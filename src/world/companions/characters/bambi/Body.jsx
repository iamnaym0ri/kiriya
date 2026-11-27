import { useId } from "react";
import BambyFace, { BambyBrows } from "./Face.jsx";
import { HeartArm, HeartBurst, Headset, MicArm, Notes } from "./props.jsx";
import "./bambi.css";

// Bamby (PLAVE) as a hand-drawn chibi, in the house style Maomao set: big round head, short body,
// soft gradients, a rim of colour on the shaded side, no outlines heavier than the lashes.
// Original fan art. His face and hair after his official look: thick, wavy bubblegum-pink hair with
// a fringe to the brows, big pink-violet deer eyes, dark brows, a round face with pink cheeks. His
// clothes after the PLBBUU era (2025): a cream knit sweater with a big pink star over a white
// turtleneck, a string of pastel beads, periwinkle jeans with navy stars, pink sneakers. His heart
// sunglasses come out for the showing-off poses. Every pose is CSS transforms on a fixed rig (see bambi.css); nothing re-renders per frame.

const HAIR = "#f59bbf";
const HAIR_DEEP = "#d86d9e";
const HAIR_LINE = "#b2457f";
const SKIN = "#ffe7d8";
const SKIN_LINE = "#e3b19c";
const JACKET = "#f7ebdf"; // the cream knit sweater
const JACKET_LINE = "#c4a693";
const KNIT = "#e9d5c4"; // ribbing and the shaded side
const TURTLE = "#fdfcff";
const TURTLE_LINE = "#c9c2da";
const PINK = "#ef7fb4";
const PANTS = "#b3b8e6"; // periwinkle jeans
const PANTS_LINE = "#7c83c2";
const NAVY = "#3f4b8e";
const BERET = "#b7b4ea";
const BERET_LINE = "#7b77c0";
const BERET_SHADE = "#9c98dc";
const BEADS = ["#fffaf2", "#ffc6dc", "#c9dcff", "#fff0b0"];

