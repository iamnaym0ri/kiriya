// The Apify Instagram trigger (owner's choice, 2026-11-24, aware Meta's terms forbid scraping).
// A few times a day Apify's Instagram scraper returns the newest posts of the watched accounts. A new
// post is only a trigger: it is queued for triage, and the investigation gathers everything else.
// Post images are copied to our private Blob at once, because Instagram's media links expire.
import { sourceHttp } from "../../feeds/http.js";
import { blobOps } from "../../feeds/storage.js";
import { prefilterMatch } from "./fandoms.js";
import { INSTAGRAM_ACCOUNTS } from "./registry.js";
import { USER_AGENT } from "./robots.js";
import { enqueueSignal, readKv, sha, writeKv } from "./store.js";

export const APIFY_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-scraper";
const STATE_KEY = "events:instagram";
const IMAGE_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
const MAX_IMAGES = 3;

/** Apify dataset items → our post shape. Tolerates both the scraper's and the post scraper's fields. */
export function readPosts(items = []) {
  return [items]
    .flat()
    .filter((i) => i && (i.shortCode || i.shortcode || i.url))
    .map((i) => {
      const shortCode = i.shortCode ?? i.shortcode ?? String(i.url).match(/\/(?:p|reel)\/([\w-]+)/)?.[1];
      const images = [i.displayUrl, ...(i.images ?? []), ...(i.childPosts ?? []).map((c) => c.displayUrl)].filter((u) => typeof u === "string" && /^https:\/\//.test(u));
      return {
        shortCode,
        url: i.url ?? `https://www.instagram.com/p/${shortCode}/`,
        account: i.ownerUsername ?? i.owner?.username ?? null,
        caption: String(i.caption ?? "").slice(0, 2200),
        postedAt: i.timestamp ?? i.takenAtTimestamp ?? null,
        type: i.type ?? null,
        images: [...new Set(images)].slice(0, MAX_IMAGES),
      };
    })
    .filter((p) => p.shortCode);
}

/** One synchronous actor run for all accounts (newest few posts each). */
export async function fetchPosts({ token, accounts = INSTAGRAM_ACCOUNTS, since, perAccount = 3, send, deadline = Date.now() + 5 * 60_000 }) {
  const http = sourceHttp({ id: "events-apify", hosts: ["api.apify.com"], mediaHosts: [], maxRequests: 2, maxBytes: 8 * 1024 * 1024, paceMs: 0, timeoutMs: 280_000 }, { deadline, send });
  const input = {
    directUrls: accounts.map((a) => `https://www.instagram.com/${a.handle}/`),
    resultsType: "posts",
    resultsLimit: perAccount,
    ...(since ? { onlyPostsNewerThan: since.slice(0, 10) } : {}),
    addParentData: false,
  };
  const items = await http.json(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?format=json&clean=true`, {
    method: "POST",
    body: JSON.stringify(input),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": USER_AGENT },
  });
  return readPosts(items);
}

/** Copies a post's pictures to Blob (events/ig-<code>-<n>.jpg). Returns the stored paths. */
export async function copyImages(post, { blob, send, deadline = Date.now() + 60_000 } = {}) {
  if (!blob) return [];
  const paths = [];
  for (const [n, url] of post.images.entries()) {
    let host;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!IMAGE_HOSTS.test(host)) continue;
    try {
      const http = sourceHttp({ id: "events-ig-image", hosts: [host], mediaHosts: [host], maxRequests: 1, maxBytes: 4 * 1024 * 1024, paceMs: 0, timeoutMs: 20_000 }, { deadline, send });
      const r = await http.image(url);
      const ext = r.contentType === "image/png" ? "png" : r.contentType === "image/webp" ? "webp" : "jpg";
      const pathname = `events/ig-${post.shortCode.replace(/[^\w-]/g, "")}-${n}.${ext}`;
      await blob.put(pathname, r.buffer, r.contentType).catch((error) => {
        if (!/exist/i.test(error?.message ?? "")) throw error;
      });
      paths.push(pathname);
    } catch {
      // A picture that can't be copied is left out; the caption still triggers.
    }
  }
  return paths;
}

export const mediaUrl = (pathname) => `/api/uploads/media?path=${encodeURIComponent(pathname)}`;

/**
 * Checks Instagram (when due) and queues one signal per new post. `fetch` and `blob` are injectable.
 * Returns `{ran, posts, queued, reason}`.
 */
export async function checkInstagram(db, { token = process.env.APIFY_TOKEN, everyHours = Number(process.env.EVENTS_INSTAGRAM_EVERY_HOURS) || 8, now = new Date(), fetch = fetchPosts, blob, send } = {}) {
  if (!token) return { ran: false, reason: "no APIFY_TOKEN" };
  const state = await readKv(db, STATE_KEY, { seen: [], lastRunAt: null });
  if (state.lastRunAt && now - new Date(state.lastRunAt) < everyHours * 3600_000) return { ran: false, reason: "not due" };
  const since = state.lastRunAt ?? new Date(now - 7 * 86400_000).toISOString();
  await writeKv(db, STATE_KEY, { ...state, lastRunAt: now.toISOString() });
  const posts = await fetch({ token, since, send });
  const seen = new Set(state.seen);
  const store = blob === undefined ? await blobOps() : blob;
  let queued = 0;
  for (const post of posts) {
    if (seen.has(post.shortCode)) continue;
    seen.add(post.shortCode);
    // Every post of a watched account is a lead, but plain promos without event words are skipped.
    if (!prefilterMatch(post.caption) && !/singapore|\bsg\b|suntec|expo|mbs|jewel|vivocity|scape/i.test(post.caption)) continue;
    const blobPaths = await copyImages(post, { blob: store, send });
    const { created } = await enqueueSignal(db, {
      origin: "instagram",
      sourceId: `ig:${post.account ?? "unknown"}`,
      url: post.url,
      title: `@${post.account ?? "instagram"}: ${post.caption.split("\n")[0].slice(0, 120)}`,
      excerpt: post.caption,
      payload: { caption: post.caption, postedAt: post.postedAt, account: post.account, blobPaths, images: blobPaths.map(mediaUrl) },
      hash: sha("instagram", post.shortCode),
    });
    if (created) queued++;
  }
  await writeKv(db, STATE_KEY, { seen: [...seen].slice(-600), lastRunAt: now.toISOString(), lastPosts: posts.length });
  return { ran: true, posts: posts.length, queued };
}

/** Reads a copied picture back from Blob for the investigation (base64). */
export async function loadBlobImage(pathname) {
  const { blobOptions, blobReadConfigured } = await import("../blob.js");
  if (!blobReadConfigured()) return null;
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, { access: "private", ...blobOptions() });
  if (!result) return null;
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { contentType: result.blob.contentType ?? "image/jpeg", data: buffer.toString("base64") };
}
