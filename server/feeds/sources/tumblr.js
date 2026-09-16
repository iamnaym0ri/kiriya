// Tumblr collectors: Maomao art/GIFs and cosplay through /v2/tagged (API key), SEKAI fandom memes through
// allowlisted blog RSS (keyless).
//
// Verified 2026-09-15 (UTC) from a home WSL machine, not Vercel:
// - Application Developer and API License Agreement (tumblr.com/docs/en/api_agreement, last modified
//   2018-09-12): attribute "the Tumblr blog that posted such Content" and "the source of the Content, if
//   such source was provided"; "within twenty-four hours after such notification" delete removed content,
//   disable suspended blogs and follow sharing changes; "Under no circumstances will you or your Licensee
//   Applications store or cache Content for longer than three (3) days; after three (3) days, you ... will
//   re-request any such Content"; no page scraping; no continuous playback without user input; say the app
//   uses Tumblr; Licensee Applications "must present users with the ability to log into the Tumblr
//   Services through the Tumblr API via the OAuth protocol" (a UI obligation this collector cannot meet).
// - Terms of Service (last modified 2026-01-16): no automated access except Tumblr's published interfaces or
//   what robots.txt permits, no scraping; §7 applies the API agreement to any software built on Tumblr
//   content "whether using the Tumblr Application Programming Interface or not" (so RSS use follows it too).
// - API docs (tumblr.com/docs/en/api/v2 and github.com/tumblr/docs): /v2/tagged (API key or OAuth;
//   limit 1–20; `before` timestamp); /v2/blog/{blog}/posts?id= "Returns the single post specified or (if
//   not found) a 404 error"; 1,000 calls/hour and 5,000/day per consumer key, 300/minute per IP; a consistent
//   User-Agent is required. NPF image blocks list sizes widest first; GIF variants may carry a poster; image
//   blocks may carry an attribution (post/link/blog/app). Only community objects document content labels
//   (has_content_label, content_label_categories); per-post NSFW fields read below are defensive guesses.
// - Live: anonymous /v2/tagged?tag=maomao → 401. pjsk--shitposts.tumblr.com/rss and
//   project-sekai-but-incorrect.tumblr.com/rss → 200 text/xml, 20 items, Cache-Control max-age=600, images on
//   64.media.tumblr.com; blog robots.txt allows /rss (Crawl-delay 1). ghostinthegutter's RSS was all reblogs
//   of unrelated fandoms (Stranger Things, TGCF) with a May–September gap, so it is not allowlisted.
import { FeedError } from "../config.js";
import {
  CHARACTER_ALIASES,
  FANDOM_ALIASES,
  UNIT_ALIASES,
  VOICEBANKS,
  canonicalCharacters,
  canonicalFandoms,
  canonicalUnits,
  mentions,
} from "./tags.js";
import { cursor as cursorCodec, decodeEntities, feedEntries, toIso } from "./util.js";

const API = "api.tumblr.com";
const WEB = "www.tumblr.com";
const MEDIA = "64.media.tumblr.com";
export const TUMBLR_TERMS_URL = "https://www.tumblr.com/docs/en/api_agreement";
const DOCS_URL = "https://www.tumblr.com/docs/en/api/v2";
export const TUMBLR_VERIFIED_AT = "2026-09-15T14:49:30Z";
export const TUMBLR_CACHE_HOURS = 72;
const HOUR = 3_600_000;
const MAX_PASSES_PER_STEP = 2;
const BLOG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export const TUMBLR_MEME_BLOGS = [
  { blog: "pjsk--shitposts", fandom: "project sekai" },
  { blog: "project-sekai-but-incorrect", fandom: "project sekai" },
];
export const TUMBLR_REJECTED_BLOGS = {
  ghostinthegutter:
    "2026-09-15 RSS: every recent item was a reblog of other blogs about Stranger Things, TGCF or random memes, with no Apothecary Diaries meme since before May; wrong fandom and wrong credit.",
};
const MEME_BLOG_NAMES = new Set(TUMBLR_MEME_BLOGS.map((b) => b.blog));
// Exact hosts accepted as the attributed "source" link.
export const TUMBLR_SOURCE_HOSTS = [
  WEB,
  "www.pixiv.net",
  "x.com",
  "twitter.com",
  "bsky.app",
  "www.instagram.com",
  "www.deviantart.com",
  "www.artstation.com",
];

