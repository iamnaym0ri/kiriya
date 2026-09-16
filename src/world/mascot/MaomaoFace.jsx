import { useId, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion";

const BASE = {
  top: 105,
  arch: 102,
  bottom: 119,
  lower: 125,
  open: 1,
  lookX: 0,
  lookY: 0,
  iris: 9,
  pupil: 4,
  shine: 2.6,
  browLeft: 97,
  browRight: 97,
  browTilt: 0,
  browArch: 2,
  leftLid: 0,
  rightLid: 0,
  closedCurve: -8,
  mouthWidth: 4,
  smile: 0,
  mouthOpen: 0,
  mouthTilt: 0,
  blush: 0.15,
  shade: 0,
  catSmile: 0,
};
const FACES = {
  deadpan: {},
  thinking: { lookX: -3, browLeft: 94, browArch: 4, mouthWidth: 4, smile: -2 },
  smug: {
    lookX: 2,
    leftLid: 1,
    browLeft: 94,
    mouthWidth: 7,
    smile: 3,
    mouthTilt: -3,
  },
  sparkle: {
    top: 103,
    arch: 88,
    bottom: 116,
    lower: 132,
    iris: 10,
    shine: 4,
    browLeft: 92,
    browRight: 92,
    mouthWidth: 7,
    smile: 2,
    mouthOpen: 6,
    blush: 0.3,
  },
  happy: { open: 0, closedCurve: -8, mouthWidth: 7, smile: 5, blush: 0.23 },
  sleepy: {
    open: 0,
    closedCurve: 5,
    mouthWidth: 3,
    mouthOpen: 5,
    browLeft: 100,
    browRight: 100,
  },
  party: {
    open: 0,
    closedCurve: -10,
    mouthWidth: 8,
    smile: 5,
    mouthOpen: 3,
    blush: 0.3,
  },
  ew: {
    top: 108,
    arch: 107,
    bottom: 119,
    lower: 122,
    pupil: 2.4,
    shine: 1,
    browLeft: 95,
    browRight: 95,
    browTilt: 6,
    browArch: 0,
    mouthWidth: 11,
    smile: -4,
    mouthOpen: 10,
    shade: 0.5,
  },
  herb: {
    top: 102,
    arch: 86,
    bottom: 117,
    lower: 134,
    iris: 10.5,
    pupil: 4.6,
    shine: 4.4,
    browLeft: 92,
    browRight: 92,
    mouthWidth: 14,
    smile: 3,
    mouthOpen: 12,
    blush: 0.58,
  },
  poison: {
    open: 0,
    closedCurve: -11,
    mouthWidth: 10,
    smile: 4,
    catSmile: 1,
    blush: 0.55,
  },
  curious: {
    lookX: 3,
    top: 104,
    arch: 100,
    browLeft: 93,
    browRight: 97,
    browArch: 4,
    mouthWidth: 4,
    smile: -1,
  },
  writing: { lookY: 3, leftLid: 1, rightLid: 1, mouthWidth: 4 },
  pleased: { open: 0, closedCurve: -6, mouthWidth: 7, smile: 4, blush: 0.23 },
  startled: {
    top: 100,
    arch: 84,
    bottom: 118,
    lower: 135,
    iris: 8.3,
    pupil: 3,
    shine: 3.4,
    browLeft: 89,
    browRight: 89,
    browArch: 5,
    mouthWidth: 4,
    mouthOpen: 10,
  },
  skeptical: {
    lookX: 3.5,
    leftLid: 0,
    rightLid: 4,
    browLeft: 91,
    browRight: 101,
    browArch: 5,
    mouthWidth: 5,
    mouthTilt: -1,
    smile: -1,
  },
  shy: {
    lookX: -3,
    lookY: 2,
    leftLid: 2,
    rightLid: 2,
    browLeft: 97,
    browRight: 97,
    mouthWidth: 5,
    smile: 2,
    blush: 0.43,
  },
  sniff: { open: 0, closedCurve: 3, mouthWidth: 4, smile: 1, blush: 0.25 },
  // Companion additions. The roaming companion needs a wider ordinary range than the greeting did:
  // most of its day is spent working, half-listening or quietly amused, not reacting to a prompt.
  focused: {
    lookY: 2,
    leftLid: 3,
    rightLid: 3,
    browLeft: 95,
    browRight: 95,
    browArch: 1,
    mouthWidth: 4,
    smile: -1,
  },
  fond: {
    leftLid: 2,
    rightLid: 2,
    browLeft: 99,
    browRight: 99,
    mouthWidth: 7,
    smile: 4,
    blush: 0.34,
  },
  amused: {
    lookX: 2,
    rightLid: 3,
    browLeft: 91,
    browRight: 99,
    browArch: 4,
    mouthWidth: 8,
    smile: 3,
    mouthTilt: -2,
  },
  alarmed: {
    top: 99,
    arch: 82,
    bottom: 118,
    lower: 136,
    iris: 8,
    pupil: 2.6,
    shine: 3,
    browLeft: 88,
    browRight: 90,
    browArch: 6,
    mouthWidth: 6,
    mouthOpen: 8,
  },
  proud: {
    lookY: -1,
    leftLid: 2,
    rightLid: 2,
    browLeft: 95,
    browRight: 95,
    mouthWidth: 8,
    smile: 4,
    mouthTilt: -1,
    blush: 0.2,
  },
  conspiratorial: {
    lookX: -3,
    leftLid: 4,
    rightLid: 4,
    browLeft: 95,
    browRight: 95,
    mouthWidth: 9,
    smile: 3,
    mouthTilt: -2,
    blush: 0.2,
  },
  unimpressed: {
    leftLid: 5,
    rightLid: 5,
    browLeft: 99,
    browRight: 99,
    browArch: 0,
    mouthWidth: 5,
    smile: 0,
  },
  delighted: {
    top: 102,
    arch: 87,
    bottom: 116,
    lower: 133,
    iris: 10.2,
    shine: 4.2,
    browLeft: 91,
    browRight: 91,
    mouthWidth: 10,
    smile: 3,
    mouthOpen: 8,
    blush: 0.42,
  },
};
// Shared with the "ask her something" route, which must offer exactly these and no others.
export { MAOMAO_EXPRESSIONS } from "../../../shared/maomaoExpressions.js";
const faceFor = (expression) => ({
  ...BASE,
  ...(FACES[expression] ?? FACES.deadpan),
});

// One continuous set of facial coordinates, including when a new reaction interrupts the last.
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
      return;
    }
    const from = latest.current;
    if (Object.keys(target).every((key) => target[key] === from[key])) return;
    const controls = animate(0, 1, {
      duration: 0.34,
      ease: [0.22, 0.72, 0.2, 1],
      onUpdate: (progress) =>
        update(
          Object.fromEntries(
            Object.keys(target).map((key) => [
              key,
              from[key] + (target[key] - from[key]) * progress,
            ]),
          ),
        ),
      onComplete: () => update(target),
    });
    return () => controls.stop();
  }, [expression, moving]);
  return face;
}

