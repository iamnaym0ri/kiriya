import { memo } from "react";
import { DollArms, DollBody, DollHead, DollSlip, browOf } from "./body.jsx";
import { HAIR_COLOURS, hairById, tieFor } from "./hair.jsx";
import { Backdrop, EYE_COLOURS, SKINS, itemById } from "./wardrobe.jsx";

// The doll wearing a look, layer by layer: wings and the back of her hair, her body, socks, shoes,
// bottoms, tops, dresses, jackets, necklaces, arms and sleeves (the outermost on top), her face,
// glasses, the front of her hair, hats and bows, and whatever she's holding.

function Worn({ look, slot, part = "draw" }) {
  const worn = look.outfit?.[slot];
  const item = worn && itemById(worn.id);
  const Draw = item?.[part];
  if (!Draw) return null;
  const [c, a] = item.colors[worn.c] ?? item.colors[0];
  return (
    <g data-slot={slot} data-item={item.id}>
      <Draw c={c} a={a} />
    </g>
  );
}

function Doll({ look, backdrop, svgRef, className, label = "your paper doll", viewBox = "-30 0 300 400" }) {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const eyes = EYE_COLOURS[look.eyes] ?? EYE_COLOURS[0];
  const hair = hairById(look.hair?.id);
  const hairColour = HAIR_COLOURS[look.hair?.c] ?? HAIR_COLOURS[0];
  const tie = tieFor(hairColour);
  const outfit = look.outfit ?? {};
  const covered = { top: Boolean(outfit.dress || outfit.top), bottom: Boolean(outfit.dress || outfit.bottom) };
  return (
    <svg ref={svgRef} className={className} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      {backdrop && <Backdrop id={backdrop} />}
      <Worn look={look} slot="back" />
      <g data-hair="back">{hair.back(hairColour, tie)}</g>
      <DollBody skin={skin} />
      {(!covered.top || !covered.bottom) && <DollSlip top={!covered.top} bottom={!covered.bottom} />}
      <Worn look={look} slot="socks" />
      <Worn look={look} slot="shoes" />
      <Worn look={look} slot="bottom" />
      <Worn look={look} slot="top" />
      <Worn look={look} slot="dress" />
      <Worn look={look} slot="outer" />
      <Worn look={look} slot="neck" />
      <DollArms skin={skin} />
      <Worn look={look} slot="top" part="sleeves" />
      <Worn look={look} slot="dress" part="sleeves" />
      <Worn look={look} slot="outer" part="sleeves" />
      <DollHead skin={skin} eyes={eyes} eyeStyle={look.eyeStyle} mouth={look.mouth} brow={browOf(hairColour)} />
      <Worn look={look} slot="face" />
      <g data-hair="front">{hair.front(hairColour, tie)}</g>
      <Worn look={look} slot="head" />
      <Worn look={look} slot="hand" />
    </svg>
  );
}

export default memo(Doll);
