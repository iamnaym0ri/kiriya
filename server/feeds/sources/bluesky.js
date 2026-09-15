// Bluesky (AT Protocol) collectors: Maomao art/clips, Miku/SEKAI fan art, cosplay, J-fashion looks, memes.
//
// Verified 2026-09-15 (UTC) from a home WSL machine, not from Vercel:
// - docs.bsky.app now 301-redirects to bsky.network/docs. "API Hosts and Auth": api.bsky.app and
//   public.api.bsky.app "do not support authentication"; authenticated app.bsky.* reads go through the
//   account's PDS and are routed by the `atproto-proxy` header (did:web:api.bsky.app#bsky_appview).
//   "PDS Entryway": most application requests "can be sent to either the Entryway or the PDS", so one exact
//   host (bsky.social) serves createSession, refreshSession and authenticated reads. An anonymous
//   GET bsky.social/xrpc/app.bsky.feed.searchPosts answered 401 AuthMissing (RateLimit-Policy 3000;w=300).
// - "Bluesky API" guide: bots and single-purpose tools may use app-password sessions; accessJwt "expires
//   after a few minutes", refreshJwt is used only to refresh. atproto PDS source: an expired access token is
//   HTTP 400 ExpiredToken/InvalidToken, a missing one 401. Rate limits page: createSession 30 per 5 min and
//   300 per day per account; PDS 3000 requests per 5 min per IP.
// - Keyless, spaced 16 s apart: getFeed/getAuthorFeed/getPosts/getFeedGenerators on public.api.bsky.app
//   returned 200 (Cache-Control max-age=30). searchPosts on public.api.bsky.app returned 403; on
//   api.bsky.app 200 for the first page only (a cursor returned 403 "Request forbidden by administrative
//   rules"). `q=#tag` together with `since` returned 400; `q=<word>&tag=<tag>&since=` returned 200.
//   getPosts silently omitted a fabricated rkey from a two-URI batch.
// - Media: embed.images[].fullsize on cdn.bsky.app (image/webp); video playlists on video.bsky.app
//   (application/vnd.apple.mpegurl); the video thumbnail 302-redirects to video.cdn.bsky.app.
// - Developer Guidelines (bsky.network/docs/developer-guidelines) contain no caching or storage restriction
//   and no deadline; they require "a method for deleting content a user has requested to be deleted".
//   Community Guidelines (updated 2025-09-19) forbid bypassing or abusing APIs and rate limits. This module
//   makes no write calls (no posting, following, liking or messaging).
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
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
import { cursor as cursorCodec, toIso } from "./util.js";

const PUBLIC_APPVIEW = "public.api.bsky.app";
const SEARCH_APPVIEW = "api.bsky.app";
const ENTRYWAY = "bsky.social";
const WEB = "bsky.app";
const IMAGE_CDN = "cdn.bsky.app";
const VIDEO = "video.bsky.app";
const VIDEO_CDN = "video.cdn.bsky.app";
const APPVIEW_PROXY = "did:web:api.bsky.app#bsky_appview";
const TERMS_URL = "https://bsky.network/docs/developer-guidelines";
const DOCS_URL = "https://bsky.network/docs/api-directory";
export const BLUESKY_VERIFIED_AT = "2026-09-15T14:33:04Z";

export const BLUESKY_FEEDS = {
  // "Kusuriya no Hitorigoto" by shandrox.bsky.social: "Only showing posts with pics".
  kusuriya: "at://did:plc:knoh46c6xff6lrdcfs2q5y4a/app.bsky.feed.generator/aaaaabqzpdxj4",
  // "Vocaloid" (311 likes); its generator removes NSFW-labelled images. Creator handle is currently invalid.
  vocaloid: "at://did:plc:bw7yi2j5f7ndhemwcleiblis/app.bsky.feed.generator/aaaixmavfk7jw",
  // "Project Sekai" (265 likes), same generator. The "Project Sekai - Latest" feed (aaamthrewdbhi) is not
  // used: its sample matched news and traffic posts ("Shai", road "N25") and an official-card-art bot.
  sekai: "at://did:plc:bw7yi2j5f7ndhemwcleiblis/app.bsky.feed.generator/aaaixpmeevmx6",
};
// Checked 2026-09-15: all three posted within the last week, no labels on sampled posts, no politics in text.
export const BLUESKY_MEME_ACCOUNTS = ["wholesomememe.bsky.social", "adhdforreal.bsky.social", "murmurlilies.bsky.social"];

// Early skip. A superset of rules.js BAD_LABELS: Bluesky moderation values, imperative `!` labels and the
// `bot` self-label. Negated labels are ignored rather than allowed to cancel an earlier label.
export const DISALLOWED_LABELS = new Set([
  "porn",
  "sexual",
  "sexual-figurative",
  "nudity",
  "graphic-media",
  "gore",
  "corpse",
  "self-harm",
  "sensitive",
  "intolerant",
  "threat",
  "rude",
  "spam",
  "impersonation",
  "misleading",
  "extremist",
  "!hide",
  "!warn",
  "!takedown",
  "!suspend",
  "!no-unauthenticated",
  "!no-promote",
  "bot",
]);

/** Test-tunable pacing: keyless searches share one gap across every Bluesky entry in the process. */
export const BLUESKY_PACING = { keylessSearchGapMs: 15_000 };

