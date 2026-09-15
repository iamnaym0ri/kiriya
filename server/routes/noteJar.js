import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { readNoteJar, pullNote, noteHistory, keepNote } from "../lib/noteJar.js";

export const noteJarRoutes = new Hono();
const pullBody = z.object({ requestId: z.string().uuid() }).strict();
const keepBody = z.object({ id: z.string().uuid(), saved: z.boolean() }).strict();
const historyQuery = z.object({ before: z.coerce.number().int().positive().max(2147483647).optional(), saved: z.enum(["true", "false"]).optional() }).strict();
noteJarRoutes.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
noteJarRoutes.get("/", async c => c.json(await readNoteJar(await getDb())));
noteJarRoutes.post("/pull", async c => {
  const parsed = pullBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_pull", message: "Try pulling that note again." }, 400);
  try {
    return c.json(await pullNote(await getDb(), parsed.data.requestId, { preview: c.get("session").role === "admin" }));
  } catch (error) {
    if (error.status === 409) return c.json({ error: "jar_busy", message: "The jar got a little tangled. Try again." }, 409);
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
  if (c.get("session").role === "admin") return c.json({ error: "preview_only", message: "Preview notes don’t change Kiriya’s collection." }, 403);
  const record = await keepNote(await getDb(), parsed.data.id, parsed.data.saved);
  return record ? c.json(record) : c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
});
