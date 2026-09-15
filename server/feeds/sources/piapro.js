// Crypton Future Media's official Hatsune Miku blog (blog.piapro.net), WordPress RSS.
//
// Basis, checked live 2026-09-15 from a home WSL machine (not Vercel):
// - https://blog.piapro.net/robots.txt disallows only /wp-admin/; feeds are application/rss+xml with
//   ETag/Last-Modified. The blog links no terms of use (footer: "© Crypton Future Media, INC.", privacy
//   policy https://www.crypton.co.jp/cfm/privacy_policy). The piapro.jp crawling ban (user agreement
//   art. 8) covers piapro.jp, which is never requested.
// - Feeds: /feed (latest 10 posts), /category/event/feed, /category/goods/feed, tag feeds such as
//   /tag/event-magical-mirai/feed, /tag/mikuexpo/feed, /tag/snow-miku/feed, /tag/project-sekai/feed.
// - Posts are Japanese; excerpts are the feed's own verbatim text, and stated goods facts are copied as
//   exact strings. Images come only from the post body on blog.piapro.net/wp-content/uploads (the same
//   images the post shows), so no extra HTML pages are fetched for og:image.
import { FeedError } from "../config.js";
import { asArray, clip, cursor as pageCursor, decodeEntities, feedEntries } from "./util.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, MERCH_TYPES, UNIT_ALIASES, VOICEBANKS, canonicalFandoms, mentions } from "./tags.js";

const BLOG = "https://blog.piapro.net";
export const PIAPRO_FEEDS = {
  main: `${BLOG}/feed`,
  events: `${BLOG}/category/event/feed`,
  goods: `${BLOG}/category/goods/feed`,
};
export const PIAPRO_TAG_FEEDS = [
  `${BLOG}/tag/event-magical-mirai/feed`,
  `${BLOG}/tag/mikuexpo/feed`,
  `${BLOG}/tag/snow-miku/feed`,
  `${BLOG}/tag/project-sekai/feed`,
];
const DAY_MS = 86_400_000;
export const NEWS_WINDOW_MS = 30 * DAY_MS;
export const GOODS_WINDOW_MS = 45 * DAY_MS;
export const PRICE_TTL_MS = 48 * 3600 * 1000;
const unique = (values) => [...new Set(values.filter(Boolean))];
const VOICEBANK_TEXT = Object.fromEntries(VOICEBANKS.map((v) => [v, CHARACTER_ALIASES[v] ?? []]));
// Master-data codes and common words ("street", "idol", "piapro") are not unit mentions in prose.
const CODE_ALIASES = new Set(["street", "idol", "piapro", "light_sound", "school_refusal", "light music club"]);
const UNIT_TEXT = Object.fromEntries(
  Object.entries(UNIT_ALIASES).map(([unit, aliases]) => [unit, aliases.filter((alias) => !CODE_ALIASES.has(alias))]),
);

const CREDIT = {
  name: "初音ミク公式ブログ (Crypton Future Media)",
  handle: "",
  profileUrl: `${BLOG}/`,
  platform: "piapro blog",
  license: "© Crypton Future Media, INC. Announcement link, short excerpt and stated facts only.",
};

export function piaproNewsPlan(day) {
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
  if (!Number.isFinite(n)) throw new FeedError("invalid_day");
  return [PIAPRO_FEEDS.main, PIAPRO_FEEDS.events, PIAPRO_TAG_FEEDS[n % PIAPRO_TAG_FEEDS.length]];
}

async function readFeed(http, url) {
  const { doc } = await http.xml(url);
  if (!doc?.rss?.channel) throw new FeedError("invalid_source_xml");
  return feedEntries(doc).filter((entry) => entry.link && entry.title);
}

const isGoods = (entry) => entry.categories.some((c) => c.startsWith("グッズ"));
const summaryOf = (entry) =>
  clip(
    entry.summary
      // WordPress auto-excerpts end with "… 続きを読む" plus screen-reader text.
      .replace(/\s*(?:…|\.\.\.)?\s*続きを読む[\s\S]*$/, "")
      .replace(/\s+/g, " ")
      .trim(),
    600,
  );

