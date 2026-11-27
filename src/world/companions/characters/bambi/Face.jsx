// Bamby's face, after his official look (VLAST's profile and concept art, 2023–2026): a round face
// with pink in the cheeks, big deer eyes in pink-violet with a strong upper lash line that runs out
// past the corner, a soft lid crease, dark straight brows (darker than his hair, they show through
// the fringe), a small mouth. The house chibi rig: discrete sets of numbers per expression, swapped
// instantly (snappy suits him), nothing re-renders per frame.
// The expressions fans know him for are here as well as the everyday ones: the deadpan stare of the
// "frozen peach" first impression (blank), the sudden yell out of nowhere (yell), the puffed cheeks
// that set off his birthday ability (puff), the squeeze before his flowers (squeeze), the wink of
// the ending fairy, and the happy crying. Fan art: Bamby (PLAVE) © VLAST.

export const EYE_Y = 114;
const EYES_X = [76, 124];
const INK = "#2c1428"; // lash line
const BROW = "#4a2840"; // dark plum-brown, darker than the hair
const CREASE = "#c78aa6";

const BASE = {
  eyes: "open", // open | happy | sleep | squeeze | wink | star
  lid: 0, // upper lid lowered by this much (half-lidded = cool)
  look: [0, 0],
  iris: 1, // iris scale (small = alarmed)
  shine: 3.2,
  brow: 0, // up (negative) or down (positive)
  browTilt: 0, // inner ends down (+, cross) or up (-, worried)
  mouth: "smile", // smile | grin | open | o | cat | pout | smirk | flat | munch | wobble | yell | puff
  blush: 0.45,
  tear: false,
  sweat: false,
  shout: false,
  puff: false,
};

const FACES = {
  neutral: {},
  happy: { eyes: "happy", mouth: "grin", blush: 0.6 },
  grin: { look: [1.5, 0], shine: 3.6, mouth: "grin", blush: 0.5, brow: -1.5 },
  sparkle: { eyes: "star", mouth: "open", blush: 0.6, brow: -3, iris: 1.05 },
  wink: { eyes: "wink", mouth: "cat", blush: 0.55, brow: -1 },
  cool: { lid: 4.5, look: [2.5, 0], mouth: "smirk", brow: 1, browTilt: 1.2, blush: 0.3 },
  squeeze: { eyes: "squeeze", mouth: "wobble", blush: 0.6, brow: 1, browTilt: -2 },
  surprised: { iris: 0.82, shine: 2.4, mouth: "o", brow: -5, blush: 0.35 },
  scared: { iris: 0.7, shine: 2, mouth: "wobble", brow: -2, browTilt: -4, blush: 0.25, sweat: true },
  teary: { look: [0, 1], shine: 4.6, mouth: "wobble", brow: -1, browTilt: -4, blush: 0.7, tear: true },
  pout: { look: [-2, 1], lid: 2, mouth: "pout", brow: 1.5, browTilt: 2.5, blush: 0.55 },
  sleepy: { eyes: "sleep", mouth: "o", blush: 0.45, brow: 1 },
  focused: { lid: 2.5, look: [0, 1.5], mouth: "flat", brow: 1.5, browTilt: 2, blush: 0.35 },
  munch: { eyes: "happy", mouth: "munch", blush: 0.65 },
  fond: { lid: 2.5, mouth: "smile", blush: 0.75, brow: -0.5, browTilt: -1 },
  proud: { eyes: "happy", mouth: "smirk", blush: 0.45, brow: -2 },
  sulky: { lid: 3, look: [-3, 0], mouth: "pout", brow: 2, browTilt: 3, blush: 0.45 },
  curious: { look: [3, -1], mouth: "o", brow: -2, browTilt: -1, blush: 0.4 },
  sing: { eyes: "happy", mouth: "open", blush: 0.55, brow: -2.5 },
  flirty: { lid: 3, look: [2, 0.5], shine: 3.8, mouth: "smirk", blush: 0.7, brow: -1.5, browTilt: -0.5 },
  shy: { look: [-3, 2], lid: 1.5, mouth: "cat", blush: 0.9, brow: -1, browTilt: -2 },
  // The frozen-peach stare: wide, still, giving nothing away (and then something absurd).
  blank: { iris: 0.92, shine: 2.6, mouth: "flat", blush: 0.2, brow: -0.5 },
  // A yell out of nowhere: small irises, brows down, mouth wide open.
  yell: { iris: 0.72, shine: 2.2, mouth: "yell", brow: 2.5, browTilt: 3.5, blush: 0.55, shout: true },
  // Cheeks full of air (his birthday ability goes off when he puffs them).
  puff: { eyes: "squeeze", mouth: "puff", blush: 0.85, brow: -1, browTilt: -1, puff: true },
};

