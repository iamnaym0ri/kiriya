// Presentation of published feed entries, including older editions and their reserves.
const tags = (item, key) => (item?.tags?.[key] ?? []).map((tag) => tag.toLowerCase());
export const isMaomao = (item) => tags(item, "characters").includes("maomao");
export const isMiku = (item) => tags(item, "characters").includes("hatsune miku");
export const isApothecary = (item) => isMaomao(item) || tags(item, "fandoms").some((tag) => /apothecary diaries|kusuriya/.test(tag));
export const isCosplay = (entry) => entry.primary?.kind === "cosplay" && entry.primary.media?.length > 0;

export function selectCosplayPicks(entries) {
  const pool = entries.filter(isCosplay);
  const first = pool.find((entry) => isMaomao(entry.primary));
  const third = pool.find((entry) => isMiku(entry.primary) && entry.primary.id !== first?.primary.id);
  const remaining = pool.filter((entry) => ![first?.primary.id, third?.primary.id].includes(entry.primary.id) && !isMiku(entry.primary));
  const second = remaining.find((entry) => isMaomao(entry.primary))
    ?? remaining.find((entry) => isApothecary(entry.primary))
    ?? remaining[0];
  return [first ?? null, second ?? null, third ?? null];
}

export function cosplayCollection(item) {
  return isApothecary(item) ? "apothecary" : isMiku(item) ? "miku" : "all";
}

export function filterCosplays(entries, collection = "all", selectedId) {
  return entries.filter(isCosplay).filter((entry) => entry.primary.id === selectedId
    || collection === "all"
    || (collection === "apothecary" && isApothecary(entry.primary))
    || (collection === "miku" && isMiku(entry.primary)))
    .sort((a, b) => Number(b.primary.id === selectedId) - Number(a.primary.id === selectedId));
}
