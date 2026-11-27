// The game library (docs/refactor/RENOVATION.md, "Games"): every
// `games/<shelf>/<game-id>/index.js` default-exports its game's card. The cards are tiny and load
// eagerly; each game's own code loads only when she opens it (`load()`). Owner: the frame agent.
const modules = import.meta.glob("./*/*/index.js", { eager: true });
// New sticker designs a game brings along (`stickers.js` beside its index, or one per shelf), so
// the hub can draw them before the coordinator adds them to the catalogue.
const stickerModules = import.meta.glob(["./*/*/stickers.{js,jsx}", "./*/stickers.{js,jsx}"], { eager: true });

export const SHELVES = [
  { id: "pastime", title: "pastime", blurb: "cosy, no rush", mark: "✿" },
  { id: "brain", title: "brain power", blurb: "a little puzzle", mark: "✎" },
  { id: "luck", title: "luck", blurb: "feeling lucky?", mark: "☘" },
  { id: "artsy", title: "artsy", blurb: "make something pretty", mark: "✧" },
  { id: "dexterity", title: "dexterity", blurb: "quick fingers", mark: "♪" },
];
const SHELF_ORDER = new Map(SHELVES.map((shelf, index) => [shelf.id, index]));

export const GAMES = Object.values(modules)
  .map((module) => module.default)
  .filter((game) => game?.id && SHELF_ORDER.has(game.shelf) && typeof game.load === "function" && (import.meta.env.DEV || !game.devOnly))
  // Stable order inside a shelf: an explicit `order` first, then by title.
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || String(a.title).localeCompare(String(b.title)));

export const gamesOnShelf = (shelf) => GAMES.filter((game) => game.shelf === shelf);
export const gameById = (id) => GAMES.find((game) => game.id === id) ?? null;

/**
 * Sticker designs from the game folders, by id: { id, art, name, line, render? }. `art` may be a
 * component, the inside of a 64×64 SVG as markup, an image path, or a name the module's own
 * `AnySticker` renderer knows (passed along as `render`).
 */
export const GAME_STICKERS = new Map(
  Object.values(stickerModules)
    .flatMap((module) => {
      const list = module.default ?? module.stickers ?? module.STICKERS;
      return Array.isArray(list) ? list.map((sticker) => ({ ...sticker, render: module.AnySticker ?? null })) : [];
    })
    .filter((sticker) => sticker?.id)
    .map((sticker) => [sticker.id, sticker]),
);
