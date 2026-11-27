// The artsy shelf's rules: colour by number and the kaleidoscope, plus the shared saves and rewards
// (docs/refactor/RENOVATION.md, "Games"). The paper doll and the bouquet maker have their own files
// (test-games-artsy-doll.mjs, test-games-artsy-bouquet.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { canFill, decodeIds, distanceField, hintRegion, idColour, labelSpots, nextColour, progress, toPicture, viewBox, zoomAround } from "../src/world/play/games/artsy/colour-by-number/logic.js";
import { PICTURES } from "../src/world/play/games/artsy/colour-by-number/pictures.js";
import { smooth, star } from "../src/world/play/games/artsy/colour-by-number/shapes.js";
import { readdirSync, existsSync } from "node:fs";
import { FOLDS, PALETTES, SLICE_CHOICES, beadPoints, copyPoint, isBlank, nearestCheckpoint, nextFold, strokeColour, symmetry, tidyPoints, visibleStrokes } from "../src/world/play/games/artsy/kaleidoscope/logic.js";
import { STORE_PREFIX, readJson, writeJson } from "../src/world/play/games/artsy/_kit/store.js";
import { ARTSY_REWARDS, countMade, rewardOnce } from "../src/world/play/games/artsy/_kit/rewards.js";
import { stickers as CATALOGUE } from "../server/content/birthday.js";

const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---------------------------------------------------------------- colour by number

test("colour by number: every picture is complete, paintable data", () => {
  const ids = new Set();
  for (const picture of PICTURES) {
    assert.ok(!ids.has(picture.id), `${picture.id} is unique`);
    ids.add(picture.id);
    assert.equal(picture.width, 360);
    assert.equal(picture.height, 480);
    assert.ok(picture.palette.length >= 6 && picture.palette.length <= 9, `${picture.id} has 6-9 paints`);
    assert.ok(picture.regions.length >= 20, `${picture.id} has enough shapes`);
    const used = new Set(picture.regions.map((region) => region.c));
    picture.palette.forEach((paint, c) => {
      assert.match(paint.hex, /^#[0-9a-f]{6}$/i);
      assert.ok(paint.name, "each paint has a name");
      assert.ok(used.has(c), `${picture.id}: paint ${c + 1} is used`);
    });
    for (const region of picture.regions) {
      assert.ok(Number.isInteger(region.c) && region.c >= 0 && region.c < picture.palette.length);
      assert.match(region.d, /^M[\d.-]/);
      assert.doesNotMatch(region.d, /NaN|undefined/);
    }
    for (const d of picture.lines) assert.doesNotMatch(d, /NaN|undefined/);
  }
  assert.equal(PICTURES.length, 6);
});

test("colour by number: numbers sit in the roomiest spot of each shape", () => {
  // A 9 × 7 map: region 0 everywhere, a 5 × 3 block of region 1, one outline pixel (-1).
  const w = 9, h = 7;
  const ids = new Int32Array(w * h);
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 6; x++) ids[y * w + x] = 1;
  ids[0] = -1;
  const field = distanceField(ids, w, h);
  assert.equal(field[0], 0);
  assert.equal(field[3 * w + 4], 1, "the block's middle is one step from its edge");
  const spots = labelSpots(ids, w, h, 2);
  assert.deepEqual([spots[1].x, spots[1].y], [4.5, 3.5]);
  assert.equal(spots[1].area, 15);
  assert.equal(spots[0].area, w * h - 15 - 1);
});

test("colour by number: the hit map's colours decode exactly and blends never pass as a region", () => {
  const count = 48;
  const seen = new Set();
  const rgba = new Uint8ClampedArray(count * 4 + 8);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = idColour(i);
    seen.add(`${r},${g},${b}`);
    rgba.set([r, g, b, 255], i * 4);
  }
  assert.equal(seen.size, count, "no two regions share a colour");
  rgba.set([10, 10, 10, 128], count * 4); // a half-covered edge pixel
  const [a, b] = [idColour(3), idColour(4)];
  rgba.set([(a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1, (a[2] + b[2]) >> 1, 255], count * 4 + 4);
  const ids = decodeIds(rgba, count);
  for (let i = 0; i < count; i++) assert.equal(ids[i], i);
  assert.equal(ids[count], -1);
  assert.equal(ids[count + 1], -1);
});

