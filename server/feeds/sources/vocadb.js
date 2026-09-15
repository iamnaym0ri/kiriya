// VocaDB song collectors plus the YouTube playback helpers shared with youtube.js (kept here so the
// import direction stays one-way: youtube.js -> vocadb.js).
//
// Policy basis, checked live 2026-09-15 from a home WSL machine (not Vercel):
// - https://wiki.vocadb.net/docs/license: database contents are CC BY 4.0, "provide a link back";
//   user-uploaded images, audio and lyrics are not covered. PV media keeps its own rights.
// - https://wiki.vocadb.net/docs/public-api: cache responses, send a custom User-Agent, mention VocaDB;
//   "thousands per day" without permission counts as abuse. This collector sends about 12 VocaDB
//   requests a day plus publish rechecks.
// - YouTube API Services Developer Policies III.E.4: API data is kept at most 30 days, then refreshed
//   or deleted, so every item expires within 30 days.
import { FeedError } from "../config.js";
import { fetchRisingSongs } from "../../engine/sources/vocadb.js";
import { seededRandom, shuffle } from "../../engine/pick.js";
import { asArray, clip, cursor as pageCursor, toIso } from "./util.js";
import { ERAS, canonicalFandoms, canonicalUnits, canonicalVoicebanks } from "./tags.js";

// Foundation adapter (rising songs only). Kept unchanged for the existing test suite; superseded by
// `vocadbSongs` below.
export async function fetchVocaDb(ctx) {
  const songs = await fetchRisingSongs({ requestJson: ctx.http.json });
  return {
    items: songs.slice(0, ctx.limits.items).map((song) => ({
      source: "vocadb",
      nativeId: String(song.data.id),
      sections: ["music"],
      kind: "song",
      title: song.data.title.slice(0, 200),
      url: song.data.vocadbUrl,
      media: [{ type: "youtube", url: song.url, poster: song.data.thumbnail }],
      credit: {
        name: song.data.artist.slice(0, 200),
        platform: "VocaDB",
        license:
          "CC BY (VocaDB metadata only; linked media retains its own rights)",
        profileUrl: song.data.vocadbUrl,
      },
      tags: {
        voicebanks: ["hatsune miku", "kagamine rin", "kagamine len"].filter(
          (v) => song.data.artist.toLowerCase().includes(v),
        ),
        fandoms: ["vocaloid"],
      },
      facts: {
        names: [song.data.artist.slice(0, 100)],
        sourceScore: song.data.ratingScore ?? 0,
      },
      publishedAt: song.publishedAt
        ? new Date(song.publishedAt).toISOString()
        : null,
      // Moving content/SG playback/source tags need source-specific checks before publication.
      safety: { rating: "unknown" },
    })),
    cursor: null,
    done: true,
  };
}

const API = "https://vocadb.net/api";
const SITE = "https://vocadb.net";
export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
export const DAY_MS = 86_400_000;
export const YOUTUBE_DATA_TTL_MS = 30 * DAY_MS;
export const PLAYBACK_REGION = "SG";
const VIDEO_ID = /^[\w-]{11}$/;
const LICENSE = "VocaDB data CC BY; media retains its own rights";

/** Singapore build day -> whole days since the epoch; drives every rotation deterministically. */
export function dayIndex(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ""))) throw new FeedError("invalid_day");
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const unique = (values) => [...new Set(values.filter(Boolean))];

// ---------------------------------------------------------------------------------------------
// Verified VocaDB IDs (VocaDB API, 2026-09-15 14:43-15:03 UTC).
// ---------------------------------------------------------------------------------------------

