import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./GameSheet.css";

// The full-screen sheet every game (and the sketchbook) opens in (docs/refactor/RENOVATION.md,
// "Games"): above the header and the tab bar, safe areas padded, a 44 pt top bar with "‹ play" and
// the title, and a stage the game fills. Nothing behind it scrolls while it's open. Portalled to
// <body>, because the content column is its own stacking context. Owner: the frame agent.

const EXIT_MS = 240;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tells the iPhone app to pause its edge swipe-back while a game is open (if the build supports it). */
function setSwipeBack(enabled) {
  try {
    window.webkit?.messageHandlers?.kiriyaSwipeBack?.postMessage(enabled);
  } catch {
    // Older builds have no such handler; the swipe then simply closes the game.
  }
}

export default function GameSheet({ open, title, backLabel = "play", onClose, children, stageClassName = "", trailing = null }) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, reduced() ? 0 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return undefined;
    const root = document.documentElement;
    root.classList.add("game-sheet-open");
    setSwipeBack(false);
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("game-sheet-open");
      setSwipeBack(true);
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  return createPortal(
    <div
      ref={panel}
      className="game-sheet"
      data-leaving={leaving || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <header className="game-sheet__bar">
        <button type="button" className="game-sheet__back" onClick={onClose}>
          {backLabel}
        </button>
        <h2 className="game-sheet__title">{title}</h2>
        <div className="game-sheet__trailing">{trailing}</div>
      </header>
      <div className={`game-sheet__stage ${stageClassName}`.trim()}>{children}</div>
    </div>,
    document.body,
  );
}
