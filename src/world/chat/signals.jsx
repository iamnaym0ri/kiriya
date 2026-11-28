// The quick signals' looks (round 3): each one's own colour and short word, the red heart, and the
// glyph a signal shows in the composer's row and in the chat.

// Each signal's own feeling: a colour, a short word under its button, and its own little motion
// (Chat.css, .signal-tile[data-signal]).
export const SIGNAL_LOOK = {
  thinking: { word: "thinking", color: "#ff4d79" },
  hug: { word: "hug", color: "#ff9a52" },
  kiss: { word: "kiss", color: "#ff5ca8" },
  morning: { word: "morning", color: "#f5b82e" },
  night: { word: "night", color: "#5d6bd8" },
  miss: { word: "miss you", color: "#5f9dff" },
  water: { word: "water", color: "#22bcd4" },
};

/** A filled heart (the "thinking of you" signal, and the composer's signal button). */
export function RedHeart({ size = 22, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.6S3 14.9 3 8.9A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 9 1.6c0 6-9 11.7-9 11.7Z" fill="currentColor" />
      <path d="M7.4 7.6a2.4 2.4 0 0 0-2 2.1" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** A signal's picture: its emoji, or the red heart for "thinking of you". */
export function SignalGlyph({ tap, size = 22 }) {
  return tap.key === "thinking" ? <RedHeart size={size} className="signal-heart" /> : tap.emoji;
}
