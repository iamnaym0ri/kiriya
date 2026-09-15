// AniList GraphQL (POST https://graphql.anilist.co): Apothecary Diaries airing schedule and release dates.
//
// Verified live 2026-09-15T14:44Z from a home WSL machine (not Vercel):
// - 195516 "The Apothecary Diaries Season 3" (TV, NOT_YET_RELEASED, start 2026-10-02, 12 weekly airing
//   nodes from episode 1 at 2026-10-02T14:00Z); 200927 "Kusuriya no Hitorigoto 3rd Season Part 2" (TV,
//   start 2027-04, no day, no schedule); 200929 "Kusuriya no Hitorigoto: Bouhi no Hihou" (MOVIE, start
//   2026-12-11; its single airing node is AniList's 00:00 JST placeholder, not a showtime). Relations
//   confirm 176301 (S2) → 195516 → 200927, with 200929 as OTHER.
// - docs.anilist.co terms: free for non-commercial use; no use as a backup/data store; no hoarding or mass
//   collection. The rate-limiting page says the API is degraded to 30 requests/minute (x-ratelimit-limit: 30
//   observed). The terms say nothing about displaying cover images, which are the rights holders' key art,
//   so no media is used.
// Dates are never hardcoded: every build fetches the current schedule.
import { FeedError } from "../config.js";
import { clip, toIso } from "./util.js";

const ENDPOINT = "https://graphql.anilist.co";
export const APOTHECARY_MEDIA = { season3: 195516, season3Part2: 200927, film: 200929 };
export const ANILIST_VERIFIED_AT = "2026-09-15T14:44:49Z";
const DAY = 86_400_000;
export const RECENT_WINDOW_MS = 7 * DAY;
export const UPCOMING_WINDOW_MS = 8 * DAY;

export const ANILIST_QUERY = `query ($ids: [Int]) {
  Page(perPage: 10) {
    media(id_in: $ids, type: ANIME) {
      id idMal title { romaji english native } format status(version: 2) episodes isAdult siteUrl
      startDate { year month day } season seasonYear
      nextAiringEpisode { episode airingAt }
      airingSchedule(perPage: 30) { nodes { episode airingAt } }
    }
  }
}`;

const SEASON_MONTH = { WINTER: 1, SPRING: 4, SUMMER: 7, FALL: 10 };
const pad = (n) => String(n).padStart(2, "0");

function mediaUrl(media) {
  try {
    const url = new URL(media.siteUrl);
    if (url.protocol === "https:" && url.hostname === "anilist.co" && url.pathname === `/anime/${media.id}`) return url.href;
  } catch {
    // fall through to the canonical form
  }
  return `https://anilist.co/anime/${media.id}`;
}

/** AniList fuzzy dates are Japanese release dates: {releaseAt (JST), releasePrecision, label}. */
export function releaseDate(media) {
  const { year, month, day } = media.startDate ?? {};
  if (!Number.isInteger(year)) return null;
  if (Number.isInteger(month) && Number.isInteger(day))
    return { releaseAt: `${year}-${pad(month)}-${pad(day)}T00:00:00+09:00`, releasePrecision: "day", label: `${year}-${pad(month)}-${pad(day)}` };
  if (Number.isInteger(month))
    return { releaseAt: `${year}-${pad(month)}-01T00:00:00+09:00`, releasePrecision: "month", label: `${year}-${pad(month)}` };
  if (SEASON_MONTH[media.season] && media.seasonYear === year)
    return { releaseAt: `${year}-${pad(SEASON_MONTH[media.season])}-01T00:00:00+09:00`, releasePrecision: "season", label: `${media.season} ${year}` };
  return { releaseAt: `${year}-01-01T00:00:00+09:00`, releasePrecision: "year", label: String(year) };
}

const names = (media) =>
  [...new Set([media.title?.english, media.title?.romaji, media.title?.native].filter((t) => typeof t === "string" && t.trim()))].map((t) =>
    clip(t, 100),
  );
const displayTitle = (media) => media.title?.english || media.title?.romaji || media.title?.native || `AniList ${media.id}`;
const base = {
  source: "anilist-apothecary",
  sections: ["maomao"],
  kind: "news",
  credit: { name: "AniList", platform: "AniList", license: "AniList API data, non-commercial use" },
  tags: { fandoms: ["the apothecary diaries"] },
  safety: { rating: "unknown" },
};

