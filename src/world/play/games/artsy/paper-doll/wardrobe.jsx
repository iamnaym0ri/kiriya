// The paper doll and everything she can wear, drawn for this game (doll space: 240 × 400, feet at
// the bottom). Each item draws itself in doll space with its colour `c` and accent `a`; `thumb` is
// the part of doll space its drawer tile shows. Original designs in the site's soft lilac style.
export const INK = "#4f3a5e";
const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" };

export const SKINS = ["#ffe6d4", "#f6d2b8", "#e0b08c", "#a8775a"];
export const EYES = ["#5d3f78", "#3f5f8a", "#6b4a3a", "#3f7a6a"];
export const HAIR_COLOURS = ["#3b2a4a", "#8a5a44", "#e8c27f", "#f3a6c4", "#b79be0", "#8fd6c0", "#ece6f4"];

// ---------------------------------------------------------------- the doll
export const ARMS = { left: { from: [94, 150], to: [79, 224], hand: [77, 231] }, right: { from: [146, 150], to: [161, 224], hand: [163, 231] } };

export function DollBody({ skin }) {
  return (
    <g>
      <path d="M106 222c-1 40-3 78-4 112M134 222c1 40 3 78 4 112" stroke={INK} strokeWidth="19.5" strokeLinecap="round" fill="none" />
      <path d="M106 222c-1 40-3 78-4 112M134 222c1 40 3 78 4 112" stroke={skin} strokeWidth="15" strokeLinecap="round" fill="none" />
      <ellipse cx="101" cy="340" rx="11" ry="6.5" fill={skin} {...ink} />
      <ellipse cx="139" cy="340" rx="11" ry="6.5" fill={skin} {...ink} />
      <path d="M90 154q0-9 10-10h40q10 1 10 10l-8 44q6 12 4 26H94q-2-14 4-26Z" fill={skin} {...ink} />
      <rect x="112" y="122" width="16" height="26" rx="6" fill={skin} {...ink} />
    </g>
  );
}

export function DollArms({ skin }) {
  return (
    <g>
      {Object.values(ARMS).map(({ from, to, hand }, i) => (
        <g key={i}>
          <path d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}`} stroke={INK} strokeWidth="16" strokeLinecap="round" />
          <path d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}`} stroke={skin} strokeWidth="11.6" strokeLinecap="round" />
          <circle cx={hand[0]} cy={hand[1]} r="8" fill={skin} {...ink} />
        </g>
      ))}
    </g>
  );
}

