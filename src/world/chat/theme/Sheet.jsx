import { useCallback, useEffect, useId, useRef, useState } from "react";

const CLOSE_MS = 220;

/**
 * A bottom sheet (a real <dialog>, so focus and VoiceOver stay inside it): slides up, closes with
 * the ✕, a tap outside, Escape, or a swipe down from its top. Used by the chat's design sheet.
 */
export default function Sheet({ title, onClose, children, className = "", header = null }) {
  const ref = useRef(null);
  const panel = useRef(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const drag = useRef(null);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onClose, reduced ? 0 : CLOSE_MS);
  }, [closing, onClose]);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  // Swipe down from the grabber or the title row to close.
  const onPointerDown = (event) => {
    if (event.button > 0 || event.target.closest("button")) return;
    drag.current = { y: event.clientY, t: performance.now(), dy: 0 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    const dy = Math.max(0, event.clientY - drag.current.y);
    drag.current.dy = dy;
    if (panel.current) panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    drag.current = null;
    const fast = dy / Math.max(1, performance.now() - t) > 0.6;
    if (dy > 110 || (fast && dy > 30)) close();
    else if (panel.current) {
      panel.current.style.transition = "transform 0.2s ease";
      panel.current.style.transform = "";
      setTimeout(() => panel.current && (panel.current.style.transition = ""), 220);
    }
  };

  return (
    <dialog
      ref={ref}
      className={`chat-sheet ${className}`}
      data-closing={closing || undefined}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div ref={panel} className="chat-sheet__panel">
        <div className="chat-sheet__grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="chat-sheet__grabber" aria-hidden="true" />
          <div className="chat-sheet__head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="chat-sheet__close" onClick={close} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        {header}
        <div className="chat-sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
