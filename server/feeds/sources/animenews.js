// Anime news RSS for the Maomao club, music and dress-up: Anime News Network (Southeast Asia edition),
// Crunchyroll News, Anime Corner and (disabled) MyAnimeList news.
//
// Verified live 2026-09-15T14:45Z from a home WSL machine (not Vercel):
// - ANN SEA `all/rss.xml?ann-edition=sea`: 200 application/rss+xml, 211 items over 7 days, short teasers,
//   no thumbnails. ANN's copyright policy allows quoting an excerpt with credit and a link when the rest is
//   in your own words, you don't rely on one source and add original content.
// - Crunchyroll `cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss`: 200 application/xml, 50 items
//   over ~3 days, © Crunchyroll, LLC, SmartNews syndication namespace, one-line deks plus full article
//   bodies (bodies are ignored). The ToS page at www.crunchyroll.com/tos only renders through a Cloudflare
//   challenge script, so its terms could not be read: optional.
// - Anime Corner `animecorner.me/feed/`: 200 application/rss+xml, 25 items over ~3 days. robots.txt allows
//   everything; no terms page exists (/terms*, /dmca, /copyright are 404; the sitemap lists privacy and
//   editorial policies only).
// - MyAnimeList `rss/news.xml`: 200 application/xml, 20 items over 5 days, but its Terms of Use (last updated
//   2025-12-16) say "you agree not to collate or aggregate any of the content available through the
//   Service for use elsewhere", so it stays disabled.
// Every item is a headline + the feed's own verbatim summary + a link; articles are never republished and
// no thumbnails are shown (none is offered with a clear display permission).
import { FeedError } from "../config.js";
import { canonicalVoicebanks, CHARACTER_ALIASES, FANDOM_ALIASES, mentions } from "./tags.js";
import { clip, cursor as cursorCodec, feedEntries } from "./util.js";

export const NEWS_VERIFIED_AT = "2026-09-15T14:45:45Z";
export const NEWS_MAX_AGE_MS = 7 * 86_400_000;
export const NEWS_ROUTES = [
  ["maomao", /apothecary|kusuriya|maomao|薬屋/i],
  ["music", /hatsune miku|vocaloid|project sekai|magical mirai|miku expo|kagamine|crypton/i],
  ["dressup", /cosplay/i],
];
const APOTHECARY_CHARACTERS = ["maomao", "jinshi", "pairin", "meimei", "joka", "xiaolan", "gaoshun", "lakan", "luomen", "gyokuyou"];
const TRACKING = /^(?:_location|utm_\w+|fbclid|gclid|ref|cmpid)$/i;

/** Sections an article belongs to, from its headline and summary only (bodies cause false matches). */
export function routesFor(text) {
  return NEWS_ROUTES.filter(([, pattern]) => pattern.test(text)).map(([section]) => section);
}

function articleUrl(value, hosts) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.includes(url.hostname.toLowerCase()))
    return null;
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.href;
}

/** A news item for one parsed feed entry and its routed sections. Exported for per-outlet tests. */
export function articleItem(outlet, entry, sections) {
  const url = articleUrl(entry.link, outlet.hosts);
  const title = clip(entry.title, 200);
  if (!url || !title || !sections.length) return null;
  const text = `${entry.title} ${entry.summary}`;
  const fandoms = mentions(text, FANDOM_ALIASES);
  if (sections.includes("maomao") && !fandoms.includes("the apothecary diaries")) fandoms.push("the apothecary diaries");
  const found = mentions(text, CHARACTER_ALIASES);
  const voicebanks = sections.includes("music") ? canonicalVoicebanks(found) : [];
  const characters = [
    ...(sections.includes("maomao") ? found.filter((c) => APOTHECARY_CHARACTERS.includes(c)) : []),
    ...voicebanks,
  ];
  const summary = entry.summary && entry.summary !== entry.title ? clip(entry.summary, 600) : "";
  return {
    source: outlet.id,
    nativeId: clip(entry.id || url, 1000),
    sections,
    kind: "news",
    title,
    url,
    credit: { name: outlet.name, platform: outlet.platform, profileUrl: outlet.home },
    tags: { characters, fandoms, voicebanks },
    facts: {
      excerpts: summary ? [summary] : [],
      names: entry.author ? [clip(entry.author, 100)] : [],
    },
    safety: { rating: "unknown", sourceTags: entry.categories.filter((c) => c.length <= 100).slice(0, 40) },
    publishedAt: entry.published,
  };
}

const order = (a, b) => (b.time - a.time) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

