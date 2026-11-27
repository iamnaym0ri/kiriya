// Teacup shuffle: the rules, kept pure so they're tested (scripts/test-games-luck.mjs).
// Fair and readable: one swap at a time, every swap visible, never faster than MIN_SWAP_MS, and
// the cup she must follow is in at least half of the swaps, so it really moves.
export const MIN_SWAP_MS = 300;
export const LIVES = 3;
export const MILESTONES = [
  { round: 5, sticker: "st-teacup", reason: "teacup shuffle: round 5" },
  { round: 10, sticker: "st-star", reason: "teacup shuffle: round 10" },
];

export function roundSettings(round) {
  const r = Math.max(1, Math.floor(round));
  return {
    cups: r >= 6 ? 4 : 3,
    swaps: Math.min(3 + r, 14),
    swapMs: Math.max(MIN_SWAP_MS, 720 - (r - 1) * 45),
  };
}

/** A swap of two slots takes a little longer when the cups travel further. */
export const swapDuration = (swapMs, a, b) => Math.round(swapMs * (0.85 + 0.15 * Math.abs(a - b)));

/** The swaps for one round, as pairs of slots [a, b] with a < b. */
export function planSwaps({ cups, swaps }, charmSlot, rng = Math.random) {
  const plan = [];
  let at = charmSlot;
  let last = "";
  for (let i = 0; i < swaps; i++) {
    let a;
    let b;
    let key;
    do {
      const withCharm = i % 2 === 0 || rng() < 0.5;
      a = withCharm ? at : Math.floor(rng() * cups);
      do b = Math.floor(rng() * cups); while (b === a);
      if (a > b) [a, b] = [b, a];
      key = `${a}-${b}`;
    } while (key === last && cups > 2);
    plan.push([a, b]);
    last = key;
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return plan;
}

/** Where the charm ends up after the swaps. */
export function followCharm(charmSlot, plan) {
  let at = charmSlot;
  for (const [a, b] of plan) {
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return at;
}

/** Applies swaps to `slotOf` (cup id → slot); returns a new array. */
export function applySwaps(slotOf, plan) {
  const next = [...slotOf];
  for (const [a, b] of plan) {
    const ca = next.indexOf(a);
    const cb = next.indexOf(b);
    next[ca] = b;
    next[cb] = a;
  }
  return next;
}
