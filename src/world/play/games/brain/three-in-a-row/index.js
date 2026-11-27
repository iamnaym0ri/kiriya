import Icon from "./Icon.jsx";

export default {
  id: "three-in-a-row",
  shelf: "brain",
  title: "three in a row",
  blurb: "blossoms against maomao’s herbs",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "game, art and Maomao’s lines original (minimax play written for this game); Maomao is fan art (The Apothecary Diaries © Natsu Hyuuga / Shufunotomo / Square Enix)",
};
