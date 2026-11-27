// Little helpers that turn points into SVG path data with a soft, hand-drawn wobble. The pictures in
// pictures.js are made from these, so the same path both fills (SVG and canvas Path2D) and outlines.
const f = (n) => Math.round(n * 10) / 10;

/** A small seeded random, so a picture's wobble is the same every time. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/**
 * A smooth curve through the points (Catmull-Rom as cubic Béziers). A point written [x, y, 1] is a
 * sharp corner. Open curves are for lines only.
 */
export function smooth(points, { closed = true, tension = 1 } = {}) {
  const n = points.length;
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  const t = tension / 6;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** A wobbly ellipse (rot in degrees). */
export function blob(cx, cy, rx, ry = rx, { seed = 1, wobble = 0.03, n = 10, rot = 0, from = 0, to = 360 } = {}) {
  const random = rng(seed * 7919 + Math.round(cx * 13 + cy * 31));
  const r = (rot * Math.PI) / 180;
  const arc = to - from < 360;
  const count = arc ? Math.max(3, Math.round((n * (to - from)) / 360)) : n;
  const points = [];
  for (let i = 0; i <= (arc ? count : count - 1); i++) {
    const a = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    const k = 1 + (random() - 0.5) * 2 * wobble;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    points.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  if (arc) {
    points[0].push(1);
    points.at(-1).push(1);
  }
  return smooth(points);
}

/** Straight edges between the points. */
export const poly = (points) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;

/** A rounded rectangle. */
export function rect(x, y, w, h, r = 0) {
  if (!r) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/** A heart of width s centred on (cx, cy), point down; tilt in degrees. */
export function heart(cx, cy, s, tilt = 0) {
  const pts = [
    [0, 0.42, 1], [-0.3, 0.12], [-0.5, -0.12], [-0.42, -0.36], [-0.2, -0.42], [0, -0.24, 1],
    [0.2, -0.42], [0.42, -0.36], [0.5, -0.12], [0.3, 0.12],
  ];
  const r = (tilt * Math.PI) / 180;
  return smooth(pts.map(([x, y, c]) => [cx + (x * Math.cos(r) - y * Math.sin(r)) * s, cy + (x * Math.sin(r) + y * Math.cos(r)) * s, c]));
}

/** A star with `n` points (outer radius R, inner r). */
export function star(cx, cy, R, r = R * 0.45, n = 5, rot = -90) {
  const points = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (180 / n) * i) * Math.PI) / 180;
    const k = i % 2 ? r : R;
    points.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k, i % 2 ? 0 : 1]);
  }
  return smooth(points, { tension: 0.5 });
}

/** A four-point twinkle. */
export const sparkle = (cx, cy, R) => star(cx, cy, R, R * 0.36, 4, -90);

/** Several shapes as one region (they fill together). */
export const join = (...paths) => paths.join("");

/** Points drawn around (0, 0), turned by `rot` degrees, scaled and moved to (cx, cy). */
export function place(points, cx, cy, rot = 0, scale = 1, mirror = false) {
  const r = (rot * Math.PI) / 180;
  return points.map(([x, y, c]) => {
    const mx = (mirror ? -x : x) * scale, my = y * scale;
    return [cx + mx * Math.cos(r) - my * Math.sin(r), cy + mx * Math.sin(r) + my * Math.cos(r), c];
  });
}

/** An ellipse with a frilly (scalloped) edge, like a doily or a plate's rim. */
export function scallop(cx, cy, rx, ry, n = 24, depth = 0.08) {
  const points = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const k = i % 2 ? 1 - depth : 1;
    points.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, i % 2]);
  }
  return smooth(points);
}

/** A puffy cloud with a flat-ish bottom. */
export function cloud(cx, cy, w, h, bumps = 4, seed = 3) {
  const random = rng(seed);
  const points = [[cx - w / 2, cy, 1]];
  for (let i = 0; i <= bumps * 2; i++) {
    const a = Math.PI + (Math.PI * i) / (bumps * 2);
    const peak = i % 2 === 1;
    const k = peak ? 1 + random() * 0.18 : 0.78;
    points.push([cx + Math.cos(a) * (w / 2) * (peak ? 0.98 : 1), cy + Math.sin(a) * h * k, peak ? 0 : 1]);
  }
  points.push([cx + w / 2, cy, 1], [cx, cy + h * 0.12]);
  return smooth(points.filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 0.5));
}

/** A band of width `w` (or [start, end] widths) along a centre line: ribbons, paths, tails. */
export function band(line, w) {
  const [w0, w1] = Array.isArray(w) ? w : [w, w];
  const n = line.length;
  const left = [], right = [];
  line.forEach(([x, y], i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    const half = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    left.push([x + nx * half, y + ny * half, i === 0 || i === n - 1 ? 1 : 0]);
    right.push([x - nx * half, y - ny * half, i === 0 || i === n - 1 ? 1 : 0]);
  });
  return smooth([...left, ...right.reverse()]);
}

/** Icing along the top of a cake tier: a flat top and rounded drips hanging down. */
export function drips(x0, x1, top, base, n = 6, seed = 5) {
  const random = rng(seed);
  const points = [[x0, top + 6, 1], [x0 + 4, top, 1], [x1 - 4, top, 1], [x1, top + 6, 1]];
  const step = (x1 - x0) / n;
  for (let k = 0; k <= n; k++) {
    const x = x1 - k * step;
    points.push([x, base + (k === 0 || k === n ? 0 : 4), 0]);
    if (k < n) points.push([x - step / 2, base + 12 + random() * 18, 0]);
  }
  return smooth(points);
}

/** A little hanging flag for bunting: top edge from a to b, point hanging `drop` below. */
export function flag([ax, ay], [bx, by], drop) {
  return smooth([[ax, ay, 1], [bx, by, 1], [(ax + bx) / 2, (ay + by) / 2 + drop, 1]]);
}

/** A capital Z (for sleepy cats), size s at its top-left corner (x, y). */
export function zee(x, y, s, tilt = -8) {
  const pts = [[0, 0], [1, 0], [1, 0.27], [0.45, 0.73], [1, 0.73], [1, 1], [0, 1], [0, 0.73], [0.55, 0.27], [0, 0.27]];
  return smooth(place(pts.map(([px, py]) => [px - 0.5, py - 0.5, 1]), x + s / 2, y + s / 2, tilt, s));
}
