// boop the cats: kittens drawn to match the site's calico kitten (src/shared/Kitten.jsx), peeking
// out of cardboard boxes. Every face is drawn here, in the sticker line style.
import { INK, line } from "../_kit/sprites.js";

const W = 112;
const H = 88;

const EYES = {
  open: (c) =>
    `<ellipse cx="43" cy="51" rx="4.6" ry="5.8" fill="${c.iris ?? INK}" ${c.iris ? line(1.4) : ""}/>
     <ellipse cx="69" cy="51" rx="4.6" ry="5.8" fill="${c.iris ?? INK}" ${c.iris ? line(1.4) : ""}/>
     ${c.iris ? `<ellipse cx="43" cy="51.5" rx="1.8" ry="4" fill="${INK}"/><ellipse cx="69" cy="51.5" rx="1.8" ry="4" fill="${INK}"/>` : ""}
     <circle cx="44.8" cy="48.6" r="1.8" fill="#fff"/><circle cx="70.8" cy="48.6" r="1.8" fill="#fff"/>`,
  wow: (c) =>
    `<circle cx="43" cy="51" r="6.2" fill="${c.iris ?? INK}" ${line(1.4)}/><circle cx="69" cy="51" r="6.2" fill="${c.iris ?? INK}" ${line(1.4)}/>
     <circle cx="43" cy="51.5" r="2.6" fill="${INK}"/><circle cx="69" cy="51.5" r="2.6" fill="${INK}"/>
     <circle cx="45" cy="48.4" r="2" fill="#fff"/><circle cx="71" cy="48.4" r="2" fill="#fff"/>`,
  happy: (c) => `<path d="M37.5 53q5.5-7.5 11 0M63.5 53q5.5-7.5 11 0" fill="none" stroke="${c.lines ?? INK}" stroke-width="3" stroke-linecap="round"/>`,
  closed: (c) => `<path d="M37.5 51q5.5 5 11 0M63.5 51q5.5 5 11 0" fill="none" stroke="${c.lines ?? INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  grumpy: (c) =>
    `<path d="M37 52.5h11.5M63.5 52.5H75" stroke="${c.lines ?? INK}" stroke-width="2.8" stroke-linecap="round"/>
     <path d="M36.5 44.5l11 3.2M75.5 44.5l-11 3.2" stroke="${c.lines ?? INK}" stroke-width="2.4" stroke-linecap="round"/>`,
};

const MOUTHS = {
  smile: (c) => `<path d="M56 60.5c-.8 2.8-4 3.4-6.2 1.8M56 60.5c.8 2.8 4 3.4 6.2 1.8" fill="none" stroke="${c.lines ?? INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  open: () => `<path d="M50.5 61q5.5 9 11 0z" fill="#f96cab" ${line(1.8)}/>`,
  o: () => `<ellipse cx="56" cy="63.5" rx="2.8" ry="3.4" fill="#f96cab" ${line(1.5)}/>`,
  grumpy: (c) => `<path d="M51.5 64.5q4.5-3.5 9 0" fill="none" stroke="${c.lines ?? INK}" stroke-width="1.9" stroke-linecap="round"/>`,
};

