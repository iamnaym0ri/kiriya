import { distance, fromLch, hexDistance, inGamut, oklabToRgb, rgbToOklab, fromHex, toHex } from "./colour.js";

// Shy shade: every level is a grid of swatches with one shade hiding among them. The grid grows
// and the difference shrinks. The first levels (the "cue" levels) differ only in lightness and by
// a clear step, so they read without colour vision and the game can say "one is lighter".

export const HEARTS = 3;
export const CUE_LEVELS = 6;
export const MIN_DIFFERENCE = 0.014;

export function gridSize(level) {
  if (level <= 2) return 2;
  if (level <= 5) return 3;
  if (level <= 9) return 4;
  if (level <= 14) return 5;
  if (level <= 20) return 6;
  return 7;
}

/** How different the shy shade is, in Oklab units (about 0.02 is a just-noticeable step). */
export const difference = (level) => Math.max(MIN_DIFFERENCE, 0.17 * 0.885 ** (level - 1));

/** One squint (a hint that greys out half the grid) per run, plus one more every ten levels. */
export const squintsFor = (level) => 1 + Math.floor((level - 1) / 10);

function baseColour(level, random) {
  // Lilac to rose most of the time; periwinkle now and then once she's warmed up.
  const hue = level > 8 && random() < 0.2 ? 250 + random() * 35 : 285 + random() * 62;
  const L = 0.66 + random() * 0.19;
  const C = 0.065 + random() * 0.07;
  return fromLch(L, C, hue);
}

function direction(level, base, random) {
  if (level <= CUE_LEVELS) {
    // Lighter or darker, whichever keeps the pair comfortably inside the pastel range.
    const lighter = base[0] < 0.74 ? random() < 0.8 : random() < 0.25;
    return { dir: [lighter ? 1 : -1, 0, 0], kind: lighter ? "lighter" : "darker" };
  }
  // Later: a random mix of lighter/darker, softer/stronger and a nudge round the colour wheel,
  // with the hue nudge kept small so the shy shade stays the same family, just shy.
  const chroma = Math.hypot(base[1], base[2]) || 1;
  const radial = [0, base[1] / chroma, base[2] / chroma];
  const around = [0, -base[2] / chroma, base[1] / chroma];
  // At most 30% of the step goes round the wheel; the rest is lightness and softness.
  const turn = (random() * 2 - 1) * 0.3;
  const angle = random() * Math.PI * 2;
  const rest = Math.sqrt(1 - turn * turn);
  const [dl, dc] = [Math.cos(angle) * rest, Math.sin(angle) * rest];
  const v = [dl, dc * radial[1] + turn * around[1], dc * radial[2] + turn * around[2]];
  const n = Math.hypot(...v) || 1;
  return { dir: v.map((x) => x / n), kind: "different" };
}

/** A level's round: grid size, the swatch colour, the shy shade and where it hides. */
export function newRound(level, random = Math.random) {
  const size = gridSize(level);
  const amount = difference(level);
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = baseColour(level, random);
    const { dir, kind } = direction(level, base, random);
    const odd = base.map((x, i) => x + dir[i] * amount);
    const baseRgb = oklabToRgb(base);
    const oddRgb = oklabToRgb(odd);
    if (!inGamut(baseRgb) || !inGamut(oddRgb)) continue;
    const swatch = toHex(baseRgb);
    const shy = toHex(oddRgb);
    // Rounding to whole sRGB steps moves colours a hair; keep only rounds that stay true.
    const actual = hexDistance(swatch, shy);
    if (swatch === shy || Math.abs(actual - amount) > Math.max(0.004, amount * 0.2)) continue;
    return { level, size, swatch, shy, kind, odd: Math.floor(random() * size * size), amount: actual };
  }
  // Practically unreachable; a gentle fallback that is always in gamut.
  const swatch = "#c9a7dd";
  const shy = toHex(oklabToRgb(rgbToOklab(fromHex(swatch)).map((x, i) => (i === 0 ? x + amount : x))));
  return { level, size, swatch, shy, kind: "lighter", odd: Math.floor(random() * size * size), amount: distance(rgbToOklab(fromHex(swatch)), rgbToOklab(fromHex(shy))) };
}

export function newRun(random = Math.random) {
  return { level: 1, hearts: HEARTS, squints: squintsFor(1), round: newRound(1, random), missed: [], dimmed: [], phase: "play" };
}

/** Taps and the squint. Returns the next state; `event` says what happened, for sound and words. */
export function shadeTurn(state, action, random = Math.random) {
  if (action.type === "tap") {
    const i = action.index;
    if (state.phase !== "play" || state.missed.includes(i) || state.dimmed.includes(i) || i < 0 || i >= state.round.size ** 2) return state;
    if (i === state.round.odd) return { ...state, phase: "found", event: "found" };
    const hearts = state.hearts - 1;
    return { ...state, hearts, missed: [...state.missed, i], phase: hearts <= 0 ? "over" : "play", event: hearts <= 0 ? "over" : "miss" };
  }
  if (action.type === "next" && state.phase === "found") {
    const level = state.level + 1;
    const extra = squintsFor(level) - squintsFor(state.level);
    return { ...state, level, squints: state.squints + extra, round: newRound(level, random), missed: [], dimmed: [], phase: "play", event: "level" };
  }
  if (action.type === "squint" && state.phase === "play" && state.squints > 0 && !state.dimmed.length) {
    const cells = state.round.size ** 2;
    const others = [];
    for (let i = 0; i < cells; i++) if (i !== state.round.odd && !state.missed.includes(i)) others.push(i);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    return { ...state, squints: state.squints - 1, dimmed: others.slice(0, Math.floor(cells / 2)), event: "squint" };
  }
  return state;
}
