import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { Client } from "@upstash/qstash";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { kiriya } from "../content/kiriya.js";
import { FEELINGS } from "../content/moods.js";
import { readCheckin } from "./checkin.js";
import { addDays, localDay, zonedInstant, zonedParts } from "./time.js";
import { notificationSettings } from "../push/planner.js";
import { pushConfigured, sendToSubscribers } from "../push/webpush.js";

// The jar holds only notes Josh writes in admin (the bundled library was erased on 2026-11-24).
// A new note joins the jar at the next 08:00 in Singapore so a day's notes arrive together; she
// hears about them that morning, and they come out of the jar first, oldest first.

export const JAR_NOTE_MAX = 800;
export const JAR_RELEASE_HOUR = 8;
export const JAR_FEELINGS = FEELINGS.map((feeling) => feeling.key);

const STATE = "notejar:state";
const PREFIX = "notejar:pull:";
const LAST_ANNOUNCE = "notejar:announce:last";
const json = (value) => sql`${JSON.stringify(value)}::jsonb`;
const rows = (result) => result.rows ?? result;
const empty = () => ({ revision: 0, seen: [], ever: [], recent: [], last: null, daily: null });
const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// The line at the top of the paper, from the day the note was written for.
const LABELS = {
  happy: "for the cute days",
  content: "for the comfy days",
  excited: "for the can’t-sit-still days",
  sad: "for the heavy days",
  angry: "for the grr days",
  anxious: "for the 47-tabs-open days",
  overwhelmed: "for the too-loud days",
  playful: "for the little-menace days",
};
export const jarLabel = (feelings = []) => (feelings.length === 1 ? LABELS[feelings[0]] : null) ?? "a little note, just for u";

async function valueAt(db, key) {
  const [row] = await db.select({ value: schema.kv.value }).from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? null;
}
async function signatureOf(db) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "signature"));
  return typeof row?.value === "string" && row.value.trim() ? row.value : kiriya.signature;
}

/** The next 08:00 in Singapore at or after `now`. */
export function nextRelease(now = new Date()) {
  const today = localDay(now);
  const at = zonedInstant(today, JAR_RELEASE_HOUR);
  return now.getTime() <= at.getTime() ? at : zonedInstant(addDays(today, 1), JAR_RELEASE_HOUR);
}

/** When the morning push goes out on `day`: 08:00, or later if her own "not before" hour is later. */
export function announceTime(day, startHour = JAR_RELEASE_HOUR) {
  return zonedInstant(day, Math.max(JAR_RELEASE_HOUR, Number(startHour) || 0));
}

/** A stored note in the shape the picker and the paper use. */
export function jarNote(row, signature = kiriya.signature) {
  const feelings = Array.isArray(row.feelings) ? row.feelings : [];
  return {
    id: row.id,
    theme: feelings[0] ?? "love",
    label: jarLabel(feelings),
    text: row.text,
    feelings,
    avoidFeelings: [],
    minEnergy: 0,
    voice: "josh",
    byline: `— ${signature}`,
  };
}

/**
 * Picks the next note. Notes she hasn't drawn yet (`fresh`, oldest first) always come first; after
 * that, the mood-aware rotation: notes for her current feeling (or any day), unseen before seen,
 * never the same note twice in a row. Returns null only when the pool is empty.
 */
