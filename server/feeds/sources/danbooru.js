// Danbooru (danbooru.donmai.us) keyless JSON API: Maomao art, Vocaloid art/GIFs and anime memes.
//
// Verified live 2026-09-15 from a home WSL machine (not Vercel):
// - help:api asks for an honest, unique User-Agent (ideally with a Danbooru user ID), ~1 request/s
//   sustained (10/s burst), `page=b<id>` pagination and `limit` ≤ 200 on /posts.json.
// - help:users / help:cheatsheet: anonymous searches allow 2 tags. Free metatags (rating, status, age,
//   score, filetype, id, limit, …) don't count; negated tags, `order:` and every `~or` term do.
//   `tag -ai-generated order:score` and a 3-term `~` query both returned HTTP 422 TagLimitError.
// - robots.txt disallows `/*.json` for crawlers. This module makes a few documented API calls per build
//   within the stated rate limits; it never crawls or indexes the site.
// - Terms of Service (last updated 2022-10-23) contain no clause restricting API clients from caching
//   or storing media; they require API rate limits to be honoured. See `copyPermission`.
import { FeedError } from "../config.js";
import { MEDIA_LIMITS } from "../http.js";
import { BAD_TAGS } from "../rules.js";
import { canonicalCharacters, canonicalFandoms, canonicalVoicebanks } from "./tags.js";
import { clip, cursor as cursorCodec, toIso } from "./util.js";

const HOST = "danbooru.donmai.us";
const CDN = "cdn.donmai.us";
const TERMS_URL = "https://danbooru.donmai.us/terms_of_service";
const DOCS_URL = "https://danbooru.donmai.us/wiki_pages/help:api";
export const DANBOORU_VERIFIED_AT = "2026-09-15T14:32:39Z";
export const DANBOORU_PAGE_SIZE = 20;
export const DANBOORU_FIELDS = [
  "id",
  "created_at",
  "rating",
  "score",
  "fav_count",
  "md5",
  "file_ext",
  "file_size",
  "image_width",
  "image_height",
  "is_deleted",
  "is_banned",
  "is_pending",
  "is_flagged",
  "source",
  "pixiv_id",
  "tag_string_general",
  "tag_string_character",
  "tag_string_copyright",
  "tag_string_artist",
  "tag_string_meta",
  "media_asset[md5,file_ext,duration,variants]",
].join(",");

// Where an artist's original post may be linked from. Exact hosts only; anything else is dropped from
// facts.links (the Danbooru post itself stays the item URL).
export const SOURCE_LINK_HOSTS = {
  "www.pixiv.net": "pixiv",
  "x.com": "X",
  "twitter.com": "X",
  "bsky.app": "Bluesky",
  "www.bilibili.com": "bilibili",
  "t.bilibili.com": "bilibili",
  "space.bilibili.com": "bilibili",
  "www.instagram.com": "Instagram",
  "www.deviantart.com": "DeviantArt",
  "www.artstation.com": "ArtStation",
  "misskey.io": "Misskey",
  "skeb.jp": "Skeb",
  "fantia.jp": "Fantia",
  "www.youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "www.tiktok.com": "TikTok",
  "weibo.com": "Weibo",
  "www.weibo.com": "Weibo",
  "m.weibo.cn": "Weibo",
  "www.nicovideo.jp": "Niconico",
  "seiga.nicovideo.jp": "Niconico",
  "www.tumblr.com": "Tumblr",
  "www.plurk.com": "Plurk",
  "www.threads.com": "Threads",
};

