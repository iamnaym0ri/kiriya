import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The middle-of-the-screen moment for the notes & letters section, the in-app cousin of the cards
// that open inside her notifications: a jar note, a little note or a letter flies up from where she
// tapped it, unfolds panel by panel over a soft lilac veil, and its reactions and "save" fade in
// underneath. A tap outside, a swipe down, the × or Escape fold it away. Nothing behind it scrolls,
// and the iPhone's edge swipe pauses while it's open (like the play hub's game sheet).
//
// RevealLayer is the stage (portalled to <body>: the content column is its own stacking context);
// RevealCard is one paper on it, rendered once as itself and, while it unfolds, three more times as
// the three panels of the fold (identical layout, so the hand-over to the real paper is seamless).
// Motion is transform and opacity only; with Reduce Motion it simply fades in.

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tells the iPhone app to pause its edge swipe-back while the reveal is open (if the build supports it). */
function setSwipeBack(enabled) {
  try {
    window.webkit?.messageHandlers?.kiriyaSwipeBack?.postMessage(enabled);
  } catch {
    // Older builds have no such handler; the swipe then goes back as usual.
  }
}

/** Where something was tapped, for the paper to fly out of (a plain object: DOMRects don't spread). */
export function rectOf(element, { x = 0, y = 0, w = 1, h = 1 } = {}) {
  const box = element?.getBoundingClientRect?.();
  if (!box || !box.width) return null;
  return { left: box.left + box.width * x, top: box.top + box.height * y, width: box.width * w, height: box.height * h };
}

const EXIT_MS = 240;
const SWIPE_CLOSE = 110;

/**
 * The stage. `open` mounts it; closing plays the exit before it unmounts (the last children stay
 * on screen meanwhile). `children` fill a column: the paper(s), then what's under them.
 */
