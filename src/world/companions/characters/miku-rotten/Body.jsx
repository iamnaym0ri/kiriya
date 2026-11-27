import { useId, useSyncExternalStore } from "react";
import { C } from "./palette.js";
import Face from "./Face.jsx";
import { Arm, Cross, Halo, Heart, Hymnal, OpenBook, Paddle, Phone, Sketchbook, SmackBurst, Tail, Twinkle } from "./parts.jsx";
import "./miku-rotten.css";

// Rotten Girl Miku: the fangirl from SAWTOWNE's "Confessions of a Rotten Girl", drawn from scratch
// in the house chibi style (Maomao's line weight, big head, soft gradients, slow breath and blink).
// Research and references: .lab/research.md in the miku-rotten worktree.
//
// One rig for every pose. CSS (miku-rotten.css) does all the motion with transforms keyed on
// data-pose; React only swaps which arms and props are drawn. Coordinates: a 220 × 240 viewBox
// with her feet at (110, 238).

export const VIEW = { width: 220, height: 240 };
export const SIZE = { width: 110, height: 120 }; // same aspect as VIEW, so she fills the box exactly

const SEATED = new Set(["sit", "sleep", "sketch"]);
// Her skirt's plaid, inside the skirt's outline (M85 186h50l11 26q-36 10-72 0Z).
const PLAID_CHECK = "M75 210.8V211.1M87 187.2V213.8M99 187.2V215.3M111 187.2V215.8M123 187.2V215.1M135 187.2V213.4M82.4 195H137.6M77.3 207H142.7";
const PLAID_RED = "M81.5 195.5V212.7M93.5 187.2V214.7M105.5 187.2V215.7M117.5 187.2V215.6M129.5 187.2V214.3M141.5 202.6V212.0M84.7 189.5H135.3M79.6 201.5H140.4";
// Which arms to swap in when the engine hands her a prop for a pose that doesn't carry it.
const PROP_ARMS = { paddle: { stand: "behind", seat: "leaning" }, phone: { stand: "phone", seat: "phone" } };
const ALIASES = { picked: "held", dangle: "held", carried: "held", stand: "idle", hop: "jump" };

/** What each pose does with her arms and face when nobody asks for a particular expression. */
const POSES = {
  // Standing about, she carries the paddle behind her back across her hips, as in the concept art.
  idle: { arms: "behind", face: "soft" },
  walk: { arms: "behind", face: "soft" },
  crouch: { arms: "behind", face: "focused" },
  jump: { arms: "up", face: "gasp" },
  fall: { arms: "up", face: "flustered" },
  land: { arms: "behind", face: "happy" },
  sit: { arms: "plant", face: "happy" },
  wave: { arms: "wave", face: "happy" },
  react: { arms: "cheeks", face: "flustered" },
  sleep: { arms: "cuddle", face: "sleepy" },
  held: { arms: "dangle", face: "flustered" },
  sketch: { arms: "draw", face: "focused" },
  pray: { arms: "pray", face: "pray" },
  fluster: { arms: "cheeks", face: "flustered" },
  peek: { arms: "peek", face: "shy" },
  cheer: { arms: "cheer", face: "sparkle" },
  nope: { arms: "cross", face: "flustered" },
  glint: { arms: "glasses", face: "smug" },
  giggle: { arms: "giggle", face: "giggle" },
  show: { arms: "show", face: "sparkle" },
  hug: { arms: "hug", face: "dreamy" }, // the sketchbook (her doujinshi) clutched to her chest
  paddle: { arms: "brandish", face: "smug" }, // the paddle held up for all to see
  smack: { arms: "smack", face: "feral" }, // winds up and slams it down on a ship: SMACK
  penance: { arms: "penance", face: "wince" }, // paddles herself for her sins, as in the MV
  phone: { arms: "phone", face: "feral" }, // squealing at her phone, feet kicking
  dance: { arms: "dance", face: "giggle" }, // a little hop-and-wave dance on the spot
  ascend: { arms: "pray", face: "bliss" }, // a chapter so good she ascends: halo, floating, at peace
  magazine: { arms: "magazine", face: "flustered" }, // "reading her hymnal" (a magazine is inside it)
  point: { arms: "point", face: "smug" }, // the seme/uke verdict, delivered with a finger
};
export const POSE_NAMES = Object.keys(POSES);

