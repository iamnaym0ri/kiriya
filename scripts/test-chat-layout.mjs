// The chat's photo layout rules (round 3): Discord's arrangement for 1–10 photos.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mosaic, soloRatio } from "../src/world/chat/layout.js";

test("Albums follow Discord's arrangement for every count from 1 to 10", () => {
  const expected = { 1: [1], 2: [2], 3: "feature", 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [1, 3, 3], 8: [2, 3, 3], 9: [3, 3, 3], 10: [1, 3, 3, 3] };
  for (const [count, rows] of Object.entries(expected)) assert.deepEqual(mosaic(Number(count)), rows, `${count} photos`);
  for (let n = 4; n <= 10; n++) assert.equal(mosaic(n).reduce((a, b) => a + b, 0), n, `${n} photos all placed`);
});

test("A solo photo keeps its own shape, within sensible limits", () => {
  assert.equal(soloRatio(1200, 900), 1200 / 900);
  assert.equal(soloRatio(4000, 500), 3, "a panorama is capped");
  assert.equal(soloRatio(500, 4000), 0.42, "a very tall shot is capped");
  assert.equal(soloRatio(), 1, "no size known: square until it loads");
});
