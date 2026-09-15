// YouTube Data API v3 collectors (API key only). Written from the official documentation because the
// key exists only as a Vercel Sensitive value; live verification is pending deployment.
//
// Basis (developers.google.com, read 2026-09-15; pages show "Last updated 2026-09-14"):
// - Quota (determine_quota_cost): channels.list, playlistItems.list and videos.list cost 1 unit each from
//   the shared 10,000/day bucket; search.list has its own bucket of 100 calls/day at 1 unit each
//   (revision history, 2026-06-01).
// - Uploads: channels.list contentDetails.relatedPlaylists.uploads, then playlistItems.list. The
//   "UULF"/"UUSH" playlist prefixes are not documented anywhere, so they are not used; Shorts are dropped
//   by aspect ratio (player.embedWidth/embedHeight with maxWidth) and duration instead.
// - Developer Policies III.E.4: Non-Authorized Data at most 30 days, then refresh or delete; III.E.4.j:
//   look up madeForKids for embedded videos (requested with part=status); III.F.2.a: show YouTube as the
//   source. III.D.7 forbids undocumented APIs, so oEmbed and channel RSS are not used. Channel pages are
//   never fetched.
import { FeedError } from "../config.js";
import { asArray, clip, cursor as pageCursor, stripHtml, toIso } from "./util.js";
import {
  CHARACTER_ALIASES,
  COSPLAY_FORMATS,
  FANDOM_ALIASES,
  UNIT_ALIASES,
  VOICEBANKS,
  canonicalFandoms,
  mentions,
} from "./tags.js";
import {
  DAY_MS,
  dayIndex,
  playable,
  playbackFrom,
  songVerdict,
  youtubeDataExpiry,
  youtubePoster,
  youtubeUrl,
  youtubeVideos,
  youtubeWatchUrl,
} from "./vocadb.js";

