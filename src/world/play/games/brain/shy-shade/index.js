import Icon from "./Icon.jsx";

export default {
  id: "shy-shade",
  shelf: "brain",
  title: "shy shade",
  blurb: "one swatch is a whisper different",
  Icon,
  load: () => import("./Game.jsx"),
  credit: "Oklab colour conversion by Björn Ottosson (public domain); game and art original",
};
