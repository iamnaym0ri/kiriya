// Pure presentation shared by the feed UI and compatibility API routes.
export const DISCOVERY_SECTIONS = Object.freeze({ maomao: "maomao", vocaloid: "music", cosplay: "dressup" });
const NOTE_KINDS = new Set(["lore", "news", "note", "event", "tutorial", "spot", "creator", "look"]);

export function discoveryEntries(entries) {
  const notes = entries.flatMap((entry) => [entry.primary, ...(entry.companions ?? [])]
    .filter((item) => NOTE_KINDS.has(item.kind) && item.blurb?.text)
    .map((primary) => ({ ...entry, key: primary.id, primary, companions: [], ids: [primary.id] })));
  return notes.filter((entry, index) => notes.findIndex((other) => other.primary.id === entry.primary.id) === index);
}

export function publishedEntries(feed) {
  if (!feed?.revision) return [];
  const entries = [...(feed.slots ?? []), ...(feed.reserve ?? []), ...(feed.seenEarlier ?? [])];
  return entries.filter((entry, index) => entries.findIndex((other) => other.primary.id === entry.primary.id) === index);
}

/** Only a published item's recorded YouTube media can become a feed song. */
export function youtubeSong(item) {
  const media = item.media?.find((entry) => entry.type === "youtube");
  if (!media) return null;
  let id;
  try {
    const url = new URL(media.url);
    id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop();
  } catch { return null; }
  if (!/^[\w-]{11}$/.test(id ?? "")) return null;
  return {
    provider: "youtube", embedId: id, url: `https://www.youtube.com/watch?v=${id}`,
    title: item.title, artist: item.credit?.name ?? "",
    thumbnail: media.poster ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
