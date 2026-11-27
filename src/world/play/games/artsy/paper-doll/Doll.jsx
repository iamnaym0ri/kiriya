import { memo } from "react";
import { DollArms, DollBody, DollHead, DollSlip, browOf } from "./body.jsx";
import { HAIR_COLOURS, hairById, tieFor } from "./hair.jsx";
import { Backdrop, EYE_COLOURS, SKINS, itemById } from "./wardrobe.jsx";

// The doll wearing a look, layer by layer: wings and the back of her hair, her body, socks, shoes,
// bottoms, tops, dresses, jackets, necklaces, arms and sleeves (the outermost on top), her face,
// glasses, the front of her hair, hats and bows, and whatever she's holding.

function Worn({ look, slot, part = "draw", lifting }) {
  const worn = look.outfit?.[slot];
  const item = worn && itemById(worn.id);
  const Draw = item?.[part];
  if (!Draw) return null;
  const [c, a] = item.colors[worn.c] ?? item.colors[0];
  // A piece she's dragging off stays in the picture, invisible: her finger's touch belongs to it,
  // and iOS keeps sending that touch to it (a removed piece would take the rest of the drag along).
  return (
    <g data-slot={slot} data-item={item.id} opacity={lifting === slot ? 0 : undefined}>
      <Draw c={c} a={a} />
    </g>
  );
}

/** `lifting`: the slot of a piece being dragged off her (drawn invisible until it's let go). */
function Doll({ look, backdrop, svgRef, className, label = "your paper doll", viewBox = "-30 0 300 400", lifting = null }) {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const eyes = EYE_COLOURS[look.eyes] ?? EYE_COLOURS[0];
  const hair = hairById(look.hair?.id);
  const hairColour = HAIR_COLOURS[look.hair?.c] ?? HAIR_COLOURS[0];
  const tie = tieFor(hairColour);
  const outfit = look.outfit ?? {};
  const on = (slot) => Boolean(outfit[slot]) && lifting !== slot;
  const covered = { top: on("dress") || on("top"), bottom: on("dress") || on("bottom") };
  return (
    <svg ref={svgRef} className={className} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      {backdrop && <Backdrop id={backdrop} />}
      <Worn lifting={lifting} look={look} slot="back" />
      <g data-hair="back">{hair.back(hairColour, tie)}</g>
      <DollBody skin={skin} />
      {(!covered.top || !covered.bottom) && <DollSlip top={!covered.top} bottom={!covered.bottom} />}
      <Worn lifting={lifting} look={look} slot="socks" />
      <Worn lifting={lifting} look={look} slot="shoes" />
      <Worn lifting={lifting} look={look} slot="bottom" />
      <Worn lifting={lifting} look={look} slot="top" />
      <Worn lifting={lifting} look={look} slot="dress" />
      <Worn lifting={lifting} look={look} slot="outer" />
      <Worn lifting={lifting} look={look} slot="neck" />
      <DollArms skin={skin} />
      <Worn lifting={lifting} look={look} slot="top" part="sleeves" />
      <Worn lifting={lifting} look={look} slot="dress" part="sleeves" />
      <Worn lifting={lifting} look={look} slot="outer" part="sleeves" />
      <DollHead skin={skin} eyes={eyes} eyeStyle={look.eyeStyle} mouth={look.mouth} brow={browOf(hairColour)} />
      <Worn lifting={lifting} look={look} slot="face" />
      <g data-hair="front">{hair.front(hairColour, tie)}</g>
      <Worn lifting={lifting} look={look} slot="head" />
      <Worn lifting={lifting} look={look} slot="hand" />
    </svg>
  );
}

export default memo(Doll);
