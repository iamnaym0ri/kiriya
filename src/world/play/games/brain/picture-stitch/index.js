import Icon from "./Icon.jsx";

export default {
  id: "picture-stitch",
  shelf: "brain",
  title: "picture stitch",
  blurb: "number clues stitch a hidden picture",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "line solving adapted from nonogram-solver by Thomas Rosenau (Apache-2.0); pictures and art original",
};
