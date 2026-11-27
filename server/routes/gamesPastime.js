// The pastime games' little bit of shared state on the server (owner: the games-pastime agent).
// Today: the photos Josh puts in "us, in pieces" (the slide puzzle). Both of them can read the list;
// only Josh changes it, from the game's own screen. Stored in the `settings` key-value table.
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { isUploadUrl } from "../lib/media.js";

export const SLIDE_PHOTOS_KEY = "games.pastime.slidePhotos";
export const MAX_SLIDE_PHOTOS = 40;

const photoSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().max(600).refine((url) => isUploadUrl(url, ["photos"]), "Add the photo from your phone first."),
  caption: z.string().trim().max(80).optional().default(""),
  addedAt: z.string().datetime().optional(),
});
const listSchema = z.object({ photos: z.array(photoSchema).max(MAX_SLIDE_PHOTOS, `Up to ${MAX_SLIDE_PHOTOS} photos.`) });

export async function readSlidePhotos(db) {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, SLIDE_PHOTOS_KEY));
  return Array.isArray(row?.value) ? row.value : [];
}

export const pastimeRoutes = new Hono();

pastimeRoutes.get("/slide-photos", async (c) => {
  const db = await getDb();
  return c.json({ photos: await readSlidePhotos(db) });
});

pastimeRoutes.put("/slide-photos", async (c) => {
  if (c.get("session")?.role !== "admin")
    return c.json({ error: "forbidden", message: "Only Josh can change the photos." }, 403);
  const body = await c.req.json().catch(() => null);
  const parsed = listSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "bad_photos", message: parsed.error.issues[0]?.message ?? "Those photos can't be saved." }, 400);
  const now = new Date().toISOString();
  const photos = parsed.data.photos.map((photo) => ({
    id: photo.id ?? randomUUID(),
    url: photo.url,
    caption: photo.caption,
    addedAt: photo.addedAt ?? now,
  }));
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key: SLIDE_PHOTOS_KEY, value: photos })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: photos, updatedAt: new Date() } });
  return c.json({ photos });
});
