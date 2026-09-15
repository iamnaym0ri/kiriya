// VocaDB (CC BY data; the site credits VocaDB with a link). Arrays need [] in the query string.
import { getJson } from "../../lib/http.js";
import { seededRandom } from "../pick.js";

const API = "https://vocadb.net/api";

function youtubePv(song) {
  const pvs = song.pvs ?? [];
  return (
    pvs.find((p) => p.service === "Youtube" && p.pvType === "Original" && !p.disabled) ??
    pvs.find((p) => p.service === "Youtube" && !p.disabled) ??
    null
  );
}

function normalize(song) {
  const pv = youtubePv(song);
  if (!pv) return null;
  return {
    id: song.id,
    title: song.name,
    artist: song.artistString,
    provider: "youtube",
    embedId: pv.pvId,
    url: `https://www.youtube.com/watch?v=${pv.pvId}`,
    thumbnail: `https://i.ytimg.com/vi/${pv.pvId}/hqdefault.jpg`,
    vocadbUrl: `https://vocadb.net/S/${song.id}`,
    publishDate: song.publishDate ?? null,
    bpm: song.maxMilliBpm ? Math.round(song.maxMilliBpm / 1000) : null,
    ratingScore: song.ratingScore ?? null,
  };
}

/** A well-loved pool of Miku, Rin and Len originals with YouTube videos. */
export async function fetchSongPool() {
  const pages = await Promise.all(
    [
      "artistId[]=1&minScore=400",
      "artistId[]=14&minScore=150",
      "artistId[]=15&minScore=150",
    ].map((filter) =>
      getJson(
        `${API}/songs?${filter}&songTypes=Original&onlyWithPvs=true&pvServices=Youtube&sort=RatingScore&maxResults=100&fields=PVs&lang=English`,
      ),
    ),
  );
  const seen = new Set();
  const pool = [];
  for (const page of pages) {
    for (const song of page.items ?? []) {
      const item = normalize(song);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        pool.push(item);
      }
    }
  }
  return pool;
}

export function songOfTheDay(pool, day, recentIds = []) {
  const random = seededRandom(day, "song-of-the-day");
  const fresh = pool.filter((s) => !recentIds.includes(String(s.id)));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(random() * list.length)] ?? null;
}

/** Adds tempo and tags for the chosen song. */
export async function songDetails(id) {
  const song = await getJson(`${API}/songs/${id}?fields=PVs,Tags,Bpm&lang=English`);
  const item = normalize(song);
  if (!item) return null;
  return {
    ...item,
    bpm: song.maxMilliBpm ? Math.round(song.maxMilliBpm / 1000) : item.bpm,
    tags: (song.tags ?? [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => t.tag?.name)
      .filter(Boolean),
  };
}

/** New and rising Miku / Rin / Len songs this week, as "fresh finds". */
export async function fetchRisingSongs() {
  const data = await getJson(
    `${API}/songs/top-rated?durationHours=168&filterBy=PublishDate&vocalist=Vocaloid&maxResults=40&fields=PVs&languagePreference=English`,
  );
  return (Array.isArray(data) ? data : data.items ?? [])
    .filter((song) => /Hatsune Miku|Kagamine Rin|Kagamine Len|初音ミク|鏡音/.test(song.artistString ?? ""))
    .map(normalize)
    .filter(Boolean)
    .slice(0, 6)
    .map((song) => ({
      id: `vocadb:${song.id}`,
      source: "VocaDB",
      category: "vocaloid",
      title: `${song.title} by ${song.artist}`,
      url: song.url,
      summary: "New this week and climbing the VocaDB charts.",
      publishedAt: song.publishDate,
      data: song,
    }));
}
