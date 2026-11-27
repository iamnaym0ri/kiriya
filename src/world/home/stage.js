import { CAPTION_INTERVAL_MS, DISPLAY_PHOTOS, DISPLAY_START_DAY } from "../../shared/profile/displayRotation.js";
import { COSPLAY_PRAISE } from "../../shared/profile/praise.js";

// The centre stage's photos and captions: Josh's own lists when he has made them, otherwise the
// ones the site always had (the same pictures and the same captions, rotating the same way).

export const DEFAULT_GREETING = "there you are, lovely.";
const DAY_MS = 24 * 60 * 60 * 1000;
const start = Date.parse(`${DISPLAY_START_DAY}T00:00:00+08:00`);

export function defaultPhotos(avatarUrl) {
  if (avatarUrl) return [{ id: "custom", src: avatarUrl, alt: "Kiriya in cosplay", focus: "center", ownCaptionsOnly: false }];
  return DISPLAY_PHOTOS.map(({ id, src, alt, width, height, ownPraiseOnly }) => ({
    id,
    src,
    alt,
    width,
    height,
    focus: "center",
    ownCaptionsOnly: Boolean(ownPraiseOnly),
  }));
}

// The retired IMG_5445's captions stay out until that photo comes back.
export const defaultCaptions = () =>
  COSPLAY_PRAISE.filter((item) => item.photo !== "img-5445").map(({ id, text, photo }) => ({ id, text, photo: photo ?? null }));

export function stageOf(home, avatarUrl) {
  const photos = home?.photos?.length ? home.photos : defaultPhotos(avatarUrl);
  const captions = home?.captions?.length ? home.captions : defaultCaptions();
  return { photos, captions, pinned: home?.pinnedCaption ?? null, custom: { photos: Boolean(home?.photos?.length), captions: Boolean(home?.captions?.length) } };
}

/** The photo the carousel opens on: a different one every two days, as before. */
export function firstPhoto(count, now = Date.now()) {
  if (!count) return 0;
  const day = Math.floor(Math.max(0, now - start) / DAY_MS);
  return Math.floor(day / 2) % count;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** A stride that visits every caption before repeating (coprime with the list's length). */
function strideFor(length) {
  let stride = 37;
  while (length > 1 && gcd(stride, length) !== 1) stride += 2;
  return stride;
}

const fits = (caption, photo) => (photo?.ownCaptionsOnly ? caption.photo === photo.id : !caption.photo || caption.photo === photo?.id);

/**
 * The caption under one photo right now. A pinned caption always shows (under its own photo, if it
 * belongs to one). Otherwise it changes every two hours, and each photo gets its own.
 */
export function captionFor({ photo, index = 0, captions, pinned, now = Date.now() }) {
  if (!captions.length) return null;
  const chosen = pinned && captions.find((item) => item.id === pinned);
  if (chosen && (!chosen.photo || chosen.photo === photo?.id)) return chosen;
  const tick = Math.floor(Math.max(0, now - start) / CAPTION_INTERVAL_MS);
  const stride = strideFor(captions.length);
  for (let offset = 0; offset < captions.length; offset++) {
    const candidate = captions[(((tick * stride + index * 7 + offset) % captions.length) + captions.length) % captions.length];
    if (fits(candidate, photo)) return candidate;
  }
  return captions.find((item) => !item.photo) ?? null;
}

/** When the caption next changes, so the stage can quietly refresh itself. */
export function nextCaptionAt(now = Date.now()) {
  if (now < start) return start;
  return start + (Math.floor((now - start) / CAPTION_INTERVAL_MS) + 1) * CAPTION_INTERVAL_MS;
}
