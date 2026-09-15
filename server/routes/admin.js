import { isUploadUrl } from "../lib/media.js";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { blobUploadMode } from "../lib/blob.js";
import { isPassphraseHash } from "../auth/passphrase.js";
import { localDay } from "../lib/time.js";
import { runDailyAndPlan } from "./jobs.js";
import { claimPush, qstashConfigured } from "../push/planner.js";
import { pushConfigured, sendToSubscribers } from "../push/webpush.js";
import { COLLECTION_VERSION } from "../content/collection.js";
import { kiriya } from "../content/kiriya.js";
import { publicProfileDefaults } from "../content/publicProfile.js";

export const adminRoutes = new Hono();

async function getSetting(db, key, fallback) {
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));
  return row?.value ?? fallback;
}

async function putSetting(db, key, value) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, updatedAt: new Date() },
    });
}

// ---------- status ----------

adminRoutes.get("/status", async (c) => {
  const db = await getDb();
  const [subs, [today]] = await Promise.all([
    db.select().from(schema.pushSubscriptions),
    db.select().from(schema.days).where(eq(schema.days.day, localDay())),
  ]);
  return c.json({
    day: localDay(),
    services: {
      database: env.databaseUrl
        ? "Neon Postgres"
        : "local PGlite (development)",
      passphrases: isPassphraseHash(env.kiriyaPassphraseHash) && isPassphraseHash(env.adminPassphraseHash),
      sessions: Boolean(env.sessionSecret),
      collection: `Selected collection v${COLLECTION_VERSION}`,
      scheduler: qstashConfigured(),
      cronSecret: Boolean(env.cronSecret),
      push: pushConfigured(),
      fileStorage: Boolean(blobUploadMode()),
    },
    devices: subs.map((s) => ({
      role: s.role,
      lastSuccessAt: s.lastSuccessAt,
      lastError: s.lastError,
      userAgent: s.userAgent,
    })),
    today: today
      ? {
          writer: today.writer,
          generatedAt: today.generatedAt,
          collectionVersion: today.bundle.collectionVersion ?? null,
          cards: today.bundle.cards?.length ?? 0,
        }
      : null,
  });
});

// ---------- daily job and pushes ----------

adminRoutes.post("/daily/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const db = await getDb();
  const result = await runDailyAndPlan(db, localDay(), {
    force: Boolean(body.force),
  });
  return c.json(result);
});

adminRoutes.get("/days", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.days)
    .orderBy(desc(schema.days.day))
    .limit(14);
  return c.json(
    rows.map((r) => ({
      day: r.day,
      writer: r.writer,
      generatedAt: r.generatedAt,
      finds: r.bundle.finds?.length ?? 0,
      song: r.bundle.song?.title ?? null,
    })),
  );
});

adminRoutes.get("/pushes", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.plannedPushes)
    .orderBy(desc(schema.plannedPushes.sendAt))
    .limit(40);
  return c.json(rows);
});

adminRoutes.post("/pushes/:id/send-now", async (c) => {
  const db = await getDb();
  const row = await claimPush(db, c.req.param("id"), { allowEarly: true });
  if (!row)
    return c.json(
      {
        error: "not_pending",
        message: "That push was already sent or doesn't exist.",
      },
      409,
    );
  const result = await sendToSubscribers(db, row.payload, { role: "kiriya" });
  await db
    .update(schema.plannedPushes)
    .set({
      status: result.sent ? "sent" : "failed",
      sentAt: new Date(),
      detail: JSON.stringify(result),
    })
    .where(eq(schema.plannedPushes.id, row.id));
  return c.json(result);
});

adminRoutes.post("/pushes/custom", async (c) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(40),
      body: z.string().trim().min(1).max(110),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success)
    return c.json(
      {
        error: "bad_push",
        message: "A title up to 40 characters and a message up to 110.",
      },
      400,
    );
  if (!pushConfigured())
    return c.json(
      {
        error: "not_configured",
        message: "Push keys aren't set on the server.",
      },
      503,
    );
  const db = await getDb();
  const result = await sendToSubscribers(
    db,
    { ...body.data, navigate: "/world" },
    { role: "kiriya" },
  );
  if (!result.targets)
    return c.json(
      {
        error: "no_devices",
        message: "Kiriya hasn't turned on surprises on any device yet.",
      },
      409,
    );
  return c.json(result);
});

