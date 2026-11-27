// The cross-fade between two drawings of a body (README.md, "Transitions"; blend.js says how long).
//
// Characters draw their poses in different ways: CSS on persistent limbs (Miku, Bamby), whole arm
// groups swapped per pose (Maomao, Rotten Girl), paths computed per pose (KAITO). One thing works
// for all of them: just before React swaps the pose, the body's DOM is copied exactly as it looks at
// that instant (the "ghost"), and a MutationObserver notes what React then changes. The copy is laid
// over the new drawing with its CSS clocks carrying on in step with where the old ones were, and
// fades out:
//   - parts React removed or redrew (an arm group, a path's shape, a prop) fade out of the copy,
//     and their new versions fade in on the live body;
//   - parts that now slide on their own (a CSS transition, e.g. the upper body lowering to sit)
//     slide in the copy too, in step with the live body (same values, same clock), so they glide
//     without a double, and whatever fades with them fades where they are;
//   - parts that would jump by CSS alone (a pose rule with no transition, an animation swapped for
//     another or for a still value: the upper body dropping to sit, an arm's angle) glide instead:
//     each styled part's transform and opacity are read before and after, and a part that changed
//     is animated from where it was into whatever its CSS now says, still or moving, with its copy
//     in the ghost gliding in step. Characters need no transitions of their own for this.
// When only the expression or the prop changed, the copy holds just what React removed or redrew
// (a mark, a prop, a face drawn per expression): a face that eases between expressions by itself
// (Maomao's, both Mikus', KAITO's) then shows its own easing with no double over it.
// The live body itself is never made see-through. Cost: one cloneNode, one MutationObserver and a
// few short opacity animations per change; nothing per frame.

let ghostSeq = 0;
/** What a styled part's look is made of, for the before/after comparison. */
const LOOK = ["translate", "rotate", "scale", "transform", "opacity"];
const readLook = (node) => {
  const cs = getComputedStyle(node);
  return LOOK.map((k) => cs.getPropertyValue(k));
};
const GLIDE_EASE = "cubic-bezier(0.3, 0.8, 0.3, 1)";
const MAX_GHOSTS = 2;
/** Attributes that are flags for CSS, not drawing: a change to them is not a redraw. */
const FLAG = /^(data-|aria-|class$|role$|tabindex$|focusable$)/;

/**
 * Called while the DOM still shows the old pose (React's getSnapshotBeforeUpdate): a copy of `el`,
 * where each of its running CSS animations and transitions was, and a watch on what changes next.
 * `look`: also note how each styled part looks, so the parts that jump can glide (a new pose; not
 * needed when only the expression changes, which is the commonest change and so kept cheapest).
 */
export function snapshot(el, { look = true } = {}) {
  if (!el || typeof el.cloneNode !== "function") return null;
  const all = [el, ...el.querySelectorAll("*")];
  const index = new Map(all.map((node, i) => [node, i]));
  const clocks = [];
  const held = [];
  let running = [];
  try {
    running = el.getAnimations?.({ subtree: true }) ?? [];
  } catch {
    running = [];
  }
  for (const a of running) {
    const effect = a.effect;
    if (!effect || effect.pseudoElement) continue;
    const i = index.get(effect.target);
    if (i == null) continue;
    if (a.animationName) clocks.push({ i, name: a.animationName, time: a.currentTime, paused: a.playState === "paused" });
    else if (a.transitionProperty) {
      // A transition mid-way (an arm easing up): the copy holds the value it had reached.
      const prop = a.transitionProperty;
      held.push({ i, prop, value: getComputedStyle(effect.target).getPropertyValue(prop) });
    }
  }
  // How each styled part (the ones CSS poses) looks right now.
  const styled = [];
  if (look) for (let i = 1; i < all.length; i++) if (all[i].hasAttribute("class")) styled.push({ i, look: readLook(all[i]) });
  let observer = null;
  if (typeof MutationObserver === "function") {
    observer = new MutationObserver(() => {});
    observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
  }
  return { root: el, all, index, clone: el.cloneNode(true), clocks, held, styled, observer };
}