export const MAOMAO_TAGS = [
  { key: "tag-apothecary-diaries", tag: "the apothecary diaries" },
  { key: "tag-kusuriya", tag: "kusuriya no hitorigoto" },
  // "maomao" is shared with the cartoon Mao Mao: Heroes of Pure Heart, so a fandom match is required.
  { key: "tag-maomao", tag: "maomao", needsFandom: true },
];
export const COSPLAY_FIXED_TAGS = ["maomao cosplay", "hatsune miku cosplay", "miku cosplay"].map((tag) => ({
  key: `tag-${tag.replace(/\s+/g, "-")}`,
  tag,
}));
export const COSPLAY_ROTATING_TAGS = [
  "project sekai cosplay",
  "vocaloid cosplay",
  "the apothecary diaries cosplay",
  "frieren cosplay",
  "witch hat atelier cosplay",
  "genshin impact cosplay",
  "honkai star rail cosplay",
  "bungo stray dogs cosplay",
].map((tag) => ({ key: `tag-${tag.replace(/\s+/g, "-")}`, tag }));

export function tumblrCosplayTags(day) {
  const t = Date.parse(`${day}T00:00:00Z`);
  const d = Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
  const n = COSPLAY_ROTATING_TAGS.length;
  return [...COSPLAY_FIXED_TAGS, ...[...new Set([d % n, (d + 3) % n])].map((i) => COSPLAY_ROTATING_TAGS[i])];
}

// ---------------------------------------------------------------------------------------------------------
// Text, media and attribution helpers

const MORE_ENTITIES = {
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ntilde: "ñ",
  ccedil: "ç",
  trade: "™",
  copy: "©",
  reg: "®",
  deg: "°",
  middot: "·",
  bull: "•",
  laquo: "«",
  raquo: "»",
  times: "×",
};
const decode = (value) =>
  decodeEntities(value).replace(/&([a-z]+);/gi, (m, name) => MORE_ENTITIES[name.toLowerCase()] ?? m);

export function clipText(value, max) {
  const text = String(value ?? "")
    .replace(/[\x00]/g, "")
    .trim();
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 1);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  const soft = cut.replace(/\s+\S*$/, "");
  return `${soft.length >= max * 0.6 ? soft : cut}…`;
}

/** Plain text from untrusted Tumblr HTML, keeping paragraph breaks (quotes read line by line). */
export function htmlText(html) {
  const broken = String(html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:br|\/?p|\/?li|\/?h\d|\/?blockquote|\/?figure|\/?div)\b[^>]*>/gi, "\n");
  // Inline tags (span, b, i, a) vanish without adding spaces, so "Haruka</span>, you" stays "Haruka, you".
  return decode(broken.replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function mediaUrl(value) {
  try {
    const u = new URL(value);
    if (u.hostname !== MEDIA || u.username || u.password || (u.port && u.port !== "443")) return null;
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    return u.href;
  } catch {
    return null;
  }
}
function mediaIdentity(url) {
  const [hash, asset] = new URL(url).pathname.split("/").filter(Boolean);
  if (!/^[0-9a-f]{32}$/i.test(hash ?? "") || !asset) return undefined;
  return `tumblr-media:${hash.toLowerCase()}/${asset.replace(/_(?:\d+|s\d+x\d+\w*)\.\w+$/, "")}`.slice(0, 200);
}
const dimension = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 30000 ? n : null;
};

/** Images from Tumblr post HTML (RSS descriptions, legacy bodies): the widest srcset variant ≤ 1280 px. */
export function htmlImages(html) {
  const out = [];
  for (const match of String(html ?? "").matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const attr = (name) => {
      const found = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
      return found ? decode(found[1]) : null;
    };
    const origW = dimension(attr("data-orig-width"));
    const origH = dimension(attr("data-orig-height"));
    const variants = (attr("srcset") ?? "")
      .split(",")
      .map((part) => part.trim().split(/\s+/))
      .map(([url, w]) => ({ url: mediaUrl(url), w: Number(String(w ?? "").replace(/w$/, "")) || 0 }))
      .filter((v) => v.url && v.w <= 1280)
      .sort((a, b) => b.w - a.w);
    const src = mediaUrl(attr("src"));
    const best = variants[0] ?? (src ? { url: src, w: 0 } : null);
    if (!best) continue;
    const width = best.w || (origW && origW <= 1280 ? origW : null);
    const height = width && origW && origH ? Math.max(1, Math.round((origH * width) / origW)) : null;
    const gif = /\.gif(?:$|\?)/i.test(best.url);
    out.push({
      type: gif ? "gif" : "image",
      url: best.url,
      width,
      height,
      poster: null,
      alt: clipText(attr("alt") ?? "", 500),
      identity: mediaIdentity(best.url),
    });
  }
  return out.slice(0, 4);
}

