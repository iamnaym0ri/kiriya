import { readStore, writeStore } from "./hooks.js";

// Stickers are for real achievements, and each one is given once: the hub's save is idempotent
// per game + reason as well, but remembering here keeps the "you got a sticker" moment from
// popping up again on a replay (docs/refactor/RENOVATION.md, "Games").
const KEY = "kiriya:brain:rewards";

export function rewardOnce(onReward, { sticker, game, reason }) {
  const given = readStore(KEY, {});
  const key = `${game}:${reason}`;
  if (given[key]) return false;
  writeStore(KEY, { ...given, [key]: Date.now() });
  try {
    onReward?.({ sticker, game, reason });
  } catch {
    // The hub shows the moment; a failure there mustn't break the game.
  }
  return true;
}
