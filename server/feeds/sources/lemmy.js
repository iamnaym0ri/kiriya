// Lemmy collector: meme-of-the-day candidates from allowlisted communities, each queried on its home instance.
//
// Verified 2026-09-15 (UTC) from a home WSL machine, not Vercel:
// - nodeinfo: lemmy.world 0.19.19, ani.social 0.19.20 (v3 API). GET /api/v3/post/list?community_name=…
//   &sort=TopDay&limit=20 → 200 (Cache-Control public, max-age=60). GET /api/v3/post?id= → 200 with post_view;
//   an unknown id → HTTP 400 {"error":"couldnt_find_post"}.
// - robots.txt on both instances: Crawl-delay 60, /api not disallowed. Requests are 30 s apart and alternate
//   hosts, so each instance sees at most one request a minute from this collector.
// - Terms: lemmy.world Terms of Service (legal.lemmy.world/tos, Legal & Help Center last revised 2025-06-09)
//   apply to the site "and it's API's": no disruption, no evading WAF/IP blocks, "any provided method" is
//   allowed "in good faith". ani.social Terms of Use (instance legal page, last updated 2026-08-01): do not
//   "interfere with, disrupt, or damage the instance"; bot rules cover bot accounts. Neither addresses third
//   parties caching, copying or deletion deadlines, so copies default to link_only and deletions follow the
//   owner's community-post rule (PIPELINE §19.1) with a 24 h recheck.
// - Community rules read live: memes@lemmy.world "No politics"; animemes@ani.social and anime_irl@ani.social
//   require NSFW tags for lewd content; hatsunemiku@lemmy.world allows "Lewd ... nothing too hardcore" (so the
//   NSFW flag and the vision check both gate it); minecraft@lemmy.world allows memes; vocaloid@ani.social
//   exists (225 posts) but its TopDay list was empty and recent posts are federated from sh.itjust.works.
// - Media: local uploads are https://<instance>/pictrs/image/<uuid>.<ext>; ani.social shows federated media via
//   /api/v3/image_proxy?url=…. Only pictrs files on the post's own (allowlisted) instance are used.
import { FeedError } from "../config.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, UNIT_ALIASES, VOICEBANKS, mentions } from "./tags.js";
import { cursor as cursorCodec, hostOf, toIso } from "./util.js";

export const LEMMY_INSTANCES = ["lemmy.world", "ani.social"];
export const LEMMY_VERIFIED_AT = "2026-09-15T15:10:00Z";
const TERMS_URL = "https://legal.lemmy.world/tos/";
const DOCS_URL = "https://join-lemmy.org/docs/contributors/04-api.html";
const MAX_PASSES_PER_STEP = 2;

// Stable order, alternating instances (appending keeps checkpoints valid).
export const LEMMY_COMMUNITIES = [
  { host: "lemmy.world", name: "memes" },
  { host: "ani.social", name: "animemes" },
  { host: "lemmy.world", name: "me_irl" },
  { host: "ani.social", name: "anime_irl" },
  { host: "lemmy.world", name: "hatsunemiku", fandom: "vocaloid" },
  { host: "ani.social", name: "vocaloid", fandom: "vocaloid" },
  { host: "lemmy.world", name: "minecraft", fandom: "minecraft", memesOnly: true },
];
export const LEMMY_REJECTED_COMMUNITIES = [
  {
    community: "lemmyshitpost@lemmy.world",
    reason: "Skipped by instruction; research found its top posts political.",
  },
  {
    community: "onehundredninetysix@lemmy.blahaj.zone",
    reason:
      "Rules (read 2026-09-15) ban bigotry and authoritarianism but not politics; that day's TopDay list included 'Happy Kirkiversary rule!', a political-violence anniversary meme the keyword filter would not catch.",
  },
];

const PICTRS = /^\/pictrs\/image\/([0-9a-f-]{36})\.(jpe?g|png|webp|gif|mp4)$/i;
const MEME_CUES = /\b(?:memes?|me[_ ]irl|me when|pov|be like|mfw|tfw|nobody:|no one:|shitpost\w*|joke|funny|lol|lmao)\b/i;
const ADULT_PROFILE = /🔞|\bnsfw\b|18\+|\br-?18\b|\blewd\b|\bhentai\b/i;

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

