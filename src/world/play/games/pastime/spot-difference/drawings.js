// "look twice": every little thing in the pictures, drawn for this site as SVG strings (so a whole
// scene becomes one light image). Each drawing sits around (0, 0); `RADIUS` is how far it reaches,
// which is also how close a tap must land to count.
const O = 'stroke="#4a2f57" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const T = 'stroke="#4a2f57" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
const W = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8"';

export const COLOURS = {
  lilac: "#c9a8f5",
  pink: "#f7a6c8",
  peach: "#ffc49e",
  butter: "#ffe08a",
  mint: "#a8d69a",
  sky: "#a9cdf5",
  cream: "#fff3df",
  rose: "#e8789f",
  plum: "#9b6bc4",
  teal: "#8fd3c7",
  coral: "#f59a8b",
  grey: "#c9c3d3",
};

const star = (r, inner = r * 0.45) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const d = i % 2 ? inner : r;
    return `${(Math.cos(a) * d).toFixed(1)},${(Math.sin(a) * d).toFixed(1)}`;
  }).join(" ");

const heartPath = (s) => `M0 ${6 * s}C${-8 * s} ${1 * s} ${-9 * s} ${-5 * s} ${-5 * s} ${-7 * s}C${-2.5 * s} ${-8 * s} 0 ${-6 * s} 0 ${-4 * s}C0 ${-6 * s} ${2.5 * s} ${-8 * s} ${5 * s} ${-7 * s}C${9 * s} ${-5 * s} ${8 * s} ${1 * s} 0 ${6 * s}Z`;

