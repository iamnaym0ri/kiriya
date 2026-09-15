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
