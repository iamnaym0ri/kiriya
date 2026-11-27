// Shy shade's colours. Differences are measured in Oklab, a perceptual colour space, so "a whisper
// different" means the same amount to the eye whatever the base colour is. The Oklab <-> sRGB
// conversion is Björn Ottosson's reference code (https://bottosson.github.io/posts/oklab/), which he
// placed in the public domain; ported to JS here.

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Oklab [L, a, b] → sRGB [r, g, b] in 0..1 (may fall outside for out-of-gamut colours). */
export function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** sRGB [r, g, b] in 0..1 → Oklab [L, a, b]. */
export function rgbToOklab([r, g, b]) {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export const fromLch = (L, C, hueDegrees) => {
  const h = (hueDegrees * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
};
export const inGamut = (rgb) => rgb.every((c) => c >= 0 && c <= 1);
export const toHex = (rgb) =>
  `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("")}`;
export const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
export const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
/** How far apart two hex colours are, in Oklab. */
export const hexDistance = (a, b) => distance(rgbToOklab(fromHex(a)), rgbToOklab(fromHex(b)));

/** WCAG relative luminance contrast between two hex colours (1 = identical). */
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b2] = fromHex(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
