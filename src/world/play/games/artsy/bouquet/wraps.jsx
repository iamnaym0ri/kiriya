import { useId } from "react";
import { deep, light, mix } from "./colour.js";
import { INK } from "./flowers.jsx";

// Wrapping papers and ribbons, drawn in bouquet space (300 × 400, the stems gather at the tie,
// 150 × 300). A wrap has a back sheet (behind every flower) and a front sheet (over the stems); a
// ribbon is tied over the front at the tie. Patterns get ids unique to each drawing, because the
// shelf shows many bouquets at once.
const ink = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" };
const useUid = () => `w${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

// ---------------------------------------------------------------- shapes
const BACK = "M150 324L20 116C34 92 52 88 66 98C76 70 104 62 120 80C132 54 168 54 180 80C196 62 224 70 234 98C248 88 266 92 280 116Z";
const BACK_FRILL = "M150 324L16 120C20 104 32 98 42 104C40 88 54 80 66 88C66 72 82 64 94 74C98 58 116 54 126 68C134 52 156 50 164 66C172 52 192 54 198 70C210 62 226 68 228 84C242 78 256 88 254 104C266 102 280 110 284 120Z";
const FRONT = "M44 212C86 244 118 236 150 248C182 236 214 244 256 212L170 304L180 396H120L130 304Z";
const FRONT_LEFT = "M44 212C86 244 118 236 150 248L150 304H130Z";
const LIP = "M44 212C86 244 118 236 150 248C182 236 214 244 256 212";

/** The lip's scallops for lace (small half-circles along the top edge). */
function laceEdge() {
  const points = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    // Follow the lip roughly: two gentle curves meeting low in the middle.
    const x = 44 + 212 * t;
    const y = t < 0.5 ? 212 + (248 - 212) * Math.sin(t * Math.PI) * 0.92 : 212 + (248 - 212) * Math.sin(t * Math.PI) * 0.92;
    points.push([x, y]);
  }
  return points;
}
const LACE = laceEdge();

function Pattern({ kind, id, c, a }) {
  if (kind === "polka")
    return (
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
        <rect width="16" height="16" fill={c} />
        <circle cx="4" cy="4" r="2.6" fill={a} />
        <circle cx="12" cy="12" r="2.6" fill={a} />
      </pattern>
    );
  if (kind === "gingham")
    return (
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <rect width="16" height="16" fill={light(a, 0.82)} />
        <rect width="8" height="16" fill={a} opacity="0.32" />
        <rect width="16" height="8" fill={a} opacity="0.32" />
      </pattern>
    );
  if (kind === "news")
    return (
      <pattern id={id} width="44" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
        <rect width="44" height="36" fill={c} />
        {[4, 9, 14, 19, 24].map((y, i) => <rect key={y} x={i === 0 ? 2 : 2} y={y} width={i === 0 ? 24 : 38 - (i % 2) * 8} height={i === 0 ? 3 : 1.6} rx="0.8" fill={i === 0 ? "#6b5a72" : "#9f93a6"} opacity={i === 0 ? 0.55 : 0.5} />)}
        <path d="M33 31c-3-2-4.5-4-3.5-5.5.8-1 2.3-.8 3.5.6 1.2-1.4 2.7-1.6 3.5-.6 1 1.5-.5 3.5-3.5 5.5Z" fill={a} />
      </pattern>
    );
  if (kind === "hearts")
    return (
      <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
        <rect width="22" height="22" fill={c} />
        <path d="M6 9C2 6.5 1 4.5 2.2 3c1-1.2 2.7-.9 3.8.5 1.1-1.4 2.8-1.7 3.8-.5C11 4.5 10 6.5 6 9Z" fill={a} />
        <path d="M17 20c-4-2.5-5-4.5-3.8-6 1-1.2 2.7-.9 3.8.5 1.1-1.4 2.8-1.7 3.8-.5 1.2 1.5.2 3.5-3.8 6Z" fill={a} opacity="0.6" />
      </pattern>
    );
  return null;
}

/** How each paper fills its sheets: a flat colour, or its pattern. */
function papers(kind, id, c, a) {
  const patterned = ["polka", "gingham", "news", "hearts"].includes(kind);
  return { front: patterned ? `url(#${id})` : c, back: patterned ? `url(#${id})` : c };
}

