import { memo, useId } from "react";
import "./kaito.css";

// KAITO's cloud: soft-serve with ice-cream scoops nestled in it (vanilla, soda blue, mint, and one
// lilac for her), a scalloped underside and a couple of melty drips. It forms with the scoops
// plopping in one after another from the middle, sparkles with frost while he's on it, and melts
// away behind him (platformFx "own": the engine leaves the states to us).
//
// Drawn at BASE_WIDTH × HEIGHT and scaled to the width the engine asks for (platformWidth × the
// stage's scale), so it looks the same on every phone and `surface` stays true.
export const BASE_WIDTH = 104;
const HEIGHT = 34;
const SURFACE = 9;
const VANILLA = { fill: "#fff4da", line: "#d9b984", glint: "#ffffff" };
const SODA = { fill: "#bfe6fa", line: "#6fafd8", glint: "#effaff" };
const MINT = { fill: "#cdf1e2", line: "#7cc2a5", glint: "#f2fffa" };
const LILAC = { fill: "#e2d0f8", line: "#a98ad1", glint: "#f8f2ff" };
const CYCLE = [VANILLA, SODA, MINT, VANILLA, SODA];

/** Where the scoops, drips and sparkles go: computed once, the cloud always looks the same. */
function layout(w) {
  const n = Math.max(3, Math.round((w - 22) / 14) + 1);
  const step = (w - 22) / (n - 1);
  const middle = Math.floor(n / 2);
  const scoops = Array.from({ length: n }, (_, i) => {
    const r = [7.6, 6.8, 8, 7, 7.4][i % 5];
    const colour = i === middle ? LILAC : CYCLE[i % CYCLE.length];
    return { x: 11 + i * step, y: 10.4 + (i % 2) * 1.4, r, colour, back: i % 2 === 1, order: Math.abs(i - middle) };
  });
  // Back row first, front row over it: a little heap rather than a fence.
  scoops.sort((p, q) => Number(q.back) - Number(p.back));
  const bumps = Math.max(3, Math.round((w - 6) / 14));
  const span = (w - 6) / bumps;
  let underside = "";
  for (let i = 0; i < bumps; i += 1) {
    const x0 = w - 3 - i * span;
    const x1 = x0 - span;
    underside += `Q${((x0 + x1) / 2).toFixed(1)} ${23.6 + (i % 2) * 0.8} ${x1.toFixed(1)} 19.4`;
  }
  // The top edge is soft-serve: gentle waves that tuck the scoops in.
  const waves = n + 1;
  let top = "M5 13";
  for (let i = 0; i < waves; i += 1) {
    const x0 = 5 + ((w - 10) / waves) * i;
    const x1 = 5 + ((w - 10) / waves) * (i + 1);
    top += `Q${((x0 + x1) / 2).toFixed(1)} ${11 - (i % 2) * 1.2} ${x1.toFixed(1)} 13`;
  }
  const base = `${top}Q${w - 0.8} 13.4 ${w - 1.4} 16Q${w - 1.8} 17.6 ${w - 3} 17.8${underside}Q1.8 17.6 1.4 16Q0.8 13.4 5 13Z`;
  const drips = [
    { x: w * 0.3, top: 21.2, long: 4.5 },
    { x: w * 0.71, top: 21.6, long: 6.5 },
  ];
  const sparkles = [
    { x: w * 0.18, y: 3.5, s: 2.3 },
    { x: w * 0.64, y: 2, s: 1.9 },
    { x: w * 0.9, y: 14, s: 1.6 },
  ];
  return { scoops, base, drips, sparkles };
}
const LAYOUT = layout(BASE_WIDTH);

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

const Scoop = ({ s }) => (
  <g className="kaito-cloud__scoop" style={{ transformOrigin: `${s.x}px ${s.y + s.r}px`, animationDelay: `${s.order * 32}ms` }}>
    <path
      d={`M${s.x - s.r} ${s.y + 3}C${s.x - s.r} ${s.y - s.r * 1.18} ${s.x + s.r} ${s.y - s.r * 1.18} ${s.x + s.r} ${s.y + 3}Z`}
      fill={s.colour.fill}
      stroke={s.colour.line}
      strokeWidth="1"
    />
    <path
      d={`M${s.x - s.r * 0.55} ${s.y - s.r * 0.1}q${s.r * 0.2} ${-s.r * 0.5} ${s.r * 0.62} ${-s.r * 0.58}`}
      stroke={s.colour.glint}
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  </g>
);

function KaitoPlatform({ width = BASE_WIDTH, state = "steady", playing = true }) {
  const id = useId();
  const k = Math.min(1.4, Math.max(0.6, width / BASE_WIDTH));
  const w = BASE_WIDTH;
  const { scoops, base, drips, sparkles } = LAYOUT;
  return (
    <div
      className="kaito-cloud"
      data-state={state}
      data-playing={playing ? "on" : "off"}
      style={{ width: w * k, height: HEIGHT * k }}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${w} ${HEIGHT}`} width={w * k} height={HEIGHT * k} overflow="visible">
        <defs>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fbfdff" />
            <stop offset=".55" stopColor="#eaf3fd" />
            <stop offset="1" stopColor="#d3e5f8" />
          </linearGradient>
        </defs>
        {/* The scoops sit in the soft-serve, so they go first and the base's wavy top tucks them in. */}
        {scoops.map((s) => (
          <Scoop key={s.x} s={s} />
        ))}
        <g className="kaito-cloud__scoop kaito-cloud__wafer" style={{ transformOrigin: `${w - 12}px 12px`, animationDelay: "160ms" }}>
          <path d={`M${w - 14} 12l6-12.5 2.8 1.3-6 12.5Z`} fill="#e9bb72" stroke="#a8722f" strokeWidth=".8" strokeLinejoin="round" />
          <path d={`M${w - 12.4} 8.6l2.6 1.2m-1-4.4 2.6 1.2`} stroke="#c48a40" strokeWidth=".8" />
        </g>
        <g className="kaito-cloud__base">
          {drips.map((d) => (
            <path
              key={d.x}
              className="kaito-cloud__drip"
              d={`M${d.x - 1.4} ${d.top - 3}C${d.x - 1.4} ${d.top + d.long * 0.4} ${d.x - 2.6} ${d.top + d.long * 0.6} ${d.x - 2.6} ${d.top + d.long}A2.6 2.6 0 0 0 ${d.x + 2.6} ${d.top + d.long}C${d.x + 2.6} ${d.top + d.long * 0.6} ${d.x + 1.4} ${d.top + d.long * 0.4} ${d.x + 1.4} ${d.top - 3}Z`}
              fill="#e2eefb"
              stroke="#a7c2e6"
              strokeWidth=".9"
            />
          ))}
          <path d={base} fill={`url(#${id}-base)`} stroke="#a7c2e6" strokeWidth="1" strokeLinejoin="round" />
          {drips.map((d) => (
            <path key={d.x} d={`M${d.x - 0.8} ${d.top - 0.8}h1.6v1.8h-1.6Z`} fill="#e2eefb" />
          ))}
          <path d={`M10 16.6H${w - 10}`} stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
        </g>
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
