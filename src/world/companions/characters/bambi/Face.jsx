// Bamby's face: the house chibi face (the same eye rig, lash weight and blush as Maomao's), with
// his own pink-violet eyes, a sharper lash flick and a cheekier mouth. Expressions are discrete
// sets of numbers, swapped instantly: snappy suits him, and nothing re-renders per frame.
// Fan art: Bamby (PLAVE) © VLAST. Research notes live in the lab, not here.

export const EYE_Y = 113;
const EYES_X = [77, 123];
const INK = "#3b2440";
const BROW = "#a1497a";

const BASE = {
  eyes: "open", // open | happy | sleep | squeeze | wink | star
  lid: 0, // upper lid lowered by this much (half-lidded = cool)
  look: [0, 0],
  iris: 1, // iris scale (small = alarmed)
  shine: 3,
  brow: 0, // up (negative) or down (positive)
  browTilt: 0, // inner ends down (+, cross) or up (-, worried)
  mouth: "smile", // smile | grin | open | o | cat | pout | smirk | flat | munch | wobble
  blush: 0.35,
  tear: false,
  sweat: false,
};

const FACES = {
  neutral: {},
  happy: { eyes: "happy", mouth: "grin", blush: 0.5 },
  grin: { look: [1.5, 0], shine: 3.6, mouth: "grin", blush: 0.45, brow: -1.5 },
  sparkle: { eyes: "star", mouth: "open", blush: 0.55, brow: -3, iris: 1.05 },
  wink: { eyes: "wink", mouth: "cat", blush: 0.5, brow: -1 },
  cool: { lid: 5, look: [2.5, 0], mouth: "smirk", brow: 1, browTilt: 1.5, blush: 0.25 },
  squeeze: { eyes: "squeeze", mouth: "wobble", blush: 0.55, brow: 1, browTilt: -2 },
  surprised: { iris: 0.82, shine: 2.4, mouth: "o", brow: -5, blush: 0.3 },
  scared: { iris: 0.7, shine: 2, mouth: "wobble", brow: -2, browTilt: -4, blush: 0.2, sweat: true },
  teary: { look: [0, 1], shine: 4.4, mouth: "wobble", brow: -1, browTilt: -4, blush: 0.65, tear: true },
  pout: { look: [-2, 1], lid: 2, mouth: "pout", brow: 1.5, browTilt: 2.5, blush: 0.5 },
  sleepy: { eyes: "sleep", mouth: "o", blush: 0.4, brow: 1 },
  focused: { lid: 2, look: [0, 1.5], mouth: "flat", brow: 1.5, browTilt: 2, blush: 0.3 },
  munch: { eyes: "happy", mouth: "munch", blush: 0.6 },
  fond: { lid: 2.5, mouth: "smile", blush: 0.7, brow: -0.5, browTilt: -1 },
  proud: { eyes: "happy", mouth: "smirk", blush: 0.4, brow: -2 },
  sulky: { lid: 3, look: [-3, 0], mouth: "pout", brow: 2, browTilt: 3, blush: 0.4 },
  curious: { look: [3, -1], mouth: "o", brow: -2, browTilt: -1, blush: 0.35 },
  sing: { eyes: "happy", mouth: "open", blush: 0.5, brow: -2.5 },
  flirty: { lid: 3, look: [2, 0.5], shine: 3.8, mouth: "smirk", blush: 0.65, brow: -1.5, browTilt: -0.5 },
  shy: { look: [-3, 2], lid: 1.5, mouth: "cat", blush: 0.85, brow: -1, browTilt: -2 },
};

export const BAMBY_EXPRESSIONS = Object.keys(FACES);
export const faceFor = (expression) => ({ ...BASE, ...(FACES[expression] ?? FACES.neutral) });

