import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { localDay } from "../lib/time.js";
import { birthdayInfo } from "../lib/birthday.js";
import { parseSongUrl } from "../lib/songs.js";
import {
  defaultSong,
  publicProfileDefaults,
} from "../content/publicProfile.js";

export const publicRoutes = new Hono();

async function totalViews(db) {
  const [{ total }] = await db
    .select({ total: sql`coalesce(sum(${schema.views.count}), 0)::int` })
    .from(schema.views);
  return total;
}

publicRoutes.get("/profile", async (c) => {
  const db = await getDb();
  const [override] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "public_profile"));
  const profile = { ...publicProfileDefaults, ...(override?.value ?? {}) };

  const [featured] = await db
    .select()
    .from(schema.songs)
    .where(
      and(eq(schema.songs.featured, true), eq(schema.songs.isPublic, true)),
    )
    .orderBy(desc(schema.songs.createdAt))
    .limit(1);

  let song = defaultSong;
  if (featured) {
    const parsed =
      featured.kind === "upload"
        ? { provider: "audio", embedId: featured.url }
        : parseSongUrl(featured.url);
    song = {
      kind: featured.kind,
      ...parsed,
      url: featured.url,
      title: featured.title,
      artist: featured.artist,
      thumbnail: featured.thumbnail,
    };
  }

  c.header(
    "Cache-Control",
    "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
  );
  return c.json({
    ...profile,
    views: profile.showViews ? await totalViews(db) : null,
    song,
    birthday: birthdayInfo(),
  });
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
  return c.json({ views: await totalViews(db) });
});
