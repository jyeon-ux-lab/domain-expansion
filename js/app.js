import { analyzeHand, CONNECTIONS } from './hand.js';
import { characters } from './characters/index.js';
import { createAsciiRenderer, clearCanvas } from './fx/ascii.js';
import { unlockAudio, playSound } from './fx/audio.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const video = $('video');
const fxCanvas = $('fx');
const overlay = $('overlay');
const asciiCanvas = $('ascii');
const fx = fxCanvas.getContext('2d');
const ov = overlay.getContext('2d');
const renderAscii = createAsciiRenderer(asciiCanvas);

const params = new URLSearchParams(location.search);
const state = {
  character: characters.find((c) => c.id === params.get('c')) || characters[0],
  landmarker: null,
  facing: 'user',
  stream: null,
  sound: true,
  asciiMode: false,
  debug: params.has('debug'),
  charge: 0,
  chargePos: null,
  domain: null, // { fx, t, char, ended }
  cooldown: 0,
  hands: [],
  lastVideoTime: -1,
  w: 0, h: 0, dpr: 1,
  lastAscii: 0,
};

// ---------------------------------------------------------------- UI setup
function renderChips() {
  const box = $('charChips');
  box.innerHTML = '';
  for (const c of characters) {
    const b = document.createElement('button');
    b.className = 'chip' + (c === state.character ? ' active' : '');
    b.textContent = `${c.name} · ${c.domain}`;
    b.onclick = () => { state.character = c; renderChips(); };
    box.appendChild(b);
  }
  $('hint').innerHTML = state.character.hint;
  document.documentElement.style.setProperty('--accent', state.character.accent);
}
renderChips();

const toggle = (btn, on) => btn.classList.toggle('on', on);
toggle($('btnSound'), state.sound);
toggle($('btnDebug'), state.debug);
$('debug').hidden = !state.debug;

$('btnSound').onclick = () => { state.sound = !state.sound; toggle($('btnSound'), state.sound); if (state.sound) unlockAudio(); };
$('btnDebug').onclick = () => { state.debug = !state.debug; toggle($('btnDebug'), state.debug); $('debug').hidden = !state.debug; };
$('btnAscii').onclick = () => { state.asciiMode = !state.asciiMode; toggle($('btnAscii'), state.asciiMode); };
$('btnFlip').onclick = async () => {
  state.facing = state.facing === 'user' ? 'environment' : 'user';
  await startCamera().catch(showError);
};
$('btnPreview').onclick = () => {
  if (state.sound) unlockAudio();
  triggerDomain({ x: state.w / 2, y: state.h / 2 });
};
stage.addEventListener('pointerdown', (e) => {
  if (!state.domain || e.target.closest('button')) return;
  // tap to end the domain early
  state.domain.t = Math.max(state.domain.t, state.domain.fx.duration - 0.7);
});

$('btnStart').onclick = async () => {
  const btn = $('btnStart');
  btn.disabled = true;
  unlockAudio();
  try {
    setStatus('카메라를 켜는 중…');
    await startCamera();
    setStatus('손 추적 모델을 불러오는 중… (처음 한 번은 몇 초 걸려요)');
    await loadLandmarker();
    setStatus('');
    $('start').classList.add('gone');
  } catch (err) {
    showError(err);
    btn.disabled = false;
  }
};

function setStatus(t) { $('status').textContent = t; }
function showError(err) {
  console.error(err);
  let msg = '문제가 생겼어요: ' + (err && err.message ? err.message : err);
  if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
    msg = '카메라 권한이 막혀 있어요. 주소창의 설정(aA 또는 자물쇠 아이콘)에서 카메라를 허용한 뒤 새로고침해 주세요.';
  } else if (!window.isSecureContext) {
    msg = '카메라는 https 주소에서만 켜져요.';
  } else if (err && err.name === 'NotFoundError') {
    msg = '카메라를 찾지 못했어요.';
  }
  setStatus(msg);
}

// ---------------------------------------------------------------- camera + model
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라를 지원하지 않아요.');
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  state.stream = stream;
  video.srcObject = stream;
  video.classList.toggle('no-mirror', state.facing !== 'user');
  await video.play();
}

async function loadLandmarker() {
  if (state.landmarker) return;
  const { FilesetResolver, HandLandmarker } = await import('../vendor/mediapipe/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm', import.meta.url).href);
  const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL('../models/hand_landmarker.task', import.meta.url).href, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    state.landmarker = await make('GPU');
  } catch (e) {
    console.warn('GPU delegate failed, using CPU', e);
    state.landmarker = await make('CPU');
  }
}

// ---------------------------------------------------------------- geometry
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = stage.clientWidth, h = stage.clientHeight;
  if (w === state.w && h === state.h && dpr === state.dpr) return;
  Object.assign(state, { w, h, dpr });
  for (const c of [fxCanvas, overlay]) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Map a normalized landmark to screen coordinates, matching object-fit: cover + mirroring.
function toScreen(l) {
  const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
  const s = Math.max(state.w / vw, state.h / vh);
  const dx = (state.w - vw * s) / 2, dy = (state.h - vh * s) / 2;
  let x = l.x * vw * s + dx;
  if (state.facing === 'user') x = state.w - x;
  return { x, y: l.y * vh * s + dy };
}

// ---------------------------------------------------------------- domain
function triggerDomain(origin) {
  if (state.domain) return;
  const char = state.character;
  const d = char.createDomain({ w: state.w, h: state.h, origin });
  state.domain = { fx: d, t: 0, char, subs: [] };
  state.charge = 0;
  document.body.classList.add('in-domain');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
  if (navigator.vibrate) navigator.vibrate([60, 40, 160]);
  if (state.sound) playSound(char.sound, d.duration);
  state.domain.subs = showSubtitles(char.subtitles || []);
}

