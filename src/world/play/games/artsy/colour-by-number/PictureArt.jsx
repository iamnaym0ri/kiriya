import { memo } from "react";
import { idColour } from "./logic.js";

export const INK = "#5b4569";
const PAPER = "#fffdfd";

// SMIL's clock starts with the document, so a bloom added later starts itself.
const startNow = (element) => element?.beginElement?.();

const Region = memo(function Region({ i, d, rule, fill, bloom, bloomFill, uid, strokeWidth, pulse }) {
  return (
    <>
      <path data-i={i} d={d} fill={fill} fillRule={rule} stroke={INK} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className={pulse ? "cbn-pulse" : undefined} />
      {bloom && (
        <>
          <clipPath id={`${uid}-bloom-${i}`}>
            <circle cx={bloom.x} cy={bloom.y} r="0">
              <animate ref={startNow} attributeName="r" from="0" to={bloom.r} begin="indefinite" dur="0.38s" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1" fill="freeze" />
            </circle>
          </clipPath>
          <path d={d} fill={bloomFill} fillRule={rule} clipPath={`url(#${uid}-bloom-${i})`} stroke={INK} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </>
      )}
    </>
  );
});

/**
 * One picture as SVG: painted regions, the hatched hint for the chosen number, the numbers, and the
 * line details. Used large on the easel and small on the picker's cards.
 */
export default function PictureArt({ picture, filled, selected = -1, spots, labelScale = 0, uid = "cbn", blooms, pulse = -1, soft = false, strokeWidth = 2, svgRef, viewBox, className, label }) {
  const done = filled instanceof Set ? filled : new Set(filled);
  const hatch = selected >= 0 ? picture.palette[selected]?.hex : null;
  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={viewBox ?? `0 0 ${picture.width} ${picture.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? picture.name}
    >
      {hatch && (
        <defs>
          <pattern id={`${uid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill={PAPER} />
            <rect width="3.2" height="8" fill={hatch} opacity="0.5" />
          </pattern>
        </defs>
      )}
      <rect x="5" y="6" width={picture.width} height={picture.height} rx="3" fill="#e2d2ee" />
      <g opacity={soft ? 1 : undefined}>
        {picture.regions.map((region, i) => {
          const isDone = done.has(i);
          const bloom = blooms?.[i];
          const fill = isDone && !bloom ? picture.palette[region.c].hex : region.c === selected && !isDone ? `url(#${uid}-hatch)` : PAPER;
          return (
            <Region
              key={i}
              i={i}
              d={region.d}
              rule={region.rule}
              fill={fill}
              bloom={bloom}
              bloomFill={picture.palette[region.c].hex}
              uid={uid}
              strokeWidth={soft ? strokeWidth * 0.6 : strokeWidth}
              pulse={pulse === i}
            />
          );
        })}
      </g>
      <g fill="none" stroke={INK} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        {picture.lines.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {spots && labelScale > 0 && (
        <g className="cbn-numbers" pointerEvents="none" textAnchor="middle" dominantBaseline="central">
          {picture.regions.map((region, i) => {
            const spot = spots[i];
            if (done.has(i) || !spot || spot.r <= 0) return null;
            const size = Math.min(16, Math.max(3.4, spot.r * 0.95));
            if (size * labelScale < 7) return null;
            const chosen = region.c === selected;
            return (
              <text key={i} x={spot.x} y={spot.y} fontSize={size} fill={chosen ? "#3d2850" : "#9d8fae"} fontWeight={chosen ? 800 : 600}>
                {region.c + 1}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}

// ---------- where the numbers go (needs a canvas, so it runs in the browser) ----------

const spotCache = new Map();
/** Paints each region in its own code colour, outlines in black, and reads the map back. */
export async function regionSpots(picture, labelSpots, decodeIds) {
  if (spotCache.has(picture.id)) return spotCache.get(picture.id);
  const { width: w, height: h } = picture;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  picture.regions.forEach((region, i) => {
    const path = new Path2D(region.d);
    ctx.fillStyle = `rgb(${idColour(i).join(",")})`;
    ctx.fill(path, region.rule ?? "nonzero");
    ctx.stroke(path);
  });
  ctx.lineWidth = 1.8;
  for (const d of picture.lines) ctx.stroke(new Path2D(d));
  const ids = decodeIds(ctx.getImageData(0, 0, w, h).data, picture.regions.length);
  const spots = labelSpots(ids, w, h, picture.regions.length);
  spotCache.set(picture.id, spots);
  return spots;
}

/** The finished picture as a big PNG for the chat or her doodle gallery. */
export function paintPicture(picture, width = 1080) {
  const scale = width / picture.width;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(picture.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  for (const region of picture.regions) {
    const path = new Path2D(region.d);
    ctx.fillStyle = picture.palette[region.c].hex;
    ctx.fill(path, region.rule ?? "nonzero");
    ctx.lineWidth = 1.8;
    ctx.stroke(path);
  }
  ctx.lineWidth = 1.5;
  for (const d of picture.lines) ctx.stroke(new Path2D(d));
  return canvas;
}
