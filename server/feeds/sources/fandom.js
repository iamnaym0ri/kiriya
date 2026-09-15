// The Apothecary Diaries Wiki (kusuriya.fandom.com) through its MediaWiki Action API only.
//
// Verified live 2026-09-15T14:48Z from a home WSL machine (not Vercel):
// - `api.php` (siteinfo, parse, categorymembers, allmessages) → 200 JSON (MediaWiki 1.43.9, 582 articles).
// - Article HTML, robots.txt, www.fandom.com/licensing and /terms-of-use all return a 403 Cloudflare
//   managed challenge to this client (and HTTP 402 to a generic fetcher). They are not bypassed; the HTML
//   is never requested.
// - Licence: siteinfo rightsinfo says "CC-BY-SA" → fandom.com/licensing, and the wiki's own
//   "The Apothecary Diaries Wiki:Copyrights" page (read through the API) says text is licensed under
//   "Creative Commons Attribution-Share Alike License 3.0 (Unported) (CC-BY-SA)".
// - Character pages Maomao, Pairin, Meimei, Joka, Xiaolan and Gaoshun exist; Category:Anime_Episode lists
//   "Season N Episode NN" pages (S1–S2) plus a Season 3 placeholder table.
import { FeedError } from "../config.js";
import { canonicalCharacters, CHARACTER_ALIASES, mentions } from "./tags.js";
import { clip, cursor as cursorCodec } from "./util.js";
import {
  APOTHECARY_CHARACTERS,
  expandTemplates,
  inlinePlain,
  isRenderable,
  SENSITIVE_LORE,
  sentenceClip,
  stripBlocks,
} from "./wikipedia.js";

const WIKI = "https://kusuriya.fandom.com";
const API = `${WIKI}/api.php`;
export const FANDOM_VERIFIED_AT = "2026-09-15T14:48:21Z";
export const FANDOM_PAGES = ["Maomao", "Pairin", "Meimei", "Joka", "Xiaolan", "Gaoshun"];
export const EPISODE_CATEGORY = "Category:Anime Episode";
export const EXCERPTS_PER_PAGE = { Maomao: 3, default: 2 };
export const EPISODE_PAGES_PER_BUILD = 2;
const DAY = 86_400_000;

const SKIPPED_SECTIONS =
  /^(?:gallery|galleries|images?|videos?|references?|notes?|sources?|external links?|see also|navigation|site navigation|music|notable characters|appearances|voice actors?|cast|staff|changes)$/i;
const BLOCK_TEMPLATES = /^(?:infobox\b.*|.*\btab row|clear|clr|toc|stub|spoiler|navbox\b.*|main|see also|disambig\w*|expand section|cleanup)$/i;
const HATNOTE = /^(?:were you looking for|for other uses|this article is about|not to be confused|translated blurb)/i;

// Inline templates whose rendered text is known exactly (checked through action=parse on 2026-09-15:
// {{TAD}}/{{TADanime}}/{{TADlnovel}}/{{TADmanga}} → "The Apothecary Diaries"; a first parameter replaces it).
function renderFandom({ key, positional }) {
  if (/^tad[a-z]*$/.test(key)) return positional[0] || "The Apothecary Diaries";
  if (key === "nihongo" || key === "ruby" || key === "expand") return positional[0] ?? "";
  if (/(?:^|\s)ref$|^cite\b|^citation\b|^efn\b|^sfn\b|^reflist$/.test(key)) return "";
  if (key === "!") return "|";
  return null;
}

const titlePath = (title) =>
  encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%28/g, "(").replace(/%29/g, ")");
const slugOf = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "section";

/**
 * Candidate excerpts for one page, in document order: `{section, slug, anchor, n, text}`. `n` counts raw
 * candidates per section before filtering so identities don't shift when a filter changes.
 */