/** Plain text from Lemmy markdown: images and spoiler markers dropped, links reduced to their text. */
export function markdownText(markdown) {
  return String(markdown ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^:::\s*(?:spoiler\s*)?/gim, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_~`>]/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** A pictrs file on `origin` (a proxied URL is unwrapped first); only pictrs `thumbnail`/`format` params survive. */
export function ownPictrs(value, origin) {
  let u;
  try {
    u = new URL(value);
    if (LEMMY_INSTANCES.includes(u.hostname) && u.pathname === "/api/v3/image_proxy") u = new URL(u.searchParams.get("url"));
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const match = PICTRS.exec(u.pathname);
  if (!match || u.hostname !== origin || !LEMMY_INSTANCES.includes(origin)) return null;
  const clean = new URL(`https://${u.hostname}${u.pathname}`);
  for (const key of ["thumbnail", "format"]) if (u.searchParams.has(key)) clean.searchParams.set(key, u.searchParams.get(key));
  return { url: clean.href, uuid: match[1].toLowerCase(), ext: match[2].toLowerCase() };
}

const dimension = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 30000 ? n : null;
};

function postMedia(view, origin) {
  const post = view.post;
  const contentType = String(post.url_content_type ?? "").toLowerCase();
  const details = view.image_details ?? null;
  const thumb = post.thumbnail_url ? ownPictrs(post.thumbnail_url, origin) : null;
  const direct = post.url ? ownPictrs(post.url, origin) : null;
  const sized = (file) =>
    details && details.link === file.url ? { width: dimension(details.width), height: dimension(details.height) } : {};
  if (direct) {
    const type =
      direct.ext === "gif" || contentType === "image/gif"
        ? "gif"
        : direct.ext === "mp4" || contentType === "video/mp4"
          ? "mp4"
          : "image";
    return [
      {
        type,
        url: direct.url,
        ...sized(direct),
        poster: type === "image" ? null : (thumb && thumb.ext !== "mp4" ? thumb.url : null),
        alt: clipText(post.alt_text, 500),
        identity: `pictrs:${origin}/${direct.uuid}`,
      },
    ];
  }
  // A linked image hosted elsewhere still has an instance-made preview on the origin's own pictrs.
  if (thumb && thumb.ext !== "mp4" && contentType.startsWith("image/"))
    return [
      {
        type: thumb.ext === "gif" ? "gif" : "image",
        url: thumb.url,
        ...sized(thumb),
        poster: null,
        alt: clipText(post.alt_text, 500),
        identity: `pictrs:${origin}/${thumb.uuid}`,
      },
    ];
  return [];
}

function topicTags(text, community) {
  const characters = mentions(text, CHARACTER_ALIASES);
  const fandoms = [...new Set([...mentions(text, FANDOM_ALIASES), ...(community.fandom ? [community.fandom] : [])])];
  const units = mentions(text, UNIT_ALIASES);
  const formats = [];
  if (/(^|\n)\s*pov\b|\bpov:/i.test(text)) formats.push("pov");
  if (/\bme when\b/i.test(text)) formats.push("me_when");
  return { characters, fandoms, voicebanks: characters.filter((c) => VOICEBANKS.includes(c)), units, formats, topics: [] };
}
const isMusic = (t) =>
  t.voicebanks.length > 0 || t.units.length > 0 || t.fandoms.includes("vocaloid") || t.fandoms.includes("project sekai");

