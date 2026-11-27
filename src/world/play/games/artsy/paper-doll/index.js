import { createElement as h } from "react";

// paper doll: a chibi doll, a big wardrobe, themed sets, and a lookbook of saved looks.
function Icon(props) {
  return h(
    "svg",
    { viewBox: "0 0 48 48", "aria-hidden": "true", ...props },
    h("path", { d: "M11 22c-3 10-1 18-5 23h36c-4-5-2-13-5-23Z", fill: "#3b2a4a", stroke: "#4f3a5e", strokeWidth: 2, strokeLinejoin: "round" }),
    h("path", { d: "M16 31h16l6 14H10Z", fill: "#f6a9c7", stroke: "#4f3a5e", strokeWidth: 2, strokeLinejoin: "round" }),
    h("path", { d: "M12 43q4 3 6 0 3 3 6 0 3 3 6 0 3 3 6 0", fill: "none", stroke: "#fffafd", strokeWidth: 1.6, strokeLinecap: "round" }),
    h("ellipse", { cx: 24, cy: 18, rx: 12, ry: 11.5, fill: "#ffe9dc", stroke: "#4f3a5e", strokeWidth: 2 }),
    h("path", { d: "M12 20c-1-9 5-13 12-13s13 4 12 13c-2-3-4-4-5-4l-1 3-2-4-2 4-2-4-2 4-2-4-1 3c-2 0-4 1-5 2Z", fill: "#3b2a4a" }),
    h("ellipse", { cx: 20, cy: 20.5, rx: 2, ry: 2.6, fill: "#6b4a9a" }),
    h("ellipse", { cx: 28, cy: 20.5, rx: 2, ry: 2.6, fill: "#6b4a9a" }),
    h("circle", { cx: 20.7, cy: 19.6, r: 0.8, fill: "#fff" }),
    h("circle", { cx: 28.7, cy: 19.6, r: 0.8, fill: "#fff" }),
    h("ellipse", { cx: 17, cy: 24, rx: 2, ry: 1.2, fill: "#ff8fb4", opacity: 0.6 }),
    h("ellipse", { cx: 31, cy: 24, rx: 2, ry: 1.2, fill: "#ff8fb4", opacity: 0.6 }),
    h("path", { d: "M35 9c-3-4-8-3-7 1 1 3 4 3 7-1Zm0 0c3-4 8-3 7 1-1 3-4 3-7-1Z", fill: "#c9b1ee", stroke: "#4f3a5e", strokeWidth: 1.6 }),
  );
}

export default {
  id: "paper-doll",
  shelf: "artsy",
  order: 30,
  title: "paper doll",
  blurb: "dress her up, try a set, save the look",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "paper doll: doll, hair, wardrobe and scenes drawn for kiriya.love; dragging by @use-gesture (MIT)",
};
