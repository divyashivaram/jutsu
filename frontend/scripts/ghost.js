// Ghost-hand overlay: stylized 21-landmark target hands for each seal, drawn on
// the camera so the trainee lines their tracked skeleton up with them. Poses come
// from the shared per-seal LAYOUTS (diagrams.js); coordinates are in the same
// 240×210 layout space, authored as the trainee sees their own hands.

import { LAYOUTS } from "./diagrams.js";

export const LAYOUT_W = 240;
export const LAYOUT_H = 210;

// Local hand units match the schematic diagrams: palm ~46 wide, fingers up = -y.
const KNUCKLE_X = [16.5, 5.5, -5.5, -16.5]; // index→pinky
const KNUCKLE_Y = -22;
const FINGER_LEN = [42, 48, 44, 34];
const SEG = [0.46, 0.31, 0.23]; // proximal / middle / distal share
// Degrees folded at MCP/PIP/DIP when fully curled. Sums to ~170° so a fist reads
// as knuckles with tips tucked downward, not landmarks piled inside the palm.
const BENDS = [45, 90, 35];
const WRIST = { x: 0, y: 34 };
const THUMB_CMC = { x: 14, y: 24 };
const THUMB_ANGLE = -50; // up-and-out, matching the schematic thumb
const THUMB_SEG = [16, 12, 10];
const THUMB_BENDS = [55, 65]; // folds across the palm when curled

const rad = (deg) => (deg * Math.PI) / 180;

function chain(start, angles, lengths) {
  const pts = [start];
  let p = start;
  for (let i = 0; i < lengths.length; i++) {
    p = { x: p.x + Math.cos(angles[i]) * lengths[i], y: p.y + Math.sin(angles[i]) * lengths[i] };
    pts.push(p);
  }
  return pts;
}

// 21 MediaPipe-ordered landmarks for one hand, transformed into layout space.
// pose = { fingers: [thumb..pinky] 0..1, x, y, rot?, mirror? } — a LAYOUTS entry.
export function handLandmarks({ fingers, x, y, rot = 0, mirror = false }) {
  const lm = new Array(21);
  lm[0] = WRIST;

  const tCurl = 1 - fingers[0];
  const tAngles = [
    rad(THUMB_ANGLE),
    rad(THUMB_ANGLE - THUMB_BENDS[0] * tCurl),
    rad(THUMB_ANGLE - (THUMB_BENDS[0] + THUMB_BENDS[1]) * tCurl),
  ];
  chain(THUMB_CMC, tAngles, THUMB_SEG).forEach((p, i) => (lm[1 + i] = p));

  for (let f = 0; f < 4; f++) {
    const curl = 1 - fingers[f + 1];
    const mcp = { x: KNUCKLE_X[f], y: KNUCKLE_Y };
    let a = -90;
    const angles = BENDS.map((b) => rad((a += b * curl)));
    const lengths = SEG.map((s) => s * FINGER_LEN[f]);
    chain(mcp, angles, lengths).forEach((p, i) => (lm[5 + f * 4 + i] = p));
  }

  const cos = Math.cos(rad(rot));
  const sin = Math.sin(rad(rot));
  return lm.map((p) => {
    const lx = mirror ? -p.x : p.x;
    return { x: x + lx * cos - p.y * sin, y: y + lx * sin + p.y * cos };
  });
}

// Where the ghost sits on the camera canvas: lower-center (seals are held at
// chest height), 62% of frame height, clear of the face region up top.
export function ghostPlacement(canvasW, canvasH) {
  const s = (canvasH * 0.62) / LAYOUT_H;
  return { s, ox: (canvasW - LAYOUT_W * s) / 2, oy: canvasH * 0.34 };
}

// Ghost hands for a seal (back-to-front, like the diagram), or null if unknown.
export function sealGhost(sealId) {
  const layout = LAYOUTS[sealId];
  if (!layout) return null;
  return layout.map(handLandmarks);
}
