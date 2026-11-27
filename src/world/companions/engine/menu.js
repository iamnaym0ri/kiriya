// Where the tap menu goes (README.md, "The tap menu and stay"). Pure geometry, so it can be tested:
// beside the character if there is room (a column of chips), else under its cloud or over its head
// (a row), always fully inside the band (never under the status bar, the top bars or the tab bar)
// and, when it can be, clear of the speech bubble.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * @param {object} p
 * @param {{ top, bottom, left, right }} p.band   the band characters live in (viewport px)
 * @param {{ x, feet, w, h, cloud }} p.actor     feet point, the drawn body's width and height, and how
 *                                                far its cloud reaches below the feet
 * @param {{ column: { w, h }, row: { w, h } }} p.size  the menu's size in each layout
 * @param {{ left, top, right, bottom } | null} p.bubble  the speech bubble, if one shows
 * @param {{ layout, side } | null} p.prev        the last placement (kept while it still works)
 * @param {number} [p.pad]                        distance kept from the band's edges
 * @param {number} [p.gap]                        distance kept from the body
 * @returns {{ left, top, layout: "column" | "row", side: "right" | "left" | "below" | "above", w, h }}
 */
export function placeMenu({ band, actor, size, bubble = null, prev = null, pad = 8, gap = 6 }) {
  const { x, feet, w, h } = actor;
  const cloud = actor.cloud ?? 0;
  const body = { left: x - w / 2, right: x + w / 2, top: feet - h, bottom: feet };
  const mid = feet - h * 0.5;
  const minX = band.left + pad;
  const maxX = band.right - pad;
  const minY = band.top + pad;
  const maxY = band.bottom - pad;
  const col = size.column;
  const row = size.row;
  const roomRight = maxX - body.right;
  const roomLeft = body.left - minX;

  const beside = (side) => {
    const left = side === "right" ? body.right + gap : body.left - gap - col.w;
    const top = clamp(mid - col.h / 2, minY, maxY - col.h);
    const fits = left >= minX - 0.5 && left + col.w <= maxX + 0.5 && col.h <= maxY - minY;
    return { left, top, layout: "column", side, w: col.w, h: col.h, fits };
  };
  const below = () => {
    const top = feet + cloud + gap;
    const left = clamp(x - row.w / 2, minX, maxX - row.w);
    return { left, top, layout: "row", side: "below", w: row.w, h: row.h, fits: top + row.h <= maxY + 0.5 && row.w <= maxX - minX };
  };
  const above = () => {
    const ceiling = bubble && bubble.bottom <= body.top + h * 0.35 ? Math.min(bubble.top, body.top) : body.top;
    const top = ceiling - gap - row.h;
    const left = clamp(x - row.w / 2, minX, maxX - row.w);
    return { left, top, layout: "row", side: "above", w: row.w, h: row.h, fits: top >= minY - 0.5 && row.w <= maxX - minX };
  };

  const first = roomRight >= roomLeft ? "right" : "left";
  const order = [beside(first), beside(first === "right" ? "left" : "right"), below(), above()];
  const rect = (c) => ({ left: c.left, top: c.top, right: c.left + c.w, bottom: c.top + c.h });
  const clear = (c) => c.fits && !overlaps(rect(c), bubble);

  // Keep the last placement while it still fits, so the menu doesn't hop as a bubble comes and goes.
  const kept = prev && order.find((c) => c.side === prev.side);
  let pick = kept && clear(kept) ? kept : order.find(clear) ?? order.find((c) => c.fits);
  if (!pick) {
    // Nothing fits cleanly (a very narrow band): a column on the roomier side, pushed on screen.
    const c = beside(first);
    pick = { ...c, left: clamp(c.left, minX, Math.max(minX, maxX - col.w)) };
  }
  const { fits, ...out } = pick;
  void fits;
  return { ...out, left: Math.round(out.left), top: Math.round(clamp(out.top, minY, Math.max(minY, maxY - out.h))) };
}