// Fanservice/gore tags that make a general-rated post ineligible before any paid check. rules.js BAD_TAGS
// is also applied to every tag individually so the 40-tag sourceTags cap can never hide a bad tag.
// Evidence: 100 general-rated `meme` posts from the last 30 days sampled 2026-09-15 carried
// breasts-size tags (7), cleavage, arm_under_breasts, thighs (2), midriff (2), wet and blood/injury.
export const FANSERVICE_TAGS = new Set([
  "cleavage",
  "large_breasts",
  "huge_breasts",
  "gigantic_breasts",
  "breast_focus",
  "underboob",
  "sideboob",
  "arm_under_breasts",
  "breast_hold",
  "breast_press",
  "breasts_squeezed_together",
  "grabbing_another's_breast",
  "groping",
  "ass",
  "ass_focus",
  "butt_crack",
  "thighs",
  "thick_thighs",
  "thigh_focus",
  "panties",
  "pantyshot",
  "underwear",
  "underwear_only",
  "bra",
  "lingerie",
  "swimsuit",
  "bikini",
  "micro_bikini",
  "one-piece_swimsuit",
  "school_swimsuit",
  "competition_swimsuit",
  "nude",
  "completely_nude",
  "nipples",
  "covered_nipples",
  "groin",
  "cameltoe",
  "bottomless",
  "topless",
  "naked_towel",
  "naked_apron",
  "naked_shirt",
  "bathing",
  "see-through",
  "see-through_clothes",
  "wet_clothes",
  "sexually_suggestive",
  "implied_sex",
  "after_sex",
  "bdsm",
  "bondage",
  "bound",
  "shibari",
  "condom",
  "pregnant",
  "lactation",
  "spread_legs",
  "skirt_lift",
  "upskirt",
  "downblouse",
  "strap_slip",
  "foot_focus",
  "soles",
  "armpit_focus",
  "guro",
  "blood",
  "injury",
  "corpse",
  "death",
  "severed_head",
  "decapitation",
  "impaled",
  "hanging",
  "suicide",
  "self-harm",
  "horror_(theme)",
]);

// Meme formats that are sexual/lewd by construction even when a post is rated general. Taken from the
// 400 largest `*_(meme)` tags (tags.json name_matches, order=count) reviewed 2026-09-15.
export const LEWD_MEME_TAGS = new Set([
  "they_had_lots_of_sex_afterwards_(meme)",
  "boobs_in_book_(meme)",
  "lace_pantyhose_hooked_on_heel_(meme)",
  "hand_shadow_covering_breasts_(meme)",
  "daijoubu?_oppai_momu?_(meme)",
  "girl_staring_at_guy's_chest_(meme)",
  "uohhhhhhhhh!_(meme)",
  "iced_latte_with_breast_milk_(meme)",
  "your_bra_strap_is_showing_(meme)",
  "guy_tired_after_sex_(meme)",
  "pec_pov_(meme)",
  "one_finger_selfie_challenge_(meme)",
  "piper_perri_surrounded_(meme)",
  "negative_space_oral_(meme)",
  "although_she_hurriedly_put_on_clothes_(meme)",
  "can't_show_this_(meme)",
  "seggs_(meme)",
  "coomer_(meme)",
  "cover_them_up_slut_(meme)",
  "69_(meme)",
  "nipple_guessing_game_(meme)",
  "broly_culo_(meme)",
  "ankha_zone_(meme)",
  "sakuya's_pads_(meme)",
  "even_though_you_lost_your_virginity_to_me_(meme)",
  "italian_senate_porn_livestream_(meme)",
  "booba_(meme)",
  "huge_ass_lying_on_couch_pose_(meme)",
  "boobs?_wanna_touch_boobs?_(meme)",
  "hamedori_template_(meme)",
  "game_controller_nipples_(meme)",
  "precure_netorare_(meme)",
  "deez_nuts_(meme)",
  "cunny_(meme)",
  "sloppy_blowjob_devil_(meme)",
  "cuck_chair_(meme)",
  "ora_ora_get_pregnant_(meme)",
  "plap_plap_plap_get_pregnant_(meme)",
  "servants_holding_aphrodite's_breasts_(meme)",
  "femboy_hooters_(meme)",
  "insertion_threshold_(meme)",
  "leatherclub_scene_(meme)",
  "hasn't_kissed_anyone_ever_vs_expecting_a_kiss_with_tongue_(meme)",
  "feet_burger_(meme)",
  "are_you_a_virgin?_(meme)",
  "no_bitches?_(meme)",
  "nude_guy_wrapped_in_ribbons_standing_(meme)",
  "lightning_crotch_(meme)",
  "girlfriend_booty_(meme)",
  "among_us_twerk_(meme)",
  "assume_the_position_(meme)",
  "come_under_the_blanket_(meme)",
  "wombforce_(meme)",
  "woman_scared_of_breasts_(meme)",
  "boob_shadow_(meme)",
  "wintam_ribbon_bondage_(meme)",
  "world_cup_american_bikini_(meme)",
  "vaporeon_copypasta_(meme)",
  "lauren_phillips_lifting_alice_merchesi_(meme)",
  "nijihub_(meme)",
  "draw_me_like_one_of_your_french_girls_(meme)",
  "i've_never_seen_a_guy_recreate_this_successfully_tbh_(meme)",
  "cammy_stretch_(meme)",
  "wilhelmina_stretch_(meme)",
  "bakushin_o_armpit_gif_(meme)",
  "going_to_colombia_for_the_food_and_culture_(meme)",
  "114514_(meme)",
  "yjsnpi_interview_(meme)",
  "yajuu_no_gankou_(meme)",
  "yajuu_no_houkou_(meme)",
]);
// Other approved hard no's that show up as meme formats: AI imagery, self-harm, politics/drama, horror,
// body jokes and brainrot.
export const OFF_LIMITS_MEME_TAGS = new Set([
  "you_should_kill_yourself_now_(meme)",
  "italian_brainrot_ai_animals_(meme)",
  "ai_drawing_anime_characters_eating_ramen_(meme)",
  "domino's_pizza_ai_images_(meme)",
  "racist_momoi_(meme)",
  "social_credit_score_(meme)",
  "live_tucker_reaction_(meme)",
  "doorbell_chud_(meme)",
  "pride_flag_question_mark_(meme)",
  "mexico_ufo_alien_bodies_hearing_(meme)",
  "will_smith_slapping_chris_rock_(meme)",
  "nice_boat_(meme)",
  "grimace_shake_(meme)",
  "pennywise_in_the_sewer_(meme)",
  "here's_johnny!_(meme)",
  "fatass_teto_(meme)",
  "100kg_(meme)",
  "67_(meme)",
]);
// Unlisted lewd meme formats: any `*_(meme)` tag containing one of these words.
const LEWD_MEME_WORDS =
  /(?:^|_)(?:sex|seggs|oppai|boobs?|booba|breasts?|nipples?|virgin(?:ity)?|pregnant|blowjob|oral|porn|hentai|ecchi|lewd|horny|cunny|coomer|netorare|ntr|booty|twerk|womb|bikini|panty|panties|pantsu|crotch|culo|cuck|nsfw|nude|naked|ass|butt)(?:_|$)/;

