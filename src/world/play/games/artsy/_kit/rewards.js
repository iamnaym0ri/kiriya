import { readJson, writeJson } from "./store.js";

// Stickers for real achievements only, each one once per phone (the hub's route is idempotent too,
// this just keeps the "you got a sticker" moment from repeating). Ids: server/content/birthday.js,
// or new ones a game brings in its own stickers.js (the coordinator adds those to the catalogue).
// The old sticker scenes gave "st-kitten" (game "sticker-scene"); stickers she earned there stay in
// her collection, and st-kitten stays in the catalogue.
export const ARTSY_REWARDS = {
  "colour-by-number": { first: { sticker: "st-brush", reason: "finished a picture" }, all: { sticker: "st-star", reason: "finished every picture" } },
  "paper-doll": {
    first: { sticker: "st-bow", reason: "saved a first look" },
    sets: { sticker: "st-wardrobe", reason: "tried on every themed outfit" },
  },
  bouquet: {
    first: { sticker: "st-bouquet", reason: "made a first bouquet" },
    five: { sticker: "st-vase", reason: "five bouquets on the shelf" },
  },
  kaleidoscope: {
    first: { sticker: "st-mirror", reason: "kept a first kaleidoscope" },
    five: { sticker: "st-prism", reason: "five kaleidoscopes kept" },
  },
};

export function rewardOnce(onReward, game, which = "first", store) {
  const reward = ARTSY_REWARDS[game]?.[which];
  if (!reward || typeof onReward !== "function") return false;
  const given = readJson("rewards", [], store);
  const key = `${game}:${which}`;
  if (given.includes(key)) return false;
  writeJson("rewards", [...given, key], store);
  onReward({ sticker: reward.sticker, reason: reward.reason }); // the hub adds the game's id

  return true;
}

/** Counts something she made in a game (kept on the phone), for "five of them" rewards. */
export function countMade(game, store) {
  const counts = readJson("made", {}, store);
  const next = (counts[game] ?? 0) + 1;
  writeJson("made", { ...counts, [game]: next }, store);
  return next;
}
