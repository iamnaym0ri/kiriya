// "look twice": four little places, re-coloured and re-arranged every round, and the rules that
// pick five differences between the two copies. Written for this site; pure (tested).
import { seeded, shuffle } from "../_shared/rng.js";
import { ASYMMETRIC, COLOURS, RADIUS, VARIANTS, drawItem } from "./drawings.js";

export const WIDTH = 360;
export const HEIGHT = 260;
export const DIFFERENCES = 5;
export const TAP_SLACK = 16; // a tap this far outside a drawing still counts

const SOFT = ["lilac", "pink", "peach", "butter", "mint", "sky", "coral", "teal"];
const ALL = Object.keys(COLOURS);

// Items: [type, x, y, scale, colours (one or a list), extra options].
const SCENES = [
  {
    id: "room",
    title: "her room",
    background: () => `
      <rect width="360" height="190" fill="#f1e6f8"/>
      <path d="M0 18h360M0 60h360M0 102h360M0 144h360" stroke="#e8dbf0" stroke-width="2"/>
      <rect y="186" width="360" height="74" fill="#e4d2ea"/>
      <path d="M0 186h360M0 214h360M0 240h360M60 186v28M180 186v28M300 186v28M120 214v26M240 214v26" stroke="#d3bcdc" stroke-width="2"/>
      <ellipse cx="160" cy="232" rx="120" ry="22" fill="#f7c9dc" stroke="#d99ab8" stroke-width="2"/>
      <ellipse cx="160" cy="232" rx="96" ry="14" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 6"/>
      <rect x="150" y="94" width="160" height="7" rx="3" fill="#c9a98f" stroke="#4a2f57" stroke-width="2"/>
      <path d="M170 101l6 10M290 101l-6 10" stroke="#4a2f57" stroke-width="2" stroke-linecap="round"/>
      <rect x="236" y="196" width="44" height="6" rx="3" fill="#c9a98f" stroke="#4a2f57" stroke-width="2"/>
      <path d="M242 202v28M274 202v28" stroke="#4a2f57" stroke-width="2.4" stroke-linecap="round"/>`,
    items: [
      ["window", 68, 72, 1, "cream", { gone: false, size: false, variants: [0, 1] }],
      ["frame", 196, 44, 0.9, ["pink", "lilac", "sky", "butter"]],
      ["frame", 246, 48, 0.72, ["mint", "peach", "lilac"]],
      ["clock", 318, 42, 1, ["sky", "pink", "butter", "mint"]],
      ["bow", 196, 18, 0.9, ["rose", "plum", "sky"]],
      ["jar", 170, 80, 1, SOFT],
      ["books", 214, 82, 0.95, ["plum", "rose", "teal", "coral"]],
      ["plant", 272, 74, 0.95, ["peach", "sky", "lilac", "coral"]],
      ["lamp", 324, 168, 1.1, ["butter", "pink", "lilac", "mint"]],
      ["cushion", 112, 214, 1.15, ["pink", "lilac", "sky", "butter"], { size: false }],
      ["cat", 112, 190, 1, ["peach", "grey", "cream", "butter"]],
      ["yarn", 196, 228, 1, ["sky", "pink", "mint", "lilac"]],
      ["cup", 258, 186, 0.95, ["mint", "pink", "sky", "butter"]],
      ["star", 26, 150, 1, ["butter", "pink", "sky"]],
      ["heart", 140, 140, 0.9, ["pink", "rose", "lilac"]],
      ["plant", 30, 212, 1.05, ["coral", "teal", "butter", "lilac"]],
    ],
  },
  {
    id: "garden",
    title: "the herb garden",
    background: () => `
      <defs><linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3efff"/><stop offset="1" stop-color="#f8ecfb"/></linearGradient></defs>
      <rect width="360" height="176" fill="url(#g-sky)"/>
      <rect y="170" width="360" height="90" fill="#d3ebc7"/>
      <path d="M0 170h360" stroke="#9cc48a" stroke-width="2"/>
      ${Array.from({ length: 15 }, (_, i) => `<path d="M${i * 25 + 4} 182v-48l8-8 8 8v48z" fill="#fff8f0" stroke="#4a2f57" stroke-width="2" stroke-linejoin="round"/>`).join("")}
      <path d="M0 148h360M0 172h360" stroke="#4a2f57" stroke-width="2"/>
      ${Array.from({ length: 24 }, (_, i) => `<path d="M${(i * 37) % 360 + 6} ${196 + ((i * 53) % 60)}l3-6 3 6" fill="none" stroke="#8fbf7d" stroke-width="1.6" stroke-linecap="round"/>`).join("")}`,
    items: [
      ["sun", 312, 40, 1, ["butter", "peach"]],
      ["cloud", 78, 38, 1, ["cream", "sky", "pink"]],
      ["cloud", 196, 26, 0.75, ["cream", "lilac", "sky"]],
      ["bird", 148, 76, 1, ["sky", "pink", "butter", "coral"]],
      ["butterfly", 252, 92, 1, ["pink", "lilac", "butter", "sky"]],
      ["butterfly", 56, 112, 0.85, ["coral", "teal", "lilac"]],
      ["plant", 50, 204, 1.15, ["peach", "coral", "sky"]],
      ["plant", 104, 214, 0.95, ["lilac", "pink", "teal"]],
      ["can", 166, 214, 1, ["sky", "mint", "pink", "butter"]],
      ["flower", 214, 202, 1, ["pink", "lilac", "butter", "coral"]],
      ["flower", 240, 212, 0.9, ["butter", "sky", "pink"]],
      ["flower", 264, 198, 1.05, ["lilac", "coral", "peach"]],
      ["plant", 314, 206, 1.15, ["teal", "butter", "lilac"]],
      ["mushroom", 22, 240, 0.95, ["rose", "peach", "lilac"]],
      ["snail", 330, 244, 1, ["peach", "pink", "lilac"]],
      ["heart", 120, 140, 0.8, ["pink", "rose"]],
    ],
  },
  {
    id: "market",
    title: "the night market",
    background: () => `
      <defs><linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2d5f"/><stop offset="1" stop-color="#6a5899"/></linearGradient></defs>
      <rect width="360" height="200" fill="url(#m-sky)"/>
      <rect y="196" width="360" height="64" fill="#8a77b5"/>
      <path d="M0 196h360" stroke="#4a2f57" stroke-width="2"/>
      <path d="M10 40q170 40 340 0" fill="none" stroke="#e8dcff" stroke-width="1.6"/>
      ${[0, 1].map((k) => {
        const x = 14 + k * 178;
        return `<rect x="${x}" y="150" width="154" height="50" rx="3" fill="#f6e7d6" stroke="#4a2f57" stroke-width="2"/>
        <rect x="${x - 4}" y="146" width="162" height="8" rx="3" fill="#c9a98f" stroke="#4a2f57" stroke-width="2"/>
        ${Array.from({ length: 7 }, (_, i) => `<path d="M${x + i * 22} 98h22v14c0 6-11 6-11 0 0 6-11 6-11 0z" fill="${i % 2 ? "#fff" : k ? "#f7a6c8" : "#a9cdf5"}" stroke="#4a2f57" stroke-width="2" stroke-linejoin="round"/>`).join("")}
        <path d="M${x + 4} 114v34M${x + 150} 114v34" stroke="#4a2f57" stroke-width="2.4"/>`;
      }).join("")}
      ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 71) % 350 + 6}" cy="${(i * 29) % 50 + 8}" r="1.3" fill="#fff" opacity="0.8"/>`).join("")}`,
    items: [
      ["moon", 316, 38, 1.1, ["butter", "cream", "peach"]],
      ["star", 42, 30, 1, ["butter", "cream", "pink"]],
      ["star", 210, 24, 0.95, ["butter", "sky", "pink"]],
      ["lantern", 54, 66, 0.85, ["pink", "peach", "coral", "butter"]],
      ["lantern", 118, 73, 0.85, ["lilac", "peach", "butter"]],
      ["lantern", 182, 76, 0.85, ["coral", "pink", "teal"]],
      ["lantern", 246, 73, 0.85, ["butter", "lilac", "pink"]],
      ["lantern", 306, 66, 0.85, ["peach", "sky", "coral"]],
      ["cupcake", 42, 134, 1, ["pink", "lilac", "mint", "butter"]],
      ["cupcake", 76, 134, 1, ["sky", "peach", "pink"]],
      ["macaron", 116, 140, 1, ["mint", "pink", "lilac", "butter"]],
      ["jar", 146, 134, 1, SOFT],
      ["teapot", 228, 131, 0.8, ["mint", "sky", "pink", "lilac"]],
      ["cup", 272, 138, 0.9, ["pink", "butter", "teal"]],
      ["cup", 308, 138, 0.9, ["lilac", "coral", "mint"]],
      ["cat", 178, 226, 1, ["grey", "cream", "peach"]],
      ["balloon", 336, 170, 0.9, ["pink", "lilac", "sky", "butter"], { size: false }],
    ],
  },
  {
    id: "tea",
    title: "a tea party",
    background: () => `
      <rect width="360" height="260" fill="#fde9f1"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="${i * 44 + 14}" cy="${(i % 2) * 24 + 90}" r="3" fill="#f7c9dc"/>`).join("")}
      <path d="M0 18q90 22 180 6t180 8" fill="none" stroke="#4a2f57" stroke-width="1.6"/>
      <rect x="-4" y="160" width="368" height="104" fill="#fffaf2" stroke="#4a2f57" stroke-width="2"/>
      <path d="M-4 168${Array.from({ length: 13 }, (_, i) => `q14 14 28 0`).join("")}" fill="#fff" stroke="#d99ab8" stroke-width="2"/>
      <path d="M0 200h360M0 232h360M40 160v100M120 160v100M200 160v100M280 160v100" stroke="#f7d3e2" stroke-width="2"/>
      <ellipse cx="180" cy="168" rx="56" ry="9" fill="#fff" stroke="#4a2f57" stroke-width="2"/>`,
    items: [
      ["flag", 30, 28, 1, ["pink", "lilac", "sky"]],
      ["flag", 78, 32, 1, ["butter", "mint", "peach"]],
      ["flag", 128, 31, 1, ["lilac", "coral", "pink"]],
      ["flag", 230, 30, 1, ["sky", "pink", "butter"]],
      ["flag", 280, 34, 1, ["mint", "lilac", "coral"]],
      ["flag", 330, 36, 1, ["peach", "pink", "sky"]],
      ["clock", 54, 92, 1, ["lilac", "sky", "butter"]],
      ["frame", 306, 92, 0.85, ["pink", "mint", "lilac"]],
      ["heart", 180, 78, 1.1, ["pink", "rose", "lilac"]],
      ["teapot", 180, 136, 1.25, ["sky", "mint", "pink", "lilac"]],
      ["cup", 104, 150, 1, ["pink", "butter", "lilac"]],
      ["cup", 256, 150, 1, ["mint", "sky", "coral"]],
      ["cupcake", 48, 148, 1.05, ["pink", "lilac", "butter"]],
      ["cupcake", 312, 148, 1.05, ["mint", "peach", "sky"]],
      ["macaron", 130, 196, 1, ["pink", "mint", "lilac"]],
      ["macaron", 160, 204, 1, ["butter", "sky", "coral"]],
      ["vase", 236, 200, 1.1, ["sky", "lilac", "teal"]],
      ["candle", 300, 210, 1.1, ["pink", "butter", "lilac"]],
      ["bow", 60, 222, 1, ["rose", "plum", "teal"]],
    ],
  },
];

