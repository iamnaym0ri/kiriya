// The ten opening scenes (index.js plays one per launch). Original art, drawn here in the app's lilac.
//
// Josh (round 3): "more broader, like stars, love, moon and other stuff, not big icons, it should all
// compliment the kiriya logo". So the "kiriya" wordmark is the centrepiece of every scene, and each is
// a light, airy scene around it: many small, delicate things spread across the whole screen at
// different depths (smaller, softer and slower behind; a little bigger in front), framing the word,
// which glows, shimmers or is re-inked by them.
//
// Every scene starts on the native splash's own frame: the lilac backdrop, the wordmark and its
// sparkle exactly where the launch image has them (wordmark.js); everything else starts invisible,
// so the hand-over is seamless. Pieces live on a square stage the size of the launch image drawn
// aspect-fill (opening.css) and are placed in % of it: the word spans 35–65% across and 41–59%
// down; a phone shows roughly 25–75% across and all of it down. Each piece is a small HTML box
// holding a still SVG, moved only by transform and opacity (Web Animations API), so it all runs on
// the compositor while the app loads underneath. 14–28 pieces a scene.
import { LETTERS, SPARKLE, SPLASH, WORD } from "./wordmark.js";

const INK = "#4e2f63";
const SPARK = "#9a6fb4";
const PAPER = "#fff9fd";
const LILAC = "#d9c3ee";
const LILAC_D = "#a27cc7";
const PINK = "#f6cfe0";
const PINK_D = "#e597bd";
const ROSE = "#c46d98";
const GOLD = "#f3d58c";
const GOLD_D = "#d9b15c";

const r = (n) => Math.round(n * 1000) / 1000;
/** Launch-image units (0–2732) to % of the stage. */
const S = (n) => (n / SPLASH) * 100;
/** A box centred on (cx, cy), all in % of the stage. */
const at = (cx, cy, w, h = w) => `left:${r(cx - w / 2)}%;top:${r(cy - h / 2)}%;width:${r(w)}%;height:${r(h)}%;`;
const piece = (name, place, inner, style = "") => `<div class="opening__piece opening__${name}" style="${place}${style}">${inner}</div>`;
const svg = (viewBox, inner) => `<svg viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;

const HEART = "M0 9C-7 4-10 0-10-4-10-7.5-7.5-10-4.6-10-2.6-10-1-8.9 0-7.3 1-8.9 2.6-10 4.6-10 7.5-10 10-7.5 10-4 10 0 7 4 0 9Z";
const STAR4 = "M0-10Q1.8-1.8 10 0 1.8 1.8 0 10-1.8 1.8-10 0-1.8-1.8 0-10Z";
const PETAL = "M0-10C-4-6-4.5 2 0 10 4.5 2 4-6 0-10Z";
const shape = {
  star: (fill) => svg("-11 -11 22 22", `<path d="${STAR4}" fill="${fill}"/>`),
  dot: (fill) => svg("-5 -5 10 10", `<circle r="3.2" fill="${fill}"/>`),
  heart: (fill, stroke) => svg("-12 -12 24 23", `<path d="${HEART}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"` : ""}/>`),
  heartLine: (stroke) => svg("-12 -12 24 23", `<path d="${HEART}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`),
  petal: (fill, stroke) => svg("-11 -11 22 22", `<path d="${PETAL}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><path d="M0-6v11" stroke="${stroke}" stroke-width=".8" opacity=".5"/>`),
};

/** A seeded random (the same every launch), so each scene's scatter is a composed one. */
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// Around the word, kept clear (in % of the stage).
const WORD_ZONE = { x0: 32, x1: 68, y0: 38, y1: 62 };
const inWord = (x, y) => x > WORD_ZONE.x0 && x < WORD_ZONE.x1 && y > WORD_ZONE.y0 && y < WORD_ZONE.y1;
/** Points spread evenly over an area (never closer than `gap`), off the word unless allowed. */
function scatter(seed, count, { x0 = 26, x1 = 74, y0 = 4, y1 = 96, gap = 7, word = false } = {}) {
  const rand = seeded(seed);
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (!word && inWord(x, y)) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) continue;
    out.push({ x, y, k: rand(), j: rand() });
  }
  return out;
}

// ---------- the splash's own frame ----------