/** Gives the copy its own ids (gradients, clip paths), so it never draws with the live body's. */
function renameIds(root, suffix) {
  const named = root.querySelectorAll("[id]");
  if (!named.length) return;
  const map = new Map();
  for (const node of named) {
    map.set(node.id, node.id + suffix);
    node.id += suffix;
  }
  for (const node of [root, ...root.querySelectorAll("*")]) {
    for (const attr of node.attributes) {
      const value = attr.value;
      if (value.includes("url(")) {
        attr.value = value.replace(/url\((['"]?)#([^)'"]+)\1\)/g, (match, q, id) => (map.has(id) ? `url(${q}#${map.get(id)}${q})` : match));
      } else if ((attr.name === "href" || attr.name === "xlink:href") && value[0] === "#" && map.has(value.slice(1))) {
        attr.value = `#${map.get(value.slice(1))}`;
      }
    }
  }
}

/** Fades a part of the live body in from nothing to whatever its CSS says (0 stays hidden). */
function fadeIn(node, ms) {
  try {
    // One keyframe at offset 0 (a lone keyframe would be the end): the end is the live value.
    node.animate([{ opacity: 0, offset: 0 }], { duration: ms, easing: "cubic-bezier(0.2, 0.6, 0.35, 1)" });
  } catch {
    // An engine without implicit keyframes: the part just appears under the fading ghost.
  }
}

/**
 * Lays the ghost over the live body and fades it out over `ms`.
 * `layer`: the empty element the ghosts go in. `live`: the live body's wrapper.
 * `only`: the copy shows only what React removed or redrew (a change of expression or prop).
 * `glide`: parts that jumped glide from where they were, over `glideMs` (off in quiet mode).
 */
export function playGhost(snap, layer, live, { ms = 160, only = false, glide = true, glideMs = Math.round(ms * 1.8) } = {}) {
  const records = snap?.observer?.takeRecords() ?? [];
  snap?.observer?.disconnect();
  if (!snap || !layer || !(ms > 0)) return null;
  const liveRoot = live?.firstElementChild ?? null;
  const clone = snap.clone;
  const all = [clone, ...clone.querySelectorAll("*")];
  const replaced = liveRoot !== snap.root;

  // What React changed: parts removed and redrawn (shown in the copy), parts added (faded in).
  const shown = new Set();
  const arriving = new Set();
  for (const r of records) {
    if (r.type === "childList") {
      for (const node of r.removedNodes) if (snap.index.has(node)) shown.add(snap.index.get(node));
      for (const node of r.addedNodes) if (node.nodeType === 1) arriving.add(node);
    } else if (r.type === "characterData") {
      const parent = r.target.parentNode;
      if (parent && snap.index.has(parent)) {
        shown.add(snap.index.get(parent));
        arriving.add(parent);
      }
    } else if (r.target !== snap.root && !FLAG.test(r.attributeName) && snap.index.has(r.target)) {
      shown.add(snap.index.get(r.target));
      arriving.add(r.target);
    }
  }

  // Parts of the live body that now glide by their own CSS transition: the copy glides with them.
  const gliding = [];
  if (!replaced && liveRoot) {
    let anims = [];
    try {
      anims = liveRoot.getAnimations({ subtree: true });
    } catch {
      anims = [];
    }
    for (const a of anims) {
      if (!a.transitionProperty || a.effect?.pseudoElement) continue;
      const i = snap.index.get(a.effect?.target);
      if (i != null) gliding.push({ i, a });
    }
  }

  // Parts whose look jumped with the new pose (and that no CSS transition is easing): they glide.
  const glides = [];
  if (glide && !replaced && liveRoot && snap.styled.length) {
    const easing = new Set(gliding.map(({ i, a }) => `${i}|${a.transitionProperty}`));
    for (const { i, look } of snap.styled) {
      const node = snap.all[i];
      if (!node.isConnected || !liveRoot.contains(node)) continue;
      const now = readLook(node);
      const from = {};
      const to = {};
      let changed = false;
      for (let k = 0; k < LOOK.length; k++) {
        if (now[k] === look[k] || easing.has(`${i}|${LOOK[k]}`)) continue;
        from[LOOK[k]] = look[k];
        to[LOOK[k]] = now[k];
        changed = true;
      }
      if (changed) glides.push({ i, node, from, to });
    }
  }

  renameIds(clone, `-g${++ghostSeq}`);
  for (const h of snap.held) {
    const node = all[h.i];
    if (!node) continue;
    node.style.setProperty(h.prop, h.value);
    node.style.transition = "none";
  }
  const keep = only ? shown.size > 0 : true;
  if (only && keep) {
    // Just what React removed or redrew fades out from where it was. Everything else leaves the
    // copy before it is styled (hidden parts would still cost a style pass): only the shown parts,
    // the groups that hold them (for their transforms) and the gradients stay.
    const shownNodes = new Set([...shown].map((i) => all[i]).filter(Boolean));
    const path = new Set();
    for (const node of shownNodes) for (let p = node; p && !path.has(p); p = p.parentNode) path.add(p);
    for (const node of all) {
      // Kept: the path to a shown part, everything inside a shown part, and the gradients.
      if (path.has(node) || !path.has(node.parentNode) || shownNodes.has(node.parentNode) || node.localName === "defs") continue;
      node.remove();
    }
    clone.style.setProperty("visibility", "hidden");
    for (const node of shownNodes) node.style.setProperty("visibility", "visible");
  }

  const arrive = () => {
    // What arrives fades in under the copy. A whole new drawing (the Body swapped its root) fades in whole.
    const inMs = Math.round(ms * 0.6);
    if (replaced) {
      if (live) fadeIn(live, inMs);
      return;
    }
    let n = 0;
    for (const node of arriving) {
      if (!node.isConnected || !liveRoot.contains(node) || node === liveRoot) continue;
      // Only the outermost of what arrived (a new arm group, not each of its paths).
      let inside = false;
      for (let p = node.parentNode; p && p !== liveRoot; p = p.parentNode) if (arriving.has(p)) inside = true;
      if (inside) continue;
      fadeIn(node, inMs);
      if (++n >= 40) break;
    }
  };
  if (!keep) {
    arrive();
    return null;
  }

  const ghost = document.createElement("div");
  ghost.className = "cs-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.appendChild(clone);
  layer.appendChild(ghost);
  // The copy's CSS clocks start now: put each one where the old drawing's was, so the ghost keeps
  // moving exactly as the old pose would have (a walk keeps stepping while it fades).
  if (snap.clocks.length) {
    const index = new Map(all.map((node, i) => [node, i]));
    const byKey = new Map(snap.clocks.map((c) => [`${c.i}|${c.name}`, c]));
    let copies = [];
    try {
      copies = ghost.getAnimations({ subtree: true });
    } catch {
      copies = [];
    }
    for (const a of copies) {
      const c = byKey.get(`${index.get(a.effect?.target)}|${a.animationName}`);
      if (!c || c.time == null) continue;
      a.currentTime = c.time;
      if (c.paused) a.pause();
    }
  }
  // The copy's gliding parts follow the live ones: the same keyframes, timing and clock.
  for (const { i, a } of gliding) {
    const node = all[i];
    if (!node) continue;
    try {
      const timing = a.effect.getTiming();
      const frames = a.effect.getKeyframes().map(({ computedOffset, ...frame }) => frame);
      const copy = node.animate(frames, { duration: timing.duration, delay: timing.delay, easing: timing.easing, fill: "both" });
      copy.currentTime = a.currentTime ?? 0;
    } catch {
      // Keyframes this engine won't hand over: that part fades from where it was instead.
    }
  }
  // Parts that jumped: from where they were into whatever their CSS now says (an implicit end, so a
  // new animation is joined where it is), the copy alongside to the value they jump to.
  for (const { i, node, from, to } of glides) {
    try {
      node.animate([{ ...from, offset: 0 }], { duration: glideMs, easing: GLIDE_EASE });
      all[i]?.animate([from, to], { duration: glideMs, easing: GLIDE_EASE, fill: "both" });
    } catch {
      // A value this engine can't animate between: that part fades from where it was.
    }
  }
  // Changes in quick succession (crouch, take-off, the top of the arc): the oldest ghosts go.
  while (layer.childElementCount > MAX_GHOSTS) layer.firstElementChild.remove();
  const drop = () => ghost.remove();
  const fade = ghost.animate(
    [{ opacity: 1 }, { opacity: 1, offset: 0.12, easing: "cubic-bezier(0.35, 0, 0.6, 1)" }, { opacity: 0 }],
    { duration: ms, fill: "forwards" },
  );
  fade.finished.then(drop, drop);
  arrive();
  return ghost;
}
