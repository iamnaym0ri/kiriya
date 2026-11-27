// The game library (docs/refactor/RENOVATION.md, "Games"): every
// `games/<shelf>/<game-id>/index.js` default-exports its game's card. The cards are tiny and load
// eagerly; each game's own code loads only when she opens it (`load()`). Owner: the frame agent.
const modules = import.meta.glob("./*/*/index.js", { eager: true });

export const SHELVES = [
  { id: "pastime", title: "pastime", blurb: "cosy, no rush" },
  { id: "brain", title: "brain power", blurb: "a little puzzle" },
  { id: "luck", title: "luck", blurb: "feeling lucky?" },
  { id: "artsy", title: "artsy", blurb: "make something pretty" },
  { id: "dexterity", title: "dexterity", blurb: "quick fingers" },
];

export const GAMES = Object.values(modules)
  .map((module) => module.default)
  .filter((game) => game?.id && game.shelf && (import.meta.env.DEV || !game.devOnly));

export const gamesOnShelf = (shelf) => GAMES.filter((game) => game.shelf === shelf);
export const gameById = (id) => GAMES.find((game) => game.id === id) ?? null;
