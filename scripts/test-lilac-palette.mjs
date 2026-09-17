import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatHex, interpolate, oklch, parse, wcagContrast } from "culori";
import { FEELINGS } from "../server/content/moods.js";

// Moods tint the look she's on; they never replace it. This reads the real stylesheet and repeats
// the browser's `color-mix(in oklch, look, tint amount)` for every look and mood combination.
const css = await readFile(new URL("../src/styles/daily-style.css", import.meta.url), "utf8");
const block = (selector) => {
  const found = css.match(new RegExp(`${selector.replace(/[[\]"=()]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  assert.ok(found, `${selector} is missing from daily-style.css`);
  return Object.fromEntries([...found[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
};
const TOKENS = ["accent", "accent-hover", "ink", "muted", "hand", "page", "paper", "notebook", "soft", "line", "deep", "wash"];
const lilac = block(":root");
const moods = { lilac, ...Object.fromEntries(["rose", "iris", "night", "cloud"].map((key) => [key, { ...lilac, ...block(`:root[data-mood="${key}"]`) }])) };
// The papers take the pale tint; everything else takes the strong one.
const PALE = new Set(["page", "paper", "notebook", "soft", "line", "wash"]);
// What the browser computes for color-mix(in oklch, base, tint amount%), rounded to a real colour.
const mix = (base, tint, amount) => parse(formatHex(interpolate([parse(base), parse(tint)], "oklch")(amount)));
const theme = (mood, feeling) =>
  Object.fromEntries(TOKENS.map((token) => {
    const base = mood[`base-${token}`];
    if (!feeling) return [token, parse(base)];
    // The notebook's cream paper keeps its own colour; see daily-style.css.
    if (token === "notebook") return [token, parse(base)];
    const tint = feeling[PALE.has(token) ? "f-tint-pale" : "f-tint"];
    return [token, mix(base, tint, Number.parseFloat(feeling["f-amount"]) / 100)];
  }));
// Violet through pink. Near-white papers have too little colour for a meaningful hue.
const inLilacBand = (colour) => { const { c, h } = oklch(colour); return c < 0.015 || (h >= 290 && h <= 355); };
const channelShift = (a, b) => Math.max(...["r", "g", "b"].map((key) => Math.abs(Math.round(a[key] * 255) - Math.round(b[key] * 255))));

test("Every mood and feeling keeps the world lilac: violet-to-pink, tinted rather than recoloured", () => {
  for (const { key } of FEELINGS) {
    const feeling = block(`:root[data-feeling="${key}"]`);
    assert.ok(inLilacBand(parse(feeling["charm-color"])), `${key} charms stay lilac`);
    assert.ok(Math.abs(Number.parseFloat(feeling["feeling-hue"])) <= 10, `${key} turns the blossom photo only slightly`);
    for (const [moodKey, mood] of Object.entries(moods)) {
      const colours = theme(mood, feeling);
      for (const token of TOKENS) assert.ok(inLilacBand(colours[token]), `${moodKey} + ${key}: --theme-${token} leaves the lilac band (hue ${oklch(colours[token]).h?.toFixed(0)})`);
      assert.ok(oklch(colours.accent).c >= 0.03, `${moodKey} + ${key}: the accent still reads as a colour, not grey`);
      // The whole point of the tint: you notice it if you look for it, and never mistake it for
      // another colour. Measured against the same mood with no feeling chosen.
      for (const token of ["accent", "ink", "page", "paper", "soft", "line"]) {
        const shift = channelShift(colours[token], theme(mood)[token]);
        assert.ok(shift <= 13, `${moodKey} + ${key}: --theme-${token} moves ${shift}/255, too much for a tint`);
      }
      assert.ok(channelShift(colours.accent, theme(mood).accent) >= 2, `${moodKey} + ${key}: the accent doesn't move at all`);
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
