import { C } from "./palette.js";

// Small pieces of her drawing, shared by the body, the thumb and the platform. Coordinates are in
// the body's 220 × 240 viewBox unless a part says otherwise.

/** A stroke drawn twice (a darker rim under a lighter core): limbs, curls, the ahoge. */
export function Lined({ d, core, line, width, rim = 1.25, className, opacity }) {
  return (
    <g className={className} opacity={opacity}>
      <path d={d} fill="none" stroke={line} strokeWidth={width + rim * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={core} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * The viewer's-left twin tail, root hidden behind the head. The right one is the same shape
 * mirrored. Long and flared like the MV's, ending in an outward hooked curl, with a little flick
 * curling up over the cross where it leaves the head.
 */
export function Tail({ fill }) {
  return (
    <g>
      <path
        d="M72 52C46 54 24 84 19 124C15 156 15 184 19 200C21 208 16 213 10 212C6 211 5 207 7 204C2 206 0 214 5 220C11 227 26 228 33 216C38 206 42 180 44 150C45 120 54 96 76 84Z"
        fill={fill}
        stroke={C.hairLine}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Strands follow the fall of the hair; the shine is broken, like anime hair. */}
      <g fill="none" strokeLinecap="round">
        <path d="M43 140C41 170 37 196 29 214" stroke={C.hairDeep} strokeWidth="2.2" opacity=".45" />
        <path d="M37 96C29 124 26 160 27 188" stroke={C.hairDark} strokeWidth="1.3" opacity=".7" />
        <path d="M33 150C32 176 30 196 22 208" stroke={C.hairDark} strokeWidth="1.2" opacity=".6" />
        <path d="M50 70C38 86 31 104 28 122m-1 12q-1 8-1 14" stroke={C.hairLight} strokeWidth="2.6" opacity=".6" />
      </g>
      <FlickCurl />
    </g>
  );
}

/** The little horn of hair that curls up out of each tail where it leaves the head. */
export function FlickCurl() {
  return (
    <path
      d="M64 60C52 58 42 50 40 40C38 31 45 27 51 30C55 33 54 39 49 39C51 36 48 33 46 35C44 39 47 47 56 52C60 54 63 55 66 55Z"
      fill={C.hair}
      stroke={C.hairLine}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  );
}

/** A crimson Latin cross hair ornament, centred on (x, y). */
export function Cross({ x, y, rotate = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        d="M-3.6-15h7.2v7h6.9v6.4h-6.9V14h-7.2V-1.6h-6.9V-8h6.9Z"
        fill={C.cross}
        stroke={C.crossDark}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M-1.4-12.5v6.5m-6 -3.2h3" stroke={C.crossLight} strokeWidth="1.3" strokeLinecap="round" opacity=".85" />
    </g>
  );
}

/**
 * Her notebook, closed: the MV's "Yaoi Note" (a Death Note parody), plain black with the title in
 * white, where her fanfic lives. Centred on (x, y). With `facing` -1 (the engine mirrors her) the
 * title mirrors back so it still reads.
 */
export function Sketchbook({ x, y, w = 30, h = 36, rotate = 0, className, facing = 1 }) {
  const left = -w / 2,
    top = -h / 2;
  // Two lines, "YAOI" over "NOTE", as big as the cover allows.
  const size = Math.min((w - 6) / 3.64, (h - 10) / 2.6);
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={left} y={top} width={w} height={h} rx="2.4" fill={C.book} stroke={C.bookDark} strokeWidth="1.5" />
      <path d={`M${left + 2.4} ${top + 1.6}v${h - 3.2}`} stroke="#4a4352" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
      <path d={`M${left + 4} ${top + 3}h${w * 0.4}`} stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".22" />
      <g transform={`translate(${1.2} 0)${facing < 0 ? " scale(-1 1)" : ""}`}>
        <g transform={`translate(0 ${-size * 0.68})`}>
          <Lettering word="YAOI" size={size} color={C.noteInk} width={Math.max(1, size * 0.17)} />
        </g>
        <g transform={`translate(0 ${size * 0.68})`}>
          <Lettering word="NOTE" size={size} color={C.noteInk} width={Math.max(1, size * 0.17)} />
        </g>
      </g>
    </g>
  );
}

/** The Yaoi Note held open, pages towards the viewer, with a doodle on it. */
export function OpenBook({ x, y, w = 48, h = 32, rotate = 0, doodle = "ship", className, drawing }) {
  const left = -w / 2,
    top = -h / 2;
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path
        d={`M${left - 1.5} ${top + 1.5}h${w + 3}v${h}h${-w - 3}Z`}
        fill={C.book}
        stroke={C.bookDark}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={`M${left} ${top}h${w / 2}v${h - 1.5}h${-w / 2}Z`} fill={C.paper} stroke="#d9cdea" strokeWidth=".9" />
      <path d={`M0 ${top}h${w / 2}v${h - 1.5}H0Z`} fill={C.paper} stroke="#d9cdea" strokeWidth=".9" />
      <path d={`M0 ${top}v${h - 1.5}`} stroke={C.bookDark} strokeWidth="1.2" />
      {[0.32, 0.56, 0.8].map((t) => (
        <path key={t} d={`M${left + 3} ${top + h * t}h${w / 2 - 6}m6 0h${w / 2 - 6}`} stroke={C.paperLine} strokeWidth=".8" />
      ))}
      {doodle === "ship" && <ShipDoodle w={w} h={h} />}
      {doodle === "sketch" && (
        <g>
          <path
            className={drawing ? "mr-ink" : undefined}
            d={`M${left + 5} ${top + h * 0.62}q3-9 8-3t7-2M${4} ${top + h * 0.5}q4-6 8 0q4 6 8 0`}
            fill="none"
            stroke={C.ink}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <Heart x={w * 0.3} y={top + h * 0.3} size={5} />
        </g>
      )}
    </g>
  );
}

