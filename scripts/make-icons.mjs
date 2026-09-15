// Renders the app icons (Home Screen, maskable, notification badge, favicon) from SVG.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve("public/icons");
await mkdir(out, { recursive: true });

const heart =
  "M256 404C152 334 104 282 104 220c0-46 36-82 80-82 32 0 56 17 72 42 16-25 40-42 72-42 44 0 80 36 80 82 0 62-48 114-152 184z";
const sparkle = "M378 112q6 26 32 32-26 6-32 32-6-26-32-32 26-6 32-32z";

function art(scale = 1) {
  // Scale around the centre so maskable icons keep the heart inside the safe zone.
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="${heart}" fill="#fff9fd"/>
    <path d="${sparkle}" fill="#fff9fd"/>
  </g>`;
}

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#493653"/>${art(1)}</svg>`;
const fullBleed = (
  scale,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#493653"/>${art(scale)}</svg>`;
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${heart}" transform="translate(256 256) scale(1.25) translate(-256 -270)" fill="#fff9fd"/></svg>`;

const jobs = [
  ["icon-192.png", rounded, 192],
  ["icon-512.png", rounded, 512],
  ["maskable-512.png", fullBleed(0.78), 512],
  ["apple-touch-icon.png", fullBleed(0.92), 180],
  ["badge-96.png", badge, 96],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(out, name));
  console.log("wrote", name);
}
await writeFile(path.resolve("public/favicon.svg"), rounded);
console.log("wrote favicon.svg");
