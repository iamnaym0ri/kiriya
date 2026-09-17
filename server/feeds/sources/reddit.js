// Reddit collector (Data API, OAuth2 client credentials). Added 2026-09-17 at the owner's request:
// Bluesky and Tumblr are dry, and Reddit is where her fandoms actually talk.
//
// Basis:
// - Auth: POST https://www.reddit.com/api/v1/access_token with HTTP Basic (client id : secret) and
//   `grant_type=client_credentials` — the documented app-only flow for a script app
//   (github.com/reddit-archive/reddit/wiki/OAuth2). The token is cached per warm instance until it
//   expires. Reddit's free Data API tier allows 100 queries a minute per client id; this collector
//   makes about ten requests a day, paced 1.5 s apart.
// - Reads: GET https://oauth.reddit.com/r/<subreddit>/hot?limit=25&raw_json=1 with the bearer token.
//   Unauthenticated www.reddit.com JSON now answers 403, so the token is required, not optional.
// - Deletion: the Data API terms require honouring removals, so `recheck` reads GET /api/info and a
//   deleted, removed or newly NSFW post is dropped (24 h deadline, the same rule as Lemmy).
// - Media: only static images on Reddit's own hosts are used, hot-linked, never copied. Galleries
//   take their first image from `media_metadata`. GIF and video posts are skipped: this source's
//   policy is `still_only`, and a poster is not the clip.
// - Safety: `over_18` posts, NSFW subreddits, quarantined subreddits, ads, stickied posts and
//   deleted authors are all dropped before anything is scored.
import { FeedError } from "../config.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, UNIT_ALIASES, VOICEBANKS, canonicalFandoms, mentions } from "./tags.js";
import { clip, cursor as cursorCodec, stripHtml, toIso } from "./util.js";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";
const TERMS_URL = "https://redditinc.com/policies/data-api-terms";
const DOCS_URL = "https://www.reddit.com/dev/api/";
const POST_LICENSE = "Reddit post; rights stay with the poster";
/** Reddit's own image hosts. A link to anywhere else is a link, not media. */
export const REDDIT_MEDIA_HOSTS = ["i.redd.it", "preview.redd.it", "external-preview.redd.it", "b.thumbs.redditmedia.com"];
const STILL = /\.(?:jpe?g|png|webp)$/i;
const POST_ID = /^[a-z0-9]{4,12}$/;

/**
 * Stable order; append rather than reorder (checkpoints hold the index). `sections` is where a
 * post from that subreddit may go; the item's own kind decides which slots it can fill.
 * Not yet confirmed live: Reddit blocks unauthenticated reads, so these names and their rules
 * could only be checked once the owner creates the API app. The first probe records what resolves.
 */
export const SUBREDDITS = [
  { name: "Kusuriya", sections: ["maomao"], fandoms: ["the apothecary diaries"] },
  { name: "vocaloid", sections: ["music"], fandoms: ["vocaloid"] },
  { name: "ProjectSekai", sections: ["music"], fandoms: ["project sekai"] },
  { name: "cosplay", sections: ["dressup"], cosplayOnly: true },
  { name: "Animemes", sections: ["meme"], memesOnly: true },
  { name: "AnimeFigures", sections: ["merch"], merchOnly: true },
  // Her VTuber corner: updates and announcements, which become notes rather than pictures.
  { name: "VirtualYoutubers", sections: ["music"], newsOnly: true },
  { name: "Nijisanji", sections: ["music"], newsOnly: true },
];

/** Something that reads as a joke rather than a discussion thread. */
const MEME_CUES = /\bmemes?\b|\bshitpost|\bwhen you\b|\bme when\b|\bpov\b|\bbe like\b|\bmfw\b|\btfw\b|nobody:|no one:/i;
/** A person in costume, not an illustration or a figure. */
const COSPLAY_CUES = /\bcosplay(?:er|ing)?\b|\bcosplayed\b|\bcos ?test\b|コスプレ/i;
/** Product news she can act on: something new, orderable or back in stock. */
const MERCH_CUES = /\bpre-?order\b|\bpreorders?\b|\brestock(?:ed|ing)?\b|\bannounced\b|\bnew release\b|\brelease date\b|\bnow available\b|\bup for order\b/i;
/** Channel-farm filler and the threads that are only interesting inside the community. */
const SKIP_CUES = /\bwho is this\b|\bsource\?|\bhelp\b|\bquestion\b|\bwhere (?:can|do) i\b|\bis (?:it|this) (?:legit|real|fake)\b|\brate my\b|\bhaul\b|daily (?:discussion|thread)|weekly (?:discussion|thread)|megathread/i;