function baseTags(entry) {
  // NFKC turns full-width punctuation such as "MORE MORE JUMP！" into the ASCII aliases.
  const text = `${entry.title} ${entry.summary}`.normalize("NFKC");
  const sekai = entry.categories.includes("プロジェクトセカイ");
  return {
    characters: [],
    fandoms: canonicalFandoms(unique(["vocaloid", sekai ? "project sekai" : null, ...mentions(text, FANDOM_ALIASES)])),
    voicebanks: mentions(text, VOICEBANK_TEXT),
    producers: [],
    units: mentions(text, UNIT_TEXT),
    formats: [],
    topics: [],
  };
}
const postKey = (id) => String(id ?? "").match(/[?&]p=(\d+)/)?.[1] ?? clip(String(id ?? ""), 60);

function withinWindow(entry, now, windowMs) {
  const at = Date.parse(entry.published ?? "");
  return Number.isFinite(at) && at <= now + 3600_000 && now - at <= windowMs;
}

// ---------------------------------------------------------------------------------------------
// piapro-news
// ---------------------------------------------------------------------------------------------

async function fetchPiaproNews(ctx) {
  const plan = piaproNewsPlan(ctx.day);
  const state = pageCursor.decode(ctx.cursor, {});
  const index = state.d === ctx.day && Number.isInteger(state.i) && state.i >= 0 ? state.i : 0;
  if (index >= plan.length) return { items: [], cursor: null, done: true };
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();
  // Posts already emitted from an earlier feed in this run (a post can be in several feeds).
  const emitted = state.d === ctx.day && Array.isArray(state.s) ? state.s.map(String) : [];
  const entries = await readFeed(ctx.http, plan[index]);
  const items = entries
    // Goods announcements belong to piapro-goods.
    .filter((entry) => !isGoods(entry) && withinWindow(entry, now, NEWS_WINDOW_MS) && !emitted.includes(postKey(entry.id)))
    .slice(0, limit)
    .map((entry) => {
      const excerpt = summaryOf(entry);
      return {
        source: piaproNews.id,
        nativeId: entry.id,
        sections: ["music"],
        kind: "news",
        title: clip(entry.title, 200),
        url: entry.link,
        credit: CREDIT,
        tags: baseTags(entry),
        facts: {
          excerpts: excerpt ? [excerpt] : [],
          links: [{ kind: "official", label: "piapro blog", url: entry.link }],
          lang: "ja",
        },
        safety: { rating: "unknown", sourceTags: unique(entry.categories.map((c) => clip(c, 100))).slice(0, 20) },
        publishedAt: entry.published,
      };
    });
  const next = index + 1;
  const seen = [...emitted, ...items.map((item) => postKey(item.nativeId))].slice(-30);
  return next >= plan.length
    ? { items, cursor: null, done: true }
    : { items, cursor: pageCursor.encode({ v: 1, d: ctx.day, i: next, s: seen }), done: false };
}

// ---------------------------------------------------------------------------------------------
// piapro-goods
// ---------------------------------------------------------------------------------------------

/** Plain-text lines of a post body, keeping the post's own line structure. */
export function htmlLines(html) {
  return decodeEntities(
    String(html ?? "")
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|tr|table|ul|ol|dl|dt|dd|blockquote|figure|figcaption)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t 　]+/g, " ").trim())
    .filter(Boolean);
}

const NAME_KEYS = /^(?:商品名|製品名|品名|アイテム名)$/;
const PRICE_KEYS = /^(?:価格|販売価格|税込価格|参考価格|定価)$/;
const PERIOD_KEYS = /^(?:予約受付期間|予約期間|受注期間|受付期間|予約締切|予約締切日|予約受付締切)$/;
const DATE_KEYS = /^(?:予約開始|予約開始日|発売日|発売時期|発売予定|発売予定日|お届け予定|お届け予定日|お届け時期|発送時期|発送予定|販売期間|販売開始|販売開始日|予約受付期間|予約期間|受注期間|受付期間|予約締切|予約締切日|予約受付締切)$/;
const FIELD = /^[・◆■●▼◇□※\-\s]*([^\s：:【】]{2,8})\s*[：:]\s*(.+)$/;
const HEADER = /^【\s*([^】]{2,10})\s*】$/;
const LOOKS_DATE = /\d{4}年\s*\d{1,2}月|\d{1,2}月\s*\d{1,2}日|\d{4}\/\d{1,2}\/\d{1,2}|上旬|中旬|下旬/;
const LOOKS_PRICE = /[\d,]+\s*円|[¥￥]\s*[\d,]+/;

