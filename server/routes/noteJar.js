import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { isReaction } from "../../shared/reactions.js";
import { readNoteJar, pullNote, peekNote, noteHistory, keepNote, reactToPull, herJarMarks } from "../lib/noteJar.js";

// Her note jar (mounted under /me/note-jar). No daily limit: she pulls as often as she likes. The
// app fetches the next note ahead (`next`), so a tap shows it at once; the pull then keeps that note.
export const noteJarRoutes = new Hono();
const noteId = z.string().min(1).max(64);
// Josh's previews skip the notes he has just looked at, so "another one" goes round the whole jar.
const exclude = z.array(z.string().uuid()).max(60).default([]);
const pullBody = z.object({ requestId: z.string().uuid(), prefer: noteId.nullish(), exclude }).strict();
const keepBody = z.object({ id: z.string().uuid(), saved: z.boolean() }).strict();
const reactionBody = z.object({ reaction: z.string().refine(isReaction).nullable() }).strict();
const historyQuery = z.object({ before: z.coerce.number().int().positive().max(2147483647).optional(), saved: z.enum(["true", "false"]).optional() }).strict();
const isPreview = (c) => c.get("session").role === "admin";

/** The jar's counts plus the next note, after a pull too (so the one after is ready as well). */
async function summary(db, preview, excluded = []) {
  const [jar, next] = await Promise.all([readNoteJar(db), peekNote(db, { preview, exclude: excluded })]);
  return { fresh: jar.fresh, total: jar.total, pulled: jar.pulled, next };
}

/** On Josh's phone, a preview pull says how that note has fared with her. */
async function withHerMarks(db, record) {
  if (!record.preview || record.sample) return record;
  const marks = await herJarMarks(db, [record.note.id]);
  return { ...record, her: marks.get(record.note.id) ?? { pulls: 0, lastAt: null, reaction: null } };
}

noteJarRoutes.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
noteJarRoutes.get("/", async c => {
  const db = await getDb();
  const [jar, next] = await Promise.all([readNoteJar(db), peekNote(db, { preview: isPreview(c) })]);
  return c.json({ ...jar, next });
});
noteJarRoutes.post("/pull", async c => {
  const parsed = pullBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_pull", message: "Try pulling that note again." }, 400);
  const preview = isPreview(c);
  const db = await getDb();
  try {
    const { requestId, prefer, exclude: excluded } = parsed.data;
    const record = await pullNote(db, requestId, { preview, prefer, exclude: excluded });
    const after = await summary(db, preview, preview ? [...excluded, record.note.id].slice(-60) : []);
    return c.json({ ...(await withHerMarks(db, record)), jar: after });
  } catch (error) {
    if (error.status === 409) return c.json({ error: "jar_busy", message: "The jar got a little tangled. Try again." }, 409);
    if (error.code === "jar_empty") return c.json({ error: "jar_empty", message: "The jar is waiting for its first notes." }, 404);
    throw error;
  }
});
noteJarRoutes.get("/history", async c => {
  const parsed = historyQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "bad_page", message: "That page of notes couldn’t open." }, 400);
  return c.json(await noteHistory(await getDb(), { before: parsed.data.before, saved: parsed.data.saved === "true" }));
});
noteJarRoutes.put("/keep", async c => {
  const parsed = keepBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_note", message: "That little note couldn’t be saved." }, 400);
  if (isPreview(c)) return c.json({ error: "preview_only", message: "Preview notes don’t change Kiriya’s collection." }, 403);
  const record = await keepNote(await getDb(), parsed.data.id, parsed.data.saved);
  return record ? c.json(record) : c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
});
// Her heart or emoji on a note she pulled. Reactions are hers to give; Josh sees them on his jar notes.
noteJarRoutes.put("/:id/reaction", async c => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
  if (isPreview(c)) return c.json({ error: "preview_only", message: "Reactions on her jar notes are Kiriya’s to give." }, 403);
  const parsed = reactionBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_reaction", message: "A heart or one emoji, please." }, 400);
  const record = await reactToPull(await getDb(), id.data, parsed.data.reaction);
  return record ? c.json(record) : c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
});