// General tags that clearly identify a Maomao moment from the taste profile. Nothing else becomes a topic.
export const MOMENT_TAGS = {
  herb: "herbs",
  ginseng: "herbs",
  medicine: "herbs",
  medicine_bottle: "herbs",
  "mortar_(bowl)": "herbs",
  pestle: "herbs",
  apothecary: "herbs",
  poison: "poison",
  disgust: "disgusted face",
};
// Only tags that name the format itself. Danbooru's `pov` is a camera angle, not the POV meme.
export const FORMAT_TAGS = {
  comic: "comic",
  "1koma": "comic",
  "2koma": "comic",
  "3koma": "comic",
  "4koma": "comic",
  tweet: "text_post",
};

const STILL_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const split = (value) => String(value ?? "").split(/\s+/).filter(Boolean);
const humanize = (tag) => tag.replace(/_/g, " ").trim();
const shortName = (tag) => humanize(tag.replace(/_\([^)]*\)$/, ""));

function cdnUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === CDN && !url.port ? url.href : null;
  } catch {
    return null;
  }
}
const variant = (post, type) => {
  const found = (post.media_asset?.variants ?? []).find((v) => v?.type === type);
  const url = found && cdnUrl(found.url);
  return url ? { ...found, url } : null;
};
const stillVariant = (post) =>
  variant(post, "720x720") ?? variant(post, "sample") ?? variant(post, "360x360");
const dimension = (n) => (Number.isInteger(n) && n > 0 && n <= 30000 ? n : null);

