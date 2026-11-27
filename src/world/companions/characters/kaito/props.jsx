// KAITO's little props, drawn in the body's 200×236 viewBox. All original: a waffle cone with one
// scoop (soda blue, his own; lilac, the one he saves for Kiriya; vanilla), and a small paper cup.

export const FLAVOURS = {
  soda: { fill: "#aee0f7", line: "#5ea6d3", glint: "#e9f8ff" },
  lilac: { fill: "#dcc6f5", line: "#9a78c9", glint: "#f6efff" },
  vanilla: { fill: "#fff4da", line: "#d6b47c", glint: "#ffffff" },
};

/** A cone held at (x, y): the hand's grip point. The scoop sits ~19 units above it. */
export function IceCone({ x, y, flavour = "soda", className = "kaito__cone" }) {
  const c = FLAVOURS[flavour] ?? FLAVOURS.soda;
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <path d="M-7.5-9 7.5-9 0 12Z" fill="#e8b66b" stroke="#a8722f" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="m-5-5 8 9m-6-11 9 10M5-5l-8 9m6-11-9 10" stroke="#c48a40" strokeWidth=".9" fill="none" />
      <path
        className="kaito__scoop"
        d="M-9.5-8.5C-12-19-5-25 0-25S12-19 9.5-8.5C7-6 5.5-9 3.5-7 1-5-1-8.5-3.5-7-6-5.5-7-9.5-9.5-8.5Z"
        fill={c.fill}
        stroke={c.line}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M-5.5-19q2-3.5 5.5-3.5" stroke={c.glint} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path className="kaito__drip" d="M5.6-8.2q1.2 4 0 6.2-1.4-1.8 0-6.2Z" fill={c.fill} stroke={c.line} strokeWidth=".8" />
    </g>
  );
}

/** A little paper cup with a lilac band and a wooden spoon, held at (x, y). */
export function IceCup({ x, y }) {
  return (
    <g className="kaito__cup" transform={`translate(${x} ${y})`}>
      <path d="M-9-4C-9-10 9-10 9-4" fill="#fff4da" stroke="#d6b47c" strokeWidth="1.1" />
      <path d="M-9.5-4h19l-2.5 12h-14Z" fill="#fffaff" stroke="#9a86b8" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M-8.6 0h17.2l-.7 3.4H-7.9Z" fill="#cdb3ee" />
    </g>
  );
}

/** A small wooden spoon; (x, y) is the bowl. */
export function Spoon({ x, y, angle = -30 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d="M0 0v12" stroke="#c9a06a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="0" cy="-1" rx="2.6" ry="3.2" fill="#e2bd86" stroke="#ab8150" strokeWidth=".8" />
      <ellipse cx="0" cy="-2" rx="1.6" ry="1.4" fill="#aee0f7" />
    </g>
  );
}
