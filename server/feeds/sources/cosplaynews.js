// Dress-up web feeds: Arda Wigs news (wig lines, contests), SoraNews24's cosplay tag, and Kamui Cosplay
// build write-ups. Link-only news cards: title, a short source excerpt and a thumbnail on the feed's own
// host. Items go to dressup, plus maomao/music only when the entry names those fandoms.
//
// Verified 2026-09-15 from a home WSL machine (US exit), not Vercel:
// - arda-wigs.com/blogs/news.atom: 200 application/atom+xml, 172,674 bytes, 30 entries (newest
//   2026-08-12). robots.txt (Shopify 2026) allows blogs; the store's terms-of-service page body is empty.
// - soranews24.com/tag/cosplay/feed/: 200 application/rss+xml, 508,676 bytes, 20 items (newest
//   2026-09-11), ETag + Last-Modified. robots.txt disallows only /wp-admin/; no terms page is published
//   (/terms*, /privacy-policy/ 404; /about/ has none).
// - www.kamuicosplay.com/feed/: 200 application/rss+xml, 150,597 bytes, TTFB 14.8 s, full body 101.1 s.
//   A conditional GET with If-Modified-Since equal to Last-Modified returned 304 in 2.1 s, but the header
//   (2026-09-15T14:11:53Z) moves with site-wide changes although the newest post is 2025-11-27.
import { FeedError } from "../config.js";
import { asArray, clip, decodeEntities, feedEntries, hostOf, httpsOnly, stripHtml } from "./util.js";
import { COSPLAY_FORMATS } from "./tags.js";
import { matchFandoms } from "./merch.js";

const DAY_MS = 86_400_000;
const feedCache = new WeakMap(); // http → Map(url → Promise<entries|notModified>)

/** dressup always; maomao/music only on a fandom match. */
export function newsSections(fandoms) {
  const sections = ["dressup"];
  if (fandoms.includes("the apothecary diaries")) sections.push("maomao");
  if (fandoms.includes("vocaloid") || fandoms.includes("project sekai")) sections.push("music");
  return sections;
}

// Literal format cues only; COSPLAY_FORMATS values, never invented labels.
const FORMAT_CUES = [
  ["photoshoot", /\bphoto\s?shoots?\b/i],
  ["wig", /\bwigs?\b/i],
  ["makeup", /\bmake-?up\b/i],
  ["wip", /\bwork in progress\b|\bwip\b/i],
  ["transformation", /\btransformation\b/i],
  ["tutorial", /\bhow to\b|\btutorials?\b|\bstep[- ]by[- ]step\b/i],
  ["props", /\bprops?\b|\bswords?\b|\barmou?r\b|\bkatana\b|\bfoam\b/i],
];
export function cosplayFormats(text, extra = []) {
  const found = new Set(asArray(extra));
  for (const [format, cue] of FORMAT_CUES) if (cue.test(String(text ?? ""))) found.add(format);
  return COSPLAY_FORMATS.filter((f) => found.has(f));
}

const SUGGESTIVE_NEWS =
  /\b(?:lingerie|underwear|bikinis?|swimsuits?|swimwear|gravure|beautiful women|sexy|nsfw|bra|panty|panties|lewd|r-?18|adult)\b|18\+/i;

function allowedImage(url, host, prefix, alt) {
  const href = httpsOnly(url ? decodeEntities(url) : url);
  if (!href || hostOf(href) !== host) return null;
  const path = new URL(href).pathname;
  if (!path.startsWith(prefix) || !/\.(?:jpe?g|png|webp)$/i.test(path)) return null;
  return { type: "image", url: href, alt: clip(alt, 500) };
}

async function readFeed(ctx, url, { maxBytes, validators = null }) {
  if (!feedCache.has(ctx.http)) feedCache.set(ctx.http, new Map());
  const perInvocation = feedCache.get(ctx.http);
  if (!perInvocation.has(url)) {
    perInvocation.set(
      url,
      (async () => {
        const known = validators?.get(url) ?? null;
        const headers = {};
        if (known?.etag) headers["if-none-match"] = known.etag;
        if (known?.lastModified) headers["if-modified-since"] = known.lastModified;
        const res = await ctx.http.xml(url, { headers, allowNotModified: Boolean(known), maxBytes });
        if (res.notModified) return { notModified: true, entries: [] };
        if (validators) {
          const etag = res.headers?.etag;
          const lastModified = res.headers?.["last-modified"];
          if (etag || lastModified) validators.set(url, { etag: etag ?? null, lastModified: lastModified ?? null });
        }
        const root = res.doc?.rss?.channel ?? res.doc?.feed ?? res.doc?.["rdf:RDF"];
        if (!root) throw new FeedError("unexpected_source_format", 503);
        return { notModified: false, entries: feedEntries(res.doc) };
      })(),
    );
  }
  return perInvocation.get(url);
}