const B = WORD.box;
const WORD_CX = S(B.x + B.w / 2);
const WORD_CY = S(B.y + B.h / 2);
const glyphs = (letters) => letters.map((l) => `<path transform="translate(${l.ox} ${l.oy})" d="${l.d}"/>`).join("");
const wordGroup = (letters, colour = INK, stroke = WORD.stroke) =>
  `<g fill="${colour}" stroke="${colour}" stroke-width="${stroke}" stroke-linejoin="round" transform="translate(${WORD.tx} ${WORD.ty}) scale(${WORD.scale} ${-WORD.scale})">${glyphs(letters)}</g>`;
const box = (b) => `${r(b.x)} ${r(b.y)} ${r(b.w)} ${r(b.h)}`;
const wordSvg = (letters, b) => `<svg viewBox="${box(b)}" preserveAspectRatio="none" aria-hidden="true">${wordGroup(letters)}</svg>`;
const wordPiece = () => piece("word", at(WORD_CX, WORD_CY, S(B.w), S(B.h)), wordSvg(LETTERS, B));
/** The word as six boxes, one per letter (all as tall as the word). */
const letterPieces = () =>
  LETTERS.map((l, i) => piece(`letter opening__letter--${i}`, at(S(l.x + l.w / 2), WORD_CY, S(l.w), S(B.h)), wordSvg([l], { x: l.x, y: B.y, w: l.w, h: B.h }))).join("");
/** A soft light behind the word (drawn once, blurred once; only its opacity moves). */
const GLOW = { x: B.x - 90, y: B.y - 90, w: B.w + 180, h: B.h + 180 };
const glowPiece = () =>
  piece(
    "glow",
    at(WORD_CX, WORD_CY, S(GLOW.w), S(GLOW.h)),
    `<svg viewBox="${box(GLOW)}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="opening-glow-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter></defs><g filter="url(#opening-glow-blur)" opacity=".95">${wordGroup(LETTERS, "#fff6fc", 300)}</g></svg>`,
  );
const SPARKLE_SIZE = S(100 * SPARKLE.unit);
const sparklePiece = () => piece("sparkle", at(S(SPARKLE.x), S(SPARKLE.y), SPARKLE_SIZE), svg("-50 -50 100 100", `<path fill="${SPARK}" d="${SPARKLE.d}"/>`));
/** Where the letters are, for things that land on them. */
const LETTER_POINTS = LETTERS.map((l) => ({ x: S(l.x + l.w / 2), y: S(l.y + l.h * 0.5) }));

/** The launch image's backdrop (scripts/make-app-icon.mjs, the lilac theme), drawn the same way. */
export function backdropMarkup() {
  return `<svg class="opening__backdrop" viewBox="0 0 ${SPLASH} ${SPLASH}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="opening-bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#f3e9fa"/><stop offset="0.55" stop-color="#e2cff0"/><stop offset="1" stop-color="#cfb2e4"/></linearGradient><radialGradient id="opening-glow" cx="0.78" cy="0.18" r="0.55"><stop offset="0" stop-color="#ffe6f1" stop-opacity="0.85"/><stop offset="1" stop-color="#ffe6f1" stop-opacity="0"/></radialGradient></defs><rect width="${SPLASH}" height="${SPLASH}" fill="url(#opening-bg)"/><rect width="${SPLASH}" height="${SPLASH}" fill="url(#opening-glow)"/></svg>`;
}

/** Back layer, the word's glow, the word (or its letters), its sparkle, then the front layer. */
export function sceneMarkup(scene) {
  if (!scene) return wordPiece() + sparklePiece();
  const word = scene.letters ? letterPieces() : wordPiece();
  return `${scene.back?.() ?? ""}${glowPiece()}${word}${sparklePiece()}${scene.front?.() ?? ""}`;
}

// ---------- a little motion kit ----------

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SOFT = "cubic-bezier(0.25, 0.8, 0.3, 1)";
const SWAY = "cubic-bezier(0.45, 0, 0.55, 1)";

