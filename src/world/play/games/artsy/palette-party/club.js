// Maomao's colour club, the rules apart from the screen (tested in scripts/test-games-artsy.mjs):
// the paints, the colours she asks for (each a recipe of drops), mixing drops like real pigment,
// how close a mix is, and the one change she'd suggest next.

export const PAINTS = {
  white: { name: "milk white", hex: "#fbf7f1" },
  lilac: { name: "lilac", hex: "#9774d6" },
  rose: { name: "rose", hex: "#e2709b" },
  plum: { name: "plum", hex: "#5b3368" },
  sky: { name: "sky", hex: "#4f9fe0" },
  teal: { name: "teal", hex: "#1f8a8b" },
  lemon: { name: "lemon", hex: "#f4d24a" },
  coral: { name: "coral", hex: "#f08a6a" },
};

/** The colours she can be asked for: a name, Maomao's note, and the drops that make it. */
export const COLOURS = [
  { id: "birthday-lilac", name: "birthday lilac", note: "a little rose tucked into lavender", recipe: { lilac: 2, rose: 1, white: 2 } },
  { id: "miku-mint", name: "miku mint", note: "teal twin tails, a lot of cream", recipe: { teal: 1, white: 3 } },
  { id: "maomao-rose", name: "maomao rose", note: "a plum ribbon, softened", recipe: { plum: 1, rose: 1, white: 2 } },
  { id: "sakura-milk", name: "sakura milk", note: "the palest blossom", recipe: { rose: 1, white: 4 } },
  { id: "matcha-latte", name: "matcha latte", note: "green, from yellow and blue", recipe: { lemon: 2, teal: 1, white: 2 } },
  { id: "dusk-violet", name: "dusk violet", note: "the sky just after the lanterns", recipe: { lilac: 2, plum: 1 } },
  { id: "peach-tea", name: "peach tea", note: "warm, with milk", recipe: { coral: 1, lemon: 1, white: 2 } },
  { id: "sea-glass", name: "sea glass", note: "worn smooth by the tide", recipe: { sky: 1, teal: 1, white: 3 } },
  { id: "lavender-cloud", name: "lavender cloud", note: "mostly air", recipe: { lilac: 1, white: 3 } },
  { id: "honey", name: "honey", note: "gold, with a blush", recipe: { lemon: 3, coral: 1 } },
  { id: "twilight", name: "twilight", note: "blue going to bed", recipe: { sky: 1, plum: 2 } },
  { id: "pistachio", name: "pistachio", note: "a soft nutty green", recipe: { lemon: 2, teal: 1, white: 1 } },
  { id: "strawberry-milk", name: "strawberry milk", note: "pink, and a bit sweet", recipe: { rose: 2, coral: 1, white: 3 } },
  { id: "hydrangea", name: "hydrangea", note: "between blue and violet", recipe: { sky: 2, lilac: 1, white: 1 } },
];

export const ROUNDS = 3;
export const MAX_DROPS = 12;
export const PASS = 95;

/** A palette of `ROUNDS` different colours, each with its pots: the recipe's, plus one or two others. */
export function newPalette(random = Math.random) {
  const pool = [...COLOURS];
  const picked = [];
  while (picked.length < ROUNDS && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return picked.map((colour) => {
    const own = Object.keys(colour.recipe);
    const others = Object.keys(PAINTS).filter((paint) => !own.includes(paint));
    const extra = [];
    const want = own.length >= 3 ? 1 : 2;
    while (extra.length < want && others.length) extra.push(others.splice(Math.floor(random() * others.length), 1)[0]);
    // White always sits first; the rest in the paint box's order, so pots don't jump about.
    const order = Object.keys(PAINTS);
    const pots = [...own, ...extra].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { ...colour, pots };
  });
}

// ---------------------------------------------------------------- colour maths
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const rgbToHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/**
 * The colour of a bowl of drops ({ paint: count }). With Mixbox (pigment mixing: yellow and blue
 * make green) when it's loaded, else a plain average.
 */
export function mixDrops(drops, mixbox = null) {
  const entries = Object.entries(drops).filter(([paint, n]) => n > 0 && PAINTS[paint]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (!total) return null;
  if (mixbox?.rgbToLatent) {
    let latent = null;
    for (const [paint, n] of entries) {
      const z = mixbox.rgbToLatent(...hexToRgb(PAINTS[paint].hex));
      latent = latent ? latent.map((v, i) => v + (z[i] * n) / total) : z.map((v) => (v * n) / total);
    }
    return rgbToHex(mixbox.latentToRgb(latent));
  }
  const rgb = [0, 0, 0];
  for (const [paint, n] of entries) hexToRgb(PAINTS[paint].hex).forEach((v, i) => (rgb[i] += (v * n) / total));
  return rgbToHex(rgb);
}

function toLab(hex) {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const xyz = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** The colour difference between two colours (CIE76: about 2 is "barely tell them apart"). */
export function difference(a, b) {
  if (!a || !b) return Infinity;
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** How close two colours look, 0–100 (100: the same). About 2.5 units of colour difference is 95. */
export function closeness(a, b) {
  const delta = difference(a, b);
  return Number.isFinite(delta) ? Math.max(0, Math.min(100, Math.round(100 - delta * 2))) : 0;
}

/** The target colour of a round. */
export const targetOf = (round, mixbox) => mixDrops(round.recipe, mixbox);

/**
 * Maomao's tip: the one change that moves the bowl towards the sample's proportions. A paint that
 * isn't in the sample comes out first; otherwise the paint furthest below its share gets another
 * drop (or, if the bowl is too full for that, the one furthest above its share comes out).
 * Returns { paint, more: true | false }, or null when the proportions are already right.
 */
export function nextStep(drops, round) {
  const recipe = round.recipe;
  const stray = Object.keys(drops).find((paint) => drops[paint] > 0 && !recipe[paint]);
  if (stray) return { paint: stray, more: false };
  const paints = Object.keys(recipe);
  // The smallest batch of the sample's recipe that holds everything already in the bowl.
  const batch = Math.max(1, ...paints.map((paint) => Math.ceil((drops[paint] ?? 0) / recipe[paint])));
  const short = paints.map((paint) => ({ paint, by: recipe[paint] * batch - (drops[paint] ?? 0) })).sort((a, b) => b.by - a.by)[0];
  if (short.by <= 0) return null;
  if (paints.reduce((sum, paint) => sum + recipe[paint] * batch, 0) <= MAX_DROPS) return { paint: short.paint, more: true };
  const over = [...paints].sort((a, b) => (drops[b] ?? 0) / recipe[b] - (drops[a] ?? 0) / recipe[a])[0];
  return { paint: over, more: false };
}

/** Stars for a matched round: first try three, second two, after that one. */
export const starsFor = (checks) => (checks <= 1 ? 3 : checks === 2 ? 2 : 1);
