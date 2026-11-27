import { useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion";

// Hatsune Miku's face rig, built the same way as Maomao's (src/world/mascot/MaomaoFace.jsx): one set
// of numbers per expression, eased from one to the next, so the house chibi family moves alike.
// Her eyes are rounder and brighter than Maomao's half-lidded ones, with teal irises and teal brows.

const EYES = [87, 133];
const EYE_Y = 119;
const MOUTH_Y = 142;

const BASE = {
  top: 108, // upper lid at the corners
  arch: 100, // upper lid at the top of the curve
  bottom: 125,
  lower: 133,
  open: 1, // 0 = both eyes closed (arcs)
  wink: 0, // closes her left eye (viewer's right) only
  closedCurve: -7, // closed eyes: negative = happy ^ arcs, positive = sleepy u arcs
  lookX: 0,
  lookY: 0,
  iris: 10.5,
  pupil: 4.6,
  shine: 3.3,
  star: 0, // sparkle in the eyes
  browY: 96,
  browTilt: 0, // + = inner ends up (worried), - = inner ends down (cross)
  browArch: 2.4,
  lid: 0, // lowers both upper lids
  cross: 0, // > < eyes
  mouthWidth: 5,
  smile: 3,
  mouthOpen: 0,
  mouthTilt: 0,
  round: 0, // an "o" mouth
  cat: 0, // a little w mouth
  pout: 0,
  tongue: 0,
  blush: 0.22,
  sweat: 0,
};

const FACES = {
  happy: { mouthWidth: 6, smile: 4, mouthOpen: 2, blush: 0.28 },
  joy: { open: 0, closedCurve: -8, mouthWidth: 8, smile: 4, mouthOpen: 9, tongue: 1, blush: 0.42, browY: 93 },
  sing: { open: 0, closedCurve: -4, browY: 94, browArch: 3, mouthWidth: 4, round: 1, mouthOpen: 8, blush: 0.32 },
  hum: { open: 0, closedCurve: -5, mouthWidth: 4, smile: 2, cat: 0.0, blush: 0.3 },
  wink: { wink: 1, closedCurve: -8, lookX: 1, mouthWidth: 7, smile: 4, mouthOpen: 6, tongue: 1, blush: 0.34 },
  surprised: {
    top: 106, arch: 96, bottom: 126, lower: 136, iris: 9.4, pupil: 3.2, shine: 3.6,
    browY: 90, browArch: 4, mouthWidth: 3, round: 1, mouthOpen: 7, smile: 0, blush: 0.18,
  },
  pout: {
    lid: 3, lookX: -2, browY: 97, browTilt: -3, mouthWidth: 3, smile: -1, pout: 1, blush: 0.5,
  },
  shy: { lookX: -3, lookY: 3, lid: 3, browY: 97, browTilt: 2, mouthWidth: 4, smile: 2, blush: 0.62 },
  sleepy: { lid: 7, lookY: 2, browY: 99, browArch: 1, mouthWidth: 3, smile: 1, mouthOpen: 2, blush: 0.2 },
  asleep: { open: 0, closedCurve: 4, browY: 99, browArch: 1, mouthWidth: 3, round: 0.6, mouthOpen: 4, smile: 0, blush: 0.26 },
  flustered: { cross: 1, open: 0, closedCurve: 0, browY: 92, browTilt: 3, mouthWidth: 6, smile: -1, mouthOpen: 6, blush: 0.6, sweat: 1 },
  love: { star: 1, iris: 11, shine: 4.2, browY: 93, mouthWidth: 8, smile: 5, mouthOpen: 7, tongue: 1, blush: 0.55 },
  thinking: { lookX: 4, lookY: -4, browY: 95, browTilt: 0, browArch: 4, mouthWidth: 3, smile: 0, mouthTilt: -2, blush: 0.2 },
  proud: { open: 0, closedCurve: -6, browY: 93, browArch: 3, mouthWidth: 8, smile: 5, mouthOpen: 4, mouthTilt: -1, blush: 0.3 },
  soft: { lid: 4, browY: 97, browTilt: 1, mouthWidth: 5, smile: 4, blush: 0.5 },
  giggle: { open: 0, closedCurve: -8, mouthWidth: 5, cat: 1, smile: 2, blush: 0.45 },
  wistful: { lid: 2, lookY: 2, browY: 95, browTilt: 3, mouthWidth: 4, smile: 1, blush: 0.3 },
  determined: { lid: 1, browY: 95, browTilt: -3, mouthWidth: 7, smile: 3, mouthOpen: 3, blush: 0.25 },
};

export const MIKU_EXPRESSIONS = Object.keys(FACES);

const faceFor = (expression) => ({ ...BASE, ...(FACES[expression] ?? FACES.happy) });

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

const LASH = "#24323d";
const BROW = "#178f96";

// Drawn in three passes so each blink is one animation for both eyes: the open eyes, the blink
// lines, then whatever stays put (closed arcs, > <, brows).
function Eye({ x, i, f, uid, part }) {
  // i = 0 her right eye (viewer's left), 1 her left eye (viewer's right).
  const outer = i ? 1 : -1;
  const openness = Math.max(0, f.open * (i ? 1 - f.wink : 1) - f.cross);
  const top = f.top + f.lid;
  const arch = f.arch + f.lid * 1.4;
  const outline = `M${x - 14} ${top} C${x - 8} ${arch} ${x + 8} ${arch} ${x + 14} ${top} L${x + 13.5} ${f.bottom} C${x + 8} ${f.lower} ${x - 8} ${f.lower} ${x - 13.5} ${f.bottom}Z`;
  const lidLine = `M${x - 15} ${top + 1} C${x - 8} ${arch - 1} ${x + 8} ${arch - 1} ${x + 15} ${top + 1}`;
  const ix = x + f.lookX;
  const iy = EYE_Y + f.lookY;
  const closed = `M${x - 11} ${EYE_Y + 2} q11 ${f.closedCurve} 22 0`;
  const crossPath = i
    ? `M${x + 9} ${EYE_Y - 6} l-12 6 12 6`
    : `M${x - 9} ${EYE_Y - 6} l12 6 -12 6`;
  if (part === "blink") {
    return (
      <path
        d={`M${x - 12} ${EYE_Y + 3}q12 3 24 0`}
        opacity={openness}
        fill="none"
        stroke={LASH}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    );
  }
  if (part === "open") {
    return (
      <g opacity={openness}>
        <defs>
          <clipPath id={`${uid}-eye${i}`}>
            <path d={outline} />
          </clipPath>
        </defs>
          <path d={outline} fill="#fffdfb" />
          <g clipPath={`url(#${uid}-eye${i})`}>
            <ellipse cx={ix} cy={iy} rx={f.iris} ry="14.5" fill={`url(#${uid}-iris)`} />
            <ellipse cx={ix} cy={iy - 1} rx={f.pupil} ry="7.6" fill="#0b3f4a" />
            <path d={`M${ix - 7} ${iy + 8}q7 5 14 0`} fill="none" stroke="#b8fff3" strokeWidth="1.6" opacity=".85" />
            <circle cx={ix + 4} cy={iy - 6} r={f.shine} fill="#fff" />
            <circle cx={ix - 4.5} cy={iy + 6} r="1.7" fill="#eafffb" />
            {f.star > 0.05 && (
              <path
                d={`M${ix - 3} ${iy - 3}l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4Z`}
                fill="#fff"
                opacity={f.star}
              />
            )}
            <path d={lidLine} stroke="#1d5560" strokeWidth="7" opacity=".14" fill="none" />
          </g>
          <path d={lidLine} stroke={LASH} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path
            d={`M${x + 15 * outer} ${top + 1}l${3.6 * outer} 2.6`}
            stroke={LASH}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d={`M${x + 12.5 * outer} ${f.bottom + 2}q${-2 * outer} 3.4 ${-5 * outer} 4.6`}
            stroke="#2b5a63"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity=".55"
          />
      </g>
    );
  }
  return (
    <g>
      <path
        d={closed}
        opacity={Math.max(0, 1 - openness - f.cross)}
        fill="none"
        stroke={LASH}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={crossPath}
        opacity={f.cross}
        fill="none"
        stroke={LASH}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${x - 11} ${f.browY + (i ? -f.browTilt : f.browTilt) * 0.2}q11 ${-f.browArch} 22 ${i ? -f.browTilt : f.browTilt}`}
        fill="none"
        stroke={BROW}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </g>
  );
}

export default function MikuFace({ expression, moving, talking, uid }) {
  const f = useFace(expression, moving);
  const left = 110 - f.mouthWidth;
  const right = 110 + f.mouthWidth;
  const y = MOUTH_Y;
  const topLine = `M${left} ${y} Q110 ${y + f.smile} ${right} ${y + f.mouthTilt}`;
  const open = Math.max(0, f.mouthOpen * (1 - f.round) * (1 - f.cat));
  const mouth = `${topLine} Q110 ${y + open * 1.6 + f.smile} ${left} ${y}Z`;
  const roundRx = 2.6 + f.mouthWidth * 0.35;
  return (
    <g className="hmiku__face">
      <ellipse cx="70" cy="135" rx="12" ry="7" fill={`url(#${uid}-blush)`} opacity={f.blush} />
      <ellipse cx="150" cy="135" rx="12" ry="7" fill={`url(#${uid}-blush)`} opacity={f.blush} />
      {f.blush > 0.45 && (
        <g stroke="#ee8ea6" strokeWidth="1.2" strokeLinecap="round" opacity={(f.blush - 0.45) * 3}>
          <path d="M64 133l-2 4m6-4-2 4m6-4-2 4M146 133l-2 4m6-4-2 4m6-4-2 4" />
        </g>
      )}
      <g className="hmiku__eyes-open" style={{ transformOrigin: `110px ${EYE_Y + 4}px` }}>
        {EYES.map((x, i) => (
          <Eye key={x} x={x} i={i} f={f} uid={uid} part="open" />
        ))}
      </g>
      <g className="hmiku__blinks">
        {EYES.map((x, i) => (
          <Eye key={x} x={x} i={i} f={f} uid={uid} part="blink" />
        ))}
      </g>
      {EYES.map((x, i) => (
        <Eye key={x} x={x} i={i} f={f} uid={uid} part="rest" />
      ))}
      <path d="M109.4 131.6l1.4.9" stroke="#e2b3a2" strokeWidth="1.3" strokeLinecap="round" />
      <g className="hmiku__mouth" style={{ transformOrigin: `110px ${y}px` }}>
        {/* open smile */}
        <path d={mouth} fill="#b84f67" opacity={Math.min(1, open / 2)} />
        {f.tongue > 0 && open > 3 && (
          <path
            d={`M${110 - f.mouthWidth * 0.45} ${y + open * 1.1 + f.smile * 0.6}q${f.mouthWidth * 0.45} ${-3} ${f.mouthWidth * 0.9} 0q${-f.mouthWidth * 0.45} ${3.5} ${-f.mouthWidth * 0.9} 0Z`}
            fill="#f08c9c"
            opacity={f.tongue * Math.min(1, (open - 3) / 3)}
          />
        )}
        <path
          d={topLine}
          fill="none"
          stroke="#9c4a5d"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={(1 - f.round) * (1 - f.cat) * (1 - f.pout)}
        />
        {/* round "o" for singing and surprise */}
        <ellipse
          className="hmiku__mouth-o"
          cx="110"
          cy={y + 2.6}
          rx={roundRx}
          ry={2 + f.mouthOpen * 0.42}
          fill="#b84f67"
          stroke="#9c4a5d"
          strokeWidth="1.4"
          opacity={f.round}
          style={{ transformOrigin: `110px ${y}px` }}
        />
        {/* the little w */}
        <path
          d="M102 141q4 5 8 0 4 5 8 0"
          fill="none"
          stroke="#9c4a5d"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={f.cat}
        />
        {/* pout: a small pushed-out mouth and a puffed cheek */}
        <path d="M106.5 143q3.5-3 7 0" fill="none" stroke="#9c4a5d" strokeWidth="2" strokeLinecap="round" opacity={f.pout} />
        <path d="M151 128q9 8 1 16" fill="none" stroke="#e9b6a6" strokeWidth="1.4" strokeLinecap="round" opacity={f.pout} />
      </g>
      {talking && open < 3 && f.round < 0.5 && f.cat < 0.5 && (
        // a little moving mouth while her bubble is up, for faces whose mouth is otherwise closed
        <ellipse
          className="hmiku__talk"
          cx="110"
          cy={y + 2.2 + f.smile * 0.4}
          rx={Math.max(2.6, f.mouthWidth * 0.55)}
          ry="2.8"
          fill="#b84f67"
          style={{ transformOrigin: `110px ${y + 1}px` }}
        />
      )}
      {f.sweat > 0.05 && (
        <path d="M158 102q7 10 0 12-7-2 0-12Z" fill="#a9dcf0" stroke="#7ab8d0" strokeWidth=".8" opacity={f.sweat} />
      )}
    </g>
  );
}
