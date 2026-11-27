import { useId } from "react";
import BambyFace, { BambyBrows } from "./Face.jsx";
import "./bambi.css";

// Bamby (PLAVE) as a hand-drawn chibi, in the house style Maomao set: big round head, short body,
// soft gradients, a rim of colour on the shaded side, no outlines heavier than the lashes.
// Original fan art: pink fluffy hair, pink-violet eyes, heart sunglasses pushed up on his head,
// a white dance jacket with black shoulders and pink piping, dark track pants, pink sneakers.
// Every pose is CSS transforms on a fixed rig (see bambi.css); nothing re-renders per frame.

const HAIR = "#f4a7c9";
const HAIR_DEEP = "#d9789f";
const HAIR_LINE = "#b9578a";
const SKIN = "#ffe7d8";
const SKIN_LINE = "#e3b19c";
const JACKET = "#fdfbff";
const JACKET_LINE = "#8f84a8";
const BLACK = "#352d47";
const PINK = "#ef7fb4";
const PANTS = "#3c3549";

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
};
export const BAMBY_POSES = Object.keys(POSE_FACE);

// The poses that keep his heart sunglasses down over his eyes.
const SHADES = new Set(["freeze", "cool"]);
// Sitting poses: he sits on the cloud's surface with his legs over its front edge.
const SITTING = new Set(["sit", "sleep"]);

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
      <path d={`M${ex + (left ? 3.4 : -3.4)} 171l${left ? -1 : 1} 9`} stroke={PINK} strokeWidth="1.6" strokeLinecap="round" />
      <g className={`bamby__fore bamby__fore--${side}`}>
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET_LINE} strokeWidth="14.6" strokeLinecap="round" />
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET} strokeWidth="11.8" strokeLinecap="round" />
        <path d={`M${wx} 193.5v3`} stroke={left ? BLACK : PINK} strokeWidth="12" />
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
          stroke="#272231"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d={`M${x + out * 7} 192l${out * 0.3} 28`} stroke="#f6f1ff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
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

