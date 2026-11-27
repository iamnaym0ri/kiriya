import { deep, light, mix } from "./colour.js";

// The doll herself, drawn for this game: a three-heads-tall chibi in doll space (240 × 400, centre
// line x = 120, feet near y = 340). Clothes in wardrobe.jsx are drawn to these landmarks.
export const INK = "#4f3a5e";
export const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };
export const thin = { stroke: INK, strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" };

export const SKINS = ["#ffe9dc", "#fbd9c4", "#f1c4a2", "#d9a07a", "#b97a56", "#8a5a3e"];
export const EYE_COLOURS = ["#6b4a9a", "#3f6aa8", "#6b4a3a", "#3f8a78", "#b04a6e", "#5a5a6e", "#c9862e", "#3a8fb0"];
export const EYE_STYLES = [
  { id: "round", name: "bright" },
  { id: "sparkle", name: "sparkly" },
  { id: "sleepy", name: "dreamy" },
  { id: "happy", name: "smiley" },
  { id: "wink", name: "wink" },
];
export const MOUTHS = [
  { id: "smile", name: "smile" },
  { id: "open", name: "giggle" },
  { id: "cat", name: "cat mouth" },
  { id: "o", name: "ooh" },
];

/** Landmarks clothes are drawn to. */
export const BODY = {
  neck: 150,
  shoulder: 156,
  waist: 198,
  hip: 218,
  knee: 276,
  ankle: 330,
  feet: 338,
  arms: { left: { from: [101, 160], to: [88, 222] }, right: { from: [139, 160], to: [152, 222] } },
  hands: { left: [86, 229], right: [154, 229] },
};

/** A tapered capsule between two points (limbs and sleeves), radius r1 at `a`, r2 at `b`. */
export function capsule([x1, y1], [x2, y2], r1, r2) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const f = (v) => v.toFixed(1);
  const p = (x, y) => `${f(x)} ${f(y)}`;
  return `M${p(x1 + nx * r1, y1 + ny * r1)}L${p(x2 + nx * r2, y2 + ny * r2)}A${f(r2)} ${f(r2)} 0 0 0 ${p(x2 - nx * r2, y2 - ny * r2)}L${p(x1 - nx * r1, y1 - ny * r1)}A${f(r1)} ${f(r1)} 0 0 0 ${p(x1 + nx * r1, y1 + ny * r1)}Z`;
}
/** A point part-way along an arm (t = 0 at the shoulder, 1 at the wrist). */
export function along(side, t) {
  const { from, to } = BODY.arms[side];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}
export const mirrorX = (x) => 240 - x;

export const LEG_L = "M99 212C97 238 100 262 103 284C104 300 104 316 104.5 331H115C115.5 316 116 300 117 284C118.5 262 120.5 238 120.5 220Z";
export const LEG_R = "M141 212C143 238 140 262 137 284C136 300 136 316 135.5 331H125C124.5 316 124 300 123 284C121.5 262 119.5 238 119.5 220Z";
const TORSO = "M109 148Q100 150 96 156C94 162 97 168 99 173C101 183 103 191 104 198C101 205 98 212 98 221H142C142 212 139 205 136 198C137 191 139 183 141 173C143 168 146 162 144 156Q140 150 131 148Z";

export function DollBody({ skin }) {
  const shade = mix(skin, "#c9707f", 0.28);
  return (
    <g>
      <path d={LEG_L} fill={skin} {...ink} />
      <path d={LEG_R} fill={skin} {...ink} />
      <path d="M104 286C105 300 105 314 105.5 326" stroke={shade} strokeOpacity="0.5" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M136 286C135 300 135 314 134.5 326" stroke={shade} strokeOpacity="0.5" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="109.5" cy="337" rx="9.5" ry="6" fill={skin} {...ink} />
      <ellipse cx="130.5" cy="337" rx="9.5" ry="6" fill={skin} {...ink} />
      <path d={TORSO} fill={skin} {...ink} />
      <rect x="112.5" y="134" width="15" height="20" rx="6" fill={skin} {...ink} />
      <path d="M113 142Q120 149 127 142V150Q120 154 113 150Z" fill={shade} opacity="0.55" />
    </g>
  );
}

/** What she wears when nothing else is: a little lilac camisole and bloomers. */
export function DollSlip({ top = true, bottom = true }) {
  return (
    <g>
      {bottom && <path d="M99 206H141C142 214 142 222 140 230C134 233 127 232 120 228C113 232 106 233 100 230C98 222 98 214 99 206Z" fill="#efe4ff" {...thin} />}
      {top && (
        <g>
          <path d="M103 160C110 164 130 164 137 160L139 172C140 184 138 196 137 206H103C102 196 100 184 101 172Z" fill="#efe4ff" {...thin} />
          <path d="M106 158V164M134 158V164" stroke={INK} strokeWidth="1.2" />
          <path d="M116 166C114 163 111 164 112 167C113 169 116 168 120 167C124 168 127 169 128 167C129 164 126 163 124 166" fill="#f6a9c7" stroke={INK} strokeWidth="0.9" />
        </g>
      )}
    </g>
  );
}

