import Icon from "./Icon.jsx";

export default {
  id: "cups",
  shelf: "luck",
  title: "teacup shuffle",
  blurb: "follow the little star under the cups",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "teacup shuffle drawn and built for kiriya.love; sounds made with ZzFX by Frank Force (MIT); confetti by canvas-confetti (ISC)",
};
