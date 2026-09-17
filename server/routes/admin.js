import { isUploadUrl } from "../lib/media.js";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { blobUploadMode } from "../lib/blob.js";
import { isPassphraseHash } from "../auth/passphrase.js";
import { newSessionKey, readCredential, writeCredential } from "../auth/credentials.js";
import { localDay } from "../lib/time.js";
import { runDailyAndPlan } from "./jobs.js";
import { claimPush, qstashConfigured } from "../push/planner.js";
import { pushConfigured, sendToSubscribers } from "../push/webpush.js";
import { COLLECTION_VERSION } from "../content/collection.js";
import { kiriya } from "../content/kiriya.js";
import { publicProfileDefaults } from "../content/publicProfile.js";
import { reactionBody, sendOrSchedule } from "./loveNotes.js";
import { ARTWORK_NOTE_MAX, addArtworkNote, artworkLink, artworksWithNotes, deleteArtworkNote, reactToArtwork } from "../lib/artworkNotes.js";
import { notificationPreview } from "../lib/loveNotes.js";

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

// ---------- passphrase recovery ----------

adminRoutes.get("/credentials", async (c) => {
  const db = await getDb();
  const [kiriyaRow, adminRow] = await Promise.all([readCredential("kiriya", db), readCredential("admin", db)]);
  const describe = (row) => ({ custom: Boolean(row?.hash), changedAt: row?.changedAt ?? null });
  return c.json({ kiriya: describe(kiriyaRow), admin: describe(adminRow) });
});

// If Kiriya forgets a phrase she chose, the one configured in Vercel opens her world again.
// Her devices are signed out so the reset can't leave a forgotten session behind.
adminRoutes.post("/credentials/kiriya/reset", async (c) => {
  await writeCredential(await getDb(), "kiriya", { hash: null, sessionKey: newSessionKey() });
  return c.json({ ok: true });
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

// What her phone shows for a new letter. The test route sends the same thing to the admin's phone.
const letterAnnouncement = (title) => ({
  kind: "update",
  title: "a new letter for you ✉",
  body: `“${title}” is waiting in your letters ♡`,
  link: "/world/letters",
});

// Try a letter's notification on the admin's own phone without saving a letter she would see.
adminRoutes.post("/letters/test-announcement", async (c) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_letter", message: "Give the letter a title first." }, 400);
  return c.json(await sendOrSchedule(await getDb(), { ...letterAnnouncement(parsed.data.title), recipient: "admin", sendAt: new Date() }));
});

const letterBody = z.object({
  kind: z.enum(["birthday", "open_when", "note"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20_000),
  openWhen: z.string().trim().max(120).nullable().optional(),
  unlockAt: z.string().datetime({ offset: true }).nullable().optional(),
  // New letters only: let Kiriya's phone know, when it's written or when it unlocks.
  notify: z.boolean().optional(),
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
  const { unlockAt, notify, ...rest } = parsed.data;
  const [row] = await db
    .insert(schema.letters)
    .values({
      ...rest,
      author: "giver",
      unlockAt: unlockAt ? new Date(unlockAt) : null,
    })
    .returning();
  const announcement = notify
    ? await sendOrSchedule(db, {
        ...letterAnnouncement(row.title),
        recipient: "kiriya",
        sendAt: row.unlockAt && row.unlockAt.getTime() > Date.now() ? row.unlockAt : new Date(),
      })
    : null;
  return c.json({ ...row, announcement });
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
  const { unlockAt, notify: _notify, ...rest } = parsed.data;
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

// ---------- her doodles, and little notes left on them ----------

adminRoutes.get("/artworks", async (c) => c.json({ artworks: await artworksWithNotes(await getDb()) }));

const artworkNoteBody = z.object({
  body: z.string().trim().min(1).max(ARTWORK_NOTE_MAX),
  // Let her phone know, with a link that opens the doodle.
  notify: z.boolean().optional(),
});

adminRoutes.post("/artworks/:id/notes", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That doodle is gone." }, 404);
  const parsed = artworkNoteBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_note", message: `A little note, up to ${ARTWORK_NOTE_MAX} characters.` }, 400);
  const db = await getDb();
  const added = await addArtworkNote(db, id, parsed.data.body);
  if (!added) return c.json({ error: "not_found", message: "That doodle is gone." }, 404);
  const announcement = parsed.data.notify
    ? await sendOrSchedule(db, {
        recipient: "kiriya",
        kind: "note",
        title: "a little note on your doodle ✎",
        body: notificationPreview(`on “${added.artwork.prompt || "a little untitled thing"}”: ${added.note.body}`, 900),
        link: artworkLink(id),
        sendAt: new Date(),
      })
    : null;
  return c.json({ note: added.note, announcement });
});

// A heart or one emoji on her doodle. She sees it beside the doodle in her gallery.
adminRoutes.put("/artworks/:id/reaction", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That doodle is gone." }, 404);
  const parsed = reactionBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_reaction", message: "A heart or one emoji, please." }, 400);
  const artwork = await reactToArtwork(await getDb(), id, parsed.data.reaction);
  return artwork ? c.json(artwork) : c.json({ error: "not_found", message: "That doodle is gone." }, 404);
});

adminRoutes.delete("/artworks/notes/:noteId", async (c) => {
  const noteId = c.req.param("noteId");
  const note = z.string().uuid().safeParse(noteId).success ? await deleteArtworkNote(await getDb(), noteId) : null;
  return note ? c.json({ ok: true }) : c.json({ error: "not_found", message: "That note is already gone." }, 404);
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
