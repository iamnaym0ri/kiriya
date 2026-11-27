import { createElement as h } from "react";

const line = { stroke: "#2b1b35", strokeWidth: 1.7, strokeLinejoin: "round", strokeLinecap: "round" };
const mochi = (y, fill, half) =>
  h("path", { key: y, d: `M${24 - half} ${y + 8}c-3-1-3.5-3.5-3-6 1.5-4 7-7 ${half + 3}-7s${half + 1.5} 3 ${half + 3} 7c.5 2.5 0 5-3 6-5 1.5-10 1.5-${half} 1.5s-${half - 4} 0-${half}-1.5z`, fill, ...line });

function Icon({ size = 48 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": "true" },
    h("ellipse", { cx: 24, cy: 43, rx: 19, ry: 3.6, fill: "#fbf6ff", ...line }),
    mochi(31, "#d4eabf", 14),
    mochi(21, "#ffd3e2", 12),
    mochi(11, "#e4d4f8", 10),
    h("path", { d: "M24 2v8", stroke: "#b589ff", strokeWidth: 1.8, strokeLinecap: "round" }),
    h("path", { d: "M20.5 16q1.5-2 3 0M25.5 16q1.5-2 3 0", fill: "none", ...line, strokeWidth: 1.4 }),
  );
}

export default {
  id: "mochi-tower",
  shelf: "dexterity",
  title: "mochi tower",
  blurb: "stack swaying mochi as high as you can",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "mochi tower: stacking rules adapted from tower_game by iamkun (MIT, © 2018 BMQB, Inc); little sounds made with ZzFX by Frank Force (MIT)",
};
