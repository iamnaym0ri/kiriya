// Negi, a little spring onion who cheers with a penlight: an original character drawn for this game
// in the site's sticker line style. Pose comes from data-pose (idle | cheer | wow | encourage), the
// bop from data-beat; both are set by the engine, so React never re-renders while a song plays.
import { forwardRef } from "react";

const INK = "#2b1b35";
const s = (width = 2) => ({ stroke: INK, strokeWidth: width, strokeLinejoin: "round", strokeLinecap: "round" });

const Buddy = forwardRef(function Buddy({ bubbleRef }, ref) {
  return (
    <div className="buddy" ref={ref} data-pose="idle" data-beat="a" aria-hidden="true">
      <span className="buddy__bubble" ref={bubbleRef} data-show="false" />
      <svg viewBox="0 0 100 124" className="buddy__svg">
        <g className="buddy__bop">
          {/* leaves: the two outer ones sway like pigtails */}
          <path className="buddy__tail buddy__tail--l" d="M45 32C36 20 24 10 11 5c5 11 14 23 28 31z" fill="#7fcf8e" {...s()} />
          <path className="buddy__tail buddy__tail--r" d="M55 32c9-12 21-22 34-27-5 11-14 23-28 31z" fill="#7fcf8e" {...s()} />
          <path d="M50 30c-3-11-1-20 4-27 3 10 1 19-4 27z" fill="#a4e3ad" {...s(1.8)} />
          <path d="M20 10q8 7 14 16M80 10q-8 7-14 16" fill="none" stroke="#c8f0cc" strokeWidth="1.8" strokeLinecap="round" />
          {/* roots and feet */}
          <path d="M43 106q-2 6-6 9M50 107v9M57 106q2 6 6 9" fill="none" stroke="#c9b48a" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="41" cy="112" rx="6" ry="3.6" fill="#a4e3ad" {...s(1.6)} />
          <ellipse cx="59" cy="112" rx="6" ry="3.6" fill="#a4e3ad" {...s(1.6)} />
          {/* arms: the right one holds the penlight */}
          <g className="buddy__arm buddy__arm--l">
            <path d="M25 72q-7 6-9 14" fill="none" stroke={INK} strokeWidth="6.4" strokeLinecap="round" />
            <path d="M25 72q-7 6-9 14" fill="none" stroke="#fffdf6" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="15.6" cy="87.5" r="3.6" fill="#fffdf6" {...s(1.6)} />
          </g>
          <g className="buddy__arm buddy__arm--r">
            <path d="M75 72q7 6 9 14" fill="none" stroke={INK} strokeWidth="6.4" strokeLinecap="round" />
            <path d="M75 72q7 6 9 14" fill="none" stroke="#fffdf6" strokeWidth="3.4" strokeLinecap="round" />
            <g className="buddy__penlight">
              <circle className="buddy__glow" cx="88" cy="68" r="10" fill="#a8fff6" opacity=".45" />
              <rect x="82" y="60" width="6" height="26" rx="3" transform="rotate(14 85 86)" fill="#a8fff6" stroke="#1f9a92" strokeWidth="1.6" />
              <rect x="82.5" y="82" width="5" height="9" rx="1.6" transform="rotate(14 85 86)" fill="#5b4a6b" {...s(1.4)} />
            </g>
            <circle cx="84.4" cy="87.5" r="3.6" fill="#fffdf6" {...s(1.6)} />
          </g>
          {/* the bulb */}
          <g className="buddy__head">
            <path d="M50 28c18 0 30 14 30 36 0 26-14 42-30 42S20 90 20 64c0-22 12-36 30-36z" fill="#fffdf6" {...s(2.2)} />
            <path d="M23.5 48c6-12 16-18 26.5-18s20.5 6 26.5 18c-8-4-17.5-6-26.5-6s-18.5 2-26.5 6z" fill="#d9f2c9" />
            <path d="M50 28c18 0 30 14 30 36 0 26-14 42-30 42S20 90 20 64c0-22 12-36 30-36z" fill="none" {...s(2.2)} />
            <path d="M28 70q2 14 10 22" fill="none" stroke="#f1ece0" strokeWidth="3" strokeLinecap="round" />
            {/* a teal bow on one leaf */}
            <path d="M38 32c-6-5-12-5-11-1s7 3 11 1zm0 0c3-6 9-8 10-4s-5 6-10 4z" fill="#5fd3c8" {...s(1.5)} />
            <g className="buddy__eyes">
              <ellipse cx="41" cy="64" rx="3.6" ry="4.6" fill={INK} />
              <ellipse cx="59" cy="64" rx="3.6" ry="4.6" fill={INK} />
              <circle cx="42.4" cy="62" r="1.5" fill="#fff" />
              <circle cx="60.4" cy="62" r="1.5" fill="#fff" />
            </g>
            <path className="buddy__happy" d="M37 65q4-5.5 8 0M55 65q4-5.5 8 0" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="34" cy="71" rx="4" ry="2.2" fill="#ffa4c9" opacity=".75" />
            <ellipse cx="66" cy="71" rx="4" ry="2.2" fill="#ffa4c9" opacity=".75" />
            <path className="buddy__mouth" d="M46.5 71q3.5 4.5 7 0z" fill="#f96cab" {...s(1.4)} />
          </g>
          <g className="buddy__sparkles">
            <path d="M10 22l1.6 4.4L16 28l-4.4 1.6L10 34l-1.6-4.4L4 28l4.4-1.6z" fill="#fff6c9" stroke="#e9b949" strokeWidth="1" />
            <path d="M92 26l1.2 3.2 3.2 1.2-3.2 1.2L92 34.8l-1.2-3.2-3.2-1.2 3.2-1.2z" fill="#ffd3e8" stroke="#e0609c" strokeWidth="1" />
          </g>
        </g>
      </svg>
    </div>
  );
});

export default Buddy;
