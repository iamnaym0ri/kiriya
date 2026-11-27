import {
  GLASS,
  GLASS_EDGE,
  INK,
  LEAF,
  LEAF_DARK,
  PAPER,
  STONE,
  STONE_EDGE,
  WOOD,
} from "./palette.js";

// The small things she carries, in the body's 200 x 236 box. Original drawings in the website
// mascot's style (same strokes, same palette).

/** A sprig with three leaves; its base is at the origin and it grows upward. */
export function Sprig({ transform, className }) {
  return (
    <g transform={transform} className={className}>
      <path d="M0 0q3-17 0-36" stroke={LEAF_DARK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path
        d="M1-10C-14-12-13-25-13-25-3-24 3-18 1-10ZM1-22C14-24 13-35 13-35 3-34-1-29 1-22ZM0-33C-7-37-4-47-4-47 3-44 5-38 0-33Z"
        fill={LEAF}
        stroke={LEAF_DARK}
        strokeWidth="1.4"
      />
      <path d="m0-13-9-9m11-3 7-7" stroke="#c1d18a" fill="none" />
    </g>
  );
}

/** A little stone mortar held against her waist, with green grist in it. */
export function HeldMortar() {
  return (
    <g className="mm-mortar">
      <path d="M78 176h40q-2 20-20 20t-20-20Z" fill={STONE} stroke={STONE_EDGE} strokeWidth="1.8" />
      <ellipse cx="98" cy="176" rx="20" ry="5" fill="#bec9ab" stroke={STONE_EDGE} strokeWidth="1.5" />
      <g className="mm-grist">
        <ellipse cx="96" cy="177" rx="9" ry="2.6" fill="#9aad74" />
        <circle cx="91" cy="176" r="1.4" fill="#7e9459" />
        <circle cx="100" cy="177" r="1.2" fill="#7e9459" />
      </g>
      <path d="M90 191h14" stroke="#b9bdab" strokeWidth="2" />
      <g className="mm-dust" fill="#cdd6b4">
        <circle cx="88" cy="166" r="2.2" />
        <circle cx="100" cy="162" r="1.7" />
        <circle cx="94" cy="157" r="1.4" />
      </g>
    </g>
  );
}

/** Her notebook, open, with a line of ink that writes itself. */
export function Notebook() {
  return (
    <g className="mm-notebook">
      <path d="M74 160q15-4 27 2 14-6 29-2v38q-15-3-29 2-12-5-27-2Z" fill={PAPER} stroke="#a38d79" strokeWidth="1.7" />
      <path d="M101 162v37" stroke="#c2a992" strokeWidth="1.4" />
      <path d="M80 170h14m-14 7h14m-14 7h11" stroke="#b19aa0" strokeWidth="1.4" />
      <path className="mm-ink" d="M107 171h15m-15 7h15m-15 7h11" stroke={INK} strokeWidth="1.4" fill="none" />
    </g>
  );
}

/** A stoppered specimen bottle with an old label, hugged to her chest. */
export function Vial() {
  return (
    <g className="mm-vial">
      <path d="M92 157h16v9q9 4 9 13v17H83v-17q0-9 9-13Z" fill={GLASS} stroke={GLASS_EDGE} strokeWidth="2" />
      <path d="M86 186h28v8H86Z" fill="#8fb7a8" opacity=".75" />
      <rect x="90" y="153" width="20" height="8" rx="2" fill={WOOD} />
      <rect x="90" y="172" width="20" height="13" rx="2" fill="#fff3d3" />
      <path d="M96 176h8m-8 4h6" stroke="#8b748d" strokeWidth="1.5" />
      <path d="M86 174q0-5 4-7" stroke="#fff" strokeWidth="1.6" fill="none" opacity=".6" />
    </g>
  );
}

/** A plain cup of tea, held in both hands; the steam curls off it. */
export function Teacup() {
  return (
    <g className="mm-teacup">
      <g className="mm-steam" fill="none" stroke="#cfd8e4" strokeWidth="2" strokeLinecap="round">
        <path d="M95 170q-5-5 0-10t0-9" />
        <path d="M104 168q-5-5 0-10t0-8" />
      </g>
      <path d="M86 174h28q-1 14-14 14t-14-14Z" fill="#f6f1e6" stroke="#a8a08f" strokeWidth="1.5" />
      <ellipse cx="100" cy="174" rx="14" ry="3.4" fill="#c9b27a" stroke="#a8a08f" strokeWidth="1.2" />
      <path d="M90 180h20" stroke="#9cb7c9" strokeWidth="1.6" />
    </g>
  );
}

/** A tiny mushroom that has come up through her cloud, which she cannot leave alone. */
export function Mushroom() {
  return (
    <g className="mm-mushroom">
      <path d="M163 232v-9" stroke="#efe6d6" strokeWidth="5" strokeLinecap="round" />
      <path d="M152 224q11-16 22 0Z" fill="#c98aa6" stroke="#9d5f7c" strokeWidth="1.2" />
      <circle cx="159" cy="219" r="1.6" fill="#fbeef3" />
      <circle cx="166" cy="217" r="1.2" fill="#fbeef3" />
    </g>
  );
}

/**
 * A small stoppered vial, held in her fingers (the tap menu's "show her a vial"). Its base sits at
 * the origin; it is 19 wide and 31 tall.
 */
export function SmallVial({ transform, className = "mm-small-vial" }) {
  return (
    <g transform={transform} className={className}>
      <rect x="-4.5" y="-31" width="9" height="6" rx="1.6" fill={WOOD} stroke="#8d7150" strokeWidth=".9" />
      <path d="M-3.8-25.5h7.6v5.5q6 3 6 9.5v7.5q0 3.5-3.5 3.5H-6.7q-3.5 0-3.5-3.5V-10.5q0-6.5 6.4-9.5Z" fill={GLASS} stroke={GLASS_EDGE} strokeWidth="1.5" />
      <path d="M-9.2-7h18.4v3.5q0 3-3 3H-6.2q-3 0-3-3Z" fill="#8fb7a8" opacity=".9" />
      <path d="M-9.2-7q9.2 2.4 18.4 0" stroke="#bfe0cf" strokeWidth="1" fill="none" />
      <path d="M-6.4-12.5q0-3.6 3-5.2" stroke="#fff" strokeWidth="1.4" fill="none" opacity=".75" strokeLinecap="round" />
    </g>
  );
}

/** Her coin pouch: soft leather, tied at the neck. Its bottom centre is at the origin. */
export function Pouch({ transform }) {
  return (
    <g transform={transform} className="mm-pouch">
      <path d="M-6-19q-9 5-8 13 1 7 14 7T14-6q1-8-8-13Z" fill="#c9a46a" stroke="#8d6c3f" strokeWidth="1.4" />
      <path d="M-7-19q7 3 14 0" stroke="#8d6c3f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M-2-20l-4-5m8 5 4-5" stroke="#8d6c3f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-8-8q2 5 7 6" stroke="#e0c48f" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** One coin: a disc with a square hole, as the palace's were. */
export function Coin({ cx, cy, r = 3.6, className }) {
  return (
    <g className={className}>
      <circle cx={cx} cy={cy} r={r} fill="#e7c25a" stroke="#a9832a" strokeWidth=".9" />
      <rect x={cx - r * 0.28} y={cy - r * 0.28} width={r * 0.56} height={r * 0.56} fill="#a9832a" />
    </g>
  );
}

/** A bundle of herbs hung upside down to dry, tied at the stems; the knot is at the origin. */
export function HerbBundle({ transform }) {
  return (
    <g transform={transform} className="mm-bundle">
      <path d="M-2 0l-6 24M0 0v28m2-28 6 24" stroke={LEAF_DARK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <g fill={LEAF} stroke={LEAF_DARK} strokeWidth="1.1">
        <ellipse cx="-8" cy="14" rx="4" ry="6.5" transform="rotate(20 -8 14)" />
        <ellipse cx="-9" cy="24" rx="3.6" ry="6" transform="rotate(14 -9 24)" />
        <ellipse cx="0" cy="20" rx="3.8" ry="6.5" />
        <ellipse cx="1" cy="31" rx="3.2" ry="5.4" />
        <ellipse cx="8" cy="15" rx="4" ry="6.5" transform="rotate(-20 8 15)" />
        <ellipse cx="9" cy="25" rx="3.6" ry="6" transform="rotate(-14 9 25)" />
      </g>
      <path d="M-5 2h10" stroke="#c9a46a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M3 2q4 6 2 11" stroke="#c9a46a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** The tap menu's chip icon: the same vial, small. */
export function VialIcon({ size = 22 }) {
  return (
    <svg viewBox="-12 -34 24 38" width={size} height={size} aria-hidden="true" focusable="false">
      <SmallVial className="mm-vial-icon" />
    </svg>
  );
}