test("colour by number: progress, the next paint, the hint and what a tap can fill", () => {
  const picture = { palette: [{}, {}, {}], regions: [{ c: 0 }, { c: 1 }, { c: 1 }, { c: 2 }] };
  assert.deepEqual(progress(picture, []).colours, [{ total: 1, done: 0 }, { total: 2, done: 0 }, { total: 1, done: 0 }]);
  assert.equal(progress(picture, [0, 1]).done, 2);
  assert.equal(progress(picture, new Set([0, 1, 2, 3])).complete, true);
  assert.equal(nextColour(picture, [0], 0), 1);
  assert.equal(nextColour(picture, [0, 1, 2], 1), 2);
  assert.equal(nextColour(picture, [1, 2, 3], 2), 0, "wraps around");
  assert.equal(nextColour(picture, [0, 1, 2, 3], 0), -1);
  assert.equal(canFill(picture, [], 1, 1), true);
  assert.equal(canFill(picture, [1], 1, 1), false, "already painted");
  assert.equal(canFill(picture, [], 1, 0), false, "wrong number");
  assert.equal(canFill(picture, [], 9, 0), false);
  assert.equal(hintRegion(picture, [], 1, [{}, { area: 50 }, { area: 8 }, {}]), 2, "the smallest one first");
  assert.equal(hintRegion(picture, [2], 1, [{}, { area: 50 }, { area: 8 }, {}]), 1);
  assert.equal(hintRegion(picture, [1, 2], 1, []), -1);
});

test("colour by number: zooming keeps the picture point under the fingers and the view on the picture", () => {
  const stage = { width: 390, height: 600 }, picture = { width: 360, height: 480 };
  const whole = viewBox({ z: 1, cx: 180, cy: 240 }, stage, picture);
  assert.ok(near(whole.cx, 180) && near(whole.cy, 240));
  assert.ok(whole.w >= 360 && whole.h >= 480);
  const [px, py] = toPicture(whole, 100, 200);
  const zoomed = zoomAround(3, px, py, 100, 200, stage, picture);
  const [qx, qy] = toPicture(zoomed, 100, 200);
  assert.ok(near(qx, px, 1e-6) && near(qy, py, 1e-6), "anchor stays put");
  const corner = viewBox({ z: 4, cx: -500, cy: 9999 }, stage, picture);
  assert.ok(corner.x >= 0 && corner.y + corner.h <= 480 + 1e-9, "clamped to the picture");
  assert.equal(zoomAround(40, 0, 0, 0, 0, stage, picture).z, 8, "zoom has a ceiling");
});

test("colour by number: shape helpers make closed, finite paths", () => {
  const d = smooth([[0, 0], [10, 0, 1], [10, 10], [0, 10]]);
  assert.match(d, /^M0 0C.*Z$/);
  assert.equal((star(50, 50, 20).match(/C/g) ?? []).length, 10);
});

// ---------------------------------------------------------------- kaleidoscope

test("kaleidoscope: a stroke is copied n times, twice that when mirrored", () => {
  assert.equal(symmetry(8, false).length, 8);
  assert.equal(symmetry(6, true).length, 12);
  const quarter = copyPoint([600, 500], { angle: Math.PI / 2, flip: false });
  assert.ok(near(quarter[0], 500) && near(quarter[1], 600), "a quarter turn about the centre");
  const flipped = copyPoint([600, 520], { angle: 0, flip: true });
  assert.ok(near(flipped[0], 600) && near(flipped[1], 480), "mirrored across the centre line");
  for (const copy of symmetry(5, true)) {
    const [x, y] = copyPoint([700, 640], copy);
    assert.ok(near(Math.hypot(x - 500, y - 500), Math.hypot(200, 140)), "copies stay the same distance from the centre");
  }
});

test("kaleidoscope: points are tidied, beads evenly spaced, folds cycle and undo finds its snapshot", () => {
  const tidy = tidyPoints([[0, 0, 0.5], [0.4, 0, 0.5], [3, 0, 0.513], [3.2, 0.1, 0.5], [10.123, 4.567, 0.5]]);
  assert.deepEqual(tidy, [[0, 0, 0.5], [3, 0, 0.51], [10.1, 4.6, 0.5]]);
  const beads = beadPoints([[0, 0], [10, 0], [25, 0]], 5);
  assert.deepEqual(beads.map(([x]) => x), [0, 5, 10, 15, 20, 25]);
  let n = FOLDS[0];
  const seen = new Set();
  for (let i = 0; i < FOLDS.length; i++) seen.add((n = nextFold(n)));
  assert.equal(seen.size, FOLDS.length);
  assert.equal(nextFold(99), FOLDS[0]);
  const checkpoints = new Map([[20, "a"], [40, "b"], [60, "c"]]);
  assert.equal(nearestCheckpoint(checkpoints, 59), 40);
  assert.equal(nearestCheckpoint(checkpoints, 60), 60);
  assert.equal(nearestCheckpoint(checkpoints, 7), 0);
});