/** His heart sunglasses: pushed up on his head normally, down over his eyes when showing off. */
function HeartShades({ down }) {
  const heart = "M0 7.5C-11 0-11.5-9-5.6-9.6-2.6-9.9-.8-7.6 0-5.2.8-7.6 2.6-9.9 5.6-9.6 11.5-9 11 0 0 7.5Z";
  if (down) {
    return (
      <g className="bamby__shades bamby__shades--down">
        <path d="M52 108q-4 1-7 4m103-4q4 1 7 4" stroke="#d2417f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M89 108q11-5 22 0" stroke="#d2417f" strokeWidth="2.4" fill="none" />
        {[77, 123].map((x) => (
          <g key={x} transform={`translate(${x} 113) scale(1.55)`}>
            <path d={heart} fill="#ff6fae" fillOpacity=".88" stroke="#d2417f" strokeWidth="1.5" />
            <path d="M-6-5.6q-2 1.4-2.2 4" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".9" />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g className="bamby__shades">
      <path d="M78 50q11-4 22-1.2 11-2.8 22 1.2" stroke="#d2417f" strokeWidth="2.2" fill="none" />
      {[85, 115].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i ? 48 : 49}) rotate(${i ? 6 : -6}) scale(1.08)`}>
          <path d={heart} fill="#ff86bb" stroke="#d2417f" strokeWidth="1.6" />
          <path d="M-6-5.6q-2 1.4-2.2 4" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
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

// His hair is fluffy and wavy all over: a cloud of soft curls rather than a smooth bob.
const HAIR_OUTLINE = [
  [46, 136], [37, 120], [33, 101], [36, 81], [44, 63], [57, 47], [74, 36], [92, 30], [110, 30],
  [128, 35], [144, 46], [157, 62], [165, 80], [168, 100], [164, 120], [155, 136],
];
const BACK_HAIR = `${curls(HAIR_OUTLINE, 5.5)}L146 142H54Z`;
const CROWN = "M44 104C42 64 66 41 100 41s58 23 56 63";
// The fringe's lower edge, right to left: wavy locks that hook at the tips, down to the brows.
const FRINGE_EDGE =
  "M156 104C152 98 150 92 148 85C147 93 145 99 139 102C140 94 137 87 132 81C131 90 128 96 122 99C123 91 120 85 115 79C114 88 111 95 105 98C106 90 103 84 98 79C97 88 94 94 88 97C89 89 86 84 81 80C80 89 77 95 71 99C72 91 69 86 65 83C64 92 61 98 56 102C56 96 53 92 51 88C50 96 48 101 44 104";
const FRINGE = `${CROWN}${FRINGE_EDGE.replace(/^M156 104/, "")}Z`;
const BACK_HEAD = `${curls(
  [[60, 146], [44, 132], [36, 114], [33, 95], [37, 76], [46, 59], [60, 45], [78, 35], [100, 30], [122, 35], [140, 45], [154, 59], [163, 76], [167, 95], [164, 114], [156, 132], [140, 146]],
  5.5,
)}C132 151 124 149 118 152C112 148 104 148 100 152C96 148 88 148 82 152C76 149 68 151 60 146Z`;
const SIDE_LOCKS =
  "M48 93C42 103 40 115 42 126C39 125 36 127 36 130C41 135 49 133 52 126C53 119 55 113 56 108C56 113 58 117 61 119C59 111 59 103 60 97ZM152 93C158 103 160 115 158 126C161 125 164 127 164 130C159 135 151 133 148 126C147 119 145 113 144 108C144 113 142 117 139 119C141 111 141 103 140 97Z";

function Hair({ ids }) {
  return (
    <>
      <path d={BACK_HAIR} fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Curl texture on the crown and sides. */}
      <path
        d="M58 56q5-7 13-5m10-11q7-5 15-2m12-1q8-3 14 2m11 7q7 0 10 7M41 92q-2-8 2-14m116 14q2-8-2-14M42 118q-3-6-1-12m118 12q3-6 1-12"
        stroke={HAIR_DEEP}
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

function Fringe({ ids }) {
  return (
    <>
      <path d={FRINGE} fill={`url(#${ids.hair})`} />
      <path d={FRINGE} fill={`url(#${ids.sheen})`} />
      <path d={FRINGE_EDGE} stroke={HAIR_LINE} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* Strand lines running down into each lock. */}
      <path
        d="M140 64q6 10 6 22m-22-34q5 12 4 26m-20-30q3 13 1 26m-18-25q0 12-4 24m-14-18q-4 9-5 19m-12-6q-4 6-5 12"
        stroke={HAIR_DEEP}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d={SIDE_LOCKS} fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M68 50q14-8 30-8" stroke="#ffe3f0" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M112 44q9 1 15 5" stroke="#ffe3f0" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".6" />
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
      <path d="M80 156c10-4 30-4 40 0l11 10c-9 4-19 3-31 6-12-3-22-2-31-6Z" fill={BLACK} />
      <path
        className="bamby__back-heart"
        d="M100 186c-10-6-10-13-5-14 2.4-.4 4 1.2 5 3 1-1.8 2.6-3.4 5-3 5 1 5 8-5 14Z"
        fill={PINK}
        stroke="#c4568d"
        strokeWidth="1"
      />
      <path d="M66 190c22 6 46 6 68 0v4c-22 6-46 6-68 0Z" fill={PINK} />
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
        <path d="M100 30c-3-9 5-16 13-12-6 1-8 5-7 10" fill={HAIR} stroke={HAIR_LINE} strokeWidth="1.4" />
        <HeartShades />
      </g>
    </g>
  );
}

export default function BambyBody({
  pose = "idle",
  expression,
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
      data-talking={talking && !back ? "" : undefined}
      style={frozen ? { "--bf": frame } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ids.hair} gradientUnits="userSpaceOnUse" x1="80" y1="28" x2="112" y2="150">
          <stop stopColor="#ffc6de" />
          <stop offset=".4" stopColor={HAIR} />
          <stop offset="1" stopColor="#e584b0" />
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
          <stop stopColor="#5b1f55" />
          <stop offset=".5" stopColor="#c8478f" />
          <stop offset="1" stopColor="#f8a4cf" />
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
                <path d="M131 166c3 8 4 16 3 25-6 2-11 3-17 3 6-10 9-19 14-28Z" fill="#e7e0f3" opacity=".8" />
                <path d="M80 156c10-4 30-4 40 0l11 10c-9 4-19 3-31 6-12-3-22-2-31-6Z" fill={BLACK} />
                <path d="M90 152.5h20l-2.5 6.5h-15Z" fill={BLACK} stroke="#4a4258" strokeWidth=".8" />
                <path d="M100 160v33" stroke={PINK} strokeWidth="1.7" />
                <path d="M71 171c-2 7-2 13-1 19m59-19c2 7 2 13 1 19" stroke={PINK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path
                  d="M114 179c-5-3-5-6.6-2.6-7 1.2-.2 2 .6 2.6 1.5.6-.9 1.4-1.7 2.6-1.5 2.4.4 2.4 4-2.6 7Z"
                  fill={PINK}
                />
                <path d="M66 190c22 6 46 6 68 0v4c-22 6-46 6-68 0Z" fill={PINK} stroke="#c4568d" strokeWidth=".8" />
              </g>
              <g className="bamby__head">
                <Hair ids={ids} />
                <g className="bamby__tuft">
                  <path d="M101 31c-4-11 5-19 15-14-7 0-10 5-9 11" fill={HAIR} stroke={HAIR_LINE} strokeWidth="1.5" strokeLinejoin="round" />
                </g>
                <ellipse cx="46" cy="113" rx="6.5" ry="9.5" fill="#f2c6b2" />
                <ellipse cx="154" cy="113" rx="6.5" ry="9.5" fill="#f2c6b2" />
                <path d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z" fill={`url(#${ids.skin})`} />
                <path d="M45 92q0-42 55-43 55 1 55 43v24q-4 39-55 40-51-1-55-40Z" fill={`url(#${ids.rim})`} />
                <BambyFace expression={face} ids={ids} />
                <Fringe ids={ids} />
                <BambyBrows expression={face} />
                <HeartShades down={shadesDown} />
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
              <Arm side="r" />
            </>
          )}
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
