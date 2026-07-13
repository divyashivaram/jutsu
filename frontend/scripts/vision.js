// Camera + MediaPipe HandLandmarker + seal classification.
// All inference is in-browser; no frames leave the machine.

import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const TEMPLATE_KEY = "jutsu.templates.v1";

// Landmark indices
const WRIST = 0;
const TIPS = [4, 8, 12, 16, 20];
const PIPS = [3, 6, 10, 14, 18];
const MCPS = [2, 5, 9, 13, 17];
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function palmCenter(lm) {
  const pts = [lm[WRIST], lm[5], lm[9], lm[13], lm[17]];
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function handSize(lm) {
  return dist(lm[WRIST], lm[MIDDLE_MCP]) || 1e-6;
}

// Per-hand: 5 finger-extension values in 0..1 plus direction angle.
function handFeatures(lm) {
  const size = handSize(lm);
  const fingers = [];
  // Thumb: distance from thumb tip to pinky MCP, relative to hand size.
  fingers.push(clamp01((dist(lm[4], lm[PINKY_MCP]) / size - 0.7) / 0.8));
  for (let f = 1; f < 5; f++) {
    const raw = (dist(lm[TIPS[f]], lm[WRIST]) - dist(lm[PIPS[f]], lm[WRIST])) / size;
    fingers.push(clamp01((raw + 0.2) / 0.8));
  }
  const dir = Math.atan2(lm[MIDDLE_MCP].y - lm[WRIST].y, lm[MIDDLE_MCP].x - lm[WRIST].x);
  return { fingers, dir, size, palm: palmCenter(lm), mcps: MCPS.map((i) => lm[i]) };
}

// Fixed 14-dim feature vector for a two-hand frame: [fingersA×5, fingersB×5, gap, vert, cross, flat]
export function extractFeatures(lmA, lmB) {
  const A = handFeatures(lmA);
  const B = handFeatures(lmB);
  const size = (A.size + B.size) / 2;
  const gap = clamp01((dist(A.palm, B.palm) / size - 0.7) / 2.0);
  const vert = clamp01(Math.abs(A.palm.y - B.palm.y) / size / 1.2);
  let angleDiff = Math.abs(A.dir - B.dir) % Math.PI;
  angleDiff = Math.min(angleDiff, Math.PI - angleDiff);
  const cross = clamp01((angleDiff - Math.PI / 6) / (Math.PI / 3));
  const flatness = (d) => Math.abs(Math.cos(d));
  const flat = (flatness(A.dir) + flatness(B.dir)) / 2;
  return { A, B, vec: [...A.fingers, ...B.fingers, gap, vert, cross, flat] };
}

function heuristicScore(features, sig) {
  const permutations = [
    [features.A.fingers, features.B.fingers],
    [features.B.fingers, features.A.fingers],
  ];
  const [gap, vert, cross, flat] = features.vec.slice(10);
  let best = 0;
  for (const [fa, fb] of permutations) {
    let diff = 0;
    let weight = 0;
    for (let i = 0; i < 5; i++) {
      diff += Math.abs(fa[i] - sig.fingersA[i]) + Math.abs(fb[i] - sig.fingersB[i]);
      weight += 2;
    }
    diff += Math.abs(gap - sig.palmGap) * 2.5;
    weight += 2.5;
    diff += Math.abs(vert - sig.verticalOffset) * 1.5;
    weight += 1.5;
    if (sig.crossed) {
      diff += Math.abs(cross - 1) * 2;
      weight += 2;
    }
    if (sig.flat) {
      diff += Math.abs(flat - 1) * 1.5;
      weight += 1.5;
    }
    best = Math.max(best, 1 - diff / weight);
  }
  return best;
}

function templateScore(features, template) {
  const v = features.vec;
  let diff = 0;
  for (let i = 0; i < v.length; i++) diff += Math.abs(v[i] - template[i]);
  return clamp01(1 - (diff / v.length) * 2.2);
}

export function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveTemplate(sealId, frames) {
  const templates = loadTemplates();
  const n = frames.length;
  const mean = frames[0].map((_, i) => frames.reduce((s, f) => s + f[i], 0) / n);
  templates[sealId] = mean;
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

export function clearTemplates() {
  localStorage.removeItem(TEMPLATE_KEY);
}

// Score a two-hand frame against a seal. Calibrated template wins when present.
export function scoreSeal(features, seal, templates = loadTemplates()) {
  const template = templates[seal.id];
  const heuristic = heuristicScore(features, seal.sig);
  if (!template) return { score: heuristic, calibrated: false };
  return { score: Math.max(templateScore(features, template), heuristic * 0.9), calibrated: true };
}

export class VisionEngine {
  constructor(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.landmarker = null;
    this.running = false;
    this.onFrame = null;
  }

  async init() {
    if (!this.landmarker) {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    }
    if (this.video.srcObject) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 540, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise((res) => (this.video.onloadedmetadata = res));
    await this.video.play();
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
  }

  start(onFrame) {
    this.onFrame = onFrame;
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      if (this.video.readyState >= 2) {
        const result = this.landmarker.detectForVideo(this.video, performance.now());
        this.draw(result);
        let features = null;
        if (result.landmarks.length === 2) {
          features = extractFeatures(result.landmarks[0], result.landmarks[1]);
        }
        this.onFrame?.({ numHands: result.landmarks.length, features });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.onFrame = null;
  }

  shutdown() {
    this.stop();
    const stream = this.video.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }

  draw(result) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    for (const lm of result.landmarks) {
      ctx.strokeStyle = "rgba(79, 195, 247, 0.85)";
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