function npfImage(block) {
  const variants = (Array.isArray(block?.media) ? block.media : [])
    .map((m) => ({ ...m, url: mediaUrl(m?.url) }))
    .filter((m) => m.url)
    .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  const best = variants.find((m) => (Number(m.width) || 0) <= 1280) ?? variants[variants.length - 1];
  if (!best) return null;
  const gif = best.type === "image/gif" || /\.gif(?:$|\?)/i.test(best.url);
  const poster = gif ? (mediaUrl(best.poster?.url) ?? mediaUrl(block.poster?.url)) : null;
  const known = !best.original_dimensions_missing;
  return {
    type: gif ? "gif" : "image",
    url: best.url,
    width: known ? dimension(best.width) : null,
    height: known ? dimension(best.height) : null,
    poster,
    alt: clipText(block.alt_text ?? "", 500),
    identity: mediaIdentity(best.url),
  };
}

function legacyPhoto(photo) {
  const sizes = [photo?.original_size, ...(Array.isArray(photo?.alt_sizes) ? photo.alt_sizes : [])]
    .filter(Boolean)
    .map((s) => ({ ...s, url: mediaUrl(s.url) }))
    .filter((s) => s.url)
    .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  const best = sizes.find((s) => (Number(s.width) || 0) <= 1280) ?? sizes[sizes.length - 1];
  if (!best) return null;
  const gif = /\.gif(?:$|\?)/i.test(best.url);
  return {
    type: gif ? "gif" : "image",
    url: best.url,
    width: dimension(best.width),
    height: dimension(best.height),
    poster: null,
    alt: clipText(photo.caption ? htmlText(photo.caption) : "", 500),
    identity: mediaIdentity(best.url),
  };
}

/** A source URL reduced to an exact allowlisted host (Tumblr posts canonicalized); null when unusable. */
export function sourceLink(value) {
  let u;
  try {
    u = new URL(value);
    if (u.hostname === "t.umblr.com" && u.pathname === "/redirect") u = new URL(u.searchParams.get("z"));
  } catch {
    return null;
  }
  const sub = /^([a-z0-9-]+)\.tumblr\.com$/i.exec(u.hostname);
  const post = /^\/post\/(\d+)/.exec(u.pathname);
  if (sub && post && sub[1] !== "www") return `https://${WEB}/${sub[1].toLowerCase()}/${post[1]}`;
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  if (!TUMBLR_SOURCE_HOSTS.includes(u.hostname.toLowerCase())) return null;
  u.hash = "";
  return u.href;
}

/** Content-safety signals. Only community labels are documented; the rest are defensive field reads. */
export function tumblrFlags(post) {
  const labels = [];
  const add = (value) => value && labels.push(String(value).toLowerCase().slice(0, 100));
  const list = (value) => (Array.isArray(value) ? value : []);
  if (post?.is_nsfw === true) add("nsfw");
  if (typeof post?.classification === "string" && post.classification.toLowerCase() !== "clean")
    add(`classification:${post.classification}`);
  for (const value of [...list(post?.community_labels), ...list(post?.community_label_categories)])
    add(`community_label:${typeof value === "string" ? value : (value?.name ?? value?.category ?? "unknown")}`);
  if (post?.has_community_label === true) add("community_label");
  if (post?.blog?.is_nsfw === true || post?.blog?.is_adult === true) add("blog_nsfw");
  const communityNsfw =
    post?.community?.has_content_label === true || list(post?.community?.content_label_categories).length > 0;
  return { labels: [...new Set(labels)], nsfw: labels.length > 0, communityNsfw };
}

