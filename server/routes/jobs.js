import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { Receiver } from "@upstash/qstash";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { localDay } from "../lib/time.js";
import { prepareDay } from "../engine/daily.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  claimPush,
  planDay,
} from "../push/planner.js";
import { sendToSubscribers } from "../push/webpush.js";
import { deliverLoveNote, sweepLoveNotes } from "../lib/loveNotes.js";

export const jobRoutes = new Hono();

// Two ways in, both authenticated: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`,
// QStash signs the raw body with its signing keys.
async function authorize(c) {
  const auth = c.req.header("authorization");
  if (env.cronSecret && auth === `Bearer ${env.cronSecret}`)
    return { via: "cron", body: null };

  const signature = c.req.header("upstash-signature");
  if (signature && env.qstashCurrentSigningKey && env.qstashNextSigningKey) {
    const receiver = new Receiver({
      currentSigningKey: env.qstashCurrentSigningKey,
      nextSigningKey: env.qstashNextSigningKey,
    });
    const body = await c.req.text();
    const valid = await receiver.verify({ signature, body }).catch(() => false);
    if (valid) return { via: "qstash", body };
  }
  return null;
}

export async function runDailyAndPlan(db, day, options = {}) {
  const report = await prepareDay(db, day, options);
  const [dayRow] = await db
    .select()
    .from(schema.days)
    .where(eq(schema.days.day, day));
  const [settingsRow] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "notifications"));
  const settings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(settingsRow?.value ?? {}),
  };
  const pushes = dayRow
    ? await planDay(db, day, dayRow.bundle, settings)
    : { planned: 0, reason: "no bundle" };
  return { ...report, pushes };
}

async function runDaily(c) {
  const caller = await authorize(c);
  if (!caller)
    return c.json(
      { error: "unauthorized", message: "This job needs a valid signature." },
      401,
    );
  const db = await getDb();
  const result = await runDailyAndPlan(db, localDay());
  // Notes whose scheduled callback never arrived still reach her world.
  result.loveNotes = await sweepLoveNotes(db).catch((error) => ({ error: error.name }));
  console.log(
    "[jobs] daily",
    caller.via,
    JSON.stringify({
      ...result,
      sources: result.sources?.filter((s) => !s.ok),
    }),
  );
  return c.json({ ok: true, via: caller.via, result });
}

jobRoutes.get("/backstop", runDaily);
jobRoutes.post("/daily", runDaily);

// QStash calls this at a note's chosen time. Claiming is idempotent, so retries can't double-send.
jobRoutes.post("/love-note", async (c) => {
  const caller = await authorize(c);
  if (!caller)
    return c.json(
      { error: "unauthorized", message: "This job needs a valid signature." },
      401,
    );
  let id = null;
  try {
    id = JSON.parse(caller.body ?? (await c.req.text()) ?? "{}").id ?? null;
  } catch {
    id = null;
  }
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    return c.json({ error: "bad_request", message: "Missing note id." }, 400);
  // QStash's notBefore is whole seconds, so allow the callback to land a moment early.
  const note = await deliverLoveNote(await getDb(), id, { now: new Date(Date.now() + 60_000) });
  return c.json({ ok: true, delivered: Boolean(note) });
});

jobRoutes.post("/send-push", async (c) => {
  const caller = await authorize(c);
  if (!caller)
    return c.json(
      { error: "unauthorized", message: "This job needs a valid signature." },
      401,
    );
  let id, expectedTime;
  try {
    const payload = JSON.parse(caller.body ?? (await c.req.text()) ?? "{}");
    id = payload.id;
    expectedTime = payload.sendAt;
  } catch {
    id = null;
  }
  if (!id)
    return c.json({ error: "bad_request", message: "Missing push id." }, 400);

  const db = await getDb();
  const row = await claimPush(db, id, { expectedTime });
  // Already sent, or never existed: acknowledge so QStash stops retrying.
  if (!row) return c.json({ ok: true, skipped: true });

  try {
    const result = await sendToSubscribers(db, row.payload, {
      role: "kiriya",
      ttlSeconds: 3 * 60 * 60,
    });
    await db
      .update(schema.plannedPushes)
      .set({
        status: result.sent > 0 ? "sent" : "failed",
        sentAt: new Date(),
        detail: JSON.stringify(result),
      })
      .where(eq(schema.plannedPushes.id, id));
    return c.json({ ok: true, result });
  } catch (error) {
    await db
      .update(schema.plannedPushes)
      .set({ status: "failed", detail: error.message })
      .where(eq(schema.plannedPushes.id, id));
    return c.json({ ok: false, message: error.message }, 500);
  }
});
