// New collectible stickers from the luck shelf (RENOVATION.md, "Games": new sticker designs). Same
// die-cut look and 64×64 box as src/shared/stickers/StickerArt.jsx, so the coordinator can move
// each picture into that file's ART map and each entry into server/content/birthday.js. The names
// and lines match server/content/luck.js (LUCK_STICKERS), which the capsule machine hands out.
import StickerArt from "../../../../shared/stickers/StickerArt.jsx";

const line = { stroke: "#2b1b35", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" };

export const LUCK_STICKER_ART = {
  capsule: (
    <g transform="rotate(-14 32 32)">
      <path d="M12 32a20 20 0 0 1 40 0z" fill="#e3d4ff" {...line} />
      <path d="M12 32h40a20 20 0 0 1-40 0z" fill="#ffa4c9" {...line} />
      <path d="M12 32h40" {...line} strokeWidth="3.4" />
      <path d="M32 26c-3-4-9-2-7 3 1 3 7 6 7 6s6-3 7-6c2-5-4-7-7-3z" fill="#f96cab" stroke="#2b1b35" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 22c2-4 6-7 10-8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="41" r="2" fill="#fff" opacity=".8" />
    </g>
  ),
  fortune: (
    <>
      <path d="M14 8h32l4 5v43H18l-4-5z" fill="#fffaf4" {...line} />
      <path d="M14 8v43h4V13z" fill="#e3d4ff" {...line} strokeWidth="2" />
      <rect x="15" y="27" width="35" height="10" rx="2" fill="#b589ff" {...line} />
      <text x="36" y="23" textAnchor="middle" fontSize="11" fontWeight="700" fill="#c2006f" fontFamily="serif">吉</text>
      <path d="M26 44h16M28 49h12" stroke="#a589b4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M33 32c-2-3-6-1-5 2 1 2 5 4 5 4s4-2 5-4c1-3-3-5-5-2z" fill="#fff" />
    </>
  ),
  lantern: (
    <>
      <circle cx="32" cy="33" r="25" fill="#ffd166" opacity=".35" />
      <rect x="24" y="6" width="16" height="7" rx="2" fill="#7e39df" {...line} />
      <path d="M17 30c0-11 7-17 15-17s15 6 15 17-7 18-15 18-15-7-15-18z" fill="#ffcf8a" {...line} />
      <path d="M32 13v35M24 15c-5 8-5 24 0 32M40 15c5 8 5 24 0 32" stroke="#e59f4f" strokeWidth="2" fill="none" />
      <rect x="25" y="47" width="14" height="6" rx="2" fill="#7e39df" {...line} />
      <path d="M32 53v6" {...line} />
      <path d="M29 59h6" stroke="#f96cab" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 26c1-4 3-6 6-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  clover: (
    <>
      <path d="M32 33c3 10 2 18-4 26" {...line} fill="none" stroke="#2b1b35" />
      <path d="M32 33c3 10 2 18-4 26" stroke="#5fae6f" strokeWidth="1.2" fill="none" />
      {[0, 90, 180, 270].map((angle) => (
        <path key={angle} transform={`rotate(${angle + 45} 32 31)`} d="M32 31c-9-3-13-10-9-15 3-3 7-2 9 2 2-4 6-5 9-2 4 5 0 12-9 15z" fill="#9fd08f" {...line} />
      ))}
      <circle cx="32" cy="31" r="3" fill="#6fcf97" {...line} strokeWidth="1.8" />
      <path d="M22 17c2-1 4-1 5 1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </>
  ),
  card: (
    <>
      <rect x="20" y="10" width="30" height="44" rx="5" fill="#cfb4ff" {...line} transform="rotate(10 35 32)" />
      <rect x="13" y="9" width="30" height="44" rx="5" fill="#fffaf4" {...line} transform="rotate(-8 28 31)" />
      <g transform="rotate(-8 28 31)">
        <text x="18" y="21" fontSize="10" fontWeight="700" fill="#7e39df" fontFamily="sans-serif">7</text>
        <path d="M28 27c-3-5-10-3-8 3 1 4 8 8 8 8s7-4 8-8c2-6-5-8-8-3z" fill="#f96cab" stroke="#2b1b35" strokeWidth="2" strokeLinejoin="round" />
        <text x="38" y="49" fontSize="10" fontWeight="700" fill="#7e39df" fontFamily="sans-serif" transform="rotate(180 36 46)">7</text>
      </g>
    </>
  ),
  teacup: (
    <>
      <ellipse cx="32" cy="52" rx="24" ry="6" fill="#e3d4ff" {...line} />
      <path d="M14 50c0-14 6-26 18-26s18 12 18 26z" fill="#ffcce0" {...line} />
      <path d="M44 33c7-3 12 2 9 8" {...line} fill="none" />
      <path d="M18 44c4 2 24 2 28 0" stroke="#e52f8c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M22 34c1-3 3-5 6-6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M50 10l2 5 5 1-4 3 1 5-4-3-5 3 1-5-4-3 5-1z" fill="#ffd166" {...line} strokeWidth="1.8" />
    </>
  ),
};

export const LUCK_STICKERS = [
  { id: "st-capsule", art: "capsule", name: "Capsule toy", line: "Twist, rattle, pop. Something lovely inside." },
  { id: "st-fortune", art: "fortune", name: "Fortune slip", line: "Today's luck: the sweet kind." },
  { id: "st-lantern", art: "lantern", name: "Wish lantern", line: "Lit, lifted and still glowing." },
  { id: "st-clover", art: "clover", name: "Four-leaf clover", line: "Found where nobody was looking." },
  { id: "st-card", art: "card", name: "Lilac card", line: "Higher, always higher." },
  { id: "st-teacup", art: "teacup", name: "Shuffle teacup", line: "It was under this one all along." },
];

/** Any sticker in her collection: a luck one drawn here, or one from the shared sticker art. */
export function AnySticker({ art, size = 64, className = "" }) {
  if (LUCK_STICKER_ART[art]) {
    return (
      <svg className={`sticker-art ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        {LUCK_STICKER_ART[art]}
      </svg>
    );
  }
  return <StickerArt art={art} size={size} className={className} />;
}

export default LUCK_STICKERS;
