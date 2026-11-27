// Per-phone keepsakes for the dexterity games: best scores, settings and which stickers were already
// handed out. localStorage can be missing (private mode) or throw; every game still works without it.
const PREFIX = "kiriya:dex:";

function read(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, String(value));
  } catch {
    // Nothing to do: the value just isn't remembered.
  }
}

export function readNumber(key, fallback = 0) {
  const value = Number(read(key));
  return read(key) !== null && Number.isFinite(value) ? value : fallback;
}

export const writeNumber = (key, value) => write(key, Number.isFinite(value) ? value : null);
export const readFlag = (key, fallback = false) => {
  const value = read(key);
  return value === null ? fallback : value === "1";
};
export const writeFlag = (key, on) => write(key, on ? "1" : "0");
export const readText = (key, fallback = "") => read(key) ?? fallback;
export const writeText = (key, value) => write(key, value);

export const bestScore = (game, board = "best") => readNumber(`${game}:${board}`, 0);

/** Keeps the higher of the two. Returns the best after this round and whether it is new. */
export function saveBest(game, score, board = "best") {
  const before = bestScore(game, board);
  if (score > before) {
    writeNumber(`${game}:${board}`, score);
    return { best: score, isNew: before > 0 || score > 0 };
  }
  return { best: before, isNew: false };
}
