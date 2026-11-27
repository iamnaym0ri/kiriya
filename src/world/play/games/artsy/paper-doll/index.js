import { createElement as h } from "react";

// paper doll: an original doll, outfits to tap or drag on, and a lookbook of saved looks.
function Icon(props) {
  return h(
    "svg",
    { viewBox: "0 0 48 48", "aria-hidden": "true", ...props },
    h("path", { d: "M14 20c-2 10 0 18-4 24h28c-4-6-2-14-4-24Z", fill: "#3b2a4a", stroke: "#4f3a5e", strokeWidth: 2 }),
    h("circle", { cx: 24, cy: 17, r: 10, fill: "#ffe6d4", stroke: "#4f3a5e", strokeWidth: 2 }),
    h("path", { d: "M14 18c-1-9 5-12 10-12s11 3 10 12c-2-3-4-4-6-4-4 0-8 2-14 4Z", fill: "#3b2a4a" }),
    h("path", { d: "M17 30h14l5 14H12Z", fill: "#f6a9c7", stroke: "#4f3a5e", strokeWidth: 2, strokeLinejoin: "round" }),
    h("path", { d: "M33 8c-3-4-8-3-7 1 1 3 4 3 7-1Zm0 0c3-4 8-3 7 1-1 3-4 3-7-1Z", fill: "#c9b1ee", stroke: "#4f3a5e", strokeWidth: 1.6 }),
    h("circle", { cx: 20.5, cy: 18.5, r: 1.6, fill: "#4f3a5e" }),
    h("circle", { cx: 27.5, cy: 18.5, r: 1.6, fill: "#4f3a5e" }),
  );
}

export default {
  id: "paper-doll",
  shelf: "artsy",
  order: 30,
  title: "paper doll",
  blurb: "dress her up, save the look",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "paper doll: doll and outfits drawn for kiriya.love; dragging by @use-gesture (MIT)",
};