export const BAMBY_EXPRESSIONS = Object.keys(FACES);
export const faceFor = (expression) => ({ ...BASE, ...(FACES[expression] ?? FACES.neutral) });

function OpenEye({ x, face, ids, wink }) {
  const [lx, ly] = face.look;
  const lid = face.lid;
  const top = 105.5 + lid;
  // Big round deer eyes: a tall almond, the inner corner a touch lower, the outer corner square.
  const inner = x < 100 ? 1 : -1; // direction towards the nose
  const oX = x - inner * 13.5;
  const iX = x + inner * 11.5;
  const outline = `M${oX} ${top}C${oX + inner * 4} ${top - 6.5} ${iX - inner * 6} ${top - 7} ${iX} ${top + 1.5}L${iX} 121C${iX - inner * 3} 128 ${oX + inner * 6} 128.5 ${oX + inner * 0.5} 120Z`;
  const lash = `M${oX - inner * 2.2} ${top + 1.6}C${oX + inner * 3.5} ${top - 6.8} ${iX - inner * 6} ${top - 7.6} ${iX + inner * 0.6} ${top + 1.2}`;
  // The liner runs out past the outer corner, square and a little down.
  const flick = `M${oX - inner * 1.6} ${top + 1.2}l${-inner * 4.2} 1.8`;
  const crease = `M${oX + inner * 3} ${top - 5.6}C${x - inner * 2} ${top - 11} ${iX - inner * 5} ${top - 10.4} ${iX - inner * 0.5} ${top - 5}`;
  if (wink) {
    return (
      <g>
        <path d={`M${x - 12} ${EYE_Y + 1}q12 -8 24 0`} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        <path d={`M${oX - inner * 1} ${EYE_Y - 0.5}l${-inner * 3.6} -1.6`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  const r = face.iris;
  return (
    <g className="bamby__eye">
      <clipPath id={ids.clip}>
        <path d={outline} />
      </clipPath>
      <path d={crease} fill="none" stroke={CREASE} strokeWidth="1.1" strokeLinecap="round" opacity=".75" />
      <g className="bamby__eye-open" style={{ transformOrigin: `${x}px ${EYE_Y}px` }}>
        <path d={outline} fill="#fffafd" />
        <g clipPath={`url(#${ids.clip})`}>
          <ellipse cx={x + lx} cy={115 + ly} rx={10.2 * r} ry={13.4 * r} fill={`url(#${ids.iris})`} />
          <ellipse cx={x + lx} cy={115 + ly} rx={10.2 * r} ry={13.4 * r} fill="none" stroke="#6e1f5e" strokeWidth="1.1" opacity=".7" />
          <ellipse cx={x + lx} cy={113 + ly} rx={4.4 * r} ry={7.2 * r} fill="#2e0b2b" />
          <path d={`M${x - 6.6 * r + lx} ${121 + ly}q${6.6 * r} ${5.6 * r} ${13.2 * r} 0`} fill="none" stroke="#ffd0ea" strokeWidth="1.5" opacity=".9" />
          {face.eyes === "star" ? (
            <path d={`m${x + 3.5 + lx} ${104.5 + ly} 1.5 3.6 3.8.3-2.9 2.4.9 3.7-3.3-2-3.3 2 .9-3.7-2.9-2.4 3.8-.3Z`} fill="#fffdfb" />
          ) : (
            <>
              <circle cx={x + 4 + lx} cy={108 + ly} r={face.shine} fill="#fffdfb" />
              <circle cx={x + 6.4 + lx} cy={113.4 + ly} r={face.shine * 0.36} fill="#fffdfb" opacity=".9" />
            </>
          )}
          <circle cx={x - 4 + lx} cy={120.5 + ly} r="1.7" fill="#fff0fa" />
          {/* The upper lid's shadow on the eyeball, so the eye reads as round, not pasted on. */}
          <path d={lash} stroke="#5a1c4c" strokeWidth="7" opacity=".14" fill="none" />
        </g>
        <path d={lash} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        <path d={flick} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d={`M${oX + inner * 1.5} 121.5q${inner * 5} 4.8 ${inner * 11} 5`} stroke="#a7708f" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
      <path
        className="bamby__blink"
        d={`M${x - 12} ${EYE_Y}q12 3 24 0`}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

function ClosedEye({ x, kind }) {
  const inner = x < 100 ? 1 : -1;
  if (kind === "squeeze") {
    // > <, squeezed tight (the windup before the flowers, a flinch, puffed cheeks).
    const d = inner > 0 ? `M${x - 10} ${EYE_Y - 7.5}l15 7-15 7` : `M${x + 10} ${EYE_Y - 7.5}l-15 7 15 7`;
    return <path d={d} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (kind === "sleep") {
    return (
      <g>
        <path d={`M${x - 12} ${EYE_Y + 1}q12 6.5 24 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d={`M${x - inner * 12} ${EYE_Y + 1}l${-inner * 3} -1.4`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  // happy: ^ ^ with the liner's tail.
  return (
    <g>
      <path d={`M${x - 12} ${EYE_Y + 3}q12 -12 24 0`} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path d={`M${x - inner * 12} ${EYE_Y + 3}l${-inner * 3} 1`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Mouth({ kind }) {
  const y = 138;
  switch (kind) {
    case "grin":
      return (
        <g>
          <path d={`M92 ${y - 1}q8 1.5 16 0q-1.5 9-8 9t-8-9Z`} fill="#a8476f" />
          <path d={`M94 ${y + 5}q6-2.8 12 0q-2.6 2.8-6 2.8t-6-2.8Z`} fill="#f08cae" />
          <path d={`M93.5 ${y}h13`} stroke="#fff6f2" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "open":
      return (
        <g>
          <path d={`M94 ${y - 1}q6 1 12 0q-1 7.5-6 7.5t-6-7.5Z`} fill="#a8476f" />
          <path d={`M95.8 ${y + 4.2}q4.2-2.2 8.4 0q-1.8 2.4-4.2 2.4t-4.2-2.4Z`} fill="#f08cae" />
        </g>
      );
    case "o":
      return <ellipse cx="100" cy={y + 1.5} rx="3.2" ry="3.8" fill="#a8476f" />;
    case "cat":
      return <path d={`M93.5 ${y - 1}q3.25 4.4 6.5 0 3.25 4.4 6.5 0`} fill="none" stroke="#8f4466" strokeWidth="2" strokeLinecap="round" />;
    case "pout":
      return <path d={`M96.5 ${y + 1}q1.75-2.8 3.5 0 1.75 2.8 3.5 0`} fill="none" stroke="#8f4466" strokeWidth="2" strokeLinecap="round" />;
    case "smirk":
      return <path d={`M95 ${y + 1}q6 2 11-3`} fill="none" stroke="#8f4466" strokeWidth="2.1" strokeLinecap="round" />;
    case "flat":
      return <path d={`M96.5 ${y}h7`} fill="none" stroke="#8f4466" strokeWidth="2" strokeLinecap="round" />;
    case "munch":
      return (
        <g className="bamby__munch">
          <path d={`M95 ${y}q5 3 10 0`} fill="none" stroke="#8f4466" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "wobble":
      return <path d={`M93 ${y + 2}q1.75-3 3.5 0t3.5 0 3.5 0 3.5 0`} fill="none" stroke="#8f4466" strokeWidth="1.9" strokeLinecap="round" />;
    case "yell":
      // Wide and square, top teeth showing, a little tongue: the sudden "YA!".
      return (
        <g>
          <path d={`M90.5 ${y - 3}q9.5-1.5 19 0q1 11-9.5 13t-9.5-13Z`} fill="#94365f" stroke="#7a2a4f" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M92 ${y - 2.3}q8-1 16 0l-.6 2.6q-7.4-.8-14.8 0Z`} fill="#fff8f4" />
          <path d={`M94.5 ${y + 6.8}q5.5-3.6 11 0q-2.6 3.4-5.5 3.4t-5.5-3.4Z`} fill="#f08cae" />
        </g>
      );
    case "puff":
      return (
        <g>
          <ellipse cx="100" cy={y + 0.5} rx="2.6" ry="2.2" fill="#a8476f" />
          <path d="M57 131q-5-3-6-9m92 9q5-3 6-9" fill="none" stroke="#e7849f" strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
        </g>
      );
    default:
      return <path d={`M95.5 ${y - 0.5}q4.5 4.2 9 0`} fill="none" stroke="#8f4466" strokeWidth="2.1" strokeLinecap="round" />;
  }
}

/** Brows sit over the fringe (anime convention), so they always read: drawn after the hair. Dark,
 *  fairly straight and a little heavier towards the nose, tapering out. */
export function BambyBrows({ expression }) {
  const face = faceFor(expression);
  return (
    <g className="bamby__brows">
      {EYES_X.map((x, i) => {
        const inner = i === 0 ? 1 : -1;
        const y = 94.5 + face.brow;
        const tilt = face.browTilt;
        const ix = x + inner * 11; // inner end
        const ox = x - inner * 12.5; // outer end
        const iy = y + tilt;
        const oy = y + 1 + (tilt < 0 ? tilt * 0.35 : 0);
        // A tapered stroke: a thick inner half, a thin tail.
        return (
          <g key={x}>
            <path d={`M${ix} ${iy}Q${x} ${y - 2.4} ${ox} ${oy}`} fill="none" stroke={BROW} strokeWidth="2" strokeLinecap="round" />
            <path d={`M${ix} ${iy}Q${x + inner * 4} ${y - 1.8} ${x - inner * 2} ${y - 1.4}`} fill="none" stroke={BROW} strokeWidth="2.9" strokeLinecap="round" />
          </g>
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
      <ellipse cx="61" cy="131" rx={face.puff ? 14 : 12} ry={face.puff ? 9 : 7} fill={`url(#${ids.blush})`} opacity={face.blush} />
      <ellipse cx="139" cy="131" rx={face.puff ? 14 : 12} ry={face.puff ? 9 : 7} fill={`url(#${ids.blush})`} opacity={face.blush} />
      {face.blush > 0.5 && (
        <path d="M56 130l3-3m3 3 3-3m69 3 3-3m3 3 3-3" stroke="#e7849f" strokeWidth="1.3" strokeLinecap="round" opacity=".75" />
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
      <path d="M99.6 128.5l1.6 1.3-1.6.9" fill="none" stroke="#d9a18c" strokeWidth="1.1" strokeLinecap="round" />
      <Mouth kind={face.mouth} />
      {/* While his bubble is up the mouth flaps between its own shape and a small open one. */}
      <g className="bamby__talk">
        <path d="M95.5 137q4.5 1 9 0q-1 6-4.5 6t-4.5-6Z" fill="#a8476f" />
        <path d="M97 140.6q3-1.4 6 0q-1.3 1.8-3 1.8t-3-1.8Z" fill="#f08cae" />
      </g>
      {face.tear && (
        <g className="bamby__tears" fill="#bfe3ff" stroke="#8fb8de" strokeWidth=".8">
          <path d="M61 122q4 6 0 9-4-3 0-9Z" />
          <path d="M139 122q4 6 0 9-4-3 0-9Z" />
        </g>
      )}
      {face.sweat && <path className="bamby__sweat" d="M158 96q7 10 0 12-7-2 0-12Z" fill="#bfe3ff" stroke="#8fb8de" strokeWidth=".8" />}
      {face.shout && (
        <path className="bamby__shout" d="M168 84l12-6m-10 18 14-1m-16 13 11 6M32 84l-12-6m10 18-14-1m16 13-11 6" stroke="#e0567f" strokeWidth="2.6" strokeLinecap="round" />
      )}
    </g>
  );
}
