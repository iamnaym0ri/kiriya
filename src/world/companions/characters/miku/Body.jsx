import { memo, useId, useSyncExternalStore } from "react";
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
// Round 2 ramp, from the official costume sheet and the Nendoroid paint (lighter at the roots so
// the hair stops reading as one heavy mass; only the bottom third of the tails darkens).
const HAIR = "#2cc4cf";
const HAIR_DARK = "#0f9aa6";
const HAIR_LINE = "#0e7480";
const HAIR_LIGHT = "#7fdce3";
const SHIRT_LINE = "#7f8a93";
const TEAL = "#1cc4d4";
const TEAL_DARK = "#0b8593";
const INK = "#2c313b"; // skirt, sleeves, boots
const INK_LINE = "#1b1f27";
const INK_HI = "#4b5262";
const MAGENTA = "#e72d8a";
const PINK_HI = "#ff6fb5";
const SLATE = "#3a3d42";
const RED_01 = "#f42539";

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
  crouch: "determined",
  // Round 2: a sideways peace sign and a wink, a curtain-call bow, a teal penlight waved overhead.
  peace: "wink",
  bow: "proud",
  glowstick: "happy",
};

export const MIKU_POSES = Object.keys(POSE_FACE);

// Poses where she sits on the cloud: her seat is the feet line and her legs hang over the front.
const SEATED = new Set(["sit", "sleep"]);
// Poses with nothing under her: no contact shadow.
const AIRBORNE = new Set(["jump", "fall", "held"]);

/* ------------------------------------------------------------------------------------------------
   Hair
   ------------------------------------------------------------------------------------------------ */

// Her right tail (viewer's left). The right-hand one is the same shape mirrored. Round 2: it leaves
// the head narrow at the tie and bows straight out, so there is air between it and her earpiece from
// ear level down (the silhouette is about twice the head's width), widest near her waist, then
// tapering to three points that curl in at her ankles.
const TAIL =
  "M50 44C30 48 12 76 9 114C6 152 8 186 22 212C27 220 31 226 36 233C36 225 38 219 42 215C44 220 47 223 51 225C47 207 43 188 41 170C37 148 31 130 30 113C30 93 40 72 64 57Z";
const TAIL_STRANDS = "M42 58C24 82 16 118 16 150M50 62C34 90 26 130 30 176M20 122C15 152 18 182 30 208";
const TAIL_SHEEN = "M30 64C18 84 13 108 13 132";

const Tail = memo(function Tail({ side, uid }) {
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
});