/** Goods facts stated by the post, as exact source strings (values over 100 characters are skipped). */
export function goodsFacts(title, html) {
  const names = [];
  const prices = [];
  const dates = [];
  const periods = [];
  const exact = (value) => {
    const text = String(value ?? "").trim();
    return text && text.length <= 100 ? text : null;
  };
  const lines = htmlLines(html);
  for (let i = 0; i < lines.length; i++) {
    const field = lines[i].match(FIELD);
    if (field) {
      const [, key, raw] = field;
      const value = exact(raw);
      if (!value) continue;
      if (NAME_KEYS.test(key)) names.push(value);
      else if (PRICE_KEYS.test(key) && LOOKS_PRICE.test(value)) prices.push(value);
      else if (DATE_KEYS.test(key) && LOOKS_DATE.test(value)) {
        dates.push(value);
        if (PERIOD_KEYS.test(key)) periods.push(value);
      }
      continue;
    }
    const header = lines[i].match(HEADER);
    if (!header) continue;
    const key = header[1];
    for (let j = i + 1; j < Math.min(lines.length, i + 6) && !HEADER.test(lines[j]); j++) {
      const value = exact(lines[j]);
      if (!value) continue;
      if (PRICE_KEYS.test(key) && LOOKS_PRICE.test(value)) prices.push(value);
      if (DATE_KEYS.test(key) && LOOKS_DATE.test(value)) {
        dates.push(value);
        if (PERIOD_KEYS.test(key)) periods.push(value);
      }
    }
  }
  // Product and song names quoted in the title, e.g. 「ねんどろいど 初音ミク V6」.
  for (const m of String(title ?? "").matchAll(/「([^」]{1,100})」/g)) names.push(m[1].trim());
  return {
    names: unique(names).slice(0, 20),
    prices: unique(prices).slice(0, 20),
    dates: unique(dates).slice(0, 20),
    ...preorderDeadline(periods),
  };
}

/** The end of the first stated preorder period, in Japan time. Only explicit dates with a year count. */
export function preorderDeadline(periods) {
  for (const period of asArray(periods)) {
    const startYear = String(period).match(/(\d{4})年/)?.[1];
    const end = String(period).match(/[～〜~]\s*(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*[（(][^）)]{1,3}[）)])?\s*(?:(\d{1,2})[：:時](\d{2}))?/);
    const single = !end && String(period).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*[（(][^）)]{1,3}[）)])?\s*(?:(\d{1,2})[：:時](\d{2}))?/);
    let year, month, day, hour, minute;
    if (end) [, year = startYear, month, day, hour, minute] = end;
    else if (single) [, year, month, day, hour, minute] = single;
    if (!year || !month || !day) continue;
    const pad = (v) => String(v).padStart(2, "0");
    const timed = hour !== undefined && minute !== undefined;
    const at = Date.parse(`${year}-${pad(month)}-${pad(day)}T${timed ? `${pad(hour)}:${pad(minute)}` : "23:59"}:00+09:00`);
    if (!Number.isFinite(at)) continue;
    return { preorderUntil: new Date(at).toISOString(), datePrecision: timed ? "datetime" : "day" };
  }
  return { preorderUntil: null, datePrecision: null };
}

const MERCH_PATTERNS = [
  ["nendoroids", /ねんどろいど|nendoroid/i],
  ["figma", /\bfigma\b/i],
  ["prize figures", /プライズ|\bprize\b/i],
  ["scale figures", /スケール|\d+\/\d+\s*スケール|scale figure/i],
  ["plushies", /ぬいぐるみ|\bplush/i],
  ["acrylic stands", /アクリルスタンド|アクスタ|acrylic stand/i],
  ["badges", /缶バッジ|バッジ|\bbadges?\b/i],
  ["pins", /ピンズ|ピンバッジ|\bpins?\b/i],
  ["shirts", /Tシャツ|シャツ|\bt-?shirts?\b/i],
  ["gacha", /ガチャ|カプセルトイ|\bgacha\b/i],
  ["beauty collab", /コスメ|メイクアップ|ネイル|\bcosmetics?\b/i],
  ["fashion collab", /アパレル|ファッション|\bapparel\b/i],
];
/** One MERCH_TYPES value from the title first, then the post's categories. */
export function piaproMerchType(title, categories = []) {
  for (const text of [String(title ?? ""), asArray(categories).join(" ")]) {
    const hit = MERCH_PATTERNS.find(([type, pattern]) => MERCH_TYPES.includes(type) && pattern.test(text));
    if (hit) return hit[0];
  }
  if (asArray(categories).includes("フィギュア")) return "scale figures";
  return "other goods";
}

