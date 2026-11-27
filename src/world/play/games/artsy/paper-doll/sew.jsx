import { useId } from "react";
import { BODY, INK, along, capsule, deep, light, mix } from "./body.jsx";

// Sewing kit for the wardrobe: bodices, skirts and trousers cut to the doll's landmarks, hems with
// frills and lace, sleeves that follow her arms, fabric patterns, and soft fold shading. Every
// garment in wardrobe.jsx is put together from these, so they all share one hand.
export const ink = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" };
export const thin = { stroke: INK, strokeWidth: 1.2, strokeLinejoin: "round", strokeLinecap: "round" };
const f = (v) => Number(v).toFixed(1);

/** A pattern id unique to this drawing (many dolls render at once in the lookbook). */
export const usePid = () => `p${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

// ---------------------------------------------------------------- fabric
export function Fabric({ id, kind, c, a }) {
  if (kind === "gingham")
    return (
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={light(a, 0.85)} />
        <rect width="5" height="10" fill={a} opacity="0.35" />
        <rect width="10" height="5" fill={a} opacity="0.35" />
      </pattern>
    );
  if (kind === "plaid")
    return (
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill={c} />
        <rect x="5" width="3" height="16" fill={a} opacity="0.55" />
        <rect y="5" width="16" height="3" fill={a} opacity="0.55" />
        <rect x="12" width="1" height="16" fill={light(c, 0.6)} opacity="0.7" />
        <rect y="12" width="16" height="1" fill={light(c, 0.6)} opacity="0.7" />
      </pattern>
    );
  if (kind === "polka")
    return (
      <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill={c} />
        <circle cx="3" cy="3" r="1.8" fill={a} />
        <circle cx="9" cy="9" r="1.8" fill={a} />
      </pattern>
    );
  if (kind === "stripes")
    return (
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={c} />
        <rect width="8" height="3.2" fill={a} />
      </pattern>
    );
  if (kind === "floral")
    return (
      <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <rect width="22" height="22" fill={c} />
        {[[6, 6], [17, 16]].map(([x, y]) => (
          <g key={x}>
            {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 2.4} rx="1.6" ry="2.4" transform={`rotate(${r} ${x} ${y})`} fill={a} />)}
            <circle cx={x} cy={y} r="1.2" fill="#ffe08a" />
          </g>
        ))}
        <path d="M14 5q2-2 4 0q-2 2-4 0Z" fill="#9fcf8f" />
      </pattern>
    );
  if (kind === "hearts")
    return (
      <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill={c} />
        <path d="M4 7C1.5 5.5 1 4 1.8 3c.8-.9 2-.6 2.2.4.2-1 1.4-1.3 2.2-.4.8 1 .3 2.5-2.2 4Z" fill={a} />
        <path d="M11 13.5c-2.5-1.5-3-3-2.2-4 .8-.9 2-.6 2.2.4.2-1 1.4-1.3 2.2-.4.8 1 .3 2.5-2.2 4Z" fill={a} opacity="0.6" />
      </pattern>
    );
  if (kind === "stars")
    return (
      <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill={c} />
        <path d="M5 2l1 2.3 2.4.3-1.8 1.6.5 2.4L5 7.4 2.9 8.6l.5-2.4L1.6 4.6 4 4.3Z" fill={a} />
        <circle cx="14" cy="13" r="1" fill={a} />
      </pattern>
    );
  if (kind === "cloud")
    return (
      <pattern id={id} width="30" height="20" patternUnits="userSpaceOnUse">
        <rect width="30" height="20" fill={c} />
        <path d="M4 14q0-4 4-4q1-4 5-3q3-2 5 1q4 0 4 4q0 3-3 3H7q-3 0-3-1Z" fill={a} opacity="0.7" />
      </pattern>
    );
  return null;
}
/** The fill for a garment: its colour, or its fabric pattern. */
export const fillOf = (pattern, pid, c) => (pattern ? `url(#${pid})` : c);

// ---------------------------------------------------------------- bodices
/**
 * A bodice from the neckline down to `hem`. neck: round | crew | v | square | sweetheart | off |
 * cross (a wrap collar, crossing left over right). flare: how far the hem opens past the hips.
 */
export function bodice({ neck = "round", hem = 206, flare = 0, waist = 0 }) {
  const wl = 102.5 - waist, wr = 137.5 + waist;
  const hl = Math.min(wl, 101 - flare), hr = Math.max(wr, 139 + flare);
  const off = neck === "off";
  const left = off ? "M95 164C95.5 167 97.5 170 98.5 173" : "M109 148Q100 150 95.5 156C95 162 97 168 98.5 173";
  const down = `C100.5 184 ${f(wl)} 191 ${f(wl)} 198C${f(wl - 1)} ${f(hem - 4)} ${f(hl)} ${f(hem - 2)} ${f(hl)} ${f(hem)}Q120 ${f(hem + 4)} ${f(hr)} ${f(hem)}C${f(hr)} ${f(hem - 2)} ${f(wr + 1)} ${f(hem - 4)} ${f(wr)} 198C${f(wr)} 191 139.5 184 141.5 173`;
  if (off) return `${left}${down}C142.5 170 144.5 167 145 164Q132 170 120 169Q108 170 95 164Z`;
  const right = "C143 168 145 162 144.5 156Q140 150 131 148";
  const necks = {
    round: "Q120 164 109 148",
    crew: "Q120 156 109 148",
    v: "L120 172L109 148",
    square: "L130 161H110L109 148",
    sweetheart: "L132 162C128 160 123 160 120 165C117 160 112 160 108 162L109 148",
    cross: "L120 178L109 148",
  };
  return `${left}${down}${right}${necks[neck] ?? necks.round}Z`;
}

// ---------------------------------------------------------------- skirts and trousers
/** A skirt from the waist (`top`) to `bottom`, `wTop`/`wBot` half-widths, a curved hem. */
export function skirt({ top = 198, bottom = 250, wTop = 18, wBot = 30, curve = 6, bulge = 0.35 }) {
  const h = bottom - top;
  return `M${f(120 - wTop)} ${top}H${f(120 + wTop)}C${f(120 + wTop + (wBot - wTop) * bulge + 2)} ${f(top + h * 0.3)} ${f(120 + wBot)} ${f(bottom - h * 0.25)} ${f(120 + wBot)} ${bottom}Q120 ${f(bottom + curve * 2)} ${f(120 - wBot)} ${bottom}C${f(120 - wBot)} ${f(bottom - h * 0.25)} ${f(120 - wTop - (wBot - wTop) * bulge - 2)} ${f(top + h * 0.3)} ${f(120 - wTop)} ${top}Z`;
}
/** Where the curved hem is at x (matching skirt()'s quadratic). */
const hemY = (x, bottom, wBot, curve) => bottom + curve * (1 - ((x - 120) / wBot) ** 2);

/** A ruffle or lace band under a hem: scallops along the curve. */
export function Hem({ bottom, wBot, curve = 6, depth = 8, n = 12, c, lace = false, under = false }) {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const x = 120 - wBot - 2 + ((2 * wBot + 4) * i) / n;
    return [x, hemY(Math.min(Math.max(x, 120 - wBot), 120 + wBot), bottom, wBot, curve)];
  });
  let d = `M${f(pts[0][0])} ${f(pts[0][1] - (under ? 0 : 3))}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += `Q${f((x0 + x1) / 2)} ${f((y0 + y1) / 2 + depth * 1.9)} ${f(x1)} ${f(y1)}`;
  }
  d += `L${f(pts.at(-1)[0])} ${f(pts.at(-1)[1] - (under ? 0 : 3))}Z`;
  return (
    <g>
      <path d={d} fill={c} {...thin} />
      {pts.slice(1).map(([x, y], i) => {
        const mx = (pts[i][0] + x) / 2, my = (pts[i][1] + y) / 2;
        return lace ? (
          <circle key={i} cx={f(mx)} cy={f(my + depth * 0.55)} r="1.3" fill={deep(c, 0.18)} />
        ) : (
          <path key={i} d={`M${f(mx)} ${f(my + 1)}v${f(depth * 0.6)}`} stroke={deep(c, 0.3)} strokeOpacity="0.35" strokeWidth="1" />
        );
      })}
    </g>
  );
}

/** Soft folds down a skirt: darker wedges and one highlight. */
export function Folds({ top, bottom, wTop, wBot, c, n = 4, curve = 6 }) {
  const items = [];
  for (let i = 1; i < n; i++) {
    const k = -1 + (2 * i) / n;
    const x0 = 120 + wTop * k, x1 = 120 + wBot * k;
    items.push(<path key={i} d={`M${f(x0)} ${top + 6}Q${f(x0 + (x1 - x0) * 0.6)} ${f((top + bottom) / 2)} ${f(x1 - 3)} ${f(hemY(x1, bottom, wBot, curve) - 1)}L${f(x1 + 3)} ${f(hemY(x1, bottom, wBot, curve) - 1)}Q${f(x0 + (x1 - x0) * 0.6 + 1)} ${f((top + bottom) / 2)} ${f(x0)} ${top + 6}Z`} fill={deep(c, 0.4)} opacity="0.16" />);
  }
  items.push(<path key="hi" d={`M${f(120 - wTop * 0.5)} ${top + 8}Q${f(120 - wBot * 0.45)} ${f((top + bottom) / 2)} ${f(120 - wBot * 0.6)} ${bottom - 6}`} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />);
  return <g>{items}</g>;
}

/** Pleats: lines fanning from waist to hem. */
export function Pleats({ top, bottom, wTop, wBot, c, n = 7, curve = 6 }) {
  return (
    <g>
      {Array.from({ length: n - 1 }, (_, i) => {
        const k = -1 + (2 * (i + 1)) / n;
        const x1 = 120 + wBot * k;
        return <path key={i} d={`M${f(120 + wTop * k)} ${top + 4}L${f(x1)} ${f(hemY(x1, bottom, wBot, curve) - 1)}`} stroke={deep(c, 0.35)} strokeOpacity="0.55" strokeWidth="1.2" />;
      })}
    </g>
  );
}

/** Trousers: hem at `hem` (ankle 330, shorts ~246), `wide` opens the legs. */
export function trousers({ hem = 330, wide = 0, top = 198 }) {
  const lo = 98.5 - wide, ro = 141.5 + wide;
  const li = 118.5 - wide * 0.4, ri = 121.5 + wide * 0.4;
  return `M102 ${top}H138C140 210 142 220 142 230C${f(ro)} ${f(hem - 40)} ${f(ro - 4 + wide * 0.4)} ${f(hem - 10)} ${f(ro - 5 + wide)} ${hem}H${f(ri)}L120.5 238H119.5L${f(li)} ${hem}H${f(lo + 5 - wide)}C${f(lo + 4 - wide * 0.4)} ${f(hem - 10)} ${f(lo)} ${f(hem - 40)} 98 230C98 220 100 210 102 ${top}Z`;
}

// ---------------------------------------------------------------- sleeves
/** Sleeves on both arms. kind: puff | short | elbow | long | bell | wide | cap | offpuff. */
export function Sleeves({ kind, c, a, pid, pattern, cuff = true }) {
  const fill = fillOf(pattern, pid, c);
  return (
    <g>
      {pattern && (
        <defs>
          <Fabric id={pid} kind={pattern} c={c} a={a} />
        </defs>
      )}
      {["left", "right"].map((side) => (
        <Sleeve key={side} side={side} kind={kind} fill={fill} c={c} a={a} cuff={cuff} />
      ))}
    </g>
  );
}
function Sleeve({ side, kind, fill, c, a, cuff }) {
  const s = side === "left" ? 1 : -1;
  const { from } = BODY.arms[side];
  const angle = side === "left" ? 11 : -11;
  if (kind === "puff" || kind === "offpuff") {
    const [x, y] = along(side, kind === "offpuff" ? 0.2 : 0.1);
    return (
      <g>
        <ellipse cx={x} cy={y} rx="12.5" ry="11" transform={`rotate(${angle} ${x} ${y})`} fill={fill} {...ink} />
        <path d={`M${x - 8} ${y - 4}q3 6 0 12M${x} ${y - 9}v16M${x + 8} ${y - 4}q-3 6 0 12`} transform={`rotate(${angle} ${x} ${y})`} fill="none" stroke={deep(c, 0.35)} strokeOpacity="0.35" strokeWidth="1" />
        <path d={`M${x - 10} ${y + 8}Q${x} ${y + 12} ${x + 10} ${y + 8}`} transform={`rotate(${angle} ${x} ${y})`} fill="none" stroke={a} strokeWidth="2.6" strokeLinecap="round" />
        <ellipse cx={x - 4 * s} cy={y - 4} rx="4" ry="2.6" fill="#fff" opacity="0.45" />
      </g>
    );
  }
  if (kind === "cap") {
    const [x, y] = along(side, 0.04);
    return <path d={`M${x - 10} ${y - 2}Q${x} ${y - 9} ${x + 10} ${y - 2}Q${x + 6 * s} ${y + 10} ${x - 6 * s} ${y + 8}Z`} fill={fill} {...ink} />;
  }
  if (kind === "wide") {
    const d = side === "left" ? "M101 154C86 160 74 196 66 240C64 252 72 262 86 262C94 262 98 256 96 246L104 196Z" : "M139 154C154 160 166 196 174 240C176 252 168 262 154 262C146 262 142 256 144 246L136 196Z";
    const lining = side === "left" ? "M68 246C70 256 78 262 88 261C94 259 96 254 95 247C86 252 76 252 68 246Z" : "M172 246C170 256 162 262 152 261C146 259 144 254 145 247C154 252 164 252 172 246Z";
    return (
      <g>
        <path d={d} fill={fill} {...ink} />
        <path d={lining} fill={a} {...thin} />
        <path d={side === "left" ? "M92 172C84 196 78 220 76 244" : "M148 172C156 196 162 220 164 244"} fill="none" stroke={deep(c, 0.35)} strokeOpacity="0.35" strokeWidth="1.4" />
      </g>
    );
  }
  const reach = { short: 0.36, elbow: 0.62, long: 0.98, bell: 0.9 }[kind] ?? 0.4;
  const end = along(side, reach);
  const start = [from[0] - 1.5 * s, from[1] - 3];
  const r2 = kind === "long" ? 6.4 : kind === "elbow" ? 7.4 : 8.4;
  return (
    <g>
      <path d={capsule(start, end, 9.4, r2)} fill={fill} {...ink} />
      <path d={capsule([start[0] + 2.5 * s, start[1] + 4], [end[0] + 2 * s, end[1] - 4], 2.2, 1.4)} fill="#fff" opacity="0.25" />
      {kind === "bell" && <path d={`M${end[0] - 8} ${end[1] - 3}L${end[0] - 13} ${end[1] + 16}Q${end[0]} ${end[1] + 22} ${end[0] + 13} ${end[1] + 16}L${end[0] + 8} ${end[1] - 3}Z`} transform={`rotate(${angle} ${end[0]} ${end[1]})`} fill={fill} {...ink} />}
      {cuff && kind !== "bell" && kind !== "short" && <path d={capsule(along(side, reach - 0.08), end, r2 + 0.6, r2 + 0.6)} fill={a} {...thin} />}
      {kind === "short" && <path d={`M${end[0] - 8} ${end[1] - 2}Q${end[0]} ${end[1] + 3} ${end[0] + 8} ${end[1] - 2}`} transform={`rotate(${angle} ${end[0]} ${end[1]})`} fill="none" stroke={a} strokeWidth="2.4" strokeLinecap="round" />}
    </g>
  );
}

// ---------------------------------------------------------------- little trims
export function BowKnot({ x, y, c, s = 1, turn = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${s})`}>
      <path d="M0 0C-6-8-17-9-17-1C-17 5-8 5 0 0ZM0 0C6-8 17-9 17-1C17 5 8 5 0 0Z" fill={c} {...thin} />
      <path d="M-1.5 1.5L-6 12L-2 10.5L0 14L1.5 1.5ZM1.5 1.5L6 12L2 10.5L0 14L-1.5 1.5Z" fill={deep(c, 0.15)} {...thin} />
      <circle r="3.4" fill={light(c, 0.25)} {...thin} />
      <path d="M-12-3q2-3 5-2M7-5q3-1 5 2" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  );
}
export const Buttons = ({ x = 120, ys, c, r = 1.9 }) => (
  <g>
    {ys.map((y) => (
      <circle key={y} cx={x} cy={y} r={r} fill={c} stroke={INK} strokeWidth="0.8" />
    ))}
  </g>
);
/** A row of lace scallops along a straight edge from (x0, y) to (x1, y). */
export function LaceEdge({ x0, x1, y, c, r = 3, down = true }) {
  const n = Math.max(2, Math.round((x1 - x0) / (r * 2)));
  const step = (x1 - x0) / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <path d={`M${f(x0 + step * i)} ${y}A${f(step / 2)} ${f(step / 2)} 0 0 ${down ? 0 : 1} ${f(x0 + step * (i + 1))} ${y}`} fill={c} {...thin} strokeWidth="0.9" />
          <circle cx={f(x0 + step * (i + 0.5))} cy={f(y + (down ? 1 : -1) * step * 0.22)} r="0.8" fill={deep(c, 0.2)} />
        </g>
      ))}
    </g>
  );
}
export { mix, light, deep, INK };
