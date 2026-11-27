import { createElement as h } from "react";

const line = { stroke: "#2b1b35", strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" };

function Icon({ size = 48 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": "true" },
    h("path", { d: "M12 22l1.5-13 9.5 7.5zM36 22l-1.5-13-9.5 7.5z", fill: "#fffaf4", ...line }),
    h("ellipse", { cx: 24, cy: 24, rx: 14, ry: 11.5, fill: "#fffaf4", ...line }),
    h("path", { d: "M12 20c4-4 9-3.5 10 1 .8 3.4-3 5-7 4.6", fill: "#f1a46c" }),
    h("path", { d: "M18.5 25q2.2-3 4.4 0M25.1 25q2.2-3 4.4 0", fill: "none", ...line, strokeWidth: 1.6 }),
    h("path", { d: "M22.8 28h2.4L24 29.3z", fill: "#f96cab" }),
    h("path", { d: "M6 30h36l-3 14H9z", fill: "#f2d9bd", ...line }),
    h("path", { d: "M21 30h6v14h-6z", fill: "#d9c3f2" }),
    h("path", { d: "M6 30h36", ...line }),
  );
}

export default {
  id: "boop-the-cats",
  shelf: "dexterity",
  title: "boop the cats",
  blurb: "kittens pop up, boop their noses",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "boop the cats: original game and kittens; little sounds made with ZzFX by Frank Force (MIT)",
};
