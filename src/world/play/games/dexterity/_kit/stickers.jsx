import StickerArt from "../../../../../shared/stickers/StickerArt.jsx";

/**
 * Gives each reward a picture for the end-of-round card. `own` is the game's `stickers.js` (new
 * designs the coordinator adds to the catalogue); anything else is drawn by the collection's
 * StickerArt, whose art names are the `st-*` ids without the prefix.
 */
export function withArt(rewards, own = []) {
  return rewards.map((reward) => {
    const mine = own.find((sticker) => sticker.id === reward.sticker);
    const Art = mine ? mine.art : ({ size }) => <StickerArt art={reward.sticker.replace(/^st-/, "")} size={size} />;
    return { ...reward, Art };
  });
}

/** The die-cut sticker frame the collection's art uses, for new designs. */
export function StickerSvg({ size = 64, children, label }) {
  return (
    <svg className="sticker-art" width={size} height={size} viewBox="0 0 64 64" aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label}>
      {children}
    </svg>
  );
}

export const stickerLine = { stroke: "#2b1b35", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" };
