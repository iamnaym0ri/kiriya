import { useId } from "react";
import "./bambi.css";

// Bamby's cloud: a little stage. A flat, glossy pink-lilac top to dance on, soft puffs underneath,
// and flowers along the front edge that bloom as it forms (his ability: shut your eyes, open them,
// flowers). It pulses softly on the beat while it holds him, and drops its petals as it fades.
// Pure SVG + CSS (transform/opacity only).

const HEIGHT = 30;
export const PLATFORM_SURFACE = 6; // px from the box top to where his feet stand

/** Puff centres along the cloud's underside, as fractions of the width, with radii in px. */
function puffs(width) {
  const count = Math.max(3, Math.round(width / 26));
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const edge = Math.abs(t - 0.5) * 2; // 0 in the middle, 1 at the ends
    return { x: 10 + t * (width - 20), r: 10.5 - edge * 3.5 + (i % 2) * 1.6, i };
  });
}

export default function BambyPlatform({ width = 100, state = "steady" }) {
  const raw = useId().replace(/[:«»]/g, "");
  const top = `bp${raw}-top`;
  const body = `bp${raw}-body`;
  const glow = `bp${raw}-glow`;
  const w = Math.max(48, width);
  const list = puffs(w);
  const flowers = list.filter((p) => p.i % 2 === 1 || list.length <= 3);
  return (
    <svg
      className="bamby-cloud"
      data-state={state}
      width={w}
      height={HEIGHT}
      viewBox={`0 0 ${w} ${HEIGHT}`}
      aria-hidden="true"
      style={{ "--w": `${w}px`, overflow: "visible" }}
    >
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff6fb" />
          <stop offset="1" stopColor="#fbdcec" />
        </linearGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f8dcf0" />
          <stop offset="1" stopColor="#dccbf6" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop stopColor="#ff9fcb" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff9fcb" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="bamby-cloud__all" style={{ transformOrigin: `${w / 2}px 8px` }}>
        <g className="bamby-cloud__puffs">
          {list.map((p) => (
            <circle
              key={p.i}
              className="bamby-cloud__puff"
              cx={p.x}
              cy={14}
              r={p.r}
              fill={`url(#${body})`}
              stroke="#cdb2ea"
              strokeWidth="1.2"
              style={{ "--i": Math.abs(p.i - (list.length - 1) / 2), transformOrigin: `${p.x}px 10px` }}
            />
          ))}
        </g>
        {/* The stage top: flat, so his feet have somewhere to stand, with a soft gloss. */}
        <rect className="bamby-cloud__deck" x="3" y="2" width={w - 6} height="9" rx="4.5" fill={`url(#${top})`} stroke="#e7b5d4" strokeWidth="1.1" />
        <path d={`M10 4.6h${w * 0.32}`} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
        <ellipse className="bamby-cloud__beat" cx={w / 2} cy="6" rx={Math.min(30, w * 0.32)} ry="5" fill={`url(#${glow})`} />
        {flowers.map((p, n) => (
          <g key={p.i} className="bamby-cloud__flower" style={{ "--i": n, transformOrigin: `${p.x}px 20px` }}>
            <g transform={`translate(${p.x} 20) scale(.62)`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cy="-4.6" rx="3.3" ry="4.6" fill={n % 2 ? "#fff3f9" : "#ffbad8"} stroke="#e47bab" strokeWidth=".9" transform={`rotate(${a})`} />
              ))}
              <circle r="2.3" fill="#ffe27a" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

BambyPlatform.surface = PLATFORM_SURFACE;
