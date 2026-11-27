import { getStroke } from "perfect-freehand";
import { SIZE, beadPoints, symmetry } from "./logic.js";

// Paints kaleidoscope strokes onto a canvas: each stroke's outline is worked out once (perfect-
// freehand, MIT) and then filled at every turn and flip around the centre.

/** perfect-freehand's outline points as a smooth Path2D (the approach from its README, MIT). */
function outline(points, size, last) {
  const stroke = getStroke(points, { size, thinning: 0.45, smoothing: 0.55, streamline: 0.4, simulatePressure: true, last });
  if (stroke.length < 4) {
    const path = new Path2D();
    const [x, y] = points[0] ?? [SIZE / 2, SIZE / 2];
    path.arc(x, y, size / 2, 0, Math.PI * 2);
    return path;
  }
  const avg = (a, b) => (a + b) / 2;
  let d = `M${stroke[0][0]},${stroke[0][1]} Q${stroke[1][0]},${stroke[1][1]} ${avg(stroke[1][0], stroke[2][0])},${avg(stroke[1][1], stroke[2][1])} T`;
  for (let i = 2; i < stroke.length - 1; i++) d += `${avg(stroke[i][0], stroke[i + 1][0])},${avg(stroke[i][1], stroke[i + 1][1])} `;
  return new Path2D(`${d}Z`);
}

function eachCopy(ctx, stroke, paint) {
  for (const copy of symmetry(stroke.n, stroke.mirror)) {
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(copy.angle);
    if (copy.flip) ctx.scale(1, -1);
    ctx.translate(-SIZE / 2, -SIZE / 2);
    paint();
    ctx.restore();
  }
}

/** Paints one stroke (all its copies). `scale` is canvas pixels per drawing unit. */
export function paintStroke(ctx, stroke, scale, last = true) {
  if (stroke.tool === "clear") {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    return;
  }
  if (!stroke.points?.length) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.fillStyle = stroke.color;
  if (stroke.tool === "beads") {
    const r = stroke.size * 0.55;
    const path = new Path2D();
    for (const [x, y] of beadPoints(stroke.points, stroke.size * 1.7)) {
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    }
    eachCopy(ctx, stroke, () => ctx.fill(path));
  } else if (stroke.tool === "glow") {
    const halo = outline(stroke.points, stroke.size * 2.8, last);
    const core = outline(stroke.points, stroke.size, last);
    const shine = outline(stroke.points, Math.max(2, stroke.size * 0.32), last);
    eachCopy(ctx, stroke, () => {
      ctx.globalAlpha = 0.2;
      ctx.fill(halo);
      ctx.globalAlpha = 1;
      ctx.fill(core);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#ffffff";
      ctx.fill(shine);
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = 1;
    });
  } else {
    const path = outline(stroke.points, stroke.tool === "eraser" ? stroke.size * 1.8 : stroke.size, last);
    eachCopy(ctx, stroke, () => ctx.fill(path));
  }
  ctx.restore();
}

/** The whole drawing on its paper, as a square canvas `width` pixels wide (for sharing). */
export function paintDrawing(strokes, paper, width = 1600) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = width;
  const ink = document.createElement("canvas");
  ink.width = ink.height = width;
  const inkCtx = ink.getContext("2d");
  for (const stroke of strokes) paintStroke(inkCtx, stroke, width / SIZE);
  // A round plate on a soft lilac card, like the one she drew on.
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3ecfc";
  ctx.fillRect(0, 0, width, width);
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, width / 2, width * 0.47, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = paper.fill;
  ctx.fillRect(0, 0, width, width);
  ctx.translate(width * 0.03, width * 0.03);
  ctx.scale(0.94, 0.94);
  ctx.drawImage(ink, 0, 0);
  ctx.restore();
  ctx.lineWidth = width * 0.006;
  ctx.strokeStyle = "#c9b1ee";
  ctx.beginPath();
  ctx.arc(width / 2, width / 2, width * 0.47, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
}
