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
function kick({ out }, t, vol = 1) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.95 * vol, 0.003, 0.42);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.5);
  // beater click
  const n = noise();
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2500;
  const ng = ac.createGain();
  env(ng, t, 0.25 * vol, 0.001, 0.02);
  n.connect(f).connect(ng).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.05);
}

function snare({ out, send }, t, vol = 1) {
  const n = noise();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.7;
  const ng = ac.createGain();
  env(ng, t, 0.55 * vol, 0.002, 0.2);
  n.connect(bp).connect(ng);
  ng.connect(out);
  ng.connect(send);
  n.start(t, Math.random());
  n.stop(t + 0.3);
  const o = ac.createOscillator();
  const og = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  env(og, t, 0.45 * vol, 0.002, 0.12);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function hat({ out }, t, open = false, vol = 1) {
  const n = noise();
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  const g = ac.createGain();
  env(g, t, (open ? 0.16 : 0.12) * vol, 0.001, open ? 0.28 : 0.045);
  n.connect(hp).connect(g).connect(out);
  n.start(t, Math.random());
  n.stop(t + (open ? 0.35 : 0.08));
}

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

// Plucked-string lead with a little pitch bend on the attack (koto-like, synthesized).
function pluck({ out, send }, t, freq, vol = 1) {
  const g = ac.createGain();
  env(g, t, 0.22 * vol, 0.003, 1.3);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 3;
  lp.frequency.setValueAtTime(4200, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
  for (const [type, mul, lvl] of [['triangle', 1, 1], ['sawtooth', 2, 0.25]]) {
    const o = ac.createOscillator();
    const og = ac.createGain();
    og.gain.value = lvl;
    o.type = type;
    o.frequency.setValueAtTime(freq * mul * 1.03, t);
    o.frequency.exponentialRampToValueAtTime(freq * mul, t + 0.04);
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + 1.4);
  }
  lp.connect(g);
  g.connect(out);
  g.connect(send);
}

// Breathy "choir" pad: detuned saws through a vowel-ish band-pass.
function pad({ out, send }, t, freqs, len, vol = 1) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.5);
  g.gain.setValueAtTime(0.09 * vol, t + len - 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 750;
  f1.Q.value = 1.2;
  const f2 = ac.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.value = 2000;
  for (const f of freqs) {
    for (const det of [-9, 0, 9]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(f1);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  }
  f1.connect(f2).connect(g);
  g.connect(out);
  g.connect(send);
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
  f.frequency.setValueAtTime(9000, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 2.5);
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

// ------------------------------------------------------------------ public: tracks
const N = {
  A1: 55, Bb1: 58.27, G1: 49, D2: 73.42,
  G3: 196, A3: 220, D3: 146.83, F3: 174.61, Bb2: 116.54, G2: 98, A2: 110, C3: 130.81, Eb3: 155.56,
  D4: 293.66, Eb4: 311.13, G4: 392, A4: 440, Bb4: 466.16, D5: 587.33, Eb5: 622.25, G5: 783.99,
};

const tracks = {
  // Dark boom-bap groove, drums + 808 bass only, 96 BPM, 4 bars.
  void(b, t0, duration) {
    const bpm = 96;
    const step = 60 / bpm / 4; // 16th note
    const bars = Math.max(1, Math.round(duration / (step * 16)));
    impact(b, t0);

    const roots = [[N.D2], [N.Bb1], [N.G1], [N.A1, N.D2]];
    for (let bar = 0; bar < bars; bar++) {
      const tb = t0 + bar * step * 16;
      const last = bar === bars - 1;
      const swing = (s) => tb + s * step + (s % 2 === 1 ? step * 0.28 : 0);

      // drums
      const kicks = last ? [0, 3, 10, 11] : [0, 7, 10];
      kicks.forEach((s) => kick(b, swing(s), s === 0 ? 1 : 0.8));
      [4, 12].forEach((s) => snare(b, swing(s)));
      for (let s = 0; s < 16; s += 2) hat(b, swing(s), false, s % 4 === 0 ? 1 : 0.7);
      for (let s = 1; s < 16; s += 4) hat(b, swing(s), false, 0.4);
      if (bar % 2 === 1) hat(b, swing(14), true);
      if (last) [13, 14, 15].forEach((s) => hat(b, swing(s), false, 0.6));

      // 808 bass
      const r = roots[bar % 4];
      sub808(b, tb, r[0], step * 7, null);
      sub808(b, swing(10), r[0], step * 6, r[1] || null);
    }
  },
};

/**
 * Starts a track `offset` seconds from now. Returns a handle with stop(fadeSeconds).
 */
export function playTrack(name, duration, offset = 0) {
  if (!ac || !tracks[name]) return { stop() {} };
  try {
    const b = bus();
    const t0 = ac.currentTime + offset + 0.02;
    b.out.gain.setValueAtTime(1, t0);
    b.out.gain.setValueAtTime(1, t0 + duration - 1.2);
    b.out.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    b.send.gain.setValueAtTime(1, t0 + duration - 1.2);
    b.send.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    tracks[name](b, t0, duration);
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
export async function renderPreview(name, duration, { ticks = 4, tickGap = 0.325, stopGap = 0.5 } = {}) {
  const saved = [ac, master, reverbSend, noiseBuf];
  const sr = 44100;
  const total = ticks * tickGap + stopGap + duration + 0.5;
  try {
    ac = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    noiseBuf = null;
    setupGraph();
    for (let i = 0; i < ticks; i++) playTick(0.05 + i * tickGap);
    playTrack(name, duration, ticks * tickGap + stopGap);
    return await ac.startRendering();
  } finally {
    [ac, master, reverbSend, noiseBuf] = saved;
  }
}
