import { createElement as h } from "react";
import { StickerSvg, stickerLine } from "../_kit/stickers.jsx";

// A new sticker for her collection (docs/refactor/RENOVATION.md, "Games"): the coordinator adds it
// to the catalogue in server/content/birthday.js and StickerArt.
function PenlightSticker({ size = 64 }) {
  return h(
    StickerSvg,
    { size },
    h("circle", { cx: 36, cy: 22, r: 18, fill: "#a8fff6", opacity: 0.45 }),
    h("rect", { x: 30, y: 6, width: 12, height: 38, rx: 6, transform: "rotate(18 36 44)", fill: "#a8fff6", ...stickerLine, stroke: "#1f9a92" }),
    h("path", { d: "M31 12l2 22", stroke: "#fff", strokeWidth: 3, strokeLinecap: "round", transform: "rotate(18 36 44)" }),
    h("rect", { x: 30.5, y: 42, width: 11, height: 16, rx: 3, transform: "rotate(18 36 44)", fill: "#5b4a6b", ...stickerLine }),
    h("path", { d: "M12 18l1.6 4.4L18 24l-4.4 1.6L12 30l-1.6-4.4L6 24l4.4-1.6z", fill: "#fff6c9", stroke: "#e9b949", strokeWidth: 1.2 }),
    h("path", { d: "M54 40v-9l6 1.6v3.4", fill: "none", stroke: "#2b1b35", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
    h("ellipse", { cx: 52, cy: 41, rx: 3, ry: 2.4, fill: "#f96cab", stroke: "#2b1b35", strokeWidth: 1.6 }),
  );
}

export default [{ id: "st-penlight", art: PenlightSticker, name: "Penlight", line: "Waved in time, every single beat." }];