/** Root voicebank artists, always queried with childVoicebanks=true. */
export const VOICEBANK_ARTIST_IDS = {
  "hatsune miku": 1, // Hatsune Miku (Vocaloid, Locked)
  "kagamine rin": 14, // Kagamine Rin (Vocaloid, Locked)
  "kagamine len": 15, // Kagamine Len (Vocaloid, Locked)
  luka: 2, // Megurine Luka (Vocaloid, Locked)
  kaito: 71, // KAITO (Vocaloid, Locked)
  meiko: 176, // MEIKO (Vocaloid, Locked)
  // "Kasane Teto (Unknown)": base of Kasane Teto UTAU (116), Kasane Teto SV (118397) and others.
  "kasane teto": 140308,
  gumi: 3, // GUMI (Vocaloid, Locked); base of V4 GUMI, AI Megpoid, GUMI A.I.VOICE
};
// Child voicebanks (V4X, NT, V6, SP, SV...) are matched by name, only for voice-synthesizer artists.
const VOICEBANK_NAMES = [
  ["hatsune miku", /\bhatsune miku\b|初音ミク/i],
  ["kagamine rin", /\bkagamine rin\b|鏡音リン/i],
  ["kagamine len", /\bkagamine len\b|鏡音レン/i],
  ["luka", /\bmegurine luka\b|巡音ルカ/i],
  ["kaito", /^kaito\b|^カイト/i],
  ["meiko", /^meiko\b|^メイコ/i],
  ["kasane teto", /\bkasane teto\b|重音テト/i],
  ["gumi", /\bgumi\b|\bmegpoid\b|メグッポイド/i],
];
const SYNTH_TYPES = new Set([
  "Vocaloid",
  "UTAU",
  "CeVIO",
  "SynthesizerV",
  "NEUTRINO",
  "VoiSona",
  "NewType",
  "Voiceroid",
  "VOICEVOX",
  "ACEVirtualSinger",
  "AIVOICE",
  "OtherVoiceSynthesizer",
]);

export const TAG_IDS = { story: 6965 /* "story music" */, sekai: 7323 /* "ProSeka" */ };
/** Project SEKAI unit artist entries (all "Band"). VIRTUAL SINGER has no artist entry. */
export const SEKAI_UNIT_ARTISTS = {
  84505: "wonderlands×showtime",
  86692: "vivid bad squad",
  84782: "leo/need",
  83923: "more more jump!",
  83861: "nightcord at 25:00",
};
/** The three units she picked, rotated one per day. */
export const HER_UNIT_ARTIST_IDS = [84505, 86692, 84782];

/** "A smidge of each": the verified producer list minus the dark & intense group. */
export const ROTATION_PRODUCERS = [
  { id: 45, name: "DECO*27" },
  { id: 28, name: "PinocchioP" },
  { id: 80976, name: "Kanaria" },
  { id: 4834, name: "syudou" },
  { id: 65229, name: "iyowa" },
  { id: 8, name: "40mP" },
  { id: 855, name: "HoneyWorks" },
  { id: 189, name: "mothy" },
  { id: 103, name: "HitoshizukuP" },
  { id: 36280, name: "NayutalieN" },
  { id: 67, name: "ryo" },
  { id: 89, name: "kz" },
  { id: 624, name: "Mitchie M" },
  { id: 305, name: "TOKOTOKO" },
  { id: 67910, name: "Chinozo" },
  { id: 70347, name: "Ayase" },
  { id: 1620, name: "*Luna" },
  { id: 772, name: "Giga" },
];
/** She did not pick the dark & intense group: never rotated, and songs crediting them are skipped. */
export const DARK_INTENSE_PRODUCERS = [
  { id: 1665, name: "MARETU" },
  { id: 885, name: "Kairiki bear" },
  { id: 137, name: "Neru" },
  { id: 470, name: "Kikuo" },
];
const DARK_IDS = new Set(DARK_INTENSE_PRODUCERS.map((p) => p.id));

/**
 * Always sent as excludedTagIds[]. VocaDB does not expand child tags (checked live: a song tagged only
 * "Suno" survives excluding its parents 10766/11827, and "suggestive" survives excluding 320), so the
 * verified children of "AI-generated content" (11827) and "sexual content" (320) are listed too.
 */