const HOUR = 3_600_000;
const SESSION_SKEW_MS = 60_000;
const ACCESS_FALLBACK_MS = 5 * 60_000;
const REFRESH_FALLBACK_MS = 24 * HOUR;
const AUTH_FAILURE_COOLDOWN_MS = 10 * 60_000;
const MAX_PASSES_PER_STEP = 2;
const REAUTH_CODES = new Set(["blocked", "source_http_400"]);
const POST_URI = /^at:\/\/(did:[a-z0-9]+:[A-Za-z0-9._:%-]{1,200})\/app\.bsky\.feed\.post\/([A-Za-z0-9._~:-]{1,512})$/;
const HANDLE = /^(?=.{3,100}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const CID = /^[a-z0-9]{20,120}$/i;

// ---------------------------------------------------------------------------------------------------------
// Session: module-private, reused within the process until expiry. Tokens never leave this closure.

const sessions = new Map();
let lastKeylessSearch = 0;

/** Test helper: forget cached sessions, failure cooldowns and keyless pacing state. */
export function resetBlueskySessions() {
  sessions.clear();
  lastKeylessSearch = 0;
}

function credentialsOf(ctx) {
  const identifier = String(ctx?.credentials?.BLUESKY_HANDLE ?? "").trim().replace(/^@/, "");
  const password = String(ctx?.credentials?.BLUESKY_APP_PASSWORD ?? "");
  return identifier && password ? { identifier, password } : null;
}
const credentialKey = ({ identifier, password }) =>
  createHash("sha256").update(`${identifier.toLowerCase()}\u0000${password}`).digest("hex");

function jwtExpiry(token, fallbackMs) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1] ?? "", "base64url").toString("utf8"));
    if (Number.isFinite(payload?.exp)) return payload.exp * 1000;
  } catch {
    // Opaque token: fall back to the documented "few minutes" lifetime.
  }
  return Date.now() + fallbackMs;
}

function sessionFrom(response) {
  let data;
  try {
    data = JSON.parse(response.buffer.toString("utf8"));
  } catch {
    throw new FeedError("bluesky_session_invalid", 503);
  }
  const valid =
    typeof data?.accessJwt === "string" &&
    typeof data?.refreshJwt === "string" &&
    data.accessJwt.length > 0 &&
    data.accessJwt.length < 8192 &&
    data.refreshJwt.length > 0 &&
    data.refreshJwt.length < 8192 &&
    /^did:[a-z0-9]+:/.test(String(data?.did ?? ""));
  if (!valid) throw new FeedError("bluesky_session_invalid", 503);
  // A deactivated, suspended or taken-down account is a configuration problem, not an empty page.
  if (data.active === false) throw new FeedError("blocked", 403);
  // Only the fields below are kept; email and DID documents in the response are discarded.
  return {
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    accessExp: jwtExpiry(data.accessJwt, ACCESS_FALLBACK_MS),
    refreshExp: jwtExpiry(data.refreshJwt, REFRESH_FALLBACK_MS),
  };
}

async function createSession(ctx, creds) {
  const body = JSON.stringify({ identifier: creds.identifier, password: creds.password });
  let response;
  try {
    response = await ctx.http.request(xrpcUrl(ENTRYWAY, "com.atproto.server.createSession"), {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) },
    });
  } catch (error) {
    // 400 (bad identifier) and 401 (wrong app password, 2FA required) are credential problems.
    if (error?.code === "source_http_400") throw new FeedError("blocked", 403);
    throw error;
  }
  return sessionFrom(response);
}

async function refreshSession(ctx, current) {
  const response = await ctx.http.request(xrpcUrl(ENTRYWAY, "com.atproto.server.refreshSession"), {
    method: "POST",
    headers: { authorization: `Bearer ${current.refreshJwt}`, "content-length": "0" },
  });
  return sessionFrom(response);
}

async function session(ctx, creds, stale = null) {
  const key = credentialKey(creds);
  let slot = sessions.get(key);
  if (!slot) sessions.set(key, (slot = { current: null, pending: null, blockedUntil: 0 }));
  if (slot.pending) return slot.pending;
  if (slot.blockedUntil > Date.now()) throw new FeedError("blocked", 403);
  const current = slot.current;
  if (current && current !== stale && current.accessExp - SESSION_SKEW_MS > Date.now()) return current;
  slot.pending = (async () => {
    try {
      let next = null;
      if (current && current.refreshExp - SESSION_SKEW_MS > Date.now()) {
        try {
          next = await refreshSession(ctx, current);
        } catch (error) {
          if (!REAUTH_CODES.has(error?.code)) throw error;
        }
      }
      next ??= await createSession(ctx, creds);
      slot.current = next;
      return next;
    } catch (error) {
      slot.current = null;
      // Do not retry a rejected login on every page; createSession is limited to 30 per 5 minutes.
      if (error?.code === "blocked") slot.blockedUntil = Date.now() + AUTH_FAILURE_COOLDOWN_MS;
      throw error;
    } finally {
      slot.pending = null;
    }
  })();
  return slot.pending;
}

const authHeaders = (accessJwt) => ({ authorization: `Bearer ${accessJwt}`, "atproto-proxy": APPVIEW_PROXY });

async function authedJson(ctx, creds, url) {
  const current = await session(ctx, creds);
  try {
    return await ctx.http.json(url, { headers: authHeaders(current.accessJwt) });
  } catch (error) {
    // Expired/invalid access tokens are 400 ExpiredToken/InvalidToken (or 401): refresh once, retry once.
    if (!REAUTH_CODES.has(error?.code)) throw error;
    const next = await session(ctx, creds, current);
    return ctx.http.json(url, { headers: authHeaders(next.accessJwt) });
  }
}

async function keylessSearchGap(ctx) {
  const wait = Math.max(0, lastKeylessSearch + BLUESKY_PACING.keylessSearchGapMs - Date.now());
  if (wait > 0) {
    if (Date.now() + wait + 250 >= ctx.deadline) throw new FeedError("deadline", 409);
    await sleep(wait, undefined, ctx.signal ? { signal: ctx.signal } : undefined);
  }
  lastKeylessSearch = Date.now();
}

