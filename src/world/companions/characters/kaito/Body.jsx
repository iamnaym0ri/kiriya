import { memo, useId, useSyncExternalStore } from "react";
import { KaitoBrows, KaitoFace, resolveExpression } from "./KaitoFace.jsx";
import { IceCone, IceCup, Spoon } from "./props.jsx";
import "./kaito.css";

// KAITO as a little companion: original SVG fan art in the house chibi style (Maomao's proportions,
// line weights and face rig), from the research in .lab/research.md: royal-blue flared hair with a
// flick on one side, a gold headset with a boom mic, a long blue scarf with gold-tipped tails, the
// white coat with blue trim and gold triangles, navy boots, and an ice cream more often than not.
//
// The drawing faces right (facing 1). Everything is transform/opacity animation in kaito.css, gated
// by `playing` and by prefers-reduced-motion.

const HAIR_LIGHT = "#7499ef";
const SKIN = "#ffe6d4";
const SKIN_LINE = "#dfb39c";
const COAT = "#fdfdff";
const COAT_LINE = "#8c96c8";
const TRIM = "#2a50c8";
const GOLD = "#f3c433";
const GOLD_DARK = "#c4931c";
const SCARF = "#3a62d6";
const SCARF_DARK = "#2446ad";
const SCARF_LIGHT = "#7fa1f0";
const SHIRT = "#283150";
const PANTS = "#4b5379";
const BOOT = "#212c5e";
const BOOT_BAND = "#6cc4ea";
const INK = "#2b2f3d";

// Poses every companion shares, then his own.
export const SHARED_POSES = ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held"];
export const OWN_POSES = ["icecream", "offer", "brainfreeze", "hum", "snuggle", "slip", "treat"];
export const POSES = [...SHARED_POSES, ...OWN_POSES];
const POSE_ALIASES = { stand: "idle", picked: "held", dangle: "held", carried: "held", hop: "jump", crouch: "jump", eat: "icecream" };
const SITTING = new Set(["sit", "sleep", "treat"]);