const IMAGE = /<img[^>]+src=["']([^"']+)["']/gi;
/** First post image hosted by the blog itself (wp-content/uploads), else none. */
export function postImage(html) {
  for (const m of String(html ?? "").matchAll(IMAGE)) {
    let url;
    try {
      url = new URL(decodeEntities(m[1]), `${BLOG}/`);
    } catch {
      continue;
    }
    if (url.protocol === "https:" && url.hostname === "blog.piapro.net" && /^\/wp-content\/uploads\/.+\.(?:jpe?g|png|webp)$/i.test(url.pathname))
      return url.href;
  }
  return null;
}

async function fetchPiaproGoods(ctx) {
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();
  const dayStart = Date.parse(`${ctx.day}T00:00:00+08:00`);
  if (!Number.isFinite(dayStart)) throw new FeedError("invalid_day");
  const entries = await readFeed(ctx.http, PIAPRO_FEEDS.goods);
  const items = entries
    .filter((entry) => withinWindow(entry, now, GOODS_WINDOW_MS))
    .slice(0, limit)
    .map((entry) => {
      const facts = goodsFacts(entry.title, entry.contentHtml);
      const image = postImage(entry.contentHtml);
      const excerpt = summaryOf(entry);
      const tags = baseTags(entry);
      tags.topics = [piaproMerchType(entry.title, entry.categories)];
      return {
        source: piaproGoods.id,
        nativeId: entry.id,
        sections: ["merch", "music"],
        kind: "merch",
        title: clip(entry.title, 200),
        url: entry.link,
        media: image ? [{ type: "image", url: image, alt: clip(entry.title, 500) }] : [],
        credit: CREDIT,
        tags,
        facts: {
          excerpts: excerpt ? [excerpt] : [],
          names: facts.names,
          dates: facts.dates,
          prices: facts.prices,
          preorderUntil: facts.preorderUntil,
          datePrecision: facts.datePrecision,
          links: [{ kind: "official", label: "piapro blog", url: entry.link }],
          lang: "ja",
        },
        safety: { rating: "unknown", sourceTags: unique(entry.categories.map((c) => clip(c, 100))).slice(0, 20) },
        publishedAt: entry.published,
        // Stated prices are time-sensitive merch facts: at most 48 h after this build day starts.
        expiresAt: facts.prices.length ? new Date(dayStart + PRICE_TTL_MS).toISOString() : null,
      };
    });
  return { items, cursor: null, done: true };
}

const PIAPRO_POLICY = {
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  hosts: ["blog.piapro.net"],
  linkHosts: ["blog.piapro.net"],
  requiredCredentials: [],
  maxBytes: 512 * 1024,
  paceMs: 1000,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
  termsUrl: null,
  docsUrl: `${BLOG}/robots.txt`,
};

export const piaproNews = {
  ...PIAPRO_POLICY,
  id: "piapro-news",
  sections: ["music"],
  mediaHosts: [],
  mediaPolicy: "link_only",
  maxRequests: 5,
  fetch: fetchPiaproNews,
  notes:
    "Crypton's official Miku blog: /feed, /category/event/feed and one rotating tag feed (Magical Mirai, MIKU EXPO, SNOW MIKU, " +
    "Project SEKAI) per day; posts from the last 30 days, goods posts skipped (piapro-goods). Japanese (lang ja), link-only.",
};

export const piaproGoods = {
  ...PIAPRO_POLICY,
  id: "piapro-goods",
  sections: ["merch", "music"],
  mediaHosts: ["blog.piapro.net"],
  mediaPolicy: "still_only",
  maxRequests: 3,
  fetch: fetchPiaproGoods,
  notes:
    "/category/goods/feed: official goods and collab announcements from the last 45 days. Names, prices and dates only when a " +
    "post states them (exact strings); preorderUntil only from an explicit dated period. One still image from " +
    "blog.piapro.net/wp-content/uploads when the post body has one. expiresAt 48 h after the build day starts when prices are stated.",
};
