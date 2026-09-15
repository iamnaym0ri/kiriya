import { createHash } from "node:crypto";

// Deterministic randomness: the same day and salt always give the same choices, so a card doesn't
// change when the page is refreshed, and tomorrow still feels different.
export function seededRandom(...parts) {
  let state = createHash("sha256").update(parts.join("|")).digest().readUInt32LE(0) || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks `count` items from `pool`, preferring ones not in `recentIds` (most recent last).
 * If everything was used recently, the least recently used come back first.
 */
export function pickFresh(pool, { count = 1, recentIds = [], random, id = (item) => item.id } = {}) {
  const recentRank = new Map(recentIds.map((key, i) => [key, i]));
  const unused = shuffle(pool.filter((item) => !recentRank.has(id(item))), random);
  const used = pool
    .filter((item) => recentRank.has(id(item)))
    .sort((a, b) => recentRank.get(id(a)) - recentRank.get(id(b)));
  return [...unused, ...used].slice(0, count);
}