const unique = (values) => [...new Set(values.filter(Boolean))];

/**
 * Reddit asks for `<platform>:<app id>:<version> (by /u/<username>)`. The username is optional, so
 * the shared default User-Agent stands in when the owner hasn't configured one.
 */
function userAgentHeaders(ctx) {
  const user = String(ctx.credentials?.REDDIT_USERNAME ?? "");
  return /^[\w-]{3,20}$/.test(user)
    ? { "user-agent": `web:kiriya.love:1.0 (by /u/${user})` }
    : {};
}

function requireCredentials(ctx) {
  const id = ctx.credentials?.REDDIT_CLIENT_ID;
  const secret = ctx.credentials?.REDDIT_CLIENT_SECRET;
  if (!id || !secret) throw new FeedError("not_configured", 503);
  return { id, secret };
}

// One token per warm instance; Reddit's app-only tokens last an hour or a day depending on the app.
let cached = null;
export const clearRedditToken = () => {
  cached = null;
};

export async function accessToken(ctx) {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const { id, secret } = requireCredentials(ctx);
  const body = await ctx.http.json(TOKEN_URL, {
    method: "POST",
    headers: {
      ...userAgentHeaders(ctx),
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const token = typeof body?.access_token === "string" ? body.access_token : null;
  if (!token) throw new FeedError("not_configured", 503);
  const seconds = Number(body.expires_in);
  cached = { token, expiresAt: Date.now() + (Number.isFinite(seconds) && seconds > 60 ? seconds : 3600) * 1000 };
  return token;
}

const dimension = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 30000 ? n : null;
};

/** A static image on one of Reddit's own hosts, or null. Gallery previews arrive HTML-escaped. */
export function postImage(post) {
  const candidates = [];
  if (post?.post_hint === "image" && typeof post.url === "string") candidates.push({ url: post.url });
  if (post?.is_gallery && post.media_metadata && typeof post.media_metadata === "object")
    for (const entry of Object.values(post.media_metadata)) {
      if (entry?.e === "Image" && typeof entry?.s?.u === "string")
        candidates.push({ url: stripHtml(entry.s.u).replace(/&amp;/g, "&"), width: entry.s.x, height: entry.s.y });
    }
  const preview = post?.preview?.images?.[0]?.source;
  if (preview && typeof preview.url === "string")
    candidates.push({ url: stripHtml(preview.url).replace(/&amp;/g, "&"), width: preview.width, height: preview.height });
  for (const candidate of candidates) {
    let url;
    try {
      url = new URL(candidate.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.username || url.password) continue;
    if (!REDDIT_MEDIA_HOSTS.includes(url.hostname) || !STILL.test(url.pathname)) continue;
    return {
      type: "image",
      url: url.href,
      width: dimension(candidate.width),
      height: dimension(candidate.height),
      alt: "",
      identity: `reddit:${url.hostname}${url.pathname}`,
    };
  }
  return null;
}

function postTags(text, sub) {
  const characters = mentions(text, CHARACTER_ALIASES);
  const fandoms = canonicalFandoms(unique([...(sub.fandoms ?? []), ...mentions(text, FANDOM_ALIASES)]));
  const formats = [];
  if (COSPLAY_CUES.test(text)) formats.push("cosplay");
  if (/\bwip\b|work in progress/i.test(text)) formats.push("wip");
  if (/\bwigs?\b/i.test(text)) formats.push("wig");
  return {
    characters,
    fandoms,
    voicebanks: characters.filter((c) => VOICEBANKS.includes(c)),
    units: mentions(text, UNIT_ALIASES),
    formats,
    topics: [],
  };
}

/**
 * One Reddit post → FeedItem, or null when it isn't for her. `kind` follows the subreddit's job:
 * a meme sub makes memes, the figure sub makes merch news, the cosplay sub makes cosplay photos,
 * a fandom sub makes pictures when it has one and notes when it doesn't.
 */
export function redditItem(entry, sub, raw) {
  const post = raw?.data;
  if (!post || raw.kind !== "t3") return null;
  const id = String(post.id ?? "");
  if (!POST_ID.test(id)) return null;
  if (post.over_18 || post.quarantine || post.removed_by_category || post.stickied || post.pinned) return null;
  if (post.is_created_from_ads_ui || post.promoted || post.hidden) return null;
  if (!post.author || post.author === "[deleted]" || post.author === "AutoModerator") return null;
  if (String(post.subreddit ?? "").toLowerCase() !== sub.name.toLowerCase()) return null;
  if (typeof post.permalink !== "string" || !post.permalink.startsWith("/r/")) return null;
  const title = clip(stripHtml(post.title), 200);
  if (!title || SKIP_CUES.test(title)) return null;
  const body = clip(stripHtml(post.selftext ?? ""), 600);
  const flair = clip(stripHtml(post.link_flair_text ?? ""), 100);
  const text = [title, flair, body].filter(Boolean).join("\n");
  const image = postImage(post);
  const tags = postTags(text, sub);

  let kind;
  if (sub.merchOnly) {
    if (!image || !MERCH_CUES.test(text)) return null;
    kind = "merch";
  } else if (sub.memesOnly) {
    if (!image || !MEME_CUES.test(text)) return null;
    kind = "meme";
  } else if (sub.cosplayOnly) {
    if (!image || !COSPLAY_CUES.test(text)) return null;
    kind = "cosplay";
  } else if (sub.newsOnly) {
    kind = "news";
  } else {
    kind = image ? "image" : "news";
  }
  // A picture slot needs a picture; a note needs something to read.
  if (["image", "cosplay", "meme", "merch"].includes(kind) && !image) return null;
  if (kind === "news" && !body && !flair) return null;

  return {
    source: entry.id,
    nativeId: id,
    sections: sub.sections,
    kind,
    title,
    url: `https://www.reddit.com${post.permalink}`,
    media: image ? [image] : [],
    ...(image ? { mediaIdentity: image.identity } : {}),
    credit: {
      name: clip(`u/${post.author}`, 200),
      handle: clip(String(post.author), 100),
      profileUrl: `https://www.reddit.com/user/${encodeURIComponent(post.author)}/`,
      platform: clip(`Reddit · r/${post.subreddit}`, 200),
      license: POST_LICENSE,
    },
    tags,
    facts: {
      excerpts: unique([body]).slice(0, 2),
      sourceScore: Math.max(0, Number(post.score) || 0),
      links: [{ kind: "source", label: "Reddit", url: `https://www.reddit.com${post.permalink}` }],
    },
    safety: {
      rating: "unknown",
      labels: unique([post.spoiler ? "reddit:spoiler" : null, flair ? `flair:${flair.toLowerCase()}` : null]).slice(0, 8),
      sourceTags: [],
    },
    publishedAt: toIso(Number(post.created_utc) > 0 ? new Date(Number(post.created_utc) * 1000).toISOString() : null),
  };
}

function readCursor(value) {
  const raw = cursorCodec.decode(value, {});
  const byName = typeof raw.r === "string" ? SUBREDDITS.findIndex((s) => s.name === raw.r) : -1;
  const index = byName >= 0 ? byName : Number.isInteger(raw.i) ? raw.i : 0;
  return Math.max(0, index);
}

async function fetchRedditFandom(ctx) {
  const index = readCursor(ctx.cursor);
  if (index >= SUBREDDITS.length) return { items: [], cursor: null, done: true };
  const sub = SUBREDDITS[index];
  const token = await accessToken(ctx);
  const limit = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
  const body = await ctx.http.json(`${API}/r/${sub.name}/hot?limit=25&raw_json=1`, {
    headers: { ...userAgentHeaders(ctx), authorization: `bearer ${token}` },
  });
  if (body?.kind !== "Listing" || !Array.isArray(body?.data?.children)) throw new FeedError("source_shape", 503);
  const seen = new Set();
  const eligible = [];
  for (const child of body.data.children) {
    const item = redditItem(redditFandom, sub, child);
    if (!item || seen.has(item.nativeId)) continue;
    seen.add(item.nativeId);
    eligible.push(item);
  }
  eligible.sort((a, b) => b.facts.sourceScore - a.facts.sourceScore || (a.nativeId < b.nativeId ? -1 : 1));
  const next = SUBREDDITS[index + 1];
  return {
    items: eligible.slice(0, limit),
    cursor: next ? cursorCodec.encode({ r: next.name, i: index + 1 }) : null,
    done: !next,
  };
}

export async function recheckReddit(item, ctx) {
  const id = String(item?.nativeId ?? "");
  if (!POST_ID.test(id)) return { state: "restricted", scope: "unverifiable_id" };
  try {
    const token = await accessToken(ctx);
    const body = await ctx.http.json(`${API}/api/info?id=t3_${id}&raw_json=1`, {
      headers: { ...userAgentHeaders(ctx), authorization: `bearer ${token}` },
    });
    const post = body?.data?.children?.[0]?.data;
    // An authoritative empty listing: deleted, removed by Reddit, or in a private subreddit now.
    if (!post || String(post.id) !== id) return { state: "removed", scope: "post_not_found" };
    if (post.removed_by_category || post.author === "[deleted]") return { state: "removed", scope: "moderator_removed" };
    if (post.over_18 || post.quarantine) return { state: "removed", scope: "ineligible_labels" };
    return { state: "present", scope: "post" };
  } catch (error) {
    if (error?.code === "not_found") return { state: "removed", scope: "post_not_found" };
    return { state: ["blocked", "rate_limited"].includes(error?.code) ? "restricted" : "transient", scope: "post" };
  }
}

export const redditFandom = {
  id: "reddit-fandom",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["maomao", "music", "dressup", "meme", "merch"],
  hosts: ["www.reddit.com", "oauth.reddit.com"],
  mediaHosts: REDDIT_MEDIA_HOSTS,
  profileHosts: ["www.reddit.com"],
  linkHosts: ["www.reddit.com"],
  requiredCredentials: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  // Reddit asks clients to identify themselves with the owner's username; used when configured.
  optionalCredentials: ["REDDIT_USERNAME"],
  // One token plus one page per subreddit, with room for a retry.
  maxRequests: SUBREDDITS.length + 4,
  maxBytes: 1024 * 1024,
  paceMs: 1500,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "still_only",
  copyPolicy: "link_only",
  deletionPolicy: "honor_deletions",
  deletionDeadlineHours: 24,
  termsUrl: TERMS_URL,
  docsUrl: DOCS_URL,
  fetch: fetchRedditFandom,
  recheck: recheckReddit,
  notes:
    "Eight subreddits, one page of /hot (25 posts) each per day, through the documented app-only OAuth flow " +
    "(client_credentials; the token is cached per warm instance). r/Kusuriya → maomao, r/vocaloid and " +
    "r/ProjectSekai → music, r/cosplay → dressup (cosplay photos only), r/Animemes → meme, r/AnimeFigures → " +
    "merch (only preorder/release/restock posts, so the shelf stays things she can act on), r/VirtualYoutubers " +
    "and r/Nijisanji → music as notes, for her VTuber corner. Drops over_18 posts, quarantined or mismatched " +
    "subreddits, ads, stickied posts, deleted authors, AutoModerator, and the help/source/haul/megathread " +
    "threads that only make sense inside the community. Media: static JPEG/PNG/WebP on i.redd.it, " +
    "preview.redd.it, external-preview.redd.it or b.thumbs.redditmedia.com only, hot-linked, never copied; " +
    "GIF and video posts are skipped because this source is still_only. Credit is the poster (u/name) with the " +
    "subreddit in platform. Free tier is 100 queries a minute per client id; this makes about ten requests a " +
    "day, 1.5 s apart. Deletions are honoured within 24 h via GET /api/info. The subreddit names are not yet " +
    "confirmed live: Reddit answers 403 without a token, so the first probe after the owner creates the app " +
    "records which of them resolve.",
};
