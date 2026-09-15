import { getStroke } from "perfect-freehand";

export const PAPERS = {
  dots: { label: "Dotty", fill: "#fffdfb", pattern: "dots" },
  white: { label: "Plain", fill: "#ffffff" },
  cream: { label: "Cream", fill: "#fff3df" },
  lavender: { label: "Lilac", fill: "#f1e8ff" },
  ruled: { label: "Lined", fill: "#fffaf6", pattern: "lines" },
  night: { label: "Night", fill: "#19083a" },
};
export const SIZES = [4, 10, 24];
export const BRUSHES = [
  { id: "pen", label: "Brush" }, { id: "pencil", label: "Pencil" },
  { id: "marker", label: "Marker" }, { id: "crayon", label: "Crayon" },
];
export const SHAPES = [
  { id: "line", label: "Line" }, { id: "rectangle", label: "Box" },
  { id: "ellipse", label: "Circle" }, { id: "heart", label: "Heart" },
  { id: "star", label: "Star" }, { id: "sparkle", label: "Sparkle" },
];
export const isShape = tool => SHAPES.some(shape => shape.id === tool);
export function drawingHistory(strokes = [], undone = []) {
  const start = strokes.findLastIndex(stroke => stroke.tool === "clear") + 1;
  return { count: strokes.length - start, canUndo: strokes.length > 0, canRedo: undone.length > 0 };
}

function outlinePath(points) {
  if (points.length < 4) return new Path2D();
  const avg = (a, b) => (a + b) / 2;
  let d = `M${points[0][0]},${points[0][1]} Q${points[1][0]},${points[1][1]} ${avg(points[1][0], points[2][0])},${avg(points[1][1], points[2][1])} T`;
  for (let i = 2; i < points.length - 1; i++) d += `${avg(points[i][0], points[i + 1][0])},${avg(points[i][1], points[i + 1][1])} `;
  return new Path2D(d + "Z");
}

function shapePath(stroke) {
  const [a, b] = [stroke.points[0], stroke.points.at(-1)];
  const tap = Math.hypot(b[0] - a[0], b[1] - a[1]) < 4;
  const diameter = Math.max(28, stroke.size * 3);
  const x = tap ? a[0] - diameter / 2 : Math.min(a[0], b[0]);
  const y = tap ? a[1] - diameter / 2 : Math.min(a[1], b[1]);
  const w = tap ? diameter : Math.max(1, Math.abs(a[0] - b[0]));
  const h = tap ? diameter : Math.max(1, Math.abs(a[1] - b[1]));
  const p = new Path2D();
  if (stroke.tool === "line") {
    p.moveTo(tap ? x : a[0], tap ? y + h : a[1]);
    p.lineTo(tap ? x + w : b[0], tap ? y : b[1]);
  }
  else if (stroke.tool === "rectangle") p.rect(x, y, w, h);
  else if (stroke.tool === "ellipse") p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (stroke.tool === "heart") {
    p.moveTo(x + w / 2, y + h);
    p.bezierCurveTo(x + w * .4, y + h * .82, x - w * .15, y + h * .45, x + w * .04, y + h * .15);
    p.bezierCurveTo(x + w * .18, y - h * .08, x + w * .44, y, x + w / 2, y + h * .23);
    p.bezierCurveTo(x + w * .56, y, x + w * .82, y - h * .08, x + w * .96, y + h * .15);
    p.bezierCurveTo(x + w * 1.15, y + h * .45, x + w * .6, y + h * .82, x + w / 2, y + h);
    p.closePath();
  } else {
    const sides = stroke.tool === "sparkle" ? 4 : 5;
    for (let i = 0; i < sides * 2; i++) {
      const angle = Math.PI * i / sides - Math.PI / 2;
      const radius = i % 2 ? (sides === 4 ? .19 : .43) : 1;
      const px = x + w / 2 + Math.cos(angle) * w / 2 * radius;
      const py = y + h / 2 + Math.sin(angle) * h / 2 * radius;
      i ? p.lineTo(px, py) : p.moveTo(px, py);
    }
    p.closePath();
  }
  return p;
}

