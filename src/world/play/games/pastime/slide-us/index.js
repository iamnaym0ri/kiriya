import SlideIcon from "./Icon.jsx";

export default {
  id: "slide-us",
  shelf: "pastime",
  title: "us, in pieces",
  blurb: "slide our photos back together",
  Icon: SlideIcon,
  load: () => import("./Game.jsx"),
  credit: "Us, in pieces: our own sliding puzzle",
};
