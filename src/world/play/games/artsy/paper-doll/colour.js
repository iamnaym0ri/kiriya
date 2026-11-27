// Tiny colour helpers for soft shading: a deeper tone for folds and shadows, a lighter one for
// highlights, both mixed from the garment's own colour so every colour variant shades itself.
const parse = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

export function mix(a, b, t) {
  const x = parse(a), y = parse(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
export const deep = (c, t = 0.3) => mix(c, "#5d2f74", t);
export const light = (c, t = 0.5) => mix(c, "#ffffff", t);