/** A five-point star centred on (x, y), outer radius r. */
function starPath(x, y, r, inner = 0.48) {
  let d = "";
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const k = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * k).toFixed(1)} ${(y + Math.sin(a) * k).toFixed(1)}`;
  }
  return `${d}Z`;
}

// What each pose looks like when no line is setting the face.
const POSE_FACE = {
  idle: "neutral",
  crouch: "focused",
  walk: "grin",
  jump: "grin",
  fall: "surprised",
  land: "squeeze",
  sit: "neutral",
  wave: "happy",
  react: "surprised",
  sleep: "sleepy",
  held: "scared",
  groove: "happy",
  dance: "grin",
  spin: "happy",
  freeze: "cool",
  bloom: "sparkle",
  count: "focused",
  vroom: "grin",
  stretch: "happy",
  snack: "munch",
  heart: "happy",
  skygaze: "neutral",
  cry: "teary",
  scared: "squeeze",
  cool: "cool",
  fairy: "wink",
  sing: "sing",
};
export const BAMBY_POSES = Object.keys(POSE_FACE);

// The poses that keep his heart sunglasses down over his eyes.
const SHADES = new Set(["freeze", "cool"]);
// Sitting poses: he sits on the cloud's surface with his legs over its front edge.
const SITTING = new Set(["sit", "sleep"]);
// Poses that bring their own prop, so the lab's pose gallery shows it without the engine's `prop`.
const POSE_PROP = { fairy: "heart", sing: "mic" };

/** One sleeve + hand, drawn as two strokes so it has a soft outline without a filter. */
function Arm({ side, children }) {
  const left = side === "l";
  const sx = left ? 73 : 127;
  const ex = left ? 69 : 131;
  const wx = left ? 68 : 132;
  return (
    <g className={`bamby__arm bamby__arm--${side}`}>
      <path d={`M${sx} 163L${ex} 181`} stroke={JACKET_LINE} strokeWidth="15.4" strokeLinecap="round" />
      <path d={`M${sx} 163L${ex} 181`} stroke={JACKET} strokeWidth="12.6" strokeLinecap="round" />
      <path d={`M${ex + (left ? 3.4 : -3.4)} 171l${left ? -1 : 1} 9`} stroke={KNIT} strokeWidth="1.4" strokeLinecap="round" />
      <g className={`bamby__fore bamby__fore--${side}`}>
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET_LINE} strokeWidth="14.6" strokeLinecap="round" />
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET} strokeWidth="11.8" strokeLinecap="round" />
        <path d={`M${wx} 192.5v4.5`} stroke={KNIT} strokeWidth="12" />
        <path d={`M${wx - 3.5} 193v3.6m3.5-3.6v3.6m3.5-3.6v3.6`} stroke={JACKET_LINE} strokeWidth=".8" opacity=".7" />
        <g className={`bamby__hand bamby__hand--${side}`}>
          <circle cx={wx} cy="201.5" r="7" fill={SKIN} stroke={SKIN_LINE} strokeWidth="1.1" />
          {children}
        </g>
      </g>
    </g>
  );
}

function Leg({ side }) {
  const left = side === "l";
  const x = left ? 89 : 111;
  const out = left ? -1 : 1;
  return (
    <g className={`bamby__leg bamby__leg--${side}`}>
      <g className={`bamby__shin bamby__shin--${side}`}>
        <path
          d={`M${x - 8.5} 189h17l-.6 34h-15.8Z`}
          fill={PANTS}
          stroke={PANTS_LINE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d={starPath(x - out * 2, 201, 3)} fill={NAVY} />
        <path d={starPath(x + out * 3.5, 214, 2.6)} fill={NAVY} />
        <g className={`bamby__shoe bamby__shoe--${side}`}>
          <path
            d={`M${x - 11 + out * 2} 229c0-8 4.5-10.5 11-10.5s11 2.5 11 10.5Z`}
            fill={PINK}
            stroke="#c4568d"
            strokeWidth="1.2"
          />
          <path d={`M${x - 5 + out * 2} 222.5h10m-9 2.6h8`} stroke="#fff4fa" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d={`M${x - 12 + out * 2} 228.5h24v2.6q-12 2.2-24 0Z`}
            fill="#fffaff"
            stroke="#b79fc6"
            strokeWidth="1"
          />
        </g>
      </g>
    </g>
  );
}

/** His heart sunglasses: they come out, down over his eyes, only when he's showing off. */
function HeartShades({ down }) {
  const heart = "M0 7.5C-11 0-11.5-9-5.6-9.6-2.6-9.9-.8-7.6 0-5.2.8-7.6 2.6-9.9 5.6-9.6 11.5-9 11 0 0 7.5Z";
  if (down) {
    return (
      <g className="bamby__shades bamby__shades--down">
        <path d="M52 108q-4 1-7 4m103-4q4 1 7 4" stroke="#d2417f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M89 108q11-5 22 0" stroke="#d2417f" strokeWidth="2.4" fill="none" />
        {[76, 124].map((x) => (
          <g key={x} transform={`translate(${x} 114) scale(1.6)`}>
            <path d={heart} fill="#ff6fae" fillOpacity=".88" stroke="#d2417f" strokeWidth="1.5" />
            <path d="M-6-5.6q-2 1.4-2.2 4" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".9" />
          </g>
        ))}
      </g>
    );
  }
  return null;
}

function Flower({ x, y, r = 1, tone = "#ffb3d4", className = "" }) {
  return (
    <g className={`bamby__flower ${className}`} transform={`translate(${x} ${y}) scale(${r})`}>
      <g className="bamby__flower-in">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-4.6" rx="3.4" ry="4.6" fill={tone} stroke="#e070a6" strokeWidth=".8" transform={`rotate(${a})`} />
        ))}
        <circle r="2.4" fill="#ffe27a" stroke="#e9b73f" strokeWidth=".6" />
      </g>
    </g>
  );
}

/** A curly outline: straight segments between the points, each bulged outward into a soft bump. */
function curls(points, bulge, cx = 100, cy = 88) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const len = Math.hypot(mx - cx, my - cy) || 1;
    const qx = mx + ((mx - cx) / len) * bulge;
    const qy = my + ((my - cy) / len) * bulge;
    d += `Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x1} ${y1}`;
  }
  return d;
}

// His hair, after his official look: bubblegum pink, thick and wavy with a lot of volume on top, a
// fringe that falls to the brows in separate wavy locks (parted a little to his right, the long
// central lock dipping between his eyes, the rest swept towards the viewer's right), and soft locks
// over the ears that curl in towards his cheeks. Drawn as a base mass with locks layered on it.
const HAIR_OUTLINE = [
  [46, 138], [36, 122], [31, 102], [33, 82], [40, 63], [53, 47], [70, 35], [89, 29], [110, 28],
  [130, 32], [147, 43], [160, 59], [168, 80], [170, 101], [165, 122], [155, 138],
];
const BACK_HAIR = `${curls(HAIR_OUTLINE, 5.2, 100, 86)}L146 144H54Z`;
// The front mass: over the crown, down the temples, a soft hairline across the forehead.
const FRONT =
  "M40 120C35 70 62 37 100 37C138 37 165 70 160 120L152 120C151 104 147 93 137 88C120 82 80 82 63 88C53 93 49 104 48 120Z";
// Each lock: [root x, root y, length, sweep (tip's sideways reach), width]. Drawn in this order, so the
// ones nearest the parting land on top.
const LOCKS = [
  [47.5, 88, 46, 7, 15], // over his right ear, curling in
  [152.5, 88, 46, -7, 15], // over his left ear
  [60, 80, 22, -7, 17],
  [141, 80, 22, 7, 15],
  [75, 77, 20, -6, 16],
  [125, 75, 23, 9, 17],
  [109, 73, 26, 9, 18],
  [92, 72, 36, 8, 17], // the long one between his eyes
];
function lockPaths([rx, ry, len, sweep, w]) {
  const s = Math.sign(sweep) || 1;
  const a = [rx - (s * w) / 2, ry]; // the long, outer edge starts here
  const b = [rx + (s * w) / 2, ry];
  const tip = [rx + sweep, ry + len];
  const f = (n) => n.toFixed(1);
  const edge =
    `M${f(a[0])} ${f(a[1])}C${f(a[0] - s * 3.2)} ${f(ry + len * 0.5)} ${f(tip[0] - sweep * 0.7)} ${f(tip[1] - 2.5)} ${f(tip[0])} ${f(tip[1])}` +
    `C${f(tip[0] - s * 3.5)} ${f(tip[1] - len * 0.38)} ${f(b[0] + s * 2.5)} ${f(ry + len * 0.4)} ${f(b[0])} ${f(b[1])}`;
  const strand = `M${f(rx - s * 1.5)} ${f(ry + 5)}C${f(rx - s * 3.5)} ${f(ry + len * 0.4)} ${f(tip[0] - sweep * 0.6)} ${f(tip[1] - len * 0.4)} ${f(tip[0] - sweep * 0.25 - s * 1.5)} ${f(tip[1] - len * 0.2)}`;
  return { fill: `${edge}Z`, edge, strand };
}
const LOCK_PATHS = LOCKS.map(lockPaths);
const BACK_HEAD = `${curls(
  [[60, 146], [44, 132], [35, 114], [31, 95], [35, 75], [44, 57], [58, 43], [77, 33], [100, 28], [123, 33], [142, 43], [156, 57], [165, 75], [169, 95], [165, 114], [156, 132], [140, 146]],
  4.4,
  100,
  86,
)}C132 151 124 149 118 152C112 148 104 148 100 152C96 148 88 148 82 152C76 149 68 151 60 146Z`;

function Hair({ ids }) {
  return (
    <>
      <path d={BACK_HAIR} fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Wave texture on the sides and the nape. */}
      <path
        d="M39 92q-2-8 2-14m118 14q2-8-2-14M40 118q-3-6-1-12m120 12q3-6 1-12M44 132q4 3 8 2m104-2q-4 3-8 2"
        stroke={HAIR_DEEP}
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

/** His cowlick: a little wavy tuft on the crown that bounces when he does. */
function Tuft() {
  return (
    <g className="bamby__tuft">
      <path d="M101 39c-3-7 1-13 8-12-4 2-5 6-3 11Z" fill={HAIR} stroke={HAIR_LINE} strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  );
}

function Fringe({ ids }) {
  return (
    <>
      <path d={FRONT} fill={`url(#${ids.hair})`} />
      <path d={FRONT} fill={`url(#${ids.sheen})`} />
      {/* Waves running back from the parting over the crown. */}
      <path
        d="M82 44c-7 6-4 12-10 20M98 41c-3 7 2 13-2 21M116 42c3 7-1 12 4 19M132 49c5 5 3 10 8 15"
        stroke={HAIR_DEEP}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity=".55"
      />
      {LOCK_PATHS.map((l, i) => (
        <g key={i}>
          <path d={l.fill} fill={`url(#${ids.hair})`} />
          <path d={l.edge} fill="none" stroke={HAIR_LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d={l.strand} fill="none" stroke={HAIR_DEEP} strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
        </g>
      ))}
      {/* The shine: a soft ring of light across the crown. */}
      <path d="M62 58q18-16 40-17" stroke="#fff0f7" strokeWidth="3.4" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M112 42q14 2 24 10" stroke="#fff0f7" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".6" />
      <Tuft />
    </>
  );
}

