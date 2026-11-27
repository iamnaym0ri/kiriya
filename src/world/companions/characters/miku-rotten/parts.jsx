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
        d="M72 52C46 54 24 84 19 124C14 160 16 192 23 212Q25 218 28 219Q33 214 36 200C41 178 43 152 45 128C47 106 56 92 76 84Z"
        fill={fill}
        stroke={C.hairLine}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M44 132C42 160 39 184 33 205" fill="none" stroke={C.hairDeep} strokeWidth="2.4" opacity=".45" strokeLinecap="round" />
      <path d="M54 66C36 90 28 124 27 160" fill="none" stroke={C.hairLight} strokeWidth="2.4" opacity=".6" strokeLinecap="round" />
      <path d="M38 104C32 134 31 170 30 196" fill="none" stroke={C.hairDark} strokeWidth="1.4" opacity=".75" strokeLinecap="round" />
      <Lined className="mr-tail-tip" d="M27 216q-1 12-11 13q-8 0-8-7q1-6 7-4" core={C.hair} line={C.hairLine} width={4} />
      <Lined d="M60 57q-12-4-17-15q-3-9 5-10q7 0 5 7" core={C.hair} line={C.hairLine} width={4} />
    </g>
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

/** Her sketchbook, closed: lilac cover, spiral rings along the top, a heart sticker. */
export function Sketchbook({ x, y, w = 30, h = 36, rotate = 0, className }) {
  const left = -w / 2,
    top = -h / 2;
  const rings = Math.max(3, Math.round(w / 7));
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={left} y={top} width={w} height={h} rx="3" fill={C.book} stroke={C.bookDark} strokeWidth="1.5" />
      <rect x={left + 2.5} y={top + 2.5} width={w - 5} height={h - 5} rx="2" fill="none" stroke="#e8dcfb" strokeWidth="1" opacity=".7" />
      <path d={`M${left + 3} ${top + h - 4}h${w - 6}`} stroke={C.bookDark} strokeWidth="1" opacity=".35" />
      {Array.from({ length: rings }, (_, i) => (
        <ellipse key={i} cx={left + ((i + 0.5) * w) / rings} cy={top} rx="1.6" ry="3" fill="none" stroke={C.bookRing} strokeWidth="1.4" />
      ))}
      <Heart x={2} y={1} size={w * 0.3} />
      <path d={`M${left + 5} ${top + h - 9}h${w * 0.35}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
    </g>
  );
}

/** The sketchbook held open, pages towards the viewer, with a doodle on it. */
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

/** The little wooden cheer paddle (the MV's prop, with a carved heart instead of a word). */
export function Paddle({ x, y, rotate = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-2.4" y="-8" width="4.8" height="18" rx="2" fill={C.woodDark} />
      <path d="M-11-40q0-8 11-8t11 8v22q0 9-11 10-11-1-11-10Z" fill={C.wood} stroke={C.woodDark} strokeWidth="1.5" />
      <path d="M-7-38q1-5 7-6" stroke="#e9c49c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M0-21.5C-5.5-26.5-6.5-30-4.5-32S.5-33 0-29.5c-.5-3.5 2.5-4.5 4.5-2.5s1 5.5-4.5 10.5Z" fill="#a86a48" stroke={C.woodDark} strokeWidth="1" />
    </g>
  );
}