/** One PostView → FeedItem, or null when ineligible (flags, bots, pinned, foreign host, no own media). */
export function lemmyItem(entry, community, view) {
  const post = view?.post;
  const creator = view?.creator;
  const home = view?.community;
  if (!post || !creator || !home || !Number.isInteger(post.id) || post.id <= 0) return null;
  const origin = hostOf(post.ap_id);
  if (!LEMMY_INSTANCES.includes(origin) || !String(post.ap_id).startsWith(`https://${origin}/`)) return null;
  if (String(home.name).toLowerCase() !== community.name || hostOf(home.actor_id) !== community.host) return null;
  if (post.nsfw || post.deleted || post.removed || home.nsfw || home.removed || home.deleted) return null;
  if (creator.bot_account || creator.banned || creator.deleted || view.creator_banned_from_community) return null;
  if (ADULT_PROFILE.test(`${creator.display_name ?? ""} ${creator.name ?? ""}`)) return null;
  if (post.featured_community || post.featured_local) return null;
  const media = postMedia(view, origin);
  if (!media.length) return null;
  const title = clipText(post.name, 200);
  const body = clipText(markdownText(post.body), 600);
  const alt = clipText(post.alt_text, 600);
  const text = [title, body, alt].filter(Boolean).join("\n");
  if (!title || (community.memesOnly && !MEME_CUES.test(text))) return null;
  const tags = topicTags(text, community);
  const creatorHost = hostOf(creator.actor_id);
  return {
    source: entry.id,
    nativeId: `${community.host}:${post.id}`,
    sections: isMusic(tags) ? ["meme", "music"] : ["meme"],
    kind: "meme",
    title,
    url: post.ap_id,
    media,
    credit: {
      name: clipText(creator.display_name || creator.name, 200) || "lemmy user",
      handle: `${creator.name}@${creatorHost}`.slice(0, 100),
      profileUrl: LEMMY_INSTANCES.includes(creatorHost) && String(creator.actor_id).startsWith("https://") ? creator.actor_id : null,
      platform: clipText(`Lemmy · !${home.name}@${community.host}`, 200),
    },
    tags,
    facts: {
      excerpts: [...new Set([body, alt].filter(Boolean))],
      sourceScore: Math.max(0, Number(view.counts?.score) || 0),
    },
    safety: {
      rating: "unknown",
      nsfw: Boolean(post.nsfw),
      deleted: Boolean(post.deleted),
      removed: Boolean(post.removed),
      communityNsfw: Boolean(home.nsfw),
    },
    publishedAt: toIso(post.published),
    mediaIdentity: media[0].identity,
  };
}

function readCursor(value) {
  const raw = cursorCodec.decode(value, {});
  const byKey =
    typeof raw.k === "string" ? LEMMY_COMMUNITIES.findIndex((c) => `${c.name}@${c.host}` === raw.k) : -1;
  const index = byKey >= 0 ? byKey : Number.isInteger(raw.s) ? raw.s : Number.isInteger(raw.index) ? raw.index : 0;
  const same = byKey >= 0 || !raw.k;
  return {
    index: Math.max(0, index),
    offset: same && Number.isInteger(raw.o) && raw.o > 0 ? raw.o : 0,
    pass: same && Number.isInteger(raw.p) && raw.p > 0 ? raw.p : 0,
  };
}

async function fetchLemmyMemes(ctx) {
  const entry = { id: "lemmy-memes" };
  const state = readCursor(ctx.cursor);
  if (state.index >= LEMMY_COMMUNITIES.length) return { items: [], cursor: null, done: true };
  const community = LEMMY_COMMUNITIES[state.index];
  const query = new URLSearchParams({ community_name: community.name, sort: "TopDay", limit: "20" });
  const body = await ctx.http.json(`https://${community.host}/api/v3/post/list?${query}`);
  if (!Array.isArray(body?.posts)) throw new FeedError("source_shape", 503);
  const seen = new Set();
  const eligible = [];
  for (const view of body.posts) {
    const item = lemmyItem(entry, community, view);
    if (!item || seen.has(item.nativeId)) continue;
    seen.add(item.nativeId);
    eligible.push(item);
  }
  eligible.sort((a, b) => b.facts.sourceScore - a.facts.sourceScore || (a.nativeId < b.nativeId ? -1 : 1));
  const size = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
  const items = eligible.slice(state.offset, state.offset + size);
  const more = state.offset + size < eligible.length && state.pass + 1 < MAX_PASSES_PER_STEP;
  const nextCommunity = LEMMY_COMMUNITIES[state.index + 1];
  const next = more
    ? { k: `${community.name}@${community.host}`, s: state.index, o: state.offset + size, p: state.pass + 1 }
    : { k: nextCommunity ? `${nextCommunity.name}@${nextCommunity.host}` : null, s: state.index + 1, o: 0, p: 0 };
  const done = !more && state.index + 1 >= LEMMY_COMMUNITIES.length;
  return { items, cursor: done ? null : cursorCodec.encode(next), done };
}

