// English music news feeds, keyword-filtered for Miku, Vocaloid and Project SEKAI.
//
// Basis, checked live 2026-09-15 from a home WSL machine (not Vercel):
// - ANN press releases: https://www.animenewsnetwork.com/press-release/rss.xml?ann-edition=w returned
//   200 application/rss+xml, 40 items covering 11 days, 2 of them Miku. robots.txt does not disallow it
//   (Crawl-delay: 2). https://www.animenewsnetwork.com/copyright-policy: "1) Link to the source, 2) use
//   your own words 3) Don't rely on one single source and 4) Have some original content". Items keep the
//   feed's short description as an excerpt for grounding; the writer rewrites, never republishes.
// - Siliconera tag feed https://www.siliconera.com/tag/hatsune-miku/feed/ returned 200, but its
//   robots.txt returned a Cloudflare "Attention Required!" challenge (403), so robots permission cannot
//   be confirmed and cloud IPs are likely challenged: restricted and disabled.
import { FeedError } from "../config.js";
import { clip, feedEntries } from "./util.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, VOICEBANKS, canonicalFandoms, mentions } from "./tags.js";

export const ANN_PRESS_FEED = "https://www.animenewsnetwork.com/press-release/rss.xml?ann-edition=w";
export const SILICONERA_MIKU_FEED = "https://www.siliconera.com/tag/hatsune-miku/feed/";
const DAY_MS = 86_400_000;
export const MUSIC_NEWS_WINDOW_MS = 21 * DAY_MS;
/** Strong terms only; bare "kaito"/"meiko"/"gumi"/"luka" also name unrelated characters. */
export const MUSIC_KEYWORDS =
  /hatsune miku|\bmiku\b|vocaloid|project sekai|colorful stage|crypton future media|magical mirai|miku expo|kagamine (?:rin|len)|megurine luka|kasane teto|piapro|snow miku|初音ミク|ボーカロイド|プロセカ/i;
const VOICEBANK_TEXT = Object.fromEntries(VOICEBANKS.map((v) => [v, CHARACTER_ALIASES[v] ?? []]));
const MUSIC_FANDOMS = { vocaloid: FANDOM_ALIASES.vocaloid, "project sekai": FANDOM_ALIASES["project sekai"] };
const unique = (values) => [...new Set(values.filter(Boolean))];

function newsFetcher(source, { feed, credit, keywordFilter }) {
  return async (ctx) => {
    const limit = Math.max(0, Math.min(8, ctx.limits.items));
    const now = Date.now();
    const { doc } = await ctx.http.xml(feed);
    if (!doc?.rss?.channel) throw new FeedError("invalid_source_xml");
    const items = feedEntries(doc)
      .filter((e) => e.link && e.title)
      .filter((e) => {
        const at = Date.parse(e.published ?? "");
        return Number.isFinite(at) && at <= now + 3600_000 && now - at <= MUSIC_NEWS_WINDOW_MS;
      })
      .filter((e) => !keywordFilter || MUSIC_KEYWORDS.test(`${e.title} ${e.summary}`))
      .slice(0, limit)
      .map((e) => {
        const text = `${e.title} ${e.summary}`;
        const excerpt = clip(e.summary.replace(/\s+/g, " ").trim(), 600);
        return {
          source,
          nativeId: e.id,
          sections: ["music"],
          kind: "news",
          title: clip(e.title, 200),
          url: e.link,
          credit,
          tags: {
            characters: [],
            fandoms: canonicalFandoms(unique(["vocaloid", ...mentions(text, MUSIC_FANDOMS)])),
            voicebanks: mentions(text, VOICEBANK_TEXT),
            producers: [],
            units: [],
            formats: [],
            topics: [],
          },
          facts: {
            excerpts: excerpt ? [excerpt] : [],
            names: e.author ? [clip(e.author, 100)] : [],
            links: [{ kind: "source", label: credit.platform, url: e.link }],
            lang: "en",
          },
          safety: { rating: "unknown", sourceTags: unique(e.categories.map((c) => clip(c, 100))).slice(0, 20) },
          publishedAt: e.published,
        };
      });
    return { items, cursor: null, done: true };
  };
}

const NEWS_POLICY = {
  stage: "fetch-a",
  sections: ["music"],
  mediaHosts: [],
  requiredCredentials: [],
  maxRequests: 3,
  maxBytes: 512 * 1024,
  timeoutMs: 12000,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
};

export const annPressVocaloid = {
  ...NEWS_POLICY,
  id: "ann-press-vocaloid",
  status: "enabled",
  enabled: true,
  hosts: ["www.animenewsnetwork.com"],
  linkHosts: ["www.animenewsnetwork.com"],
  // robots.txt Crawl-delay: 2
  paceMs: 2000,
  // The feed is served with Cache-Control: max-age=14400.
  cacheSeconds: 14400,
  termsUrl: "https://www.animenewsnetwork.com/copyright-policy",
  docsUrl: ANN_PRESS_FEED,
  notes:
    "ANN press-release RSS (worldwide edition), one request a day, kept only when the title or description names Miku, " +
    "Vocaloid, Project SEKAI, Crypton, Magical Mirai, MIKU EXPO, Kagamine Rin/Len, Megurine Luka, Kasane Teto or piapro. " +
    "Last 21 days. Link-only; summarize in own words.",
  fetch: newsFetcher("ann-press-vocaloid", {
    feed: ANN_PRESS_FEED,
    credit: {
      name: "Anime News Network",
      handle: "",
      profileUrl: null,
      platform: "ANN press release",
      license: "Press release via Anime News Network; link and summarize, do not republish",
    },
    keywordFilter: true,
  }),
};

export const siliconeraMiku = {
  ...NEWS_POLICY,
  id: "siliconera-miku",
  status: "restricted",
  enabled: false,
  hosts: ["www.siliconera.com"],
  linkHosts: ["www.siliconera.com"],
  paceMs: 2000,
  cacheSeconds: 86400,
  termsUrl: null,
  docsUrl: SILICONERA_MIKU_FEED,
  notes:
    "Disabled: https://www.siliconera.com/robots.txt answered a Cloudflare challenge (403) on 2026-09-15 14:58 UTC, so the " +
    "feed's robots status is unknown and cloud IPs are likely challenged. The tag feed itself returned 200 from home. " +
    "Re-check robots.txt and a Vercel preview request before enabling.",
  fetch: newsFetcher("siliconera-miku", {
    feed: SILICONERA_MIKU_FEED,
    credit: {
      name: "Siliconera",
      handle: "",
      profileUrl: null,
      platform: "Siliconera",
      license: "Article by Siliconera; link and summarize, do not republish",
    },
    keywordFilter: false,
  }),
};