function xrpcUrl(host, nsid, params = []) {
  const query = new URLSearchParams(params).toString();
  return `https://${host}/xrpc/${nsid}${query ? `?${query}` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------
// Post parsing

const labelValues = (labels) => [
  ...new Set(
    (Array.isArray(labels) ? labels : [])
      .filter((l) => l && typeof l.val === "string" && !l.neg)
      .map((l) => l.val.toLowerCase().slice(0, 100)),
  ),
];

export function clipText(value, max) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 1);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  const soft = cut.replace(/\s+\S*$/, "");
  return `${soft.length >= max * 0.6 ? soft : cut}…`;
}

function dimension(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 30000 ? n : null;
}

function imageMedia(image, did) {
  let url;
  try {
    url = new URL(image?.fullsize);
  } catch {
    return null;
  }
  const prefix = `/img/feed_fullsize/plain/${did}/`;
  if (url.protocol !== "https:" || url.hostname !== IMAGE_CDN || !url.pathname.startsWith(prefix)) return null;
  const cid = url.pathname.slice(prefix.length).replace(/@(?:jpeg|png|webp)$/, "");
  return {
    type: "image",
    url: url.href,
    width: dimension(image.aspectRatio?.width),
    height: dimension(image.aspectRatio?.height),
    alt: clipText(image.alt, 500),
    ...(CID.test(cid) ? { identity: cid } : {}),
  };
}

function videoMedia(video) {
  let playlist, poster;
  try {
    playlist = new URL(video?.playlist);
  } catch {
    return null;
  }
  if (playlist.protocol !== "https:" || playlist.hostname !== VIDEO || !playlist.pathname.endsWith("/playlist.m3u8"))
    return null;
  try {
    const thumb = new URL(video.thumbnail);
    if (thumb.protocol === "https:" && thumb.hostname === VIDEO) poster = thumb.href;
  } catch {
    poster = null;
  }
  return {
    type: "hls",
    url: playlist.href,
    poster: poster ?? null,
    width: dimension(video.aspectRatio?.width),
    height: dimension(video.aspectRatio?.height),
    alt: clipText(video.alt, 500),
    ...(CID.test(String(video.cid ?? "")) ? { identity: video.cid } : {}),
  };
}

/** Normalized view of a post with everything the entry selectors need; null when unusable. */
export function parseBlueskyPost(post, reason = null) {
  const match = POST_URI.exec(String(post?.uri ?? ""));
  const author = post?.author;
  const record = post?.record;
  if (!match || !author || match[1] !== author.did || !record || typeof record !== "object") return null;
  let embed = post.embed ?? null;
  const quote = embed?.$type === "app.bsky.embed.record#view";
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view") embed = embed.media;
  const media = [];
  let gif = false;
  if (embed?.$type === "app.bsky.embed.images#view")
    for (const image of (embed.images ?? []).slice(0, 4)) {
      const m = imageMedia(image, author.did);
      if (m) media.push(m);
    }
  if (embed?.$type === "app.bsky.embed.video#view") {
    const m = videoMedia(embed);
    if (m) media.push(m);
    gif = embed.presentation === "gif";
  }
  const features = (Array.isArray(record.facets) ? record.facets : []).flatMap((f) =>
    Array.isArray(f?.features) ? f.features : [],
  );
  const hashtags = [
    ...new Set(
      [
        ...features.filter((f) => f?.$type === "app.bsky.richtext.facet#tag").map((f) => f.tag),
        ...(Array.isArray(record.tags) ? record.tags : []),
      ]
        .filter((t) => typeof t === "string")
        .map((t) => t.replace(/^#/, "").trim().toLowerCase().slice(0, 100))
        .filter(Boolean),
    ),
  ].slice(0, 40);
  const handle = HANDLE.test(String(author.handle ?? "")) && author.handle !== "handle.invalid" ? author.handle.toLowerCase() : null;
  const actor = handle ?? author.did;
  const indexedAt = toIso(post.indexedAt) ?? toIso(record.createdAt);
  return {
    uri: post.uri,
    rkey: match[2],
    did: author.did,
    handle,
    displayName: clipText(author.displayName, 200),
    profileUrl: `https://${WEB}/profile/${actor}`,
    url: `https://${WEB}/profile/${actor}/post/${match[2]}`,
    text: typeof record.text === "string" ? record.text : "",
    langs: Array.isArray(record.langs) ? record.langs.filter((l) => typeof l === "string") : [],
    reply: Boolean(record.reply),
    repost: typeof reason?.$type === "string" && reason.$type.includes("reasonRepost"),
    quote,
    external: embed?.$type === "app.bsky.embed.external#view",
    hasLinks: features.some((f) => f?.$type === "app.bsky.richtext.facet#link"),
    hashtags,
    postLabels: labelValues(post.labels),
    authorLabels: labelValues(author.labels),
    media,
    gif,
    likes: Math.max(0, Number(post.likeCount) || 0),
    reposts: Math.max(0, Number(post.repostCount) || 0),
    quotes: Math.max(0, Number(post.quoteCount) || 0),
    indexedAt,
    indexedAtMs: indexedAt ? Date.parse(indexedAt) : 0,
  };
}

export const hasDisallowedLabel = (cand) =>
  [...cand.postLabels, ...cand.authorLabels].some((l) => DISALLOWED_LABELS.has(l));

// Compact hashtags mapped onto existing tags.js aliases (never onto new tag names).
const COMPACT_TAGS = {
  apothecarydiaries: "apothecary diaries",
  theapothecarydiaries: "the apothecary diaries",
  kusuriyanohitorigoto: "kusuriya no hitorigoto",
  "薬屋": "薬屋のひとりごと",
  maomao: "maomao",
  jinshi: "jinshi",
  hatsunemiku: "hatsune miku",
  mikuhatsune: "hatsune miku",
  miku: "miku",
  kagaminerin: "kagamine rin",
  kagaminelen: "kagamine len",
  megurineluka: "megurine luka",
  kasaneteto: "kasane teto",
  teto: "teto",
  vocaloid: "vocaloid",
  projectsekai: "project sekai",
  "プロセカ": "project sekai",
  prsk: "prsk",
  pjsk: "pjsk",
  niigo: "25ji",
  wxs: "wxs",
  vbs: "vbs",
  leoneed: "leoneed",
  mmj: "mmj",
  genshin: "genshin",
  genshinimpact: "genshin impact",
  honkaistarrail: "honkai: star rail",
  hsr: "hsr",
  frieren: "frieren",
  sousounofrieren: "sousou no frieren",
  witchhatatelier: "witch hat atelier",
  tongariboushinoatelier: "tongari boushi no atelier",
  bungostraydogs: "bungo stray dogs",
  bungoustraydogs: "bungou stray dogs",
  oshinoko: "oshi no ko",
  bocchitherock: "bocchi the rock",
  girlsbandcry: "girls band cry",
  minecraft: "minecraft",
};
const TAG_SUFFIXES = ["cosplayer", "cosplay", "fanart", "_fa", "fa", "art", "memes", "meme"];

