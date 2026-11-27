import { createElement as h } from "react";

function Icon({ size = 48 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": "true" },
    h("path", { d: "M24 17c-4-3-4-8 0-9.5 4 1.5 4 6.5 0 9.5ZM24 17c3-4 8-4 9.5 0-1.5 4-6.5 4-9.5 0ZM24 17c4 3 4 8 0 9.5-4-1.5-4-6.5 0-9.5ZM24 17c-3 4-8 4-9.5 0 1.5-4 6.5-4 9.5 0Z", fill: "#cfb4ff", stroke: "#2b1b35", strokeWidth: 1.6, strokeLinejoin: "round", transform: "translate(0 -3)" }),
    h("circle", { cx: 24, cy: 14, r: 2, fill: "#ffe08a", stroke: "#2b1b35", strokeWidth: 1 }),
    h("path", { d: "M8 28h32l-3.5 12c-.5 2-2 3-4 3H15.5c-2 0-3.5-1-4-3Z", fill: "#efcf9f", stroke: "#2b1b35", strokeWidth: 1.8, strokeLinejoin: "round" }),
    h("rect", { x: 6, y: 25, width: 36, height: 5.5, rx: 2.75, fill: "#f7dfba", stroke: "#2b1b35", strokeWidth: 1.8 }),
    h("path", { d: "M24 35c-3-3-7-3.5-7-1s4.5 2.3 7 1Zm0 0c3-3 7-3.5 7-1s-4.5 2.3-7 1Z", fill: "#b589ff", stroke: "#2b1b35", strokeWidth: 1.2 }),
  );
}

export default {
  id: "petal-catch",
  shelf: "dexterity",
  title: "petal catch",
  blurb: "catch the lilac petals, dodge the thorns",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "petal catch: original game; little sounds made with ZzFX by Frank Force (MIT)",
};
