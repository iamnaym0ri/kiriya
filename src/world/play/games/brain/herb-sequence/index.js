import { createElement as h } from "react";

// Herb sequence, on the brain shelf: Maomao's notes, one herb longer each time, three hearts. The
// website keeps its own three-note version (src/world/play/MoreMaomaoGames.jsx).
function HerbSequenceIcon() {
  return h(
    "svg",
    { viewBox: "0 0 64 64", "aria-hidden": "true" },
    h("path", { d: "M8 12h44l4 6v34H12l-4-6Z", fill: "#f6e7c9", stroke: "#ae9578", strokeWidth: 2.2, strokeLinejoin: "round" }),
    h("path", { d: "M8 12v34l4 6V18Z", fill: "#e6d2b0", stroke: "#ae9578", strokeWidth: 1.6, strokeLinejoin: "round" }),
    h("path", { d: "M19 38q2-11 9-16", fill: "none", stroke: "#547d63", strokeWidth: 2, strokeLinecap: "round" }),
    h("path", { d: "M22 31c-6 0-7-6-7-6 6 0 8 3 7 6Z", fill: "#94b888", stroke: "#547d63", strokeWidth: 1.2 }),
    [0, 72, 144, 216, 288].map((angle) => h("ellipse", { key: angle, cx: 38, cy: 26, rx: 3, ry: 4.5, transform: `rotate(${angle} 38 30)`, fill: "#dba1bf", stroke: "#ae739c", strokeWidth: 1 })),
    h("circle", { cx: 38, cy: 30, r: 2.4, fill: "#efcf88" }),
    h("path", { d: "M44 38h6v8h-6z", fill: "#c0a5d9", stroke: "#795798", strokeWidth: 1.4 }),
    h("text", { x: 22, y: 48, fontSize: 7, fill: "#876b88", fontFamily: "sans-serif", textAnchor: "middle" }, "1"),
    h("text", { x: 36, y: 48, fontSize: 7, fill: "#876b88", fontFamily: "sans-serif", textAnchor: "middle" }, "2"),
  );
}

export default {
  id: "herb-sequence",
  shelf: "brain",
  order: 12,
  title: "herb sequence",
  blurb: "remember maomao’s note, one herb longer each time",
  Icon: HerbSequenceIcon,
  load: () => import("./Game.jsx"),
  credit: "Herb sequence: our own game",
};