export const EXCLUDED_TAG_IDS = {
  11827: "AI-generated content",
  9119: "AI-generated art",
  9256: "NovelAI (AI art)",
  9257: "Stable Diffusion (AI art)",
  9258: "Midjourney (AI art)",
  9260: "Dream (AI art)",
  9261: "Disco Diffusion (AI art)",
  9263: "DALL-E (AI art)",
  10066: "Adobe Firefly (AI art)",
  11960: "Imagen (AI art)",
  12828: "AI-generated background art",
  9190: "AI-generated lyrics",
  8111: "MugenMikuUta",
  8112: "Shikaki",
  9518: "GPT",
  13087: "LYRICALOID",
  9887: "AI-generated video",
  9888: "Kaiber",
  10766: "AI-generated music",
  9191: "AI-generated melody",
  9357: "Orpheus",
  11319: "CREEVO",
  10648: "Suno",
  11828: "AI-generated vocals",
  12782: "FIMMIGRM",
  12880: "ACE-Step",
  13520: "AI production warning",
  320: "sexual content",
  1517: "sadism",
  1518: "masochism",
  2757: "lolicon",
  3151: "suggestive",
  12728: "breasts",
  3412: "explicit lyrics",
  10713: "sexually explicit lyrics",
  10714: "profanity",
  3507: "masturbation",
  4892: "age-restricted PV",
  6103: "explicit artwork",
  7733: "R-15",
  9473: "nudity",
  9478: "prostitution",
  2991: "incest",
};
// Second layer for tags created after the ID list was verified.
export const EXCLUDED_TAG_NAME =
  /\bai[- ](?:generated|assisted)\b|\(ai art\)|\bsuno\b|\budio\b|\bsexual(?:ly)?\b|\bexplicit\b|\bnudity\b|\blolicon\b|\bsuggestive\b|\bmasturbation\b|\bprostitution\b|\bincest\b|\bage-restricted\b|\br-1[58]\b/i;
// Content warnings passed through as safety.sourceTags; rules.js/moderation decide. Narrative theme
// tags ("death", "murder", "tragedy", "abuse") are descriptive rather than warnings and are not passed:
// nearly every Rin & Len story song carries them.
const WARNING_TAG_NAME =
  /\bgore\b|\bblood\b|horror|\bguro\b|self-harm|suicid|eating disorder|cannibal|flashing lights|content warning/i;

// ---------------------------------------------------------------------------------------------
// Query plan
// ---------------------------------------------------------------------------------------------

const OTHER_NEW_VOICEBANKS = ["kasane teto", "luka", "kaito", "meiko", "gumi"];

/** 3-4 producers a day; a 7-producer window slides every two days, so nobody repeats within ~5 days. */
export function producersForDay(day) {
  const n = dayIndex(day);
  const pair = Math.floor(n / 2);
  const size = ROTATION_PRODUCERS.length;
  const base = (pair * 7) % size;
  const slots = n % 2 === 0 ? [0, 1, 2, 3] : [4, 5, 6];
  const cycle = Math.floor((pair * 7) / size);
  return slots.map((k) => ({ ...ROTATION_PRODUCERS[(base + k) % size], offset: (cycle % 4) * 8 }));
}

/** Deterministic per-day plan: Miku new originals first, the rest in a day-seeded order. */
export function vocadbPlan(day) {
  const n = dayIndex(day);
  const steps = [
    { kind: "new", voicebank: "hatsune miku" },
    { kind: "new", voicebank: n % 2 === 0 ? "kagamine rin" : "kagamine len" },
    { kind: "new", voicebank: OTHER_NEW_VOICEBANKS[n % OTHER_NEW_VOICEBANKS.length] },
    { kind: "classics", offset: (n % 40) * 8 },
    { kind: "story", voicebank: n % 2 === 0 ? "kagamine len" : "kagamine rin", offset: (Math.floor(n / 2) % 20) * 8 },
    { kind: "modern", offset: (n % 40) * 8 },
    { kind: "sekai", offset: (n % 30) * 8 },
    { kind: "unit", unit: HER_UNIT_ARTIST_IDS[n % HER_UNIT_ARTIST_IDS.length] },
    ...producersForDay(day).map((p) => ({ kind: "producer", producer: p.id, offset: p.offset })),
  ];
  return [steps[0], ...shuffle(steps.slice(1), seededRandom(day, "vocadb-songs-plan"))];
}

export const VOCADB_PAGE_SIZE = 12;