export const SCENE_IDS = SCENES.map((scene) => scene.id);
export const sceneTitle = (id) => SCENES.find((scene) => scene.id === id)?.title ?? "";

const radiusOf = (item) => RADIUS[item.type] * item.s;

/** This round's version of a scene: colours and looks picked, small things nudged. */
export function dressScene(sceneIndex, random) {
  const scene = SCENES[sceneIndex % SCENES.length];
  const items = scene.items.map(([type, x, y, s, colours, options = {}], i) => {
    const colour = Array.isArray(colours) ? colours[Math.floor(random() * colours.length)] : colours;
    const variants = options.variants ?? (VARIANTS[type] ? Array.from({ length: VARIANTS[type] }, (_, k) => k) : [0]);
    const small = RADIUS[type] * s < 24;
    return {
      id: `${scene.id}-${i}`,
      type,
      x: x + (small ? Math.round((random() - 0.5) * 8) : 0),
      y: y + (small ? Math.round((random() - 0.5) * 6) : 0),
      s,
      r: 0,
      flip: ASYMMETRIC.has(type) && type !== "window" && random() < 0.3,
      colour,
      colours: Array.isArray(colours) ? colours : [colours],
      variant: variants[Math.floor(random() * variants.length)],
      variants,
      options,
    };
  });
  return { scene, items };
}

