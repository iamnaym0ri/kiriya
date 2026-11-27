// Bouquet maker rules, apart from the screen (tested in scripts/test-games-artsy-bouquet.mjs).
// Bouquet space is a 300 × 400 card. Every stem gathers at the tie (TIE), under the ribbon; the
// flower heads sit in a fan above it. A placed flower is { id, kind, c, x, y, s, t }: (x, y) is the
// centre of its head, s its size (1 = as drawn), t her own extra turn in degrees on top of the
// natural outward lean the fan gives it (lean(x, y)).
export const W = 300;
export const H = 400;
export const TIE = [150, 300];
export const FAN = { cx: 150, cy: 162, rx: 118, ry: 114, top: 40, bottom: 250 };
export const MAX_FLOWERS = 40;
export const MAX_SHELF = 24;
export const MIN_SIZE = 0.45;
export const MAX_SIZE = 1.9;
export const CARD_MAX = 20;
export const CARD_PRESETS = ["for you ♡", "ily", "just because", "my favourite", "happy day ♡", "thank you", "miss u", "always u"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, k = 10) => Math.round(v * k) / k;
export const clampSize = (s) => round(clamp(s, MIN_SIZE, MAX_SIZE), 100);

/** Keeps a flower head inside the fan (a soft ellipse above the tie, never under the wrap's lip). */
export function clampToFan(x, y) {
  let nx = clamp(x, FAN.cx - FAN.rx, FAN.cx + FAN.rx);
  let ny = clamp(y, FAN.top, FAN.bottom);
  const dx = (nx - FAN.cx) / FAN.rx, dy = (ny - FAN.cy) / FAN.ry;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    nx = FAN.cx + (dx / d) * FAN.rx;
    ny = clamp(FAN.cy + (dy / d) * FAN.ry, FAN.top, FAN.bottom);
  }
  return [round(nx), round(ny)];
}

/** How far a head leans outward at (x, y): flowers fan away from the tie, a little. */
export const lean = (x, y) => round((Math.atan2(x - TIE[0], TIE[1] - y) * 180) / Math.PI * 0.6, 10);

/** The head's full turn: its natural lean plus her own. */
export const turnOf = (item) => round(lean(item.x, item.y) + (item.t ?? 0), 10);

/** Where a point in the head's own drawing (dx, dy) lands in bouquet space. */
export function headPoint(item, [dx, dy]) {
  const a = (turnOf(item) * Math.PI) / 180, s = item.s ?? 1;
  return [item.x + (dx * Math.cos(a) - dy * Math.sin(a)) * s, item.y + (dx * Math.sin(a) + dy * Math.cos(a)) * s];
}

/**
 * A stem as an SVG path: from the head's base (`base`, in the head's own drawing) in a gentle curve
 * to the tie, then on past it to a cut end below the wrap, crossing over like real bunched stems.
 */
export function stemPath(item, base = [0, 16]) {
  const [bx, by] = headPoint(item, base);
  const [tx, ty] = TIE;
  const cx = bx + (tx - bx) * 0.55 + (bx - tx) * 0.12;
  const cy = by + (ty - by) * 0.45;
  const ex = tx + (tx - bx) * 0.14;
  const f = (v) => Math.round(v * 10) / 10;
  return `M${f(bx)} ${f(by)}Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}L${f(ex)} ${H - 4}`;
}

/** A transform for the head's <g>. */
export const headTransform = (item) => `translate(${round(item.x)} ${round(item.y)}) rotate(${turnOf(item)}) scale(${item.s ?? 1})`;

// ---------------------------------------------------------------- placing and arranging

/** Spots on the fan, rings outward from the middle: the places a new flower can land. */
function fanSpots() {
  const spots = [];
  const rings = [
    { r: 0, n: 1 },
    { r: 0.34, n: 6 },
    { r: 0.62, n: 9 },
    { r: 0.86, n: 12 },
  ];
  for (const { r, n } of rings) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + (r ? 0.35 * r : 0);
      const x = FAN.cx + Math.cos(a) * FAN.rx * r;
      const y = FAN.cy + Math.sin(a) * FAN.ry * r * 0.92 - 8;
      if (y <= FAN.bottom - 4) spots.push([round(x), round(y), r]);
    }
  }
  return spots;
}
const SPOTS = fanSpots();

/** How a kind of flower likes to sit: greenery around the edge and behind, blooms in the middle. */
const ROLE = { bloom: { ring: 0.3, behind: false }, little: { ring: 0.6, behind: false }, green: { ring: 0.85, behind: true }, extra: { ring: 0.55, behind: false } };