function OpenEye({ x, face, ids, wink }) {
  const [lx, ly] = face.look;
  const lid = face.lid;
  const top = 106 + lid;
  // Almond aperture with the outer corner lifted a touch: a boy's eye in the same family as hers.
  const inner = x < 100 ? 1 : -1; // direction towards the nose
  const outerX = x - inner * 13;
  const innerX = x + inner * 12;
  const outline = `M${outerX} ${top - 1} C${x - 7} ${99 + lid} ${x + 7} ${99 + lid} ${innerX} ${top + 1} L${innerX} 119 C${x + 6} 124.5 ${x - 6} 124.5 ${outerX} 118Z`;
  const lash = `M${outerX - inner * 1.5} ${top - 1.5} C${x - 7} ${98.6 + lid} ${x + 7} ${98.6 + lid} ${innerX + inner} ${top + 1.2}`;
  const flick = `M${outerX - inner * 1} ${top - 1} l${-inner * 3.4} -2.6`;
  if (wink) {
    return (
      <path d={`M${x - 11} ${EYE_Y + 1}q11 -7 22 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    );
  }
  const r = face.iris;
  return (
    <g className="bamby__eye">
      <clipPath id={ids.clip}>
        <path d={outline} />
      </clipPath>
      <g className="bamby__eye-open" style={{ transformOrigin: `${x}px ${EYE_Y}px` }}>
        <path d={outline} fill="#fffafc" />
        <g clipPath={`url(#${ids.clip})`}>
          <ellipse cx={x + lx} cy={113 + ly} rx={9 * r} ry={13 * r} fill={`url(#${ids.iris})`} />
          <ellipse cx={x + lx} cy={111.5 + ly} rx={4 * r} ry={7 * r} fill="#3d1239" />
          <path d={`M${x - 6 * r + lx} ${119 + ly}q${6 * r} ${5 * r} ${12 * r} 0`} fill="none" stroke="#ffc9e4" strokeWidth="1.3" opacity=".9" />
          {face.eyes === "star" ? (
            <path
              d={`m${x + 3 + lx} ${104 + ly} 1.4 3.4 3.6.3-2.8 2.3.9 3.5-3.1-1.9-3.1 1.9.9-3.5-2.8-2.3 3.6-.3Z`}
              fill="#fffdfb"
            />
          ) : (
            <circle cx={x + 3.5 + lx} cy={106 + ly} r={face.shine} fill="#fffdfb" />
          )}
          <circle cx={x - 3.5 + lx} cy={118 + ly} r="1.6" fill="#fff0f8" />
          {/* The upper lid's shadow on the eyeball, so the eye reads as round, not pasted on. */}
          <path d={lash} stroke="#5a2a50" strokeWidth="6" opacity=".12" fill="none" />
        </g>
        <path d={lash} stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d={flick} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={`M${outerX + inner * 3} 121.5q${inner * 5} 2.4 ${inner * 9} 2`} stroke="#b77a95" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
      <path
        className="bamby__blink"
        d={`M${x - 11} ${EYE_Y}q11 3 22 0`}
        fill="none"
        stroke={INK}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </g>
  );
}

function ClosedEye({ x, kind }) {
  const inner = x < 100 ? 1 : -1;
  if (kind === "squeeze") {
    // > <, squeezed tight (the windup before the flowers, or a scared flinch).
    const d =
      inner > 0
        ? `M${x - 9} ${EYE_Y - 7}l14 6.5-14 6.5`
        : `M${x + 9} ${EYE_Y - 7}l-14 6.5 14 6.5`;
    return <path d={d} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (kind === "sleep") {
    return (
      <path d={`M${x - 11} ${EYE_Y + 1}q11 6 22 0`} fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
    );
  }
  // happy: ^ ^ with a little lash tail.
  return (
    <path
      d={`M${x - 11} ${EYE_Y + 3}q11 -11 22 0`}
      fill="none"
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
    />
  );
}

function Mouth({ kind }) {
  const y = 137;
  switch (kind) {
    case "grin":
      return (
        <g>
          <path d={`M91 ${y - 1}q9 1.5 18 0q-1.5 9.5-9 9.5t-9-9.5Z`} fill="#b24d78" />
          <path d={`M93 ${y + 5.5}q7-3 14 0q-3 3-7 3t-7-3Z`} fill="#f08cae" />
          <path d={`M92.5 ${y}h15`} stroke="#fff6f2" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "open":
      return (
        <g>
          <path d={`M93 ${y - 1}q7 1 14 0q-1 8-7 8t-7-8Z`} fill="#b24d78" />
          <path d={`M95 ${y + 4.5}q5-2.4 10 0q-2 2.6-5 2.6t-5-2.6Z`} fill="#f08cae" />
        </g>
      );
    case "o":
      return <ellipse cx="100" cy={y + 1.5} rx="3.6" ry="4.2" fill="#b24d78" />;
    case "cat":
      return <path d={`M92 ${y - 1}q4 5 8 0 4 5 8 0`} fill="none" stroke="#9b4a6e" strokeWidth="2.1" strokeLinecap="round" />;
    case "pout":
      return (
        <path d={`M96 ${y + 1}q2-3 4 0 2 3 4 0`} fill="none" stroke="#9b4a6e" strokeWidth="2.1" strokeLinecap="round" />
      );
    case "smirk":
      return <path d={`M94 ${y + 1}q7 2 13-3`} fill="none" stroke="#9b4a6e" strokeWidth="2.2" strokeLinecap="round" />;
    case "flat":
      return <path d={`M95.5 ${y}h9`} fill="none" stroke="#9b4a6e" strokeWidth="2" strokeLinecap="round" />;
    case "munch":
      return (
        <g className="bamby__munch">
          <path d={`M94 ${y}q6 3 12 0`} fill="none" stroke="#9b4a6e" strokeWidth="2.1" strokeLinecap="round" />
        </g>
      );
    case "wobble":
      return (
        <path
          d={`M92 ${y + 2}q2-3 4 0t4 0 4 0 4 0`}
          fill="none"
          stroke="#9b4a6e"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    default:
      return <path d={`M94 ${y - 0.5}q6 5 12 0`} fill="none" stroke="#9b4a6e" strokeWidth="2.2" strokeLinecap="round" />;
  }
}

/** Brows sit over the fringe (anime convention), so they always read: drawn after the hair. */
export function BambyBrows({ expression }) {
  const face = faceFor(expression);
  return (
    <g className="bamby__brows">
      {EYES_X.map((x, i) => {
        const inner = i === 0 ? 1 : -1;
        const y = 96 + face.brow;
        const tilt = face.browTilt;
        return (
          <path
            key={x}
            d={`M${x - inner * 11} ${y + (tilt < 0 ? tilt * 0.4 : 0)}Q${x} ${y - 3.2} ${x + inner * 10} ${y + tilt}`}
            fill="none"
            stroke={BROW}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

export default function BambyFace({ expression, ids }) {
  const face = faceFor(expression);
  const closed = face.eyes === "happy" || face.eyes === "sleep" || face.eyes === "squeeze";
  return (
    <g className="bamby__face" data-eyes={face.eyes} data-mouth={face.mouth}>
      <ellipse cx="63" cy="130" rx="12" ry="7" fill={`url(#${ids.blush})`} opacity={face.blush} />
      <ellipse cx="137" cy="130" rx="12" ry="7" fill={`url(#${ids.blush})`} opacity={face.blush} />
      {face.blush > 0.5 && (
        <path d="M58 129l3-3m3 3 3-3m69 3 3-3m3 3 3-3" stroke="#e7849f" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
      )}
      {EYES_X.map((x, i) =>
        closed ? (
          <ClosedEye key={x} x={x} kind={face.eyes} />
        ) : (
          <OpenEye
            key={x}
            x={x}
            face={face}
            wink={face.eyes === "wink" && i === 1}
            ids={{ clip: `${ids.base}-eye${i}`, iris: ids.iris }}
          />
        ),
      )}
      <path d="M99.5 127.5l1.8 1.4-1.8 1" fill="none" stroke="#d9a18c" strokeWidth="1.15" strokeLinecap="round" />
      <Mouth kind={face.mouth} />
      {/* While his bubble is up the mouth flaps between its own shape and a small open one. */}
      <g className="bamby__talk">
        <path d="M94.5 136q5.5 1 11 0q-1 6.5-5.5 6.5t-5.5-6.5Z" fill="#b24d78" />
        <path d="M96.5 140q3.5-1.6 7 0q-1.5 2-3.5 2t-3.5-2Z" fill="#f08cae" />
      </g>
      {face.tear && (
        <g className="bamby__tears" fill="#bfe3ff" stroke="#8fb8de" strokeWidth=".8">
          <path d="M62 121q4 6 0 9-4-3 0-9Z" />
          <path d="M138 121q4 6 0 9-4-3 0-9Z" />
        </g>
      )}
      {face.sweat && <path className="bamby__sweat" d="M158 96q7 10 0 12-7-2 0-12Z" fill="#bfe3ff" stroke="#8fb8de" strokeWidth=".8" />}
    </g>
  );
}
