// The capsule machine's pictures: capsules and the machine itself, drawn for this game in the
// site's hand-drawn lilac style.
const INK = "#4a2f57";

export const CAPSULE_COLOURS = {
  lilac: { base: "#c9a8f5", deep: "#a983e0", dots: null },
  pink: { base: "#ff9fc6", deep: "#ef78a9", dots: null },
  mint: { base: "#97dcc8", deep: "#6fc2ab", dots: null },
  butter: { base: "#ffdc7d", deep: "#f2c04f", dots: null },
  berry: { base: "#d77bc0", deep: "#b85aa2", dots: "#ffe3f2" },
  gold: { base: "#ffcf4d", deep: "#e7a92a", dots: "#fff6c9" },
  heart: { base: "#ff7fb3", deep: "#e65895", dots: "#fff" },
};

/** One capsule centred on (0, 0), radius r: a clear top half and a coloured bottom half. */
export function CapsuleShape({ colour = "lilac", r = 20, id = "c" }) {
  const c = CAPSULE_COLOURS[colour] ?? CAPSULE_COLOURS.lilac;
  return (
    <g>
      <path d={`M${-r} 0a${r} ${r} 0 0 1 ${2 * r} 0z`} fill="#f7f1ff" fillOpacity=".92" />
      <path d={`M${-r} 0h${2 * r}a${r} ${r} 0 0 1 ${-2 * r} 0z`} fill={c.base} />
      {c.dots && (
        colour === "heart"
          ? <path d={`M${-r * 0.2} ${r * 0.42}c-.9-1.4-3.2-1-3.1.7.1 1.1 3.1 2.6 3.1 2.6s3-1.5 3.1-2.6c.1-1.7-2.2-2.1-3.1-.7z`} fill={c.dots} transform={`scale(${r / 20})`} />
          : <g fill={c.dots}>
              <circle cx={-r * 0.45} cy={r * 0.38} r={r * 0.1} />
              <circle cx={r * 0.15} cy={r * 0.62} r={r * 0.09} />
              <circle cx={r * 0.5} cy={r * 0.3} r={r * 0.08} />
            </g>
      )}
      <path d={`M${-r * 0.78} ${r * 0.2}a${r * 0.82} ${r * 0.82} 0 0 0 ${r * 0.5} ${r * 0.55}`} stroke={c.deep} strokeWidth={r * 0.12} fill="none" strokeLinecap="round" opacity=".7" />
      <circle r={r} fill="none" stroke={INK} strokeWidth={Math.max(1.6, r * 0.09)} />
      <path d={`M${-r} 0h${2 * r}`} stroke={INK} strokeWidth={Math.max(1.6, r * 0.09)} />
      <path d={`M${-r * 0.55} ${-r * 0.45}a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.45} ${-r * 0.3}`} stroke="#fff" strokeWidth={r * 0.13} strokeLinecap="round" fill="none" id={id} />
    </g>
  );
}

/** A capsule as its own picture, its halves separate so it can pop open. */
export function CapsuleSvg({ colour = "lilac", className = "" }) {
  const c = CAPSULE_COLOURS[colour] ?? CAPSULE_COLOURS.lilac;
  const r = 40;
  return (
    <svg className={`capsule-svg ${className}`} viewBox="-46 -46 92 92" aria-hidden="true">
      {(colour === "gold" || colour === "heart") && <circle r="45" fill={colour === "gold" ? "#ffe9a8" : "#ffd3e6"} opacity=".55" className="capsule-svg__glow" />}
      <g className="capsule-svg__bottom">
        <path d={`M${-r} 1h${2 * r}a${r} ${r} 0 0 1 ${-2 * r} 0z`} fill={c.base} stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
        {c.dots && colour !== "heart" && (
          <g fill={c.dots}><circle cx="-18" cy="16" r="4" /><circle cx="6" cy="26" r="3.6" /><circle cx="21" cy="12" r="3.2" /></g>
        )}
        {colour === "heart" && (
          <g fill="#fff">
            {[[-18, 15], [8, 26], [22, 10]].map(([x, y]) => (
              <path key={x} transform={`translate(${x} ${y})`} d="M0 3c-2.5-1.8-4.4-3.4-4.4-5 0-1.3 1-2.2 2.2-2.2.9 0 1.7.5 2.2 1.2.5-.7 1.3-1.2 2.2-1.2 1.2 0 2.2.9 2.2 2.2 0 1.6-1.9 3.2-4.4 5z" />
            ))}
          </g>
        )}
        <path d="M-31 9a32 32 0 0 0 20 22" stroke={c.deep} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".7" />
      </g>
      <g className="capsule-svg__top">
        <path d={`M${-r} -1a${r} ${r} 0 0 1 ${2 * r} 0z`} fill="#f7f1ff" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M-40 -1h80" stroke={INK} strokeWidth="4" />
        <path d="M-22 -18a28 28 0 0 1 18 -13" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M-8 -14c-2-4-8-3-7 1 1 3 7 6 7 6s6-3 7-6c1-4-5-5-7-1z" fill={c.base} opacity=".55" />
      </g>
      {colour === "gold" && (
        <g fill="#fff" className="capsule-svg__twinkle">
          <path d="M30-34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M-36 26l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" />
        </g>
      )}
    </svg>
  );
}

