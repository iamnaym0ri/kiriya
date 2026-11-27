// Where she left off, kept on this phone. Every read and write is guarded: private mode or a full
// disk just means the game starts fresh.
const PREFIX = "kiriya.pastime.";

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Nothing to do: the game still plays, it just won't remember.
  }
}

/** A reward fires once per reason on this phone; the hub also keeps them idempotent. */
export function rewardOnce(onReward, { sticker, game, reason }) {
  const seen = load("rewards", {});
  const key = `${game}:${reason}`;
  if (seen[key]) return false;
  save("rewards", { ...seen, [key]: Date.now() });
  onReward?.({ sticker, game, reason });
  return true;
}
