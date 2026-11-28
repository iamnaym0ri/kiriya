import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { getJson } from "../lib/http.js";
import { background } from "../lib/background.js";
import {
  TAPS,
  addMemory,
  addSticker,
  chatSummary,
  names,
  deleteMessage,
  editMessage,
  listMemories,
  MEMORY_SHELVES,
  memoryCounts,
  listMessages,
  listStickers,
  markRead,
  notePresence,
  other,
  presenceOf,
  react,
  readPrefs,
  readState,
  removeMemory,
  removeSticker,
  savePrefs,
  sendMessage,
  setTyping,
  typingOf,
  clearTyping,
  unreadMessages,
} from "../lib/chat.js";
import { ablyConfigured, realtimeToken } from "../lib/realtime.js";

// The private chat (mounted at /api/me/chat behind a kiriya/admin session) and "our memories"
// (/api/me/memories). docs/refactor/PLAN.md phase 4.
export const chatRoutes = new Hono();
export const memoryRoutes = new Hono();

const isoDate = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const role = (c) => c.get("session").role;
const fail = (c, error, fallback = "That didn’t work. Try again?") =>
  c.json({ error: error.status === 429 ? "slow_down" : "bad_request", message: error.status ? error.message : fallback }, error.status ?? 400);

// Push and live events go out after the response (lib/background.js), so sending feels instant.

for (const routes of [chatRoutes, memoryRoutes])
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    await next();
  });

chatRoutes.get("/messages", async (c) => {
  const query = z.object({ before: isoDate.optional(), after: isoDate.optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_page", message: "That page of messages couldn’t open." }, 400);
  const db = await getDb();
  const [page, reads, typing, unread, who] = await Promise.all([
    listMessages(db, query.data),
    readState(db),
    !ablyConfigured() ? typingOf(db, other(role(c))) : false,
    unreadMessages(db, role(c)),
    names(db),
  ]);
  // Josh previewing her side reads the chat by polling: a live token would let his phone speak as her.
  return c.json({ ...page, reads, typing, unread, me: role(c), names: who, live: ablyConfigured() && !c.get("session").previewBy });
});

chatRoutes.get("/summary", async (c) => {
  const db = await getDb();
  // This phone is open: note it (and its time zone) for the other one's "active" dot. Never while
  // Josh is previewing her side, or he'd show up as her.
  if (!c.get("session").previewBy) await notePresence(db, role(c), { tz: c.req.query("tz") ?? null }).catch(() => {});
  const [summary, who, presence] = await Promise.all([chatSummary(db, role(c)), names(db), presenceOf(db, other(role(c)))]);
  return c.json({ ...summary, me: role(c), names: who, presence });
});

chatRoutes.post("/messages", async (c) => {
  try {
    const db = await getDb();
    const message = await sendMessage(db, role(c), await c.req.json().catch(() => null), { after: background });
    if (!ablyConfigured()) await clearTyping(db, role(c)).catch(() => {});
    return c.json(message, 201);
  } catch (error) {
    return fail(c, error, "That message couldn’t be sent.");
  }
});

chatRoutes.patch("/messages/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "not_found", message: "That message isn’t here." }, 404);
  try {
    const message = await editMessage(await getDb(), role(c), id.data, await c.req.json().catch(() => null));
    return message ? c.json(message) : c.json({ error: "not_found", message: "Only your own words and captions can be edited." }, 404);
  } catch (error) {
    return fail(c, error, "That edit didn’t save.");
  }
});

chatRoutes.delete("/messages/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "not_found", message: "That message isn’t here." }, 404);
  return (await deleteMessage(await getDb(), role(c), id.data, { after: background }))
    ? c.json({ ok: true })
    : c.json({ error: "not_found", message: "Only your own messages can be deleted." }, 404);
});

chatRoutes.put("/messages/:id/reaction", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  const body = z.object({ emoji: z.string().min(1).max(16).nullable() }).strict().safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: "bad_reaction", message: "That reaction didn’t stick." }, 400);
  const result = await react(await getDb(), role(c), id.data, body.data.emoji);
  return result ? c.json(result) : c.json({ error: "not_found", message: "That message isn’t here." }, 404);
});

chatRoutes.post("/read", async (c) => c.json(await markRead(await getDb(), role(c))));

// Polling fallback only: with Ably, typing travels straight between the two phones.
chatRoutes.post("/typing", async (c) => {
  const body = z.object({ stop: z.boolean().optional() }).strict().safeParse((await c.req.json().catch(() => null)) ?? {});
  const db = await getDb();
  if (body.success && body.data.stop) await clearTyping(db, role(c));
  else await setTyping(db, role(c));
  return c.json({ ok: true });
});

chatRoutes.get("/realtime", async (c) => {
  if (c.get("session").previewBy) return c.json({ error: "preview", message: "Live chat is off while you peek at her side." }, 403);
  if (!ablyConfigured()) return c.json({ error: "not_configured", message: "Live chat isn’t set up; checking every few seconds instead." }, 503);
  return c.json(await realtimeToken(role(c)));
});

// The wallpaper links ride along so the iPhone app receives them signed (see lib/mediaLinks.js).
const WALLPAPER_LINKS = { miku: "/api/uploads/wallpapers/miku?v=1", maomao: "/api/uploads/wallpapers/maomao?v=2" };
chatRoutes.get("/prefs", async (c) => c.json({ ...(await readPrefs(await getDb(), role(c))), wallpapers: WALLPAPER_LINKS }));
chatRoutes.put("/prefs", async (c) => {
  try {
    return c.json({ ...(await savePrefs(await getDb(), role(c), await c.req.json().catch(() => null))), wallpapers: WALLPAPER_LINKS });
  } catch (error) {
    return fail(c, error, "That look couldn’t be saved.");
  }
});

