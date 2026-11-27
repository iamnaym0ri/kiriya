import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@use-gesture/react";
import { useIsAdmin } from "../../../lib/session.js";
import { haptic } from "../../../lib/native.js";
import { usePrefs, useSetPin } from "../../../lib/prefs.js";
import { downloadBlob } from "../../studio/drawingTools.js";
import { KINDS, artKind, artTitle } from "./kinds.js";
import { KindIcon, savedOn } from "./GalleryParts.jsx";
import { isHeart, reactionGlyph, useRemoveArtwork, useSignature } from "./useArtworks.js";

// One piece of her gallery, opened big: swipe sideways for the next one, down (or "done") to close.
// Below it: when she made it, Josh's heart and his little notes, then share, pin and delete.

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Viewer({ art, index, count, onPrev, onNext, onClose, onRemoved, fresh, adminControls }) {
  const admin = useIsAdmin();
  const signature = useSignature();
  const remove = useRemoveArtwork();
  const prefs = usePrefs();
  const setPin = useSetPin();
  const pinned = (prefs.data?.pins ?? []).some((pin) => pin.id === art.id);
  const [asking, setAsking] = useState(false);
  const [shareError, setShareError] = useState("");
  const panel = useRef(null);
  const picture = useRef(null);
  const kind = KINDS.find((each) => each.id === artKind(art)) ?? KINDS[0];

  // While it's open the page underneath stays put, and Escape closes it (keyboards, the Simulator).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("gallery-viewer-open");
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onNext?.();
      if (event.key === "ArrowLeft") onPrev?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("gallery-viewer-open");
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAsking(false);
    setShareError("");
    remove.reset();
    setPin.reset();
  }, [art.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe: sideways steps through her things, down closes. The picture follows her finger.
  const bind = useDrag(
    ({ last, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], axis, cancel, tap }) => {
      const el = picture.current;
      if (!el || tap) return;
      if (!last) {
        const x = axis === "x" ? mx : 0;
        const y = axis === "y" ? Math.max(0, my) : 0;
        el.style.transition = "none";
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 - Math.min(y, 300) / 1500})`;
        el.style.opacity = String(1 - Math.min(y, 300) / 600);
        return;
      }
      el.style.transition = reduced() ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s";
      el.style.transform = "";
      el.style.opacity = "";
      if (axis === "x" && (Math.abs(mx) > 70 || (vx > 0.5 && Math.abs(mx) > 24))) {
        haptic("light");
        (mx < 0 || dx < 0 ? onNext : onPrev)?.();
      } else if (axis === "y" && (my > 110 || (vy > 0.6 && dy > 0 && my > 30))) {
        onClose();
      }
      cancel?.();
    },
    { axis: "lock", filterTaps: true, threshold: 10 },
  );

  async function share() {
    setShareError("");
    try {
      const response = await fetch(art.url);
      if (!response.ok) throw new Error("This picture couldn’t be fetched. Try again?");
      const blob = await response.blob();
      const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `kiriya-${kind.id}-${art.id.slice(0, 8)}.${ext}`, { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: artTitle(art) });
      else downloadBlob(blob, file.name);
    } catch (error) {
      if (error?.name !== "AbortError") setShareError(error.message || "That didn’t work. Try again?");
    }
  }

  const notes = art.notes ?? [];
  return createPortal(
    <div ref={panel} className="gallery-viewer" role="dialog" aria-modal="true" aria-label={artTitle(art)} tabIndex={-1}>
      <header className="gallery-viewer__bar">
        <button type="button" className="gallery-viewer__done" onClick={onClose}>
          done
        </button>
        <span className="gallery-viewer__count" aria-live="polite">
          {count > 1 ? `${index + 1} of ${count}` : ""}
        </span>
        <button type="button" className="gallery-viewer__icon" aria-label="share or save this picture" onClick={share}>
          <ShareIcon />
        </button>
      </header>

      <div className="gallery-viewer__scroll">
        <div className="gallery-viewer__stage" {...bind()}>
          <figure ref={picture} className="gallery-viewer__picture" key={art.id} data-kind={kind.id}>
            <img src={art.url} alt={artTitle(art)} draggable={false} />
          </figure>
          {onPrev && (
            <button type="button" className="gallery-viewer__step" data-side="left" onClick={onPrev} aria-label="newer">
              <Chevron />
            </button>
          )}
          {onNext && (
            <button type="button" className="gallery-viewer__step" data-side="right" onClick={onNext} aria-label="older">
              <Chevron flip />
            </button>
          )}
        </div>

        <div className="gallery-viewer__card">
          <h2 className="gallery-viewer__title">{artTitle(art)}</h2>
          <p className="gallery-viewer__meta">
            <KindIcon kind={kind.id} size={15} />
            {kind.one}
            {savedOn(art.createdAt) && <> · {savedOn(art.createdAt)}</>}
            {pinned && <> · 📌 on your profile</>}
          </p>

          {art.reaction && (
            <p className="gallery-viewer__reaction">
              <span className="gallery-viewer__glyph" data-heart={isHeart(art.reaction) || undefined} aria-hidden="true">
                {reactionGlyph(art.reaction)}
              </span>
              {isHeart(art.reaction) ? `${signature} hearted this` : `${signature} reacted ${art.reaction}`}
            </p>
          )}
          {notes.length > 0 && (
            <ul className="gallery-viewer__notes" aria-label={`little notes from ${signature}`}>
              {notes.map((note) => (
                <li key={note.id} className="gallery-note">
                  <p>{note.body}</p>
                  <small>
                    — {signature}
                    {!admin && (!note.seenAt || fresh.has(note.id)) && <span className="gallery-note__new">new</span>}
                    {admin && <span className="gallery-note__seen">{note.seenAt ? "she’s seen it ♡" : "not seen yet"}</span>}
                  </small>
                </li>
              ))}
            </ul>
          )}
          {admin && <div className="gallery-viewer__admin">{adminControls}</div>}

          {!admin && (
            <div className="gallery-viewer__actions">
              <button type="button" className="gallery-viewer__action" aria-pressed={pinned} disabled={setPin.isPending || !prefs.data} onClick={() => setPin.mutate({ id: art.id, pinned: !pinned })}>
                <PinIcon />
                {setPin.isPending ? "pinning…" : pinned ? "unpin from profile" : "pin to profile"}
              </button>
              <button
                type="button"
                className="gallery-viewer__action gallery-viewer__action--danger"
                data-asking={asking || undefined}
                disabled={remove.isPending}
                onClick={() => (asking ? remove.mutate(art.id, { onSuccess: onRemoved }) : setAsking(true))}
              >
                <BinIcon />
                {remove.isPending ? "removing…" : asking ? "sure? delete it" : "delete"}
              </button>
            </div>
          )}
          {(remove.error || setPin.error || shareError) && (
            <p className="gallery-viewer__error" role="alert">
              {remove.error?.message || setPin.error?.message || shareError}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const Chevron = ({ flip }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5v11M8 7.2l4-3.7 4 3.7M7.5 10.5H6.4c-1 0-1.9.9-1.9 1.9v6.2c0 1 .9 1.9 1.9 1.9h11.2c1 0 1.9-.9 1.9-1.9v-6.2c0-1-.9-1.9-1.9-1.9h-1.1" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5Zm3 8.5v8.5" />
  </svg>
);
const BinIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 7h15M9.5 7V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.4.8.8V7M6.5 7l.9 12.2c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7" />
  </svg>
);