const reducedQuery = "(prefers-reduced-motion: reduce)";
const readReduced = () => typeof matchMedia === "function" && matchMedia(reducedQuery).matches;
function subscribeReduced(listener) {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(reducedQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/* --- Arms and props, per pose. `back` is drawn behind her head, `front` over it. ------------- */

const sideBook = (facing) => (
  <g className="mr-sidebook">
    <Arm d="M82 168Q77 180 84 189" />
    <Sketchbook x={86} y={194} w={20} h={25} rotate={12} facing={facing} />
    <circle cx="85" cy="188" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
  </g>
);

/** The paddle behind her back, gripped in both hands, the blade poking out past her left hip. */
const behind = ({ facing }) => ({
  under: (
    <>
      <Paddle x={131} y={186} rotate={-110} facing={facing} tipFirst />
      <Arm d="M82 168Q80 182 96 190" />
      <Arm d="M138 168Q140 180 128 187" />
    </>
  ),
});

const ARMS = {
  behind,
  brandish: ({ facing }) => ({
    back: <Arm d="M82 168Q66 180 86 190" hand={[87, 190]} handR={5} />,
    front: (
      <g className="mr-brandish-arm">
        <Arm d="M138 168Q158 166 162 150" />
        <Paddle x={163} y={148} rotate={24} facing={facing} grip={10} />
        <circle cx="163" cy="149" r="5.4" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </g>
    ),
  }),
  smack: ({ facing }) => ({
    back: <Arm className="mr-smack-off" d="M82 168Q68 176 70 160" hand={[70, 157]} handR={5} />,
    front: (
      <>
        <g className="mr-smack-arm">
          <Arm d="M138 168Q156 164 160 148" />
          <Paddle x={161} y={146} rotate={18} facing={facing} grip={10} />
          <circle cx="161" cy="147" r="5.4" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        </g>
        <SmackBurst x={226} y={222} facing={facing} className="mr-smack-burst" />
      </>
    ),
  }),
  // Penance: her hand behind her back swings the paddle into her own behind. SMACK. Ow.
  penance: ({ facing }) => ({
    under: (
      <>
        <g className="mr-penance-paddle">
          <Paddle x={146} y={192} rotate={-100} facing={facing} tipFirst grip={6} />
        </g>
        <Arm d="M138 168Q152 180 146 192" hand={[146, 192]} handR={5} />
      </>
    ),
    back: <Arm className="mr-penance-off" d="M82 168Q66 172 70 156" hand={[70, 153]} handR={5} />,
    front: <SmackBurst x={60} y={204} facing={facing} className="mr-penance-burst" />,
  }),
  leaning: ({ facing }) => ({
    back: (
      <>
        <Paddle x={160} y={238} rotate={10} facing={facing} grip={0} />
        <Arm d="M82 168Q73 188 75 208" hand={[75, 209]} />
        <Arm d="M138 168Q150 184 156 196" hand={[157, 197]} />
      </>
    ),
  }),
  phone: {
    front: (
      <g className="mr-phone">
        <Phone x={110} y={161} rotate={-4} />
        <Arm d="M82 168Q84 182 99 170" hand={[100, 167]} handR={5.2} />
        <Arm d="M138 168Q136 182 121 170" hand={[120, 166]} handR={5.2} />
      </g>
    ),
  },
  dance: {
    front: (
      <>
        <Arm className="mr-dance-l" d="M82 168Q64 164 58 146" hand={[57, 143]} handR={5.2} />
        <Arm className="mr-dance-r" d="M138 168Q156 164 162 146" hand={[163, 143]} handR={5.2} />
      </>
    ),
  },
  hug: ({ facing }) => ({
    back: (
      <>
        <Arm d="M82 168Q79 184 96 191" />
        <Arm d="M138 168Q143 180 128 178" />
        <Sketchbook x={112} y={182} w={30} h={34} rotate={-10} className="mr-book" facing={facing} />
        <circle cx="96" cy="191" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <circle cx="127" cy="176" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </>
    ),
  }),
  up: {
    front: (
      <>
        <Arm className="mr-arm-l" d="M82 168Q64 164 58 146" hand={[57, 143]} />
        <Arm className="mr-arm-r" d="M138 168Q156 164 162 146" hand={[163, 143]} />
      </>
    ),
  },
  wave: ({ facing }) => ({
    back: sideBook(facing),
    front: (
      <g className="mr-wave-arm">
        <Arm d="M138 168Q160 162 163 140" hand={[163, 136]} handR={5.4} />
        <path d="M159 131.5l-1.5-3m5.3 2.3v-3.4m4 4.2 1.6-2.8" stroke={C.skinLine} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    ),
  }),
  plant: {
    back: (
      <>
        <Arm d="M82 168Q73 188 75 208" hand={[75, 209]} />
        <Arm d="M138 168Q147 188 145 208" hand={[145, 209]} />
      </>
    ),
  },
  cuddle: ({ facing }) => ({
    back: (
      <>
        <Arm d="M82 168Q80 192 97 199" />
        <Arm d="M138 168Q140 192 123 199" />
        <Sketchbook x={110} y={196} w={34} h={26} rotate={-4} facing={facing} />
        <circle cx="98" cy="199" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <circle cx="122" cy="199" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </>
    ),
  }),
  dangle: {
    back: (
      <>
        <Arm className="mr-arm-l" d="M82 168Q78 182 81 195" hand={[81, 196]} />
        <Arm className="mr-arm-r" d="M138 168Q142 182 139 195" hand={[139, 196]} />
      </>
    ),
  },
  draw: {
    back: (
      <>
        <Arm d="M82 168Q78 190 89 200" />
        <Arm d="M138 168Q142 186 125 194" />
        <OpenBook x={106} y={203} w={44} h={26} rotate={-7} doodle="sketch" drawing />
        <circle cx="89" cy="201" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <g className="mr-pencil-hand">
          <path d="M120 199l12-17" stroke={C.pencil} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M120 199l12-17" stroke="#c9963a" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0 0 2 30" />
          <path d="M119.2 200.4l1.3-2.6 1.2.8Z" fill={C.ink} />
          <circle cx="125" cy="193" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        </g>
      </>
    ),
  },
  pray: {
    back: (
      <>
        <Arm d="M82 168Q86 178 103 166" />
        <Arm d="M138 168Q134 178 117 166" />
      </>
    ),
    front: (
      <g className="mr-pray-hands">
        <path d="M103 170q-3-10 3-17q4-4 4 0q0-4 4 0q6 7 3 17q-7 4-14 0Z" fill={C.skin} stroke={C.skinLine} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M110 154v13" stroke={C.skinLine} strokeWidth="1" opacity=".8" />
      </g>
    ),
  },
  cheeks: {
    back: (
      <>
        <Arm d="M82 168Q66 166 65 147" />
        <Arm d="M138 168Q154 166 155 147" />
      </>
    ),
    front: (
      <g className="mr-cheek-hands">
        <ellipse cx="66" cy="140" rx="6" ry="7.2" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <ellipse cx="154" cy="140" rx="6" ry="7.2" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </g>
    ),
  },
  peek: ({ facing }) => ({
    back: (
      <>
        <Arm d="M82 168Q76 160 82 151" />
        <Arm d="M138 168Q144 160 138 151" />
      </>
    ),
    front: (
      <g className="mr-peek-book">
        <Sketchbook x={110} y={150} w={58} h={38} rotate={-2} facing={facing} />
        <circle cx="82" cy="150" r="5" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <circle cx="138" cy="149" r="5" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </g>
    ),
  }),
  cheer: ({ facing }) => ({
    back: <Arm d="M82 168Q80 180 92 178" hand={[93, 177]} handR={5.2} />,
    front: (
      <g className="mr-cheer-arm">
        <Arm d="M138 168Q158 166 162 150" />
        <Paddle x={163} y={148} rotate={20} facing={facing} grip={10} />
        <circle cx="163" cy="149" r="5.4" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </g>
    ),
  }),
  cross: {
    front: (
      <g className="mr-cross-arms">
        <Arm d="M82 170Q100 172 126 149" hand={[128, 147]} handR={5.2} />
        <Arm d="M138 170Q120 172 94 149" hand={[92, 147]} handR={5.2} />
      </g>
    ),
  },
  glasses: ({ facing }) => ({
    back: sideBook(facing),
    front: (
      <g className="mr-glasses-hand">
        <Arm d="M138 168Q137 146 118 131" hand={[116, 129]} handR={5} />
        <path d="M114.5 125.5l-3.5-9" stroke={C.skinLine} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M114.5 125.5l-3.5-9" stroke={C.skin} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    ),
  }),
  giggle: ({ facing }) => ({
    back: sideBook(facing),
    front: (
      <g className="mr-giggle-hand">
        <Arm d="M138 168Q134 152 116 145" hand={[113, 142]} handR={6} />
      </g>
    ),
  }),
  // A hymnal held up in both hands at her chin; the magazine inside pokes out of the top.
  magazine: ({ facing }) => ({
    back: (
      <>
        <Arm d="M82 168Q74 160 87 154" />
        <Arm d="M138 168Q146 160 133 154" />
      </>
    ),
    front: (
      <g className="mr-magazine">
        <Hymnal x={110} y={160} w={52} h={34} rotate={-2} facing={facing} />
        <circle cx="86" cy="158" r="5" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        <circle cx="134" cy="157" r="5" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
      </g>
    ),
  }),
  // Pointing out at somebody (the verdict), the other hand on her hip.
  point: {
    back: <Arm d="M82 168Q70 178 84 186" hand={[85, 186]} handR={5} />,
    front: (
      <g className="mr-point-arm">
        <Arm d="M138 168Q156 166 170 156" hand={[172, 155]} handR={5.2} />
        <path d="M175 152.5l7-4.5" stroke={C.skinLine} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M175 152.5l7-4.5" stroke={C.skin} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    ),
  },
  show: {
    back: (
      <>
        <Arm d="M82 168Q78 176 86 180" />
        <Arm d="M138 168Q142 176 134 180" />
        <g className="mr-show-book">
          <OpenBook x={110} y={180} w={52} h={34} rotate={-3} doodle="ship" />
          <circle cx="85" cy="181" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
          <circle cx="135" cy="179" r="4.8" fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />
        </g>
      </>
    ),
  },
};

/* --- Legs. Standing legs swing from the hip; seated ones hang over the cloud from the knee. --- */

function Leg({ x, className }) {
  return (
    <g className={className}>
      <rect x={x - 4} y="210" width="8" height="12" rx="3" fill={C.skin} stroke={C.skinLine} strokeWidth="1" />
      <rect x={x - 5} y="219" width="10" height="12" rx="3.2" fill={C.sock} stroke={C.sockLine} strokeWidth="1.1" />
      <path d={`M${x - 8.5} 234q0-6.5 8.5-6.5t8.5 6.5q0 3.4-8.5 3.4t-8.5-3.4Z`} fill={C.shoe} />
      <path d={`M${x - 5} 231q3-2 7-1.5`} stroke={C.shoeLight} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </g>
  );
}

function SeatLeg({ x, className }) {
  return (
    <g className={className}>
      <ellipse cx={x} cy="233" rx="6.2" ry="5" fill={C.skin} stroke={C.skinLine} strokeWidth="1" />
      <rect x={x - 4.5} y="232" width="9" height="15" rx="4" fill={C.skin} stroke={C.skinLine} strokeWidth="1" />
      <rect x={x - 5} y="244" width="10" height="11" rx="3.2" fill={C.sock} stroke={C.sockLine} strokeWidth="1.1" />
      <path d={`M${x - 8} 258q0-6 8-6t8 6q0 3.2-8 3.2t-8-3.2Z`} fill={C.shoe} />
      <path d={`M${x - 4.5} 255.5q3-2 6.5-1.4`} stroke={C.shoeLight} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </g>
  );
}

/* --- Little marks around her head. ----------------------------------------------------------- */

function Marks({ pose, expression }) {
  return (
    <g className="mr-marks">
      {pose === "react" && (
        <g className="mr-bang">
          <path d="M188 26l-3 20" stroke={C.cross} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="183.6" cy="54" r="2.6" fill={C.cross} />
        </g>
      )}
      {(pose === "fluster" || pose === "nope" || pose === "fall" || pose === "phone" || pose === "penance" || pose === "magazine" || expression === "flustered" || expression === "feral" || expression === "rotten") && (
        <g className="mr-steam" fill="none" stroke="#c8bde0" strokeWidth="2.2" strokeLinecap="round">
          <path d="M168 22q6-4 4-10q-2-5 3-8" />
          <path d="M184 36q6-2 6-8q0-5 5-6" />
        </g>
      )}
      {pose === "sleep" && (
        <g className="mr-zzz" fill="none" stroke="#9a86c4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path className="mr-z1" d="M176 34h8l-8 9h8" />
          <path className="mr-z2" d="M190 18h6l-6 7h6" />
        </g>
      )}
      {(pose === "show" || pose === "cheer" || pose === "phone" || pose === "hug" || pose === "dance" || expression === "dreamy" || expression === "nosebleed") && (
        <g className="mr-hearts">
          <Heart className="mr-heart1" x={190} y={58} size={11} />
          <Heart className="mr-heart2" x={28} y={74} size={8} />
        </g>
      )}
      {(pose === "pray" || pose === "paddle" || pose === "ascend" || expression === "sparkle") && (
        <g className="mr-twinkles">
          <Twinkle className="mr-tw1" x={190} y={60} r={6} />
          <Twinkle className="mr-tw2" x={28} y={84} r={4.5} fill="#bfe3c9" />
          <Twinkle className="mr-tw3" x={84} y={22} r={3.5} />
        </g>
      )}
      {pose === "ascend" && (
        <g className="mr-ascend">
          <g className="mr-rays" stroke="#f7e3a0" strokeWidth="2.4" strokeLinecap="round" opacity=".8">
            <path d="M110 6v-10M74 18l-7-7M146 18l7-7M58 44l-10-3M162 44l10-3" />
          </g>
          <Halo x={112} y={14} className="mr-halo" />
        </g>
      )}
      {pose === "point" && (
        <g className="mr-verdict" fill="none" stroke={C.bow} strokeWidth="2.6" strokeLinecap="round">
          <path d="M188 128l10-6m-8 16 12 1m-14 10 9 7" />
        </g>
      )}
      {pose === "peek" && (
        <g className="mr-question" fill="none" stroke={C.bow} strokeWidth="3" strokeLinecap="round">
          <path d="M178 30q0-9 8-9 9 1 5 9l-5 6v3" />
          <path d="M186 46v.5" />
        </g>
      )}
    </g>
  );
}

/* --- The body. -------------------------------------------------------------------------------- */

/** Picks the drawing for a pose: arms, legs, default face. Shared by Body and Thumb. */
export function resolvePose(pose, expression, prop = null, facing = 1) {
  const name = POSES[pose] ? pose : POSES[ALIASES[pose]] ? ALIASES[pose] : "idle";
  const spec = POSES[name];
  const seated = SEATED.has(name);
  let armsName = spec.arms;
  // A prop from the engine (the tap menu's action) replaces whatever her hands were doing, unless
  // the pose already holds it.
  const swap = PROP_ARMS[prop];
  if (swap && !PROP_HOLDERS[prop].has(armsName)) armsName = seated ? swap.seat : swap.stand;
  const arms = ARMS[armsName];
  return { name, face: expression ?? spec.face, arms: typeof arms === "function" ? arms({ facing }) : arms, seated };
}
const PROP_HOLDERS = {
  paddle: new Set(["behind", "brandish", "smack", "penance", "cheer", "leaning"]),
  phone: new Set(["phone"]),
};

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, readReduced, () => true);
}

/**
 * The engine's Body (src/world/companions/README.md, "Body"). She is drawn facing right and the
 * engine mirrors her, so `facing` needs nothing here (she carries no text). `frame` from the engine
 * is a set of Motion values that she doesn't need: her steps are timed to her own walkSpeed. A
 * number `frame` (seconds) with `playing` off freezes every clock at that moment, for stills.
 */
export default function Body({ pose = "idle", expression, prop = null, facing = 1, playing = true, frame, talking, className, style }) {
  const reduced = useReducedMotion();
  const { name, face, seated } = resolvePose(pose, expression, prop, facing);
  const still = typeof frame === "number";
  const motion = reduced ? "off" : playing ? "on" : still ? "still" : "off";
  return (
    <svg
      className={`mr${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      data-pose={name}
      data-expression={face}
      data-seated={seated ? "yes" : "no"}
      data-motion={motion}
      data-talking={talking ? "yes" : "no"}
      data-prop={prop ?? undefined}
      style={still ? { "--mr-at": `${-frame}s`, ...style } : style}
      aria-hidden="true"
      overflow="visible"
    >
      <Figure pose={name} expression={face} prop={prop} facing={facing} moving={motion === "on"} />
    </svg>
  );
}

/** Everything inside the SVG, so the thumb can frame the same drawing with its own viewBox. */
export function Figure({ pose, expression, prop = null, facing = 1, moving }) {
  const id = useId();
  const { name, face, arms, seated } = resolvePose(pose, expression, prop, facing);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2=".3" y2="1">
          <stop stopColor={C.hairTop} />
          <stop offset=".5" stopColor={C.hair} />
          <stop offset="1" stopColor={C.hairDark} />
        </linearGradient>
        {/* The tails darken towards their tips, as on her reference sheet. */}
        <linearGradient id={`${id}-tail`} x1="0" y1="0" x2=".25" y2="1">
          <stop stopColor={C.hairTop} />
          <stop offset=".4" stopColor={C.hair} />
          <stop offset=".78" stopColor={C.hairDark} />
          <stop offset="1" stopColor={C.tipDark} />
        </linearGradient>
        <radialGradient id={`${id}-skin`} cx=".45" cy=".4" r=".7">
          <stop offset=".45" stopColor="#ffece0" />
          <stop offset="1" stopColor={C.skinShade} />
        </radialGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2=".15" y2="1">
          <stop offset=".1" stopColor="#c9f0d4" stopOpacity="0" />
          <stop offset=".4" stopColor="#c9f0d4" stopOpacity=".42" />
          <stop offset=".7" stopColor="#c9f0d4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-shirt`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={C.shirt} />
          <stop offset="1" stopColor={C.shirtShade} />
        </linearGradient>
        <radialGradient id={`${id}-ground`} cx=".5" cy=".5" r=".5">
          <stop stopColor="#5d4a7a" stopOpacity=".28" />
          <stop offset="1" stopColor="#5d4a7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g>
        <ellipse className="mr-shadow" cx="110" cy="237" rx="34" ry="5" fill={`url(#${id}-ground)`} />
        <g className="mr-root">
          <g className="mr-sway">
            {seated ? (
              <g className="mr-seat-legs">
                <SeatLeg x={101} className="mr-shin mr-shin--l" />
                <SeatLeg x={119} className="mr-shin mr-shin--r" />
              </g>
            ) : (
              <g className="mr-legs">
                <Leg x={102} className="mr-leg mr-leg--l" />
                <Leg x={118} className="mr-leg mr-leg--r" />
              </g>
            )}
            <g className="mr-upper">
              <g className="mr-breath">
                <g className="mr-tail mr-tail--l">
                  <g className="mr-tail-swing">
                    <Tail fill={`url(#${id}-tail)`} />
                  </g>
                </g>
                <g transform={`translate(${VIEW.width} 0) scale(-1 1)`}>
                  <g className="mr-tail mr-tail--r">
                    <g className="mr-tail-swing">
                      <Tail fill={`url(#${id}-tail)`} />
                    </g>
                  </g>
                </g>
                {arms.under}
                <g className="mr-torso">
                  {/* Skirt: navy plaid, pleated, a little A-line. */}
                  <g className="mr-skirt">
                    {/* The plaid as plain lines, not a <pattern>: a pattern fill made every frame of her
                        CSS animation repaint far slower in WebKit (.lab bench, 2026-11-27). */}
                    <path d="M85 186h50l11 26q-36 10-72 0Z" fill={C.skirt} stroke={C.skirtDark} strokeWidth="1.5" strokeLinejoin="round" />
                    <path d={PLAID_CHECK} stroke={C.skirtCheck} strokeWidth="2.2" opacity=".55" />
                    <path d={PLAID_RED} stroke={C.skirtRed} strokeWidth=".9" opacity=".8" />
                    <path d="M96 189l-6 25m14-25-1 27m13-27 2 27m12-26 6 24" stroke={C.skirtDark} strokeWidth="1.3" opacity=".7" />
                  </g>
                  {/* Blouse with short puffed sleeves. */}
                  <path d="M87 160q23-7 46 0l4 30q-27 6-54 0Z" fill={`url(#${id}-shirt)`} stroke={C.shirtLine} strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M110 166v22" stroke={C.shirtLine} strokeWidth="1" opacity=".6" />
                  <circle cx="110" cy="176" r="1.1" fill={C.shirtLine} />
                  <circle cx="110" cy="184" r="1.1" fill={C.shirtLine} />
                  <path d="M88 161q-12 1-14 13q7 6 15 2Z" fill={C.shirt} stroke={C.shirtLine} strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M132 161q12 1 14 13q-7 6-15 2Z" fill={C.shirt} stroke={C.shirtLine} strokeWidth="1.4" strokeLinejoin="round" />
                  {/* Rolled cuffs on the short sleeves. */}
                  <path d="M75.5 170.5q6.5 4.6 13.6 1.6" fill="none" stroke={C.shirtLine} strokeWidth="1.1" opacity=".8" />
                  <path d="M144.5 170.5q-6.5 4.6-13.6 1.6" fill="none" stroke={C.shirtLine} strokeWidth="1.1" opacity=".8" />
                  <path d="M104 152h12v8q-6 3-12 0Z" fill={C.skinShade} />
                  {/* Pointed collar and her crimson ribbon, crossed in an X with a white stripe near each
                      cut end and a dark button where the bands cross. */}
                  <path d="M102 156l8 8-12 6-3-9Z" fill={C.shirt} stroke={C.shirtLine} strokeWidth="1.3" strokeLinejoin="round" />
                  <path d="M118 156l-8 8 12 6 3-9Z" fill={C.shirt} stroke={C.shirtLine} strokeWidth="1.3" strokeLinejoin="round" />
                  <g className="mr-bow">
                    <path d="M116.0 156.9L96.5 175.9L101.3 176.3L101.5 181.1L121.0 162.1Z" fill={C.bow} stroke={C.bowDark} strokeWidth="1.1" strokeLinejoin="round" />
                    <path d="M99.6 172.9L104.4 173.2L104.7 178.0" fill="none" stroke={C.bowStripe} strokeWidth="1.1" strokeLinejoin="round" />
                    <path d="M99.0 162.1L118.5 181.1L118.7 176.3L123.5 175.9L104.0 156.9Z" fill={C.bow} stroke={C.bowDark} strokeWidth="1.1" strokeLinejoin="round" />
                    <path d="M115.3 178.0L115.6 173.2L120.4 172.9" fill="none" stroke={C.bowStripe} strokeWidth="1.1" strokeLinejoin="round" />
                    <circle cx="110" cy="168" r="2.9" fill={C.button} />
                    <circle cx="109.2" cy="167.2" r=".9" fill="#fff" opacity=".5" />
                  </g>
                </g>
                {arms.back}
                <g className="mr-head">
                  {/* Back of the head, then the face, then the fringe and side locks over it. */}
                  <ellipse cx="110" cy="91" rx="64" ry="60" fill={`url(#${id}-hair)`} />
                  <path d="M52 104q-3 38 16 54h84q19-16 16-54Z" fill={C.hairDark} />
                  <path d="M55 92q0-42 55-43 55 1 55 43v22q-4 40-55 41-51-1-55-41Z" fill={`url(#${id}-skin)`} />
                  <Face expression={face} moving={moving}>
                    <Fringe id={id} />
                  </Face>
                  <Cross x={59} y={66} rotate={-18} />
                  <Cross x={161} y={66} rotate={18} />
                  <path
                    className="mr-ahoge"
                    d="M104 48C97 36 100 21 114 18C127 15 133 29 124 34C117 38 111 31 116 27C118 25 121 26 121 29C123 24 117 21 112 24C106 29 107 40 111 48Z"
                    fill={C.hair}
                    stroke={C.hairLine}
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                </g>
                {arms.front}
                <Marks pose={name} expression={face} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </>
  );
}

/** The fringe, the long strand between her eyes, the side locks and the sheen. */
function Fringe({ id }) {
  const cap =
    "M54 110C44 70 70 43 110 43C150 43 176 70 166 110Q161 97 157 86Q154 95 148 102Q144 91 139 82Q134 93 128 99Q124 89 120 80Q115 97 111 118Q107 96 101 80Q97 90 92 100Q88 91 82 83Q78 93 72 102Q67 93 63 86Q59 97 54 110Z";
  return (
    <g>
      <path d={cap} fill={`url(#${id}-hair)`} stroke={C.hairLine} strokeWidth="1.3" strokeLinejoin="round" />
      <path d={cap} fill={`url(#${id}-sheen)`} />
      <path
        d="M70 62q10-9 22-11m16-1q16 0 28 7m8 5q5 4 8 9M84 74l-2 14m19-18 1 16m19-15 4 14m15-10 3 10"
        stroke={C.hairDark}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity=".7"
      />
      <path d="M72 60q16-12 34-12" stroke={C.hairLight} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".75" />
      <path d="M56 84Q46 120 61 156Q62 134 67 113Q68 98 64 86Z" fill={`url(#${id}-hair)`} stroke={C.hairLine} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M164 84Q174 120 159 156Q158 134 153 113Q152 98 156 86Z" fill={`url(#${id}-hair)`} stroke={C.hairLine} strokeWidth="1.3" strokeLinejoin="round" />
    </g>
  );
}
