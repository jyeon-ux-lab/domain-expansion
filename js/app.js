import { analyzeHand, CONNECTIONS } from './hand.js';
import { characters } from './characters/index.js';
import { createAsciiRenderer, clearCanvas } from './fx/ascii.js';
import { unlockAudio, playTick, playTrack } from './fx/audio.js';

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
  forcePreview: false, // preview button simulates holding the sign until it triggers
  lastTick: -1,
};
const TICKS = 4; // clock ticks while the sign is held (the charge ring is the clock face)

// ---------------------------------------------------------------- UI setup
const GOLD = '#d4ae6a';

function renderRail() {
  const box = $('rail');
  box.innerHTML = '';
  for (const c of characters) {
    const b = document.createElement('button');
    b.className = 'rail-item' + (c === state.character ? ' active' : '');
    b.title = `${c.name} · ${c.domain}`;
    b.innerHTML = `<span class="emblem">${c.emblem || ''}</span><span class="name"></span>`;
    b.querySelector('.name').textContent = c.short || c.name;
    b.onclick = () => { state.character = c; renderRail(); };
    box.appendChild(b);
  }
  $('hint').innerHTML = state.character.hint;
  $('hintTitle').textContent = `HAND SIGN · ${state.character.domain}`;
  $('startEmblem').innerHTML = state.character.emblem || '';
}
renderRail();

// Decorative strip of invented glyphs (deterministic, original) under the start title.
function glyphStrip(count = 14, seed = 7) {
  let a = seed;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const parts = [
    (x) => `M${x + 2} 2V18`, (x) => `M${x + 12} 2V18`, (x) => `M${x + 2} 3H${x + 13}`, (x) => `M${x + 2} 17H${x + 13}`,
    (x) => `M${x + 2} 10H${x + 10}`, (x) => `M${x + 2} 18L${x + 13} 2`, (x) => `M${x + 3} 2Q${x + 14} 10 ${x + 3} 18`,
    (x) => `M${x + 12} 4Q${x + 1} 10 ${x + 12} 16`, (x) => `M${x + 7} 6V14`, (x) => `M${x + 4} 6L${x + 7} 9L${x + 10} 6`,
  ];
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = i * 18;
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) d += parts[Math.floor(rnd() * parts.length)](x);
  }
  return `<svg viewBox="0 0 ${count * 18} 20" preserveAspectRatio="xMinYMid meet"><path d="${d}"/></svg>`;
}
$('glyphs').innerHTML = glyphStrip();

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
  if (state.domain) return;
  state.cooldown = 0;
  state.forcePreview = true;
};
stage.addEventListener('pointerdown', (e) => {
  const d = state.domain;
  if (!d || e.target.closest('button') || d.t < d.delay + 1) return;
  // tap to end the domain early
  d.t = Math.max(d.t, d.delay + d.fx.duration - 0.7);
  d.music.stop(0.6);
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
  const delay = char.timeStop || 0; // a beat of frozen silence before the drop
  state.domain = { fx: d, t: 0, delay, dropped: false, char, subs: [], music: { stop() {} } };
  state.charge = 0;
  state.forcePreview = false;
  document.body.classList.add('in-domain');
  if (delay > 0) {
    stage.classList.add('timestop');
    video.pause();
  }
  if (state.sound) state.domain.music = playTrack(char.sound, d.duration, delay);
  state.domain.subs = showSubtitles(char.subtitles || []);
}

function onDrop() {
  stage.classList.remove('timestop', 'shake');
  video.play().catch(() => {});
  void stage.offsetWidth;
  stage.classList.add('shake');
  if (navigator.vibrate) navigator.vibrate([80, 40, 200]);
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

function updateSubtitles(d, t) {
  for (const { el, line } of d.subs) {
    el.classList.toggle('show', t >= line.at);
    el.classList.toggle('hide', !!line.until && t >= line.until);
  }
}

function endDomain() {
  state.domain = null;
  stage.classList.remove('timestop');
  if (video.paused) video.play().catch(() => {});
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
  const color = inDomain ? 'rgba(235,245,255,0.9)' : 'rgba(240,232,220,0.85)';
  const joint = inDomain ? 'rgba(235,245,255,0.9)' : GOLD;

  for (const hand of state.hands) {
    const pts = hand.landmarks.map(toScreen);
    ov.save();
    ov.lineCap = 'round';
    ov.shadowColor = inDomain ? color : 'rgba(212,174,106,0.6)';
    ov.shadowBlur = 10;
    ov.strokeStyle = color;
    ov.lineWidth = 1.8;
    ov.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ov.moveTo(pts[a].x, pts[a].y);
      ov.lineTo(pts[b].x, pts[b].y);
    }
    ov.stroke();
    ov.shadowBlur = 0;
    pts.forEach((p, i) => {
      const tip = [4, 8, 12, 16, 20].includes(i);
      ov.fillStyle = tip ? '#fff' : joint;
      ov.beginPath();
      ov.arc(p.x, p.y, tip ? 4 : 2.6, 0, Math.PI * 2);
      ov.fill();
    });
    ov.restore();
  }

  // charge ring around the hand that is making the sign
  if (!inDomain && state.charge > 0.02 && state.chargePos) {
    const { x, y } = state.chargePos;
    const r = Math.min(state.w, state.h) * 0.16;
    ov.save();
    ov.strokeStyle = 'rgba(236,228,214,0.22)';
    ov.lineWidth = 1;
    ov.beginPath();
    ov.arc(x, y, r, 0, Math.PI * 2);
    ov.stroke();
    // clock face: 12 marks, the filled arc and a hand
    ov.strokeStyle = 'rgba(236,228,214,0.6)';
    ov.lineWidth = 1.2;
    ov.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = r * (i % 3 === 0 ? 0.8 : 0.88);
      ov.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ov.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
    }
    ov.stroke();
    const end = -Math.PI / 2 + Math.PI * 2 * state.charge;
    // outer thin frame ring
    ov.beginPath();
    ov.arc(x, y, r * 1.12, 0, Math.PI * 2);
    ov.stroke();
    ov.strokeStyle = GOLD;
    ov.shadowColor = GOLD;
    ov.shadowBlur = 14;
    ov.lineWidth = 3;
    ov.beginPath();
    ov.arc(x, y, r, -Math.PI / 2, end);
    ov.stroke();
    ov.lineWidth = 1.6;
    ov.beginPath();
    ov.moveTo(x, y);
    ov.lineTo(x + Math.cos(end) * r * 0.72, y + Math.sin(end) * r * 0.72);
    ov.stroke();
    ov.restore();
  }
}

