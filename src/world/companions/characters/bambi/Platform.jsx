import { useId } from "react";
import "./bambi.css";

// Bamby's cloud: a little stage. A flat, glossy top to dance on, a fluffy scalloped underside,
// and flowers tucked along the front that bloom as it forms (his ability: shut your eyes, open
// them, flowers). It glows softly on the beat while it holds him, and drops its petals as it fades.
// One path per layer, transform/opacity animation only.

const HEIGHT = 30;
const TOP = 5; // the deck line
export const PLATFORM_SURFACE = 6; // px from the box top to where his feet stand

function shape(w) {
  const n = Math.max(2, Math.round((w - 16) / 22));
  const step = (w - 16) / n;
  let d = `M14 ${TOP}H${w - 14}C${w - 3} ${TOP - 2} ${w + 2} ${13} ${w - 8} 19`;
  const bumps = [];
  for (let i = 0; i < n; i += 1) {
    const x0 = w - 8 - i * step;
    const x1 = x0 - step;
    const mid = (x0 + x1) / 2;
    const dip = 9 + (i % 2) * 2.5;
    d += `Q${mid.toFixed(1)} ${19 + dip} ${x1.toFixed(1)} 19`;
    bumps.push({ x0, x1, mid, dip, i });
  }
  d += `C-2 13 3 ${TOP - 2} 14 ${TOP}Z`;
  return { d, bumps };
}

export default function BambyPlatform({ width = 100, state = "steady" }) {
  const raw = useId().replace(/[:«»]/g, "");
  const fill = `bp${raw}-fill`;
  const glow = `bp${raw}-glow`;
  const w = Math.max(48, Math.round(width));
  const { d, bumps } = shape(w);
  const flowers = bumps.filter((b) => b.i % 2 === 0);
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
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff7fb" />
          <stop offset=".3" stopColor="#fde4f1" />
          <stop offset="1" stopColor="#e2d1fa" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop stopColor="#ff8fc2" stopOpacity=".5" />
          <stop offset="1" stopColor="#ff8fc2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="bamby-cloud__all">
        <path className="bamby-cloud__shape" d={d} fill={`url(#${fill})`} stroke="#d5b5e9" strokeWidth="1.3" strokeLinejoin="round" />
        {/* Volume: a soft inner arc in each scallop, and the deck's gloss. */}
        <g stroke="#fff" strokeLinecap="round" fill="none">
          {bumps.map((b) => (
            <path key={b.i} d={`M${(b.x0 - 4).toFixed(1)} 19.5Q${b.mid.toFixed(1)} ${(19 + b.dip * 0.62).toFixed(1)} ${(b.x1 + 4).toFixed(1)} 19.5`} strokeWidth="1.4" opacity=".55" />
          ))}
          <path d={`M16 ${TOP + 2.4}H${(w * 0.46).toFixed(1)}`} strokeWidth="2" opacity=".95" />
          <path d={`M${(w * 0.54).toFixed(1)} ${TOP + 2.4}H${(w * 0.62).toFixed(1)}`} strokeWidth="2" opacity=".7" />
        </g>
        <path d={`M8 ${TOP + 7}H${w - 8}`} stroke="#f2c6dd" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" opacity=".9" />
        <ellipse className="bamby-cloud__beat" cx={w / 2} cy={TOP + 1} rx={Math.min(32, w * 0.34)} ry="5" fill={`url(#${glow})`} />
        {flowers.map((b, n) => (
          <g key={b.i} className="bamby-cloud__flower" style={{ "--i": n, transformOrigin: `${b.mid}px 20px` }}>
            <g transform={`translate(${b.mid.toFixed(1)} 20) scale(.66)`}>
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
