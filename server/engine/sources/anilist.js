// AniList GraphQL (free for non-commercial use; currently limited to 30 requests a minute).
import { fetchWithTimeout } from "../../lib/http.js";

const QUERY = `
query ($ids: [Int]) {
  Page(perPage: 10) {
    media(id_in: $ids, type: ANIME) {
      id
      title { english romaji }
      status
      format
      startDate { year month day }
      episodes
      nextAiringEpisode { episode airingAt }
      coverImage { large color }
      siteUrl
    }
  }
}`;

export const APOTHECARY_IDS = { season3: 195516, season3Part2: 200927, film: 200929 };

export async function fetchApothecaryStatus() {
  const response = await fetchWithTimeout("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { ids: Object.values(APOTHECARY_IDS) } }),
  });
  const json = await response.json();
  const media = json.data?.Page?.media ?? [];
  return media.map((m) => ({
    id: m.id,
    title: m.title.english ?? m.title.romaji,
    status: m.status,
    format: m.format,
    startDate: m.startDate,
    episodes: m.episodes,
    nextEpisode: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt * 1000 } : null,
    cover: m.coverImage?.large ?? null,
    color: m.coverImage?.color ?? null,
    url: m.siteUrl,
  }));
}
