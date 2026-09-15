import { COSPLAY_PRAISE } from "./praise.js";

export const DISPLAY_START_DAY = "2026-09-16";
export const CAPTION_INTERVAL_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const start = Date.parse(`${DISPLAY_START_DAY}T00:00:00+08:00`);
export const DISPLAY_PHOTOS = [
  { id: "img-5446", src: "/images/display/img-5446.webp", width: 828, height: 848, alt: "Kiriya in her Maomao cosplay, smiling with a hand by her cheek." },
  { id: "img-5445", src: "/images/display/img-5445.webp", width: 810, height: 1084, alt: "Kiriya in her Maomao cosplay, peeking over a pink sleeve, with green braids and gold earrings." },
];

export function displayRotation(now = Date.now(), avatarUrl = null) {
  const elapsed = Math.max(0, now - start);
  const day = Math.floor(elapsed / DAY_MS);
  const tick = Math.floor(elapsed / CAPTION_INTERVAL_MS);
  const photo = avatarUrl ? { id: "custom", src: avatarUrl, alt: "Kiriya in cosplay", width: 828, height: 848 } : DISPLAY_PHOTOS[Math.floor(day / 2) % DISPLAY_PHOTOS.length];
  // A coprime stride spaces similar topics; pose-specific praise only follows its own image.
  let praise;
  for (let offset = 0; offset < COSPLAY_PRAISE.length; offset++) {
    const candidate = COSPLAY_PRAISE[(tick * 37 + offset) % COSPLAY_PRAISE.length];
    if (!candidate.photo || candidate.photo === photo.id) { praise = candidate; break; }
  }
  const nextAt = now < start ? start : start + (tick + 1) * CAPTION_INTERVAL_MS;
  return { photo, praise, tick, nextAt };
}
