// Existing QStash planner, limited to approved discoveries and current preferences.
import { and, eq, gte, lte } from "drizzle-orm";
import { Client } from "@upstash/qstash";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { localDay, zonedInstant, zonedParts } from "../lib/time.js";
import { seededRandom } from "../engine/pick.js";
import { isApprovedPush } from "../content/collection.js";
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  perDay: 3,
  startHour: 10,
  endHour: 22,
};
export const qstashConfigured = () => Boolean(env.qstashToken);
export async function notificationSettings(db) {
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "notifications"));
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(row?.value ?? {}) };
}
export async function planDay(
  db,
  day,
  bundle,
  settings = DEFAULT_NOTIFICATION_SETTINGS,
) {
  const existing = await db
    .select()
    .from(schema.plannedPushes)
    .where(eq(schema.plannedPushes.day, day));
  const signature = `${settings.enabled}:${settings.perDay}:${settings.startHour}:${settings.endHour}`;
  const approved = (bundle.pushes ?? []).filter(isApprovedPush);
  const current = existing.filter((r) => r.status === "planned");
  const now = new Date();
  // Disable also invalidates deliveries already queued for subsequent days.
  if (!settings.enabled) {
    await db
      .update(schema.plannedPushes)
      .set({ status: "skipped", detail: "Notifications disabled" })
      .where(
        and(
          eq(schema.plannedPushes.status, "planned"),
          gte(schema.plannedPushes.day, day),
        ),
      );
    return { planned: 0, reason: "notifications are turned off" };
  }
  if (
    current.length &&
    current.every(
      (r) => isApprovedPush(r.payload) && r.payload.schedule === signature,
    )
  )
    return { planned: 0, reason: "already planned", rows: current.length };
  // Preserve sent/sending/failed history; old QStash callbacks are harmless after invalidation.
  await db
    .update(schema.plannedPushes)
    .set({ status: "skipped", detail: "Superseded preferences or collection" })
    .where(
      and(
        eq(schema.plannedPushes.day, day),
        eq(schema.plannedPushes.status, "planned"),
      ),
    );
  const attempted = existing.filter((r) =>
    ["sent", "sending", "failed"].includes(r.status),
  );
  const count = Math.min(
    approved.length,
    Math.max(0, settings.perDay - attempted.length),
  );
  const start = Math.max(
    zonedInstant(day, settings.startHour, 0).getTime(),
    now.getTime() + 60_000,
  );
  const end = zonedInstant(day, settings.endHour, 0).getTime();
  if (!count || end <= start)
    return { planned: 0, reason: "window or allowance already passed" };
  const random = seededRandom(day, "push-times");
  const inserted = [];
  const attemptedSlots = new Set(attempted.map((r) => r.slot));
  let slot = 0;
  for (let i = 0; i < count; i++) {
    while (attemptedSlots.has(slot)) slot++;
    const sendAt = new Date(
      start + ((end - start) * (i + 0.15 + random() * 0.65)) / count,
    );
    const payload = { ...approved[i], schedule: signature };
    const [row] = await db
      .insert(schema.plannedPushes)
      .values({ day, slot, kind: "surprise", sendAt, payload })
      .onConflictDoUpdate({
        target: [schema.plannedPushes.day, schema.plannedPushes.slot],
        set: { status: "planned", sendAt, payload, detail: null, sentAt: null },
        setWhere: eq(schema.plannedPushes.status, "skipped"),
      })
      .returning();
    if (row) inserted.push(row);
    slot++;
  }
  let scheduled = 0;
  if (qstashConfigured()) {
    const client = new Client({
      token: env.qstashToken,
      ...(env.qstashUrl ? { baseUrl: env.qstashUrl } : {}),
    });
    for (const row of inserted) {
      await client.publishJSON({
        url: new URL("/api/jobs/send-push", env.siteUrl).toString(),
        body: { id: row.id, sendAt: row.sendAt.toISOString() },
        notBefore: Math.floor(row.sendAt.getTime() / 1000),
        deduplicationId: `${row.id}:${row.sendAt.getTime()}`,
        retries: 3,
      });
      scheduled++;
    }
  }
  return {
    planned: inserted.length,
    scheduled,
    times: inserted.map((r) => ({
      slot: r.slot,
      kind: r.kind,
      sendAt: r.sendAt,
    })),
  };
}
/** Recheck current preferences and eligibility immediately before an atomic claim. */
export async function claimPush(
  db,
  id,
  { expectedTime, allowEarly = false, now = new Date() } = {},
) {
  const [candidate] = await db
    .select()
    .from(schema.plannedPushes)
    .where(
      and(
        eq(schema.plannedPushes.id, id),
        eq(schema.plannedPushes.status, "planned"),
      ),
    );
  if (!candidate) return null;
  if (expectedTime && candidate.sendAt.toISOString() !== expectedTime)
    return null;
  if (!allowEarly && candidate.sendAt > now) return null;
  const settings = await notificationSettings(db);
  const hour = zonedParts(now).hour;
  const rows = await db
    .select()
    .from(schema.plannedPushes)
    .where(eq(schema.plannedPushes.day, candidate.day));
  const used = rows.filter((r) =>
    ["sending", "sent", "failed"].includes(r.status),
  ).length;
  if (
    !settings.enabled ||
    !isApprovedPush(candidate.payload) ||
    candidate.day !== localDay(now) ||
    hour < settings.startHour ||
    hour >= settings.endHour ||
    used >= settings.perDay
  ) {
    await db
      .update(schema.plannedPushes)
      .set({
        status: "skipped",
        detail: "No longer eligible under current preferences",
      })
      .where(
        and(
          eq(schema.plannedPushes.id, id),
          eq(schema.plannedPushes.status, "planned"),
        ),
      );
    return null;
  }
  const conditions = [
    eq(schema.plannedPushes.id, id),
    eq(schema.plannedPushes.status, "planned"),
    eq(schema.plannedPushes.sendAt, candidate.sendAt),
  ];
  if (!allowEarly) conditions.push(lte(schema.plannedPushes.sendAt, now));
  const [row] = await db
    .update(schema.plannedPushes)
    .set({ status: "sending" })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}
