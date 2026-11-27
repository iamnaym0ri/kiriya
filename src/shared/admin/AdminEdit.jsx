import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsAdmin } from "../../lib/session.js";
import "./AdminEdit.css";

// Josh edits what she sees in place (docs/refactor/RENOVATION.md, "Admin in place"). These two
// pieces are shared by every section so his controls look and behave the same everywhere.
// Owner: the me agent (it may restyle them; keep the props).

/** A small pencil beside anything Josh can change. Renders nothing on her phone. */
export function AdminEdit({ label, onClick, className = "" }) {
  const admin = useIsAdmin();
  if (!admin) return null;
  return (
    <button type="button" className={`admin-edit ${className}`} onClick={onClick} aria-label={`Edit ${label}`}>
      <span aria-hidden="true">✎</span>
      <span className="admin-edit__label">{label}</span>
    </button>
  );
}

/**
 * A bottom sheet for an edit. `onSave` may return a promise; the sheet shows "Saving…" until it
 * settles and stays open (with the error) if it fails.
 */
export function EditSheet({ open, title, children, onClose, onSave, saveLabel = "Save", saving = false, error = null }) {
  const titleId = useId();
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panel.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("edit-sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("edit-sheet-open");
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="edit-sheet" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div ref={panel} className="edit-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="edit-sheet__grabber" aria-hidden="true" />
        <header className="edit-sheet__head">
          <button type="button" className="edit-sheet__cancel" onClick={onClose}>Cancel</button>
          <h2 id={titleId}>{title}</h2>
          {onSave ? (
            <button type="button" className="edit-sheet__save" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : saveLabel}
            </button>
          ) : <span />}
        </header>
        <div className="edit-sheet__body">{children}</div>
        {error && <p className="edit-sheet__error" role="alert">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