/** Each drawing: (colour, variant) => SVG markup centred on 0,0. */
export const DRAW = {
  cat: (c, v) => `
    <path d="M-14 16c-4-10-2-20 4-25l-2-10 8 6c3-1 6-1 8 0l8-6-2 10c6 5 8 15 4 25z" fill="${c}" ${O}/>
    <path d="M14 14c8 0 12-6 10-13" fill="none" ${O}/>
    <circle cx="-5" cy="-6" r="1.6" fill="#4a2f57"/><circle cx="5" cy="-6" r="1.6" fill="#4a2f57"/>
    <path d="M-2 -2l2 1.5 2-1.5" fill="none" ${T}/>
    <ellipse cx="-8" cy="-1" rx="2.6" ry="1.5" fill="#f7a6c8"/><ellipse cx="8" cy="-1" rx="2.6" ry="1.5" fill="#f7a6c8"/>
    ${v === 1 ? `<path d="M-5 -14c2-3 8-3 10 0l-5 3z" fill="#f7a6c8" ${T}/>` : ""}`,
  cup: (c, v) => `
    <ellipse cx="0" cy="10" rx="15" ry="4" fill="#fff" ${O}/>
    <path d="M-10 -4h20l-2 13h-16z" fill="${c}" ${O}/>
    <path d="M10 -1c6 0 6 7 0 7" fill="none" ${O}/>
    ${v === 1 ? `<path d="M-3 -9c-3-3 3-5 0-9M3 -9c-3-3 3-5 0-9" fill="none" ${T} opacity="0.7"/>` : ""}
    ${heartPathIn(0, 3, 0.3)}`,
  plant: (c, v) => `
    <path d="M-10 4h20l-3 15h-14z" fill="${c}" ${O}/>
    <path d="M-12 1h24v5h-24z" fill="${c}" ${O}/>
    <path d="M0 1v-14" fill="none" stroke="#4f7d5a" stroke-width="2"/>
    <path d="M0 -4c-9 0-12-6-11-11 7 0 11 4 11 11zM0 -8c8 0 11-5 10-10-7 0-10 4-10 10z" fill="#9fd08f" stroke="#4f7d5a" stroke-width="1.8" stroke-linejoin="round"/>
    ${v === 1 ? `<path d="M0 -12c-3-6-1-11 3-13 2 5 1 10-3 13z" fill="#b9e0a8" stroke="#4f7d5a" stroke-width="1.6"/>` : ""}
    ${v === 2 ? `<circle cx="0" cy="-17" r="4" fill="#f7a6c8" ${T}/>` : ""}`,
  books: (c, v) => `
    <rect x="-16" y="6" width="32" height="8" rx="2" fill="${c}" ${O}/>
    <rect x="-13" y="-2" width="27" height="8" rx="2" fill="#fff3df" ${O}/>
    ${v !== 1 ? `<rect x="-15" y="-10" width="28" height="8" rx="2" fill="#a9cdf5" ${O}/>` : ""}
    <path d="M-10 10h18M-8 2h14" ${T} fill="none"/>`,
  frame: (c, v) => `
    <rect x="-15" y="-18" width="30" height="36" rx="3" fill="${c}" ${O}/>
    <rect x="-10" y="-13" width="20" height="26" rx="2" fill="#fffaf2" ${T}/>
    ${v === 0 ? `<path d="${heartPath(1.1)}" fill="#f7a6c8" ${T}/>` : v === 1 ? `<polygon points="${star(8)}" fill="#ffe08a" ${T}/>` : `<path d="M3 -8a8 8 0 1 0 5 12a7 7 0 1 1 -5 -12z" fill="#fff0a8" ${T}/>`}`,
  clock: (c, v) => `
    <circle r="15" fill="${c}" ${O}/>
    <circle r="11" fill="#fffaf2" ${T}/>
    <path d="M0 0${["v-8M0 0h6", "v-8M0 0v6", "h-6M0 0v-8"][v] ?? "v-8M0 0h6"}" fill="none" stroke="#4a2f57" stroke-width="2" stroke-linecap="round"/>
    <circle r="1.6" fill="#4a2f57"/>`,
  lamp: (c, v) => `
    <path d="M-2 0v20M-9 22h18" fill="none" ${O}/>
    <path d="M-14 0l5-18h18l5 18z" fill="${c}" ${O}/>
    ${v === 1 ? `<circle cx="0" cy="8" r="5" fill="#fff3a8" opacity="0.8"/>` : ""}
    <path d="M-8 -3h16" fill="none" ${T} opacity="0.5"/>`,
  jar: (c, v) => `
    <rect x="-9" y="-16" width="18" height="6" rx="2" fill="${c}" ${O}/>
    <path d="M-10 -10h20v20c0 4-3 6-6 6h-8c-3 0-6-2-6-6z" fill="#eef7ff" ${O}/>
    <rect x="-7" y="-3" width="14" height="8" rx="1.5" fill="#fff" ${T}/>
    ${v === 1 ? `<circle cx="-3" cy="9" r="2.4" fill="${c}"/><circle cx="3" cy="11" r="2" fill="${c}"/>` : `<path d="M-5 9h10" ${T}/>`}`,
  yarn: (c) => `
    <circle r="11" fill="${c}" ${O}/>
    <path d="M-9 -5c6 2 12 8 14 14M-4 -10c6 4 10 10 11 18M-10 3c5 0 9 3 11 8" fill="none" ${T}/>
    <path d="M10 6c6 2 8 6 6 10" fill="none" ${O}/>`,
  bow: (c) => `
    <path d="M0 0c-6-8-14-8-14-2s8 6 14 2zM0 0c6-8 14-8 14-2s-8 6-14 2z" fill="${c}" ${O}/>
    <path d="M-2 2l-5 10M2 2l5 10" fill="none" ${O}/>
    <circle r="3" fill="${c}" ${O}/>`,
  star: (c) => `<polygon points="${star(9)}" fill="${c}" ${O}/>`,
  heart: (c) => `<path d="${heartPath(1.3)}" fill="${c}" ${O}/>`,
  cloud: (c) => `
    <path d="M-22 8c-6 0-6-10 1-10 0-8 11-11 15-4 3-7 15-6 15 2 7-1 9 12 1 12z" fill="${c}" ${O}/>
    <path d="M-14 -1c1-3 4-4 6-4" ${W}/>`,
  sun: (c) => `
    ${Array.from({ length: 8 }, (_, i) => `<path d="M0 -15v-6" transform="rotate(${i * 45})" ${O}/>`).join("")}
    <circle r="11" fill="${c}" ${O}/>
    <circle cx="-4" cy="-1" r="1.4" fill="#4a2f57"/><circle cx="4" cy="-1" r="1.4" fill="#4a2f57"/>
    <path d="M-3 4c2 2 4 2 6 0" fill="none" ${T}/>`,
  moon: (c) => `<path d="M5 -14a14 14 0 1 0 9 22a11 11 0 1 1 -9 -22z" fill="${c}" ${O}/>`,
  flower: (c, v) => `
    <path d="M0 6v14" stroke="#4f7d5a" stroke-width="2" fill="none"/>
    <path d="M0 14c-6 0-8-4-7-6 4 0 7 2 7 6z" fill="#9fd08f" stroke="#4f7d5a" stroke-width="1.5"/>
    ${Array.from({ length: v === 1 ? 6 : 5 }, (_, i) => `<ellipse cx="0" cy="-6" rx="4" ry="6" transform="rotate(${(i * 360) / (v === 1 ? 6 : 5)})" fill="${c}" ${T}/>`).join("")}
    <circle r="3.4" fill="#ffe08a" ${T}/>`,
  mushroom: (c, v) => `
    <path d="M-5 0l-2 12c4 2 10 2 14 0l-2-12" fill="#fff3df" ${O}/>
    <path d="M-14 2c0-14 28-14 28 0z" fill="${c}" ${O}/>
    <circle cx="-6" cy="-4" r="2.2" fill="#fff"/><circle cx="3" cy="-7" r="2" fill="#fff"/>${v === 1 ? `<circle cx="8" cy="-2" r="1.8" fill="#fff"/>` : ""}`,
  butterfly: (c) => `
    <path d="M0 0c-4-10-16-12-14-2 1 5 8 6 14 2zM0 0c4-10 16-12 14-2-1 5-8 6-14 2zM0 1c-3 4-10 8-11 3 0-3 5-4 11-3zM0 1c3 4 10 8 11 3 0-3-5-4-11-3z" fill="${c}" ${O}/>
    <path d="M0 -6v12M0 -6l-3-5M0 -6l3-5" fill="none" ${T}/>`,
  bird: (c) => `
    <path d="M-12 2c0-9 7-13 13-11 6 2 9 8 8 14-6 4-17 4-21-3z" fill="${c}" ${O}/>
    <path d="M9 0l6 1-5 3" fill="#ffc49e" ${T}/>
    <circle cx="4" cy="-2" r="1.5" fill="#4a2f57"/>
    <path d="M-6 0c3 4 8 4 10 1" fill="none" ${T}/>`,
  lantern: (c) => `
    <path d="M0 -20v5" ${O}/>
    <rect x="-6" y="-16" width="12" height="4" rx="1" fill="#4a2f57"/>
    <ellipse cy="0" rx="11" ry="13" fill="${c}" ${O}/>
    <path d="M-5 -11c-3 6-3 16 0 22M5 -11c3 6 3 16 0 22" fill="none" ${T} opacity="0.6"/>
    <rect x="-5" y="12" width="10" height="3" rx="1" fill="#4a2f57"/>
    <path d="M0 15v6" ${T}/>`,
  cupcake: (c, v) => `
    <path d="M-10 0h20l-3 13h-14z" fill="#fff3df" ${O}/>
    <path d="M-6 1l1 11M0 1v11M6 1l-1 11" ${T} fill="none"/>
    <path d="M-12 1c-2-6 3-9 6-8 1-5 11-5 12 0 4-1 8 3 6 8z" fill="${c}" ${O}/>
    ${v === 1 ? `<circle cx="0" cy="-11" r="3.2" fill="#e8789f" ${T}/>` : `<polygon points="${star(4)}" transform="translate(0 -11)" fill="#ffe08a" ${T}/>`}`,
  macaron: (c) => `
    <ellipse cy="-4" rx="11" ry="5" fill="${c}" ${O}/>
    <rect x="-10" y="-2" width="20" height="4" rx="2" fill="#fff3df" ${T}/>
    <ellipse cy="5" rx="11" ry="5" fill="${c}" ${O}/>`,
  teapot: (c, v) => `
    <path d="M-14 -2c-8 0-8 10-1 12M14 0l9-8-2 8" fill="none" ${O}/>
    <path d="M-14 -4c0-8 6-12 14-12s14 4 14 12v6c0 8-6 12-14 12s-14-4-14-12z" fill="${c}" ${O}/>
    <path d="M-8 -16h16" ${O}/><circle cx="0" cy="-19" r="3" fill="${c}" ${O}/>
    ${v === 1 ? `<path d="${heartPath(0.8)}" transform="translate(0 2)" fill="#fff" ${T}/>` : `<circle cx="-5" cy="2" r="2" fill="#fff"/><circle cx="2" cy="4" r="2" fill="#fff"/><circle cx="7" cy="-1" r="2" fill="#fff"/>`}`,
  candle: (c, v) => `
    <rect x="-5" y="-6" width="10" height="20" rx="2" fill="${c}" ${O}/>
    <path d="M0 -6v-4" ${T}/>
    ${v === 1 ? "" : `<path d="M0 -19c-4 4-3 8 0 8s4-4 0-8z" fill="#ffd56b" stroke="#d9902a" stroke-width="1.4"/>`}`,
  balloon: (c) => `
    <ellipse cy="-6" rx="11" ry="13" fill="${c}" ${O}/>
    <path d="M-2 7l2 3 2-3z" fill="${c}" ${T}/>
    <path d="M0 10c-3 6 3 9 0 16" fill="none" ${T}/>
    <path d="M-6 -12c1-3 3-5 5-5" ${W}/>`,
  can: (c) => `
    <path d="M-12 -8h18v18c0 3-2 5-5 5h-8c-3 0-5-2-5-5z" fill="${c}" ${O}/>
    <path d="M6 -2l14-10 2 3-14 12" fill="${c}" ${O}/>
    <path d="M-10 -8c0-9 14-9 14 0" fill="none" ${O}/>`,
  snail: (c) => `
    <path d="M-14 10c4 0 26 0 28 0 0-4-4-5-8-5" fill="#ffe7c2" ${O}/>
    <circle cx="-2" cy="0" r="9" fill="${c}" ${O}/>
    <path d="M-2 0a4 4 0 1 1 4 -3" fill="none" ${T}/>
    <path d="M10 5l2-8M14 5l3-7" ${T}/>`,
  flag: (c) => `<path d="M-8 -6h16l-8 14z" fill="${c}" ${O}/>`,
  vase: (c, v) => `
    <path d="M-7 -4c-4 6-4 14 0 18h14c4-4 4-12 0-18z" fill="${c}" ${O}/>
    <path d="M-3 -4v-8M3 -4l3-9M-1 -4l-5-8" fill="none" stroke="#4f7d5a" stroke-width="1.8"/>
    <circle cx="-3" cy="-14" r="3.4" fill="#f7a6c8" ${T}/><circle cx="6" cy="-14" r="3.4" fill="${v === 1 ? "#a9cdf5" : "#ffe08a"}" ${T}/><circle cx="-6" cy="-12" r="3" fill="#fff" ${T}/>`,
  cushion: (c) => `
    <path d="M-20 -8c6-4 34-4 40 0 3 6 3 12 0 16-6 4-34 4-40 0-3-4-3-10 0-16z" fill="${c}" ${O}/>
    <path d="M-12 0h24" fill="none" ${T} opacity="0.5" stroke-dasharray="3 3"/>`,
  window: (c, v) => `
    <rect x="-34" y="-30" width="68" height="60" rx="4" fill="${v === 1 ? "#ffeec7" : "#5b4a8a"}" ${O}/>
    ${v === 1 ? `<circle cx="10" cy="-8" r="9" fill="#ffd56b" stroke="#d9902a" stroke-width="1.4"/>` : `<path d="M14 -18a9 9 0 1 0 6 14a7 7 0 1 1 -6 -14z" fill="#fff0a8"/><circle cx="-18" cy="-14" r="1.4" fill="#fff"/><circle cx="-6" cy="8" r="1.2" fill="#fff"/><circle cx="20" cy="14" r="1.4" fill="#fff"/>`}
    <path d="M0 -30v60M-34 0h68" stroke="${c}" stroke-width="4"/>
    <rect x="-34" y="-30" width="68" height="60" rx="4" fill="none" ${O}/>`,
  bench: (c) => `
    <path d="M-26 -2h52M-22 -2v14M22 -2v14" fill="none" ${O}/>
    <rect x="-28" y="-8" width="56" height="7" rx="2" fill="${c}" ${O}/>
    <rect x="-26" y="-20" width="52" height="7" rx="2" fill="${c}" ${O}/>`,
};

