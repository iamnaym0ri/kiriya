// The ten opening scenes (index.js plays one per launch). Original art, drawn here in the app's lilac.
//
// Every scene starts on the native splash's own frame: the lilac backdrop, the "kiriya" wordmark and
// its sparkle exactly where the launch image has them (wordmark.js), so the hand-over is invisible.
// Pieces live on a square stage the size of the launch image drawn aspect-fill (opening.css), and are
// placed in % of it: the word spans 35–65% across and 41–59% down; a phone shows roughly 27–73% across.
// Each piece is an HTML box holding a still SVG, moved only by transform and opacity (the Web
// Animations API), so every movement runs on the compositor while the app loads underneath.
import { LETTERS, SPARKLE, SPLASH, WORD } from "./wordmark.js";

const INK = "#4e2f63";
const SPARK = "#9a6fb4";
const PAPER = "#fff9fd";
const LILAC = "#d9c3ee";
const LILAC_D = "#a27cc7";
const PINK = "#f6cfe0";
const PINK_D = "#e597bd";
const ROSE = "#c46d98";
const CREAM = "#fbefcf";
const MINT = "#c9ebe1";
const GOLD = "#f3d58c";

const r = (n) => Math.round(n * 1000) / 1000;
/** Launch-image units (0–2732) to % of the stage. */
const S = (n) => (n / SPLASH) * 100;
/** A box centred on (cx, cy), all in % of the stage. */
const at = (cx, cy, w, h) => `left:${r(cx - w / 2)}%;top:${r(cy - h / 2)}%;width:${r(w)}%;height:${r(h)}%;`;
const piece = (name, place, inner, style = "") => `<div class="opening__piece opening__${name}" style="${place}${style}">${inner}</div>`;
const svg = (viewBox, inner) => `<svg viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;

const HEART = "M0 9C-7 4-10 0-10-4-10-7.5-7.5-10-4.6-10-2.6-10-1-8.9 0-7.3 1-8.9 2.6-10 4.6-10 7.5-10 10-7.5 10-4 10 0 7 4 0 9Z";
const STAR4 = "M0-10Q1.8-1.8 10 0 1.8 1.8 0 10-1.8 1.8-10 0-1.8-1.8 0-10Z";
const heartSvg = (fill, stroke = ROSE) => svg("-12 -12 24 23", `<path d="${HEART}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`);
const starSvg = (fill) => svg("-11 -11 22 22", `<path d="${STAR4}" fill="${fill}"/>`);

// ---------- the splash's own frame ----------

const B = WORD.box;
const WORD_CX = S(B.x + B.w / 2);
const WORD_CY = S(B.y + B.h / 2);

function wordSvg(letters, box) {
  const paths = letters.map((l) => `<path transform="translate(${l.ox} ${l.oy})" d="${l.d}"/>`).join("");
  return `<svg viewBox="${r(box.x)} ${r(box.y)} ${r(box.w)} ${r(box.h)}" preserveAspectRatio="none" aria-hidden="true"><g fill="${INK}" stroke="${INK}" stroke-width="${WORD.stroke}" stroke-linejoin="round" transform="translate(${WORD.tx} ${WORD.ty}) scale(${WORD.scale} ${-WORD.scale})">${paths}</g></svg>`;
}
const wordPiece = () => piece("word", at(WORD_CX, WORD_CY, S(B.w), S(B.h)), wordSvg(LETTERS, B));
/** The word as six boxes, one per letter (all as tall as the word, so one hop height suits each). */
const letterPieces = () =>
  LETTERS.map((l, i) => piece(`letter opening__letter--${i}`, at(S(l.x + l.w / 2), WORD_CY, S(l.w), S(B.h)), wordSvg([l], { x: l.x, y: B.y, w: l.w, h: B.h }))).join("");
const SPARKLE_SIZE = S(100 * SPARKLE.unit);
const sparklePiece = () => piece("sparkle", at(S(SPARKLE.x), S(SPARKLE.y), SPARKLE_SIZE, SPARKLE_SIZE), svg("-50 -50 100 100", `<path fill="${SPARK}" d="${SPARKLE.d}"/>`));

/** The launch image's backdrop (scripts/make-app-icon.mjs, the lilac theme), drawn the same way. */
export function backdropMarkup() {
  return `<svg class="opening__backdrop" viewBox="0 0 ${SPLASH} ${SPLASH}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="opening-bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#f3e9fa"/><stop offset="0.55" stop-color="#e2cff0"/><stop offset="1" stop-color="#cfb2e4"/></linearGradient><radialGradient id="opening-glow" cx="0.78" cy="0.18" r="0.55"><stop offset="0" stop-color="#ffe6f1" stop-opacity="0.85"/><stop offset="1" stop-color="#ffe6f1" stop-opacity="0"/></radialGradient></defs><rect width="${SPLASH}" height="${SPLASH}" fill="url(#opening-bg)"/><rect width="${SPLASH}" height="${SPLASH}" fill="url(#opening-glow)"/></svg>`;
}