const VIDEO_ID = /^[\w-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_PARTS = ["snippet", "status", "contentDetails", "statistics", "player"];
const TERMS_URL = "https://developers.google.com/youtube/terms/developer-policies";
const DOCS_URL = "https://developers.google.com/youtube/v3/docs";
const VIDEO_LICENSE = "YouTube video; rights stay with the uploader";

// Aliases that are SEKAI data codes or common words: fine for exact lookups, wrong for free text.
const CODE_ALIASES = new Set(["street", "idol", "piapro", "light_sound", "school_refusal", "light music club", "theme_park", "light_music_club"]);
const UNIT_TEXT = Object.fromEntries(
  Object.entries(UNIT_ALIASES).map(([unit, aliases]) => [unit, aliases.filter((alias) => !CODE_ALIASES.has(alias))]),
);
const VOICEBANK_TEXT = Object.fromEntries(VOICEBANKS.map((v) => [v, CHARACTER_ALIASES[v] ?? []]));
const unique = (values) => [...new Set(values.filter(Boolean))];

function requireKey(ctx) {
  const key = ctx.credentials?.YOUTUBE_API_KEY;
  if (!key) throw new FeedError("not_configured", 503);
  return key;
}

// ---------------------------------------------------------------------------------------------
// Channels. IDs came from the 2026-09-15 research run; `evidence` is what could be confirmed without
// contacting YouTube (official site links and VocaDB artist links). At runtime channels.list confirms
// each ID exists, supplies the documented uploads playlist, and its title must contain one of `titles`
// before uploads are recorded with owner provenance; otherwise provenance stays "unknown". Credit always
// uses the uploader's channelTitle returned by the API.
// ---------------------------------------------------------------------------------------------

export const MUSIC_CHANNELS = [
  { id: "UCdMGYXL38w6htx6Yf9YJa-w", name: "Project SEKAI COLORFUL STAGE! (JP)", titles: ["プロジェクトセカイ", "project sekai"], official: true, mode: "songs", fandoms: ["project sekai"], evidence: "pjsekai.sega.jp links /channel/<id>" },
  { id: "UCeWCjteIDYK34E7bCZBTcLA", name: "HATSUNE MIKU: COLORFUL STAGE! (Global)", titles: ["colorful stage"], official: true, mode: "all", fandoms: ["project sekai"], evidence: "VocaDB tag 7323 lists it as 'YouTube Channel (EN)'" },
  { id: "UCJwGWV914kBlV4dKRn7AEFA", name: "Hatsune Miku (Crypton)", titles: ["hatsune miku", "初音ミク"], official: true, mode: "all", fandoms: ["vocaloid"], evidence: "crypton.co.jp/piapro.net link /user/HatsuneMiku; VocaDB Ar/1 lists the ID" },
  { id: "UCgfXaWxRyF0WGZtktVliryQ", name: "piaproTV (Crypton)", titles: ["piapro", "ピアプロ"], official: true, mode: "all", fandoms: ["vocaloid"], evidence: "magicalmirai.com/2026 links /channel/<id>" },
  { id: "UCGmO0S4S-AunjRdmxA6TQYg", name: "DECO*27", titles: ["deco*27"], vocadb: 45, mode: "songs", evidence: "otoiro.co.jp links @DECO27; VocaDB Ar/45 lists the ID" },
  { id: "UCMMBGMjrrWcRZmG_lW4jC-Q", name: "PinocchioP", titles: ["pinocchiop", "ピノキオピー"], vocadb: 28, mode: "songs", evidence: "pinocchiop.com links /user/pinocchiopchannel; VocaDB Ar/28 lists the ID" },
  { id: "UC10BM9XdLdrvB8japwmRUvA", name: "Kanaria", titles: ["kanaria", "カナリア"], vocadb: 80976, mode: "songs", evidence: "VocaDB Ar/80976 only" },
  { id: "UCraC7460yGQF4GDmSjCecpQ", name: "syudou", titles: ["syudou"], vocadb: 4834, mode: "songs", evidence: "syudou.com links /channel/<id>" },
  { id: "UCLz6MG2kx_0xeaW0LowYnMQ", name: "iyowa", titles: ["iyowa", "いよわ"], vocadb: 65229, mode: "songs", evidence: "VocaDB Ar/65229 only" },
  { id: "UCG09qajPDZdPtLsTkW7mJQA", name: "40mP", titles: ["40mp", "40meterp"], vocadb: 8, mode: "songs", evidence: "40mp-official.com links /user/40meterP; VocaDB Ar/8 lists the ID" },
  { id: "UCAaGaynFpku5cAx6OOSrW-w", name: "HoneyWorks", titles: ["honeyworks"], vocadb: 855, mode: "songs", evidence: "honeyworks.jp links /channel/<id>" },
  { id: "UCSmHk3xH3nkWqF0nm9z2-2Q", name: "mothy", titles: ["mothy", "悪ノp"], vocadb: 189, mode: "songs", evidence: "VocaDB Ar/189 only" },
  { id: "UCxKrjx1FDU81UXuwTgwYQHw", name: "Hitoshizuku×Yama△", titles: ["hitoshizuku", "ひとしずく"], vocadb: 3188, mode: "songs", evidence: "hitoyamamusic.com links @hitoshizuku_yama; VocaDB lists the ID on the duo" },
  { id: "UChK8kgGU767nKTxp4f4GD6g", name: "NayutalieN", titles: ["nayutalien", "nayutan", "ナユタン星人"], vocadb: 36280, mode: "songs", evidence: "nayutalien.com links /channel/<id>" },
  { id: "UCy9UVm-UjHqcktvxg-sS4qQ", name: "ryo (supercell)", titles: ["supercell", "ryo"], vocadb: 67, mode: "songs", evidence: "supercell.jp links /channel/<id>" },
  { id: "UCQcboHvGXFE5vuy2AK2MUOg", name: "kz (livetune)", titles: ["livetune", "kz"], vocadb: 89, mode: "songs", evidence: "research RSS only (unconfirmed)" },
  { id: "UCE0uNSkGhhsNMwAZcIQY7rw", name: "Mitchie M", titles: ["mitchie"], vocadb: 624, mode: "songs", evidence: "mitchie-m.com links /c/MitchieM; VocaDB Ar/624 lists the ID" },
  { id: "UCfdFNsR_tvF8bwp0KhMaJZQ", name: "TOKOTOKO", titles: ["tokotoko", "西沢さんp"], vocadb: 305, mode: "songs", evidence: "VocaDB Ar/305 only" },
  { id: "UCft5HulDeuKloukyShxyOZA", name: "Chinozo", titles: ["chinozo", "チノズォ"], vocadb: 67910, mode: "songs", evidence: "VocaDB Ar/67910 only" },
  { id: "UCoQS4Xewa-LIS2E8CBSjkgA", name: "Ayase", titles: ["ayase"], vocadb: 70347, mode: "songs", evidence: "VocaDB Ar/70347 only (its first link is YOASOBI's channel, not this one)" },
  { id: "UCGGY3oTOQ9g9FCu9hLFJsqw", name: "*Luna", titles: ["luna"], vocadb: 1620, mode: "songs", evidence: "ast-luna.com links /channel/<id>" },
  { id: "UCvq3kUGY5Dbsdkr3DZx25Sw", name: "Giga", titles: ["giga"], vocadb: 772, mode: "songs", evidence: "giga.style links youtube.com/GigaVideos; VocaDB Ar/772 lists the ID" },
];

const nameKey = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
/** The channels.list title contains one of the expected names (case, width and punctuation ignored). */
export function channelTitleMatches(channel, title) {
  const actual = nameKey(title);
  return Boolean(actual) && asArray(channel.titles ?? [channel.name]).some((name) => {
    const expected = nameKey(name);
    return expected.length >= 2 && actual.includes(expected);
  });
}
/** Verified in research but excluded: she did not pick the dark & intense group. */
export const DARK_INTENSE_CHANNELS = [
  { id: "UCmj0YkPwo47bPoBt9ma-bxg", name: "MARETU" },
  { id: "UCp13SxKXbhCS0lb6Ty774iQ", name: "Kairiki bear" },
  { id: "UClxXuM2m0rIL9VCA1ds9HqA", name: "Neru OFFICIAL" },
  { id: "UCq3vSkJtBZdBjC8yrG-1xmA", name: "Kikuo" },
];
const DARK_CHANNEL_IDS = new Set(DARK_INTENSE_CHANNELS.map((c) => c.id));

// None of these IDs could be tied to the creator by a primary source without contacting YouTube (the
// creators' sites link @handles only), so the runtime title check decides provenance.
export const TUTORIAL_CHANNELS = [
  { id: "UCJifGeBP7fl59XwxeUYM7ag", name: "Kleiner Pixel", titles: ["kleiner pixel"] },
  { id: "UCn5_or6x8HqYbl3kVDimgJg", name: "Hanie Comb", titles: ["hanie"] },
  { id: "UCJRIterpI7fH_c7U6p0jHOg", name: "Epic Cosplay Wigs", titles: ["epic cosplay"] },
  { id: "UCbSST-QoAQKqtgZbmf3gI3g", name: "Cowbutt Crunchies", titles: ["cowbutt"] },
  { id: "UCiDvE4FTPu2oPIXyn6EJNcw", name: "Franciscosplays", titles: ["francis"] },
  { id: "UC79qFuymkVas5dCScbLF9fw", name: "Kamui Cosplay", titles: ["kamui"] },
];
export const TUTORIAL_QUERIES = [
  "maomao cosplay",
  "miku cosplay wig",
  "frieren cosplay makeup",
  "project sekai cosplay wig",
  "witch hat atelier cosplay",
  "genshin cosplay makeup tutorial",
];
export const SEARCH_CALLS_PER_DAY = 3;

/** TOHO animation's channel, linked by handle from https://www.toho.co.jp/sns/ (checked 2026-09-15). */
export const APOTHECARY_CHANNEL = { handle: "@TOHOanimation", name: "TOHO animation チャンネル" };
/** PVs embedded by the official site (kusuriyanohitorigoto.jp trailer carousel, news/2623 and news/2520). */
export const APOTHECARY_SEED_VIDEOS = ["9rProUQlD-I", "HP5wg0kTh54", "g1pKfngmcAM", "a4j4V8iZ_wg"];
const APOTHECARY_TEXT = /薬屋のひとりごと|kusuriya|apothecary diaries/i;

export function youtubeMusicPlan(day) {
  const n = dayIndex(day);
  const official = MUSIC_CHANNELS.filter((c) => c.official);
  const producers = MUSIC_CHANNELS.filter((c) => !c.official && !DARK_CHANNEL_IDS.has(c.id));
  const start = (n * 5) % producers.length;
  return [...official, ...Array.from({ length: 5 }, (_, k) => producers[(start + k) % producers.length])];
}

export function youtubeTutorialPlan(day) {
  const n = dayIndex(day);
  const channels = Array.from({ length: 3 }, (_, k) => ({ type: "channel", channel: TUTORIAL_CHANNELS[(n * 3 + k) % TUTORIAL_CHANNELS.length] }));
  const searches = Array.from({ length: SEARCH_CALLS_PER_DAY }, (_, k) => ({
    type: "search",
    query: TUTORIAL_QUERIES[(n * SEARCH_CALLS_PER_DAY + k) % TUTORIAL_QUERIES.length],
  }));
  return [...channels, ...searches];
}

// ---------------------------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------------------------

/** Items of a YouTube list response of the expected `kind`; anything else is malformed, not empty. */
function listItems(data, kind) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new FeedError("invalid_source_json");
  if (data.kind !== kind || (data.items !== undefined && !Array.isArray(data.items))) throw new FeedError("invalid_source_json");
  return asArray(data.items);
}

