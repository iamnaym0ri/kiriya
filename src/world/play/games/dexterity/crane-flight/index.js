import { createElement as h } from "react";

const line = { stroke: "#2b1b35", strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" };

function Icon({ size = 48 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": "true" },
    h("path", { d: "M2 0h10v14q-5 4-10 0z", fill: "#c7a8ef" }),
    h("path", { d: "M36 48V36q5-5 10 0v12z", fill: "#fbf7ff", ...line }),
    h("path", { d: "M5 27L17 34 15 37z", fill: "#e3d4fb", ...line }),
    h("path", { d: "M19 30L15 9 32 30z", fill: "#d9c6fb", ...line }),
    h("path", { d: "M10 34L26 26 38 34 26 40z", fill: "#f2eaff", ...line }),
    h("path", { d: "M33 32L44 16 41 31z", fill: "#f7f1ff", ...line }),
    h("path", { d: "M44 16l3 2.4-4 .8z", fill: "#f9a3c6" }),
    h("path", { d: "M22 30L24 11 35 30z", fill: "#cfb4ff", ...line }),
  );
}

export default {
  id: "crane-flight",
  shelf: "dexterity",
  title: "paper-crane flight",
  blurb: "one tap to flap through gentle gaps",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "paper-crane flight: flight model adapted from floppybird by Nebez Briefkani (Apache-2.0); little sounds made with ZzFX by Frank Force (MIT)",
};
