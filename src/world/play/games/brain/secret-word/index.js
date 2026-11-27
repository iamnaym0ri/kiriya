import Icon from "./Icon.jsx";

export default {
  id: "secret-word",
  shelf: "brain",
  title: "secret word",
  blurb: "five letters, six tries, a new word every day",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "guess dictionary: the ENABLE2K word list (public domain); game and art original",
};
