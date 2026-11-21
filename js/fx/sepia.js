// Malevolent Shrine — effect type 2: an aged, sepia film-title look.
//   1. chained, riveted panels close in from both sides while a carved seal spins in the centre,
//   2. thin radial lines burst outward and ink-brush slashes cut across on the beat,
//   3. a huge eye opens; the seal shrinks into its pupil, the iris is drawn in ink strokes,
//      trigram marks sit on spokes around it. Film grain, scratches and flicker throughout.
// Everything is drawn procedurally (no external art).

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const INK = [222, 186, 142];
const ink = (a) => `rgba(${INK[0]},${INK[1]},${INK[2]},${a})`;
const DARK = '#120c07';

// The eight trigrams as [top, middle, bottom], true = solid line.
const TRIGRAMS = [
  [1, 1, 1], [0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1],
];

function trigram(ctx, x, y, size, bits) {
  const h = size * 0.16;
  const gap = size * 0.2;
  for (let i = 0; i < 3; i++) {
    const yy = y - size * 0.4 + i * (h + gap);
    if (bits[i]) ctx.fillRect(x - size / 2, yy, size, h);
    else {
      ctx.fillRect(x - size / 2, yy, size * 0.42, h);
      ctx.fillRect(x + size * 0.08, yy, size * 0.42, h);
    }
  }
}

