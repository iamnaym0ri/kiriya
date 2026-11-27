// The Apify Instagram trigger (owner's choice, 2026-11-24, aware Meta's terms forbid scraping).
// A few times a day Apify's Instagram scraper returns the newest posts of the watched accounts. A new
// post is only a trigger: it is queued for triage, and the investigation gathers everything else.
// Post pictures are copied to our private storage at once (lib/events/images.js), because
// Instagram's media links expire.
import { and, desc, eq } from "drizzle-orm";
import { schema } from "../../db/client.js";
import { sourceHttp } from "../../feeds/http.js";
import { blobOps } from "../../feeds/storage.js";
import { prefilterMatch } from "./fandoms.js";
import { imageStore, isOurImage } from "./images.js";
import { INSTAGRAM_ACCOUNTS } from "./registry.js";
import { USER_AGENT } from "./robots.js";
import { enqueueSignal, readKv, sha, updateSignal, writeKv } from "./store.js";

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

/**
 * Copies a post's pictures to our storage (`store` from lib/events/images.js imageStore: Blob, or the
 * site's API). Returns our links, in the post's order. A picture that can't be copied is left out.
 */
export async function copyImages(post, { store, send, deadline = Date.now() + 60_000 } = {}) {
  if (!store) return [];
  const urls = [];
  for (const url of post.images) {
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
      urls.push(await store.put(r.buffer));
    } catch {
      // The caption still triggers; the picture may come from another post or page.
    }
  }
  return urls;
}

/** The worker's picture store: a Blob token if it has one, else the site's API (CRON_SECRET). */
export async function workerImageStore({ apiOrigin = process.env.EVENTS_API_ORIGIN || "https://kiriya.love", cronSecret = process.env.CRON_SECRET, post } = {}) {
  const blob = await blobOps();
  return imageStore({ blob, apiOrigin: apiOrigin.replace(/\/$/, ""), cronSecret, post });
}

const BACKFILL_DAYS = 21;

/**
 * Checks Instagram (when due) and queues one signal per new post, with its pictures copied. The first
 * run after pictures were switched on also looks back three weeks, a few posts deeper, and fills in
 * the pictures of posts it had already queued without them (no new signals, no extra run).
 * `fetch` and `store` are injectable. Returns `{ran, posts, queued, pictures, reason}`.
 */
export async function checkInstagram(db, { token = process.env.APIFY_TOKEN, everyHours = Number(process.env.EVENTS_INSTAGRAM_EVERY_HOURS) || 8, now = new Date(), fetch = fetchPosts, store, blob, send } = {}) {
  if (!token) return { ran: false, reason: "no APIFY_TOKEN" };
  const state = await readKv(db, STATE_KEY, { seen: [], lastRunAt: null });
  if (state.lastRunAt && now - new Date(state.lastRunAt) < everyHours * 3600_000) return { ran: false, reason: "not due" };
  const pictures = store !== undefined ? store : blob ? imageStore({ blob }) : await workerImageStore();
  const backfill = Boolean(pictures) && !state.picturesSince;
  const since = backfill ? new Date(now - BACKFILL_DAYS * 86400_000).toISOString() : (state.lastRunAt ?? new Date(now - 7 * 86400_000).toISOString());
  await writeKv(db, STATE_KEY, { ...state, lastRunAt: now.toISOString() });
  const posts = await fetch({ token, since, send, ...(backfill ? { perAccount: 8 } : {}) });
  const seen = new Set(state.seen);
  let queued = 0;
  let filled = 0;
  for (const post of posts) {
    const hash = sha("instagram", post.shortCode);
    if (seen.has(post.shortCode)) {
      // Seen before pictures were stored: fill them in on the signal it made, if any.
      if (!backfill) continue;
      const [old] = await db.select().from(schema.eventSignals).where(eq(schema.eventSignals.hash, hash));
      if (!old || old.payload?.images?.length) continue;
      const images = await copyImages(post, { store: pictures, send });
      if (images.length) {
        await updateSignal(db, old.id, { payload: { ...old.payload, images, remoteImages: post.images } });
        filled++;
      }
      continue;
    }
    seen.add(post.shortCode);
    // Every post of a watched account is a lead, but plain promos without event words are skipped.
    if (!prefilterMatch(post.caption) && !/singapore|\bsg\b|suntec|expo|mbs|jewel|vivocity|scape/i.test(post.caption)) continue;
    const images = await copyImages(post, { store: pictures, send });
    const { created } = await enqueueSignal(db, {
      origin: "instagram",
      sourceId: `ig:${post.account ?? "unknown"}`,
      url: post.url,
      title: `@${post.account ?? "instagram"}: ${post.caption.split("\n")[0].slice(0, 120)}`,
      excerpt: post.caption,
      // images: our copies (shown on the event and its merch); remoteImages: Instagram's own links,
      // read by the investigation while they still work.
      payload: { caption: post.caption, postedAt: post.postedAt, account: post.account, images, remoteImages: post.images },
      hash,
    });
    if (created) queued++;
  }
  await writeKv(db, STATE_KEY, { seen: [...seen].slice(-600), lastRunAt: now.toISOString(), lastPosts: posts.length, picturesSince: state.picturesSince ?? (pictures ? now.toISOString() : null) });
  return { ran: true, posts: posts.length, queued, pictures: pictures ? pictures.via : "none", ...(backfill ? { backfilled: filled } : {}) };
}

/** An event's Instagram leads with their stored pictures, newest first. */
export async function postsForEvent(db, eventId) {
  const rows = await db
    .select({ url: schema.eventSignals.url, payload: schema.eventSignals.payload, createdAt: schema.eventSignals.createdAt })
    .from(schema.eventSignals)
    .where(and(eq(schema.eventSignals.origin, "instagram"), eq(schema.eventSignals.eventId, eventId)))
    .orderBy(desc(schema.eventSignals.createdAt))
    .limit(20);
  return rows.map((r) => ({ url: r.url, account: r.payload?.account ?? null, caption: r.payload?.caption ?? "", images: (r.payload?.images ?? []).filter(isOurImage) }));
}

/**
 * A post picture for the investigation (base64): Instagram's own link while it still works, else our
 * Blob copy when this process can read Blob.
 */
export async function loadSignalImage(ref, { send } = {}) {
  if (/^https:\/\//.test(ref)) {
    const host = new URL(ref).hostname.toLowerCase();
    if (!IMAGE_HOSTS.test(host)) return null;
    const http = sourceHttp({ id: "events-ig-read", hosts: [host], mediaHosts: [host], maxRequests: 1, maxBytes: 4 * 1024 * 1024, paceMs: 0, timeoutMs: 15_000 }, { deadline: Date.now() + 20_000, send });
    const r = await http.image(ref);
    return { contentType: r.contentType, data: r.buffer.toString("base64") };
  }
  const { blobOptions, blobReadConfigured } = await import("../blob.js");
  if (!blobReadConfigured()) return null;
  const { get } = await import("@vercel/blob");
  const result = await get(ref, { access: "private", ...blobOptions() });
  if (!result) return null;
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { contentType: result.blob.contentType ?? "image/jpeg", data: buffer.toString("base64") };
}
/** Old name, kept for callers. */
export const loadBlobImage = loadSignalImage;
