// "Stay" (README.md, "The tap menu and stay"): where each character was told to stay, kept on this
// phone so the next visit to home finds it on the same spot. Pure: no React, no DOM beyond
// localStorage, which may be missing or refuse (private mode), so every access is guarded.
//
// Stored as localStorage["kiriya:companion-stay"] = { [id]: { x, level } }: `x` is the share of the
// band's width (0 left .. 1 right), `level` the level's index counted from the bottom (0 = lowest).

export const STAY_KEY = "kiriya:companion-stay";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readAll() {
  try {
    const raw = store()?.getItem(STAY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    const s = store();
    if (!s) return false;
    if (Object.keys(all).length) s.setItem(STAY_KEY, JSON.stringify(all));
    else s.removeItem(STAY_KEY);
    return true;
  } catch {
    return false;
  }
}

/** A saved spot made safe to use: { x: 0..1, level: integer >= 0 }, or null if there is none. */
export function cleanSpot(spot) {
  if (!spot || typeof spot !== "object") return null;
  const x = Number(spot.x);
  const level = Number(spot.level);
  if (!Number.isFinite(x) || !Number.isFinite(level)) return null;
  return { x: clamp(x, 0, 1), level: Math.max(0, Math.floor(level)) };
}

/** Where this character was told to stay, or null if it is free to wander. */
export function readStay(id) {
  if (!id) return null;
  return cleanSpot(readAll()[id]);
}

/** Remembers the spot (false if the phone would not keep it: it still stays for this visit). */
export function writeStay(id, spot) {
  const clean = cleanSpot(spot);
  if (!id || !clean) return false;
  const all = readAll();
  all[id] = { x: Math.round(clean.x * 1000) / 1000, level: clean.level };
  return writeAll(all);
}

/** Forgets it: the character wanders again. */
export function clearStay(id) {
  const all = readAll();
  if (!(id in all)) return true;
  delete all[id];
  return writeAll(all);
}

/** The spot for a character standing at x on a level of this band. */
export function spotAt(x, level, band) {
  const span = Math.max(1, band.right - band.left);
  return { x: clamp((x - band.left) / span, 0, 1), level: Math.max(0, level ?? 0) };
}

/**
 * Where a saved spot is on today's levels: the same level counted from the bottom (or the top one
 * if there are fewer now), at the same share of the width, kept inside that level's span.
 */
export function placeSpot(spot, levels, band) {
  const clean = cleanSpot(spot);
  if (!clean || !levels?.length) return null;
  const level = Math.min(clean.level, levels.length - 1);
  const { x0, x1 } = levels[level];
  const x = band.left + clean.x * Math.max(1, band.right - band.left);
  return { level, x: clamp(x, x0, x1) };
}
