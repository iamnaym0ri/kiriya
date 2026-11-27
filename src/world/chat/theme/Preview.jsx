import { useRef } from "react";
import { useChatLook } from "./useChatLook.js";

/**
 * A little live copy of the chat in the design sheet, drawn with the same classes (.msg, .bubble,
 * .chat__backdrop) so every theme, bubble design and background shows exactly as it will. With her
 * photo as the background, dragging the preview moves the photo.
 */
export function LivePreview({ prefs, name, onMovePhoto }) {
  const look = useChatLook(prefs);
  const start = useRef(null);
  const movable = look["data-background"] === "photo" && onMovePhoto;
  const photo = prefs.photo ?? { x: 50, y: 50 };
  const handlers = movable
    ? {
        onPointerDown: (event) => {
          start.current = { x: event.clientX, y: event.clientY, from: { x: photo.x ?? 50, y: photo.y ?? 50 }, w: event.currentTarget.clientWidth, h: event.currentTarget.clientHeight };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerMove: (event) => {
          if (!start.current) return;
          const { x, y, from, w, h } = start.current;
          // Dragging the picture right shows more of its left side, like moving a photo in a frame.
          const nx = Math.round(Math.min(100, Math.max(0, from.x - ((event.clientX - x) / w) * 100)));
          const ny = Math.round(Math.min(100, Math.max(0, from.y - ((event.clientY - y) / h) * 100)));
          onMovePhoto({ x: nx, y: ny }, { soon: true });
        },
        onPointerUp: () => {
          start.current = null;
        },
        onPointerCancel: () => {
          start.current = null;
        },
      }
    : {};
  return (
    <div className="chat-preview chat-preview--live" {...look} data-movable={movable || undefined} {...handlers} aria-label="How your chat will look" role="img">
      <span className="chat__backdrop" aria-hidden="true" />
      <span className="chat-preview__bar" aria-hidden="true">
        <span className="chat-preview__avatar">{(name ?? "").slice(0, 1).toUpperCase()}</span>
        <span className="chat-preview__name">{name}</span>
      </span>
      <span className="chat-preview__list" aria-hidden="true">
        <span className="chat__day">
          <span>today</span>
        </span>
        <span className="msg" data-first data-last>
          <span className="bubble">good morning ♡ did you sleep ok?</span>
        </span>
        <span className="msg" data-mine data-first>
          <span className="bubble">i dreamed about you</span>
        </span>
        <span className="msg" data-mine data-last>
          <span className="bubble">come over later? 🍓</span>
          <span className="msg__status">seen ♡</span>
        </span>
      </span>
      <span className="chat-preview__composer" aria-hidden="true">
        <span>message…</span>
      </span>
      {movable && <span className="chat-preview__hint">drag to move your photo</span>}
    </div>
  );
}

/** A small swatch: two bubbles in a theme and design, for the pickers. */
export function MiniBubbles({ theme, bubble, background = "plain", words = ["hi ♡", "hiii"] }) {
  return (
    <span className="chat-preview chat-preview--mini" data-theme={theme} data-bubble={bubble} data-background={background} aria-hidden="true">
      <span className="chat__backdrop" />
      <span className="msg" data-first data-last>
        <span className="bubble">{words[0]}</span>
      </span>
      <span className="msg" data-mine data-first data-last>
        <span className="bubble">{words[1]}</span>
      </span>
    </span>
  );
}

/** A background's thumbnail in the current theme. */
export function BackdropThumb({ prefs, background }) {
  const look = useChatLook({ ...prefs, background });
  return (
    <span className="chat-preview chat-preview--thumb" {...look} aria-hidden="true">
      <span className="chat__backdrop" />
      <span className="msg" data-first data-last>
        <span className="bubble">♡</span>
      </span>
    </span>
  );
}
