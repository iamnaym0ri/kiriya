import { BODY, INK, along, capsule, deep, light, mix } from "./body.jsx";
import { BowKnot, Buttons, Fabric, Folds, Hem, LaceEdge, Pleats, Sleeves, bodice, fillOf, ink, skirt, thin, trousers, usePid } from "./sew.jsx";

// Tops, bottoms, dresses and outerwear, drawn for this game to the doll's landmarks (body.jsx). Each
// item: { id, slot, name, colors: [[main, accent], …], pattern?, draw, sleeves? }. `draw` and
// `sleeves` are components ({ c, a }) so they can keep their own fabric pattern ids.

const SHADE_L = "M98.5 173C100.5 184 102.5 191 102.5 198L108 198C107 190 105.5 182 104 174Z";
const Shine = ({ d, w = 2.4, o = 0.45 }) => <path d={d} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth={w} strokeLinecap="round" />;

/** A top cut from bodice(): its fabric, a little shading, then its own details. */
function top({ id, name, colors, pattern, neck = "round", hem = 206, flare = 0, sleeves = null, cuff = true, details }) {
  return {
    id,
    slot: "top",
    name,
    colors,
    pattern,
    draw: function Top({ c, a }) {
      const pid = usePid();
      return (
        <g>
          {pattern && (
            <defs>
              <Fabric id={pid} kind={pattern} c={c} a={a} />
            </defs>
          )}
          <path d={bodice({ neck, hem, flare })} fill={fillOf(pattern, pid, c)} {...ink} />
          <path d={SHADE_L} fill={deep(c, 0.5)} opacity="0.14" />
          <Shine d={`M130 164Q134 172 134 ${hem - 12}`} />
          {details?.({ c, a })}
        </g>
      );
    },
    sleeves: sleeves
      ? function TopSleeves({ c, a }) {
          const pid = usePid();
          return <Sleeves kind={sleeves} c={c} a={a} pid={pid} pattern={pattern} cuff={cuff} />;
        }
      : null,
  };
}

/** A skirt with its hem trims; `under` draws a petticoat frill peeking out first. */
function skirtItem({ id, name, colors, pattern, bottom, wBot, wTop = 18.5, curve = 6, bulge, pleats, frill, lace, under, belt, details, slot = "bottom" }) {
  const shape = { top: 198, bottom, wTop, wBot, curve, bulge };
  return {
    id,
    slot,
    name,
    colors,
    pattern,
    draw: function Skirt({ c, a }) {
      const pid = usePid();
      return (
        <g>
          {pattern && (
            <defs>
              <Fabric id={pid} kind={pattern} c={c} a={a} />
            </defs>
          )}
          {under && <Hem bottom={bottom} wBot={wBot + 1} curve={curve} depth={7} n={14} c={under === "accent" ? a : "#fffafd"} lace under />}
          <path d={skirt(shape)} fill={fillOf(pattern, pid, c)} {...ink} />
          {pleats ? <Pleats {...shape} c={c} n={pleats} /> : <Folds {...shape} c={c} />}
          {frill && <Hem bottom={bottom} wBot={wBot} curve={curve} depth={frill} n={Math.round(wBot / 3.4)} c={frill > 0 && lace ? "#fffafd" : c} lace={lace} />}
          {belt !== false && <path d={`M${120 - wTop} 196H${120 + wTop}V203H${120 - wTop}Z`} fill={belt === "accent" ? a : deep(c, 0.12)} {...thin} />}
          {details?.({ c, a })}
        </g>
      );
    },
  };
}

/** A dress: a skirt, then a bodice over its waist seam, sleeves from the bodice. */
function dress({ id, name, colors, pattern, neck = "round", skirtShape, pleats, frill, lace, under, sleeves = null, cuff = true, waist = "accent", details, before }) {
  const shape = { top: 198, wTop: 18.5, curve: 6, ...skirtShape };
  return {
    id,
    slot: "dress",
    name,
    colors,
    pattern,
    draw: function Dress({ c, a }) {
      const pid = usePid();
      const fill = fillOf(pattern, pid, c);
      return (
        <g>
          {pattern && (
            <defs>
              <Fabric id={pid} kind={pattern} c={c} a={a} />
            </defs>
          )}
          {before?.({ c, a, fill })}
          {under && <Hem bottom={shape.bottom} wBot={shape.wBot + 1} curve={shape.curve} depth={7} n={Math.round(shape.wBot / 3)} c={under === "accent" ? a : "#fffafd"} lace under />}
          <path d={skirt(shape)} fill={fill} {...ink} />
          {pleats ? <Pleats {...shape} c={c} n={pleats} /> : <Folds {...shape} c={c} n={5} />}
          {frill && <Hem bottom={shape.bottom} wBot={shape.wBot} curve={shape.curve} depth={frill} n={Math.round(shape.wBot / 3.4)} c={lace ? "#fffafd" : c} lace={lace} />}
          <path d={bodice({ neck, hem: 202 })} fill={fill} {...ink} />
          <path d={SHADE_L} fill={deep(c, 0.5)} opacity="0.14" />
          <Shine d="M130 164Q134 172 133 190" />
          {waist && <path d="M102 195.5H138V202.5H102Z" fill={waist === "accent" ? a : deep(c, 0.12)} {...thin} />}
          {details?.({ c, a, fill })}
        </g>
      );
    },
    sleeves: sleeves
      ? function DressSleeves({ c, a }) {
          const pid = usePid();
          return <Sleeves kind={sleeves} c={c} a={a} pid={pid} pattern={pattern} cuff={cuff} />;
        }
      : null,
  };
}

