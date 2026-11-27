import { memo, useId } from "react";
import "./kaito.css";

// KAITO's cloud: a little cloud made of ice-cream scoops (soda blue, vanilla, and one lilac for
// her) on a frosty base with a melty drip rim. It forms by scoops plopping in one after another,
// sparkles with frost while he's on it, and melts away behind him.
//
// The box is `width` × HEIGHT px; the engine anchors its top centre at his feet minus `surface`,
// so the tops of the scoops rise around his boots like soft-serve.
const HEIGHT = 30;
const SURFACE = 8;
const SCOOPS = [
  { fill: "#fff4da", line: "#dcbd8a", glint: "#ffffff" },
  { fill: "#bfe6fa", line: "#73b3db", glint: "#effaff" },
  { fill: "#fff4da", line: "#dcbd8a", glint: "#ffffff" },
  { fill: "#bfe6fa", line: "#73b3db", glint: "#effaff" },
];
const LILAC = { fill: "#e2d0f8", line: "#a98ad1", glint: "#f8f2ff" };

/** Where the scoops, drips and sparkles go for a given width: the same width always looks the same. */
function layout(width) {
  const w = Math.max(40, width);
  const inset = 9;
  const n = Math.max(3, Math.round((w - inset * 2) / 15) + 1);
  const step = (w - inset * 2) / (n - 1);
  const middle = Math.floor(n / 2);
  const scoops = Array.from({ length: n }, (_, i) => {
    const r = [7.2, 6.2, 7.8, 6.6, 7][i % 5];
    const colour = i === middle ? LILAC : SCOOPS[i % SCOOPS.length];
    // Pop in from the middle outwards: that's where his feet are.
    const order = Math.abs(i - middle);
    return { x: inset + i * step, y: 10.5 - (i % 2) * 1.2, r, colour, order };
  });
  const dripCount = Math.max(2, Math.round(w / 26));
  const drips = Array.from({ length: dripCount }, (_, i) => {
    const x = (w / (dripCount + 1)) * (i + 1) + (i % 2 ? 3 : -2);
    const long = [6.5, 4, 8, 5, 7][i % 5];
    return { x, long, wide: 2.6 + (i % 3) * 0.6 };
  });
  const sparkles = [
    { x: w * 0.22, y: 5, s: 2.6 },
    { x: w * 0.7, y: 3.5, s: 2.1 },
    { x: w * 0.9, y: 12, s: 1.8 },
  ];
  return { w, scoops, drips, sparkles };
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
  const { w, scoops, drips, sparkles } = layout(width);
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
          {/* Drips first, so the rim of the base covers where they start. */}
          {drips.map((d) => (
            <path
              key={d.x}
              className="kaito-cloud__drip"
              d={`M${d.x - d.wide} 18C${d.x - d.wide} ${20 + d.long * 0.5} ${d.x - d.wide * 0.8} ${19 + d.long} ${d.x} ${19 + d.long}S${d.x + d.wide} ${20 + d.long * 0.5} ${d.x + d.wide} 18Z`}
              fill="#e2eefc"
              stroke="#a9c4e8"
              strokeWidth=".9"
            />
          ))}
          <path
            d={`M7 8.5H${w - 7}Q${w - 1} 8.5 ${w - 1.5} 14.5Q${w - 2.5} 20.5 ${w - 9} 20.5H9Q2.5 20.5 1.5 14.5Q1 8.5 7 8.5Z`}
            fill={`url(#${id}-base)`}
            stroke="#a9c4e8"
            strokeWidth="1"
          />
          {drips.map((d) => (
            <path key={d.x} d={`M${d.x - d.wide + 0.6} 19.6h${d.wide * 2 - 1.2}`} stroke="#e2eefc" strokeWidth="1.6" />
          ))}
          <path d={`M10 17.6H${w - 10}`} stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
        </g>
        {scoops.map((s) => (
          <g
            key={s.x}
            className="kaito-cloud__scoop"
            style={{ transformOrigin: `${s.x}px ${s.y + s.r}px`, animationDelay: `${s.order * 45}ms` }}
          >
            <path
              d={`M${s.x - s.r} ${s.y + 2}C${s.x - s.r} ${s.y - s.r * 1.1} ${s.x + s.r} ${s.y - s.r * 1.1} ${s.x + s.r} ${s.y + 2}C${s.x + s.r * 0.6} ${s.y + 4} ${s.x + s.r * 0.3} ${s.y + 2} ${s.x} ${s.y + 3.6}C${s.x - s.r * 0.3} ${s.y + 2} ${s.x - s.r * 0.6} ${s.y + 4} ${s.x - s.r} ${s.y + 2}Z`}
              fill={s.colour.fill}
              stroke={s.colour.line}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d={`M${s.x - s.r * 0.55} ${s.y - s.r * 0.25}q${s.r * 0.25} -${s.r * 0.45} ${s.r * 0.65} -${s.r * 0.5}`}
              stroke={s.colour.glint}
              strokeWidth="1.5"
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
