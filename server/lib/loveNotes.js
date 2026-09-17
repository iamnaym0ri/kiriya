import { and, count, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { Client } from "@upstash/qstash";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { addDays, localDay, zonedInstant, zonedParts } from "./time.js";
import { notificationSettings } from "../push/planner.js";
import { pushConfigured, sendToSubscribers } from "../push/webpush.js";

export const NOTE_KINDS = ["note", "update", "surprise"];
export const NOTE_TITLE_MAX = 60;
export const NOTE_BODY_MAX = 1000;
// A scheduled note whose callback never came is delivered quietly once it's this late, instead of
// buzzing her phone at whatever hour the backstop happens to run.
const QUIET_AFTER_MS = 2 * 60 * 60 * 1000;
// Notes a worker claimed but never finished still count as delivered after this long.
const STALE_SENDING_MS = 10 * 60 * 1000;

export const isNoteLink = (link) => typeof link === "string" && /^\/world(?:\/[a-z-]+)*(?:\?[\w=&-]*)?(?:#[\w-]*)?$/.test(link);
export const noteLink = (note) => note.link ?? `/world/notes?open=${note.id}`;

/** What fits on a lock screen: the start of the note, cut at a word. */
export function notificationPreview(body, max = 150) {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}

/** A random moment inside the notification window: later today when there's room, else tomorrow. */
export function surpriseTime(settings, now = new Date(), random = Math.random) {
  const today = localDay(now);
  for (const day of [today, addDays(today, 1)]) {
    const start = Math.max(zonedInstant(day, settings.startHour).getTime(), now.getTime() + 5 * 60_000);
    const end = zonedInstant(day, settings.endHour).getTime() - 10 * 60_000;
    if (end - start >= 20 * 60_000) return new Date(start + random() * (end - start));
  }
  return new Date(now.getTime() + 5 * 60_000);
}

export async function createLoveNote(db, { recipient, kind = "note", title, body, link = null, sendAt = new Date() }) {
  const [row] = await db.insert(schema.loveNotes).values({ recipient, kind, title, body, link, sendAt }).returning();
  return row;
}

/** Asks QStash to call back at the note's time. Without QStash, the backstop delivers it. */
export async function scheduleLoveNote(row) {
  if (!env.qstashToken) return { scheduled: false };
  const client = new Client({ token: env.qstashToken, ...(env.qstashUrl ? { baseUrl: env.qstashUrl } : {}) });
  await client.publishJSON({
    url: new URL("/api/jobs/love-note", env.siteUrl).toString(),
    body: { id: row.id },
    notBefore: Math.floor(row.sendAt.getTime() / 1000),
    deduplicationId: `love-note:${row.id}`,
    retries: 3,
  });
  return { scheduled: true };
}

const delivered = (now) =>
  and(lte(schema.loveNotes.sendAt, now), inArray(schema.loveNotes.status, ["scheduled", "sending", "sent"]));

export async function unreadCount(db, recipient, now = new Date()) {
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(schema.loveNotes)
    .where(and(eq(schema.loveNotes.recipient, recipient), delivered(now), isNull(schema.loveNotes.openedAt)));
  return unread;
}

/**
 * Claims a due note once and sends its notification. The note is in their world either way; the
 * push outcome is recorded for the admin desk. Repeated or late callbacks find nothing to claim.
 */
export async function deliverLoveNote(db, id, { now = new Date(), quiet = false } = {}) {
  const [note] = await db
    .update(schema.loveNotes)
    .set({ status: "sending" })
    .where(and(eq(schema.loveNotes.id, id), eq(schema.loveNotes.status, "scheduled"), lte(schema.loveNotes.sendAt, now)))
    .returning();
  if (!note) return null;
  let pushResult;
  if (quiet) pushResult = { skipped: "delivered outside notification hours, without a notification" };
  else if (now.getTime() - note.sendAt.getTime() > QUIET_AFTER_MS) pushResult = { skipped: "delivered late, without a notification" };
  else if (!pushConfigured()) pushResult = { skipped: "notifications aren't configured" };
  else {
    try {
      pushResult = await sendToSubscribers(
        db,
        { title: note.title, body: notificationPreview(note.body), navigate: noteLink(note), badge: await unreadCount(db, note.recipient, now) },
        { role: note.recipient, ttlSeconds: 12 * 60 * 60 },
      );
    } catch (error) {
      pushResult = { error: String(error.message).slice(0, 200) };
    }
  }
  const [sent] = await db
    .update(schema.loveNotes)
    .set({ status: "sent", sentAt: new Date(), pushResult })
    .where(eq(schema.loveNotes.id, id))
    .returning();
  return sent;
}

/**
 * Backstop for lost callbacks: delivers due notes and settles notes stuck mid-send. The backstop
 * runs just after midnight, so outside her notification hours notes arrive without a buzz.
 */
export async function sweepLoveNotes(db, now = new Date()) {
  const due = await db
    .select({ id: schema.loveNotes.id })
    .from(schema.loveNotes)
    .where(and(eq(schema.loveNotes.status, "scheduled"), lte(schema.loveNotes.sendAt, now)))
    .limit(50);
  const { startHour, endHour } = await notificationSettings(db);
  const { hour } = zonedParts(now);
  const quiet = hour < startHour || hour >= endHour;
  const results = [];
  for (const { id } of due) results.push(await deliverLoveNote(db, id, { now, quiet }));
  const settled = await db
    .update(schema.loveNotes)
    .set({ status: "sent", sentAt: now, pushResult: { skipped: "interrupted while sending" } })
    .where(and(eq(schema.loveNotes.status, "sending"), lte(schema.loveNotes.sendAt, new Date(now.getTime() - STALE_SENDING_MS))))
    .returning({ id: schema.loveNotes.id });
  return { delivered: results.filter(Boolean).length, settled: settled.length };
}

const inboxFields = (note) => ({
  id: note.id,
  kind: note.kind,
  title: note.title,
  body: note.body,
  link: note.link,
  at: note.sendAt,
  openedAt: note.openedAt,
});

/** Notes that have reached this person, newest first. */
export async function inbox(db, recipient, { now = new Date(), limit = 60 } = {}) {
  const rows = await db
    .select()
    .from(schema.loveNotes)
    .where(and(eq(schema.loveNotes.recipient, recipient), delivered(now)))
    .orderBy(desc(schema.loveNotes.sendAt))
    .limit(limit);
  return { notes: rows.map(inboxFields), unread: rows.filter((note) => !note.openedAt).length };
}

export async function openLoveNote(db, recipient, id, now = new Date()) {
  const [note] = await db
    .select()
    .from(schema.loveNotes)
    .where(and(eq(schema.loveNotes.id, id), eq(schema.loveNotes.recipient, recipient), delivered(now)));
  if (!note) return null;
  if (!note.openedAt) {
    const [opened] = await db
      .update(schema.loveNotes)
      .set({ openedAt: now })
      .where(and(eq(schema.loveNotes.id, id), isNull(schema.loveNotes.openedAt)))
      .returning();
    return inboxFields(opened ?? note);
  }
  return inboxFields(note);
}

/** The admin desk's view: every recipient, upcoming and past. */
export async function recentLoveNotes(db, limit = 60) {
  return db.select().from(schema.loveNotes).orderBy(desc(schema.loveNotes.sendAt)).limit(limit);
}

export async function cancelLoveNote(db, id) {
  const [row] = await db
    .update(schema.loveNotes)
    .set({ status: "canceled" })
    .where(and(eq(schema.loveNotes.id, id), eq(schema.loveNotes.status, "scheduled")))
    .returning();
  return row ?? null;
}
