import { createElement as h } from "react";

// kaleidoscope: one stroke, turned and mirrored around the centre into a flower.
function Icon(props) {
  const petals = [0, 60, 120, 180, 240, 300].map((angle) =>
    h("ellipse", { key: angle, cx: 24, cy: 13, rx: 5, ry: 9, transform: `rotate(${angle} 24 24)`, fill: angle % 120 ? "#f6a9c7" : "#c9b1ee", stroke: "#5b4569", strokeWidth: 1.8 }),
  );
  return h("svg", { viewBox: "0 0 48 48", "aria-hidden": "true", ...props }, h("circle", { cx: 24, cy: 24, r: 21, fill: "#2a1850" }), ...petals, h("circle", { cx: 24, cy: 24, r: 4, fill: "#fff0b8", stroke: "#5b4569", strokeWidth: 1.6 }));
}

export default {
  id: "kaleidoscope",
  shelf: "artsy",
  order: 50,
  title: "kaleidoscope",
  blurb: "one stroke, mirrored into a flower",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "kaleidoscope: brush strokes by perfect-freehand (MIT, Steve Ruiz)",
};
