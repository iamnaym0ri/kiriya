import { shrinkImage, uploadFile } from "../../../lib/uploads.js";

// Clean stock photos for quiz cards from Openverse (openverse.org, WordPress's open catalogue of
// Creative Commons media). Its API needs no key and allows any origin, so the phone searches it
// directly. Free stock libraries (StockSnap, WordPress Photo Directory, Nappy, rawpixel: mostly CC0)
// come first; Flickr fills in when they run short. A picked photo is copied into our own private
// storage, so it never breaks or slows down, and keeps its credit for the card.

const API = "https://api.openverse.org/v1/images/";
const CLEAN = "stocksnap,wordpress,nappy,rawpixel";
// No "no derivatives" licences: cards crop photos to fit.
const LICENSES = "by,by-sa,by-nc,by-nc-sa,cc0,pdm";
const PAGE = 20;

export const SOURCE_NAMES = {
  stocksnap: "StockSnap",
  wordpress: "WordPress Photo Directory",
  nappy: "Nappy",
  rawpixel: "rawpixel",
  flickr: "Flickr",
};
const LICENSE_NAMES = { cc0: "CC0", pdm: "public domain" };

/** "CC0", "public domain", "CC BY-SA 2.0". */
export function licenseName(license, version) {
  if (LICENSE_NAMES[license]) return LICENSE_NAMES[license];
  return `CC ${String(license).toUpperCase()}${version ? ` ${version}` : ""}`;
}

/** The credit line under a stock photo. */
export function creditLine(credit) {
  if (!credit) return "";
  const title = credit.title ? `“${credit.title}”` : "photo";
  return [credit.creator ? `${title} by ${credit.creator}` : title, licenseName(credit.license, credit.licenseVersion), credit.source].filter(Boolean).join(" · ");
}

const https = (url) => (typeof url === "string" && url.startsWith("https://") && url.length <= 500 ? url : null);

function toPhoto(item) {
  return {
    id: item.id,
    thumb: item.thumbnail,
    width: item.width ?? null,
    height: item.height ?? null,
    credit: {
      id: item.id,
      title: String(item.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
      creator: item.creator ? String(item.creator).trim().slice(0, 120) : null,
      creatorUrl: https(item.creator_url),
      license: item.license,
      licenseVersion: item.license_version ? String(item.license_version).slice(0, 10) : null,
      licenseUrl: https(item.license_url)?.startsWith("https://creativecommons.org/") ? item.license_url : null,
      source: (SOURCE_NAMES[item.source] ?? item.source ?? "").slice(0, 60),
      landingUrl: https(item.foreign_landing_url),
    },
  };
}

async function query(q, { source, page, signal }) {
  const params = new URLSearchParams({ q, page: String(page), page_size: String(PAGE), source, license: LICENSES, category: "photograph", mature: "false" });
  const response = await fetch(`${API}?${params}`, { signal, headers: { Accept: "application/json" } });
  if (response.status === 429) throw new Error("The photo library needs a little breather. Try again in a minute ♡");
  if (!response.ok) throw new Error("The photo library didn’t answer. Try again?");
  const data = await response.json();
  const results = (data.results ?? []).filter((item) => item.thumbnail && !item.mature && item.license && (item.width ?? 999) >= 400).map(toPhoto);
  return { results, more: page < (data.page_count ?? 0) };
}

/**
 * One page of photos. `cursor` continues where the last page ended: { source: "clean" | "flickr", page }.
 * Returns { photos, next } (next null at the end).
 */
export async function searchPhotos(q, { cursor = null, signal } = {}) {
  const term = q.trim();
  if (!term) return { photos: [], next: null };
  let at = cursor ?? { source: "clean", page: 1 };
  const photos = [];
  if (at.source === "clean") {
    const clean = await query(term, { source: CLEAN, page: at.page, signal });
    photos.push(...clean.results);
    if (clean.more) return { photos, next: { source: "clean", page: at.page + 1 } };
    at = { source: "flickr", page: 1 };
    // A short first page: fill it from Flickr straight away.
    if (photos.length >= 12) return { photos, next: at };
  }
  const flickr = await query(term, { source: "flickr", page: at.page, signal });
  const seen = new Set(photos.map((p) => p.id));
  photos.push(...flickr.results.filter((p) => !seen.has(p.id)));
  return { photos, next: flickr.more && at.page < 5 ? { source: "flickr", page: at.page + 1 } : null };
}

/** Little ideas for the search box. */
export const PHOTO_IDEAS = ["cats", "ramen", "beach", "cherry blossom", "bubble tea", "stars", "coffee", "flowers", "city night", "concert", "cake", "rain"];

/**
 * Copies a picked photo into our storage: the full-size image when it's a sensible size, else the
 * thumbnail; shrunk on the phone, then uploaded like any of her photos. Returns the image for the quiz.
 */
export async function keepPhoto(photo, { onProgress } = {}) {
  const fetchBlob = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("bad image");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    return blob;
  };
  let blob;
  try {
    blob = await fetchBlob(`${photo.thumb}?full_size=true`);
    if (blob.size > 8 * 1024 * 1024) throw new Error("too big");
  } catch {
    blob = await fetchBlob(photo.thumb);
  }
  const type = blob.type === "image/png" ? "image/png" : blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  const file = new File([blob], `stock-${photo.id}.${type.split("/")[1].replace("jpeg", "jpg")}`, { type });
  const small = await shrinkImage(file, 1400, 0.85);
  const size = await imageSize(small);
  const { url } = await uploadFile(small, { folder: "quizzes", onProgress });
  return { kind: "stock", url, ...size, credit: photo.credit };
}

/** Width and height of an image file, for a card that doesn't jump as it loads. */
export async function imageSize(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return {};
  }
}
