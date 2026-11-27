import { useId, useSyncExternalStore } from "react";
import MikuFace from "./Face.jsx";
import "./miku.css";

// Hatsune Miku (classic V2 look, KEI 2007) as an original hand-drawn chibi in the house style of
// Maomao (src/world/mascot/MaomaoMascot.jsx): big head, small body, soft gradient fills, thin
// same-hue outlines, a slow breath and a blink. Fan art under the Piapro Character License; see
// index.js for the credit. Drawn on a 220 x 240 grid, feet at (110, 236).
//
// Layers, back to front: her twin tails and the hair behind her head, legs, skirt, top, head (face,
// fringe, headset), arms, and little effects (notes, z's, "!"). The tails and the head share one
// "headrig" clock so the tails stay attached when she tilts her head.

export const W = 220;
export const H = 240;

const SKIN = "#fff2ea";
const SKIN_SHADE = "#f1d3c6";
const HAIR = "#3cc8c6";
const HAIR_DARK = "#12878f";
const HAIR_LINE = "#1a9aa1";
const HAIR_LIGHT = "#9debe2";
const SHIRT_LINE = "#7f8a93";
const TEAL = "#2dbebe";
const TEAL_DARK = "#14868d";
const INK = "#2c313b"; // skirt, sleeves, boots
const INK_LINE = "#1b1f27";
const INK_HI = "#4b5262";
const MAGENTA = "#e8489b";
const SLATE = "#3a404c";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (listener) => {
  const query = matchMedia(reducedQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const readReduced = () => matchMedia(reducedQuery).matches;

// The expression a pose wears when the engine doesn't ask for a particular one.
const POSE_FACE = {
  idle: "happy",
  walk: "happy",
  jump: "joy",
  fall: "surprised",
  land: "joy",
  sit: "happy",
  wave: "joy",
  react: "surprised",
  sleep: "asleep",
  held: "flustered",
  sing: "sing",
  swish: "wink",
  leek: "joy",
  point: "proud",
  dance: "joy",
};

export const MIKU_POSES = Object.keys(POSE_FACE);

// Poses where she sits on the cloud: her seat is the feet line and her legs hang over the front.
const SEATED = new Set(["sit", "sleep"]);
// Poses with nothing under her: no contact shadow.
const AIRBORNE = new Set(["jump", "fall", "held"]);

/* ------------------------------------------------------------------------------------------------
   Hair
   ------------------------------------------------------------------------------------------------ */

// Her right tail (viewer's left). The right-hand one is the same shape mirrored.
const TAIL =
  "M62 50C40 40 15 64 13 106C11 150 20 192 43 228C42 216 43 207 46 199C49 205 53 209 58 212C51 186 49 150 53 118C56 94 63 76 74 62Z";
const TAIL_STRANDS = "M47 60C29 84 24 142 36 202M56 72C42 102 38 150 45 198M30 90C22 120 22 160 30 190";
const TAIL_SHEEN = "M32 74C22 96 20 124 23 148";

function Tail({ side, uid }) {
  const mirror = side === "l" ? undefined : `translate(${W} 0) scale(-1 1)`;
  return (
    <g transform={mirror}>
      <g className={`hmiku__tail hmiku__tail--${side}`} style={{ transformOrigin: "60px 52px" }}>
        <path d={TAIL} fill={`url(#${uid}-tail)`} stroke={HAIR_LINE} strokeWidth="1.3" strokeLinejoin="round" />
        <path d={TAIL_STRANDS} fill="none" stroke={HAIR_DARK} strokeWidth="1.3" strokeLinecap="round" opacity=".38" />
        <path d={TAIL_SHEEN} fill="none" stroke={HAIR_LIGHT} strokeWidth="4.5" strokeLinecap="round" opacity=".55" />
      </g>
    </g>
  );
}

function HairTie({ side }) {
  const x = side === "l" ? 54 : W - 54;
  const turn = side === "l" ? -22 : 22;
  return (
    <g transform={`translate(${x} 50) rotate(${turn})`}>
      <path d="M-10-17h20l1 31H-11Z" fill={SLATE} stroke="#22262e" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M-6.5-14.5h5.2v26.5h-5.8Z" fill={MAGENTA} />
      <path d="M1.4-14.5h5.2l.6 26.5H1.4Z" fill={MAGENTA} />
      <path d="M-8-15.6h16" stroke="#6a7282" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function Fringe({ uid }) {
  const d =
    "M43 126C35 74 63 37 110 37C157 37 185 74 177 126C177 142 173 158 166 170C163 150 159 132 155 116C153 104 151 96 148 89C146 99 143 106 136 112C137 100 135 91 130 83C128 94 125 101 120 106C120 97 119 88 117 80C115 98 112 112 106 125C106 107 104 92 100 81C97 93 93 101 87 108C87 98 85 90 82 85C79 96 75 104 69 111C69 103 68 96 67 91C64 101 63 109 63 117C59 134 57 152 54 170C47 158 43 142 43 126Z";
  return (
    <g>
      <path d={d} fill={`url(#${uid}-hair)`} stroke={HAIR_LINE} strokeWidth="1.2" strokeLinejoin="round" />
      {/* strand lines and the glossy ring across the crown */}
      <path
        d="M86 50Q74 70 77 92M110 44Q106 64 110 104M134 50Q146 70 143 92M64 70Q58 96 60 124M156 70Q162 96 160 124"
        fill="none"
        stroke={HAIR_DARK}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".3"
      />
      <path d="M66 64Q110 40 154 64" fill="none" stroke={HAIR_LIGHT} strokeWidth="5" strokeLinecap="round" opacity=".6" />
      <path d="M76 58Q110 44 144 58" fill="none" stroke="#e9fffb" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </g>
  );
}

function Headset() {
  return (
    <g className="hmiku__headset">
      {[44, W - 44].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="120" rx="9.5" ry="12" fill={SLATE} stroke="#20242c" strokeWidth="1.2" />
          <ellipse cx={x} cy="120" rx="5.6" ry="8" fill="none" stroke={MAGENTA} strokeWidth="2.4" />
          <ellipse cx={x} cy="120" rx="2" ry="3.2" fill="#ff9fcf" opacity=".8" />
        </g>
      ))}
    </g>
  );
}

// The microphone boom on her right, curving round to her mouth; drawn over the cheek and side lock.
function Mic() {
  return (
    <g className="hmiku__mic">
      <path d="M47 130Q53 151 82 150" fill="none" stroke="#2a2f38" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M48 131Q54 149 80 149" fill="none" stroke="#6f7787" strokeWidth=".8" strokeLinecap="round" opacity=".8" />
      <rect x="80" y="146.4" width="8" height="6" rx="3" fill={SLATE} stroke="#20242c" strokeWidth="1" />
      <circle cx="86" cy="149.4" r="1.3" fill={MAGENTA} opacity=".85" />
    </g>
  );
}

/* ------------------------------------------------------------------------------------------------
   Body parts
   ------------------------------------------------------------------------------------------------ */

function Torso({ uid }) {
  return (
    <g className="hmiku__torso">
      <path d="M103 152h14v14h-14Z" fill={SKIN_SHADE} />
      <path
        d="M89 160H131L140 170 137 195Q110 201 83 195L80 170Z"
        fill={`url(#${uid}-shirt)`}
        stroke={SHIRT_LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* teal edge along the hem, and the little yellow tag */}
      <path d="M83 195Q110 201 137 195" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="121" y="175" width="8.5" height="2.8" rx=".8" fill="#ead64e" stroke="#b6a13a" strokeWidth=".6" />
      {/* collar */}
      <path d="M110 163 95 156 91 167 104 171Z" fill="#c3cbd0" stroke={TEAL} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M110 163 125 156 129 167 116 171Z" fill="#c3cbd0" stroke={TEAL} strokeWidth="1.5" strokeLinejoin="round" />
      {/* tie */}
      <path d="M106 164h8l-1.2 5h-5.6Z" fill={TEAL_DARK} />
      <path
        className="hmiku__tie"
        d="M107.2 169h5.6l3.4 23-6.2 6.4-6.2-6.4Z"
        fill={TEAL}
        stroke={TEAL_DARK}
        strokeWidth="1"
        strokeLinejoin="round"
        style={{ transformOrigin: "110px 169px" }}
      />
      <path d="M109 172l-1.4 18" stroke="#8ff0e6" strokeWidth="1.3" strokeLinecap="round" opacity=".7" />
    </g>
  );
}

function Skirt() {
  return (
    <g className="hmiku__skirt" style={{ transformOrigin: "110px 192px" }}>
      <path d="M86 191H134L149 213Q110 224 71 213Z" fill={INK} stroke={INK_LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M98 194 91 217M110 194V220M122 194 129 217" stroke={INK_HI} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M72 213Q110 224 148 213" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
      <path d="M78 209Q110 218 142 209" fill="none" stroke={TEAL_DARK} strokeWidth="1" opacity=".55" />
    </g>
  );
}

// One standing leg, drawn from the hip (0, 0) down to the sole at (0, 30).
function Leg() {
  return (
    <g>
      <rect x="-4.6" y="0" width="9.2" height="18" rx="4.4" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      <path d="M-5.8 14.5h11.6V25.5q0 4.5-4 4.5H-2.6q-3.8 0-3.6-3.6Z" fill={INK} stroke={INK_LINE} strokeWidth="1.1" />
      <rect x="-6.4" y="13.2" width="12.8" height="3.4" rx="1.4" fill={TEAL} stroke={TEAL_DARK} strokeWidth=".7" />
      <path d="M-5 29.4q5 1.6 10 0" stroke={TEAL} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M-2.4 18v7" stroke={INK_HI} strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}

// A seated leg seen from the front: the knee peeking from under the skirt and the shin hanging
// over the cloud's edge, toe turned out. Drawn from the knee (0, 0).
function SeatedLeg() {
  return (
    <g>
      <rect x="-4.6" y="-1" width="9.2" height="19" rx="4.4" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      <ellipse cx="0" cy="0" rx="6" ry="4.4" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      <path d="M-5.6 15h11.2v14H-5.6Z" fill={INK} stroke={INK_LINE} strokeWidth="1.1" />
      <rect x="-6.2" y="13.6" width="12.4" height="3.4" rx="1.4" fill={TEAL} stroke={TEAL_DARK} strokeWidth=".7" />
      <ellipse cx="0" cy="30" rx="6.6" ry="4" fill={INK} stroke={INK_LINE} strokeWidth="1.1" />
      <path d="M-5.4 32.2q5.4 3 10.8 0" stroke={TEAL} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M-2.2 18v9" stroke={INK_HI} strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}

function Leek() {
  // Held at the white end; the green leaves fan out at the far end. Points along +y from the hand.
  return (
    <g className="hmiku__leek-prop">
      <path d="M-1.6-6.5-3-9.6M0-6.6V-10M1.6-6.5 3-9.6" stroke="#cdbf9a" strokeWidth="1" strokeLinecap="round" />
      <rect x="-3.3" y="-7" width="6.6" height="27" rx="3.2" fill="url(#hmiku-leek)" stroke="#a8c48c" strokeWidth=".9" />
      <path d="M-2.8 19C-6 28-7 36-8 44-4 38-2 30 0 23Z" fill="#74b85a" stroke="#4f8f45" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M2.8 19C6 28 8 35 9 42 4.6 37 2 30 0 23Z" fill="#8bc865" stroke="#4f8f45" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M-1 20C-1 30 0 38 1 47 2.6 38 2.6 29 1.2 20Z" fill="#9bd46f" stroke="#4f8f45" strokeWidth=".9" strokeLinejoin="round" />
    </g>
  );
}

// One arm, hung from the shoulder at (0, 0) and pointing down +y: bare upper arm, the detached
// sleeve flaring to a teal cuff, and the hand at (0, 37). `mark` puts the red 01 on her left
// shoulder; `panel` the little readout on her left sleeve.
function Arm({ mark, panel, facing, children, finger }) {
  return (
    <g>
      <rect x="-4.6" y="-3" width="9.2" height="19" rx="4.6" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      {mark && (
        // "01" in red. Counter-flipped when she faces left so it never reads backwards.
        <g transform={facing < 0 ? "scale(-1 1)" : undefined}>
          <path d="M-1.4 4.6a1.2 1.9 0 1 0 .01 0Z M1.6 2.8v3.8" fill="none" stroke="#e3434e" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}
      <path d="M-5.6 11H5.6L9.6 32Q0 36.4-9.6 32Z" fill={INK} stroke={INK_LINE} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M-4.4 13H4.4" stroke={TEAL} strokeWidth="1.2" opacity=".8" />
      {panel && (
        <g>
          <rect x="-4" y="19" width="8" height="7.4" rx=".8" fill="#1e232b" />
          <path d="M-3 20.6h6M-3 22.6h4.4M-3 24.6h5.4" stroke="#d9da4c" strokeWidth="1" />
        </g>
      )}
      <path d="M-9.6 32Q0 36.4 9.6 32L10.4 35.4Q0 40.6-10.4 35.4Z" fill={TEAL} stroke={TEAL_DARK} strokeWidth=".9" strokeLinejoin="round" />
      <ellipse cx="0" cy="40.4" rx="4.7" ry="5.2" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".9" />
      {finger && (
        <g className="hmiku__finger" style={{ transformOrigin: "0 40.4px" }}>
          <rect x="-1.7" y="41" width="3.4" height="9.5" rx="1.7" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
        </g>
      )}
      {children && <g transform="translate(0 41)">{children}</g>}
    </g>
  );
}

function Note({ className, x, y, flag = 1, fill = TEAL }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`hmiku__note ${className}`}>
        <ellipse cx="0" cy="0" rx="4" ry="3" transform="rotate(-22)" fill={fill} />
        <path d={`M3.4-1.2V-15${flag ? "q4 2 6 6.6" : ""}`} fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Glint({ x, y, r = 5, className = "" }) {
  return (
    <path
      className={`hmiku__glint ${className}`}
      d={`M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}Z`}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
  );
}

/* ------------------------------------------------------------------------------------------------
   The body
   ------------------------------------------------------------------------------------------------ */

export default function MikuBody({ pose = "idle", expression, facing = 1, playing = true, scale = 1 }) {
  const raw = useId();
  const uid = `hm${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => true);
  const known = POSE_FACE[pose] ? pose : "idle";
  const face = expression ?? POSE_FACE[known];
  const animate = playing && !reduced;
  const seated = SEATED.has(known);
  const leek = known === "leek";
  const finger = known === "point";

  return (
    <svg
      className="hmiku"
      data-pose={known}
      data-face={face}
      data-motion={animate ? "on" : "off"}
      viewBox={`0 0 ${W} ${H}`}
      width={110 * scale}
      height={120 * scale}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2=".2" y2="1">
          <stop stopColor="#5ad8d2" />
          <stop offset=".5" stopColor={HAIR} />
          <stop offset="1" stopColor="#25aab0" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} x1="0" y1="0" x2=".3" y2="1">
          <stop stopColor={HAIR} />
          <stop offset=".55" stopColor="#2fb7b8" />
          <stop offset="1" stopColor="#1a98a0" />
        </linearGradient>
        <linearGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#20a3a8" />
          <stop offset="1" stopColor="#13838c" />
        </linearGradient>
        <radialGradient id={`${uid}-skin`} cx=".46" cy=".4" r=".72">
          <stop offset=".45" stopColor="#fff5ee" />
          <stop offset="1" stopColor="#f6d9cc" />
        </radialGradient>
        <linearGradient id={`${uid}-shirt`} x1="0" y1="0" x2=".35" y2="1">
          <stop stopColor="#c9d1d6" />
          <stop offset=".6" stopColor="#b1bbc2" />
          <stop offset="1" stopColor="#99a4ad" />
        </linearGradient>
        <linearGradient id={`${uid}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#0c5f6a" />
          <stop offset=".45" stopColor="#1aa3a8" />
          <stop offset="1" stopColor="#7fe8dc" />
        </linearGradient>
        <radialGradient id={`${uid}-blush`}>
          <stop stopColor="#f490ab" stopOpacity=".95" />
          <stop offset="1" stopColor="#f490ab" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-ground`} cx=".5" cy=".5" r=".5">
          <stop stopColor="#4f4a6b" stopOpacity=".26" />
          <stop offset="1" stopColor="#4f4a6b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hmiku-leek" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".3" stopColor="#fbfff4" />
          <stop offset="1" stopColor="#cfe9a6" />
        </linearGradient>
      </defs>

      {!AIRBORNE.has(known) && (
        <ellipse className="hmiku__shadow" cx="110" cy="236" rx={seated ? 44 : 36} ry="5" fill={`url(#${uid}-ground)`} />
      )}

      <g transform={facing < 0 ? `translate(${W} 0) scale(-1 1)` : undefined}>
        <g className="hmiku__root">
          <g className="hmiku__breath">
            {/* --- behind the body: tails, back hair, ties --------------------------------- */}
            <g className="hmiku__upper">
              <g className="hmiku__headrig">
                <Tail side="l" uid={uid} />
                <Tail side="r" uid={uid} />
                <path
                  d="M46 104C42 62 72 34 110 34C148 34 178 62 174 104L172 150Q160 162 148 152H72Q60 162 48 150Z"
                  fill={`url(#${uid}-back)`}
                />
                <HairTie side="l" />
                <HairTie side="r" />
              </g>
            </g>

            {/* --- legs ------------------------------------------------------------------- */}
            {seated ? (
              <g className="hmiku__legs hmiku__legs--seated">
                <ellipse cx="110" cy="237" rx="34" ry="4" fill="#3d4f6b" opacity=".12" />
                <g transform="translate(103 240)">
                  <g className="hmiku__shin hmiku__shin--l">
                    <SeatedLeg />
                  </g>
                </g>
                <g transform="translate(117 240)">
                  <g className="hmiku__shin hmiku__shin--r">
                    <SeatedLeg />
                  </g>
                </g>
              </g>
            ) : (
              <g className="hmiku__legs">
                <g transform="translate(101 206)">
                  <g className="hmiku__leg hmiku__leg--l">
                    <Leg />
                  </g>
                </g>
                <g transform="translate(119 206)">
                  <g className="hmiku__leg hmiku__leg--r">
                    <Leg />
                  </g>
                </g>
              </g>
            )}

            {/* --- the rest of her rides on "upper" so sitting can lower it onto the cloud ---- */}
            <g className="hmiku__upper">
              <Skirt />
              <Torso uid={uid} />
              <g className="hmiku__headrig">
                <g className="hmiku__head">
                  <Headset />
                  <path
                    d="M52 100C52 70 76 52 110 52C144 52 168 70 168 100V120C166 148 144 161 110 162C76 161 54 148 52 120Z"
                    fill={`url(#${uid}-skin)`}
                  />
                  <MikuFace expression={face} moving={animate} uid={uid} />
                  <Fringe uid={uid} />
                  <Mic />
                </g>
              </g>

              {/* arms: her right (viewer's left) and her left (viewer's right) */}
              <g transform="translate(86 167)">
                <g className="hmiku__arm hmiku__arm--r">
                  <Arm facing={facing} finger={finger}>
                    {leek && (
                      <g className="hmiku__leek">
                        <Leek />
                      </g>
                    )}
                  </Arm>
                </g>
              </g>
              <g transform="translate(134 167)">
                <g className="hmiku__arm hmiku__arm--l">
                  <Arm mark panel facing={facing} />
                </g>
              </g>

              {/* --- little effects ------------------------------------------------------- */}
              <g className="hmiku__fx">
                <g className="hmiku__notes">
                  <Note className="hmiku__note--1" x={170} y={70} />
                  <Note className="hmiku__note--2" x={186} y={92} flag={0} fill={MAGENTA} />
                  <Note className="hmiku__note--3" x={160} y={54} />
                </g>
                <g className="hmiku__zzz" fill="none" stroke="#8d7bb5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path className="hmiku__z hmiku__z--1" d="M162 66h8l-8 9h8" />
                  <path className="hmiku__z hmiku__z--2" d="M176 46h6l-6 7h6" />
                </g>
                <g className="hmiku__bang">
                  <path d="M180 50l-3 20" stroke={MAGENTA} strokeWidth="4" strokeLinecap="round" />
                  <circle cx="175.6" cy="79" r="2.4" fill={MAGENTA} />
                </g>
                <g className="hmiku__glints" fill="#ffe27a">
                  <Glint x={28} y={70} r={6} className="hmiku__glint--1" />
                  <Glint x={192} y={110} r={5} className="hmiku__glint--2" />
                  <Glint x={180} y={40} r={4} className="hmiku__glint--3" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
