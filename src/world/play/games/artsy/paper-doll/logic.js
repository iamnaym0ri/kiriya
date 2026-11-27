// Paper doll rules (tested in scripts/test-games-artsy.mjs): what can be worn together, a surprise
// outfit, and the lookbook. A look is { skin, eyes, hair: { id, c }, outfit: { slot: { id, c } } }.
export const DEFAULT_LOOK = {
  skin: 0,
  eyes: 0,
  hair: { id: "waves", c: 0 },
  outfit: { top: { id: "blouse", c: 0 }, bottom: { id: "pleats", c: 0 }, shoes: { id: "maryjanes", c: 0 } },
};
export const MAX_LOOKS = 24;

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

/** A whole surprise outfit from the wardrobe (items: the ITEMS list; hairs: the HAIR list). */
export function surprise(look, items, hairs, hairColours, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const of = (slot) => items.filter((item) => item.slot === slot);
  let next = { ...look, hair: { id: pick(hairs).id, c: Math.floor(random() * hairColours) }, outfit: {} };
  const dressUp = random() < 0.45;
  const slots = dressUp ? ["dress", "shoes"] : ["top", "bottom", "shoes"];
  for (const slot of [...slots, "socks", "head", "neck", "hand", "back"]) {
    const optional = !slots.includes(slot);
    if (optional && random() > (slot === "back" ? 0.2 : 0.5)) continue;
    const item = pick(of(slot));
    if (item) next = wear(next, item, Math.floor(random() * item.colors.length));
  }
  return next;
}

/** Saves a look at the front of the lookbook, skipping it if the newest one is the same. */
export function addLook(looks, look, backdrop, id, at = new Date().toISOString()) {
  if (looks.length && sameLook(looks[0].look, look) && looks[0].backdrop === backdrop) return looks;
  return [{ id, look, backdrop, at }, ...looks].slice(0, MAX_LOOKS);
}
export const removeLook = (looks, id) => looks.filter((each) => each.id !== id);

export function sameLook(a, b) {
  const key = (look) => JSON.stringify({ s: look.skin, e: look.eyes, h: look.hair, o: Object.keys(look.outfit ?? {}).sort().map((slot) => [slot, look.outfit[slot]]) });
  return key(a) === key(b);
}

/** A short name for a look from its pieces, like "frill dress & kitty ears". */
export function lookName(look, itemById) {
  const names = ["dress", "top", "head", "hand"].map((slot) => look.outfit?.[slot] && itemById(look.outfit[slot].id)?.name).filter(Boolean);
  return names.slice(0, 2).join(" & ") || "a little look";
}