/**
 * Shared page builder. `spec.accept(entry)` returns {kind, formats} or null to skip; entries older than
 * `spec.maxAgeDays` or linking off-host are dropped. Cursor is the offset into the filtered list.
 */
async function fetchNews(ctx, spec, now) {
  const feed = await readFeed(ctx, spec.feedUrl, { maxBytes: spec.maxBytes, validators: spec.validators });
  if (feed.notModified) return { items: [], cursor: null, done: true };
  const nowMs = now();
  const since = nowMs - spec.maxAgeDays * DAY_MS;
  const eligible = feed.entries.filter((entry) => {
    const link = httpsOnly(entry.link);
    const published = Date.parse(entry.published ?? "");
    return (
      link &&
      hostOf(link) === spec.host &&
      Number.isFinite(published) &&
      published >= since &&
      published <= nowMs + DAY_MS &&
      entry.title &&
      !SUGGESTIVE_NEWS.test(`${entry.title} ${entry.categories.join(" ")}`)
    );
  });
  const offset = Number.isInteger(ctx.cursor) && ctx.cursor >= 0 ? ctx.cursor : 0;
  const take = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
  const items = [];
  let index = offset;
  for (; index < eligible.length && items.length < take; index++) {
    const entry = eligible[index];
    const accepted = spec.accept(entry);
    if (!accepted) continue;
    const excerpt = clip(entry.summary || stripHtml(entry.contentHtml), 600);
    const match = matchFandoms([entry.title, ...entry.categories, excerpt].join(" | "));
    const image = spec.image(entry);
    items.push({
      source: spec.id,
      nativeId: clip(String(entry.id || entry.link), 1000),
      sections: newsSections(match.fandoms),
      kind: accepted.kind,
      title: clip(entry.title, 200),
      url: httpsOnly(entry.link),
      media: image ? [image] : [],
      credit: spec.credit(entry),
      tags: {
        characters: match.characters,
        fandoms: match.fandoms,
        voicebanks: match.voicebanks,
        producers: [],
        units: [],
        formats: accepted.formats,
        topics: [],
      },
      facts: { excerpts: excerpt ? [excerpt] : [], lang: "" },
      safety: {
        rating: "unknown",
        sourceTags: [...new Set(entry.categories.map((c) => clip(c, 100)).filter(Boolean))].slice(0, 40),
      },
      publishedAt: entry.published,
    });
  }
  return index < eligible.length ? { items, cursor: index, done: false } : { items, cursor: null, done: true };
}

const BASE = {
  stage: "fetch-a",
  sections: ["dressup", "maomao", "music"],
  requiredCredentials: [],
  mediaPolicy: "still_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
  cacheSeconds: 86400,
  maxRequests: 2,
  paceMs: 2000,
};

// Arda posts sales and logistics notices next to contests; only wig/cosplay content is a card.
const ARDA_COMMERCE = /\bsale\b|black friday|cyber monday|hiatus|warehouse|loyalty|arda coins|\bshipping\b|restock|gift card|coupon|discount/i;

