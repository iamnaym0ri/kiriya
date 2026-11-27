import { useId } from "react";
import { LEAF, LEAF_DARK } from "./palette.js";
import "./Platform.css";

/*
 * Maomao's cloud: a soft cream puff with a lilac underside, a sprig of herbs growing out of each
 * end, a paper lantern hanging beneath it with a warm glow, and a thread of medicinal steam rising
 * off the back as if something is always brewing somewhere in it.
 *
 * The engine anchors the box's top centre at her feet, offset by `surface` (the puffs rise a few
 * pixels behind her heels). States: "forming" (puffs pop in from the middle out and the sprigs
 * sprout), "steady" (breathing, steam, a swaying lantern), "fading" (puffs shrink away into steam).
 */

const SURFACE = 9;
const HEIGHT = 40;

/** Puffs along the top, as [fraction of width across, y, radius]. Mirror-symmetric, slightly uneven. */
const TOPS = [
  [0.13, 17, 8],
  [0.3, 12, 11],
  [0.5, 9.5, 12.5],
  [0.7, 11.5, 11],
  [0.87, 16, 8.5],
];
/** Scallops along the underside. */
const BOTTOMS = [
  [0.2, 23, 6.5],
  [0.38, 25, 7.5],
  [0.58, 25, 7.5],
  [0.77, 23, 6.5],
];

export default function Platform({ width = 100, state = "steady" }) {
  const uid = `mmc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const w = Math.max(56, width);
  // The flat belly between the end puffs, so a wide cloud stays one cloud.
  const belly = { x: w * 0.1, y: 13, width: w * 0.8, height: 13, rx: 7 };
  const puffs = [
    ...TOPS.map(([fx, y, r], i) => ({ cx: fx * w, cy: y, r: r * Math.min(1.25, Math.max(0.8, w / 100)), delay: Math.abs(i - 2) * 60 })),
    ...BOTTOMS.map(([fx, y, r], i) => ({ cx: fx * w, cy: y, r, delay: 40 + Math.abs(i - 1.5) * 60 })),
  ];
  const lantern = w * 0.76;
  return (
    <svg
      className="mm-cloud"
      data-state={state}
      viewBox={`0 0 ${w} ${HEIGHT}`}
      width={w}
      height={HEIGHT}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2={HEIGHT} gradientUnits="userSpaceOnUse">
          <stop offset=".1" stopColor="#fffbf4" />
          <stop offset=".5" stopColor="#f6f0f6" />
          <stop offset=".8" stopColor="#ddd2ea" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop stopColor="#ffd59a" stopOpacity=".75" />
          <stop offset=".45" stopColor="#ffc97f" stopOpacity=".3" />
          <stop offset="1" stopColor="#ffc97f" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Steam from somewhere inside, rising behind her. */}
      <g className="mm-cloud__steam" fill="none" stroke="#c3d8c2" strokeWidth="1.6" strokeLinecap="round">
        <path d={`M${w * 0.4} 9q-3-4 0-8t0-8`} />
        <path d={`M${w * 0.47} 8q-3-4 0-7t0-7`} />
        <path d={`M${w * 0.36} 10q3-4 0-7t0-6`} />
      </g>

      {/* Herb sprigs growing out of each end. */}
      <g className="mm-cloud__sprig mm-cloud__sprig--l" style={{ transformOrigin: `${w * 0.15}px 16px` }}>
        <path d={`M${w * 0.15} 16q-2-6-6-11`} stroke={LEAF_DARK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path
          d={`M${w * 0.15 - 3} 9c-6 0-7-5-7-5 4 0 7 2 7 5Zm-3-4c-1-4 2-6 2-6 2 3 1 5-2 6Zm2 6c3-4 7-3 7-3-1 3-4 4-7 3Z`}
          fill={LEAF}
          stroke={LEAF_DARK}
          strokeWidth=".8"
        />
      </g>
      <g className="mm-cloud__sprig mm-cloud__sprig--r" style={{ transformOrigin: `${w * 0.86}px 16px` }}>
        <path d={`M${w * 0.86} 16q2-5 5-8`} stroke={LEAF_DARK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path
          d={`M${w * 0.86 + 3} 10c5-1 6-5 6-5-4 0-6 2-6 5Zm-1 2c-4-2-7 0-7 0 2 3 5 2 7 0Z`}
          fill={LEAF}
          stroke={LEAF_DARK}
          strokeWidth=".8"
        />
      </g>

      <g className="mm-cloud__body">
        {/* Outline layer underneath, fill layer on top: the overlaps vanish and only the cloud's
            outer edge keeps a line, like the hand-drawn mascot. */}
        <g className="mm-cloud__line" fill="#cbbfdc" stroke="#cbbfdc" strokeWidth="2.6">
          <rect className="mm-cloud__puff" {...belly} />
          {puffs.map((puff, i) => (
            <circle key={i} className="mm-cloud__puff" cx={puff.cx} cy={puff.cy} r={puff.r} style={{ animationDelay: `${puff.delay}ms` }} />
          ))}
        </g>
        <g fill={`url(#${uid}-fill)`}>
          <rect className="mm-cloud__puff" {...belly} />
          {puffs.map((puff, i) => (
            <circle key={i} className="mm-cloud__puff" cx={puff.cx} cy={puff.cy} r={puff.r} style={{ animationDelay: `${puff.delay}ms` }} />
          ))}
        </g>
        {/* The lantern's warmth on the cloud's belly, and a couple of soft highlights on top. */}
        <ellipse className="mm-cloud__warm" cx={lantern} cy="24" rx={w * 0.16} ry="7" fill={`url(#${uid}-glow)`} />
        <g className="mm-cloud__shine" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity=".9">
          <path d={`M${w * 0.24} 9q4-4 9-3`} />
          <path d={`M${w * 0.45} 3.5q4-2 8-1`} />
        </g>
      </g>

      {/* A little paper lantern hanging under the far end. */}
      <g className="mm-cloud__lantern" style={{ transformOrigin: `${lantern}px 26px` }}>
        <circle cx={lantern} cy="34" r="9" fill={`url(#${uid}-glow)`} className="mm-cloud__halo" />
        <path d={`M${lantern} 26v3`} stroke="#8a6d54" strokeWidth="1" />
        <rect x={lantern - 2.5} y="28.5" width="5" height="1.8" rx=".6" fill="#c9a25a" />
        <ellipse cx={lantern} cy="34" rx="4.6" ry="4.4" fill="#e0715a" stroke="#b5503f" strokeWidth=".8" />
        <path d={`M${lantern} 29.8v8.4M${lantern - 2.4} 30.6q-1.2 3.4 0 6.8M${lantern + 2.4} 30.6q1.2 3.4 0 6.8`} stroke="#b5503f" strokeWidth=".6" fill="none" />
        <ellipse cx={lantern - 1.2} cy="32.8" rx="1.3" ry="1.8" fill="#ffd8a0" opacity=".75" />
        <rect x={lantern - 2.5} y="37.8" width="5" height="1.6" rx=".6" fill="#c9a25a" />
        <path d={`M${lantern} 39.4v2.2`} stroke="#c9a25a" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

Platform.surface = SURFACE;
