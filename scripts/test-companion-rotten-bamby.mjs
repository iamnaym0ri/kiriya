// Rotten Girl Miku's and Bamby's companion files (src/world/companions/characters/miku-rotten,
// .../bambi) follow the contract in src/world/companions/README.md: every topic the engine asks for
// (including round 2's action, stay, wander and stayIdle) is there, every line is a usable bubble
// with a face its rig can draw, visits cover every other companion with replies in the other's
// face, every pose and topic index.js names exists, and each has at least three things it can do
// in place while told to stay. Faces and poses are read from the .jsx sources (node can't import
// JSX), so this runs without a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMPANION_IDS } from "../shared/companions.js";
import { MAOMAO_EXPRESSIONS } from "../shared/maomaoExpressions.js";
import * as rottenLines from "../src/world/companions/characters/miku-rotten/lines.js";
import * as bambyLines from "../src/world/companions/characters/bambi/lines.js";

const dir = new URL("../src/world/companions/characters/", import.meta.url);
const source = (path) => readFileSync(new URL(path, dir), "utf8");
/** The keys of `const <name> = { … };` in a source file, one per line at two spaces in. */
function keysOf(path, name) {
  const text = source(path);
  const start = text.indexOf(`const ${name} = {`);
  assert.ok(start >= 0, `${path}: no ${name}`);
  const body = text.slice(start, text.indexOf("\n};", start));
  return new Set([...body.matchAll(/^ {2}([a-z][a-zA-Z]*): /gm)].map((m) => m[1]));
}

const faces = {
  "miku-rotten": keysOf("miku-rotten/Face.jsx", "FACES"),
  bambi: keysOf("bambi/Face.jsx", "FACES"),
  miku: keysOf("miku/Face.jsx", "FACES"),
  kaito: keysOf("kaito/KaitoFace.jsx", "FACES"),
  maomao: new Set(MAOMAO_EXPRESSIONS),
};
const poses = {
  "miku-rotten": keysOf("miku-rotten/Body.jsx", "POSES"),
  bambi: keysOf("bambi/Body.jsx", "POSE_FACE"),
};
const characters = { "miku-rotten": rottenLines, bambi: bambyLines };

const bubble = (where, entry, drawable) => {
  const text = typeof entry === "string" ? entry : entry?.text;
  assert.ok(typeof text === "string" && text.trim(), `${where}: empty line`);
  assert.ok(text.length <= 110, `${where}: too long for a bubble: ${text}`);
  assert.ok(!/\{(?!name\})/.test(text), `${where}: unknown placeholder: ${text}`);
  assert.ok(!/kiriya/i.test(text), `${where}: say {name}, the engine fills it: ${text}`);
  assert.ok(!/\bbambi\b/i.test(text), `${where}: his name is spelt Bamby: ${text}`);
  if (typeof entry !== "string") assert.ok(drawable.has(entry.expression), `${where}: no face for ${entry.expression}`);
};

for (const [id, { lines, visit }] of Object.entries(characters)) {
  test(`${id}: every topic the engine asks for is there, deep enough not to repeat soon`, () => {
    for (const topic of ["greet", "greetMorning", "greetAfternoon", "greetEvening", "greetNight", "idle", "tapped", "picked", "putDown", "birthday", "sweet"]) {
      assert.ok(lines[topic]?.length >= 5, `${topic} has ${lines[topic]?.length ?? 0} lines`);
    }
    for (const topic of ["pester", "bye", "visit", "action", "stay", "wander", "stayIdle"]) {
      assert.ok(lines[topic]?.length >= 3, `${topic} has ${lines[topic]?.length ?? 0} lines`);
    }
  });

  test(`${id}: every line is a usable bubble with a face it can make`, () => {
    for (const [topic, pool] of Object.entries(lines)) pool.forEach((entry, i) => bubble(`${topic}[${i}]`, entry, faces[id]));
  });

  test(`${id}: visits with every other companion, replies in the other's face`, () => {
    for (const other of COMPANION_IDS.filter((each) => each !== id)) {
      const talks = visit.with[other];
      assert.ok(talks?.length >= 5, `few visit lines with ${other}`);
      talks.forEach((talk, i) => {
        assert.ok(talk.length >= 2, `${other}[${i}] needs at least a line and a reply`);
        talk.forEach((entry, k) => bubble(`${other}[${i}][${k}]`, entry, k % 2 ? faces[other] : faces[id]));
      });
    }
  });

  test(`${id}: index.js names only poses and topics that exist, and it can stay busy in place`, () => {
    const index = source(`${id === "bambi" ? "bambi" : "miku-rotten"}/index.js`);
    for (const [, pose] of index.matchAll(/\bpose: "([a-zA-Z]+)"/g)) assert.ok(poses[id].has(pose), `no pose ${pose}`);
    for (const [, topic] of index.matchAll(/\btopic: "([a-zA-Z]+)"/g)) assert.ok(lines[topic]?.length, `no lines for topic ${topic}`);
    for (const [, face] of index.matchAll(/\bexpression: "([a-zA-Z]+)"/g)) assert.ok(faces[id].has(face), `no face ${face}`);
    const behaviours = index.slice(index.indexOf("behaviours: ["), index.indexOf("\n  ],", index.indexOf("behaviours: [")));
    const inPlace = [...behaviours.matchAll(/^ {4}\{ id: "([a-z]+)"[^\n]*$/gm)].filter(([line]) => !/roam: true|level: "/.test(line));
    assert.ok(inPlace.length >= 3, `only ${inPlace.length} in-place behaviours`);
    const action = index.slice(index.indexOf("action: {"), index.indexOf("\n  },", index.indexOf("action: {")));
    const label = action.match(/label: "([^"]+)"/)?.[1];
    assert.ok(label && label.length <= 20 && label === label.toLowerCase(), `action label: ${label}`);
    assert.ok(/prop: "[a-z]+"/.test(action), "the action hands its Body a prop");
  });
}
