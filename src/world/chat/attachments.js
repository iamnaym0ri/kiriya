// Getting photos and videos ready on the phone before they're sent (round 3): photos are shrunk
// (WebP, 2048 px at most; drawings and GIFs pass through), videos are checked for length and size
// and get a poster frame, and everything gets a preview so the message can show at once.
import { shrinkImage } from "../../lib/uploads.js";

export const MAX_VIDEO_SECONDS = 180;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const POSTER_EDGE = 720;

let seq = 0;

async function imageSize(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve({});
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }
}

const once = (target, event, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    target.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    target.addEventListener("error", () => reject(new Error("error")), { once: true });
  });

/** A video's length and size, and a poster frame from just after its start. */
async function videoDetails(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadedmetadata", 15000);
    const details = { duration: video.duration, width: video.videoWidth, height: video.videoHeight, url };
    try {
      video.currentTime = Math.min(0.15, (video.duration || 1) / 4);
      await once(video, "seeked", 8000);
      const scale = Math.min(1, POSTER_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
      if (!blob || blob.type !== "image/webp") blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob) details.poster = { blob, width: canvas.width, height: canvas.height, previewUrl: URL.createObjectURL(blob) };
    } catch {
      // No poster: the tile shows its colour and a play button until the video loads.
    }
    return details;
  } finally {
    video.removeAttribute("src");
    video.load?.();
  }
}

/**
 * One picked (or pasted) file, ready to send: { id, file, type, width, height, duration, mime,
 * previewUrl, poster } — or { error } with a gentle reason.
 */
export async function prepare(file) {
  const id = `a${++seq}`;
  if (file.type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(file.name ?? "")) {
    if (file.size > MAX_VIDEO_BYTES) return { id, error: `that video is a bit big ♡ (up to ${Math.round(MAX_VIDEO_BYTES / 1048576)} MB)` };
    let details;
    try {
      details = await videoDetails(file);
    } catch {
      return { id, error: "that video couldn’t be opened" };
    }
    if (details.duration > MAX_VIDEO_SECONDS + 1) {
      URL.revokeObjectURL(details.url);
      return { id, error: "videos can be up to 3 minutes ♡" };
    }
    const mime = file.type || (/\.mov$/i.test(file.name ?? "") ? "video/quicktime" : "video/mp4");
    const ready = file.type ? file : new File([file], file.name || "video.mp4", { type: mime });
    return { id, file: ready, type: "video", mime, width: details.width, height: details.height, duration: details.duration, previewUrl: details.url, poster: details.poster };
  }
  if (!file.type.startsWith("image/")) return { id, error: "only photos and videos can be sent here" };
  try {
    const ready = file.type === "image/gif" ? file : await shrinkImage(file, 2048, 0.86);
    const size = await imageSize(ready);
    return { id, file: ready, type: "image", mime: ready.type, ...size, previewUrl: URL.createObjectURL(ready) };
  } catch {
    return { id, error: "that photo couldn’t be opened" };
  }
}

/** Lets go of an attachment's previews (when it's removed from the tray before sending). */
export function release(attachment) {
  if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  if (attachment?.poster?.previewUrl) URL.revokeObjectURL(attachment.poster.previewUrl);
}
