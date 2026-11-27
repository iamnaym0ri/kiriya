import { createElement as h } from "react";

// Lantern corridor (id lantern-puzzle): the website's lantern puzzle grown into levels, 3×3 to 5×5,
// with a par for each corridor. The website keeps its own version (MoreMaomaoGames.jsx).
function LanternPuzzleIcon() {
  const lit = new Set([0, 4, 5, 7]);
  const lanterns = [];
  for (let i = 0; i < 9; i++) {
    const x = 10 + (i % 3) * 16;
    const y = 8 + Math.floor(i / 3) * 17;
    const on = lit.has(i);
    lanterns.push(
      h("g", { key: i },
        h("path", { d: `M${x + 3} ${y + 2}h8`, stroke: "#8a629b", strokeWidth: 1.6, strokeLinecap: "round" }),
        h("rect", { x, y: y + 3, width: 14, height: 12, rx: 5, fill: on ? "#ffe08a" : "#d9cbe3", stroke: on ? "#c9963d" : "#9675af", strokeWidth: 1.6 }),
        on && h("circle", { cx: x + 7, cy: y + 9, r: 2.4, fill: "#fff6d6" })),
    );
  }
  return h("svg", { viewBox: "0 0 64 64", "aria-hidden": "true" }, lanterns);
}

export default {
  id: "lantern-puzzle",
  shelf: "brain",
  order: 13,
  title: "lantern corridor",
  blurb: "light every lantern, at par if you can",
  Icon: LanternPuzzleIcon,
  load: () => import("./Game.jsx"),
  credit: "Lantern corridor: our own game (a lights-out puzzle; the par solver is written for it)",
};
