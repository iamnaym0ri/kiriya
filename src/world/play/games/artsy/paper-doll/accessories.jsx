import { INK, LEG_L, LEG_R, deep, light, mix } from "./body.jsx";
import { BowKnot, LaceEdge, ink, thin, usePid } from "./sew.jsx";

// Shoes, socks and everything else she can wear or hold, drawn for this game in doll space.
const FEET = [109.5, 130.5];
const Shine = ({ d, w = 2, o = 0.55 }) => <path d={d} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth={w} strokeLinecap="round" />;

// ---------------------------------------------------------------- socks (the legs, from `from` down)
function Legwear({ from, c, a, sheer = false, band, stripes = false, children }) {
  const pid = usePid();
  return (
    <g>
      <defs>
        <clipPath id={pid}>
          <rect x="80" y={from} width="80" height="80" />
        </clipPath>
        {stripes && (
          <pattern id={`${pid}s`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={c} />
            <rect width="8" height="4" fill={a} />
          </pattern>
        )}
      </defs>
      <g clipPath={`url(#${pid})`}>
        <path d={LEG_L} fill={stripes ? `url(#${pid}s)` : c} fillOpacity={sheer ? 0.55 : 1} {...thin} />
        <path d={LEG_R} fill={stripes ? `url(#${pid}s)` : c} fillOpacity={sheer ? 0.55 : 1} {...thin} />
      </g>
      {FEET.map((x) => <ellipse key={x} cx={x} cy="337" rx="9.5" ry="6" fill={stripes ? a : c} fillOpacity={sheer ? 0.55 : 1} {...thin} />)}
      {band?.()}
      {children}
    </g>
  );
}
const SOCKS = [
  { id: "frillsocks", slot: "socks", name: "frill socks", colors: [["#fffafd", "#f6a9c7"], ["#fffafd", "#c9b1ee"], ["#3b2a4a", "#fffafd"], ["#ffd1e3", "#fffafd"]], draw: ({ c, a }) => <Legwear from={316} c={c} a={a} band={() => <g><LaceEdge x0={102} x1={118} y={316} c={a} r={2.2} /><LaceEdge x0={122} x1={138} y={316} c={a} r={2.2} /></g>} /> },
  { id: "kneesocks", slot: "socks", name: "knee socks", colors: [["#fffafd", "#f6a9c7"], ["#3b2a4a", "#c9b1ee"], ["#c9b1ee", "#fffafd"]], draw: ({ c, a }) => <Legwear from={268} c={c} a={a} band={() => <path d="M101 268H119M121 268H139" stroke={a} strokeWidth="3" />}><BowKnot x={110} y={272} c={a} s={0.4} /><BowKnot x={130} y={272} c={a} s={0.4} /></Legwear> },
  { id: "thighhighs", slot: "socks", name: "thigh-highs", colors: [["#fffafd", "#f6a9c7"], ["#2b2033", "#f27aa0"], ["#e3d4ff", "#9a6cc8"], ["#3c4a56", "#4fc4c0"]], draw: ({ c, a }) => <Legwear from={240} c={c} a={a} band={() => <path d="M99 241H120M120 241H141" stroke={a} strokeWidth="3.4" />} /> },
  { id: "striped", slot: "socks", name: "striped stockings", colors: [["#fffafd", "#2b2033"], ["#fffafd", "#f6a9c7"], ["#fffafd", "#9a6cc8"], ["#fffafd", "#4fb8b8"]], draw: ({ c, a }) => <Legwear from={244} c={c} a={a} stripes /> },
  { id: "tights", slot: "socks", name: "sheer tights", colors: [["#2b2033", "#2b2033"], ["#fffafd", "#fffafd"], ["#f6c1d8", "#f6c1d8"]], draw: ({ c, a }) => <Legwear from={208} c={c} a={a} sheer /> },
  { id: "legwarmers", slot: "socks", name: "leg warmers", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#d9a88f"]], draw: ({ c, a }) => <Legwear from={290} c={c} a={a} band={() => <g>{[296, 304, 312, 320, 328].map((y) => <path key={y} d={`M102 ${y}H118M122 ${y}H138`} stroke={deep(c, 0.25)} strokeWidth="1.2" />)}<path d="M100 290H119M121 290H140" stroke={a} strokeWidth="3" /></g>} /> },
];

// ---------------------------------------------------------------- shoes
const shoe = (x, toe = 11, height = 10) => `M${x - toe} 339Q${x - toe} ${339 - height} ${x} ${339 - height}Q${x + toe} ${339 - height} ${x + toe} 339Q${x + toe} 345 ${x} 345Q${x - toe} 345 ${x - toe} 339Z`;
const SHOES = [
  { id: "maryjanes", slot: "shoes", name: "mary janes", colors: [["#3b2a4a", "#fffafd"], ["#e8577f", "#fffafd"], ["#fffafd", "#c9b1ee"], ["#8a5a44", "#f3dfae"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={shoe(x)} fill={c} {...ink} /><path d={`M${x - 8} 332H${x + 8}`} stroke={c} strokeWidth="3.2" /><circle cx={x + 6} cy="332" r="1.6" fill={a} /><Shine d={`M${x - 7} 336q4-4 9-4`} /></g>)}</g> },
  { id: "boots", slot: "shoes", name: "ankle boots", colors: [["#8a5a44", "#fff1d9"], ["#fffafd", "#f6a9c7"], ["#3b2a4a", "#c9b1ee"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={`M${x - 8} 306H${x + 7}L${x + 8} 334Q${x + 12} 336 ${x + 12} 340Q${x + 12} 346 ${x} 346H${x - 9}Q${x - 11} 346 ${x - 10} 338Z`} fill={c} {...ink} /><path d={`M${x - 8} 311H${x + 7}`} stroke={a} strokeWidth="3" /><Shine d={`M${x - 5} 316v20`} /></g>)}</g> },
  { id: "longboots", slot: "shoes", name: "long boots", colors: [["#2b2033", "#4fc4c0"], ["#fffafd", "#f6a9c7"], ["#8a5a44", "#f3dfae"], ["#3c4a56", "#f27aa0"]], draw: ({ c, a }) => <g>{FEET.map((x, i) => <g key={x}><path d={`M${x - 9.5} 262H${x + 8.5}L${x + 7} 334Q${x + 12} 336 ${x + 12} 340Q${x + 12} 346 ${x} 346H${x - 9}Q${x - 11} 346 ${x - 10} 338Z`} transform={i ? "" : ""} fill={c} {...ink} /><path d={`M${x - 9.5} 266H${x + 8.5}`} stroke={a} strokeWidth="3.4" /><Shine d={`M${x - 5} 274v58`} /></g>)}</g> },
  { id: "sneakers", slot: "shoes", name: "puffy sneakers", colors: [["#fffafd", "#c9b1ee"], ["#fffafd", "#f6a9c7"], ["#a9dcc8", "#fffafd"], ["#3b2a4a", "#f6a9c7"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={shoe(x, 12, 12)} fill={c} {...ink} /><path d={`M${x - 12} 341H${x + 12}V345Q${x} 348 ${x - 12} 345Z`} fill={a} {...thin} /><path d={`M${x - 3} 331l3 2 3-2M${x - 3} 335l3 2 3-2`} stroke={INK} strokeWidth="1" fill="none" /></g>)}</g> },
  { id: "platforms", slot: "shoes", name: "platform shoes", colors: [["#2b2033", "#fffafd"], ["#f6a9c7", "#fffafd"], ["#fffafd", "#2b2033"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={shoe(x, 11, 9)} fill={c} {...ink} /><path d={`M${x - 11} 340H${x + 11}V350Q${x} 352 ${x - 11} 350Z`} fill={deep(c, 0.1)} {...ink} /><path d={`M${x - 8} 333H${x + 8}`} stroke={c} strokeWidth="3" /><path d={`M${x - 5} 333l5-4 5 4`} fill="none" stroke={a} strokeWidth="1.6" /></g>)}</g> },
  { id: "pointes", slot: "shoes", name: "pointe shoes", colors: [["#ffd1e3", "#f6a9c7"], ["#fff1d9", "#e8c27f"], ["#e3d4ff", "#b79be0"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={`M${x - 6} 318L${x + 6} 324M${x + 6} 316L${x - 6} 326M${x - 6} 330L${x + 6} 324`} stroke={a} strokeWidth="2.2" strokeLinecap="round" /><path d={shoe(x, 9.5, 10)} fill={c} {...ink} /><Shine d={`M${x - 5} 337q3-3 7-3`} /></g>)}</g> },
  { id: "slippers", slot: "shoes", name: "bunny slippers", colors: [["#fffafd", "#f6a9c7"], ["#ffd1e3", "#fffafd"], ["#e3d4ff", "#f6a9c7"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><ellipse cx={x - 4} cy="326" rx="3" ry="7" transform={`rotate(-14 ${x - 4} 326)`} fill={c} {...thin} /><ellipse cx={x + 4} cy="326" rx="3" ry="7" transform={`rotate(14 ${x + 4} 326)`} fill={c} {...thin} /><ellipse cx={x - 4} cy="327" rx="1.3" ry="4" transform={`rotate(-14 ${x - 4} 327)`} fill={a} /><ellipse cx={x + 4} cy="327" rx="1.3" ry="4" transform={`rotate(14 ${x + 4} 327)`} fill={a} /><path d={shoe(x, 13, 12)} fill={c} {...ink} /><circle cx={x - 3} cy="336" r="1" fill={INK} /><circle cx={x + 3} cy="336" r="1" fill={INK} /><ellipse cx={x} cy="339" rx="1.6" ry="1" fill={a} /></g>)}</g> },
  { id: "loafers", slot: "shoes", name: "loafers", colors: [["#5a3a2e", "#e8c27f"], ["#2b2033", "#e8c27f"], ["#b7334f", "#fff1d9"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={shoe(x, 11, 9)} fill={c} {...ink} /><path d={`M${x - 6} 334H${x + 6}V337H${x - 6}Z`} fill={deep(c, 0.2)} {...thin} /><circle cx={x} cy="335.5" r="1.2" fill={a} /><Shine d={`M${x - 8} 340q4-6 10-6`} /></g>)}</g> },
  { id: "clothshoes", slot: "shoes", name: "embroidered flats", colors: [["#a9c9a4", "#f6a9c7"], ["#7b2d5b", "#e8c27f"], ["#2f3e66", "#e8c27f"], ["#f3e6ff", "#b38ad9"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={`M${x - 11} 340Q${x - 10} 330 ${x} 330Q${x + 9} 330 ${x + 13} 334L${x + 11} 340Q${x} 345 ${x - 11} 340Z`} fill={c} {...ink} /><path d={`M${x - 2} 334q2-3 4 0q-2 3-4 0Z`} fill={a} /></g>)}</g> },
  { id: "sandals", slot: "shoes", name: "ribbon sandals", colors: [["#f6a9c7", "#fffafd"], ["#e8c27f", "#fff1d9"], ["#fffafd", "#c9b1ee"]], draw: ({ c, a }) => <g>{FEET.map((x) => <g key={x}><path d={`M${x - 10} 342H${x + 10}V345Q${x} 347 ${x - 10} 345Z`} fill={c} {...thin} /><path d={`M${x - 8} 336H${x + 8}M${x - 6} 330L${x + 5} 322M${x + 6} 330L${x - 5} 322`} stroke={c} strokeWidth="2.6" strokeLinecap="round" /><BowKnot x={x} y={321} c={a} s={0.35} /></g>)}</g> },
];

// ---------------------------------------------------------------- on her head
const HEAD = [
  { id: "bow", slot: "head", name: "big ribbon", colors: [["#f6a9c7", "#e8577f"], ["#2b2033", "#f6a9c7"], ["#fffafd", "#c9b1ee"], ["#b79be0", "#fffafd"], ["#b7334f", "#fff1d9"]], draw: ({ c }) => <BowKnot x={156} y={50} c={c} s={1.25} turn={14} /> },
  { id: "catears", slot: "head", name: "kitty ears", colors: [["#2b2033", "#f6a9c7"], ["#fffafd", "#f6a9c7"], ["#e8c27f", "#fff1d9"], ["#c9b1ee", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M78 66C82 46 102 36 120 36S158 46 162 66" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M84 58L80 22L108 42Z" fill={c} {...ink} />
      <path d="M156 58L160 22L132 42Z" fill={c} {...ink} />
      <path d="M88 50L86 32L100 42ZM152 50L154 32L140 42Z" fill={a} />
    </g>
  ) },
  { id: "bunnyband", slot: "head", name: "bunny ears", colors: [["#fffafd", "#f6a9c7"], ["#ffd1e3", "#fffafd"], ["#2b2033", "#f27aa0"]], draw: ({ c, a }) => (
    <g>
      <path d="M78 66C82 46 102 36 120 36S158 46 162 66" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M100 44C88 20 90-6 100-8C110-6 112 20 108 42Z" fill={c} {...ink} transform="rotate(-10 104 40)" />
      <path d="M140 44C152 20 150-6 140-8C130-6 128 20 132 42Z" fill={c} {...ink} transform="rotate(16 136 40)" />
      <path d="M100 38C94 22 96 4 100 2C104 4 106 22 104 38Z" fill={a} transform="rotate(-10 104 40)" />
      <path d="M140 38C146 22 144 4 140 2C136 4 134 22 136 38Z" fill={a} transform="rotate(16 136 40)" />
    </g>
  ) },
  { id: "flowers", slot: "head", name: "flower crown", colors: [["#f6a9c7", "#fff1d9"], ["#c9b1ee", "#fffafd"], ["#fff3b8", "#f6a9c7"], ["#a9dcc8", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      <path d="M76 66C86 46 104 40 120 40S154 46 164 66" fill="none" stroke="#7aa36a" strokeWidth="3" />
      {[[80, 60], [92, 48], [106, 42], [120, 40], [134, 42], [148, 48], [160, 60]].map(([x, y], i) => (
        <g key={x}>
          {i % 2 === 0 && <path d={`M${x + 4} ${y + 4}q6-2 8 3q-6 2-8-3Z`} fill="#8cc47e" {...thin} />}
          {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 4.4} rx="3.6" ry="5" transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? a : c} stroke={INK} strokeWidth="1" />)}
          <circle cx={x} cy={y} r="2.6" fill="#ffcf6b" />
        </g>
      ))}
    </g>
  ) },
  { id: "beret", slot: "head", name: "beret", colors: [["#e8577f", "#5d3f78"], ["#9a6cc8", "#fffafd"], ["#fff1d9", "#8a5a44"], ["#2b2033", "#f6a9c7"]], draw: ({ c, a }) => (
    <g transform="rotate(-10 122 46)">
      <path d="M72 56C70 34 100 24 124 24S172 32 172 50C170 62 140 60 122 58S74 68 72 56Z" fill={c} {...ink} />
      <path d="M80 54C100 50 140 50 166 52" fill="none" stroke={deep(c, 0.2)} strokeWidth="2.4" />
      <path d="M124 24V16" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <Shine d="M92 36Q110 28 132 28" w={3} />
    </g>
  ) },
  { id: "tiara", slot: "head", name: "tiara", colors: [["#ffcf6b", "#f6a9c7"], ["#ece6f4", "#b79be0"], ["#f6a9c7", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M94 52L98 34L108 46L120 26L132 46L142 34L146 52Q120 46 94 52Z" fill={c} {...ink} />
      <circle cx="120" cy="38" r="3.6" fill={a} {...thin} />
      <circle cx="100" cy="42" r="2" fill={a} />
      <circle cx="140" cy="42" r="2" fill={a} />
      <Shine d="M112 40l8-8" w={1.6} />
    </g>
  ) },
  { id: "witch", slot: "head", name: "little witch hat", colors: [["#3b2a4a", "#f6a9c7"], ["#9a6cc8", "#ffcf6b"], ["#f6a9c7", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M66 58Q120 40 174 58Q160 68 120 64Q80 68 66 58Z" fill={c} {...ink} />
      <path d="M92 54C100 36 108 18 116 2C124-2 142 6 150 12C138 12 132 16 136 24C140 34 146 44 148 54Z" fill={c} {...ink} />
      <path d="M93 52Q120 46 147 52L146 58Q120 52 94 58Z" fill={a} {...thin} />
      <path d="M128 30l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.8-3.3 1.8.8-3.6-2.7-2.4 3.6-.4Z" fill="#ffcf6b" />
    </g>
  ) },
  { id: "headdress", slot: "head", name: "lace headdress", colors: [["#fffafd", "#f6a9c7"], ["#2b2033", "#fffafd"], ["#ffd1e3", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M78 62C86 42 104 36 120 36S154 42 162 62L156 66C150 50 136 44 120 44S90 50 84 66Z" fill={c} {...thin} />
      {[[82, 62], [90, 50], [102, 42], [116, 39], [130, 40], [143, 45], [154, 53], [160, 64]].map(([x, y]) => <circle key={x} cx={x} cy={y - 2} r="4.2" fill={c} {...thin} strokeWidth="0.9" />)}
      <BowKnot x={80} y={66} c={a} s={0.6} turn={-20} />
      <BowKnot x={160} y={66} c={a} s={0.6} turn={20} />
    </g>
  ) },
  { id: "hairpin", slot: "head", name: "tassel hairpin", colors: [["#e8c27f", "#b7334f"], ["#d8d4e6", "#9a6cc8"], ["#e8c27f", "#4fb8b8"]], draw: ({ c, a }) => (
    <g>
      <path d="M126 40L170 64" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(152 52)">
        {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cy="-5" rx="3.6" ry="5.4" transform={`rotate(${r})`} fill={a} stroke={INK} strokeWidth="1" />)}
        <circle r="2.6" fill={c} />
      </g>
      <path d="M156 58L160 84M152 60L152 88M160 56L168 80" stroke={c} strokeWidth="1.2" />
      {[[160, 86], [152, 90], [168, 82]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.4" fill={a} {...thin} />)}
    </g>
  ) },
  { id: "herbband", slot: "head", name: "herb scarf", colors: [["#e6d9b8", "#6b7f5a"], ["#d9c4e8", "#6b7f5a"], ["#fffafd", "#8a6a4a"]], draw: ({ c, a }) => (
    <g>
      <path d="M70 76C78 52 98 40 120 40S162 52 170 76L164 80C156 60 140 50 120 50S84 60 76 80Z" fill={c} {...thin} />
      <path d="M168 76C178 82 184 94 180 104L172 100C174 92 170 84 166 80Z" fill={c} {...thin} />
      <path d="M170 78C180 76 190 82 192 90L184 92C182 86 176 82 170 82Z" fill={deep(c, 0.12)} {...thin} />
      <path d="M150 50C154 40 162 36 168 38C164 44 158 48 150 50ZM156 46C158 36 166 30 172 32" fill="#8cc47e" stroke={a} strokeWidth="1" />
    </g>
  ) },
  { id: "starclips", slot: "head", name: "star clips", colors: [["#ffcf6b", "#f6a9c7"], ["#c9b1ee", "#fffafd"], ["#f6a9c7", "#fff3b8"]], draw: ({ c, a }) => (
    <g>
      {[[86, 74, -14], [97, 66, 10], [150, 70, 16]].map(([x, y, r], i) => (
        <path key={x} d="M0-7l2 4.4 4.8.6-3.5 3.3.9 4.7L0 2.7-4.2 5l.9-4.7-3.5-3.3 4.8-.6Z" transform={`translate(${x} ${y}) rotate(${r}) scale(${i === 1 ? 0.8 : 1})`} fill={i === 1 ? a : c} {...thin} />
      ))}
    </g>
  ) },
  { id: "sunhat", slot: "head", name: "sun hat", colors: [["#f3dfae", "#f6a9c7"], ["#fffafd", "#9a6cc8"], ["#e6cdb0", "#a9dcc8"]], draw: ({ c, a }) => (
    <g>
      <ellipse cx="120" cy="56" rx="72" ry="16" fill={c} {...ink} />
      <path d="M86 54C86 30 102 22 120 22S154 30 154 54Q120 62 86 54Z" fill={c} {...ink} />
      <path d="M86 48Q120 56 154 48L154 54Q120 62 86 54Z" fill={a} {...thin} />
      <BowKnot x={150} y={52} c={a} s={0.55} />
      <path d="M60 58Q120 70 180 58" fill="none" stroke={deep(c, 0.2)} strokeWidth="1.2" strokeDasharray="3 3" />
    </g>
  ) },
  { id: "headset", slot: "head", name: "stage headset", colors: [["#3c4a56", "#4fc4c0"], ["#2b2033", "#f27aa0"], ["#fffafd", "#9a6cc8"]], draw: ({ c, a }) => (
    <g>
      <path d="M68 104C66 66 92 40 120 40S174 66 172 104" fill="none" stroke={c} strokeWidth="4" />
      <rect x="60" y="96" width="14" height="22" rx="6" fill={c} {...ink} />
      <rect x="166" y="96" width="14" height="22" rx="6" fill={c} {...ink} />
      <rect x="63" y="101" width="8" height="12" rx="3" fill={a} />
      <path d="M70 116Q78 132 98 128" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="100" cy="128" r="3" fill={a} {...thin} />
    </g>
  ) },
];

// ---------------------------------------------------------------- on her face
const FACE = [
  { id: "glasses", slot: "face", name: "round glasses", colors: [["#5d3f78", "#ffffff"], ["#e8c27f", "#ffffff"], ["#f27aa0", "#ffffff"]], draw: ({ c }) => (
    <g>
      <circle cx="101" cy="108" r="15" fill="#fff" fillOpacity="0.18" stroke={c} strokeWidth="2.6" />
      <circle cx="139" cy="108" r="15" fill="#fff" fillOpacity="0.18" stroke={c} strokeWidth="2.6" />
      <path d="M116 106Q120 103 124 106M86 104L72 100M154 104L168 100" fill="none" stroke={c} strokeWidth="2.4" />
      <path d="M92 100l5-5M130 100l5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </g>
  ) },
  { id: "heartshades", slot: "face", name: "heart sunglasses", colors: [["#f27aa0", "#3b2a4a"], ["#c9b1ee", "#3b2a4a"], ["#2b2033", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      {[101, 139].map((x) => (
        <g key={x}>
          <path d={`M${x} 122C${x - 18} 112 ${x - 20} 100 ${x - 12} 96C${x - 6} 93 ${x - 2} 96 ${x} 100C${x + 2} 96 ${x + 6} 93 ${x + 12} 96C${x + 20} 100 ${x + 18} 112 ${x} 122Z`} fill={a} fillOpacity="0.85" stroke={c} strokeWidth="2.6" strokeLinejoin="round" />
          <path d={`M${x - 10} 102q3-3 6-2`} stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" fill="none" />
        </g>
      ))}
      <path d="M113 102Q120 98 127 102" fill="none" stroke={c} strokeWidth="2.6" />
    </g>
  ) },
  { id: "cheekstars", slot: "face", name: "cheek stickers", colors: [["#ffcf6b", "#f6a9c7"], ["#c9b1ee", "#ffcf6b"], ["#f6a9c7", "#a9dcc8"]], draw: ({ c, a }) => (
    <g>
      <path d="M0-5l1.5 3.2 3.5.4-2.6 2.4.7 3.5L0 2.8-3.1 4.5l.7-3.5L-5-1.4l3.5-.4Z" transform="translate(84 126) rotate(-12)" fill={c} {...thin} />
      <path d="M150 128c-3-2-4-4-3-5 1-1 2.4-.6 3 .6.6-1.2 2-1.6 3-.6 1 1 0 3-3 5Z" fill={a} {...thin} />
      <circle cx="158" cy="122" r="1.6" fill={c} />
    </g>
  ) },
];

// ---------------------------------------------------------------- at her neck
const NECK = [
  { id: "choker", slot: "neck", name: "heart choker", colors: [["#2b2033", "#f6a9c7"], ["#fffafd", "#e8577f"], ["#9a6cc8", "#fff1d9"]], draw: ({ c, a }) => <g><path d="M111.5 142Q120 147 128.5 142" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" /><path d="M111.5 142Q120 147 128.5 142" stroke={c} strokeWidth="3.6" strokeLinecap="round" fill="none" /><path d="M120 157c-6-4-7-8-4-10 2-1 3.4 0 4 1.6.6-1.6 2-2.6 4-1.6 3 2 2 6-4 10Z" fill={a} {...thin} /></g> },
  { id: "pearls", slot: "neck", name: "pearls", colors: [["#fffafd", "#e3d4ff"], ["#ffd1e3", "#fffafd"], ["#fff3b8", "#fffafd"]], draw: ({ c }) => <g>{[[107, 150], [109, 157], [113.5, 162], [120, 164], [126.5, 162], [131, 157], [133, 150]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r="3.2" fill={c} stroke={INK} strokeWidth="1" /><circle cx={x - 1} cy={y - 1} r="0.9" fill="#fff" /></g>)}</g> },
  { id: "bowtie", slot: "neck", name: "ribbon tie", colors: [["#e8577f", "#fffafd"], ["#9a6cc8", "#fffafd"], ["#2b2033", "#f6a9c7"], ["#4fc4c0", "#fffafd"]], draw: ({ c }) => <BowKnot x={120} y={152} c={c} s={0.85} /> },
  { id: "scarf", slot: "neck", name: "knit scarf", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#b7334f", "#f3dfae"], ["#a9dcc8", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M100 146Q120 160 140 146L142 156Q120 170 98 156Z" fill={c} {...ink} />
      <path d="M126 156L134 196H122L118 160Z" fill={c} {...ink} />
      {[164, 172, 180, 188].map((y) => <path key={y} d={`M${121 + (y - 160) * 0.08} ${y}H${133 - (196 - y) * 0.02}`} stroke={deep(c, 0.25)} strokeWidth="1.2" />)}
      <path d="M122 196l-1 5M126 196v6M130 196l1 5M134 196l2 5" stroke={a} strokeWidth="2" strokeLinecap="round" />
    </g>
  ) },
  { id: "moon", slot: "neck", name: "moon pendant", colors: [["#e8c27f", "#fff3b8"], ["#d8d4e6", "#c9b1ee"], ["#f6a9c7", "#fffafd"]], draw: ({ c, a }) => <g><path d="M108 146Q120 176 132 146" fill="none" stroke={c} strokeWidth="1.2" /><path d="M118 168a7 7 0 1 0 6 10a5.6 5.6 0 1 1-6-10Z" fill={a} stroke={INK} strokeWidth="1.2" /><circle cx="127" cy="168" r="1.4" fill={c} /></g> },
];

// ---------------------------------------------------------------- in her hand (the right hand, 154, 229)
const HAND = [
  { id: "heartbag", slot: "hand", name: "heart bag", colors: [["#e8577f", "#fffafd"], ["#f6a9c7", "#3b2a4a"], ["#c9b1ee", "#fffafd"], ["#2b2033", "#f6a9c7"]], draw: ({ c, a }) => <g><path d="M152 230C148 240 150 250 156 256M156 230C164 240 166 250 162 256" stroke={INK} strokeWidth="2" fill="none" /><path d="M159 280C140 268 134 254 146 248C152 245 157 248 159 253C161 248 166 245 172 248C184 254 178 268 159 280Z" fill={c} {...ink} /><circle cx="159" cy="258" r="2.4" fill={a} /><Shine d="M146 254q3-4 7-3" /></g> },
  { id: "bunny", slot: "hand", name: "bunny plush", colors: [["#fffafd", "#f6a9c7"], ["#e3d4ff", "#f6a9c7"], ["#fff1d9", "#e8577f"]], draw: ({ c, a }) => <g><ellipse cx="156" cy="212" rx="5" ry="14" fill={c} {...ink} transform="rotate(-14 156 212)" /><ellipse cx="170" cy="212" rx="5" ry="14" fill={c} {...ink} transform="rotate(14 170 212)" /><ellipse cx="163" cy="256" rx="15" ry="17" fill={c} {...ink} /><circle cx="163" cy="234" r="13" fill={c} {...ink} /><circle cx="158.5" cy="233" r="1.7" fill={INK} /><circle cx="167.5" cy="233" r="1.7" fill={INK} /><path d="M161 238q2 2 4 0" stroke={INK} strokeWidth="1.2" fill="none" /><ellipse cx="155" cy="238" rx="2.8" ry="1.6" fill={a} /><ellipse cx="171" cy="238" rx="2.8" ry="1.6" fill={a} /><circle cx="154" cy="229" r="6.4" fill="none" /></g> },
  { id: "wand", slot: "hand", name: "star wand", colors: [["#fff3b8", "#c9b1ee"], ["#f6a9c7", "#fffafd"], ["#a9dcc8", "#fff3b8"]], draw: ({ c, a }) => <g><path d="M154 234l10-52" stroke={INK} strokeWidth="5.6" strokeLinecap="round" /><path d="M154 234l10-52" stroke={a} strokeWidth="2.6" strokeLinecap="round" /><path d="M165 162l4.4 9.4 10.2 1.2-7.6 7 2 10-9-5-9 5 2-10-7.6-7 10.2-1.2Z" fill={c} {...ink} /><BowKnot x={163} y={186} c="#f6a9c7" s={0.45} /></g> },
  { id: "bouquet", slot: "hand", name: "little bouquet", colors: [["#f6a9c7", "#c9b1ee"], ["#fff3b8", "#f6a9c7"], ["#c9b1ee", "#fffafd"]], draw: ({ c, a }) => <g><path d="M154 232l-8-28M154 232l2-30M154 232l10-26" stroke="#6f9f62" strokeWidth="2.4" strokeLinecap="round" />{[[146, 202, c], [157, 194, a], [166, 204, c], [154, 208, a], [140, 210, a]].map(([x, y, fill]) => <g key={`${x}${y}`}>{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 3.6} rx="3" ry="4" transform={`rotate(${r} ${x} ${y})`} fill={fill} stroke={INK} strokeWidth="1" />)}<circle cx={x} cy={y} r="1.8" fill="#ffcf6b" /></g>)}<path d="M144 222l10 14 10-14-10-4Z" fill="#fffafd" {...thin} /></g> },
  { id: "parasol", slot: "hand", name: "lace parasol", colors: [["#fffafd", "#f6a9c7"], ["#2b2033", "#fffafd"], ["#ffd1e3", "#fffafd"], ["#e3d4ff", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M154 236L190 100" stroke="#8a5a44" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M150 238q2 8 8 4" fill="none" stroke="#8a5a44" strokeWidth="2.6" strokeLinecap="round" />
      <g transform="rotate(14 190 100)">
        <path d="M134 108C140 72 168 58 190 58S240 72 246 108Q232 100 218 108Q204 100 190 108Q176 100 162 108Q148 100 134 108Z" fill={c} {...ink} />
        <path d="M190 58L162 108M190 58V108M190 58L218 108" stroke={deep(c, 0.3)} strokeWidth="1.2" />
        {[134, 148, 162, 176, 190, 204, 218, 232].map((x) => <circle key={x} cx={x + 7} cy={107} r="3.6" fill={a} {...thin} strokeWidth="0.8" />)}
        <circle cx="190" cy="56" r="3" fill={a} {...thin} />
      </g>
    </g>
  ) },
  { id: "basket", slot: "hand", name: "herb basket", colors: [["#c99b6a", "#8cc47e"], ["#e6cdb0", "#c9a8f0"], ["#a8784e", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      <path d="M140 246C140 226 168 226 168 246" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M140 246C140 226 168 226 168 246" fill="none" stroke={c} strokeWidth="3" />
      <path d="M144 240C148 230 152 226 156 228C154 234 150 238 144 240ZM156 236C158 226 164 222 168 224C166 230 162 234 156 236ZM150 238L152 228" fill={a} {...thin} />
      <path d="M134 246H174L168 270H140Z" fill={c} {...ink} />
      <path d="M137 254H171M139 262H169M146 246L148 270M154 246V270M162 246L160 270" stroke={deep(c, 0.3)} strokeWidth="1.2" />
    </g>
  ) },
  { id: "mic", slot: "hand", name: "microphone", colors: [["#e3d4ff", "#3c4a56"], ["#f6a9c7", "#fffafd"], ["#4fc4c0", "#3c4a56"]], draw: ({ c, a }) => <g><path d="M153 232L164 204" stroke={a} strokeWidth="6" strokeLinecap="round" /><circle cx="166" cy="198" r="9" fill={c} {...ink} /><path d="M159 196h14M161 192h10M161 202h10" stroke={deep(c, 0.3)} strokeWidth="1" /><path d="M160 210h10" stroke={INK} strokeWidth="1" /><Shine d="M161 194q2-3 5-3" /></g> },
  { id: "mug", slot: "hand", name: "cocoa mug", colors: [["#fffafd", "#f6a9c7"], ["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"]], draw: ({ c, a }) => <g><path d="M146 216H168V238Q168 244 162 244H152Q146 244 146 238Z" fill={c} {...ink} /><path d="M168 222Q178 222 176 230Q174 236 168 236" fill="none" stroke={INK} strokeWidth="2" /><ellipse cx="157" cy="216" rx="11" ry="3" fill="#8a5a44" {...thin} /><circle cx="152" cy="214" r="2.6" fill="#fffafd" {...thin} /><circle cx="158" cy="213" r="2.4" fill="#ffd1e3" {...thin} /><path d="M157 230c-4-3-5-5-3-6.4 1.2-.8 2.4 0 3 1 .6-1 1.8-1.8 3-1 2 1.4 1 3.4-3 6.4Z" fill={a} /><path d="M152 206q-2-4 1-7M160 206q-2-4 1-7" stroke={INK} strokeOpacity="0.4" strokeWidth="1.2" fill="none" strokeLinecap="round" /></g> },
  { id: "fan", slot: "hand", name: "folding fan", colors: [["#fffafd", "#b7334f"], ["#f3e6ff", "#9a6cc8"], ["#fff1d9", "#2f3e66"]], draw: ({ c, a }) => (
    <g>
      <path d="M154 232L128 194A40 40 0 0 1 184 190Z" fill={c} {...ink} />
      {[-30, -18, -6, 6, 18].map((r) => <path key={r} d="M154 232L154 192" transform={`rotate(${r} 154 232)`} stroke={deep(c, 0.25)} strokeWidth="1" />)}
      <path d="M142 204q6-6 12 0q6-6 12 0" fill="none" stroke={a} strokeWidth="1.6" />
      <circle cx="154" cy="232" r="2.4" fill={a} />
      <path d="M154 234l-2 12M154 234l3 12" stroke={a} strokeWidth="1.4" />
    </g>
  ) },
  { id: "book", slot: "hand", name: "storybook", colors: [["#9a6cc8", "#fff1d9"], ["#e8577f", "#fffafd"], ["#6aa889", "#fff1d9"]], draw: ({ c, a }) => <g><path d="M140 216H168V248H140Z" fill={c} {...ink} transform="rotate(-8 154 232)" /><path d="M144 218V246" stroke={a} strokeWidth="3" transform="rotate(-8 154 232)" /><path d="M150 226h12M150 232h10" stroke={a} strokeWidth="1.6" transform="rotate(-8 154 232)" /><path d="M156 238c-3-2-4-3.6-2.4-4.6 1-.6 2 0 2.4.8.4-.8 1.4-1.4 2.4-.8 1.6 1 .6 2.6-2.4 4.6Z" fill="#f6a9c7" transform="rotate(-8 154 232)" /></g> },
];

// ---------------------------------------------------------------- on her back
const BACK = [
  { id: "wings", slot: "back", name: "angel wings", colors: [["#fffafd", "#e3d4ff"], ["#ffd1e3", "#fffafd"], ["#2b2033", "#9a6cc8"]], draw: ({ c, a }) => (
    <g>
      <path d="M104 172C78 128 38 122 22 136C34 140 38 148 36 156C46 156 50 162 50 170C60 170 66 178 64 188C80 186 92 186 104 178Z" fill={c} {...ink} />
      <path d="M136 172C162 128 202 122 218 136C206 140 202 148 204 156C194 156 190 162 190 170C180 170 174 178 176 188C160 186 148 186 136 178Z" fill={c} {...ink} />
      <path d="M44 150Q70 152 96 170M58 166Q78 168 98 176M196 150Q170 152 144 170M182 166Q162 168 142 176" stroke={a} strokeWidth="2.4" fill="none" />
    </g>
  ) },
  { id: "fairy", slot: "back", name: "fairy wings", colors: [["#d8f3ea", "#a9dcc8"], ["#e3d4ff", "#c9b1ee"], ["#ffd1e3", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      <path d="M108 172C80 112 34 112 34 138S70 178 108 172Zm0 6C80 182 52 204 62 222C72 238 98 220 108 178Z" fill={c} fillOpacity="0.85" {...ink} />
      <path d="M132 172C160 112 206 112 206 138S170 178 132 172Zm0 6C160 182 188 204 178 222C168 238 142 220 132 178Z" fill={c} fillOpacity="0.85" {...ink} />
      <path d="M52 136Q80 146 104 170M188 136Q160 146 136 170M72 214Q90 198 106 180M168 214Q150 198 134 180" stroke={a} strokeWidth="2" fill="none" />
      {[[56, 140], [184, 140], [76, 206], [164, 206]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#fff" />)}
    </g>
  ) },
  { id: "batwings", slot: "back", name: "bat wings", colors: [["#2b2033", "#9a6cc8"], ["#4a1f3a", "#f27aa0"], ["#c9b1ee", "#fffafd"]], draw: ({ c, a }) => (
    <g>
      <path d="M104 170C86 132 52 122 30 132C40 140 40 150 34 158C46 156 52 162 50 172C60 168 70 172 70 182C82 176 92 178 104 180Z" fill={c} {...ink} />
      <path d="M136 170C154 132 188 122 210 132C200 140 200 150 206 158C194 156 188 162 190 172C180 168 170 172 170 182C158 176 148 178 136 180Z" fill={c} {...ink} />
      <path d="M100 168L44 140M100 172L54 162M100 176L72 178M140 168L196 140M140 172L186 162M140 176L168 178" stroke={a} strokeWidth="1.4" />
    </g>
  ) },
  { id: "backbow", slot: "back", name: "big back bow", colors: [["#f6a9c7", "#e8577f"], ["#fffafd", "#c9b1ee"], ["#2b2033", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      <path d="M120 200C96 176 62 172 60 196C58 216 92 214 120 204ZM120 200C144 176 178 172 180 196C182 216 148 214 120 204Z" fill={c} {...ink} />
      <path d="M112 206C104 232 92 256 84 272L98 270L102 282C112 260 118 232 122 206ZM128 206C136 232 148 256 156 272L142 270L138 282C128 260 122 232 118 206Z" fill={deep(c, 0.1)} {...ink} />
      <path d="M70 186q10-8 24 0M146 186q14-8 24 0" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  ) },
  { id: "backpack", slot: "back", name: "bunny backpack", colors: [["#ffd1e3", "#fffafd"], ["#e3d4ff", "#f6a9c7"], ["#fff1d9", "#f6a9c7"]], draw: ({ c, a }) => (
    <g>
      <ellipse cx="94" cy="148" rx="6" ry="16" transform="rotate(-24 94 148)" fill={c} {...ink} />
      <ellipse cx="146" cy="148" rx="6" ry="16" transform="rotate(24 146 148)" fill={c} {...ink} />
      <ellipse cx="94" cy="149" rx="2.4" ry="10" transform="rotate(-24 94 149)" fill={a} />
      <ellipse cx="146" cy="149" rx="2.4" ry="10" transform="rotate(24 146 149)" fill={a} />
      <path d="M90 168C88 150 152 150 150 168L152 222Q120 232 88 222Z" fill={c} {...ink} />
    </g>
  ) },
];

export const ACCESSORIES = [...SOCKS, ...SHOES, ...HEAD, ...FACE, ...NECK, ...HAND, ...BACK];
export { light, mix };
