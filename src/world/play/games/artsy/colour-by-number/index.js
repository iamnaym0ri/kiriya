import { createElement as h } from "react";

// colour by number: original lilac line-art pictures, tap the numbered shapes to paint them.
function Icon(props) {
  return h(
    "svg",
    { viewBox: "0 0 48 48", "aria-hidden": "true", ...props },
    h("path", { d: "M24 41C14 34 5 27 5 17.5 5 11 10 7 15.5 7c3.7 0 6.6 2 8.5 5 1.9-3 4.8-5 8.5-5C38 7 43 11 43 17.5 43 27 34 34 24 41Z", fill: "#fffaf4", stroke: "#5b4569", strokeWidth: 2.4, strokeLinejoin: "round" }),
    h("path", { d: "M24 12c-2 6 4 11 1 17-1.6 3.4-1 8 -1 12C14 34 5 27 5 17.5 5 11 10 7 15.5 7c3.7 0 6.6 2 8.5 5Z", fill: "#c9b1ee", stroke: "#5b4569", strokeWidth: 2.4, strokeLinejoin: "round" }),
    h("text", { x: 33, y: 25, textAnchor: "middle", fontSize: 11, fontWeight: 800, fill: "#7b6590", fontFamily: "system-ui, sans-serif" }, "2"),
  );
}

export default {
  id: "colour-by-number",
  shelf: "artsy",
  title: "colour by number",
  blurb: "tap the numbers, watch it bloom",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "colour by number: pictures drawn for kiriya.love; zoom and pan with @use-gesture (MIT)",
};