const COATS = {
  calico: {
    fur: "#fffaf4",
    ear: "#ffb3cf",
    patches: `<path d="M16 34c10-10 28-9 31 4 3 10-7 15-19 15S10 45 16 34z" fill="#f1a46c"/>
              <path d="M66 25c9-4 22-1 25 9 2 7-6 10-14 8s-17-13-11-17z" fill="#3a2d45"/>`,
  },
  grey: {
    fur: "#d9d3e3",
    ear: "#f6b8d2",
    patches: `<path d="M47 23l2.4 9M56 21.5v10M65 23l-2.4 9M20 47l8 1.4M19 54l8-.2M92 47l-8 1.4M93 54l-8-.2" stroke="#9a8fb0" stroke-width="3.4" stroke-linecap="round"/>`,
  },
  black: {
    fur: "#3d3048",
    ear: "#f7a9c8",
    iris: "#ffe28a",
    lines: "#fff3fb",
    patches: `<path d="M44 74q12 6 24 0" fill="none" stroke="#574862" stroke-width="3" stroke-linecap="round"/>`,
    extra: `<path d="M84 18c-6-7-15-6-14 0s9 5 14 0zm0 0c6-7 15-6 14 0s-9 5-14 0z" fill="#f96cab" ${line(1.8)}/><circle cx="84" cy="18" r="3" fill="#ffcce0" ${line(1.5)}/>`,
  },
  chonk: {
    fur: "#f6bd85",
    ear: "#ffb3cf",
    wide: true,
    patches: `<path d="M40 66c4-7 28-7 32 0 2 6-8 11-16 11s-18-5-16-11z" fill="#fff4e6"/>
              <path d="M46 22l2.4 8M56 20.5v9M66 22l-2.4 8" stroke="#e39253" stroke-width="3.4" stroke-linecap="round"/>`,
  },
  sleepy: {
    fur: "#f3e9fa",
    ear: "#e3c9f5",
    patches: `<path d="M24 35c6-6 14-6 16 1" fill="none" stroke="#d8c3ea" stroke-width="3" stroke-linecap="round"/>`,
    extra: `<path d="M70 20c4-12 20-17 30-6l-4 8z" fill="#b589ff" ${line(2)}/><path d="M69 22c9-4 19-3 27 0" fill="none" ${line(2)}/>
            <circle cx="101" cy="13" r="4.4" fill="#fff" ${line(1.8)}/>`,
  },
};

function catFace(coat, eyes, mouth, { blush = 0.6 } = {}) {
  const c = COATS[coat];
  const wide = c.wide ? `transform="translate(56 50) scale(1.12 1) translate(-56 -50)"` : "";
  const ears = `<path d="M27 38L30 8l23 18z" fill="${c.fur}" ${line()}/><path d="M85 38L82 8 59 26z" fill="${c.fur}" ${line()}/>
                <path d="M32.5 31l1.6-15 11 8.5z" fill="${c.ear}"/><path d="M79.5 31l-1.6-15-11 8.5z" fill="${c.ear}"/>`;
  return `<defs><clipPath id="head"><ellipse cx="56" cy="51" rx="36" ry="30"/></clipPath></defs>
    <g ${wide}>
      ${ears}
      <ellipse cx="56" cy="51" rx="36" ry="30" fill="${c.fur}"/>
      <g clip-path="url(#head)">${c.patches}</g>
      <ellipse cx="56" cy="51" rx="36" ry="30" fill="none" ${line()}/>
    </g>
    ${c.extra ?? ""}
    ${EYES[eyes](c)}
    <path d="M53.6 57.4h4.8L56 59.8z" fill="#f96cab" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    ${MOUTHS[mouth](c)}
    <ellipse cx="34" cy="61" rx="5" ry="2.9" fill="#ffa4c9" opacity="${blush}"/>
    <ellipse cx="78" cy="61" rx="5" ry="2.9" fill="#ffa4c9" opacity="${blush}"/>
    <path d="M14 56l9 1.6M14 62.5l9-1M98 56l-9 1.6M98 62.5l-9-1" stroke="${c.lines ?? INK}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`;
}

function paws(coat) {
  const fur = COATS[coat].fur;
  const toe = COATS[coat].lines ?? INK;
  return `<ellipse cx="34" cy="12" rx="11.5" ry="8" fill="${fur}" ${line(2.2)}/><ellipse cx="78" cy="12" rx="11.5" ry="8" fill="${fur}" ${line(2.2)}/>
    <path d="M30 7.5v5M34 6.5v6M38 7.5v5M74 7.5v5M78 6.5v6M82 7.5v5" stroke="${toe}" stroke-width="1.3" stroke-linecap="round"/>`;
}

