import { forwardRef, useEffect, useId, useRef } from "react";
import { unlockAudio, useSound } from "./sound.js";
import "./kit.css";

// Shared pieces for the luck shelf's games. Each game fills the hub's sheet (RENOVATION.md,
// "Games"): the sheet draws the top bar and back button; a game draws everything below it.

/** The game's stage: fills the sheet, never scrolls or zooms the page behind it. */
export const LuckStage = forwardRef(function LuckStage({ className = "", children, ...rest }, ref) {
  return (
    <div ref={ref} className={`luck-stage ${className}`} onPointerDownCapture={unlockAudio} {...rest}>
      {children}
    </div>
  );
});

function SpeakerIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity=".18" />
      {on ? <path d="M15.5 9c1.2 1.6 1.2 4.4 0 6M18.2 6.6c2.6 3 2.6 7.8 0 10.8" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}

export function SoundButton() {
  const [on, toggle] = useSound();
  return (
    <button type="button" className="luck-round" aria-pressed={on} aria-label={on ? "sound on" : "sound off"} onClick={toggle}>
      <SpeakerIcon on={on} />
    </button>
  );
}

/** The strip under the sheet's top bar: the game's own chips on the left, sound on the right. */
export function StatusBar({ children }) {
  return (
    <div className="luck-status">
      <div className="luck-status__chips">{children}</div>
      <SoundButton />
    </div>
  );
}

/** A panel that slides up inside the stage (her charm book, her keepsakes). */
export function Panel({ open, title, onClose, children, className = "" }) {
  const id = useId();
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`luck-panel-layer ${className}`} data-open={open} aria-hidden={!open} inert={!open}>
      <button type="button" className="luck-panel-backdrop" tabIndex={-1} aria-label="close" onClick={onClose} />
      <section className="luck-panel" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="luck-panel__head">
          <h2 id={id}>{title}</h2>
          <button ref={closeRef} type="button" className="luck-round" aria-label="close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="luck-panel__body">{children}</div>
      </section>
    </div>
  );
}

/** Where confetti falls: a canvas over the whole stage that never takes a tap. */
export const ConfettiCanvas = forwardRef(function ConfettiCanvas(props, ref) {
  return <canvas ref={ref} className="luck-confetti" aria-hidden="true" {...props} />;
});

/** A small hand-drawn sparkle for decoration. */
export function Sparkle({ size = 14, className = "", style }) {
  return (
    <svg className={`luck-sparkle ${className}`} style={style} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="M10 1c.8 4.6 3.4 7.2 9 9-5.6 1.8-8.2 4.4-9 9-.8-4.6-3.4-7.2-9-9 5.6-1.8 8.2-4.4 9-9z" fill="currentColor" />
    </svg>
  );
}

/** "tomorrow" in words she'd use: how long until Singapore's midnight. */
export function untilTomorrow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  const left = (24 * 60) - (hour * 60 + minute);
  if (left <= 60) return `in ${Math.max(1, left)} min`;
  return `in ${Math.round(left / 60)} h`;
}
