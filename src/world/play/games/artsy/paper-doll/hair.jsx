import { INK, deep, light, mix } from "./body.jsx";

// Hairstyles, drawn for this game. Each one has a back (behind the head and body: lengths, tails,
// buns) and a front (the crown, the fringe and the locks that fall over her shoulders, with a soft
// shine). `c` is the hair colour, `a` the colour of ties and bows.
export const HAIR_COLOURS = ["#3b2a4a", "#5a3a2e", "#8a5a44", "#d9a86a", "#f3dfae", "#f3a6c4", "#c8a6ec", "#8fd6c0", "#4fb8b8", "#d8d4e6", "#c4505a", "#2f3e66"];

const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };
const thinInk = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" };

// ---------------------------------------------------------------- fringes
/** A fringe whose bottom edge is a row of clumps: tips [x, y] from right to left. */
function fringe(tips, rootY = 74, outer = "M64 122C58 70 88 36 120 36C152 36 182 70 176 122") {
  let d = `${outer}L170 100`;
  let px = 170;
  for (const [x, y] of tips) {
    d += `Q${((px + x) / 2).toFixed(1)} ${rootY} ${x} ${y}`;
    px = x;
  }
  return `${d}Q${((px + 70) / 2).toFixed(1)} ${rootY} 70 100Z`;
}
const BANGS = {
  blunt: fringe([[159, 91], [146, 93], [133, 92], [120, 94], [107, 92], [94, 93], [81, 91]], 81),
  wispy: fringe([[162, 96], [151, 88], [141, 95], [131, 86], [121, 96], [110, 88], [100, 94], [88, 87], [80, 95]], 78),
  side: fringe([[160, 84], [146, 82], [130, 85], [116, 90], [102, 95], [88, 100], [78, 104]], 74),
  short: fringe([[158, 82], [144, 79], [130, 81], [118, 78], [104, 80], [90, 79], [80, 86]], 70),
  parted:
    "M64 122C58 70 88 36 120 36C152 36 182 70 176 122L172 104C168 80 150 62 124 52C126 66 140 84 156 96C140 90 126 76 120 60C114 76 100 90 84 96C100 84 114 66 116 52C90 62 72 80 68 104Z",
};
const STRANDS = {
  blunt: "M98 52Q94 70 94 90M120 40Q119 64 120 92M142 52Q146 70 146 90",
  wispy: "M100 52Q98 70 100 92M124 42Q122 66 121 94M146 54Q150 70 150 88",
  side: "M100 54Q108 72 116 86M126 44Q136 62 146 78",
  short: "M104 50Q102 64 104 78M130 46Q132 62 130 78",
  parted: "M118 44Q106 60 90 92M122 44Q134 60 150 92",
};

function Front({ c, bangs = "blunt", locks = 0, lockStyle = "straight", shine = true }) {
  const d = deep(c, 0.32), l = light(c, 0.5);
  const lockL =
    lockStyle === "wave"
      ? `M68 100C58 130 70 ${130 + locks * 0.4} 62 ${150 + locks}C74 ${150 + locks} 82 ${130 + locks * 0.5} 78 104Z`
      : lockStyle === "blunt"
        ? `M68 98C64 120 64 ${140 + locks * 0.5} 66 ${150 + locks}H80C78 ${136 + locks * 0.5} 78 120 80 104Z`
        : `M68 98C60 124 62 ${136 + locks * 0.6} 66 ${150 + locks}C72 ${140 + locks * 0.7} 80 ${124 + locks * 0.4} 80 104Z`;
  const lockR = lockL.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(240 - Number(x)).toFixed(1)} ${y}`).replace(/H(\d+(?:\.\d+)?)/g, (_, x) => `H${240 - Number(x)}`);
  return (
    <g>
      {locks > 0 && (
        <>
          <path d={lockL} fill={c} {...ink} />
          <path d={lockR} fill={c} {...ink} />
        </>
      )}
      <path d={BANGS[bangs] ?? BANGS.blunt} fill={c} {...ink} />
      <path d={STRANDS[bangs] ?? STRANDS.blunt} fill="none" stroke={d} strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M70 100C70 84 76 70 86 60C80 74 78 88 80 100Z" fill={d} opacity="0.25" />
      {shine && <path d="M84 60Q102 48 120 47Q138 48 156 60" fill="none" stroke={l} strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" strokeDasharray="14 7 22 6 30" />}
    </g>
  );
}

// ---------------------------------------------------------------- backs and extras
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(240 - Number(x)).toFixed(1)} ${y}`);
const Shade = ({ d, c, o = 0.3 }) => <path d={d} fill="none" stroke={deep(c, 0.35)} strokeOpacity={o} strokeWidth="1.6" strokeLinecap="round" />;

