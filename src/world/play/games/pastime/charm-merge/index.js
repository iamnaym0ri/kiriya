import { CharmMergeIcon } from "./art.jsx";

export default {
  id: "charm-merge",
  shelf: "pastime",
  title: "charm ladder",
  blurb: "slide matching charms together, all the way to a crown",
  Icon: CharmMergeIcon,
  load: () => import("./Game.jsx"),
  credit: "Charm ladder: sliding rules adapted from 2048 by Gabriele Cirulli (MIT)",
};
