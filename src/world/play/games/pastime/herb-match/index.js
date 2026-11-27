import { HerbMatchIcon } from "./art.jsx";

export default {
  id: "herb-match",
  shelf: "pastime",
  title: "herb patch",
  blurb: "swap herbs, make rows of three",
  Icon: HerbMatchIcon,
  load: () => import("./Game.jsx"),
  credit: "Herb patch: our own match-3 board, following the rules of match-three-js by Playtester's Kitchen (MIT)",
};
