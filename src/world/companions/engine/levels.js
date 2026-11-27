// Where characters can stand: the band of screen between the home top bar and the tab bar, the
// invisible levels across it, and a cheap look at what is underneath a spot (README.md, "Levels").

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let insetProbe = null;
/** The safe-area insets, read once from a hidden element (env() is not readable from JS). */
export function safeInsets() {
  if (typeof document === "undefined") return { top: 0, bottom: 0, left: 0, right: 0 };
  if (!insetProbe) {
    insetProbe = document.createElement("div");
    insetProbe.setAttribute("aria-hidden", "true");
    insetProbe.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;inset:0 auto auto 0;width:0;height:0;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(insetProbe);
  }
  const css = getComputedStyle(insetProbe);
  return {
    top: parseFloat(css.paddingTop) || 0,
    right: parseFloat(css.paddingRight) || 0,
    bottom: parseFloat(css.paddingBottom) || 0,
    left: parseFloat(css.paddingLeft) || 0,
  };
}

// The app frame (docs/refactor/RENOVATION.md, "App layout"): fixed bars at the top (the compact bar
// that fades in once home's title scrolls away), the home top bar and ribbon that scroll with the
// page, the tab bar, and anything floating just above it.
const TOP_FIXED = ['[data-companion-edge="top"]', ".app-topbar", ".app-topbar-strip"];
const TOP_FLOW = [".world-mast", ".birthday-ribbon"];
const BOTTOM_FIXED = ['[data-companion-edge="bottom"]', ".app-tabs"];
const BOTTOM_FLOATING = [".listening-room", ".daily-style-corner", "[data-companion-float]"];

function rects(selectors) {
  const out = [];
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ el, r });
    }
  }
  return out;
}

/**
 * The band characters live in, in viewport px: below everything at the top of home and above the
 * tab bar (or the home indicator). It stays put while home scrolls: the top bar and ribbon count
 * where they sit at the top of the page, so nobody slides about as she scrolls, and nobody ever
 * stands under them or under the compact bar. `override` ({ top, bottom }) wins when given.
 */
export function measureBand(override = {}) {
  const width = document.documentElement.clientWidth || innerWidth;
  const height = innerHeight;
  const safe = safeInsets();
  let top = safe.top;
  for (const { r } of rects(TOP_FIXED)) if (r.bottom < height * 0.3) top = Math.max(top, r.bottom);
  for (const { el, r } of rects(TOP_FLOW)) {
    const position = getComputedStyle(el).position;
    const bottom = position === "fixed" || position === "sticky" ? r.bottom : r.bottom + scrollY;
    if (bottom < height * 0.35) top = Math.max(top, bottom);
  }
  let bottom = height - safe.bottom;
  for (const { el, r } of rects(BOTTOM_FIXED)) {
    if (r.top > height * 0.6 && r.top < height && getComputedStyle(el).visibility !== "hidden") bottom = Math.min(bottom, r.top);
  }
  for (const { el, r } of rects(BOTTOM_FLOATING)) {
    if (r.top > height * 0.6 && r.top < bottom && getComputedStyle(el).position === "fixed") bottom = Math.min(bottom, r.top - 4);
  }
  if (Number.isFinite(override.top)) top = override.top;
  if (Number.isFinite(override.bottom)) bottom = override.bottom;
  return {
    top: Math.round(top),
    bottom: Math.round(bottom),
    left: Math.round(safe.left),
    right: Math.round(width - safe.right),
    width,
    height,
  };
}

// Alternating spans give the levels the feel of platforms at different heights rather than ruled
// lines: the bottom and top run the full width, the ones between lean left and right in turn.
const SPAN_PATTERN = [
  [0, 1],
  [0.3, 1],
  [0, 0.72],
  [0.22, 1],
  [0, 0.78],
  [0.18, 1],
];