const LONG = "M66 96C56 150 54 222 60 290Q72 298 84 290Q96 298 108 290H132Q144 298 156 290Q168 298 180 290C186 222 184 150 174 96Z";
const WAVES = "M66 96C50 132 66 160 54 196C46 224 64 248 54 282Q70 300 86 286Q100 298 112 288H128Q140 298 154 286Q170 300 186 282C176 248 194 224 186 196C174 160 190 132 174 96Z";
const BOB = "M64 100C56 128 60 152 72 164Q88 172 102 162H138Q152 172 168 164C180 152 184 128 176 100Z";
const SHOULDER = "M64 100C54 140 58 176 66 198Q82 206 96 196H144Q158 206 174 198C182 176 186 140 176 100Z";
const WOLF = "M64 100C54 132 50 160 60 188L70 176L74 200L86 182L92 204L100 178H140L148 204L154 182L166 200L170 176L180 188C190 160 186 132 176 100Z";
const PIXIE = "M66 104C60 120 62 136 70 146Q78 148 84 140H156Q162 148 170 146C178 136 180 120 174 104Z";

function Tie({ x, y, a, r = 6 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={a} {...thinInk} />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.3} fill="#fff" opacity="0.7" />
    </g>
  );
}
function Bow({ x, y, a, s = 1, turn = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${s})`}>
      <path d="M0 0C-8-10-22-12-22-2C-22 6-10 6 0 0ZM0 0C8-10 22-12 22-2C22 6 10 6 0 0Z" fill={a} {...thinInk} />
      <path d="M-2 2L-8 16L-3 14L0 18L2 2ZM2 2L8 16L3 14L0 18L-2 2Z" fill={deep(a, 0.15)} {...thinInk} />
      <circle r="4.2" fill={light(a, 0.2)} {...thinInk} />
    </g>
  );
}
/** A braid: stacked plaits from (x, y0) to y1, swaying a little. */
function Braid({ x, y0, y1, c, a, sway = 0 }) {
  const n = Math.max(4, Math.round((y1 - y0) / 13));
  const step = (y1 - y0) / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const cx = x + Math.sin(i * 0.8) * sway;
        const cy = y0 + step * (i + 0.5);
        return (
          <g key={i}>
            <ellipse cx={cx - 3} cy={cy} rx="8" ry={step * 0.62} transform={`rotate(-22 ${cx - 3} ${cy})`} fill={c} {...thinInk} />
            <ellipse cx={cx + 3} cy={cy + step * 0.3} rx="8" ry={step * 0.62} transform={`rotate(22 ${cx + 3} ${cy + step * 0.3})`} fill={mix(c, deep(c, 0.3), 0.3)} {...thinInk} />
          </g>
        );
      })}
      <Tie x={x} y={y1 + 2} a={a} r={5} />
      <path d={`M${x - 5} ${y1 + 6}Q${x} ${y1 + 22} ${x + 5} ${y1 + 6}`} fill={c} {...thinInk} />
    </g>
  );
}
/** A drill curl (ojou-sama ringlets): stacked teardrops narrowing downward. */
function Drill({ x, y0, y1, c }) {
  const n = 6;
  const step = (y1 - y0) / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const w = 15 - i * 1.4;
        const cy = y0 + step * i;
        return (
          <g key={i}>
            <path d={`M${x - w} ${cy}C${x - w} ${cy + step * 0.9} ${x + w} ${cy + step * 1.1} ${x + w * 0.8} ${cy + step * 0.3}C${x + w * 0.4} ${cy - 4} ${x - w * 0.6} ${cy - 4} ${x - w} ${cy}Z`} fill={i % 2 ? mix(c, deep(c, 0.3), 0.25) : c} {...thinInk} />
            <path d={`M${x - w * 0.5} ${cy + step * 0.3}Q${x} ${cy + step * 0.7} ${x + w * 0.5} ${cy + step * 0.4}`} fill="none" stroke={light(c, 0.5)} strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
function Curls({ c, until = 210 }) {
  const puffs = [];
  for (let y = 70; y <= until; y += 18) {
    const spread = y < 120 ? 58 : 60 - (y - 120) * 0.12;
    puffs.push([120 - spread, y], [120 + spread, y]);
    if (y > 130) puffs.push([120 - spread * 0.55, y + 8], [120 + spread * 0.55, y + 8]);
  }
  return (
    <g>
      {puffs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 15 : 17} fill={i % 2 ? c : mix(c, deep(c, 0.3), 0.2)} {...thinInk} />
      ))}
      <ellipse cx="120" cy="100" rx="56" ry="50" fill={c} />
    </g>
  );
}

const TAIL_HIGH = "M80 62C42 60 28 112 36 170C42 216 34 252 44 292C50 286 54 276 56 262C62 238 60 210 62 186C66 140 76 102 92 80Z";
const TAIL_LOW = "M74 126C58 136 52 160 56 186C58 206 54 220 60 238C66 232 72 220 74 204C78 182 80 156 86 140Z";
const SIDE_TAIL = "M156 64C196 62 210 110 202 160C196 200 206 230 192 262C186 252 184 240 182 226C178 200 184 172 178 146C172 112 164 90 150 76Z";
const PONY = "M148 48C188 40 206 84 198 130C192 170 202 200 188 236C180 224 178 210 176 196C172 168 182 142 176 116C170 90 160 72 146 62Z";

export const HAIR = [
  { id: "waves", name: "long waves", back: (c) => <g><path d={WAVES} fill={c} {...ink} /><Shade c={c} d="M78 150C72 190 82 230 76 270M162 150C168 190 158 230 164 270M120 150V280" /></g>, front: (c) => <Front c={c} bangs="wispy" locks={44} lockStyle="wave" /> },
  { id: "long", name: "long & straight", back: (c) => <g><path d={LONG} fill={c} {...ink} /><Shade c={c} d="M80 140V282M160 140V282M120 150V286" /></g>, front: (c) => <Front c={c} bangs="blunt" locks={40} /> },
  { id: "hime", name: "princess cut", back: (c) => <g><path d={LONG} fill={c} {...ink} /><Shade c={c} d="M84 160V284M156 160V284" /></g>, front: (c) => <Front c={c} bangs="blunt" locks={8} lockStyle="blunt" /> },
  {
    id: "twintails",
    name: "twin tails",
    back: (c) => (
      <g>
        <path d={TAIL_HIGH} fill={c} {...ink} />
        <path d={mirror(TAIL_HIGH)} fill={c} {...ink} />
        <Shade c={c} d={`M52 110C44 160 52 220 46 270${mirror("M52 110C44 160 52 220 46 270")}`} />
        <path d={BOB} fill={c} {...ink} />
      </g>
    ),
    front: (c, a) => (
      <g>
        <Front c={c} bangs="blunt" locks={10} />
        <Tie x={80} y={62} a={a} r={7} />
        <Tie x={160} y={62} a={a} r={7} />
      </g>
    ),
  },
  {
    id: "pigtails",
    name: "low pigtails",
    back: (c) => (
      <g>
        <path d={TAIL_LOW} fill={c} {...ink} />
        <path d={mirror(TAIL_LOW)} fill={c} {...ink} />
        <path d={BOB} fill={c} {...ink} />
      </g>
    ),
    front: (c, a) => (
      <g>
        <Front c={c} bangs="wispy" locks={0} />
        <Bow x={76} y={128} a={a} s={0.62} turn={-12} />
        <Bow x={164} y={128} a={a} s={0.62} turn={12} />
      </g>
    ),
  },
  {
    id: "braids",
    name: "two braids",
    back: (c) => <path d={BOB} fill={c} {...ink} />,
    front: (c, a) => (
      <g>
        <Braid x={76} y0={118} y1={238} c={c} a={a} sway={2} />
        <Braid x={164} y0={118} y1={238} c={c} a={a} sway={-2} />
        <Front c={c} bangs="parted" locks={0} />
      </g>
    ),
  },
  { id: "bob", name: "soft bob", back: (c) => <path d={BOB} fill={c} {...ink} />, front: (c) => <Front c={c} bangs="blunt" locks={14} lockStyle="blunt" /> },
  { id: "shoulder", name: "shoulder length", back: (c) => <g><path d={SHOULDER} fill={c} {...ink} /><Shade c={c} d="M80 140C78 160 80 180 84 196M160 140C162 160 160 180 156 196" /></g>, front: (c) => <Front c={c} bangs="side" locks={24} /> },
  { id: "pixie", name: "pixie", back: (c) => <path d={PIXIE} fill={c} {...ink} />, front: (c) => <Front c={c} bangs="side" locks={0} /> },
  { id: "wolf", name: "wolf cut", back: (c) => <path d={WOLF} fill={c} {...ink} />, front: (c) => <Front c={c} bangs="wispy" locks={26} /> },
  {
    id: "buns",
    name: "space buns",
    back: (c) => (
      <g>
        <circle cx="78" cy="50" r="20" fill={c} {...ink} />
        <circle cx="162" cy="50" r="20" fill={c} {...ink} />
        <path d="M66 46Q78 36 90 46M150 46Q162 36 174 46" fill="none" stroke={light(c, 0.5)} strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
        <path d={BOB} fill={c} {...ink} />
      </g>
    ),
    front: (c, a) => (
      <g>
        <Front c={c} bangs="blunt" locks={18} />
        <path d="M92 58Q80 70 68 62M148 58Q160 70 172 62" fill="none" stroke={a} strokeWidth="4" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: "topbun",
    name: "top bun",
    back: (c) => (
      <g>
        <circle cx="120" cy="30" r="22" fill={c} {...ink} />
        <path d="M106 24Q120 12 134 24" fill="none" stroke={light(c, 0.5)} strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
        <path d={PIXIE} fill={c} {...ink} />
      </g>
    ),
    front: (c, a) => (
      <g>
        <Front c={c} bangs="parted" locks={16} />
        <path d="M104 44Q120 52 136 44" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" />
      </g>
    ),
  },
  { id: "sidetail", name: "side ponytail", back: (c) => <g><path d={SIDE_TAIL} fill={c} {...ink} /><path d={BOB} fill={c} {...ink} /></g>, front: (c, a) => <g><Front c={c} bangs="side" locks={10} /><Tie x={158} y={68} a={a} r={7} /></g> },
  { id: "ponytail", name: "high ponytail", back: (c) => <g><path d={PONY} fill={c} {...ink} /><path d={PIXIE} fill={c} {...ink} /></g>, front: (c) => <Front c={c} bangs="wispy" locks={20} /> },
  { id: "curly", name: "fluffy curls", back: (c) => <Curls c={c} until={200} />, front: (c) => <Front c={c} bangs="wispy" locks={0} /> },
  {
    id: "drills",
    name: "drill curls",
    back: (c) => <path d={SHOULDER} fill={c} {...ink} />,
    front: (c, a) => (
      <g>
        <Drill x={72} y0={112} y1={236} c={c} />
        <Drill x={168} y0={112} y1={236} c={c} />
        <Front c={c} bangs="blunt" locks={0} />
        <Bow x={150} y={50} a={a} s={0.7} turn={18} />
      </g>
    ),
  },
  {
    id: "halfup",
    name: "half-up bow",
    back: (c) => <g><path d={WAVES} fill={c} {...ink} /><Shade c={c} d="M78 150C72 190 82 230 76 270M162 150C168 190 158 230 164 270" /></g>,
    front: (c, a) => (
      <g>
        <Front c={c} bangs="parted" locks={40} lockStyle="wave" />
        <Bow x={120} y={40} a={a} s={0.85} />
      </g>
    ),
  },
];
export const hairById = (id) => HAIR.find((hair) => hair.id === id) ?? HAIR[0];
/** Tie and bow colour for a hair colour: pink, or lilac on pink hair. */
export const tieFor = (c) => (c === "#f3a6c4" ? "#9a6cc8" : "#f27aa0");
