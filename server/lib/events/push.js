// Event pushes, through the existing push path (sendToSubscribers → web push + APNs, kind "event").
// - Instant: big items (cons, pop-ups and merch tied to her fandoms), one push per event per run.
// - Weekly digest: everything else, Sundays from 10:00 Singapore time.
// Nothing reaches Kiriya unless EVENTS_PUSH_AUDIENCE says so (default: Josh only, the app is still a
// surprise), and never while app test mode is on (server/lib/appTestMode.js): then Josh's phones get
// it, marked "test".
import { and, asc, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "../../db/client.js";
import { sendToSubscribers } from "../../push/webpush.js";
import { notificationSettings } from "../../push/planner.js";
import { testMode } from "../appTestMode.js";
import { localDay, zonedParts } from "../time.js";
import { readSetting, writeSetting } from "./store.js";

const DIGEST_WEEKDAY = 0; // Sunday
const DIGEST_HOUR = 10;

/** Who event pushes go to: "admin" (default), "kiriya" or "both". */
export function pushAudience() {
  const value = String(process.env.EVENTS_PUSH_AUDIENCE ?? "admin").toLowerCase();
  return ["admin", "kiriya", "both"].includes(value) ? value : "admin";
}

const navigateTo = (eventId) => `/world?event=${encodeURIComponent(eventId)}#events`;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** One push for one event's pending big entries. */
export function instantMessage(event, entries) {
  const top = entries[0];
  const more = entries.length > 1 ? ` (+${entries.length - 1} more)` : "";
  const title = top.kind === "new" ? `new: ${event.name}` : `${event.name}: ${top.title}`;
  const body = [top.text, more].filter(Boolean).join("").trim() || "tap to see what's new ♡";
  return { title: clip(title, 60), body: clip(body, 160), navigate: navigateTo(event.id), kind: "event", threadId: "events" };
}

export function digestMessage(groups) {
  const names = groups.map((g) => g.event.name);
  const count = groups.reduce((n, g) => n + g.entries.length, 0);
  return {
    title: `this week in events & merch ♡`,
    body: clip(`${count} update${count === 1 ? "" : "s"}: ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}`, 160),
    navigate: "/world#events",
    kind: "event",
    threadId: "events",
  };
}

function inHours(now, { startHour, endHour }) {
  const { hour } = zonedParts(now);
  return hour >= startHour && hour < endHour;
}

export function digestDue(now, lastDigestAt) {
  const p = zonedParts(now);
  const weekday = new Date(`${localDay(now)}T12:00:00Z`).getUTCDay();
  if (weekday !== DIGEST_WEEKDAY || p.hour < DIGEST_HOUR) return false;
  return !lastDigestAt || now.getTime() - Date.parse(lastDigestAt) > 6 * 86400_000;
}

/**
 * Sends what's due. Returns `{instant: [...], digest, audience, test}`. `send` is injectable for tests.
 * Entries are marked sent before the push goes out, so a retry can never double-notify her.
 */
export async function deliverEventPushes(db, { digest = false, now = new Date(), send = sendToSubscribers } = {}) {
  const test = (await testMode(db, now)).on;
  const audience = test ? "admin" : pushAudience();
  const roles = audience === "both" ? ["kiriya", "admin"] : [audience];
  const hours = await notificationSettings(db);
  const herQuiet = roles.includes("kiriya") && !test && !inHours(now, hours);
  const out = { audience, test, instant: [], digest: null, held: 0 };

  const pending = await db
    .select()
    .from(schema.eventLog)
    .where(and(isNull(schema.eventLog.pushedAt), inArray(schema.eventLog.push, ["instant", "digest"])))
    .orderBy(asc(schema.eventLog.at))
    .limit(500);
  if (!pending.length) return out;
  const ids = [...new Set(pending.map((e) => e.eventId))];
  const events = new Map((await db.select().from(schema.events).where(inArray(schema.events.id, ids))).map((e) => [e.id, e]));
  const visible = (e) => events.get(e.eventId) && events.get(e.eventId).status !== "hidden";

  // Instant pushes wait for her notification hours (held, not dropped).
  const instant = pending.filter((e) => e.push === "instant" && visible(e));
  if (instant.length && herQuiet) out.held = instant.length;
  else {
    const byEvent = new Map();
    for (const e of instant) byEvent.set(e.eventId, [...(byEvent.get(e.eventId) ?? []), e]);
    for (const [eventId, entries] of byEvent) {
      const message = instantMessage(events.get(eventId), entries.reverse());
      if (test) message.title = clip(`test · ${message.title}`, 60);
      await markSent(db, entries.map((e) => e.id), now, { audience, test });
      const results = [];
      for (const role of roles) results.push(await send(db, message, { role, ttlSeconds: 24 * 3600 }).catch((error) => ({ error: String(error.message).slice(0, 120) })));
      out.instant.push({ eventId, entries: entries.length, title: message.title, results });
    }
  }

  // The weekly digest gathers the rest (and anything instant that a hidden event left behind).
  const last = (await readSetting(db, "events_digest", null))?.at ?? null;
  if (digest || digestDue(now, last)) {
    const rest = pending.filter((e) => e.push === "digest" && visible(e));
    if (rest.length && !(herQuiet && !digest)) {
      const groups = [];
      for (const e of rest) {
        const g = groups.find((x) => x.event.id === e.eventId);
        if (g) g.entries.push(e);
        else groups.push({ event: events.get(e.eventId), entries: [e] });
      }
      const message = digestMessage(groups);
      if (test) message.title = clip(`test · ${message.title}`, 60);
      await markSent(db, rest.map((e) => e.id), now, { audience, test, digest: true });
      const results = [];
      for (const role of roles) results.push(await send(db, message, { role, ttlSeconds: 24 * 3600 }).catch((error) => ({ error: String(error.message).slice(0, 120) })));
      await writeSetting(db, "events_digest", { at: now.toISOString(), entries: rest.length });
      out.digest = { entries: rest.length, events: groups.length, title: message.title, results };
    }
  }
  // Entries for hidden events are retired quietly.
  const retired = pending.filter((e) => !visible(e)).map((e) => e.id);
  if (retired.length) await markSent(db, retired, now, { skipped: "hidden" });
  return out;
}

async function markSent(db, ids, now, result) {
  if (!ids.length) return;
  await db.update(schema.eventLog).set({ pushedAt: now, pushResult: result }).where(inArray(schema.eventLog.id, ids));
}

/** How pending pushes look right now, for admin status. */
export async function pendingPushes(db) {
  const result = await db.execute(sql`SELECT push, count(*)::int AS n FROM event_log WHERE pushed_at IS NULL GROUP BY push`);
  return Object.fromEntries((Array.isArray(result) ? result : result.rows).map((r) => [r.push, Number(r.n)]));
}