/**
 * The invisible levels. Each is { id, y, x0, x1 }: y is the feet line, x0..x1 the range the feet
 * may stand in (already inset so the body never leaves the band). Level 0 is the lowest.
 *
 * `count` is how many (2..6, default: as many as fit about every 150 px). `custom` is an optional
 * list of { at, from, to } with `at` 0 (top) .. 1 (bottom) and `from`/`to` 0..1 across the width.
 */
export function buildLevels(band, { count, custom, bodyWidth = 96, bodyHeight = 128, platformDepth = 18, seed = 1 } = {}) {
  const margin = 8;
  const half = bodyWidth / 2;
  const xMin = band.left + margin + half;
  const xMax = band.right - margin - half;
  const feetBottom = band.bottom - platformDepth - 6;
  const feetTop = Math.min(feetBottom - 40, band.top + bodyHeight + 14);
  const range = Math.max(0, feetBottom - feetTop);
  const across = (f) => xMin + clamp(f, 0, 1) * Math.max(0, xMax - xMin);

  if (Array.isArray(custom) && custom.length) {
    return custom
      .map((level, i) => ({
        id: i,
        y: Math.round(feetTop + clamp(level.at ?? 1, 0, 1) * range),
        x0: across(level.from ?? 0),
        x1: across(level.to ?? 1),
      }))
      .sort((a, b) => b.y - a.y)
      .map((level, i) => ({ ...level, id: i }));
  }

  const n = clamp(Math.round(count ?? Math.round(range / 150) + 1), 2, 6);
  // A small, stable wobble so the levels don't look ruled.
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const levels = [];
  for (let i = 0; i < n; i++) {
    const even = feetBottom - (i * range) / (n - 1);
    const wobble = i === 0 || i === n - 1 ? 0 : (rand() - 0.5) * Math.min(24, range / (n - 1) / 4);
    const [from, to] = i === n - 1 && n > 2 ? [0.06, 0.94] : SPAN_PATTERN[i % SPAN_PATTERN.length];
    levels.push({ id: i, y: Math.round(even + wobble), x0: across(from), x1: across(to) });
  }
  return levels;
}

// --- What is underneath --------------------------------------------------------------------------

const INTERACTIVE = "a[href], button, input, textarea, select, label, summary, [role=button], [role=link], [contenteditable], [data-companion-avoid]";
const MEDIA = "img, video, iframe, canvas, svg:not([aria-hidden=true])";
let range = null;

function textUnder(el, x, y) {
  for (const node of el.childNodes) {
    if (node.nodeType !== 3 || !node.textContent.trim()) continue;
    range ??= document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) return true;
    }
  }
  return false;
}

/** 1 if what is at (x, y) under the stage is text, a control or a picture; 0 if it is just paper. */
function busyPoint(x, y, stage) {
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 0;
  const hits = document.elementsFromPoint(x, y);
  const el = hits.find((hit) => !stage?.contains(hit));
  if (!el || el === document.body || el === document.documentElement) return 0;
  if (el.closest("[data-companion-ok]")) return 0;
  if (el.closest(INTERACTIVE)) return 1;
  if (el.closest(MEDIA)) return 0.7;
  return textUnder(el, x, y) ? 1 : 0;
}

/**
 * How much of a rect ({ left, top, right, bottom }, viewport px) covers things she might want to
 * read or tap, 0..1. Seven samples: cheap enough to run when a character decides where to go, never
 * per frame.
 */
export function busyScore(rect, stage) {
  const xs = [rect.left + (rect.right - rect.left) * 0.25, rect.left + (rect.right - rect.left) * 0.75];
  const ys = [rect.top + (rect.bottom - rect.top) * 0.2, rect.top + (rect.bottom - rect.top) * 0.55, rect.top + (rect.bottom - rect.top) * 0.9];
  let sum = busyPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, stage);
  for (const x of xs) for (const y of ys) sum += busyPoint(x, y, stage);
  return sum / 7;
}
