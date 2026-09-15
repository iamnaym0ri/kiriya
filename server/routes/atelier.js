import { isUploadUrl } from "../lib/media.js";
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { approvedCosplay } from "../content/collection.js";

export const atelierRoutes = new Hono();

// Photograph records reuse the existing cosplay table; older planning fields remain stored.
const projectBody = z.object({
  character: z.string().trim().min(1).max(80),
  series: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  coverUrl: z.string().max(600).refine(isUploadUrl).nullable().optional(),
});

atelierRoutes.get("/cosplay", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.cosplayProjects)
    .orderBy(desc(schema.cosplayProjects.updatedAt));
  return c.json({
    projects: rows.map(
      ({ id, character, series, notes, coverUrl, updatedAt }) => ({
        id,
        character,
        series,
        notes,
        coverUrl,
        updatedAt,
      }),
    ),
  });
});

atelierRoutes.post("/cosplay", async (c) => {
  const parsed = projectBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_project",
        message: "Give the cosplay a character name (up to 80 characters).",
      },
      400,
    );
  const db = await getDb();
  const [row] = await db
    .insert(schema.cosplayProjects)
    .values({
      ...parsed.data,
    })
    .returning();
  return c.json(row);
});

atelierRoutes.patch("/cosplay/:id", async (c) => {
  const parsed = projectBody
    .partial()
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      { error: "bad_project", message: "Some of those changes don't fit." },
      400,
    );
  const db = await getDb();
  const [row] = await db
    .update(schema.cosplayProjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.cosplayProjects.id, c.req.param("id")))
    .returning();
  if (!row)
    return c.json(
      {
        error: "not_found",
        message: "That photograph isn't in your lookbook.",
      },
      404,
    );
  return c.json(row);
});

atelierRoutes.delete("/cosplay/:id", async (c) => {
  const db = await getDb();
  await db
    .delete(schema.cosplayProjects)
    .where(eq(schema.cosplayProjects.id, c.req.param("id")));
  return c.json({ ok: true });
});

// Stored costume photographs remain. Planning data is preserved in the database.
atelierRoutes.get("/library", (c) => c.json({ tips: approvedCosplay }));
