import { Backdrop, DollArms, DollBody, DollHead, DollSlip, EYES, HAIR_COLOURS, SKINS, hairById, itemById } from "./wardrobe.jsx";

function Worn({ look, slot, part = "draw" }) {
  const worn = look.outfit?.[slot];
  const item = worn && itemById(worn.id);
  const Draw = item?.[part];
  if (!Draw) return null;
  const [c, a] = item.colors[worn.c] ?? item.colors[0];
  return (
    <g data-slot={part === "draw" ? slot : undefined} data-item={item.id}>
      <Draw c={c} a={a} />
    </g>
  );
}

/** The doll wearing a look. viewBox covers the doll with a little room around her. */
export default function Doll({ look, backdrop, svgRef, className, label = "your paper doll" }) {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const eyes = EYES[look.eyes] ?? EYES[0];
  const hair = hairById(look.hair?.id);
  const hairColour = HAIR_COLOURS[look.hair?.c] ?? HAIR_COLOURS[0];
  const tie = hairColour === "#f3a6c4" ? "#b79be0" : "#f6a9c7";
  const outfit = look.outfit ?? {};
  const slip = !outfit.dress && !(outfit.top && outfit.bottom);
  return (
    <svg ref={svgRef} className={className} viewBox="-30 0 300 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      {backdrop && <Backdrop id={backdrop} />}
      <Worn look={look} slot="back" />
      <g data-hair="back">{hair.back(hairColour, tie)}</g>
      <DollBody skin={skin} />
      {slip && <DollSlip />}
      <Worn look={look} slot="socks" />
      <Worn look={look} slot="shoes" />
      <Worn look={look} slot="bottom" />
      <Worn look={look} slot="top" />
      <Worn look={look} slot="dress" />
      <DollArms skin={skin} />
      <Worn look={look} slot="top" part="sleeves" />
      <Worn look={look} slot="dress" part="sleeves" />
      <DollHead skin={skin} eyes={eyes} />
      <Worn look={look} slot="neck" />
      <g data-hair="front">{hair.front(hairColour, tie)}</g>
      <Worn look={look} slot="head" />
      <Worn look={look} slot="hand" />
    </svg>
  );
}