/** Two little round friends with a heart between them: "they'd be cute together". */
function ShipDoodle({ w, h }) {
  const r = h * 0.17;
  return (
    <g strokeLinecap="round">
      <circle cx={-w * 0.25} cy={h * 0.06} r={r} fill="#dff3e6" stroke={C.ink} strokeWidth="1.1" />
      <circle cx={w * 0.25} cy={h * 0.06} r={r} fill="#dde6fb" stroke={C.ink} strokeWidth="1.1" />
      <path d={`M${-w * 0.25 - r * 0.4} ${h * 0.04}v.5m${r * 0.8} -.5v.5M${w * 0.25 - r * 0.4} ${h * 0.04}v.5m${r * 0.8} -.5v.5`} stroke={C.ink} strokeWidth="1.3" />
      <path d={`M${-w * 0.25 - 1.5} ${h * 0.14}q1.5 1.2 3 0M${w * 0.25 - 1.5} ${h * 0.14}q1.5 1.2 3 0`} stroke={C.ink} strokeWidth=".9" fill="none" />
      <Heart x={0} y={-h * 0.16} size={h * 0.26} />
    </g>
  );
}

/** A heart centred on (x, y), `size` wide. */
export function Heart({ x, y, size = 8, fill = C.heart, stroke = "#c25a78", className }) {
  const s = size / 12;
  return (
    <path
      className={className}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 4.5C-5-.5-6-3.5-4-5.5S1-6.5 0-3c-1-3.5 2-4.5 4-2.5S5-.5 0 4.5Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2 / s > 2.2 ? 2.2 : 1.2 / s}
      strokeLinejoin="round"
    />
  );
}

