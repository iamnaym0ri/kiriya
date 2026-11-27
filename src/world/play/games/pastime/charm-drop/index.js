import { CharmDropIcon } from "./art.jsx";

export default {
  id: "charm-drop",
  shelf: "pastime",
  title: "charm drop",
  blurb: "fill a row of charms and it floats away",
  Icon: CharmDropIcon,
  load: () => import("./Game.jsx"),
  credit: "Charm drop: falling-block rules adapted from javascript-tetris by Jake Gordon (MIT)",
};