export function vocadbStepUrl(step, day) {
  const url = new URL(`${API}/songs`);
  const add = (key, value) => url.searchParams.append(key, String(value));
  const start = Date.parse(`${day}T00:00:00Z`);
  switch (step.kind) {
    case "new":
      add("artistId[]", VOICEBANK_ARTIST_IDS[step.voicebank]);
      add("childVoicebanks", true);
      add("songTypes", "Original");
      // Published 2-14 days ago: ratings settle for 48-72 h before new songs are ranked.
      add("afterDate", ymd(start - 14 * DAY_MS));
      add("beforeDate", ymd(start - 2 * DAY_MS));
      add("minScore", step.voicebank === "hatsune miku" ? 10 : 3);
      add("sort", "RatingScore");
      break;
    case "classics":
      add("songTypes", "Original");
      add("afterDate", "2007-01-01");
      add("beforeDate", "2014-01-01");
      add("sort", "RatingScore");
      add("start", step.offset);
      break;
    case "story":
      add("tagId[]", TAG_IDS.story);
      add("artistId[]", VOICEBANK_ARTIST_IDS[step.voicebank]);
      add("childVoicebanks", true);
      add("songTypes", "Original");
      add("sort", "RatingScore");
      add("start", step.offset);
      break;
    case "modern":
      add("songTypes", "Original");
      add("afterDate", "2014-01-01");
      add("beforeDate", ymd(start - 14 * DAY_MS));
      add("sort", "RatingScore");
      add("start", step.offset);
      break;
    case "sekai":
      add("tagId[]", TAG_IDS.sekai);
      add("songTypes", "Original");
      add("sort", "RatingScore");
      add("start", step.offset);
      break;
    case "unit":
      // Unit versions are VocaDB "Cover" entries with the official SEKAI channel PV.
      add("artistId[]", step.unit);
      add("songTypes", "Original,Cover");
      add("beforeDate", ymd(start + DAY_MS));
      add("sort", "PublishDate");
      break;
    case "producer":
      // One request per producer: several artistId[] values are ANDed by VocaDB.
      add("artistId[]", step.producer);
      add("songTypes", "Original");
      add("sort", "RatingScore");
      add("start", step.offset);
      break;
    default:
      throw new FeedError("invalid_plan_step");
  }
  add("onlyWithPvs", true);
  add("pvServices", "Youtube");
  add("maxResults", VOCADB_PAGE_SIZE);
  add("fields", "Artists,PVs,Tags,WebLinks");
  add("lang", "English");
  for (const id of Object.keys(EXCLUDED_TAG_IDS)) add("excludedTagIds[]", id);
  return url.href;
}

// ---------------------------------------------------------------------------------------------
// Song interpretation (shared with youtube.js byPv matching)
// ---------------------------------------------------------------------------------------------