// ---------- letters ----------

const letterBody = z.object({
  kind: z.enum(["birthday", "open_when", "note"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20_000),
  openWhen: z.string().trim().max(120).nullable().optional(),
  unlockAt: z.string().datetime({ offset: true }).nullable().optional(),
});

adminRoutes.get("/letters", async (c) => {
  const db = await getDb();
  return c.json(
    await db
      .select()
      .from(schema.letters)
      .orderBy(desc(schema.letters.createdAt)),
  );
});

adminRoutes.post("/letters", async (c) => {
  const parsed = letterBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_letter",
        message: "Give the letter a title and some words.",
      },
      400,
    );
  const db = await getDb();
  const { unlockAt, ...rest } = parsed.data;
  const [row] = await db
    .insert(schema.letters)
    .values({
      ...rest,
      author: "giver",
      unlockAt: unlockAt ? new Date(unlockAt) : null,
    })
    .returning();
  return c.json(row);
});

adminRoutes.put("/letters/:id", async (c) => {
  const parsed = letterBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_letter",
        message: "Give the letter a title and some words.",
      },
      400,
    );
  const db = await getDb();
  const { unlockAt, ...rest } = parsed.data;
  const [row] = await db
    .update(schema.letters)
    .set({
      ...rest,
      unlockAt: unlockAt ? new Date(unlockAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.letters.id, c.req.param("id")))
    .returning();
  return row
    ? c.json(row)
    : c.json({ error: "not_found", message: "That letter is gone." }, 404);
});

adminRoutes.delete("/letters/:id", async (c) => {
  const db = await getDb();
  await db
    .delete(schema.letters)
    .where(eq(schema.letters.id, c.req.param("id")));
  return c.json({ ok: true });
});

// ---------- notes sprinkled into days ----------

adminRoutes.get("/notes", async (c) => {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.kv)
    .where(eq(schema.kv.key, "admin:notes"));
  return c.json({ notes: row?.value ?? [] });
});

adminRoutes.put("/notes", async (c) => {
  const parsed = z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        text: z.string().trim().min(1).max(280),
      }),
    )
    .max(200)
    .safeParse((await c.req.json().catch(() => ({}))).notes);
  if (!parsed.success)
    return c.json(
      { error: "bad_notes", message: "Each note can be up to 280 characters." },
      400,
    );
  const notes = parsed.data.map((n) => ({
    id: n.id ?? randomUUID().slice(0, 8),
    text: n.text,
  }));
  const db = await getDb();
  await db
    .insert(schema.kv)
    .values({ key: "admin:notes", value: notes })
    .onConflictDoUpdate({
      target: schema.kv.key,
      set: { value: notes, updatedAt: new Date() },
    });
  return c.json({ notes });
});

// ---------- signature and public profile media ----------

adminRoutes.get("/profile", async (c) => {
  const db = await getDb();
  const profile = {
    ...publicProfileDefaults,
    ...(await getSetting(db, "public_profile", {})),
  };
  return c.json({
    signature: await getSetting(db, "signature", kiriya.signature),
    avatarUrl: profile.avatarUrl,
    cosplays: profile.cosplays,
  });
});

adminRoutes.put("/signature", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const signature =
    typeof body.signature === "string"
      ? body.signature.trim().slice(0, 40)
      : "";
  if (!signature)
    return c.json(
      { error: "bad_signature", message: "The signature can't be empty." },
      400,
    );
  const db = await getDb();
  await putSetting(db, "signature", signature);
  return c.json({ signature });
});

const mediaUrl = z
  .string()
  .max(600)
  .refine((url) => isUploadUrl(url), "Upload through the admin desk");

adminRoutes.put("/profile/media", async (c) => {
  const parsed = z
    .object({
      avatarUrl: mediaUrl.nullable().optional(),
      cosplays: z
        .array(
          z.object({
            character: z.string().trim().min(1).max(80),
            series: z.string().trim().max(80),
            photoUrl: mediaUrl.nullable(),
          }),
        )
        .max(24)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_media",
        message: parsed.error.issues[0]?.message ?? "Those changes don't fit.",
      },
      400,
    );
  const db = await getDb();
  const current = await getSetting(db, "public_profile", {});
  const next = { ...current, ...parsed.data };
  await putSetting(db, "public_profile", next);
  return c.json({ ok: true });
});