function changesFor(item) {
  const kinds = [];
  if (item.options.colour !== false) kinds.push("colour");
  if (item.options.gone !== false) kinds.push("gone");
  if (ASYMMETRIC.has(item.type) && item.options.flip !== false && item.type !== "window") kinds.push("flip");
  if (item.options.size !== false) kinds.push("size");
  if (item.variants.length > 1) kinds.push("look");
  return kinds;
}

function alter(item, kind, random) {
  switch (kind) {
    case "colour": {
      // A clearly different colour: from its own list if it has one, else any soft one.
      const pool = (item.colours.length > 1 ? item.colours : ALL).filter((c) => c !== item.colour);
      const fallback = ALL.filter((c) => c !== item.colour);
      const list = pool.length ? pool : fallback;
      return { ...item, colour: list[Math.floor(random() * list.length)] };
    }
    case "gone":
      return null;
    case "flip":
      return { ...item, flip: !item.flip };
    case "size":
      return { ...item, s: item.s * (radiusOf(item) > 18 ? 0.66 : 1.45) };
    case "look": {
      const others = item.variants.filter((v) => v !== item.variant);
      return { ...item, variant: others[Math.floor(random() * others.length)] };
    }
    default:
      return item;
  }
}

/**
 * Round `n` (0-based): a scene, two copies of it ("top" and "bottom") and the five things that
 * differ. Each difference lives in one copy or the other, and no two sit on top of each other.
 */