function animator(root) {
  const list = [];
  const moved = new Set();
  // A piece's first animation also holds its first frame until it starts (so pieces that arrive
  // later are hidden until then); a later one on the same piece only takes over when it starts.
  const play = (node, frames, timing) => {
    const fill = moved.has(node) ? "forwards" : "both";
    moved.add(node);
    list.push(node.animate(frames, { fill, ...timing }));
  };
  const run = (selector, frames, duration, delay = 0, easing = SOFT, options = {}) =>
    root.querySelectorAll(`.opening__${selector}`).forEach((node) => play(node, frames, { duration, delay, easing, ...options }));
  /** One animation per matching piece, from (index, piece) → [frames, timing]. */
  const each = (selector, make) =>
    root.querySelectorAll(`.opening__${selector}`).forEach((node, i) => {
      const [frames, timing] = make(i, node);
      play(node, frames, { easing: SOFT, ...timing });
    });
  return { run, each, list };
}
const appear = (scale = 1.3) => [
  { transform: "scale(0)", opacity: 0 },
  { transform: `scale(${scale})`, opacity: 1, offset: 0.55 },
  { transform: "scale(1)", opacity: 1 },
];
const twinkleLoop = [
  { transform: "scale(1)", opacity: 1 },
  { transform: "scale(0.7)", opacity: 0.55 },
];
const sparkleTwinkle = [
  { transform: "scale(1) rotate(0deg)" },
  { transform: "scale(1.45) rotate(45deg)", offset: 0.45 },
  { transform: "scale(1) rotate(90deg)" },
];
/** The word's glow coming up and settling. */
const glowIn = (run, delay, peak = 1, rest = 0.7) =>
  run("glow", [{ opacity: 0 }, { opacity: peak, offset: 0.55 }, { opacity: rest }], 900, delay, "ease-out");
const lift = [
  { transform: "translateY(0) scale(1)" },
  { transform: "translateY(-1.6%) scale(1.025)", offset: 0.5 },
  { transform: "translateY(0) scale(1)" },
];
/** Depth from a 0–1 draw: 0 far (small, soft), 1 near. */
const depth = (k) => (k < 0.45 ? 0 : k < 0.8 ? 1 : 2);
const DEPTH = [
  { size: 0.7, opacity: 0.55 },
  { size: 1, opacity: 0.8 },
  { size: 1.35, opacity: 1 },
];

