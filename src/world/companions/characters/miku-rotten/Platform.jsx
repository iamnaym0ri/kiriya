import { useId } from "react";
import { C } from "./palette.js";
import "./miku-rotten.css";

// Her cloud is a page from her sketchbook: a puffy lilac-white cloud with faint ruled lines, a
// pencil outline that draws itself in when it forms, a couple of doodles while she stands on it,
// and an eraser rubbing it out (crumbs and all) when it fades behind her.

const SURFACE = 7; // px from the top of the box to where her feet stand: the puffs rise behind them

function cloudPath(w, h) {
  const top = SURFACE + 3;
  const bottom = h - 6;
  const n = Math.max(3, Math.round((w - 8) / 24));
  const seg = (w - 12) / n;
  let d = `M6 ${top + 3}`;
  for (let i = 0; i < n; i += 1) {
    // Middle puffs rise higher than the outer ones, like a real cumulus.
    const lift = Math.min(top - 1, seg * 0.42) * (0.75 + 0.25 * Math.sin(((i + 0.5) / n) * Math.PI));
    const x = 6 + seg * (i + 1);
    d += `C${x - seg * 0.95} ${top - lift} ${x - seg * 0.05} ${top - lift} ${x} ${top + (i === n - 1 ? 3 : 1)}`;
  }
  d += `C${w + 1} ${top + 4} ${w + 1} ${bottom} ${w - 8} ${bottom}`;
  const m = Math.max(2, n - 1);
  const under = (w - 20) / m;
  for (let i = 0; i < m; i += 1) {
    const x = w - 10 - under * (i + 1);
    d += `C${x + under * 0.8} ${bottom + 5} ${x + under * 0.2} ${bottom + 5} ${x} ${bottom}`;
  }
  d += `C-1 ${bottom} -1 ${top + 3} 6 ${top + 3}Z`;
  return d;
}

export default function Platform({ width = 96, state = "steady" }) {
  const id = useId();
  const w = Math.max(48, Math.round(width));
  const h = Math.round(Math.min(40, Math.max(26, w * 0.32)));
  const d = cloudPath(w, h);
  return (
    <svg
      className="mr-cloud"
      data-state={state}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
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
          <path d={d} />
        </clipPath>
      </defs>
      <g className="mr-cloud__body" style={{ transformOrigin: `${w / 2}px ${SURFACE}px` }}>
        <path d={d} fill={`url(#${id}-fill)`} />
        <g clipPath={`url(#${id}-clip)`} className="mr-cloud__page">
          {[SURFACE + 9, SURFACE + 15, SURFACE + 21].map((y) => (
            <path key={y} d={`M0 ${y}H${w}`} stroke={C.paperLine} strokeWidth=".8" opacity=".75" />
          ))}
          <path d={`M${Math.round(w * 0.16)} 0V${h}`} stroke="#f3b6c7" strokeWidth=".8" opacity=".7" />
          <ellipse cx={w / 2} cy={h - 4} rx={w * 0.42} ry="5" fill="#cbbbe8" opacity=".35" />
        </g>
      </g>
      <path
        className="mr-cloud__sketch mr-cloud__sketch--ghost"
        d={d}
        pathLength="100"
        fill="none"
        stroke="#8c7bb5"
        strokeWidth=".8"
        strokeLinejoin="round"
        transform="translate(.9 .7)"
        opacity=".35"
      />
      <path
        className="mr-cloud__sketch"
        d={d}
        pathLength="100"
        fill="none"
        stroke="#8c7bb5"
        strokeWidth="1.15"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g className="mr-cloud__doodles" fill="none" stroke="#a38fcb" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path
          transform={`translate(${w * 0.27} ${SURFACE + 13}) scale(.42)`}
          d="M0 4.5C-5-.5-6-3.5-4-5.5S1-6.5 0-3c-1-3.5 2-4.5 4-2.5S5-.5 0 4.5Z"
          stroke="#e37f9c"
          strokeWidth="2.4"
        />
        <path d={`M${w * 0.74} ${SURFACE + 9}v6m-2.4-4h4.8`} stroke={C.crossLight} />
        {w > 80 && <path d={`M${w * 0.52} ${SURFACE + 18}l1 2 2 .6-2 .7-1 2-1-2-2-.7 2-.6Z`} fill="#f1cf6a" stroke="none" />}
      </g>
      <g className="mr-cloud__crumbs" fill="#d8cfe6">
        <rect x={w * 0.2} y={SURFACE + 8} width="3" height="1.8" rx=".9" />
        <rect x={w * 0.48} y={SURFACE + 14} width="2.4" height="1.6" rx=".8" />
        <rect x={w * 0.72} y={SURFACE + 10} width="3" height="1.8" rx=".9" />
      </g>
    </svg>
  );
}

Platform.surface = SURFACE;
