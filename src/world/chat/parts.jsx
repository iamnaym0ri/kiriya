import { useEffect, useRef, useState } from "react";
import { useMediaUrl } from "../../lib/chatCrypto.js";

/** The chat's line icons (24 × 24, drawn here; currentColor). */
export function ChatIcon({ name, size = 22, stroke = 1.8 }) {
  const paths = {
    send: <path d="M4.5 12 20 4.5 14.5 20l-2.8-6.6L4.5 12Z" />,
    up: <path d="M12 19V5.5M6.5 11 12 5.5l5.5 5.5" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 17 5-5 4 4 2-2 5 4" />
        <circle cx="15.5" cy="9.5" r="1.5" />
      </>
    ),
    clip: <path d="M20.5 11.2 12.2 19.5a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    heart: <path d="M12 20S3 14 3 8.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 1.5C21 14 12 20 12 20Z" />,
    back: <path d="M15 5 8 12l7 7" />,
    palette: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.2 0-1 .8-1.9 1.9-1.9H17a4 4 0 0 0 4-4c0-4.2-4-7.5-9-7.5Z" />
        <circle cx="7.5" cy="11.5" r="1" />
        <circle cx="10.5" cy="7.5" r="1" />
        <circle cx="15" cy="8" r="1" />
      </>
    ),
    down: <path d="m6 9 6 6 6-6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    play: <path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.2-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    book: (
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" />
        <path d="M4 19V5M9 7h6" />
      </>
    ),
    reply: (
      <>
        <path d="M9.5 14.5 4.5 9.5l5-5" />
        <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-2.5" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4.2L19.3 8.9a2.9 2.9 0 0 0-4.2-4.2L4 15.8V20Z" />
        <path d="m13.6 6.2 4.2 4.2" />
      </>
    ),
    trash: <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12M9.5 7V4.5h5V7" />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.5" />
        <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
      </>
    ),
    save: (
      <>
        <path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1Z" />
        <path d="M12 12.2s-2.6-1.6-2.6-3.2a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.6-2.6 3.2-2.6 3.2Z" />
      </>
    ),
    expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const minutes = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** A voice note: play/pause, its little waveform filling as it plays, and the time. */
export function VoiceNote({ media }) {
  const src = useMediaUrl(media);
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(0);
  const peaks = media.peaks?.length ? media.peaks : Array.from({ length: 28 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
  useEffect(() => () => audio.current?.pause(), []);
  function toggle(event) {
    event.stopPropagation();
    if (!src) return;
    if (!audio.current) {
      audio.current = new Audio(src);
      audio.current.addEventListener("timeupdate", () => {
        setNow(audio.current.currentTime);
        setProgress(audio.current.currentTime / (audio.current.duration || media.duration));
      });
      audio.current.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
        setNow(0);
      });
    }
    if (playing) audio.current.pause();
    else audio.current.play().catch(() => setPlaying(false));
    setPlaying(!playing);
  }
  return (
    <div className="voice">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause voice note" : "Play voice note"} disabled={!src}>
        <ChatIcon name={playing ? "pause" : "play"} size={18} stroke={2.2} />
      </button>
      <span className="voice__bars" aria-hidden="true">
        {peaks.map((peak, i) => (
          <i key={i} style={{ "--peak": Math.max(0.14, peak) }} data-played={i / peaks.length < progress || undefined} />
        ))}
      </span>
      <span className="voice__time">{minutes(playing ? now : media.duration)}</span>
    </div>
  );
}

/** "…is typing", in her chosen style, drawn inside a little bubble of theirs. */
export function TypingIndicator({ style = "hearts", name }) {
  return (
    <div className="typing" role="status" aria-label={`${name} is typing`}>
      {style === "hearts" && (
        <span className="typing__hearts" aria-hidden="true">
          <i>♥</i>
          <i>♥</i>
          <i>♥</i>
        </span>
      )}
      {style === "dots" && (
        <span className="typing__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {style === "pencil" && (
        <svg className="typing__pencil" width="64" height="28" viewBox="0 0 64 28" aria-hidden="true">
          <path className="scribble" d="M4 20q6-10 12 0t12 0 12 0 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <g className="pencil">
            <path d="m4 18 3-12 4 1-3 12-3 1Z" fill="#f6c28b" stroke="#6e4a85" strokeWidth="1.2" />
            <path d="m4 18 1 2 2-1Z" fill="#4e2f63" />
          </g>
        </svg>
      )}
      {style === "maomao" && (
        <svg className="typing__maomao" width="60" height="30" viewBox="0 0 60 30" aria-hidden="true">
          <path d="M14 18h32l-4 10H18Z" fill="#d9c3a5" stroke="#7a5b3e" strokeWidth="1.2" />
          <ellipse cx="30" cy="18" rx="16" ry="3" fill="#b99671" />
          <g className="pestle">
            <path d="m30 10 6-9" stroke="#7a5b3e" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="22" cy="15" r="1.6" fill="#6c9a5b" />
          <circle cx="37" cy="14.5" r="1.4" fill="#8fbf6f" />
        </svg>
      )}
      <span className="typing__label">{name} is typing…</span>
    </div>
  );
}