function updateDebug(results, pair) {
  if (!state.debug) return;
  if (!results.length) { $('debug').textContent = '손이 안 보여요'; return; }
  const fmt = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v === true ? 'O' : v === false ? '·' : v}`).join('\n');
  let text = results.map((r, i) => `손 ${i + 1} ${r.match ? '✅ 인식' : ''}\n${fmt(r.debug)}`).join('\n');
  if (pair) text += `\n두 손 ${pair.match ? '✅ 인식' : ''}\n${fmt(pair.debug)}`;
  $('debug').textContent = text + `\n충전 ${(state.charge * 100) | 0}%`;
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
  const analyzed = state.hands.map((h) => analyzeHand(h.landmarks, aspect));
  const results = analyzed.map((a) => state.character.detect(a));
  const pair = analyzed.length >= 2 && state.character.detectPair
    ? state.character.detectPair(analyzed[0], analyzed[1]) : null;
  updateDebug(results, pair);
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (!state.domain) {
    const idx = results.findIndex((r) => r.match);
    const forced = state.forcePreview;
    const pairMatch = !!(pair && pair.match);
    if ((idx >= 0 || pairMatch || forced) && state.cooldown === 0) {
      state.charge = Math.min(1, state.charge + dt / state.character.holdSeconds);
      if (pairMatch) {
        const [l1, l2] = [state.hands[0].landmarks, state.hands[1].landmarks];
        state.chargePos = toScreen({
          x: (l1[0].x + l1[9].x + l2[0].x + l2[9].x) / 4,
          y: (l1[0].y + l1[9].y + l2[0].y + l2[9].y) / 4,
        });
      } else if (idx >= 0) {
        const lm = state.hands[idx].landmarks;
        state.chargePos = toScreen({ x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 });
      } else {
        state.chargePos = { x: state.w / 2, y: state.h * 0.45 };
      }
      // tick-tock as the ring fills; silence once it is full
      const tick = Math.min(TICKS - 1, Math.floor(state.charge * TICKS));
      if (state.charge < 1 && tick > state.lastTick) {
        state.lastTick = tick;
        if (state.sound) playTick();
      }
      if (state.charge >= 1) triggerDomain(state.chargePos);
    } else {
      // decay slowly so a flickering detection does not reset the clock
      state.charge = Math.max(0, state.charge - dt / 0.9);
    }
    if (state.charge === 0 || state.domain) state.lastTick = -1;
    else state.lastTick = Math.min(state.lastTick, Math.floor(state.charge * TICKS));
  }

  // domain effect
  let asciiOn = state.asciiMode;
  let asciiOpts = { color: [190, 235, 255], alpha: 0.9 };
  if (state.domain) {
    const d = state.domain;
    d.t += Math.min(0.1, rawDt);
    const ft = d.t - d.delay; // effect time; negative during the frozen beat
    if (ft >= 0 && !d.dropped) { d.dropped = true; onDrop(); }
    updateSubtitles(d, ft);
    const done = ft >= 0 ? d.fx.render(fx, ft, dt) : false;
    const ac = d.char.asciiCamera;
    if (ac && ft >= ac.from && ft < d.fx.duration - 0.6) {
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
