import { createElement as h } from "react";
import { StickerSvg, stickerLine } from "../_kit/stickers.jsx";

// A new sticker for her collection (docs/refactor/RENOVATION.md, "Games"): the coordinator adds it
// to the catalogue in server/content/birthday.js and StickerArt.
function PetalSticker({ size = 64 }) {
  const petal = (angle) =>
    h("path", { key: angle, transform: `rotate(${angle} 32 32)`, d: "M32 29C22 22 21 9 32 6c11 3 10 16 0 23Z", fill: "#cfb4ff", ...stickerLine });
  return h(
    StickerSvg,
    { size },
    h("path", { d: "M20 58c4-8 6-13 12-26", fill: "none", stroke: "#6fae7c", strokeWidth: 3.5, strokeLinecap: "round" }),
    h("path", { d: "M22 50c-7 0-11-4-11-9 7 0 11 4 11 9Z", fill: "#9fd08f", ...stickerLine, strokeWidth: 2 }),
    [0, 90, 180, 270].map(petal),
    h("path", { d: "M27 12q5-3 9 0M51 27q3 5 0 9", fill: "none", stroke: "#fff", strokeWidth: 2.6, strokeLinecap: "round" }),
    h("circle", { cx: 32, cy: 32, r: 5, fill: "#ffe08a", ...stickerLine, strokeWidth: 2 }),
  );
}

export default [{ id: "st-petal", art: PetalSticker, name: "Lilac petal", line: "Caught before it touched the ground." }];