function expandHashtag(tag) {
  const direct = COMPACT_TAGS[tag] ?? tag.replaceAll("_", " ");
  const phrases = [direct];
  for (const suffix of TAG_SUFFIXES)
    if (tag.length > suffix.length + 1 && tag.endsWith(suffix)) {
      const base = tag.slice(0, -suffix.length).replace(/_+$/, "");
      if (COMPACT_TAGS[base]) phrases.push(COMPACT_TAGS[base]);
    }
  return phrases;
}

const MOMENTS = [
  ["poison", /\bpoison/i],
  ["herbs", /\bherb/i],
  ["disgusted face", /\bdisgust/i],
  ["verdigris house", /verdigris/i],
];

export function topicTags(texts, hashtags = []) {
  const phrases = hashtags.flatMap(expandHashtag);
  const haystack = [...texts, ...phrases].join("\n");
  const characters = [...new Set([...canonicalCharacters(phrases), ...mentions(haystack, CHARACTER_ALIASES)])];
  const fandoms = [...new Set([...canonicalFandoms(phrases), ...mentions(haystack, FANDOM_ALIASES)])];
  const units = [...new Set([...canonicalUnits(phrases), ...mentions(haystack, UNIT_ALIASES)])];
  const voicebanks = characters.filter((c) => VOICEBANKS.includes(c));
  const apothecary = characters.includes("maomao") || fandoms.includes("the apothecary diaries");
  const topics = apothecary ? MOMENTS.filter(([, re]) => re.test(haystack)).map(([t]) => t) : [];
  return { characters, fandoms, voicebanks, units, formats: [], topics };
}
const isApothecary = (t) => t.characters.includes("maomao") || t.fandoms.includes("the apothecary diaries");
const isMusic = (t) =>
  t.voicebanks.length > 0 || t.units.length > 0 || t.fandoms.includes("vocaloid") || t.fandoms.includes("project sekai");

// Early text cues. Decisions stay in rules.js/moderate.js; these only avoid spending checks on obvious misses.
const REPOST_CUES =
  /\b(?:credits?|source|src|artist|art by|reposted?|reposting|cr)\s*[:：]|\bvia @|\bnot (?:mine|my (?:art|photo))\b|\b(?:art(?:work)?|illustration|drawing)\s+(?:provided\s+)?(?:by|from)\s+(?!me\b|my\b)/i;
// Merch announcements and trades are collected by the merch sources, not as fan art or looks.
const MERCH_CUES =
  /\b(?:nendoroids?|figma|prize figures?|scale figures?|figure update|prototype|pre-?orders?|restock|merch|acrylic stands?|keychains?|plush(?:ies)?)\b|予約|グッズ/i;
const TRADE_CUES =
  /【(?:交換|譲|求)】|\bWT[SBT]\b|\bfor sale\b|\bselling\b|\b(?:sales?|shop|store|pre-?orders?)\s+(?:are\s+|is\s+)?(?:now\s+)?(?:open|opening|live)\b/i;
// Accounts that label themselves adult in their name or handle are skipped even when a post is unlabelled.
const ADULT_PROFILE = /🔞|\bnsfw\b|18\+|\br-?18\b|\blewd\b|\bhentai\b|\bonlyfans\b|\bfansly\b/i;
const ADULT_CUES =
  /\b(?:nsfw|lewd|spicy|thirst\w*|boudoir|lingerie|onlyfans|fansly|fanvue|gumroad|patreon|boosty|throne|jiggle|bouncy|bikini|swimsuit|ecchi|hentai|r-?18)\b|18\+|thigh\s*(?:crusher|highs?)/i;
const AD_TAGS = new Set(["ad", "ads", "sponsored", "affiliate", "promo", "promosky"]);
const OFFICIAL_CARD_ART = /\b\d☆\s*\((?:un)?trained\)|\(cameo\)\s*$/i;
const MEME_CUES = /\b(?:memes?|shitpost\w*|me when|pov|be like|nobody:|no one:|mfw|tfw|incorrect quotes?)\b/i;

