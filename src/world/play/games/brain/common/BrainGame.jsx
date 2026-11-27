import { useEffect, useId, useRef, useState } from "react";
import { setSoundOn, useSoundOn } from "./feel.js";
import { readStore, writeStore } from "./hooks.js";
import "./brain.css";

// The frame every brain-power game sits in. The play hub's sheet already gives the "‹ play" bar and
// the title; this fills the sheet's stage (height 100%), adds a slim status strip with the game's
// own tools, sound and "how to play", and stops stray pinches and double-taps from zooming while
// she plays. The board area (`.brain-stage`) is a size container, so boards can size themselves
// with cqw/cqh units.

function SoundIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      {on ? (
        <path d="M15.2 9.2q1.6 2.8 0 5.6M17.8 7q3.3 5 0 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function ToolButton({ label, onClick, children, pressed, className = "" }) {
  return (
    <button type="button" className={`brain-tool ${className}`} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/** "How to play": a card that rises inside the game (first visit, and from the ? button). */
function HowTo({ title, children, onClose }) {
  const id = useId();
  const card = useRef(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="brain-howto" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={card} className="brain-howto__card" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <h2 id={id}>{title}</h2>
        <div className="brain-howto__body">{children}</div>
        <button type="button" className="brain-btn" onClick={onClose}>
          let’s play
          <svg viewBox="0 0 20 18" className="brain-heart-glyph" aria-hidden="true">
            <path d="M10 16.5C3.5 12.3 1.5 9 1.5 6 1.5 3.4 3.4 1.5 5.8 1.5c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.9 4.3 4.5 0 3-2 6.3-8.5 10.5z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function BrainGame({ id, status, tools, howToTitle = "how to play", howTo, children, className = "", style }) {
  const root = useRef(null);
  const sound = useSoundOn();
  const seenKey = `kiriya:brain:${id}:howto`;
  const [help, setHelp] = useState(() => !readStore(seenKey, false));
  const closeHelp = () => {
    writeStore(seenKey, true);
    setHelp(false);
  };

  useEffect(() => {
    const node = root.current;
    // Safari's pinch gestures; touch-action covers double-tap zoom.
    const stop = (event) => event.preventDefault();
    node.addEventListener("gesturestart", stop);
    node.addEventListener("gesturechange", stop);
    return () => {
      node.removeEventListener("gesturestart", stop);
      node.removeEventListener("gesturechange", stop);
    };
  }, []);

  return (
    <div ref={root} className={`brain-game ${className}`} data-game={id} style={style}>
      <div className="brain-strip">
        <div className="brain-strip__status" aria-live="polite">
          {status}
        </div>
        <div className="brain-strip__tools">
          {tools}
          <ToolButton label={sound ? "sound on" : "sound off"} pressed={sound} onClick={() => setSoundOn(!sound)} className="brain-tool--sound">
            <SoundIcon on={sound} />
          </ToolButton>
          <ToolButton label="how to play" onClick={() => setHelp(true)}>
            <span className="brain-tool__q" aria-hidden="true">?</span>
          </ToolButton>
        </div>
      </div>
      <div className="brain-stage">{children}</div>
      {help && howTo && (
        <HowTo title={howToTitle} onClose={closeHelp}>
          {howTo}
        </HowTo>
      )}
    </div>
  );
}
