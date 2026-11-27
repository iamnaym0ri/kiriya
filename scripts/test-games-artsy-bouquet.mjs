// The bouquet maker's rules (src/world/play/games/artsy/bouquet/logic.js): where flowers land, the
// fan they stay in, arranging, layers, the vase shelf, the name and a surprise bouquet, plus the
// catalogue of flowers, wraps and ribbons it draws from (docs/refactor/RENOVATION.md, "Games").
import test from "node:test";
import assert from "node:assert/strict";
import { CARD_MAX, FAN, MAX_FLOWERS, MAX_SHELF, MAX_SIZE, MIN_SIZE, TIE, addFlower, arrange, bouquetName, clampToFan, duplicate, handleTo, lean, moveTo, pinchTo, placeNew, pushHistory, removeItem, sameBouquet, shelve, stemPath, surprise, tidyCard, toBack, toFront, turnOf, unshelve } from "../src/world/play/games/artsy/bouquet/logic.js";

const inFan = ([x, y]) => {
  const dx = (x - FAN.cx) / FAN.rx, dy = (y - FAN.cy) / FAN.ry;
  return Math.hypot(dx, dy) <= 1.005 && y >= FAN.top - 0.05 && y <= FAN.bottom + 0.05; // positions are rounded to 0.1
};
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// A small stand-in catalogue (the real one draws SVG, so it stays out of node tests).
const CATALOGUE = {
  flowers: [
    { id: "rose", role: "bloom", colors: [1, 2, 3] },
    { id: "peony", role: "bloom", colors: [1, 2] },
    { id: "daisy", role: "little", colors: [1, 2] },
    { id: "lavender", role: "little", colors: [1] },
    { id: "fern", role: "green", colors: [1, 2] },
    { id: "heart", role: "extra", colors: [1] },
  ],
  wraps: [{ id: "kraft", colors: [1, 2] }, { id: "tissue", colors: [1] }],
  ribbons: [{ id: "satin", colors: [1, 2, 3] }],
};
const roleOf = (kind) => CATALOGUE.flowers.find((flower) => flower.id === kind)?.role ?? "bloom";

test("bouquet: new flowers land in the fan, spread out, greenery behind", () => {
  const random = seeded();
  let items = [];
  for (let i = 0; i < 12; i++) {
    const role = i % 4 === 0 ? "green" : "bloom";
    const flower = placeNew(items, { kind: role === "green" ? "fern" : "rose", role }, random, `f${i}`);
    assert.ok(inFan([flower.x, flower.y]), `flower ${i} is inside the fan`);
    assert.ok(flower.s >= MIN_SIZE && flower.s <= MAX_SIZE);
    items = addFlower(items, flower, role);
  }
  assert.equal(items[0].kind, "fern", "greenery slips in behind everything");
  const spots = new Set(items.slice(0, 8).map((item) => `${Math.round(item.x / 12)},${Math.round(item.y / 12)}`));
  assert.ok(spots.size >= 7, "the first flowers don't stack on one spot");
  let full = [];
  for (let i = 0; i < MAX_FLOWERS + 5; i++) full = addFlower(full, { id: `x${i}`, kind: "rose", x: 150, y: 150, s: 1 }, "bloom");
  assert.equal(full.length, MAX_FLOWERS, "a bouquet has a limit");
});

test("bouquet: moving keeps heads in the fan, pinch and the handle size and turn within limits", () => {
  for (const [x, y] of [[-500, -500], [900, 140], [150, 999], [150, 162]]) assert.ok(inFan(clampToFan(x, y)));
  const rose = { id: "a", kind: "rose", c: 0, x: 150, y: 160, s: 1, t: 0 };
  assert.ok(inFan([moveTo(rose, 9999, 9999).x, moveTo(rose, 9999, 9999).y]));
  assert.equal(pinchTo(rose, 100, 0).s, MAX_SIZE);
  assert.equal(pinchTo(rose, 0.001, 0).s, MIN_SIZE);
  assert.equal(pinchTo(rose, 1, 999).t, 180, "turning is clamped");
  const turned = handleTo(rose, [170, 160], [150, 200]);
  assert.ok(Math.abs(turned.s - 1.9) < 1e-9 || Math.abs(turned.s - 2) < 0.11, "twice as far is twice as big (up to the limit)");
  assert.ok(Math.abs(turned.t - 90) < 0.1, "a quarter turn");
  assert.equal(lean(TIE[0], 100), 0, "straight above the tie: upright");
  assert.ok(lean(60, 120) < 0 && lean(240, 120) > 0, "flowers lean away from the middle");
  assert.equal(turnOf({ ...rose, x: 240, t: 10 }), Math.round((lean(240, 160) + 10) * 10) / 10);
  const d = stemPath(rose);
  assert.match(d, /^M[\d.-]+ [\d.-]+Q[\d.-]+ [\d.-]+ 150 300L[\d.-]+ 396$/, "every stem gathers at the tie and runs down past it");
});

test("bouquet: layers, copies, removing and undo history", () => {
  const a = { id: "a", kind: "rose", x: 150, y: 150, s: 1 }, b = { ...a, id: "b" }, c = { ...a, id: "c" };
  assert.deepEqual(toFront([a, b, c], "a").map((each) => each.id), ["b", "c", "a"]);
  assert.deepEqual(toBack([a, b, c], "c").map((each) => each.id), ["c", "a", "b"]);
  const copied = duplicate([a, b], "a", "a2");
  assert.deepEqual(copied.map((each) => each.id), ["a", "a2", "b"], "a copy sits just above its original");
  assert.ok(inFan([copied[1].x, copied[1].y]));
  assert.deepEqual(removeItem([a, b], "a").map((each) => each.id), ["b"]);
  let history = [];
  for (let i = 0; i < 50; i++) history = pushHistory(history, { n: i });
  assert.equal(history.length, 40);
  const same = { n: 1 };
  assert.equal(pushHistory([same], same).length, 1, "the same state twice is kept once");
});