function topicTags(texts, tags) {
  const haystack = [...texts, ...tags].join("\n");
  const characters = [...new Set([...canonicalCharacters(tags), ...mentions(haystack, CHARACTER_ALIASES)])];
  const fandoms = [...new Set([...canonicalFandoms(tags), ...mentions(haystack, FANDOM_ALIASES)])];
  const units = [...new Set([...canonicalUnits(tags), ...mentions(haystack, UNIT_ALIASES)])];
  return {
    characters,
    fandoms,
    voicebanks: characters.filter((c) => VOICEBANKS.includes(c)),
    units,
    formats: [],
    topics: [],
  };
}
const APOTHECARY_CHARACTERS = ["jinshi", "pairin", "meimei", "joka", "xiaolan", "gaoshun", "lakan", "luomen", "gyokuyou"];
const isApothecary = (t) => t.characters.includes("maomao") || t.fandoms.includes("the apothecary diaries");
const isMusic = (t) =>
  t.voicebanks.length > 0 || t.units.length > 0 || t.fandoms.includes("vocaloid") || t.fandoms.includes("project sekai");
const NSFW_TAGS = /^(?:nsfw|18\+|r-?18|lewd|suggestive|tw nsfw|cw nsfw)$/i;
const ADULT_BLOG = /nsfw|18\+|(?:^|-)r-?18(?:-|$)|lewd|hentai/i;

// ---------------------------------------------------------------------------------------------------------
// API posts (NPF with legacy fallback)

export function parseTumblrPost(post) {
  const blog = String(post?.blog_name ?? post?.blog?.name ?? "").toLowerCase();
  const id = String(post?.id_string ?? (typeof post?.id === "string" ? post.id : ""));
  if (!BLOG.test(blog) || !/^\d{1,20}$/.test(id)) return null;
  const trail = Array.isArray(post.trail) ? post.trail : [];
  const reblog = trail.length > 0 || Boolean(post.parent_post_url || post.reblogged_from_id || post.reblogged_root_id);
  const texts = [];
  const media = [];
  let foreignAttribution = false;
  let paywalled = Boolean(post.is_paywalled);
  if (Array.isArray(post.content)) {
    for (const block of post.content) {
      if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
      if (block?.type === "paywall") paywalled = true;
      if (block?.type === "image") {
        const type = block.attribution?.type;
        // GIF-search inserts (post attribution) and app attributions belong to someone else.
        if (type === "post" || type === "app") foreignAttribution = true;
        const m = npfImage(block);
        if (m) media.push(m);
      }
    }
  } else if (post.type === "photo") {
    for (const photo of Array.isArray(post.photos) ? post.photos : []) {
      const m = legacyPhoto(photo);
      if (m) media.push(m);
    }
    if (post.caption) texts.push(htmlText(post.caption));
  } else if (post.type === "text") {
    media.push(...htmlImages(post.body));
    if (post.title) texts.push(decode(post.title));
    if (post.body) texts.push(htmlText(post.body));
  }
  const imageAttribution = (Array.isArray(post.content) ? post.content : [])
    .map((b) => (b?.type === "image" && ["link", "blog"].includes(b.attribution?.type) ? b.attribution.url : null))
    .find(Boolean);
  const rawSource = post.source_url || imageAttribution || null;
  const source = rawSource ? sourceLink(rawSource) : null;
  const tags = (Array.isArray(post.tags) ? post.tags : [])
    .filter((t) => typeof t === "string")
    .map((t) => t.trim().toLowerCase().slice(0, 100))
    .filter(Boolean)
    .slice(0, 40);
  const timestamp = Number(post.timestamp);
  return {
    blog,
    id,
    url: `https://${WEB}/${blog}/${id}`,
    state: typeof post.state === "string" ? post.state : "published",
    reblog,
    paywalled,
    foreignAttribution,
    rawSource,
    source: source && source !== `https://${WEB}/${blog}/${id}` ? source : null,
    sourceTitle: clipText(decode(post.source_title ?? ""), 100),
    text: texts.join("\n").trim(),
    summary: clipText(decode(post.summary ?? ""), 200),
    media: media.slice(0, 4),
    tags,
    flags: tumblrFlags(post),
    notes: Math.max(0, Number(post.note_count) || 0),
    publishedAt: Number.isFinite(timestamp) && timestamp > 0 ? toIso(timestamp * 1000) : null,
  };
}

