import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsAdmin } from "../../lib/session.js";
import "./AdminEdit.css";

// Josh edits what she sees in place (docs/refactor/RENOVATION.md, "Admin in place"). These pieces
// are shared by every section so his controls look and behave the same everywhere.
// Owner: the me agent. Keep the props; new ones are optional.

/** The little hand-drawn pencil every edit control uses. */
export function PencilIcon({ size = 16 }) {
  return (
    <svg className="admin-pencil" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M13.6 3.3c.8-.8 2-.7 2.8.1.8.8.8 2 .1 2.8L7.4 15.3l-3.7 1 1-3.7z" />
      <path d="M12.2 4.8l3 3M4.7 12.6l2.7 2.7" />
    </svg>
  );
}

/**
 * A small pencil beside anything Josh can change. Renders nothing on her phone.
 * `compact` shows the pencil alone (the label still names it for VoiceOver); the tap target is
 * 44 pt either way.
 */
export function AdminEdit({ label, onClick, className = "", compact = false }) {
  const admin = useIsAdmin();
  if (!admin) return null;
  return (
    <button
      type="button"
      className={`admin-edit${compact ? " admin-edit--compact" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-label={`Edit ${label}`}
    >
      <PencilIcon />
      {!compact && <span className="admin-edit__label">{label}</span>}
    </button>
  );
}

/**
 * A labelled field for an EditSheet, so every sheet's form looks the same. Pass one input,
 * textarea or select as the child: it gets the label, and the hint as its description.
 */
export function EditField({ label, hint, children, className = "" }) {
  const id = useId();
  const single = isValidElement(children) && typeof children.type === "string";
  if (!single)
    return (
      <label className={`edit-field ${className}`.trim()}>
        <span className="edit-field__label">{label}</span>
        {children}
        {hint && <small className="edit-field__hint">{hint}</small>}
      </label>
    );
  const fieldId = children.props.id ?? `${id}-field`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`edit-field ${className}`.trim()}>
      <label className="edit-field__label" htmlFor={fieldId}>
        {label}
      </label>
      {cloneElement(children, { id: fieldId, "aria-describedby": [children.props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined })}
      {hint && (
        <small className="edit-field__hint" id={hintId}>
          {hint}
        </small>
      )}
    </div>
  );
}

const EXIT_MS = 240;
let openSheets = 0; // the page stays still while any sheet is up
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pins the sheet to what's actually visible: in Safari the keyboard covers the page without
 * resizing it, so the sheet rides up on top of the keyboard (the app's web view resizes by itself,
 * and this measures nothing there).
 */
function useVisibleViewport(ref, active) {
  useLayoutEffect(() => {
    const node = ref.current;
    const vv = window.visualViewport;
    if (!active || !node || !vv) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        node.style.setProperty("--sheet-top", `${Math.round(vv.offsetTop)}px`);
        node.style.setProperty("--sheet-height", `${Math.round(vv.height)}px`);
        node.classList.toggle("edit-sheet--keyboard", covered > 80);
        // Keep the field being typed in above the keyboard once it has settled.
        const focused = document.activeElement;
        if (covered > 80 && focused && node.contains(focused) && focused.matches("input, textarea, select, [contenteditable]"))
          focused.scrollIntoView({ block: "nearest" });
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [ref, active]);
}

/**
 * Drag the sheet down to dismiss it, like any iPhone sheet: from the grabber and title bar always,
 * and from the content once it's scrolled to the top. Touch drives it on the phone (so a scroll
 * that starts at the top can turn into a dismiss), the mouse on a computer.
 */
function useDragToDismiss({ sheet, panel, body, enabled, onDismiss }) {
  useEffect(() => {
    const panelNode = panel.current;
    const sheetNode = sheet.current;
    if (!enabled || !panelNode || !sheetNode) return undefined;
    let drag = null;

    const fromHandle = (target) => Boolean(target.closest?.(".edit-sheet__grab-zone"));
    const typing = (target) => Boolean(target.closest?.("input, textarea, select, [contenteditable='true'], [data-sheet-no-drag]"));

    function begin(y, target) {
      if (!fromHandle(target) && (typing(target) || !body.current?.contains(target))) return;
      drag = { y0: y, last: y, lastT: performance.now(), velocity: 0, dy: 0, moving: false, handle: fromHandle(target) };
    }
    function move(y, event) {
      if (!drag) return;
      const dy = y - drag.y0;
      if (!drag.moving) {
        // Content that can still scroll up keeps the gesture; so does an upward swipe.
        if (!drag.handle && (body.current.scrollTop > 0 || dy <= 0)) {
          if (Math.abs(dy) > 8) drag = null;
          return;
        }
        if (Math.abs(dy) < 6) return;
        drag.moving = true;
        drag.y0 = y;
        panelNode.classList.add("is-dragging");
      }
      event?.cancelable && event.preventDefault();
      const now = performance.now();
      const raw = y - drag.y0;
      // Pulling up past the top stretches a little and no further.
      drag.dy = raw < 0 ? -Math.min(24, Math.sqrt(-raw) * 2.4) : raw;
      drag.velocity = (y - drag.last) / Math.max(1, now - drag.lastT);
      drag.last = y;
      drag.lastT = now;
      panelNode.style.transform = `translate3d(0, ${drag.dy}px, 0)`;
      const height = panelNode.offsetHeight || 1;
      sheetNode.style.setProperty("--sheet-shade", String(Math.max(0, 1 - drag.dy / height)));
    }
    function end() {
      if (!drag) return;
      const { moving, dy } = drag;
      // A finger that stopped before lifting isn't flinging.
      const velocity = performance.now() - drag.lastT > 90 ? 0 : drag.velocity;
      drag = null;
      if (!moving) return;
      panelNode.classList.remove("is-dragging");
      const height = panelNode.offsetHeight || 1;
      if (dy > Math.min(160, height * 0.3) || (velocity > 0.55 && dy > 24)) {
        onDismiss();
      } else {
        panelNode.style.transform = "";
        sheetNode.style.removeProperty("--sheet-shade");
      }
    }

    const onTouchStart = (event) => event.touches.length === 1 && begin(event.touches[0].clientY, event.target);
    const onTouchMove = (event) => drag && move(event.touches[0].clientY, event);
    const onTouchEnd = () => end();
    const onPointerDown = (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !fromHandle(event.target)) return;
      begin(event.clientY, event.target);
      const onMove = (e) => move(e.clientY, e);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        end();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
    panelNode.addEventListener("touchstart", onTouchStart, { passive: true });
    panelNode.addEventListener("touchmove", onTouchMove, { passive: false });
    panelNode.addEventListener("touchend", onTouchEnd);
    panelNode.addEventListener("touchcancel", onTouchEnd);
    panelNode.addEventListener("pointerdown", onPointerDown);
    return () => {
      panelNode.removeEventListener("touchstart", onTouchStart);
      panelNode.removeEventListener("touchmove", onTouchMove);
      panelNode.removeEventListener("touchend", onTouchEnd);
      panelNode.removeEventListener("touchcancel", onTouchEnd);
      panelNode.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sheet, panel, body, enabled, onDismiss]);
}

/**
 * A bottom sheet for an edit (or any short form).
 *
 * - `open`, `onClose`: controlled by the caller. Cancel, Escape, a tap on the dimmed page and a
 *   swipe down all call `onClose`; the sheet plays its own exit.
 * - `onSave`: shows the Save button. It may return a promise: the sheet shows "Saving…" until it
 *   settles, closes itself when it resolves (resolve to `false` to stay open), and stays open with
 *   the error's message if it rejects. Or drive it yourself with `saving` and `error`.
 * - `error`: a string or an Error, shown at the bottom of the sheet.
 * - Optional: `saveDisabled`, `dirty` (a swipe or tap outside then asks before throwing the
 *   changes away), `onDelete` + `deleteLabel` (a red action at the end of the sheet; it asks once
 *   before calling), `subtitle`.
 */
export function EditSheet({
  open,
  title,
  subtitle,
  children,
  onClose,
  onSave,
  saveLabel = "Save",
  saving = false,
  error = null,
  saveDisabled = false,
  dirty = false,
  onDelete,
  deleteLabel = "Delete",
}) {
  const titleId = useId();
  const sheet = useRef(null);
  const panel = useRef(null);
  const body = useRef(null);
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [ownError, setOwnError] = useState(null);
  const [asking, setAsking] = useState(null); // "discard" | "delete" | null
  const dismissed = useRef(false);

  // Mount on open; on close, play the exit before unmounting.
  useEffect(() => {
    if (open) {
      dismissed.current = false;
      setMounted(true);
      setLeaving(false);
      setOwnError(null);
      setAsking(null);
      return undefined;
    }
    if (!mounted) return undefined;
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, dismissed.current || reducedMotion() ? 120 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => onClose?.(), [onClose]);
  const busy = saving || pending;

  // A swipe or a tap outside: if there are unsaved changes, ask first.
  const requestClose = useCallback(() => {
    if (busy) return false;
    if (dirty) {
      setAsking("discard");
      return false;
    }
    close();
    return true;
  }, [busy, dirty, close]);

  const dragDismiss = useCallback(() => {
    if (busy || dirty) {
      panel.current.style.transform = "";
      sheet.current?.style.removeProperty("--sheet-shade");
      if (dirty && !busy) setAsking("discard");
      return;
    }
    dismissed.current = true;
    panel.current.classList.add("is-flung");
    panel.current.style.transform = "translate3d(0, 105%, 0)";
    sheet.current?.style.setProperty("--sheet-shade", "0");
    close();
  }, [busy, dirty, close]);

  useVisibleViewport(sheet, mounted);
  useDragToDismiss({ sheet, panel, body, enabled: mounted && !leaving, onDismiss: dragDismiss });

  // The latest handlers, for listeners that live as long as the sheet.
  const latest = useRef({});
  latest.current = { asking, requestClose };

  // Focus, Escape, Tab kept inside, and the page underneath held still.
  useEffect(() => {
    if (!mounted || leaving) return undefined;
    const previous = document.activeElement;
    const node = panel.current;
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (latest.current.asking) setAsking(null);
        else latest.current.requestClose();
      }
      if (event.key === "Tab") {
        const items = [...node.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
          (item) => !item.disabled && item.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    openSheets += 1;
    document.documentElement.classList.add("edit-sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      openSheets -= 1;
      if (openSheets <= 0) document.documentElement.classList.remove("edit-sheet-open");
      previous?.focus?.({ preventScroll: true });
    };
  }, [mounted, leaving]);

  async function save() {
    if (!onSave || busy) return;
    setOwnError(null);
    let result;
    try {
      result = onSave();
    } catch (err) {
      setOwnError(err?.message || "That didn’t save. Try again?");
      return;
    }
    if (!result || typeof result.then !== "function") return;
    setPending(true);
    try {
      const value = await result;
      setPending(false);
      if (value !== false) close();
    } catch (err) {
      setPending(false);
      setOwnError(err?.message || "That didn’t save. Try again?");
    }
  }

  async function confirmDelete() {
    setAsking(null);
    setOwnError(null);
    setPending(true);
    try {
      const value = await onDelete();
      setPending(false);
      if (value !== false) close();
    } catch (err) {
      setPending(false);
      setOwnError(err?.message || "That didn’t work. Try again?");
    }
  }

  if (!mounted) return null;
  const message = ownError || (typeof error === "string" ? error : error?.message) || null;

  return createPortal(
    <div
      ref={sheet}
      className={`edit-sheet${leaving ? " is-leaving" : ""}${dismissed.current ? " is-dismissed" : ""}`}
      role="presentation"
      onClick={(event) => event.target === event.currentTarget && requestClose()}
    >
      <div ref={panel} className="edit-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="edit-sheet__grab-zone">
          <div className="edit-sheet__grabber" aria-hidden="true" />
          <header className="edit-sheet__head">
            <button type="button" className="edit-sheet__cancel" onClick={() => (dirty && !busy ? setAsking("discard") : close())} disabled={busy}>
              Cancel
            </button>
            <div className="edit-sheet__titles">
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {onSave ? (
              <button type="button" className="edit-sheet__save" onClick={save} disabled={busy || saveDisabled}>
                {busy ? <span className="edit-sheet__saving">Saving…</span> : saveLabel}
              </button>
            ) : (
              <button type="button" className="edit-sheet__save edit-sheet__save--done" onClick={close}>
                Done
              </button>
            )}
          </header>
        </div>
        <div ref={body} className="edit-sheet__body">
          {children}
          {onDelete && (
            <button type="button" className="edit-sheet__delete" onClick={() => setAsking("delete")} disabled={busy}>
              {deleteLabel}
            </button>
          )}
        </div>
        {message && (
          <p className="edit-sheet__error" role="alert">
            {message}
          </p>
        )}
        {asking && (
          <div className="edit-sheet__ask" role="alertdialog" aria-label={asking === "delete" ? deleteLabel : "Discard changes?"}>
            <p>{asking === "delete" ? "are you sure? this can’t be undone." : "throw away what you changed?"}</p>
            <div>
              <button type="button" className="edit-sheet__ask-keep" onClick={() => setAsking(null)} autoFocus>
                {asking === "delete" ? "keep it" : "keep editing"}
              </button>
              <button
                type="button"
                className="edit-sheet__ask-go"
                onClick={() => {
                  if (asking === "delete") confirmDelete();
                  else {
                    setAsking(null);
                    close();
                  }
                }}
              >
                {asking === "delete" ? deleteLabel.toLowerCase() : "discard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
