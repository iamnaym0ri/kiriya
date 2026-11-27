// Maomao's companion lines (src/world/companions/characters/maomao/lines.js) follow the shared
// contract in docs/refactor/RENOVATION.md "Companions": every line is a string or
// { text, expression }, every expression is one her face can draw, and visits are [mine, theirs].
import assert from "node:assert/strict";
import test from "node:test";
import { MAOMAO_EXPRESSIONS } from "../shared/maomaoExpressions.js";
import { COMPANION_IDS } from "../shared/companions.js";
import { lines, visit } from "../src/world/companions/characters/maomao/lines.js";

const drawable = new Set(MAOMAO_EXPRESSIONS);
const check = (where, entry) => {
  const text = typeof entry === "string" ? entry : entry?.text;
  assert.ok(typeof text === "string" && text.trim(), `${where}: empty line`);
  assert.ok(text.length <= 120, `${where}: too long for a bubble: ${text}`);
  assert.ok(!/\{(?!name\})/.test(text), `${where}: unknown placeholder: ${text}`);
  assert.ok(!/kiriya/i.test(text), `${where}: say {name}, the engine fills it: ${text}`);
  if (typeof entry !== "string") assert.ok(drawable.has(entry.expression), `${where}: no face for ${entry.expression}`);
};

test("Every topic the engine asks for is there, and each is deep enough not to repeat soon", () => {
  for (const topic of ["greet", "greetMorning", "greetAfternoon", "greetEvening", "greetNight", "idle", "tapped", "pester", "picked", "putDown", "birthday", "sweet", "visit", "bye",
    // Round 2: the tap menu (her vial), stay and wander, and her in-place moments.
    "action", "actionAfter", "stay", "wander", "stayIdle", "coins", "stretch", "drying", "slugLook", "sunbeam"]) {
    assert.ok(lines[topic]?.length >= 6, `${topic} has ${lines[topic]?.length ?? 0} lines`);
  }
});

test("Every line is a usable bubble with a face she can make", () => {
  for (const [topic, pool] of Object.entries(lines)) pool.forEach((entry, i) => check(`${topic}[${i}]`, entry));
});

test("Visits are pairs, Maomao first, with every other companion", () => {
  for (const id of COMPANION_IDS.filter((each) => each !== "maomao")) {
    const pairs = visit.with[id];
    assert.ok(pairs?.length >= 9, `few visit lines with ${id}`);
    pairs.forEach((pair, i) => {
      assert.equal(pair.length, 2, `${id}[${i}] is not a pair`);
      check(`${id}[${i}] mine`, pair[0]);
      check(`${id}[${i}] theirs`, pair[1]);
    });
  }
});

test("Her birthday lines know the date, and nothing she says is a remedy", () => {
  assert.ok(lines.birthday.some((entry) => /september/i.test(entry.text)));
  const all = Object.values(lines).flat().map((entry) => (typeof entry === "string" ? entry : entry.text));
  for (const text of all) assert.ok(!/\b\d+\s?(mg|ml|grams?|drops)\b/i.test(text), `sounds like a dose: ${text}`);
});
