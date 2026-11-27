import Icon from "./Icon.jsx";

export default {
  id: "lanterns",
  shelf: "luck",
  title: "wishing lanterns",
  blurb: "catch three lanterns, keep their wishes",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "wishing lanterns and every wish drawn and written for kiriya.love; sounds made with ZzFX by Frank Force (MIT); confetti by canvas-confetti (ISC)",
};