const categoriesOf = (credit) =>
  String(credit?.categories ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

export function voicebanksOf(artists) {
  const found = [];
  for (const credit of asArray(artists)) {
    if (!categoriesOf(credit).includes("Vocalist") || !credit.artist) continue;
    const root = Object.entries(VOICEBANK_ARTIST_IDS).find(([, id]) => id === credit.artist.id);
    if (root) {
      found.push(root[0]);
      continue;
    }
    if (!SYNTH_TYPES.has(credit.artist.artistType)) continue;
    const names = [credit.artist.name, ...String(credit.artist.additionalNames ?? "").split(",")]
      .map((n) => String(n ?? "").trim())
      .filter(Boolean);
    const hit = VOICEBANK_NAMES.find(([, pattern]) => names.some((n) => pattern.test(n)));
    if (hit) found.push(hit[0]);
  }
  return canonicalVoicebanks(found);
}

/** Original, non-disabled YouTube PVs; uploads by the artist before auto-generated "- Topic" tracks. */
export function youtubeCandidates(pvs) {
  const originals = asArray(pvs).filter(
    (pv) => pv?.service === "Youtube" && pv.pvType === "Original" && !pv.disabled && VIDEO_ID.test(pv.pvId ?? ""),
  );
  const topic = (pv) => / - Topic$/.test(String(pv.author ?? ""));
  return [...originals.filter((pv) => !topic(pv)), ...originals.filter(topic)].slice(0, 3);
}

function streamingLinks(song) {
  const links = [];
  for (const link of asArray(song.webLinks)) {
    if (link?.disabled || link?.category !== "Commercial") continue;
    let url;
    try {
      url = new URL(link.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    const label = { "open.spotify.com": "Spotify", "music.apple.com": "Apple Music" }[url.hostname.toLowerCase()];
    if (label && !links.some((l) => l.label === label)) links.push({ kind: "listen", label, url: url.href });
  }
  return links;
}

/**
 * Interprets a VocaDB song. Returns `{ok:false, reason}` for songs to skip (excluded tags, dark & intense
 * producers, unreleased, not one of her voicebanks, no playable original PV) or `{ok:true, ...}`.
 */
export function songVerdict(song, { step = null, now = Date.now(), requirePv = true } = {}) {
  if (!song || !Number.isInteger(song.id) || typeof song.name !== "string") return { ok: false, reason: "malformed" };
  if (song.deleted) return { ok: false, reason: "deleted" };
  const publishedMs = Date.parse(song.publishDate ?? "");
  if (Number.isFinite(publishedMs) && publishedMs > now) return { ok: false, reason: "unreleased" };
  const tags = asArray(song.tags)
    .map((usage) => usage?.tag)
    .filter((tag) => tag && typeof tag.name === "string");
  if (tags.some((tag) => EXCLUDED_TAG_IDS[tag.id] || EXCLUDED_TAG_NAME.test(tag.name)))
    return { ok: false, reason: "excluded_tag" };
  const artists = asArray(song.artists);
  if (artists.some((credit) => DARK_IDS.has(credit?.artist?.id))) return { ok: false, reason: "dark_intense_producer" };
  const voicebanks = voicebanksOf(artists);
  if (!voicebanks.length) return { ok: false, reason: "not_her_voicebanks" };
  const pvs = youtubeCandidates(song.pvs);
  if (requirePv && !pvs.length) return { ok: false, reason: "no_youtube_original" };

  const producerCredits = artists.filter((credit) => categoriesOf(credit).includes("Producer") && !credit.isSupport);
  const producerNames = unique(producerCredits.map((credit) => String(credit.artist?.name ?? credit.name ?? "").trim()));
  const tagIds = new Set(tags.map((tag) => tag.id));
  const unitIds = unique(artists.map((credit) => credit?.artist?.id).filter((id) => SEKAI_UNIT_ARTISTS[id]));
  const sekai = tagIds.has(TAG_IDS.sekai) || unitIds.length > 0;
  const units = canonicalUnits(unitIds.map((id) => SEKAI_UNIT_ARTISTS[id]));
  if (sekai && !units.length) units.push(...canonicalUnits(["virtual singer"]));

  const year = Number(String(song.publishDate ?? "").slice(0, 4));
  const rating = Number(song.ratingScore) || 0;
  const topics = [];
  const rated = step && step.kind !== "new";
  if (step?.kind === "story" || (tagIds.has(TAG_IDS.story) && voicebanks.some((v) => v.startsWith("kagamine"))))
    topics.push(ERAS.story);
  if (step?.kind === "classics" || (rated && year >= 2007 && year <= 2013 && rating >= 200)) topics.push(ERAS.classics);
  if (step?.kind === "modern" || (rated && year >= 2014 && rating >= 300)) topics.push(ERAS.modern);

  return {
    ok: true,
    song,
    voicebanks,
    producers: producerNames,
    producerIds: producerCredits.map((credit) => credit.artist?.id).filter(Number.isInteger),
    units,
    herUnit: unitIds.some((id) => HER_UNIT_ARTIST_IDS.includes(id)),
    fandoms: canonicalFandoms(sekai ? ["vocaloid", "project sekai"] : ["vocaloid"]),
    topics: unique(topics),
    pvs,
    warnings: unique(tags.filter((tag) => WARNING_TAG_NAME.test(tag.name)).map((tag) => clip(tag.name, 100))).slice(0, 20),
    links: streamingLinks(song),
    publishedAt: toIso(song.publishDate),
  };
}

// ---------------------------------------------------------------------------------------------
// YouTube Data API helpers (API key only; every returned value is Non-Authorized Data)
// ---------------------------------------------------------------------------------------------

/** Documented endpoint URL with the key as the `key` query parameter; never logged or stored. */
export function youtubeUrl(method, params, key) {
  const url = new URL(`${YOUTUBE_API}/${method}`);
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  url.searchParams.set("key", key);
  return url.href;
}

export const YOUTUBE_BATCH = 50;

/** videos.list in batches of at most 50 IDs (1 quota unit per call). Returns Map(videoId -> resource). */
export async function youtubeVideos(http, key, ids, parts = ["status", "contentDetails"], extra = {}) {
  if (!key) throw new FeedError("not_configured", 503);
  const wanted = unique(asArray(ids).filter((id) => VIDEO_ID.test(String(id ?? ""))));
  const videos = new Map();
  for (let i = 0; i < wanted.length; i += YOUTUBE_BATCH) {
    const data = await http.json(youtubeUrl("videos", { part: parts.join(","), id: wanted.slice(i, i + YOUTUBE_BATCH).join(","), ...extra }, key));
    // A malformed or wrong-kind answer is an error, never an empty (all removed) result.
    if (!data || data.kind !== "youtube#videoListResponse" || (data.items !== undefined && !Array.isArray(data.items)))
      throw new FeedError("invalid_source_json");
    for (const video of asArray(data.items)) if (VIDEO_ID.test(String(video?.id ?? ""))) videos.set(video.id, video);
  }
  return videos;
}

/**
 * Playback facts from a videos.list resource (status + contentDetails):
 * - embeddable: status.embeddable, and never for private or unprocessed uploads;
 * - regionOk: contentDetails.regionRestriction allows SG ("allowed" present without SG, including an empty
 *   list, blocks it; "blocked" containing SG blocks it; no restriction object allows it);
 * - ageRestricted: contentDetails.contentRating.ytRating === "ytAgeRestricted".
 */
export function playbackFrom(video, { provenance, checkedAt, region = PLAYBACK_REGION }) {
  const status = video?.status ?? {};
  const restriction = video?.contentDetails?.regionRestriction;
  const codes = (list) => asArray(list).map((code) => String(code).toUpperCase());
  let regionOk = true;
  if (restriction && Array.isArray(restriction.allowed)) regionOk = codes(restriction.allowed).includes(region);
  if (restriction && Array.isArray(restriction.blocked) && codes(restriction.blocked).includes(region)) regionOk = false;
  return {
    embeddable:
      status.embeddable === true &&
      status.privacyStatus !== "private" &&
      (status.uploadStatus === undefined || status.uploadStatus === "processed"),
    regionOk,
    ageRestricted: video?.contentDetails?.contentRating?.ytRating === "ytAgeRestricted",
    checkedAt,
    provenance,
  };
}
export const playable = (playback) => Boolean(playback?.embeddable && playback.regionOk && !playback.ageRestricted);

/**
 * Expiry for items carrying YouTube API data: the start of the current 7-day UTC bucket plus 30 days.
 * Always within 30 days of the fetch (Developer Policies III.E.4.d) and stable for a week, so a daily
 * re-fetch of unchanged data does not alter the payload fingerprint through this field alone.
 */
export function youtubeDataExpiry(now = Date.now()) {
  const bucket = Math.floor(now / (7 * DAY_MS)) * 7 * DAY_MS;
  return new Date(bucket + YOUTUBE_DATA_TTL_MS).toISOString();
}

export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youtubePoster = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// ---------------------------------------------------------------------------------------------
// vocadb-songs entry
// ---------------------------------------------------------------------------------------------

function songItem(verdict, { videos, checkedAt, now }) {
  const { song } = verdict;
  let pv = verdict.pvs[0];
  let playback = null;
  const labels = [];
  if (videos) {
    // PIPELINE §8.3: every song must embed and play in Singapore; age-restricted videos are dropped (§7).
    // The first original PV that passes wins; a song with none (deleted, private, blocked) is skipped.
    const best = verdict.pvs
      .map((candidate) => ({ candidate, video: videos.get(candidate.pvId) }))
      .filter((x) => x.video)
      .map((x) => ({ ...x, playback: playbackFrom(x.video, { provenance: "vocadb_original", checkedAt }) }))
      .find((x) => playable(x.playback));
    if (!best) return null;
    pv = best.candidate;
    playback = best.playback;
    // Developer Policies III.E.4.j: the made-for-kids status of an embedded video is looked up and kept.
    if (best.video.status?.madeForKids === true) labels.push("youtube:made_for_kids");
  }
  const title = clip(song.name, 200);
  const vocadbUrl = `${SITE}/S/${song.id}`;
  const watch = youtubeWatchUrl(pv.pvId);
  const profileId = verdict.producerIds[0];
  return {
    source: vocadbSongs.id,
    nativeId: String(song.id),
    sections: ["music"],
    kind: "song",
    title,
    url: vocadbUrl,
    media: [
      {
        type: "youtube",
        url: watch,
        poster: youtubePoster(pv.pvId),
        alt: clip(`${song.name} - ${song.artistString ?? ""}`, 500),
        duration: Number(pv.length) > 0 ? Number(pv.length) : Number(song.lengthSeconds) > 0 ? Number(song.lengthSeconds) : null,
        identity: `youtube:${pv.pvId}`,
      },
    ],
    mediaIdentity: `youtube:${pv.pvId}`,
    credit: {
      name: clip(verdict.producers.join(", ") || song.artistString || "VocaDB", 200),
      handle: "",
      profileUrl: profileId ? `${SITE}/Ar/${profileId}` : null,
      platform: "VocaDB",
      license: LICENSE,
    },
    tags: {
      characters: [],
      fandoms: verdict.fandoms,
      voicebanks: verdict.voicebanks,
      producers: unique(verdict.producers.map((name) => clip(name.toLowerCase(), 100))).slice(0, 40),
      units: verdict.units,
      formats: [],
      topics: verdict.topics,
    },
    facts: {
      names: unique([song.name, song.defaultName, ...verdict.producers].map((name) => clip(name ?? "", 100))).slice(0, 40),
      dates: verdict.publishedAt ? [String(song.publishDate).slice(0, 10)] : [],
      sourceScore: Math.min(Math.max(Number(song.ratingScore) || 0, 0), 1_000_000_000),
      releaseAt: verdict.publishedAt,
      releasePrecision: verdict.publishedAt ? "day" : null,
      links: [
        { kind: "listen", label: "YouTube", url: watch },
        { kind: "source", label: "VocaDB", url: vocadbUrl },
        ...verdict.links,
      ].slice(0, 8),
      playback,
    },
    safety: { rating: "unknown", labels, sourceTags: verdict.warnings },
    publishedAt: verdict.publishedAt,
    expiresAt: youtubeDataExpiry(now),
  };
}

const sekaiRank = (verdict) => (verdict.units.includes("virtual singer") ? 0 : verdict.herUnit ? 1 : 2);

async function fetchVocadbSongs(ctx) {
  const plan = vocadbPlan(ctx.day);
  const state = pageCursor.decode(ctx.cursor, {});
  const index = state.d === ctx.day && Number.isInteger(state.i) && state.i >= 0 ? state.i : 0;
  if (index >= plan.length) return { items: [], cursor: null, done: true };
  const step = plan[index];
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();

  const data = await ctx.http.json(vocadbStepUrl(step, ctx.day));
  if (!data || !Array.isArray(data.items)) throw new FeedError("invalid_source_json");
  let verdicts = data.items.map((song) => songVerdict(song, { step, now })).filter((v) => v.ok);
  if (step.kind === "sekai" || step.kind === "unit")
    verdicts = verdicts.map((v, i) => ({ v, i })).sort((a, b) => sekaiRank(a.v) - sekaiRank(b.v) || a.i - b.i).map((x) => x.v);
  // A few spares so a missing or blocked video does not shrink the page.
  const candidates = verdicts.slice(0, Math.min(limit + 4, VOCADB_PAGE_SIZE));

  const key = ctx.credentials?.YOUTUBE_API_KEY;
  let videos = null;
  let checkedAt = null;
  if (key && candidates.length && limit) {
    // One videos.list call per page (<=36 IDs, 1 unit).
    videos = await youtubeVideos(ctx.http, key, candidates.flatMap((v) => v.pvs.map((pv) => pv.pvId)), ["status", "contentDetails"]);
    checkedAt = new Date(now).toISOString();
  }
  const items = [];
  for (const verdict of candidates) {
    if (items.length >= limit) break;
    const item = songItem(verdict, { videos, checkedAt, now });
    if (item) items.push(item);
  }
  const next = index + 1;
  return next >= plan.length
    ? { items, cursor: null, done: true }
    : { items, cursor: pageCursor.encode({ v: 1, d: ctx.day, i: next }), done: false };
}

function failureState(error) {
  return error?.code === "not_found" ? "removed" : ["blocked", "rate_limited"].includes(error?.code) ? "restricted" : "transient";
}

/** Song still exists on VocaDB, its PV is not disabled, and (with a key) YouTube still serves it in SG. */
async function recheckVocadbSong(item, ctx) {
  const id = Number(item.nativeId);
  if (!Number.isInteger(id) || id <= 0) return { state: "transient", scope: "vocadb_song" };
  let song;
  try {
    // Deleted or unknown songs redirect to /Error?code=404, which the helper reports as not_found.
    song = await ctx.http.json(`${API}/songs/${id}?fields=PVs&lang=English`);
  } catch (error) {
    return { state: failureState(error), scope: "vocadb_song" };
  }
  if (!song || typeof song !== "object") return { state: "transient", scope: "vocadb_song" };
  if (song.deleted && !song.mergedTo) return { state: "removed", scope: "vocadb_song" };
  const media = asArray(item.media).find((m) => m?.type === "youtube");
  const videoId = String(media?.identity ?? item.mediaIdentity ?? "").replace(/^youtube:/, "");
  if (!VIDEO_ID.test(videoId)) return { state: "present", scope: "vocadb_song" };
  const pv = asArray(song.pvs).find((p) => p?.service === "Youtube" && p.pvId === videoId);
  // VocaDB marks PVs that stopped working as disabled.
  if (pv?.disabled) return { state: "removed", scope: "vocadb_pv" };
  const key = ctx.credentials?.YOUTUBE_API_KEY;
  if (key) {
    try {
      const videos = await youtubeVideos(ctx.http, key, [videoId], ["status", "contentDetails"]);
      const video = videos.get(videoId);
      // videos.list omits IDs that are deleted, private or otherwise not public.
      if (!video) return { state: "removed", scope: "youtube_video" };
      const playback = playbackFrom(video, { provenance: "vocadb_original", checkedAt: new Date().toISOString() });
      return { state: playable(playback) ? "present" : "restricted", scope: "youtube_playback" };
    } catch (error) {
      return { state: ["blocked", "rate_limited"].includes(error?.code) ? "restricted" : "transient", scope: "youtube_video" };
    }
  }
  // Without a key only VocaDB can be asked: a PV no longer listed is unconfirmed, not removed.
  return pv ? { state: "present", scope: "vocadb_pv" } : { state: "restricted", scope: "vocadb_pv" };
}

// Foundation entry, unchanged (scripts/test-feeds.mjs validates fetchVocaDb items against it).
export const vocadb = {
  id: "vocadb",
  stage: "fetch-a",
  sections: ["music"],
  hosts: ["vocadb.net"],
  mediaHosts: ["www.youtube.com", "i.ytimg.com"],
  mediaPolicy: "embed_provenance",
  termsUrl: "https://wiki.vocadb.net/docs/license",
  fetch: fetchVocaDb,
  recheck: async (item, ctx) => {
    try {
      await ctx.http.json(
        `https://vocadb.net/api/songs/${encodeURIComponent(item.nativeId)}?fields=None`,
      );
      return { state: "present", scope: "metadata" };
    } catch (e) {
      return {
        state:
          e.code === "not_found"
            ? "removed"
            : e.code === "blocked"
              ? "restricted"
              : "transient",
        scope: "metadata",
      };
    }
  },
};

export const vocadbSongs = {
  id: "vocadb-songs",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["music"],
  hosts: ["vocadb.net", "www.googleapis.com"],
  mediaHosts: ["www.youtube.com", "i.ytimg.com"],
  linkHosts: ["www.youtube.com", "vocadb.net", "open.spotify.com", "music.apple.com"],
  profileHosts: [],
  requiredCredentials: [],
  optionalCredentials: ["YOUTUBE_API_KEY"],
  // 11-12 plan steps x (1 VocaDB + 1 videos.list) plus one retry each way.
  maxRequests: 32,
  maxBytes: 1024 * 1024,
  paceMs: 1000,
  timeoutMs: 15000,
  // Stored YouTube API data (playback) must be refreshed or deleted within 30 days.
  cacheSeconds: 30 * 86400,
  mediaPolicy: "embed_provenance",
  copyPolicy: "link_only",
  deletionPolicy: "recheck_before_publish",
  attributionRequired: true,
  termsUrl: "https://wiki.vocadb.net/docs/license",
  docsUrl: "https://wiki.vocadb.net/docs/public-api",
  notes:
    "VocaDB /api/songs day plan: new originals (Miku, Rin or Len, one other voicebank; 2-14 days old, by rating), " +
    "classics 2007-2013, Rin & Len story songs (tag 6965), modern hits, ProSeka (tag 7323), one of her units, 3-4 rotated " +
    "producers. AI and sexual-content tag trees excluded server-side; dark & intense producers (MARETU, Kairiki bear, Neru, " +
    "Kikuo) skipped. Optional YOUTUBE_API_KEY: one videos.list (status,contentDetails) per page fills facts.playback; without " +
    "it playback stays null. Spotify/Apple Music links come only from VocaDB WebLinks. iTunes Search is not used: " +
    "itunes.apple.com/robots.txt disallows /search* (checked 2026-09-15) and it answers text/javascript.",
  fetch: fetchVocadbSongs,
  recheck: recheckVocadbSong,
};