export function episodeItem(media, episode, airingAt) {
  const at = new Date(airingAt * 1000);
  return {
    ...base,
    nativeId: `${media.id}:episode:${episode}`,
    title: clip(`${displayTitle(media)} · episode ${episode}`, 200),
    // One AniList page per media; the query keeps episode items distinct because canonical URLs drop
    // fragments and a shared URL would merge every episode into one identity.
    url: `${mediaUrl(media)}?episode=${episode}`,
    facts: {
      names: names(media),
      dates: [at.toISOString()],
      episode,
      airingAt: at.toISOString(),
      datePrecision: "datetime",
    },
    expiresAt: new Date(at.getTime() + RECENT_WINDOW_MS).toISOString(),
  };
}

export function statusItem(media) {
  const date = releaseDate(media);
  if (!date) return null;
  return {
    ...base,
    nativeId: `${media.id}:release`,
    title: clip(`${displayTitle(media)} · ${media.format === "MOVIE" ? "release date" : "start date"} ${date.label}`, 200),
    url: mediaUrl(media),
    facts: {
      names: names(media),
      dates: [date.label],
      releaseAt: date.releaseAt,
      releasePrecision: date.releasePrecision,
    },
  };
}

/** Items for one media relative to `now`: nearby episodes for series, a release-date note otherwise. */
export function mediaItems(media, now) {
  if (!media || media.isAdult || !Number.isInteger(media.id)) return [];
  const episodes = [];
  if (media.format !== "MOVIE") {
    const nodes = new Map();
    for (const node of media.airingSchedule?.nodes ?? [])
      if (Number.isInteger(node?.episode) && Number.isInteger(node?.airingAt)) nodes.set(node.episode, node.airingAt);
    const next = media.nextAiringEpisode;
    if (Number.isInteger(next?.episode) && Number.isInteger(next?.airingAt)) nodes.set(next.episode, next.airingAt);
    for (const [episode, airingAt] of nodes) {
      const delta = airingAt * 1000 - now;
      if ((delta >= -RECENT_WINDOW_MS && delta <= UPCOMING_WINDOW_MS) || episode === next?.episode)
        episodes.push(episodeItem(media, episode, airingAt));
    }
    episodes.sort((a, b) => Date.parse(a.facts.airingAt) - Date.parse(b.facts.airingAt));
  }
  if (episodes.length) return episodes;
  if (media.status === "NOT_YET_RELEASED" || media.format === "MOVIE") {
    const item = statusItem(media);
    return item ? [item] : [];
  }
  return [];
}

export async function fetchAniList(ctx) {
  const body = await ctx.http.json(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { ids: Object.values(APOTHECARY_MEDIA) } }),
  });
  if (Array.isArray(body?.errors) && body.errors.length) {
    const status = Number(body.errors[0]?.status);
    if (status === 429) throw new FeedError("rate_limited", 429);
    if (status === 403 || status === 401) throw new FeedError("blocked", 403);
    if (status === 404) throw new FeedError("not_found", 404);
    throw new FeedError("source_unavailable", 503);
  }
  const list = body?.data?.Page?.media;
  if (!Array.isArray(list)) throw new FeedError("source_shape", 503);
  // A missing Season 3 entry means the IDs changed; don't publish a partial "nothing scheduled" view.
  if (!list.some((m) => m?.id === APOTHECARY_MEDIA.season3)) throw new FeedError("not_found", 404);
  const reference = Date.parse(`${ctx.day}T00:00:00+08:00`);
  const now = Number.isFinite(reference) ? reference : Date.now();
  const order = Object.values(APOTHECARY_MEDIA);
  const items = [...list]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .flatMap((media) => mediaItems(media, now))
    .slice(0, Math.min(8, ctx.limits.items));
  return { items, cursor: null, done: true };
}

export const anilistApothecary = {
  id: "anilist-apothecary",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["maomao"],
  hosts: ["graphql.anilist.co", "anilist.co"],
  mediaHosts: [],
  linkHosts: [],
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: [],
  maxRequests: 2,
  maxBytes: 256 * 1024,
  paceMs: 2100,
  timeoutMs: 15000,
  cacheSeconds: 3600,
  attributionRequired: true,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  copyPermission: null,
  deletionPolicy: "none",
  deletionDeadlineHours: null,
  termsUrl: "https://docs.anilist.co/guide/terms-of-use",
  docsUrl: "https://docs.anilist.co/guide/rate-limiting",
  notes:
    "One POST per build for Season 3 (195516), Season 3 Part 2 (200927) and the film (200929); IDs and relations re-verified 2026-09-15. Episode items for the next airing episode plus any airing within 7 days before / 8 days after the build day (airingAt ISO, datePrecision datetime; expires 7 days after airing). Release-date items for unreleased media and the film use AniList's fuzzy start date with day/month/season/year precision (JST). No cover images: the API terms don't address image display and the art belongs to the rights holders. Rate limit currently 30 requests/minute; one request per build. Non-commercial use only.",
  fetch: fetchAniList,
};
