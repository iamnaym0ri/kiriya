import { createElement as h } from "react";
import { StickerSvg, stickerLine } from "../_kit/stickers.jsx";

// A new sticker for her collection (docs/refactor/RENOVATION.md, "Games"): the coordinator adds it
// to the catalogue in server/content/birthday.js and StickerArt.
function CraneSticker({ size = 64 }) {
  return h(
    StickerSvg,
    { size },
    h("path", { d: "M6 30L24 42 21 46z", fill: "#e3d4fb", ...stickerLine, strokeWidth: 2.2 }),
    h("path", { d: "M26 34L20 6 44 34z", fill: "#d9c6fb", ...stickerLine, strokeWidth: 2.2 }),
    h("path", { d: "M14 41L36 31 52 41 36 50z", fill: "#f2eaff", ...stickerLine }),
    h("path", { d: "M45 38L60 16 56 37z", fill: "#f7f1ff", ...stickerLine, strokeWidth: 2.2 }),
    h("path", { d: "M60 16l3 3-5 1z", fill: "#f9a3c6", ...stickerLine, strokeWidth: 1.6 }),
    h("path", { d: "M30 34L33 9 48 34z", fill: "#cfb4ff", ...stickerLine }),
    h("path", { d: "M35 30l-1-14", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round" }),
    h("path", { d: "M10 16c-3-3-3-6-1-7s3 1 3 2c0-1 1-3 3-2s1 4-5 7z", fill: "#f96cab", ...stickerLine, strokeWidth: 1.4 }),
  );
}

export default [{ id: "st-crane", art: CraneSticker, name: "Paper crane", line: "Folded with a wish inside." }];