// ---------- 1. a sky of stars twinkling on ----------
const STARFIELD = scatter(11, 26, { gap: 6.5 });
const STARS = {
  id: "stars",
  beat: 1300,
  back: () =>
    STARFIELD.map((p, i) => {
      const d = DEPTH[depth(p.k)];
      const size = (i % 4 === 0 ? 1.1 : 1.9 + p.j * 1.4) * d.size;
      const fill = [GOLD, PAPER, LILAC_D, PINK_D][i % 4];
      return piece(`sky opening__sky--${depth(p.k)}`, at(p.x, p.y, size), i % 4 === 0 ? shape.dot(fill) : shape.star(fill), `opacity:${d.opacity};`);
    }).join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("sky", (i) => [appear(1.5), { duration: 420, delay: 80 + ((i * 7) % 26) * 34, easing: SPRING }]);
    each("sky", (i) => [twinkleLoop, { duration: 900 + (i % 5) * 160, delay: 1100 + (i % 7) * 90, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, 500);
    run("word", lift, 900, 600, SWAY);
    run("sparkle", sparkleTwinkle, 600, 900, SWAY);
    return list;
  },
};

// ---------- 2. a crescent moon drifting in, stars around it ----------
const MOON_STARS = scatter(23, 16, { y1: 36, gap: 6 });
const MOON_LOW = scatter(29, 7, { y0: 66, y1: 94, gap: 8 });
const MOON = {
  id: "moon",
  beat: 1400,
  back: () =>
    piece("moon", at(37, 24, 7.2), svg("-50 -50 100 100", `<path d="M16-44A46 46 0 1 0 44 18 38 38 0 1 1 16-44Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="3.5" stroke-linejoin="round"/>`), "filter:drop-shadow(0 0 0.6em #fff5d6);") +
    [...MOON_STARS, ...MOON_LOW]
      .map((p, i) => piece("mstar", at(p.x, p.y, (i % 3 === 0 ? 1 : 1.6 + p.j) * DEPTH[depth(p.k)].size), i % 3 === 0 ? shape.dot(i % 2 ? PAPER : GOLD) : shape.star(i % 2 ? GOLD : LILAC_D), `opacity:${DEPTH[depth(p.k)].opacity};`))
      .join(""),
  play(root) {
    const { run, each, list } = animator(root);
    run("moon", [{ transform: "translate(-160%, 90%) rotate(-40deg) scale(0.6)", opacity: 0 }, { transform: "translate(8%, -6%) rotate(6deg) scale(1.04)", opacity: 1, offset: 0.75 }, { transform: "none", opacity: 1 }], 1000, 0, SOFT);
    each("mstar", (i) => [appear(1.6), { duration: 380, delay: 300 + i * 42, easing: SPRING }]);
    each("mstar", (i) => [twinkleLoop, { duration: 800 + (i % 4) * 200, delay: 1300 + (i % 6) * 80, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, 700);
    run("sparkle", sparkleTwinkle, 600, 1000, SWAY);
    return list;
  },
};

// ---------- 3. little hearts floating up across the whole screen ----------
const HEART_SET = scatter(37, 22, { x0: 25, x1: 75, y0: 66, y1: 106, gap: 6.5, word: true });
const HEARTS = {
  id: "hearts",
  beat: 1350,
  back: () =>
    HEART_SET.map((p, i) => {
      const d = depth(p.k);
      const size = (1.3 + p.j * 1.6) * DEPTH[d].size;
      const art = i % 3 === 0 ? shape.heartLine(i % 2 ? ROSE : LILAC_D) : shape.heart(i % 2 ? PINK : LILAC, i % 2 ? PINK_D : LILAC_D);
      return piece(`fheart opening__fheart--${d}`, at(p.x, p.y, size), art, `opacity:${DEPTH[d].opacity};`);
    }).join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("fheart", (i, node) => {
      const d = Number(node.className.match(/fheart--(\d)/)[1]);
      const size = (1.3 + HEART_SET[i].j * 1.6) * DEPTH[d].size;
      // Up the whole screen (a share of it, turned into the heart's own heights); nearer ones faster.
      const rise = r(((78 + d * 10) / size) * 100);
      const sway = r(((i % 2 ? 1 : -1) * (2.5 + (i % 3) * 1.5) / size) * 100);
      return [
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
          { transform: `translate(${sway}%, ${-rise * 0.35}%) rotate(${sway / 6}deg)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${-sway * 0.6}%, ${-rise * 0.7}%) rotate(${-sway / 8}deg)`, opacity: 1, offset: 0.65 },
          { transform: `translate(${sway * 0.4}%, ${-rise}%) rotate(0deg)`, opacity: 0 },
        ],
        { duration: 2600 - d * 300, delay: (i * 97) % 900, easing: "linear", iterations: Infinity },
      ];
    });
    glowIn(run, 450, 0.95, 0.75);
    run("word", lift, 1000, 500, SWAY);
    run("sparkle", sparkleTwinkle, 600, 950, SWAY);
    return list;
  },
};

// ---------- 4. a shower of tiny sparkles settling into the letters ----------
const SHOWER = Array.from({ length: 22 }, (_, i) => {
  const rand = seeded(53 + i);
  const target = LETTER_POINTS[i % LETTER_POINTS.length];
  return { x: 27 + rand() * 46, y: 2 + rand() * 20, tx: target.x + (rand() - 0.5) * 3, ty: target.y + (rand() - 0.5) * 6, k: rand() };
});
const SHOWERS = {
  id: "shower",
  beat: 1400,
  front: () =>
    SHOWER.map((p, i) => piece("drop", at(p.x, p.y, i % 3 === 0 ? 1.2 : 1.8 + p.k), i % 3 === 0 ? shape.dot(i % 2 ? PAPER : GOLD) : shape.star([GOLD, PAPER, PINK_D][i % 3]))).join("") +
    scatter(61, 10, { gap: 9 })
      .map((p) => piece("glint", at(p.x, p.y, 1.3), shape.star(LILAC_D), "opacity:.6;"))
      .join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("drop", (i) => {
      const p = SHOWER[i];
      const size = i % 3 === 0 ? 1.2 : 1.8 + p.k;
      const dx = ((p.tx - p.x) / size) * 100;
      const dy = ((p.ty - p.y) / size) * 100;
      return [
        [
          { transform: "translate(0, 0) scale(0.6) rotate(0deg)", opacity: 0 },
          { transform: `translate(${r(dx * 0.25)}%, ${r(dy * 0.3)}%) scale(1) rotate(60deg)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${r(dx)}%, ${r(dy)}%) scale(1.3) rotate(200deg)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${r(dx)}%, ${r(dy)}%) scale(0) rotate(240deg)`, opacity: 0 },
        ],
        { duration: 900 + (i % 5) * 70, delay: (i * 37) % 420, easing: "cubic-bezier(0.5, 0, 0.75, 0.6)" },
      ];
    });
    each("glint", (i) => [appear(1.5), { duration: 400, delay: 200 + i * 80, easing: SPRING }]);
    // The word drinks the light in: a glow that swells as the sparkles land.
    glowIn(run, 650, 1, 0.75);
    run("word", lift, 700, 900, SWAY);
    run("sparkle", sparkleTwinkle, 600, 1100, SWAY);
    return list;
  },
};