/** Why a post can't be used, or null. Pure; exported for tests and probe accounting. */
export function skipReason(post) {
  if (!post || typeof post !== "object" || !Number.isInteger(post.id)) return "malformed";
  if (post.is_deleted) return "deleted";
  if (post.is_banned) return "banned";
  if (post.is_pending || post.is_flagged) return "unmoderated";
  // Owner decision (2026-09-16, second pass): "sensitive" is allowed alongside "general";
  // questionable/explicit are not. The vision check and the apparent-minor gate still apply.
  if (!DANBOORU_RATINGS.includes(post.rating)) return "rating";
  const meta = split(post.tag_string_meta);
  const general = split(post.tag_string_general);
  if ([...meta, ...general].some((t) => t === "ai-generated" || t === "ai-assisted")) return "ai";
  if (!split(post.tag_string_artist).length) return "no_artist";
  const all = [...general, ...meta, ...split(post.tag_string_character), ...split(post.tag_string_copyright)];
  if (
    all.some(
      (t) =>
        FANSERVICE_TAGS.has(t) ||
        LEWD_MEME_TAGS.has(t) ||
        OFF_LIMITS_MEME_TAGS.has(t) ||
        BAD_TAGS.test(t) ||
        (t.endsWith("_(meme)") && LEWD_MEME_WORDS.test(t.slice(0, -"_(meme)".length))),
    )
  )
    return "blocked_tag";
  const ext = String(post.media_asset?.file_ext ?? post.file_ext ?? "").toLowerCase();
  const moving = ext === "mp4" || (ext === "gif" && meta.includes("animated_gif"));
  if (!moving && !STILL_EXTS.has(ext)) return "unsupported_media";
  if (moving) {
    // Moving media is only shown after bounded frame sampling, which can't read more than 8 MiB.
    if (!(post.file_size > 0) || post.file_size > MEDIA_LIMITS.binary) return "clip_too_large";
    if (!variant(post, "original") || !variant(post, "720x720")) return "no_media";
  } else if (!stillVariant(post)) return "no_media";
  if (!/^[0-9a-f]{32}$/.test(String(post.md5 ?? post.media_asset?.md5 ?? ""))) return "no_media";
  return null;
}

function sourceLink(post) {
  if (Number.isInteger(post.pixiv_id) && post.pixiv_id > 0)
    return { kind: "source", label: "original post (pixiv)", url: `https://www.pixiv.net/artworks/${post.pixiv_id}` };
  let url;
  try {
    url = new URL(String(post.source ?? "").trim());
  } catch {
    return null;
  }
  const label = SOURCE_LINK_HOSTS[url.hostname.toLowerCase()];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !label || url.href.length > 1600)
    return null;
  url.hash = "";
  return { kind: "source", label: `original post (${label})`, url: url.href };
}

function media(post) {
  const ext = String(post.media_asset?.file_ext ?? post.file_ext ?? "").toLowerCase();
  const meta = split(post.tag_string_meta);
  const md5 = String(post.md5 ?? post.media_asset?.md5);
  if (ext === "mp4" || (ext === "gif" && meta.includes("animated_gif"))) {
    const original = variant(post, "original");
    const poster = variant(post, "720x720");
    const duration = Number(post.media_asset?.duration);
    return {
      type: ext === "mp4" ? "mp4" : "gif",
      url: original.url,
      width: dimension(original.width ?? post.image_width),
      height: dimension(original.height ?? post.image_height),
      poster: poster.url,
      duration: Number.isFinite(duration) && duration >= 0 && duration <= 36000 ? duration : null,
      bytes: Number.isInteger(post.file_size) ? post.file_size : null,
      identity: md5,
    };
  }
  const still = stillVariant(post);
  return { type: "image", url: still.url, width: dimension(still.width), height: dimension(still.height), identity: md5 };
}

function subject(post, lead) {
  // The purpose's own character leads (Maomao in a crowded crossover), then taste characters, then the rest.
  const tags = split(post.tag_string_character);
  const rank = (t) => (canonicalCharacters([t])[0] === lead ? 0 : 1);
  const known = tags.filter((t) => canonicalCharacters([t]).length).sort((x, y) => rank(x) - rank(y));
  const characters = [...new Set([...known, ...tags].map(shortName))];
  if (characters.length > 3) return `${characters.slice(0, 3).join(", ")} +${characters.length - 3}`;
  if (characters.length) return characters.length === 1 ? characters[0] : `${characters.slice(0, -1).join(", ")} & ${characters.at(-1)}`;
  const copyrights = split(post.tag_string_copyright).map(humanize);
  return copyrights[0] ?? "original";
}

