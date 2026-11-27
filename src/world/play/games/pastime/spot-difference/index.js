import SpotIcon from "./Icon.jsx";

export default {
  id: "spot-difference",
  shelf: "pastime",
  title: "look twice",
  blurb: "two little pictures, five things changed",
  Icon: SpotIcon,
  load: () => import("./Game.jsx"),
  credit: "Look twice: our own pictures and rules",
};
