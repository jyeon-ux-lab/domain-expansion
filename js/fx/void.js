// "Infinite Void" style domain visual: an expanding black dome that swallows the
// screen, a 3D warp starfield, concentric light rings and spiralling glyphs.
// All shapes are drawn procedurally on a 2D canvas (no external art).

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

export function createVoid({ w, h, origin, palette, glyphs, duration = 7.5 }) {
  const small = Math.min(w, h);
  const maxR = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 40;
  const EXPAND = 1.05; // seconds for the dome to cover the screen
  const FADE = 1.0;
  const low = w * h < 600 * 900; // phones get fewer particles

  const stars = Array.from({ length: low ? 420 : 700 }, () => newStar(true));
  function newStar(anyDepth) {
    return {
      x: rand(-1, 1),
      y: rand(-1, 1),
      z: anyDepth ? rand(0.05, 1) : rand(0.85, 1),
      pz: 0,
      c: palette.stars[(Math.random() * palette.stars.length) | 0],
    };
  }

  const glyphParts = [];
  const rings = [];
  let ringTimer = 0;
  let glyphTimer = 0;

  return {
    duration,
    render(ctx, t, dt) {
      const fadeOut = clamp01((duration - t) / FADE);
      const expand = clamp01(t / EXPAND);
      const R = easeOutCubic(expand) * maxR;

      // Void centre drifts from the hand to the middle of the screen.
      const cm = easeInOut(clamp01((t - 0.2) / 1.4));
      const cx = lerp(origin.x, w / 2, cm);
      const cy = lerp(origin.y, h * 0.44, cm);

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = fadeOut;

      // ---- clip to the expanding dome --------------------------------------
      if (expand < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, R, 0, Math.PI * 2);
        ctx.clip();
      }

      // ---- background ------------------------------------------------------
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, palette.bgInner);
      bg.addColorStop(0.45, palette.bgMid);
      bg.addColorStop(1, '#000');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ---- warp starfield --------------------------------------------------
      const speed = lerp(1.6, 0.35, easeOutCubic(clamp01((t - 0.3) / 2.5)));
      const f = small * 0.55;
      ctx.lineCap = 'round';
      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed * dt * (0.3 + (1 - s.z) * 0.2);
        if (s.z <= 0.03) { Object.assign(s, newStar(false)); s.pz = s.z; continue; }
        const sx = cx + (s.x / s.z) * f;
        const sy = cy + (s.y / s.z) * f;
        const px = cx + (s.x / s.pz) * f;
        const py = cy + (s.y / s.pz) * f;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { Object.assign(s, newStar(false)); continue; }
        const b = clamp01(1.2 - s.z);
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = fadeOut * b;
        ctx.lineWidth = lerp(0.4, 2.4, b);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.globalAlpha = fadeOut;

      // ---- concentric rings ------------------------------------------------
      ringTimer -= dt;
      if (t > 0.5 && ringTimer <= 0) { rings.push({ r: 0, a: 1 }); ringTimer = 0.55; }
      ctx.lineWidth = 1.2;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * small * (0.25 + r.r / small);
        r.a = clamp01(1 - r.r / (Math.max(w, h) * 0.9));
        if (r.a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = palette.ring;
        ctx.globalAlpha = fadeOut * r.a * 0.55;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r.r, r.r * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = fadeOut;

      // ---- spiralling glyphs ("too much information") ----------------------
      glyphTimer -= dt;
      if (t > 0.7) {
        while (glyphTimer <= 0) {
          glyphParts.push({
            a: rand(0, Math.PI * 2),
            r: rand(4, small * 0.06),
            spin: rand(0.25, 0.7) * (Math.random() < 0.5 ? 1 : -1),
            ch: glyphs[(Math.random() * glyphs.length) | 0],
            c: palette.glyphs[(Math.random() * palette.glyphs.length) | 0],
          });
          glyphTimer += low ? 0.018 : 0.011;
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = glyphParts.length - 1; i >= 0; i--) {
        const g = glyphParts[i];
        g.r *= 1 + dt * 0.9;
        g.a += g.spin * dt;
        const x = cx + Math.cos(g.a) * g.r;
        const y = cy + Math.sin(g.a) * g.r * 0.9;
        if (g.r > Math.max(w, h)) { glyphParts.splice(i, 1); continue; }
        const size = 6 + g.r * 0.05;
        ctx.globalAlpha = fadeOut * clamp01(g.r / (small * 0.2)) * 0.85;
        ctx.fillStyle = g.c;
        ctx.font = `${size | 0}px ui-monospace, Menlo, monospace`;
        ctx.fillText(g.ch, x, y);
      }
      ctx.globalAlpha = fadeOut;

      // ---- core light ------------------------------------------------------
      const pulse = 0.85 + Math.sin(t * 3.1) * 0.15;
      const coreR = small * 0.22 * pulse * easeOutCubic(clamp01((t - 0.4) / 1.2));
      if (coreR > 1) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.08, palette.core);
        g.addColorStop(0.35, palette.coreGlow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();
        // thin horizontal lens streak
        const sg = ctx.createLinearGradient(cx - w * 0.6, cy, cx + w * 0.6, cy);
        sg.addColorStop(0, 'rgba(0,0,0,0)');
        sg.addColorStop(0.5, palette.streak);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.globalAlpha = fadeOut * 0.7 * pulse;
        ctx.fillRect(cx - w * 0.6, cy - 1.2, w * 1.2, 2.4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fadeOut;
      }

      // ---- dome rim while expanding -----------------------------------------
      if (expand < 1) {
        ctx.restore(); // remove clip
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = palette.ring;
          ctx.globalAlpha = (1 - expand) * (0.9 - k * 0.28);
          ctx.lineWidth = 3 + k * 8;
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, Math.max(0, R - k * 6), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- initial flash ----------------------------------------------------
      if (t < 0.35) {
        ctx.globalAlpha = (1 - t / 0.35) * 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
      return t >= duration;
    },
  };
}
