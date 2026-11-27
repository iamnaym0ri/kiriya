import { useId, useState } from "react";
import { C } from "./palette.js";
import "./miku-rotten.css";

// Her cloud is a page from her sketchbook: a puffy lilac-white cloud with faint ruled lines and a
// pink margin, a pencil outline that draws itself in (starting on the side she's walking towards)
// as it forms, a doodle or two while she stands on it, and an eraser rubbing it out, crumbs and all,
// as it fades behind her. She runs with platformFx "own": these states are animated here.
//
// Drawn on a fixed 96-wide page and scaled to the width the engine asks for, so the feet line
// (`surface`) scales with it exactly.

const W = 96;
const H = 31;
const SURFACE = 7; // where her feet stand, from the top of the box: the puffs rise behind them

function cloudPath() {
  const top = SURFACE + 3;
  const bottom = H - 6;
  const n = 4;
  const seg = (W - 12) / n;
  let d = `M6 ${top + 3}`;
  for (let i = 0; i < n; i += 1) {
    // Middle puffs rise higher than the outer ones, like a real cumulus.
    const lift = Math.min(top - 1, seg * 0.42) * (0.75 + 0.25 * Math.sin(((i + 0.5) / n) * Math.PI));
    const x = 6 + seg * (i + 1);
    d += `C${x - seg * 0.95} ${top - lift} ${x - seg * 0.05} ${top - lift} ${x} ${top + (i === n - 1 ? 3 : 1)}`;
  }
  d += `C${W + 1} ${top + 4} ${W + 1} ${bottom} ${W - 8} ${bottom}`;
  const m = 3;
  const under = (W - 20) / m;
  for (let i = 0; i < m; i += 1) {
    const x = W - 10 - under * (i + 1);
    d += `C${x + under * 0.8} ${bottom + 5} ${x + under * 0.2} ${bottom + 5} ${x} ${bottom}`;
  }
  return `${d}C-1 ${bottom} -1 ${top + 3} 6 ${top + 3}Z`;
}
const CLOUD = cloudPath();

// Little things she has drawn on the page. Each cloud gets one or two, so a trail of clouds isn't
// a row of identical stickers.
const DOODLES = [
  (x, y) => <path key="h" transform={`translate(${x} ${y}) scale(.42)`} d="M0 4.5C-5-.5-6-3.5-4-5.5S1-6.5 0-3c-1-3.5 2-4.5 4-2.5S5-.5 0 4.5Z" stroke="#e37f9c" strokeWidth="2.4" />,
  (x, y) => <path key="c" d={`M${x} ${y - 3}v6m-2.4-4h4.8`} stroke={C.crossLight} />,
  (x, y) => <path key="s" d={`M${x} ${y - 3}l1 2 2 .6-2 .7-1 2-1-2-2-.7 2-.6Z`} fill="#f1cf6a" stroke="none" />,
  (x, y) => <path key="n" d={`M${x - 2} ${y + 2}a1.6 1.3 0 1 0 .1 0M${x - 0.4} ${y + 2}v-5.5q2 .5 3 2`} stroke="#8f7fc4" />,
  (x, y) => <path key="w" d={`M${x - 4} ${y}q1-2 2 0t2 0 2 0 2 0`} stroke="#8fb9de" />,
];

export default function Platform({ width = W, state = "steady", facing = 1, playing = true }) {
  const id = useId();
  const [doodles] = useState(() => {
    const first = Math.floor(Math.random() * DOODLES.length);
    const two = Math.random() < 0.5;
    return [
      { draw: DOODLES[first], x: 22 + Math.random() * 14, y: SURFACE + 11 + Math.random() * 5 },
      ...(two ? [{ draw: DOODLES[(first + 2) % DOODLES.length], x: 60 + Math.random() * 16, y: SURFACE + 9 + Math.random() * 6 }] : []),
    ];
  });
  const height = (width * H) / W;
  return (
    <svg
      className="mr-cloud"
      data-state={state}
      data-playing={playing ? "on" : "off"}
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      overflow="visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset=".6" stopColor="#f6f0ff" />
          <stop offset="1" stopColor="#e3d6f6" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={CLOUD} />
        </clipPath>
      </defs>
      {/* Mirrored when she walks left, so the pencil starts on the side she's heading for. */}
      <g transform={facing < 0 ? `translate(${W} 0) scale(-1 1)` : undefined}>
        <g className="mr-cloud__body">
          <path d={CLOUD} fill={`url(#${id}-fill)`} />
          <g clipPath={`url(#${id}-clip)`}>
            {[SURFACE + 9, SURFACE + 15, SURFACE + 21].map((y) => (
              <path key={y} d={`M0 ${y}H${W}`} stroke={C.paperLine} strokeWidth=".8" opacity=".75" />
            ))}
            <path d={`M15 0V${H}`} stroke="#f3b6c7" strokeWidth=".8" opacity=".7" />
            <ellipse cx={W / 2} cy={H - 4} rx={W * 0.42} ry="5" fill="#cbbbe8" opacity=".35" />
          </g>
        </g>
        <path
          className="mr-cloud__sketch mr-cloud__sketch--ghost"
          d={CLOUD}
          pathLength="100"
          fill="none"
          stroke="#8c7bb5"
          strokeWidth=".8"
          strokeLinejoin="round"
          transform="translate(.9 .7)"
          opacity=".35"
        />
        <path className="mr-cloud__sketch" d={CLOUD} pathLength="100" fill="none" stroke="#8c7bb5" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round" />
        <g className="mr-cloud__doodles" fill="none" stroke="#a38fcb" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {doodles.map(({ draw, x, y }) => draw(x, y))}
        </g>
        <g className="mr-cloud__crumbs" fill="#d8cfe6">
          <rect x="20" y={SURFACE + 8} width="3" height="1.8" rx=".9" />
          <rect x="46" y={SURFACE + 14} width="2.4" height="1.6" rx=".8" />
          <rect x="70" y={SURFACE + 10} width="3" height="1.8" rx=".9" />
        </g>
      </g>
    </svg>
  );
}

// Feet line at scale 1. The engine scales it with the body, as the drawing scales with `width`.
Platform.surface = SURFACE;