/** A four-point twinkle. */
export function Twinkle({ x, y, r = 5, fill = "#f5d36b", className }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`}
      fill={fill}
    />
  );
}

/** A limb: a skin stroke with a rim, ending in a round mitten hand. */
export function Arm({ d, hand, handR = 4.8, className, children }) {
  return (
    <g className={className}>
      <path d={d} fill="none" stroke={C.skinLine} strokeWidth="8.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={C.skin} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      {hand && <circle cx={hand[0]} cy={hand[1]} r={handR} fill={C.skin} stroke={C.skinLine} strokeWidth="1.2" />}
      {children}
    </g>
  );
}

/* --- Her paddle ------------------------------------------------------------------------------ */

// The letters, hand-drawn as strokes in a 12 × 16 cell (no font to load, same on every phone).
const LETTERS = {
  Y: "M0 0L6 7.5L12 0M6 7.5V16",
  A: "M0 16L6 0L12 16M2.4 10.4H9.6",
  O: "M6 0C-1.6 0-1.6 16 6 16C13.6 16 13.6 0 6 0Z",
  I: "M6 0V16M2.5 0H9.5M2.5 16H9.5",
  S: "M11 2.4C9.8.6 8 0 6 0C2.6 0 .8 2 1.2 4.4C1.6 7 4.8 7.6 7 8.4C10 9.4 11.6 10.8 11 13C10.4 15 8.4 16 6 16C3.6 16 1.6 15 .6 13",
  N: "M0 16V0L12 16V0",
  E: "M11 0H1V16H11M1 8H9",
  R: "M1 16V0H7C11 0 11.6 8 7 8H1M6.4 8L11.6 16",
  H: "M1 0V16M11 0V16M1 8H11",
  P: "M1 16V0H7C11.4 0 11.4 8.4 7 8.4H1",
  T: "M0 0H12M6 0V16",
  C: "M11.4 3C10 .8 8.2 0 6.4 0C2.2 0 .4 3.6.4 8S2.2 16 6.4 16C8.2 16 10 15.2 11.4 13",
  M: "M0 16V0L6 9L12 0V16",
  K: "M1 0V16M11 0L1 9.4M4.6 6.4L11.4 16",
  "!": "M6 0V10.4M6 15.4V15.6",
  "♥": "M6 15C-2 9.4-1 3 2.6 2.4C4.4 2.1 5.6 3.4 6 4.8C6.4 3.4 7.6 2.1 9.4 2.4C13 3 14 9.4 6 15Z",
};

/** A word in her hand lettering, centred on (0, 0), `size` px tall, reading left to right. */
export function Lettering({ word, size = 16, color = C.paddleInk, width = 3.2, gap = 3.4 }) {
  const chars = [...word];
  const step = 12 + gap;
  const total = chars.length * step - gap;
  const k = size / 16;
  return (
    <g transform={`scale(${k}) translate(${-total / 2} -8)`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round">
      {chars.map((ch, i) =>
        LETTERS[ch] ? (
          <path key={i} d={LETTERS[ch]} transform={`translate(${i * step} 0)`} fill={ch === "♥" ? color : "none"} />
        ) : null,
      )}
    </g>
  );
}

/**
 * Her paddle: the con-floor "yaoi paddle" she carries through the MV, a tan wooden board on a
 * long handle, "SINNER" burnt dark into the wood (the MV; the song's concept art has "YAOI"). Drawn standing up, the end of the handle at
 * (0, 0) and the blade's tip at (0, -LEN); place it with x, y (the hand) and rotate. The engine
 * mirrors her whole body to face left, so with `facing` -1 the lettering mirrors back and still
 * reads. `grip` is how far up the handle her hand is; `tipFirst` turns the word round to read from
 * the tip, for when the blade points left.
 */
export const PADDLE_LEN = 104;
export function Paddle({ x, y, rotate = 0, word = "SINNER", facing = 1, className, grip = 8, tipFirst = false }) {
  const n = [...word].length;
  const size = Math.min(15, (60 * 16) / Math.max(1, n * 15.4 - 3.4));
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate}) translate(0 ${grip})`}>
      {/* Handle with a rounded knob, then the blade, then the grain, the lettering and a shine. */}
      <path d="M-4.6-2Q-6.6 0-6 3.4Q-5 6.6 0 6.6T6 3.4Q6.6 0 4.6-2V-34H-4.6Z" fill={C.paddleDark} stroke={C.paddleLine} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M-1.6-4v-27" stroke={C.paddle} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <path
        d="M-6-32Q-15-36-15-44V-96Q-15-104-7-104H7Q15-104 15-96V-44Q15-36 6-32Z"
        fill={C.paddle}
        stroke={C.paddleLine}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M-9-48Q-10-72-8-96M8-46Q10-70 9-98" stroke={C.paddleDark} strokeWidth="1" fill="none" opacity=".45" strokeLinecap="round" />
      <path d="M-11-92V-56" stroke={C.paddleLight} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
      {/* The word runs along the blade, from the handle up (or from the tip down with tipFirst). */}
      <g transform={`translate(${tipFirst ? -1 : 1} -70) rotate(${tipFirst ? 90 : -90})${facing < 0 ? " scale(-1 1)" : ""}`}>
        <g transform="translate(.7 .7)">
          <Lettering word={word} size={size} width={Math.max(2.4, size * 0.22)} color={C.paddleBurnLight} />
        </g>
        <Lettering word={word} size={size} width={Math.max(2.4, size * 0.22)} color={C.paddleBurn} />
      </g>
    </g>
  );
}