// ---------- 5. a gust of petals sweeping across ----------
const PETAL_SET = scatter(71, 20, { x0: 8, x1: 34, y0: 4, y1: 96, gap: 5.5, word: true });
const petalSize = (p) => (2.4 + p.j * 1.4) * DEPTH[depth(p.k)].size;
const PETALS = {
  id: "petals",
  beat: 1400,
  back: () =>
    PETAL_SET.map((p, i) => {
      const d = depth(p.k);
      return piece(
        `gust opening__gust--${d}`,
        at(p.x, p.y, petalSize(p)),
        i % 2 ? shape.petal(PINK, PINK_D) : shape.petal(LILAC, LILAC_D),
        `opacity:${Math.min(1, DEPTH[d].opacity + 0.15)};`,
      );
    }).join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("gust", (i) => {
      const p = PETAL_SET[i];
      const size = petalSize(p);
      const across = ((84 - p.x) / size) * 100; // to past the right edge, in its own widths
      const wave = (i % 2 ? 1 : -1) * (90 + (i % 4) * 45);
      const turn = Math.round(p.j * 180); // its own angle, turned after it moves (so it never steers it)
      return [
        [
          { transform: `translate(0, 0) rotate(${turn}deg)`, opacity: 0 },
          { transform: `translate(${r(across * 0.3)}%, ${wave}%) rotate(${turn + 160}deg)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${r(across * 0.65)}%, ${-wave * 0.6}%) rotate(${turn + 320}deg)`, opacity: 1, offset: 0.65 },
          { transform: `translate(${r(across)}%, ${wave * 0.5}%) rotate(${turn + 480}deg)`, opacity: 0 },
        ],
        { duration: 1500 + (i % 4) * 180, delay: (i * 53) % 600, easing: "cubic-bezier(0.3, 0.1, 0.6, 1)" },
      ];
    });
    run("word", [{ transform: "rotate(0deg)" }, { transform: "rotate(-1.4deg) translateY(-0.8%)", offset: 0.4 }, { transform: "rotate(0.6deg)", offset: 0.75 }, { transform: "rotate(0deg)" }], 1100, 350, SWAY);
    glowIn(run, 600, 0.85, 0.6);
    run("sparkle", sparkleTwinkle, 600, 1000, SWAY);
    return list;
  },
};