/** channels.list by up to 50 IDs in one call (1 unit). */
export async function channelsById(http, key, ids) {
  const out = new Map();
  const wanted = unique(asArray(ids).filter((id) => CHANNEL_ID.test(id)));
  for (let i = 0; i < wanted.length; i += 50) {
    const data = await http.json(youtubeUrl("channels", { part: "snippet,contentDetails", id: wanted.slice(i, i + 50).join(",") }, key));
    for (const channel of listItems(data, "youtube#channelListResponse")) {
      if (!CHANNEL_ID.test(channel?.id ?? "")) continue;
      out.set(channel.id, {
        id: channel.id,
        title: String(channel.snippet?.title ?? ""),
        uploads: channel.contentDetails?.relatedPlaylists?.uploads ?? null,
      });
    }
  }
  return out;
}

const handleCache = new Map();
export const clearChannelCache = () => handleCache.clear();

/** channels.list?forHandle= (1 unit), cached per warm instance for a day. */
export async function channelByHandle(http, key, handle) {
  const cached = handleCache.get(handle);
  if (cached && Date.now() - cached.at < DAY_MS) return cached.channel;
  const data = await http.json(youtubeUrl("channels", { part: "snippet,contentDetails", forHandle: handle }, key));
  const channel = listItems(data, "youtube#channelListResponse").find((c) => CHANNEL_ID.test(c?.id ?? ""));
  const resolved = channel
    ? { id: channel.id, title: String(channel.snippet?.title ?? ""), uploads: channel.contentDetails?.relatedPlaylists?.uploads ?? null }
    : null;
  handleCache.set(handle, { at: Date.now(), channel: resolved });
  return resolved;
}

