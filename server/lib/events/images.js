// Pictures for events and merch, without a single extra Claude call.
//
// Where they come from, in order of trust:
//   - Instagram posts of the seven watched accounts (Apify already returns their picture links);
//   - the event's own pages: the og:image / twitter:image of its official, ticketing or news page;
//   - a picture link the investigation saw on a page it read (merch[].image), copied the same way.
// Instagram links expire within days and other sites may change, so every picture is copied once and
// served from our own private storage (the `events` upload folder, /api/uploads/media).
//
// Who stores: the site. The Railway worker has no Blob token, so it hands each picture to the site's
// own API (POST /api/jobs/events/images, Bearer CRON_SECRET), which stores it with the same private
// Blob store as every other upload (or, in local development, under .data/uploads). A worker that
// does have a Blob token stores directly. Every page and picture is fetched through the polite fetcher
// (blocked sites, robots.txt for our agent and Anthropic's, pacing).
import { createHash } from "node:crypto";
import { readKv, writeKv } from "./store.js";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The picture's real type from its first bytes (JPEG, PNG, WebP), or null. */
export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Content-addressed names: the same picture is stored once, whoever sends it. */
export function imageNames(buffer, type) {
  const hash = createHash("sha256").update(buffer).digest("hex");
  const ext = EXT[type] ?? "jpg";
  return { blob: `events/${hash.slice(0, 32)}.${ext}`, local: `events-${hash.slice(0, 16)}.${ext}` };
}

export const mediaUrlFor = (pathname) => `/api/uploads/media?path=${encodeURIComponent(pathname)}`;
const OURS = /^\/api\/(?:uploads\/(?:media\?path=events(?:%2F|\/)|file\/events-)|events\/fixture-art\/)/;
/** A picture link we already serve ourselves (never fetched again). */
export const isOurImage = (url) => typeof url === "string" && OURS.test(url);

/**
 * Site side: stores one picture and returns `{url, pathname}`. `blob` is lib/feeds/storage.js
 * blobOps() (null when no store is connected); `localDir` is the development stand-in.
 */
export async function storeImageBytes(buffer, { blob, localDir = null, isProd = true } = {}) {
  const type = sniffImage(buffer);
  if (!type) throw Object.assign(new Error("not an image"), { code: "not_an_image" });
  if (buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error("too big"), { code: "too_big" });
  const names = imageNames(buffer, type);
  if (blob) {
    await blob.put(names.blob, buffer, type).catch((error) => {
      if (!/exist/i.test(error?.message ?? "")) throw error;
    });
    return { url: mediaUrlFor(names.blob), pathname: names.blob };
  }
  if (isProd || !localDir) throw Object.assign(new Error("no storage"), { code: "not_configured" });
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(localDir, { recursive: true });
  await writeFile(path.join(localDir, names.local), buffer);
  return { url: `/api/uploads/file/${names.local}`, pathname: names.local };
}

/**
 * Worker side: where pictures go. With a Blob token, straight to Blob; otherwise to the site's API
 * with CRON_SECRET. Returns `{put(buffer) → url, via}` or null when neither is available.
 */