// The face each pose wears when the engine doesn't ask for one.
const POSE_FACE = {
  idle: "gentle",
  walk: "gentle",
  jump: "joyful",
  fall: "surprised",
  land: "happy",
  sit: "gentle",
  wave: "happy",
  react: "surprised",
  sleep: "sleepy",
  held: "sheepish",
  icecream: "lick",
  offer: "fond",
  brainfreeze: "brainfreeze",
  hum: "happy",
  snuggle: "shy",
  slip: "surprised",
  treat: "blissful",
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const readReducedMotion = () => matchMedia(reducedMotionQuery).matches;
function subscribeReducedMotion(listener) {
  const query = matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const quad = (a, c, b, t) => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];
// The part of a quadratic curve between t0 and t1, as its own quadratic.
function quadSlice(a, c, b, t0, t1) {
  const p0 = quad(a, c, b, t0);
  const p1 = quad(a, c, b, t1);
  const d = (t) => [2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];
  const d0 = d(t0);
  const k = (t1 - t0) / 2;
  const ctrl = [p0[0] + d0[0] * k, p0[1] + d0[1] * k];
  return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}Q${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
}

/**
 * One coat sleeve from the shoulder to the hand, as a soft stroked curve (so any pose is one line
 * of numbers): white sleeve, gold band, blue cuff, round hand.
 */
function Arm({ from, via, to, className = "", hand = true, children }) {
  const d = `M${from[0]} ${from[1]}Q${via[0]} ${via[1]} ${to[0]} ${to[1]}`;
  // The hand sits just past the cuff, along the forearm's direction.
  const dir = [to[0] - via[0], to[1] - via[1]];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const hx = to[0] + (dir[0] / len) * 4.5;
  const hy = to[1] + (dir[1] / len) * 4.5;
  return (
    <g className={`kaito__arm ${className}`} style={{ transformOrigin: `${from[0]}px ${from[1]}px` }}>
      <path d={d} stroke={COAT_LINE} strokeWidth="13.4" strokeLinecap="round" fill="none" />
      <path d={d} stroke={COAT} strokeWidth="10.8" strokeLinecap="round" fill="none" />
      <path d={quadSlice(from, via, to, 0.7, 0.76)} stroke={GOLD} strokeWidth="10.8" fill="none" />
      <path d={quadSlice(from, via, to, 0.76, 1)} stroke={TRIM} strokeWidth="11.6" fill="none" />
      {children}
      {hand && <ellipse cx={hx} cy={hy} rx="6" ry="5.6" fill={SKIN} stroke={SKIN_LINE} strokeWidth=".9" />}
    </g>
  );
}

/** The two scarf tails, each in two pieces so they can ripple. Behind everything else. */
function Tails() {
  return (
    <g className="kaito__tails">
      <g className="kaito__tail kaito__tail--far">
        <path d="M74 161Q62 172 54 185" stroke="#5a80e4" strokeWidth="9" strokeLinecap="round" fill="none" />
        <g className="kaito__tail-end" style={{ transformOrigin: "54px 185px" }}>
          <path d="M54 185Q48 196 43 206" stroke="#5a80e4" strokeWidth="9" fill="none" />
          <path d="M46 199 40.5 208" stroke="#a9c1f7" strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M38.6 203.6 47.3 208.4 39.3 214.6Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth=".8" strokeLinejoin="round" />
        </g>
      </g>
      <g className="kaito__tail kaito__tail--near">
        <path d="M78 160Q71 178 66 194" stroke={SCARF} strokeWidth="10" strokeLinecap="round" fill="none" />
        <g className="kaito__tail-end" style={{ transformOrigin: "66px 194px" }}>
          <path d="M66 194Q63 207 62 219" stroke={SCARF} strokeWidth="10" fill="none" />
          <path d="M64.8 205 64 215" stroke={SCARF_LIGHT} strokeWidth="1.3" strokeDasharray="2 2" />
          <path d="M57 219 67 219.4 61.6 228.6Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth=".8" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
}

const BACK_HAIR =
  "M42 120C30 70 58 28 100 28C144 28 172 70 158 120L164 146 150 136 146 154 134 140H66L54 154 50 136 36 146Z";
// The flick that sticks out on his right (the viewer's left): the silhouette's signature bump.
const FLICK = "M50 60C38 51 25 53 15 61 28 63 36 70 40 78ZM43 82C33 81 24 87 19 97 29 92 38 95 45 99Z";
const FRINGE =
  "M44 118C36 66 62 30 100 30C140 30 166 64 157 118Q157 132 151 142Q148 120 145 96Q142 103 137 106Q132 95 128 86Q123 96 118 103Q114 92 110 84Q104 104 101 123Q100 100 94 84Q89 95 84 103Q80 93 75 86Q69 97 64 106Q60 99 56 96Q52 120 49 142Q45 132 44 118Z";
const FACE = "M46 94q0-44 54-45 54 1 54 45v20q-4 41-54 42-50-1-54-42Z";

function Boots({ sitting }) {
  if (sitting) {
    // Sitting on the cloud's edge: the boots hang down over its front and swing.
    return (
      <g className="kaito__legs kaito__legs--sit">
        <g className="kaito__boot kaito__boot--l" style={{ transformOrigin: "91px 226px" }}>
          <path d="M85 222H97V242Q97 249 90 249H84Q79 249 81 244L85 240Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
          <path d="M85 230H97" stroke={BOOT_BAND} strokeWidth="2.6" />
        </g>
        <g className="kaito__boot kaito__boot--r" style={{ transformOrigin: "109px 226px" }}>
          <path d="M103 222H115V240L119 244Q121 249 116 249H110Q103 249 103 242Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
          <path d="M103 230H115" stroke={BOOT_BAND} strokeWidth="2.6" />
        </g>
      </g>
    );
  }
  return (
    <g className="kaito__legs">
      <g className="kaito__boot kaito__boot--l" style={{ transformOrigin: "91px 208px" }}>
        <path d="M89 194H99L98 210H86Z" fill={PANTS} />
        <path d="M85 206H97V224Q97 231 90 231H84Q79 231 81 226L85 222Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
        <path d="M85 209H97" stroke={BOOT_BAND} strokeWidth="2.6" />
        <path d="M88 214v8" stroke="#3c4a8a" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="kaito__boot kaito__boot--r" style={{ transformOrigin: "109px 208px" }}>
        <path d="M101 194H111L114 210H102Z" fill={PANTS} />
        <path d="M103 206H115V222L119 226Q121 231 116 231H110Q103 231 103 224Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
        <path d="M103 209H115" stroke={BOOT_BAND} strokeWidth="2.6" />
        <path d="M106 214v8" stroke="#3c4a8a" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Coat({ id }) {
  return (
    <g className="kaito__coat">
      {/* What shows through the open front: navy shirt, belt, trousers. */}
      <path d="M95 160H105L111 194H89Z" fill={SHIRT} />
      <path d="M88.5 190H111.5V195.5H88.5Z" fill="#1b2034" />
      <rect x="96.4" y="190.4" width="7.2" height="4.8" rx="1.1" fill="#eef4f8" stroke="#94a9bd" strokeWidth=".6" />
      <path d="M98.4 192.8h3.2" stroke="#3cc6b0" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M89 195.5H111L113.5 208H86.5Z" fill={PANTS} />
      <path d="M100 196v11" stroke="#3a4166" strokeWidth="1" />
      {/* The coat: two flared halves, blue edging, gold triangles. */}
      <g className="kaito__coat-halves">
        <path d="M90 158Q74 159 67 170Q59 190 51 214Q66 223 85 219Q90 190 97 163Z" fill={`url(#${id}-coat)`} stroke={COAT_LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M110 158Q126 159 133 170Q141 190 149 214Q134 223 115 219Q110 190 103 163Z" fill={`url(#${id}-coat)`} stroke={COAT_LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M57 200Q62 186 68 176M143 200Q138 186 132 176" stroke="#dfe4f5" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M85 219Q90 190 97 163M115 219Q110 190 103 163" stroke={TRIM} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M51.6 214.6Q66 223 85 219M148.4 214.6Q134 223 115 219" stroke={TRIM} strokeWidth="4.6" strokeLinecap="round" fill="none" />
        <path d="M54 210.4Q67 217.6 85.6 214.6M146 210.4Q133 217.6 114.4 214.6" stroke="#c9d8ff" strokeWidth="1" fill="none" />
        <path d="M91 162Q82 170 72 183M109 162Q118 170 128 183" stroke={TRIM} strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M108 173h9.5v3.6H108Z" fill={TRIM} />
        <g fill={GOLD} stroke={GOLD_DARK} strokeWidth=".7" strokeLinejoin="round">
          <path d="M76.5 167.5l-7 1.6 4.6 4.6ZM123.5 167.5l7 1.6-4.6 4.6Z" />
          <path d="M69.5 196.5h10.5l-5.2 5.2ZM120 196.5h10.5l-5.2 5.2Z" />
          <path d="M80 216.6 88.4 218.4 83.4 225.4ZM120 216.6 111.6 218.4 116.6 225.4Z" />
          <path d="M49.4 210.6 57 216.4 50 220.4ZM150.6 210.6 143 216.4 150 220.4Z" />
        </g>
      </g>
    </g>
  );
}

function Headset() {
  return (
    <g className="kaito__headset">
      <path d="M152.4 123.6Q148 137 132.4 139.4" stroke={INK} strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <ellipse cx="130.6" cy="139.6" rx="3.4" ry="2.5" fill={INK} />
      <circle cx="157" cy="117" r="8.6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.3" />
      <circle cx="157" cy="117" r="4.6" fill={INK} />
      <circle cx="157" cy="117" r="1.5" fill={GOLD} />
      <path d="M151.2 112.4q2.6-3.4 6.6-3.6" stroke="#fff3c4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** The scarf wound round his neck, high under the chin. */
function ScarfRoll() {
  return (
    <g className="kaito__scarf">
      <path
        d="M65 154Q100 168 135 154Q142 159 140 168Q100 186 60 168Q58 159 65 154Z"
        fill={SCARF}
        stroke={SCARF_DARK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M68 163Q100 176 132 163" stroke={SCARF_LIGHT} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M77 171q-6-1-10-5m59 5q6-1 10-5" stroke={SCARF_DARK} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* The knot sits on his right shoulder; the tails leave from behind it. */}
      <path d="M62 160Q55 166 61 174Q70 177 76 170Q74 161 62 160Z" fill={SCARF} stroke={SCARF_DARK} strokeWidth="1.2" />
      <path d="M63 165q4 2 9 1" stroke={SCARF_LIGHT} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Pulled up over his mouth (snuggling into it, or dozing). Moves with the head. */
function ScarfUp() {
  return (
    <g className="kaito__scarf-up">
      <path
        d="M66 141Q100 128 134 141Q140 150 136 160Q100 172 64 160Q60 150 66 141Z"
        fill={SCARF}
        stroke={SCARF_DARK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M70 148Q100 138 130 148" stroke={SCARF_LIGHT} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M84 156q16 4 32 0" stroke={SCARF_DARK} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </g>
  );
}

// Arm poses: [from, via, to] for his right arm (viewer's left) then his left (viewer's right).
const REST_L = [[76, 168], [62, 178], [60, 197]];
const REST_R = [[124, 168], [138, 178], [140, 197]];
const ARMS = {
  rest: [REST_L, REST_R],
  up: [[[78, 167], [60, 162], [53, 144]], [[122, 167], [140, 162], [147, 144]]],
  flail: [[[78, 167], [58, 168], [45, 152]], [[122, 167], [142, 168], [155, 152]]],
  out: [[[77, 168], [60, 180], [51, 190]], [[123, 168], [140, 180], [149, 190]]],
  startle: [[[77, 168], [58, 168], [47, 180]], [[123, 168], [142, 168], [153, 180]]],
  lap: [[[78, 168], [71, 188], [83, 202]], [[122, 168], [129, 188], [117, 202]]],
  folded: [[[78, 168], [80, 192], [94, 201]], [[122, 168], [120, 192], [106, 201]]],
  limp: [[[77, 168], [67, 184], [65, 203]], [[123, 168], [133, 184], [135, 203]]],
  wave: [REST_L, [[124, 167], [146, 162], [148, 141]]],
  cone: [REST_L, [[124, 168], [146, 190], [121, 172]]],
  offer: [[[78, 168], [80, 192], [94, 186]], [[122, 168], [120, 192], [106, 186]]],
  freeze: [[[77, 167], [50, 160], [57, 112]], REST_R],
  mic: [REST_L, [[124, 167], [152, 172], [140, 146]]],
  scarf: [[[78, 168], [68, 164], [86, 152]], [[122, 168], [132, 164], [114, 152]]],
  windmill: [[[78, 167], [58, 158], [51, 138]], [[122, 168], [144, 174], [157, 160]]],
  treat: [[[78, 168], [73, 190], [86, 200]], [[122, 168], [146, 184], [121, 168]]],
};
const POSE_ARMS = {
  idle: "rest",
  walk: "rest",
  jump: "up",
  fall: "flail",
  land: "out",
  sit: "lap",
  wave: "wave",
  react: "startle",
  sleep: "folded",
  held: "limp",
  icecream: "cone",
  offer: "offer",
  brainfreeze: "freeze",
  hum: "mic",
  snuggle: "scarf",
  slip: "windmill",
  treat: "treat",
};

function Arms({ pose }) {
  const [l, r] = ARMS[POSE_ARMS[pose] ?? "rest"];
  return (
    <g className="kaito__arms">
      <Arm from={l[0]} via={l[1]} to={l[2]} className="kaito__arm--l" />
      {pose === "offer" && <IceCone x={100} y={182} flavour="lilac" className="kaito__cone kaito__cone--offer" />}
      <Arm from={r[0]} via={r[1]} to={r[2]} className="kaito__arm--r">
        {pose === "icecream" && <IceCone x={121} y={171} flavour="soda" />}
        {pose === "brainfreeze" && <IceCone x={144} y={203} flavour="soda" />}
        {pose === "treat" && <Spoon x={117} y={158} angle={-24} />}
      </Arm>
      {pose === "treat" && <IceCup x={90} y={198} />}
      {pose === "offer" && (
        <g fill={SKIN} stroke={SKIN_LINE} strokeWidth=".9">
          <ellipse cx="95" cy="188" rx="5.6" ry="5.2" />
          <ellipse cx="105" cy="188" rx="5.6" ry="5.2" />
        </g>
      )}
    </g>
  );
}

/** Little marks around him that must not mirror (letters, notes): drawn outside the facing flip. */
function Effects({ pose, expression, facing }) {
  const fx = (x) => (facing < 0 ? 200 - x : x);
  return (
    <g className="kaito__effects" aria-hidden="true">
      {pose === "react" && (
        <g className="kaito__bang" stroke="#e0a72a" strokeWidth="4" strokeLinecap="round">
          <path d={`M${fx(164)} 30v16`} />
          <path d={`M${fx(164)} 55v.5`} />
        </g>
      )}
      {pose === "sleep" && (
        <g fill="#8a7fc0" fontWeight="700" fontFamily="ui-rounded, 'SF Pro Rounded', system-ui, sans-serif">
          <text className="kaito__z kaito__z--1" x={fx(156)} y="72" fontSize="18" textAnchor="middle">z</text>
          <text className="kaito__z kaito__z--2" x={fx(170)} y="52" fontSize="14" textAnchor="middle">z</text>
        </g>
      )}
      {pose === "hum" && (
        <g fill="#6f86d9" stroke="#6f86d9">
          <g className="kaito__note kaito__note--1">
            <ellipse cx={fx(166)} cy="86" rx="4.6" ry="3.6" transform={`rotate(-20 ${fx(166)} 86)`} stroke="none" />
            <path d={`M${fx(170.2)} 85V66q5 2 7 7`} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </g>
          <g className="kaito__note kaito__note--2">
            <ellipse cx={fx(176)} cy="62" rx="3.8" ry="3" transform={`rotate(-20 ${fx(176)} 62)`} stroke="none" />
            <path d={`M${fx(179.5)} 61V45l9-2v15`} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <ellipse cx={fx(185.4)} cy="59" rx="3.8" ry="3" transform={`rotate(-20 ${fx(185.4)} 59)`} stroke="none" />
          </g>
        </g>
      )}
      {(pose === "brainfreeze" || expression === "brainfreeze") && (
        <g className="kaito__frost" stroke="#7fc4ef" strokeWidth="2" strokeLinecap="round">
          <path d={`M${fx(166)} 52v14m-7-7h14m-12-5 10 10m0-10-10 10`} />
          <path d={`M${fx(36)} 70v10m-5-5h10`} />
          <path d={`M${fx(174)} 84v8m-4-4h8`} />
        </g>
      )}
      {pose === "offer" && (
        <path
          className="kaito__heart"
          d={`M${fx(124)} 150c-3-4-9-1-6 4l6 5 6-5c3-5-3-8-6-4Z`}
          fill="#e993b4"
          stroke="#c86f93"
          strokeWidth="1"
        />
      )}
      {expression === "sparkle" && (
        <g className="kaito__glints" fill="#f0c94c">
          <path d={`M${fx(28)} 88l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z`} />
          <path d={`M${fx(176)} 64l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z`} />
        </g>
      )}
    </g>
  );
}

function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-hair`} x1="0" y1="0" x2=".3" y2="1">
        <stop stopColor="#4a70e0" />
        <stop offset=".55" stopColor="#2c52c4" />
        <stop offset="1" stopColor="#1d388f" />
      </linearGradient>
      <linearGradient id={`${id}-hair-back`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#2a4cb8" />
        <stop offset="1" stopColor="#172d7a" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2=".2" y2="1">
        <stop offset=".12" stopColor="#bcd0ff" stopOpacity="0" />
        <stop offset=".34" stopColor="#bcd0ff" stopOpacity=".5" />
        <stop offset=".5" stopColor="#bcd0ff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-skin`} cx=".45" cy=".38" r=".7">
        <stop offset=".4" stopColor="#ffeada" />
        <stop offset="1" stopColor="#f2cdb8" />
      </radialGradient>
      <linearGradient id={`${id}-coat`} x1="0" y1="0" x2=".25" y2="1">
        <stop stopColor="#ffffff" />
        <stop offset=".7" stopColor="#f4f6fd" />
        <stop offset="1" stopColor="#e2e7f7" />
      </linearGradient>
      <linearGradient id={`${id}-rim`} x1="1" y1="0" x2="0" y2="0">
        <stop stopColor="#c7dcff" stopOpacity=".5" />
        <stop offset=".22" stopColor="#c7dcff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-ground`} cx=".5" cy=".5" r=".5">
        <stop stopColor="#4a4a7a" stopOpacity=".28" />
        <stop offset="1" stopColor="#4a4a7a" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${id}-face`}>
        <path d={FACE} />
      </clipPath>
    </defs>
  );
}

/** The whole figure, facing right, in the 200×236 box. Shared by the body and the portrait. */
export function Figure({ id, pose, face, motion }) {
  const sitting = SITTING.has(pose);
  return (
    <g className="kaito__root">
      <g className="kaito__breath">
        <g className="kaito__float">
          <Boots sitting={sitting} />
          <g className="kaito__upper">
            <Tails />
            <g className="kaito__head kaito__head--back">
              <path d={BACK_HAIR} fill={`url(#${id}-hair-back)`} />
              <path className="kaito__flick" d={FLICK} fill={`url(#${id}-hair-back)`} />
            </g>
            <Coat id={id} />
            <g className="kaito__head kaito__head--front">
              <path d={FACE} fill={`url(#${id}-skin)`} />
              {/* The fringe's shadow on the forehead. */}
              <path d={FRINGE} transform="translate(1 4)" fill="#5a4c95" opacity=".16" clipPath={`url(#${id}-face)`} />
              <KaitoFace expression={face} moving={motion} />
              <path d={FRINGE} fill={`url(#${id}-hair)`} />
              <path d={FRINGE} fill={`url(#${id}-sheen)`} />
              <path
                d="M66 58q-7 12-7 27M84 44q-4 16-1 34M117 44q5 16 4 33M135 56q7 12 8 28M52 112q-1 14 1 24M149 110q1 14-1 24"
                stroke={HAIR_LIGHT}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity=".85"
              />
              <path d="M94 84q3 18 5.6 32M110 84q-3 14-6.6 28" stroke="#1d3a96" strokeWidth="1.2" fill="none" opacity=".5" />
              <path d={FACE} fill={`url(#${id}-rim)`} />
              <KaitoBrows expression={face} moving={motion} />
              <Headset />
              {(pose === "snuggle" || pose === "sleep") && <ScarfUp />}
            </g>
            <ScarfRoll />
            <Arms pose={pose} />
          </g>
        </g>
      </g>
    </g>
  );
}

export const useReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);

function KaitoBody({ pose = "idle", expression, facing = 1, playing = true, scale = 1 }) {
  const id = useId();
  const reduced = useReducedMotion();
  const p = POSES.includes(pose) ? pose : POSE_ALIASES[pose] ?? "idle";
  const face = resolveExpression(expression) ?? POSE_FACE[p] ?? "gentle";
  const motion = playing && !reduced;
  return (
    <div
      className="kaito"
      data-pose={p}
      data-expression={face}
      data-motion={motion ? "on" : "off"}
      style={{ width: 100 * scale, height: 118 * scale }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 236" className="kaito__svg" overflow="visible">
        <Defs id={id} />
        <ellipse className="kaito__ground" cx="100" cy="231" rx="42" ry="6.5" fill={`url(#${id}-ground)`} />
        <g transform={facing < 0 ? "translate(200 0) scale(-1 1)" : undefined}>
          <Figure id={id} pose={p} face={face} motion={motion} />
        </g>
        <Effects pose={p} expression={face} facing={facing} />
      </svg>
    </div>
  );
}

/** Head and shoulders with his ice cream and a wink, for her settings picker. */
export function KaitoThumb({ size = 56, expression = "wink" }) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div className="kaito kaito--thumb" data-pose="portrait" data-expression={expression} data-motion={reduced ? "off" : "on"} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="22 20 156 156" className="kaito__svg">
        <Defs id={id} />
        <Figure id={id} pose="icecream" face={expression} motion={!reduced} />
      </svg>
    </div>
  );
}

export default memo(KaitoBody);