/**
 * A new flower in the roomiest spot that suits it (so the very first taps already look like a
 * bouquet), with a little wobble. `role` is the flower's group: bloom | little | green | extra.
 */
export function placeNew(items, { kind, c = 0, role = "bloom", s = 1 }, random = Math.random, id = `f${Date.now().toString(36)}${Math.floor(random() * 1e6).toString(36)}`) {
  const want = ROLE[role]?.ring ?? 0.4;
  let best = SPOTS[0], score = -Infinity;
  for (const [x, y, r] of SPOTS) {
    let room = 160;
    for (const other of items) room = Math.min(room, Math.hypot(other.x - x, other.y - y));
    const value = room - Math.abs(r - want) * 70 + random() * 6;
    if (value > score) {
      score = value;
      best = [x, y, r];
    }
  }
  const [x, y] = clampToFan(best[0] + (random() - 0.5) * 10, best[1] + (random() - 0.5) * 10);
  return { id, kind, c, x, y, s: clampSize(s * (0.92 + random() * 0.16)), t: round((random() - 0.5) * 16) };
}

/** Adds a flower: greenery slips in behind everything, the rest go on top. */
export function addFlower(items, flower, role) {
  if (items.length >= MAX_FLOWERS) return items;
  return ROLE[role]?.behind ? [flower, ...items] : [...items, flower];
}

/**
 * "Arrange nicely": spreads the flowers over the fan again: big blooms in the middle, little ones
 * around them, greenery at the edge, keeping each flower's own size and colour. `roleOf(kind)`
 * says which group a kind is in. Deterministic, so the same bouquet always settles the same way.
 */
export function arrange(items, roleOf) {
  const order = { bloom: 0, extra: 1, little: 2, green: 3 };
  const ranked = items.map((item, i) => ({ item, i, role: roleOf(item.kind) })).sort((a, b) => (order[a.role] ?? 1) - (order[b.role] ?? 1) || a.i - b.i);
  const n = ranked.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const placed = new Map();
  ranked.forEach(({ item, role }, k) => {
    // A sunflower spiral squashed into the fan; greenery pushed out to the rim.
    let r = Math.sqrt((k + 0.5) / Math.max(n, 1)) * 0.92;
    if (role === "green") r = Math.max(r, 0.78);
    const a = -Math.PI / 2 + (k * golden) % (Math.PI * 2);
    const [x, y] = clampToFan(FAN.cx + Math.cos(a) * FAN.rx * r, FAN.cy - 4 + Math.sin(a) * FAN.ry * r * 0.9);
    placed.set(item.id, { ...item, x, y, t: 0 });
  });
  // Greenery stays behind; everything else keeps its layer order.
  const greens = items.filter((item) => roleOf(item.kind) === "green");
  const rest = items.filter((item) => roleOf(item.kind) !== "green");
  return [...greens, ...rest].map((item) => placed.get(item.id));
}

/** Moving a head: it stays in the fan. */
export const moveTo = (item, x, y) => {
  const [nx, ny] = clampToFan(x, y);
  return { ...item, x: nx, y: ny };
};

/** Two fingers: grow or shrink by `ratio` and turn by `turn` degrees from where the pinch began. */
export const pinchTo = (start, ratio, turn) => ({ ...start, s: clampSize(start.s * ratio), t: round(clamp((start.t ?? 0) + turn, -180, 180)) });

/** The corner handle: size and turn follow the finger around the head's centre. */
export function handleTo(start, [ax, ay], [bx, by]) {
  const d0 = Math.hypot(ax - start.x, ay - start.y) || 1;
  const d1 = Math.hypot(bx - start.x, by - start.y);
  const turn = ((Math.atan2(by - start.y, bx - start.x) - Math.atan2(ay - start.y, ax - start.x)) * 180) / Math.PI;
  return pinchTo(start, d1 / d0, turn);
}

export const updateItem = (items, id, change) => items.map((item) => (item.id === id ? { ...item, ...change } : item));
export const removeItem = (items, id) => items.filter((item) => item.id !== id);
export const toFront = (items, id) => [...items.filter((item) => item.id !== id), ...items.filter((item) => item.id === id)];
export const toBack = (items, id) => [...items.filter((item) => item.id === id), ...items.filter((item) => item.id !== id)];
export function duplicate(items, id, newId) {
  const at = items.findIndex((each) => each.id === id);
  if (at < 0 || items.length >= MAX_FLOWERS) return items;
  const item = items[at];
  const [x, y] = clampToFan(item.x + 16, item.y - 10);
  return [...items.slice(0, at + 1), { ...item, id: newId, x, y }, ...items.slice(at + 1)];
}