export function imageStore({ blob = null, apiOrigin = null, cronSecret = null, post = globalThis.fetch } = {}) {
  if (blob) return { via: "blob", put: async (buffer) => (await storeImageBytes(buffer, { blob })).url };
  if (!apiOrigin || !cronSecret) return null;
  return {
    via: "api",
    async put(buffer) {
      const type = sniffImage(buffer);
      if (!type) throw Object.assign(new Error("not an image"), { code: "not_an_image" });
      const response = await post(`${apiOrigin}/api/jobs/events/images`, {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}`, "content-type": type },
        body: buffer,
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw Object.assign(new Error(`image upload ${response.status}`), { code: `upload_${response.status}` });
      const data = await response.json();
      // Stored as the plain relative link the website uses, whatever form the answer took.
      const url = String(data?.url ?? "").replace(/^https?:\/\/[^/]+/, "").replace(/[?&]s=[A-Za-z0-9_-]{22}$/, "");
      if (!isOurImage(url)) throw Object.assign(new Error("bad upload answer"), { code: "upload_bad_answer" });
      return url;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Finding pictures on pages (og:image), politely.
// ---------------------------------------------------------------------------------------------

const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"))?.slice(2).find((v) => v != null) ?? null;
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&quot;/g, '"').trim();

/** The page's own share picture: og:image, twitter:image or image_src, made absolute (https only). */
export function shareImageOf(html, baseUrl) {
  const head = String(html ?? "").slice(0, 400_000);
  const found = [];
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    if (["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"].includes(key)) {
      const content = attr(tag, "content");
      if (content) found.push(decode(content));
    }
  }
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) if (/\bimage_src\b/i.test(attr(tag, "rel") ?? "")) found.push(decode(attr(tag, "href") ?? ""));
  for (const candidate of found) {
    try {
      const url = new URL(candidate, baseUrl);
      if (url.protocol === "https:" && !/\.svg(\?|$)|favicon|logo-?(?:white|black)?\.png|placeholder/i.test(url.pathname)) return url.href;
    } catch {
      // not a link
    }
  }
  return null;
}

/** Fetches `url` (robots.txt and the blocked list apply) and copies it. Returns our link or null. */
export async function copyRemoteImage(url, { fetcher, store }) {
  if (!url || !store) return null;
  if (isOurImage(url)) return url;
  try {
    const picture = await fetcher.image(url);
    return await store.put(picture.buffer);
  } catch {
    return null;
  }
}

/** The share picture of a page, copied. */
export async function pagePicture(pageUrl, { fetcher, store }) {
  if (!pageUrl || !store || isSocial(pageUrl)) return null;
  try {
    const page = await fetcher.get(pageUrl, { types: ["text/html", "application/xhtml+xml"] });
    const image = shareImageOf(page.text, page.url ?? pageUrl);
    return image ? await copyRemoteImage(image, { fetcher, store }) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Matching pictures to events and merch.
// ---------------------------------------------------------------------------------------------

const STOP = new Set(["the", "and", "for", "with", "set", "of", "a", "an", "at", "in", "on", "by", "x", "sg", "singapore", "2026", "2027", "edition", "exclusive", "exclusives", "limited", "merch", "official", "sample"]);
const words = (s) => String(s ?? "").normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
const isInstagramPost = (url) => /^https:\/\/(www\.)?instagram\.com\/(p|reel)\//i.test(url ?? "");
// Social sites are never crawled (Instagram reaches us only through the Apify trigger).
const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|tiktok\.com|threads\.net|youtube\.com|t\.me|telegram\.me)$/i;
const isSocial = (url) => {
  try {
    return SOCIAL.test(new URL(url).hostname);
  } catch {
    return true;
  }
};
const normPost = (url) => String(url ?? "").replace(/^https:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

/** An Instagram caption talks about this merch piece when most of its telling words appear in it. */
export function captionMentions(caption, name) {
  const want = [...new Set(words(name))];
  if (!want.length) return false;
  const have = new Set(words(caption));
  const hits = want.filter((w) => have.has(w)).length;
  return hits >= Math.min(2, want.length) && hits / want.length >= 0.5;
}

/**
 * Which sources a merch piece may borrow a page picture from: cited by merch only (a page about the
 * exclusives, not the whole event, so its picture shows the goods and not the con's poster).
 */
export function merchOnlySources(dossier = {}) {
  const used = new Map();
  const mark = (ids, who) => (ids ?? []).forEach((id) => used.set(id, new Set([...(used.get(id) ?? []), who])));
  const walk = (value, who) => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, who));
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.sourceIds)) mark(value.sourceIds, who);
    for (const [k, v] of Object.entries(value)) if (k !== "sourceIds") walk(v, who);
  };
  for (const [key, value] of Object.entries(dossier)) if (!["sources", "timeline", "merch"].includes(key)) walk(value, "event");
  walk(dossier.merch ?? [], "merch");
  return new Set([...used].filter(([, who]) => who.size === 1 && who.has("merch")).map(([id]) => id));
}

/**
 * Fills in the pictures an event is missing. Returns `{image, merch, changed, fetched}`: the cover
 * (`events.image` shape) and the merch list with `images` filled where a picture was found.
 * `posts` are this event's Instagram leads: [{url, account, caption, images: [our links]}].
 */
export async function picturesFor(row, { posts = [], fetcher, store, maxFetches = 4 } = {}) {
  const dossier = row.dossier ?? {};
  const sources = dossier.sources ?? [];
  let fetched = 0;
  let changed = false;
  const budget = () => fetched < maxFetches;
  const byPost = new Map(posts.filter((p) => p.images?.length).map((p) => [normPost(p.url), p]));

  // The cover: the official page's share picture, else an Instagram post's, else a ticketing/news page's.
  let image = row.image?.url ? row.image : null;
  if (!image && store) {
    const official = row.url && !/kiriya\.love/.test(row.url) && !isSocial(row.url) ? row.url : null;
    if (official && budget()) {
      fetched++;
      const url = await pagePicture(official, { fetcher, store });
      if (url) image = { url, alt: row.name, credit: hostOf(official) };
    }
    if (!image) {
      const post = posts.find((p) => p.images?.length);
      if (post) image = { url: post.images[0], alt: row.name, credit: post.account ? `@${post.account}` : "instagram" };
    }
    for (const source of sources.filter((s) => ["ticketing", "venue", "news", "listing"].includes(s.kind) && !isSocial(s.url))) {
      if (image || !budget()) break;
      fetched++;
      const url = await pagePicture(source.url, { fetcher, store });
      if (url) image = { url, alt: row.name, credit: source.publisher ?? hostOf(source.url) };
    }
    if (image) changed = true;
  }

  // Merch: the item's own picture, its Instagram post, a post whose caption names it, then a page
  // cited only for the merch.
  const merchPages = merchOnlySources(dossier);
  const pageCache = new Map();
  const merch = [];
  for (const item of dossier.merch ?? []) {
    if (item.images?.length) {
      merch.push(item);
      continue;
    }
    const found = [];
    let credit = null;
    if (item.image && store) {
      const own = isOurImage(item.image) ? item.image : budget() ? (fetched++, await copyRemoteImage(item.image, { fetcher, store })) : null;
      if (own) found.push(own);
    }
    const itemSources = (item.sourceIds ?? []).map((id) => sources.find((s) => s.id === id)).filter(Boolean);
    for (const source of itemSources) {
      const post = byPost.get(normPost(source.url));
      if (post) {
        found.push(...post.images);
        credit ??= post.account ? `@${post.account}` : null;
      } else if (source.images?.length) found.push(...source.images.filter(isOurImage));
    }
    if (!found.length) {
      const post = posts.find((p) => p.images?.length && captionMentions(p.caption, item.name));
      if (post) {
        found.push(...post.images);
        credit = post.account ? `@${post.account}` : null;
      }
    }
    if (!found.length && store) {
      for (const source of itemSources.filter((s) => merchPages.has(s.id) && !isSocial(s.url) && s.url !== row.url)) {
        if (!pageCache.has(source.url)) {
          if (!budget()) break;
          fetched++;
          pageCache.set(source.url, await pagePicture(source.url, { fetcher, store }));
        }
        const url = pageCache.get(source.url);
        if (url) {
          found.push(url);
          credit = source.publisher ?? hostOf(source.url);
          break;
        }
      }
    }
    const images = [...new Set(found)].slice(0, 6);
    if (images.length) {
      changed = true;
      merch.push({ ...item, images, image: images[0], imageCredit: credit ?? item.imageCredit ?? null });
    } else merch.push(item);
  }
  return { image, merch, changed, fetched };
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Keeps pictures across investigations: a new draft's merch inherits what the stored one had. */
export function carryMerchImages(next = [], previous = []) {
  const key = (m) => String(m.name ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const byId = new Map(previous.map((m) => [m.id, m]));
  const byName = new Map(previous.map((m) => [key(m), m]));
  return next.map((m) => {
    const old = byId.get(m.id) ?? byName.get(key(m));
    if (!old?.images?.length || m.images?.length) return m;
    return { ...m, images: old.images, image: m.image && isOurImage(m.image) ? m.image : old.images[0], imageCredit: m.imageCredit ?? old.imageCredit ?? null };
  });
}

// ---------------------------------------------------------------------------------------------
// The worker step: a few events per tick, each retried at most every few days.
// ---------------------------------------------------------------------------------------------

const RETRY_MS = 3 * 86400_000;

/** A short fingerprint of what an event's pictures depend on (sources, merch, its posts' pictures). */
const pictureKey = (row, posts = []) =>
  createHash("sha256")
    .update(JSON.stringify([row.url, (row.dossier?.sources ?? []).map((s) => s.url), (row.dossier?.merch ?? []).map((m) => [m.name, m.image ?? null, (m.images ?? []).length]), posts.map((p) => [p.url, p.images?.length ?? 0])]))
    .digest("hex")
    .slice(0, 16);

export function needsPictures(row) {
  return !row.image?.url || (row.dossier?.merch ?? []).some((m) => !m.images?.length);
}

/**
 * Looks for pictures for up to `perTick` upcoming events that are missing some. `postsFor(id)`
 * returns that event's Instagram leads. `save(row, patch)` writes `{image, dossier}`.
 */
export async function refreshPictures(db, rows, { fetcher, store, postsFor, save, now = new Date(), perTick = 2 } = {}) {
  if (!store) return { ran: false, reason: "no picture storage (CRON_SECRET or a Blob token)" };
  const out = { ran: true, looked: 0, covers: 0, merch: 0 };
  for (const row of rows) {
    if (out.looked >= perTick) break;
    if (!needsPictures(row)) continue;
    const key = `events:pictures:${row.id}`;
    const last = await readKv(db, key, null);
    // New Instagram pictures for this event change the fingerprint, so they're used at once.
    const posts = await postsFor(row.id);
    const fingerprint = pictureKey(row, posts);
    if (last && last.key === fingerprint && now - new Date(last.at) < RETRY_MS) continue;
    out.looked++;
    const result = await picturesFor(row, { posts, fetcher, store });
    if (result.changed) {
      const before = (row.dossier?.merch ?? []).filter((m) => m.images?.length).length;
      const after = result.merch.filter((m) => m.images?.length).length;
      if (result.image && !row.image?.url) out.covers++;
      out.merch += after - before;
      const patched = { ...row, image: result.image, dossier: { ...row.dossier, merch: result.merch } };
      await save(row, { image: result.image, dossier: patched.dossier });
      await writeKv(db, key, { at: now.toISOString(), key: pictureKey(patched, posts) });
    } else await writeKv(db, key, { at: now.toISOString(), key: fingerprint });
  }
  return out;
}
