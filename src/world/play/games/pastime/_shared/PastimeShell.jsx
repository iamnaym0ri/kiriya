import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { isMuted, onMutedChange, setMuted } from "./sound.js";
import { load, save } from "./storage.js";
import "./pastime.css";

/** True while the app is in the background or the screen is off. */
export function usePageHidden() {
  return useSyncExternalStore(
    (notify) => {
      document.addEventListener("visibilitychange", notify);
      window.addEventListener("pagehide", notify);
      return () => {
        document.removeEventListener("visibilitychange", notify);
        window.removeEventListener("pagehide", notify);
      };
    },
    () => document.visibilityState === "hidden",
    () => false,
  );
}

/**
 * Paused when she leaves the app; stays paused (with a "carry on" card) until she taps back in, so
 * nothing moves while she isn't looking. `pause()`/`resume()` for the game's own pause button.
 */
export function usePause() {
  const hidden = usePageHidden();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (hidden) setPaused(true);
  }, [hidden]);
  return { paused: paused || hidden, pause: () => setPaused(true), resume: () => setPaused(false) };
}

export function useMuted() {
  return useSyncExternalStore(onMutedChange, isMuted, () => false);
}

function SoundIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M15.5 9c1.2 1.6 1.2 4.4 0 6M18.5 7c2.3 2.8 2.3 7.2 0 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** A small sheet inside the game: how to play, finished rounds, choices. */
export function PastimeSheet({ open, title, children, onClose, closeLabel = "okay ♡" }) {
  const id = useId();
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    panel.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="pastime-sheet" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div ref={panel} className="pastime-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <h2 id={id} className="pastime-sheet__title">{title}</h2>
        <div className="pastime-sheet__body">{children}</div>
        {onClose && closeLabel && (
          <button type="button" className="pastime-button pastime-button--primary pastime-sheet__close" onClick={onClose}>{closeLabel}</button>
        )}
      </div>
    </div>
  );
}

/**
 * What every pastime game sits in, inside the hub's sheet (which owns the title and "‹ play"): a
 * slim line with the game's little kicker, sound and "how to play". It fills its container and
 * keeps the page from scrolling or zooming underneath the game. The how-to opens by itself the
 * first time she plays a game; `onHelp(open)` lets a game with a clock or falling pieces wait.
 */
export default function PastimeShell({ game, kicker, help, actions, children, className = "", onHelp }) {
  const muted = useMuted();
  const [firstTime, setFirstTime] = useState(() => Boolean(help) && !load("seen-help", {})[game]);
  const [helpOpen, setHelpOpen] = useState(firstTime);
  const root = useRef(null);
  const onHelpRef = useRef(onHelp);
  onHelpRef.current = onHelp;
  useEffect(() => {
    onHelpRef.current?.(helpOpen);
  }, [helpOpen]);
  const closeHelp = () => {
    setHelpOpen(false);
    if (!firstTime) return;
    save("seen-help", { ...load("seen-help", {}), [game]: Date.now() });
    setFirstTime(false);
  };

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("pastime-open");
    // Safari's pinch gesture events: a pinch on the game never zooms the page.
    const stop = (event) => event.preventDefault();
    const node = root.current;
    node?.addEventListener("gesturestart", stop);
    node?.addEventListener("gesturechange", stop);
    return () => {
      html.classList.remove("pastime-open");
      node?.removeEventListener("gesturestart", stop);
      node?.removeEventListener("gesturechange", stop);
    };
  }, []);

  return (
    <div ref={root} className={`pastime pastime--${game} ${className}`} data-game={game}>
      <div className="pastime__head">
        <span className="pastime__kicker">{kicker}</span>
        <div className="pastime__actions">
          {actions}
          <button type="button" className="pastime__icon" onClick={() => setMuted(!muted)} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            <SoundIcon muted={muted} />
          </button>
          {help && (
            <button type="button" className="pastime__icon" onClick={() => setHelpOpen(true)} aria-label="How to play">
              <span aria-hidden="true" className="pastime__q">?</span>
            </button>
          )}
        </div>
      </div>
      <div className="pastime__body">{children}</div>
      {help && (
        <PastimeSheet open={helpOpen} title="how to play" onClose={closeHelp} closeLabel={firstTime ? "let's play ♡" : "okay ♡"}>
          {help}
        </PastimeSheet>
      )}
    </div>
  );
}

/** Shown over a game with a clock or falling pieces after she comes back to the app. */
export function PausedCard({ onResume, line = "the game waited for you." }) {
  return (
    <div className="pastime-paused" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="pastime-paused__card">
        <span className="pastime__kicker">PAUSED</span>
        <p>{line}</p>
        <button type="button" className="pastime-button pastime-button--primary" onClick={onResume} autoFocus>carry on ♡</button>
      </div>
    </div>
  );
}

/** The size of an element (the space a board may use), kept current as the sheet resizes. */
export function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize((old) => (Math.abs(old.width - rect.width) < 0.5 && Math.abs(old.height - rect.height) < 0.5 ? old : { width: rect.width, height: rect.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** setTimeout that is cancelled when the game closes. */
export function useTimers() {
  const timers = useRef(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return useRef({
    wait(ms) {
      return new Promise((resolve) => {
        const id = setTimeout(() => {
          timers.current.delete(id);
          resolve();
        }, ms);
        timers.current.add(id);
      });
    },
    later(fn, ms) {
      const id = setTimeout(() => {
        timers.current.delete(id);
        fn();
      }, ms);
      timers.current.add(id);
      return id;
    },
    cancel(id) {
      clearTimeout(id);
      timers.current.delete(id);
    },
  }).current;
}

export { prefersLessMotion } from "../../../../../shared/effects.js";
