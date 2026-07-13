// Tests for the learn-mode fold animation (run: node --test tests/diagrams.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";

import { LAYOUTS, foldPose, sealDiagramFrame, sealDiagram } from "../frontend/scripts/diagrams.js";

const SEAL_IDS = Object.keys(LAYOUTS);

test("foldPose at k=0 is an open hand, flat and unrotated", () => {
  for (const id of SEAL_IDS) {
    for (const pose of LAYOUTS[id]) {
      const open = foldPose(pose, 0);
      assert.deepEqual(open.fingers, [1, 1, 1, 1, 1], `${id}: fingers should start extended`);
      assert.equal(open.rot, 0, `${id}: rotation should start at 0`);
      assert.equal(!!open.mirror, !!pose.mirror, `${id}: mirror must not animate`);
    }
  }
});

test("foldPose at k=1 reproduces the seal layout exactly", () => {
  for (const id of SEAL_IDS) {
    for (const pose of LAYOUTS[id]) {
      const done = foldPose(pose, 1);
      assert.deepEqual(done.fingers, pose.fingers, `${id}: fingers`);
      assert.equal(done.x, pose.x, `${id}: x`);
      assert.equal(done.y, pose.y, `${id}: y`);
      assert.equal(done.rot, pose.rot ?? 0, `${id}: rot`);
    }
  }
});

test("foldPose interpolates between open and target", () => {
  const pose = { fingers: [0, 1, 0, 0, 1], x: 130, y: 90, rot: -40 };
  const mid = foldPose(pose, 0.5);
  assert.equal(mid.fingers[0], 0.5);
  assert.equal(mid.fingers[1], 1);
  assert.equal(mid.rot, -20);
  assert.ok(mid.y > 90 && mid.y < 120, "y should sit between start and target");
});

test("open hands start apart: mirrored right, plain left", () => {
  const left = foldPose({ fingers: [0, 0, 0, 0, 0], x: 120, y: 110 }, 0);
  const right = foldPose({ fingers: [0, 0, 0, 0, 0], x: 120, y: 110, mirror: true }, 0);
  assert.ok(left.x < 120 && right.x > 120, "hands should begin spread from center");
});

test("sealDiagramFrame renders an svg for every seal at any k", () => {
  for (const id of SEAL_IDS) {
    for (const k of [0, 0.4, 1]) {
      const svg = sealDiagramFrame(id, k);
      assert.ok(svg.startsWith("<svg"), `${id}@${k}: expected svg`);
      assert.ok(svg.includes("</svg>"), `${id}@${k}: unterminated svg`);
    }
  }
  assert.equal(sealDiagramFrame("rasengan", 1), "");
});

test("sealDiagramFrame at k=1 matches the static diagram", () => {
  for (const id of SEAL_IDS) {
    assert.equal(sealDiagramFrame(id, 1), sealDiagram(id), id);
  }
});
