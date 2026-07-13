// Schematic SVG diagrams of the 12 seals: two parametric hands with per-finger
// extension and a per-seal layout (position, rotation, mirroring). Drawn as the
// trainee sees their own hands. Approximate on purpose — the hint text adds nuance.

const FILL = "#22303e";
const STROKE = "rgba(79, 195, 247, 0.8)";

// finger x-offsets (index→pinky) and base lengths, in local hand units
const FX = [16.5, 5.5, -5.5, -16.5];
const BASE = [30, 36, 32, 24];

function capsule(x, y, w, h) {
  const r = w / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"
    fill="${FILL}" stroke="${STROKE}" stroke-width="2"/>`;
}

// fingers = [thumb, index, middle, ring, pinky], each 0 (curled) .. 1 (extended)
function hand({ fingers, x, y, rot = 0, mirror = false }) {
  const parts = [];
  parts.push(capsule(-14, 22, 28, 16)); // wrist
  for (let f = 0; f < 4; f++) {
    const len = 8 + BASE[f] * fingers[f + 1];
    parts.push(capsule(FX[f] - 5.5, -26 - len, 11, len + 12));
  }
  // palm over finger roots so curled stubs tuck behind it
  parts.push(
    `<rect x="-23" y="-26" width="46" height="52" rx="11"
      fill="${FILL}" stroke="${STROKE}" stroke-width="2"/>`,
  );
  const thumbLen = 10 + 26 * fingers[0];
  parts.push(
    `<g transform="translate(24,6) rotate(-38)">${capsule(-5.5, -thumbLen, 11, thumbLen + 8)}</g>`,
  );
  const flip = mirror ? " scale(-1,1)" : "";
  return `<g transform="translate(${x},${y}) rotate(${rot})${flip}">${parts.join("")}</g>`;
}

const NONE = [0, 0, 0, 0, 0];
const ALL = [1, 1, 1, 1, 1];
const POINTER = [0, 1, 1, 0, 0]; // index + middle

// One layout per seal; hands listed back-to-front.
const LAYOUTS = {
  tiger: [
    { fingers: POINTER, x: 106, y: 112, rot: -8 },
    { fingers: POINTER, x: 134, y: 112, rot: 8, mirror: true },
  ],
  ram: [
    { fingers: POINTER, x: 130, y: 126, rot: 6, mirror: true },
    { fingers: POINTER, x: 110, y: 92, rot: -6 },
  ],
  snake: [
    { fingers: NONE, x: 108, y: 115, rot: -10 },
    { fingers: NONE, x: 132, y: 115, rot: 10, mirror: true },
  ],
  rat: [
    { fingers: POINTER, x: 118, y: 96, rot: 0 },
    { fingers: NONE, x: 122, y: 140, rot: 0, mirror: true },
  ],
  ox: [
    { fingers: ALL, x: 108, y: 108, rot: 0 },
    { fingers: ALL, x: 128, y: 122, rot: 90, mirror: true },
  ],
  hare: [
    { fingers: [1, 0, 0, 0, 0], x: 122, y: 150, rot: -90, mirror: true },
    { fingers: [0, 0, 0, 0, 1], x: 118, y: 96, rot: 0 },
  ],
  dragon: [
    { fingers: [1, 0, 0, 0, 0], x: 128, y: 128, rot: 4, mirror: true },
    { fingers: [1, 0, 0, 0, 0], x: 112, y: 96, rot: -4 },
  ],
  horse: [
    { fingers: [0, 1, 0, 0, 0], x: 104, y: 114, rot: 14 },
    { fingers: [0, 1, 0, 0, 0], x: 136, y: 114, rot: -14, mirror: true },
  ],
  monkey: [
    { fingers: ALL, x: 120, y: 134, rot: 90, mirror: true },
    { fingers: ALL, x: 120, y: 96, rot: -90 },
  ],
  bird: [
    { fingers: [1, 1, 0, 1, 1], x: 98, y: 112, rot: -28 },
    { fingers: [1, 1, 0, 1, 1], x: 142, y: 112, rot: 28, mirror: true },
  ],
  dog: [
    { fingers: NONE, x: 120, y: 138, rot: 0, mirror: true },
    { fingers: ALL, x: 118, y: 94, rot: -90 },
  ],
  boar: [
    { fingers: NONE, x: 102, y: 118, rot: -90 },
    { fingers: NONE, x: 138, y: 118, rot: 90, mirror: true },
  ],
};

export function sealDiagram(sealId) {
  const layout = LAYOUTS[sealId];
  if (!layout) return "";
  return `<svg viewBox="0 0 240 210" class="seal-diagram" role="img"
    aria-label="hand position diagram">${layout.map(hand).join("")}</svg>`;
}