function titleFor(cand, fallback) {
  // Trailing hashtag runs are dropped; inline hashtags keep their word ("some #maomao" → "some maomao").
  const line = cand.text
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/(?:\s*#[^\s#]+)+\s*$/u, "")
        .replace(/(^|\s)#([^\s#]+)/gu, "$1$2")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .find(Boolean);
  const alt = cand.media.map((m) => m.alt.split(/\n+/)[0]?.trim()).find(Boolean);
  return clipText(line || alt || fallback, 120) || fallback;
}

function namedCredits(text) {
  const names = [];
  for (const re of [
    /\bcosplay(?:er)?\s*(?:by|:)\s*@?[\p{L}\p{N}._-]{2,60}/giu,
    /\b(?:photos?|photography|shot|ph)\s*(?:by|:)\s*@?[\p{L}\p{N}._-]{2,60}/giu,
  ])
    for (const m of text.matchAll(re)) names.push(clipText(m[0], 100));
  return [...new Set(names)].slice(0, 4);
}

function baseItem(entry, cand, { kind, sections, tags, title, extraExcerpts = [] }) {
  const excerpts = [cand.text.trim(), ...cand.media.map((m) => m.alt), ...extraExcerpts]
    .map((t) => clipText(t, 600))
    .filter(Boolean);
  const sourceTags = [...cand.hashtags, ...(cand.gif ? ["presentation:gif"] : [])].slice(0, 40);
  return {
    source: entry.id,
    nativeId: cand.uri,
    sections: [...new Set(sections)],
    kind,
    title,
    url: cand.url,
    media: cand.media,
    credit: {
      name: cand.displayName || cand.handle || cand.did,
      handle: (cand.handle ?? cand.did).slice(0, 100),
      profileUrl: cand.profileUrl,
      platform: "Bluesky",
    },
    tags,
    facts: {
      excerpts: [...new Set(excerpts)].slice(0, 3),
      names: namedCredits(cand.text),
      sourceScore: cand.likes + cand.reposts + cand.quotes,
      lang: cand.langs.some((l) => /^ja\b/i.test(l)) ? "ja" : "",
    },
    safety: {
      rating: "unknown",
      labels: [...new Set([...cand.postLabels, ...cand.authorLabels])].slice(0, 40),
      sourceTags,
      nsfw: false,
      deleted: false,
      removed: false,
      communityNsfw: false,
    },
    publishedAt: cand.indexedAt,
    ...(cand.media[0]?.identity ? { mediaIdentity: cand.media[0].identity } : {}),
  };
}

function commonSkip(cand) {
  return (
    !cand ||
    cand.reply ||
    cand.repost ||
    hasDisallowedLabel(cand) ||
    ADULT_PROFILE.test(`${cand.displayName} ${cand.handle ?? ""}`)
  );
}

// ---------------------------------------------------------------------------------------------------------
// Entry selectors

function selectMaomao(entry, cand) {
  if (commonSkip(cand) || !cand.media.length || cand.hasLinks || REPOST_CUES.test(cand.text)) return null;
  if (TRADE_CUES.test(cand.text)) return null;
  const tags = topicTags([cand.text, ...cand.media.map((m) => m.alt)], cand.hashtags);
  if (!isApothecary(tags)) return null;
  const moving = cand.media.some((m) => m.type === "hls");
  return baseItem(entry, cand, {
    kind: moving ? "clip" : "image",
    sections: ["maomao"],
    tags,
    title: titleFor(cand, `maomao post by @${cand.handle ?? "bluesky"}`),
  });
}

function selectArt(entry, cand) {
  if (commonSkip(cand) || cand.hasLinks || REPOST_CUES.test(cand.text) || OFFICIAL_CARD_ART.test(cand.text)) return null;
  if (!cand.media.length || cand.media.some((m) => m.type !== "image")) return null;
  if (cand.hashtags.some((t) => AD_TAGS.has(t)) || MERCH_CUES.test(cand.text) || TRADE_CUES.test(cand.text)) return null;
  // Cosplay photos are collected by bluesky-cosplay, not as fan art.
  if (/cosplay|コスプレ/i.test([cand.text, cand.hashtags.join(" ")].join(" "))) return null;
  const tags = topicTags([cand.text, ...cand.media.map((m) => m.alt)], cand.hashtags);
  if (!isMusic(tags)) return null;
  return baseItem(entry, cand, {
    kind: "image",
    sections: ["music"],
    tags,
    title: titleFor(cand, `vocaloid art by @${cand.handle ?? "bluesky"}`),
  });
}

const COSPLAY_FORMAT_CUES = [
  ["wip", /\bwip\b|cosplaywip/i],
  ["wig", /\bwigs?\b/i],
  ["makeup", /\bmake-?up\b/i],
  ["props", /\bprops?\b/i],
  ["photoshoot", /photo ?shoot|photograph|📸|\bshot by\b|\bphotos? by\b/i],
  ["transformation", /transformation/i],
  ["tutorial", /tutorial/i],
];

function selectCosplay(entry, cand) {
  if (commonSkip(cand) || !cand.media.length || REPOST_CUES.test(cand.text)) return null;
  const all = [cand.text, ...cand.media.map((m) => m.alt), cand.hashtags.join(" ")].join("\n");
  if (ADULT_CUES.test(all) || TRADE_CUES.test(cand.text) || cand.hashtags.some((t) => AD_TAGS.has(t))) return null;
  if (!/cosplay|コスプレ|cosplayer/i.test(all)) return null;
  const tags = topicTags([cand.text, ...cand.media.map((m) => m.alt)], cand.hashtags);
  tags.formats = COSPLAY_FORMAT_CUES.filter(([, re]) => re.test(all)).map(([f]) => f);
  const sections = ["dressup"];
  if (isApothecary(tags)) sections.push("maomao");
  if (isMusic(tags)) sections.push("music");
  return baseItem(entry, cand, {
    kind: "cosplay",
    sections,
    tags,
    title: titleFor(cand, `cosplay by @${cand.handle ?? "bluesky"}`),
  });
}

function fashionStyles(cand) {
  const tags = new Set(cand.hashtags);
  const text = cand.text;
  const styles = [];
  if ([...tags].some((t) => /^y2k/.test(t)) || /\by2k\b/i.test(text)) styles.push("y2k");
  if ([...tags].some((t) => /^(?:skater|skate)(?:style|fashion|girl|streetwear)?$/.test(t)) || /\bskater\b/i.test(text))
    styles.push("skater streetwear");
  if (tags.has("sweetlolita") || /\bsweet lolita\b/i.test(text)) styles.push("sweet");
  if (tags.has("girlykei") || /\bgirly kei\b/i.test(text)) styles.push("girly");
  return styles;
}

function selectFashion(entry, cand) {
  if (commonSkip(cand) || !cand.media.length || cand.hasLinks || REPOST_CUES.test(cand.text)) return null;
  const all = [cand.text, ...cand.media.map((m) => m.alt), cand.hashtags.join(" ")].join("\n");
  if (ADULT_CUES.test(all) || TRADE_CUES.test(cand.text) || cand.hashtags.some((t) => AD_TAGS.has(t))) return null;
  const tags = topicTags([cand.text, ...cand.media.map((m) => m.alt)], cand.hashtags);
  tags.formats = fashionStyles(cand);
  return baseItem(entry, cand, {
    kind: "look",
    sections: ["dressup"],
    tags,
    title: titleFor(cand, `j-fashion look by @${cand.handle ?? "bluesky"}`),
  });
}

function memeFormats(cand) {
  const text = cand.text;
  const formats = [];
  if (/(^|\n)\s*pov\b|\bpov:/i.test(text)) formats.push("pov");
  if (/\bme when\b/i.test(text)) formats.push("me_when");
  if (!cand.media.length) formats.push("text_post");
  if (/\bcomics?\b/i.test(text) || cand.hashtags.some((t) => /comic/.test(t))) formats.push("comic");
  return formats;
}

function selectMeme(entry, cand, step) {
  if (commonSkip(cand) || cand.quote || cand.external) return null;
  const all = [cand.text, ...cand.media.map((m) => m.alt), cand.hashtags.join(" ")].join("\n");
  if (ADULT_CUES.test(all) || cand.hashtags.some((t) => AD_TAGS.has(t))) return null;
  // Text-only memes come only from allowlisted accounts and must carry their text (no links or quotes).
  const textPost = !cand.media.length && !cand.hasLinks && cand.text.trim().length >= 20 && cand.text.length <= 600;
  if (!cand.media.length && !(step.allowlisted && textPost)) return null;
  if (!step.allowlisted && !(MEME_CUES.test(all) || cand.hashtags.some((t) => /meme|shitpost/.test(t)))) return null;
  const tags = topicTags([cand.text, ...cand.media.map((m) => m.alt)], cand.hashtags);
  tags.formats = memeFormats(cand);
  const sections = ["meme"];
  if (isApothecary(tags)) sections.push("maomao");
  if (isMusic(tags)) sections.push("music");
  return baseItem(entry, cand, {
    kind: "meme",
    sections,
    tags,
    title: titleFor(cand, `meme from @${cand.handle ?? "bluesky"}`),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Query plans. Every page runs one step; the cursor rotates through steps (and at most one extra pass over a
// step's remaining items). Searches never send a cursor.

const feed = (key, uri, extra = {}) => ({ key, type: "feed", feed: uri, limit: 50, windowHours: 72, ...extra });
const author = (actor, extra = {}) => ({
  key: `author-${actor.split(".")[0]}`,
  type: "author",
  actor,
  filter: "posts_no_replies",
  limit: 30,
  windowHours: 72,
  allowlisted: true,
  ...extra,
});
const search = (key, q, extra = {}) => ({ key, type: "search", q, sort: "top", limit: 50, ...extra });

export const MAOMAO_STEPS = [
  feed("feed-kusuriya", BLUESKY_FEEDS.kusuriya),
  search("q-maomao-fanart", "maomao fanart", { sinceHours: 48 }),
  search("q-tag-maomao", "#maomao", { sort: "latest", windowHours: 48 }),
  search("q-maomao-ja", "猫猫 薬屋のひとりごと", { sinceHours: 48 }),
  search("q-tag-apothecarydiaries", "#apothecarydiaries", { sort: "latest", windowHours: 48, auth: "required" }),
];
export const ART_STEPS = [
  feed("feed-vocaloid", BLUESKY_FEEDS.vocaloid),
  feed("feed-sekai", BLUESKY_FEEDS.sekai),
  search("q-tag-prsk-fa", "#prsk_FA", { sort: "latest", windowHours: 48, auth: "required" }),
  search("q-tag-hatsunemiku", "#hatsunemiku", { sort: "latest", windowHours: 48, auth: "required" }),
  search("q-tag-hatsunemiku-ja", "#初音ミク", { sort: "latest", windowHours: 48, auth: "required" }),
  search("q-tag-kasaneteto", "#kasaneteto", { sort: "latest", windowHours: 48, auth: "required" }),
];
// PIPELINE §5.3 queries. Plain-word queries use a server-side 48 h `since`; hashtag queries cannot combine
// with `since` (400), so they use sort=latest and a 48 h window in code.
export const COSPLAY_FIXED_STEPS = [
  search("q-tag-mikucosplay", "#mikucosplay", { sort: "latest", windowHours: 48 }),
  search("q-miku-cosplay", "miku cosplay", { sinceHours: 48 }),
  search("q-maomao-cosplay", "cosplay", { tag: "maomao", sort: "latest", sinceHours: 48 }),
  search("q-maomao-cosplay-ja", "猫猫 コスプレ", { sort: "latest", sinceHours: 48 }),
  search("q-miku-cosplay-ja", "初音ミク コスプレ", { sort: "latest", sinceHours: 48 }),
];
export const COSPLAY_ROTATING_STEPS = [
  "project sekai cosplay",
  "genshin cosplay",
  "frieren cosplay",
  "fern cosplay",
  "witch hat atelier cosplay",
  "bungo stray dogs cosplay",
  "honkai star rail cosplay",
  "cosplay singapore",
].map((q) => search(`q-${q.replace(/\s+/g, "-")}`, q, { sinceHours: 48 }));
// Active J-fashion tags on 2026-09-15. #skaterfashion (7 posts ever, shops) and #girlykei (one author with
// !no-unauthenticated) were rejected; styles are refined later by the vision check.
export const FASHION_STEPS = ["lolitafashion", "jfashion", "sweetlolita", "y2kfashion", "harajukufashion"].map((t) =>
  search(`q-tag-${t}`, `#${t}`, { sort: "latest", windowHours: 168 }),
);
export const MEME_STEPS = [
  ...BLUESKY_MEME_ACCOUNTS.map((a) => author(a)),
  feed("feed-kusuriya-memes", BLUESKY_FEEDS.kusuriya),
  feed("feed-sekai-memes", BLUESKY_FEEDS.sekai),
  feed("feed-vocaloid-memes", BLUESKY_FEEDS.vocaloid),
];

const dayNumber = (day) => {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
};
export function cosplaySteps(day) {
  const n = COSPLAY_ROTATING_STEPS.length;
  const d = dayNumber(day);
  const picks = [...new Set([d % n, (d + Math.floor(n / 2)) % n])];
  return [...COSPLAY_FIXED_STEPS, ...picks.map((i) => COSPLAY_ROTATING_STEPS[i])];
}

/** Windows are anchored to the build day (never later than its Singapore midnight). */
function anchorMs(day) {
  const end = Date.parse(`${day}T23:59:59.999+08:00`);
  return Number.isFinite(end) ? Math.min(Date.now(), end) : Date.now();
}

async function loadStep(ctx, step) {
  const creds = credentialsOf(ctx);
  // With credentials every read goes through the entryway proxy; without, the keyless AppView hosts.
  async function read(keylessHost, nsid, params) {
    if (creds) return authedJson(ctx, creds, xrpcUrl(ENTRYWAY, nsid, params));
    if (keylessHost === SEARCH_APPVIEW) await keylessSearchGap(ctx);
    return ctx.http.json(xrpcUrl(keylessHost, nsid, params));
  }
  if (step.type === "feed") {
    const body = await read(PUBLIC_APPVIEW, "app.bsky.feed.getFeed", [
      ["feed", step.feed],
      ["limit", String(step.limit)],
    ]);
    if (!Array.isArray(body?.feed)) throw new FeedError("source_shape", 503);
    return body.feed.map((e) => ({ post: e?.post, reason: e?.reason ?? null }));
  }
  if (step.type === "author") {
    const body = await read(PUBLIC_APPVIEW, "app.bsky.feed.getAuthorFeed", [
      ["actor", step.actor],
      ["filter", step.filter],
      ["limit", String(step.limit)],
    ]);
    if (!Array.isArray(body?.feed)) throw new FeedError("source_shape", 503);
    return body.feed.map((e) => ({ post: e?.post, reason: e?.reason ?? null }));
  }
  const params = [
    ["q", step.q],
    ["sort", step.sort],
    ["limit", String(step.limit)],
  ];
  if (step.tag) params.push(["tag", step.tag]);
  if (step.sinceHours)
    params.push(["since", new Date(anchorMs(ctx.day) - step.sinceHours * HOUR).toISOString().replace(/\.\d{3}Z$/, "Z")]);
  const body = await read(SEARCH_APPVIEW, "app.bsky.feed.searchPosts", params);
  if (!Array.isArray(body?.posts)) throw new FeedError("source_shape", 503);
  return body.posts.map((post) => ({ post, reason: null }));
}

function readCursor(value, steps) {
  const raw = cursorCodec.decode(value, {});
  let index = Number.isInteger(raw.s) ? raw.s : Number.isInteger(raw.index) ? raw.index : 0;
  const byKey = typeof raw.k === "string" ? steps.findIndex((s) => s.key === raw.k) : -1;
  if (byKey >= 0) index = byKey;
  const sameStep = byKey >= 0 || !raw.k;
  return {
    index: Math.max(0, index),
    offset: sameStep && Number.isInteger(raw.o) && raw.o > 0 ? raw.o : 0,
    pass: sameStep && Number.isInteger(raw.p) && raw.p > 0 ? raw.p : 0,
  };
}

function planFetcher(id, stepsFor, select) {
  const entry = { id };
  return async function fetchBlueskyPage(ctx) {
    const authed = Boolean(credentialsOf(ctx));
    const steps = stepsFor(ctx.day).filter((s) => s.auth !== "required" || authed);
    const size = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
    const state = readCursor(ctx.cursor, steps);
    if (state.index >= steps.length) return { items: [], cursor: null, done: true };
    const step = steps[state.index];
    const rows = await loadStep(ctx, step);
    const floor = step.windowHours ? anchorMs(ctx.day) - step.windowHours * HOUR : -Infinity;
    const seen = new Set();
    const eligible = [];
    for (const { post, reason } of rows) {
      if (!post?.uri || seen.has(post.uri)) continue;
      seen.add(post.uri);
      const cand = parseBlueskyPost(post, reason);
      if (!cand || cand.indexedAtMs < floor) continue;
      const item = select(entry, cand, step);
      if (item) eligible.push(item);
    }
    eligible.sort((a, b) => b.facts.sourceScore - a.facts.sourceScore || (a.nativeId < b.nativeId ? -1 : 1));
    const items = eligible.slice(state.offset, state.offset + size);
    const more = state.offset + size < eligible.length && state.pass + 1 < MAX_PASSES_PER_STEP;
    const next = more
      ? { k: step.key, s: state.index, o: state.offset + size, p: state.pass + 1 }
      : { k: steps[state.index + 1]?.key ?? null, s: state.index + 1, o: 0, p: 0 };
    const done = !more && state.index + 1 >= steps.length;
    return { items, cursor: done ? null : cursorCodec.encode(next), done };
  };
}

// ---------------------------------------------------------------------------------------------------------
// Recheck: batched app.bsky.feed.getPosts (≤25 URIs) on the keyless cached AppView.

export async function recheckBlueskyMany(items, ctx) {
  const verdicts = new Array(items.length);
  const valid = [];
  items.forEach((item, i) => {
    if (POST_URI.test(String(item?.nativeId ?? ""))) valid.push(i);
    else verdicts[i] = { state: "restricted", scope: "unverifiable_id" };
  });
  for (let start = 0; start < valid.length; start += 25) {
    const batch = valid.slice(start, start + 25);
    const params = batch.map((i) => ["uris", items[i].nativeId]);
    try {
      const body = await ctx.http.json(xrpcUrl(PUBLIC_APPVIEW, "app.bsky.feed.getPosts", params));
      if (!Array.isArray(body?.posts)) throw new FeedError("source_shape", 503);
      const found = new Map(body.posts.filter((p) => p?.uri).map((p) => [p.uri, p]));
      for (const i of batch) {
        const post = found.get(items[i].nativeId);
        if (!post) verdicts[i] = { state: "removed", scope: "post" };
        else {
          const cand = parseBlueskyPost(post);
          verdicts[i] =
            cand && hasDisallowedLabel(cand)
              ? { state: "removed", scope: "ineligible_labels" }
              : { state: "present", scope: "post" };
        }
      }
    } catch (error) {
      const state = error?.code === "blocked" ? "restricted" : "transient";
      for (const i of batch) verdicts[i] = { state, scope: "post" };
    }
  }
  return verdicts;
}
export async function recheckBluesky(item, ctx) {
  return (await recheckBlueskyMany([item], ctx))[0];
}

// ---------------------------------------------------------------------------------------------------------
// Entries

const COMMON = {
  stage: "fetch-b",
  status: "enabled",
  enabled: true,
  hosts: [WEB, PUBLIC_APPVIEW, SEARCH_APPVIEW, ENTRYWAY],
  mediaHosts: [IMAGE_CDN, VIDEO, VIDEO_CDN],
  profileHosts: [WEB],
  linkHosts: [WEB],
  requiredCredentials: [],
  optionalCredentials: ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"],
  maxBytes: 1024 * 1024,
  paceMs: 4000,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "moving_sampled",
  copyPolicy: "private_copy",
  copyPermission: {
    basis:
      "Bluesky Developer Guidelines (bsky.network/docs/developer-guidelines, read live 2026-09-15) set no caching or storage restriction and require services to delete content a user asked to delete; Terms of Service (updated 2025-08-14) leave third-party app use to those guidelines. Owner decision PIPELINE §19.1 (2026-09-15): private, non-public personal copies with credit, removed when the creator deletes the post. Not a copyright licence.",
    sourceUrl: TERMS_URL,
    verifiedAt: BLUESKY_VERIFIED_AT,
  },
  deletionPolicy: "honor_deletions",
  deletionDeadlineHours: 24,
  termsUrl: TERMS_URL,
  docsUrl: DOCS_URL,
  recheck: recheckBluesky,
  recheckMany: recheckBlueskyMany,
};
const SHARED_NOTES =
  "Keyless: feeds/author feeds on public.api.bsky.app, first-page searchPosts on api.bsky.app (≥15 s apart across all Bluesky entries, never a cursor). With BLUESKY_HANDLE + BLUESKY_APP_PASSWORD: one in-process app-password session via bsky.social createSession/refreshSession, all reads through bsky.social with atproto-proxy did:web:api.bsky.app#bsky_appview; expired or rejected tokens refresh once, rejected logins surface as blocked with a 10-minute cooldown (auth path verified with documented mocks only; live check pending deployment). Skips replies, reposts and any post/author label in DISALLOWED_LABELS (incl. !no-unauthenticated, bot). Deletion: getPosts batch, missing → removed, new disallowed label → removed (24 h). Video posters point at video.bsky.app, which redirects to video.cdn.bsky.app (octet-stream), so server-side poster inspection needs an http.js change.";

export const blueskyMaomao = {
  ...COMMON,
  id: "bluesky-maomao",
  sections: ["maomao"],
  maxRequests: MAOMAO_STEPS.length * MAX_PASSES_PER_STEP + 4,
  notes: `Kusuriya no Hitorigoto custom feed (72 h), then searches 'maomao fanart' (top, since 48 h), '#maomao' (latest, 48 h), '猫猫 薬屋のひとりごと' (top, since 48 h) and, when logged in, '#apothecarydiaries'. Needs images or video plus a Maomao/Apothecary Diaries mention; link posts and credited reposts are skipped. Kinds image/clip. ${SHARED_NOTES}`,
  fetch: planFetcher("bluesky-maomao", () => MAOMAO_STEPS, selectMaomao),
};
export const blueskyArt = {
  ...COMMON,
  id: "bluesky-art",
  sections: ["music"],
  maxRequests: ART_STEPS.length * MAX_PASSES_PER_STEP + 4,
  notes: `Vocaloid (aaaixmavfk7jw) and Project Sekai (aaaixpmeevmx6) feeds, 72 h; logged-in searches #prsk_FA, #hatsunemiku, #初音ミク, #kasaneteto (48 h). Still images only with a voicebank/unit/Vocaloid/SEKAI mention; #ad posts, link posts, credited reposts ('Artist:') and official card-art bot captions ('4☆ (trained)') are skipped. ${SHARED_NOTES}`,
  fetch: planFetcher("bluesky-art", () => ART_STEPS, selectArt),
};
export const blueskyCosplay = {
  ...COMMON,
  id: "bluesky-cosplay",
  sections: ["dressup", "maomao", "music"],
  maxRequests: (COSPLAY_FIXED_STEPS.length + 2) * MAX_PASSES_PER_STEP + 4,
  notes: `PIPELINE §5.3 narrow queries, 48 h: #mikucosplay, 'miku cosplay', 'cosplay'+tag maomao, '猫猫 コスプレ', '初音ミク コスプレ' daily plus two rotating fandom queries (project sekai, genshin, frieren, fern, witch hat atelier, bungo stray dogs, honkai star rail, cosplay singapore). Sections: dressup, plus maomao/music only on a fandom match. Adult-sale cues (gumroad, fansly, lewd, thigh…) and credited reposts are skipped; labels miss suggestive posts, so vision review remains mandatory. Credit is the posting account; 'cosplay by'/'photos by' strings go to facts.names. ${SHARED_NOTES}`,
  fetch: planFetcher("bluesky-cosplay", cosplaySteps, selectCosplay),
};
export const blueskyFashion = {
  ...COMMON,
  id: "bluesky-fashion",
  sections: ["dressup"],
  maxRequests: FASHION_STEPS.length * MAX_PASSES_PER_STEP + 4,
  notes: `J-fashion hashtags #lolitafashion, #jfashion, #sweetlolita, #y2kfashion, #harajukufashion (latest, 7-day window). FASHION_STYLES only from explicit tags/text (y2k, skater, sweet lolita, girly kei); no active skater tag exists on Bluesky, so skater looks depend on vision classification. Link/shop posts and adult cues skipped. Kind look. ${SHARED_NOTES}`,
  fetch: planFetcher("bluesky-fashion", () => FASHION_STEPS, selectFashion),
};
export const blueskyMemes = {
  ...COMMON,
  id: "bluesky-memes",
  sections: ["meme", "maomao", "music"],
  maxRequests: MEME_STEPS.length * MAX_PASSES_PER_STEP + 4,
  notes: `Allowlisted accounts @wholesomememe, @adhdforreal, @murmurlilies (72 h; image posts plus clearly text-only posts, which keep their text as the excerpt) and the Kusuriya, Project Sekai and Vocaloid feeds (only posts with meme cues). No general meme feeds (political during research). Sections: meme, plus maomao/music on a fandom match. ${SHARED_NOTES}`,
  fetch: planFetcher("bluesky-memes", () => MEME_STEPS, selectMeme),
};
