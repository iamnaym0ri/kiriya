import Icon from "./Icon.jsx";

export default {
  id: "capsule",
  shelf: "luck",
  title: "charm capsules",
  blurb: "turn the crank, collect the charms",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "capsule machine drawn and built for kiriya.love; sounds made with ZzFX by Frank Force (MIT); confetti by canvas-confetti (ISC)",
};