const PeterPan = ({ c = "#fffafd" }) => (
  <g>
    <path d="M109 148Q103 156 107 163Q115 166 120 157Z" fill={c} {...thin} />
    <path d="M131 148Q137 156 133 163Q125 166 120 157Z" fill={c} {...thin} />
  </g>
);
const Lacing = ({ y0 = 166, y1 = 196, c }) => (
  <g>
    {Array.from({ length: 4 }, (_, i) => {
      const y = y0 + ((y1 - y0) / 4) * i;
      return <path key={i} d={`M115 ${y}L125 ${y + 6}M125 ${y}L115 ${y + 6}`} stroke={c} strokeWidth="1.4" strokeLinecap="round" />;
    })}
  </g>
);

// ---------------------------------------------------------------- tops
const TOPS = [
  top({ id: "blouse", name: "frill blouse", colors: [["#fffafd", "#f6a9c7"], ["#f3e6ff", "#9a6cc8"], ["#fff1d9", "#8fd6c0"], ["#ffe6ef", "#e8577f"]], neck: "crew", sleeves: "puff", details: ({ a }) => <g><PeterPan /><Buttons ys={[168, 180, 192]} c={a} /><LaceEdge x0={101} x1={139} y={206} c="#fffafd" r={2.4} /></g> }),
  top({ id: "sailor", name: "sailor top", colors: [["#fffafd", "#5b6fb8"], ["#fffafd", "#e8577f"], ["#f3e6ff", "#5d3f78"], ["#2f3e66", "#fffafd"]], neck: "v", sleeves: "short", details: ({ c, a }) => (
    <g>
      <path d="M109 148L96 156L100 178L120 172Z" fill={a} {...thin} />
      <path d="M131 148L144 156L140 178L120 172Z" fill={a} {...thin} />
      <path d="M99 160L103 176M141 160L137 176" stroke={c} strokeWidth="1.4" />
      <BowKnot x={120} y={174} c="#e8577f" s={0.8} />
    </g>
  ) }),
  top({ id: "sweater", name: "cosy knit", colors: [["#c9b1ee", "#fffafd"], ["#f6a9c7", "#fff1d9"], ["#a9dcc8", "#fffafd"], ["#fff1d9", "#d9a88f"], ["#8a5a44", "#f3dfae"]], neck: "crew", hem: 216, flare: 3, sleeves: "long", details: ({ c }) => (
    <g>
      <path d="M100 210Q120 214 140 210V218Q120 222 100 218Z" fill={deep(c, 0.08)} {...thin} />
      {[106, 112, 128, 134].map((x) => <path key={x} d={`M${x} 160Q${x + 3} 172 ${x} 184Q${x - 3} 196 ${x} 208`} fill="none" stroke={deep(c, 0.25)} strokeOpacity="0.5" strokeWidth="1.3" />)}
      <path d="M115 162c0-4 5-4 5 0 0-4 5-4 5 0 0 4-5 7-5 9 0-2-5-5-5-9Z" fill={light(c, 0.55)} {...thin} />
    </g>
  ) }),
  top({ id: "tee", name: "heart tee", colors: [["#fff1d9", "#e8577f"], ["#3b2a4a", "#f6a9c7"], ["#e3d4ff", "#fffafd"], ["#d8f3ea", "#7b8fd6"]], neck: "crew", hem: 210, flare: 1, sleeves: "short", details: ({ a }) => <path d="M120 194C110 186 106 179 111 175C114 173 118 174 120 178C122 174 126 173 129 175C134 179 130 186 120 194Z" fill={a} {...thin} /> }),
  top({ id: "cami", name: "lace cami", colors: [["#fffafd", "#f6a9c7"], ["#3b2a4a", "#c9b1ee"], ["#ffd1e3", "#fffafd"], ["#d9c4f5", "#fffafd"]], neck: "square", hem: 208, flare: 2, details: ({ c }) => (
    <g>
      <path d="M104 150V161M136 150V161" stroke={INK} strokeWidth="1.6" />
      <LaceEdge x0={109} x1={131} y={161} c={light(c, 0.4)} r={2.2} />
      <BowKnot x={120} y={164} c="#f6a9c7" s={0.45} />
    </g>
  ) }),
  top({ id: "offshoulder", name: "off-shoulder", colors: [["#fffafd", "#c9b1ee"], ["#ffe1ea", "#f6a9c7"], ["#e8f4ff", "#8fb3e8"]], pattern: null, neck: "off", hem: 206, sleeves: "offpuff", details: ({ c }) => <Hem bottom={163} wBot={26} curve={3} depth={4} n={12} c={c} /> }),
  top({ id: "turtleneck", name: "turtleneck", colors: [["#3b2a4a", "#3b2a4a"], ["#fff1d9", "#fff1d9"], ["#c9b1ee", "#c9b1ee"], ["#8a5a44", "#8a5a44"]], neck: "crew", hem: 208, sleeves: "long", cuff: false, details: ({ c }) => <path d="M110 138H130V152Q120 156 110 152Z" fill={c} {...thin} /> }),
  top({ id: "breton", name: "striped tee", colors: [["#fffafd", "#2f3e66"], ["#fffafd", "#e8577f"], ["#fffafd", "#9a6cc8"]], pattern: "stripes", neck: "crew", hem: 210, flare: 1, sleeves: "elbow", cuff: false }),
  top({ id: "corset", name: "corset blouse", colors: [["#3b2a4a", "#fffafd"], ["#f6a9c7", "#fffafd"], ["#7b2d5b", "#fff1d9"]], neck: "sweetheart", hem: 204, sleeves: "puff", details: ({ c, a }) => (
    <g>
      <path d="M109 148Q114 158 120 160Q126 158 131 148" fill={a} {...thin} />
      <path d="M104 172C110 170 130 170 136 172L137 202H103Z" fill={c} {...thin} />
      <Lacing y0={172} y1={198} c={a} />
    </g>
  ) }),
  top({ id: "jabot", name: "ruffle blouse", colors: [["#fffafd", "#c9b1ee"], ["#f3e6ff", "#5d3f78"], ["#fff1d9", "#b7334f"]], neck: "crew", sleeves: "bell", details: ({ c, a }) => (
    <g>
      {[154, 162, 170, 178].map((y, i) => <path key={y} d={`M${112 + i} ${y}Q120 ${y + 8} ${128 - i} ${y}Q124 ${y + 4} 120 ${y + 2}Q116 ${y + 4} ${112 + i} ${y}Z`} fill={light(c, 0.3)} {...thin} />)}
      <circle cx="120" cy="152" r="2.6" fill={a} {...thin} />
    </g>
  ) }),
  top({ id: "gingham", name: "gingham top", colors: [["#fffafd", "#f59ab9"], ["#fffafd", "#9a6cc8"], ["#fffafd", "#6aa889"], ["#fffafd", "#5b6fb8"]], pattern: "gingham", neck: "square", hem: 204, sleeves: "puff", details: () => <BowKnot x={120} y={163} c="#fffafd" s={0.55} /> }),
  top({ id: "bowtop", name: "ribbon top", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#5d3f78"], ["#fff1d9", "#e8577f"]], neck: "round", hem: 204, sleeves: "cap", details: ({ a }) => <BowKnot x={120} y={170} c={a} s={1.1} /> }),
  top({ id: "pjtop", name: "pyjama top", colors: [["#e3d4ff", "#fffafd"], ["#ffd1e3", "#fffafd"], ["#d8f3ea", "#fffafd"]], pattern: "cloud", neck: "v", hem: 214, flare: 3, sleeves: "long", details: ({ a }) => (
    <g>
      <path d="M109 148L102 158L114 166L120 172Z" fill={a} {...thin} />
      <path d="M131 148L138 158L126 166L120 172Z" fill={a} {...thin} />
      <Buttons ys={[182, 194, 206]} c={a} r={2.2} />
    </g>
  ) }),
];

// ---------------------------------------------------------------- bottoms
const BOTTOMS = [
  skirtItem({ id: "pleats", name: "pleated mini", colors: [["#9a6cc8", "#fffafd"], ["#3b2a4a", "#f6a9c7"], ["#e8577f", "#fff1d9"], ["#5b6fb8", "#fffafd"], ["#fffafd", "#c9b1ee"]], bottom: 248, wBot: 34, pleats: 9 }),
  skirtItem({ id: "plaid", name: "plaid skirt", colors: [["#b7334f", "#2f3e66"], ["#c9b1ee", "#5d3f78"], ["#e6cdb0", "#8a5a44"], ["#2f3e66", "#e8577f"]], pattern: "plaid", bottom: 250, wBot: 34, pleats: 9, belt: "accent" }),
  skirtItem({ id: "tiers", name: "frill skirt", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#f6a9c7"]], bottom: 246, wBot: 32, frill: 10, details: ({ c }) => <Hem bottom={226} wBot={28} curve={5} depth={7} n={12} c={c} /> }),
  skirtItem({ id: "aline", name: "button midi", colors: [["#8a5a44", "#f3dfae"], ["#c9b1ee", "#fffafd"], ["#5b6fb8", "#fff1d9"], ["#f3dfae", "#8a5a44"]], bottom: 292, wBot: 38, details: ({ a }) => <Buttons ys={[212, 228, 244, 260, 276]} c={a} r={2.2} /> }),
  skirtItem({ id: "maxi", name: "flower maxi", colors: [["#fffafd", "#f59ab9"], ["#e9dcff", "#9a6cc8"], ["#fff1d9", "#e8577f"], ["#3b2a4a", "#f6a9c7"]], pattern: "floral", bottom: 330, wBot: 44, frill: 8 }),
  skirtItem({ id: "bubble", name: "bubble skirt", colors: [["#ffd1e3", "#e8577f"], ["#e3d4ff", "#9a6cc8"], ["#fffafd", "#f6a9c7"]], bottom: 240, wBot: 30, bulge: 1.2, curve: 2, details: ({ a }) => <g><path d="M92 236Q120 248 148 236" fill="none" stroke={deep(a, 0)} strokeWidth="2" /><BowKnot x={136} y={200} c={a} s={0.6} /></g> }),
  skirtItem({ id: "tulle", name: "tulle skirt", colors: [["#ffd1e3", "#ffe8f1"], ["#e3d4ff", "#f3ebff"], ["#d8f3ea", "#effaf6"], ["#3b2a4a", "#6b5a7a"]], bottom: 262, wBot: 40, under: "accent", details: ({ a }) => <g opacity="0.6">{[106, 120, 134].map((x) => <circle key={x} cx={x} cy={230 + (x % 3) * 8} r="1.6" fill="#fff" />)}<path d="M96 212Q120 220 144 212" fill="none" stroke={a} strokeWidth="2" /></g> }),
  skirtItem({ id: "lacemidi", name: "lace midi", colors: [["#fffafd", "#f6e8f0"], ["#3b2a4a", "#6b5a7a"], ["#f6c1d8", "#fff0f5"]], bottom: 282, wBot: 36, frill: 8, lace: true }),
  {
    id: "jeans",
    slot: "bottom",
    name: "soft jeans",
    colors: [["#8fb3e8", "#fffafd"], ["#5b6fb8", "#f3dfae"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#d9a88f"]],
    draw: function Jeans({ c, a }) {
      return (
        <g>
          <path d={trousers({ hem: 328, wide: 1 })} fill={c} {...ink} />
          <path d="M120 206V236M102 204H138" stroke={deep(c, 0.35)} strokeWidth="1.2" />
          <path d="M104 212Q109 218 114 212M126 212Q131 218 136 212" fill="none" stroke={a} strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M101 320H118M122 320H139" stroke={a} strokeWidth="3" />
          <path d="M106 250Q108 280 108 314M134 250Q132 280 132 314" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      );
    },
  },
  {
    id: "wideleg",
    slot: "bottom",
    name: "wide trousers",
    colors: [["#fff1d9", "#8a5a44"], ["#3b2a4a", "#c9b1ee"], ["#c9b1ee", "#5d3f78"], ["#d8f3ea", "#3f8a78"]],
    draw: function Wide({ c, a }) {
      return (
        <g>
          <path d={trousers({ hem: 332, wide: 7 })} fill={c} {...ink} />
          <path d="M108 216L104 330M132 216L136 330" stroke={deep(c, 0.3)} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M101 196H139V204H101Z" fill={a} {...thin} />
        </g>
      );
    },
  },
  {
    id: "shorts",
    slot: "bottom",
    name: "frill shorts",
    colors: [["#8fb3e8", "#fffafd"], ["#f6a9c7", "#fffafd"], ["#fff1d9", "#c9b1ee"], ["#3b2a4a", "#f6a9c7"]],
    draw: function Shorts({ c, a }) {
      return (
        <g>
          <path d={trousers({ hem: 246, wide: 3 })} fill={c} {...ink} />
          <LaceEdge x0={96} x1={118} y={246} c={a} r={2.6} />
          <LaceEdge x0={122} x1={144} y={246} c={a} r={2.6} />
          <path d="M101 196H139V203H101Z" fill={deep(c, 0.12)} {...thin} />
          <BowKnot x={128} y={200} c={a} s={0.5} />
        </g>
      );
    },
  },
  {
    id: "pjpants",
    slot: "bottom",
    name: "pyjama pants",
    colors: [["#e3d4ff", "#fffafd"], ["#ffd1e3", "#fffafd"], ["#d8f3ea", "#fffafd"]],
    pattern: "cloud",
    draw: function Pj({ c, a }) {
      const pid = usePid();
      return (
        <g>
          <defs>
            <Fabric id={pid} kind="cloud" c={c} a={a} />
          </defs>
          <path d={trousers({ hem: 326, wide: 3 })} fill={`url(#${pid})`} {...ink} />
          <path d="M99 318H119M121 318H141" stroke={a} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    },
  },
];

// ---------------------------------------------------------------- dresses
const Sash = ({ a, tails = true }) => (
  <g>
    <path d="M101 192H139V206H101Z" fill={a} {...thin} />
    {tails && <path d="M128 204C132 222 128 240 134 256L140 252C136 238 140 222 134 204ZM122 204C124 222 120 244 124 262L130 260C128 244 130 222 128 204Z" fill={a} {...thin} />}
  </g>
);
const CrossCollar = ({ inner = "#fffafd", trim }) => (
  <g>
    <path d="M109 148L120 178L131 148" fill="none" stroke={inner} strokeWidth="6" strokeLinejoin="round" />
    <path d="M109 148L120 178L131 148" fill="none" stroke={trim} strokeWidth="3" strokeLinejoin="round" transform="translate(0 3)" />
    <path d="M131 148L114 194" stroke={INK} strokeWidth="1.2" opacity="0.5" />
  </g>
);
const DRESSES = [
  dress({ id: "frilldress", name: "babydoll dress", colors: [["#3b2a4a", "#f6a9c7"], ["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fffafd", "#e8577f"]], neck: "square", sleeves: "puff", skirtShape: { bottom: 256, wBot: 40 }, frill: 9, details: ({ a }) => <BowKnot x={120} y={163} c={a} s={0.7} /> }),
  dress({ id: "sundress", name: "flower sundress", colors: [["#fff1d9", "#f59ab9"], ["#e9dcff", "#9a6cc8"], ["#e6f6ff", "#5b6fb8"], ["#ffe1ea", "#e8577f"]], pattern: "floral", neck: "sweetheart", skirtShape: { bottom: 292, wBot: 44 }, waist: "accent", details: () => <path d="M104 160L100 150M136 160L140 150" stroke={INK} strokeWidth="2.2" strokeLinecap="round" /> }),
  dress({ id: "lolita", name: "sweet lolita", colors: [["#ffd1e3", "#fffafd"], ["#e3d4ff", "#fffafd"], ["#fff1d9", "#f6a9c7"], ["#d8f3ea", "#fffafd"]], neck: "square", sleeves: "puff", skirtShape: { bottom: 272, wBot: 52, bulge: 0.7 }, under: "white", frill: 10, lace: true, details: ({ c, a }) => (
    <g>
      <Hem bottom={244} wBot={48} curve={6} depth={8} n={14} c={c} />
      <LaceEdge x0={110} x1={130} y={161} c={a} r={2} />
      <Lacing y0={168} y1={194} c={deep(c, 0.4)} />
      <BowKnot x={120} y={200} c={deep(c, 0.15)} s={0.9} />
      <BowKnot x={86} y={252} c={a} s={0.5} turn={-10} />
      <BowKnot x={154} y={252} c={a} s={0.5} turn={10} />
    </g>
  ) }),
  dress({ id: "gothic", name: "gothic lolita", colors: [["#2b2033", "#fffafd"], ["#4a1f3a", "#e8c3d6"], ["#1f2b44", "#d8d4e6"]], neck: "crew", sleeves: "bell", skirtShape: { bottom: 276, wBot: 50, bulge: 0.7 }, under: "accent", frill: 10, details: ({ c, a }) => (
    <g>
      <Hem bottom={246} wBot={46} curve={6} depth={8} n={14} c={a} lace />
      <path d="M110 140H130V152Q120 157 110 152Z" fill={a} {...thin} />
      <LaceEdge x0={106} x1={134} y={152} c={a} r={2.4} />
      <Lacing y0={166} y1={194} c={a} />
      <path d="M120 206C116 202 113 199 115 197C116 196 118 196.5 120 198.5C122 196.5 124 196 125 197C127 199 124 202 120 206Z" fill="#b7334f" {...thin} />
      <path d={`M100 200C110 204 130 204 140 200`} stroke={light(c, 0.2)} strokeWidth="2" fill="none" />
    </g>
  ) }),
  dress({ id: "tutu", name: "ballet tutu", colors: [["#ffd1e3", "#fffafd"], ["#e3d4ff", "#fffafd"], ["#d8f3ea", "#fffafd"], ["#fffafd", "#ffd1e3"]], neck: "sweetheart", skirtShape: { bottom: 214, wBot: 20 }, waist: false, before: ({ c, a }) => (
    <g>
      {[[62, 228, 0.5], [60, 222, 1], [56, 216, 0.75]].map(([r, y, o], i) => (
        <path key={i} d={`M${120 - r} ${y}C${120 - r * 0.6} ${y - 18} ${120 + r * 0.6} ${y - 18} ${120 + r} ${y}Q${120 + r * 0.5} ${y + 14} 120 ${y + 8}Q${120 - r * 0.5} ${y + 14} ${120 - r} ${y}Z`} fill={i === 1 ? c : a} fillOpacity={o} {...thin} />
      ))}
    </g>
  ), details: ({ c }) => <g><path d="M68 222C84 214 156 214 172 222" fill="none" stroke={light(c, 0.6)} strokeWidth="2" />{[80, 100, 140, 160].map((x) => <circle key={x} cx={x} cy={220} r="1.4" fill="#fff" />)}<path d="M104 160L100 150M136 160L140 150" stroke={INK} strokeWidth="1.6" /></g> }),
  dress({ id: "gown", name: "princess gown", colors: [["#e3d4ff", "#ffd1e3"], ["#ffd1e3", "#fff1d9"], ["#fff1d9", "#c9b1ee"], ["#cfe6ff", "#fffafd"]], neck: "off", sleeves: "offpuff", skirtShape: { bottom: 340, wBot: 76, bulge: 0.8, curve: 8 }, frill: 10, details: ({ c, a }) => (
    <g>
      <Hem bottom={300} wBot={68} curve={8} depth={9} n={16} c={a} />
      <path d="M70 280Q120 296 170 280" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
      {[[96, 250], [148, 262], [120, 314], [84, 318], [158, 320]].map(([x, y]) => <path key={x} d={`M${x} ${y - 4}l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z`} fill="#fff" />)}
      <BowKnot x={120} y={200} c={a} s={0.8} />
    </g>
  ) }),
  dress({ id: "pinafore", name: "pinafore", colors: [["#fffafd", "#f59ab9"], ["#fffafd", "#9a6cc8"], ["#fffafd", "#6aa889"]], pattern: "gingham", neck: "square", sleeves: "puff", skirtShape: { bottom: 262, wBot: 40 }, frill: 8, details: ({ a }) => <g><PeterPan /><path d="M107 160V198M133 160V198" stroke={deep(a, 0.2)} strokeWidth="3" /><path d="M110 232H122V246H110Z" fill="#fffafd" {...thin} /></g> }),
  dress({ id: "apron", name: "café apron dress", colors: [["#3b2a4a", "#fffafd"], ["#f6a9c7", "#fffafd"], ["#5b6fb8", "#fffafd"], ["#c9b1ee", "#fffafd"]], neck: "crew", sleeves: "puff", skirtShape: { bottom: 262, wBot: 42 }, frill: 8, details: ({ a }) => (
    <g>
      <path d="M108 168H132L134 198H106Z" fill={a} {...thin} />
      <path d="M98 202H142L150 252Q120 262 90 252Z" fill={a} {...thin} />
      <Hem bottom={252} wBot={30} curve={5} depth={6} n={12} c={a} lace />
      <LaceEdge x0={108} x1={132} y={168} c={a} r={2} down={false} />
      <PeterPan />
      <BowKnot x={120} y={152} c="#e8577f" s={0.5} />
    </g>
  ) }),
  dress({ id: "idol", name: "stage dress", colors: [["#3c4a56", "#4fc4c0"], ["#f6a9c7", "#5d3f78"], ["#fffafd", "#9a6cc8"], ["#2b2033", "#f27aa0"]], neck: "v", sleeves: null, skirtShape: { bottom: 246, wBot: 38 }, pleats: 10, under: "accent", waist: "accent", details: ({ c, a }) => (
    <g>
      <path d="M109 148L98 158L106 166L120 172ZM131 148L142 158L134 166L120 172Z" fill={light(c, 0.25)} {...thin} />
      <path d="M117 170L123 170L126 194L120 200L114 194Z" fill={a} {...thin} />
      <path d="M98 236Q120 246 142 236" fill="none" stroke={a} strokeWidth="2.4" />
    </g>
  ) }),
  dress({ id: "herbalist", name: "herbalist robe", colors: [["#a9c9a4", "#6b7f5a"], ["#c9d8b8", "#8a6a4a"], ["#b8c8d8", "#5a6a7a"], ["#d9c4e8", "#7b5a8a"]], neck: "cross", sleeves: "wide", skirtShape: { bottom: 334, wBot: 40, bulge: 0.2 }, waist: false, before: ({ a }) => <path d={skirt({ top: 198, bottom: 336, wTop: 19, wBot: 42, bulge: 0.2 })} fill={a} {...ink} />, details: ({ c, a }) => (
    <g>
      <path d="M120 200L124 334" stroke={deep(c, 0.35)} strokeOpacity="0.5" strokeWidth="1.3" />
      <CrossCollar trim={a} />
      <Sash a={deep(a, 0.1)} />
      <path d="M90 320Q120 330 150 320" fill="none" stroke={a} strokeWidth="3" />
      <path d="M108 216q4-6 8 0q-4 4-8 0ZM112 214v-6" fill="#8cc47e" {...thin} />
    </g>
  ) }),
  dress({ id: "court", name: "court robe", colors: [["#7b2d5b", "#e8c27f"], ["#2f3e66", "#e8c27f"], ["#f3e6ff", "#b38ad9"], ["#b7334f", "#f3dfae"]], neck: "cross", sleeves: "wide", skirtShape: { bottom: 340, wBot: 52, bulge: 0.4, curve: 7 }, waist: false, pattern: null, before: ({ c, a }) => (
    <g>
      <path d={skirt({ top: 198, bottom: 344, wTop: 19, wBot: 58, bulge: 0.45, curve: 7 })} fill={light(c, 0.6)} {...ink} />
      <Hem bottom={344} wBot={58} curve={7} depth={5} n={16} c={a} />
    </g>
  ), details: ({ c, a }) => (
    <g>
      {[[96, 300], [140, 310], [118, 270], [80, 330], [160, 332]].map(([x, y]) => <path key={x} d={`M${x - 6} ${y}q0-5 5-5q1-4 6-2q4 0 4 4q3 1 2 4H${x - 5}Z`} fill={light(a, 0.3)} opacity="0.8" />)}
      <path d="M70 330Q120 346 170 330" fill="none" stroke={a} strokeWidth="3.4" />
      <CrossCollar inner={light(c, 0.6)} trim={a} />
      <Sash a={a} />
      <path d="M126 206V236" stroke={INK} strokeWidth="1" />
      <circle cx="126" cy="240" r="4.4" fill="#a9dcc8" {...thin} />
      <path d="M124 244L122 262M126 244V264M128 244L130 262" stroke={deep(a, 0.2)} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ) }),
];

// ---------------------------------------------------------------- outerwear
/** An open-front jacket: two panels from the shoulders to `hem`, meeting at `gap` from the centre. */
function panels(hem, gap = 4, flare = 2) {
  const l = `M109 148Q100 150 95.5 156C95 162 97 168 98.5 173C100 186 ${101 - flare} 200 ${100 - flare} ${hem}Q${110 - gap} ${hem + 3} ${120 - gap} ${hem}L${120 - gap} 176L109 148Z`;
  const r = l.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(240 - Number(x)).toFixed(1)} ${y}`);
  return [l, r];
}
function outer({ id, name, colors, pattern, hem = 214, gap = 4, sleeves = "long", cuff = true, flare = 2, details, under }) {
  return {
    id,
    slot: "outer",
    name,
    colors,
    pattern,
    draw: function Outer({ c, a }) {
      const pid = usePid();
      const [l, r] = panels(hem, gap, flare);
      return (
        <g>
          {pattern && (
            <defs>
              <Fabric id={pid} kind={pattern} c={c} a={a} />
            </defs>
          )}
          {under?.({ c, a })}
          <path d={l} fill={fillOf(pattern, pid, c)} {...ink} />
          <path d={r} fill={fillOf(pattern, pid, c)} {...ink} />
          <path d={SHADE_L} fill={deep(c, 0.5)} opacity="0.16" />
          {details?.({ c, a })}
        </g>
      );
    },
    sleeves: sleeves
      ? function OuterSleeves({ c, a }) {
          const pid = usePid();
          return <Sleeves kind={sleeves} c={c} a={a} pid={pid} pattern={pattern} cuff={cuff} />;
        }
      : null,
  };
}
const OUTER = [
  outer({ id: "cardigan", name: "cardigan", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#d9a88f"], ["#a9dcc8", "#fffafd"], ["#3b2a4a", "#f6a9c7"]], hem: 212, details: ({ c, a }) => (
    <g>
      <Buttons x={113} ys={[182, 194, 206]} c={a} r={2.2} />
      <path d="M100 206Q108 209 116 207V213Q108 215 100 212ZM140 206Q132 209 124 207V213Q132 215 140 212Z" fill={deep(c, 0.08)} {...thin} />
      <path d="M116 176L109 148M124 176L131 148" stroke={deep(c, 0.25)} strokeWidth="2.6" />
    </g>
  ) }),
  outer({ id: "denim", name: "denim jacket", colors: [["#8fb3e8", "#f3dfae"], ["#5b6fb8", "#f3dfae"], ["#fffafd", "#c9b1ee"], ["#f6c1d8", "#fffafd"]], hem: 204, gap: 2, details: ({ c, a }) => (
    <g>
      <path d="M109 148L102 162L112 168L116 160ZM131 148L138 162L128 168L124 160Z" fill={light(c, 0.15)} {...thin} />
      <path d="M103 176H114V186H103ZM126 176H137V186H126Z" fill="none" stroke={deep(c, 0.3)} strokeWidth="1.2" />
      <path d="M103 176l5.5 4 5.5-4M126 176l5.5 4 5.5-4" fill="none" stroke={a} strokeWidth="1" strokeDasharray="1.6 1.6" />
      <Buttons x={115} ys={[170, 186]} c={a} r={1.6} />
    </g>
  ) }),
  outer({ id: "hoodie", name: "bunny hoodie", colors: [["#e3d4ff", "#f6a9c7"], ["#ffd1e3", "#fffafd"], ["#fff1d9", "#f6a9c7"], ["#3b2a4a", "#c9b1ee"]], hem: 218, gap: -2, flare: 4, under: ({ c }) => <path d="M96 150C100 136 140 136 144 150C136 146 104 146 96 150Z" fill={deep(c, 0.12)} {...ink} />, details: ({ c, a }) => (
    <g>
      <path d="M106 198H134L138 214H102Z" fill={deep(c, 0.06)} {...thin} />
      <path d="M114 152V170M126 152V170" stroke={a} strokeWidth="1.6" />
      <circle cx="114" cy="172" r="1.8" fill={a} />
      <circle cx="126" cy="172" r="1.8" fill={a} />
    </g>
  ) }),
  outer({ id: "trench", name: "trench coat", colors: [["#e6cdb0", "#8a5a44"], ["#c9b1ee", "#5d3f78"], ["#fff1d9", "#8a5a44"], ["#3b2a4a", "#c9b1ee"]], hem: 276, gap: 2, flare: 8, details: ({ c, a }) => (
    <g>
      <path d="M109 148L100 166L114 174L118 160ZM131 148L140 166L126 174L122 160Z" fill={light(c, 0.15)} {...thin} />
      <path d="M100 196H140V204H100Z" fill={a} {...thin} />
      <path d="M118 196H124V204H118Z" fill="none" stroke="#e8c27f" strokeWidth="1.4" />
      <Buttons x={113} ys={[184, 216, 232]} c={a} r={2} />
      <Buttons x={127} ys={[184, 216, 232]} c={a} r={2} />
    </g>
  ) }),
  outer({ id: "haori", name: "starry haori", colors: [["#3b2a4a", "#f3dfae"], ["#c9b1ee", "#fffafd"], ["#f6a9c7", "#fffafd"], ["#2f3e66", "#f6a9c7"]], pattern: "stars", hem: 262, gap: 6, flare: 6, sleeves: "wide", details: ({ a }) => <path d="M109 148L114 262M131 148L126 262" stroke={a} strokeWidth="4" /> }),
  outer({ id: "bolero", name: "lace bolero", colors: [["#fffafd", "#f6e8f0"], ["#3b2a4a", "#6b5a7a"], ["#ffd1e3", "#fff0f5"]], hem: 180, gap: 8, flare: 0, sleeves: "puff", details: ({ c }) => <g><LaceEdge x0={99} x1={113} y={180} c={c} r={2.2} /><LaceEdge x0={127} x1={141} y={180} c={c} r={2.2} /><BowKnot x={120} y={160} c="#f6a9c7" s={0.5} /></g> }),
  {
    id: "capelet",
    slot: "outer",
    name: "capelet",
    colors: [["#c9b1ee", "#fffafd"], ["#b7334f", "#fffafd"], ["#3b2a4a", "#e8c3d6"], ["#fff1d9", "#f6a9c7"]],
    draw: () => null,
    sleeves: function Cape({ c, a }) {
      return (
        <g>
          <path d="M108 146Q92 150 84 170C78 186 76 196 80 200Q120 212 160 200C164 196 162 186 156 170Q148 150 132 146Q120 152 108 146Z" fill={c} {...ink} />
          <path d="M84 196Q120 208 156 196" fill="none" stroke={a} strokeWidth="2.6" />
          <path d="M94 176Q92 188 94 198M146 176Q148 188 146 198" stroke={deep(c, 0.3)} strokeOpacity="0.4" strokeWidth="1.4" fill="none" />
          <BowKnot x={120} y={154} c={a} s={0.8} />
        </g>
      );
    },
  },
];

// The stage dress has detached sleeves: drawn over her arms, from just above the elbow.
DRESSES.find((item) => item.id === "idol").sleeves = function IdolSleeves({ c, a }) {
  return (
    <g>
      {["left", "right"].map((side) => (
        <g key={side}>
          <path d={capsule(along(side, 0.4), along(side, 1.02), 8, 8.6)} fill={c} {...ink} />
          <path d={capsule(along(side, 0.4), along(side, 0.5), 8.6, 8.6)} fill={a} {...thin} />
          <path d={capsule(along(side, 0.94), along(side, 1.02), 9, 9)} fill={a} {...thin} />
        </g>
      ))}
    </g>
  );
};

export const CLOTHES = [...TOPS, ...BOTTOMS, ...DRESSES, ...OUTER];
export { light, mix, deep, BODY };
