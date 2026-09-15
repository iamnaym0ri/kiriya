// Project SEKAI Global (EN server): Sekai-World community master data and the official Global news list.
//
// Basis, checked live 2026-09-15 from a home WSL machine (not Vercel):
// - https://github.com/Sekai-World/sekai-master-db-en-diff ("Project Sekai (English) Master DB Difference"),
//   last push 2026-09-14T19:07Z, served by GitHub Pages at sekai-world.github.io (Range requests supported).
//   The repository has NO license file (GitHub license API 404); the data is SEGA/Colorful Palette game
//   data, so only text facts (names, dates, credits) and links are used, credited to Sekai-World.
// - Future rows are datamined and unannounced: only events with startAt <= now and songs with
//   publishedAt <= now are used.
// - events.json is 2,322,247 bytes (pretty-printed) and gachas.json ~40 MB: gachas are never read, and
//   events.json is read as a bounded tail Range (recent events are appended at the end).
// - Official art cannot be reposted (SEGA) and storage.sekai.best blocks hotlinking: no media at all.
// - https://www.colorfulstage.com/news/all/entries.txt is JSON with a trailing comma (text/plain, ~37 KB);
//   its dates are Pacific Time (the event article shows "(PT)" next to the same date). No robots.txt
//   (S3 404) and no terms page is linked; titles, categories, dates and official links only.
import { FeedError } from "../config.js";
import { asArray, clip, cursor as pageCursor } from "./util.js";
import { CHARACTER_ALIASES, UNIT_ALIASES, VOICEBANKS, canonicalUnits, canonicalVoicebanks, mentions } from "./tags.js";

const DB = "https://sekai-world.github.io/sekai-master-db-en-diff";
const REPO = "https://github.com/Sekai-World/sekai-master-db-en-diff";
export const NEWS_URL = "https://www.colorfulstage.com/news/all/entries.txt";
const NEWS_SITE = "https://www.colorfulstage.com";
const VIEWER = "https://sekai.best";
const DAY_MS = 86_400_000;
export const EVENTS_TAIL_BYTES = 900_000;
export const NEW_SONG_WINDOW_MS = 14 * DAY_MS;
export const NEWS_WINDOW_MS = 21 * DAY_MS;
const unique = (values) => [...new Set(values.filter(Boolean))];

const DATA_CREDIT = {
  name: "Sekai-World community data",
  handle: "",
  profileUrl: REPO,
  platform: "Sekai-World master DB (EN)",
  license: "No repository license; game data © SEGA / Colorful Palette / Crypton Future Media. Text facts and links only.",
};
const NEWS_CREDIT = {
  name: "HATSUNE MIKU: COLORFUL STAGE! official news",
  handle: "",
  profileUrl: `${NEWS_SITE}/`,
  platform: "colorfulstage.com",
  license: "© SEGA / © Colorful Palette / © Crypton Future Media. Title, date and link only.",
};

/** gameCharacters.json (EN, 2026-09-15): 21-26 are the VIRTUAL SINGER characters (unit "piapro"). */
export const VIRTUAL_SINGER_CHARACTERS = {
  21: "hatsune miku",
  22: "kagamine rin",
  23: "kagamine len",
  24: "luka",
  25: "meiko",
  26: "kaito",
};
// Master-data codes missing from tags.js UNIT_ALIASES today (theme_park, light_music_club) or deliberately
// kept out of it (vocaloid would turn every "vocaloid" mention into a unit). Values are canonical keys.
const UNIT_CODE_FALLBACK = { theme_park: "wonderlands×showtime", light_music_club: "leo/need", vocaloid: "virtual singer" };
const HER_UNITS = new Set(["wonderlands×showtime", "vivid bad squad", "leo/need"]);

/** Unit codes from events.json `unit` or musicTags.json `musicTag` -> canonical unit tags. */
export function sekaiUnits(codes) {
  return canonicalUnits(
    asArray(codes)
      .map((code) => String(code ?? "").trim().toLowerCase())
      .filter((code) => code && !["none", "all", "other"].includes(code))
      .flatMap((code) => [code, code.replaceAll("_", " "), UNIT_CODE_FALLBACK[code]])
      .filter(Boolean),
  );
}

/**
 * Parses the tail of the pretty-printed events.json returned by a suffix Range request: the first
 * complete top-level event starts at "\n  {\n    \"id\": N,\n    \"eventType\"". A whole file also works.
 */
