// Whether something is open over the page that the companions must never cover or sit behind
// (README.md, "Every page"): a sheet, a pop-up, a viewer, a game. While one is open the stage is
// fully hidden and paused (bodies stop their own animations too); it comes back exactly where it was
// when the last one closes.
//
// It looks for what the app's overlays already say about themselves, so nothing needs marking:
// dialogs (`role="dialog"`, `aria-modal`, `<dialog open>`), the photo viewer (PhotoSwipe's `.pswp`),
// the game sheet (games, the sketchbook and the other play sheets: `html.game-sheet-open`, and
// `.game-sheet`), and anything a page marks `data-companion-hide`. It is told by a MutationObserver
// (only structure and those attributes, so a page's own animations cost it nothing) and looks at
// most once per frame.

const OVERLAYS = ['[aria-modal="true"]', '[role="dialog"]', "dialog[open]", ".pswp", ".game-sheet", "[data-companion-hide]"].join(", ");

/** Is anything open over the page? `stage`: the stage's own layer (its parts never count). */
export function coveredNow(stage) {
  if (document.documentElement.classList.contains("game-sheet-open")) return true;
  for (const el of document.querySelectorAll(OVERLAYS)) {
    if (stage?.contains(el)) continue;
    if (el.hidden || el.closest("[hidden], [inert]")) continue;
    const shown = typeof el.checkVisibility === "function" ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.getClientRects().length > 0;
    if (!shown) continue;
    return true;
  }
  return false;
}

/**
 * Calls `onChange(covered)` whenever that changes. `getStage()` gives the stage's layer (or null).
 * Returns a function that stops watching.
 */
export function watchCover(onChange, getStage = () => null) {
  if (typeof document === "undefined" || typeof MutationObserver !== "function") return () => {};
  let covered = null;
  let frame = 0;
  const check = () => {
    frame = 0;
    const now = coveredNow(getStage());
    if (now !== covered) {
      covered = now;
      onChange(now);
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(check);
  };
  const observer = new MutationObserver((records) => {
    const stage = getStage();
    // The stage's own comings and goings (bubbles, clouds, faces) never matter here.
    for (const r of records) if (!stage || !stage.contains(r.target)) return schedule();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["role", "aria-modal", "open", "hidden", "inert", "data-companion-hide"] });
  const root = new MutationObserver(schedule);
  root.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  check();
  return () => {
    observer.disconnect();
    root.disconnect();
    cancelAnimationFrame(frame);
  };
}
