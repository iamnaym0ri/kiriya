import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { restoreAudioSession, unlockAudio, useSound } from "./sound.js";
import "./kit.css";

// Shared pieces for the luck shelf's games. Each game fills the hub's sheet (RENOVATION.md,
// "Games"): the sheet draws the top bar and back button; a game draws everything below it.

/** The game's stage: fills the sheet, never scrolls or zooms the page behind it. */
export const LuckStage = forwardRef(function LuckStage({ className = "", children, ...rest }, ref) {
  useEffect(() => restoreAudioSession, []);
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

// The how-to's little marks, drawn (a number is simply written).
const MARK_PATHS = {
  crank: <><path d="M18.4 9.2A7 7 0 1 0 19 14" /><path d="M19 4.5v5h-5" /></>,
  capsule: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16" /><path d="M8.5 8.5c.8-1 2-1.6 3.3-1.7" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 7.6l1.3 2.8 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="currentColor" stroke="none" /></>,
  updown: <><path d="M8 19V5M4.5 8.5L8 5l3.5 3.5" /><path d="M16 5v14M12.5 15.5L16 19l3.5-3.5" /></>,
  same: <path d="M6 9.5h12M6 14.5h12" />,
  heart: <path d="M12 19.5C6 15.6 3.5 12.7 3.5 9.6A4 4 0 0 1 12 7.8a4 4 0 0 1 8.5 1.8c0 3.1-2.5 6-8.5 9.9z" />,
  star: <path d="M12 3.8l2.4 5 5.4.7-4 3.7 1 5.4L12 16l-4.8 2.6 1-5.4-4-3.7 5.4-.7z" />,
  swap: <><path d="M4 9h15M15.5 5.5L19 9l-3.5 3.5" /><path d="M20 15H5M8.5 11.5L5 15l3.5 3.5" /></>,
  tin: <><path d="M6.5 7.5h11l-1 12h-9z" /><path d="M6.5 7.5c0-1.4 2.5-2.3 5.5-2.3s5.5.9 5.5 2.3" /><path d="M12.6 5.2l1.2-3" /></>,
  bow: <><path d="M12 12c-2.5-4-7.5-5-7.5-1.5S9.5 13 12 12zM12 12c2.5-4 7.5-5 7.5-1.5S14.5 13 12 12z" /><path d="M11 13l-2.5 6M13 13l2.5 6" /></>,
  flower: <><circle cx="12" cy="12" r="2.4" /><path d="M12 9.6c-1.6-3.6 1.6-3.6 0 0M14.3 11.3c3.5-1.9 4.5 1.2.4 1.2M13.4 14.1c2.3 3.2-.4 5.1-1.4 1.2M10.6 14.1c-2.3 3.2.4 5.1 1.4 1.2M9.7 11.3c-3.5-1.9-4.5 1.2-.4 1.2" /></>,
  lantern: <><path d="M8 7.5c0-2 1.8-3 4-3s4 1 4 3v7c0 2.2-1.8 4-4 4s-4-1.8-4-4z" /><path d="M10 4.5h4M10 18.5h4M12 18.5v2.5" /></>,
};
function Mark({ mark }) {
  const drawing = MARK_PATHS[mark];
  if (!drawing) return mark;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {drawing}
    </svg>
  );
}

const HOWTO_KEY = "kiriya:luck-howto";
const seenHowTo = () => {
  try {
    return JSON.parse(localStorage.getItem(HOWTO_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

/**
 * The strip under the sheet's top bar: the game's own chips on the left, "how to play" and sound on
 * the right. `help` ({ game, steps: [[mark, text], …] }) is shown by itself the first time she
 * opens the game, and again whenever she taps "?".
 */
export function StatusBar({ children, help }) {
  const [firstTime, setFirstTime] = useState(() => Boolean(help) && !seenHowTo()[help.game]);
  const [open, setOpen] = useState(firstTime);
  const close = () => {
    setOpen(false);
    if (!firstTime) return;
    setFirstTime(false);
    try {
      localStorage.setItem(HOWTO_KEY, JSON.stringify({ ...seenHowTo(), [help.game]: Date.now() }));
    } catch {
      // Private mode: she'll simply see the how-to again next time.
    }
  };
  return (
    <>
      <div className="luck-status">
        <div className="luck-status__chips">{children}</div>
        <div className="luck-status__end">
          {help && (
            <button type="button" className="luck-round luck-round--q" aria-label="how to play" onClick={() => setOpen(true)}>
              <span aria-hidden="true">?</span>
            </button>
          )}
          <SoundButton />
        </div>
      </div>
      {help && (
        <Panel open={open} onClose={close} title="how to play" className="luck-howto">
          <ol className="luck-howto__steps">
            {help.steps.map(([mark, text]) => (
              <li key={text}>
                <span className="luck-howto__mark" aria-hidden="true"><Mark mark={mark} /></span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="luck-btn luck-howto__go" onClick={close}>
            {firstTime ? "let's play ♡" : "okay ♡"}
          </button>
        </Panel>
      )}
    </>
  );
}

/** A panel that slides up inside the stage (her charm book, her keepsakes). */
export function Panel({ open, title, onClose, children, className = "" }) {
  const id = useId();
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`luck-panel-layer ${className}`} data-open={open} aria-hidden={!open} inert={!open}>
      <button type="button" className="luck-panel-backdrop" tabIndex={-1} aria-label="close" onClick={onClose} />
      <section ref={panelRef} className="luck-panel" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="luck-panel__head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="luck-round" aria-label="close" onClick={onClose}>
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
