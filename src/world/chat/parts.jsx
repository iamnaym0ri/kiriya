import { useEffect, useRef, useState } from "react";
import { tapByKey } from "../../../shared/taps.js";
import { Modal } from "../../shared/WorldPrimitives.jsx";
import { tapFeedback } from "../../lib/native.js";
import { useMediaUrl } from "../../lib/chatCrypto.js";

export function ChatIcon({ name, size = 22 }) {
  const paths = {
    send: <path d="M4 12 20 4l-6 16-3-7-7-1Z" />,
    smile: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5q3.5 3 7 0M9 9.5h.01M15 9.5h.01" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 17 5-5 4 4 2-2 5 4" />
        <circle cx="15.5" cy="9.5" r="1.5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    sticker: (
      <>
        <path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8l7-7V6a3 3 0 0 0-3-3h-4" />
        <path d="M14 21v-4a3 3 0 0 1 3-3h4" />
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
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    book: (
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" />
        <path d="M4 19V5M9 7h6" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const ONLY_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u;
const isBigEmoji = (text) => ONLY_EMOJI.test(text) && [...text.replace(/\s/g, "")].length <= 8;
const minutes = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export function VoiceNote({ media }) {
  const src = useMediaUrl(media);
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const peaks = media.peaks?.length ? media.peaks : Array.from({ length: 28 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
  useEffect(() => () => audio.current?.pause(), []);
  function toggle() {
    if (!src) return;
    if (!audio.current) {
      audio.current = new Audio(src);
      audio.current.addEventListener("timeupdate", () => setProgress(audio.current.currentTime / (audio.current.duration || media.duration)));
      audio.current.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    if (playing) audio.current.pause();
    else audio.current.play().catch(() => setPlaying(false));
    setPlaying(!playing);
  }
  return (
    <div className="voice">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause voice note" : "Play voice note"}>
        <ChatIcon name={playing ? "pause" : "play"} size={18} />
      </button>
      <span className="voice__bars" aria-hidden="true">
        {peaks.map((peak, i) => (
          <i key={i} style={{ height: `${Math.max(12, peak * 100)}%` }} data-played={i / peaks.length < progress || undefined} />
        ))}
      </span>
      <span className="voice__time">{minutes(playing ? (audio.current?.currentTime ?? 0) : media.duration)}</span>
    </div>
  );
}

function TapCard({ message, mine, names, onTapBack }) {
  const tap = tapByKey[message.body];
  if (!tap) return null;
  const who = mine ? "you" : names[message.sender];
  return (
    <div className="tap-card">
      <span className="tap-card__emoji" aria-hidden="true">{tap.emoji}</span>
      <strong>{mine ? `you sent ${tap.label}` : `${who} sent ${tap.label}`}</strong>
      {!mine && (
        <button type="button" className="text-link" onClick={() => onTapBack(tap.key)}>
          send one back ♡
        </button>
      )}
      <small>{new Date(message.createdAt).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" })}</small>
    </div>
  );
}

/** One picture through the encryption hooks (src/lib/chatCrypto.js): never media.url directly. */
function MediaImage({ media, alt, onOpen, ...props }) {
  const src = useMediaUrl(media);
  if (!src) return <span className="msg__opening" style={props.style} aria-label="opening…" />;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onClick={onOpen ? () => onOpen(src) : undefined} {...props} />;
}

function Content({ message, onOpenImage }) {
  if (message.locked) return <div className="bubble msg__locked">this one is still unlocking ♡</div>;
  switch (message.kind) {
    case "deleted":
      return <div className="bubble msg__deleted">message unsent</div>;
    case "image":
      return (
        <div className="bubble bubble--media">
          <MediaImage
            media={message.media}
            alt={message.media.alt ?? "a photo"}
            style={message.media.width ? { aspectRatio: `${message.media.width} / ${message.media.height}` } : undefined}
            onOpen={onOpenImage}
          />
          {message.body && <div className="bubble__caption">{message.body}</div>}
        </div>
      );
    case "gif":
      return (
        <div className="bubble bubble--media">
          <MediaImage media={message.media} alt={message.media.alt ?? "a GIF"} style={message.media.width ? { aspectRatio: `${message.media.width} / ${message.media.height}` } : undefined} />
        </div>
      );
    case "sticker":
      return (
        <div className="msg__sticker">
          <MediaImage media={message.media} alt={message.media.alt ?? "a sticker"} />
        </div>
      );
    case "voice":
      return (
        <div className="bubble">
          <VoiceNote media={message.media} />
        </div>
      );
    default:
      return isBigEmoji(message.body) ? <div className="msg__big">{message.body}</div> : <div className="bubble">{message.body}</div>;
  }
}

function statusOf(message, readByThem) {
  if (message.failed) return "failed";
  if (message.pending) return "sending…";
  if (readByThem) return "seen ♡";
  return "sent";
}

/** One message. Long-press (or right-click) opens its little menu. */
export function Message({ message, me, names, first, last, showStatus, readByThem, onActions, onRetry, onQuote, onOpenImage, onTapBack }) {
  const mine = message.sender === me;
  const press = useRef(null);
  const [pressed, setPressed] = useState(false);
  if (message.kind === "tap")
    return (
      <div className="msg msg--tap">
        <TapCard message={message} mine={mine} names={names} onTapBack={onTapBack} />
      </div>
    );
  const start = () => {
    if (message.pending || message.kind === "deleted") return;
    setPressed(true);
    press.current = setTimeout(() => {
      setPressed(false);
      tapFeedback();
      onActions(message);
    }, 420);
  };
  const cancel = () => {
    clearTimeout(press.current);
    setPressed(false);
  };
  const reactions = Object.values(message.reactions ?? {});
  const status = statusOf(message, readByThem);
  return (
    <div
      className="msg"
      data-mine={mine || undefined}
      data-first={first || undefined}
      data-last={last || undefined}
      data-pending={message.pending || undefined}
      data-pressed={pressed || undefined}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => {
        event.preventDefault();
        cancel();
        if (!message.pending && message.kind !== "deleted") onActions(message);
      }}
    >
      {message.replyTo && (
        <button type="button" className="msg__quote" onClick={() => onQuote(message.replyTo.id)}>
          ↩ {message.replyTo.sender === me ? "you" : names[message.replyTo.sender]}: {message.replyTo.kind === "text" ? message.replyTo.body : message.replyTo.kind === "deleted" ? "message unsent" : `a ${message.replyTo.kind}`}
        </button>
      )}
      <Content message={message} onOpenImage={onOpenImage} />
      {reactions.length > 0 && (
        <div className="msg__reactions" aria-label={`reactions: ${reactions.join(" ")}`}>
          {reactions.map((emoji, i) => (
            <span key={i}>{emoji}</span>
          ))}
        </div>
      )}
      {mine && (showStatus || message.failed || message.pending) && (
        <div className="msg__status" role={message.failed ? "alert" : undefined}>
          {status === "failed" ? (
            <>
              didn’t send ·{" "}
              <button type="button" onClick={() => onRetry(message)}>
                try again
              </button>
            </>
          ) : (
            status
          )}
        </div>
      )}
    </div>
  );
}

const QUICK_REACTIONS = ["♥", "😭", "😂", "🥺", "✨", "😍", "👍"];

export function MessageActions({ message, me, onClose, onReact, onReply, onSave, onUnsend }) {
  const mine = message.sender === me;
  const current = message.reactions?.[me];
  return (
    <Modal title="a little something" onClose={onClose} className="msg-actions-dialog">
      <div className="msg-actions">
        <div className="msg-actions__reactions" role="group" aria-label="React">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" aria-pressed={current === emoji} onClick={() => onReact(current === emoji ? null : emoji)}>
              {emoji}
            </button>
          ))}
        </div>
        <div className="msg-actions__list">
          <button type="button" onClick={onReply}>↩ reply</button>
          {message.kind === "text" && (
            <button type="button" onClick={() => navigator.clipboard?.writeText(message.body).finally(onClose)}>
              ⧉ copy
            </button>
          )}
          <button type="button" onClick={onSave}>✿ save to our memories</button>
          {mine && (
            <button type="button" data-danger onClick={onUnsend}>
              ↺ unsend
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

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
          <path className="scribble" d="M4 20q6-10 12 0t12 0 12 0 12 0" fill="none" stroke="#b48ccb" strokeWidth="2" strokeLinecap="round" />
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
      <span>{name} is typing…</span>
    </div>
  );
}
