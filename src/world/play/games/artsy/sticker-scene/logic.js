// Sticker scene rules (tested in scripts/test-games-artsy.mjs). A placed sticker is
// { id, kind, ref, x, y, s, r, flip }: x and y are its centre as fractions of the scene, s its width
// as a fraction of the scene's width, r its turn in degrees.
export const MAX_STICKERS = 40;
export const ASPECT = 5 / 4; // scenes are 4 wide by 5 tall
export const MIN_SIZE = 0.06, MAX_SIZE = 1.1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clampSize = (s) => clamp(s, MIN_SIZE, MAX_SIZE);
const round = (v, k = 1000) => Math.round(v * k) / k;

/** A new sticker near the middle, nudged so a second tap doesn't hide the first. */
export function placeNew(items, { kind, ref, s = 0.28 }, random = Math.random, id = `s${Date.now().toString(36)}${Math.floor(random() * 1e6).toString(36)}`) {
  const n = items.length % 6;
  return {
    id,
    kind,
    ref,
    x: round(0.5 + (n % 3 - 1) * 0.12 + (random() - 0.5) * 0.04),
    y: round(0.45 + (Math.floor(n / 3) - 0.5) * 0.12 + (random() - 0.5) * 0.04),
    s: kind === "word" ? 0.42 : s,
    r: round((random() - 0.5) * 16, 10),
    flip: false,
  };
}

/** Moving: keep at least a corner of it on the scene. */
export const moveTo = (item, x, y) => ({ ...item, x: round(clamp(x, -0.05, 1.05)), y: round(clamp(y, -0.05, 1.05)) });

/** Two fingers: grow or shrink by `ratio` and turn by `turn` degrees from where the pinch began. */
export const pinchTo = (start, ratio, turn) => ({ ...start, s: round(clampSize(start.s * ratio)), r: round(start.r + turn, 10) });

/** The corner handle: size and turn follow the finger around the sticker's centre (all in px). */
export function handleTo(start, [cx, cy], [ax, ay], [bx, by]) {
  const d0 = Math.hypot(ax - cx, ay - cy) || 1;
  const d1 = Math.hypot(bx - cx, by - cy);
  const turn = ((Math.atan2(by - cy, bx - cx) - Math.atan2(ay - cy, ax - cx)) * 180) / Math.PI;
  return pinchTo(start, d1 / d0, turn);
}

export const bringToFront = (items, id) => [...items.filter((item) => item.id !== id), ...items.filter((item) => item.id === id)];
export const removeItem = (items, id) => items.filter((item) => item.id !== id);
export const updateItem = (items, id, change) => items.map((item) => (item.id === id ? { ...item, ...change } : item));
export function duplicate(items, id, newId) {
  const item = items.find((each) => each.id === id);
  if (!item || items.length >= MAX_STICKERS) return items;
  return [...items, { ...item, id: newId, x: round(clamp(item.x + 0.06, 0, 1)), y: round(clamp(item.y + 0.06, 0, 1)) }];
}

/** The CSS transform that puts a sticker in place on a scene `width` px wide. */
export function placement(item, width) {
  const height = width * ASPECT;
  return {
    width: `${item.s * width}px`,
    transform: `translate(${item.x * width}px, ${item.y * height}px) translate(-50%, -50%) rotate(${item.r}deg)${item.flip ? " scaleX(-1)" : ""}`,
  };
}

/** A small history of scenes for undo (newest last, at most `limit`). */
export function pushHistory(history, items, limit = 30) {
  if (history.length && history.at(-1) === items) return history;
  return [...history, items].slice(-limit);
}