// ---------- the machine ----------
// viewBox 0 -18 300 458 (the heart on top pokes above 0). Dome centred on (150, 132); crank on (150, 318); chute mouth at (150, 386).
export const MACHINE = { top: -18, width: 300, height: 458, dome: { cx: 150, cy: 132, r: 106 }, crank: { cx: 150, cy: 318, r: 40 }, chute: { x: 150, y: 386 } };

export function MachineBack() {
  return (
    <>
      <ellipse cx="150" cy="430" rx="118" ry="8" fill="#5b3d6b" opacity=".12" />
      {/* feet */}
      <rect x="66" y="410" width="34" height="18" rx="7" fill="#a983e0" stroke={INK} strokeWidth="3" />
      <rect x="200" y="410" width="34" height="18" rx="7" fill="#a983e0" stroke={INK} strokeWidth="3" />
      {/* body */}
      <rect x="44" y="246" width="212" height="172" rx="28" fill="#dcc8f1" stroke={INK} strokeWidth="3.4" />
      <path d="M56 260c0-6 5-10 12-10h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M48 380h204v10c0 15-12 26-27 26H75c-15 0-27-11-27-26z" fill="#c9aeea" />
      {[[70, 300], [230, 300], [70, 346], [230, 346], [86, 323], [214, 323]].map(([x, y]) => (
        <path key={`${x}${y}`} transform={`translate(${x} ${y})`} d="M0-4c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4z" fill="#fff" opacity=".85" />
      ))}
      <rect x="44" y="246" width="212" height="172" rx="28" fill="none" stroke={INK} strokeWidth="3.4" />
      {/* label */}
      <rect x="92" y="258" width="116" height="22" rx="11" fill="#fff9fd" stroke={INK} strokeWidth="2.4" />
      <text x="150" y="273.5" textAnchor="middle" fontSize="10.5" fill="#6b4a7a" fontFamily="DotGothic16, monospace" letterSpacing="1">✿ CHARMS ✿</text>
      {/* chute */}
      <rect x="112" y="368" width="76" height="38" rx="14" fill="#6b4a7a" stroke={INK} strokeWidth="3" />
      <rect x="120" y="374" width="60" height="26" rx="10" fill="#3d2649" />
    </>
  );
}

export function ChuteFlap({ open }) {
  return (
    <path className="capsule-flap" data-open={open} d="M120 374h60v12c0 3-2 5-5 5h-50c-3 0-5-2-5-5z" fill="#cdb3ea" stroke={INK} strokeWidth="2.4" />
  );
}