/** A small history for undo (newest last, at most `limit`). */
export function pushHistory(history, state, limit = 40) {
  if (history.length && history.at(-1) === state) return history;
  return [...history, state].slice(-limit);
}

// ---------------------------------------------------------------- the card and a name

export const tidyCard = (text) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, CARD_MAX);

/**
 * A name from what's in it, like "peonies & lavender" (the two kinds there are most of).
 * `nameOf(kind)` gives { one, many } for a kind.
 */
export function bouquetName(items, nameOf) {
  const counts = new Map();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const top = [...counts.entries()]
    .map(([kind, n]) => ({ kind, n, name: nameOf(kind) }))
    .filter((each) => each.name && !each.name.quiet)
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .map(({ n, name }) => (n > 1 ? name.many : name.one));
  return top.join(" & ") || "a little bouquet";
}

// ---------------------------------------------------------------- her vase shelf

/** Just the parts that make a bouquet (what the shelf keeps). */
export const pickBouquet = (draft) => ({ items: draft.items ?? [], wrap: draft.wrap, ribbon: draft.ribbon, card: draft.card ?? "" });

export function sameBouquet(a, b) {
  const key = (one) => JSON.stringify({ i: (one.items ?? []).map(({ kind, c, x, y, s, t }) => [kind, c, x, y, s, t]), w: one.wrap, r: one.ribbon, c: one.card ?? "" });
  return key(a) === key(b);
}

/**
 * Puts a bouquet on the shelf: a new one goes first; one she re-opened (`editing`) is updated in
 * place. Returns { shelf, entry, added }.
 */
export function shelve(shelf, bouquet, { id, name, editing = null, at = new Date().toISOString() }) {
  const existing = editing ? shelf.find((each) => each.id === editing) : null;
  if (existing) {
    const entry = { ...existing, ...pickBouquet(bouquet), name, at };
    return { shelf: [entry, ...shelf.filter((each) => each.id !== editing)], entry, added: false };
  }
  if (shelf.length && sameBouquet(shelf[0], bouquet)) return { shelf, entry: shelf[0], added: false };
  const entry = { id, name, ...pickBouquet(bouquet), at };
  return { shelf: [entry, ...shelf].slice(0, MAX_SHELF), entry, added: true };
}
export const unshelve = (shelf, id) => shelf.filter((each) => each.id !== id);

// ---------------------------------------------------------------- a surprise bouquet

/**
 * A whole surprise bouquet: a colour story, greenery, a few blooms and little flowers, an extra now
 * and then, a wrap and a ribbon. `catalogue` = { flowers: [{ id, role, colors }], wraps, ribbons }.
 */
export function surprise(catalogue, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const of = (role) => catalogue.flowers.filter((flower) => flower.role === role);
  const plan = [
    ...Array.from({ length: 2 + Math.floor(random() * 2) }, () => ["green", pick(of("green"))]),
    ...Array.from({ length: 3 + Math.floor(random() * 2) }, () => ["bloom", pick(of("bloom"))]),
    ...Array.from({ length: 3 + Math.floor(random() * 3) }, () => ["little", pick(of("little"))]),
    ...(random() < 0.45 ? [["extra", pick(of("extra"))]] : []),
  ].filter(([, flower]) => flower);
  // One colour per kind, so the same flowers match.
  const colourOf = new Map();
  let items = [];
  plan.forEach(([role, flower], i) => {
    if (!colourOf.has(flower.id)) colourOf.set(flower.id, Math.floor(random() * flower.colors.length));
    const placed = placeNew(items, { kind: flower.id, c: colourOf.get(flower.id), role }, random, `f${i}${Math.floor(random() * 1e6).toString(36)}`);
    items = addFlower(items, placed, role);
  });
  const roleOf = (kind) => catalogue.flowers.find((flower) => flower.id === kind)?.role ?? "bloom";
  items = arrange(items, roleOf).map((item) => ({ ...item, t: round((random() - 0.5) * 14) }));
  const wrap = pick(catalogue.wraps), ribbon = pick(catalogue.ribbons);
  return {
    items,
    wrap: { id: wrap.id, c: Math.floor(random() * wrap.colors.length) },
    ribbon: { id: ribbon.id, c: Math.floor(random() * ribbon.colors.length) },
  };
}