/** The scene's pieces, with the word and sparkle on top (or the word in letters, for the hop). */
export function sceneMarkup(scene) {
  const word = scene?.letters ? letterPieces() : wordPiece();
  return `${scene ? scene.back?.() ?? "" : ""}${word}${sparklePiece()}${scene ? scene.front?.() ?? "" : ""}`;
}

// ---------- a little motion kit ----------

function animator(root) {
  const list = [];
  const moved = new Set();
  // A piece's first animation also holds its first frame until it starts (so pieces that arrive
  // later are hidden until then); any later one on the same piece only takes over when it starts.
  const run = (selector, frames, duration, delay = 0, easing = "cubic-bezier(0.25, 0.8, 0.3, 1)", options = {}) => {
    root.querySelectorAll(`.opening__${selector}`).forEach((node) => {
      const fill = moved.has(node) ? "forwards" : "both";
      moved.add(node);
      list.push(node.animate(frames, { duration, delay, easing, fill, ...options }));
    });
  };
  return { run, list };
}
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SOFT = "cubic-bezier(0.25, 0.8, 0.3, 1)";
const pop = (scale = 1.25) => [
  { transform: "scale(0)", opacity: 0 },
  { transform: `scale(${scale})`, opacity: 1, offset: 0.6 },
  { transform: "scale(1)", opacity: 1 },
];
const twinkle = [
  { transform: "scale(1) rotate(0deg)" },
  { transform: "scale(1.45) rotate(45deg)", offset: 0.45 },
  { transform: "scale(1) rotate(90deg)" },
];
const happyBounce = [
  { transform: "scale(1)" },
  { transform: "scale(1.045)", offset: 0.4 },
  { transform: "scale(0.99)", offset: 0.75 },
  { transform: "scale(1)" },
];

// ---------- the scenes ----------

