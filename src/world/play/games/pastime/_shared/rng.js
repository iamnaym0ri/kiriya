// Small seeded random numbers for the pastime games, so a round can be replayed and tested.
// mulberry32 by Tommy Ettinger (public domain).
export function seeded(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (list, random = Math.random) => list[Math.floor(random() * list.length)];
export const between = (min, max, random = Math.random) => min + random() * (max - min);
export const intBetween = (min, max, random = Math.random) => min + Math.floor(random() * (max - min + 1));

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
