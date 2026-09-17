import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { pushConfigured, sendToSubscribers } from "../push/webpush.js";
import { DEFAULT_NOTIFICATION_SETTINGS, planDay } from "../push/planner.js";
import { getOrCreateDay } from "../engine/day.js";
import { localDay } from "../lib/time.js";

export const pushRoutes = new Hono();

const subscriptionBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

pushRoutes.get("/status", async (c) => {
  const db = await getDb();
  const [settingsRow] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "notifications"));
  const subs = await db.select().from(schema.pushSubscriptions);
  return c.json({
    configured: pushConfigured(),
    settings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(settingsRow?.value ?? {}),
    },
    devices: subs.map((s) => ({
      id: s.id,
      role: s.role,
      lastSuccessAt: s.lastSuccessAt,
      lastError: s.lastError,
      createdAt: s.createdAt,
    })),
  });
});

// Called when notifications are switched on, and again every time the app opens (iOS can silently
// drop a subscription, and there's no event for it).
pushRoutes.post("/subscribe", async (c) => {
  const parsed = subscriptionBody.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json(
      {
        error: "bad_subscription",
        message: "That notification subscription looks incomplete.",
      },
      400,
    );
  const db = await getDb();
  const role = c.get("session").role;
  const { endpoint, keys } = parsed.data;
  await db
    .insert(schema.pushSubscriptions)
    .values({
      endpoint,
      keys,
      role,
      userAgent: c.req.header("user-agent")?.slice(0, 300),
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { keys, role, lastSeenAt: new Date() },
    });
  return c.json({ ok: true });
});

pushRoutes.post("/unsubscribe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.endpoint !== "string")
    return c.json({ error: "bad_request", message: "Missing endpoint." }, 400);
  const db = await getDb();
  await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, body.endpoint));
  return c.json({ ok: true });
});

pushRoutes.post("/test", async (c) => {
  if (!pushConfigured())
    return c.json(
      {
        error: "not_configured",
        message: "Notifications aren't set up on the server yet.",
      },
      503,
    );
  const db = await getDb();
  const result = await sendToSubscribers(
    db,
    {
      title: "Testing, testing ✦",
      body: "If you can read this, surprises will find you. — your apothecary",
      navigate: "/world",
    },
    { role: c.get("session").role, ttlSeconds: 600 },
  );
  if (!result.targets)
    return c.json(
      {
        error: "no_devices",
        message: "This device isn't subscribed yet. Turn on surprises first.",
      },
      409,
    );
  return c.json(result);
});

const settingsBody = z.object({
  enabled: z.boolean(),
  perDay: z.number().int().min(1).max(3),
  startHour: z.number().int().min(6).max(20),
  endHour: z.number().int().min(12).max(24),
});

pushRoutes.put("/settings", async (c) => {
  // These are Kiriya's delivery hours. An admin phone subscribes for test notes without changing them.
  if (c.get("session").role !== "kiriya")
    return c.json({ error: "hers_only", message: "Notification hours belong to Kiriya’s settings." }, 403);
  const parsed = settingsBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.endHour - parsed.data.startHour < 4) {
    return c.json(
      {
        error: "bad_settings",
        message: "Choose a window of at least four hours.",
      },
      400,
    );
  }
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key: "notifications", value: parsed.data })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: parsed.data, updatedAt: new Date() },
    });
  const day = localDay();
  await planDay(db, day, await getOrCreateDay(db, day), parsed.data);
  return c.json(parsed.data);
});