/** The back of his head and jacket, for the sky-gazing pose (back turned, hand on his waist). */
function BackView({ ids }) {
  return (
    <g className="bamby__back">
      <path d="M94 148h12v12H94Z" fill="#f3cdb9" />
      <path
        d="M80 156c10-4 30-4 40 0l11 10c3 8 4 16 3 25-22 6-46 6-68 0-1-9 0-17 3-25Z"
        fill={JACKET}
        stroke={JACKET_LINE}
        strokeWidth="1.6"
      />
      <path d="M88 151q12-5 24 0l1 7q-13 4-26 0Z" fill={TURTLE} stroke={TURTLE_LINE} strokeWidth="1" />
      <path d="M66 189c22 6 46 6 68 0v5c-22 6-46 6-68 0Z" fill={KNIT} stroke={JACKET_LINE} strokeWidth=".8" />
      <g className="bamby__head bamby__head--back">
        <ellipse cx="38" cy="112" rx="6" ry="9" fill="#f2c6b2" stroke={SKIN_LINE} strokeWidth="1" />
        <ellipse cx="162" cy="112" rx="6" ry="9" fill="#f2c6b2" stroke={SKIN_LINE} strokeWidth="1" />
        <path d={BACK_HEAD} fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.6" strokeLinejoin="round" />
        <path
          d="M70 60q-6 12-3 24m31-46q-4 14-1 26m30-18q4 12 1 24M52 96q-2 10 2 20m96-20q2 10-2 20M66 100q-4 12 0 24m34-30q-3 14 0 26m34-20q4 12 0 24"
          stroke={HAIR_DEEP}
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M82 140q6 8 0 14m36-14q-6 8 0 14m-18-16v14" stroke={HAIR_DEEP} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Tuft />
      </g>
    </g>
  );
}

