// The paper doll's rules (src/world/play/games/artsy/paper-doll/logic.js): what can be worn
// together, surprise outfits, undo and the lookbook (docs/refactor/RENOVATION.md, "Games").
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, MAX_LOOKS, addLook, lookName, sameLook, surprise, takeOff, wear } from "../src/world/play/games/artsy/paper-doll/logic.js";

// ---------------------------------------------------------------- paper doll

const ITEMS = [
  { id: "t", slot: "top", colors: [[1], [2]] }, { id: "b", slot: "bottom", colors: [[1]] }, { id: "d", slot: "dress", colors: [[1], [2]] },
  { id: "s", slot: "shoes", colors: [[1]] }, { id: "h", slot: "head", colors: [[1]] }, { id: "k", slot: "socks", colors: [[1]] },
  { id: "n", slot: "neck", colors: [[1]] }, { id: "x", slot: "hand", colors: [[1]] }, { id: "w", slot: "back", colors: [[1]] },
];
const byId = (id) => ITEMS.find((item) => item.id === id);

test("paper doll: a dress replaces a top and skirt, and the other way round", () => {
  let look = wear(DEFAULT_LOOK, byId("d"), 1);
  assert.deepEqual(look.outfit.dress, { id: "d", c: 1 });
  assert.equal(look.outfit.top, undefined);
  assert.equal(look.outfit.bottom, undefined);
  assert.ok(look.outfit.shoes, "shoes stay on");
  look = wear(look, byId("t"));
  assert.equal(look.outfit.dress, undefined);
  assert.deepEqual(look.outfit.top, { id: "t", c: 0 });
  look = takeOff(look, "top");
  assert.equal(look.outfit.top, undefined);
  assert.ok(DEFAULT_LOOK.outfit.top, "the default look is never changed in place");
});

test("paper doll: surprise outfits are always wearable", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const look = surprise(DEFAULT_LOOK, ITEMS, [{ id: "waves" }, { id: "bob" }], 7, random);
    const slots = Object.keys(look.outfit);
    assert.ok(!(slots.includes("dress") && (slots.includes("top") || slots.includes("bottom"))));
    assert.ok(slots.includes("dress") || (slots.includes("top") && slots.includes("bottom")), "never left in just the slip");
    assert.ok(slots.includes("shoes"));
    for (const slot of slots) assert.ok(byId(look.outfit[slot].id)?.slot === slot);
    assert.ok(look.hair.c >= 0 && look.hair.c < 7);
  }
});

test("paper doll: the lookbook skips repeats, keeps the newest first and has a limit", () => {
  let looks = addLook([], DEFAULT_LOOK, "room", "a");
  looks = addLook(looks, structuredClone(DEFAULT_LOOK), "room", "b");
  assert.equal(looks.length, 1, "the same look twice in a row is saved once");
  const other = wear(DEFAULT_LOOK, byId("d"));
  looks = addLook(looks, other, "room", "c");
  assert.equal(looks[0].id, "c");
  for (let i = 0; i < 40; i++) looks = addLook(looks, wear(other, byId("h"), i % 2), i % 2 ? "room" : "garden", `l${i}`);
  assert.equal(looks.length, MAX_LOOKS);
  assert.ok(sameLook(DEFAULT_LOOK, structuredClone(DEFAULT_LOOK)));
  assert.ok(!sameLook(DEFAULT_LOOK, other));
  assert.equal(lookName(wear(other, byId("h")), (id) => ({ d: { name: "frill dress" }, h: { name: "kitty ears" } })[id]), "frill dress & kitty ears");
});