export const WRAPS = [
  { id: "kraft", name: "kraft paper", colors: [["#d8b48c", "#b88a5e"], ["#e6cdb0", "#c49e78"], ["#c9a07a", "#9c7350"]] },
  { id: "tissue", name: "tissue", colors: [["#e9dcff", "#c9b1ee"], ["#ffdbe8", "#f6a9c7"], ["#fff3dc", "#f2d49a"], ["#d9f2ea", "#a9dcc8"]] },
  { id: "polka", name: "polka dots", colors: [["#fbe3ee", "#ffffff"], ["#e8dcff", "#ffffff"], ["#fffaf0", "#f6a9c7"], ["#5d3f78", "#f3d9ff"]] },
  { id: "lace", name: "lace", colors: [["#fffaf5", "#f6e8f0"], ["#f8eefc", "#ffffff"], ["#fff0f5", "#ffffff"]] },
  { id: "gingham", name: "gingham", colors: [["#fffaf5", "#f59ab9"], ["#fffaf5", "#b39ae6"], ["#fffaf5", "#8cc4a8"], ["#fffaf5", "#8fb3e8"]] },
  { id: "cellophane", name: "cellophane", colors: [["#ffffff", "#e9dcff"], ["#fff0f6", "#ffd1e3"], ["#f0fbff", "#cdeaf5"]] },
  { id: "news", name: "newsprint", colors: [["#f4efe4", "#e8577f"], ["#f1ece6", "#9a6cc8"], ["#efe9dc", "#6aa889"]] },
  { id: "hearts", name: "love letters", colors: [["#fff1f6", "#f59ab9"], ["#f4ecff", "#b38ad9"], ["#fffaf0", "#e8577f"]] },
];
export const wrapById = (id) => WRAPS.find((wrap) => wrap.id === id) ?? WRAPS[0];

