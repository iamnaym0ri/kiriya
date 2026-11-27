// Database reads and writes for the events engine. The API reads; the worker writes.
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "../../db/client.js";

const rowsOf = (result) => (Array.isArray(result) ? result : (result?.rows ?? []));
export const sha = (...parts) => createHash("sha256").update(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p ?? null))).join("\u0000")).digest("hex");

// ---------------------------------------------------------------------------------------------
// Per-person state (kv): her saves and when she last looked. Josh's session reads hers (he sees what
// she sees) and never writes it.
// ---------------------------------------------------------------------------------------------

const ME_KEY = "events:me:kiriya";
const blankMe = () => ({ saved: { events: {}, merch: {} }, lastLookedAt: null, looked: {} });

export async function readMe(db) {
  const [row] = await db.select({ value: schema.kv.value }).from(schema.kv).where(eq(schema.kv.key, ME_KEY));
  const value = row?.value ?? {};
  const base = blankMe();
  return {
    saved: { events: { ...(value.saved?.events ?? {}) }, merch: { ...(value.saved?.merch ?? {}) } },
    lastLookedAt: value.lastLookedAt ?? base.lastLookedAt,
    looked: { ...(value.looked ?? {}) },
  };
}

export async function updateMe(db, change) {
  const next = change(await readMe(db)) ?? (await readMe(db));
  await db
    .insert(schema.kv)
    .values({ key: ME_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.kv.key, set: { value: next, updatedAt: new Date() } });
  return next;
}

// ---------------------------------------------------------------------------------------------
// Small settings (settings table).
// ---------------------------------------------------------------------------------------------

export async function readSetting(db, key, fallback = null) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? fallback;
}
export async function writeSetting(db, key, value) {
  await db
    .insert(schema.settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
  return value;
}

// kv rows for worker state (per source change detection, robots.txt cache).
export async function readKv(db, key, fallback = null) {
  const [row] = await db.select({ value: schema.kv.value }).from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? fallback;
}
export async function writeKv(db, key, value) {
  await db
    .insert(schema.kv)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
  return value;
}

// ---------------------------------------------------------------------------------------------
// Events.
// ---------------------------------------------------------------------------------------------

/** Singapore events only (tier sg), newest first by start, hidden ones only for admin tooling. */
export async function listEventRows(db, { includeHidden = false } = {}) {
  const where = includeHidden ? eq(schema.events.tier, "sg") : and(eq(schema.events.tier, "sg"), sql`${schema.events.status} <> 'hidden'`);
  return db.select().from(schema.events).where(where).orderBy(asc(schema.events.startsOn), asc(schema.events.name)).limit(400);
}

export async function getEventRow(db, id) {
  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  return row ?? null;
}

export async function logFor(db, ids) {
  if (!ids.length) return [];
  return db.select().from(schema.eventLog).where(inArray(schema.eventLog.eventId, ids)).orderBy(desc(schema.eventLog.at)).limit(2000);
}

export async function recentLog(db, { limit = 20 } = {}) {
  return db.select().from(schema.eventLog).orderBy(desc(schema.eventLog.at)).limit(limit);
}

/**
 * Inserts or updates an event. `record` uses the column names of `schema.events`. Owner-set flags
 * (`status: hidden`, hand-set `hers`) survive automatic updates.
 */
export async function saveEvent(db, record, { now = new Date() } = {}) {
  const existing = await getEventRow(db, record.id);
  const value = {
    ...record,
    updatedAt: now,
    status: existing?.status === "hidden" ? "hidden" : (record.status ?? existing?.status ?? "upcoming"),
    hers: Boolean(record.hers || existing?.hers),
  };
  if (existing) {
    const { id, firstSeenAt, ...set } = value;
    await db.update(schema.events).set(set).where(eq(schema.events.id, record.id));
  } else {
    await db.insert(schema.events).values({ firstSeenAt: now, ...value });
  }
  return getEventRow(db, record.id);
}

export async function addLogEntries(db, eventId, entries, { now = new Date(), push = "digest", big = false } = {}) {
  const out = [];
  for (const entry of entries) {
    const [row] = await db
      .insert(schema.eventLog)
      .values({
        eventId,
        at: entry.at ? new Date(entry.at) : now,
        kind: entry.kind,
        title: entry.title.slice(0, 160),
        text: (entry.text ?? "").slice(0, 600),
        sourceIds: entry.sourceIds ?? [],
        big: Boolean(entry.big ?? big),
        push: entry.push ?? push,
        pushedAt: entry.pushedAt ?? null,
      })
      .returning();
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Signals (the worker's queue).
// ---------------------------------------------------------------------------------------------

/** Queues a signal once per hash. Returns `{signal, created}`. */
export async function enqueueSignal(db, signal) {
  const hash = signal.hash ?? sha(signal.origin, signal.sourceId ?? "", signal.url ?? "", signal.title ?? "", signal.excerpt ?? "");
  const [inserted] = await db
    .insert(schema.eventSignals)
    .values({
      origin: signal.origin,
      sourceId: signal.sourceId ?? null,
      url: signal.url ?? null,
      title: signal.title?.slice(0, 300) ?? null,
      excerpt: signal.excerpt?.slice(0, 4000) ?? null,
      payload: signal.payload ?? {},
      hash,
      status: signal.status ?? "queued",
      eventId: signal.eventId ?? null,
      by: signal.by ?? null,
    })
    .onConflictDoNothing({ target: schema.eventSignals.hash })
    .returning();
  if (inserted) return { signal: inserted, created: true };
  const [existing] = await db.select().from(schema.eventSignals).where(eq(schema.eventSignals.hash, hash));
  return { signal: existing, created: false };
}

export async function getSignal(db, id) {
  const [row] = await db.select().from(schema.eventSignals).where(eq(schema.eventSignals.id, id));
  return row ?? null;
}

export async function updateSignal(db, id, patch) {
  const [row] = await db
    .update(schema.eventSignals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.eventSignals.id, id))
    .returning();
  return row ?? null;
}

/** The oldest queued signals; pasted links first (Josh is waiting on them). */
export async function queuedSignals(db, { limit = 10, statuses = ["queued"] } = {}) {
  const result = await db.execute(sql`SELECT * FROM event_signals WHERE status IN (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})
    ORDER BY CASE origin WHEN 'link' THEN 0 WHEN 'refresh' THEN 1 ELSE 2 END, created_at ASC LIMIT ${limit}`);
  return rowsOf(result).map((r) => ({ ...r, sourceId: r.source_id, eventId: r.event_id, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function signalsByOrigin(db, origin, { limit = 30 } = {}) {
  return db.select().from(schema.eventSignals).where(eq(schema.eventSignals.origin, origin)).orderBy(desc(schema.eventSignals.createdAt)).limit(limit);
}

export async function signalCounts(db) {
  const result = await db.execute(sql`SELECT status, count(*)::int AS n FROM event_signals GROUP BY status`);
  return Object.fromEntries(rowsOf(result).map((r) => [r.status, Number(r.n)]));
}
