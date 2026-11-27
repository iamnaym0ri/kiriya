import { EYE_COLOURS, EYE_STYLES, INK, MOUTHS, SKINS } from "./body.jsx";
import { HAIR, HAIR_COLOURS, hairById } from "./hair.jsx";
import { CLOTHES } from "./clothes.jsx";
import { ACCESSORIES } from "./accessories.jsx";

// Everything she can wear, the themed sets, and the scenes behind her. All drawn for this game
// (doll space 240 × 400, see body.jsx); original designs in the site's soft lilac style.
export { EYE_COLOURS, EYE_STYLES, HAIR, HAIR_COLOURS, MOUTHS, SKINS, hairById };
export const EYES = EYE_COLOURS; // older saves call them this

export const ITEMS = [...CLOTHES, ...ACCESSORIES];
export const itemById = (id) => ITEMS.find((item) => item.id === id) ?? null;

/** The wardrobe's drawers, in the order her tabs show them. */
export const DRAWERS = [
  { id: "top", name: "tops" },
  { id: "bottom", name: "skirts & pants" },
  { id: "dress", name: "dresses" },
  { id: "outer", name: "jackets" },
  { id: "shoes", name: "shoes" },
  { id: "socks", name: "socks" },
  { id: "head", name: "hats & bows" },
  { id: "face", name: "glasses" },
  { id: "neck", name: "necklaces" },
  { id: "hand", name: "to hold" },
  { id: "back", name: "wings" },
];

// ---------------------------------------------------------------- themed sets
const piece = (id, c = 0) => ({ id, c });
export const SETS = [
  { id: "apothecary", name: "apothecary", backdrop: "apothecary", look: { hair: piece("topbun", 0), eyeStyle: "sleepy", mouth: "smile", outfit: { dress: piece("herbalist", 0), shoes: piece("clothshoes", 0), head: piece("herbband", 0), hand: piece("basket", 0) } } },
  { id: "court", name: "court robes", backdrop: "palace", look: { hair: piece("hime", 0), eyeStyle: "round", mouth: "smile", outfit: { dress: piece("court", 0), shoes: piece("clothshoes", 1), head: piece("hairpin", 0), hand: piece("fan", 0), neck: piece("pearls", 0) } } },
  { id: "idol", name: "idol stage", backdrop: "stage", look: { hair: piece("twintails", 8), eyeStyle: "sparkle", mouth: "open", outfit: { dress: piece("idol", 0), socks: piece("thighhighs", 3), shoes: piece("longboots", 0), head: piece("headset", 0), hand: piece("mic", 2) } } },
  { id: "cozy", name: "cozy night in", backdrop: "night", look: { hair: piece("buns", 2), eyeStyle: "happy", mouth: "cat", outfit: { top: piece("pjtop", 0), bottom: piece("pjpants", 0), outer: piece("cardigan", 0), shoes: piece("slippers", 0), hand: piece("mug", 0) } } },
  { id: "gothic", name: "gothic lolita", backdrop: "night", look: { hair: piece("drills", 0), eyeStyle: "round", mouth: "o", outfit: { dress: piece("gothic", 0), socks: piece("striped", 0), shoes: piece("platforms", 0), head: piece("headdress", 1), hand: piece("parasol", 1), back: piece("batwings", 0) } } },
  { id: "ballet", name: "ballet recital", backdrop: "stage", look: { hair: piece("topbun", 3), eyeStyle: "sparkle", mouth: "smile", outfit: { dress: piece("tutu", 0), shoes: piece("pointes", 0), head: piece("tiara", 1), neck: piece("pearls", 0) } } },
  { id: "cafe", name: "café shift", backdrop: "cafe", look: { hair: piece("braids", 2), eyeStyle: "round", mouth: "open", outfit: { dress: piece("apron", 1), socks: piece("frillsocks", 0), shoes: piece("maryjanes", 0), head: piece("headdress", 0), hand: piece("mug", 1) } } },
  { id: "picnic", name: "spring picnic", backdrop: "garden", look: { hair: piece("halfup", 3), eyeStyle: "happy", mouth: "smile", outfit: { dress: piece("sundress", 0), shoes: piece("sandals", 0), head: piece("sunhat", 0), hand: piece("basket", 1) } } },
];