export function chooseNote(state, { pool, fresh = [], feeling = null, energy = 2, random = Math.random } = {}) {
  if (!pool?.length) return null;
  const byId = new Map(pool.map((note) => [note.id, note]));
  const first = fresh.map((id) => byId.get(id)).find((note) => note && !state.seen.includes(note.id));
  if (first) return { note: first, reset: false, resetIds: [], fresh: true };
  let eligible = pool.filter((note) =>
    (!feeling || !note.feelings.length || note.feelings.includes(feeling)) &&
    !(note.avoidFeelings ?? []).includes(feeling) && energy >= (note.minEnergy ?? 0));
  // Every note is written for a different mood than hers: a note from him still beats an empty jar.
  if (!eligible.length) eligible = pool;
  let candidates = eligible.filter((note) => !state.seen.includes(note.id));
  const reset = candidates.length === 0;
  if (reset) candidates = eligible.filter((note) => note.id !== state.lastNote);
  if (!candidates.length) candidates = eligible;
  const recent = state.recent ?? [];
  const scored = candidates.map((note) => {
    let score = random() * 4;
    if (note.feelings.includes(feeling)) score += 4;
    if (!note.feelings.length) score += 1;
    if (recent[0] === note.theme) score -= 3;
    if (energy <= 1 && note.text.length < 155) score += 2;
    return { note, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return { note: scored[0].note, reset, resetIds: reset ? eligible.map((note) => note.id) : [], fresh: false };
}

/** Released notes (or, for an admin preview, every note) and the ones she hasn't drawn yet. */
async function jarPool(db, { now = new Date(), includeWaiting = false } = {}) {
  const list = await db
    .select()
    .from(schema.jarNotes)
    .where(includeWaiting ? undefined : lte(schema.jarNotes.releaseAt, now))
    .orderBy(asc(schema.jarNotes.releaseAt), asc(schema.jarNotes.createdAt));
  const signature = await signatureOf(db);
  return {
    pool: list.map((row) => jarNote(row, signature)),
    fresh: list.filter((row) => !row.firstPulledAt).map((row) => row.id),
  };
}

export async function readNoteJar(db, day = localDay(), { now = new Date() } = {}) {
  const state = (await valueAt(db, STATE)) ?? empty();
  const [current, daily, { pool, fresh }] = await Promise.all([
    state.last ? valueAt(db, PREFIX + state.last) : null,
    state.daily?.day === day ? valueAt(db, PREFIX + state.daily.id) : null,
    jarPool(db, { now }),
  ]);
  return {
    day,
    current,
    daily,
    total: pool.length,
    pulled: state.revision,
    // New notes she hasn't drawn yet: this is what lights the red heart on the jar.
    fresh: fresh.filter((id) => !state.seen.includes(id)).length,
  };
}

// Each pull has its own immutable snapshot; state contains only bounded selection metadata.
// One compare-and-swap SQL statement advances state, stores the delivery and retires the note's
// "new" heart together on Neon HTTP.
export async function pullNote(db, requestId, { day = localDay(), now = new Date(), preview = false, random = Math.random } = {}) {
  const key = PREFIX + requestId;
  // A preview follows the admin's own test check-in; real pulls follow Kiriya's.
  const { current } = await readCheckin(db, day, preview ? "admin" : "kiriya");
  const context = { feeling: current?.feeling?.key, energy: current?.energy ?? 2, random };
  if (preview) {
    // Josh sees what she'll get next, including notes still waiting for the morning.
    const { pool, fresh } = await jarPool(db, { now, includeWaiting: true });
    const chosen = chooseNote(empty(), { ...context, pool, fresh });
    if (!chosen) throw Object.assign(new Error("The jar is empty."), { status: 404, code: "jar_empty" });
    return { id: requestId, note: chosen.note, day, at: now.toISOString(), saved: false, revisited: false, fresh: chosen.fresh, preview: true };
  }
  await db.insert(schema.kv).values({ key: STATE, value: empty() }).onConflictDoNothing();
  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await valueAt(db, key);
    if (existing) return existing;
    const [state, { pool, fresh }] = await Promise.all([valueAt(db, STATE), jarPool(db, { now })]);
    const chosen = chooseNote(state, { ...context, pool, fresh });
    if (!chosen) throw Object.assign(new Error("The jar is empty."), { status: 404, code: "jar_empty" });
    const { note, resetIds } = chosen;
    const record = { id: requestId, note, day, at: now.toISOString(), ordinal: state.revision + 1, saved: false, revisited: state.ever.includes(note.id), fresh: chosen.fresh };
    const next = {
      revision: state.revision + 1,
      // Only refresh the exhausted mood-compatible set. Switching moods must not
      // forget notes already read in another mood; immutable history stays intact.
      seen: [...state.seen.filter((id) => !resetIds.includes(id)), note.id],
      ever: [...new Set([...state.ever, note.id])],
      recent: [note.theme, ...state.recent].slice(0, 4),
      last: requestId, lastNote: note.id,
      daily: state.daily?.day === day ? state.daily : { day, id: requestId },
    };
    const noteId = isUuid(note.id) ? note.id : null;
    const result = rows(await db.execute(sql`
      WITH advanced AS (
        UPDATE kv SET value=${json(next)}, updated_at=now()
        WHERE key=${STATE} AND (value->>'revision')::integer=${state.revision}
          AND NOT EXISTS (SELECT 1 FROM kv WHERE key=${key})
        RETURNING key
      ), retired AS (
        UPDATE jar_notes SET first_pulled_at=${now.toISOString()}::timestamptz
        WHERE id=${noteId}::uuid AND first_pulled_at IS NULL AND EXISTS (SELECT 1 FROM advanced)
        RETURNING id
      )
      INSERT INTO kv(key,value) SELECT ${key},${json(record)} FROM advanced
      ON CONFLICT(key) DO NOTHING RETURNING value
    `));
    if (result[0]) return result[0].value;
  }
  const existing = await valueAt(db, key);
  if (existing) return existing;
  throw Object.assign(new Error("The jar is busy. Try the same pull again."), { status: 409 });
}

export async function noteHistory(db, { before = null, saved = false } = {}) {
  const found = rows(await db.execute(sql`
    SELECT value FROM kv WHERE key LIKE ${PREFIX + "%"}
    ${saved ? sql`AND value->>'saved'='true'` : sql``}
    ${before ? sql`AND (value->>'ordinal')::integer < ${before}` : sql``}
    ORDER BY (value->>'ordinal')::integer DESC LIMIT 25
  `)).map((row) => row.value);
  return { items: found.slice(0, 24), next: found.length > 24 ? found[23].ordinal : null };
}

export async function keepNote(db, id, saved) {
  const result = rows(await db.execute(sql`
    UPDATE kv SET value=jsonb_set(value,'{saved}',${json(saved)}),updated_at=now()
    WHERE key=${PREFIX + id} RETURNING value
  `));
  return result[0]?.value ?? null;
}

// ---------- admin ----------

const cleanFeelings = (feelings = []) => [...new Set(feelings)].filter((key) => JAR_FEELINGS.includes(key));

export function jarNoteStatus(row, now = new Date()) {
  if (row.firstPulledAt) return "read";
  if (row.releaseAt.getTime() > now.getTime()) return "waiting";
  return "in_jar";
}

export async function listJarNotes(db, { now = new Date() } = {}) {
  const list = await db.select().from(schema.jarNotes).orderBy(desc(schema.jarNotes.createdAt));
  const notes = list.map((row) => ({
    id: row.id,
    text: row.text,
    feelings: row.feelings,
    label: jarLabel(row.feelings),
    status: jarNoteStatus(row, now),
    releaseAt: row.releaseAt.toISOString(),
    announcedAt: row.announcedAt?.toISOString() ?? null,
    firstPulledAt: row.firstPulledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
  const settings = await notificationSettings(db);
  const release = nextRelease(now);
  return {
    notes,
    counts: {
      total: notes.length,
      waiting: notes.filter((n) => n.status === "waiting").length,
      inJar: notes.filter((n) => n.status === "in_jar").length,
      read: notes.filter((n) => n.status === "read").length,
    },
    nextRelease: release.toISOString(),
    nextAnnounce: announceTime(localDay(release), settings.startHour).toISOString(),
    herStartHour: settings.startHour,
    push: pushConfigured(),
    scheduler: Boolean(env.qstashToken),
    lastAnnounce: await valueAt(db, LAST_ANNOUNCE),
    feelings: FEELINGS.map(({ key, label, emoji }) => ({ key, label, emoji })),
  };
}

export async function addJarNote(db, { text, feelings = [] }, { now = new Date() } = {}) {
  const [row] = await db
    .insert(schema.jarNotes)
    .values({ text: text.trim(), feelings: cleanFeelings(feelings), releaseAt: nextRelease(now) })
    .returning();
  return row;
}

export async function editJarNote(db, id, { text, feelings, releaseNow = false }, { now = new Date() } = {}) {
  const set = { updatedAt: now };
  // "Skip the wait": a note still waiting for the morning goes into her jar right away.
  if (releaseNow) set.releaseAt = now;
  if (typeof text === "string") set.text = text.trim();
  if (Array.isArray(feelings)) set.feelings = cleanFeelings(feelings);
  const [row] = await db.update(schema.jarNotes).set(set).where(eq(schema.jarNotes.id, id)).returning();
  return row ?? null;
}

export async function deleteJarNote(db, id) {
  const [row] = await db.delete(schema.jarNotes).where(eq(schema.jarNotes.id, id)).returning({ id: schema.jarNotes.id });
  return Boolean(row);
}

/** Asks QStash to call the announcement at that morning's push time. Without QStash, the 08:00 cron does it. */
export async function scheduleJarAnnouncement(db, row) {
  if (!env.qstashToken) return { scheduled: false };
  const day = localDay(row.releaseAt);
  const { startHour } = await notificationSettings(db);
  const at = announceTime(day, startHour);
  const client = new Client({ token: env.qstashToken, ...(env.qstashUrl ? { baseUrl: env.qstashUrl } : {}) });
  await client.publishJSON({
    url: new URL("/api/jobs/note-jar", env.siteUrl).toString(),
    body: { day },
    notBefore: Math.floor(at.getTime() / 1000),
    deduplicationId: `jar-announce:${day}`,
    retries: 3,
  });
  return { scheduled: true, at: at.toISOString() };
}

/**
 * The morning announcement: claims every released, unannounced note once, then sends one push
 * about the ones she still hasn't drawn. Before her "not before" hour it waits (QStash calls back
 * at that hour); repeated calls find nothing left to claim, so they can't double-buzz her phone.
 */
export async function announceJar(db, { now = new Date(), send = sendToSubscribers } = {}) {
  const settings = await notificationSettings(db);
  const day = localDay(now);
  const at = announceTime(day, settings.startHour);
  if (now.getTime() < at.getTime() - 60_000) {
    if (env.qstashToken) {
      const client = new Client({ token: env.qstashToken, ...(env.qstashUrl ? { baseUrl: env.qstashUrl } : {}) });
      await client.publishJSON({
        url: new URL("/api/jobs/note-jar", env.siteUrl).toString(),
        body: { day },
        notBefore: Math.floor(at.getTime() / 1000),
        deduplicationId: `jar-announce:${day}`,
        retries: 3,
      });
      return { announced: 0, deferredUntil: at.toISOString() };
    }
    // No scheduler to wait with: the morning cron's push still beats never telling her.
  }
  const { hour } = zonedParts(now);
  if (hour >= settings.endHour) return { announced: 0, skipped: "after her notification hours" };
  const claimed = await db
    .update(schema.jarNotes)
    .set({ announcedAt: now })
    .where(and(isNull(schema.jarNotes.announcedAt), lte(schema.jarNotes.releaseAt, now)))
    .returning();
  const unread = claimed.filter((row) => !row.firstPulledAt).length;
  let push = { skipped: "nothing new" };
  if (unread) {
    if (!pushConfigured()) push = { skipped: "notifications aren't configured" };
    else {
      try {
        push = await send(
          db,
          {
            title: unread === 1 ? "a new little note in your jar ♡" : `${unread} new little notes in your jar ♡`,
            body: unread === 1 ? "Josh slipped a new note in for you. Pull it whenever you like." : "Josh slipped some new notes in for you. Pull them whenever you like.",
            navigate: "/world#note-jar",
            badge: unread,
            kind: "jar",
          },
          { role: "kiriya", ttlSeconds: 12 * 60 * 60 },
        );
      } catch (error) {
        push = { error: String(error.message).slice(0, 200) };
      }
    }
  }
  const report = { at: now.toISOString(), announced: claimed.length, unread, push, reminder: unread ? await scheduleJarReminder(db, day, settings).catch(() => ({ scheduled: false })) : undefined };
  if (claimed.length)
    await db.insert(schema.kv).values({ key: LAST_ANNOUNCE, value: report })
      .onConflictDoUpdate({ target: schema.kv.key, set: { value: report, updatedAt: new Date() } });
  return report;
}

// ---------- the gentle evening reminder (phase 4b) ----------
// If the morning's new notes are still undrawn by the evening, one soft nudge, inside her
// notification hours. QStash calls back; without it there's no reminder (Hobby crons run once a day).
export const JAR_REMINDER_HOUR = 19;
const REMINDED = "notejar:reminded:";

export function reminderTime(day, endHour = 22) {
  return zonedInstant(day, Math.min(JAR_REMINDER_HOUR, Math.max(JAR_RELEASE_HOUR + 1, Number(endHour) - 1)));
}

async function scheduleJarReminder(db, day, settings) {
  if (!env.qstashToken) return { scheduled: false };
  const at = reminderTime(day, settings.endHour);
  const client = new Client({ token: env.qstashToken, ...(env.qstashUrl ? { baseUrl: env.qstashUrl } : {}) });
  await client.publishJSON({
    url: new URL("/api/jobs/note-jar-reminder", env.siteUrl).toString(),
    body: { day },
    notBefore: Math.floor(at.getTime() / 1000),
    deduplicationId: `jar-reminder:${day}`,
    retries: 2,
  });
  return { scheduled: true, at: at.toISOString() };
}

export async function remindJar(db, { now = new Date(), send = sendToSubscribers } = {}) {
  const settings = await notificationSettings(db);
  const day = localDay(now);
  const { hour } = zonedParts(now);
  if (hour >= settings.endHour || hour < settings.startHour) return { reminded: false, skipped: "outside her notification hours" };
  if (await valueAt(db, REMINDED + day)) return { reminded: false, skipped: "already reminded today" };
  const { fresh } = await readNoteJar(db, day, { now });
  if (!fresh) return { reminded: false, skipped: "she drew them already ♡" };
  if (!pushConfigured()) return { reminded: false, skipped: "notifications aren't configured" };
  await db.insert(schema.kv).values({ key: REMINDED + day, value: { at: now.toISOString(), fresh } }).onConflictDoNothing();
  const push = await send(
    db,
    {
      title: fresh === 1 ? "a little note has been waiting since this morning ♡" : `${fresh} little notes have been waiting since this morning ♡`,
      body: "they're still in your jar whenever you're ready.",
      navigate: "/world#note-jar",
      kind: "reminder",
    },
    { role: "kiriya", ttlSeconds: 3 * 60 * 60 },
  );
  return { reminded: true, fresh, push };
}
