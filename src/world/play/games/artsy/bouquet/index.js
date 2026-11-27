import { createElement as h } from "react";

// bouquet maker: pick flowers, a wrap, a ribbon and a card; tie it up for her vase shelf. It took the
// sticker scenes' place on the artsy shelf (their stickers stay in her collection).
function Icon(props) {
  const petals = (cx, cy, r, fill) =>
    [0, 72, 144, 216, 288].map((a) =>
      h("ellipse", { key: `${cx}${a}`, cx, cy: cy - r * 0.62, rx: r * 0.46, ry: r * 0.66, transform: `rotate(${a} ${cx} ${cy})`, fill, stroke: "#5b4569", strokeWidth: 1.3 }),
    );
  return h(
    "svg",
    { viewBox: "0 0 48 48", "aria-hidden": "true", ...props },
    h("path", { d: "M24 40 6 14c4-4 9-4 12-1 2-4 10-4 12 0 3-3 8-3 12 1Z", fill: "#e9dcff", stroke: "#5b4569", strokeWidth: 2, strokeLinejoin: "round" }),
    ...petals(17, 17, 7, "#f6a9c7"),
    h("circle", { cx: 17, cy: 17, r: 2.4, fill: "#ffe08a" }),
    ...petals(31, 16, 6.4, "#c9b1ee"),
    h("circle", { cx: 31, cy: 16, r: 2.2, fill: "#fff4cf" }),
    ...petals(24, 10, 5.6, "#fff4ee"),
    h("circle", { cx: 24, cy: 10, r: 2, fill: "#f6a9c7" }),
    h("path", { d: "M11 27c7 5 19 5 26 0l-10 13h-6Z", fill: "#f6c1d8", stroke: "#5b4569", strokeWidth: 2, strokeLinejoin: "round" }),
    h("path", { d: "M24 34c-3-3-8-4-8-1s5 2 8 1Zm0 0c3-3 8-4 8-1s-5 2-8 1Z", fill: "#9a6cc8", stroke: "#5b4569", strokeWidth: 1.4, strokeLinejoin: "round" }),
  );
}

export default {
  id: "bouquet",
  shelf: "artsy",
  order: 40,
  title: "bouquet maker",
  blurb: "pick flowers, wrap them, tie a bow",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "bouquet maker: flowers, wraps and ribbons drawn for kiriya.love; gestures by @use-gesture (MIT)",
};