export async function recheckLemmy(item, ctx) {
  const match = /^(lemmy\.world|ani\.social):(\d{1,12})$/.exec(String(item?.nativeId ?? ""));
  if (!match) return { state: "restricted", scope: "unverifiable_id" };
  try {
    const body = await ctx.http.json(`https://${match[1]}/api/v3/post?id=${match[2]}`);
    const view = body?.post_view;
    if (!view?.post || String(view.post.id) !== match[2]) return { state: "transient", scope: "post" };
    if (view.post.deleted) return { state: "removed", scope: "creator_deleted" };
    if (view.post.removed || view.community?.removed || view.community?.deleted)
      return { state: "removed", scope: "moderator_removed" };
    if (view.post.nsfw || view.community?.nsfw) return { state: "removed", scope: "ineligible_labels" };
    return { state: "present", scope: "post" };
  } catch (error) {
    // Lemmy 0.19 answers an unknown or purged post id with HTTP 400 couldnt_find_post (checked live); the
    // shared helper only exposes the status, and this lookup sends nothing else that could be invalid.
    if (error?.code === "source_http_400") return { state: "removed", scope: "post_not_found" };
    return { state: error?.code === "blocked" ? "restricted" : "transient", scope: "post" };
  }
}

export const lemmyMemes = {
  id: "lemmy-memes",
  stage: "fetch-b",
  status: "enabled",
  enabled: true,
  sections: ["meme", "music"],
  hosts: LEMMY_INSTANCES,
  mediaHosts: LEMMY_INSTANCES,
  profileHosts: LEMMY_INSTANCES,
  linkHosts: LEMMY_INSTANCES,
  requiredCredentials: [],
  maxRequests: LEMMY_COMMUNITIES.length * MAX_PASSES_PER_STEP + 1,
  maxBytes: 512 * 1024,
  paceMs: 30_000,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "moving_sampled",
  copyPolicy: "link_only",
  deletionPolicy: "honor_deletions",
  deletionDeadlineHours: 24,
  termsUrl: TERMS_URL,
  docsUrl: DOCS_URL,
  notes:
    "Public v3 API post/list sort=TopDay (20 posts) for memes@lemmy.world, animemes@ani.social, me_irl@lemmy.world, anime_irl@ani.social, hatsunemiku@lemmy.world, vocaloid@ani.social and minecraft@lemmy.world (actual memes only: title/body cues). Each community is read on its home instance; requests 30 s apart, alternating instances (robots Crawl-delay 60). Skips nsfw/deleted/removed posts, NSFW/removed communities, bot or banned creators and pinned posts. Media only from pictrs on the post's own allowlisted instance (ani.social image-proxy URLs unwrapped only when they point there; a linked image may use the origin's pictrs preview). URL = ap_id on lemmy.world/ani.social, so federated posts from other instances are skipped. Credit: poster (display name, name@instance) and community in platform. Sections: meme, plus music on a Vocaloid/SEKAI match. Terms (lemmy.world ToS; ani.social TOU 2026-08-01) say nothing about third-party copies → link_only; recheck GET /api/v3/post?id= on the community instance: deleted/removed/nsfw → removed, 400 couldnt_find_post → removed, others transient/restricted. Rejected: lemmyshitpost@lemmy.world (instruction/politics), onehundredninetysix@lemmy.blahaj.zone (no politics rule; political-violence meme in TopDay 2026-09-15).",
  fetch: fetchLemmyMemes,
  recheck: recheckLemmy,
};