const ENVELOPE = {
  id: "letter",
  beat: 1350,
  back: () => "",
  front: () =>
    piece(
      "env",
      at(50, 75, 15, 10.4),
      piece("env-open", "inset:0;", svg("0 0 110 76", `<path d="M5 6 L55 42 L105 6Z" fill="#f1e4f8" stroke="${LILAC_D}" stroke-width="3" stroke-linejoin="round"/>`), "transform-origin:50% 7.9%;") +
        piece("env-back", "inset:0;", svg("0 0 110 76", `<rect x="4" y="5" width="102" height="67" rx="9" fill="#efe0f7" stroke="${LILAC_D}" stroke-width="3"/>`)) +
        piece("env-heart", "left:31%;top:12%;width:38%;height:52%;", heartSvg(PINK_D)) +
        piece(
          "env-front",
          "inset:0;",
          svg("0 0 110 76", `<path d="M4 26 L55 54 L106 26 V63a9 9 0 0 1-9 9H13a9 9 0 0 1-9-9Z" fill="${PAPER}" stroke="${LILAC_D}" stroke-width="3" stroke-linejoin="round"/><path d="M8 68 L40 46M102 68 L70 46" stroke="${LILAC}" stroke-width="2.5" stroke-linecap="round"/>`),
        ) +
        piece(
          "env-flap",
          "inset:0;",
          svg("0 0 110 76", `<path d="M5 6 L55 44 L105 6Z" fill="#f7eefb" stroke="${LILAC_D}" stroke-width="3" stroke-linejoin="round"/><g transform="translate(55 40) scale(.62)"><path d="${HEART}" fill="${ROSE}"/></g>`),
          "transform-origin:50% 7.9%;",
        ),
    ) +
    piece("env-spark opening__env-spark--a", at(40, 63, 2.8, 2.8), starSvg(GOLD)) +
    piece("env-spark opening__env-spark--b", at(60.5, 62, 2.4, 2.4), starSvg(PINK_D)) +
    piece("env-spark opening__env-spark--c", at(57, 68.5, 1.8, 1.8), starSvg(LILAC_D)),
  play(root) {
    const { run, list } = animator(root);
    run("env", [{ transform: "translateY(55%)", opacity: 0 }, { transform: "translateY(-4%)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], 420, 0, SOFT);
    run("env-flap", [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 150, 430, "ease-in");
    run("env-open", [{ transform: "scaleY(0)" }, { transform: "scaleY(-1)" }], 170, 580, "ease-out");
    run(
      "env-heart",
      [
        { transform: "translateY(30%) scale(0.4)", opacity: 0 },
        { transform: "translateY(-120%) scale(1.25)", opacity: 1, offset: 0.45 },
        { transform: "translateY(-170%) scale(1.05)", opacity: 1, offset: 0.75 },
        { transform: "translateY(-160%) scale(1.1)", opacity: 1 },
      ],
      620,
      640,
      SOFT,
    );
    run("env-spark", pop(1.4), 420, 1010, SPRING);
    run("word", happyBounce, 520, 980, "ease-out");
    run("sparkle", twinkle, 600, 1050, "ease-in-out");
    return list;
  },
};

const JAR = {
  id: "jar",
  beat: 1400,
  front: () =>
    piece("note opening__note--a", at(50, 66, 3.2, 2.5), svg("0 0 26 20", `<rect x="2" y="2" width="22" height="16" rx="3" fill="${PINK}" stroke="${ROSE}" stroke-width="1.6"/><path d="M6 8h12M6 12h8" stroke="${ROSE}" stroke-width="1.4" stroke-linecap="round"/>`)) +
    piece("note opening__note--b", at(50, 66, 3, 2.3), svg("0 0 26 20", `<rect x="2" y="2" width="22" height="16" rx="3" fill="${CREAM}" stroke="#c4a45e" stroke-width="1.6"/><path d="M6 8h12M6 12h9" stroke="#c4a45e" stroke-width="1.4" stroke-linecap="round"/>`)) +
    piece("jar-star", at(50, 66, 4, 4), starSvg(GOLD)) +
    piece(
      "jar",
      at(50, 75, 10.4, 15.6),
      svg(
        "0 0 80 120",
        `<path d="M14 42h52q7 0 7 9v53q0 13-13 13H20Q7 117 7 104V51q0-9 7-9z" fill="#f8f1fc" fill-opacity=".92" stroke="${LILAC_D}" stroke-width="3"/>` +
          `<rect x="15" y="86" width="17" height="13" rx="3" fill="${PINK}" transform="rotate(-14 23 92)"/><rect x="33" y="90" width="17" height="13" rx="3" fill="${CREAM}" transform="rotate(9 41 96)"/><rect x="48" y="84" width="16" height="13" rx="3" fill="${MINT}" transform="rotate(-6 56 90)"/><rect x="24" y="100" width="17" height="12" rx="3" fill="${LILAC}" transform="rotate(5 32 106)"/><rect x="44" y="102" width="16" height="11" rx="3" fill="${PINK}" transform="rotate(-10 52 107)"/>` +
          `<g transform="translate(40 66) scale(.85)"><path d="${HEART}" fill="${PINK_D}"/></g><path d="M15 54v30" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>`,
      ) + piece("jar-lid", "left:4%;top:18%;width:92%;height:21%;", svg("0 0 74 26", `<rect x="6" y="2" width="62" height="13" rx="5" fill="${LILAC_D}"/><rect x="2" y="12" width="70" height="11" rx="5" fill="${LILAC}" stroke="${LILAC_D}" stroke-width="2"/>`), "transform-origin:20% 100%;"),
      "transform-origin:50% 100%;",
    ),
  play(root) {
    const { run, list } = animator(root);
    run("jar", [{ transform: "translateY(30%) scale(0.6)", opacity: 0 }, { transform: "scale(1.06)", opacity: 1, offset: 0.65 }, { transform: "none", opacity: 1 }], 380, 0, SOFT);
    const shake = [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-9deg)", offset: 0.15 },
      { transform: "rotate(8deg)", offset: 0.33 },
      { transform: "rotate(-7deg)", offset: 0.5 },
      { transform: "rotate(6deg)", offset: 0.67 },
      { transform: "rotate(-3deg)", offset: 0.84 },
      { transform: "rotate(0deg)" },
    ];
    run("jar", shake, 480, 380, "ease-in-out");
    run("jar-lid", [{ transform: "none" }, { transform: "translateY(-80%) rotate(-18deg)", offset: 0.45 }, { transform: "none" }], 320, 790, "ease-out");
    // The star flies out in an arc and becomes the wordmark's own sparkle.
    const dx = ((S(SPARKLE.x) - 50) / 4) * 100;
    const dy = ((S(SPARKLE.y) - 66) / 4) * 100;
    run(
      "jar-star",
      [
        { transform: "translate(0, 0) scale(0.5) rotate(0deg)", opacity: 0 },
        { transform: `translate(${r(dx * 0.12)}%, -230%) scale(1.15) rotate(90deg)`, opacity: 1, offset: 0.28 },
        { transform: `translate(${r(dx * 0.6)}%, ${r(dy * 1.22)}%) scale(1.2) rotate(240deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${r(dx)}%, ${r(dy)}%) scale(0.7) rotate(360deg)`, opacity: 0 },
      ],
      580,
      820,
      "cubic-bezier(0.3, 0.6, 0.5, 1)",
    );
    run("note--a", [{ transform: "none", opacity: 0 }, { transform: "translate(-170%, -190%) rotate(-24deg)", opacity: 1, offset: 0.4 }, { transform: "translate(-280%, -140%) rotate(-40deg)", opacity: 0 }], 650, 850, SOFT);
    run("note--b", [{ transform: "none", opacity: 0 }, { transform: "translate(180%, -220%) rotate(20deg)", opacity: 1, offset: 0.4 }, { transform: "translate(290%, -170%) rotate(38deg)", opacity: 0 }], 650, 890, SOFT);
    run("sparkle", twinkle, 520, 1330, "ease-in-out");
    return list;
  },
};

const BOW = {
  id: "bow",
  beat: 1300,
  front: () => {
    const loop = (flip) =>
      svg(
        "0 0 120 80",
        `<g ${flip ? 'transform="translate(120 0) scale(-1 1)"' : ""}><path d="M58 35C44 10 12 4 9 26 6 48 38 54 58 40Z" fill="${PINK_D}" stroke="${ROSE}" stroke-width="3" stroke-linejoin="round"/><path d="M50 33C38 20 22 16 18 26" fill="none" stroke="${PINK}" stroke-width="4" stroke-linecap="round"/></g>`,
      );
    return piece(
      "bow",
      at(50, 72, 17, 11.3),
      piece("bow-tails", "inset:0;", svg("0 0 120 80", `<path d="M56 40 41 76l9-3 6 6 3-36Z" fill="${PINK_D}" stroke="${ROSE}" stroke-width="3" stroke-linejoin="round"/><path d="M64 40l15 36-9-3-6 6-3-36Z" fill="${PINK_D}" stroke="${ROSE}" stroke-width="3" stroke-linejoin="round"/>`), "transform-origin:50% 48%;") +
        piece("bow-left", "inset:0;", loop(false), "transform-origin:50% 45%;") +
        piece("bow-right", "inset:0;", loop(true), "transform-origin:50% 45%;") +
        piece("bow-knot", "left:42%;top:33%;width:16%;height:24%;", svg("0 0 20 20", `<rect x="2" y="2" width="16" height="16" rx="6" fill="${ROSE}" stroke="#a24f7c" stroke-width="2"/><path d="M6 7q4-3 8 0" stroke="${PINK}" stroke-width="2" fill="none" stroke-linecap="round"/>`)),
      "transform-origin:50% 45%;",
    ) +
      piece("bow-heart opening__bow-heart--a", at(42, 65, 2.6, 2.5), heartSvg(PINK)) +
      piece("bow-heart opening__bow-heart--b", at(58.5, 64.5, 2.2, 2.1), heartSvg(LILAC, LILAC_D));
  },
  play(root) {
    const { run, list } = animator(root);
    run("bow-left", [{ transform: "translateX(-60%) rotate(-50deg) scale(0.5)", opacity: 0 }, { transform: "translateX(3%) rotate(8deg) scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], 460, 0, SOFT);
    run("bow-right", [{ transform: "translateX(60%) rotate(50deg) scale(0.5)", opacity: 0 }, { transform: "translateX(-3%) rotate(-8deg) scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], 460, 80, SOFT);
    run("bow-knot", pop(1.45), 300, 470, SPRING);
    run("bow-tails", [{ transform: "scaleY(0)", opacity: 0 }, { transform: "scaleY(1.1)", opacity: 1, offset: 0.7 }, { transform: "scaleY(1)", opacity: 1 }], 320, 600, SOFT);
    run("bow", [{ transform: "rotate(0deg)" }, { transform: "rotate(-9deg)", offset: 0.3 }, { transform: "rotate(7deg)", offset: 0.62 }, { transform: "rotate(-2deg)", offset: 0.85 }, { transform: "rotate(0deg)" }], 520, 820, "ease-in-out");
    run("bow-heart", [{ transform: "translateY(60%) scale(0)", opacity: 0 }, { transform: "translateY(-40%) scale(1.2)", opacity: 1, offset: 0.5 }, { transform: "translateY(-120%) scale(1)", opacity: 1 }], 600, 760, SOFT);
    run("word", happyBounce, 480, 640, "ease-out");
    run("sparkle", twinkle, 560, 900, "ease-in-out");
    return list;
  },
};

// Five petals fly in from all around and gather into a flower under the word.
const PETAL = "M0-6C-13-18-12-42 0-46 12-42 13-18 0-6Z";
const PETAL_FROM = [
  [-330, -260, -160],
  [300, -300, 140],
  [360, 120, 200],
  [-60, 330, -220],
  [-360, 150, -120],
];
const PETALS = {
  id: "petals",
  beat: 1400,
  front: () =>
    piece(
      "flower",
      at(50, 73, 13, 13),
      PETAL_FROM.map((_, i) =>
        piece(`petal opening__petal--${i}`, "inset:0;", svg("-50 -50 100 100", `<path d="${PETAL}" transform="rotate(${i * 72})" fill="${i % 2 ? LILAC : PINK}" stroke="${i % 2 ? LILAC_D : ROSE}" stroke-width="3" stroke-linejoin="round"/>`)),
      ).join("") + piece("flower-heart", "left:38%;top:38%;width:24%;height:24%;", svg("-12 -12 24 23", `<circle r="9" fill="${GOLD}" stroke="#c79a3c" stroke-width="2"/>`)),
      "transform-origin:50% 50%;",
    ) +
    piece("drift opening__drift--a", at(35, 30, 3.4, 3.4), svg("-50 -50 100 100", `<path d="${PETAL}" fill="${PINK}" stroke="${ROSE}" stroke-width="5"/>`)) +
    piece("drift opening__drift--b", at(63, 22, 2.8, 2.8), svg("-50 -50 100 100", `<path d="${PETAL}" fill="${LILAC}" stroke="${LILAC_D}" stroke-width="5"/>`)),
  play(root) {
    const { run, list } = animator(root);
    PETAL_FROM.forEach(([x, y, turn], i) =>
      run(
        `petal--${i}`,
        [
          { transform: `translate(${x}%, ${y}%) rotate(${turn}deg) scale(0.6)`, opacity: 0 },
          { transform: `translate(${r(x * 0.35)}%, ${r(y * 0.35 - 30)}%) rotate(${r(turn * 0.3)}deg) scale(0.9)`, opacity: 1, offset: 0.55 },
          { transform: "none", opacity: 1 },
        ],
        720,
        i * 90,
        "cubic-bezier(0.3, 0.7, 0.3, 1)",
      ),
    );
    run("flower-heart", pop(1.5), 340, 820, SPRING);
    run("flower", [{ transform: "rotate(0deg) scale(1)" }, { transform: "rotate(14deg) scale(1.08)", offset: 0.5 }, { transform: "rotate(18deg) scale(1)" }], 520, 880, "ease-out");
    run("drift", [{ transform: "translate(0, -200%) rotate(0deg)", opacity: 0 }, { transform: "translate(60%, 150%) rotate(120deg)", opacity: 0.9, offset: 0.5 }, { transform: "translate(120%, 420%) rotate(220deg)", opacity: 0 }], 1300, 100, "linear");
    run("word", happyBounce, 480, 860, "ease-out");
    run("sparkle", twinkle, 560, 950, "ease-in-out");
    return list;
  },
};

const PAW = {
  id: "paw",
  beat: 1300,
  front: () =>
    piece(
      "paw",
      at(50, 83, 12, 34),
      svg(
        "0 0 100 340",
        `<rect x="22" y="40" width="56" height="320" rx="28" fill="${LILAC}" stroke="${LILAC_D}" stroke-width="4"/><path d="M34 120v40M50 128v40M66 120v40" stroke="${LILAC_D}" stroke-width="3" stroke-linecap="round" opacity=".45"/>` +
          `<ellipse cx="50" cy="46" rx="40" ry="34" fill="${PAPER}" stroke="${LILAC_D}" stroke-width="4"/>` +
          `<ellipse cx="50" cy="58" rx="16" ry="12" fill="${PINK_D}"/><ellipse cx="25" cy="34" rx="7.5" ry="9" fill="${PINK_D}"/><ellipse cx="41" cy="22" rx="7.5" ry="9" fill="${PINK_D}"/><ellipse cx="59" cy="22" rx="7.5" ry="9" fill="${PINK_D}"/><ellipse cx="75" cy="34" rx="7.5" ry="9" fill="${PINK_D}"/>`,
      ),
    ) +
    piece("paw-heart", at(56, 62, 2.8, 2.7), heartSvg(PINK_D)) +
    piece("paw-star opening__paw-star--a", at(43, 61.5, 1.8, 1.8), starSvg(GOLD)) +
    piece("paw-star opening__paw-star--b", at(58, 59.5, 1.5, 1.5), starSvg(LILAC_D)),
  play(root) {
    const { run, list } = animator(root);
    run(
      "paw",
      [
        { transform: "translateY(100%)" },
        { transform: "translateY(6%)", offset: 0.34 },
        { transform: "translateY(6%)", offset: 0.4 },
        { transform: "translateY(-17%)", offset: 0.5 },
        { transform: "translateY(4%)", offset: 0.62 },
        { transform: "translateY(4%)", offset: 0.7 },
        { transform: "translateY(105%)" },
      ],
      1250,
      0,
      "ease-in-out",
    );
    // The tap: the word squishes and springs back.
    root.querySelector(".opening__word").style.transformOrigin = "50% 100%";
    run(
      "word",
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.05, 0.93)", offset: 0.25 },
        { transform: "scale(0.97, 1.04)", offset: 0.55 },
        { transform: "scale(1.01, 0.99)", offset: 0.8 },
        { transform: "scale(1, 1)" },
      ],
      520,
      600,
      "ease-out",
    );
    run("paw-heart", [{ transform: "translate(-80%, 40%) scale(0)", opacity: 0 }, { transform: "translate(0, -40%) scale(1.25)", opacity: 1, offset: 0.4 }, { transform: "translate(40%, -150%) scale(1)", opacity: 1 }], 700, 640, SOFT);
    run("paw-star", pop(1.5), 360, 650, SPRING);
    run("sparkle", twinkle, 560, 760, "ease-in-out");
    return list;
  },
};

const MOON_STARS = [
  [32, 22, 2.8, 380],
  [57, 17, 2.4, 480],
  [64, 30, 3, 560],
  [46, 12, 2, 640],
  [68, 20, 2.2, 720],
  [35, 36, 1.9, 800],
];
const MOON = {
  id: "moon",
  beat: 1400,
  back: () => piece("moon-glow", at(40, 30, 34, 34), svg("-50 -50 100 100", `<defs><radialGradient id="opening-moon-glow"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle r="50" fill="url(#opening-moon-glow)"/>`)),
  front: () =>
    piece("moon", at(40, 30, 11, 11), svg("-50 -50 100 100", `<path d="M14-42A44 44 0 1 0 40 18 36 36 0 1 1 14-42Z" fill="${GOLD}" stroke="#c79a3c" stroke-width="4" stroke-linejoin="round"/><circle cx="-14" cy="6" r="4" fill="#e9bf63" opacity=".7"/><circle cx="-2" cy="24" r="3" fill="#e9bf63" opacity=".6"/><path d="M-26-6q3 3 6 0M-14 8q3 3 6 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="-30" cy="6" rx="4" ry="2.5" fill="${PINK_D}" opacity=".7"/>`), "transform-origin:50% 50%;") +
    MOON_STARS.map(([x, y, size], i) => piece(`mstar opening__mstar--${i}`, at(x, y, size, size), starSvg(i % 3 === 0 ? GOLD : i % 3 === 1 ? LILAC_D : PINK_D))).join("") +
    piece("cloud", at(35, 38.5, 12, 5), svg("0 0 120 50", `<path d="M14 44h88a14 14 0 0 0 2-28 20 20 0 0 0-36-8 18 18 0 0 0-32 6 15 15 0 0 0-22 30Z" fill="${PAPER}" stroke="${LILAC}" stroke-width="3" stroke-linejoin="round"/>`)),
  play(root) {
    const { run, list } = animator(root);
    run("moon-glow", [{ opacity: 0 }, { opacity: 1 }], 700, 200, "ease-out");
    run("moon", [{ transform: "translateY(160%) rotate(-30deg) scale(0.7)", opacity: 0 }, { transform: "translateY(-6%) rotate(4deg) scale(1.02)", opacity: 1, offset: 0.75 }, { transform: "none", opacity: 1 }], 760, 0, SOFT);
    MOON_STARS.forEach(([, , , delay], i) => run(`mstar--${i}`, pop(1.6), 380, delay, SPRING));
    run("cloud", [{ transform: "translateX(-90%)", opacity: 0 }, { transform: "translateX(6%)", opacity: 1, offset: 0.8 }, { transform: "none", opacity: 1 }], 900, 250, SOFT);
    run("moon", [{ transform: "rotate(0deg)" }, { transform: "rotate(-8deg)", offset: 0.5 }, { transform: "rotate(0deg)" }], 600, 800, "ease-in-out");
    run("sparkle", twinkle, 600, 900, "ease-in-out");
    return list;
  },
};

const BALLOON_SET = [
  [39, PINK_D, ROSE, 0],
  [61, LILAC, LILAC_D, 160],
  [50, CREAM, "#c4a45e", 330],
];
const BALLOONS = {
  id: "balloons",
  beat: 1300,
  back: () =>
    BALLOON_SET.map(([x, fill, stroke], i) =>
      piece(
        `balloon opening__balloon--${i}`,
        at(x, 114, 10, 21),
        piece("balloon-sway", "inset:0;", svg("0 0 80 170", `<path d="M40 70C14 52 4 36 4 22 4 10 13 2 24 2c7 0 12 4 16 10 4-6 9-10 16-10 11 0 20 8 20 20 0 14-10 30-36 48Z" fill="${fill}" stroke="${stroke}" stroke-width="3.5" stroke-linejoin="round"/><path d="M18 16q4-6 11-6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><path d="M40 72c-7 18 7 30 0 48s6 30 0 48" stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`), "transform-origin:50% 0%;"),
      ),
    ).join(""),
  front: () => piece("bheart opening__bheart--a", at(41, 38, 2, 1.9), heartSvg(PINK)) + piece("bheart opening__bheart--b", at(60, 37, 1.6, 1.5), heartSvg(PINK_D)),
  play(root) {
    const { run, list } = animator(root);
    BALLOON_SET.forEach(([, , , delay], i) => {
      run(`balloon--${i}`, [{ transform: "translateY(0)" }, { transform: "translateY(-760%)" }], 1900, delay, "cubic-bezier(0.35, 0.15, 0.55, 1)");
      run(`balloon--${i} .opening__balloon-sway`, [{ transform: "rotate(-7deg)" }, { transform: "rotate(7deg)" }], 620, delay, "ease-in-out", { iterations: 4, direction: "alternate" });
    });
    run("word", [{ transform: "translateY(0)" }, { transform: "translateY(-4%)", offset: 0.35 }, { transform: "translateY(1.5%)", offset: 0.7 }, { transform: "translateY(0)" }], 600, 640, "ease-in-out");
    run("bheart", pop(1.4), 380, 900, SPRING);
    run("sparkle", twinkle, 560, 760, "ease-in-out");
    return list;
  },
};

const HOP = {
  id: "hop",
  beat: 1250,
  letters: true,
  front: () =>
    piece("hheart opening__hheart--0", at(41, 36.5, 2.2, 2.1), heartSvg(PINK_D)) +
    piece("hheart opening__hheart--1", at(50, 34, 2.8, 2.6), heartSvg(PINK)) +
    piece("hheart opening__hheart--2", at(59, 36.5, 2.2, 2.1), heartSvg(LILAC, LILAC_D)),
  play(root) {
    const { run, list } = animator(root);
    LETTERS.forEach((_, i) => {
      root.querySelector(`.opening__letter--${i}`).style.transformOrigin = "50% 100%";
      run(
        `letter--${i}`,
        [
          { transform: "translateY(0) scale(1, 1)" },
          { transform: "translateY(0) scale(1.05, 0.95)", offset: 0.12 },
          { transform: "translateY(-13%) scale(0.97, 1.04)", offset: 0.45 },
          { transform: "translateY(0) scale(1.05, 0.95)", offset: 0.78 },
          { transform: "translateY(0) scale(1, 1)" },
        ],
        480,
        60 + i * 85,
        "ease-in-out",
      );
    });
    [0, 1, 2].forEach((i) => run(`hheart--${i}`, [{ transform: "translateY(60%) scale(0)", opacity: 0 }, { transform: "translateY(-20%) scale(1.25)", opacity: 1, offset: 0.55 }, { transform: "translateY(-40%) scale(1)", opacity: 1 }], 460, 700 + i * 90, SOFT));
    run("sparkle", twinkle, 560, 640, "ease-in-out");
    return list;
  },
};

// A star loops once around the word, leaving sparkles, and settles as the wordmark's own sparkle.
const LOOP = { rx: 19, ry: 12.5, start: -36 };
const loopPoint = (deg) => [50 + LOOP.rx * Math.cos((deg * Math.PI) / 180), 50 + LOOP.ry * Math.sin((deg * Math.PI) / 180)];
const TRAIL = Array.from({ length: 11 }, (_, i) => LOOP.start + 30 + i * 30);
const SHOOTING = {
  id: "shooting-star",
  beat: 1400,
  front: () =>
    TRAIL.map((deg, i) => {
      const [x, y] = loopPoint(deg);
      return piece(`trail opening__trail--${i}`, at(x, y, 1.8, 1.8), starSvg(i % 3 === 0 ? GOLD : i % 3 === 1 ? LILAC_D : PINK_D));
    }).join("") + piece("comet", at(50, 50, 5, 5), svg("-11 -11 22 22", `<circle r="9" fill="#fff6d6" opacity=".55"/><path d="${STAR4}" fill="${GOLD}" stroke="#c79a3c" stroke-width=".8"/>`)),
  play(root) {
    const { run, list } = animator(root);
    const frames = [];
    for (let k = 0; k <= 12; k++) {
      const deg = LOOP.start + k * 30;
      const [x, y] = loopPoint(deg);
      frames.push({ transform: `translate(${r(((x - 50) / 5) * 100)}%, ${r(((y - 50) / 5) * 100)}%) rotate(${k * 45}deg) scale(${k === 0 ? 0.4 : k === 12 ? 0.7 : 1})`, opacity: k === 0 ? 0 : k === 12 ? 0 : 1 });
    }
    run("comet", frames, 1100, 60, "cubic-bezier(0.45, 0.05, 0.55, 0.95)");
    TRAIL.forEach((_, i) => run(`trail--${i}`, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1.4)", opacity: 1, offset: 0.4 }, { transform: "scale(0.8)", opacity: 0.75 }], 420, 60 + ((i + 1) / 12) * 1100 - 60, SPRING));
    run("sparkle", [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.6) rotate(60deg)", offset: 0.45 }, { transform: "scale(1) rotate(90deg)" }], 560, 1100, "ease-in-out");
    run("word", happyBounce, 480, 1120, "ease-out");
    return list;
  },
};

const QUILL = {
  id: "quill",
  beat: 1350,
  front: () =>
    piece("line", at(50, 64, 30, 3), svg("0 0 300 30", `<path d="M4 18C40 6 70 26 108 16S170 6 206 16 268 22 296 12" fill="none" stroke="${SPARK}" stroke-width="5" stroke-linecap="round"/>`), "transform-origin:0% 50%;") +
    piece("line-heart", at(66.5, 62.4, 2.6, 2.5), heartSvg(PINK_D)) +
    piece(
      "quill",
      at(37.4, 59, 7, 10.5),
      svg("0 0 60 90", `<path d="M6 86 14 64C22 36 38 14 58 4 54 28 44 52 24 70Z" fill="${PAPER}" stroke="${LILAC_D}" stroke-width="3" stroke-linejoin="round"/><path d="M14 66C26 48 38 30 52 12" stroke="${LILAC}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M6 86l5-14 6 4Z" fill="${INK}"/>`),
      "transform-origin:10% 95%;",
    ) +
    piece("ink opening__ink--a", at(45, 60, 1.4, 1.4), starSvg(GOLD)) +
    piece("ink opening__ink--b", at(57, 60.5, 1.2, 1.2), starSvg(PINK_D)),
  play(root) {
    const { run, list } = animator(root);
    run("quill", [{ transform: "translate(-60%, -80%) rotate(-20deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 260, 0, SOFT);
    const travel = (30 / 7) * 100;
    run(
      "quill",
      [
        { transform: "translate(0, 0) rotate(0deg)" },
        { transform: `translate(${r(travel * 0.25)}%, 6%) rotate(5deg)`, offset: 0.25 },
        { transform: `translate(${r(travel * 0.5)}%, -4%) rotate(-4deg)`, offset: 0.5 },
        { transform: `translate(${r(travel * 0.75)}%, 5%) rotate(4deg)`, offset: 0.75 },
        { transform: `translate(${r(travel)}%, -6%) rotate(0deg)` },
      ],
      700,
      260,
      "ease-in-out",
    );
    run("line", [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 700, 260, "ease-in-out");
    run("quill", [{ transform: `translate(${r(travel)}%, -6%) rotate(0deg)`, opacity: 1 }, { transform: `translate(${r(travel + 90)}%, -150%) rotate(25deg)`, opacity: 0 }], 360, 980, "ease-in");
    run("line-heart", pop(1.5), 360, 940, SPRING);
    run("ink", pop(1.4), 340, 620, SPRING);
    run("sparkle", twinkle, 560, 1000, "ease-in-out");
    return list;
  },
};

export const SCENES = [ENVELOPE, JAR, BOW, PETALS, PAW, MOON, BALLOONS, HOP, SHOOTING, QUILL];