test("kaleidoscope: the page, blank or not, and the colour each new stroke takes", () => {
  const stroke = (tool = "ink") => ({ tool, points: [[1, 1]] });
  assert.equal(isBlank([]), true);
  assert.equal(isBlank([stroke()]), false);
  assert.equal(isBlank([stroke(), { tool: "clear" }]), true, "a fresh plate is blank");
  assert.deepEqual(visibleStrokes([stroke("ink"), { tool: "clear" }, stroke("glow")]).map((each) => each.tool), ["glow"]);
  const palette = PALETTES[0];
  assert.equal(strokeColour({ turns: false, colour: 2 }, palette, []), palette.colors[2]);
  assert.equal(strokeColour({ turns: false, colour: 99 }, palette, []), palette.colors[0]);
  const drawn = [stroke(), stroke(), { tool: "clear" }, stroke(), stroke("eraser")];
  assert.equal(strokeColour({ turns: true }, palette, drawn), palette.colors[1], "rainbow counts only what's on the page, erasers aside");
  assert.equal(strokeColour({ turns: true }, palette, Array.from({ length: palette.colors.length }, () => stroke())), palette.colors[0], "and wraps around");
  for (const each of PALETTES) {
    assert.equal(each.colors.length, 6, `${each.id} fills the colour row`);
    for (const colour of each.colors) assert.match(colour, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(new Set(PALETTES.map((each) => each.id)).size, PALETTES.length);
  assert.deepEqual(SLICE_CHOICES, [...SLICE_CHOICES].sort((a, b) => a - b));
  for (const n of SLICE_CHOICES) assert.ok(FOLDS.includes(n), `${n} slices draw like any other fold`);
});

// ---------------------------------------------------------------- saves and rewards

test("artsy saves survive bad or missing storage", () => {
  const store = memory();
  assert.equal(readJson("x", 5, store), 5);
  assert.equal(writeJson("x", { a: 1 }, store), true);
  assert.deepEqual(readJson("x", null, store), { a: 1 });
  assert.ok(store.data.has(`${STORE_PREFIX}x`));
  store.setItem(`${STORE_PREFIX}bad`, "{nope");
  assert.equal(readJson("bad", "fallback", store), "fallback");
  const full = { ...memory(), setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(writeJson("x", 1, full), false);
  assert.equal(readJson("x", 1, null), 1);
});

// New sticker designs the artsy games bring along (each game's stickers.js), by id.
const artsyDir = new URL("../src/world/play/games/artsy/", import.meta.url);
const GAME_STICKERS = new Map();
for (const folder of readdirSync(artsyDir)) {
  const file = new URL(`${folder}/stickers.js`, artsyDir);
  if (!existsSync(file)) continue;
  for (const sticker of (await import(file)).default) GAME_STICKERS.set(sticker.id, { ...sticker, folder });
}

test("artsy rewards: stickers from her catalogue or a game's own stickers.js, each given once", () => {
  const known = new Set(CATALOGUE.filter((sticker) => !sticker.birthdayOnly).map((sticker) => sticker.id));
  for (const [game, rewards] of Object.entries(ARTSY_REWARDS))
    for (const reward of Object.values(rewards)) {
      assert.match(reward.sticker, /^st-[a-z0-9-]{1,40}$/);
      assert.ok(known.has(reward.sticker) || GAME_STICKERS.has(reward.sticker), `${game}: ${reward.sticker} has art somewhere`);
      assert.ok(reward.reason.length <= 80);
    }
  for (const [id, sticker] of GAME_STICKERS) {
    assert.ok(!known.has(id), `${id} doesn't reuse a catalogue id`);
    assert.ok(sticker.name && sticker.line, `${id} has a name and a line`);
    assert.match(sticker.art, /^<(path|g|circle|rect|ellipse)/, `${id} is 64×64 svg markup`);
  }
  assert.ok(!("sticker-scene" in ARTSY_REWARDS), "the sticker scenes are gone from the shelf");
  assert.ok(known.has("st-kitten"), "the sticker scene's old reward stays in her catalogue");
  const store = memory();
  const got = [];
  assert.equal(rewardOnce((reward) => got.push(reward), "kaleidoscope", "first", store), true);
  assert.equal(rewardOnce((reward) => got.push(reward), "kaleidoscope", "first", store), false);
  assert.equal(rewardOnce((reward) => got.push(reward), "nope", "first", store), false);
  assert.deepEqual(got, [{ sticker: "st-mirror", reason: "kept a first kaleidoscope" }]);
  assert.deepEqual([countMade("bouquet", store), countMade("bouquet", store), countMade("kaleidoscope", store)], [1, 2, 1]);
});
