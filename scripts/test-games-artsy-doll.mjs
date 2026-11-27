// The paper doll's rules (src/world/play/games/artsy/paper-doll/logic.js): what can be worn
// together, themed sets, surprise outfits, undo, old saves and the lookbook
// (docs/refactor/RENOVATION.md, "Games"). The wardrobe itself draws SVG, so these tests use a small
// stand-in wardrobe with the same slots.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, HISTORY_MAX, MAX_LOOKS, SLOTS, addLook, inSet, lookName, pushHistory, sameLook, surprise, takeOff, tidyLook, wear, wearSet } from "../src/world/play/games/artsy/paper-doll/logic.js";

const ITEMS = [
  { id: "t", slot: "top", colors: [[1], [2]] }, { id: "b", slot: "bottom", colors: [[1]] }, { id: "d", slot: "dress", colors: [[1], [2]] },
  { id: "o", slot: "outer", colors: [[1], [2], [3]] }, { id: "s", slot: "shoes", colors: [[1]] }, { id: "h", slot: "head", colors: [[1]] },
  { id: "k", slot: "socks", colors: [[1]] }, { id: "n", slot: "neck", colors: [[1]] }, { id: "x", slot: "hand", colors: [[1]] },
  { id: "w", slot: "back", colors: [[1]] }, { id: "g", slot: "face", colors: [[1]] },
  { id: "blouse", slot: "top", colors: [[1]] }, { id: "pleats", slot: "bottom", colors: [[1]] }, { id: "frillsocks", slot: "socks", colors: [[1]] }, { id: "maryjanes", slot: "shoes", colors: [[1]] },
];
const byId = (id) => ITEMS.find((item) => item.id === id) ?? null;
const HAIRS = [{ id: "waves" }, { id: "bob" }];
const SET = { id: "idol", name: "idol stage", look: { hair: { id: "bob", c: 3 }, eyeStyle: "sparkle", mouth: "open", outfit: { dress: { id: "d", c: 1 }, shoes: { id: "s", c: 0 }, head: { id: "h", c: 0 } } } };
const RULES = { itemById: byId, hairById: (id) => HAIRS.find((hair) => hair.id === id) ?? HAIRS[0], hairColours: 12, skins: 6, eyeColours: 8, eyeStyles: ["round", "sparkle"], mouths: ["smile", "open"] };

test("paper doll: a dress replaces a top and skirt, the other way round, and a jacket goes over either", () => {
  let look = wear(DEFAULT_LOOK, byId("d"), 1);
  assert.deepEqual(look.outfit.dress, { id: "d", c: 1 });
  assert.equal(look.outfit.top, undefined);
  assert.equal(look.outfit.bottom, undefined);
  assert.ok(look.outfit.shoes, "shoes stay on");
  look = wear(look, byId("o"), 2);
  assert.ok(look.outfit.dress && look.outfit.outer, "a jacket over a dress");
  look = wear(look, byId("t"));
  assert.equal(look.outfit.dress, undefined);
  assert.deepEqual(look.outfit.top, { id: "t", c: 0 });
  assert.ok(look.outfit.outer, "and over a top");
  look = takeOff(look, "top");
  assert.equal(look.outfit.top, undefined);
  assert.ok(DEFAULT_LOOK.outfit.top, "the default look is never changed in place");
  assert.deepEqual(SLOTS.slice().sort(), ["back", "bottom", "dress", "face", "hand", "head", "neck", "outer", "shoes", "socks", "top"]);
});

