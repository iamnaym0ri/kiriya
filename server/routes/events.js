// Events & merch API (phase 6). Contract: docs/refactor/EVENTS-API.md.
//   /api/events/*         her and Josh (Josh sees exactly what she sees; his saves are previews)
//   /api/admin/events/*   Josh only: paste-a-link, the spend ledger, worker status, hide/refresh
//   /api/jobs/events/*    the Railway worker (Bearer CRON_SECRET): push delivery
// The API only reads what the worker stored; it never calls Claude, Apify, NEA or LTA itself.
import { Hono } from "hono";
import { z } from "zod";
import { requireRole } from "../auth/session.js";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { localDay } from "../lib/time.js";
import { eventCard, eventDetail, filterRows, meBlock, merchDetail, presentMerch } from "../lib/events/present.js";
import { aliasMap, getEventRow, getSignal, listEventRows, logFor, mergeEvent, readMe, readSetting, recentLog, resolveEventRow, signalCounts, signalsByOrigin, updateMe, enqueueSignal, sha } from "../lib/events/store.js";
import { MAX_IMAGE_BYTES, storeImageBytes } from "../lib/events/images.js";
import { fixtureArt, fixturesAllowed, seedFixtures } from "../lib/events/fixtures.js";
import { eventIcs } from "../lib/events/ics.js";
import { LINK_MESSAGES, pasteLink, presentLink } from "../lib/events/links.js";
import { setCeiling, spendReport } from "../lib/events/spend.js";
import { deliverEventPushes } from "../lib/events/push.js";
import { KINDS } from "../lib/events/dossier.js";

const friendly = (c, status, error, message) => c.json({ error, message }, status);

function withErrors(app, tag) {
  app.onError((error, c) => {
    if (error instanceof z.ZodError) return friendly(c, 400, "invalid_input", "Check the submitted fields.");
    if (error?.code === "invalid_link") return friendly(c, 400, "invalid_link", "That doesn't look like a web link.");
    console.error(`[${tag}]`, error.name, error.message?.slice(0, 200));
    return friendly(c, 500, "events_unavailable", "Events are taking a little nap. Try again in a moment.");
  });
  return app;
}

async function db() {
  const handle = await getDb();
  // Local development gets the sample events until the worker has stored real ones.
  if (fixturesAllowed() && !globalThis.__kiriyaEventFixtures) {
    globalThis.__kiriyaEventFixtures = seedFixtures(handle).catch((error) => {
      globalThis.__kiriyaEventFixtures = undefined;
      throw error;
    });
  }
  if (globalThis.__kiriyaEventFixtures) await globalThis.__kiriyaEventFixtures;
  return handle;
}

const today = () => localDay();
const role = (c) => c.get("session").role;
const isKiriya = (c) => role(c) === "kiriya";
const isAdmin = (c) => role(c) === "admin";
const listParam = (value) => (value ? String(value).split(",").map((v) => v.trim()).filter(Boolean).slice(0, 12) : []);
const idParam = (c) => z.string().min(1).max(200).parse(c.req.param("id"));
async function body(c, schema) {
  let json;
  try {
    json = await c.req.json();
  } catch {
    json = {};
  }
  return schema.parse(json ?? {});
}

// ---------------------------------------------------------------------------------------------
// /api/events
// ---------------------------------------------------------------------------------------------

export const eventRoutes = withErrors(new Hono(), "events");

// Public: "Add to Calendar". The app opens this URL and iOS shows its calendar sheet, which can't
// carry the session, so it answers without one. Public facts only (lib/events/ics.js publicEvent).
eventRoutes.get("/:id/calendar.ics", async (c) => {
  const handle = await db();
  const { row } = await resolveEventRow(handle, idParam(c));
  if (!row || row.status === "hidden" || row.tier !== "sg") return friendly(c, 404, "event_not_found", "That event isn't here anymore.");
  const detail = eventDetail(row, { today: today(), me: null, log: [] });
  const ics = await eventIcs(detail);
  const filename = `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}.ics`;
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, max-age=300",
  });
});

// Development only: the sample events' placeholder pictures.
eventRoutes.get("/fixture-art/:name", (c) => {
  if (!fixturesAllowed()) return friendly(c, 404, "not_found", "Nothing lives at this address.");
  const name = c.req.param("name").replace(/\.svg$/, "");
  return c.body(fixtureArt(name), 200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
});

eventRoutes.use("*", requireRole("kiriya", "admin"));
eventRoutes.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.get("Cache-Control")) c.header("Cache-Control", "private, no-store");
});

