// One message in the chat (round 3): its bubble, photos, GIF or voice note, the Discord-like quote
// above a reply, reactions, "edited", and how it's sent and seen. Hold it for the menu; swipe it to
// the left to reply (it follows the finger, ticks once at the point where letting go replies, and
// springs back).
import { memo, useRef } from "react";
import { tapByKey } from "../../../shared/taps.js";
import { haptic } from "../../lib/native.js";
import { mediaItems } from "../../lib/chat.js";
import { Album, GifMedia, QuoteThumb, StickerMedia } from "./media.jsx";
import { ChatIcon, VoiceNote } from "./parts.jsx";

const HOLD_MS = 420;
const SWIPE_MAX = 96;
const SWIPE_REPLY = 58;
const time = (iso) => new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" }).toLowerCase();

const ONLY_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u;
const isBigEmoji = (text) => ONLY_EMOJI.test(text) && [...text.replace(/\s/g, "")].length <= 8 && !/^[\d#*\s]+$/.test(text);

/** A few words for a message, as a quote or a notification would say it. */
export function snippetOf(message) {
  if (!message) return "";
  if (message.locked) return "…";
  switch (message.kind) {
    case "deleted":
      return "original message was deleted";
    case "text":
      return message.body;
    case "image": {
      const items = message.media?.items ?? [message.media ?? {}];
      const count = message.media?.count ?? items.length;
      const videos = items.filter((item) => item?.type === "video").length;
      const what = count > 1 ? `${count} ${videos === count ? "videos" : "photos"}` : videos ? "a video" : "a photo";
      return `${videos === count && count ? "🎬" : "📷"} ${message.body ? message.body : what}`;
    }
    case "gif":
      return "a GIF";
    case "sticker":
      return "a sticker";
    case "voice":
      return "🎙️ a voice note";
    case "tap":
      return `${tapByKey[message.body]?.emoji ?? "♡"} ${tapByKey[message.body]?.label ?? ""}`;
    default:
      return "a message";
  }
}

/** The quote above a reply: who, a few words, and a thumbnail; tap it to jump to the original. */
function Quote({ quote, me, names, onJump }) {
  const missing = quote.kind === "deleted";
  const who = quote.sender === me ? "you" : (names[quote.sender] ?? "");
  return (
    <button type="button" className="quote" data-missing={missing || undefined} disabled={missing} onClick={(event) => (event.stopPropagation(), onJump(quote.id))}>
      <span className="quote__curve" aria-hidden="true" />
      {missing ? (
        <span className="quote__text">original message was deleted</span>
      ) : (
        <>
          <strong className="quote__who">{who}</strong>
          <span className="quote__text">{snippetOf(quote)}</span>
          <QuoteThumb media={quote.media} kind={quote.kind} />
        </>
      )}
    </button>
  );
}

/** A quick signal ("thinking of you", a hug…): a little moment in the middle of the chat. */
function Signal({ message, mine, names, onTapBack, preview }) {
  const tap = tapByKey[message.body];
  if (!tap) return null;
  return (
    <div className="signal" data-signal={tap.key}>
      <span className="signal__emoji" aria-hidden="true">
        {tap.emoji}
      </span>
      <span className="signal__words">
        <strong>{mine ? `you sent ${tap.label}` : `${names[message.sender]} sent ${tap.label}`}</strong>
        <small>
          {tap.note} · {time(message.createdAt)}
        </small>
      </span>
      {!mine && !preview && (
        <button type="button" className="signal__back" onClick={(event) => (event.stopPropagation(), onTapBack(tap.key))}>
          send one back ♡
        </button>
      )}
    </div>
  );
}

function Edited({ message }) {
  return message.editedAt ? <span className="msg__edited">{message.saving ? " · saving…" : " edited"}</span> : null;
}

function Content({ message, onOpenMedia }) {
  if (message.locked) return <div className="bubble msg__locked">this one is still unlocking ♡</div>;
  switch (message.kind) {
    case "image": {
      const items = mediaItems(message);
      return (
        <>
          <div className="msg__media">
            <Album items={items} onOpen={onOpenMedia} />
          </div>
          {message.body && (
            <div className="bubble bubble--caption">
              {message.body}
              <Edited message={message} />
            </div>
          )}
        </>
      );
    }
    case "gif":
      return (
        <div className="msg__media">
          <GifMedia media={message.media ?? {}} />
        </div>
      );
    case "sticker":
      return <StickerMedia media={message.media ?? {}} />;
    case "voice":
      return (
        <div className="bubble bubble--voice">
          <VoiceNote media={message.media ?? {}} />
        </div>
      );
    default:
      return isBigEmoji(message.body) && !message.editedAt ? (
        <div className="msg__big">{message.body}</div>
      ) : (
        <div className="bubble">
          {message.body}
          <Edited message={message} />
        </div>
      );
  }
}

function Status({ message, readByThem, actions, canRetry }) {
  if (message.failed) {
    const locked = message.failure === "locked";
    return (
      <div className="msg__status" data-failed role="alert">
        {locked ? "the chat is still unlocking on this phone" : message.failure === "too_big" ? "that was too big to send" : "didn’t send"}
        {canRetry && message.failure !== "too_big" && (
          <>
            {" · "}
            <button type="button" onClick={(event) => (event.stopPropagation(), actions.retry(message))}>
              try again
            </button>
          </>
        )}
        {" · "}
        <button type="button" onClick={(event) => (event.stopPropagation(), actions.discard(message))}>
          remove
        </button>
      </div>
    );
  }
  const uploading = mediaItems(message).some((item) => typeof item.progress === "number" && item.progress < 100);
  return <div className="msg__status">{message.pending ? (uploading ? "sending your photos…" : "sending…") : readByThem ? "seen ♡" : "sent"}</div>;
}

/**
 * One message. `actions` is one stable object: { hold(message, element), reply(message),
 * jump(id), open(slides, index), tapBack(key), retry(message), discard(message) }.
 */
export const Message = memo(function Message({ message, me, names, first, last, showStatus, readByThem, arrive, flash, leaving, preview, canRetry, actions, design }) {
  const mine = message.sender === me;
  const row = useRef(null);
  const swipe = useRef(null);
  const gesture = useRef(null);
  const swallowClick = useRef(false);
  const interactive = !message.pending && !message.failed && !leaving;

  function release(reply) {
    const g = gesture.current;
    gesture.current = null;
    clearTimeout(g?.timer);
    const node = swipe.current;
    if (row.current) delete row.current.dataset.pressed;
    if (!node || g?.mode !== "swipe") return;
    node.style.transition = "";
    node.style.transform = "";
    row.current?.removeAttribute("data-swiping");
    row.current?.removeAttribute("data-armed");
    if (reply) actions.reply(message);
  }

  const handlers = {
    onPointerDown(event) {
      swallowClick.current = false;
      if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (event.target.closest("button, a, video[controls], .tile__expand")) return;
      const g = { id: event.pointerId, x0: event.clientX, y0: event.clientY, mode: null, armed: false };
      g.timer = setTimeout(() => {
        if (gesture.current !== g || g.mode) return;
        g.mode = "held";
        swallowClick.current = true;
        if (row.current) delete row.current.dataset.pressed;
        haptic("medium");
        actions.hold(message, row.current?.querySelector(".msg__swipe") ?? row.current);
      }, HOLD_MS);
      gesture.current = g;
      if (row.current) row.current.dataset.pressed = "";
    },
    onPointerMove(event) {
      const g = gesture.current;
      if (!g || g.id !== event.pointerId) return;
      const dx = event.clientX - g.x0;
      const dy = event.clientY - g.y0;
      if (!g.mode) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        clearTimeout(g.timer);
        if (row.current) delete row.current.dataset.pressed;
        if (!preview && dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          g.mode = "swipe";
          row.current?.setAttribute("data-swiping", "");
          try {
            row.current?.setPointerCapture(event.pointerId);
          } catch {
            // Capture is a nicety: without it the swipe still follows the finger.
          }
        } else {
          g.mode = "scroll";
          return;
        }
      }
      if (g.mode !== "swipe") return;
      const pull = Math.max(0, -dx);
      const offset = SWIPE_MAX * (1 - Math.exp(-pull / SWIPE_MAX));
      if (swipe.current) {
        swipe.current.style.transition = "none";
        swipe.current.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      const armed = pull >= SWIPE_REPLY;
      if (armed !== g.armed) {
        g.armed = armed;
        if (armed) {
          haptic("light");
          row.current?.setAttribute("data-armed", "");
        } else row.current?.removeAttribute("data-armed");
      }
    },
    onPointerUp(event) {
      const g = gesture.current;
      if (!g || g.id !== event.pointerId) return;
      if (g.mode === "swipe") swallowClick.current = true;
      release(g.mode === "swipe" && g.armed);
    },
    onPointerCancel() {
      release(false);
    },
    onClickCapture(event) {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
    onContextMenu(event) {
      event.preventDefault();
      if (!interactive || gesture.current?.mode === "held") return;
      release(false);
      actions.hold(message, row.current?.querySelector(".msg__swipe") ?? row.current);
    },
  };

  if (message.kind === "tap")
    return (
      <div ref={row} className="msg msg--signal" data-kind="tap" data-mine={mine || undefined} data-arrive={arrive || undefined} data-flash={flash || undefined} data-leaving={leaving || undefined} data-id={message.id} {...handlers}>
        <div ref={swipe} className="msg__swipe">
          <Signal message={message} mine={mine} names={names} onTapBack={actions.tapBack} preview={preview} />
        </div>
        <span className="msg__reply-hint" aria-hidden="true">
          <ChatIcon name="reply" size={18} />
        </span>
      </div>
    );

  const reactions = Object.values(message.reactions ?? {});
  return (
    <div
      ref={row}
      className="msg"
      data-kind={message.kind}
      data-design={design}
      data-mine={mine || undefined}
      data-first={first || undefined}
      data-last={last || undefined}
      data-pending={message.pending || undefined}
      data-failed={message.failed || undefined}
      data-arrive={arrive || undefined}
      data-flash={flash || undefined}
      data-leaving={leaving || undefined}
      data-reacted={reactions.length > 0 || undefined}
      data-id={message.id}
      {...handlers}
    >
      <div ref={swipe} className="msg__swipe">
        {message.replyTo && !message.locked && <Quote quote={message.replyTo} me={me} names={names} onJump={actions.jump} />}
        <Content message={message} onOpenMedia={actions.open} />
        {reactions.length > 0 && (
          <div className="msg__reactions" aria-label={`reactions: ${reactions.join(" ")}`}>
            {reactions.map((emoji, i) => (
              <span key={i}>{emoji}</span>
            ))}
          </div>
        )}
      </div>
      <span className="msg__reply-hint" aria-hidden="true">
        <ChatIcon name="reply" size={18} />
      </span>
      {mine && (showStatus || message.failed || message.pending) && <Status message={message} readByThem={readByThem} actions={actions} canRetry={canRetry} />}
    </div>
  );
});