export default function MaomaoFace({ expression, moving }) {
  const id = useId();
  const f = useFace(expression, moving);
  const mouthY = 133;
  const left = 100 - f.mouthWidth,
    right = 100 + f.mouthWidth;
  const topMouth = `M${left} ${mouthY} Q100 ${mouthY + f.smile} ${right} ${mouthY + f.mouthTilt}`;
  const mouth = `${topMouth} Q100 ${mouthY + f.mouthOpen * 1.7 + f.smile} ${left} ${mouthY}Z`;
  return (
    <g className="mascot__face-rig">
      <defs>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#504879" />
          <stop offset=".5" stopColor="#7771b2" />
          <stop offset="1" stopColor="#80b9d4" />
        </linearGradient>
        <radialGradient id={`${id}-blush`}>
          <stop stopColor="#e795ab" stopOpacity=".95" />
          <stop offset="1" stopColor="#e795ab" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#776b91" />
          <stop offset="1" stopColor="#776b91" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse
        cx="64"
        cy="127"
        rx="13"
        ry="8"
        fill={`url(#${id}-blush)`}
        opacity={f.blush}
      />
      <ellipse
        cx="136"
        cy="127"
        rx="13"
        ry="8"
        fill={`url(#${id}-blush)`}
        opacity={f.blush}
      />
      <path d="M57 95h86v34H57Z" fill={`url(#${id}-shade)`} opacity={f.shade} />
      {[77, 123].map((x, i) => {
        const lid = i ? f.rightLid : f.leftLid;
        const outline = `M${x - 13} ${f.top + lid} C${x - 7} ${f.arch + lid} ${x + 7} ${f.arch + lid} ${x + 13} ${f.top + lid} L${x + 13} ${f.bottom} C${x + 7} ${f.lower} ${x - 7} ${f.lower} ${x - 13} ${f.bottom}Z`;
        const lidLine = `M${x - 14} ${f.top + lid} C${x - 7} ${f.arch + lid - 1} ${x + 7} ${f.arch + lid - 1} ${x + 14} ${f.top + lid}`;
        const browY = i ? f.browRight : f.browLeft;
        return (
          <g key={x} className="mascot__eye-rig">
            <defs>
              <clipPath id={`${id}-eye-${i}`}>
                <path className="mascot__aperture" d={outline} />
              </clipPath>
              <clipPath id={`${id}-blink-${i}`}>
                <rect
                  className="mascot__blink-mask"
                  x={x - 18}
                  y="84"
                  width="36"
                  height="51"
                />
              </clipPath>
            </defs>
            <g opacity={f.open}>
              <g clipPath={`url(#${id}-blink-${i})`}>
                <path d={outline} fill="#fffaf7" />
                <g clipPath={`url(#${id}-eye-${i})`}>
                  <g className="mascot__iris-gaze">
                    <ellipse
                      cx={x + f.lookX}
                      cy={111 + f.lookY}
                      rx={f.iris}
                      ry="15"
                      fill={`url(#${id}-iris)`}
                    />
                    <ellipse
                      cx={x + f.lookX}
                      cy={110 + f.lookY}
                      rx={f.pupil}
                      ry="8"
                      fill="#343251"
                    />
                    <path
                      d={`M${x - 6 + f.lookX} ${119 + f.lookY}q6 6 12 0`}
                      fill="none"
                      stroke="#b4e7e6"
                      strokeWidth="1.2"
                      opacity=".8"
                    />
                    <circle
                      cx={x + f.lookX + 3.5}
                      cy={104 + f.lookY}
                      r={f.shine}
                      fill="#fffdfb"
                    />
                    <circle
                      cx={x + f.lookX - 4}
                      cy={117 + f.lookY}
                      r="1.8"
                      fill="#e9f7ff"
                    />
                    <circle
                      cx={x + f.lookX - 3}
                      cy={108 + f.lookY}
                      r="1.2"
                      fill="#dac3ed"
                    />
                  </g>
                  <path
                    d={lidLine}
                    stroke="#303740"
                    strokeWidth="6"
                    opacity=".1"
                    fill="none"
                  />
                </g>
                <path
                  className="mascot__upper-lid"
                  d={lidLine}
                  stroke="#303b42"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={
                    i
                      ? `m${x + 12} ${f.top + lid}-1-3`
                      : `m${x - 12} ${f.top + lid}-3-2`
                  }
                  stroke="#303b42"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </g>
              <path
                className="mascot__blink-line"
                d={`M${x - 11} 112q11 3 22 0`}
                fill="none"
                stroke="#303b42"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </g>
            <path
              d={`M${x - 11} 112q11 ${f.closedCurve} 22 0`}
              opacity={1 - f.open}
              fill="none"
              stroke="#303b42"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={`M${x - 13} ${browY}q13 ${-f.browArch} 26 ${i ? -f.browTilt : f.browTilt}`}
              fill="none"
              stroke="#3d544e"
              strokeWidth="1.65"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <path
        d="m99 123 2 1.5-2 1"
        fill="none"
        stroke="#d7ad97"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <g className="mascot__mouth">
        <path d={mouth} fill="#a86076" opacity={Math.min(1, f.mouthOpen)} />
        <path
          className="mascot__mouth-line"
          d={topMouth}
          fill="none"
          stroke="#975b70"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={1 - f.catSmile}
        />
        <path
          d="M90 132q5 8 10 1 5 7 10-1"
          fill="none"
          stroke="#a45e75"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={f.catSmile}
        />
        <path
          d={`M${left + 3} 134q${f.mouthWidth - 3} 3 ${Math.max(0, f.mouthWidth * 2 - 6)} 0`}
          stroke="#fff4e8"
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity={Math.max(0, (f.mouthOpen - 8) / 5)}
          fill="none"
        />
      </g>
    </g>
  );
}
