import { memo } from "react";
import { flowerById } from "./flowers.jsx";
import { CardTag, Ribbon, WrapBack, WrapFront } from "./wraps.jsx";
import { headTransform, stemPath } from "./logic.js";

// A whole bouquet as one SVG (bouquet space 300 × 400): the back of the wrap, every stem, every
// flower head, then the front of the wrap, the ribbon and the card. Used by the editor (which moves
// heads and stems through refs while she drags), the shelf and the picture she keeps.

export const STEM = "#6f9f62";

export function stemColour(kind) {
  return kind === "cherry" ? "#7a5442" : kind === "pearls" ? "#c9b48a" : kind === "heart-pick" || kind === "star-pick" ? "#c9a46a" : STEM;
}

/** One flower's stem (an ink line under a green one) and its head. */
export const Stem = memo(function Stem({ item, register }) {
  const flower = flowerById(item.kind);
  if (!flower) return null;
  const d = stemPath(item, flower.base);
  return (
    <g ref={register ? (el) => register(item.id, "stem", el) : undefined}>
      <path d={d} fill="none" stroke="#4d5a3f" strokeOpacity="0.85" strokeWidth="4.4" strokeLinecap="round" />
      <path d={d} fill="none" stroke={stemColour(item.kind)} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
});

export const Head = memo(function Head({ item, register }) {
  const flower = flowerById(item.kind);
  if (!flower) return null;
  const Draw = flower.Draw;
  const c = flower.colors[item.c] ?? flower.colors[0];
  return (
    <g ref={register ? (el) => register(item.id, "head", el) : undefined} transform={headTransform(item)} data-flower={item.id}>
      <Draw c={c} />
    </g>
  );
});

export default function Bouquet({ bouquet, svgRef, className, label = "a bouquet", register, children, width, height }) {
  const items = (bouquet.items ?? []).filter((item) => flowerById(item.kind));
  return (
    <svg ref={svgRef} className={className} viewBox="0 0 300 400" width={width} height={height} role="img" aria-label={label}>
      <WrapBack wrap={bouquet.wrap} />
      <g>
        {items.map((item) => (
          <Stem key={item.id} item={item} register={register} />
        ))}
      </g>
      <g>
        {items.map((item) => (
          <Head key={item.id} item={item} register={register} />
        ))}
      </g>
      <g pointerEvents="none">
        <WrapFront wrap={bouquet.wrap} />
        <Ribbon ribbon={bouquet.ribbon} />
        {bouquet.card ? <CardTag text={bouquet.card} /> : null}
      </g>
      {children}
    </svg>
  );
}
