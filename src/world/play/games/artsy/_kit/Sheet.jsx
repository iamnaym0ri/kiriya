import { useEffect, useId, useRef } from "react";

/** A bottom sheet inside the game (not the whole app): a soft backdrop, a title and a close button. */
export function Sheet({ open, title, onClose, children, className = "" }) {
  const id = useId();
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const key = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="artsy-sheet" role="presentation">
      <button type="button" className="artsy-sheet__backdrop" aria-label="close" tabIndex={-1} onClick={onClose} />
      <section ref={panel} className={`artsy-sheet__panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="artsy-sheet__head">
          <span className="artsy-sheet__grip" aria-hidden="true" />
          <h2 id={id}>{title}</h2>
          <button type="button" className="artsy-chip" onClick={onClose}>done</button>
        </header>
        <div className="artsy-sheet__body">{children}</div>
      </section>
    </div>
  );
}

export function Toast({ text }) {
  return (
    <p className="artsy-toast" role="status" aria-live="polite" data-show={Boolean(text)}>
      {text}
    </p>
  );
}