function heartPathIn(x, y, s) {
  return `<path d="${heartPath(s * 2)}" transform="translate(${x} ${y})" fill="#fff" opacity="0.85"/>`;
}

/** How far each drawing reaches from its centre at scale 1. */
export const RADIUS = {
  cat: 20, cup: 14, plant: 17, books: 16, frame: 18, clock: 15, lamp: 18, jar: 14, yarn: 12, bow: 12,
  star: 9, heart: 10, cloud: 20, sun: 18, moon: 14, flower: 12, mushroom: 13, butterfly: 13, bird: 13,
  lantern: 15, cupcake: 14, macaron: 11, teapot: 20, candle: 12, balloon: 14, can: 16, snail: 13, flag: 9,
  vase: 14, cushion: 20, window: 34, bench: 26,
};

/** Drawings that look different mirrored (the others can't be "flipped" as a difference). */
export const ASYMMETRIC = new Set(["cat", "cup", "plant", "lamp", "yarn", "cloud", "moon", "bird", "teapot", "can", "snail", "window", "books"]);

/** Drawings with more than one look, and how many. */
export const VARIANTS = { cat: 2, cup: 2, plant: 3, books: 2, frame: 3, clock: 3, lamp: 2, jar: 2, flower: 2, mushroom: 2, cupcake: 2, teapot: 2, candle: 2, vase: 2, window: 2 };

export function drawItem(item) {
  const sx = item.s * (item.flip ? -1 : 1);
  const art = DRAW[item.type](COLOURS[item.colour] ?? item.colour, item.variant ?? 0);
  return `<g transform="translate(${item.x} ${item.y}) rotate(${item.r ?? 0}) scale(${sx} ${item.s})">${art}</g>`;
}
