// The rules of colour by number, kept apart from the screen so scripts/test-games-artsy.mjs can
// check them: where each number sits, what's left to paint, and the zoom/pan maths.

/**
 * Distance (in pixels) from each pixel to the nearest pixel of another region, the picture's edge,
 * or an outline (id < 0). Two-pass chamfer (1, √2).
 */
export function distanceField(ids, w, h) {
  const d = new Float32Array(w * h);
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, id = ids[i];
      const edge = id < 0 || x === 0 || y === 0 || x === w - 1 || y === h - 1
        || ids[i - 1] !== id || ids[i + 1] !== id || ids[i - w] !== id || ids[i + w] !== id;
      d[i] = edge ? 0 : Infinity;
    }
  for (let y = 1; y < h; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], d[i - 1] + 1, d[i - w] + 1, d[i - w - 1] + D, d[i - w + 1] + D);
    }
  for (let y = h - 2; y >= 0; y--)
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], d[i + 1] + 1, d[i + w] + 1, d[i + w + 1] + D, d[i + w - 1] + D);
    }
  return d;
}

/**
 * For each region: the roomiest spot for its number ({ x, y, r } in pixels) and its area. Among
 * equally roomy spots, the one nearest the shape's middle wins, so numbers sit centred.
 */
export function labelSpots(ids, w, h, count) {
  const field = distanceField(ids, w, h);
  const spots = Array.from({ length: count }, () => ({ x: 0, y: 0, r: -1, area: 0, sx: 0, sy: 0 }));
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id < 0 || id >= count) continue;
    const spot = spots[id];
    spot.area += 1;
    spot.sx += i % w;
    spot.sy += Math.floor(i / w);
    if (field[i] > spot.r) spot.r = field[i];
  }
  const best = spots.map(() => Infinity);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id < 0 || id >= count) continue;
    const spot = spots[id];
    if (field[i] < spot.r - 0.25) continue;
    const x = i % w, y = Math.floor(i / w);
    const d = (x - spot.sx / spot.area) ** 2 + (y - spot.sy / spot.area) ** 2;
    if (d < best[id]) {
      best[id] = d;
      spot.x = x + 0.5;
      spot.y = y + 0.5;
    }
  }
  return spots.map(({ x, y, r, area }) => ({ x, y, r, area }));
}

/** Colours that encode a region index for the hit map, far apart so blended edges never decode. */
export function idColour(i) {
  return [(i * 67 + 13) & 255, (i * 151 + 29) & 255, ((i >> 2) * 97 + (i & 3) * 64 + 7) & 255];
}
export function decodeIds(rgba, count) {
  const lookup = new Map();
  for (let i = 0; i < count; i++) {
    const [r, g, b] = idColour(i);
    lookup.set((r << 16) | (g << 8) | b, i);
  }
  const ids = new Int32Array(rgba.length / 4);
  for (let p = 0; p < ids.length; p++) {
    const o = p * 4;
    ids[p] = rgba[o + 3] === 255 ? lookup.get((rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2]) ?? -1 : -1;
  }
  return ids;
}

/** How far along a picture is, overall and per colour. `filled` is a Set or array of region indexes. */
export function progress(picture, filled) {
  const done = filled instanceof Set ? filled : new Set(filled);
  const colours = picture.palette.map(() => ({ total: 0, done: 0 }));
  picture.regions.forEach((region, i) => {
    colours[region.c].total += 1;
    if (done.has(i)) colours[region.c].done += 1;
  });
  const total = picture.regions.length;
  const count = picture.regions.reduce((n, _, i) => n + (done.has(i) ? 1 : 0), 0);
  return { total, done: count, complete: count === total, colours };
}

/** The next colour with something left to paint, starting after `current` (or -1 when finished). */
export function nextColour(picture, filled, current = -1) {
  const { colours } = progress(picture, filled);
  const n = colours.length;
  for (let step = 1; step <= n; step++) {
    const c = (((current + step) % n) + n) % n;
    if (colours[c].done < colours[c].total) return c;
  }
  return -1;
}

/** Whether tapping region `i` with colour `c` paints it: right number, not painted yet. */
export const canFill = (picture, filled, i, c) =>
  i >= 0 && i < picture.regions.length && picture.regions[i].c === c && !(filled instanceof Set ? filled.has(i) : filled.includes(i));

/** The unpainted region of colour `c` that's smallest (hardest to spot), for the hint. */
export function hintRegion(picture, filled, c, spots) {
  const done = filled instanceof Set ? filled : new Set(filled);
  let best = -1;
  picture.regions.forEach((region, i) => {
    if (region.c !== c || done.has(i)) return;
    if (best < 0 || (spots?.[i]?.area ?? 0) < (spots?.[best]?.area ?? 0)) best = i;
  });
  return best;
}

// ---------- the view: which part of the picture shows (in picture units) ----------

export const MAX_ZOOM = 8;

/** The visible box for a zoom `z` centred on (cx, cy), kept on the picture. */
export function viewBox({ z, cx, cy }, stage, picture) {
  const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
  const w = stage.width / (fit * z), h = stage.height / (fit * z);
  const clampAxis = (c, size, full) => (size >= full ? full / 2 : Math.min(full - size / 2, Math.max(size / 2, c)));
  const x = clampAxis(cx, w, picture.width), y = clampAxis(cy, h, picture.height);
  return { x: x - w / 2, y: y - h / 2, w, h, scale: fit * z, cx: x, cy: y, z };
}

/** The picture point under a point on the stage (stage pixels from its top-left). */
export const toPicture = (box, sx, sy) => [box.x + sx / box.scale, box.y + sy / box.scale];

/** The view after zooming to `z` while keeping picture point (px, py) under stage point (sx, sy). */
export function zoomAround(z, px, py, sx, sy, stage, picture) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, z));
  const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
  const scale = fit * zoom;
  const cx = px - sx / scale + stage.width / (2 * scale);
  const cy = py - sy / scale + stage.height / (2 * scale);
  return viewBox({ z: zoom, cx, cy }, stage, picture);
}