// ---------------------------------------------------------------- scenes behind her
export const BACKDROPS = [
  { id: "room", name: "dressing room" },
  { id: "garden", name: "garden" },
  { id: "sakura", name: "sakura" },
  { id: "stage", name: "stage" },
  { id: "night", name: "starry night" },
  { id: "cafe", name: "café" },
  { id: "apothecary", name: "apothecary" },
  { id: "palace", name: "palace hall" },
];
const line = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };
const Sparkle = ({ x, y, r = 5, c = "#fff" }) => <path d={`M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`} fill={c} />;
const Floor = ({ fill, rug }) => (
  <g>
    <path d="M-80 340h400v80H-80Z" fill={fill} {...line} />
    {rug && <ellipse cx="120" cy="352" rx="100" ry="16" fill={rug} {...line} />}
  </g>
);

/** A soft scene behind the doll (doll space, wider than the doll). */
export function Backdrop({ id }) {
  if (id === "garden")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#e3f3ff" />
        <circle cx="228" cy="44" r="26" fill="#fff3b8" {...line} />
        <path d="M-40 70q10-14 26-8 10-14 28-4 14 0 14 12H-40Z" fill="#fff" opacity="0.9" />
        <path d="M-80 250q60-30 120-10t120-6 160 8V420H-80Z" fill="#cfe8c4" {...line} />
        <path d="M-80 296q100-26 200-6t200-10V420H-80Z" fill="#b6dba8" {...line} />
        {[[-30, 330], [30, 372], [200, 340], [262, 380], [244, 310], [-14, 380]].map(([x, y], i) => (
          <g key={x}>
            {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 6} rx="5" ry="7" transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? "#ffd1e3" : "#fff3b8"} stroke={INK} strokeWidth="1.2" />)}
            <circle cx={x} cy={y} r="3.4" fill="#ffcf6b" />
          </g>
        ))}
      </g>
    );
  if (id === "sakura")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#ffeef5" />
        <path d="M-80 30C-20 40 20 20 60 50M260 10C220 40 200 30 170 60" fill="none" stroke="#8a5a44" strokeWidth="6" strokeLinecap="round" />
        {[[-40, 30], [0, 40], [40, 46], [250, 20], [210, 38], [180, 56], [-10, 60], [230, 60]].map(([x, y], i) => (
          <g key={i}>
            {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={x} cy={y - 7} rx="6" ry="8" transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? "#ffc9da" : "#ffe0ea"} stroke="#e8a3bb" strokeWidth="1" />)}
            <circle cx={x} cy={y} r="2.6" fill="#f27aa0" />
          </g>
        ))}
        {[[20, 140], [210, 120], [-20, 220], [250, 240], [30, 300], [190, 300]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="4" ry="6" transform={`rotate(40 ${x} ${y})`} fill="#ffc9da" />)}
        <Floor fill="#f3d9e4" rug="#ffd1e3" />
      </g>
    );
  if (id === "stage")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#3a2763" />
        <path d="M70 -20 20 360h200l-50-380Z" fill="#fff3c9" opacity="0.16" />
        <path d="M-80 -20h80c-12 120-12 240-34 380h-46Z" fill="#9f78c9" {...line} />
        <path d="M320 -20h-80c12 120 12 240 34 380h46Z" fill="#9f78c9" {...line} />
        <path d="M-80-20h400v30q-30 16-50 0-30 16-50 0-30 16-50 0-30 16-50 0-30 16-50 0-30 16-50 0-30 16-50 0-30 16-50 0Z" fill="#b48ad9" {...line} />
        {[[30, 70], [200, 90], [10, 200], [236, 220], [60, 140], [180, 160]].map(([x, y]) => <Sparkle key={x} x={x} y={y} r={5} c="#fff3c9" />)}
        <path d="M-80 340h400v80H-80Z" fill="#e7c7a6" {...line} />
        <ellipse cx="120" cy="352" rx="110" ry="18" fill="#fff1c9" opacity="0.7" />
      </g>
    );
  if (id === "night")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#2a2150" />
        <path d="M-80 200C0 170 80 210 160 190S280 170 320 190V420H-80Z" fill="#3a2d6b" />
        <path d="M232 46a22 22 0 1 0 18 34a18 18 0 1 1-18-34Z" fill="#fff3c9" />
        {[[-40, 40], [10, 90], [60, 30], [150, 20], [190, 120], [-20, 160], [250, 170], [40, 200], [110, 70]].map(([x, y], i) => <Sparkle key={i} x={x} y={y} r={i % 3 ? 3.4 : 5.4} c={i % 2 ? "#fff3c9" : "#e3d4ff"} />)}
        <path d="M-60 120q8-10 20-6 8-10 22-2 10 0 10 8H-60Z" fill="#4a3d86" />
        <Floor fill="#463a78" rug="#6b5aa8" />
      </g>
    );
  if (id === "cafe")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#fbeee6" />
        {Array.from({ length: 10 }, (_, i) => <rect key={i} x={-80 + i * 40} y="-20" width="20" height="300" fill="#f6dfe6" />)}
        <rect x="150" y="40" width="96" height="110" rx="48" fill="#dff2ff" {...line} />
        <path d="M198 40V150M150 100H246" stroke={INK} strokeWidth="2" />
        <path d="M-80 250h400v14H-80Z" fill="#c99b6a" {...line} />
        <path d="M-60 250v-20h60v20M-50 230q0-14 20-14t20 14" fill="#fff" {...line} />
        <path d="M-40 216c-4-6 4-10 10-4 6-6 14-2 10 4" fill="#f6a9c7" {...line} />
        <path d="M-80 264h400v76H-80Z" fill="#e6cdb0" {...line} />
        <Floor fill="#d9b48c" />
      </g>
    );
  if (id === "apothecary")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#f1e6d2" />
        {[40, 120, 200].map((y) => <path key={y} d={`M-80 ${y}h400v8H-80Z`} fill="#b88a5e" {...line} />)}
        {[[-60, 40], [-30, 40], [180, 40], [215, 40], [250, 40], [-50, 120], [-20, 120], [200, 120], [236, 120], [-60, 200], [230, 200]].map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x} ${y}v-22q0-6 6-8h10q6 2 6 8v22Z`} fill={["#cfe6d6", "#e8d6f0", "#f6e0c8"][i % 3]} {...line} strokeWidth="1.6" />
            <path d={`M${x + 2} ${y - 30}h18v-4h-18Z`} fill="#8a5a44" />
            <path d={`M${x + 4} ${y - 12}h14`} stroke="#fff" strokeWidth="3" />
          </g>
        ))}
        {[10, 50, 90, 130, 170].map((x, i) => <path key={x} d={`M${x} -20v${30 + (i % 2) * 10}m-6 0q6 14 12 0q-6-4-12 0Z`} fill="#8cc47e" stroke={INK} strokeWidth="1.4" />)}
        <path d="M-80 260h400v80H-80Z" fill="#c99b6a" {...line} />
        {[-60, 0, 60, 120, 180, 240].map((x) => <rect key={x} x={x} y="274" width="44" height="22" rx="3" fill="#b88a5e" {...line} strokeWidth="1.4" />)}
        <Floor fill="#a8784e" />
      </g>
    );
  if (id === "palace")
    return (
      <g>
        <rect x="-80" y="-20" width="400" height="440" fill="#f6e3d6" />
        <path d="M-80-20h400v40H-80Z" fill="#b7334f" {...line} />
        {[-50, 250].map((x) => <path key={x} d={`M${x} 20h30v320h-30Z`} fill="#c4505a" {...line} />)}
        {[[0, 70], [240, 70]].map(([x, y]) => (
          <g key={x}>
            <path d={`M${x} 20v${y - 30}`} stroke={INK} strokeWidth="1.4" />
            <ellipse cx={x} cy={y} rx="16" ry="20" fill="#f27a5a" {...line} />
            <path d={`M${x - 16} ${y}h32`} stroke="#e8c27f" strokeWidth="2" />
            <path d={`M${x} ${y + 20}v14`} stroke="#e8c27f" strokeWidth="2" />
          </g>
        ))}
        <path d="M40 60h160v200H40Z" fill="#fff8ee" opacity="0.6" />
        <path d="M40 60h160M40 130h160M40 200h160M120 60v200" stroke="#e8c27f" strokeWidth="2" opacity="0.6" />
        <Floor fill="#e8c27f" rug="#b7334f" />
      </g>
    );
  return (
    <g>
      <rect x="-80" y="-20" width="400" height="440" fill="#f3e6f8" />
      {Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => <circle key={`${row}-${col}`} cx={-60 + col * 50 + (row % 2) * 25} cy={10 + row * 40} r="3.4" fill="#e6d2ef" />))}
      <ellipse cx="120" cy="170" rx="106" ry="152" fill="#fffafd" stroke="#e2cdee" strokeWidth="10" />
      <Floor fill="#e8cdd9" rug="#c9b1ee" />
    </g>
  );
}
