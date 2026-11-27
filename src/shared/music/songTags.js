// Reads a song file's own tags in the browser, before it's uploaded: title, artist, album, length
// and the cover picture inside it. music-metadata (MIT, https://github.com/Borewit/music-metadata)
// loads only when Josh picks a file, so nobody else downloads it.

const AUDIO_TYPES = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
};
// What the upload route accepts (server/routes/uploads.js).
export const UPLOADABLE_AUDIO = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav"];

/** The file with a type the upload route accepts (the Files app sometimes leaves it blank). */
export function audioFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let type = file.type;
  if (!UPLOADABLE_AUDIO.includes(type)) type = AUDIO_TYPES[ext] ?? type;
  if (type === "audio/x-m4a") type = "audio/mp4";
  if (!UPLOADABLE_AUDIO.includes(type)) return null;
  return type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

/** A title from a file name, for files with no tags: "03 - World is Mine.mp3" → "World is Mine". */
export const titleFromName = (name) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{1,3}[\s._-]+/, "")
    .replace(/[_]+/g, " ")
    .trim() || "a song for you";

export async function readSongTags(file) {
  const { parseBlob, selectCover } = await import("music-metadata");
  const meta = await parseBlob(file, { duration: true });
  const { common, format } = meta;
  const picture = selectCover(common.picture);
  let cover = null;
  if (picture?.data?.length && /^image\/(jpeg|png|webp|gif)$/.test(picture.format)) {
    const ext = picture.format.split("/")[1].replace("jpeg", "jpg");
    cover = new File([picture.data], `cover.${ext}`, { type: picture.format });
  }
  return {
    title: common.title?.trim() || null,
    artist: (common.artist ?? common.artists?.join(", ") ?? common.albumartist)?.trim() || null,
    album: common.album?.trim() || null,
    duration: Number.isFinite(format.duration) && format.duration > 0 ? Math.round(format.duration * 10) / 10 : null,
    cover,
  };
}

/** The length of an audio file as the phone itself measures it (when the tags don't say). */
export function measureDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration * 10) / 10 : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    probe.src = url;
  });
}