test("bouquet: arranging spreads every flower over the fan, blooms in the middle, greenery at the rim", () => {
  const random = seeded(3);
  let items = [];
  for (const [kind, role] of [["fern", "green"], ["rose", "bloom"], ["daisy", "little"], ["peony", "bloom"], ["fern", "green"], ["daisy", "little"], ["rose", "bloom"]])
    items = addFlower(items, placeNew(items, { kind, role }, random), role);
  const neat = arrange(items, roleOf);
  assert.equal(neat.length, items.length);
  assert.deepEqual(new Set(neat.map((each) => each.id)), new Set(items.map((each) => each.id)), "nobody lost or added");
  for (const item of neat) {
    assert.ok(inFan([item.x, item.y]));
    assert.equal(item.t, 0);
    const before = items.find((each) => each.id === item.id);
    assert.deepEqual([item.kind, item.c, item.s], [before.kind, before.c, before.s], "kind, colour and size stay");
  }
  const dist = (item) => Math.hypot((item.x - FAN.cx) / FAN.rx, (item.y - FAN.cy) / FAN.ry);
  const greens = neat.filter((each) => roleOf(each.kind) === "green");
  const blooms = neat.filter((each) => roleOf(each.kind) === "bloom");
  assert.ok(Math.min(...greens.map(dist)) > Math.max(...blooms.map(dist)) - 0.2, "greenery sits further out than the blooms");
  assert.ok(neat.findIndex((each) => roleOf(each.kind) !== "green") >= greens.length, "greenery stays behind");
  assert.deepEqual(arrange(items, roleOf), neat, "the same bouquet always settles the same way");
});

test("bouquet: the card, a name, and her vase shelf", () => {
  assert.equal(tidyCard("  for   you ♡  "), "for you ♡");
  assert.equal(tidyCard("x".repeat(80)).length, CARD_MAX);
  const names = { rose: { one: "rose", many: "roses" }, daisy: { one: "daisy", many: "daisies" }, fern: { one: "fern", many: "ferns", quiet: true } };
  const nameOf = (kind) => names[kind] ?? null;
  const flowers = (...kinds) => kinds.map((kind, i) => ({ id: `${i}`, kind, x: 150, y: 150, s: 1 }));
  assert.equal(bouquetName(flowers("rose", "rose", "daisy", "fern", "fern", "fern"), nameOf), "roses & daisy", "greenery doesn't name a bouquet");
  assert.equal(bouquetName(flowers("fern"), nameOf), "a little bouquet");
  const one = { items: flowers("rose"), wrap: { id: "kraft", c: 0 }, ribbon: { id: "satin", c: 1 }, card: "ily" };
  let { shelf, entry, added } = shelve([], one, { id: "s1", name: "rose", at: "2026-11-27" });
  assert.deepEqual([shelf.length, added, entry.id], [1, true, "s1"]);
  ({ shelf, added } = shelve(shelf, structuredClone(one), { id: "s2", name: "rose" }));
  assert.deepEqual([shelf.length, added], [1, false], "the same bouquet twice is shelved once");
  const changed = { ...one, card: "miss u" };
  ({ shelf, entry, added } = shelve(shelf, changed, { id: "s3", name: "rose", editing: "s1" }));
  assert.deepEqual([shelf.length, added, entry.id, entry.card], [1, false, "s1", "miss u"], "re-opened and changed: updated in place");
  assert.ok(sameBouquet(shelf[0], changed));
  for (let i = 0; i < 40; i++) shelf = shelve(shelf, { ...one, card: `${i}` }, { id: `n${i}`, name: "rose" }).shelf;
  assert.equal(shelf.length, MAX_SHELF);
  assert.equal(unshelve(shelf, shelf[0].id).length, MAX_SHELF - 1);
});

test("bouquet: a surprise is always a real bouquet", () => {
  const random = seeded(11);
  for (let i = 0; i < 100; i++) {
    const made = surprise(CATALOGUE, random);
    assert.ok(made.items.length >= 6 && made.items.length <= MAX_FLOWERS);
    assert.ok(made.items.some((item) => roleOf(item.kind) === "bloom"));
    assert.ok(made.items.some((item) => roleOf(item.kind) === "green"));
    for (const item of made.items) {
      assert.ok(inFan([item.x, item.y]));
      const flower = CATALOGUE.flowers.find((each) => each.id === item.kind);
      assert.ok(item.c >= 0 && item.c < flower.colors.length);
    }
    const colours = new Map();
    for (const item of made.items) {
      if (colours.has(item.kind)) assert.equal(colours.get(item.kind), item.c, "the same flowers match");
      colours.set(item.kind, item.c);
    }
    assert.ok(CATALOGUE.wraps.some((wrap) => wrap.id === made.wrap.id && made.wrap.c < wrap.colors.length));
    assert.ok(made.ribbon.c < CATALOGUE.ribbons[0].colors.length);
    assert.equal(new Set(made.items.map((item) => item.id)).size, made.items.length, "ids are unique");
  }
});
