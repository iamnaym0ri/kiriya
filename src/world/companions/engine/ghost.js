// The cross-fade between two drawings of a body (README.md, "Transitions"; blend.js says how long).
//
// Round 3, second pass (measured on Josh's iPhone 11): copying the whole body for every change cost
// a dropped frame each time (WebKit had to style and paint a second ~200-node SVG, then repaint it
// every frame while its clocks ran). Now nothing is copied wholesale and nothing reads styles:
//
//   - just before React draws the new pose, a MutationObserver starts watching the body (with old
//     values); right after, it says exactly what React changed;
//   - parts React removed (an arm group, a prop, a mark, a face drawn per expression) are put back
//     where they were, frozen, and fade out in place, then go. They keep their place in the
//     drawing (what was behind stays behind) and ride along with the body;
//   - a node React redrew in place (a path's shape, a transform attribute) gets a one-node copy
//     with its old attributes just in front of it, which fades out the same way;
//   - what React added or redrew fades in;
//   - parts that move by CSS (sitting down) glide by the Body's own CSS transitions.
//
// Cost per change: the observer, a handful of nodes put back (only they need styling), a few
// opacity animations. No getComputedStyle, no getAnimations, no layout reads, nothing per frame.

/** Attributes that are flags for CSS, not drawing: a change to them is not a redraw. */
const FLAG = /^(data-|aria-|class$|role$|tabindex$|focusable$|style$)/;
/** At most this many parts fade at once per body (a burst of changes drops the oldest). */
const MAX_LEAVING = 24;

/** Called while the DOM still shows the old pose (React's getSnapshotBeforeUpdate). */
export function watch(el) {
  if (!el || typeof MutationObserver !== "function") return null;
  const observer = new MutationObserver(() => {});
  observer.observe(el, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
  return { root: el, observer };
}

/** Fades a part of the live body in from nothing to whatever its CSS says (0 stays hidden). */
function fadeIn(node, ms) {
  try {
    // One keyframe at offset 0 (a lone keyframe would be the end): the end is the live value.
    node.animate([{ opacity: 0, offset: 0 }], { duration: ms, easing: "cubic-bezier(0.2, 0.6, 0.35, 1)" });
  } catch {
    // An engine without implicit keyframes: the part just appears as the old one fades.
  }
}

/** Puts `node` back into `parent` as near its old place as the new drawing allows. */
function putBack(node, parent, next, prev) {
  if (next && next.parentNode === parent) parent.insertBefore(node, next);
  else if (prev && prev.parentNode === parent) parent.insertBefore(node, prev.nextSibling);
  else parent.appendChild(node);
}

/**
 * Right after React drew the change: fade out what left, fade in what arrived, over `ms`.
 * `live`: the live body's wrapper. `leaving`: this body's set of parts still fading (kept between
 * calls so a burst of changes never piles up). `dip`: quiet mode and reduced motion, where nothing
 * glides: the whole body dips and comes back (its wrapper's opacity, composited), so a change of
 * pose is a soft cut rather than a jump.
 */
export function blendChanges(watcher, live, { ms = 160, leaving = new Set(), dip = false } = {}) {
  if (!watcher) return 0;
  const records = watcher.observer.takeRecords();
  watcher.observer.disconnect();
  const root = watcher.root;
  if (!(ms > 0) || !records.length) return 0;
  if (dip && live) {
    try {
      live.animate([{ opacity: 0.35, offset: 0 }], { duration: ms + 40, easing: "cubic-bezier(0.3, 0.6, 0.4, 1)" });
    } catch {
      // No implicit keyframes: the change is a cut, as before.
    }
  }
  const inMs = Math.round(ms * 0.6);
  // The Body swapped its whole drawing (a new root element): it fades in whole.
  if (live && live.firstElementChild !== root) {
    fadeIn(live, inMs);
    return 1;
  }

  const gone = [];
  const arriving = new Set();
  const redrawn = new Map(); // node -> { attribute: old value }
  for (const r of records) {
    if (r.type === "childList") {
      for (const node of r.removedNodes) if (node.nodeType === 1 && !node.isConnected) gone.push({ node, parent: r.target, next: r.nextSibling, prev: r.previousSibling });
      for (const node of r.addedNodes) if (node.nodeType === 1) arriving.add(node);
    } else if (r.type === "characterData") {
      const parent = r.target.parentNode;
      if (parent?.nodeType === 1 && parent !== root) {
        const old = redrawn.get(parent) ?? {};
        old["#text"] ??= { node: r.target, value: r.oldValue };
        redrawn.set(parent, old);
      }
    } else if (r.target !== root && !FLAG.test(r.attributeName)) {
      const old = redrawn.get(r.target) ?? {};
      // The first record holds the value from before this commit.
      if (!(r.attributeName in old)) old[r.attributeName] = r.oldValue;
      redrawn.set(r.target, old);
    }
  }

  const out = [];
  // Removed parts go back where they were (reverse order, so siblings land in their old order).
  for (let k = gone.length - 1; k >= 0; k--) {
    const { node, parent, next, prev } = gone[k];
    if (!parent.isConnected || !root.contains(parent) || node.isConnected) continue;
    putBack(node, parent, next, prev);
    out.push(node);
  }
  // Redrawn nodes: a copy with the old attributes, just in front of the new one.
  for (const [node, old] of redrawn) {
    if (!node.isConnected || !root.contains(node) || arriving.has(node)) continue;
    let inside = false;
    for (let p = node.parentNode; p && p !== root; p = p.parentNode) if (arriving.has(p)) inside = true;
    if (inside) continue;
    const copy = node.cloneNode(true);
    for (const [name, value] of Object.entries(old)) {
      if (name === "#text") {
        copy.textContent = value.value ?? "";
        continue;
      }
      if (value == null) copy.removeAttribute(name);
      else copy.setAttribute(name, value);
    }
    copy.removeAttribute("id");
    node.parentNode.insertBefore(copy, node.nextSibling);
    out.push(copy);
    arriving.add(node);
  }
  // What leaves: frozen where it is, fading to nothing, then gone.
  for (const node of out) {
    node.setAttribute("data-cs-leaving", "");
    leaving.add(node);
    const drop = () => {
      node.remove();
      leaving.delete(node);
    };
    try {
      const fade = node.animate([{ opacity: 1 }, { opacity: 1, offset: 0.12, easing: "cubic-bezier(0.35, 0, 0.6, 1)" }, { opacity: 0 }], { duration: ms, fill: "forwards" });
      fade.finished.then(drop, drop);
    } catch {
      drop();
    }
  }
  // A burst of changes (crouch, take-off, the top of the arc): the oldest leaving parts go now.
  if (leaving.size > MAX_LEAVING) {
    let extra = leaving.size - MAX_LEAVING;
    for (const node of leaving) {
      if (extra-- <= 0) break;
      node.remove();
      leaving.delete(node);
    }
  }
  // What arrives fades in (only the outermost of each new group).
  let n = 0;
  for (const node of arriving) {
    if (!node.isConnected || node === root || node.hasAttribute("data-cs-leaving")) continue;
    let inside = false;
    for (let p = node.parentNode; p && p !== root; p = p.parentNode) if (arriving.has(p)) inside = true;
    if (inside) continue;
    fadeIn(node, inMs);
    if (++n >= 40) break;
  }
  return out.length + n;
}