/**
 * playlistItems.list (1 unit): recent uploads with their publish time. A channel whose uploads playlist
 * does not exist (documented 404 playlistNotFound, e.g. no public uploads) has no uploads; every other
 * failure (quota, key, outage) propagates.
 */
export async function recentUploads(http, key, playlistId, { max = 15, windowMs, now = Date.now(), part = "contentDetails" } = {}) {
  let data;
  try {
    data = await http.json(youtubeUrl("playlistItems", { part, playlistId, maxResults: max }, key));
  } catch (error) {
    if (error?.code === "not_found") return [];
    throw error;
  }
  return listItems(data, "youtube#playlistItemListResponse")
    .map((entry) => ({
      id: entry?.contentDetails?.videoId,
      at: Date.parse(entry?.contentDetails?.videoPublishedAt ?? ""),
      title: String(entry?.snippet?.title ?? ""),
    }))
    .filter((u) => VIDEO_ID.test(u.id ?? "") && Number.isFinite(u.at) && u.at <= now && (!windowMs || now - u.at <= windowMs));
}

export function isoDurationSeconds(value) {
  const m = String(value ?? "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m || value === "P" || value === "PT") return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

/** Shorts: vertical and at most 3 minutes, "#shorts" in the title, or at most 60 s with unknown shape. */
export function isShort(video) {
  const seconds = isoDurationSeconds(video?.contentDetails?.duration);
  const width = Number(video?.player?.embedWidth);
  const height = Number(video?.player?.embedHeight);
  const known = width > 0 && height > 0;
  if (/#shorts?\b/i.test(String(video?.snippet?.title ?? ""))) return true;
  if (known) return height > width && (seconds === null || seconds <= 180);
  return seconds !== null && seconds <= 60;
}

const liveOrUpcoming = (video) => !["none", undefined].includes(video?.snippet?.liveBroadcastContent);

/** VocaDB credits for a YouTube video (keyless). Returns a songVerdict or null when VocaDB has no entry. */
async function vocadbMatch(http, videoId, now) {
  const song = await http.json(
    `https://vocadb.net/api/songs/byPv?pvService=Youtube&pvId=${encodeURIComponent(videoId)}&fields=Artists,Tags,WebLinks&lang=English`,
  );
  if (song === null) return null;
  return songVerdict(song, { now, requirePv: false });
}

function firstParagraph(description) {
  const text = stripHtml(String(description ?? "").split(/\n\s*\n/)[0]);
  return text ? clip(text, 300) : "";
}

function videoItem(entry, video, { kind, sections, provenance, checkedAt, now, fandoms = [], match = null, characters = [], formats = [], extraLinks = [] }) {
  const id = video.id;
  const snippet = video.snippet ?? {};
  const title = clip(stripHtml(snippet.title) || id, 200);
  const text = `${snippet.title ?? ""}\n${firstParagraph(snippet.description)}`;
  // Voicebank, unit and producer tags only describe music items.
  const music = sections.includes("music");
  const channelId = CHANNEL_ID.test(snippet.channelId ?? "") ? snippet.channelId : "";
  const playback = playbackFrom(video, { provenance, checkedAt });
  const seconds = isoDurationSeconds(video.contentDetails?.duration);
  const width = Number(video.player?.embedWidth);
  const height = Number(video.player?.embedHeight);
  const views = Number(video.statistics?.viewCount);
  const excerpt = firstParagraph(snippet.description);
  const lang = String(snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? "").slice(0, 10);
  const watch = youtubeWatchUrl(id);
  return {
    source: entry.id,
    nativeId: id,
    sections,
    kind,
    title,
    url: watch,
    media: [
      {
        type: "youtube",
        url: watch,
        poster: youtubePoster(id),
        width: width > 0 ? Math.round(width) : null,
        height: height > 0 ? Math.round(height) : null,
        duration: seconds,
        alt: title,
        identity: `youtube:${id}`,
      },
    ],
    mediaIdentity: `youtube:${id}`,
    credit: {
      name: clip(stripHtml(snippet.channelTitle) || "YouTube channel", 200),
      handle: channelId,
      profileUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
      platform: "YouTube",
      license: VIDEO_LICENSE,
    },
    tags: {
      characters: unique(characters),
      fandoms: canonicalFandoms(unique([...fandoms, ...(match?.fandoms ?? []), ...mentions(text, FANDOM_ALIASES)])),
      voicebanks: music ? unique([...(match?.voicebanks ?? []), ...mentions(text, VOICEBANK_TEXT)]) : [],
      producers: music ? unique((match?.producers ?? []).map((name) => clip(name.toLowerCase(), 100))).slice(0, 40) : [],
      units: music ? unique([...(match?.units ?? []), ...mentions(text, UNIT_TEXT)]) : [],
      formats: unique(formats),
      topics: match?.topics ?? [],
    },
    facts: {
      excerpts: excerpt ? [excerpt] : [],
      names: unique([stripHtml(snippet.channelTitle), ...(match?.producers ?? [])].map((n) => clip(n ?? "", 100))).slice(0, 40),
      sourceScore: Number.isFinite(views) && views > 0 ? Math.min(views, 1_000_000_000) : 0,
      links: [{ kind: "watch", label: "YouTube", url: watch }, ...extraLinks].slice(0, 8),
      playback,
      lang,
    },
    safety: {
      rating: "unknown",
      labels: video.status?.madeForKids === true ? ["youtube:made_for_kids"] : [],
      sourceTags: match?.warnings ?? [],
    },
    publishedAt: toIso(snippet.publishedAt),
    expiresAt: youtubeDataExpiry(now),
  };
}

/**
 * Kept only when it is a regular, finished upload that embeds and plays in Singapore and is not age
 * restricted (PIPELINE §5.2 and §7). The playback facts recorded on each item come from the same check.
 */
export function usable(video) {
  if (!video || isShort(video) || liveOrUpcoming(video)) return false;
  return playable(playbackFrom(video, { provenance: "unknown", checkedAt: new Date(0).toISOString() }));
}

// ---------------------------------------------------------------------------------------------
// youtube-music
// ---------------------------------------------------------------------------------------------

const SONG_TITLE = /3DMV|2DMV|\bMV\b|music video|feat\.|ver\.|セカイver|バーチャル・シンガー|初音ミク|鏡音|巡音/i;
/** Daily collection keeps a short window; older uploads are already stored (expiry up to 30 days). */
export const MUSIC_WINDOW_MS = 7 * DAY_MS;
export const BYPV_PER_PAGE = 4;

function readState(ctx) {
  const state = pageCursor.decode(ctx.cursor, {});
  return state.d === ctx.day && Number.isInteger(state.i) && state.i >= 0 ? state : { i: 0 };
}
function nextPage(ctx, state, planLength, items) {
  const i = state.i + 1;
  return i >= planLength ? { items, cursor: null, done: true } : { items, cursor: pageCursor.encode({ ...state, v: 1, d: ctx.day, i }), done: false };
}

/**
 * Resolves the plan's channels once (1 unit). The cursor keeps the documented uploads playlist IDs (`u`)
 * and whether each channel's returned title matched its expected names (`t`, "1"/"0").
 */
async function uploadsForPlan(ctx, key, state, channels) {
  if (Array.isArray(state.u) && state.u.length === channels.length && typeof state.t === "string" && state.t.length === channels.length)
    return { u: state.u, t: state.t };
  const found = await channelsById(ctx.http, key, channels.map((c) => c.id));
  if (!found.size) throw new FeedError("youtube_channels_unavailable", 503);
  return {
    u: channels.map((c) => found.get(c.id)?.uploads ?? null),
    t: channels.map((c) => (found.has(c.id) && channelTitleMatches(c, found.get(c.id).title) ? "1" : "0")).join(""),
  };
}

async function fetchYoutubeMusic(ctx) {
  const key = requireKey(ctx);
  const plan = youtubeMusicPlan(ctx.day);
  let state = readState(ctx);
  if (state.i >= plan.length) return { items: [], cursor: null, done: true };
  const resolved = await uploadsForPlan(ctx, key, state, plan);
  state = { ...state, ...resolved };
  const uploads = resolved.u;
  const channel = plan[state.i];
  const provenance = resolved.t[state.i] === "1" ? "official_channel" : "unknown";
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  if (!uploads[state.i] || !limit) return nextPage(ctx, state, plan.length, []);

  const now = Date.now();
  const recent = await recentUploads(ctx.http, key, uploads[state.i], { max: 15, windowMs: MUSIC_WINDOW_MS, now });
  if (!recent.length) return nextPage(ctx, state, plan.length, []);
  const videos = await youtubeVideos(ctx.http, key, recent.map((u) => u.id), VIDEO_PARTS, { maxWidth: 480 });
  const checkedAt = new Date(now).toISOString();
  const items = [];
  let lookups = 0;
  for (const upload of recent) {
    if (items.length >= limit) break;
    const video = videos.get(upload.id);
    if (!usable(video) || video.snippet?.channelId !== channel.id) continue;
    const wantsSong = channel.mode === "songs";
    // Producer uploads are always looked up; official channels only for song-like titles.
    const worthLookup = !channel.official || SONG_TITLE.test(video.snippet?.title ?? "");
    let match = null;
    if (worthLookup && lookups < BYPV_PER_PAGE) {
      lookups++;
      match = await vocadbMatch(ctx.http, upload.id, now);
    }
    // Excluded tags, dark & intense producers or unreleased entries: drop the video outright.
    if (match && !match.ok && !["not_her_voicebanks", "no_youtube_original"].includes(match.reason)) continue;
    const song = match?.ok ? match : null;
    if (wantsSong && !song) continue;
    items.push(
      videoItem(youtubeMusic, video, {
        kind: song ? "song" : "video",
        sections: ["music"],
        provenance,
        checkedAt,
        now,
        fandoms: channel.fandoms ?? ["vocaloid"],
        match: song,
        extraLinks: song ? [{ kind: "source", label: "VocaDB", url: `https://vocadb.net/S/${song.song.id}` }] : [],
      }),
    );
  }
  return nextPage(ctx, state, plan.length, items);
}

// ---------------------------------------------------------------------------------------------
// youtube-tutorials
// ---------------------------------------------------------------------------------------------

const FORMAT_PATTERNS = [
  ["wig", /\bwigs?\b|ウィッグ/i],
  ["makeup", /\bmake-?up\b|メイク/i],
  ["tutorial", /\btutorials?\b|\bhow to\b|\bguide\b|step[- ]by[- ]step|\bdiy\b/i],
  ["transformation", /\btransformation\b/i],
  ["props", /\bprops?\b|\barmou?r\b|\beva ?foam\b|\bworbla\b|\b3d[- ]?print/i],
  ["wip", /\bwip\b|work in progress/i],
  ["photoshoot", /\bphoto ?shoot\b/i],
].filter(([format]) => COSPLAY_FORMATS.includes(format));

export function cosplayFormats(text) {
  return FORMAT_PATTERNS.filter(([, pattern]) => pattern.test(String(text ?? ""))).map(([format]) => format);
}
export const TUTORIAL_WINDOW_MS = 60 * DAY_MS;

function tutorialItem(video, { provenance, checkedAt, now }) {
  const text = `${video.snippet?.title ?? ""}\n${firstParagraph(video.snippet?.description)}`;
  const formats = cosplayFormats(text);
  if (!formats.length) return null;
  return videoItem(youtubeTutorials, video, {
    kind: "tutorial",
    sections: ["dressup"],
    provenance,
    checkedAt,
    now,
    characters: mentions(text, CHARACTER_ALIASES),
    formats,
  });
}

async function fetchYoutubeTutorials(ctx) {
  const key = requireKey(ctx);
  const plan = youtubeTutorialPlan(ctx.day);
  let state = readState(ctx);
  if (state.i >= plan.length) return { items: [], cursor: null, done: true };
  const channelSteps = plan.filter((s) => s.type === "channel");
  const step = plan[state.i];
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();
  const checkedAt = new Date(now).toISOString();
  if (!limit) return nextPage(ctx, state, plan.length, []);

  let ids = [];
  let expectedChannel = null;
  let provenance = "unknown";
  if (step.type === "channel") {
    const resolved = await uploadsForPlan(ctx, key, state, channelSteps.map((s) => s.channel));
    state = { ...state, ...resolved };
    const position = channelSteps.indexOf(step);
    const playlist = resolved.u[position];
    if (!playlist) return nextPage(ctx, state, plan.length, []);
    ids = (await recentUploads(ctx.http, key, playlist, { max: 15, windowMs: TUTORIAL_WINDOW_MS, now })).map((u) => u.id);
    expectedChannel = step.channel.id;
    if (resolved.t[position] === "1") provenance = "creator_upload";
  } else {
    // search.list: separate 100/day bucket, 1 unit per call; strict SafeSearch, embeddable videos only.
    const data = await ctx.http.json(
      youtubeUrl(
        "search",
        {
          part: "snippet",
          type: "video",
          q: step.query,
          safeSearch: "strict",
          videoEmbeddable: "true",
          regionCode: "SG",
          relevanceLanguage: "en",
          publishedAfter: new Date(now - TUTORIAL_WINDOW_MS).toISOString(),
          order: "relevance",
          maxResults: 10,
        },
        key,
      ),
    );
    ids = listItems(data, "youtube#searchListResponse")
      .map((result) => result?.id?.videoId)
      .filter((id) => VIDEO_ID.test(id ?? ""));
  }
  // Videos already examined earlier in this run (overlapping searches) are not requested again.
  const examined = Array.isArray(state.s) ? state.s.filter((id) => VIDEO_ID.test(String(id))) : [];
  ids = unique(ids).filter((id) => !examined.includes(id));
  state = { ...state, s: [...examined, ...ids].slice(-40) };
  if (!ids.length) return nextPage(ctx, state, plan.length, []);
  const videos = await youtubeVideos(ctx.http, key, ids, VIDEO_PARTS, { maxWidth: 480 });
  const items = [];
  for (const id of ids) {
    if (items.length >= limit) break;
    const video = videos.get(id);
    if (!usable(video)) continue;
    if (expectedChannel && video.snippet?.channelId !== expectedChannel) continue;
    const item = tutorialItem(video, { provenance, checkedAt, now });
    if (item) items.push(item);
  }
  return nextPage(ctx, state, plan.length, items);
}

// ---------------------------------------------------------------------------------------------
// youtube-apothecary
// ---------------------------------------------------------------------------------------------

export const APOTHECARY_WINDOW_MS = 60 * DAY_MS;
/** The official-site PVs are offered for this long after their upload date. */
export const APOTHECARY_SEED_WINDOW_MS = 120 * DAY_MS;

async function fetchYoutubeApothecary(ctx) {
  const key = requireKey(ctx);
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const channel = await channelByHandle(ctx.http, key, APOTHECARY_CHANNEL.handle);
  if (!channel?.uploads) throw new FeedError("youtube_channel_unavailable", 503);
  const now = Date.now();
  const uploads = await recentUploads(ctx.http, key, channel.uploads, { max: 50, windowMs: APOTHECARY_WINDOW_MS, now, part: "snippet,contentDetails" });
  const ids = unique([...uploads.filter((u) => APOTHECARY_TEXT.test(u.title)).map((u) => u.id), ...APOTHECARY_SEED_VIDEOS]);
  const videos = await youtubeVideos(ctx.http, key, ids, VIDEO_PARTS, { maxWidth: 480 });
  const checkedAt = new Date(now).toISOString();
  const items = [...videos.values()]
    // Only the verified official channel's uploads; a seed ID uploaded elsewhere is ignored.
    .filter((video) => usable(video) && video.snippet?.channelId === channel.id && APOTHECARY_TEXT.test(`${video.snippet?.title ?? ""} ${video.snippet?.description ?? ""}`))
    .filter((video) => now - (Date.parse(video.snippet?.publishedAt ?? "") || 0) <= APOTHECARY_SEED_WINDOW_MS)
    .sort((a, b) => (Date.parse(b.snippet?.publishedAt ?? "") || 0) - (Date.parse(a.snippet?.publishedAt ?? "") || 0))
    .slice(0, limit)
    .map((video) => {
      const text = `${video.snippet?.title ?? ""}\n${firstParagraph(video.snippet?.description)}`;
      return videoItem(youtubeApothecary, video, {
        kind: "video",
        sections: ["maomao"],
        provenance: "official_channel",
        checkedAt,
        now,
        fandoms: ["the apothecary diaries"],
        characters: mentions(text, CHARACTER_ALIASES),
      });
    });
  return { items, cursor: null, done: true };
}

// ---------------------------------------------------------------------------------------------
// Shared recheck and policies
// ---------------------------------------------------------------------------------------------

function recheckVideo(provenance) {
  return async (item, ctx) => {
    const key = ctx.credentials?.YOUTUBE_API_KEY;
    // The publish runner must pass credentials to recheck; without them nothing is asserted.
    if (!key) return { state: "transient", scope: "youtube_not_configured" };
    if (!VIDEO_ID.test(String(item.nativeId ?? ""))) return { state: "transient", scope: "youtube_video" };
    try {
      const videos = await youtubeVideos(ctx.http, key, [item.nativeId], ["status", "contentDetails"]);
      const video = videos.get(item.nativeId);
      // An authoritative empty result: deleted, private or otherwise no longer public.
      if (!video) return { state: "removed", scope: "youtube_video" };
      return { state: playable(playbackFrom(video, { provenance, checkedAt: new Date().toISOString() })) ? "present" : "restricted", scope: "youtube_playback" };
    } catch (error) {
      return { state: ["blocked", "rate_limited"].includes(error?.code) ? "restricted" : "transient", scope: "youtube_video" };
    }
  };
}

const YOUTUBE_POLICY = {
  requiredCredentials: ["YOUTUBE_API_KEY"],
  mediaHosts: ["www.youtube.com", "i.ytimg.com"],
  profileHosts: ["www.youtube.com"],
  maxBytes: 1024 * 1024,
  timeoutMs: 12000,
  // Developer Policies III.E.4.d: stored API data is refreshed or deleted within 30 days.
  cacheSeconds: 30 * 86400,
  mediaPolicy: "embed_provenance",
  copyPolicy: "link_only",
  deletionPolicy: "recheck_before_publish",
  attributionRequired: true,
  termsUrl: TERMS_URL,
  docsUrl: DOCS_URL,
};

export const youtubeMusic = {
  ...YOUTUBE_POLICY,
  id: "youtube-music",
  stage: "fetch-b",
  status: "enabled",
  enabled: true,
  sections: ["music"],
  hosts: ["www.googleapis.com", "vocadb.net", "www.youtube.com"],
  linkHosts: ["www.youtube.com", "vocadb.net"],
  // 1 channels.list + 9 channels x (playlistItems + videos.list + up to 4 VocaDB byPv), plus retries.
  maxRequests: 70,
  paceMs: 500,
  fetch: fetchYoutubeMusic,
  recheck: recheckVideo("official_channel"),
  notes:
    "Uploads (last 7 days) from 4 official channels daily (SEKAI JP, SEKAI Global, Crypton, piaproTV) plus 5 of 18 producer " +
    "channels in rotation; MARETU, Kairiki bear, Neru and Kikuo channels excluded. About 19 quota units/day. Producer and SEKAI " +
    "JP uploads need a VocaDB byPv match (credits, AI/sexual-tag and dark-producer filters); Shorts, live/upcoming broadcasts, " +
    "non-embeddable, SG-blocked and age-restricted videos dropped. Provenance is official_channel only when the channels.list " +
    "title matches the expected names. Documentation-faithful mocks only; live verification pending deployment (key is a " +
    "Vercel Sensitive value).",
};

export const youtubeTutorials = {
  ...YOUTUBE_POLICY,
  id: "youtube-tutorials",
  stage: "fetch-b",
  status: "enabled",
  enabled: true,
  sections: ["dressup"],
  hosts: ["www.googleapis.com", "www.youtube.com"],
  linkHosts: ["www.youtube.com"],
  // 1 channels.list + 3 channels x 2 + 3 searches x 2, plus retries.
  maxRequests: 20,
  paceMs: 250,
  fetch: fetchYoutubeTutorials,
  recheck: recheckVideo("creator_upload"),
  notes:
    "Uploads (last 60 days) of 3 of the 6 tutorial channels per day plus 3 search.list calls (own 100/day bucket, " +
    "safeSearch=strict, videoEmbeddable=true, regionCode=SG). Only videos whose title/description names a COSPLAY_FORMATS " +
    "format are kept. Channel IDs are from the research run (not re-confirmed by a primary source); channels.list must return " +
    "a matching title for creator_upload provenance, else unknown. About 7 shared units + 3 search calls/day. Live verification " +
    "pending deployment.",
};

export const youtubeApothecary = {
  ...YOUTUBE_POLICY,
  id: "youtube-apothecary",
  stage: "fetch-b",
  status: "enabled",
  enabled: true,
  sections: ["maomao"],
  hosts: ["www.googleapis.com", "www.youtube.com"],
  linkHosts: ["www.youtube.com"],
  maxRequests: 6,
  paceMs: 250,
  fetch: fetchYoutubeApothecary,
  recheck: recheckVideo("official_channel"),
  notes:
    "TOHO animation (@TOHOanimation, linked from https://www.toho.co.jp/sns/; TOHO lists Season 3 and the film at " +
    "toho.co.jp/anime and /movie/lineup). The handle is resolved with channels.list?forHandle (cached a day), uploads " +
    "from the last 60 days are kept when the title names 薬屋のひとりごと/Kusuriya/Apothecary Diaries, plus the PVs the " +
    "official site embeds (9rProUQlD-I S3 PV, HP5wg0kTh54 film trailer) if videos.list shows the same channel. " +
    "3 units/day. Live verification pending deployment.",
};