chatRoutes.get("/taps", (c) => c.json({ taps: TAPS }));

chatRoutes.get("/stickers", async (c) => c.json({ stickers: await listStickers(await getDb()) }));
chatRoutes.post("/stickers", async (c) => {
  try {
    return c.json(await addSticker(await getDb(), role(c), (await c.req.json().catch(() => null)) ?? {}), 201);
  } catch (error) {
    return fail(c, error, "That sticker couldn’t be added.");
  }
});
chatRoutes.delete("/stickers/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  return id.success && (await removeSticker(await getDb(), id.data)) ? c.json({ ok: true }) : c.json({ error: "not_found", message: "That sticker isn’t here." }, 404);
});

// ---------- GIFs (GIPHY), searched server-side so the key never reaches the phone ----------

const gifCache = new Map();
const GIF_TTL = 10 * 60 * 1000;
const giphyKey = () => process.env.GIPHY_API_KEY;
const GIF_PAGE = 24;
const MP4_BUDGET = 3_000_000; // bytes: GIPHY's full-size mp4 is crisp and still light; past this, a smaller one
const WEBP_BUDGET = 2_500_000;
const size = (value) => Number(value) || Infinity;
/**
 * The renditions the chat uses (GIPHY's rendition guide): in a message, the full-size MP4 played as a
 * muted looping video (sharp, and a fraction of the GIF's weight) with a 480w still as its poster;
 * in the picker, the 200w animated WebP. The full GIF is never used.
 */
export function gifShape(gif) {
  const images = gif.images ?? {};
  const original = images.original ?? {};
  const fixed = images.fixed_width ?? {};
  const small = images.downsized_small ?? {};
  const mp4 = original.mp4 && size(original.mp4_size) <= MP4_BUDGET ? original.mp4 : small.mp4 || fixed.mp4 || original.mp4 || null;
  const webp = original.webp && size(original.webp_size) <= WEBP_BUDGET ? original.webp : fixed.webp || null;
  return {
    id: gif.id,
    title: gif.title ?? "",
    // `url` stays a plain image for anything that can only show an <img> (memories, old builds).
    url: webp ?? fixed.url ?? original.url,
    mp4,
    still: images["480w_still"]?.url ?? images.original_still?.url ?? images.fixed_width_still?.url ?? null,
    width: Number(original.width) || Number(fixed.width) || null,
    height: Number(original.height) || Number(fixed.height) || null,
    preview: {
      url: fixed.webp ?? fixed.url ?? null,
      still: images.fixed_width_still?.url ?? null,
      width: Number(fixed.width) || null,
      height: Number(fixed.height) || null,
    },
  };
}

// Local development has no GIPHY key: a fixed page shaped exactly like GIPHY's responses
// (real public media.giphy.com renditions) stands in, so the picker and bubbles can be built.
async function devFixture(q, offset) {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile(new URL("../../scripts/fixtures/giphy-search.json", import.meta.url), "utf8"));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = words.length ? data.data.filter((gif) => words.some((word) => gif.title.toLowerCase().includes(word))) : data.data;
  const list = (all.length ? all : data.data).slice(offset, offset + GIF_PAGE);
  return { data: list, pagination: { count: list.length, offset, total_count: all.length } };
}

chatRoutes.get("/gifs", async (c) => {
  const dev = !giphyKey() && process.env.NODE_ENV !== "production";
  if (!giphyKey() && !dev) return c.json({ error: "not_configured", message: "GIF search isn’t set up yet." }, 503);
  const query = z.object({ q: z.string().trim().max(60).optional(), offset: z.coerce.number().int().min(0).max(450).optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_search", message: "That search didn’t work." }, 400);
  const { q = "", offset = 0 } = query.data;
  const key = `${q.toLowerCase()}|${offset}`;
  const hit = gifCache.get(key);
  if (hit && Date.now() - hit.at < GIF_TTL) return c.json(hit.value);
  const url = new URL(q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending");
  url.searchParams.set("api_key", giphyKey() ?? "");
  url.searchParams.set("limit", String(GIF_PAGE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  if (q) url.searchParams.set("q", q);
  try {
    const data = dev ? await devFixture(q, offset) : await getJson(url.href, { timeoutMs: 8000 });
    const value = { gifs: (data.data ?? []).map(gifShape).filter((g) => g.url), next: (data.pagination?.count ?? 0) === GIF_PAGE ? offset + GIF_PAGE : null };
    if (gifCache.size > 200) gifCache.clear();
    if (!dev) gifCache.set(key, { at: Date.now(), value });
    return c.json(value);
  } catch {
    return c.json({ error: "gifs_down", message: "GIFs couldn’t load just now." }, 502);
  }
});

// ---------- our memories ----------

memoryRoutes.get("/", async (c) => {
  const query = z.object({ before: isoDate.optional(), shelf: z.enum(Object.keys(MEMORY_SHELVES)).optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_page", message: "That page couldn’t open." }, 400);
  const db = await getDb();
  const [page, counts] = await Promise.all([listMemories(db, query.data), query.data.before ? null : memoryCounts(db)]);
  return c.json({ ...page, ...(counts ? { counts } : {}) });
});
memoryRoutes.post("/", async (c) => {
  try {
    return c.json(await addMemory(await getDb(), role(c), (await c.req.json().catch(() => null)) ?? {}), 201);
  } catch (error) {
    return fail(c, error, "That couldn’t be saved to your memories.");
  }
});
memoryRoutes.delete("/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  return id.success && (await removeMemory(await getDb(), id.data, { after: background })) ? c.json({ ok: true }) : c.json({ error: "not_found", message: "That memory isn’t here." }, 404);
});

