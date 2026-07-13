// Geometry tests for the ghost-hand overlay generator (run: node --test tests/ghost.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";

import { LAYOUTS } from "../frontend/scripts/diagrams.js";
import { ghostPlacement, handLandmarks, sealGhost, LAYOUT_W, LAYOUT_H } from "../frontend/scripts/ghost.js";

const SEAL_IDS = Object.keys(LAYOUTS);
const TIPS = [4, 8, 12, 16, 20];
const WRIST = 0;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("every seal produces two ghost hands of 21 finite landmarks", () => {
  assert.equal(SEAL_IDS.length, 12);
  for (const id of SEAL_IDS) {
    const hands = sealGhost(id);
    assert.equal(hands.length, 2, `${id}: expected two hands`);
    for (const hand of hands) {
      assert.equal(hand.length, 21, `${id}: expected 21 landmarks`);
      for (const p of hand) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${id}: non-finite landmark`);
      }
    }
  }
});

test("ghost hands stay near the layout box", () => {
  const margin = 60;
  for (const id of SEAL_IDS) {
    for (const hand of sealGhost(id)) {
      for (const p of hand) {
        assert.ok(p.x > -margin && p.x < LAYOUT_W + margin, `${id}: x out of range (${p.x})`);
        assert.ok(p.y > -margin && p.y < LAYOUT_H + margin, `${id}: y out of range (${p.y})`);
      }
    }
  }
});

test("extending a finger moves its tip away from the wrist", () => {
  for (let f = 0; f < 5; f++) {
    const fingers = (e) => {
      const v = [0, 0, 0, 0, 0];
      v[f] = e;
      return v;
    };
    const curled = handLandmarks({ fingers: fingers(0), x: 0, y: 0 });
    const extended = handLandmarks({ fingers: fingers(1), x: 0, y: 0 });
    assert.ok(
      dist(extended[TIPS[f]], extended[WRIST]) > dist(curled[TIPS[f]], curled[WRIST]) + 10,
      `finger ${f}: extension should lengthen tip-to-wrist distance`,
    );
  }
});

test("mirroring flips landmarks about the hand origin", () => {
  const pose = { fingers: [1, 1, 0, 0, 1], x: 0, y: 0 };
  const plain = handLandmarks(pose);
  const flipped = handLandmarks({ ...pose, mirror: true });
  for (let i = 0; i < 21; i++) {
    assert.ok(Math.abs(plain[i].x + flipped[i].x) < 1e-9, `landmark ${i}: x should negate`);
    assert.ok(Math.abs(plain[i].y - flipped[i].y) < 1e-9, `landmark ${i}: y should match`);
  }
});

test("ghost placement sits lower-center, inside the canvas", () => {
  for (const [w, h] of [[960, 540], [1280, 720], [640, 480]]) {
    const { s, ox, oy } = ghostPlacement(w, h);
    assert.ok(s > 0, "positive scale");
    // horizontally centered
    assert.ok(Math.abs(ox - (w - LAYOUT_W * s) / 2) < 1e-9, `${w}×${h}: not centered`);
    // seals are held at chest height: layout midpoint below canvas midpoint
    assert.ok(oy + (LAYOUT_H * s) / 2 > h / 2, `${w}×${h}: not lower than center`);
    // and fully on screen, clear of the top (face) region
    assert.ok(oy > 0.25 * h, `${w}×${h}: overlaps face region`);
    assert.ok(oy + LAYOUT_H * s <= h, `${w}×${h}: spills off the bottom`);
  }
});

test("ghost placement scales with canvas height", () => {
  const a = ghostPlacement(960, 540);
  const b = ghostPlacement(960, 1080);
  assert.ok(Math.abs(b.s / a.s - 2) < 1e-9, "scale should track canvas height");
});

test("unknown seal id yields no ghost", () => {
  assert.equal(sealGhost("rasengan"), null);
  assert.equal(sealGhost(null), null);
});
