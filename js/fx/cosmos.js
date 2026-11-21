// Infinite Void — effect type 1.
// Three acts, all drawn procedurally:
//   1. a violet/cyan vortex with a black hole travels from the hand to the centre,
//   2. it bursts into light rays and floating crystal shards,
//   3. a tilted celestial orbit map settles in: rings, star dust, orbiting emblem nodes,
//      a stack of floating rings above the core and a slow golden dial.

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const C = {
  cyan: [127, 233, 255],
  violet: [170, 124, 255],
  magenta: [214, 120, 255],
  pink: [255, 160, 240],
  white: [245, 248, 255],
  silver: [220, 226, 240],
  gold: [232, 199, 122],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function star4(ctx, x, y, r) {
  const k = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fill();
}

export function createCosmos({ w, h, origin, duration = 10 }) {
  const small = Math.min(w, h);
  const S = small / 390;
  const cx = w / 2;
  const cy = h * 0.57; // orbit core sits just below the centred title
  const maxR = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 40;
  const low = w * h < 600 * 900;

  const EXPAND = 1.0;
  const BURST = 1.7; // vortex collapses into the crystal burst
  const FADE = 1.0;

  // ---- ellipse geometry for the tilted orbit plane ----
  const TILT = 0.36; // vertical squash
  const ROT = -0.2; // plane rotation
  const cosR = Math.cos(ROT);
  const sinR = Math.sin(ROT);
  const onPlane = (r, th, ox = cx, oy = cy) => {
    const ex = r * Math.cos(th);
    const ey = r * TILT * Math.sin(th);
    return [ox + ex * cosR - ey * sinR, oy + ex * sinR + ey * cosR];
  };
  const R0 = Math.max(w, h) * 0.55;
  const rings = [0.16, 0.28, 0.4, 0.55, 0.72, 0.92, 1.15].map((f, i) => ({
    r: f * R0,
    bold: i >= 5,
    speed: (i % 2 ? -1 : 1) * (0.05 + 0.03 * (6 - i) / 6),
    ticks: i === 2 || i === 4,
  }));
  const diamonds = Array.from({ length: 14 }, () => ({ ring: 1 + ((Math.random() * 5) | 0), th: rand(0, Math.PI * 2) }));
  const nodes = Array.from({ length: 7 }, (_, i) => ({
    ring: [1, 2, 3, 3, 4, 5, 2][i],
    th: rand(0, Math.PI * 2),
    glyph: pick(['star', 'cross', 'diamond', 'ring', 'eye']),
  }));

  // ---- star dust on the orbit plane + background stars ----
  const dust = Array.from({ length: low ? 360 : 600 }, () => ({
    r: Math.sqrt(Math.random()) * R0 * 1.1,
    th: rand(0, Math.PI * 2),
    s: rand(0.5, 1.6) * S,
    a: rand(0.25, 0.85),
    c: pick([C.white, C.silver, C.violet, C.cyan]),
  }));
  const bgStars = Array.from({ length: 140 }, () => ({ x: rand(0, w), y: rand(0, h), s: rand(0.4, 1.3), ph: rand(0, 6.28) }));

  // ---- vortex particles ----
  const VR = small * 0.62;
  const swirl = Array.from({ length: low ? 220 : 340 }, () => newSwirl(true));
  function newSwirl(any) {
    return {
      a: rand(0, Math.PI * 2),
      r: any ? rand(0.08, 1) * VR : rand(0.8, 1.05) * VR,
      w: rand(1.2, 2.2),
      c: pick([C.violet, C.violet, C.cyan, C.magenta, C.pink, C.white]),
      lw: rand(0.8, 2.6) * S,
      px: null,
      py: null,
    };
  }

  // ---- crystal shards ----
  const burstPt = { x: cx, y: cy + small * 0.06 };
  const shards = Array.from({ length: low ? 16 : 24 }, () => {
    const a = -Math.PI / 2 + rand(-1.35, 1.35);
    const sp = rand(260, 720) * S;
    return {
      x: burstPt.x, y: burstPt.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85,
      rot: rand(-0.6, 0.6), spin: rand(-3, 3),
      sw: rand(16, 46) * S, sh: rand(34, 92) * S, skew: rand(-0.25, 0.25),
      ph: rand(0, 6.28),
      crack: [[rand(-0.4, 0.4), -0.5], [rand(-0.3, 0.3), rand(-0.1, 0.2)], [rand(-0.5, 0.5), 0.5]],
    };
  });
  const rays = Array.from({ length: 18 }, (_, i) => ({
    a: (i / 18) * Math.PI * 2 + rand(-0.12, 0.12),
    len: rand(0.5, 1.25) * Math.max(w, h),
    wid: rand(4, 14) * S,
  }));
  const sparkles = Array.from({ length: 26 }, () => ({
    x: rand(0, w), y: rand(0, h), r: rand(3, 9) * S, ph: rand(0, 6.28), sp: rand(1.5, 3.5),
    c: pick([C.white, C.cyan, C.pink]),
  }));

  return {
    duration,
    render(ctx, t, dt) {
      const fadeOut = clamp01((duration - t) / FADE);
      const expand = clamp01(t / EXPAND);
      const R = easeOutCubic(expand) * maxR;
      const m = easeInOut(clamp01((t - 0.15) / (BURST - 0.25)));
      const vc = { x: lerp(origin.x, cx, m), y: lerp(origin.y, cy, m) };
      const after = t - BURST;
      const mapIn = easeOutCubic(clamp01((after - 0.1) / 1.6));

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = fadeOut;

      if (expand < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, R, 0, Math.PI * 2);
        ctx.clip();
      }

      // ---- background + nebula ----
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.9);
      bg.addColorStop(0, '#2a1466');
      bg.addColorStop(0.4, '#120a35');
      bg.addColorStop(1, '#05030f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, r, c, a] of [
        [w * 0.15, h * 0.2, small * 0.6, C.magenta, 0.12],
        [w * 0.9, h * 0.75, small * 0.7, C.cyan, 0.08],
        [w * 0.7, h * 0.15, small * 0.5, C.violet, 0.12],
      ]) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (const s of bgStars) {
        ctx.fillStyle = rgba(C.white, (0.35 + 0.35 * Math.sin(t * 2 + s.ph)) * fadeOut);
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalCompositeOperation = 'source-over';

      // dotted "+" grids in two corners
      if (mapIn > 0) {
        ctx.fillStyle = rgba(C.silver, 0.22 * mapIn * fadeOut);
        for (const [ox, oy] of [[18 * S, h * 0.14], [w - 18 * S - 5 * 16 * S, h * 0.8]]) {
          for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
            const x = ox + i * 16 * S, y = oy + j * 16 * S;
            ctx.fillRect(x - 2.5 * S, y - 0.5, 5 * S, 1);
            ctx.fillRect(x - 0.5, y - 2.5 * S, 1, 5 * S);
          }
        }
      }

      // ---- act 3: orbit map ----
      if (mapIn > 0) {
        ctx.globalAlpha = fadeOut * mapIn;
        // dashed radial guides
        ctx.setLineDash([2 * S, 7 * S]);
        ctx.strokeStyle = rgba(C.silver, 0.18);
        ctx.lineWidth = 1;
        for (const a of [0.35, 1.25, 2.1, 2.75]) {
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(a) * w * 1.2, cy - Math.sin(a) * h * 0.8);
          ctx.lineTo(cx + Math.cos(a) * w * 1.2, cy + Math.sin(a) * h * 0.8);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // star dust disk
        ctx.globalCompositeOperation = 'lighter';
        for (const d of dust) {
          d.th += dt * (0.08 + 0.25 * (1 - d.r / (R0 * 1.1)));
          const [x, y] = onPlane(d.r, d.th);
          if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
          ctx.fillStyle = rgba(d.c, d.a * fadeOut * mapIn);
          ctx.fillRect(x, y, d.s, d.s);
        }
        ctx.globalCompositeOperation = 'source-over';

        // rings, drawn in as arcs that complete themselves
        rings.forEach((rg, i) => {
          const p = easeOutCubic(clamp01((after - 0.1 - i * 0.12) / 1.2));
          if (p <= 0) return;
          const start = -Math.PI / 2 + t * rg.speed;
          ctx.strokeStyle = rgba(C.silver, rg.bold ? 0.75 : 0.45);
          ctx.lineWidth = rg.bold ? 2.2 * S : 1;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rg.r, rg.r * TILT, ROT, start, start + Math.PI * 2 * p);
          ctx.stroke();
          if (rg.bold) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = rgba(C.silver, 0.35);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rg.r * 1.025, rg.r * 1.025 * TILT, ROT, start, start + Math.PI * 2 * p);
            ctx.stroke();
          }
          if (rg.ticks && p > 0.9) {
            ctx.strokeStyle = rgba(C.silver, 0.55);
            ctx.beginPath();
            for (let k = 0; k < 72; k++) {
              const th = (k / 72) * Math.PI * 2 + t * rg.speed;
              const [x1, y1] = onPlane(rg.r, th);
              const [x2, y2] = onPlane(rg.r * (k % 6 === 0 ? 0.95 : 0.975), th);
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
            }
            ctx.stroke();
          }
        });

        // diamonds riding the rings
        ctx.fillStyle = rgba(C.white, 0.85);
        for (const d of diamonds) {
          const rg = rings[d.ring];
          const [x, y] = onPlane(rg.r, d.th + t * rg.speed * 2);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-2.6 * S, -2.6 * S, 5.2 * S, 5.2 * S);
          ctx.restore();
        }

        // emblem nodes
        nodes.forEach((n, i) => {
          const rg = rings[n.ring];
          const [x, y] = onPlane(rg.r, n.th + t * rg.speed * 1.5);
          const nr = 11 * S * (0.8 + 0.4 * (y / h));
          const halo = ctx.createRadialGradient(x, y, nr * 0.6, x, y, nr * 2.4);
          halo.addColorStop(0, rgba(C.violet, 0.45));
          halo.addColorStop(1, rgba(C.violet, 0));
          ctx.fillStyle = halo;
          ctx.fillRect(x - nr * 2.4, y - nr * 2.4, nr * 4.8, nr * 4.8);
          ctx.fillStyle = '#0b0922';
          ctx.strokeStyle = rgba(C.silver, 0.9);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(x, y, nr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = rgba(C.white, 0.95);
          ctx.strokeStyle = rgba(C.white, 0.95);
          ctx.lineWidth = 1.2;
          const g = nr * 0.55;
          if (n.glyph === 'star') star4(ctx, x, y, g);
          else if (n.glyph === 'cross') { ctx.beginPath(); ctx.moveTo(x - g, y); ctx.lineTo(x + g, y); ctx.moveTo(x, y - g); ctx.lineTo(x, y + g); ctx.stroke(); }
          else if (n.glyph === 'diamond') { ctx.beginPath(); ctx.moveTo(x, y - g); ctx.lineTo(x + g, y); ctx.lineTo(x, y + g); ctx.lineTo(x - g, y); ctx.closePath(); ctx.stroke(); }
          else if (n.glyph === 'ring') { ctx.beginPath(); ctx.arc(x, y, g * 0.7, 0, Math.PI * 2); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(x - g, y); ctx.quadraticCurveTo(x, y - g, x + g, y); ctx.quadraticCurveTo(x, y + g, x - g, y); ctx.stroke(); ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
        });

        // floating ring stack above the core
        for (let i = 1; i <= 5; i++) {
          const p = clamp01((after - 0.6 - i * 0.12) / 0.5);
          if (p <= 0) continue;
          const bob = Math.sin(t * 1.6 + i) * 3 * S;
          const y = cy - (i * 30 + i * i * 2) * S + bob;
          const rx = (64 - i * 10) * S;
          ctx.strokeStyle = rgba(i % 2 ? C.gold : C.silver, 0.75 * p);
          ctx.lineWidth = (i === 1 ? 2.4 : 1.6) * S;
          ctx.beginPath();
          ctx.ellipse(cx, y, rx, rx * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(C.silver, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 200 * S * mapIn);
        ctx.stroke();

        // golden dial (screen space)
        const dialIn = clamp01((after - 1.0) / 1.2);
        if (dialIn > 0) {
          const dr = small * 0.47;
          ctx.strokeStyle = rgba(C.gold, 0.32 * dialIn);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let k = 0; k < 96; k++) {
            const a = (k / 96) * Math.PI * 2 + t * 0.06;
            const len = k % 8 === 0 ? 12 * S : 5 * S;
            ctx.moveTo(cx + Math.cos(a) * dr, cy + Math.sin(a) * dr);
            ctx.lineTo(cx + Math.cos(a) * (dr + len), cy + Math.sin(a) * (dr + len));
          }
          ctx.stroke();
        }
        ctx.globalAlpha = fadeOut;
      }

      // ---- act 2: rays + shards ----
      if (after > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const rayA = after < 0.15 ? after / 0.15 : Math.max(0.12, 1 - (after - 0.15) / 1.6);
        for (const r of rays) {
          const ex = burstPt.x + Math.cos(r.a) * r.len;
          const ey = burstPt.y + Math.sin(r.a) * r.len * 0.45;
          const nx = -Math.sin(r.a) * r.wid;
          const ny = Math.cos(r.a) * r.wid * 0.45;
          const g = ctx.createLinearGradient(burstPt.x, burstPt.y, ex, ey);
          g.addColorStop(0, rgba(C.white, 0.9 * rayA));
          g.addColorStop(0.3, rgba(C.cyan, 0.5 * rayA));
          g.addColorStop(1, rgba(C.violet, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(burstPt.x + nx, burstPt.y + ny);
          ctx.lineTo(ex, ey);
          ctx.lineTo(burstPt.x - nx, burstPt.y - ny);
          ctx.closePath();
          ctx.fill();
        }
        // burst core glow
        const cg = ctx.createRadialGradient(burstPt.x, burstPt.y, 0, burstPt.x, burstPt.y, small * 0.35);
        cg.addColorStop(0, rgba(C.white, 0.8 * rayA + 0.15));
        cg.addColorStop(0.25, rgba(C.cyan, 0.35 * rayA + 0.08));
        cg.addColorStop(1, rgba(C.violet, 0));
        ctx.fillStyle = cg;
        ctx.fillRect(burstPt.x - small * 0.35, burstPt.y - small * 0.35, small * 0.7, small * 0.7);
        ctx.globalCompositeOperation = 'source-over';

        const shardA = clamp01((duration - 2.2 - t) / 1.2);
        for (const s of shards) {
          const drag = Math.exp(-2.4 * dt);
          s.vx *= drag;
          s.vy *= drag;
          s.spin *= Math.exp(-1.2 * dt);
          s.x += s.vx * dt;
          s.y += s.vy * dt + Math.sin(t * 1.4 + s.ph) * 6 * S * dt;
          s.rot += s.spin * dt;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.globalAlpha = fadeOut * shardA;
          const hw = s.sw / 2, hh = s.sh / 2, sk = s.skew * s.sh;
          const g = ctx.createLinearGradient(-hw, -hh, hw, hh);
          g.addColorStop(0, rgba(C.cyan, 0.6));
          g.addColorStop(0.55, rgba([120, 160, 255], 0.35));
          g.addColorStop(1, rgba(C.magenta, 0.5));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-hw, -hh);
          ctx.lineTo(hw, -hh + sk);
          ctx.lineTo(hw, hh);
          ctx.lineTo(-hw, hh - sk);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = rgba(C.white, 0.9);
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.strokeStyle = rgba(C.white, 0.45);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          s.crack.forEach(([fx, fy], i) => (i ? ctx.lineTo(fx * s.sw, fy * s.sh) : ctx.moveTo(fx * s.sw, fy * s.sh)));
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = fadeOut;
      }

      // ---- act 1: vortex + black hole ----
      const vortexA = t < BURST - 0.15 ? 1 : clamp01(1 - (t - (BURST - 0.15)) / 0.6);
      if (vortexA > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        // painted spiral arms: tapered filled ribbons + a bright spine
        const armFill = ctx.createRadialGradient(vc.x, vc.y, 0, vc.x, vc.y, VR);
        armFill.addColorStop(0, rgba(C.cyan, 0.55 * vortexA));
        armFill.addColorStop(0.35, rgba(C.violet, 0.4 * vortexA));
        armFill.addColorStop(0.75, rgba(C.magenta, 0.22 * vortexA));
        armFill.addColorStop(1, rgba(C.magenta, 0));
        for (let arm = 0; arm < 4; arm++) {
          const base = arm * (Math.PI / 2) + t * 2.2;
          const pts = [];
          for (let i = 0; i <= 60; i++) {
            const k = i / 60;
            const th = base + k * 4.4;
            const r = VR * (0.05 + k * k * 0.95);
            pts.push([vc.x + Math.cos(th) * r, vc.y + Math.sin(th) * r * 0.55, k]);
          }
          const left = [], right = [];
          for (let i = 0; i < pts.length; i++) {
            const [x, y, k] = pts[i];
            const [nx0, ny0] = pts[Math.min(pts.length - 1, i + 1)];
            const [px0, py0] = pts[Math.max(0, i - 1)];
            let dx = nx0 - px0, dy = ny0 - py0;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len; dy /= len;
            const half = (2 + Math.sin(k * Math.PI) * (arm % 2 ? 26 : 18)) * S;
            left.push([x - dy * half, y + dx * half]);
            right.push([x + dy * half, y - dx * half]);
          }
          ctx.fillStyle = armFill;
          ctx.beginPath();
          left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = rgba(arm % 2 ? C.pink : C.cyan, 0.5 * vortexA);
          ctx.lineWidth = 1.4 * S;
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        // particles spiralling inward
        const bh = small * 0.045 * (1 - clamp01((t - BURST + 0.4) / 0.6));
        for (const p of swirl) {
          p.r *= 1 - dt * (0.45 + 0.9 * (1 - p.r / VR));
          p.a += dt * p.w * (1 + 2.2 * (1 - p.r / VR));
          if (p.r < small * 0.04) { Object.assign(p, newSwirl(false)); continue; }
          const x = vc.x + Math.cos(p.a) * p.r;
          const y = vc.y + Math.sin(p.a) * p.r * 0.55;
          if (p.px !== null) {
            ctx.strokeStyle = rgba(p.c, 0.75 * vortexA);
            ctx.lineWidth = p.lw;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          p.px = x;
          p.py = y;
        }
        ctx.globalCompositeOperation = 'source-over';
        if (bh > 0.5) {
          const ring = ctx.createRadialGradient(vc.x, vc.y, bh * 0.9, vc.x, vc.y, bh * 2.4);
          ring.addColorStop(0, rgba(C.white, 0.95 * vortexA));
          ring.addColorStop(0.15, rgba(C.cyan, 0.7 * vortexA));
          ring.addColorStop(0.5, rgba(C.violet, 0.35 * vortexA));
          ring.addColorStop(1, rgba(C.violet, 0));
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = ring;
          ctx.beginPath();
          ctx.arc(vc.x, vc.y, bh * 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(vc.x, vc.y, bh, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- sparkles ----
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparkles) {
        const a = Math.max(0, Math.sin(t * s.sp + s.ph));
        if (a <= 0.05) continue;
        ctx.fillStyle = rgba(s.c, a * 0.9 * fadeOut);
        star4(ctx, s.x, s.y, s.r * (0.6 + a * 0.6));
      }
      ctx.globalCompositeOperation = 'source-over';

      // ---- dome rim while expanding ----
      if (expand < 1) {
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = rgba(k ? C.violet : C.cyan, 1);
          ctx.globalAlpha = (1 - expand) * (0.9 - k * 0.28);
          ctx.lineWidth = 3 + k * 8;
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, Math.max(0, R - k * 6), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- flashes: at the drop and at the burst ----
      const flashA = Math.max(t < 0.3 ? 1 - t / 0.3 : 0, after > 0 && after < 0.35 ? 0.7 * (1 - after / 0.35) : 0);
      if (flashA > 0) {
        ctx.globalAlpha = flashA * 0.85;
        ctx.fillStyle = '#f2ecff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
      return t >= duration;
    },
  };
}