export function DollArms({ skin }) {
  const shade = mix(skin, "#c9707f", 0.25);
  return (
    <g>
      {["left", "right"].map((side) => {
        const { from, to } = BODY.arms[side];
        const [hx, hy] = BODY.hands[side];
        return (
          <g key={side}>
            <path d={capsule(from, to, 6.4, 4.8)} fill={skin} {...ink} />
            <ellipse cx={hx} cy={hy} rx="6.6" ry="7.4" fill={skin} {...ink} transform={`rotate(${side === "left" ? 12 : -12} ${hx} ${hy})`} />
            <path d={side === "left" ? `M${hx + 2} ${hy - 4}q3 3 1 7` : `M${hx - 2} ${hy - 4}q-3 3-1 7`} stroke={shade} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------- the face
const HEAD = "M120 46C152 46 172 70 172 101C172 129 151 147 120 147C89 147 68 129 68 101C68 70 88 46 120 46Z";
export { HEAD };

function Eye({ x, colour, style, side, lash, skin }) {
  const y = 108;
  const lid = side === "left" ? `M${x - 13} ${y - 6}C${x - 9} ${y - 16} ${x + 7} ${y - 17} ${x + 12} ${y - 8}` : `M${x + 13} ${y - 6}C${x + 9} ${y - 16} ${x - 7} ${y - 17} ${x - 12} ${y - 8}`;
  const flick = side === "left" ? `M${x - 12} ${y - 7}l-4-2` : `M${x + 12} ${y - 7}l4-2`;
  if (style === "happy" || (style === "wink" && side === "right"))
    return <path d={`M${x - 10} ${y + 1}Q${x} ${y - 10} ${x + 10} ${y + 1}`} fill="none" stroke={lash} strokeWidth="3" strokeLinecap="round" />;
  const dark = deep(colour, 0.45), bright = light(colour, 0.45);
  return (
    <g>
      <ellipse cx={x} cy={y} rx="10.5" ry="12.5" fill="#fff" />
      <ellipse cx={x} cy={y + 0.5} rx="9.2" ry="11.6" fill={colour} />
      <path d={`M${x - 9.2} ${y}A9.2 11.6 0 0 1 ${x + 9.2} ${y}C${x + 6} ${y - 3} ${x - 6} ${y - 3} ${x - 9.2} ${y}Z`} fill={dark} opacity="0.75" />
      <ellipse cx={x} cy={y + 6} rx="6" ry="4.2" fill={bright} opacity="0.85" />
      <ellipse cx={x} cy={y + 1} rx="4.2" ry="5.6" fill={deep(colour, 0.7)} />
      <ellipse cx={x + (side === "left" ? 3.6 : -3.6)} cy={y - 4} rx="3.6" ry="4.4" fill="#fff" />
      <circle cx={x + (side === "left" ? -3.6 : 3.6)} cy={y + 5} r="1.7" fill="#fff" opacity="0.9" />
      {style === "sparkle" && <path d={`M${x - 3} ${y + 2}l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z`} fill="#fff" />}
      {style === "sleepy" && <path d={`M${x - 11} ${y - 13}H${x + 11}V${y - 2}C${x + 6} ${y - 5} ${x - 6} ${y - 5} ${x - 11} ${y - 2}Z`} fill={skin} />}
      <path d={style === "sleepy" ? `M${x - 12} ${y - 2}C${x - 6} ${y - 6} ${x + 6} ${y - 6} ${x + 12} ${y - 2}` : lid} fill="none" stroke={lash} strokeWidth="3.2" strokeLinecap="round" />
      {style !== "sleepy" && <path d={flick} stroke={lash} strokeWidth="2.4" strokeLinecap="round" />}
      <path d={`M${x - 5} ${y + 13}Q${x} ${y + 14.5} ${x + 5} ${y + 13}`} fill="none" stroke={lash} strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function Mouth({ id }) {
  if (id === "open")
    return (
      <g>
        <path d="M114 126Q120 125 126 126Q125 134 120 134Q115 134 114 126Z" fill="#c75a78" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M116.5 131Q120 129 123.5 131Q122 133.6 120 133.6Q118 133.6 116.5 131Z" fill="#ff9fb4" />
      </g>
    );
  if (id === "cat") return <path d="M112.5 126Q116 130.5 120 126.5Q124 130.5 127.5 126" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />;
  if (id === "o") return <ellipse cx="120" cy="129" rx="3" ry="3.6" fill="#c75a78" stroke={INK} strokeWidth="1.4" />;
  return <path d="M114.5 127Q120 132 125.5 127" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />;
}

/** The head: face, ears, eyes, brows, blush and mouth. `brow` is a soft tone of her hair colour. */
export function DollHead({ skin, eyes, eyeStyle = "round", mouth = "smile", brow = "#5a3f4f" }) {
  const shade = mix(skin, "#c9707f", 0.22);
  const lash = "#3a2740";
  return (
    <g>
      <ellipse cx="68" cy="108" rx="6" ry="9" fill={skin} {...ink} />
      <ellipse cx="172" cy="108" rx="6" ry="9" fill={skin} {...ink} />
      <path d={HEAD} fill={skin} {...ink} />
      <path d="M78 128C88 142 104 147 120 147C136 147 152 142 162 128C150 138 136 142 120 142C104 142 90 138 78 128Z" fill={shade} opacity="0.35" />
      <path d="M92 90Q100 86 108 89M132 89Q140 86 148 90" fill="none" stroke={brow} strokeWidth="2" strokeLinecap="round" />
      <Eye x={101} side="left" colour={eyes} style={eyeStyle} lash={lash} skin={skin} />
      <Eye x={139} side="right" colour={eyes} style={eyeStyle} lash={lash} skin={skin} />
      <ellipse cx="90" cy="123" rx="9" ry="5" fill="#ff8fb4" opacity="0.4" />
      <ellipse cx="150" cy="123" rx="9" ry="5" fill="#ff8fb4" opacity="0.4" />
      <path d="M86 122l2-3M90 123l2-3M94 122l2-3M146 122l2-3M150 123l2-3M154 122l2-3" stroke="#f27aa0" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M119 119.5q1 1 2 0" stroke={shade} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Mouth id={mouth} />
    </g>
  );
}

export const browOf = (hair) => mix(hair, "#3a2740", 0.35);
export { deep, light, mix };
