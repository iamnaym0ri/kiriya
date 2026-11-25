// Renders the kiriya.love iPhone app's icon and launch image: "kiriya" in the site's own cursive
// wordmark (Parisienne, SIL OFL, public/fonts) on lilac. Letters become vector paths with fontkit,
// so the result matches the nav bar exactly, then sharp renders PNGs with no transparency (Apple
// rejects icons with an alpha channel).
// Besides the lilac icon it makes four alternate icons she can pick in the app (Settings → app icon):
// Night, Blush, Mint and Paper. Colours only, no character art. Each becomes its own
// `<Name>.appiconset` (the App target lists them in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES)
// plus a small preview under public/app-icons/ for the picker.
//   node scripts/make-app-icon.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as fontkit from "fontkit";
import sharp from "sharp";

const font = fontkit.openSync(path.resolve("public/fonts/parisienne-400.woff2"));
const iosAssets = path.resolve("ios/App/App/Assets.xcassets");

/** The word as one SVG path (font units, y flipped), plus its ink bounds for centring. */
function wordPath(text) {
  const run = font.layout(text);
  let x = 0;
  const parts = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  run.glyphs.forEach((glyph, i) => {
    const position = run.positions[i];
    const box = glyph.bbox;
    const ox = x + position.xOffset, oy = position.yOffset;
    if (Number.isFinite(box.minX)) {
      minX = Math.min(minX, ox + box.minX); maxX = Math.max(maxX, ox + box.maxX);
      minY = Math.min(minY, oy + box.minY); maxY = Math.max(maxY, oy + box.maxY);
    }
    parts.push(`<path transform="translate(${ox} ${oy})" d="${glyph.path.toSVG()}"/>`);
    x += position.xAdvance;
  });
  return { svg: parts.join(""), minX, minY, maxX, maxY };
}

const word = wordPath("kiriya");
const sparkle = "M0-46Q8-8 46 0 8 8 0 46-8 8-46 0-8-8 0-46Z";

/** Seeded so the stars land in the same places on every run. */
function seeded(seed) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function stars(size) {
  const random = seeded(7);
  const dots = [];
  for (let i = 0; i < 46; i++) {
    const x = random() * size, y = random() * size, r = (0.8 + random() * 2.4) * (size / 1024), o = 0.35 + random() * 0.55;
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#f4ecff" fill-opacity="${o.toFixed(2)}"/>`);
  }
  return dots.join("");
}

function ruledPaper(size) {
  const lines = [];
  const gap = size / 11;
  for (let y = gap * 1.5; y < size; y += gap) lines.push(`<rect x="0" y="${y.toFixed(1)}" width="${size}" height="${(size / 512).toFixed(2)}" fill="#c9b48e" fill-opacity="0.32"/>`);
  lines.push(`<rect x="${(size * 0.13).toFixed(1)}" y="0" width="${(size / 400).toFixed(2)}" height="${size}" fill="#e08a8a" fill-opacity="0.35"/>`);
  return lines.join("");
}

// Each look: a three-stop background, a soft glow, the ink for the word and the sparkle's colour.
const THEMES = {
  lilac: { stops: ["#f3e9fa", "#e2cff0", "#cfb2e4"], glow: "#ffe6f1", glowOpacity: 0.85, ink: "#4e2f63", sparkle: "#9a6fb4", flat: "#e2cff0" },
  night: { stops: ["#2b2160", "#211a4d", "#15102f"], glow: "#8f7fe0", glowOpacity: 0.45, ink: "#efe3ff", sparkle: "#ffd9f0", flat: "#211a4d", extra: stars },
  blush: { stops: ["#fdeef3", "#f8d3df", "#efb3c8"], glow: "#fff4e6", glowOpacity: 0.8, ink: "#7a2f4f", sparkle: "#d06d93", flat: "#f8d3df" },
  mint: { stops: ["#e6faf7", "#b9ece6", "#7fd6cc"], glow: "#f1e6ff", glowOpacity: 0.7, ink: "#1d5c57", sparkle: "#e86aa6", flat: "#b9ece6" },
  paper: { stops: ["#fdf8ee", "#f6ecd8", "#ecdcbd"], glow: "#fffaf0", glowOpacity: 0.6, ink: "#4e2f63", sparkle: "#c4934a", flat: "#f6ecd8", extra: ruledPaper },
};

