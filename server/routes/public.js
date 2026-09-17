import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { localDay } from "../lib/time.js";
import { buildPublicProfile } from "../lib/publicProfile.js";

export const publicRoutes = new Hono();

publicRoutes.get("/profile", async (c) => {
  const profile = await buildPublicProfile(await getDb(), "kiriya");
  // Browsers always ask again; only Vercel's CDN keeps a copy, briefly, so a changed mood or a new
  // pin reaches her friends within about a minute.
  c.header("Cache-Control", "public, max-age=0, must-revalidate");
  c.header("Vercel-CDN-Cache-Control", "max-age=15, stale-while-revalidate=45");
  return c.json(profile);
});

// Counts one profile view and returns the running total (the eye icon on the profile card).
publicRoutes.post("/view", async (c) => {
  const db = await getDb();
  const day = localDay();
  await db
    .insert(schema.views)
    .values({ day, count: 1 })
    .onConflictDoUpdate({
      target: schema.views.day,
      set: { count: sql`${schema.views.count} + 1` },
    });
  const [{ total }] = await db.select({ total: sql`coalesce(sum(${schema.views.count}), 0)::int` }).from(schema.views);
  return c.json({ views: total });
});
