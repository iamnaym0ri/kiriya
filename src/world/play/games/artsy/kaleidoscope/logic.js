// Kaleidoscope rules, apart from the screen (tested in scripts/test-games-artsy.mjs): the copies a
// stroke makes, colour palettes, tidy points, and which saved snapshot an undo can start from.
export const SIZE = 1000; // drawings live in a 1000 × 1000 square, centred on (500, 500)
export const FOLDS = [6, 8, 12, 2, 3, 4, 5];

export const PALETTES = [
  { id: "dusk", name: "lilac dusk", colors: ["#c9b1ee", "#9a6cc8", "#f6a9c7", "#fff4e3", "#6e4fa3", "#ffd6e8"] },
  { id: "sakura", name: "sakura milk", colors: ["#ffd1e3", "#f59ac0", "#e8577f", "#fff1d9", "#c7b2f0", "#a9dcc8"] },
  { id: "soda", name: "mint soda", colors: ["#a9dcc8", "#5fbfae", "#d8f3ea", "#c9b1ee", "#fff8e0", "#8fb3e8"] },
  { id: "glow", name: "midnight glow", colors: ["#fff0b8", "#ffcf6b", "#f6a9c7", "#b589ff", "#8fe3d0", "#ffffff"] },
];

export const PAPERS = [
  { id: "night", name: "night", fill: "#1d1038", guide: "rgb(255 255 255 / 0.16)" },
  { id: "lilac", name: "lilac", fill: "#f3ecfc", guide: "rgb(110 79 163 / 0.18)" },
  { id: "cream", name: "cream", fill: "#fff8ee", guide: "rgb(110 79 163 / 0.16)" },
];

export const BRUSHES = [
  { id: "ink", name: "ink" },
  { id: "glow", name: "glow" },
  { id: "beads", name: "beads" },
  { id: "eraser", name: "eraser" },
];
export const SIZES = [6, 12, 22];

/** The turns (radians) and flips a stroke is copied with: `n` around the centre, mirrored or not. */
export function symmetry(n, mirror) {
  const folds = Math.max(1, Math.round(n));
  const copies = [];
  for (let k = 0; k < folds; k++) {
    const angle = (2 * Math.PI * k) / folds;
    copies.push({ angle, flip: false });
    if (mirror) copies.push({ angle, flip: true });
  }
  return copies;
}

/** Where point (x, y) lands for one copy (rotate about the centre, flipping across the x axis first). */
export function copyPoint([x, y], { angle, flip }, centre = SIZE / 2) {
  const dx = x - centre, dy = flip ? -(y - centre) : y - centre;
  return [centre + dx * Math.cos(angle) - dy * Math.sin(angle), centre + dx * Math.sin(angle) + dy * Math.cos(angle)];
}

/** Drops points closer than `min` to the last kept one and rounds the rest, so drafts stay small. */
export function tidyPoints(points, min = 1.5) {
  const out = [];
  for (const [x, y, p = 0.5] of points) {
    const last = out.at(-1);
    if (last && Math.hypot(x - last[0], y - last[1]) < min) continue;
    out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100]);
  }
  if (points.length && out.length < 1) out.push(points[0]);
  return out;
}

/** Evenly spaced bead centres along a stroke. */
export function beadPoints(points, spacing) {
  if (!points.length) return [];
  const out = [[points[0][0], points[0][1]]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    let along = spacing - carry;
    while (along <= length) {
      const t = along / length;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      along += spacing;
    }
    carry = length - (along - spacing);
  }
  return out;
}

/** The latest saved snapshot at or before `count` strokes (snapshots: Map of count → image). */
export function nearestCheckpoint(checkpoints, count) {
  let best = 0;
  for (const at of checkpoints.keys()) if (at <= count && at > best) best = at;
  return best;
}

/** The next fold count when she taps the symmetry chip. */
export const nextFold = (n) => FOLDS[(FOLDS.indexOf(n) + 1) % FOLDS.length] ?? FOLDS[0];