export function makeArdaWigs({ now = Date.now } = {}) {
  const id = "arda-wigs";
  const host = "arda-wigs.com";
  const spec = {
    id,
    host,
    feedUrl: `https://${host}/blogs/news.atom`,
    maxBytes: 512 * 1024,
    maxAgeDays: 60,
    accept(entry) {
      if (ARDA_COMMERCE.test(entry.title)) return null;
      const tutorial = /\bhow to\b|\btutorials?\b|\bguide\b|\bstyling tips\b/i.test(entry.title);
      return { kind: tutorial ? "tutorial" : "news", formats: cosplayFormats(entry.title, ["wig"]) };
    },
    image(entry) {
      for (const m of String(entry.contentHtml ?? "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
        const image = allowedImage(m[1], "cdn.shopify.com", "/s/files/1/1409/1418/", entry.title);
        if (image) return image;
      }
      return null;
    },
    credit: () => ({ name: "Arda Wigs", platform: "Arda Wigs blog", profileUrl: `https://${host}/blogs/news` }),
  };
  return {
    ...BASE,
    id,
    status: "enabled",
    enabled: true,
    kind: "news",
    hosts: [host],
    mediaHosts: ["cdn.shopify.com"],
    linkHosts: [host],
    maxBytes: 512 * 1024,
    timeoutMs: 12000,
    termsUrl: `https://${host}/policies/terms-of-service`,
    docsUrl: `https://${host}/agents.md`,
    notes:
      "Checked 2026-09-15 from a home WSL machine (US exit), not Vercel. Shopify blog Atom (172,674 bytes, 30 entries, newest 2026-08-12); robots.txt allows /blogs; the terms-of-service page body is empty. " +
      "Low volume: sale/shipping/loyalty posts are skipped, contests and wig posts older than 60 days are dropped. Thumbnails only from Arda's own cdn.shopify.com store files (/s/files/1/1409/1418/); external proxied images are ignored. Link-only; no deletion obligation stated.",
    fetch: (ctx) => fetchNews(ctx, spec, now),
  };
}
export const ardaWigs = makeArdaWigs();

export function makeSoranewsCosplay({ now = Date.now } = {}) {
  const id = "soranews-cosplay";
  const host = "soranews24.com";
  const spec = {
    id,
    host,
    feedUrl: `https://${host}/tag/cosplay/feed/`,
    maxBytes: 1024 * 1024,
    maxAgeDays: 60,
    accept: (entry) => ({ kind: "news", formats: cosplayFormats(`${entry.title} ${entry.categories.join(" ")}`) }),
    image(entry) {
      for (const m of entry.media) {
        const image = allowedImage(m.url, host, "/wp-content/uploads/", entry.title);
        if (image) return { ...image, width: m.width, height: m.height };
      }
      return null;
    },
    credit: (entry) => ({ name: clip(entry.author || "SoraNews24", 200), platform: "SoraNews24" }),
  };
  return {
    ...BASE,
    id,
    status: "enabled",
    enabled: true,
    kind: "news",
    hosts: [host],
    mediaHosts: [host],
    linkHosts: [host],
    maxBytes: 1024 * 1024,
    timeoutMs: 12000,
    termsUrl: `https://${host}/about/`,
    docsUrl: `https://${host}/tag/cosplay/feed/`,
    notes:
      "Checked 2026-09-15 from a home WSL machine (US exit), not Vercel. WordPress VIP RSS (508,676 bytes, 20 items, newest 2026-09-11; cache-control max-age=300). robots.txt disallows only /wp-admin/; no terms page is published (termsUrl points at /about/). " +
      "Link-only: title, the feed's own excerpt (≤600 chars) and the media:content thumbnail on soranews24.com/wp-content/uploads. Items older than 60 days or with suggestive categories (e.g. 'beautiful women', 'lingerie') are skipped; category words pass through as sourceTags for rules.js. " +
      "Probe 2026-09-15T19:11Z failed before connecting: soranews24.com resolves to 192.0.66.143 (WordPress VIP, public Automattic range), which http.js publicAddress() currently rejects as 192.0.0.0/16.",
    fetch: (ctx) => fetchNews(ctx, spec, now),
  };
}
export const soranewsCosplay = makeSoranewsCosplay();

const kamuiValidators = new Map(); // process-lifetime ETag/Last-Modified memo (no durable adapter state)

export function makeKamuiCosplay({ now = Date.now, validators = kamuiValidators } = {}) {
  const id = "kamui-cosplay";
  const host = "www.kamuicosplay.com";
  const spec = {
    id,
    host,
    feedUrl: `https://${host}/feed/`,
    maxBytes: 512 * 1024,
    maxAgeDays: 180,
    validators,
    accept(entry) {
      const categories = entry.categories.map((c) => c.toLowerCase());
      if (categories.includes("products")) return null; // shop announcements, not build write-ups
      const tutorial =
        categories.includes("crafting projects") || categories.includes("tips") || /\bhow to\b|\btutorial\b/i.test(entry.title);
      return {
        kind: tutorial ? "tutorial" : "news",
        formats: cosplayFormats(`${entry.title} ${entry.summary}`, tutorial ? ["tutorial"] : []),
      };
    },
    image(entry) {
      for (const m of String(entry.contentHtml ?? "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
        const image = allowedImage(m[1], host, "/wp-content/uploads/", entry.title);
        if (image) return image;
      }
      return null;
    },
    credit: () => ({ name: "Kamui Cosplay", platform: "Kamui Cosplay blog", profileUrl: `https://${host}/` }),
  };
  return {
    ...BASE,
    id,
    status: "optional",
    enabled: false,
    kind: "tutorial",
    hosts: [host],
    mediaHosts: [host],
    linkHosts: [host],
    maxRequests: 1,
    maxBytes: 512 * 1024,
    timeoutMs: 20000,
    termsUrl: `https://${host}/`,
    docsUrl: `https://${host}/feed/`,
    notes:
      "Disabled after live checks on 2026-09-15 (home WSL machine, US exit, not Vercel): the plain GET took 101.1 s (TTFB 14.8 s, 150,597 bytes), far beyond the 20 s timeout. " +
      "Conditional GET is implemented (If-None-Match/If-Modified-Since from the last 200, allowNotModified) and a matching If-Modified-Since returned 304 in 2.1 s, but no validator survives between builds " +
      "and Last-Modified moved to 2026-09-15T14:11:53Z although the newest post is 2025-11-27, so almost every build would need the slow full body. robots.txt allows /feed/. About 2 posts a year (Genshin builds). " +
      "Adapter probe 2026-09-15T19:12Z: the single request was aborted at 20 s and the helper's retry was refused by maxRequests 1 (source_request_limit), so nothing looks like an empty success.",
    fetch: (ctx) => fetchNews(ctx, spec, now),
  };
}
export const kamuiCosplay = makeKamuiCosplay();
