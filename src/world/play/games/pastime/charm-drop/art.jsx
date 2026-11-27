// Charm drop's charms: each falling piece is a string of one kind of charm bead, drawn for this
// site. The same little shapes paint the canvas (as cached sprites) and the "next" previews (SVG).
import { PIECES, cellsOf } from "./engine.js";

export const CHARM_LOOKS = {
  ribbon: { fill: "#f59cc0", edge: "#b0577f", motif: "M10 10C7 6 3 6 3 9s4 3 7 1zM10 10c3-4 7-4 7-1s-4 3-7 1z" },
  moon: { fill: "#a9cdf5", edge: "#4f6fae", motif: "M12.5 3a7 7 0 1 0 4.5 11.5A5.6 5.6 0 1 1 12.5 3z" },
  star: { fill: "#ffe08a", edge: "#b7862a", motif: "M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5L10 13.9 5.5 16.3l.9-5L2.8 7.8l5-.7z" },
  locket: { fill: "#8fd3c7", edge: "#3f8f86", motif: "M10 3l6 7-6 7-6-7z" },
  leaf: { fill: "#a8d69a", edge: "#4f7d5a", motif: "M4 16C4 8 9 4 16 4c0 7-4 12-12 12z" },
  crown: { fill: "#c9a8f5", edge: "#6a4c99", motif: "M3 15l-.5-8 4 3.5L10 4l3.5 6.5 4-3.5-.5 8z" },
  petal: { fill: "#f7b68a", edge: "#b8692e", motif: "M10 15.5C4.5 12 3 9 3 7c0-2 1.6-3.6 3.5-3.6 1.6 0 2.8.9 3.5 2.2.7-1.3 1.9-2.2 3.5-2.2C15.4 3.4 17 5 17 7c0 2-1.5 5-7 8.5z" },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One bead per kind, painted once at the board's size. */
export function makeSprites(cell, dpr) {
  const sprites = {};
  for (const [type, look] of Object.entries(CHARM_LOOKS)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.ceil(cell * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const inset = Math.max(1, cell * 0.06);
    const size = cell - inset * 2;
    roundRect(ctx, inset, inset, size, size, size * 0.28);
    const shade = ctx.createLinearGradient(0, inset, 0, inset + size);
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(0.35, look.fill);
    shade.addColorStop(1, look.fill);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, cell * 0.06);
    ctx.strokeStyle = look.edge;
    ctx.stroke();
    ctx.save();
    const scale = (size * 0.62) / 20;
    ctx.translate(cell / 2 - 10 * scale, cell / 2 - 10 * scale + cell * 0.02);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill(new Path2D(look.motif));
    ctx.restore();
    sprites[type] = canvas;
  }
  return sprites;
}

export function drawCell(ctx, sprites, type, x, y, cell) {
  const sprite = sprites?.[type];
  if (sprite) ctx.drawImage(sprite, x, y, cell, cell);
}

/** A small picture of a whole piece, for "next" and "keep". */
export function CharmCell({ type, size = 14 }) {
  const look = CHARM_LOOKS[type];
  const cells = cellsOf({ type, x: 0, y: 0, dir: 0 });
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
  return (
    <svg className="drop-piece" viewBox={`0 0 ${w * 20} ${h * 20}`} width={w * size} height={h * size} aria-label={`${type} charm`} role="img">
      {cells.map(([x, y], i) => (
        <g key={i} transform={`translate(${(x - minX) * 20} ${(y - minY) * 20})`}>
          <rect x="1" y="1" width="18" height="18" rx="5" fill={look.fill} stroke={look.edge} strokeWidth="1.4" />
          <path d={look.motif} transform="translate(3.6 3.8) scale(0.64)" fill="#fff" opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}

export function CharmDropIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 14h40v40c0 4-3 6-6 6H18c-3 0-6-2-6-6z" fill="#f6eefa" stroke="#9675af" strokeWidth="2" />
      <path d="M10 10h44" stroke="#9675af" strokeWidth="3" strokeLinecap="round" />
      {[[16, 46, "crown"], [26, 46, "crown"], [36, 46, "star"], [46, 46, "star"], [16, 36, "leaf"], [36, 36, "star"], [26, 18, "ribbon"], [26, 28, "ribbon"]].map(([x, y, type], i) => (
        <g key={i} transform={`translate(${x - 1} ${y - 1}) scale(0.55)`}>
          <rect x="1" y="1" width="18" height="18" rx="5" fill={CHARM_LOOKS[type].fill} stroke={CHARM_LOOKS[type].edge} strokeWidth="1.6" />
          <path d={CHARM_LOOKS[type].motif} transform="translate(3.6 3.8) scale(0.64)" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}

export const PIECE_NAMES = Object.keys(PIECES);
