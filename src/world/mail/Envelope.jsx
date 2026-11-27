import { useId } from "react";
import { HEART } from "../../../shared/reactions.js";

// Hand-drawn envelopes for the notes & letters section. Sealed ones wait with a wax seal, opened ones
// show the letter peeking out (her reaction sits on the corner like a sticker), and a letter that
// isn't ready yet wears a gold date seal.

const TONES = {
  blush: { paper: "#f8dde8", light: "#fdeef4", line: "#d9a3bf", inner: "#eec2d6", wax: "#9b3a69", waxLight: "#c75f8c" },
  lilac: { paper: "#e8dbf5", light: "#f4ecfb", line: "#bfa6db", inner: "#d6c2ec", wax: "#673f8d", waxLight: "#9168b8" },
  cream: { paper: "#f8eedc", light: "#fdf7ec", line: "#d8c09b", inner: "#ecd8b8", wax: "#87385b", waxLight: "#b65b84" },
  night: { paper: "#3d2954", light: "#4d3768", line: "#7a62a0", inner: "#291a3b", wax: "#b98f44", waxLight: "#e8ca86" },
  locked: { paper: "#ece6f2", light: "#f6f2f9", line: "#c9bdd6", inner: "#ddd3e7", wax: "#b48c42", waxLight: "#ecd290" },
};

/** A wavy wax-seal outline around (cx, cy). */
function sealPath(cx, cy, r, bumps = 14, wobble = 1.4) {
  const points = [];
  for (let i = 0; i <= 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r + wobble * Math.sin(a * bumps);
    points.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}
const SEAL = sealPath(100, 98, 16);

export const toneFor = (letter) => {
  if (letter.author === "maomao") return "night";
  if (letter.locked) return "locked";
  if (letter.kind === "birthday") return "blush";
  if (letter.kind === "open_when") return "lilac";
  return "cream";
};

const short = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });

