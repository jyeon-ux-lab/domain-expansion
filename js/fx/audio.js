// Procedural sound engine (Web Audio). Every sound here is synthesized in code:
// no audio files, samples or existing songs are used.
let ac = null;
let master = null;
let reverbSend = null;

function setupGraph() {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  // brick-wall-ish limiter after the glue compressor
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  comp.connect(limiter).connect(ac.destination);
  master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(comp);
  const reverb = ac.createConvolver();
  reverb.buffer = impulse(2.6);
  reverbSend = ac.createGain();
  reverbSend.gain.value = 0.5;
  reverbSend.connect(reverb).connect(master);
}

export function unlockAudio() {
  try {
    // iOS: play through the silent switch like a media app would.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      setupGraph();
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (_) { /* audio is optional */ }
}

// ------------------------------------------------------------------ helpers
function impulse(seconds) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

let driveCurve = null;
function drive() {
  if (!driveCurve) {
    driveCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      driveCurve[i] = Math.tanh(x * 3.2);
    }
  }
  const ws = ac.createWaveShaper();
  ws.curve = driveCurve;
  return ws;
}

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// A "bus" is one playback: everything routes through it so it can be faded out as a whole.
function bus() {
  const out = ac.createGain();
  out.connect(master);
  const send = ac.createGain();
  send.gain.value = 1;
  send.connect(reverbSend);
  return { out, send };
}

// ------------------------------------------------------------------ instruments
function sub808({ out }, t, freq, len, glideTo) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + len * 0.85);
  const ws = drive();
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.setValueAtTime(0.5, t + len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(ws).connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.05);
}

// Deep, driven kick tuned for phone speakers: sub sine plus a mid "thump" layer, no bright click.
function boom({ out }, t, vol = 1) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
  env(g, t, 0.9 * vol, 0.004, 0.6);
  o.connect(drive()).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.7);
  const m = ac.createOscillator();
  const mg = ac.createGain();
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  m.type = 'triangle';
  m.frequency.setValueAtTime(190, t);
  m.frequency.exponentialRampToValueAtTime(70, t + 0.07);
  env(mg, t, 0.55 * vol, 0.002, 0.09);
  m.connect(lp).connect(mg).connect(out);
  m.start(t);
  m.stop(t + 0.15);
}

// Big low hit ("쿵"): kick + a dark, low noise body with a short room tail.
function slam(b, t, vol = 1) {
  boom(b, t, vol);
  const n = noise();
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(250, t + 0.25);
  const g = ac.createGain();
  env(g, t, 0.5 * vol, 0.003, 0.28);
  n.connect(lp).connect(g);
  g.connect(b.out);
  g.connect(b.send);
  n.start(t, Math.random());
  n.stop(t + 0.35);
  const o = ac.createOscillator();
  const og = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(96, t);
  o.frequency.exponentialRampToValueAtTime(62, t + 0.3);
  env(og, t, 0.5 * vol, 0.003, 0.35);
  o.connect(og).connect(b.out);
  o.start(t);
  o.stop(t + 0.4);
}

// Air-cutting slash: a fast downward noise sweep (kept in the mids) with a low thud.
function swish({ out, send }, t, vol = 1) {
  const n = noise();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(1800, t);
  bp.frequency.exponentialRampToValueAtTime(350, t + 0.14);
  const g = ac.createGain();
  env(g, t, 0.55 * vol, 0.004, 0.16);
  n.connect(bp).connect(g);
  g.connect(out);
  g.connect(send);
  n.start(t, Math.random());
  n.stop(t + 0.22);
}

function impact({ out, send }, t) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
  env(g, t, 1, 0.005, 2.0);
  o.connect(drive()).connect(g).connect(out);
  o.start(t);
  o.stop(t + 2.2);
  // wide noise wash
  const n = noise();
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2800, t);
  f.frequency.exponentialRampToValueAtTime(200, t + 2.5);
  const ng = ac.createGain();
  env(ng, t, 0.3, 0.005, 2.6);
  n.connect(f).connect(ng);
  ng.connect(out);
  ng.connect(send);
  n.start(t);
  n.stop(t + 2.8);
}

// ------------------------------------------------------------------ public: clock tick
let tickToggle = false;
export function playTick(at) {
  if (!ac) return;
  const t = at ?? ac.currentTime + 0.005;
  tickToggle = !tickToggle;
  const n = noise();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = tickToggle ? 3400 : 2500;
  bp.Q.value = 8;
  const g = ac.createGain();
  env(g, t, 3.6, 0.001, 0.035);
  n.connect(bp).connect(g);
  g.connect(master);
  g.connect(reverbSend);
  n.start(t, Math.random());
  n.stop(t + 0.06);
  const o = ac.createOscillator();
  const og = ac.createGain();
  o.type = 'square';
  o.frequency.value = tickToggle ? 1900 : 1400;
  env(og, t, 0.22, 0.001, 0.015);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + 0.03);
}