export function pageExcerpts(wikitext) {
  const quotes = [];
  const expanded = expandTemplates(stripBlocks(wikitext), (parts) => {
    if (BLOCK_TEMPLATES.test(parts.key)) return "\n";
    if (parts.key === "quote") {
      quotes.push(parts);
      return "\n\n";
    }
    return renderFandom(parts);
  });
  const out = [];
  let section = { name: "overview", slug: "overview", anchor: null };
  let n = 0;
  let buffer = [];
  const push = (raw) => {
    const index = n++;
    if (SKIPPED_SECTIONS.test(section.name)) return;
    const text = inlinePlain(raw);
    if (!isRenderable(text) || text.length < 60 || /:$/.test(text) || HATNOTE.test(text) || SENSITIVE_LORE.test(text)) return;
    out.push({ section: section.name, slug: section.slug, anchor: section.anchor, n: index, text: sentenceClip(text, 600) });
  };
  const flush = () => {
    if (buffer.length) push(buffer.join(" "));
    buffer = [];
  };
  for (const line of expanded.split("\n")) {
    const heading = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (heading) {
      flush();
      const name = inlinePlain(heading[2]) || "section";
      section = { name, slug: slugOf(name), anchor: name.replace(/ /g, "_") };
      n = 0;
    } else if (!line.trim()) flush();
    else if (/^\s*[*#:;]/.test(line)) {
      flush();
      push(line.replace(/^\s*[*#:;]+\s*/, ""));
    } else buffer.push(line.trim());
  }
  flush();
  quotes.forEach((parts, index) => {
    const said = inlinePlain(expandTemplates(parts.positional[0] ?? "", renderFandom));
    const speaker = inlinePlain(parts.positional[1] ?? "");
    const medium = inlinePlain(parts.positional[2] ?? "");
    if (!isRenderable(`${said}${speaker}${medium}`) || said.length < 10 || SENSITIVE_LORE.test(said)) return;
    const text = `“${said}” — ${speaker}${medium && !/^var\(/.test(medium) ? `, ${medium}` : ""}`;
    out.push({ section: "quote", slug: "quote", anchor: null, n: index, text: sentenceClip(text, 600) });
  });
  return out;
}

/** `count` consecutive entries; the window moves by `count` each day, so every paragraph comes around. */
export function rotate(list, day, count) {
  if (!list.length) return [];
  const offset = (Math.floor((Date.parse(`${day}T00:00:00Z`) || Date.now()) / DAY) * count) % list.length;
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(offset + i) % list.length]);
}

export function excerptItem(page, excerpt) {
  const path = titlePath(page.title);
  const url = new URL(`${WIKI}/wiki/${path}`);
  // Distinct per excerpt: canonical URLs drop fragments, and the bare page URL would merge every excerpt.
  url.searchParams.set("excerpt", `${excerpt.slug}-${excerpt.n}`);
  if (excerpt.anchor) url.hash = encodeURIComponent(excerpt.anchor);
  const characters = [
    ...new Set([
      ...canonicalCharacters([page.title]).filter((c) => APOTHECARY_CHARACTERS.includes(c)),
      ...mentions(excerpt.text, CHARACTER_ALIASES).filter((c) => APOTHECARY_CHARACTERS.includes(c)),
    ]),
  ];
  return {
    source: "fandom-apothecary",
    nativeId: `${page.pageid}:${excerpt.slug}:${excerpt.n}`,
    sections: ["maomao"],
    kind: "lore",
    title: clip(`${page.title} · ${excerpt.section}`, 200),
    url: url.href,
    credit: {
      name: "The Apothecary Diaries Wiki contributors",
      platform: "Fandom",
      license: "CC BY-SA 3.0",
      profileUrl: `${WIKI}/wiki/${path}?action=history`,
    },
    tags: { characters, fandoms: ["the apothecary diaries"] },
    facts: { excerpts: [excerpt.text], names: [clip(page.title, 100)] },
    safety: { rating: "unknown" },
  };
}

function apiError(body) {
  const code = String(body?.error?.code ?? "");
  if (!code) return null;
  if (code === "missingtitle" || code === "pagecannotexist") return new FeedError("not_found", 404);
  if (code === "maxlag" || code === "ratelimited") return new FeedError("rate_limited", 429);
  return new FeedError("source_unavailable", 503);
}

export const parseUrl = (title) =>
  `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext%7Crevid&redirects=1&format=json&formatversion=2`;
export const episodeListUrl = () =>
  `${API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(EPISODE_CATEGORY)}&cmlimit=100&cmprop=title&format=json&formatversion=2`;

/** Latest episode page plus one rotating older page. */
export function chooseEpisodes(titles, day) {
  const pages = titles
    .map((title) => ({ title, m: title.match(/^Season (\d+) Episode (\d+)$/) }))
    .filter((p) => p.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]) || Number(a.m[2]) - Number(b.m[2]))
    .map((p) => p.title);
  if (!pages.length) return [];
  const latest = pages.at(-1);
  const older = rotate(pages.slice(0, -1), day, 1);
  return [...new Set([latest, ...older])].slice(0, EPISODE_PAGES_PER_BUILD);
}

