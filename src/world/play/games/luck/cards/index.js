import Icon from "./Icon.jsx";

export default {
  id: "cards",
  shelf: "luck",
  title: "lilac cards",
  blurb: "higher or lower? keep the streak going",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "lilac card deck drawn and built for kiriya.love; sounds made with ZzFX by Frank Force (MIT); confetti by canvas-confetti (ISC)",
};
