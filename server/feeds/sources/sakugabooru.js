// Sakugabooru (www.sakugabooru.com, Moebooru) keyless JSON API: Apothecary Diaries animation cuts.
//
// Verified live 2026-09-15 from a home WSL machine (not Vercel):
// - `post.json?api_version=2&include_tags=1` returns `{posts, tags}` where `tags` maps every tag on the page
//   to its type (general/artist/copyright/meta), so animator credit needs no per-tag lookups.
// - `kusuriya_no_hitorigoto` had 84 visible posts (83 mp4, all rating "s", newest 2025-08-24). Sources
//   name the episode ("#48", "#04 (AD: Moaang) (BD)") or a creditless OP/ED; there are no character tags.
// - Moebooru ratings are s/q/e; "s" (safe) is the lowest tier, so it is what "general only" means here.
// - robots.txt: `User-agent: * Allow: /` with Cloudflare content signals `search=yes, ai-train=no,
//   use=reference`. The Terms of Service cover uploads/DMCA only and say nothing about API use.
// - Clips are studio footage uploaded without a licence: link only, never copied.
import { FeedError } from "../config.js";
import { MEDIA_LIMITS } from "../http.js";
import { BAD_TAGS } from "../rules.js";
import { FANSERVICE_TAGS } from "./danbooru.js";
import { clip, cursor as cursorCodec, toIso } from "./util.js";

const HOST = "www.sakugabooru.com";
export const SAKUGA_PAGE_SIZE = 20;
export const SAKUGA_PAGES = 2;
export const SAKUGA_VERIFIED_AT = "2026-09-15T14:41:52Z";
const LINK_HOSTS = { "x.com": "X", "twitter.com": "X", "www.youtube.com": "YouTube", "youtu.be": "YouTube", "bsky.app": "Bluesky", "www.pixiv.net": "pixiv" };

const split = (value) => String(value ?? "").split(/\s+/).filter(Boolean);
const humanize = (tag) => tag.replace(/_/g, " ").trim();

function siteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === HOST && !url.port ? url.href : null;
  } catch {
    return null;
  }
}

export function postsUrl(before = null) {
  const url = new URL(`https://${HOST}/post.json`);
  url.searchParams.set("tags", `kusuriya_no_hitorigoto rating:s${before ? ` id:<${before}` : ""}`);
  url.searchParams.set("limit", String(SAKUGA_PAGE_SIZE));
  url.searchParams.set("api_version", "2");
  url.searchParams.set("include_tags", "1");
  return url.href;
}

/** Why a cut can't be used, or null. */
export function skipReason(post) {
  if (!post || typeof post !== "object" || !Number.isInteger(post.id)) return "malformed";
  if (post.status !== "active" || post.is_held || post.is_pending) return "not_active";
  if (post.rating !== "s") return "rating";
  const tags = split(post.tags);
  if (tags.some((t) => FANSERVICE_TAGS.has(t) || BAD_TAGS.test(t))) return "blocked_tag";
  if (String(post.file_ext).toLowerCase() !== "mp4") return "not_mp4";
  // Moving media needs bounded frame sampling before approval, which reads at most 8 MiB.
  if (!(post.file_size > 0) || post.file_size > MEDIA_LIMITS.binary) return "clip_too_large";
  if (!siteUrl(post.file_url) || !siteUrl(post.preview_url)) return "no_media";
  if (!/^[0-9a-f]{32}$/.test(String(post.md5 ?? ""))) return "no_media";
  return null;
}

