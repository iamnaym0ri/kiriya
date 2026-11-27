import { createElement as h } from "react";

// Maomao's memory drawer, on the brain shelf: three cabinet sizes and a best for each. The website
// keeps its own version (src/world/play/MaomaoGames.jsx).
function MemoryDrawerIcon() {
  const drawer = (x, y, open) =>
    h("g", { key: `${x}${y}` },
      h("rect", { x, y, width: 22, height: 17, rx: 3, fill: open ? "#fff8ec" : "#e8dcee", stroke: "#8a629b", strokeWidth: 2 }),
      open
        ? h("path", { d: `M${x + 7} ${y + 13}q2-8 9-8 0 7-9 8Zm0 1 6-6`, fill: "#9cba8d", stroke: "#608567", strokeWidth: 1.2 })
        : h("circle", { cx: x + 11, cy: y + 8.5, r: 2, fill: "#b38bc0" }));
  return h(
    "svg",
    { viewBox: "0 0 64 64", "aria-hidden": "true" },
    h("rect", { x: 6, y: 8, width: 52, height: 48, rx: 6, fill: "#c5aad6", stroke: "#795798", strokeWidth: 2.4 }),
    drawer(11, 13, false),
    drawer(35, 13, true),
    drawer(11, 34, true),
    drawer(35, 34, false),
  );
}

export default {
  id: "memory-drawer",
  shelf: "brain",
  order: 10,
  title: "memory drawer",
  blurb: "find the pairs in maomao’s cabinet",
  Icon: MemoryDrawerIcon,
  load: () => import("./Game.jsx"),
  credit: "Maomao’s memory drawer: our own game",
};
