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
const BLACK = "#2d2838";
const PINK = "#ef7fb4";
const PANTS = "#3c3549";

// What each pose looks like when no line is setting the face.
const POSE_FACE = {
  idle: "neutral",
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
      <path d={`M${sx} 163L${sx - (left ? 1.2 : -1.2)} 169`} stroke={BLACK} strokeWidth="12.6" strokeLinecap="round" />
      <path d={`M${ex + (left ? 3.4 : -3.4)} 171l${left ? -1 : 1} 9`} stroke={PINK} strokeWidth="1.6" strokeLinecap="round" />
      <g className={`bamby__fore bamby__fore--${side}`}>
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET_LINE} strokeWidth="14.6" strokeLinecap="round" />
        <path d={`M${ex} 181L${wx} 195`} stroke={JACKET} strokeWidth="11.8" strokeLinecap="round" />
        <path d={`M${wx} 193.5v3`} stroke={left ? BLACK : PINK} strokeWidth="12" />
        <g className={`bamby__hand bamby__hand--${side}`}>
          <circle cx={wx} cy="201" r="6.4" fill={SKIN} stroke={SKIN_LINE} strokeWidth="1.1" />
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
          d={`M${x - 8.5} 196h17l-.6 27h-15.8Z`}
          fill={PANTS}
          stroke="#272231"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d={`M${x + out * 7} 199l${out * 0.3} 21`} stroke="#f6f1ff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
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