export function WrapBack({ wrap }) {
  const uid = useUid();
  const kind = wrapById(wrap?.id).id;
  const [c, a] = wrapById(kind).colors[wrap?.c ?? 0] ?? wrapById(kind).colors[0];
  const fill = papers(kind, uid, c, a);
  if (kind === "cellophane")
    return (
      <g>
        <path d={BACK} transform="rotate(-9 150 320) scale(1.04) translate(-6 -4)" fill={a} fillOpacity="0.28" stroke={deep(a, 0.4)} strokeOpacity="0.55" strokeWidth="1.2" />
        <path d={BACK} transform="rotate(8 150 320)" fill={c} fillOpacity="0.3" stroke={deep(a, 0.4)} strokeOpacity="0.55" strokeWidth="1.2" />
        <path d="M48 128L120 250M232 120L184 230M70 112L98 160" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  if (kind === "tissue")
    return (
      <g>
        <path d={BACK_FRILL} transform="rotate(-10 150 320)" fill={a} {...ink} strokeWidth="1.2" />
        <path d={BACK_FRILL} transform="rotate(9 150 320)" fill={mix(c, a, 0.4)} {...ink} strokeWidth="1.2" />
        <path d={BACK_FRILL} fill={c} {...ink} />
        <path d="M60 104L120 230M150 64V220M238 100L180 228" stroke={deep(c, 0.25)} strokeOpacity="0.25" strokeWidth="1.2" />
      </g>
    );
  return (
    <g>
      <defs>
        <Pattern kind={kind} id={uid} c={c} a={a} />
      </defs>
      <path d={BACK} transform="rotate(-8 150 320)" fill={kind === "kraft" ? a : deep(c, 0.08)} {...ink} />
      <path d={BACK} fill={fill.back} {...ink} />
      <path d={BACK} fill={deep(c, 0.4)} opacity="0.12" />
      {kind === "kraft" && <path d="M56 104L104 196M150 60L146 170M242 102L196 190M96 76L118 132" stroke={deep(c, 0.3)} strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />}
      {kind === "lace" && <path d={BACK} fill="none" stroke={a} strokeWidth="5" strokeDasharray="1 7" strokeLinecap="round" />}
    </g>
  );
}

export function WrapFront({ wrap }) {
  const uid = useUid();
  const kind = wrapById(wrap?.id).id;
  const [c, a] = wrapById(kind).colors[wrap?.c ?? 0] ?? wrapById(kind).colors[0];
  const fill = papers(kind, uid, c, a);
  if (kind === "cellophane")
    return (
      <g>
        <path d={FRONT} fill={c} fillOpacity="0.32" stroke={deep(a, 0.4)} strokeOpacity="0.6" strokeWidth="1.2" />
        <path d="M70 226L138 300M210 228L166 288M140 330L136 384" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
        <path d={LIP} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2" />
      </g>
    );
  return (
    <g>
      <defs>
        <Pattern kind={kind} id={uid} c={c} a={a} />
      </defs>
      <path d={FRONT} fill={kind === "tissue" ? mix(c, a, 0.25) : fill.front} {...ink} />
      <path d={FRONT_LEFT} fill={deep(c, 0.45)} opacity="0.13" />
      <path d="M150 248L150 304M130 304L122 396M170 304L178 396" stroke={deep(c, 0.4)} strokeOpacity="0.3" strokeWidth="1.2" />
      <path d="M60 222C92 240 120 236 150 246" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
      {kind === "tissue" && <path d="M44 212C60 226 66 214 80 228C92 220 100 236 112 232C124 238 134 236 150 248C166 236 176 238 188 232C200 236 208 220 220 228C234 214 240 226 256 212" fill="none" stroke={a} strokeWidth="2.2" />}
      {kind === "kraft" && <path d="M80 232L134 296M220 232L166 292M150 320V380" stroke={deep(c, 0.3)} strokeOpacity="0.35" strokeWidth="1.2" />}
      {kind === "lace" && (
        <g>
          {LACE.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y - 1} r="5.6" fill={c} stroke={INK} strokeWidth="1" />
              <circle cx={x} cy={y - 2.4} r="1.5" fill={deep(c, 0.18)} />
            </g>
          ))}
          <path d={LIP} fill="none" stroke={deep(c, 0.25)} strokeWidth="1" strokeDasharray="2 3" transform="translate(0 9)" />
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- ribbons
export const RIBBONS = [
  { id: "satin", name: "satin bow", colors: ["#f59ab9", "#b38ad9", "#fffaf5", "#e8577f", "#8fb3e8", "#5d3f78"] },
  { id: "tails", name: "long tails", colors: ["#c9a8f0", "#f6a9c7", "#fff0c9", "#a9dcc8"] },
  { id: "velvet", name: "velvet", colors: ["#7b2d5b", "#4a2f63", "#b7334f", "#2f4a6b"] },
  { id: "lace-bow", name: "lace bow", colors: ["#fffaf5", "#ffe3ef", "#efe2ff"] },
  { id: "twine", name: "twine", colors: ["#c9a46a", "#e8d6b0", "#d98aa6"] },
  { id: "pearls", name: "pearl string", colors: ["#fffaf2", "#ffe3ef", "#efe2ff"] },
];
export const ribbonById = (id) => RIBBONS.find((ribbon) => ribbon.id === id) ?? RIBBONS[0];

const LOOP_L = "M150 302C134 286 108 280 104 292C100 304 126 312 150 304Z";
const LOOP_R = "M150 302C166 286 192 280 196 292C200 304 174 312 150 304Z";
const TAIL_L = "M146 306C140 322 132 336 124 352L134 350L138 360C142 344 148 324 152 308Z";
const TAIL_R = "M154 306C160 322 168 336 176 352L166 350L162 360C158 344 152 324 148 308Z";

export function Ribbon({ ribbon }) {
  const kind = ribbonById(ribbon?.id).id;
  const c = ribbonById(kind).colors[ribbon?.c ?? 0] ?? ribbonById(kind).colors[0];
  const d = deep(c, 0.3), l = light(c, 0.55);
  // A band around the bundle first, then the bow.
  const band = <path d="M130 296C142 302 158 302 170 296L171 306C158 312 142 312 129 306Z" fill={c} {...ink} />;
  if (kind === "twine")
    return (
      <g>
        {[296, 300, 304, 308].map((y, i) => <path key={y} d={`M${129 - i * 0.2} ${y}C142 ${y + 5} 158 ${y + 5} ${171 + i * 0.2} ${y}`} fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />)}
        {[296, 300, 304, 308].map((y, i) => <path key={`t${y}`} d={`M${129 - i * 0.2} ${y}C142 ${y + 5} 158 ${y + 5} ${171 + i * 0.2} ${y}`} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />)}
        <path d="M150 306C142 296 130 296 132 304C134 310 144 308 150 306ZM150 306C158 296 170 296 168 304C166 310 156 308 150 306Z" fill="none" stroke={INK} strokeWidth="3.4" />
        <path d="M150 306C142 296 130 296 132 304C134 310 144 308 150 306ZM150 306C158 296 170 296 168 304C166 310 156 308 150 306Z" fill="none" stroke={c} strokeWidth="1.8" />
        <path d="M150 306C146 318 140 328 136 338M150 306C154 318 160 330 164 336" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M150 306C146 318 140 328 136 338M150 306C154 318 160 330 164 336" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    );
  if (kind === "pearls")
    return (
      <g>
        {band}
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          const x = 131 + 38 * t, y = 300 + Math.sin(t * Math.PI) * 5;
          return <circle key={i} cx={x} cy={y} r="3.4" fill={l} stroke={INK} strokeWidth="0.9" />;
        })}
        {Array.from({ length: 7 }, (_, i) => (
          <g key={`d${i}`}>
            <circle cx={150 - i * 1.6} cy={310 + i * 6} r="3" fill={c} stroke={INK} strokeWidth="0.9" />
            <circle cx={150 + i * 2.2} cy={310 + i * 5.4} r="3" fill={c} stroke={INK} strokeWidth="0.9" />
          </g>
        ))}
        <circle cx="150" cy="303" r="5.6" fill={c} stroke={INK} strokeWidth="1.2" />
        <circle cx="148.4" cy="301.4" r="1.6" fill="#fff" />
      </g>
    );
  const big = kind === "velvet" ? 1.15 : 1;
  const tails =
    kind === "tails" ? (
      <g>
        <path d="M146 306C136 330 150 346 138 368C130 382 140 392 134 398L142 396C150 386 140 378 148 366C160 346 146 330 154 308Z" fill={c} {...ink} />
        <path d="M154 306C166 328 152 344 164 362C172 376 162 388 170 396L162 396C154 386 164 376 156 364C144 346 158 330 148 308Z" fill={mix(c, d, 0.25)} {...ink} />
      </g>
    ) : (
      <g>
        <path d={TAIL_L} fill={c} {...ink} />
        <path d={TAIL_R} fill={mix(c, d, 0.25)} {...ink} />
      </g>
    );
  return (
    <g>
      {band}
      {tails}
      <g transform={`translate(150 302) scale(${big}) translate(-150 -302)`}>
        <path d={LOOP_L} fill={c} {...ink} />
        <path d={LOOP_R} fill={c} {...ink} />
        <path d="M150 303C138 298 120 292 112 294C120 298 136 302 150 304Z" fill={d} opacity="0.35" />
        <path d="M150 303C162 298 180 292 188 294C180 298 164 302 150 304Z" fill={d} opacity="0.35" />
        {kind !== "velvet" && <path d="M112 290C118 286 128 286 136 290M164 290C172 286 182 286 188 290" fill="none" stroke={l} strokeWidth="2" strokeLinecap="round" />}
        {kind === "lace-bow" && (
          <g fill="none" stroke={deep(c, 0.2)} strokeWidth="1" strokeDasharray="1.4 2.6">
            <path d="M107 292C112 284 128 286 140 294M193 292C188 284 172 286 160 294" />
          </g>
        )}
        <ellipse cx="150" cy="303" rx="7" ry="6.4" fill={kind === "velvet" ? c : mix(c, d, 0.15)} {...ink} />
        <path d="M147 300C149 299 151 299 153 300" stroke={l} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

/** The little card tag hanging from the ribbon (its words are drawn by the game). */
export const CARD_BOX = { x: 166, y: 318, w: 74, h: 34, turn: 8 };
export function CardTag({ text, colour = "#fffdf8" }) {
  const { x, y, w, h, turn } = CARD_BOX;
  return (
    <g transform={`rotate(${turn} ${x} ${y})`}>
      <path d={`M154 306C158 312 ${x + 4} ${y - 2} ${x + 10} ${y + 6}`} fill="none" stroke="#b49a7a" strokeWidth="1" />
      <rect x={x} y={y} width={w} height={h} rx="5" fill={colour} {...ink} strokeWidth="1.2" />
      <circle cx={x + 10} cy={y + 7} r="2.2" fill="#fff" stroke={INK} strokeWidth="0.9" />
      <path d={`M${x + 6} ${y + h - 5}H${x + w - 6}`} stroke="#ead9e6" strokeWidth="1" />
      {text && (
        <text x={x + w / 2 + 4} y={y + h / 2 + 5} textAnchor="middle" fill="#5d3f78" fontSize={text.length > 12 ? 11 : 13} data-card-text style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}>
          {text}
        </text>
      )}
    </g>
  );
}
