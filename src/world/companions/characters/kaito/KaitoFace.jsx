import { useId, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion";

// KAITO's face rig, built like Maomao's (src/world/mascot/MaomaoFace.jsx) so the family reads as one:
// the same eye construction, lid line, blush and mouth, in his own blues. One continuous set of
// numbers per expression; switching expressions eases between them.
//
// Coordinates are in the body's 200×236 viewBox. Eye centres at x 77 / 123, mouth at y 135.
const BASE = {
  top: 106, // eye outline: top corners, arch, bottom corners, lower curve
  arch: 101,
  bottom: 120,
  lower: 126,
  openL: 1, // 1 open, 0 closed (drawn as a curve: closedCurve < 0 is ^, > 0 is a content ‿)
  openR: 1,
  lookX: 0,
  lookY: 0,
  iris: 9,
  pupil: 3.6,
  shine: 2.8,
  star: 0, // sparkly star highlights (ice cream spotted)
  lidL: 1.2, // a little heavy-lidded: his eyes are kind, not wide
  lidR: 1.2,
  closedCurve: -7,
  squeeze: 0, // > < eyes
  browL: 95,
  browR: 95,
  browTilt: 0, // + = worried (inner ends up)
  browArch: 2,
  mouthWidth: 5,
  smile: 2.5,
  mouthOpen: 0,
  mouthTilt: 0,
  tongue: 0,
  blush: 0.16,
  blushLines: 0,
  sweat: 0,
};

const FACES = {
  gentle: {},
  happy: { openL: 0, openR: 0, closedCurve: -8, mouthWidth: 7, smile: 5, blush: 0.3 },
  joyful: {
    openL: 0,
    openR: 0,
    closedCurve: -9,
    mouthWidth: 8,
    smile: 3,
    mouthOpen: 9,
    blush: 0.38,
    blushLines: 1,
  },
  wink: { openR: 0, closedCurve: -8, lidL: 0.6, mouthWidth: 7, smile: 4.5, mouthTilt: -1.5, blush: 0.26 },
  surprised: {
    top: 104,
    arch: 96,
    bottom: 121,
    lower: 129,
    lidL: 0,
    lidR: 0,
    iris: 8.4,
    pupil: 2.8,
    shine: 3.2,
    browL: 89,
    browR: 89,
    browArch: 4,
    mouthWidth: 3.5,
    smile: 0,
    mouthOpen: 6,
  },
  sheepish: {
    openL: 0,
    openR: 0,
    closedCurve: -6,
    browTilt: 4,
    browL: 93,
    browR: 93,
    mouthWidth: 7,
    smile: 3,
    mouthOpen: 2.5,
    mouthTilt: -1.5,
    blush: 0.28,
    sweat: 1,
  },
  pout: {
    top: 104,
    arch: 98,
    lidL: 0,
    lidR: 0,
    iris: 9.6,
    pupil: 4.4,
    shine: 3.8,
    lookY: 1,
    browTilt: 6,
    browL: 93,
    browR: 93,
    browArch: 1,
    mouthWidth: 4,
    smile: -2.5,
    blush: 0.24,
  },
  sparkle: {
    top: 104,
    arch: 95,
    bottom: 120,
    lower: 129,
    lidL: 0,
    lidR: 0,
    iris: 9.8,
    shine: 3.6,
    star: 1,
    browL: 91,
    browR: 91,
    mouthWidth: 7,
    smile: 3,
    mouthOpen: 6,
    blush: 0.34,
  },
  blissful: {
    openL: 0,
    openR: 0,
    closedCurve: 4,
    browL: 97,
    browR: 97,
    browTilt: 1,
    mouthWidth: 6,
    smile: 4,
    blush: 0.46,
  },
  lick: {
    openL: 0,
    openR: 0,
    closedCurve: -7,
    mouthWidth: 4,
    smile: 2,
    mouthOpen: 2.4,
    tongue: 1,
    blush: 0.42,
  },
  brainfreeze: {
    openL: 0,
    openR: 0,
    squeeze: 1,
    browTilt: 5,
    browL: 92,
    browR: 92,
    browArch: 0,
    mouthWidth: 6,
    smile: -3,
    mouthOpen: 3,
    mouthTilt: 1,
    blush: 0.12,
  },
  shy: {
    lookX: -3,
    lookY: 2,
    lidL: 3,
    lidR: 3,
    browTilt: 2,
    mouthWidth: 4,
    smile: 2,
    blush: 0.56,
    blushLines: 0.7,
  },
  sleepy: {
    openL: 0,
    openR: 0,
    closedCurve: 3,
    browL: 98,
    browR: 98,
    mouthWidth: 3,
    smile: 0.5,
    mouthOpen: 2.5,
    blush: 0.2,
  },
  thinking: {
    lookX: 3,
    lookY: -3,
    lidL: 2,
    lidR: 1,
    browL: 96,
    browR: 91,
    browArch: 3,
    mouthWidth: 4,
    smile: 0,
    mouthTilt: -1.5,
  },
  proud: {
    lidL: 4,
    lidR: 4,
    lookY: -1,
    browL: 92,
    browR: 92,
    browArch: 3,
    mouthWidth: 8,
    smile: 4.5,
    mouthTilt: -1,
    blush: 0.2,
  },
  fond: {
    lidL: 3.2,
    lidR: 3.2,
    browTilt: 1.5,
    mouthWidth: 7,
    smile: 4.5,
    blush: 0.4,
  },
  worried: {
    browTilt: 5,
    browL: 93,
    browR: 93,
    lidL: 0.6,
    lidR: 0.6,
    mouthWidth: 4,
    smile: -1,
    mouthOpen: 1.5,
  },
};

// Names other characters (and the engine) commonly use, so a shared line still lands on a face.
const ALIASES = {
  neutral: "gentle",
  calm: "gentle",
  smile: "gentle",
  deadpan: "gentle",
  pleased: "happy",
  laugh: "joyful",
  excited: "sparkle",
  delighted: "sparkle",
  startled: "surprised",
  alarmed: "surprised",
  sad: "pout",
  sorry: "sheepish",
  embarrassed: "sheepish",
  love: "fond",
  curious: "thinking",
  sleep: "sleepy",
  cold: "brainfreeze",
};

export const KAITO_EXPRESSIONS = Object.keys(FACES);
export const resolveExpression = (expression) =>
  FACES[expression] ? expression : ALIASES[expression] ?? null;

const faceFor = (expression) => ({ ...BASE, ...(FACES[expression] ?? FACES.gentle) });

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
      onUpdate: (t) =>
        update(Object.fromEntries(Object.keys(target).map((key) => [key, from[key] + (target[key] - from[key]) * t]))),
      onComplete: () => update(target),
    });
    return () => controls.stop();
  }, [expression, moving]);
  return face;
}

