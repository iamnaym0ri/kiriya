import { createElement as h } from "react";
import { StickerSvg, stickerLine } from "../_kit/stickers.jsx";

// A new sticker for her collection (docs/refactor/RENOVATION.md, "Games"): the coordinator adds it
// to the catalogue in server/content/birthday.js and StickerArt.
function PawSticker({ size = 64 }) {
  return h(
    StickerSvg,
    { size },
    h("path", { d: "M32 58c-11 0-19-6-19-14 0-7 8-12 19-12s19 5 19 12c0 8-8 14-19 14Z", fill: "#fffaf4", ...stickerLine }),
    h("path", { d: "M32 54c-6 0-10-3-10-7s4-7 10-7 10 3 10 7-4 7-10 7Z", fill: "#ffa4c9" }),
    h("ellipse", { cx: 14, cy: 24, rx: 6.5, ry: 8, fill: "#fffaf4", ...stickerLine }),
    h("ellipse", { cx: 26, cy: 14, rx: 6.5, ry: 8.5, fill: "#fffaf4", ...stickerLine }),
    h("ellipse", { cx: 38, cy: 14, rx: 6.5, ry: 8.5, fill: "#fffaf4", ...stickerLine }),
    h("ellipse", { cx: 50, cy: 24, rx: 6.5, ry: 8, fill: "#fffaf4", ...stickerLine }),
    h("ellipse", { cx: 14, cy: 25, rx: 3, ry: 3.6, fill: "#ffa4c9" }),
    h("ellipse", { cx: 26, cy: 15, rx: 3, ry: 3.8, fill: "#ffa4c9" }),
    h("ellipse", { cx: 38, cy: 15, rx: 3, ry: 3.8, fill: "#ffa4c9" }),
    h("ellipse", { cx: 50, cy: 25, rx: 3, ry: 3.6, fill: "#ffa4c9" }),
    h("path", { d: "M44 40l4-3m-2 7 5-1", stroke: "#7e39df", strokeWidth: 2.4, strokeLinecap: "round" }),
  );
}

export default [{ id: "st-paw", art: PawSticker, name: "Boop paw", line: "Certified boop. Very official." }];
