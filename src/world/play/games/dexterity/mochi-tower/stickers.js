import { createElement as h } from "react";
import { StickerSvg, stickerLine } from "../_kit/stickers.jsx";

// A new sticker for her collection (docs/refactor/RENOVATION.md, "Games"): the coordinator adds it
// to the catalogue in server/content/birthday.js and StickerArt.
function MochiSticker({ size = 64 }) {
  const mochi = (y, fill, w) =>
    h("path", { key: y, d: `M${32 - w} ${y + 12}c-4-1-5-5-4-9 2-6 10-10 ${w + 4}-10s${w + 2} 4 ${w + 4} 10c1 4 0 8-4 9-7 2-14 2-${w}2s-${w - 6} 0-${w}-2z`, fill, ...stickerLine, strokeWidth: 2.2 });
  return h(
    StickerSvg,
    { size },
    h("ellipse", { cx: 32, cy: 56, rx: 26, ry: 5, fill: "#fbf6ff", ...stickerLine, strokeWidth: 2 }),
    mochi(38, "#d4eabf", 20),
    mochi(24, "#ffd3e2", 17),
    mochi(10, "#e4d4f8", 14),
    h("path", { d: "M27.5 17q2-3 4 0M34.5 17q2-3 4 0", fill: "none", stroke: "#2b1b35", strokeWidth: 1.8, strokeLinecap: "round" }),
    h("ellipse", { cx: 24.5, cy: 19.5, rx: 2.6, ry: 1.5, fill: "#ffa4c9" }),
    h("ellipse", { cx: 41.5, cy: 19.5, rx: 2.6, ry: 1.5, fill: "#ffa4c9" }),
    h("path", { d: "M50 8l1.2 3.4 3.4 1.2-3.4 1.2L50 17.2l-1.2-3.4-3.4-1.2 3.4-1.2z", fill: "#ffd166", stroke: "#2b1b35", strokeWidth: 1 }),
  );
}

export default [{ id: "st-mochi", art: MochiSticker, name: "Mochi stack", line: "Soft, sweet, and somehow still standing." }];