const LID = "#27304f";
const BROW = "#2a3d9a";

function Star({ x, y, r }) {
  return <path d={`M${x} ${y - r}L${x + r * 0.32} ${y - r * 0.32} ${x + r} ${y} ${x + r * 0.32} ${y + r * 0.32} ${x} ${y + r} ${x - r * 0.32} ${y + r * 0.32} ${x - r} ${y} ${x - r * 0.32} ${y - r * 0.32}Z`} fill="#fff" />;
}

/** Eyes, mouth and cheeks: drawn under the fringe. */
export function KaitoFace({ expression, moving }) {
  const id = useId();
  const f = useFace(expression, moving);
  const mouthY = 135;
  const left = 100 - f.mouthWidth;
  const right = 100 + f.mouthWidth;
  const topMouth = `M${left} ${mouthY} Q100 ${mouthY + f.smile} ${right} ${mouthY + f.mouthTilt}`;
  const mouth = `${topMouth} Q100 ${mouthY + f.mouthOpen * 1.7 + f.smile} ${left} ${mouthY}Z`;
  return (
    <g className="kaito__face-rig">
      <defs>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2a74" />
          <stop offset=".5" stopColor="#3a5cd0" />
          <stop offset="1" stopColor="#92d2f7" />
        </linearGradient>
        <clipPath id={`${id}-mouth`}>
          <path d={mouth} />
        </clipPath>
        <radialGradient id={`${id}-blush`}>
          <stop stopColor="#ec95ad" stopOpacity=".95" />
          <stop offset="1" stopColor="#ec95ad" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="63" cy="129" rx="13" ry="7.5" fill={`url(#${id}-blush)`} opacity={f.blush} />
      <ellipse cx="137" cy="129" rx="13" ry="7.5" fill={`url(#${id}-blush)`} opacity={f.blush} />
      <path
        d="m57 132 4-5m1 5 4-5m1 5 4-5M129 132l4-5m1 5 4-5m1 5 4-5"
        stroke="#e2829d"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity={f.blushLines}
      />
      {[77, 123].map((x, i) => {
        const lid = i ? f.lidR : f.lidL;
        const open = i ? f.openR : f.openL;
        const outer = i ? 1 : -1;
        // The outer corner sits a touch lower than the inner one: kind, slightly drooping eyes.
        const tl = f.top + lid + (outer < 0 ? 1.5 : 0);
        const tr = f.top + lid + (outer > 0 ? 1.5 : 0);
        const outline = `M${x - 13} ${tl} C${x - 7} ${f.arch + lid} ${x + 7} ${f.arch + lid} ${x + 13} ${tr} L${x + 13} ${f.bottom} C${x + 7} ${f.lower} ${x - 7} ${f.lower} ${x - 13} ${f.bottom}Z`;
        const lidLine = `M${x - 14} ${tl} C${x - 7} ${f.arch + lid - 1} ${x + 7} ${f.arch + lid - 1} ${x + 14} ${tr}`;
        const closedOpacity = (1 - open) * (1 - f.squeeze);
        return (
          <g key={x} className="kaito__eye-rig">
            <defs>
              <clipPath id={`${id}-eye-${i}`}>
                <path d={outline} />
              </clipPath>
              <clipPath id={`${id}-blink-${i}`}>
                <rect className="kaito__blink-mask" x={x - 18} y="86" width="36" height="48" />
              </clipPath>
            </defs>
            <g opacity={open}>
              <g clipPath={`url(#${id}-blink-${i})`}>
                <path d={outline} fill="#fbfcff" />
                <g clipPath={`url(#${id}-eye-${i})`}>
                  <g className="kaito__gaze">
                    <ellipse cx={x + f.lookX} cy={112 + f.lookY} rx={f.iris} ry="14" fill={`url(#${id}-iris)`} />
                    <ellipse cx={x + f.lookX} cy={111 + f.lookY} rx={f.pupil} ry="7" fill="#161d4c" />
                    <path
                      d={`M${x - 6 + f.lookX} ${119 + f.lookY}q6 5 12 0`}
                      fill="none"
                      stroke="#c4ecff"
                      strokeWidth="1.3"
                      opacity=".85"
                    />
                    <circle cx={x + f.lookX + 3.6} cy={105 + f.lookY} r={f.shine * (1 - f.star)} fill="#fff" />
                    <circle cx={x + f.lookX - 3.6} cy={117 + f.lookY} r="1.7" fill="#e6f7ff" />
                    {f.star > 0.01 && (
                      <g opacity={f.star}>
                        <Star x={x + f.lookX + 3.4} y={106 + f.lookY} r={4.6} />
                      </g>
                    )}
                  </g>
                  <path d={lidLine} stroke={LID} strokeWidth="6" opacity=".12" fill="none" />
                </g>
                <path className="kaito__upper-lid" d={lidLine} stroke={LID} strokeWidth="3" fill="none" strokeLinecap="round" />
                <path
                  d={i ? `m${x + 13} ${tr} 2 -2` : `m${x - 13} ${tl} -2 -2`}
                  stroke={LID}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </g>
              <path
                className="kaito__blink-line"
                d={`M${x - 11} 113q11 3 22 0`}
                fill="none"
                stroke={LID}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </g>
            <path
              d={`M${x - 11} 113q11 ${f.closedCurve} 22 0`}
              opacity={closedOpacity}
              fill="none"
              stroke={LID}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={i ? `M${x + 9} 106 ${x - 7} 113 ${x + 9} 120` : `M${x - 9} 106 ${x + 7} 113 ${x - 9} 120`}
              opacity={f.squeeze}
              fill="none"
              stroke={LID}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      <path d="m99 125 2 1.5-2 1" fill="none" stroke="#d9ae98" strokeWidth="1.15" strokeLinecap="round" />
      <g className="kaito__mouth">
        <path d={mouth} fill="#a4566f" opacity={Math.min(1, f.mouthOpen)} />
        {f.mouthOpen > 4 && (
          <g clipPath={`url(#${id}-mouth)`}>
            <ellipse
              cx="101"
              cy={mouthY + f.smile * 0.7 + f.mouthOpen * 1.45}
              rx={f.mouthWidth * 0.62}
              ry={f.mouthOpen * 0.5}
              fill="#ef8ea4"
              opacity={Math.min(1, (f.mouthOpen - 4) / 3)}
            />
          </g>
        )}
        <path d={topMouth} fill="none" stroke="#8f4f68" strokeWidth="2" strokeLinecap="round" />
        {f.tongue > 0.01 && (
          <path
            d={`M97.6 ${mouthY + 1.6}q2.9 6.6 6 0Z`}
            fill="#f08ca3"
            stroke="#c96a83"
            strokeWidth=".9"
            opacity={f.tongue}
          />
        )}
      </g>
    </g>
  );
}

/** Eyebrows: drawn over the fringe, as anime brows show through hair. */
export function KaitoBrows({ expression, moving }) {
  const f = useFace(expression, moving);
  return (
    <g className="kaito__brows">
      {[77, 123].map((x, i) => {
        const y = i ? f.browR : f.browL;
        // The inner ends (towards the nose) rise with browTilt: worried, pleading.
        const t = f.browTilt;
        return (
          <path
            key={x}
            d={i ? `M${x - 9} ${y - t}q10 ${-f.browArch - t / 2} 20 ${t}` : `M${x - 11} ${y}q10 ${-f.browArch - t / 2} 20 ${-t}`}
            fill="none"
            stroke={BROW}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".78"
          />
        );
      })}
      {f.sweat > 0.01 && (
        <path
          className="kaito__sweat"
          d="M152 84q8 11 0 14-8-3 0-14Z"
          fill="#a9d6f2"
          stroke="#6fa9d6"
          strokeWidth="1"
          opacity={f.sweat}
        />
      )}
    </g>
  );
}