export function createSepia({ w, h, origin, duration = 10, slashTimes = [], glyphs = '伏魔御廚子' }) {
  const small = Math.min(w, h);
  const S = small / 390;
  const cx = w / 2;
  const cy = h * 0.42;
  const maxR = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 40;
  const EXPAND = 0.9;
  const FADE = 1.0;
  const EYE = 3.2; // when the eye starts to open
  const panelW = Math.max(56, w * 0.19);

  const radial = Array.from({ length: 64 }, (_, i) => ({
    a: i < 24 ? (i / 24) * Math.PI * 2 : rand(0, Math.PI * 2),
    len: i < 24 ? 0.55 : rand(0.6, 1.4),
    lw: Math.random() < 0.06 ? rand(2, 3.5) : rand(0.5, 1.2),
    alpha: rand(0.35, 0.9),
  }));
  const iris = Array.from({ length: 240 }, () => ({
    a: rand(0, Math.PI * 2),
    r0: rand(0.38, 0.5),
    r1: rand(0.75, 1.04),
    lw: rand(0.6, 3.2),
    alpha: rand(0.25, 0.85),
    delay: rand(0, 0.6),
  }));
  const spokes = TRIGRAMS.map((tri, i) => ({ a: ((i + 0.5) / 8) * Math.PI * 2, tri }));

  const queue = [...slashTimes].sort((a, b) => a - b);
  const strokes = [];
  let dir = 1;
  let pulse = 0;
  // A dry-brush slash: a solid tapered core plus loose bristle lines with gaps.
  function spawnStroke() {
    dir = -dir;
    const ang = dir * rand(0.6, 1.05);
    const len = Math.hypot(w, h) * rand(0.85, 1.05);
    const half = rand(11, 22) * S;
    const bristles = Array.from({ length: 16 }, (_, i) => {
      const b = (i / 15) * 2 - 1;
      const edge = Math.abs(b);
      return {
        b: b + rand(-0.05, 0.05),
        f0: rand(0, 0.1 + edge * 0.25),
        f1: rand(0.78 - edge * 0.3, 1),
        lw: rand(0.8, 2.4) * S,
        a: rand(0.45, 1),
        gap: Math.random() < 0.45 ? [rand(0.2, 0.7), rand(0.04, 0.14)] : null,
      };
    });
    strokes.push({
      ox: rand(w * 0.3, w * 0.7), oy: rand(h * 0.3, h * 0.7),
      ang, len, half, bristles, wob: rand(0, 6.28), bend: rand(-0.05, 0.05), age: 0, life: 0.5,
    });
    pulse = 1;
  }

  function drawPanel(ctx, x, flip, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#1b130b';
    ctx.fillRect(x, 0, panelW, h);
    // engraving hatch
    ctx.strokeStyle = ink(0.12);
    ctx.lineWidth = 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 0, panelW, h);
    ctx.clip();
    ctx.beginPath();
    for (let k = -h; k < panelW + h; k += 7 * S) {
      ctx.moveTo(x + k, 0);
      ctx.lineTo(x + k - h * 0.6 * flip, h);
    }
    ctx.stroke();
    // chain: links along a diagonal
    const links = Math.ceil(h / (22 * S)) + 4;
    for (let i = 0; i < links; i++) {
      const k = i / links;
      const lx = x + panelW * (flip > 0 ? 0.15 + 0.7 * k : 0.85 - 0.7 * k);
      const ly = -20 + (h + 40) * k;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(Math.atan2(h + 40, panelW * 0.7 * flip) + (i % 2 ? Math.PI / 2 : 0));
      ctx.strokeStyle = ink(0.55);
      ctx.lineWidth = 2.2 * S;
      ctx.beginPath();
      ctx.ellipse(0, 0, (i % 2 ? 5 : 11) * S, (i % 2 ? 11 : 5) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // riveted double frame
    ctx.strokeStyle = ink(0.6);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 5 * S, 5 * S, panelW - 10 * S, h - 10 * S);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 10 * S, 10 * S, panelW - 20 * S, h - 20 * S);
    ctx.fillStyle = ink(0.7);
    for (let y = 22 * S; y < h - 10 * S; y += 34 * S) {
      for (const rx of [x + 7.5 * S, x + panelW - 7.5 * S]) {
        ctx.beginPath();
        ctx.arc(rx, y, 1.8 * S, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSeal(ctx, x, y, r, spin, alpha) {
    if (r < 2) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.fillStyle = '#1e150d';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink(0.85);
    ctx.lineWidth = Math.max(1, 2 * S * (r / (small * 0.2)));
    for (const f of [1, 0.93, 0.62, 0.55, 0.22]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ticks between rings
    ctx.rotate(spin);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(Math.cos(a) * r * (k % 5 ? 0.66 : 0.72), Math.sin(a) * r * (k % 5 ? 0.66 : 0.72));
    }
    ctx.stroke();
    // micro text ring
    const fs = Math.max(6, r * 0.13);
    ctx.font = `${fs | 0}px "Noto Serif JP", "Noto Serif KR", serif`;
    ctx.fillStyle = ink(0.85);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const count = 30;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -r * 0.775);
      ctx.fillText(glyphs[k % glyphs.length], 0, 0);
      ctx.restore();
    }
    // trigrams on the inner band
    ctx.rotate(-spin * 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      trigram(ctx, 0, -r * 0.39, r * 0.12, TRIGRAMS[k]);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return {
    duration,
    render(ctx, t, dt) {
      const fadeOut = clamp01((duration - t) / FADE);
      const expand = clamp01(t / EXPAND);
      const R = easeOutCubic(expand) * maxR;
      pulse = Math.max(0, pulse - dt * 3);

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = fadeOut;
      if (expand < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, R, 0, Math.PI * 2);
        ctx.clip();
      }

      // ---- paper-dark background ----
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#2d1f13');
      bg.addColorStop(0.55, '#1a120a');
      bg.addColorStop(1, '#070402');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // big partial arcs near the edges
      ctx.strokeStyle = ink(0.35);
      ctx.lineWidth = 1.4 * S;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(w, h) * 0.62, Math.PI * 1.05 + t * 0.03, Math.PI * 1.45 + t * 0.03);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(w, h) * 0.62, Math.PI * 1.6 - t * 0.03, Math.PI * 1.9 - t * 0.03);
      ctx.stroke();

      // ---- radial lines (act 1 star, act 2 burst) ----
      const burst = easeOutCubic(clamp01((t - 1.4) / 0.8));
      const radA = t < EYE ? 1 : lerp(1, 0.35, clamp01((t - EYE) / 0.8));
      const sealR0 = small * 0.2;
      for (const l of radial) {
        const isBase = l.len === 0.55;
        const vis = isBase ? clamp01((t - 0.4) / 0.6) : burst;
        if (vis <= 0) continue;
        const r0 = sealR0 * 1.15;
        const r1 = r0 + (isBase ? Math.max(w, h) * 0.55 : Math.max(w, h) * l.len) * vis;
        ctx.strokeStyle = ink(l.alpha * radA);
        ctx.lineWidth = l.lw * S;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
        ctx.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
        ctx.stroke();
      }

      // ---- the eye ----
      const open = easeInOut(clamp01((t - EYE) / 0.9));
      const ir = small * 0.3 * (1 + pulse * 0.03);
      const ew = Math.min(w * 0.47, ir * 2.1); // half width of the eye
      const peak = ir * 0.9 * open; // lid height, a little under the iris so the lids cut it
      const lids = (top, bottom) => {
        ctx.beginPath();
        ctx.moveTo(cx - ew, cy);
        ctx.quadraticCurveTo(cx, cy - peak * 2 * top, cx + ew, cy);
        ctx.quadraticCurveTo(cx, cy + peak * 2 * bottom, cx - ew, cy);
      };
      if (open > 0) {
        // iris strokes grow outward, clipped by the lids
        const grow = clamp01((t - EYE - 0.3) / 1.2);
        ctx.save();
        lids(1, 1);
        ctx.clip();
        ctx.fillStyle = 'rgba(10, 6, 3, 0.55)';
        ctx.fillRect(cx - ew, cy - peak, ew * 2, peak * 2);
        ctx.fillStyle = '#21170e';
        ctx.beginPath();
        ctx.arc(cx, cy, ir, 0, Math.PI * 2);
        ctx.fill();
        for (const s of iris) {
          const g = clamp01((grow - s.delay * 0.5) / 0.5);
          if (g <= 0) continue;
          const a = s.a + t * 0.02;
          const r1 = ir * lerp(s.r0, s.r1, g);
          ctx.strokeStyle = ink(s.alpha);
          ctx.lineWidth = s.lw * S;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * ir * s.r0, cy + Math.sin(a) * ir * s.r0);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.strokeStyle = ink(0.75);
        ctx.lineWidth = 1.4 * S;
        ctx.beginPath();
        ctx.arc(cx, cy, ir * 1.04, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // lids: a heavy line, an upper crease and the corner tails
        ctx.strokeStyle = ink(0.9);
        ctx.lineWidth = 2.4 * S;
        lids(1, 1);
        ctx.stroke();
        ctx.strokeStyle = ink(0.45);
        ctx.lineWidth = 1 * S;
        lids(1.28, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - ew, cy);
        ctx.lineTo(cx - ew - 14 * S, cy + 3 * S);
        ctx.moveTo(cx + ew, cy);
        ctx.lineTo(cx + ew + 14 * S, cy + 3 * S);
        ctx.stroke();
        // spokes + trigrams on an ellipse that stays clear of the side panels
        const sp = clamp01((t - EYE - 0.9) / 0.6);
        if (sp > 0) {
          const rx = Math.min(ir * 1.62, w / 2 - panelW * 0.45 - 22 * S);
          const ry = ir * 1.62;
          ctx.strokeStyle = ink(0.6 * sp);
          ctx.fillStyle = ink(0.85 * sp);
          ctx.lineWidth = 1;
          for (const s of spokes) {
            const c = Math.cos(s.a), si = Math.sin(s.a);
            ctx.beginPath();
            ctx.moveTo(cx + c * ir * 1.08, cy + si * ir * 1.08);
            ctx.lineTo(cx + c * rx * 0.86, cy + si * ry * 0.86);
            ctx.stroke();
            trigram(ctx, cx + c * rx, cy + si * ry, 16 * S, s.tri);
          }
        }
      }

      // ---- seal: spins in, then shrinks into the pupil ----
      const sealIn = easeOutCubic(clamp01((t - 0.3) / 0.7));
      const toPupil = easeInOut(clamp01((t - EYE) / 1.0));
      const sealR = lerp(sealR0, ir * 0.36, toPupil) * sealIn;
      drawSeal(ctx, cx, cy, sealR, t * 0.6, 1);
      // horizontal bar marks beside the seal (act 1-2)
      if (toPupil < 1) {
        ctx.fillStyle = ink(0.8 * sealIn * (1 - toPupil));
        for (const side of [-1, 1]) {
          for (let k = 0; k < 3; k++) ctx.fillRect(cx + side * (sealR0 * 1.05) - (side > 0 ? 0 : 26 * S), cy - 9 * S + k * 7 * S, 26 * S, 2.4 * S);
        }
      }

      // ---- side panels with chains ----
      // they slide in, then pull back partway so the eye has room
      const pin = easeOutCubic(clamp01((t - 0.15) / 0.8)) - 0.55 * open;
      drawPanel(ctx, -panelW + panelW * pin, 1, 1);
      drawPanel(ctx, w - panelW * pin, -1, 1);

      // ---- ink-brush slashes on the beat ----
      while (queue.length && queue[0] <= t) { queue.shift(); spawnStroke(); }
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        s.age += dt;
        const k = s.age / s.life;
        if (k >= 1) { strokes.splice(i, 1); continue; }
        const reveal = easeOutCubic(clamp01(k * 4));
        const a = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
        const ux = Math.cos(s.ang), uy = Math.sin(s.ang);
        const nx = -uy, ny = ux;
        const sx = s.ox - ux * s.len / 2, sy = s.oy - uy * s.len / 2;
        const at = (f, off) => {
          const bend = s.bend * s.len * Math.sin(Math.PI * f) + off;
          return [sx + ux * s.len * f + nx * bend, sy + uy * s.len * f + ny * bend];
        };
        const thick = (f) => s.half * Math.pow(Math.sin(Math.PI * f), 0.6) * (0.85 + 0.15 * Math.sin(f * 9 + s.wob));
        const N = 24;
        // soft halo, then the solid core
        for (const [scale, alpha] of [[1.35, 0.16], [0.42, 0.95]]) {
          ctx.fillStyle = ink(alpha * a);
          ctx.beginPath();
          for (let j = 0; j <= N; j++) {
            const f = (j / N) * reveal;
            const [x, y] = at(f, thick(f) * scale);
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          for (let j = N; j >= 0; j--) {
            const f = (j / N) * reveal;
            const [x, y] = at(f, -thick(f) * scale);
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
        // bristles with gaps (dry brush)
        for (const b of s.bristles) {
          const f1 = Math.min(b.f1, reveal);
          if (f1 <= b.f0) continue;
          ctx.strokeStyle = ink(0.85 * b.a * a);
          ctx.lineWidth = b.lw;
          ctx.beginPath();
          let pen = false;
          for (let j = 0; j <= N; j++) {
            const f = b.f0 + (f1 - b.f0) * (j / N);
            if (b.gap && f > b.gap[0] && f < b.gap[0] + b.gap[1]) { pen = false; continue; }
            const [x, y] = at(f, b.b * thick(f));
            pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            pen = true;
          }
          ctx.stroke();
        }
      }

      // ---- film: grain, scratches, flicker, vignette ----
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? ink(rand(0.05, 0.18)) : `rgba(0,0,0,${rand(0.1, 0.25)})`;
        const s = rand(0.6, 1.8) * S;
        ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
      }
      if (Math.random() < 0.5) {
        ctx.strokeStyle = ink(rand(0.08, 0.22));
        ctx.lineWidth = rand(0.5, 1.2);
        const x = Math.random() * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + rand(-6, 6), h);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(0,0,0,${rand(0, 0.07)})`;
      ctx.fillRect(0, 0, w, h);
      const vg = ctx.createRadialGradient(cx, h / 2, small * 0.35, cx, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // ---- dome rim ----
      if (expand < 1) {
        ctx.restore();
        ctx.save();
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = ink(1);
          ctx.globalAlpha = (1 - expand) * (0.85 - k * 0.27);
          ctx.lineWidth = 2 + k * 6;
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, Math.max(0, R - k * 5), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (t < 0.3) {
        ctx.globalAlpha = (1 - t / 0.3) * 0.85;
        ctx.fillStyle = '#f1dfc4';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
      return t >= duration;
    },
  };
}