function titleFor(text, fallback) {
  const line = String(text ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .find(Boolean);
  return clipText(line || fallback, 120) || fallback;
}

function buildItem(entry, parsed, { kind, sections, tags, title, formats = [] }) {
  const excerpts = [parsed.text, ...parsed.media.map((m) => m.alt)].map((t) => clipText(t, 600)).filter(Boolean);
  return {
    source: entry.id,
    nativeId: parsed.id,
    sections: [...new Set(sections)],
    kind,
    title,
    url: parsed.url,
    media: parsed.media,
    credit: {
      name: parsed.blog,
      handle: parsed.blog,
      profileUrl: `https://${WEB}/${parsed.blog}`,
      platform: "Tumblr",
    },
    tags: { ...tags, formats },
    facts: {
      excerpts: [...new Set(excerpts)].slice(0, 3),
      names: parsed.sourceTitle ? [parsed.sourceTitle] : [],
      sourceScore: parsed.notes ?? 0,
      links: parsed.source
        ? [{ kind: "source", label: clipText(`original source${parsed.sourceTitle ? `: ${parsed.sourceTitle}` : ""}`, 80), url: parsed.source }]
        : [],
    },
    safety: {
      rating: "unknown",
      labels: parsed.flags.labels,
      sourceTags: parsed.tags,
      nsfw: parsed.flags.nsfw,
      communityNsfw: parsed.flags.communityNsfw,
    },
    publishedAt: parsed.publishedAt,
    // API agreement: no stored copy of Content older than three days; re-request after that.
    expiresAt: new Date(Date.now() + TUMBLR_CACHE_HOURS * HOUR).toISOString(),
    ...(parsed.media[0]?.identity ? { mediaIdentity: parsed.media[0].identity } : {}),
  };
}

function apiSkip(parsed) {
  return (
    !parsed ||
    ADULT_BLOG.test(parsed.blog) ||
    parsed.state !== "published" ||
    parsed.reblog ||
    parsed.paywalled ||
    parsed.foreignAttribution ||
    parsed.flags.nsfw ||
    parsed.flags.communityNsfw ||
    parsed.tags.some((t) => NSFW_TAGS.test(t)) ||
    // A stated source we cannot link on an exact host cannot be attributed, so the post is skipped.
    (parsed.rawSource && !parsed.source && !String(parsed.rawSource).includes(`${parsed.blog}.tumblr.com`))
  );
}

function selectMaomao(entry, parsed, step) {
  if (apiSkip(parsed) || !parsed.media.length) return null;
  const tags = topicTags([parsed.text, ...parsed.media.map((m) => m.alt)], parsed.tags);
  const apothecary =
    tags.fandoms.includes("the apothecary diaries") || tags.characters.some((c) => APOTHECARY_CHARACTERS.includes(c));
  if (step.needsFandom ? !apothecary : !isApothecary(tags)) return null;
  if (!tags.fandoms.includes("the apothecary diaries")) tags.fandoms.push("the apothecary diaries");
  return buildItem(entry, parsed, {
    kind: parsed.media.some((m) => m.type === "gif") ? "clip" : "image",
    sections: ["maomao"],
    tags,
    title: titleFor(parsed.text || parsed.summary, `apothecary diaries post by ${parsed.blog}`),
  });
}

const COSPLAY_FORMAT_TAGS = [
  ["wip", /\bwip\b|work in progress/i],
  ["wig", /\bwigs?\b/i],
  ["makeup", /\bmake-?up\b/i],
  ["props", /\bprops?\b/i],
  ["photoshoot", /photo ?shoot|photograph/i],
  ["transformation", /transformation/i],
  ["tutorial", /tutorial/i],
];

function selectCosplay(entry, parsed) {
  if (apiSkip(parsed) || !parsed.media.length) return null;
  const tags = topicTags([parsed.text, ...parsed.media.map((m) => m.alt)], parsed.tags);
  const all = [parsed.text, ...parsed.tags].join("\n");
  if (!/cosplay|コスプレ/i.test(all)) return null;
  const sections = ["dressup"];
  if (isApothecary(tags)) sections.push("maomao");
  if (isMusic(tags)) sections.push("music");
  return buildItem(entry, parsed, {
    kind: "cosplay",
    sections,
    tags,
    formats: COSPLAY_FORMAT_TAGS.filter(([, re]) => re.test(all)).map(([f]) => f),
    title: titleFor(parsed.text || parsed.summary, `cosplay posted by ${parsed.blog}`),
  });
}

// ---------------------------------------------------------------------------------------------------------
// RSS memes

function linkParts(link) {
  const value = String(link ?? "");
  const sub = /^https?:\/\/([a-z0-9-]+)\.tumblr\.com\/post\/(\d{1,20})(?:[/?#]|$)/i.exec(value);
  if (sub && sub[1].toLowerCase() !== "www") return { blog: sub[1].toLowerCase(), id: sub[2] };
  const web = /^https?:\/\/www\.tumblr\.com\/([a-z0-9-]+)\/(\d{1,20})(?:[/?#]|$)/i.exec(value);
  return web ? { blog: web[1].toLowerCase(), id: web[2] } : null;
}

function memeFormats(text, media) {
  const formats = [];
  if (/(^|\n)\s*pov\b|\bpov:/i.test(text)) formats.push("pov");
  if (/\bme when\b/i.test(text)) formats.push("me_when");
  if (!media.length) formats.push("text_post");
  return formats;
}

export function rssMemeItem(entry, blogConfig, raw) {
  const parts = linkParts(raw.link) ?? linkParts(raw.id);
  if (!parts || parts.blog !== blogConfig.blog) return null;
  const html = raw.contentHtml ?? "";
  const categories = raw.categories.map((c) => c.toLowerCase().slice(0, 100));
  if (/class="tumblr_blog"/i.test(html) || categories.includes("reblog")) return null;
  if (categories.some((c) => /^not a (?:shitpost|quote post|meme)\b/.test(c) || NSFW_TAGS.test(c))) return null;
  const media = htmlImages(html);
  const text = htmlText(html);
  // Owner decision (2026-09-16, second pass): memes must carry an image or video, never text alone.
  if (!media.length) return null;
  const tags = topicTags([text], categories);
  if (!isMusic(tags) && !isApothecary(tags)) return null;
  const sections = ["meme"];
  if (isMusic(tags)) sections.push("music");
  if (isApothecary(tags)) sections.push("maomao");
  const parsed = {
    blog: parts.blog,
    id: parts.id,
    url: `https://${WEB}/${parts.blog}/${parts.id}`,
    text,
    media,
    tags: categories.slice(0, 40),
    flags: { labels: [], nsfw: false, communityNsfw: false },
    notes: 0,
    source: null,
    sourceTitle: "",
    publishedAt: raw.published,
  };
  return buildItem(entry, parsed, {
    kind: "meme",
    sections,
    tags,
    formats: memeFormats(text, media),
    title: titleFor(decode(raw.title) || text, `meme from ${parts.blog}`),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Paging (one tag or blog per page, at most two passes over a step's items)

function readCursor(value, steps) {
  const raw = cursorCodec.decode(value, {});
  const byKey = typeof raw.k === "string" ? steps.findIndex((s) => (s.key ?? s.blog) === raw.k) : -1;
  const index = byKey >= 0 ? byKey : Number.isInteger(raw.s) ? raw.s : Number.isInteger(raw.index) ? raw.index : 0;
  const same = byKey >= 0 || !raw.k;
  return {
    index: Math.max(0, index),
    offset: same && Number.isInteger(raw.o) && raw.o > 0 ? raw.o : 0,
    pass: same && Number.isInteger(raw.p) && raw.p > 0 ? raw.p : 0,
  };
}

function page(ctx, steps, state, eligible) {
  const size = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
  eligible.sort((a, b) => b.facts.sourceScore - a.facts.sourceScore || (a.nativeId < b.nativeId ? 1 : -1));
  const items = eligible.slice(state.offset, state.offset + size);
  const more = state.offset + size < eligible.length && state.pass + 1 < MAX_PASSES_PER_STEP;
  const step = steps[state.index];
  const nextStep = steps[state.index + 1];
  const next = more
    ? { k: step.key ?? step.blog, s: state.index, o: state.offset + size, p: state.pass + 1 }
    : { k: nextStep ? (nextStep.key ?? nextStep.blog) : null, s: state.index + 1, o: 0, p: 0 };
  const done = !more && state.index + 1 >= steps.length;
  return { items, cursor: done ? null : cursorCodec.encode(next), done };
}

function anchorMs(day) {
  const end = Date.parse(`${day}T23:59:59.999+08:00`);
  return Number.isFinite(end) ? Math.min(Date.now(), end) : Date.now();
}

function taggedFetcher(id, stepsFor, select) {
  const entry = { id };
  return async function fetchTumblrTagged(ctx) {
    const key = String(ctx.credentials?.TUMBLR_API_KEY ?? "");
    if (!key) throw new FeedError("not_configured", 503);
    const steps = stepsFor(ctx.day);
    const state = readCursor(ctx.cursor, steps);
    if (state.index >= steps.length) return { items: [], cursor: null, done: true };
    const step = steps[state.index];
    const query = new URLSearchParams({ tag: step.tag, limit: "20", npf: "true", api_key: key });
    const body = await ctx.http.json(`https://${API}/v2/tagged?${query}`);
    if (!Array.isArray(body?.response)) throw new FeedError("source_shape", 503);
    const floor = anchorMs(ctx.day) - TUMBLR_CACHE_HOURS * HOUR;
    const seen = new Set();
    const eligible = [];
    for (const post of body.response) {
      const parsed = parseTumblrPost(post);
      if (!parsed || seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      if (parsed.publishedAt && Date.parse(parsed.publishedAt) < floor) continue;
      const item = select(entry, parsed, step);
      if (item) eligible.push(item);
    }
    return page(ctx, steps, state, eligible);
  };
}

async function fetchTumblrMemes(ctx) {
  const entry = { id: "tumblr-memes" };
  const steps = TUMBLR_MEME_BLOGS;
  const state = readCursor(ctx.cursor, steps);
  if (state.index >= steps.length) return { items: [], cursor: null, done: true };
  const blog = steps[state.index];
  const { doc } = await ctx.http.xml(`https://${blog.blog}.tumblr.com/rss`);
  if (!doc?.rss?.channel) throw new FeedError("source_shape", 503);
  const floor = anchorMs(ctx.day) - TUMBLR_CACHE_HOURS * HOUR;
  const seen = new Set();
  const eligible = [];
  for (const raw of feedEntries(doc)) {
    if (raw.published && Date.parse(raw.published) < floor) continue;
    const item = rssMemeItem(entry, blog, raw);
    if (!item || seen.has(item.nativeId)) continue;
    seen.add(item.nativeId);
    eligible.push(item);
  }
  return page(ctx, steps, state, eligible);
}

// ---------------------------------------------------------------------------------------------------------
// Recheck

export async function recheckTumblr(item, ctx) {
  const parts = linkParts(item?.url);
  if (!parts || parts.id !== String(item?.nativeId ?? "")) return { state: "restricted", scope: "unverifiable_id" };
  const key = String(ctx?.credentials?.TUMBLR_API_KEY ?? "");
  if (key) {
    const query = new URLSearchParams({ id: parts.id, npf: "true", api_key: key });
    try {
      const body = await ctx.http.json(`https://${API}/v2/blog/${parts.blog}/posts?${query}`);
      const post = Array.isArray(body?.response?.posts) ? body.response.posts[0] : null;
      if (!post || String(post.id_string ?? post.id) !== parts.id) return { state: "transient", scope: "api_post" };
      const flags = tumblrFlags(post);
      if (flags.nsfw || flags.communityNsfw) return { state: "removed", scope: "ineligible_labels" };
      return { state: "present", scope: "api_post" };
    } catch (error) {
      if (error?.code === "not_found") return { state: "removed", scope: "api_post" };
      return { state: error?.code === "blocked" ? "restricted" : "transient", scope: "api_post" };
    }
  }
  // Keyless: presence in the current RSS window only. Absence is not proof of deletion.
  if (!MEME_BLOG_NAMES.has(parts.blog)) return { state: "transient", scope: "no_api_key" };
  try {
    const { doc } = await ctx.http.xml(`https://${parts.blog}.tumblr.com/rss`);
    const found = feedEntries(doc).some((e) => (linkParts(e.link) ?? linkParts(e.id))?.id === parts.id);
    return { state: found ? "present" : "transient", scope: "rss_window" };
  } catch (error) {
    return { state: error?.code === "blocked" ? "restricted" : "transient", scope: "rss_window" };
  }
}

// ---------------------------------------------------------------------------------------------------------
// Entries

const COMMON = {
  enabled: true,
  hosts: [WEB, API],
  mediaHosts: [MEDIA],
  profileHosts: [WEB],
  linkHosts: TUMBLR_SOURCE_HOSTS,
  maxBytes: 1024 * 1024,
  paceMs: 1500,
  timeoutMs: 15000,
  // The agreement's three-day ceiling; every item also carries expiresAt = fetch time + 72 h.
  cacheSeconds: TUMBLR_CACHE_HOURS * 3600,
  // Source content may not be stored longer than this: payloads expire and saves keep credit + link only.
  retentionHours: TUMBLR_CACHE_HOURS,
  attributionRequired: true,
  mediaPolicy: "moving_sampled",
  // A saved private copy would outlive the three-day storage limit, so saves stay link-only.
  copyPolicy: "link_only",
  deletionPolicy: "honor_deletions",
  deletionDeadlineHours: 24,
  termsUrl: TUMBLR_TERMS_URL,
  docsUrl: DOCS_URL,
  recheck: recheckTumblr,
};
const POLICY_NOTES =
  "Policies from the API License Agreement (read 2026-09-15): credit posting blog + source, link-only saves, expiresAt ≤ 72 h after fetch, deletions/suspensions/sharing changes honoured within 24 h. UI obligations outside this collector: a 'powered by Tumblr' note, no continuous autoplay of GIF sequences, and the agreement's OAuth-login clause (not met by a read-only personal feed; flagged for the owner). Shared gaps: pruneFeeds keeps expired payloads for 14–90 days and save snapshots keep facts/media; both must drop Tumblr content after 72 h.";

export const tumblrMaomao = {
  ...COMMON,
  id: "tumblr-maomao",
  stage: "fetch-b",
  status: "optional",
  sections: ["maomao"],
  requiredCredentials: ["TUMBLR_API_KEY"],
  maxRequests: MAOMAO_TAGS.length * MAX_PASSES_PER_STEP + 1,
  notes: `/v2/tagged (npf=true, 20 posts) for 'the apothecary diaries', 'kusuriya no hitorigoto' and 'maomao' (the last needs an Apothecary Diaries tag or character because the cartoon Mao Mao shares it); posts from the last 72 h with images/GIFs (GIF posters kept). Reblogs, paywalled posts, GIF-search inserts, NSFW/community-labelled posts and posts with an unlinkable stated source are skipped. Kinds image/clip. Live verification pending deployment (key only in Vercel); fixtures are documentation-faithful mocks. ${POLICY_NOTES}`,
  fetch: taggedFetcher("tumblr-maomao", () => MAOMAO_TAGS, selectMaomao),
};
export const tumblrCosplay = {
  ...COMMON,
  id: "tumblr-cosplay",
  stage: "fetch-b",
  status: "optional",
  sections: ["dressup", "maomao", "music"],
  requiredCredentials: ["TUMBLR_API_KEY"],
  maxRequests: (COSPLAY_FIXED_TAGS.length + 2) * MAX_PASSES_PER_STEP + 1,
  notes: `/v2/tagged for 'maomao cosplay', 'hatsune miku cosplay', 'miku cosplay' daily plus two rotating fandom cosplay tags; last 72 h, images only, same skips as tumblr-maomao. Sections: dressup, plus maomao/music on a fandom match. Kind cosplay. Live verification pending deployment. ${POLICY_NOTES}`,
  fetch: taggedFetcher("tumblr-cosplay", tumblrCosplayTags, selectCosplay),
};
export const tumblrMemes = {
  ...COMMON,
  id: "tumblr-memes",
  stage: "fetch-a",
  status: "enabled",
  sections: ["meme", "music", "maomao"],
  hosts: [WEB, API, ...TUMBLR_MEME_BLOGS.map((b) => `${b.blog}.tumblr.com`)],
  requiredCredentials: [],
  optionalCredentials: ["TUMBLR_API_KEY"],
  maxRequests: TUMBLR_MEME_BLOGS.length * MAX_PASSES_PER_STEP + 1,
  notes: `Keyless blog RSS from the allowlist pjsk--shitposts (SEKAI image/text memes) and project-sekai-but-incorrect (incorrect quotes → kind meme, format text_post, quote text in excerpts). Original posts from the last 72 h with a SEKAI/Vocaloid (or Apothecary) tag; reblogs and 'not a shitpost/quote post' posts skipped. URLs canonicalized to www.tumblr.com/<blog>/<id>. Recheck uses the API when TUMBLR_API_KEY reaches recheck (needs jobs.js to pass credentials); otherwise RSS presence → present, absence → transient. ${POLICY_NOTES}`,
  fetch: fetchTumblrMemes,
};