export function RevealLayer({ open, onClose, label, kind = "note", children }) {
  const [mounted, setMounted] = useState(open);
  const [exit, setExit] = useState(null); // null | "fade" | "swipe"
  const last = useRef(children);
  const root = useRef(null);
  const stage = useRef(null);
  const veil = useRef(null);
  const swiped = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  if (open) last.current = children;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExit(null);
      swiped.current = false;
      return undefined;
    }
    if (!mounted) return undefined;
    setExit(swiped.current ? "swipe" : "fade");
    const timer = setTimeout(() => {
      setMounted(false);
      setExit(null);
    }, reducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // While it's up: nothing behind scrolls, the edge swipe pauses, Escape and a tap on the current
  // tab close it, and focus moves in (and back to where it was afterwards).
  useEffect(() => {
    if (!mounted) return undefined;
    const html = document.documentElement;
    html.classList.add("mail-reveal-open");
    setSwipeBack(false);
    const previous = document.activeElement;
    root.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      // Josh's edit sheet (over the reveal) takes its own Escape first.
      if (event.key === "Escape" && !document.querySelector(".edit-sheet")) close.current?.();
    };
    const onReselect = () => close.current?.();
    document.addEventListener("keydown", onKey);
    document.addEventListener("app:tab-reselect", onReselect);
    return () => {
      html.classList.remove("mail-reveal-open");
      setSwipeBack(true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("app:tab-reselect", onReselect);
      previous?.focus?.({ preventScroll: true });
    };
  }, [mounted]);

  // Swipe down to close: the paper follows the finger (unless she's scrolling a long letter that
  // isn't at its top), the veil lightens, and a long or quick enough pull lets it go.
  useEffect(() => {
    const element = root.current;
    if (!mounted || !element) return undefined;
    let start = null;
    const setDrag = (y, animate) => {
      const node = stage.current;
      if (!node) return;
      node.style.transition = animate ? "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
      node.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
      if (veil.current) {
        veil.current.style.transition = animate ? "opacity 260ms ease" : "none";
        veil.current.style.opacity = y ? String(Math.max(0.25, 1 - y / 420)) : "";
      }
    };
    const down = (event) => {
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const scroller = event.target.closest?.(".reveal-scroll");
      start = { y: event.touches[0].clientY, t: performance.now(), scroller, dragging: false, last: 0 };
    };
    const move = (event) => {
      if (!start) return;
      const dy = event.touches[0].clientY - start.y;
      const scrollable = start.scroller && start.scroller.scrollHeight > start.scroller.clientHeight + 1;
      if (!start.dragging) {
        if (scrollable && (start.scroller.scrollTop > 0 || dy < 0)) return; // her scroll, not ours
        if (event.target.closest?.(".reaction-bar__tray")) return;
        if (dy > 6) start.dragging = true;
        else {
          // Nothing behind the reveal may scroll.
          if (!scrollable && event.cancelable) event.preventDefault();
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      start.last = dy;
      setDrag(dy > 0 ? dy : dy / 4, false);
    };
    const up = () => {
      if (!start) return;
      const { dragging, last: dy, t } = start;
      start = null;
      if (!dragging) return;
      const speed = dy / Math.max(1, performance.now() - t);
      if (dy > SWIPE_CLOSE || (dy > 36 && speed > 0.55)) {
        swiped.current = true;
        stage.current?.style.setProperty("--drag", `${dy}px`);
        close.current?.();
      } else setDrag(0, true);
    };
    element.addEventListener("touchstart", down, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", up);
    element.addEventListener("touchcancel", up);
    return () => {
      element.removeEventListener("touchstart", down);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", up);
      element.removeEventListener("touchcancel", up);
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={root}
      className="mail-reveal"
      data-kind={kind}
      data-exit={exit || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={(event) => {
        // A tap anywhere that isn't the paper or one of its buttons folds it away.
        if (exit) return;
        if (event.target.closest?.(".reveal-card, .mail-reveal__after > *, .mail-reveal__ghost, button, a, input, textarea")) return;
        onClose?.();
      }}
    >
      <div ref={veil} className="mail-reveal__veil" aria-hidden="true" />
      <div ref={stage} className="mail-reveal__stage">
        {open ? children : last.current}
      </div>
      <button type="button" className="mail-reveal__close" onClick={() => onClose?.()} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

// The paper's entrance, in ms. It flies out of where she tapped (the jar's neck, an envelope, a row),
// lands with its first panel showing, then the middle and bottom panels swing down toward her.
const FLY = 560;
const SWING = 430;
const SECOND = 250; // the bottom panel starts this long after the middle one
const SWING_EASE = "cubic-bezier(0.42, 0, 0.3, 1)";
const FOLD2 = 178; // the middle panel starts folded up over the top one…
const FOLD3 = 172; // …with the bottom one folded inside it

/** A CSS cubic-bezier as a function of progress (to know when a swinging panel is edge-on). */
function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let t = x;
    for (let i = 0; i < 10; i++) {
      const dx = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - (at(x1, x2, t) - x) / dx));
    }
    return at(y1, y2, t);
  };
}
const swingEase = cubicBezier(0.42, 0, 0.3, 1);

/** When the middle panel, then the bottom one (riding on it), turn to face her, in ms. */
function foldTurns(start2, start3) {
  const angle = (from, start, t) => from * (1 - swingEase(Math.min(1, Math.max(0, (t - start) / SWING))));
  const end = start3 + SWING;
  let middle = end;
  let bottom = end;
  for (let t = start2; t <= end; t += 2) {
    const a2 = angle(FOLD2, start2, t);
    if (middle === end && a2 <= 90) middle = t;
    if (a2 + angle(FOLD3, start3, t) <= 90) {
      bottom = t;
      break;
    }
  }
  return { middle, bottom, end };
}

/**
 * One paper on the stage. `paper()` draws it (called once more per panel while it unfolds, so it
 * must draw the same thing every time). `mode`: "unfold" (a folded note opening), "rise" (it just
 * flies up and settles: a sealed envelope, a quiet message). `origin` is a viewport rect, or null to
 * rise from below. `onShown` fires once it's open, for what goes under it to fade in.
 */
export function RevealCard({ paper, origin = null, mode = "unfold", hold = false, onShown, className = "", sticker = "heart" }) {
  // `hold`: in place (holding its space) but not shown yet, while an envelope opens over it.
  const [phase, setPhase] = useState(() => (reducedMotion() ? "open" : mode === "unfold" ? "folded" : "rising"));
  const box = useRef(null);
  const h2 = useRef(null);
  const h3 = useRef(null);
  const shade2 = useRef(null);
  const shade3 = useRef(null);
  const shown = useRef(onShown);
  shown.current = onShown;

  useLayoutEffect(() => {
    const card = box.current;
    if (!card || hold) return undefined;
    if (phase === "open") {
      shown.current?.();
      return undefined;
    }
    const rect = card.getBoundingClientRect();
    const animations = [];
    const run = (element, frames, options) => {
      if (!element) return null;
      const animation = element.animate(frames, { fill: "both", ...options });
      animations.push(animation);
      return animation;
    };
    // The folded note is the paper's top third (unfold), or the whole paper (rise).
    const part = mode === "unfold" ? rect.height / 3 : rect.height;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + part / 2;
    const from = origin ?? { left: cx - 40, top: window.innerHeight + 30, width: 80, height: 40 };
    const ox = from.left + from.width / 2 - cx;
    const oy = from.top + from.height / 2 - cy;
    const scale = Math.min(0.6, Math.max(0.14, from.width / rect.width));
    card.style.transformOrigin = `50% ${(part / 2 / rect.height) * 100}%`;
    const lift = Math.min(70, Math.abs(oy) * 0.18 + 24);
    const flight = run(
      card,
      [
        { transform: `translate3d(${ox}px, ${oy}px, 0) scale(${scale}) rotate(-14deg)`, opacity: 0 },
        { transform: `translate3d(${ox * 0.9}px, ${oy * 0.82}px, 0) scale(${scale * 1.1}) rotate(-10deg)`, opacity: 1, offset: 0.14 },
        { transform: `translate3d(${ox * 0.25}px, ${oy * 0.25 - lift}px, 0) scale(${0.55 + scale * 0.5}) rotate(5deg)`, opacity: 1, offset: 0.62 },
        { transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: FLY, easing: "cubic-bezier(0.25, 0.7, 0.25, 1)" },
    );
    let finish = flight.finished;
    if (mode === "unfold") {
      const start2 = FLY - 40;
      const start3 = start2 + SECOND;
      const swing = { duration: SWING, easing: SWING_EASE };
      run(h2.current, [{ transform: `rotateX(${FOLD2}deg)` }, { transform: "rotateX(0deg)" }], { ...swing, delay: start2 });
      run(shade2.current, [{ opacity: 0.4 }, { opacity: 0.4, offset: 0.4 }, { opacity: 0 }], { ...swing, delay: start2 });
      run(h3.current, [{ transform: `rotateX(${FOLD3}deg)` }, { transform: "rotateX(0deg)" }], { ...swing, delay: start3 });
      run(shade3.current, [{ opacity: 0.4 }, { opacity: 0.4, offset: 0.4 }, { opacity: 0 }], { ...swing, delay: start3 });
      // Which side of each panel shows is switched exactly when it turns edge-on, instead of
      // trusting backface-visibility (WebKit doesn't always honour it inside a moving 3D fold).
      const { middle, bottom, end } = foldTurns(start2, start3);
      const flip = (element, from, to, at) =>
        run(element, [{ opacity: from }, { opacity: from, offset: at / end }, { opacity: to, offset: Math.min(1, at / end + 0.0005) }, { opacity: to }], { duration: end, easing: "linear" });
      const fold = box.current.querySelector(".reveal-fold");
      flip(fold?.querySelector(".reveal-fold__p2"), 0, 1, middle);
      flip(fold?.querySelector(".reveal-fold__b2"), 1, 0, middle);
      // The bottom panel lies folded over the middle one, out of sight until that one is edge-on.
      flip(h3.current, 0, 1, middle);
      flip(fold?.querySelector(".reveal-fold__p3"), 0, 1, bottom);
      flip(fold?.querySelector(".reveal-fold__b3"), 1, 0, bottom);
      finish = Promise.all(animations.map((a) => a.finished));
    }
    let alive = true;
    const settle = () => {
      if (!alive) return;
      alive = false;
      setPhase("open");
      for (const animation of animations) animation.cancel();
      card.style.transformOrigin = "";
    };
    finish.then(settle).catch(() => {});
    // Never stuck folded: if the animations don't report back (a background tab), open anyway.
    const safety = setTimeout(settle, FLY + SWING + SECOND + 2400);
    return () => {
      alive = false;
      clearTimeout(safety);
      for (const animation of animations) animation.cancel();
    };
  }, [phase === "open", hold]); // eslint-disable-line react-hooks/exhaustive-deps

  const unfolding = mode === "unfold" && phase === "folded";
  return (
    <div ref={box} className={`reveal-card ${className}`.trim()} data-phase={hold ? "held" : phase} data-mode={mode}>
      <div className="reveal-card__base" aria-hidden={unfolding || undefined}>
        {paper()}
      </div>
      {unfolding && (
        <div className="reveal-fold" aria-hidden="true" inert>
          <div className="reveal-fold__face reveal-fold__p1">{paper()}</div>
          <div ref={h2} className="reveal-fold__hinge reveal-fold__h2">
            <div className="reveal-fold__face reveal-fold__p2">
              {paper()}
              <span ref={shade2} className="reveal-fold__shade reveal-fold__shade--2" />
            </div>
            <div className="reveal-fold__back reveal-fold__b2">
              {sticker === "heart" ? (
                <span className="reveal-fold__seal">
                  <svg className="reveal-fold__sticker" viewBox="-16 -16 32 32" aria-hidden="true">
                    <path d="M0 11C-15 1-16-9-9-12-4-14 0-10 0-7 0-10 4-14 9-12 16-9 15 1 0 11Z" fill="#e0476f" stroke="#a8244d" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M-9-7q2-3 5-3" fill="none" stroke="#ffd3df" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  just for u
                </span>
              ) : (
                <span className="reveal-fold__word">{sticker}</span>
              )}
            </div>
            <div ref={h3} className="reveal-fold__hinge reveal-fold__h3">
              <div className="reveal-fold__face reveal-fold__p3">
                {paper()}
                <span ref={shade3} className="reveal-fold__shade reveal-fold__shade--3" />
              </div>
              <div className="reveal-fold__back reveal-fold__b3" />
            </div>
          </div>
        </div>
      )}
      {phase === "open" && mode === "unfold" && !reducedMotion() && (
        <span className="reveal-hearts" aria-hidden="true">
          {["♡", "♥", "✦", "♡", "♥", "✧"].map((charm, i) => (
            <span key={i} style={{ "--i": i }}>
              {charm}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/**
 * A paper that just left (the jar's "another one"): drawn where it was, swept aside, then gone.
 * The new one flies in at the same time.
 */
export function SweptPaper({ rect, paper, onGone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reducedMotion()) {
      onGone?.();
      return undefined;
    }
    const animation = node.animate(
      [
        { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
        { transform: "translate3d(-18px, -10px, 0) rotate(-3deg)", opacity: 1, offset: 0.25 },
        { transform: "translate3d(-115vw, 60px, 0) rotate(-16deg)", opacity: 0 },
      ],
      { duration: 420, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)", fill: "both" },
    );
    animation.finished.then(() => onGone?.()).catch(() => {});
    return () => animation.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="mail-reveal__ghost" aria-hidden="true" inert style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      {paper()}
    </div>
  );
}
