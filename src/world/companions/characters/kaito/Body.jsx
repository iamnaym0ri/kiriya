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
export const OWN_POSES = ["crouch", "icecream", "offer", "brainfreeze", "hum", "snuggle", "slip", "treat"];
export const POSES = [...SHARED_POSES, ...OWN_POSES];
const POSE_ALIASES = { stand: "idle", picked: "held", dangle: "held", carried: "held", hop: "jump", eat: "icecream" };
const SITTING = new Set(["sit", "sleep", "treat"]);

// The face each pose wears when the engine doesn't ask for one.
const POSE_FACE = {
  idle: "gentle",
  walk: "gentle",
  crouch: "gentle",
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

const norm = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

/** Where the hand sits: just past the cuff, along the forearm's direction. */
function handPoint(via, to) {
  const [dx, dy] = norm(to[0] - via[0], to[1] - via[1]);
  return [to[0] + dx * 4.5, to[1] + dy * 4.5];
}

/**
 * One coat sleeve from the shoulder to the wrist, as a soft stroked curve (so any pose is one line
 * of numbers): white sleeve with a fine outline, gold band, blue cuff. The hand is drawn separately
 * (ArmHand), in front of the scarf, inside a group with the same class so both move together.
 */
function Sleeve({ arm: [from, via, to], className }) {
  const d = `M${from[0]} ${from[1]}Q${via[0]} ${via[1]} ${to[0]} ${to[1]}`;
  return (
    <g className={`kaito__arm ${className}`} style={{ transformOrigin: `${from[0]}px ${from[1]}px` }}>
      <path d={d} stroke={COAT_LINE} strokeWidth="14.4" strokeLinecap="round" fill="none" />
      <path d={d} stroke={COAT} strokeWidth="11.8" strokeLinecap="round" fill="none" />
      <path d={`M${from[0]} ${from[1]}Q${via[0]} ${via[1]} ${to[0]} ${to[1]}`} stroke="#e3e8f7" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".7" transform="translate(1.4 1.6)" />
      <path d={quadSlice(from, via, to, 0.7, 0.76)} stroke={GOLD} strokeWidth="11.8" fill="none" />
      <path d={quadSlice(from, via, to, 0.76, 1)} stroke={TRIM} strokeWidth="12.6" fill="none" />
    </g>
  );
}

function ArmHand({ arm: [from, via, to], className, open = false, children }) {
  const [hx, hy] = handPoint(via, to);
  return (
    <g className={`kaito__arm ${className}`} style={{ transformOrigin: `${from[0]}px ${from[1]}px` }}>
      {children}
      {open ? (
        // An open palm (waving): a slightly bigger hand with a thumb.
        <g fill={SKIN} stroke={SKIN_LINE} strokeWidth=".9">
          <ellipse cx={hx} cy={hy - 1} rx="6.4" ry="7.4" />
          <ellipse cx={hx - 6} cy={hy + 1.5} rx="2.6" ry="3.6" transform={`rotate(-30 ${hx - 6} ${hy + 1.5})`} />
        </g>
      ) : (
        <ellipse cx={hx} cy={hy} rx="6.2" ry="5.8" fill={SKIN} stroke={SKIN_LINE} strokeWidth=".9" />
      )}
    </g>
  );
}

/**
 * A scarf tail as a ribbon in two pieces (so it can ripple): square-cut end with the gold corner
 * patch from his V3 design.
 */
function Ribbon({ a, c1, b, c2, end, width, colour, stripe, className }) {
  const [dx, dy] = norm(end[0] - c2[0], end[1] - c2[1]);
  const [nx, ny] = [-dy, dx];
  const h = width / 2;
  const A = [end[0] + nx * h, end[1] + ny * h];
  const B = [end[0] - nx * h, end[1] - ny * h];
  const C = [A[0] - dx * width * 1.05, A[1] - dy * width * 1.05];
  const pt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return (
    <g className={`kaito__tail ${className}`}>
      <path d={`M${pt(a)}Q${pt(c1)} ${pt(b)}`} stroke={colour} strokeWidth={width} strokeLinecap="round" fill="none" />
      <g className="kaito__tail-end" style={{ transformOrigin: `${b[0]}px ${b[1]}px` }}>
        <path d={`M${pt(b)}Q${pt(c2)} ${pt(end)}`} stroke={colour} strokeWidth={width} fill="none" />
        <path d={`M${pt(b)}Q${pt(c2)} ${pt(end)}`} stroke={stripe} strokeWidth="1.3" strokeDasharray="2.5 3" fill="none" opacity=".9" />
        <path d={`M${pt(A)}L${pt(B)} ${pt(C)}Z`} fill={GOLD} stroke={GOLD_DARK} strokeWidth=".8" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** The two scarf tails. Behind everything else; they hang in idle and stream out when he moves. */
function Tails() {
  return (
    <g className="kaito__tails">
      <Ribbon className="kaito__tail--far" a={[74, 161]} c1={[62, 172]} b={[54, 186]} c2={[48, 197]} end={[43, 208]} width={10.5} colour="#5c82e6" stripe="#b3c8f8" />
      <Ribbon className="kaito__tail--near" a={[78, 160]} c1={[71, 178]} b={[67, 195]} c2={[64, 207]} end={[63, 220]} width={11.5} colour={SCARF} stripe={SCARF_LIGHT} />
    </g>
  );
}

const BACK_HAIR =
  "M42 122C30 78 52 34 98 28C146 24 172 66 160 120L166 146 150 136 146 156 134 140H66L54 156 50 136 34 146Z";
// The locks that flare out on his right (the viewer's left): the silhouette's signature bump.
const FLICK =
  "M60 48C46 38 31 39 17 47 30 50 38 57 45 68ZM47 68C35 63 24 68 15 79 27 78 35 82 42 89ZM42 91C34 90 28 95 24 104 30 102 37 103 42 108Z";
// The fringe: broad locks sweeping a touch to his right, a long one falling between the eyes, side
// locks down to the jaw.
const FRINGE =
  "M43 120C34 66 62 28 101 29C141 30 168 66 158 118C158 128 156 136 152 146C150 132 149 116 147 100C146 103 143 105 139 105C136 99 133 93 129 88C128 96 124 102 118 104C116 98 113 91 111 86C109 100 104 114 99 125C99 112 98 98 95 87C93 95 89 102 83 104C81 98 79 92 76 88C74 96 68 102 61 104C59 101 58 99 56 97C55 112 53 128 49 144C46 136 44 128 43 120Z";
const FACE = "M46 94q0-44 54-45 54 1 54 45v20q-4 41-54 42-50-1-54-42Z";

function Boots({ sitting }) {
  if (sitting) {
    // Sitting on the cloud's edge: the boots hang down over its front and swing.
    return (
      <g className="kaito__legs kaito__legs--sit">
        {/* Knees towards her, peeking from under the coat. */}
        <ellipse cx="91" cy="225" rx="7.5" ry="5.5" fill={PANTS} stroke="#3a4166" strokeWidth=".8" />
        <ellipse cx="109" cy="225" rx="7.5" ry="5.5" fill={PANTS} stroke="#3a4166" strokeWidth=".8" />
        <g className="kaito__boot kaito__boot--l" style={{ transformOrigin: "91px 232px" }}>
          <path d="M87 222H99L98 240H86Z" fill={PANTS} />
          <path d="M85 236H97V254Q97 261 90 261H84Q79 261 81 256L85 252Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
          <path d="M85 239H97" stroke={BOOT_BAND} strokeWidth="2.6" />
        </g>
        <g className="kaito__boot kaito__boot--r" style={{ transformOrigin: "109px 232px" }}>
          <path d="M101 222H113L114 240H102Z" fill={PANTS} />
          <path d="M103 236H115V252L119 256Q121 261 116 261H110Q103 261 103 254Z" fill={BOOT} stroke="#141c40" strokeWidth=".9" />
          <path d="M103 239H115" stroke={BOOT_BAND} strokeWidth="2.6" />
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
      {/* The coat: two flared halves, blue edging, a few gold triangles. */}
      <g className="kaito__coat-halves">
        <path d="M90 158Q74 159 67 170Q59 190 51 214Q66 223 85 219Q90 190 97 163Z" fill={`url(#${id}-coat)`} stroke={COAT_LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M110 158Q126 159 133 170Q141 190 149 214Q134 223 115 219Q110 190 103 163Z" fill={`url(#${id}-coat)`} stroke={COAT_LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M57 202Q62 188 68 178M143 202Q138 188 132 178" stroke="#dfe4f5" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M85 219Q90 190 97 163M115 219Q110 190 103 163" stroke={TRIM} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M51.6 214.6Q66 223 85 219M148.4 214.6Q134 223 115 219" stroke={TRIM} strokeWidth="4.6" strokeLinecap="round" fill="none" />
        <path d="M54 210.4Q67 217.6 85.6 214.6M146 210.4Q133 217.6 114.4 214.6" stroke="#c9d8ff" strokeWidth="1" fill="none" />
        <path d="M91 163Q82 171 73 184M109 163Q118 171 127 184" stroke={TRIM} strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M108 174h9v3.4h-9Z" fill={TRIM} />
        <g fill={GOLD} stroke={GOLD_DARK} strokeWidth=".7" strokeLinejoin="round">
          <path d="M71 197h8l-4 4.4ZM121 197h8l-4 4.4Z" />
          <path d="M80.4 216.8 88.2 218.6 83.6 224.6ZM119.6 216.8 111.8 218.6 116.4 224.6Z" />
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

/** The scarf wound round his neck, high under the chin, knotted on his right shoulder. */
function ScarfRoll() {
  return (
    <g className="kaito__scarf">
      <path
        d="M63 152Q100 166 137 152Q144 159 142 169Q100 189 58 169Q56 159 63 152Z"
        fill={SCARF}
        stroke={SCARF_DARK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M67 162Q100 176 133 162" stroke={SCARF_LIGHT} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M78 172q-7-1-11-6m59 6q7-1 11-6M96 179q4 1 9 0" stroke={SCARF_DARK} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M61 159Q53 166 59 175Q69 179 77 171Q75 161 61 159Z" fill={SCARF} stroke={SCARF_DARK} strokeWidth="1.2" />
      <path d="M62 165q5 2 10 1" stroke={SCARF_LIGHT} strokeWidth="1.5" strokeLinecap="round" fill="none" />
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

// Arm poses: [shoulder, elbow-ish control, wrist] for his right arm (viewer's left), then his left.
const REST_L = [[77, 170], [63, 180], [61, 197]];
const REST_R = [[123, 170], [137, 180], [139, 197]];
const ARMS = {
  rest: [REST_L, REST_R],
  up: [[[77, 168], [56, 152], [50, 124]], [[123, 168], [144, 152], [150, 124]]],
  flail: [[[77, 169], [56, 162], [42, 142]], [[123, 169], [144, 162], [158, 142]]],
  out: [[[77, 170], [60, 182], [51, 191]], [[123, 170], [140, 182], [149, 191]]],
  back: [[[77, 171], [66, 186], [70, 200]], [[123, 171], [134, 186], [130, 200]]],
  startle: [[[77, 170], [58, 170], [46, 181]], [[123, 170], [142, 170], [154, 181]]],
  lap: [[[77, 170], [66, 186], [76, 197]], [[123, 170], [134, 186], [124, 197]]],
  folded: [[[77, 170], [76, 190], [91, 197]], [[123, 170], [124, 190], [109, 197]]],
  limp: [[[77, 170], [67, 185], [65, 203]], [[123, 170], [133, 185], [135, 203]]],
  wave: [REST_L, [[123, 169], [151, 164], [155, 133]]],
  cone: [REST_L, [[123, 170], [146, 190], [121, 172]]],
  offer: [[[77, 170], [78, 192], [93, 186]], [[123, 170], [122, 192], [107, 186]]],
  freeze: [[[77, 169], [48, 160], [56, 112]], REST_R],
  mic: [REST_L, [[123, 169], [153, 172], [141, 146]]],
  scarf: [[[77, 170], [66, 166], [84, 152]], [[123, 170], [134, 166], [116, 152]]],
  windmill: [[[77, 169], [57, 158], [50, 138]], [[123, 170], [144, 175], [157, 160]]],
  treat: [[[77, 170], [72, 190], [86, 198]], [[123, 170], [146, 184], [121, 168]]],
};
const POSE_ARMS = {
  idle: "rest",
  walk: "rest",
  crouch: "back",
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
const armsFor = (pose) => ARMS[POSE_ARMS[pose] ?? "rest"];

function Sleeves({ pose }) {
  const [l, r] = armsFor(pose);
  return (
    <g className="kaito__sleeves">
      <Sleeve arm={l} className="kaito__arm--l" />
      <Sleeve arm={r} className="kaito__arm--r" />
    </g>
  );
}

/** Hands and whatever they're holding: always in front of the scarf. */
function Hands({ pose }) {
  const [l, r] = armsFor(pose);
  if (pose === "offer") {
    return (
      <g className="kaito__hands">
        <IceCone x={100} y={180} flavour="lilac" className="kaito__cone kaito__cone--offer" />
        <g fill={SKIN} stroke={SKIN_LINE} strokeWidth=".9">
          <ellipse cx="94.5" cy="188" rx="5.8" ry="5.4" />
          <ellipse cx="105.5" cy="188" rx="5.8" ry="5.4" />
        </g>
      </g>
    );
  }
  return (
    <g className="kaito__hands">
      <ArmHand arm={l} className="kaito__arm--l" />
      {pose === "treat" && <IceCup x={88} y={196} />}
      <ArmHand arm={r} className="kaito__arm--r" open={pose === "wave"}>
        {pose === "icecream" && <IceCone x={122} y={170} flavour="soda" />}
        {pose === "brainfreeze" && <IceCone x={142} y={203} flavour="soda" />}
        {pose === "treat" && <Spoon x={118} y={159} angle={-24} />}
      </ArmHand>
    </g>
  );
}

/**
 * Little marks around him (the "!", z's, notes, frost, a heart). The engine mirrors the whole body to
 * face left; letters are flipped back so they still read.
 */
function Effects({ pose, expression, facing }) {
  const fx = (x) => x;
  const unflip = (x) => (facing < 0 ? `translate(${2 * x} 0) scale(-1 1)` : undefined);
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
          <g transform={unflip(156)}>
            <text className="kaito__z kaito__z--1" x="156" y="72" fontSize="18" textAnchor="middle">z</text>
          </g>
          <g transform={unflip(170)}>
            <text className="kaito__z kaito__z--2" x="170" y="52" fontSize="14" textAnchor="middle">z</text>
          </g>
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
              <path d={FACE} fill={`url(#${id}-rim)`} />
              <path d={FRINGE} fill={`url(#${id}-hair)`} />
              {/* Lock partings, then a broken shine ring across the crown. */}
              <path
                d="M76 88C79 74 84 62 92 52M95 87C98 72 100 60 103 48M111 86C114 74 118 64 124 56M129 88C133 80 138 72 144 68M56 97C56 84 60 74 66 66"
                stroke="#1c3690"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
                opacity=".45"
              />
              <path
                d="M60 70Q66 58 77 52M85 47Q95 43 104 44M112 45Q124 47 133 55M140 62Q145 68 148 76"
                stroke="#b5caff"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
                opacity=".62"
              />
              <path d="M52 114q-1 13 1 22M149 110q1 13-1 22" stroke={HAIR_LIGHT} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".7" />
              <KaitoBrows expression={face} moving={motion} />
              <Headset />
              {(pose === "snuggle" || pose === "sleep") && <ScarfUp />}
            </g>
            <Sleeves pose={pose} />
            <ScarfRoll />
            <Hands pose={pose} />
          </g>
        </g>
      </g>
    </g>
  );
}

export const useReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);

function KaitoBody({ pose = "idle", expression, facing = 1, playing = true, talking = false }) {
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
      data-talking={talking ? "on" : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 236" className="kaito__svg" overflow="visible">
        <Defs id={id} />
        <ellipse className="kaito__ground" cx="100" cy="231" rx="42" ry="6.5" fill={`url(#${id}-ground)`} />
        <Figure id={id} pose={p} face={face} motion={motion} />
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
