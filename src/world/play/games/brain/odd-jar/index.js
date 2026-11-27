import { createElement as h } from "react";

// Find the odd jar (src/world/play/MaomaoGames.jsx), on the brain shelf.
function OddJarIcon() {
  const jar = (x, odd) =>
    h("g", { key: x, transform: `translate(${x} 0)` },
      h("path", { d: "M5 18h12v6q6 3 6 9v16q0 4-4 4H3q-4 0-4-4V33q0-6 6-9Z", fill: "#e8dcee", stroke: "#9675af", strokeWidth: 2 }),
      h("rect", { x: 4, y: 12, width: 14, height: 7, rx: 2, fill: "#d6b58b", stroke: "#ad8a66", strokeWidth: 1.5 }),
      h("rect", { x: 2, y: 34, width: 18, height: 13, rx: 2, fill: "#fff8ec" }),
      odd
        ? h("path", { d: "m11 36 4 4-4 4-4-4Z", fill: "#e52f8c" })
        : h("circle", { cx: 11, cy: 40.5, r: 3.4, fill: "#ba86aa" }));
  return h(
    "svg",
    { viewBox: "0 0 64 64", "aria-hidden": "true" },
    jar(4, false),
    jar(23, true),
    jar(42, false),
    h("path", { d: "M27 6c3-3 7-3 9 0", fill: "none", stroke: "#e52f8c", strokeWidth: 2, strokeLinecap: "round" }),
    h("path", { d: "M34 4l2 2-2 2", fill: "none", stroke: "#e52f8c", strokeWidth: 2, strokeLinecap: "round" }),
  );
}

export default {
  id: "odd-jar",
  shelf: "brain",
  order: 11,
  title: "odd jar",
  blurb: "one jar breaks the pattern. which?",
  Icon: OddJarIcon,
  load: () => import("./Game.jsx"),
  credit: "Find the odd jar: our own game",
};
