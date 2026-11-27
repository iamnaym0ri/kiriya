// Hatsune Miku's and KAITO's companion lines (src/world/companions/characters/{miku,kaito}/lines.js)
// follow the contract in docs/refactor/RENOVATION.md "Companions" and round 2's tap menu: every
// line is a string or { text, expression }, every expression is one their face can draw, the tap
// menu and stay topics exist, and visits with every other companion are [mine, theirs] pairs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMPANION_IDS } from "../shared/companions.js";
import { lines as mikuLines, visit as mikuVisit } from "../src/world/companions/characters/miku/lines.js";
import { lines as kaitoLines, visit as kaitoVisit } from "../src/world/companions/characters/kaito/lines.js";

/** The expression names a face file draws: the keys of its FACES table (read as text: it is JSX). */
function facesIn(file, table = "FACES") {
  const src = readFileSync(new URL(`../src/world/companions/characters/${file}`, import.meta.url), "utf8");
  const start = src.indexOf(`const ${table} = {`);
  assert.ok(start >= 0, `${file}: no ${table}`);
  const body = src.slice(start, src.indexOf("\n};", start));
  return new Set([...body.matchAll(/^ {2}([a-zA-Z]+):/gm)].map((m) => m[1]));
}

const characters = {
  miku: { lines: mikuLines, visit: mikuVisit, faces: facesIn("miku/Face.jsx") },
  kaito: { lines: kaitoLines, visit: kaitoVisit, faces: facesIn("kaito/KaitoFace.jsx") },
};

const check = (where, entry, faces) => {
  const text = typeof entry === "string" ? entry : entry?.text;
  assert.ok(typeof text === "string" && text.trim(), `${where}: empty line`);
  assert.ok(text.length <= 120, `${where}: too long for a bubble: ${text}`);
  assert.ok(!/\{(?!name\})/.test(text), `${where}: unknown placeholder: ${text}`);
  assert.ok(!/kiriya/i.test(text), `${where}: say {name}, the engine fills it: ${text}`);
  if (faces && entry && typeof entry !== "string" && entry.expression) assert.ok(faces.has(entry.expression), `${where}: no face for ${entry.expression}`);
};

const REQUIRED = ["greet", "greetMorning", "greetAfternoon", "greetEvening", "greetNight", "idle", "tapped", "pester", "picked", "putDown", "birthday", "sweet", "bye", "action", "actionAfter", "stay", "wander", "stayIdle"];

for (const [id, c] of Object.entries(characters)) {
  test(`${id}: every topic the engine asks for, the tap menu and stay included, is deep enough`, () => {
    for (const topic of REQUIRED) assert.ok(c.lines[topic]?.length >= 5, `${topic} has ${c.lines[topic]?.length ?? 0} lines`);
  });

  test(`${id}: every line is a usable bubble with a face it can make`, () => {
    for (const [topic, pool] of Object.entries(c.lines)) pool.forEach((entry, i) => check(`${topic}[${i}]`, entry, c.faces));
  });

  test(`${id}: visits are pairs, ${id} first, with every other companion`, () => {
    for (const other of COMPANION_IDS.filter((each) => each !== id)) {
      const pairs = c.visit.with[other];
      assert.ok(pairs?.length >= 8, `${pairs?.length ?? 0} visit pairs with ${other}`);
      pairs.forEach((pair, i) => {
        assert.equal(pair.length, 2, `${other}[${i}] is not a pair`);
        check(`${other}[${i}] mine`, pair[0], c.faces);
        check(`${other}[${i}] theirs`, pair[1], characters[other]?.faces ?? null);
      });
    }
  });
}

test("No song lyrics: nothing quoted at length, no verse markers", () => {
  for (const c of Object.values(characters)) {
    const all = [...Object.values(c.lines).flat(), ...Object.values(c.visit.with).flat(2)].map((e) => (typeof e === "string" ? e : e.text));
    for (const text of all) {
      assert.ok(!/["“][^"”]{40,}["”]/.test(text), `long quote: ${text}`);
      assert.ok(!/\b(verse|chorus) \d/i.test(text), `lyric marker: ${text}`);
    }
  }
});