// Texture uses fixed dots so resizing, undo and export preserve the same crayon marks.
const crayons = new Map();
function crayonPattern(ctx, color) {
  if (!crayons.has(color)) {
    const tile = document.createElement("canvas"); tile.width = tile.height = 12;
    const paint = tile.getContext("2d"); paint.fillStyle = color;
    paint.globalAlpha = .65; paint.fillRect(0, 0, 12, 12);
    paint.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 22; i++) paint.fillRect((i * 7) % 12, (i * 5 + Math.floor(i / 4)) % 12, 1.2, 1.7);
    if (crayons.size > 32) crayons.delete(crayons.keys().next().value);
    crayons.set(color, tile);
  }
  return ctx.createPattern(crayons.get(color), "repeat");
}
function paintStroke(ctx, stroke) {
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.globalAlpha = stroke.tool === "eraser" ? 1 : (stroke.opacity ?? 1);
  ctx.fillStyle = ctx.strokeStyle = stroke.color;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;
  if (isShape(stroke.tool)) {
    const path = shapePath(stroke);
    if (stroke.tool !== "line" && stroke.fill !== false) ctx.fill(path);
    else ctx.stroke(path);
  } else if (stroke.tool === "marker") {
    ctx.globalAlpha *= .4;
    ctx.lineWidth = stroke.size * 1.6;
    ctx.beginPath();
    stroke.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (stroke.points.length === 1) ctx.lineTo(stroke.points[0][0] + .1, stroke.points[0][1]);
    ctx.stroke();
  } else {
    const pencil = stroke.tool === "pencil";
    if (stroke.tool === "crayon") ctx.fillStyle = crayonPattern(ctx, stroke.color);
    const path = outlinePath(getStroke(stroke.points, {
      size: stroke.size * (pencil ? .38 : 1),
      thinning: pencil ? .25 : stroke.pen ? .7 : .5,
      smoothing: pencil ? .2 : .55, streamline: pencil ? .15 : .45,
      simulatePressure: !stroke.pen, last: stroke.done,
    }));
    ctx.fill(path);
  }
  ctx.restore();
}
export function renderInk(ctx, strokes, width, height) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(width / 800, 0, 0, width / 800, 0, 0);
  for (const stroke of strokes) {
    if (stroke.tool === "clear") { ctx.clearRect(0, 0, 800, height / width * 800); continue; }
    paintStroke(ctx, stroke);
    if (stroke.mirror) {
      ctx.save(); ctx.translate(800, 0); ctx.scale(-1, 1);
      paintStroke(ctx, stroke); ctx.restore();
    }
  }
}
export function renderPaper(ctx, key, width, height) {
  const paper = PAPERS[key] ?? PAPERS.white;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = paper.fill; ctx.fillRect(0, 0, width, height);
  ctx.setTransform(width / 800, 0, 0, width / 800, 0, 0);
  ctx.fillStyle = "#d9c9de"; ctx.strokeStyle = "#dfccdf"; ctx.lineWidth = 1;
  for (let y = 24; y < height / width * 800; y += 24) {
    if (paper.pattern === "dots") for (let x = 24; x < 800; x += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
    if (paper.pattern === "lines") { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
  }
}

export function groupArtworksByDate(artworks, timeZone = "Asia/Singapore") {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const label = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "long", day: "numeric" });
  const groups = new Map();
  for (const art of [...artworks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
    const date = new Date(art.createdAt);
    const valid = !Number.isNaN(date.getTime());
    const id = valid ? key.format(date) : "undated";
    if (!groups.has(id)) groups.set(id, { key: id, label: valid ? label.format(date) : "Earlier pages", artworks: [] });
    groups.get(id).artworks.push(art);
  }
  return [...groups.values()];
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