export function parseEventsTail(text) {
  const body = String(text ?? "");
  const trimmed = body.trim();
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // A tail that happens to start with "[" is parsed below.
    }
  }
  const start = body.search(/\n {2}\{\n {4}"id": \d+,\n {4}"eventType": "/);
  if (start < 0 || !trimmed.endsWith("]")) throw new FeedError("sekai_events_format_changed", 503);
  try {
    const events = JSON.parse(`[${body.slice(start + 1)}`);
    if (!Array.isArray(events)) throw new Error("not an array");
    return events;
  } catch {
    throw new FeedError("invalid_source_json");
  }
}

/** JSON with trailing commas: commas directly before "]" or "}" are dropped outside strings only. */
export function parseLenientJson(text) {
  const source = String(text ?? "").replace(/^﻿/, "");
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j++;
      if (source[j] === "]" || source[j] === "}") continue;
    }
    out += ch;
  }
  try {
    return JSON.parse(out);
  } catch {
    throw new FeedError("invalid_source_json");
  }
}

/** Wall-clock time in an IANA zone -> ISO instant (two offset passes cover DST edges). */
export function zonedToIso({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const offset = (instant) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - instant;
  };
  let instant = wall - offset(wall);
  instant = wall - offset(instant);
  return new Date(instant).toISOString();
}