/** The paddle as a tiny icon for the tap menu's chip. */
export function PaddleIcon({ size = 18 }) {
  return (
    <svg viewBox="-56 -110 112 112" width={size} height={size} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <g transform="rotate(38 0 -50)">
        <Paddle x={0} y={-4} word="♥" grip={0} />
      </g>
    </svg>
  );
}

/** Her phone, seen from the back (lilac case, a heart sticker), the screen's glow on her face. */
export function Phone({ x, y, rotate = 0, className }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-11" y="-18" width="22" height="36" rx="5" fill={C.phone} stroke="#211a30" strokeWidth="1.4" />
      <rect x="-9" y="-16" width="18" height="32" rx="4" fill="#c9b5ec" />
      <circle cx="-4.4" cy="-10.6" r="2.6" fill="#2a2238" stroke="#7d6aa2" strokeWidth="1" />
      <Heart x={1.5} y={4} size={10} />
    </g>
  );
}

/** The comic "SMACK!" burst where the paddle lands. */
export function SmackBurst({ x, y, facing = 1, className }) {
  // The class (animated with CSS scale/opacity) sits on an inner group: WebKit drops an SVG
  // transform attribute on an element that also has CSS transform properties.
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
      <path
        d="M0-25L6-12L19-20L13-6L28-1L13 4L20 18L6 11L0 25L-6 11L-20 18L-13 4L-28-1L-13-6L-19-20L-6-12Z"
        fill="#fff6c9"
        stroke="#e8a93c"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <g transform={`rotate(-8)${facing < 0 ? " scale(-1 1)" : ""}`}>
        <Lettering word="SMACK!" size={9} width={2.6} gap={2} color={C.paddleInk} />
      </g>
      </g>
    </g>
  );
}

/**
 * A hymnal held open in front of her, cover towards the viewer (brown leather, a gold cross,
 * "HYMNS"), with a glossy pink magazine tucked inside it poking out of the top: what she's really
 * reading (in the MV she buys one). Centred on (x, y). The title mirrors back with `facing` -1.
 */
export function Hymnal({ x, y, w = 50, h = 34, rotate = 0, facing = 1, className }) {
  const left = -w / 2,
    top = -h / 2;
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {/* The magazine inside, sticking out of the top and one side. */}
      <g className="mr-mag">
        <path d={`M${left + 5} ${top - 9}h${w - 8}l2 ${h * 0.6}h${-w + 4}Z`} fill={C.mag} stroke={C.magDark} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={`M${left + 9} ${top - 5}h${w * 0.36}m4 0h${w * 0.22}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
        <Heart x={w * 0.22} y={top - 1.5} size={6} fill="#fff" stroke={C.magDark} />
      </g>
      <rect x={left} y={top} width={w} height={h} rx="2.6" fill={C.hymnal} stroke={C.hymnalDark} strokeWidth="1.5" />
      <path d={`M0 ${top + 1}v${h - 2}`} stroke={C.hymnalDark} strokeWidth="1.6" />
      <path d={`M${left + 3} ${top + 3}h${w / 2 - 6}`} stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".2" />
      {/* The front cover is the right half (seen from outside): a gold cross and the title. */}
      <g transform={`translate(${w / 4} 0)${facing < 0 ? " scale(-1 1)" : ""}`}>
        <path d="M-1.4-12h2.8v4h3.6v2.6h-3.6V2h-2.8v-7.4h-3.6V-8h3.6Z" fill={C.gold} />
        <g transform="translate(0 8.5)">
          <Lettering word="HYMNS" size={5.2} width={1.15} gap={2.4} color={C.gold} />
        </g>
      </g>
      <g transform={`translate(${-w / 4} 0)`}>
        <path d="M-1.4-6h2.8v2.4h2.6v2.2h-2.6V6h-2.8V-1.4h-2.6v-2.2h2.6Z" fill={C.gold} opacity=".7" />
      </g>
    </g>
  );
}

/** A halo: she has ascended (a chapter was that good). Centred on (x, y). */
export function Halo({ x, y, className }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <g className="mr-halo-in">
        <ellipse rx="27" ry="7.5" fill="none" stroke={C.haloLine} strokeWidth="6.4" />
        <ellipse rx="27" ry="7.5" fill="none" stroke={C.halo} strokeWidth="4" />
        <path d="M-17-5q8-3.4 17-3.6" stroke="#fff8d8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}