export default function BambyBody({
  pose = "idle",
  expression,
  prop = null,
  playing = true,
  frame,
  talking = false,
  width = "100%",
  height = "100%",
  x,
  y,
}) {
  const raw = useId().replace(/[:«»]/g, "");
  const ids = {
    base: `bb${raw}`,
    hair: `bb${raw}-hair`,
    sheen: `bb${raw}-sheen`,
    skin: `bb${raw}-skin`,
    iris: `bb${raw}-iris`,
    blush: `bb${raw}-blush`,
    rim: `bb${raw}-rim`,
    ground: `bb${raw}-ground`,
  };
  const known = pose in POSE_FACE ? pose : "idle";
  const face = expression ?? POSE_FACE[known];
  const shadesDown = SHADES.has(known);
  const back = known === "skygaze";
  // The tap menu's action hands him a prop (src/world/companions/README.md, "Body"): the headset
  // while he dances for her, a finger heart for the ending fairy, a mic to sing. A pose may bring
  // its own as well (the fairy's finger heart, the mic when he sings), so the two add up.
  const carried = new Set([prop, POSE_PROP[known]].filter(Boolean));
  const rightArm = carried.has("heart") ? <HeartArm /> : carried.has("mic") ? <MicArm /> : <Arm side="r" />;
  // The engine passes `frame` as live motion values (ignored here: the walk is a CSS cycle). A plain
  // number is the lab's way to freeze a pose at that point of its cycle, for screenshots.
  const frozen = typeof frame === "number";
  return (
    <svg
      viewBox="0 0 200 236"
      width={width}
      height={height}
      x={x}
      y={y}
      className="bamby"
      data-pose={known}
      data-motion={playing || frozen ? "on" : "off"}
      data-frozen={frozen ? "" : undefined}
      data-sitting={SITTING.has(known) ? "" : undefined}
      data-talking={talking && !back && !carried.has("mic") ? "" : undefined}
      data-prop={[...carried].join(" ") || undefined}
      style={frozen ? { "--bf": frame } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ids.hair} gradientUnits="userSpaceOnUse" x1="80" y1="28" x2="112" y2="150">
          <stop stopColor="#fcd3e5" />
          <stop offset=".42" stopColor={HAIR} />
          <stop offset="1" stopColor="#e47cad" />
        </linearGradient>
        <linearGradient id={ids.sheen} gradientUnits="userSpaceOnUse" x1="90" y1="40" x2="104" y2="104">
          <stop offset=".15" stopColor="#fff" stopOpacity="0" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.skin} cx=".45" cy=".38" r=".7">
          <stop offset=".4" stopColor="#ffeadf" />
          <stop offset="1" stopColor="#f5cdb9" />
        </radialGradient>
        <linearGradient id={ids.iris} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#3b1037" />
          <stop offset=".45" stopColor="#a23d8e" />
          <stop offset="1" stopColor="#f3a9dc" />
        </linearGradient>
        <radialGradient id={ids.blush}>
          <stop stopColor="#f48aa8" stopOpacity=".95" />
          <stop offset="1" stopColor="#f48aa8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.rim} x1="1" y1="0" x2="0" y2="0">
          <stop stopColor="#d7c6ff" stopOpacity=".6" />
          <stop offset=".22" stopColor="#d7c6ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.ground} cx=".5" cy=".5" r=".5">
          <stop stopColor="#6a4a7a" stopOpacity=".28" />
          <stop offset="1" stopColor="#6a4a7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="bamby__ground" cx="100" cy="231" rx="40" ry="6" fill={`url(#${ids.ground})`} />
      <g className="bamby__body">
        <g className="bamby__bob">
          {back ? (
            <>
              <Leg side="l" />
              <Leg side="r" />
              <BackView ids={ids} />
              <Arm side="l" />
              <Arm side="r" />
            </>
          ) : (
            <>
              <Leg side="l" />
              <Leg side="r" />
              <g className="bamby__torso">
                <path d="M94 147h12v13H94Z" fill="#f3cdb9" />
                <path
                  d="M80 156c10-4 30-4 40 0l11 10c3 8 4 16 3 25-22 6-46 6-68 0-1-9 0-17 3-25Z"
                  fill={JACKET}
                  stroke={JACKET_LINE}
                  strokeWidth="1.6"
                />
                <path d="M131 166c3 8 4 16 3 25-6 2-11 3-17 3 6-10 9-19 14-28Z" fill={KNIT} opacity=".8" />
                {/* Knit texture, the white turtleneck, his pastel bead necklace, the big pink star. */}
                <path d="M71 171c-2 7-2 13-1 19m59-19c2 7 2 13 1 19" stroke={JACKET_LINE} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity=".6" />
                <path d="M88 151q12-5 24 0l1 8q-13 5-26 0Z" fill={TURTLE} stroke={TURTLE_LINE} strokeWidth="1" strokeLinejoin="round" />
                <path d="M88.6 155q11.4 4 22.8 0" stroke={TURTLE_LINE} strokeWidth=".9" fill="none" />
                <g className="bamby__beads">
                  {Array.from({ length: 11 }, (_, i) => {
                    const t = i / 10;
                    const bx = 86 + 28 * t;
                    const by = 160 + 22 * t * (1 - t) * 1.6;
                    return <circle key={i} cx={bx} cy={by} r="1.7" fill={BEADS[i % 4]} stroke="#b9a7c8" strokeWidth=".5" />;
                  })}
                </g>
                <path d={starPath(113, 178, 8.5)} fill={PINK} stroke="#d2659b" strokeWidth=".9" strokeLinejoin="round" opacity=".92" />
                <path d="M66 189c22 6 46 6 68 0v5c-22 6-46 6-68 0Z" fill={KNIT} stroke={JACKET_LINE} strokeWidth=".8" />
                <path d="M72 191.4v4m8-3v4m8-2.4v4m8-2v4m8 0v-4m8 2.4v-4m8 3v-4m8 0v-4" stroke={JACKET_LINE} strokeWidth=".7" opacity=".55" />
              </g>
              <g className="bamby__head">
                <Hair ids={ids} />
                <ellipse cx="46" cy="113" rx="6.5" ry="9.5" fill="#f2c6b2" />
                <ellipse cx="154" cy="113" rx="6.5" ry="9.5" fill="#f2c6b2" />
                <path d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z" fill={`url(#${ids.skin})`} />
                <path d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z" fill={`url(#${ids.rim})`} />
                <BambyFace expression={face} ids={ids} />
                <Fringe ids={ids} />
                <BambyBrows expression={face} />
                <HeartShades down={shadesDown} />
                {carried.has("headset") && <Headset />}
                {known === "bloom" && (
                  <g className="bamby__bloom">
                    <g className="bamby__bloom-squeeze">
                      <rect x="56" y="99" width="88" height="28" rx="14" fill={`url(#${ids.skin})`} />
                      <path d="M68 106l14 6.5-14 6.5M132 106l-14 6.5 14 6.5" fill="none" stroke="#3b2440" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                    <Flower x={32} y={84} r={1.6} className="bamby__flower--1" />
                    <Flower x={168} y={78} r={1.5} tone="#fff0f7" className="bamby__flower--2" />
                    <Flower x={26} y={124} r={1.2} tone="#fff0f7" className="bamby__flower--3" />
                    <Flower x={174} y={120} r={1.3} className="bamby__flower--4" />
                    <Flower x={54} y={32} r={1.15} tone="#ffd0e6" className="bamby__flower--5" />
                    <Flower x={148} y={28} r={1.25} tone="#ffd0e6" className="bamby__flower--6" />
                  </g>
                )}
              </g>
              {known === "snack" && <Peach />}
              <Arm side="l" />
              {rightArm}
            </>
          )}
          {carried.has("heart") && !back && <HeartBurst />}
          {carried.has("mic") && !back && <Notes />}
          {known === "heart" && (
            <g className="bamby__love">
              <path
                d="M100 190c-10-6-11-14-5.5-15 2.6-.4 4.4 1.3 5.5 3.3 1.1-2 2.9-3.7 5.5-3.3 5.5 1 4.5 9-5.5 15Z"
                fill="#ff7fb6"
                stroke="#d2417f"
                strokeWidth="1.2"
              />
              <path
                className="bamby__love-float"
                d="M150 70c-8-5-9-11-4.5-12 2-.3 3.5 1 4.5 2.6 1-1.6 2.5-2.9 4.5-2.6 4.5.8 3.5 7-4.5 12Z"
                fill="#ff9cc6"
              />
            </g>
          )}
        </g>
      </g>
      {known === "vroom" && (
        <g className="bamby__vroom" stroke="#b9a6d8" strokeWidth="2.4" strokeLinecap="round" fill="none">
          {/* The bike is imaginary (that's the joke), so it's only a dashed sketch: seen head-on,
              handlebars in his hands, a wheel between his knees, a headlight, two mirrors. */}
          <g className="bamby__bike" strokeDasharray="3.5 3.5" strokeWidth="2" opacity=".8">
            <path d="M72 184h56M72 184l-6-12m62 12 6-12" />
            <circle cx="64" cy="168" r="4" />
            <circle cx="136" cy="168" r="4" />
            <ellipse cx="100" cy="219" rx="7" ry="13" />
            <path d="M92 186l4 20m12-20-4 20" />
          </g>
          <path className="bamby__speed bamby__speed--1" d="M30 170h-20" />
          <path className="bamby__speed bamby__speed--2" d="M34 190h-26" />
          <path className="bamby__speed bamby__speed--3" d="M30 210h-16" />
          <circle className="bamby__puff" cx="44" cy="222" r="5" fill="#efe8fb" stroke="#cbbbe5" strokeWidth="1.2" />
        </g>
      )}
      {known === "sleep" && (
        <g className="bamby__zzz" fill="#9a7cc0" fontWeight="700" fontFamily="inherit">
          <text x="150" y="66" fontSize="18">z</text>
          <text x="162" y="50" fontSize="13">z</text>
        </g>
      )}
      {known === "scared" && (
        <g className="bamby__feather">
          <path d="M168 40c10-8 18-6 20-2-6 6-14 8-20 2Z" fill="#f6f1fb" stroke="#a99bc0" strokeWidth="1.2" />
          <path d="M166 42c6-2 12-4 20-5" stroke="#a99bc0" strokeWidth="1" fill="none" />
        </g>
      )}
      {(known === "freeze" || known === "cool" || known === "jump") && (
        <g className="bamby__glints" fill="#ffd56e">
          <path d="m30 76 2.6 6.4 6.4 2.6-6.4 2.6L30 94l-2.6-6.4-6.4-2.6 6.4-2.6Z" />
          <path d="m172 58 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
        </g>
      )}
      {known === "count" && (
        <g className="bamby__beats" fill="#b28bd8">
          <path className="bamby__note bamby__note--1" d="M160 70v-14l9-3v14" stroke="#b28bd8" strokeWidth="1.8" fill="none" />
          <circle className="bamby__note bamby__note--1" cx="157.5" cy="70" r="3" />
          <circle className="bamby__note bamby__note--1" cx="166.5" cy="67" r="3" />
        </g>
      )}
    </svg>
  );
}

function Peach() {
  // A big ripe peach with a bite out of it, held up at his chest in both hands.
  return (
    <g className="bamby__peach">
      <path
        d="M100 150c-11 0-16 7-16 15 0 9 8 15 16 15s16-6 16-15c0-4-1.5-7-4-9-2.4 1.6-5.4.2-5.4-2.6-1.6-2-4-3.4-6.6-3.4Z"
        fill="#ffc6a8"
        stroke="#e58d78"
        strokeWidth="1.3"
      />
      <path d="M100 151q-4 13 0 28" stroke="#f0a089" strokeWidth="1.2" fill="none" />
      <ellipse cx="92" cy="161" rx="5.5" ry="7" fill="#ff9db3" opacity=".55" />
      <path d="M92 157q2-3 5-3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />
      <path d="M100 150q2-7 11-7-3 6-11 7Z" fill="#8cc07a" stroke="#5f9152" strokeWidth=".8" />
    </g>
  );
}