// ------------------------------------------------------------------ public: heartbeat
export function playHeart(at) {
  if (!ac) return;
  const t = at ?? ac.currentTime + 0.005;
  for (const [dt, vol] of [[0, 1], [0.17, 0.7]]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t + dt);
    o.frequency.exponentialRampToValueAtTime(45, t + dt + 0.12);
    env(g, t + dt, 1.1 * vol, 0.006, 0.2);
    o.connect(drive()).connect(g).connect(master);
    o.start(t + dt);
    o.stop(t + dt + 0.3);
  }
}

// ------------------------------------------------------------------ public: tracks
const N = { F1: 43.65, G1: 49, Ab1: 51.91, A1: 55, Bb1: 58.27, D2: 73.42 };

const tracks = {
  // Low, heavy groove: "du-dum du-dum, boom, boom" kicks over a driven 808. 96 BPM, 4 bars.
  // Nothing above the low-mids, so there is no bright or ringing sound.
  void(b, t0, duration) {
    const bpm = 96;
    const step = 60 / bpm / 4; // 16th note
    const bars = Math.max(1, Math.round(duration / (step * 16)));
    impact(b, t0);

    const roots = [N.D2, N.D2, N.Bb1, N.A1];
    for (let bar = 0; bar < bars; bar++) {
      const tb = t0 + bar * step * 16;
      const at = (s) => tb + s * step;
      const last = bar === bars - 1;

      // du-dum du-dum
      boom(b, at(0), 0.7); boom(b, at(1), 1);
      boom(b, at(4), 0.7); boom(b, at(5), 1);
      // boom, boom (last bar rolls into a fill)
      if (last) [8, 10, 12, 13, 14, 15].forEach((s, i) => slam(b, at(s), 0.75 + i * 0.05));
      else { slam(b, at(8)); slam(b, at(12)); }

      // 808 underneath, gliding down at the very end
      sub808(b, tb, roots[bar % 4], step * 8, null);
      sub808(b, at(8), roots[bar % 4], step * 8, last ? roots[bar % 4] / 2 : null);
    }
  },

  // Slow, menacing groove: half-time slams, rolling low kicks and a slash on every cut. 84 BPM.
  shrine(b, t0, duration, { bpm = 84, slashTimes = [] } = {}) {
    const step = 60 / bpm / 4;
    const bars = Math.max(1, Math.ceil(duration / (step * 16)));
    impact(b, t0);
    const roots = [N.G1, N.G1, N.Ab1, N.F1];
    for (let bar = 0; bar < bars; bar++) {
      const tb = t0 + bar * step * 16;
      const at = (s) => tb + s * step;
      if (at(0) > t0 + duration - 0.5) break;
      slam(b, at(0), 1);
      boom(b, at(3), 0.6); boom(b, at(6), 0.8); boom(b, at(7), 0.6);
      slam(b, at(8), 0.95);
      boom(b, at(11), 0.6); boom(b, at(14), 0.7); boom(b, at(15), 0.85);
      sub808(b, tb, roots[bar % 4], step * 14, roots[bar % 4] * 0.94);
    }
    for (const s of slashTimes) if (s < duration - 0.8) swish(b, t0 + s, 0.9);
  },
};

/**
 * Starts a track `offset` seconds from now. Returns a handle with stop(fadeSeconds).
 */
export function playTrack(name, duration, offset = 0, opts = {}) {
  if (!ac || !tracks[name]) return { stop() {} };
  try {
    const b = bus();
    const t0 = ac.currentTime + offset + 0.02;
    b.out.gain.setValueAtTime(1, t0);
    b.out.gain.setValueAtTime(1, t0 + duration - 1.2);
    b.out.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    b.send.gain.setValueAtTime(1, t0 + duration - 1.2);
    b.send.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    tracks[name](b, t0, duration, opts);
    const disconnect = () => { try { b.out.disconnect(); b.send.disconnect(); } catch (_) {} };
    const timer = setTimeout(disconnect, (offset + duration + 3) * 1000);
    return {
      stop(fade = 0.5) {
        const now = ac.currentTime;
        for (const g of [b.out.gain, b.send.gain]) {
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(0.0001, now + fade);
        }
        clearTimeout(timer);
        setTimeout(disconnect, (fade + 3) * 1000);
      },
    };
  } catch (_) {
    return { stop() {} };
  }
}

/**
 * Renders the full sequence (ticks, frozen beat, track) offline into an AudioBuffer.
 * Used for previews/tests; does not touch the live audio context.
 */
export async function renderPreview(name, duration, { ticks = 4, tickGap = 0.325, stopGap = 0.5, charge = 'tick', opts = {} } = {}) {
  const saved = [ac, master, reverbSend, noiseBuf];
  const sr = 44100;
  const total = ticks * tickGap + stopGap + duration + 0.5;
  try {
    ac = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    noiseBuf = null;
    setupGraph();
    for (let i = 0; i < ticks; i++) (charge === 'heart' ? playHeart : playTick)(0.05 + i * tickGap);
    playTrack(name, duration, ticks * tickGap + stopGap, opts);
    return await ac.startRendering();
  } finally {
    [ac, master, reverbSend, noiseBuf] = saved;
  }
}
