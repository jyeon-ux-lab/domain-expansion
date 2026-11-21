// Small procedural sound engine (Web Audio). No audio files are used.
let ac = null;
let master = null;

export function unlockAudio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.7;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (_) { /* audio is optional */ }
}

function noiseBuffer(seconds) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

const sounds = {
  // Deep impact, reverse whoosh and a shimmering, slowly breathing pad.
  void(duration) {
    const t0 = ac.currentTime;
    const out = ac.createGain();
    out.gain.setValueAtTime(1, t0);
    out.gain.setValueAtTime(1, t0 + duration - 1.2);
    out.gain.linearRampToValueAtTime(0, t0 + duration);
    out.connect(master);

    // impact
    const boom = ac.createOscillator();
    const bg = ac.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, t0);
    boom.frequency.exponentialRampToValueAtTime(32, t0 + 1.2);
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
    boom.connect(bg).connect(out);
    boom.start(t0);
    boom.stop(t0 + 2);

    // whoosh
    const n = ac.createBufferSource();
    n.buffer = noiseBuffer(2);
    const nf = ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.Q.value = 0.8;
    nf.frequency.setValueAtTime(300, t0);
    nf.frequency.exponentialRampToValueAtTime(4000, t0 + 1.0);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.35, t0 + 0.25);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    n.connect(nf).connect(ng).connect(out);
    n.start(t0);

    // pad
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t0 + 0.6);
    lp.frequency.linearRampToValueAtTime(1600, t0 + 3.5);
    const pg = ac.createGain();
    pg.gain.setValueAtTime(0.0001, t0 + 0.5);
    pg.gain.linearRampToValueAtTime(0.12, t0 + 2.0);
    lp.connect(pg).connect(out);
    [55, 82.4, 110.2, 164.8].forEach((f, i) => {
      for (const det of [-6, 6]) {
        const o = ac.createOscillator();
        o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t0 + 0.5);
        o.stop(t0 + duration);
      }
    });

    // glassy bells
    for (let k = 0; k < 14; k++) {
      const at = t0 + 1.0 + Math.random() * (duration - 2.5);
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = [880, 1174.7, 1318.5, 1760, 2349.3][(Math.random() * 5) | 0];
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 1.5);
    }
  },
};

export function playSound(name, duration) {
  if (!ac || !sounds[name]) return;
  try { sounds[name](duration); } catch (_) { /* ignore */ }
}
