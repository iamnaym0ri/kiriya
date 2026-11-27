// The games' art is drawn as SVG (the site's hand-drawn line style), then rasterised once into
// small canvases at the screen's pixel density. Each frame only copies those canvases, which keeps
// the loop cheap on an iPhone 11.

export const pixelRatio = () => Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

/** `svg` is the inside of an <svg viewBox="0 0 w h">. Resolves to a canvas of w×h CSS px. */
export function svgSprite(svg, width, height, scale = pixelRatio()) {
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" ` +
    `viewBox="0 0 ${width} ${height}">${svg}</svg>`;
  const image = new Image();
  // onload rather than decode(): WebKit's decode() has refused SVG images in the past.
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("sprite failed to load"));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return loaded.then(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.w = width; // CSS size, for drawing
    canvas.h = height;
    return canvas;
  });
}

/** `{ name: [svg, w, h] }` → `{ name: canvas }`, all at once. */
export async function svgSprites(table, scale) {
  const names = Object.keys(table);
  const canvases = await Promise.all(names.map((name) => svgSprite(table[name][0], table[name][1], table[name][2], scale)));
  return Object.fromEntries(names.map((name, i) => [name, canvases[i]]));
}

/** Draws a sprite centred on (x, y), optionally rotated and scaled (no allocations). */
export function drawSprite(ctx, sprite, x, y, rotation = 0, scaleX = 1, scaleY = scaleX, alpha = 1) {
  if (!sprite) return;
  const w = sprite.w;
  const h = sprite.h;
  if (rotation === 0 && scaleX === 1 && scaleY === 1) {
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
    if (alpha !== 1) ctx.globalAlpha = 1;
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** An offscreen canvas of w×h CSS px to paint backgrounds into once. */
export function paintedCanvas(width, height, paint, scale = pixelRatio()) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  canvas.w = width;
  canvas.h = height;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  paint(ctx, width, height);
  return canvas;
}

/** Shared line style, matching the sticker art and the kitten. */
export const INK = "#2b1b35";
export const line = (width = 2.6) =>
  `stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;
