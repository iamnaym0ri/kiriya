import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { oklch, parse, wcagContrast } from "culori";
import { FEELINGS } from "../server/content/moods.js";

// Moods tint the lilac; they never replace it. This reads the real stylesheet and repeats the
// browser's `color-mix(in srgb, feeling 85%, mood)` for every mood and feeling combination.
const css = await readFile(new URL("../src/styles/daily-style.css", import.meta.url), "utf8");
const block = (selector) => {
  const found = css.match(new RegExp(`${selector.replace(/[[\]"=()]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  assert.ok(found, `${selector} is missing from daily-style.css`);
  return Object.fromEntries([...found[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
};
const TOKENS = ["accent", "accent-hover", "ink", "muted", "hand", "page", "paper", "notebook", "soft", "line", "deep", "wash"];
const lilac = block(":root");
const moods = { lilac, ...Object.fromEntries(["rose", "iris", "night", "cloud"].map((key) => [key, { ...lilac, ...block(`:root[data-mood="${key}"]`) }])) };
const mix = (top, bottom, amount = 0.85) => {
  const [a, b] = [parse(top), parse(bottom)];
  return { mode: "rgb", r: a.r * amount + b.r * (1 - amount), g: a.g * amount + b.g * (1 - amount), b: a.b * amount + b.b * (1 - amount) };
};
const theme = (mood, feeling) => Object.fromEntries(TOKENS.map((token) => [token, feeling ? mix(feeling[`f-${token}`], mood[`base-${token}`]) : parse(mood[`base-${token}`])]));
// Violet through pink. Near-white papers have too little colour for a meaningful hue.
const inLilacBand = (colour) => { const { c, h } = oklch(colour); return c < 0.015 || (h >= 290 && h <= 355); };

test("Every mood and feeling keeps the world lilac: violet-to-pink, tinted rather than recoloured", () => {
  for (const { key } of FEELINGS) {
    const feeling = block(`:root[data-feeling="${key}"]`);
    assert.ok(inLilacBand(parse(feeling["charm-color"])), `${key} charms stay lilac`);
    assert.ok(Math.abs(Number.parseFloat(feeling["feeling-hue"])) <= 25, `${key} turns the blossom photo only slightly`);
    for (const [moodKey, mood] of Object.entries(moods)) {
      const colours = theme(mood, feeling);
      for (const token of TOKENS) assert.ok(inLilacBand(colours[token]), `${moodKey} + ${key}: --theme-${token} leaves the lilac band (hue ${oklch(colours[token]).h?.toFixed(0)})`);
      assert.ok(oklch(colours.accent).c >= 0.03, `${moodKey} + ${key}: the accent still reads as a colour, not grey`);
    }
  }
  for (const [moodKey, mood] of Object.entries(moods)) for (const token of TOKENS) assert.ok(inLilacBand(theme(mood)[token]), `${moodKey}: --base-${token}`);
});

test("Feelings stay distinguishable and every combination stays readable", () => {
  const accents = new Set(FEELINGS.map(({ key }) => JSON.stringify(theme(lilac, block(`:root[data-feeling="${key}"]`)).accent)));
  assert.equal(accents.size, FEELINGS.length);
  for (const [moodKey, mood] of Object.entries(moods)) {
    for (const feeling of [null, ...FEELINGS.map(({ key }) => block(`:root[data-feeling="${key}"]`))]) {
      const colours = theme(mood, feeling);
      const name = `${moodKey}${feeling ? " with a feeling" : ""}`;
      assert.ok(wcagContrast(colours.ink, colours.paper) >= 7, `${name}: body text`);
      assert.ok(wcagContrast("#fff9ff", colours.accent) >= 4.5, `${name}: button text`);
      assert.ok(wcagContrast(colours.muted, colours.paper) >= 4.4, `${name}: quiet text`);
      // Handwriting is only used large, where 3:1 is the readable floor; 3.5 keeps a margin.
      assert.ok(wcagContrast(colours.hand, colours.paper) >= 3.5, `${name}: handwriting`);
    }
  }
});

test("Her public mood and presentation cards use the same lilac tints", async () => {
  const status = await readFile(new URL("../src/public/PublicStatus.css", import.meta.url), "utf8");
  const tones = Object.fromEntries(
    [...status.matchAll(/data-tone="(\w+)"\]\s*\{\s*--tone:\s*(#\w+);\s*--tone-soft:\s*(#\w+);\s*--tone-line:\s*(#\w+);/g)].map(([, key, tone, soft, line]) => [key, { tone, soft, line }]),
  );
  for (const key of [...FEELINGS.map((feeling) => feeling.key), "rose", "iris", "night", "cloud"]) {
    const card = tones[key];
    assert.ok(card, `the ${key} card has a tint`);
    for (const [name, colour] of Object.entries(card)) assert.ok(inLilacBand(parse(colour)), `${key} card --tone${name === "tone" ? "" : `-${name}`} leaves the lilac band (hue ${oklch(colour).h?.toFixed(0)})`);
    assert.ok(oklch(card.tone).c >= 0.03, `${key} card still reads as a colour, not grey`);
    assert.ok(wcagContrast(card.tone, card.soft) >= 4.5, `${key} card: label text`);
    assert.ok(wcagContrast("#fffaff", card.tone) >= 4.5, `${key} card: pronoun pill text`);
  }
});
