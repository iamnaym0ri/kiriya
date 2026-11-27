// What kind of thing each saved artwork is, from the title the game saved it with (artworks have no
// kind column, and the server stays as it is). The games save with these titles:
//   kaleidoscope  "a little kaleidoscope" (any title with "kaleidoscope")
//   paper doll    "paper doll · <look name>"
//   bouquet       "bouquet · <name>"
// Anything else is a doodle (the sketchbook's pages, and pictures she added herself).
export const KINDS = [
  { id: "doodle", name: "doodles", one: "doodle" },
  { id: "kaleidoscope", name: "kaleidoscopes", one: "kaleidoscope" },
  { id: "doll", name: "paper dolls", one: "paper doll" },
  { id: "bouquet", name: "bouquets", one: "bouquet" },
];

export function artKind(art) {
  const title = String(art?.prompt ?? "").trim().toLowerCase();
  if (title.includes("kaleidoscope")) return "kaleidoscope";
  if (title.startsWith("paper doll")) return "doll";
  if (title.startsWith("bouquet")) return "bouquet";
  return "doodle";
}

/** The kinds she actually has, in KINDS order, with counts. */
export function kindsIn(artworks) {
  const counts = new Map();
  for (const art of artworks) counts.set(artKind(art), (counts.get(artKind(art)) ?? 0) + 1);
  return KINDS.filter((kind) => counts.has(kind.id)).map((kind) => ({ ...kind, count: counts.get(kind.id) }));
}

/** A friendly title for a tile or the viewer: the saved title without its "kind · " prefix. */
export function artTitle(art) {
  const title = String(art?.prompt ?? "").trim();
  if (!title) return "a little untitled thing";
  const parts = title.split(" · ");
  return parts.length > 1 && /^(paper doll|bouquet)$/i.test(parts[0]) ? parts.slice(1).join(" · ") || title : title;
}

/** Artworks grouped by month, newest first: [{ key: "2026-11", label: "november 2026", artworks }]. */
export function groupByMonth(artworks, timeZone = "Asia/Singapore") {
  const label = new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone });
  const keyOf = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone });
  const groups = new Map();
  for (const art of artworks) {
    const date = art?.createdAt ? new Date(art.createdAt) : null;
    const valid = date && !Number.isNaN(date.getTime());
    const key = valid ? keyOf.format(date).slice(0, 7) : "undated";
    if (!groups.has(key)) groups.set(key, { key, label: valid ? label.format(date).toLowerCase() : "a little while ago", artworks: [] });
    groups.get(key).artworks.push(art);
  }
  return [...groups.values()];
}