/** "2026年09月06日 00時00分00秒" (Pacific Time on colorfulstage.com) -> ISO instant. */
export function newsDateToIso(value) {
  const m = String(value ?? "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})時(\d{1,2})分(\d{1,2})秒)?/);
  if (!m) return null;
  const [, year, month, day, hour = 0, minute = 0, second = 0] = m.map((v) => (v === undefined ? undefined : Number(v)));
  return zonedToIso({ year, month, day, hour, minute, second }, "America/Los_Angeles");
}

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const EVENT_TYPES = { marathon: "Marathon", cheerful_carnival: "Cheerful Carnival", world_bloom: "World Link" };
const normalizeTitle = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\[?\s*world link\s*\]?/g, " ")
    .replace(/\bevent\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

async function newsEntries(http) {
  const { text } = await http.text(NEWS_URL, { types: ["text/plain", "application/json"] });
  const data = parseLenientJson(text);
  if (!data || !Array.isArray(data.news)) throw new FeedError("invalid_source_json");
  return data.news
    .filter((entry) => entry && typeof entry.title === "string" && /^\/news\/detail\/[\w-]+\.html$/.test(String(entry.targetUrl ?? "")))
    .map((entry) => ({ ...entry, title: entry.title.trim(), at: newsDateToIso(entry.newsDate), url: `${NEWS_SITE}${entry.targetUrl}` }));
}

function officialEventLink(event, news) {
  const name = normalizeTitle(event.name);
  if (!name) return null;
  return (
    news.find((entry) => {
      if (String(entry.categoryBaseName).toLowerCase() !== "events" || !entry.at) return false;
      const title = normalizeTitle(entry.title);
      const near = Math.abs(Date.parse(entry.at) - Number(event.startAt)) <= 4 * DAY_MS;
      return near && (title === name || title.startsWith(`${name} `) || title.startsWith(name));
    }) ?? null
  );
}

function eventItem(event, { blooms, news }) {
  const official = officialEventLink(event, news);
  const viewer = `${VIEWER}/event/${event.id}`;
  const chapters = asArray(blooms).filter((b) => b?.eventId === event.id);
  const voicebanks = canonicalVoicebanks(chapters.map((b) => VIRTUAL_SINGER_CHARACTERS[b.gameCharacterId]));
  const units = sekaiUnits([event.unit]);
  const allVirtualSingers = chapters.length > 0 && chapters.every((b) => VIRTUAL_SINGER_CHARACTERS[b.gameCharacterId]);
  if (event.unit === "piapro" || allVirtualSingers) units.push(...canonicalUnits(["virtual singer"]));
  const label = EVENT_TYPES[event.eventType] ?? "Event";
  return {
    source: sekaiGlobal.id,
    nativeId: `event:${event.id}`,
    sections: ["music"],
    kind: "event",
    title: clip(`Project SEKAI Global ${label === "World Link" ? "World Link" : "event"}: ${event.name}`, 200),
    url: official?.url ?? viewer,
    credit: DATA_CREDIT,
    tags: {
      characters: [],
      fandoms: ["project sekai"],
      voicebanks,
      producers: [],
      units: unique(units),
      formats: [],
      topics: [],
    },
    facts: {
      names: unique([clip(event.name, 100), label]),
      eventId: String(event.id),
      eventAt: iso(Number(event.startAt)),
      eventEndAt: iso(Number(event.aggregateAt)),
      datePrecision: "datetime",
      links: [
        ...(official ? [{ kind: "official", label: "colorfulstage.com news", url: official.url }] : []),
        { kind: "source", label: "Sekai Viewer", url: viewer },
      ],
    },
    safety: { rating: "unknown" },
    publishedAt: official?.at ?? iso(Number(event.startAt)),
    // Events stop being shown once the event has closed.
    expiresAt: iso(Number(event.closedAt ?? event.aggregateAt)),
  };
}

function songItem(music, { tags, vocals }) {
  const musicTags = asArray(tags).filter((t) => t?.musicId === music.id).map((t) => t.musicTag);
  const units = sekaiUnits(musicTags);
  const singers = asArray(vocals)
    .filter((v) => v?.musicId === music.id)
    .flatMap((v) => asArray(v.characters))
    .filter((c) => c?.characterType === "game_character")
    .map((c) => VIRTUAL_SINGER_CHARACTERS[c.characterId]);
  const url = `${VIEWER}/music/${music.id}`;
  const published = iso(Number(music.publishedAt));
  return {
    source: sekaiGlobal.id,
    nativeId: `music:${music.id}`,
    sections: ["music"],
    kind: "news",
    title: clip(`New song on Project SEKAI Global: ${music.title}`, 200),
    url,
    credit: DATA_CREDIT,
    tags: {
      characters: [],
      fandoms: ["project sekai"],
      voicebanks: canonicalVoicebanks(singers),
      producers: [],
      units,
      formats: [],
      topics: [],
    },
    facts: {
      names: unique([music.title, music.composer, music.lyricist, music.arranger].map((n) => clip(String(n ?? "").trim(), 100))),
      releaseAt: published,
      releasePrecision: "datetime",
      links: [{ kind: "source", label: "Sekai Viewer", url }],
    },
    safety: { rating: "unknown" },
    publishedAt: published,
    expiresAt: iso(Number(music.publishedAt) + NEWS_WINDOW_MS),
  };
}

/** Virtual singers first: a vocaloid-tagged song or one with a version sung only by virtual singers. */
export function sekaiSongRank(music, { tags, vocals }) {
  const units = sekaiUnits(asArray(tags).filter((t) => t?.musicId === music.id).map((t) => t.musicTag));
  const virtualVersion = asArray(vocals)
    .filter((v) => v?.musicId === music.id)
    .some((v) => {
      const singers = asArray(v.characters);
      return singers.length > 0 && singers.every((c) => c?.characterType === "game_character" && VIRTUAL_SINGER_CHARACTERS[c.characterId]);
    });
  if (units.includes("virtual singer") || virtualVersion) return 0;
  return units.some((u) => HER_UNITS.has(u)) ? 1 : 2;
}

async function fetchSekaiGlobal(ctx) {
  const state = pageCursor.decode(ctx.cursor, {});
  const page = state.d === ctx.day && state.i === 1 ? 1 : 0;
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();

  if (page === 0) {
    const { text } = await ctx.http.text(`${DB}/events.json`, {
      types: ["application/json"],
      headers: { range: `bytes=-${EVENTS_TAIL_BYTES}` },
    });
    const current = parseEventsTail(text)
      .filter((e) => Number.isInteger(e?.id) && typeof e.name === "string" && Number.isFinite(e.startAt))
      // Released only: future rows are datamined leaks.
      .filter((e) => e.startAt <= now && Number(e.closedAt ?? e.aggregateAt) > now)
      .sort((a, b) => b.startAt - a.startAt)
      .slice(0, limit);
    let items = [];
    if (current.length) {
      const blooms = current.some((e) => e.eventType === "world_bloom") ? await ctx.http.json(`${DB}/worldBlooms.json`) : [];
      if (!Array.isArray(blooms)) throw new FeedError("invalid_source_json");
      const news = await newsEntries(ctx.http);
      items = current.map((event) => eventItem(event, { blooms, news }));
    }
    return { items, cursor: pageCursor.encode({ v: 1, d: ctx.day, i: 1 }), done: false };
  }

  const musics = await ctx.http.json(`${DB}/musics.json`);
  if (!Array.isArray(musics)) throw new FeedError("invalid_source_json");
  const fresh = musics
    .filter((m) => Number.isInteger(m?.id) && typeof m.title === "string" && Number.isFinite(m.publishedAt))
    .filter((m) => m.publishedAt <= now && now - m.publishedAt <= NEW_SONG_WINDOW_MS)
    .sort((a, b) => b.publishedAt - a.publishedAt);
  if (!fresh.length || !limit) return { items: [], cursor: null, done: true };
  const tags = await ctx.http.json(`${DB}/musicTags.json`);
  const vocals = await ctx.http.json(`${DB}/musicVocals.json`);
  if (!Array.isArray(tags) || !Array.isArray(vocals)) throw new FeedError("invalid_source_json");
  const items = fresh
    .map((music, i) => ({ music, i, rank: sekaiSongRank(music, { tags, vocals }) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map(({ music }) => songItem(music, { tags, vocals }));
  return { items, cursor: null, done: true };
}

const TEXT_UNITS = Object.fromEntries(
  Object.entries(UNIT_ALIASES).map(([unit, aliases]) => [unit, aliases.filter((a) => !["street", "idol", "piapro", "light_sound", "school_refusal", "light music club"].includes(a))]),
);
const VOICEBANK_TEXT = Object.fromEntries(VOICEBANKS.map((v) => [v, CHARACTER_ALIASES[v] ?? []]));

async function fetchSekaiNewsGlobal(ctx) {
  const limit = Math.max(0, Math.min(8, ctx.limits.items));
  const now = Date.now();
  const items = (await newsEntries(ctx.http))
    .filter((entry) => entry.at && Date.parse(entry.at) <= now && now - Date.parse(entry.at) <= NEWS_WINDOW_MS)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
    .map((entry) => ({
      source: sekaiNewsGlobal.id,
      nativeId: entry.targetUrl,
      sections: ["music"],
      kind: "news",
      title: clip(entry.title, 200),
      url: entry.url,
      credit: NEWS_CREDIT,
      tags: {
        characters: [],
        fandoms: ["project sekai"],
        voicebanks: mentions(entry.title.normalize("NFKC"), VOICEBANK_TEXT),
        producers: [],
        units: mentions(entry.title.normalize("NFKC"), TEXT_UNITS),
        formats: [],
        topics: [],
      },
      facts: {
        names: unique([clip(entry.title, 100), clip(String(entry.category ?? "").trim(), 100)]),
        dates: unique([clip(String(entry.updated ?? "").trim(), 100)]),
        links: [{ kind: "official", label: "colorfulstage.com", url: entry.url }],
      },
      safety: { rating: "unknown" },
      publishedAt: entry.at,
      expiresAt: new Date(Date.parse(entry.at) + NEWS_WINDOW_MS).toISOString(),
    }));
  return { items, cursor: null, done: true };
}

export const sekaiGlobal = {
  id: "sekai-global",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["music"],
  // sekai.best is linked (Sekai Viewer pages), never requested.
  hosts: ["sekai-world.github.io", "www.colorfulstage.com", "sekai.best"],
  mediaHosts: [],
  linkHosts: ["www.colorfulstage.com", "sekai.best"],
  profileHosts: ["github.com"],
  requiredCredentials: [],
  // events tail + worldBlooms + news, then musics + musicTags + musicVocals, plus retries.
  maxRequests: 10,
  // musicVocals.json is 937,367 bytes today; the events tail is capped at 900 KB.
  maxBytes: 1_500_000,
  paceMs: 500,
  timeoutMs: 20000,
  cacheSeconds: 86400,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
  termsUrl: REPO,
  docsUrl: REPO,
  notes:
    "Page 1: current Global events (startAt <= now < closedAt) from a 900 KB tail Range of events.json, World Link chapter " +
    "singers from worldBlooms.json, official article link matched from colorfulstage.com news. Page 2: songs whose Global " +
    "publishedAt is within the last 14 days and not in the future, units from musicTags.json, virtual singers from " +
    "musicVocals.json. No repository license (game data); no images; credited to Sekai-World.",
  fetch: fetchSekaiGlobal,
};

export const sekaiNewsGlobal = {
  id: "sekai-news-global",
  stage: "fetch-a",
  status: "enabled",
  enabled: true,
  sections: ["music"],
  hosts: ["www.colorfulstage.com"],
  mediaHosts: [],
  linkHosts: ["www.colorfulstage.com"],
  requiredCredentials: [],
  maxRequests: 3,
  maxBytes: 512 * 1024,
  paceMs: 1000,
  timeoutMs: 12000,
  cacheSeconds: 86400,
  mediaPolicy: "link_only",
  copyPolicy: "link_only",
  deletionPolicy: "none",
  attributionRequired: true,
  termsUrl: null,
  docsUrl: NEWS_URL,
  notes:
    "Official Global news list (100 entries, JSON with a trailing comma, parsed leniently). Entries from the last 21 days " +
    "(Pacific Time dates, never future-dated) become text-and-link news items; thumbnails and card art are never used. " +
    "No terms page or robots.txt exists on colorfulstage.com (checked 2026-09-15).",
  fetch: fetchSekaiNewsGlobal,
};