function Hair({ ids }) {
  return (
    <>
      {/* The fluffy mass behind the face, with a curl out at each side of the nape. */}
      <path
        d="M41 136C29 120 28 97 34 78 40 55 57 36 79 29c14-6 32-6 46-1 22 7 38 25 42 49 5 21 2 42-7 59-4 6-11 6-13 0l-1-6H55l-2 6c-3 6-9 5-12 0Z"
        fill={`url(#${ids.hair})`}
        stroke={HAIR_LINE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M46 126q-6-10-6-24m118 24q6-10 6-24" stroke={HAIR_DEEP} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  );
}

function Fringe({ ids }) {
  // Wavy, choppy fringe swept a little to his right, tips curling, down to the brows.
  const d =
    "M45 106C37 72 61 45 100 45s65 27 55 61c-3-6-6-12-10-20-2 7-5 13-11 17-1-9-3-15-8-21-3 9-8 15-16 19 1-9-1-15-5-21-4 8-10 14-19 17 2-8 1-14-2-19-4 8-9 13-16 16 1-7 0-12-3-17-4 9-8 16-15 26Z";
  return (
    <>
      <path d={d} fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={d} fill={`url(#${ids.sheen})`} />
      {/* Strand lines and the side locks that frame his cheeks. */}
      <path
        d="M64 64q-8 10-9 22m25-30q-5 12-3 26m22-28q2 12-2 24m19-21q6 9 5 20m15-11q4 6 4 14"
        stroke={HAIR_DEEP}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M46 92c-6 14-4 30 5 42 1-12 5-24 10-34Zm108 0c6 14 4 30-5 42-1-12-5-24-10-34Z" fill={`url(#${ids.hair})`} stroke={HAIR_LINE} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M70 52q14-8 30-7" stroke="#ffe0ee" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
    </>
  );
}

/** The back of his head and jacket, for the sky-gazing pose (back turned, hand on his waist). */
function BackView({ ids }) {
  return (
    <g className="bamby__back">
      <path d="M94 148h12v12H94Z" fill="#f3cdb9" />
      <path
        d="M80 156c10-4 30-4 40 0l11 10c3 10 4 20 3 32-22 6-46 6-68 0-1-12 0-22 3-32Z"
        fill={JACKET}
        stroke={JACKET_LINE}
        strokeWidth="1.6"
      />
      <path d="M80 156c10-4 30-4 40 0l11 10c-9 4-19 3-31 6-12-3-22-2-31-6Z" fill={BLACK} />
      <path
        className="bamby__back-heart"
        d="M100 192c-10-6-10-13-5-14 2.4-.4 4 1.2 5 3 1-1.8 2.6-3.4 5-3 5 1 5 8-5 14Z"
        fill={PINK}
        stroke="#c4568d"
        strokeWidth="1"
      />
      <path d="M66 197c22 6 46 6 68 0v4c-22 6-46 6-68 0Z" fill={PINK} />
      <g className="bamby__head bamby__head--back">
        <path
          d="M44 128C30 106 33 70 52 50c15-16 33-21 48-21s34 5 48 21c19 20 22 56 8 78-6 10-18 18-28 20H72c-10-2-22-10-28-20Z"
          fill={`url(#${ids.hair})`}
          stroke={HAIR_LINE}
          strokeWidth="1.6"
        />
        <path
          d="M66 70q8 30 4 64m30-96q-4 40 0 100m34-68q-8 30-4 64M50 100q4 18 12 32m88-32q-4 18-12 32"
          stroke={HAIR_DEEP}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M82 140q6 8 0 14m36-14q-6 8 0 14m-18-16v14" stroke={HAIR_DEEP} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M100 30c-3-9 5-16 13-12-6 1-8 5-7 10" fill={HAIR} stroke={HAIR_LINE} strokeWidth="1.4" />
        <g transform="translate(0 -2)">
          <path d="M78 50q11-4 22-1.2 11-2.8 22 1.2" stroke="#d2417f" strokeWidth="2.4" fill="none" />
        </g>
      </g>
    </g>
  );
}

export default function BambyBody({
  pose = "idle",
  expression,
  facing = 1,
  playing = true,
  frame,
  width = 100,
  height = 118,
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
      style={{
        "--bf": frozen ? frame : 0,
        transform: facing < 0 ? "scaleX(-1)" : undefined,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ids.hair} x1="0" y1="0" x2=".25" y2="1">
          <stop stopColor="#ffc4dc" />
          <stop offset=".45" stopColor={HAIR} />
          <stop offset="1" stopColor="#e88ab4" />
        </linearGradient>
        <linearGradient id={ids.sheen} x1="0" y1="0" x2=".2" y2="1">
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
                  d="M80 156c10-4 30-4 40 0l11 10c3 10 4 20 3 32-22 6-46 6-68 0-1-12 0-22 3-32Z"
                  fill={JACKET}
                  stroke={JACKET_LINE}
                  strokeWidth="1.6"
                />
                <path d="M131 166c3 10 4 20 3 32-6 2-11 3-17 3 6-12 9-24 14-35Z" fill="#e7e0f3" opacity=".8" />
                <path d="M80 156c10-4 30-4 40 0l11 10c-9 4-19 3-31 6-12-3-22-2-31-6Z" fill={BLACK} />
                <path d="M90 152.5h20l-2.5 6.5h-15Z" fill={BLACK} stroke="#4a4258" strokeWidth=".8" />
                <path d="M100 160v40" stroke={PINK} strokeWidth="1.7" />
                <path d="M71 171c-2 9-2 18-1 26m59-26c2 9 2 18 1 26" stroke={PINK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path
                  d="M114 183c-5-3-5-6.6-2.6-7 1.2-.2 2 .6 2.6 1.5.6-.9 1.4-1.7 2.6-1.5 2.4.4 2.4 4-2.6 7Z"
                  fill={PINK}
                />
                <path d="M66 197c22 6 46 6 68 0v4c-22 6-46 6-68 0Z" fill={PINK} stroke="#c4568d" strokeWidth=".8" />
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
                    <Flower x={36} y={84} r={1.15} className="bamby__flower--1" />
                    <Flower x={164} y={80} r={1.05} tone="#fff0f7" className="bamby__flower--2" />
                    <Flower x={28} y={124} r={0.85} tone="#fff0f7" className="bamby__flower--3" />
                    <Flower x={172} y={122} r={0.95} className="bamby__flower--4" />
                    <Flower x={58} y={34} r={0.8} tone="#ffd0e6" className="bamby__flower--5" />
                    <Flower x={146} y={30} r={0.9} tone="#ffd0e6" className="bamby__flower--6" />
                  </g>
                )}
              </g>
              <Arm side="l">
                {known === "snack" && <Peach />}
              </Arm>
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
  return (
    <g className="bamby__peach">
      <circle cx="80" cy="194" r="9" fill="#ffc2a6" stroke="#e8907a" strokeWidth="1.2" />
      <path d="M80 186q-3 8 0 16" stroke="#f0a28c" strokeWidth="1.2" fill="none" />
      <circle cx="84" cy="191" r="3" fill="#ff9fb0" opacity=".6" />
      <path d="M80 185q3-5 8-4-3 4-8 4Z" fill="#8cc07a" stroke="#5f9152" strokeWidth=".8" />
    </g>
  );
}
