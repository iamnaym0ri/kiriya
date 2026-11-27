// The chat lock's state on this device (round 3). Her choice lives in her chat prefs (so it follows
// her to every device); a copy stays here so the lock holds even before her prefs have loaded.
// Whether the chat is open right now lives only in memory: closing the app forgets it.

export const DEFAULT_LOCK = { on: false, after: 60, previews: false };
const LOCAL = "kiriya:chat-lock";

function readLocal() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL) ?? "null");
    return value && typeof value.on === "boolean" ? value : null;
  } catch {
    return null;
  }
}

export function rememberLockLocally(lock) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify({ ...DEFAULT_LOCK, ...lock }));
  } catch {
    // Private storage off: her prefs still carry the choice.
  }
}

/** Her lock settings: from her prefs once they've loaded, else this device's copy. */
export function lockPrefs(prefs) {
  if (prefs?.lock && typeof prefs.lock.on === "boolean") return { ...DEFAULT_LOCK, ...prefs.lock };
  return readLocal() ?? DEFAULT_LOCK;
}

let unlocked = false;
let leftAt = null;

/** Whether the chat may show now, given how long she has been away. */
export const stillOpen = (after) => unlocked && (leftAt === null || Date.now() - leftAt <= after * 1000);
export function markUnlocked() {
  unlocked = true;
  leftAt = null;
}
/** She left the chat or the app: the clock starts. */
export function markLeft() {
  if (unlocked && leftAt === null) leftAt = Date.now();
}
/** She's back: still open if she wasn't away for longer than she chose. */
export function markBack(after) {
  if (leftAt !== null && Date.now() - leftAt > after * 1000) unlocked = false;
  leftAt = null;
  return unlocked;
}
export function relock() {
  unlocked = false;
  leftAt = null;
}

if (typeof window !== "undefined") window.addEventListener("kiriya:locked", relock);
