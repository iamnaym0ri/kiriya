import { createElement as h } from "react";

// Maomao's colour club (src/world/play/PaletteParty.jsx), on the artsy shelf of the app's library.
function PalettePartyIcon() {
  return h(
    "svg",
    { viewBox: "0 0 64 64", "aria-hidden": "true" },
    h("path", { d: "M32 8C17 8 6 18 6 31c0 12 9 21 20 21 5 0 6-3 6-6 0-4 3-6 7-6h6c7 0 13-5 13-12C58 16 46 8 32 8Z", fill: "#fff7ec", stroke: "#835b92", strokeWidth: 2.4, strokeLinejoin: "round" }),
    h("circle", { cx: 20, cy: 27, r: 5, fill: "#dba1bf", stroke: "#ae739c", strokeWidth: 1.5 }),
    h("circle", { cx: 31, cy: 18, r: 5, fill: "#c0a5d9", stroke: "#795798", strokeWidth: 1.5 }),
    h("circle", { cx: 44, cy: 21, r: 5, fill: "#efcf88", stroke: "#b8955a", strokeWidth: 1.5 }),
    h("circle", { cx: 22, cy: 40, r: 4.5, fill: "#94b888", stroke: "#547d63", strokeWidth: 1.5 }),
    h("path", { d: "M58 48 44 37", stroke: "#a98a6a", strokeWidth: 4, strokeLinecap: "round" }),
    h("path", { d: "M44 37c-3-2-6-1-7 2 2 0 4 1 5 3 2-1 3-3 2-5Z", fill: "#995cf7", stroke: "#632bb5", strokeWidth: 1.2 }),
  );
}

export default {
  id: "palette-party",
  shelf: "artsy",
  order: 10,
  title: "colour club",
  blurb: "mix the paint to match maomao’s colour",
  Icon: PalettePartyIcon,
  load: () => import("./Game.jsx"),
  credit: "Maomao’s colour club: our own game",
};