// The hair ties: a dark frame around one hot-pink face, taller than wide, standing nearly upright
// with half of each above her crown.
const HairTie = memo(function HairTie({ side }) {
  const x = side === "l" ? 53 : W - 53;
  const turn = side === "l" ? -13 : 13;
  return (
    <g transform={`translate(${x} 40) rotate(${turn})`}>
      <path d="M-10-21h20l1.2 38H-11.2Z" fill={SLATE} stroke="#1f2125" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M-6.4-17h12.8l.8 30H-7.2Z" fill={MAGENTA} />
      <path d="M-6.4-17h3.4l-.3 30H-7.2Z" fill={PINK_HI} opacity=".85" />
      <path d="M-8.4-19h16.8" stroke="#6a7282" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
});

const Fringe = memo(function Fringe({ uid }) {
  // Round 2: five soft locks instead of a sawtooth, the centre one the longest, falling on a slant
  // between her eyes to nose level; side locks in front of the earpieces down to her collar.
  const d =
    "M43 126C35 74 63 37 110 37C157 37 185 74 177 126C177 142 173 158 166 170C163 150 159 132 155 116C153 106 150 98 146 92C144 102 140 110 133 117C134 105 131 95 126 87C123 100 118 114 107 131C108 114 107 99 103 87C99 98 94 105 86 111C86 101 84 94 80 88C77 98 72 106 66 112C66 104 65 98 64 93C63 103 62 111 62 118C59 134 57 152 54 170C47 158 43 142 43 126Z";
  return (
    <g>
      <path d={d} fill={`url(#${uid}-hair)`} stroke={HAIR_LINE} strokeWidth="1.2" strokeLinejoin="round" />
      {/* strand lines and the glossy ring across the crown */}
      <path
        d="M86 50Q76 70 78 96M108 44Q110 72 106 118M134 50Q144 70 140 100M64 70Q58 96 60 124M156 70Q162 96 160 124"
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
});

const Headset = memo(function Headset() {
  return (
    <g className="hmiku__headset">
      {[44, W - 44].map((x) => (
        <g key={x}>
          <rect x={x - 9.5} y="107" width="19" height="26" rx="8" fill={SLATE} stroke="#20242c" strokeWidth="1.2" />
          <rect x={x - 5.6} y="112" width="11.2" height="16" rx="5" fill="none" stroke="#e24075" strokeWidth="2.4" />
          <ellipse cx={x} cy="120" rx="2" ry="3.2" fill="#ff9fcf" opacity=".8" />
        </g>
      ))}
    </g>
  );
});

// The microphone boom on her right, curving round to her mouth; drawn over the cheek and side lock.
const Mic = memo(function Mic() {
  return (
    <g className="hmiku__mic">
      <path d="M47 130Q53 151 82 150" fill="none" stroke="#2a2f38" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M48 131Q54 149 80 149" fill="none" stroke="#6f7787" strokeWidth=".8" strokeLinecap="round" opacity=".8" />
      <rect x="80" y="146.4" width="8" height="6" rx="3" fill={SLATE} stroke="#20242c" strokeWidth="1" />
      <circle cx="86" cy="149.4" r="1.3" fill={MAGENTA} opacity=".85" />
    </g>
  );
});

/* ------------------------------------------------------------------------------------------------
   Body parts
   ------------------------------------------------------------------------------------------------ */

const Torso = memo(function Torso({ uid }) {
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
      {/* The long tie: past the shirt's hem onto the skirt, held by a dark two-bar clip. */}
      <g className="hmiku__tie" style={{ transformOrigin: "110px 169px" }}>
        <path d="M107.2 169h5.6l3.8 37-6.6 6.8-6.6-6.8Z" fill={TEAL} stroke={TEAL_DARK} strokeWidth="1" strokeLinejoin="round" />
        <path d="M109 172l-1.4 30" stroke="#8ff0e6" strokeWidth="1.3" strokeLinecap="round" opacity=".7" />
        <path d="M104.6 192.6h10.8M104.4 196.2h11.2" stroke="#2a2e33" strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
});

const Skirt = memo(function Skirt() {
  return (
    <g className="hmiku__skirt" style={{ transformOrigin: "110px 192px" }}>
      <path d="M86 191H134L149 213Q110 224 71 213Z" fill={INK} stroke={INK_LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M98 194 91 217M110 194V220M122 194 129 217" stroke={INK_HI} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M72 213Q110 224 148 213" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
      <path d="M78 209Q110 218 142 209" fill="none" stroke={TEAL_DARK} strokeWidth="1" opacity=".55" />
    </g>
  );
});

// One standing leg, drawn from the hip (0, 0) down to the sole at (0, 30).
const Leg = memo(function Leg() {
  return (
    <g>
      <rect x="-4.6" y="0" width="9.2" height="18" rx="4.4" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      <path d="M-5.8 14.5h11.6V25.5q0 4.5-4 4.5H-2.6q-3.8 0-3.6-3.6Z" fill={INK} stroke={INK_LINE} strokeWidth="1.1" />
      <rect x="-6.4" y="13.2" width="12.8" height="3.4" rx="1.4" fill={TEAL} stroke={TEAL_DARK} strokeWidth=".7" />
      <path d="M-5 29.4q5 1.6 10 0" stroke={TEAL} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M-2.4 18v7" stroke={INK_HI} strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
});

// A seated leg seen from the front: the knee peeking from under the skirt and the shin hanging
// over the cloud's edge, toe turned out. Drawn from the knee (0, 0).
const SeatedLeg = memo(function SeatedLeg() {
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
});

const Leek = memo(function Leek() {
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
});

// One arm, hung from the shoulder at (0, 0) and pointing down +y: bare upper arm, the detached
// sleeve flaring wide (a bell, about two and a half times the arm) to a broad teal cuff that half
// hides the hand at (0, 41). `mark` puts the red 01 on her left shoulder; `panel` the lime level
// meter printed on her left sleeve.
// A sideways V by her eye: two fingers from the hand, along +y.
const Vee = memo(function Vee() {
  return (
    <g className="hmiku__vee">
      <rect x="-3.6" y="-1" width="3.2" height="10" rx="1.6" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" transform="rotate(16)" />
      <rect x=".4" y="-1" width="3.2" height="10" rx="1.6" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" transform="rotate(-16)" />
    </g>
  );
});

// A concert penlight in her colour, held at the grip; it points along +y from the hand.
const Glowstick = memo(function Glowstick() {
  return (
    <g className="hmiku__glowstick">
      <rect x="-2.6" y="-4" width="5.2" height="9" rx="1.4" fill="#3a3d42" />
      <rect x="-3.4" y="4" width="6.8" height="26" rx="3.4" fill="#7ff3f0" opacity=".35" />
      <rect x="-2.2" y="4.6" width="4.4" height="24.6" rx="2.2" fill="#b8fffb" stroke="#2cc4cf" strokeWidth="1.1" />
      <path d="M-.6 7v19" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".8" />
    </g>
  );
});

const Arm = memo(function Arm({ mark, panel, facing, children, finger }) {
  return (
    <g>
      <rect x="-4.6" y="-3" width="9.2" height="17" rx="4.6" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
      {mark && (
        // "01" in red. Counter-flipped when she faces left so it never reads backwards.
        <g transform={facing < 0 ? "scale(-1 1)" : undefined}>
          <path d="M-1.6 3.6a1.3 2 0 1 0 .01 0Z M1.6 1.6v4.1" fill="none" stroke={RED_01} strokeWidth="1.15" strokeLinecap="round" />
        </g>
      )}
      <ellipse cx="0" cy="42" rx="4.7" ry="5.2" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".9" />
      <path d="M-5.6 9H5.6L13 32Q0 37-13 32Z" fill={INK} stroke={INK_LINE} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M-4.6 11.2H4.6" stroke={TEAL} strokeWidth="1.2" opacity=".8" />
      {panel && (
        <g>
          <rect x="-5" y="17" width="10" height="8.4" rx=".9" fill="#d6dc3a" stroke="#a4a92a" strokeWidth=".6" />
          <path d="M-3.6 19.2h2.2M-3.6 21.4h3.6M-3.6 23.4h1.6" stroke="#2c313b" strokeWidth="1" />
          <rect x="1.2" y="18.6" width="2.4" height="2" fill="#5fd3e0" />
          <rect x="1.2" y="21.6" width="2.4" height="2" fill="#ff5c9a" />
        </g>
      )}
      <path d="M-13 32Q0 37 13 32L14.4 37.6Q0 43.6-14.4 37.6Z" fill={TEAL} stroke={TEAL_DARK} strokeWidth=".9" strokeLinejoin="round" />
      <path d="M-12 35.6Q0 40.4 12 35.6" fill="none" stroke="#8ff0e6" strokeWidth=".9" opacity=".6" />
      {finger && (
        <g className="hmiku__finger" style={{ transformOrigin: "0 40.4px" }}>
          <rect x="-1.7" y="41" width="3.4" height="9.5" rx="1.7" fill={SKIN} stroke={SKIN_SHADE} strokeWidth=".8" />
        </g>
      )}
      {children && <g transform="translate(0 41)">{children}</g>}
    </g>
  );
});

const Note = memo(function Note({ className, x, y, flag = 1, fill = TEAL }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`hmiku__note ${className}`}>
        <ellipse cx="0" cy="0" rx="4" ry="3" transform="rotate(-22)" fill={fill} />
        <path d={`M3.4-1.2V-15${flag ? "q4 2 6 6.6" : ""}`} fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </g>
  );
});

const Glint = memo(function Glint({ x, y, r = 5, className = "" }) {
  return (
    <path
      className={`hmiku__glint ${className}`}
      d={`M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}Z`}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
  );
});

/* ------------------------------------------------------------------------------------------------
   The body
   ------------------------------------------------------------------------------------------------ */

// Fills the box the engine gives it (size x scale); `scale` is only for standalone use (the thumb).
export default function MikuBody({ pose = "idle", expression, facing = 1, playing = true, talking = false, scale, prop = null }) {
  const raw = useId();
  const uid = `hm${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => true);
  const known = POSE_FACE[pose] ? pose : "idle";
  const face = expression ?? POSE_FACE[known];
  const animate = playing && !reduced;
  const seated = SEATED.has(known);
  // The leek comes out for her own twirl, or whenever the engine hands it to her (the tap menu).
  const leek = known === "leek" || prop === "leek";
  const finger = known === "point" && !leek;
  const vee = known === "peace";
  const glowstick = known === "glowstick" || prop === "glowstick";

  return (
    <svg
      className="hmiku"
      data-pose={known}
      data-face={face}
      data-motion={animate ? "on" : "off"}
      data-talking={talking ? "1" : undefined}
      viewBox={`0 0 ${W} ${H}`}
      width={scale ? 110 * scale : "100%"}
      height={scale ? 120 * scale : "100%"}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2=".2" y2="1">
          <stop stopColor="#5ed6de" />
          <stop offset=".5" stopColor={HAIR} />
          <stop offset="1" stopColor="#1fb2be" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} x1="0" y1="0" x2=".2" y2="1">
          <stop stopColor="#3ccad4" />
          <stop offset=".62" stopColor={HAIR} />
          <stop offset="1" stopColor="#0f9aa6" />
        </linearGradient>
        <linearGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#17a8b4" />
          <stop offset="1" stopColor="#0a7c87" />
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
                {/* The back of her hair stops at her jaw: the nape shows between the tails. */}
                <path
                  d="M48 104C44 62 72 34 110 34C148 34 176 62 172 104L168 138Q152 150 138 142H82Q68 150 52 138Z"
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
                  <MikuFace expression={face} moving={animate} talking={talking} uid={uid} />
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
                    {vee && !leek && <Vee />}
                  </Arm>
                </g>
              </g>
              <g transform="translate(134 167)">
                <g className="hmiku__arm hmiku__arm--l">
                  <Arm mark panel facing={facing}>
                    {glowstick && <Glowstick />}
                  </Arm>
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
                  <path className="hmiku__z hmiku__z--1" d="M182 84h8l-8 9h8" />
                  <path className="hmiku__z hmiku__z--2" d="M196 64h6l-6 7h6" />
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

/** The tap menu's chip icon: her leek, small and on a slant. */
export function LeekIcon({ size = 22 }) {
  return (
    <svg viewBox="-14 -14 28 28" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hmiku-leek" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".3" stopColor="#fbfff4" />
          <stop offset="1" stopColor="#cfe9a6" />
        </linearGradient>
      </defs>
      <g transform="rotate(-40) translate(0 -18) scale(.62)">
        <Leek />
      </g>
    </svg>
  );
}
