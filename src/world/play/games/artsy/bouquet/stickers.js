// New stickers for her collection (docs/refactor/RENOVATION.md, "Games"): 64×64 SVG inner markup.
const ink = 'stroke="#2b1b35" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
export default [
  {
    id: "st-bouquet",
    name: "Little bouquet",
    line: "Tied with a bow. Picked just for you.",
    art: `<path d="M32 58 10 22c6-6 13-5 17-1 3-6 12-6 15 0 4-4 11-5 17 1Z" fill="#e9dcff" ${ink}/><g ${ink}><circle cx="22" cy="22" r="8" fill="#f6a9c7"/><circle cx="40" cy="20" r="7.5" fill="#c9b1ee"/><circle cx="31" cy="13" r="6.5" fill="#fff4ee"/></g><circle cx="22" cy="22" r="3" fill="#e8577f"/><circle cx="40" cy="20" r="2.6" fill="#fff4cf"/><circle cx="31" cy="13" r="2.4" fill="#f6a9c7"/><path d="M14 36c10 7 26 7 36 0L38 52H26Z" fill="#f6c1d8" ${ink}/><path d="M32 46c-4-5-11-6-11-2s7 3 11 2Zm0 0c4-5 11-6 11-2s-7 3-11 2Z" fill="#9a6cc8" ${ink}/>`,
  },
  {
    id: "st-vase",
    name: "Vase of five",
    line: "Five bouquets on the shelf. The room smells lovely.",
    art: `<path d="M24 30h16c0 5 7 8 7 17 0 8-7 12-15 12s-15-4-15-12c0-9 7-12 7-17Z" fill="#c9e6f2" ${ink}/><path d="M20 46c8 3 16 3 24 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><g ${ink}><path d="M32 30V16M27 30l-6-10M37 30l6-11" fill="none"/><circle cx="32" cy="12" r="6" fill="#f6a9c7"/><circle cx="20" cy="18" r="5.5" fill="#fff4cf"/><circle cx="44" cy="17" r="5.5" fill="#c9b1ee"/></g><circle cx="32" cy="12" r="2.2" fill="#e8577f"/><circle cx="20" cy="18" r="2" fill="#f4c84e"/><circle cx="44" cy="17" r="2" fill="#fff"/>`,
  },
];
