import { readJson, writeJson } from "./store.js";

// Stickers for real achievements only, each one once per phone (the hub's route is idempotent too,
// this just keeps the "you got a sticker" moment from repeating). Ids: server/content/birthday.js.
export const ARTSY_REWARDS = {
  "colour-by-number": { first: { sticker: "st-brush", reason: "finished a picture" }, all: { sticker: "st-star", reason: "finished every picture" } },
  "paper-doll": { first: { sticker: "st-bow", reason: "saved a first look" } },
  "sticker-scene": { first: { sticker: "st-kitten", reason: "sent a first scene" } },
  kaleidoscope: { first: { sticker: "st-mirror", reason: "kept a first kaleidoscope" } },
};

export function rewardOnce(onReward, game, which = "first", store) {
  const reward = ARTSY_REWARDS[game]?.[which];
  if (!reward || typeof onReward !== "function") return false;
  const given = readJson("rewards", [], store);
  const key = `${game}:${which}`;
  if (given.includes(key)) return false;
  writeJson("rewards", [...given, key], store);
  onReward({ sticker: reward.sticker, game, reason: reward.reason });
  return true;
}
