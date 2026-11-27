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
  listMemories,
  listMessages,
  listStickers,
  markRead,
  other,
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
  return c.json({ ...page, reads, typing, unread, me: role(c), names: who, live: ablyConfigured() });
});

chatRoutes.get("/summary", async (c) => {
  const db = await getDb();
  return c.json({ ...(await chatSummary(db, role(c))), me: role(c), names: await names(db) });
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

chatRoutes.delete("/messages/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "not_found", message: "That message isn’t here." }, 404);
  return (await deleteMessage(await getDb(), role(c), id.data))
    ? c.json({ ok: true })
    : c.json({ error: "not_found", message: "Only your own messages can be unsent." }, 404);
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
  await setTyping(await getDb(), role(c));
  return c.json({ ok: true });
});

chatRoutes.get("/realtime", async (c) => {
  if (!ablyConfigured()) return c.json({ error: "not_configured", message: "Live chat isn’t set up; checking every few seconds instead." }, 503);
  return c.json(await realtimeToken(role(c)));
});

// The wallpaper links ride along so the iPhone app receives them signed (see lib/mediaLinks.js).
const WALLPAPER_LINKS = { miku: "/api/uploads/wallpapers/miku?v=1", maomao: "/api/uploads/wallpapers/maomao?v=1" };
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
const gifShape = (gif) => ({
  id: gif.id,
  title: gif.title ?? "",
  url: gif.images?.fixed_width?.url ?? gif.images?.original?.url,
  still: gif.images?.fixed_width_still?.url ?? null,
  width: Number(gif.images?.fixed_width?.width) || null,
  height: Number(gif.images?.fixed_width?.height) || null,
});
chatRoutes.get("/gifs", async (c) => {
  if (!giphyKey()) return c.json({ error: "not_configured", message: "GIF search isn’t set up yet." }, 503);
  const query = z.object({ q: z.string().trim().max(60).optional(), offset: z.coerce.number().int().min(0).max(450).optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_search", message: "That search didn’t work." }, 400);
  const { q = "", offset = 0 } = query.data;
  const key = `${q.toLowerCase()}|${offset}`;
  const hit = gifCache.get(key);
  if (hit && Date.now() - hit.at < GIF_TTL) return c.json(hit.value);
  const url = new URL(q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending");
  url.searchParams.set("api_key", giphyKey());
  url.searchParams.set("limit", "24");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  if (q) url.searchParams.set("q", q);
  try {
    const data = await getJson(url.href, { timeoutMs: 8000 });
    const value = { gifs: (data.data ?? []).map(gifShape).filter((g) => g.url), next: (data.pagination?.count ?? 0) === 24 ? offset + 24 : null };
    if (gifCache.size > 200) gifCache.clear();
    gifCache.set(key, { at: Date.now(), value });
    return c.json(value);
  } catch {
    return c.json({ error: "gifs_down", message: "GIFs couldn’t load just now." }, 502);
  }
});

// ---------- our memories ----------

memoryRoutes.get("/", async (c) => {
  const query = z.object({ before: isoDate.optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_page", message: "That page couldn’t open." }, 400);
  return c.json(await listMemories(await getDb(), query.data));
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
  return id.success && (await removeMemory(await getDb(), id.data)) ? c.json({ ok: true }) : c.json({ error: "not_found", message: "That memory isn’t here." }, 404);
});

