import { useEffect, useRef, useState } from "react";
import { useMediaUrl } from "../../../lib/chatCrypto.js";

const time = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** A saved voice note, played right in its card. Only one plays at a time on the page. */
export function VoicePlayer({ media }) {
  const src = useMediaUrl(media);
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const duration = media?.duration ?? 0;
  const peaks = media?.peaks?.length ? media.peaks : Array.from({ length: 32 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
  useEffect(() => {
    const stopOthers = (event) => event.detail !== audio.current && audio.current?.pause();
    window.addEventListener("kiriya:memory-voice", stopOthers);
    return () => {
      window.removeEventListener("kiriya:memory-voice", stopOthers);
      audio.current?.pause();
    };
  }, []);
  function toggle() {
    if (!src) return;
    if (!audio.current) {
      const element = new Audio(src);
      element.addEventListener("timeupdate", () => setAt(element.currentTime));
      element.addEventListener("pause", () => setPlaying(false));
      element.addEventListener("play", () => setPlaying(true));
      element.addEventListener("ended", () => setAt(0));
      audio.current = element;
    }
    if (playing) audio.current.pause();
    else {
      window.dispatchEvent(new CustomEvent("kiriya:memory-voice", { detail: audio.current }));
      audio.current.play().catch(() => setPlaying(false));
    }
  }
  const progress = duration ? Math.min(1, at / duration) : 0;
  return (
    <div className="memory-voice" data-playing={playing || undefined}>
      <button type="button" onClick={toggle} disabled={!src} aria-label={!src ? "opening the voice note…" : playing ? "Pause voice note" : "Play voice note"}>
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m8 5 11 7-11 7Z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span className="memory-voice__bars" aria-hidden="true">
        {peaks.map((peak, i) => (
          <i key={i} style={{ height: `${Math.max(14, peak * 100)}%` }} data-played={i / peaks.length < progress || undefined} />
        ))}
      </span>
      <span className="memory-voice__time">{time(playing || at ? at : duration)}</span>
    </div>
  );
}