const ListQuery = z.object({
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

eventRoutes.get("/", async (c) => {
  const handle = await db();
  const query = ListQuery.parse({ when: c.req.query("when") ?? undefined, limit: c.req.query("limit") ?? undefined });
  const kinds = listParam(c.req.query("kind")).filter((k) => KINDS.includes(k));
  const fandoms = listParam(c.req.query("fandom"));
  const saved = c.req.query("saved") === "1";
  const day = today();
  const me = await readMe(handle);
  const rows = await listEventRows(handle);
  const { rows: picked, filters } = filterRows(rows, { when: query.when, kinds, fandoms, saved, me, today: day });
  const shown = picked.slice(0, query.limit);
  const log = await logFor(handle, shown.map((r) => r.id));
  const events = shown.map((row) => eventCard(row, { today: day, me, log }));
  return c.json({ events, filters, me: meBlock(me, role(c)), today: day, updatedAt: latest(events) });
});

const latest = (cards) => cards.map((e) => e.updatedAt).filter(Boolean).sort().at(-1) ?? null;

/** The home section's events & merch block. */
eventRoutes.get("/home", async (c) => {
  const handle = await db();
  const day = today();
  const me = await readMe(handle);
  const rows = await listEventRows(handle);
  const { rows: upcoming } = filterRows(rows, { when: "upcoming", me, today: day });
  const log = await logFor(handle, upcoming.map((r) => r.id));
  const cards = upcoming.map((row) => eventCard(row, { today: day, me, log }));
  const onNow = cards.filter((e) => e.status === "on_now");
  const dated = cards.filter((e) => e.status === "upcoming" && !e.datesTbc);
  const next = dated.find((e) => e.hers) ?? dated[0] ?? null;
  const since = me.lastLookedAt;
  const byId = new Map(cards.map((e) => [e.id, e]));
  // One line per event (its latest news), so one event's batch of updates can't crowd out others.
  const shown = new Set();
  const fresh = log
    .filter((entry) => byId.has(entry.eventId) && (!since || new Date(entry.at).toISOString() > since))
    .filter((entry) => !shown.has(entry.eventId) && shown.add(entry.eventId))
    .slice(0, 4)
    .map((entry) => {
      const event = byId.get(entry.eventId);
      return { id: entry.id, at: new Date(entry.at).toISOString(), kind: entry.kind, title: entry.title, text: entry.text, big: entry.big, event: { id: event.id, name: event.name, kind: event.kind, dateLabel: event.dateLabel } };
    });
  // Her fandoms' events first, then the rest; pieces with a picture and exclusives lead.
  const rank = (m) => (m.image ? 0 : 2) + (m.kind === "exclusive" || m.limited ? 0 : 1);
  const merch = [...upcoming.filter((row) => row.hers), ...upcoming.filter((row) => !row.hers)]
    .flatMap((row) => (row.dossier?.merch ?? []).map((m) => presentMerch(m, row, { today: day, me })))
    .filter((m) => m.status !== "sold_out")
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map(({ m }) => m)
    .slice(0, 6);
  return c.json({
    next,
    onNow,
    upcoming: dated.filter((e) => e.id !== next?.id).slice(0, 4),
    fresh,
    merch,
    counts: {
      upcoming: cards.length,
      unseenUpdates: cards.reduce((n, e) => n + e.unseenUpdates, 0),
      saved: Object.keys(me.saved.events).length + Object.keys(me.saved.merch).length,
    },
    me: meBlock(me, role(c)),
    today: day,
    updatedAt: latest(cards),
  });
});

/** Every merch item in upcoming (or on-now) events, plus merch drops. */
eventRoutes.get("/merch", async (c) => {
  const handle = await db();
  const day = today();
  const me = await readMe(handle);
  const fandoms = listParam(c.req.query("fandom"));
  const saved = c.req.query("saved") === "1";
  const rows = await listEventRows(handle);
  const { rows: upcoming } = filterRows(rows, { when: c.req.query("when") === "all" ? "all" : "upcoming", me, today: day });
  const merch = upcoming
    .flatMap((row) => (row.dossier?.merch ?? []).map((m) => presentMerch(m, row, { today: day, me })))
    .filter((m) => (!fandoms.length || m.fandoms.some((f) => fandoms.includes(f)) || m.event && rows.find((r) => r.id === m.event.id)?.fandoms?.some((f) => fandoms.includes(f))) && (!saved || m.saved));
  return c.json({ merch, me: meBlock(me, role(c)), today: day });
});

/** Her saved events and merch (Josh sees hers). */
eventRoutes.get("/saved", async (c) => {
  const handle = await db();
  const day = today();
  const me = await readMe(handle);
  const rows = await listEventRows(handle, { includeHidden: false });
  const byId = new Map(rows.map((r) => [r.id, r]));
  // A heart on an event that was folded into another one follows it.
  const aliases = await aliasMap(handle);
  const canonical = (id) => aliases[id] ?? id;
  const savedRows = [...new Set(Object.keys(me.saved.events).map(canonical))].map((id) => byId.get(id)).filter((r) => r && !["merged", "out_of_scope"].includes(r.status));
  const log = await logFor(handle, savedRows.map((r) => r.id));
  const events = savedRows.map((row) => eventCard(row, { today: day, me, log })).sort((a, b) => (a.startsOn ?? "9").localeCompare(b.startsOn ?? "9"));
  const merch = Object.keys(me.saved.merch)
    .map((key) => {
      const [eventId, itemId] = key.split("~");
      const row = byId.get(canonical(eventId));
      const item = row?.dossier?.merch?.find((m) => m.id === itemId);
      return item ? presentMerch(item, row, { today: day, me }) : null;
    })
    .filter(Boolean);
  return c.json({ events, merch, me: meBlock(me, role(c)), today: day });
});

const SaveBody = z.object({ saved: z.boolean().default(true) }).strict();

eventRoutes.post("/merch/:merchId/save", async (c) => {
  const merchId = z.string().min(3).max(260).parse(c.req.param("merchId"));
  const { saved } = await body(c, SaveBody);
  const handle = await db();
  const [askedEvent, itemId] = merchId.split("~");
  const { row } = askedEvent && itemId ? await resolveEventRow(handle, askedEvent) : { row: null };
  if (!row?.dossier?.merch?.some((m) => m.id === itemId)) return friendly(c, 404, "merch_not_found", "That merch isn't listed anymore.");
  const id = `${row.id}~${itemId}`;
  if (!isKiriya(c)) return c.json({ id, saved, preview: true });
  await updateMe(handle, (me) => {
    if (saved) me.saved.merch[id] = new Date().toISOString();
    else {
      delete me.saved.merch[id];
      delete me.saved.merch[merchId];
    }
    return me;
  });
  return c.json({ id, saved, preview: false });
});

/** One merch piece: pictures, price, kind and dates, and where it is (its event, venue, booth). */
eventRoutes.get("/merch/:merchId", async (c) => {
  const merchId = z.string().min(3).max(260).parse(c.req.param("merchId"));
  const handle = await db();
  const [askedEvent, itemId] = merchId.split("~");
  const { row } = askedEvent && itemId ? await resolveEventRow(handle, askedEvent) : { row: null };
  const item = row?.dossier?.merch?.find((m) => m.id === itemId);
  if (!item || row.tier !== "sg" || (row.status === "hidden" && !isAdmin(c))) return friendly(c, 404, "merch_not_found", "That merch isn't listed anymore.");
  const me = await readMe(handle);
  const merch = merchDetail(item, row, { today: today(), me });
  return c.json({ merch, ...(merch.id !== merchId ? { redirectedFrom: merchId } : {}), me: meBlock(me, role(c)) });
});

/** Moves her "last looked" mark: for one event (`eventId`), or for the whole section. */
eventRoutes.post("/seen", async (c) => {
  const { eventId = null } = await body(c, z.object({ eventId: z.string().min(1).max(200).nullable().optional() }).strict());
  const handle = await db();
  const at = new Date().toISOString();
  if (!isKiriya(c)) return c.json({ eventId, lastLookedAt: at, preview: true });
  await updateMe(handle, (me) => {
    if (eventId) me.looked[eventId] = at;
    else me.lastLookedAt = at;
    return me;
  });
  return c.json({ eventId, lastLookedAt: at, preview: false });
});

eventRoutes.get("/:id", async (c) => {
  const handle = await db();
  const asked = idParam(c);
  // Ids never die: one folded into another event answers with that event (`redirectedFrom`).
  const { row, from } = await resolveEventRow(handle, asked);
  if (!row || (row.status === "hidden" && !isAdmin(c)) || row.tier !== "sg" || row.status === "out_of_scope") return friendly(c, 404, "event_not_found", "That event isn't here anymore.");
  const me = await readMe(handle);
  const log = await logFor(handle, [row.id]);
  return c.json({ event: eventDetail(row, { today: today(), me, log, admin: isAdmin(c) }), ...(from ? { redirectedFrom: from } : {}), me: meBlock(me, role(c)) });
});

eventRoutes.post("/:id/save", async (c) => {
  const { saved } = await body(c, SaveBody);
  const handle = await db();
  const { row } = await resolveEventRow(handle, idParam(c));
  if (!row || row.status === "hidden") return friendly(c, 404, "event_not_found", "That event isn't here anymore.");
  const id = row.id;
  if (!isKiriya(c)) return c.json({ id, saved, preview: true });
  await updateMe(handle, (me) => {
    if (saved) me.saved.events[id] = new Date().toISOString();
    else delete me.saved.events[id];
    return me;
  });
  return c.json({ id, saved, preview: false });
});

// ---------------------------------------------------------------------------------------------
// /api/admin/events (mounted behind the admin guard)
// ---------------------------------------------------------------------------------------------

export const eventAdminRoutes = withErrors(new Hono(), "events-admin");
eventAdminRoutes.use("*", requireRole("admin"));
eventAdminRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

eventAdminRoutes.post("/links", async (c) => {
  const input = await body(c, z.object({ url: z.string().min(4).max(1200), note: z.string().trim().max(300).nullable().optional() }).strict());
  const handle = await db();
  const { signal, created } = await pasteLink(handle, { url: input.url, note: input.note ?? null });
  return c.json({ ...presentLink(signal), created }, created ? 201 : 200);
});

eventAdminRoutes.get("/links", async (c) => {
  const handle = await db();
  const links = (await signalsByOrigin(handle, "link", { limit: 30 })).map(presentLink);
  return c.json({ links, statuses: LINK_MESSAGES });
});

eventAdminRoutes.get("/links/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const signal = await getSignal(await db(), id);
  if (!signal || signal.origin !== "link") return friendly(c, 404, "link_not_found", "That link isn't in the queue.");
  return c.json(presentLink(signal));
});

eventAdminRoutes.get("/spend", async (c) => c.json(await spendReport(await db())));

eventAdminRoutes.put("/spend", async (c) => {
  const { ceilingUsd } = await body(c, z.object({ ceilingUsd: z.number().min(0).max(20) }).strict());
  const handle = await db();
  await setCeiling(handle, ceilingUsd);
  return c.json(await spendReport(handle));
});

/** What the worker is doing: last heartbeat, queue, sources and their last check. */
eventAdminRoutes.get("/status", async (c) => {
  const handle = await db();
  const worker = await readSetting(handle, "events_worker", null);
  const sources = await readSetting(handle, "events_sources_status", { sources: [] });
  const fresh = worker?.lastTickAt && Date.now() - Date.parse(worker.lastTickAt) < 3 * 3600_000;
  return c.json({
    worker: worker ? { ...worker, healthy: Boolean(fresh) } : { healthy: false, lastTickAt: null, message: "the worker hasn't checked in yet" },
    queue: await signalCounts(handle),
    sources: sources.sources ?? [],
    // The latest research failures with their error, so a broken key or request shows here.
    recentFailures: (await handle.select({ id: schema.eventSignals.id, origin: schema.eventSignals.origin, title: schema.eventSignals.title, message: schema.eventSignals.message, attempts: schema.eventSignals.attempts, updatedAt: schema.eventSignals.updatedAt })
      .from(schema.eventSignals).where(eq(schema.eventSignals.status, "failed")).orderBy(desc(schema.eventSignals.updatedAt)).limit(8)),
    recentUpdates: (await recentLog(handle, { limit: 15 })).map((e) => ({ id: e.id, eventId: e.eventId, at: new Date(e.at).toISOString(), kind: e.kind, title: e.title, push: e.push, pushedAt: e.pushedAt ? new Date(e.pushedAt).toISOString() : null })),
  });
});

/** After a fix (a key, a bad request): puts every failed research item back in the queue. */
eventAdminRoutes.post("/retry-failed", async (c) => {
  const handle = await db();
  const rows = await handle
    .update(schema.eventSignals)
    .set({ status: "queued", attempts: 0, message: "back in the queue", updatedAt: new Date() })
    .where(eq(schema.eventSignals.status, "failed"))
    .returning({ id: schema.eventSignals.id });
  return c.json({ requeued: rows.length });
});

eventAdminRoutes.patch("/:id", async (c) => {
  const id = idParam(c);
  const input = await body(c, z.object({ hidden: z.boolean().optional(), hers: z.boolean().optional(), big: z.boolean().optional() }).strict());
  const handle = await db();
  const row = await getEventRow(handle, id);
  if (!row) return friendly(c, 404, "event_not_found", "That event isn't here.");
  const status = input.hidden === true ? "hidden" : input.hidden === false && row.status === "hidden" ? "upcoming" : row.status;
  await handle
    .update(schema.events)
    .set({ status, hers: input.hers ?? row.hers, big: input.big ?? row.big, updatedAt: new Date() })
    .where(eq(schema.events.id, id));
  const next = await getEventRow(handle, id);
  return c.json({ event: eventDetail(next, { today: today(), me: await readMe(handle), log: await logFor(handle, [id]), admin: true }) });
});

/** Folds a duplicate into the event it repeats; its id keeps opening that event. */
eventAdminRoutes.post("/:id/merge", async (c) => {
  const id = idParam(c);
  const { into } = await body(c, z.object({ into: z.string().min(1).max(200) }).strict());
  const handle = await db();
  const { row: target } = await resolveEventRow(handle, into);
  const row = await getEventRow(handle, id);
  if (!row || !target || target.id === id) return friendly(c, 404, "event_not_found", "Pick two different events.");
  await mergeEvent(handle, id, target.id, { reason: "merged by josh" });
  return c.json({ id, into: target.id });
});

/** Asks the worker to look into an event again (new details, a rumour to confirm). */
eventAdminRoutes.post("/:id/refresh", async (c) => {
  const id = idParam(c);
  const handle = await db();
  const row = await getEventRow(handle, id);
  if (!row) return friendly(c, 404, "event_not_found", "That event isn't here.");
  const { signal } = await enqueueSignal(handle, { origin: "refresh", eventId: id, url: row.url, title: row.name, by: "admin", hash: sha("refresh", id, new Date().toISOString().slice(0, 13)) });
  return c.json({ id: signal.id, status: signal.status, eventId: id }, 202);
});

// ---------------------------------------------------------------------------------------------
// /api/jobs/events (the worker; push keys stay in Vercel)
// ---------------------------------------------------------------------------------------------

export const eventJobRoutes = withErrors(new Hono(), "events-jobs");

// The worker hands over event and merch pictures (it has no storage key of its own); they're stored
// with every other private upload (the `events` folder) and served by /api/uploads/media.
eventJobRoutes.post("/images", async (c) => {
  if (!env.cronSecret || c.req.header("authorization") !== `Bearer ${env.cronSecret}`) return friendly(c, 401, "unauthorized", "Not allowed.");
  const type = (c.req.header("content-type") ?? "").split(";")[0].trim();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return friendly(c, 415, "bad_type", "Pictures only (JPEG, PNG or WebP).");
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) return friendly(c, 413, "too_big", "Pictures can be up to 4 MB.");
  const buffer = Buffer.from(await c.req.arrayBuffer());
  try {
    const { blobOps } = await import("../feeds/storage.js");
    const path = await import("node:path");
    const stored = await storeImageBytes(buffer, { blob: await blobOps(), localDir: path.resolve(".data/uploads"), isProd: env.isProd });
    return c.json(stored, 201);
  } catch (error) {
    if (error.code === "not_an_image") return friendly(c, 415, "bad_type", "That isn't a picture.");
    if (error.code === "too_big") return friendly(c, 413, "too_big", "Pictures can be up to 4 MB.");
    if (error.code === "not_configured") return friendly(c, 503, "not_configured", "File storage isn't connected yet.");
    throw error;
  }
});
eventJobRoutes.post("/deliver", async (c) => {
  if (!env.cronSecret || c.req.header("authorization") !== `Bearer ${env.cronSecret}`) return friendly(c, 401, "unauthorized", "Not allowed.");
  const input = await body(c, z.object({ digest: z.boolean().optional() }).strict());
  const result = await deliverEventPushes(await getDb(), { digest: Boolean(input.digest) });
  return c.json(result);
});