/** A validated-shape FeedItem for one eligible post. `purpose` is "maomao" | "vocaloid" | "meme". */
export function postItem(entry, post, purpose) {
  const artists = split(post.tag_string_artist);
  const characterTags = split(post.tag_string_character);
  const copyrightTags = split(post.tag_string_copyright);
  const general = split(post.tag_string_general);
  const meta = split(post.tag_string_meta);
  const m = media(post);
  const fandoms = canonicalFandoms(copyrightTags);
  if (purpose === "maomao" && !fandoms.includes("the apothecary diaries")) fandoms.push("the apothecary diaries");
  const characters = canonicalCharacters(characterTags);
  const voicebanks = canonicalVoicebanks(characterTags);
  const topics = fandoms.includes("the apothecary diaries")
    ? [...new Set(general.map((t) => MOMENT_TAGS[t]).filter(Boolean))]
    : [];
  const formats = purpose === "meme" ? [...new Set(general.map((t) => FORMAT_TAGS[t]).filter(Boolean))] : [];
  let sections = entry.sections;
  let kind = m.type === "image" ? "image" : "clip";
  if (purpose === "meme") {
    kind = "meme";
    sections = ["meme"];
    if (fandoms.includes("the apothecary diaries")) sections.push("maomao");
    if (voicebanks.length || fandoms.includes("vocaloid") || fandoms.includes("project sekai")) sections.push("music");
  }
  const artistName = artists.slice(0, 3).map(humanize).join(" & ") + (artists.length > 3 ? ` +${artists.length - 3}` : "");
  const noun = kind === "meme" ? "meme" : kind === "clip" ? "animation" : "art";
  // Safety-relevant tags first; the list is capped at 40 entries by the item schema.
  const flagged = general.filter((t) => BAD_TAGS.test(t) || t.endsWith("_(meme)"));
  const sourceTags = [...new Set([...meta, ...flagged, ...general, ...copyrightTags, ...characterTags])]
    .filter((t) => t.length <= 100)
    .slice(0, 40);
  const link = sourceLink(post);
  return {
    source: entry.id,
    nativeId: String(post.id),
    sections,
    kind,
    title: clip(`${subject(post, purpose === "vocaloid" ? "hatsune miku" : "maomao")} ${noun} by ${artistName}`, 200),
    url: `https://${HOST}/posts/${post.id}`,
    media: [m],
    credit: {
      name: clip(artistName, 200),
      handle: artists[0].slice(0, 100),
      profileUrl: `https://${HOST}/posts?tags=${encodeURIComponent(artists[0])}`,
      platform: "Danbooru",
    },
    // No units: Danbooru has no SEKAI unit tags, and general tags such as `idol`/`street` would match
    // the shared unit aliases by accident.
    tags: { characters, fandoms, voicebanks, formats, topics },
    facts: {
      names: [...artists, ...characterTags].filter((t) => t.length <= 100).slice(0, 40),
      sourceScore: Math.max(0, Number(post.score) || 0),
      links: link ? [link] : [],
    },
    safety: { rating: post.rating, sourceTags },
    publishedAt: toIso(post.created_at),
    mediaIdentity: String(post.md5 ?? post.media_asset?.md5),
  };
}

export function postsUrl(tags, before = null) {
  const url = new URL(`https://${HOST}/posts.json`);
  url.searchParams.set("tags", tags);
  url.searchParams.set("limit", String(DANBOORU_PAGE_SIZE));
  url.searchParams.set("only", DANBOORU_FIELDS);
  if (before) url.searchParams.set("page", `b${before}`);
  return url.href;
}

function userAgentHeaders(ctx) {
  // help:api asks clients to include their Danbooru user ID. Used only when the owner configures one.
  const id = ctx.credentials?.DANBOORU_USER_ID;
  return /^\d{1,10}$/.test(String(id ?? ""))
    ? { "user-agent": `kiriya.love personal feed/1.0 (+https://kiriya.love; user #${id})` }
    : {};
}

