// Small seeded randomness for the dexterity games: the same seed gives the same round, which is what
// the tests rely on. mulberry32 is public domain (Tommy Ettinger).
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (random, min, max) => min + random() * (max - min);
export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing: how far to move towards a target this step. */
export const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
