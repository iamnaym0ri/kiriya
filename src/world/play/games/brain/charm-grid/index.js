import Icon from "./Icon.jsx";

export default {
  id: "charm-grid",
  shelf: "brain",
  title: "charm grid",
  blurb: "every charm once in each row, column and box",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "puzzle generator and charm art original (a unique-solution, no-guessing generator written for this game)",
};