test("paper doll: a set dresses her whole, hair and face included, and knows when she's in it", () => {
  const before = wear(wear(DEFAULT_LOOK, byId("o")), byId("w"));
  const look = wearSet(before, SET);
  assert.deepEqual(Object.keys(look.outfit).sort(), ["dress", "head", "shoes"], "nothing from before is left on");
  assert.deepEqual(look.hair, { id: "bob", c: 3 });
  assert.deepEqual([look.eyeStyle, look.mouth], ["sparkle", "open"]);
  assert.equal(look.skin, before.skin, "she stays herself");
  assert.ok(inSet(look, SET));
  assert.ok(inSet(wear(look, byId("d"), 0), SET), "another colour is still the set");
  assert.ok(!inSet(takeOff(look, "head"), SET));
  look.outfit.dress.c = 0;
  assert.equal(SET.look.outfit.dress.c, 1, "the set itself is never changed");
  assert.equal(lookName(wearSet(DEFAULT_LOOK, SET), byId, [SET]), "idol stage");
});

test("paper doll: surprise outfits are always wearable", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const look = surprise(DEFAULT_LOOK, ITEMS, HAIRS, 12, random);
    const slots = Object.keys(look.outfit);
    assert.ok(!(slots.includes("dress") && (slots.includes("top") || slots.includes("bottom"))));
    assert.ok(slots.includes("dress") || (slots.includes("top") && slots.includes("bottom")), "never left in just the slip");
    assert.ok(slots.includes("shoes"));
    for (const slot of slots) {
      const item = byId(look.outfit[slot].id);
      assert.equal(item?.slot, slot);
      assert.ok(look.outfit[slot].c < item.colors.length);
    }
    assert.ok(look.hair.c >= 0 && look.hair.c < 12);
  }
});

test("paper doll: undo history keeps the newest last and has a limit", () => {
  let history = [];
  for (let i = 0; i < HISTORY_MAX + 10; i++) history = pushHistory(history, { n: i });
  assert.equal(history.length, HISTORY_MAX);
  assert.deepEqual(history.at(-1), { n: HISTORY_MAX + 9 });
  const same = { n: 1 };
  assert.equal(pushHistory([same], same).length, 1);
});

test("paper doll: old saves are tidied, never broken", () => {
  const old = { skin: 9, eyes: 2, hair: { id: "gone", c: 40 }, outfit: { top: { id: "t", c: 7 }, dress: { id: "nope", c: 0 }, head: { id: "t", c: 0 } } };
  const look = tidyLook(old, RULES);
  assert.equal(look.skin, 5, "skin within the choices");
  assert.deepEqual(look.hair, { id: "waves", c: 11 }, "a missing hairstyle falls back, colour clamped");
  assert.deepEqual(look.outfit, { top: { id: "t", c: 1 } }, "unknown and misplaced pieces come off, colours clamp");
  assert.deepEqual([look.eyeStyle, look.mouth], ["round", "smile"], "older looks get the default face");
  assert.deepEqual(tidyLook(undefined, RULES).outfit, DEFAULT_LOOK.outfit);
});

test("paper doll: the lookbook skips repeats, keeps the newest first and has a limit", () => {
  let looks = addLook([], DEFAULT_LOOK, "room", "a");
  looks = addLook(looks, structuredClone(DEFAULT_LOOK), "room", "b");
  assert.equal(looks.length, 1, "the same look twice in a row is saved once");
  const other = wear(DEFAULT_LOOK, byId("d"));
  looks = addLook(looks, other, "room", "c");
  assert.equal(looks[0].id, "c");
  for (let i = 0; i < 40; i++) looks = addLook(looks, wear(other, byId("h"), 0), i % 2 ? "room" : "garden", `l${i}`);
  assert.equal(looks.length, MAX_LOOKS);
  assert.ok(sameLook(DEFAULT_LOOK, structuredClone(DEFAULT_LOOK)));
  assert.ok(!sameLook(DEFAULT_LOOK, other));
  assert.ok(!sameLook(DEFAULT_LOOK, { ...DEFAULT_LOOK, eyeStyle: "sparkle" }), "the face counts");
  const names = { d: { name: "babydoll dress" }, h: { name: "kitty ears" } };
  assert.equal(lookName(wear(other, byId("h")), (id) => names[id] ?? null), "babydoll dress & kitty ears");
  assert.equal(lookName({ outfit: {} }, () => null), "a little look");
});
