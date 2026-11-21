// Renders the (mirrored, cover-cropped) camera feed as ASCII characters.
const RAMP = ' .:-=+*#%@';

export function createAsciiRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sample = document.createElement('canvas');
  const sctx = sample.getContext('2d', { willReadFrequently: true });

  return function render(video, { w, h, dpr, mirror, color = [170, 225, 255], alpha = 1 }) {
    if (!video.videoWidth) return;
    const cols = w < 500 ? 64 : 110;
    const cell = w / cols;
    const rows = Math.ceil(h / (cell * 1.15));
    sample.width = cols;
    sample.height = rows;

    // cover-crop the video into the sample canvas
    const vw = video.videoWidth, vh = video.videoHeight;
    const scale = Math.max(cols / vw, rows / vh);
    const dw = vw * scale, dh = vh * scale;
    sctx.save();
    if (mirror) { sctx.translate(cols, 0); sctx.scale(-1, 1); }
    sctx.drawImage(video, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    sctx.restore();
    const data = sctx.getImageData(0, 0, cols, rows).data;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${(cell * 1.25) | 0}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [r, g, b] = color;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        const k = Math.min(RAMP.length - 1, (lum * RAMP.length) | 0);
        if (k === 0) continue;
        ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * (0.25 + lum * 0.75)).toFixed(3)})`;
        ctx.fillText(RAMP[k], (x + 0.5) * cell, (y + 0.5) * ch);
      }
    }
  };
}

export function clearCanvas(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}
