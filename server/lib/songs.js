// Turns a pasted link into something the player can embed. Unknown links are rejected with a
// message that says which kinds of links work.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseSongUrl(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return { error: "That doesn't look like a link. Paste the full address, starting with https://" };
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
    if (!id) {
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = match?.[1];
    }
    if (!id || !YOUTUBE_ID.test(id)) return { error: "That YouTube link is missing the video part." };
    return { provider: "youtube", embedId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }

  if (host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
    if (!match) return { error: "Use a Spotify track, album or playlist link." };
    return { provider: "spotify", embedId: `${match[1]}/${match[2]}`, url: `https://open.spotify.com/${match[1]}/${match[2]}` };
  }

  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    return { provider: "soundcloud", embedId: url.href, url: url.href };
  }

  if (host === "nicovideo.jp" || host === "nico.ms" || host === "sp.nicovideo.jp") {
    const match = url.pathname.match(/((?:sm|nm|so)\d+)/);
    if (!match) return { error: "That niconico link is missing the video number (like sm15630734)." };
    return { provider: "niconico", embedId: match[1], url: `https://www.nicovideo.jp/watch/${match[1]}` };
  }

  if (/\.(mp3|m4a|aac|wav|ogg|opus)(\?|$)/i.test(url.pathname)) {
    return { provider: "audio", embedId: url.href, url: url.href };
  }

  return { error: "Paste a YouTube, Spotify, SoundCloud or niconico link." };
}

/** Looks up a title and thumbnail through the provider's public oEmbed endpoint. Best effort. */
export async function fetchSongMeta(parsed) {
  const endpoints = {
    youtube: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`,
    spotify: `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.url)}`,
    soundcloud: `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`,
  };
  const endpoint = endpoints[parsed.provider];
  if (!endpoint) return {};
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return {};
    const data = await response.json();
    return { title: data.title ?? null, artist: data.author_name ?? null, thumbnail: data.thumbnail_url ?? null };
  } catch {
    return {};
  }
}

// ---------- cover art for uploaded songs that carry none (MusicBrainz + Cover Art Archive) ----------
// Only Josh's song editor calls these, once per upload. MusicBrainz asks for at most one request a
// second and a descriptive User-Agent; this one names no person or site. Cover Art Archive images are
// served by the Internet Archive. https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

export const MUSICBRAINZ_USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || "LilacSongCard/1.0 ( personal, non-commercial )";
const MB = "https://musicbrainz.org/ws/2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let nextMusicBrainzAt = 0;
const lookups = new Map();

async function musicBrainz(path, fetchImpl) {
  // One request a second, across every lookup in this instance.
  const wait = nextMusicBrainzAt - Date.now();
  nextMusicBrainzAt = Math.max(Date.now(), nextMusicBrainzAt) + 1100;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await fetchImpl(`${MB}${path}`, {
    headers: { "User-Agent": MUSICBRAINZ_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`MusicBrainz answered ${response.status}`);
  return response.json();
}

const quote = (value) => `"${String(value).replace(/["\\]/g, " ").trim()}"`;
const clean = (value) => (typeof value === "string" ? value.trim().slice(0, 120) : "");

/**
 * Albums (release groups) that might hold this song's cover, best match first. Each candidate's
 * picture is fetched through `coverImage` below. Best effort: an empty list when nothing matches.
 */
export async function lookupCovers({ title, artist, album } = {}, { fetch: fetchImpl = fetch } = {}) {
  title = clean(title);
  artist = clean(artist);
  album = clean(album);
  if (!title && !album) return [];
  const key = JSON.stringify([title, artist, album].map((part) => part.toLowerCase()));
  const cached = lookups.get(key);
  if (cached && cached.at > Date.now() - 10 * 60_000) return cached.value;
  const candidates = new Map();
  const add = (group, extra = {}) => {
    if (!group?.id || !UUID.test(group.id) || candidates.has(group.id)) return;
    candidates.set(group.id, {
      id: group.id,
      title: group.title ?? extra.title ?? null,
      artist: (group["artist-credit"] ?? extra.credit ?? []).map((credit) => credit.name + (credit.joinphrase ?? "")).join("") || null,
      type: group["primary-type"] ?? null,
      year: (extra.date ?? group["first-release-date"] ?? "").slice(0, 4) || null,
    });
  };
  try {
    if (album) {
      const query = [`releasegroup:${quote(album)}`, artist && `artist:${quote(artist)}`].filter(Boolean).join(" AND ");
      const data = await musicBrainz(`/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=5`, fetchImpl);
      for (const group of data["release-groups"] ?? []) if ((group.score ?? 0) >= 70) add(group);
    }
    if (title && candidates.size < 4) {
      const query = [`recording:${quote(title)}`, artist && `artist:${quote(artist)}`].filter(Boolean).join(" AND ");
      const data = await musicBrainz(`/recording?query=${encodeURIComponent(query)}&fmt=json&limit=8`, fetchImpl);
      for (const recording of data.recordings ?? []) {
        if ((recording.score ?? 0) < 70) continue;
        for (const release of recording.releases ?? [])
          add(release["release-group"], { title: release.title, credit: recording["artist-credit"], date: release.date });
      }
    }
  } catch {
    // MusicBrainz is busy or unreachable: Josh can still pick his own picture.
  }
  const value = [...candidates.values()].slice(0, 6);
  lookups.set(key, { at: Date.now(), value });
  return value;
}

/** The front cover of one release group, as image bytes, or null when the archive has none. */
export async function coverImage(groupId, { size = 500, fetch: fetchImpl = fetch } = {}) {
  if (!UUID.test(groupId ?? "")) return null;
  const response = await fetchImpl(`https://coverartarchive.org/release-group/${groupId}/front-${size === 250 ? 250 : 500}`, {
    headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const type = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) return null;
  return { type, bytes };
}
