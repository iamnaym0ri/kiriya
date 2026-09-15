import { feedConfig, FeedError, SECTIONS } from "../config.js";

// Controlled synthetic data, no remote calls and no real people's posts. Never registered when hosted.
export async function fetchFixtures(ctx) {
  if (!feedConfig().fixtureMode) throw new FeedError("fixtures_disabled", 403);
  const all = SECTIONS.flatMap((section, s) =>
    Array.from({ length: 5 }, (_, i) => ({
      source: "fixture",
      nativeId: `${section}-${i}`,
      sections:
        section === "maomao" && i === 0 ? ["maomao", "dressup"] : [section],
      kind: "lore",
      title: `fixture ${section} note ${i + 1}`,
      url: `https://fixtures.kiriya.invalid/${section}/${i}`,
      credit: {
        name: "foundation fixture",
        platform: "local test",
        license: "synthetic test content",
      },
      tags: {
        characters:
          section === "maomao"
            ? ["maomao"]
            : section === "music"
              ? ["hatsune miku"]
              : [],
        fandoms: [section === "music" ? "vocaloid" : "the apothecary diaries"],
        producers: section === "music" ? [`fixture producer ${i}`] : [],
      },
      facts: {
        excerpts: [`a controlled ${section} note for testing`],
        names: ["foundation fixture"],
      },
      safety: { rating: "g", sourceTags: i === 4 ? ["ai-generated"] : [] },
      publishedAt: `${ctx.day}T00:00:00+08:00`,
    })),
  );
  const offset = Number(ctx.cursor ?? 0),
    size = Math.min(ctx.limits.items, 8);
  return {
    items: all.slice(offset, offset + size),
    cursor: offset + size < all.length ? offset + size : null,
    done: offset + size >= all.length,
  };
}
