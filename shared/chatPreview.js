// What a chat message is, in a few words: the line its notification shows and the chat summary's
// preview. Used on the phone (src/lib/chatCrypto.js, which seals it with the message) and by the
// server for messages from before both of them had keys (server/lib/chat.js chatNotification).

const count = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

/** "📷 4 photos", "🎬 a video", "📷 3 photos and a video", "a GIF", "🎙️ a voice note". */
export function mediaPhrase(kind, media) {
  if (kind === "gif") return "a GIF";
  if (kind === "sticker") return "a sticker";
  if (kind === "voice") return "🎙️ a voice note";
  if (kind === "image") {
    const items = Array.isArray(media?.items) ? media.items : [media ?? {}];
    const videos = items.filter((item) => item?.type === "video").length;
    const photos = items.length - videos;
    if (videos && photos) return `📷 ${count(photos, "a photo", "photos")} and ${count(videos, "a video", "videos")}`;
    if (videos) return `🎬 ${count(videos, "a video", "videos")}`;
    return `📷 ${count(photos, "a photo", "photos")}`;
  }
  return "a message";
}

/** The whole line: the words of a text, or what was sent and its caption. */
export function previewText({ kind, body = "", media = null }, max = 180) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (kind === "text") return text.slice(0, max);
  const phrase = mediaPhrase(kind, media);
  return (text ? `${phrase}: ${text}` : phrase).slice(0, max);
}