/**
 * One request per page. Cursor `{q, b, p}`: query index, `page=b<id>` bound (last examined post) and the
 * number of requests made for that query. Each query stops after `pages` requests.
 */
function queryFetcher(target, purpose, queries) {
  return async function fetchDanbooru(ctx) {
    const state = cursorCodec.decode(ctx.cursor, {});
    const q = Number.isInteger(state.q) && state.q >= 0 ? state.q : 0;
    if (q >= queries.length) return { items: [], cursor: null, done: true };
    const query = queries[q];
    const before = Number.isInteger(state.b) && state.b > 0 ? state.b : null;
    const made = Number.isInteger(state.p) && state.p > 0 ? state.p : 0;
    const posts = await ctx.http.json(postsUrl(query.tags, before), { headers: userAgentHeaders(ctx) });
    if (!Array.isArray(posts)) throw new FeedError("source_shape", 503);
    const max = Math.min(8, ctx.limits.items);
    const items = [];
    let last = null;
    let full = false;
    for (const post of posts) {
      if (items.length >= max) {
        full = true;
        break;
      }
      if (Number.isInteger(post?.id)) last = post.id;
      if (skipReason(post)) continue;
      items.push(postItem(target, post, purpose));
    }
    const more = (full || posts.length >= DANBOORU_PAGE_SIZE) && last !== null && made + 1 < query.pages;
    const next = more ? { q, b: last, p: made + 1 } : { q: q + 1 };
    if (next.q >= queries.length) return { items, cursor: null, done: true };
    return { items, cursor: cursorCodec.encode(next), done: false };
  };
}

export async function recheckDanbooru(item, ctx) {
  const scope = "post";
  if (!/^\d{1,12}$/.test(String(item?.nativeId ?? ""))) return { state: "transient", scope };
  try {
    const post = await ctx.http.json(`https://${HOST}/posts/${item.nativeId}.json?only=id,rating,is_deleted,is_banned`);
    if (!post || typeof post !== "object" || !Number.isInteger(post.id)) return { state: "transient", scope };
    if (post.is_deleted || post.is_banned || !DANBOORU_RATINGS.includes(post.rating)) return { state: "removed", scope };
    return { state: "present", scope };
  } catch (error) {
    return {
      state: error.code === "not_found" ? "removed" : error.code === "blocked" ? "restricted" : "transient",
      scope,
    };
  }
}

const COMMON = {
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  hosts: [HOST],
  mediaHosts: [CDN],
  linkHosts: Object.keys(SOURCE_LINK_HOSTS),
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: ["DANBOORU_USER_ID"],
  maxBytes: 512 * 1024,
  paceMs: 1100,
  timeoutMs: 15000,
  cacheSeconds: 86400,
  attributionRequired: true,
  mediaPolicy: "moving_sampled",
  copyPolicy: "private_copy",
  copyPermission: {
    basis:
      "Danbooru Terms of Service (last updated 2022-10-23, read live) place no restriction on API clients caching or storing content; API use must follow the rate limits in help:api. Owner decision (PIPELINE §2 and §10, 2026-09-14) to keep private, non-public personal copies with artist credit and the original source link. Copyright stays with the artist and this is not a licence grant; copies are removed when Danbooru deletes, bans or re-rates the post (honor_deletions, 72 h).",
    sourceUrl: TERMS_URL,
    verifiedAt: DANBOORU_VERIFIED_AT,
  },
  deletionPolicy: "honor_deletions",
  deletionDeadlineHours: 72,
  termsUrl: TERMS_URL,
  docsUrl: DOCS_URL,
  recheck: recheckDanbooru,
};

