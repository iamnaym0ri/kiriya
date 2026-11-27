import Icon from "./Icon.jsx";

export default {
  id: "fortune",
  shelf: "luck",
  title: "fortune slip",
  blurb: "one sweet fortune a day, kept forever",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "fortune slip and every fortune written for kiriya.love; sounds made with ZzFX by Frank Force (MIT); confetti by canvas-confetti (ISC)",
};