// Subtitles are driven by the domain clock so they stay in sync on slow devices.
function showSubtitles(lines) {
  const box = $('subtitles');
  box.innerHTML = '';
  return lines.map((line) => {
    const el = document.createElement('div');
    el.className = `sub ${line.cls || 'line'}`;
    el.textContent = line.text;
    box.appendChild(el);
    return { el, line };
  });
}

function updateSubtitles(d) {
  for (const { el, line } of d.subs) {
    el.classList.toggle('show', d.t >= line.at);
    el.classList.toggle('hide', !!line.until && d.t >= line.until);
  }
}

function endDomain() {
  state.domain = null;
  state.cooldown = 1.5;
  fx.clearRect(0, 0, state.w, state.h);
  document.body.classList.remove('in-domain');
  const box = $('subtitles');
  [...box.children].forEach((el) => el.classList.add('hide'));
  setTimeout(() => { if (!state.domain) box.innerHTML = ''; }, 600);
}

// ---------------------------------------------------------------- drawing
function drawHands(dt) {
  ov.clearRect(0, 0, state.w, state.h);
  const inDomain = !!state.domain;
  const color = inDomain ? 'rgba(235,245,255,0.9)' : state.character.accent;

  for (const hand of state.hands) {
    const pts = hand.landmarks.map(toScreen);
    ov.save();
    ov.lineCap = 'round';
    ov.shadowColor = color;
    ov.shadowBlur = 12;
    ov.strokeStyle = color;
    ov.lineWidth = 2.5;
    ov.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ov.moveTo(pts[a].x, pts[a].y);
      ov.lineTo(pts[b].x, pts[b].y);
    }
    ov.stroke();
    ov.shadowBlur = 0;
    pts.forEach((p, i) => {
      ov.fillStyle = [4, 8, 12, 16, 20].includes(i) ? '#fff' : color;
      ov.beginPath();
      ov.arc(p.x, p.y, [4, 8, 12, 16, 20].includes(i) ? 4.5 : 3, 0, Math.PI * 2);
      ov.fill();
    });
    ov.restore();
  }

  // charge ring around the hand that is making the sign
  if (!inDomain && state.charge > 0.02 && state.chargePos) {
    const { x, y } = state.chargePos;
    const r = Math.min(state.w, state.h) * 0.16;
    ov.save();
    ov.strokeStyle = 'rgba(255,255,255,0.18)';
    ov.lineWidth = 4;
    ov.beginPath();
    ov.arc(x, y, r, 0, Math.PI * 2);
    ov.stroke();
    ov.strokeStyle = state.character.accent;
    ov.shadowColor = state.character.accent;
    ov.shadowBlur = 16;
    ov.lineWidth = 5;
    ov.beginPath();
    ov.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.charge);
    ov.stroke();
    ov.restore();
  }
}

function updateDebug(results) {
  if (!state.debug) return;
  if (!results.length) { $('debug').textContent = '손이 안 보여요'; return; }
  $('debug').textContent = results
    .map((r, i) => `손 ${i + 1} ${r.match ? '✅ 인식' : ''}\n` +
      Object.entries(r.debug).map(([k, v]) => `  ${k}: ${v === true ? 'O' : v === false ? '·' : v}`).join('\n'))
    .join('\n') + `\n충전 ${(state.charge * 100) | 0}%`;
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.05, rawDt);
  last = now;
  resize();

  // hand tracking
  if (state.landmarker && video.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    try {
      const res = state.landmarker.detectForVideo(video, now);
      state.hands = (res.landmarks || []).map((landmarks) => ({ landmarks }));
    } catch (e) {
      console.warn(e);
    }
  }

  // gesture → charge
  const aspect = (video.videoWidth || 1) / (video.videoHeight || 1);
  const results = state.hands.map((h) => state.character.detect(analyzeHand(h.landmarks, aspect)));
  updateDebug(results);
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (!state.domain) {
    const idx = results.findIndex((r) => r.match);
    if (idx >= 0 && state.cooldown === 0) {
      state.charge = Math.min(1, state.charge + dt / state.character.holdSeconds);
      const lm = state.hands[idx].landmarks;
      state.chargePos = toScreen({ x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 });
      if (state.charge >= 1) triggerDomain(state.chargePos);
    } else {
      state.charge = Math.max(0, state.charge - dt / 0.35);
    }
  }

  // domain effect
  let asciiOn = state.asciiMode;
  let asciiOpts = { color: [190, 235, 255], alpha: 0.9 };
  if (state.domain) {
    const d = state.domain;
    d.t += Math.min(0.1, rawDt);
    updateSubtitles(d);
    const done = d.fx.render(fx, d.t, dt);
    const ac = d.char.asciiCamera;
    if (ac && d.t >= ac.from && d.t < d.fx.duration - 0.6) {
      asciiOn = true;
      asciiOpts = { color: ac.color, alpha: ac.alpha };
    }
    if (done) endDomain();
  }

  asciiCanvas.classList.toggle('on', asciiOn);
  video.style.opacity = state.asciiMode && !state.domain ? '0' : '1';
  if (asciiOn && now - state.lastAscii > 50) {
    state.lastAscii = now;
    renderAscii(video, { w: state.w, h: state.h, dpr: state.dpr, mirror: state.facing === 'user', ...asciiOpts });
  } else if (!asciiOn && state.lastAscii) {
    state.lastAscii = 0;
    clearCanvas(asciiCanvas);
  }

  drawHands(dt);
}
requestAnimationFrame(frame);

// Exposed for quick testing from the console.
window.__domain = { state, triggerDomain, analyzeHand, characters };
