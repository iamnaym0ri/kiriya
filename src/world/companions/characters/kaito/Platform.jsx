import { memo, useId } from "react";
import "./kaito.css";

// KAITO's cloud: a little cloud made of ice-cream scoops (soda blue, vanilla, and one lilac for
// her) on a frosty base with a melty drip rim. It forms by scoops plopping in one after another,
// sparkles with frost while he's on it, and melts away behind him.
//
// The box is `width` × HEIGHT px; the engine anchors its top centre at his feet minus `surface`,
// so the tops of the scoops rise around his boots like soft-serve.
const HEIGHT = 34;
const SURFACE = 9;
const VANILLA = { fill: "#fff4da", line: "#d9b984", glint: "#ffffff" };
const SODA = { fill: "#bfe6fa", line: "#6fafd8", glint: "#effaff" };
const MINT = { fill: "#cdf1e2", line: "#7cc2a5", glint: "#f2fffa" };
const LILAC = { fill: "#e2d0f8", line: "#a98ad1", glint: "#f8f2ff" };
const CYCLE = [VANILLA, SODA, VANILLA, MINT, SODA];

/** Where the scoops, drips and sparkles go for a given width: the same width always looks the same. */
function layout(width) {
  const w = Math.max(40, Math.round(width));
  const n = Math.max(3, Math.round((w - 14) / 12) + 1);
  const step = (w - 14) / (n - 1);
  const middle = Math.floor(n / 2);
  const scoops = Array.from({ length: n }, (_, i) => {
    const r = [7.4, 6.6, 7.8, 6.8, 7.2][i % 5];
    const colour = i === middle ? LILAC : CYCLE[i % CYCLE.length];
    return { x: 7 + i * step, y: 11.5 + (i % 2) * 1.6, r, colour, back: i % 2 === 0, order: Math.abs(i - middle) };
  });
  // Back row first, front row over it: a little heap rather than a fence.
  scoops.sort((p, q) => Number(q.back) - Number(p.back));
  const bumps = Math.max(3, Math.round((w - 6) / 13));
  const span = (w - 6) / bumps;
  let underside = `M${w - 3} 17`;
  for (let i = 0; i < bumps; i += 1) {
    const x0 = w - 3 - i * span;
    const x1 = x0 - span;
    underside += `Q${(x0 + x1) / 2} ${23.5 + (i % 2)} ${x1} 19.2`;
  }
  const base = `M6 9.5H${w - 6}Q${w - 1} 9.5 ${w - 1.5} 13.5Q${w - 1.6} 16 ${w - 3} 17${underside.slice(underside.indexOf("Q"))}Q1.4 16 1.5 13.5Q1 9.5 6 9.5Z`;
  const drips = [];
  for (let i = 0; i < bumps; i += 1) {
    if (i % 2 === (bumps > 4 ? 1 : 0)) continue;
    const x = w - 3 - (i + 0.5) * span + (i % 3) - 1;
    drips.push({ x, top: 21.35 + (i % 2) * 0.5, long: [5.5, 3.5, 7, 4.5][i % 4] });
  }
  const sparkles = [
    { x: w * 0.2, y: 4.5, s: 2.4 },
    { x: w * 0.68, y: 3, s: 2 },
    { x: w * 0.9, y: 14.5, s: 1.7 },
  ];
  return { w, scoops, base, drips, sparkles };
}

