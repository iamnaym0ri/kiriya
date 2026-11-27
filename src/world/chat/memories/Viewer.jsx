import { useEffect, useRef, useState } from "react";
import { useMediaUrl } from "../../../lib/chatCrypto.js";

/** One picture in the viewer: a photo, a GIF, a sticker, or a video that plays right there. */
function Slide({ item, active }) {
  const src = useMediaUrl(item);
  const poster = useMediaUrl(item.poster ?? null);
  const video = useRef(null);
  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  if (!src) return <span className="mem-viewer__opening" aria-label="opening…" />;
  if (item.type === "video")
    return <video ref={video} className="mem-viewer__media" src={src} poster={poster ?? undefined} controls playsInline preload="metadata" />;
  if (item.type === "gif" && item.mp4) return <GifVideo item={item} />;
  return <img className="mem-viewer__media" src={src} alt={item.alt ?? (item.type === "sticker" ? "a sticker" : "a photo")} draggable={false} />;
}

function GifVideo({ item }) {
  const src = useMediaUrl({ url: item.mp4 });
  return <video className="mem-viewer__media" src={src ?? undefined} autoPlay loop muted playsInline aria-label={item.alt ?? "a GIF"} />;
}

/**
 * Full screen, for the pictures of one saved memory (an album can hold up to ten): swipe or use
 * the arrows to move between them, swipe down or ✕ to close, and remove the memory from here.
 */
export function Viewer({ memory, items, start = 0, caption, meta, onClose, onRemove }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(start);
  const [asking, setAsking] = useState(false);
  const touch = useRef(null);
  const count = items.length;
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);
  const go = (step) => setIndex((i) => Math.min(count - 1, Math.max(0, i + step)));
  return (
    <dialog
      ref={ref}
      className="mem-viewer"
      tabIndex={-1}
      aria-label={`${meta}${count > 1 ? `, picture ${index + 1} of ${count}` : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="mem-viewer__stage"
        onTouchStart={(event) => (touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY })}
        onTouchEnd={(event) => {
          if (!touch.current) return;
          const dx = event.changedTouches[0].clientX - touch.current.x;
          const dy = event.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        }}
      >
        <div className="mem-viewer__track" style={{ transform: `translateX(${-index * 100}%)` }}>
          {items.map((item, i) => (
            <div key={`${memory.id}-${i}`} className="mem-viewer__slide" aria-hidden={i !== index}>
              {Math.abs(i - index) <= 1 && <Slide item={item} active={i === index} />}
            </div>
          ))}
        </div>
        {count > 1 && index > 0 && (
          <button type="button" className="mem-viewer__nav" data-side="left" onClick={() => go(-1)} aria-label="Previous picture">
            ‹
          </button>
        )}
        {count > 1 && index < count - 1 && (
          <button type="button" className="mem-viewer__nav" data-side="right" onClick={() => go(1)} aria-label="Next picture">
            ›
          </button>
        )}
      </div>
      <div className="mem-viewer__top">
        <span className="mem-viewer__count">{count > 1 ? `${index + 1} / ${count}` : ""}</span>
        <button type="button" className="mem-viewer__close" onClick={onClose} aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="mem-viewer__bottom">
        {caption && <p className="mem-viewer__caption">{caption}</p>}
        <div className="mem-viewer__row">
          <span>{meta}</span>
          {asking ? (
            <span className="mem-confirm">
              <button type="button" data-danger onClick={onRemove}>
                take it out
              </button>
              <button type="button" onClick={() => setAsking(false)}>
                keep
              </button>
            </span>
          ) : (
            <button type="button" className="mem-viewer__remove" onClick={() => setAsking(true)}>
              remove
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