/** Cursor `{s, eps}`: step index over character pages, the episode listing, then chosen episode pages. */
export async function fetchFandom(ctx) {
  const state = cursorCodec.decode(ctx.cursor, {});
  const step = Number.isInteger(state.s) && state.s >= 0 ? state.s : 0;
  const episodes = Array.isArray(state.eps) ? state.eps.filter((t) => typeof t === "string").slice(0, EPISODE_PAGES_PER_BUILD) : [];
  const plan = [...FANDOM_PAGES.map((title) => ({ title })), { list: true }, ...episodes.map((title) => ({ title }))];
  if (step >= plan.length) return { items: [], cursor: null, done: true };
  const current = plan[step];
  let items = [];
  let nextEpisodes = episodes;
  if (current.list) {
    const body = await ctx.http.json(episodeListUrl());
    const error = apiError(body);
    if (error) throw error;
    if (!Array.isArray(body?.query?.categorymembers)) throw new FeedError("source_shape", 503);
    nextEpisodes = chooseEpisodes(body.query.categorymembers.map((m) => String(m?.title ?? "")), ctx.day);
  } else {
    const body = await ctx.http.json(parseUrl(current.title));
    const error = apiError(body);
    if (error) throw error;
    if (typeof body?.parse?.wikitext !== "string" || !Number.isInteger(body.parse.pageid)) throw new FeedError("source_shape", 503);
    const page = { title: String(body.parse.title ?? current.title), pageid: body.parse.pageid };
    const count = EXCERPTS_PER_PAGE[current.title] ?? EXCERPTS_PER_PAGE.default;
    items = rotate(pageExcerpts(body.parse.wikitext), ctx.day, Math.min(count, 8, ctx.limits.items)).map((e) => excerptItem(page, e));
  }
  const total = FANDOM_PAGES.length + 1 + nextEpisodes.length;
  if (step + 1 >= total) return { items, cursor: null, done: true };
  return { items, cursor: cursorCodec.encode({ s: step + 1, eps: nextEpisodes }), done: false };
}

export const fandomApothecary = {
  id: "fandom-apothecary",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["maomao"],
  hosts: ["kusuriya.fandom.com"],
  mediaHosts: [],
  linkHosts: [],
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: [],
  maxRequests: 10,
  maxBytes: 1024 * 1024,
  paceMs: 1000,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  copyPermission: null,
  deletionPolicy: "none",
  deletionDeadlineHours: null,
  termsUrl: "https://kusuriya.fandom.com/api.php?action=parse&page=Project:Copyrights&prop=wikitext&format=json&formatversion=2",
  docsUrl: "https://kusuriya.fandom.com/api.php",
  notes:
    "API only; article HTML, robots.txt and fandom.com legal pages are behind a Cloudflare challenge that is not bypassed. Per build: Maomao (3 excerpts), Pairin, Meimei, Joka, Xiaolan, Gaoshun (2 each), then Category:Anime Episode to pick the latest episode page plus one rotating older one (2 each) — at most 9 requests and 17 items, one request per page. Wikitext → plain text: comments/refs/galleries/tables/infoboxes removed, links reduced to labels, known inline templates rendered, paragraphs with any other template skipped so excerpts stay verbatim (≤600 chars, cut at a sentence end). Daily rotation walks every paragraph; gallery/reference/music/cast sections and sexual-violence/self-harm/torture wording are skipped. Light-novel spoilers allowed. Credit: The Apothecary Diaries Wiki contributors, CC BY-SA 3.0, with the page history link. No images.",
  fetch: fetchFandom,
};