export default function EnvelopeArt({ tone = "blush", open = false, locked = false, unlockAt = null, reaction = null, className = "" }) {
  const id = useId().replace(/:/g, "");
  const t = TONES[tone] ?? TONES.blush;
  const [month, day] = unlockAt ? short.formatToParts(new Date(unlockAt)).reduce((acc, part) => {
    if (part.type === "month") acc[0] = part.value.toUpperCase();
    if (part.type === "day") acc[1] = part.value;
    return acc;
  }, ["", ""]) : ["", ""];
  return (
    <svg className={`envelope-art ${className}`} viewBox="0 0 200 150" aria-hidden="true" data-open={open || undefined}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={t.light} />
          <stop offset="1" stopColor={t.paper} />
        </linearGradient>
        <radialGradient id={`${id}-wax`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={t.waxLight} />
          <stop offset="1" stopColor={t.wax} />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="146" rx="84" ry="4" fill="#6b4a80" opacity="0.1" />
      {open ? (
        <>
          {/* the back of the envelope, its flap folded up behind the letter */}
          <rect x="4" y="40" width="192" height="104" rx="9" fill={t.inner} />
          <path d="M6 41 L100 3 L194 41 Z" fill={t.light} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
          <g className="envelope-art__paper">
            <rect x="26" y="16" width="148" height="96" rx="3" fill="#fffdf8" stroke="#e2d4dc" strokeWidth="1" />
            <path d="M40 34h88M40 46h112M40 58h104M40 70h70" stroke="#d9c6dd" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <path d="M4 44 L100 92 L196 44 V138 Q196 144 190 144 H10 Q4 144 4 138 Z" fill={`url(#${id}-body)`} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6 142 L84 86 M194 142 L116 86" stroke={t.line} strokeWidth="1.2" opacity="0.7" />
        </>
      ) : (
        <>
          <rect x="4" y="40" width="192" height="104" rx="9" fill={`url(#${id}-body)`} stroke={t.line} strokeWidth="1.4" />
          <path d="M6 142 L86 92 M194 142 L114 92" stroke={t.line} strokeWidth="1.2" opacity="0.7" />
          <path d="M5 44 Q5 40 10 40 H190 Q195 40 195 44 L106 99 Q100 103 94 99 Z" fill={t.light} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
          <g className="envelope-art__seal">
            <path d={SEAL} fill={`url(#${id}-wax)`} />
            <circle cx="100" cy="98" r="10.5" fill="none" stroke={t.waxLight} strokeWidth="1.2" opacity="0.7" />
            {locked ? (
              <>
                <text x="100" y="95.5" textAnchor="middle" className="envelope-art__month">{month}</text>
                <text x="100" y="106" textAnchor="middle" className="envelope-art__day">{day}</text>
              </>
            ) : tone === "night" ? (
              <path d="M100 91.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5-4.1-2.4-4.1 2.4 1.1-4.5-3.5-3 4.6-.4z" fill="#fff6df" opacity="0.9" />
            ) : (
              <path d="M100 104.5c-6.5-4.2-8.4-8.3-6.4-10.9 1.6-2.1 4.7-1.7 6.4.8 1.7-2.5 4.8-2.9 6.4-.8 2 2.6.1 6.7-6.4 10.9Z" fill="#ffeaf3" opacity="0.92" />
            )}
          </g>
        </>
      )}
      {open && reaction && (
        <g className="envelope-art__reaction" transform="translate(168 120) rotate(8)">
          <circle r="17" fill="#fffaff" stroke={t.line} strokeWidth="1.4" />
          {reaction === HEART ? (
            <path d="M0 8.5c-8-5.2-10.3-10.3-7.8-13.4 2-2.6 5.8-2.1 7.8 1 2-3.1 5.8-3.6 7.8-1 2.5 3.1.2 8.2-7.8 13.4Z" fill="#d25c8f" />
          ) : (
            <text y="6.5" textAnchor="middle" className="envelope-art__emoji">{reaction}</text>
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * The first opening of a sealed letter: the seal lifts, the flap folds back and the letter slides
 * out. Transform and opacity only; the caller skips it for Reduce Motion.
 */
export function EnvelopeOpening({ tone = "blush", onDone }) {
  const id = useId().replace(/:/g, "");
  const t = TONES[tone] ?? TONES.blush;
  return (
    <div className="envelope-opening" onAnimationEnd={(event) => event.animationName === "envelope-opening-out" && onDone?.()} onClick={() => onDone?.()}>
      <svg className="envelope-opening__art" viewBox="0 -10 200 160" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor={t.light} />
            <stop offset="1" stopColor={t.paper} />
          </linearGradient>
          <radialGradient id={`${id}-wax`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor={t.waxLight} />
            <stop offset="1" stopColor={t.wax} />
          </radialGradient>
          <clipPath id={`${id}-inside`}>
            <rect x="0" y="-40" width="200" height="186" />
          </clipPath>
        </defs>
        <ellipse cx="100" cy="146" rx="84" ry="4" fill="#6b4a80" opacity="0.12" />
        <rect x="4" y="40" width="192" height="104" rx="9" fill={t.inner} />
        <path className="envelope-opening__flap-back" d="M6 41 L100 3 L194 41 Z" fill={t.light} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
        <g className="envelope-opening__paper">
          <rect x="26" y="48" width="148" height="92" rx="3" fill="#fffdf8" stroke="#e2d4dc" strokeWidth="1" />
          <path d="M40 66h88M40 78h112M40 90h104M40 102h70" stroke="#d9c6dd" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <path d="M4 44 L100 92 L196 44 V138 Q196 144 190 144 H10 Q4 144 4 138 Z" fill={`url(#${id}-body)`} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 142 L84 86 M194 142 L116 86" stroke={t.line} strokeWidth="1.2" opacity="0.7" />
        <path className="envelope-opening__flap" d="M5 44 Q5 40 10 40 H190 Q195 40 195 44 L106 99 Q100 103 94 99 Z" fill={t.light} stroke={t.line} strokeWidth="1.4" strokeLinejoin="round" />
        <g className="envelope-opening__seal">
          <path d={SEAL} fill={`url(#${id}-wax)`} />
          <circle cx="100" cy="98" r="10.5" fill="none" stroke={t.waxLight} strokeWidth="1.2" opacity="0.7" />
          <path d="M100 104.5c-6.5-4.2-8.4-8.3-6.4-10.9 1.6-2.1 4.7-1.7 6.4.8 1.7-2.5 4.8-2.9 6.4-.8 2 2.6.1 6.7-6.4 10.9Z" fill="#ffeaf3" opacity="0.92" />
        </g>
      </svg>
      <p className="envelope-opening__skip">tap to open</p>
    </div>
  );
}
