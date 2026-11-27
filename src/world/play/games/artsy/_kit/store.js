// Little saves for the artsy shelf: her drafts, finished pictures and looks live on the phone
// (localStorage), written a moment after each change and again whenever the app goes to the
// background, so nothing she makes is lost. Pure helpers here; the React hooks are in hooks.js.
export const STORE_PREFIX = "kiriya.artsy.v1.";

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Private mode or blocked storage: play on, just without saving.
  }
};

export function readJson(key, fallback, store = storage()) {
  try {
    const raw = store?.getItem(STORE_PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, store = storage()) {
  try {
    if (value === undefined) store?.removeItem(STORE_PREFIX + key);
    else store?.setItem(STORE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // Full storage: the in-memory copy still holds her work for this visit.
  }
}

/** Rounds stroke points so long drawings stay small in storage (logical units, so 0.1 is plenty). */
export const roundPoint = ([x, y, p = 0.5]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100];

/** A small, stable id for things she places (stickers, looks). */
export const newId = (prefix = "a") => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
