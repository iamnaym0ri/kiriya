import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import {
  JAR_FEELINGS,
  JAR_NOTE_MAX,
  addJarNote,
  deleteJarNote,
  editJarNote,
  listJarNotes,
  scheduleJarAnnouncement,
} from "../lib/noteJar.js";

// Josh writes the jar's notes here, one at a time (admin only; mounted under /admin/note-jar).
export const adminNoteJarRoutes = new Hono();
const text = z.string().trim().min(1).max(JAR_NOTE_MAX);
const feelings = z.array(z.enum(JAR_FEELINGS)).max(JAR_FEELINGS.length);
const addBody = z.object({ text, feelings: feelings.default([]) }).strict();
const editBody = z.object({ text: text.optional(), feelings: feelings.optional(), releaseNow: z.literal(true).optional() }).strict()
  .refine((body) => body.text !== undefined || body.feelings !== undefined || body.releaseNow);
const id = z.string().uuid();

adminNoteJarRoutes.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
adminNoteJarRoutes.get("/", async (c) => c.json(await listJarNotes(await getDb())));

adminNoteJarRoutes.post("/", async (c) => {
  const parsed = addBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ error: "bad_note", message: `A note needs some words, up to ${JAR_NOTE_MAX} characters.` }, 400);
  const db = await getDb();
  const row = await addJarNote(db, parsed.data);
  // The note is saved either way; a scheduler hiccup only means the 08:00 cron announces it.
  const schedule = await scheduleJarAnnouncement(db, row).catch(() => ({ scheduled: false, error: "The morning reminder couldn’t be scheduled; the daily job will still announce it." }));
  return c.json({ id: row.id, releaseAt: row.releaseAt.toISOString(), schedule }, 201);
});

adminNoteJarRoutes.patch("/:id", async (c) => {
  const noteId = id.safeParse(c.req.param("id"));
  const parsed = editBody.safeParse(await c.req.json().catch(() => null));
  if (!noteId.success || !parsed.success) return c.json({ error: "bad_note", message: "That edit couldn’t be saved." }, 400);
  const row = await editJarNote(await getDb(), noteId.data, parsed.data);
  return row ? c.json({ id: row.id }) : c.json({ error: "not_found", message: "That note isn’t in the jar any more." }, 404);
});

adminNoteJarRoutes.delete("/:id", async (c) => {
  const noteId = id.safeParse(c.req.param("id"));
  if (!noteId.success) return c.json({ error: "bad_note", message: "That note couldn’t be found." }, 400);
  return (await deleteJarNote(await getDb(), noteId.data))
    ? c.json({ ok: true })
    : c.json({ error: "not_found", message: "That note isn’t in the jar any more." }, 404);
});