export const SPRITES = {
  "calico.open": [catFace("calico", "open", "smile"), W, H],
  "calico.happy": [catFace("calico", "happy", "open", { blush: 0.95 }), W, H],
  "grey.open": [catFace("grey", "open", "smile"), W, H],
  "grey.happy": [catFace("grey", "happy", "open", { blush: 0.95 }), W, H],
  "black.open": [catFace("black", "open", "smile"), W, H],
  "black.happy": [catFace("black", "happy", "open", { blush: 0.95 }), W, H],
  "chonk.open": [catFace("chonk", "open", "smile"), W, H],
  "chonk.wow": [catFace("chonk", "wow", "o", { blush: 0.8 }), W, H],
  "chonk.happy": [catFace("chonk", "happy", "open", { blush: 0.95 }), W, H],
  "sleepy.open": [catFace("sleepy", "closed", "smile", { blush: 0.45 }), W, H],
  "sleepy.grumpy": [catFace("sleepy", "grumpy", "grumpy", { blush: 0.3 }), W, H],
  "calico.paws": [paws("calico"), W, 24],
  "grey.paws": [paws("grey"), W, 24],
  "black.paws": [paws("black"), W, 24],
  "chonk.paws": [paws("chonk"), W, 24],
  "sleepy.paws": [paws("sleepy"), W, 24],
  boxBack: [
    `<path d="M12 32V14q0-5 5-5h98q5 0 5 5v18z" fill="#b98f6f" ${line(2.4)}/>
     <path d="M15 13L3 2h29l5 11z" fill="#ecd0ad" ${line(2.2)}/>
     <path d="M117 13l12-11H100l-5 11z" fill="#ecd0ad" ${line(2.2)}/>`,
    132, 32,
  ],
  boxFront: [
    `<path d="M10 6h112l-6 62H16z" fill="#f2d9bd" ${line(2.6)}/>
     <path d="M58 7h16v60H58z" fill="#d9c3f2" opacity=".95"/>
     <path d="M58 7v60M74 7v60" stroke="#b79ad8" stroke-width="1.4"/>
     <path d="M24 24h22M26 32h15" stroke="#d6b48b" stroke-width="2.6" stroke-linecap="round"/>
     <path d="M98 47c-6-4-7-8-5.4-10.4 1.4-2.2 4.2-2.2 5.4-.2 1.2-2 4-2 5.4.2 1.6 2.4.6 6.4-5.4 10.4z" fill="#f9a3c6" ${line(1.6)}/>
     <path d="M10 6h112" ${line(2.6)}/>`,
    132, 72,
  ],
  heart: [
    `<path d="M14 24C4 17 2 11 4 7.2 6 3 11.4 2.6 14 6.8 16.6 2.6 22 3 24 7.2c2 3.8 0 9.8-10 16.8z" fill="#f96cab" ${line(1.8)}/>
     <path d="M8 9q1-2.5 3.5-2.5" fill="none" stroke="#ffd1e4" stroke-width="2" stroke-linecap="round"/>`,
    28, 27,
  ],
  sparkle: [`<path d="M8 .8l1.7 5.5L15.2 8l-5.5 1.7L8 15.2 6.3 9.7.8 8l5.5-1.7z" fill="#fff6c9" stroke="#e9b949" stroke-width="1" stroke-linejoin="round"/>`, 16, 16],
  puff: [`<circle cx="9" cy="9" r="7" fill="#fff" stroke="#d9c6e3" stroke-width="1.6"/>`, 18, 18],
};

export const SOUNDS = {
  boop: [0.9, 0, 520, 0, 0.03, 0.12, 0, 1.5, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02],
  nudge: [0.8, 0, 260, 0, 0.04, 0.14, 1, 1.2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02],
  pop: [0.25, 0, 900, 0, 0.01, 0.05, 0, 1, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  grumble: [0.9, 0.05, 180, 0.02, 0.12, 0.2, 1, 1.4, -2, 0, 0, 0, 0, 0.1, 6, 0, 0, 0.7],
  over: [0.8, 0, 523, 0.01, 0.1, 0.4, 1, 1, 0, 0, 262, 0.12, 0, 0, 0, 0, 0.12, 0.6],
};

/** A picnic blanket: soft lilac gingham, painted once per screen size. */
export function paintBlanket(ctx, width, height) {
  ctx.fillStyle = "#f6effa";
  ctx.fillRect(0, 0, width, height);
  const size = 34;
  ctx.fillStyle = "rgba(201, 176, 226, 0.22)";
  for (let x = 0; x < width; x += size * 2) ctx.fillRect(x, 0, size, height);
  for (let y = 0; y < height; y += size * 2) ctx.fillRect(0, y, width, size);
  // a few stitched hearts
  ctx.strokeStyle = "rgba(190, 150, 210, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.setLineDash([]);
}
