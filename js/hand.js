// Hand landmark helpers shared by every character's gesture detector.
// MediaPipe landmark indices: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
export const LM = {
  WRIST: 0,
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20],
};

export const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Wraps raw normalized landmarks into an object with handy measurements.
 * Landmarks are converted to pixel-proportional space (x * aspect) so that
 * distances are not distorted by a non-square camera frame.
 */
export function analyzeHand(landmarks, aspect = 1) {
  const p = landmarks.map((l) => ({ x: l.x * aspect, y: l.y, z: l.z }));
  const wrist = p[LM.WRIST];
  const palm = dist(wrist, p[9]) || 1e-6; // wrist → middle MCP

  // How far each fingertip reaches relative to its knuckle (MCP), measured from the wrist.
  // ~1.0–1.3 when curled, ~1.7–2.1 when straight.
  const reach = (f) => dist(wrist, p[f[3]]) / (dist(wrist, p[f[0]]) || 1e-6);

  // Straightness: tip→MCP distance divided by the sum of bone lengths (1 = perfectly straight).
  const straight = (f) => {
    const bones = dist(p[f[0]], p[f[1]]) + dist(p[f[1]], p[f[2]]) + dist(p[f[2]], p[f[3]]);
    return dist(p[f[0]], p[f[3]]) / (bones || 1e-6);
  };

  // Lateral axis across the knuckles (index MCP → pinky MCP), used for "left/right of" tests.
  const across = sub(p[5], p[17]);
  const acrossLen = len(across) || 1e-6;
  const u = { x: across.x / acrossLen, y: across.y / acrossLen };
  const lateral = (i) => dot(sub(p[i], wrist), u) / palm;

  const fingers = {};
  for (const [name, f] of Object.entries({ index: LM.INDEX, middle: LM.MIDDLE, ring: LM.RING, pinky: LM.PINKY })) {
    const r = reach(f);
    const s = straight(f);
    fingers[name] = { reach: r, straight: s, extended: r > 1.45 && s > 0.8, curled: r < 1.35 || s < 0.55 };
  }

  return { p, palm, fingers, lateral, raw: landmarks };
}
