import { createElement as h } from "react";

// sticker scenes: place, size and turn her stickers on a little scene, then send it.
function Icon(props) {
  return h(
    "svg",
    { viewBox: "0 0 48 48", "aria-hidden": "true", ...props },
    h("rect", { x: 5, y: 4, width: 38, height: 40, rx: 8, fill: "#e3d4ff", stroke: "#5b4569", strokeWidth: 2.4 }),
    h("path", { d: "M5 34q10-8 19-2t19-4v8a8 8 0 0 1-8 8H13a8 8 0 0 1-8-8Z", fill: "#b5e3d3", stroke: "#5b4569", strokeWidth: 2.4, strokeLinejoin: "round" }),
    h("path", { d: "M27 13c-4-5-12-1-8 5l8 8 8-8c4-6-4-10-8-5Z", fill: "#f6a9c7", stroke: "#5b4569", strokeWidth: 2.2, strokeLinejoin: "round", transform: "rotate(-12 27 17)" }),
    h("path", { d: "M13 14l1.6 3.4L18 19l-3.4 1.6L13 24l-1.6-3.4L8 19l3.4-1.6Z", fill: "#fff3b8", stroke: "#5b4569", strokeWidth: 1.6, strokeLinejoin: "round" }),
  );
}

export default {
  id: "sticker-scene",
  shelf: "artsy",
  order: 40,
  title: "sticker scenes",
  blurb: "make a little scene, send it with love",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "sticker scenes: scenes drawn for kiriya.love; Fluent Emoji stickers © Microsoft (MIT); gestures by @use-gesture (MIT)",
};
