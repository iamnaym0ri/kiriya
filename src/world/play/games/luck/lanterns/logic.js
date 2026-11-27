// Wishing lanterns: which lanterns rise, and what each one carries. Pure, tested in
// scripts/test-games-luck.mjs. One golden lantern a day carries a spare capsule coin.
import { shuffle } from "../_kit/random.js";

export const PICKS_PER_SKY = 3;
export const GOLDEN_CHANCE = 0.55;
export const LANTERN_TINTS = ["peach", "rose", "lilac", "sky"];

export const WISHES = [
  "may your coffee stay exactly as warm as you like it",
  "may every crossing light turn green when you're in a hurry",
  "may your next sketch come out cuter than you planned",
  "may your favourite song come on shuffle at the perfect moment",
  "may the weather match your outfit all week",
  "may someone hold the door for you and smile",
  "may your bubble tea have exactly the right amount of pearls",
  "may your hair look just like the picture",
  "may you sleep soundly right up until your alarm",
  "may a cat choose your lap",
  "may your next con be full of friends and good merch",
  "may your shoes feel like little clouds",
  "may your wig behave perfectly, all day",
  "may you hear \"you look lovely\" at least twice today",
  "may your inbox only bring good news",
  "may the queue be short and the cake be big",
  "may you get the window seat",
  "may every photo of you today be a keeper",
  "may something make you laugh until you snort",
  "may tomorrow feel lighter than today",
  "may you find a little luck in an ordinary moment",
  "may your favourite figure be back in stock",
  "may the rain stop right when you step outside",
  "may you feel how loved you are",
  "may your doodles look exactly like the picture in your head",
  "may your tea never go cold before you remember it",
  "may the stars line up for something you've wished for",
  "may your heart feel light and full at the same time",
  "may your playlist know your mood before you do",
  "may your favourite snack be on sale",
  "may your plans go smoothly and your naps go long",
  "may someone far away be thinking of you right now (they are)",
];

/** A sky of `count` lanterns, spread across lanes, rising at gentle, slightly different speeds. */
export function newSky(rng = Math.random, { count = 7, golden = false, usedWishes = [] } = {}) {
  const lanes = shuffle(Array.from({ length: count }, (_, i) => (i + 0.5) / count), rng);
  const fresh = WISHES.filter((wish) => !usedWishes.includes(wish));
  const wishes = shuffle(fresh.length >= count ? fresh : WISHES, rng);
  const goldenIndex = golden ? Math.floor(rng() * count) : -1;
  return lanes.map((x, i) => ({
    id: i,
    x,
    start: 0.15 + (i / count) * 0.85 + rng() * 0.08, // where in its climb it begins (0 = bottom)
    speed: 0.045 + rng() * 0.03, // fraction of the sky per second
    sway: 6 + rng() * 10,
    phase: rng() * Math.PI * 2,
    size: 0.86 + rng() * 0.28,
    tint: LANTERN_TINTS[i % LANTERN_TINTS.length],
    kind: i === goldenIndex ? "golden" : "wish",
    wish: wishes[i % wishes.length],
  }));
}

/** Where a lantern is at time `t` (seconds), as fractions of the sky: x across, y from the top. */
export function lanternAt(lantern, t) {
  const climb = (lantern.start + t * lantern.speed) % 1.25;
  return {
    x: lantern.x,
    y: 1.1 - climb,
    swayX: Math.sin(t * 0.9 + lantern.phase) * lantern.sway,
    tilt: Math.sin(t * 0.9 + lantern.phase + 0.6) * 4,
  };
}