export function DomeGlass({ children, napping }) {
  const { cx, cy, r } = MACHINE.dome;
  return (
    <>
      {/* collar */}
      <path d="M54 226h192v14c0 9-7 14-16 14H70c-9 0-16-5-16-14z" fill="#b78be0" stroke={INK} strokeWidth="3.2" />
      {/* glass */}
      <circle cx={cx} cy={cy} r={r + 6} fill="#efe4fb" stroke={INK} strokeWidth="3.4" />
      <clipPath id="capsule-dome-clip"><circle cx={cx} cy={cy} r={r} /></clipPath>
      <circle cx={cx} cy={cy} r={r} fill="#f8f2ff" />
      <ellipse cx={cx} cy={cy + r - 6} rx="22" ry="7" fill="#d9c3ea" />
      <g clipPath="url(#capsule-dome-clip)">
        <g transform={`translate(${cx} ${cy})`}>{children}</g>
      </g>
      <path d={`M${cx - 76} ${cy - 40}a${r - 18} ${r - 18} 0 0 1 52 -46`} stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".75" />
      <path d={`M${cx - 86} ${cy - 6}a${r - 10} ${r - 10} 0 0 1 3 -14`} stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".7" />
      <path d={`M${cx + 78} ${cy + 34}a${r - 14} ${r - 14} 0 0 1 -20 26`} stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".45" />
      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={INK} strokeWidth="3.4" />
      {/* topper: a little cap and a heart */}
      <rect x="130" y="13" width="40" height="13" rx="6.5" fill="#b78be0" stroke={INK} strokeWidth="3" />
      <path d="M150 8c-4-7-15-6-14 1 0 5 9 8 14 10 5-2 14-5 14-10 1-7-10-8-14-1z" fill="#ff9fc6" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" transform="translate(0 -9)" />
      {napping && (
        <g className="capsule-nap-sign">
          <path d="M120 54l30-16 30 16" stroke={INK} strokeWidth="2" fill="none" />
          <rect x="102" y="54" width="96" height="40" rx="10" fill="#fff9fd" stroke={INK} strokeWidth="2.6" transform="rotate(-4 150 74)" />
          <text x="150" y="72" textAnchor="middle" fontSize="15" fill="#6b4a7a" fontFamily="Gaegu, cursive" fontWeight="700" transform="rotate(-4 150 74)">napping</text>
          <text x="150" y="87" textAnchor="middle" fontSize="11" fill="#9b6091" fontFamily="Gaegu, cursive" transform="rotate(-4 150 74)">back tomorrow ♡</text>
        </g>
      )}
    </>
  );
}

export function Crank() {
  const { cx, cy, r } = MACHINE.crank;
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 4} fill="#c9aeea" stroke={INK} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r - 4} fill="#fffaf2" stroke={INK} strokeWidth="2.6" />
      <rect x={cx - r + 4} y={cy - 9} width={2 * r - 8} height="18" rx="9" fill="#ff9fc6" stroke={INK} strokeWidth="3" />
      <path d={`M${cx - r + 12} ${cy - 3}h18`} stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      <path d={`M${cx} ${cy + 4}c-2.4-3.4-7.6-2.2-7-1 .6-2.4 0 0 0 0-.4-3 4.4-4.4 7-1.4 2.6-3 7.4-1.6 7 1.4-.6 3.2-7 6.4-7 6.4z`} fill="none" />
      <circle cx={cx} cy={cy} r="7" fill="#b78be0" stroke={INK} strokeWidth="2.4" />
    </>
  );
}

/** A dashed arrow curling round the crank: "turn me". */
export function CrankHint({ show }) {
  const { cx, cy, r } = MACHINE.crank;
  const R = r + 13;
  const a0 = -0.95;
  const a1 = 1.25;
  const p = (a) => `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`;
  const tip = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
  // The arrowhead points along the circle, clockwise: two short strokes back from the tip.
  const back = Math.atan2(-Math.cos(a1), Math.sin(a1));
  const wing = (turn) => `${(tip.x + 9 * Math.cos(back + turn)).toFixed(1)} ${(tip.y + 9 * Math.sin(back + turn)).toFixed(1)}`;
  return (
    <g className="capsule-crank-hint" data-show={show}>
      <path d={`M${p(a0)}A${R} ${R} 0 0 1 ${p(a1)}`} fill="none" stroke="#9b6091" strokeWidth="2.6" strokeDasharray="5 6" strokeLinecap="round" />
      <path d={`M${wing(0.55)}L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${wing(-0.55)}`} fill="none" stroke="#9b6091" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
