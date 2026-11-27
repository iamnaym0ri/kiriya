// The chat's themes and bubble designs (round 3, src/world/chat/theme): every theme × bubble
// combination keeps message text readable (WCAG AA, 4.5:1) on every colour its bubbles use,
// including each stop of a gradient, and every theme's header, composer, menus and quotes pass too.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parse, wcagContrast } from "culori";

const read = (name) => readFileSync(new URL(`../src/world/chat/theme/${name}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = (css) =>
  css
    .split("}")
    .map((chunk) => chunk.split("{"))
    .filter((parts) => parts.length === 2)
    .map(([selector, body]) => ({
      selector: selector.trim(),
      decls: Object.fromEntries(
        body
          .split(";")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]),
      ),
    }));

const themesCss = rules(read("themes.css"));
const bubblesCss = rules(read("bubbles.css"));
const { THEMES, BUBBLES } = await import("../src/world/chat/theme/list.js");

const themeVars = {};
for (const { selector, decls } of themesCss) {
  const match = /\.chat\[data-theme="(\w+)"\]/.exec(selector);
  if (match) themeVars[match[1]] = { ...(themeVars[match[1]] ?? {}), ...decls };
}
const bubbleVars = {};
const comboVars = {};
const paint = {};
for (const { selector, decls } of bubblesCss) {
  const bubble = /\[data-bubble="(\w+)"\]/.exec(selector)?.[1];
  if (!bubble) continue;
  const theme = /\.chat\[data-theme="(\w+)"\]/.exec(selector)?.[1];
  const first = selector.split(",")[0].trim();
  if (!first.includes(" ")) {
    const vars = Object.fromEntries(Object.entries(decls).filter(([name]) => name.startsWith("--chat-")));
    if (theme) comboVars[`${theme}/${bubble}`] = { ...(comboVars[`${theme}/${bubble}`] ?? {}), ...vars };
    else bubbleVars[bubble] = { ...(bubbleVars[bubble] ?? {}), ...vars };
  } else if (/ \.bubble$/.test(first) && decls["background-image"]) {
    const side = first.includes("[data-mine]") ? "mine" : "theirs";
    paint[`${theme ?? "*"}/${bubble}/${side}`] = decls["background-image"].match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  }
}

// The parser really found what it checks (a guard against a test that passes on nothing).
assert.equal(Object.keys(themeVars).length, THEMES.length);
for (const key of ["*/kawaii/mine", "*/kawaii/theirs", "*/fairy/mine", "*/lovey/mine"]) assert(paint[key]?.length >= 2, key);
assert.equal(comboVars["dark/paper"]?.["--chat-theirs"], "#2c2620");

const solid = (value) => {
  const color = parse(value);
  assert(color, `not a colour: ${value}`);
  return color;
};
const ratio = (a, b) => wcagContrast(solid(a), solid(b));

test("Every theme defines the whole palette the chat takes", () => {
  const contract = ["--chat-bg", "--chat-ink", "--chat-meta", "--chat-line", "--chat-accent", "--chat-accent-ink", "--chat-mine", "--chat-mine-ink", "--chat-theirs", "--chat-theirs-ink", "--chat-bar", "--chat-bar-ink", "--chat-field", "--chat-field-ink", "--chat-menu", "--chat-menu-ink", "--chat-reply"];
  assert(THEMES.length >= 8);
  for (const key of ["white", "cream", "dark", "love", "lilac"]) assert(THEMES.some((theme) => theme.key === key), key);
  for (const { key } of THEMES) for (const name of contract) assert(themeVars[key]?.[name], `${key} is missing ${name}`);
});

test("Header, composer, menus, quotes and the background's own words pass WCAG AA in every theme", () => {
  const failures = [];
  for (const { key } of THEMES) {
    const v = themeVars[key];
    const pairs = [
      ["bg", "ink", 4.5],
      ["bg", "meta", 4.5],
      ["bar", "bar-ink", 4.5],
      ["bar", "meta", 4.5],
      ["bar", "accent", 3],
      ["field", "field-ink", 4.5],
      ["field", "meta", 3],
      ["menu", "menu-ink", 4.5],
      ["menu", "meta", 4.5],
      ["accent", "accent-ink", 4.5],
      ["reply", "ink", 4.5],
      ["reply", "meta", 4.5],
      ["mine", "mine-ink", 4.5],
      ["theirs", "theirs-ink", 4.5],
    ];
    for (const [back, front, need] of pairs) {
      const got = ratio(v[`--chat-${back}`], v[`--chat-${front}`]);
      if (got < need) failures.push(`${key}: ${front} on ${back} is ${got.toFixed(2)}:1 (needs ${need})`);
    }
  }
  assert.deepEqual(failures, []);
});

test("Every theme × bubble design keeps message text at WCAG AA on every colour its bubbles use", () => {
  const failures = [];
  let checked = 0;
  for (const { key: theme } of THEMES)
    for (const { key: bubble } of BUBBLES) {
      const v = { ...themeVars[theme], ...(bubbleVars[bubble] ?? {}), ...(comboVars[`${theme}/${bubble}`] ?? {}) };
      for (const side of ["mine", "theirs"]) {
        const ink = v[`--chat-${side}-ink`];
        const backs = [v[`--chat-${side}`], ...(paint[`${theme}/${bubble}/${side}`] ?? paint[`*/${bubble}/${side}`] ?? [])];
        for (const back of backs) {
          checked++;
          const got = ratio(back, ink);
          if (got < 4.5) failures.push(`${theme} × ${bubble} (${side}): ${ink} on ${back} is ${got.toFixed(2)}:1`);
        }
      }
    }
  assert.deepEqual(failures, []);
  assert(checked >= THEMES.length * BUBBLES.length * 2);
});
