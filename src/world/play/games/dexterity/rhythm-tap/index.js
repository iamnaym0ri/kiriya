import { createElement as h } from "react";

const line = { stroke: "#2b1b35", strokeWidth: 1.7, strokeLinejoin: "round", strokeLinecap: "round" };

function Icon({ size = 48 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": "true" },
    h("circle", { cx: 12, cy: 36, r: 9, fill: "#5fd3c8", ...line }),
    h("circle", { cx: 36, cy: 30, r: 9, fill: "#ff9cc7", ...line }),
    h("circle", { cx: 24, cy: 14, r: 9, fill: "#b996f0", ...line }),
    h("path", { d: "M26 8v9a3 3 0 1 1-2-2.8V8l5 1.4v2.6z", fill: "#fff", stroke: "#2b1b35", strokeWidth: 1 }),
  );
}

export default {
  id: "rhythm-tap",
  shelf: "dexterity",
  title: "rhythm tap",
  blurb: "tap along to little chiptunes with negi",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "rhythm tap: original game, chiptunes and characters; little sounds made with ZzFX by Frank Force (MIT)",
};