/** A square canvas with the word centred at `width` of the canvas. */
function art(size, { widthShare = 0.74, background = true, theme = "lilac" } = {}) {
  const look = THEMES[theme];
  const inkW = word.maxX - word.minX, inkH = word.maxY - word.minY;
  const scale = (size * widthShare) / inkW;
  const cx = size / 2, cy = size / 2;
  // Font y grows upward; SVG y grows downward, hence the negative vertical scale.
  const tx = cx - (word.minX + inkW / 2) * scale;
  const ty = cy + (word.minY + inkH / 2) * scale;
  // The sparkle keeps its size relative to the word (1 unit = 1 px of the 1024 px icon).
  const unit = (size * widthShare) / (1024 * 0.74);
  const sx = cx + (inkW / 2) * scale + 20 * unit, sy = cy - (inkH / 2) * scale + 30 * unit;
  const [a, b, c] = look.stops;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.18" r="0.55">
      <stop offset="0" stop-color="${look.glow}" stop-opacity="${look.glowOpacity}"/><stop offset="1" stop-color="${look.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${background ? `<rect width="${size}" height="${size}" fill="url(#bg)"/>${look.extra ? look.extra(size) : ""}<rect width="${size}" height="${size}" fill="url(#glow)"/>` : ""}
  <!-- A soft stroke in the same ink thickens the hairlines so the word stays readable at 60 pt. -->
  <g fill="${look.ink}" stroke="${look.ink}" stroke-width="34" stroke-linejoin="round" transform="translate(${tx} ${ty}) scale(${scale} ${-scale})">${word.svg}</g>
  <path d="${sparkle}" fill="${look.sparkle}" transform="translate(${sx} ${sy}) scale(${unit})"/>
</svg>`;
}

async function png(svg, file, size, flat = THEMES.lilac.flat) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).flatten({ background: flat }).removeAlpha().png().toFile(file);
  console.log("wrote", path.relative(process.cwd(), file));
}

const iconSet = (filename) =>
  JSON.stringify({ images: [{ filename, idiom: "universal", platform: "ios", size: "1024x1024" }], info: { author: "xcode", version: 1 } }, null, 2) + "\n";

// iOS single-size app icon (Xcode 14+ derives the rest from the 1024 px one).
await png(art(1024), path.join(iosAssets, "AppIcon.appiconset/AppIcon-512@2x.png"), 1024);
// Launch image: the same word, smaller, on the same lilac (shown for a moment while the app opens).
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"])
  await png(art(2732, { widthShare: 0.3 }), path.join(iosAssets, "Splash.imageset", name), 2732);
// A copy for the "how to get the app" page on kiriya.love.
await png(art(1024), path.resolve("public/install/kiriya-app-icon.png"), 512);

// Alternate icons. Names must not start with "AppIcon" (they don't render on iOS 26) and must match
// what the web side passes to AppIcon.setIcon({ icon }).
await png(art(1024), path.resolve("public/app-icons/lilac.png"), 180);
for (const [name, theme] of [["Night", "night"], ["Blush", "blush"], ["Mint", "mint"], ["Paper", "paper"]]) {
  const set = path.join(iosAssets, `${name}.appiconset`);
  const file = `${name}-1024.png`;
  await png(art(1024, { theme }), path.join(set, file), 1024, THEMES[theme].flat);
  await writeFile(path.join(set, "Contents.json"), iconSet(file));
  await png(art(1024, { theme }), path.resolve(`public/app-icons/${theme}.png`), 180, THEMES[theme].flat);
}