function Sparkle({ x, y, s, className }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - s * 1.8}Q${x + s * 0.3} ${y - s * 0.3} ${x + s * 1.8} ${y}Q${x + s * 0.3} ${y + s * 0.3} ${x} ${y + s * 1.8}Q${x - s * 0.3} ${y + s * 0.3} ${x - s * 1.8} ${y}Q${x - s * 0.3} ${y - s * 0.3} ${x} ${y - s * 1.8}Z`}
      fill="#ffffff"
      stroke="#9fd0f0"
      strokeWidth=".6"
    />
  );
}

function KaitoPlatform({ width = 100, state = "steady" }) {
  const id = useId();
  const { w, scoops, base, drips, sparkles } = layout(width);
  return (
    <div className="kaito-cloud" data-state={state} style={{ width: w, height: HEIGHT }} aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${HEIGHT}`} width={w} height={HEIGHT} overflow="visible">
        <defs>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f7fbff" />
            <stop offset=".6" stopColor="#e6f1fd" />
            <stop offset="1" stopColor="#cfe2f7" />
          </linearGradient>
        </defs>
        <g className="kaito-cloud__base">
          {drips.map((d) => (
            <path
              key={d.x}
              className="kaito-cloud__drip"
              d={`M${d.x - 1.5} ${d.top - 3}C${d.x - 1.5} ${d.top + d.long * 0.45} ${d.x - 3} ${d.top + d.long * 0.6} ${d.x - 3} ${d.top + d.long}A3 3 0 0 0 ${d.x + 3} ${d.top + d.long}C${d.x + 3} ${d.top + d.long * 0.6} ${d.x + 1.5} ${d.top + d.long * 0.45} ${d.x + 1.5} ${d.top - 3}Z`}
              fill="#e3effc"
              stroke="#a7c2e6"
              strokeWidth=".9"
            />
          ))}
          <path d={base} fill={`url(#${id}-base)`} stroke="#a7c2e6" strokeWidth="1" strokeLinejoin="round" />
          {drips.map((d) => (
            <path key={d.x} d={`M${d.x - 1.1} ${d.top}h2.2`} stroke="#e3effc" strokeWidth="2.2" />
          ))}
          <path d={`M9 16.4H${w - 9}`} stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".75" />
        </g>
        {scoops.map((s) => (
          <g
            key={s.x}
            className="kaito-cloud__scoop"
            style={{ transformOrigin: `${s.x}px ${s.y + s.r}px`, animationDelay: `${s.order * 45}ms` }}
          >
            <path
              d={`M${s.x - s.r} ${s.y + 2}C${s.x - s.r} ${s.y - s.r * 1.15} ${s.x + s.r} ${s.y - s.r * 1.15} ${s.x + s.r} ${s.y + 2}q${-s.r / 3} 3 ${(-s.r * 2) / 3} 0q${-s.r / 3} 3 ${(-s.r * 2) / 3} 0q${-s.r / 3} 3 ${(-s.r * 2) / 3} 0Z`}
              fill={s.colour.fill}
              stroke={s.colour.line}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d={`M${s.x - s.r * 0.55} ${s.y - s.r * 0.2}q${s.r * 0.22} ${-s.r * 0.45} ${s.r * 0.62} ${-s.r * 0.52}`}
              stroke={s.colour.glint}
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ))}
        {w >= 70 && (
          // A rolled wafer stuck in the last scoop.
          <g className="kaito-cloud__scoop kaito-cloud__wafer" style={{ transformOrigin: `${w - 12}px 10px`, animationDelay: `${(scoops.length / 2) * 45 + 60}ms` }}>
            <path d={`M${w - 13} 9.5l5.4-10.5 2.6 1.3-5.4 10.5Z`} fill="#e9bb72" stroke="#a8722f" strokeWidth=".8" strokeLinejoin="round" />
            <path d={`M${w - 11.6} 6.6l2.4 1.2m-1-3.8 2.4 1.2`} stroke="#c48a40" strokeWidth=".8" />
          </g>
        )}
        <g className="kaito-cloud__frost">
          {sparkles.map((s, i) => (
            <Sparkle key={i} {...s} className={`kaito-cloud__sparkle kaito-cloud__sparkle--${i}`} />
          ))}
        </g>
      </svg>
    </div>
  );
}

const Platform = memo(KaitoPlatform);
Platform.surface = SURFACE;
Platform.height = HEIGHT;
export default Platform;