/** "#48" / "EP05" / "Episode 5" → 48 / 5; creditless OP/ED, PVs and URLs → null. */
export function episodeFrom(source) {
  const text = String(source ?? "").trim();
  if (/^https?:/i.test(text)) return null;
  const m = text.match(/^#\s*(\d{1,4})\b/) ?? text.match(/\bep(?:isode)?\.?\s*(\d{1,4})\b/i);
  return m ? Number(m[1]) : null;
}

function sourceLabel(source, episode) {
  const text = String(source ?? "").replace(/\s+/g, " ").trim();
  if (episode !== null) return `episode #${episode}`;
  if (!text || /^https?:/i.test(text)) return "cut";
  return clip(text.replace(/\s*\((?:BD|TV|WEB)\)\s*$/i, ""), 40);
}

function sourceLink(source) {
  let url;
  try {
    url = new URL(String(source ?? "").trim());
  } catch {
    return null;
  }
  const label = LINK_HOSTS[url.hostname.toLowerCase()];
  if (url.protocol !== "https:" || !label || url.username || url.password || url.port) return null;
  url.hash = "";
  return { kind: "source", label: `source (${label})`, url: url.href };
}

export function cutItem(post, tagTypes) {
  const tags = split(post.tags);
  const animators = tags.filter((t) => tagTypes?.[t] === "artist" && t !== "artist_unknown");
  const names = animators.slice(0, 3).map(humanize);
  const credit = names.length ? names.join(" & ") + (animators.length > 3 ? ` +${animators.length - 3}` : "") : "unknown animator";
  const episode = episodeFrom(post.source);
  const link = sourceLink(post.source);
  const width = Number.isInteger(post.width) && post.width > 0 ? post.width : null;
  const height = Number.isInteger(post.height) && post.height > 0 ? post.height : null;
  return {
    source: "sakugabooru-maomao",
    nativeId: String(post.id),
    sections: ["maomao"],
    kind: "clip",
    title: clip(`The Apothecary Diaries sakuga · ${sourceLabel(post.source, episode)} · ${credit}`, 200),
    url: `https://${HOST}/post/show/${post.id}`,
    media: [
      {
        type: "mp4",
        url: siteUrl(post.file_url),
        width,
        height,
        poster: siteUrl(post.preview_url),
        bytes: post.file_size,
        identity: post.md5,
      },
    ],
    credit: {
      name: clip(credit, 200),
      handle: (animators[0] ?? "").slice(0, 100),
      profileUrl: animators[0] ? `https://${HOST}/post?tags=${encodeURIComponent(animators[0])}` : null,
      platform: "Sakugabooru",
    },
    tags: {
      fandoms: ["the apothecary diaries"],
      topics: [],
    },
    facts: {
      names: [...animators, ...(String(post.source ?? "").trim() && !link ? [clip(String(post.source).trim(), 100)] : [])].slice(0, 40),
      sourceScore: Math.max(0, Number(post.score) || 0),
      episode,
      links: link ? [link] : [],
    },
    safety: { rating: post.rating, sourceTags: tags.filter((t) => t.length <= 100).slice(0, 40) },
    publishedAt: Number.isFinite(post.created_at) ? toIso(post.created_at * 1000) : null,
    mediaIdentity: post.md5,
  };
}

export async function fetchSakugabooru(ctx) {
  const state = cursorCodec.decode(ctx.cursor, {});
  const before = Number.isInteger(state.b) && state.b > 0 ? state.b : null;
  const made = Number.isInteger(state.p) && state.p > 0 ? state.p : 0;
  const body = await ctx.http.json(postsUrl(before));
  if (!body || !Array.isArray(body.posts) || typeof body.tags !== "object" || body.tags === null)
    throw new FeedError("source_shape", 503);
  const max = Math.min(8, ctx.limits.items);
  const items = [];
  let last = null;
  let full = false;
  for (const post of body.posts) {
    if (items.length >= max) {
      full = true;
      break;
    }
    if (Number.isInteger(post?.id)) last = post.id;
    if (skipReason(post)) continue;
    items.push(cutItem(post, body.tags));
  }
  const more = (full || body.posts.length >= SAKUGA_PAGE_SIZE) && last !== null && made + 1 < SAKUGA_PAGES;
  return more
    ? { items, cursor: cursorCodec.encode({ b: last, p: made + 1 }), done: false }
    : { items, cursor: null, done: true };
}

export async function recheckSakugabooru(item, ctx) {
  const scope = "post";
  if (!/^\d{1,12}$/.test(String(item?.nativeId ?? ""))) return { state: "transient", scope };
  try {
    const body = await ctx.http.json(`https://${HOST}/post.json?tags=id%3A${item.nativeId}&api_version=2`);
    if (!body || !Array.isArray(body.posts)) return { state: "transient", scope };
    // Deleted posts drop out of searches entirely.
    const post = body.posts.find((p) => String(p?.id) === String(item.nativeId));
    if (!post || post.status === "deleted" || post.rating !== "s") return { state: "removed", scope };
    return { state: "present", scope };
  } catch (error) {
    return {
      state: error.code === "not_found" ? "removed" : error.code === "blocked" ? "restricted" : "transient",
      scope,
    };
  }
}

export const sakugabooruMaomao = {
  id: "sakugabooru-maomao",
  stage: "fetch-a",
  status: "optional",
  enabled: true,
  sections: ["maomao"],
  hosts: [HOST],
  mediaHosts: [HOST],
  linkHosts: Object.keys(LINK_HOSTS),
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: [],
  maxRequests: SAKUGA_PAGES + 1,
  maxBytes: 512 * 1024,
  paceMs: 1500,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "moving_sampled",
  copyPolicy: "link_only",
  copyPermission: null,
  deletionPolicy: "recheck_before_publish",
  deletionDeadlineHours: null,
  termsUrl: "https://www.sakugabooru.com/static/terms_of_service",
  docsUrl: "https://www.sakugabooru.com/help/api",
  notes:
    "Back catalogue until Season 3 cuts arrive (84 posts, newest upload 2025-08-24 when checked). Newest first, 2 requests of 20 posts, `id:<` cursor. Only active rating-s mp4 cuts ≤ 8 MiB (13 of the 84 posts were larger and 1 was a JPEG on 2026-09-15; larger cuts are skipped because frame sampling can't read them); the preview JPEG is the poster. Credits animators from artist-type tags in the same response (artist_unknown → 'unknown animator'); episode number from the source field. No character tags exist, so the vision check must confirm Maomao. Studio footage: link only, no copies.",
  fetch: fetchSakugabooru,
  recheck: recheckSakugabooru,
};
