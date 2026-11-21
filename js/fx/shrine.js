// "Malevolent Shrine" style domain visual: a crimson dome, a still blood-red pool,
// a dark gate silhouette, rising embers and slashes that cut across the screen.
// Everything is drawn procedurally (no external art).

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rand = (a, b) => a + Math.random() * (b - a);

export function createShrine({ w, h, origin, duration = 10, slashTimes = [] }) {
  const small = Math.min(w, h);
  const maxR = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 40;
  const EXPAND = 0.9;
  const FADE = 1.0;
  const horizon = h * 0.7;
  const low = w * h < 600 * 900;

  const embers = Array.from({ length: low ? 70 : 120 }, () => newEmber(true));
  function newEmber(any) {
    return {
      x: rand(0, w),
      y: any ? rand(0, h) : h + rand(0, 40),
      vy: rand(18, 60),
      sway: rand(0.5, 2),
      ph: rand(0, Math.PI * 2),
      r: rand(0.8, 2.4),
    };
  }

  const queue = [...slashTimes].sort((a, b) => a - b);
  const slashes = [];
  let flash = 0;
  function spawnSlash(big) {
    const ang = rand(-0.9, 0.9) + (Math.random() < 0.5 ? 0 : Math.PI / 2);
    const len = (big ? rand(1.1, 1.5) : rand(0.6, 1.1)) * Math.max(w, h);
    const cx = rand(w * 0.15, w * 0.85);
    const cy = rand(h * 0.12, h * 0.85);
    slashes.push({ cx, cy, ang, len, age: 0, life: big ? 0.5 : 0.36, width: big ? 1.6 : 1 });
    flash = Math.max(flash, big ? 0.22 : 0.1);
  }

  // jagged rim offsets for the expanding dome
  const rim = Array.from({ length: 48 }, () => rand(-1, 1));

  return {
    duration,
    render(ctx, t, dt) {
      const fadeOut = clamp01((duration - t) / FADE);
      const expand = clamp01(t / EXPAND);
      const R = easeOutCubic(expand) * maxR;
      const cx = w / 2;
      const cy = h * 0.34;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = fadeOut;

      if (expand < 1) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= rim.length; i++) {
          const a = (i / rim.length) * Math.PI * 2;
          const rr = R * (1 + rim[i % rim.length] * 0.05);
          const x = origin.x + Math.cos(a) * rr;
          const y = origin.y + Math.sin(a) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.clip();
      }

      // ---- sky ---------------------------------------------------------------
      const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      sky.addColorStop(0, '#5a0a0f');
      sky.addColorStop(0.35, '#2a0408');
      sky.addColorStop(1, '#070003');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // blood moon
      const moonR = small * 0.17;
      const mg = ctx.createRadialGradient(cx, cy, moonR * 0.2, cx, cy, moonR * 2.6);
      mg.addColorStop(0, 'rgba(255, 90, 70, 0.95)');
      mg.addColorStop(0.38, 'rgba(200, 20, 30, 0.55)');
      mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(cx, cy, moonR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // ---- gate silhouette (generic two-pillar gate) -------------------------
      const gw = small * 0.62;
      const gx = cx - gw / 2;
      const top = cy + moonR * 0.35;
      ctx.fillStyle = '#0b0103';
      // upper beam, curved upward at both ends
      ctx.beginPath();
      ctx.moveTo(gx - gw * 0.12, top - gw * 0.05);
      ctx.quadraticCurveTo(cx, top + gw * 0.05, gx + gw * 1.12, top - gw * 0.05);
      ctx.lineTo(gx + gw * 1.06, top + gw * 0.05);
      ctx.quadraticCurveTo(cx, top + gw * 0.12, gx - gw * 0.06, top + gw * 0.05);
      ctx.closePath();
      ctx.fill();
      // lower beam
      ctx.fillRect(gx + gw * 0.02, top + gw * 0.16, gw * 0.96, gw * 0.045);
      // pillars
      ctx.fillRect(gx + gw * 0.12, top + gw * 0.06, gw * 0.07, horizon - top - gw * 0.06);
      ctx.fillRect(gx + gw * 0.81, top + gw * 0.06, gw * 0.07, horizon - top - gw * 0.06);

      // ---- blood pool -------------------------------------------------------
      const pool = ctx.createLinearGradient(0, horizon, 0, h);
      pool.addColorStop(0, '#3d0509');
      pool.addColorStop(1, '#0a0003');
      ctx.fillStyle = pool;
      ctx.fillRect(0, horizon, w, h - horizon);
      // reflection of the moon + ripples
      ctx.globalAlpha = fadeOut * 0.35;
      ctx.fillStyle = 'rgba(255, 70, 60, 0.6)';
      for (let i = 0; i < 14; i++) {
        const y = horizon + 6 + i * i * 2.2;
        if (y > h) break;
        const wobble = Math.sin(t * 2 + i) * 6;
        const half = moonR * (1.2 - i * 0.05) + wobble;
        ctx.fillRect(cx - half, y, half * 2, 1.2);
      }
      ctx.globalAlpha = fadeOut;
      ctx.strokeStyle = 'rgba(255, 120, 110, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = horizon + ((t * 14 + i * 22) % (h - horizon));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // ---- embers -------------------------------------------------------------
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.y -= e.vy * dt;
        e.ph += dt * e.sway;
        if (e.y < -10) Object.assign(e, newEmber(false));
        const x = e.x + Math.sin(e.ph) * 10;
        ctx.globalAlpha = fadeOut * (0.4 + 0.6 * Math.abs(Math.sin(e.ph * 1.7)));
        ctx.fillStyle = 'rgba(255, 110, 60, 0.9)';
        ctx.beginPath();
        ctx.arc(x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fadeOut;

      // ---- slashes (timed to the beat) -----------------------------------------
      while (queue.length && queue[0] <= t) {
        queue.shift();
        spawnSlash(Math.random() < 0.3);
      }
      for (let i = slashes.length - 1; i >= 0; i--) {
        const s = slashes[i];
        s.age += dt;
        const k = s.age / s.life;
        if (k >= 1) { slashes.splice(i, 1); continue; }
        const grow = easeOutCubic(clamp01(k * 4));
        const dx = Math.cos(s.ang) * s.len * 0.5 * grow;
        const dy = Math.sin(s.ang) * s.len * 0.5 * grow;
        const a = 1 - k;
        for (const [wid, col] of [[10 * s.width, `rgba(255, 30, 40, ${0.35 * a})`], [3 * s.width, `rgba(255, 170, 160, ${0.9 * a})`], [1.2, `rgba(255, 255, 255, ${a})`]]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = wid * (1 - k * 0.6);
          ctx.beginPath();
          ctx.moveTo(s.cx - dx, s.cy - dy);
          ctx.lineTo(s.cx + dx, s.cy + dy);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 40, 40, ${flash * fadeOut})`;
        ctx.fillRect(0, 0, w, h);
        flash = Math.max(0, flash - dt * 1.2);
      }

      // ---- dome rim -------------------------------------------------------------
      if (expand < 1) {
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = 'rgba(255, 60, 50, 1)';
          ctx.globalAlpha = (1 - expand) * (0.9 - k * 0.28);
          ctx.lineWidth = 3 + k * 8;
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, Math.max(0, R - k * 6), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- initial flash ----------------------------------------------------------
      if (t < 0.3) {
        ctx.globalAlpha = (1 - t / 0.3) * 0.85;
        ctx.fillStyle = '#ffd9d4';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
      return t >= duration;
    },
  };
}
