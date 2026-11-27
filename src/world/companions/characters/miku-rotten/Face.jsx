import { useId, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion";
import { C } from "./palette.js";

// Her face rig: eyes behind big round glasses, the glasses themselves (which turn into white
// spirals when she's flustered and flash white when she's being smug), brows, mouth, blush and
// sweat. One set of numbers per expression, eased between, like Maomao's face. From her reference
// sheet: the nervous open grin with a sweat drop, the spiral lenses, and the guilty face in shadow
// with a heavy blush. From fujoshi canon: the nosebleed and the feral grin.

const EYES = [87, 133];
const EYE_Y = 115;
const LENS_R = 18.5;
const MOUTH_Y = 140;

const BASE = {
  open: 1,
  closedCurve: -6,
  lookX: 0,
  lookY: 0,
  iris: 1,
  shine: 1,
  lid: 0,
  top: 106,
  arch: 102,
  bottom: 121,
  lower: 127,
  browY: 91,
  browTilt: 0,
  browArch: 2.5,
  mouthW: 4,
  smile: 2.5,
  mouthOpen: 0,
  wavy: 0,
  cat: 0,
  blush: 0.28,
  hatch: 0,
  spiral: 0,
  glint: 0,
  sparkle: 0,
  heart: 0,
  sweat: 0,
  grin: 0, // a wide open grin with teeth (feral, nervous)
  shadow: 0, // the upper face in shadow (guilty)
  bleed: 0, // a nosebleed
};

const FACES = {
  soft: {},
  happy: { open: 0, closedCurve: -7, mouthW: 6, smile: 5, mouthOpen: 3, blush: 0.45 },
  giggle: { open: 0, closedCurve: -8, cat: 1, blush: 0.6, hatch: 0.35, browY: 89 },
  gasp: { top: 103, arch: 98, bottom: 123, lower: 130, iris: 0.9, shine: 1.1, mouthW: 3.5, smile: 0, mouthOpen: 7, browY: 87, browArch: 4 },
  flustered: { spiral: 1, wavy: 1, blush: 0.9, hatch: 1, sweat: 1, browY: 89, browTilt: 4, mouthW: 6 },
  sparkle: { sparkle: 1, iris: 1.06, shine: 1.35, mouthW: 7, smile: 5, mouthOpen: 7, blush: 0.55, browY: 88, browArch: 4 },
  smug: { glint: 1, cat: 1, blush: 0.22, browY: 92, browTilt: -2.5, mouthW: 6 },
  shy: { lookX: -3, lookY: 2.5, lid: 3, blush: 0.75, hatch: 0.5, mouthW: 3, smile: 1.5, browTilt: 2.5 },
  focused: { lookX: 1, lookY: 4, lid: 4.5, mouthW: 2.5, smile: 0.5, browY: 92.5, browTilt: -1 },
  pray: { open: 0, closedCurve: -3, mouthW: 3, smile: 2, blush: 0.38, browTilt: 1.5 },
  sleepy: { open: 0, closedCurve: 3.5, mouthW: 2.5, smile: 0, mouthOpen: 3, blush: 0.3, browY: 93 },
  dreamy: { heart: 1, lid: 2, blush: 0.75, mouthW: 6, smile: 4.5, mouthOpen: 2.5, browTilt: 2 },
  worried: { browTilt: 7, browY: 88, wavy: 1, mouthW: 5, sweat: 1, lookX: -2, lookY: 1, blush: 0.35, lid: 1.5 },
  pout: { browTilt: -6, browY: 93, mouthW: 2.5, smile: -3, blush: 0.8, hatch: 0.4, lookX: 3, lid: 2 },
  feral: { grin: 1, sparkle: 1, iris: 0.86, shine: 1.3, blush: 0.95, hatch: 0.9, browY: 86, browArch: 5, browTilt: -1.5, top: 104, arch: 99, bottom: 123, lower: 129 },
  guilty: { shadow: 1, grin: 0.65, iris: 0.8, lookX: 2.5, lookY: -1, blush: 1, hatch: 1, sweat: 1, browTilt: 5, browY: 89 },
  nervous: { grin: 0.75, sweat: 1, browTilt: 6, browY: 88, browArch: 3.5, blush: 0.42, iris: 0.92 },
  wince: { open: 0, closedCurve: 2.5, wavy: 1, blush: 0.85, hatch: 0.9, sweat: 1, browTilt: 6, browY: 88, mouthW: 6 },
  nosebleed: { heart: 1, bleed: 1, lid: 1.5, blush: 1, hatch: 1, mouthW: 7, smile: 4.5, mouthOpen: 4, browTilt: 3, browY: 89 },
};

export const EXPRESSIONS = Object.keys(FACES);
const faceFor = (expression) => ({ ...BASE, ...(FACES[expression] ?? FACES.soft) });

function useFace(expression, moving) {
  const [face, setFace] = useState(() => faceFor(expression));
  const latest = useRef(face);
  useLayoutEffect(() => {
    const target = faceFor(expression);
    const update = (next) => {
      latest.current = next;
      setFace(next);
    };
    if (!moving) {
      update(target);
      return undefined;
    }
    const from = latest.current;
    if (Object.keys(target).every((key) => target[key] === from[key])) return undefined;
    const controls = animate(0, 1, {
      duration: 0.3,
      ease: [0.22, 0.72, 0.2, 1],
      onUpdate: (t) => update(Object.fromEntries(Object.keys(target).map((key) => [key, from[key] + (target[key] - from[key]) * t]))),
      onComplete: () => update(target),
    });
    return () => controls.stop();
  }, [expression, moving]);
  return face;
}

/** An Archimedean-ish spiral from half circles, for the flustered lenses. */
function spiral(cx, cy, turns, step) {
  let d = `M${cx} ${cy}`;
  // Odd steps land right of centre, even steps left, each half circle a little wider.
  for (let k = 1; k <= Math.round(turns * 2); k += 1) {
    const r = (k * step) / 2;
    const target = k % 2 ? cx + ((k + 1) / 2) * step : cx - (k / 2) * step;
    d += `A${r} ${r} 0 0 1 ${target} ${cy}`;
  }
  return d;
}

export default function Face({ expression = "soft", moving, children }) {
  const id = useId();
  const f = useFace(expression, moving);
  const left = 110 - f.mouthW,
    right = 110 + f.mouthW;
  const topMouth = `M${left} ${MOUTH_Y}Q110 ${MOUTH_Y + f.smile} ${right} ${MOUTH_Y}`;
  const mouth = `${topMouth}Q110 ${MOUTH_Y + f.smile + f.mouthOpen * 1.6} ${left} ${MOUTH_Y}Z`;
  const plain = 1 - Math.max(f.wavy, f.cat, f.grin);
  const gw = 6 + f.grin * 7;
  const eyesShow = f.open * (1 - f.spiral * 0.85) * (1 - f.glint * 0.85);
  return (
    <g className="mr-face">
      <defs>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.irisTop} />
          <stop offset=".55" stopColor={C.irisMid} />
          <stop offset="1" stopColor={C.irisLow} />
        </linearGradient>
        <radialGradient id={`${id}-blush`}>
          <stop stopColor={C.blush} stopOpacity=".95" />
          <stop offset="1" stopColor={C.blush} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Blush sits under the lenses, so it shows through the glass. */}
      {[76, 144].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="132" rx="12" ry="6.5" fill={`url(#${id}-blush)`} opacity={f.blush} />
          <path d={`M${x - 6} 135l3-5m2 5 3-5m2 5 3-5`} stroke="#e0708f" strokeWidth="1.2" strokeLinecap="round" opacity={f.hatch * 0.85} />
        </g>
      ))}
      {EYES.map((x, i) => {
        const lid = f.lid;
        const outline = `M${x - 10} ${f.top + lid}C${x - 5} ${f.arch + lid} ${x + 5} ${f.arch + lid} ${x + 10} ${f.top + lid}L${x + 10} ${f.bottom}C${x + 5} ${f.lower} ${x - 5} ${f.lower} ${x - 10} ${f.bottom}Z`;
        const lidLine = `M${x - 11} ${f.top + lid + 0.5}C${x - 5} ${f.arch + lid - 0.5} ${x + 5} ${f.arch + lid - 0.5} ${x + 11} ${f.top + lid + 0.5}`;
        const ix = x + f.lookX,
          iy = EYE_Y + f.lookY;
        return (
          <g key={x}>
            <defs>
              <clipPath id={`${id}-eye-${i}`}>
                <path d={outline} />
              </clipPath>
            </defs>
            <g opacity={eyesShow}>
              <g className="mr-eye" style={{ transformOrigin: `${x}px ${EYE_Y}px` }}>
                <path d={outline} fill="#fffaf7" />
                <g clipPath={`url(#${id}-eye-${i})`}>
                  <ellipse cx={ix} cy={iy} rx={7.6 * f.iris} ry={11 * f.iris} fill={`url(#${id}-iris)`} />
                  <ellipse cx={ix} cy={iy - 1} rx={3.3} ry={6} fill={C.pupil} opacity={1 - f.heart} />
                  <path
                    transform={`translate(${ix} ${iy - 1}) scale(.62)`}
                    d="M0 6C-7-.5-8-4.5-5.5-7S.5-8 0-3.5c-.5-4.5 3-5 5.5-3.5S7-.5 0 6Z"
                    fill="#f46c97"
                    opacity={f.heart}
                  />
                  <path d={`M${ix - 5} ${iy + 6}q5 4 10 0`} fill="none" stroke="#e7d6ff" strokeWidth="1.2" opacity=".8" />
                  <circle cx={ix + 3} cy={iy - 5} r={2.6 * f.shine} fill="#fffdfb" />
                  <circle cx={ix - 3.2} cy={iy + 4.5} r={1.3 * f.shine} fill="#f3ecff" />
                  <path
                    d={`M${ix - 3} ${iy - 2}l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z`}
                    fill="#fff"
                    opacity={f.sparkle}
                    transform={`translate(${ix - 3} ${iy - 2}) scale(1.6) translate(${-(ix - 3)} ${-(iy - 2)})`}
                  />
                </g>
                <path d={lidLine} stroke={C.lid} strokeWidth="2.8" fill="none" strokeLinecap="round" />
                <path
                  d={i ? `m${x + 10} ${f.top + lid}l2.5-2.2` : `m${x - 10} ${f.top + lid}l-2.5-2.2`}
                  stroke={C.lid}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
              <path className="mr-blink-line" d={`M${x - 9} ${EYE_Y + 1}q9 3 18 0`} fill="none" stroke={C.lid} strokeWidth="2.6" strokeLinecap="round" />
            </g>
            <path
              d={`M${x - 9} ${EYE_Y + 1}q9 ${f.closedCurve} 18 0`}
              opacity={(1 - f.open) * (1 - f.spiral) * (1 - f.glint)}
              fill="none"
              stroke={C.lid}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* Guilty: the top of her face falls into shadow; the lenses still catch the light. */}
      {f.shadow > 0 && (
        <g opacity={f.shadow}>
          <defs>
            <linearGradient id={`${id}-shadow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset=".25" stopColor={C.guilt} stopOpacity=".72" />
              <stop offset="1" stopColor={C.guilt} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M56 84q54-14 108 0v44q-54 8-108 0Z" fill={`url(#${id}-shadow)`} />
        </g>
      )}
      <path d="M109 129.5l1.6 1.2-1.6.8" fill="none" stroke="#d8a690" strokeWidth="1.1" strokeLinecap="round" />
      {/* The fujoshi nosebleed: a thin trickle from one nostril and a drop. */}
      {f.bleed > 0 && (
        <g opacity={f.bleed} className="mr-bleed">
          <path d="M108.2 131.6q-1.4 3.4-.4 6.4" fill="none" stroke={C.blood} strokeWidth="2.2" strokeLinecap="round" />
          <path className="mr-bleed-drop" d="M107.6 139.6q2.4 3.4 0 4.6-2.4-1.2 0-4.6Z" fill={C.blood} />
        </g>
      )}
      <g className="mr-mouth">
        <path d={mouth} fill={C.mouth} opacity={Math.min(1, f.mouthOpen) * plain} />
        <path d={topMouth} fill="none" stroke={C.mouthLine} strokeWidth="1.9" strokeLinecap="round" opacity={plain} />
        <path d="M102 141q2-3 4 0t4 0 4 0 4 0" fill="none" stroke={C.mouthLine} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={f.wavy} />
        <path d="M103 139q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke={C.mouthLine} strokeWidth="1.9" strokeLinecap="round" opacity={f.cat * (1 - f.wavy) * (1 - f.grin)} />
        {/* The wide grin: a D of a mouth, top teeth, a little tongue. */}
        <g opacity={Math.min(1, f.grin * 1.4)}>
          <path d={`M${110 - gw} 138.2Q110 ${139 + f.grin * 17} ${110 + gw} 138.2Z`} fill={C.mouth} stroke={C.mouthLine} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={`M${110 - gw + 1.6} 138.8Q110 ${140.6} ${110 + gw - 1.6} 138.8L${110 + gw - 2.4} 140.6Q110 142.6 ${110 - gw + 2.4} 140.6Z`} fill="#fff" />
          <path d={`M${110 - 5} ${138 + f.grin * 7.4}q5-4.4 10 0q-5 2.6-10 0Z`} fill="#f39ab4" />
        </g>
        {/* While her bubble is up the mouth opens and closes (CSS, data-talking). */}
        <path className="mr-talk" d="M105.5 139.5q4.5-2 9 0q-1 6-4.5 6t-4.5-6Z" fill={C.mouth} stroke={C.mouthLine} strokeWidth="1.3" strokeLinejoin="round" />
      </g>
      <g className="mr-glasses">
        {EYES.map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={EYE_Y - 1} r={LENS_R} fill="#fff" opacity={0.14 + Math.max(f.spiral, f.glint) * 0.82} />
            <g opacity={f.spiral} className="mr-spiral" style={{ transformOrigin: `${x}px ${EYE_Y - 1}px` }}>
              <path d={spiral(x, EYE_Y - 1, 3, 3.9)} fill="none" stroke="#7a68a6" strokeWidth="1.9" strokeLinecap="round" />
            </g>
            <g opacity={f.glint}>
              <path d={`M${x - 9} ${EYE_Y + 8}l15-17m-6 19 9-10`} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <path d={`M${x - 12} ${EYE_Y + 2}q1-12 13-14`} stroke="#c9dcf5" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
            <path
              d={`M${x + 6} ${EYE_Y - 15}q6 3 7 9`}
              stroke="#fff"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              opacity={0.75 * (1 - f.spiral) * (1 - f.glint)}
            />
            <circle cx={x} cy={EYE_Y - 1} r={LENS_R} fill="none" stroke={C.glasses} strokeWidth="2.6" />
            <path
              d={i ? `M${x + LENS_R} ${EYE_Y - 4}l12-3` : `M${x - LENS_R} ${EYE_Y - 4}l-12-3`}
              stroke={C.glasses}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        ))}
        <path d={`M${EYES[0] + LENS_R - 0.5} ${EYE_Y - 4}q4.5-4 9 0`} fill="none" stroke={C.glasses} strokeWidth="2.4" strokeLinecap="round" />
      </g>
      {children}
      {EYES.map((x, i) => {
        const tilt = i ? -f.browTilt : f.browTilt;
        return (
          <path
            key={x}
            d={`M${x - 10} ${f.browY + tilt * 0.5}q10 ${-f.browArch - 1} 20 ${-tilt}`}
            fill="none"
            stroke={C.brow}
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".9"
          />
        );
      })}
      <path className="mr-sweat" d="M163 96q7 10 0 13-7-3 0-13Z" fill="#a9d4f0" stroke="#78a9cc" strokeWidth="1" opacity={f.sweat} />
    </g>
  );
}