export function DollHead({ skin, eyes }) {
  return (
    <g>
      <ellipse cx="120" cy="90" rx="44" ry="41" fill={skin} {...ink} />
      <ellipse cx="77" cy="96" rx="6" ry="9" fill={skin} {...ink} />
      <ellipse cx="163" cy="96" rx="6" ry="9" fill={skin} {...ink} />
      {[103, 137].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="99" rx="7.5" ry="10" fill={eyes} stroke={INK} strokeWidth="1.6" />
          <circle cx={x + 2.5} cy="95" r="3" fill="#fff" />
          <circle cx={x - 2.5} cy="103" r="1.4" fill="#fff" opacity="0.8" />
          <path d={`M${x - 9} 88q9-6 18 0`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx="94" cy="113" rx="8" ry="4.5" fill="#ffadc8" opacity="0.75" />
      <ellipse cx="146" cy="113" rx="8" ry="4.5" fill="#ffadc8" opacity="0.75" />
      <path d="M114 115q6 6 12 0" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** What she wears when nothing else is on: a lilac slip. */
export function DollSlip() {
  return (
    <g>
      <path d="M98 160h44l-2 40q5 10 5 24l-4 14h-16l-5-12-5 12H99l-4-14q0-14 5-24Z" fill="#e3d4ff" {...ink} />
      <path d="M104 150v12M136 150v12" stroke={INK} strokeWidth="1.8" />
    </g>
  );
}

// ---------------------------------------------------------------- hair
const bangs = (c) => (
  <path d="M77 96C70 56 96 42 120 42s50 14 43 54c-4-10-8-16-12-18 0 6-2 10-6 12-2-8-8-14-12-16-2 8-8 12-14 12 2-6 0-10-2-12-6 8-14 12-24 12 2-6 2-10 2-14-6 6-12 14-19 26Z" fill={c} {...ink} />
);
export const HAIR = [
  {
    id: "waves",
    name: "long waves",
    back: (c) => <path d="M74 80c-14 50-10 120-20 170 20 8 34-4 40-12 8 10 22 10 26 2 4 8 18 8 26-2 6 8 20 20 40 12-10-50-6-120-20-170-6-40-86-40-92 0Z" fill={c} {...ink} />,
    front: bangs,
  },
  {
    id: "twintails",
    name: "twin tails",
    back: (c, a) => (
      <>
        <path d="M78 70c-34 10-40 70-34 120 4 40 0 70 8 84 10-20 26-50 26-90 0-36 8-60 10-100Z" fill={c} {...ink} />
        <path d="M162 70c34 10 40 70 34 120-4 40 0 70-8 84-10-20-26-50-26-90 0-36-8-60-10-100Z" fill={c} {...ink} />
        <ellipse cx="120" cy="84" rx="47" ry="44" fill={c} {...ink} />
        <circle cx="76" cy="70" r="7" fill={a} {...ink} />
        <circle cx="164" cy="70" r="7" fill={a} {...ink} />
      </>
    ),
    front: bangs,
  },
  {
    id: "bob",
    name: "soft bob",
    back: (c) => <path d="M70 92c-6-48 22-60 50-60s56 12 50 60c4 22 2 44-6 56-10 4-20 0-24-8H100c-4 8-14 12-24 8-8-12-10-34-6-56Z" fill={c} {...ink} />,
    front: bangs,
  },
  {
    id: "bun",
    name: "top bun",
    back: (c) => <ellipse cx="120" cy="84" rx="47" ry="45" fill={c} {...ink} />,
    front: (c, a) => (
      <>
        <circle cx="120" cy="36" r="20" fill={c} {...ink} />
        <path d="M104 50q16 6 32 0" stroke={a} strokeWidth="5" strokeLinecap="round" fill="none" />
        {bangs(c)}
      </>
    ),
  },
  {
    id: "hime",
    name: "princess cut",
    back: (c) => <path d="M72 84c-6 60-4 120-8 164h112c-4-44-2-104-8-164-6-50-90-50-96 0Z" fill={c} {...ink} />,
    front: (c) => (
      <>
        <path d="M76 96c-6-46 18-56 44-56s50 10 44 56c-2-14-6-22-8-24H84c-2 2-6 10-8 24Z" fill={c} {...ink} />
        <path d="M78 84c-4 24-2 50 0 66h12c-2-20-2-46 0-66Z" fill={c} {...ink} />
        <path d="M162 84c4 24 2 50 0 66h-12c2-20 2-46 0-66Z" fill={c} {...ink} />
      </>
    ),
  },
];

// ---------------------------------------------------------------- clothes and the rest
const puff = (c) => (
  <>
    <ellipse cx="93" cy="154" rx="11" ry="10" fill={c} {...ink} />
    <ellipse cx="147" cy="154" rx="11" ry="10" fill={c} {...ink} />
  </>
);
export const ITEMS = [
  // tops
  {
    id: "blouse", slot: "top", name: "frill blouse", colors: [["#fffafd", "#f6a9c7"], ["#f3e6ff", "#9a6cc8"], ["#fff1d9", "#8fd6c0"]], thumb: [74, 136, 92, 80],
    draw: ({ c, a }) => (
      <>
        <path d="M92 154q0-9 9-10h38q9 1 9 10l-6 50H98Z" fill={c} {...ink} />
        <path d="M98 204q22 6 44 0" stroke={a} strokeWidth="4" strokeLinecap="round" />
        <path d="M120 146l-16 4 4 14 12-6 12 6 4-14Z" fill={c} {...ink} />
        <circle cx="120" cy="170" r="2.4" fill={a} /><circle cx="120" cy="182" r="2.4" fill={a} /><circle cx="120" cy="194" r="2.4" fill={a} />
      </>
    ),
    sleeves: ({ c }) => puff(c),
  },
  {
    id: "sweater", slot: "top", name: "cosy sweater", colors: [["#c9b1ee", "#fffafd"], ["#f6a9c7", "#fff1d9"], ["#a9dcc8", "#fffafd"], ["#fff1d9", "#d9a88f"]], thumb: [66, 136, 108, 104],
    draw: ({ c, a }) => (
      <>
        <path d="M88 156q0-12 12-13h40q12 1 12 13l-4 70H92Z" fill={c} {...ink} />
        <path d="M92 218h56" stroke={a} strokeWidth="3" strokeDasharray="3 4" />
        <path d="M110 144q10 8 20 0" stroke={INK} strokeWidth="2" fill="none" />
        <path d="M108 178c-4-8 6-12 12-4 6-8 16-4 12 4l-12 12Z" fill={a} {...ink} strokeWidth="1.6" />
      </>
    ),
    sleeves: ({ c }) => (
      <>
        <path d="M94 152 78 222" stroke={INK} strokeWidth="21" strokeLinecap="round" />
        <path d="M94 152 78 222" stroke={c} strokeWidth="17" strokeLinecap="round" />
        <path d="M146 152l16 70" stroke={INK} strokeWidth="21" strokeLinecap="round" />
        <path d="M146 152l16 70" stroke={c} strokeWidth="17" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "sailor", slot: "top", name: "sailor top", colors: [["#fffafd", "#7b8fd6"], ["#fffafd", "#e8577f"], ["#f3e6ff", "#5d3f78"]], thumb: [74, 136, 92, 84],
    draw: ({ c, a }) => (
      <>
        <path d="M92 154q0-9 9-10h38q9 1 9 10l-6 56H98Z" fill={c} {...ink} />
        <path d="M100 145h40l6 22-26 10-26-10Z" fill={a} {...ink} />
        <path d="M108 145l12 22 12-22" fill={c} {...ink} />
        <path d="M120 176c-10-8-18 0-10 6l10-2 10 2c8-6 0-14-10-6Z" fill="#e8577f" {...ink} strokeWidth="1.6" />
      </>
    ),
    sleeves: ({ c, a }) => (
      <>
        {puff(c)}
        <path d="M84 160q9 6 18 0M138 160q9 6 18 0" stroke={a} strokeWidth="3" fill="none" />
      </>
    ),
  },
  {
    id: "tee", slot: "top", name: "heart tee", colors: [["#fff1d9", "#e8577f"], ["#3b2a4a", "#f6a9c7"], ["#e3d4ff", "#fffafd"]], thumb: [74, 136, 92, 84],
    draw: ({ c, a }) => (
      <>
        <path d="M92 154q0-9 9-10h38q9 1 9 10l-6 58H98Z" fill={c} {...ink} />
        <path d="M110 146q10 8 20 0" stroke={INK} strokeWidth="2" fill="none" />
        <path d="M120 194c-12-10-16-20-8-24 4-2 8 0 8 4 0-4 4-6 8-4 8 4 4 14-8 24Z" fill={a} {...ink} strokeWidth="1.6" />
      </>
    ),
    sleeves: ({ c }) => (
      <>
        <path d="M86 150q4-8 14-6l-4 22-14-4Z" fill={c} {...ink} />
        <path d="M154 150q-4-8-14-6l4 22 14-4Z" fill={c} {...ink} />
      </>
    ),
  },
  // bottoms
  {
    id: "pleats", slot: "bottom", name: "pleated skirt", colors: [["#9a6cc8", "#fffafd"], ["#3b2a4a", "#f6a9c7"], ["#e8577f", "#fff1d9"], ["#7b8fd6", "#fffafd"]], thumb: [68, 190, 104, 84],
    draw: ({ c, a }) => (
      <>
        <path d="M98 198h44l22 64H76Z" fill={c} {...ink} />
        <path d="M108 200l-10 62M120 200v62M132 200l10 62" stroke={INK} strokeWidth="1.6" />
        <path d="M80 254h80" stroke={a} strokeWidth="3" />
      </>
    ),
  },
  {
    id: "tiers", slot: "bottom", name: "frill skirt", colors: [["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#f6a9c7"]], thumb: [64, 190, 112, 90],
    draw: ({ c, a }) => (
      <>
        <path d="M98 198h44l12 34H86Z" fill={c} {...ink} />
        <path d="M84 228h72l14 38q-8 6-16 0-8 6-16 0-8 6-16 0-8 6-16 0-8 6-16 0-8 6-16 0Z" fill={c} {...ink} />
        <path d="M86 232h68" stroke={a} strokeWidth="3" />
      </>
    ),
  },
  {
    id: "jeans", slot: "bottom", name: "soft jeans", colors: [["#8fb3e8", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fff1d9", "#d9a88f"]], thumb: [80, 190, 80, 150],
    draw: ({ c, a }) => (
      <>
        <path d="M96 198h48q4 14 2 30l-4 104h-20l-2-96-2 96H98l-4-104q-2-16 2-30Z" fill={c} {...ink} />
        <path d="M120 212v24M100 210h40" stroke={INK} strokeWidth="1.6" />
        <path d="M98 326h20M122 326h20" stroke={a} strokeWidth="3" />
      </>
    ),
  },
  // dresses
  {
    id: "frilldress", slot: "dress", name: "frill dress", colors: [["#3b2a4a", "#f6a9c7"], ["#f6a9c7", "#fffafd"], ["#c9b1ee", "#fffafd"], ["#fffafd", "#e8577f"]], thumb: [60, 136, 120, 150],
    draw: ({ c, a }) => (
      <>
        <path d="M92 154q0-9 9-10h38q9 1 9 10l-4 44 28 70q-8 8-16 2-8 8-16 0-8 8-16 0-8 8-16 0-8 8-16 0-8 8-16-2l28-70Z" fill={c} {...ink} />
        <path d="M74 258q46 16 92 0" stroke={a} strokeWidth="4" fill="none" />
        <path d="M120 162c-12-10-22-2-14 6l14-2 14 2c8-8-2-16-14-6Z" fill={a} {...ink} strokeWidth="1.6" />
        <path d="M98 198h44" stroke={a} strokeWidth="3" />
      </>
    ),
    sleeves: ({ c }) => puff(c),
  },
  {
    id: "tutu", slot: "dress", name: "ballet tutu", colors: [["#ffd1e3", "#fffafd"], ["#e3d4ff", "#fffafd"], ["#d8f3ea", "#fffafd"]], thumb: [48, 136, 144, 110],
    draw: ({ c, a }) => (
      <>
        <path d="M96 156q0-10 8-11h32q8 1 8 11l-2 50H98Z" fill={c} {...ink} />
        <path d="M54 222l14-8-2-10 16 2 6-10 12 8 10-6 10 6 12-8 6 10 16-2-2 10 14 8-16 6 4 10-18-4-8 8-12-6-12 6-8-8-18 4 4-10Z" fill={a} {...ink} />
        <path d="M62 214l14-6 10 4 14-6 20 4 20-4 14 6 10-4 14 6-12 8H74Z" fill={c} {...ink} />
      </>
    ),
    sleeves: () => null,
  },
  {
    id: "robe", slot: "dress", name: "summer robe", colors: [["#c9b1ee", "#f6a9c7"], ["#a9dcc8", "#fff1d9"], ["#f6a9c7", "#5d3f78"]], thumb: [56, 136, 128, 210],
    draw: ({ c, a }) => (
      <>
        <path d="M92 154q0-9 9-10h38q9 1 9 10l2 180H90Z" fill={c} {...ink} />
        <path d="M104 146l16 30 16-30" fill="none" {...ink} />
        <path d="M112 146l8 20" stroke={INK} strokeWidth="1.6" />
        <rect x="92" y="196" width="56" height="20" rx="4" fill={a} {...ink} />
        <path d="M138 206c10-4 18 4 12 12" fill="none" stroke={a} strokeWidth="6" strokeLinecap="round" />
        {[[104, 250], [134, 286], [110, 312], [130, 236]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill={a} opacity="0.8" />
        ))}
      </>
    ),
    sleeves: ({ c }) => (
      <>
        <path d="M92 150 70 160 66 232h24l6-60Z" fill={c} {...ink} />
        <path d="M148 150l22 10 4 72h-24l-6-60Z" fill={c} {...ink} />
      </>
    ),
  },
  {
    id: "gown", slot: "dress", name: "princess gown", colors: [["#e3d4ff", "#ffd1e3"], ["#ffd1e3", "#fff1d9"], ["#fff1d9", "#c9b1ee"]], thumb: [40, 136, 160, 220],
    draw: ({ c, a }) => (
      <>
        <path d="M94 154q0-9 9-10h34q9 1 9 10l-2 44c20 30 40 90 46 144H50c6-54 26-114 46-144Z" fill={c} {...ink} />
        <path d="M70 290q50 20 100 0M60 326q60 18 120 0" stroke={a} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M98 198h44" stroke={a} strokeWidth="4" />
        <circle cx="120" cy="164" r="5" fill={a} {...ink} strokeWidth="1.6" />
      </>
    ),
    sleeves: ({ c }) => puff(c),
  },
  // shoes
  {
    id: "maryjanes", slot: "shoes", name: "mary janes", colors: [["#3b2a4a", "#fffafd"], ["#e8577f", "#fffafd"], ["#fffafd", "#c9b1ee"]], thumb: [84, 316, 72, 36],
    draw: ({ c, a }) => (
      <>
        {[101, 139].map((x) => (
          <g key={x}>
            <path d={`M${x - 12} 340q0-10 12-10t12 10q0 6-12 6t-12-6Z`} fill={c} {...ink} />
            <path d={`M${x - 8} 334h16`} stroke={a} strokeWidth="2.4" />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "boots", slot: "shoes", name: "little boots", colors: [["#8a5a44", "#fff1d9"], ["#fffafd", "#f6a9c7"], ["#3b2a4a", "#c9b1ee"]], thumb: [82, 280, 76, 72],
    draw: ({ c, a }) => (
      <>
        {[[103, 101], [137, 139]].map(([leg, x]) => (
          <g key={x}>
            <path d={`M${leg - 10} 292h20l2 44q0 10-12 10h-12q-10 0-10-8t8-8Z`} fill={c} {...ink} />
            <path d={`M${leg - 10} 298h20`} stroke={a} strokeWidth="3" />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "pointes", slot: "shoes", name: "pointe shoes", colors: [["#ffd1e3", "#f6a9c7"], ["#fff1d9", "#e8c27f"], ["#e3d4ff", "#b79be0"]], thumb: [84, 290, 72, 60],
    draw: ({ c, a }) => (
      <>
        {[101, 139].map((x) => (
          <g key={x}>
            <path d={`M${x - 8} 300l16 0M${x - 8} 312l16-6M${x - 8} 306l16 6M${x - 8} 318l16-6`} stroke={a} strokeWidth="2.6" strokeLinecap="round" />
            <path d={`M${x - 10} 340q0-12 10-12t10 12q0 6-10 6t-10-6Z`} fill={c} {...ink} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "sneakers", slot: "shoes", name: "puffy sneakers", colors: [["#fffafd", "#c9b1ee"], ["#fffafd", "#f6a9c7"], ["#a9dcc8", "#fffafd"]], thumb: [80, 318, 80, 36],
    draw: ({ c, a }) => (
      <>
        {[101, 139].map((x) => (
          <g key={x}>
            <path d={`M${x - 14} 342q0-14 12-14 10 0 14 8 4 0 4 6Z`} fill={c} {...ink} />
            <path d={`M${x - 14} 342h30v4h-30Z`} fill={a} {...ink} />
            <path d={`M${x - 4} 334l4 3M${x} 331l4 3`} stroke={INK} strokeWidth="1.6" />
          </g>
        ))}
      </>
    ),
  },
  // socks
  {
    id: "frillsocks", slot: "socks", name: "frill socks", colors: [["#fffafd", "#f6a9c7"], ["#fffafd", "#c9b1ee"], ["#3b2a4a", "#fffafd"]], thumb: [84, 300, 72, 46],
    draw: ({ c, a }) => (
      <>
        {[102, 138].map((x) => (
          <g key={x}>
            <path d={`M${x - 9} 314h18v22H${x - 9}Z`} fill={c} {...ink} />
            <path d={`M${x - 12} 314q3 -6 6 0 3 -6 6 0 3 -6 6 0 3 -6 6 0`} fill={a} {...ink} strokeWidth="1.6" />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "thighhighs", slot: "socks", name: "ribbon stockings", colors: [["#fffafd", "#f6a9c7"], ["#3b2a4a", "#f6a9c7"], ["#e3d4ff", "#9a6cc8"]], thumb: [84, 236, 72, 110],
    draw: ({ c, a }) => (
      <>
        {[[105, 102], [135, 138]].map(([top, foot]) => (
          <g key={top}>
            <path d={`M${top - 9} 250h18l-2 86H${foot - 8}Z`} fill={c} {...ink} />
            <path d={`M${top - 6} 254c-6-6-10 2-4 4 6 2 8 0 8-4 0 4 2 6 8 4 6-2 2-10-4-4`} fill={a} stroke={INK} strokeWidth="1.4" />
          </g>
        ))}
      </>
    ),
  },
  // head
  {
    id: "bow", slot: "head", name: "big ribbon", colors: [["#f6a9c7", "#e8577f"], ["#3b2a4a", "#f6a9c7"], ["#fffafd", "#c9b1ee"], ["#b79be0", "#fffafd"]], thumb: [124, 28, 64, 48],
    draw: ({ c, a }) => (
      <g transform="rotate(14 156 50)">
        <path d="M156 50c-12-14-30-12-28 2 2 12 16 12 28-2Zm0 0c12-14 30-12 28 2-2 12-16 12-28-2Z" fill={c} {...ink} />
        <circle cx="156" cy="50" r="6" fill={a} {...ink} />
      </g>
    ),
  },
  {
    id: "catears", slot: "head", name: "kitty ears", colors: [["#3b2a4a", "#f6a9c7"], ["#fffafd", "#f6a9c7"], ["#e8c27f", "#fff1d9"]], thumb: [70, 14, 100, 52],
    draw: ({ c, a }) => (
      <>
        <path d="M80 62C86 44 104 36 120 36s34 8 40 26" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M86 54l-2-34 26 18Z" fill={c} {...ink} />
        <path d="M154 54l2-34-26 18Z" fill={c} {...ink} />
        <path d="M90 46l-1-16 12 9ZM150 46l1-16-12 9Z" fill={a} />
      </>
    ),
  },
  {
    id: "flowers", slot: "head", name: "flower crown", colors: [["#f6a9c7", "#fff1d9"], ["#c9b1ee", "#fffafd"], ["#fff3b8", "#f6a9c7"]], thumb: [70, 26, 100, 40],
    draw: ({ c, a }) => (
      <>
        {[[84, 56], [98, 46], [113, 42], [128, 42], [143, 46], [157, 56]].map(([x, y], i) => (
          <g key={x}>
            {[0, 72, 144, 216, 288].map((r) => (
              <ellipse key={r} cx={x} cy={y - 5} rx="3.6" ry="5.4" transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? a : c} stroke={INK} strokeWidth="1.2" />
            ))}
            <circle cx={x} cy={y} r="2.6" fill="#ffcf6b" />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "beret", slot: "head", name: "beret", colors: [["#e8577f", "#5d3f78"], ["#9a6cc8", "#fffafd"], ["#fff1d9", "#8a5a44"]], thumb: [70, 18, 100, 46],
    draw: ({ c, a }) => (
      <g transform="rotate(-10 120 46)">
        <path d="M74 54c0-20 30-30 50-30s48 8 46 26c-2 10-30 10-48 8s-48 6-48-4Z" fill={c} {...ink} />
        <path d="M120 24v-6" stroke={a} strokeWidth="4" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: "crown", slot: "head", name: "tiny crown", colors: [["#ffcf6b", "#f6a9c7"], ["#ece6f4", "#b79be0"], ["#f6a9c7", "#fffafd"]], thumb: [94, 14, 52, 38],
    draw: ({ c, a }) => (
      <>
        <path d="M102 46l-4-24 12 10 10-14 10 14 12-10-4 24Z" fill={c} {...ink} />
        <circle cx="120" cy="36" r="3.6" fill={a} {...ink} strokeWidth="1.4" />
      </>
    ),
  },
  // neck
  {
    id: "choker", slot: "neck", name: "heart choker", colors: [["#3b2a4a", "#f6a9c7"], ["#fffafd", "#e8577f"], ["#9a6cc8", "#fff1d9"]], thumb: [100, 126, 40, 32],
    draw: ({ c, a }) => (
      <>
        <path d="M111 136q9 4 18 0" stroke={INK} strokeWidth="6.6" strokeLinecap="round" fill="none" />
        <path d="M111 136q9 4 18 0" stroke={c} strokeWidth="3.6" strokeLinecap="round" fill="none" />
        <path d="M120 150c-7-5-8-10-4-12 2-1 4 0 4 2 0-2 2-3 4-2 4 2 3 7-4 12Z" fill={a} {...ink} strokeWidth="1.4" />
      </>
    ),
  },
  {
    id: "pearls", slot: "neck", name: "pearls", colors: [["#fffafd", "#e3d4ff"], ["#ffd1e3", "#fffafd"], ["#fff3b8", "#fffafd"]], thumb: [96, 136, 48, 40],
    draw: ({ c }) => (
      <>
        {[[104, 146], [108, 156], [114, 163], [120, 165], [126, 163], [132, 156], [136, 146]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3.6" fill={c} stroke={INK} strokeWidth="1.3" />
        ))}
      </>
    ),
  },
  // hand
  {
    id: "heartbag", slot: "hand", name: "heart bag", colors: [["#e8577f", "#fffafd"], ["#f6a9c7", "#3b2a4a"], ["#c9b1ee", "#fffafd"]], thumb: [146, 222, 50, 56],
    draw: ({ c, a }) => (
      <>
        <path d="M163 231c-6 10-6 18 2 24M163 231c8 10 10 18 4 24" stroke={INK} strokeWidth="2" fill="none" />
        <path d="M166 276c-16-10-22-22-12-28 6-3 10 0 12 4 2-4 6-7 12-4 10 6 4 18-12 28Z" fill={c} {...ink} />
        <circle cx="166" cy="258" r="2.6" fill={a} />
      </>
    ),
  },
  {
    id: "bunny", slot: "hand", name: "bunny plush", colors: [["#fffafd", "#f6a9c7"], ["#e3d4ff", "#f6a9c7"], ["#fff1d9", "#e8577f"]], thumb: [140, 200, 56, 84],
    draw: ({ c, a }) => (
      <>
        <ellipse cx="160" cy="214" rx="5" ry="14" fill={c} {...ink} transform="rotate(-12 160 214)" />
        <ellipse cx="174" cy="214" rx="5" ry="14" fill={c} {...ink} transform="rotate(12 174 214)" />
        <ellipse cx="167" cy="256" rx="15" ry="18" fill={c} {...ink} />
        <circle cx="167" cy="234" r="12" fill={c} {...ink} />
        <circle cx="163" cy="233" r="1.6" fill={INK} /><circle cx="171" cy="233" r="1.6" fill={INK} />
        <ellipse cx="160" cy="238" rx="2.6" ry="1.6" fill={a} /><ellipse cx="174" cy="238" rx="2.6" ry="1.6" fill={a} />
        <circle cx="163" cy="231" r="8" fill="transparent" />
      </>
    ),
  },
  {
    id: "wand", slot: "hand", name: "star wand", colors: [["#fff3b8", "#c9b1ee"], ["#f6a9c7", "#fffafd"], ["#a9dcc8", "#fff3b8"]], thumb: [150, 176, 46, 70],
    draw: ({ c, a }) => (
      <>
        <path d="M164 236l8-46" stroke={INK} strokeWidth="5.6" strokeLinecap="round" />
        <path d="M164 236l8-46" stroke={a} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M173 172l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill={c} {...ink} />
      </>
    ),
  },
  {
    id: "bouquet", slot: "hand", name: "little bouquet", colors: [["#f6a9c7", "#c9b1ee"], ["#fff3b8", "#f6a9c7"], ["#c9b1ee", "#fffafd"]], thumb: [144, 192, 52, 60],
    draw: ({ c, a }) => (
      <>
        <path d="M164 232l-6-24M164 232l2-26M164 232l8-22" stroke="#6f9f6a" strokeWidth="2.4" strokeLinecap="round" />
        {[[157, 206, c], [166, 200, a], [174, 208, c], [163, 212, a]].map(([x, y, fill]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="6.6" fill={fill} {...ink} strokeWidth="1.6" />
        ))}
        <path d="M156 228l8 8 8-8-8-4Z" fill="#fffafd" {...ink} strokeWidth="1.6" />
      </>
    ),
  },
  // back
  {
    id: "wings", slot: "back", name: "angel wings", colors: [["#fffafd", "#e3d4ff"], ["#ffd1e3", "#fffafd"], ["#3b2a4a", "#9a6cc8"]], thumb: [30, 120, 180, 110],
    draw: ({ c, a }) => (
      <>
        <path d="M102 166C80 130 46 126 34 136c10 4 14 10 12 16 8 0 12 4 12 10 8 0 14 6 12 14 12-2 22 0 32-10Z" fill={c} {...ink} />
        <path d="M138 166c22-36 56-40 68-30-10 4-14 10-12 16-8 0-12 4-12 10-8 0-14 6-12 14-12-2-22 0-32-10Z" fill={c} {...ink} />
        <path d="M58 150q18 4 30 14M182 150q-18 4-30 14" stroke={a} strokeWidth="2.4" fill="none" />
      </>
    ),
  },
  {
    id: "fairy", slot: "back", name: "fairy wings", colors: [["#d8f3ea", "#a9dcc8"], ["#e3d4ff", "#c9b1ee"], ["#ffd1e3", "#f6a9c7"]], thumb: [36, 120, 168, 120],
    draw: ({ c, a }) => (
      <>
        <path d="M106 170C80 120 44 120 44 140s30 36 62 30Zm0 4c-24 4-46 20-38 36 8 14 30 0 38-36Z" fill={c} opacity="0.85" {...ink} />
        <path d="M134 170c26-50 62-50 62-30s-30 36-62 30Zm0 4c24 4 46 20 38 36-8 14-30 0-38-36Z" fill={c} opacity="0.85" {...ink} />
        <path d="M62 140q20 8 40 28M178 140q-20 8-40 28" stroke={a} strokeWidth="2" fill="none" />
      </>
    ),
  },
];

export const SLOTS = ["back", "socks", "shoes", "bottom", "top", "dress", "neck", "head", "hand"];
export const itemById = (id) => ITEMS.find((item) => item.id === id) ?? null;
export const hairById = (id) => HAIR.find((hair) => hair.id === id) ?? HAIR[0];

export const BACKDROPS = [
  { id: "room", name: "dressing room" },
  { id: "garden", name: "garden" },
  { id: "stage", name: "stage" },
];

/** A soft scene behind the doll (doll space, a little wider than the doll). */
export function Backdrop({ id }) {
  if (id === "garden")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#e6f3ee" />
        <path d="M-80 300q100-30 200-6t200-10V420H-80Z" fill="#bfe0b8" {...ink} />
        {[[-30, 330], [30, 370], [200, 340], [270, 380], [250, 310]].map(([x, y]) => (
          <g key={x}>
            {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 6} rx="5" ry="7" transform={`rotate(${r} ${x} ${y})`} fill="#ffd1e3" stroke={INK} strokeWidth="1.4" />)}
            <circle cx={x} cy={y} r="3.4" fill="#ffcf6b" />
          </g>
        ))}
        <circle cx="230" cy="40" r="24" fill="#fff3b8" {...ink} />
      </g>
    );
  if (id === "stage")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#3a2763" />
        <path d="M60 -20 20 360h200l-40-380Z" fill="#fff3c9" opacity="0.16" />
        <path d="M-80 -20h70c-10 120-10 240-30 380h-40Z" fill="#9f78c9" {...ink} />
        <path d="M320 -20h-70c10 120 10 240 30 380h40Z" fill="#9f78c9" {...ink} />
        <path d="M-80 340h400v80H-80Z" fill="#e7c7a6" {...ink} />
        <ellipse cx="120" cy="352" rx="110" ry="18" fill="#fff1c9" opacity="0.7" />
      </g>
    );
  return (
    <g>
      <rect x="-80" y="-20" width="400" height="440" fill="#f3e6f8" />
      {Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => <circle key={`${row}-${col}`} cx={-60 + col * 50 + (row % 2) * 25} cy={10 + row * 40} r="3.4" fill="#e6d2ef" />))}
      <ellipse cx="120" cy="170" rx="104" ry="150" fill="#fffafd" stroke="#e2cdee" strokeWidth="10" />
      <path d="M-80 340h400v80H-80Z" fill="#e8cdd9" {...ink} />
      <ellipse cx="120" cy="352" rx="96" ry="16" fill="#c9b1ee" {...ink} />
    </g>
  );
}