export function buildRound(n) {
  const random = seeded(Math.imul(n + 1, 2654435761) ^ 0x5bd1e995);
  const { scene, items } = dressScene(n % SCENES.length, random);
  const chosen = [];
  const usedKinds = {};
  for (const item of shuffle(items, random)) {
    if (chosen.length >= DIFFERENCES) break;
    const kinds = changesFor(item);
    if (!kinds.length) continue;
    const r = radiusOf(item);
    if (chosen.some((other) => Math.hypot(other.item.x - item.x, other.item.y - item.y) < r + other.r + 6)) continue;
    // Prefer a kind of change she hasn't seen much of this round.
    const ordered = shuffle(kinds, random).sort((a, b) => (usedKinds[a] ?? 0) - (usedKinds[b] ?? 0));
    const kind = ordered[0];
    usedKinds[kind] = (usedKinds[kind] ?? 0) + 1;
    const changed = alter(item, kind, random);
    const reach = Math.max(r, changed ? radiusOf(changed) : 0);
    chosen.push({ item, kind, changed, side: random() < 0.5 ? "top" : "bottom", r: reach });
  }
  const top = [], bottom = [];
  for (const item of items) {
    const diff = chosen.find((c) => c.item.id === item.id);
    if (!diff) {
      top.push(item);
      bottom.push(item);
      continue;
    }
    const altered = diff.changed;
    if (diff.side === "top") {
      if (altered) top.push(altered);
      bottom.push(item);
    } else {
      top.push(item);
      if (altered) bottom.push(altered);
    }
  }
  return {
    n,
    scene: scene.id,
    title: scene.title,
    top,
    bottom,
    diffs: chosen.map((c) => ({ id: c.item.id, kind: c.kind, side: c.side, x: c.item.x, y: c.item.y, r: c.r })),
  };
}

/** Which difference (not yet found) a tap at scene point (x, y) lands on, or null. */
export function hitTest(round, found, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const diff of round.diffs) {
    if (found.includes(diff.id)) continue;
    const d = Math.hypot(diff.x - x, diff.y - y);
    if (d <= diff.r + TAP_SLACK && d < bestDistance) {
      best = diff.id;
      bestDistance = d;
    }
  }
  return best;
}

export function sceneSvg(round, side) {
  const scene = SCENES.find((each) => each.id === round.scene);
  const items = side === "top" ? round.top : round.bottom;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH * 2}" height="${HEIGHT * 2}">${scene.background()}${items.map(drawItem).join("")}</svg>`;
}

export const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** A finished, undisturbed picture of a scene (the slide puzzle's own pictures use these). */
export function scenePicture(sceneIndex, seed = 1) {
  const { scene, items } = dressScene(sceneIndex, seeded(seed));
  return { id: `scene-${scene.id}`, title: scene.title, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH * 2}" height="${HEIGHT * 2}">${scene.background()}${items.map(drawItem).join("")}</svg>` };
}
