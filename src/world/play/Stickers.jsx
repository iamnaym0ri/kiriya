import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import { EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { haptic } from "../../lib/native.js";
import { GAME_STICKERS } from "./games/registry.js";
import "./Stickers.css";

// Her sticker collection in the play hub: the picture for any sticker (the drawer's own, or one a
// game brought along), the little moment when a game gives one, and the sticker book.

/** One sticker's picture, whichever way its art was drawn. */
export function StickerPicture({ id, art, size = 64, className = "" }) {
  const extra = GAME_STICKERS.get(id);
  const drawing = extra?.art ?? art;
  if (typeof drawing === "function") {
    const Drawing = drawing;
    return (
      <span className={`sticker-picture ${className}`} style={{ width: size, height: size }} aria-hidden="true">
        <Drawing size={size} />
      </span>
    );
  }
  if (typeof drawing === "string" && drawing.trim().startsWith("<")) {
    return (
      <svg className={`sticker-art ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawing }} />
    );
  }
  if (typeof drawing === "string" && /^(\/|https:)/.test(drawing)) {
    return <img className={`sticker-art ${className}`} src={drawing} width={size} height={size} alt="" />;
  }
  if (extra?.render && drawing) {
    const Render = extra.render;
    return <Render art={drawing} size={size} className={className} />;
  }
  return <StickerArt art={drawing ?? "star"} size={size} className={className} />;
}

const details = (sticker) => {
  const extra = GAME_STICKERS.get(sticker.id);
  return { ...sticker, name: sticker.name ?? extra?.name ?? "a little sticker", line: sticker.line ?? extra?.line ?? "" };
};

/**
 * "a new sticker ♡": drops in over the game for a few seconds when a reward lands. `preview`
 * (Josh's sign-in) says what she would get instead.
 */
export function StickerMoment({ moment, onDone }) {
  useEffect(() => {
    if (!moment) return undefined;
    haptic("success");
    const timer = setTimeout(onDone, 3800);
    return () => clearTimeout(timer);
  }, [moment, onDone]);
  if (!moment) return null;
  const sticker = details(moment.sticker);
  return createPortal(
    <button type="button" className="sticker-moment" key={moment.key} onClick={onDone} aria-live="polite">
      <span className="sticker-moment__art">
        <StickerPicture id={sticker.id} art={sticker.art} size={56} />
      </span>
      <span className="sticker-moment__text">
        <small>{moment.preview ? "she’d get a sticker ♡" : "a new sticker for you ♡"}</small>
        <strong>{sticker.name}</strong>
        {sticker.line && <span>{sticker.line}</span>}
      </span>
    </button>,
    document.body,
  );
}

/** The sticker book: everything she's collected (the drawer's and the games'), and what's still hiding. */
export function StickerBook({ open, onClose, state, admin }) {
  const [picked, setPicked] = useState(null);
  const collected = (state?.collected ?? []).map(details);
  const have = new Set(collected.map((sticker) => sticker.id));
  const missing = (state?.catalogue ?? []).filter((sticker) => !have.has(sticker.id)).map(details);
  const total = collected.length + missing.length;
  return (
    <EditSheet
      open={open}
      onClose={() => {
        setPicked(null);
        onClose();
      }}
      title={admin ? "her stickers" : "your stickers"}
      subtitle={total ? `${collected.length} of ${total} collected` : undefined}
    >
      {!state ? (
        <p className="sticker-book__empty" role="status">opening the sticker book…</p>
      ) : collected.length === 0 && missing.length === 0 ? (
        <p className="sticker-book__empty">no stickers yet. games and the little drawer give them out ♡</p>
      ) : (
        <ul className="sticker-book" aria-label="Stickers">
          {collected.map((sticker) => (
            <li key={sticker.id}>
              <button type="button" className="sticker-book__item" aria-expanded={picked === sticker.id} onClick={() => setPicked(picked === sticker.id ? null : sticker.id)}>
                <StickerPicture id={sticker.id} art={sticker.art} size={60} />
                <strong>{sticker.name}</strong>
                {sticker.count > 1 && <span className="sticker-book__count">×{sticker.count}</span>}
                {picked === sticker.id && sticker.line && <small>{sticker.line}</small>}
              </button>
            </li>
          ))}
          {missing.map((sticker) => (
            <li key={sticker.id}>
              <span className="sticker-book__item sticker-book__item--missing">
                <span className="sticker-book__ghost">
                  <StickerPicture id={sticker.id} art={sticker.art} size={60} />
                </span>
                <strong>still hiding</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </EditSheet>
  );
}