// ---------- 6. silk ribbons sweeping across ----------
const RIBBONS_AT = [
  [18, PINK_D, PINK],
  [69, LILAC_D, LILAC],
  [86, ROSE, PINK],
];
const RIBBON_WAVE = "M0 30C60 6 110 6 170 30S280 54 340 30 450 6 510 30 620 54 680 30";
const RIBBONS = {
  id: "ribbons",
  beat: 1400,
  back: () =>
    RIBBONS_AT.map(([y, edge, face], i) =>
      piece(
        `ribbon opening__ribbon--${i}`,
        at(50, y, 58, 5.2),
        svg("0 0 680 60", `<path d="${RIBBON_WAVE}" fill="none" stroke="${edge}" stroke-width="13" stroke-linecap="round"/><path d="${RIBBON_WAVE}" fill="none" stroke="${face}" stroke-width="7" stroke-linecap="round"/><path d="${RIBBON_WAVE}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7" transform="translate(0 -2)"/>`),
        `opacity:${i === 1 ? 0.95 : 0.75};`,
      ),
    ).join("") +
    scatter(83, 14, { gap: 8 })
      .map((p, i) => piece("rspark", at(p.x, p.y, i % 3 === 0 ? 1.1 : 1.6), i % 3 === 0 ? shape.dot(GOLD) : i % 3 === 1 ? shape.heart(PINK, PINK_D) : shape.star(LILAC_D)))
      .join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("ribbon", (i) => {
      const from = i % 2 ? 110 : -110;
      return [
        [
          { transform: `translateX(${from}%) translateY(0) rotate(${i % 2 ? 4 : -4}deg)`, opacity: 0 },
          { transform: `translateX(${from * 0.45}%) translateY(-18%) rotate(0deg)`, opacity: 1, offset: 0.35 },
          { transform: `translateX(${-from * 0.2}%) translateY(12%) rotate(${i % 2 ? -3 : 3}deg)`, opacity: 1, offset: 0.75 },
          { transform: `translateX(${-from}%) translateY(0) rotate(0deg)`, opacity: 0 },
        ],
        { duration: 1900, delay: i * 160, easing: "cubic-bezier(0.35, 0.1, 0.55, 1)" },
      ];
    });
    each("rspark", (i) => [appear(1.5), { duration: 420, delay: 350 + i * 55, easing: SPRING }]);
    each("rspark", (i) => [twinkleLoop, { duration: 900 + (i % 4) * 150, delay: 1200 + (i % 5) * 90, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, 550, 0.9, 0.65);
    run("word", lift, 1000, 450, SWAY);
    run("sparkle", sparkleTwinkle, 600, 1000, SWAY);
    return list;
  },
};

// ---------- 7. a soft night sky, and a shooting star underlining her name ----------
const NIGHT_STARS = scatter(97, 22, { gap: 6.5, y1: 92 });
const LINE_Y = 61.6;
const NIGHT = {
  id: "night",
  beat: 1450,
  back: () =>
    piece("dusk", "inset:0;", "", "background:linear-gradient(180deg, #4b3478 0%, #7b5ea8cc 30%, #b79bd640 62%, #b79bd600 80%);") +
    NIGHT_STARS.map((p, i) => piece("nstar", at(p.x, p.y, (i % 3 === 0 ? 0.9 : 1.4 + p.j * 1.1) * DEPTH[depth(p.k)].size), i % 3 === 0 ? shape.dot(PAPER) : shape.star(i % 2 ? "#fff6d6" : PAPER), `opacity:${DEPTH[depth(p.k)].opacity};`)).join(""),
  front: () =>
    piece("trail", at(50, LINE_Y, 36, 0.9), svg("0 0 360 10", `<defs><linearGradient id="opening-trail"><stop offset="0" stop-color="${LILAC_D}" stop-opacity="0"/><stop offset=".55" stop-color="${PINK_D}"/><stop offset="1" stop-color="#fff6d6"/></linearGradient></defs><rect x="0" y="3.5" width="360" height="3" rx="1.5" fill="url(#opening-trail)"/>`), "transform-origin:0% 50%;") +
    piece("comet", at(32, LINE_Y, 3.6), svg("-11 -11 22 22", `<circle r="8" fill="#fff6d6" opacity=".55"/><path d="${STAR4}" fill="${GOLD}"/>`)),
  play(root) {
    const { run, each, list } = animator(root);
    run("dusk", [{ opacity: 0 }, { opacity: 0.75 }], 700, 0, "ease-out");
    each("nstar", (i) => [appear(1.5), { duration: 380, delay: 150 + ((i * 5) % 22) * 30, easing: SPRING }]);
    each("nstar", (i) => [twinkleLoop, { duration: 800 + (i % 5) * 170, delay: 1000 + (i % 6) * 80, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    const travel = (36 / 3.6) * 100;
    run("comet", [{ transform: "translateX(-60%) scale(0.5)", opacity: 0 }, { transform: "translateX(0) scale(1)", opacity: 1, offset: 0.12 }, { transform: `translateX(${travel}%) scale(1)`, opacity: 1, offset: 0.85 }, { transform: `translateX(${travel + 30}%) scale(0.4)`, opacity: 0 }], 760, 550, "cubic-bezier(0.45, 0, 0.3, 1)");
    run("trail", [{ transform: "scaleX(0)", opacity: 1 }, { transform: "scaleX(1)", opacity: 1, offset: 0.8 }, { transform: "scaleX(1)", opacity: 0.6 }], 820, 600, "cubic-bezier(0.45, 0, 0.3, 1)");
    glowIn(run, 300, 1, 0.85);
    run("sparkle", sparkleTwinkle, 600, 1250, SWAY);
    return list;
  },
};

// ---------- 8. a constellation joining into a heart above her name ----------
const HEART_POINTS = [0, 0.5, 1.05, 1.65, 2.3, 2.8, Math.PI, 3.48, 3.98, 4.63, 5.23, 5.78].map((t) => {
  const x = 16 * Math.sin(t) ** 3;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: 50 + x * 0.6, y: 22 + y * 0.6 };
});
const CONSTELLATION_LINES = HEART_POINTS.map((p, i) => {
  const q = HEART_POINTS[(i + 1) % HEART_POINTS.length];
  return { x: p.x, y: p.y, len: Math.hypot(q.x - p.x, q.y - p.y), angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
});
const CONSTELLATION = {
  id: "constellation",
  beat: 1450,
  back: () =>
    scatter(109, 16, { gap: 7 })
      .filter((p) => Math.hypot(p.x - 50, p.y - 25) > 14)
      .map((p, i) => piece("cstar", at(p.x, p.y, (i % 3 === 0 ? 0.9 : 1.3 + p.j) * DEPTH[depth(p.k)].size), i % 3 === 0 ? shape.dot(PAPER) : shape.star(i % 2 ? LILAC_D : PAPER), `opacity:${DEPTH[depth(p.k)].opacity * 0.85};`))
      .join("") +
    CONSTELLATION_LINES.map((l) => piece("cline", `left:${r(l.x)}%;top:${r(l.y - 0.12)}%;width:${r(l.len)}%;height:0.24%;`, "", `transform-origin:0% 50%;rotate:${r(l.angle)}deg;background:linear-gradient(90deg, #fff6fc, ${PINK_D});border-radius:1px;opacity:.9;`)).join("") +
    HEART_POINTS.map((p, i) => piece("cpoint", at(p.x, p.y, i === 0 || i === 6 ? 2.6 : 1.9), shape.star(i === 0 || i === 6 ? GOLD : PAPER), "filter:drop-shadow(0 0 0.3em #fff6fc);")).join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("cstar", (i) => [appear(1.4), { duration: 380, delay: 60 + i * 40, easing: SPRING }]);
    each("cpoint", (i) => [appear(1.6), { duration: 340, delay: 200 + i * 75, easing: SPRING }]);
    each("cline", (i) => [[{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 110, delay: 270 + i * 75, easing: "ease-out" }]);
    each("cpoint", (i) => [twinkleLoop, { duration: 900 + (i % 3) * 200, delay: 1350 + i * 40, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, 800, 1, 0.75);
    run("word", lift, 900, 1000, SWAY);
    run("sparkle", sparkleTwinkle, 600, 1150, SWAY);
    return list;
  },
};

// ---------- 9. soft dreamy lights rising behind and around ----------
const GLINT_SET = scatter(127, 16, { gap: 9, word: true });
const LIGHTS = {
  id: "lights",
  beat: 1300,
  back: () =>
    GLINT_SET.map((p, i) => {
      const d = depth(p.k);
      const size = (3.4 + p.j * 4.6) * (d === 0 ? 1.25 : d === 1 ? 0.9 : 0.65);
      const tint = ["#ffffff", "#ffd9ec", "#e6d4fb", "#fff3d6"][i % 4];
      return piece("bokeh", at(p.x, p.y, size), "", `border-radius:50%;background:radial-gradient(circle, ${tint} 0%, ${tint}cc 38%, ${tint}00 70%);opacity:${d === 0 ? 0.55 : 0.8};`);
    }).join(""),
  front: () =>
    scatter(131, 12, { gap: 8 })
      .map((p, i) => piece("lspark", at(p.x, p.y, i % 2 ? 1.2 : 1.7), i % 2 ? shape.dot(PAPER) : shape.star(i % 4 === 0 ? GOLD : PINK_D)))
      .join(""),
  play(root) {
    const { run, each, list } = animator(root);
    each("bokeh", (i) => [
      [
        { transform: "translateY(30%) scale(0.6)", opacity: 0 },
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.35 },
        { transform: "translateY(-45%) scale(1.08)", opacity: 1, offset: 0.75 },
        { transform: "translateY(-70%) scale(1.1)", opacity: 0.85 },
      ],
      { duration: 1800 + (i % 4) * 250, delay: (i * 61) % 500, easing: "ease-out" },
    ]);
    each("lspark", (i) => [appear(1.5), { duration: 400, delay: 300 + i * 70, easing: SPRING }]);
    each("lspark", (i) => [twinkleLoop, { duration: 850 + (i % 4) * 160, delay: 1200 + (i % 5) * 80, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, 300, 1, 0.8);
    run("word", lift, 1000, 350, SWAY);
    run("sparkle", sparkleTwinkle, 600, 850, SWAY);
    return list;
  },
};

// ---------- 10. a sparkle re-inking her name, letter by letter ----------
const PEN_PATH = LETTER_POINTS.map((p, i) => ({ x: p.x, y: p.y + (i % 2 ? -3 : 2.5) }));
const WRITE = {
  id: "write",
  beat: 1500,
  letters: true,
  back: () =>
    scatter(149, 14, { gap: 8 })
      .map((p, i) => piece("wstar", at(p.x, p.y, (i % 3 === 0 ? 1 : 1.5 + p.j) * DEPTH[depth(p.k)].size), i % 3 === 0 ? shape.dot(GOLD) : shape.star(i % 2 ? LILAC_D : PINK_D), `opacity:${DEPTH[depth(p.k)].opacity};`))
      .join(""),
  front: () =>
    PEN_PATH.map((p, i) => piece("ink", at(p.x, p.y + 4, 1.2), shape.star(i % 2 ? GOLD : PINK_D))).join("") +
    piece("pen", at(PEN_PATH[0].x, PEN_PATH[0].y, 3.4), svg("-11 -11 22 22", `<circle r="8" fill="#fff6d6" opacity=".6"/><path d="${STAR4}" fill="${GOLD}"/>`)),
  play(root) {
    const { run, each, list } = animator(root);
    const step = 150;
    const start = 260;
    // Her name goes faint, then the sparkle writes it back in, one letter at a time.
    each("letter", (i) => {
      const total = start + 260 + i * step + 300;
      const back = (start + 260 + i * step) / total;
      return [
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0.14, transform: "translateY(0) scale(1)", offset: Math.min(0.2, back * 0.5) },
          { opacity: 0.14, transform: "translateY(2%) scale(0.97)", offset: back },
          { opacity: 1, transform: "translateY(-2%) scale(1.03)", offset: back + (1 - back) * 0.55 },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: total, delay: 0, easing: "linear" },
      ];
    });
    // The pen reaches each letter just as it comes back, then flies up to become the sparkle.
    const size = 3.4;
    const reach = (i) => start + 260 + i * step;
    const total = reach(PEN_PATH.length - 1) + 320;
    const frames = PEN_PATH.map((p, i) => ({
      transform: `translate(${r(((p.x - PEN_PATH[0].x) / size) * 100)}%, ${r(((p.y - PEN_PATH[0].y) / size) * 100)}%) rotate(${i * 50}deg)`,
      opacity: 1,
      offset: r(reach(i) / total),
    }));
    const sx = ((S(SPARKLE.x) - PEN_PATH[0].x) / size) * 100;
    const sy = ((S(SPARKLE.y) - PEN_PATH[0].y) / size) * 100;
    run(
      "pen",
      [
        { transform: "translate(-80%, 0) scale(0.4)", opacity: 0, offset: 0 },
        { transform: "translate(-40%, 0) scale(0.8)", opacity: 1, offset: r(start / total) },
        ...frames,
        { transform: `translate(${r(sx)}%, ${r(sy)}%) rotate(360deg) scale(0.6)`, opacity: 0, offset: 1 },
      ],
      total,
      0,
      "linear",
    );
    each("ink", (i) => [appear(1.6), { duration: 380, delay: start + 260 + i * step, easing: SPRING }]);
    each("wstar", (i) => [appear(1.4), { duration: 380, delay: 200 + i * 60, easing: SPRING }]);
    each("wstar", (i) => [twinkleLoop, { duration: 850 + (i % 4) * 170, delay: 1300 + (i % 5) * 90, iterations: Infinity, direction: "alternate", easing: SWAY }]);
    glowIn(run, start + PEN_PATH.length * step, 1, 0.75);
    run("sparkle", sparkleTwinkle, 600, start + PEN_PATH.length * step + 400, SWAY);
    return list;
  },
};

export const SCENES = [STARS, MOON, HEARTS, SHOWERS, PETALS, RIBBONS, NIGHT, CONSTELLATION, LIGHTS, WRITE];