// Query tags: at most 2 counted tags each; everything else is a free metatag.
export const MAOMAO_QUERIES = [
  { key: "maomao", tags: "maomao_(kusuriya_no_hitorigoto) rating:g,s status:active age:<30d score:>=8", pages: 2 },
];
export const VOCALOID_QUERIES = [
  { key: "miku", tags: "hatsune_miku rating:g,s status:active age:<7d score:>=10", pages: 2 },
  { key: "miku-gif", tags: "hatsune_miku animated_gif rating:g,s status:active age:<1y score:>=3", pages: 1 },
  { key: "rin-len", tags: "~kagamine_rin ~kagamine_len rating:g,s status:active age:<7d score:>=5", pages: 1 },
  { key: "luka-kaito", tags: "~megurine_luka ~kaito_(vocaloid) rating:g,s status:active age:<7d score:>=5", pages: 1 },
  { key: "meiko-teto", tags: "~meiko_(vocaloid) ~kasane_teto rating:g,s status:active age:<7d score:>=5", pages: 1 },
  { key: "gumi", tags: "gumi rating:g,s status:active age:<7d score:>=5", pages: 1 },
];
export const DANBOORU_RATINGS = ["g", "s"];
export const MEME_QUERIES = [
  { key: "anime", tags: "meme rating:g,s status:active age:<7d score:>=10", pages: 2 },
  { key: "apothecary", tags: "kusuriya_no_hitorigoto meme rating:g,s status:active", pages: 2 },
  { key: "sekai", tags: "project_sekai meme rating:g,s status:active age:<1y score:>=3", pages: 1 },
  { key: "vocaloid", tags: "vocaloid meme rating:g,s status:active age:<1y score:>=3", pages: 1 },
  { key: "minecraft", tags: "minecraft meme rating:g,s status:active age:<1y score:>=3", pages: 1 },
];

export const danbooruMaomao = {
  ...COMMON,
  id: "danbooru-maomao",
  sections: ["maomao"],
  maxRequests: 4,
  notes:
    "Tag maomao_(kusuriya_no_hitorigoto) (2,062 posts, character category) with rating:g,s status:active age:<30d score:>=8 — one counted tag. AI (ai-generated/ai-assisted), deleted/banned/pending/flagged, questionable/explicit, artist-less, fanservice/gore-tagged, webm/zip and >8 MiB clips are skipped in code. Stills use the 720x720 CDN variant; mp4/animated GIFs use the original file with the 720x720 still as poster. Credit: artist tag; source link from pixiv_id or the post's source on an allowlisted host. Anonymous requests carry the helper User-Agent; help:api also asks for a user ID (optional DANBOORU_USER_ID, no account was created). robots.txt disallows /*.json for crawlers: this is bounded use of the documented API (help:api), not crawling — owner/orchestrator should confirm that reading.",
  fetch: queryFetcher({ id: "danbooru-maomao", sections: ["maomao"] }, "maomao", MAOMAO_QUERIES),
};
export const danbooruVocaloid = {
  ...COMMON,
  id: "danbooru-vocaloid",
  sections: ["music"],
  maxRequests: 9,
  notes:
    "Miku first (score:>=10, 7 days, up to 2 requests), real GIFs via hatsune_miku animated_gif (1 year, animated GIFs are rare: 2 in 90 days), then two-term ~or pairs Rin|Len, Luka|KAITO, MEIKO|Teto and GUMI (score:>=5, 7 days). Voicebanks and characters come from character tags; the project_sekai copyright tag maps to the project sekai fandom. Same filters, policies and robots.txt caveat (/*.json disallowed for crawlers) as danbooru-maomao.",
  fetch: queryFetcher({ id: "danbooru-vocaloid", sections: ["music"] }, "vocaloid", VOCALOID_QUERIES),
};
export const danbooruMemes = {
  ...COMMON,
  id: "danbooru-memes",
  sections: ["meme", "maomao", "music"],
  maxRequests: 8,
  notes:
    "General anime memes (meme, 7 days, score:>=10) plus kusuriya_no_hitorigoto/project_sekai/vocaloid/minecraft meme back catalogues (2 counted tags each). Sections: meme always, maomao or music only when the copyright/character tags match. Formats only from comic/Nkoma (comic) and tweet (text_post). Lewd meme formats (LEWD_MEME_TAGS plus lewd words inside *_(meme) tags) and off-limits meme formats are skipped before any paid check. Same policies and robots.txt caveat as danbooru-maomao.",
  fetch: queryFetcher({ id: "danbooru-memes", sections: ["meme", "maomao", "music"] }, "meme", MEME_QUERIES),
};