function newsFetcher(outlet) {
  return async function fetchNews(ctx) {
    const { doc } = await ctx.http.xml(outlet.feedUrl);
    if (!doc?.rss?.channel && !doc?.feed && !doc?.["rdf:RDF"]) throw new FeedError("source_shape", 503);
    const reference = Date.parse(`${ctx.day}T23:59:59+08:00`);
    const now = Number.isFinite(reference) ? reference : Date.now();
    const candidates = [];
    const keys = new Set();
    for (const entry of feedEntries(doc)) {
      const time = entry.published ? Date.parse(entry.published) : NaN;
      if (Number.isFinite(time) && now - time > NEWS_MAX_AGE_MS) continue;
      const item = articleItem(outlet, entry, routesFor(`${entry.title} ${entry.summary}`));
      if (!item || keys.has(item.nativeId)) continue;
      keys.add(item.nativeId);
      candidates.push({ time: Number.isFinite(time) ? time : 0, key: item.nativeId, item });
    }
    candidates.sort(order);
    const state = cursorCodec.decode(ctx.cursor, {});
    const after = Number.isFinite(state.t) && typeof state.k === "string" ? { time: state.t, key: state.k } : null;
    const remaining = after ? candidates.filter((c) => order(after, c) < 0) : candidates;
    const page = remaining.slice(0, Math.min(8, ctx.limits.items));
    if (page.length === remaining.length) return { items: page.map((c) => c.item), cursor: null, done: true };
    const last = page.at(-1);
    return { items: page.map((c) => c.item), cursor: cursorCodec.encode({ t: last.time, k: last.key }), done: false };
  };
}

function newsEntry(outlet) {
  return {
    id: outlet.id,
    stage: "fetch-a",
    status: outlet.status,
    enabled: outlet.enabled,
    sections: ["maomao", "music", "dressup"],
    hosts: outlet.hosts,
    mediaHosts: [],
    linkHosts: [],
    profileHosts: [],
    requiredCredentials: [],
    optionalCredentials: [],
    maxRequests: 3,
    maxBytes: 1024 * 1024,
    paceMs: 1000,
    timeoutMs: 15000,
    cacheSeconds: outlet.cacheSeconds,
    attributionRequired: true,
    mediaPolicy: "link_only",
    copyPolicy: "link_only",
    copyPermission: null,
    deletionPolicy: "none",
    deletionDeadlineHours: null,
    termsUrl: outlet.termsUrl,
    docsUrl: outlet.feedUrl,
    notes: outlet.notes,
    fetch: newsFetcher(outlet),
  };
}

const ROUTING_NOTE =
  "Routes by headline+summary: maomao = apothecary|kusuriya|maomao|薬屋; music = hatsune miku|vocaloid|project sekai|magical mirai|miku expo|kagamine|crypton; dressup = cosplay. Unrouted items and items older than 7 days are skipped. Excerpt = the feed's own summary, HTML stripped, ≤600 chars; link only; no thumbnails.";

export const newsAnn = newsEntry({
  id: "news-ann",
  name: "Anime News Network",
  platform: "Anime News Network (Southeast Asia edition)",
  home: "https://www.animenewsnetwork.com/",
  feedUrl: "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=sea",
  hosts: ["www.animenewsnetwork.com"],
  status: "enabled",
  enabled: true,
  cacheSeconds: 14400, // Cache-Control: public, max-age=14400 on the feed
  termsUrl: "https://www.animenewsnetwork.com/copyright-policy",
  notes: `ANN SEA edition RSS (211 items/7 days, 1 Apothecary Diaries match on 2026-09-15). Copyright policy: credit + link, quote an excerpt, own words. ${ROUTING_NOTE}`,
});
export const newsCrunchyroll = newsEntry({
  id: "news-crunchyroll",
  name: "Crunchyroll News",
  platform: "Crunchyroll News RSS",
  home: "https://www.crunchyroll.com/news",
  feedUrl: "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss",
  hosts: ["cr-news-api-service.prd.crunchyrollsvc.com", "crunchyroll.com", "www.crunchyroll.com"],
  status: "optional",
  enabled: true,
  cacheSeconds: 3600,
  termsUrl: "https://www.crunchyroll.com/tos",
  notes: `Undocumented but Crunchyroll-operated syndication feed (50 items/~3 days). Terms page unreadable without running a Cloudflare challenge script (not bypassed), so the feed is optional. Uses only the one-line dek, never content:encoded; media:thumbnail (a.storyblok.com) is not shown. ${ROUTING_NOTE}`,
});
export const newsAnimeCorner = newsEntry({
  id: "news-animecorner",
  name: "Anime Corner",
  platform: "Anime Corner RSS",
  home: "https://animecorner.me/",
  feedUrl: "https://animecorner.me/feed/",
  hosts: ["animecorner.me"],
  status: "enabled",
  enabled: true,
  cacheSeconds: 3600,
  termsUrl: "https://animecorner.me/robots.txt",
  notes: `WordPress RSS (25 items/~3 days). No terms page exists; robots.txt allows all agents. ${ROUTING_NOTE}`,
});
export const newsMal = newsEntry({
  id: "news-mal",
  name: "MyAnimeList News",
  platform: "MyAnimeList news RSS",
  home: "https://myanimelist.net/news",
  feedUrl: "https://myanimelist.net/rss/news.xml",
  hosts: ["myanimelist.net"],
  status: "restricted",
  enabled: false,
  cacheSeconds: 0, // Cache-Control: no-cache
  termsUrl: "https://myanimelist.net/about/terms_of_use",
  notes: `Disabled: MyAnimeList Terms of Use (last updated 2025-12-16) forbid collating or aggregating Service content for use elsewhere. The feed itself worked (200, 20 items/5 days). ${ROUTING_NOTE}`,
});
