// Paper doll rules (tested in scripts/test-games-artsy-doll.mjs): what can be worn together, sets,
// a surprise outfit, undo, and the lookbook. A look is
// { skin, eyes, eyeStyle, mouth, hair: { id, c }, outfit: { slot: { id, c } } }.
export const SLOTS = ["back", "socks", "shoes", "bottom", "top", "dress", "outer", "neck", "face", "head", "hand"];
export const DEFAULT_LOOK = {
  skin: 0,
  eyes: 0,
  eyeStyle: "round",
  mouth: "smile",
  hair: { id: "waves", c: 0 },
  outfit: { top: { id: "blouse", c: 0 }, bottom: { id: "pleats", c: 0 }, socks: { id: "frillsocks", c: 0 }, shoes: { id: "maryjanes", c: 0 } },
};
export const MAX_LOOKS = 24;
export const HISTORY_MAX = 50;

/** Puts an item on: a dress replaces a top and a bottom, and a top or a bottom replaces a dress. */
export function wear(look, item, c = 0) {
  const outfit = { ...look.outfit, [item.slot]: { id: item.id, c } };
  if (item.slot === "dress") {
    delete outfit.top;
    delete outfit.bottom;
  }
  if (item.slot === "top" || item.slot === "bottom") delete outfit.dress;
  return { ...look, outfit };
}

export function takeOff(look, slot) {
  const outfit = { ...look.outfit };
  delete outfit[slot];
  return { ...look, outfit };
}

export const isWearing = (look, item) => look.outfit?.[item.slot]?.id === item.id;

/** A themed set: its hair, face and every piece, replacing the whole outfit. */
export function wearSet(look, set) {
  return {
    ...look,
    hair: { ...set.look.hair },
    eyeStyle: set.look.eyeStyle ?? look.eyeStyle,
    mouth: set.look.mouth ?? look.mouth,
    outfit: Object.fromEntries(Object.entries(set.look.outfit).map(([slot, worn]) => [slot, { ...worn }])),
  };
}
/** True while she's wearing every piece of a set (colours may differ). */
export const inSet = (look, set) => Object.entries(set.look.outfit).every(([slot, worn]) => look.outfit?.[slot]?.id === worn.id);

/**
 * A whole surprise outfit: always something to wear on top and bottom (a dress, or a top and a
 * bottom) and shoes; now and then socks, a jacket and accessories. items: the ITEMS list.
 */
export function surprise(look, items, hairs, hairColours, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const of = (slot) => items.filter((item) => item.slot === slot);
  let next = { ...look, hair: { id: pick(hairs).id, c: Math.floor(random() * hairColours) }, outfit: {} };
  const dressUp = random() < 0.45 && of("dress").length > 0;
  const slots = dressUp ? ["dress", "shoes"] : ["top", "bottom", "shoes"];
  const chance = { socks: 0.55, outer: 0.3, head: 0.5, neck: 0.35, hand: 0.4, face: 0.15, back: 0.15 };
  for (const slot of [...slots, "socks", "outer", "head", "neck", "hand", "face", "back"]) {
    if (!slots.includes(slot) && random() > (chance[slot] ?? 0.4)) continue;
    const item = pick(of(slot));
    if (item) next = wear(next, item, Math.floor(random() * item.colors.length));
  }
  return next;
}

/** Undo history: the look before each change, newest last. */
export const pushHistory = (history, look, limit = HISTORY_MAX) => (history.at(-1) === look ? history : [...history, look].slice(-limit));

/** Saves a look at the front of the lookbook, skipping it if the newest one is the same. */
export function addLook(looks, look, backdrop, id, at = new Date().toISOString()) {
  if (looks.length && sameLook(looks[0].look, look) && looks[0].backdrop === backdrop) return looks;
  return [{ id, look, backdrop, at }, ...looks].slice(0, MAX_LOOKS);
}
export const removeLook = (looks, id) => looks.filter((each) => each.id !== id);

export function sameLook(a, b) {
  const key = (look) =>
    JSON.stringify({
      s: look.skin ?? 0,
      e: look.eyes ?? 0,
      es: look.eyeStyle ?? "round",
      m: look.mouth ?? "smile",
      h: look.hair,
      o: Object.keys(look.outfit ?? {}).sort().map((slot) => [slot, look.outfit[slot]]),
    });
  return key(a) === key(b);
}

/** A short name for a look: its set's name, or its pieces, like "babydoll dress & kitty ears". */
export function lookName(look, itemById, sets = []) {
  const set = sets.find((each) => inSet(look, each));
  if (set) return set.name;
  const names = ["dress", "top", "outer", "head", "hand"].map((slot) => look.outfit?.[slot] && itemById(look.outfit[slot].id)?.name).filter(Boolean);
  return names.slice(0, 2).join(" & ") || "a little look";
}

/**
 * A look from an older save, made safe to draw: pieces that no longer exist come off, a missing
 * hairstyle falls back to the first one, colours stay within their item's choices.
 */
export function tidyLook(look, { itemById, hairById, hairColours, skins, eyeColours, eyeStyles, mouths }) {
  const base = { ...DEFAULT_LOOK, ...(look ?? {}) };
  const outfit = {};
  for (const [slot, worn] of Object.entries(base.outfit ?? {})) {
    const item = worn && itemById(worn.id);
    if (item && item.slot === slot) outfit[slot] = { id: item.id, c: Math.min(Math.max(0, worn.c ?? 0), item.colors.length - 1) };
  }
  const hair = hairById(base.hair?.id);
  return {
    skin: Math.min(Math.max(0, base.skin ?? 0), skins - 1),
    eyes: Math.min(Math.max(0, base.eyes ?? 0), eyeColours - 1),
    eyeStyle: eyeStyles.includes(base.eyeStyle) ? base.eyeStyle : "round",
    mouth: mouths.includes(base.mouth) ? base.mouth : "smile",
    hair: { id: hair.id, c: Math.min(Math.max(0, base.hair?.c ?? 0), hairColours - 1) },
    outfit,
  };
}
