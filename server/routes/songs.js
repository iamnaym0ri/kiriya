import { isUploadUrl } from "../lib/media.js";
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { fetchSongMeta, parseSongUrl } from "../lib/songs.js";
import { getJson } from "../lib/http.js";

export const songRoutes = new Hono();

export function present(row) {
  const parsed =
    row.kind === "upload"
      ? { provider: "audio", embedId: row.url }
      : parseSongUrl(row.url);
  return {
    id: row.id,
    kind: row.kind,
    provider: parsed.provider,
    embedId: parsed.embedId,
    url: row.url,
    title: row.title,
    artist: row.artist,
    thumbnail: row.thumbnail,
    album: row.data?.album ?? null,
    // Seconds, read from the file's own tags or YouTube's player when Josh added it.
    duration: row.data?.duration ?? null,
    addedBy: row.data?.addedBy ?? null,
    featured: row.featured,
    isPublic: row.isPublic,
    vocadbUrl: row.data?.vocadbId
      ? `https://vocadb.net/S/${row.data.vocadbId}`
      : null,
    createdAt: row.createdAt,
  };
}

async function vocadbLookup(parsed) {
  const service = { youtube: "Youtube", niconico: "NicoNicoDouga" }[
    parsed.provider
  ];
  if (!service) return null;
  try {
    const song = await getJson(
      `https://vocadb.net/api/songs/byPv?pvService=${service}&pvId=${encodeURIComponent(parsed.embedId)}&fields=Artists&lang=English`,
      { timeoutMs: 6000 },
    );
    return song?.id
      ? { id: song.id, title: song.name, artist: song.artistString }
      : null;
  } catch {
    return null;
  }
}

songRoutes.get("/", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.songs)
    .orderBy(desc(schema.songs.featured), desc(schema.songs.createdAt));
  return c.json({ songs: rows.map(present) });
});

const text = (max) => z.string().trim().max(max);
const duration = z.number().positive().max(60 * 60 * 3);
// Cover art Josh uploaded (or the picture inside the file, uploaded for it).
const artUrl = z.string().min(1).max(600).refine((url) => isUploadUrl(url, ["songs"]), "That picture isn’t one of ours.");
const addBody = z.union([
  z.object({
    url: z.string().min(8).max(500),
    title: text(120).min(1).optional(),
    artist: text(120).optional(),
    duration: duration.optional(),
    thumbnail: artUrl.optional(),
  }),
  z.object({
    upload: z.object({
      url: z.string().min(1).max(600),
      title: text(120).min(1),
      artist: text(120).optional().default(""),
      album: text(120).optional().default(""),
      duration: duration.optional(),
      thumbnail: artUrl.optional(),
      art: z.enum(["tags", "lookup", "own"]).optional(),
    }),
  }),
]);

const patchBody = z
  .object({
    featured: z.literal(true).optional(),
    isPublic: z.boolean().optional(),
    title: text(120).min(1).optional(),
    artist: text(120).optional(),
    album: text(120).optional(),
    duration: duration.nullable().optional(),
    thumbnail: artUrl.nullable().optional(),
  })
  .strict();

songRoutes.post("/", async (c) => {
  const parsedBody = addBody.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success)
    return c.json(
      {
        error: "bad_song",
        message: "Paste a song link, or upload an audio file with a title.",
      },
      400,
    );
  const db = await getDb();
  // Her first song becomes the one on the public profile automatically.
  const first =
    (await db.select({ id: schema.songs.id }).from(schema.songs).limit(1))
      .length === 0;

  const addedBy = c.get("session").role;
  let values;
  if ("url" in parsedBody.data) {
    const parsed = parseSongUrl(parsedBody.data.url);
    if (parsed.error)
      return c.json({ error: "bad_link", message: parsed.error }, 400);
    const [meta, vocadb] = await Promise.all([
      fetchSongMeta(parsed),
      vocadbLookup(parsed),
    ]);
    const given = parsedBody.data;
    values = {
      kind: "link",
      provider: parsed.provider,
      url: parsed.url,
      title: given.title ?? vocadb?.title ?? meta.title ?? "A favourite song",
      artist: given.artist ?? vocadb?.artist ?? meta.artist ?? null,
      thumbnail:
        given.thumbnail ??
        meta.thumbnail ??
        (parsed.provider === "youtube"
          ? `https://i.ytimg.com/vi/${parsed.embedId}/hqdefault.jpg`
          : null),
      data: { addedBy, ...(vocadb ? { vocadbId: vocadb.id } : {}), ...(given.duration ? { duration: given.duration } : {}) },
    };
  } else {
    const { url, title, artist, album, duration: length, thumbnail, art } = parsedBody.data.upload;
    const allowed = isUploadUrl(url, ["songs"]);
    if (!allowed)
      return c.json(
        {
          error: "bad_song",
          message: "Audio has to be uploaded through the stage.",
        },
        400,
      );
    values = {
      kind: "upload",
      provider: "audio",
      url,
      title,
      artist: artist || null,
      thumbnail: thumbnail ?? null,
      data: { addedBy, ...(album ? { album } : {}), ...(length ? { duration: length } : {}), ...(thumbnail && art ? { art } : {}) },
    };
  }

  const [row] = await db
    .insert(schema.songs)
    .values({
      ...values,
      featured: first && values.kind === "link",
      isPublic: first && values.kind === "link",
    })
    .returning();
  return c.json(present(row));
});

songRoutes.patch("/:id", async (c) => {
  const parsed = patchBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return c.json({ error: "bad_song", message: "Check the song’s details and try again." }, 400);
  const body = parsed.data;
  const db = await getDb();
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success)
    return c.json({ error: "not_found", message: "That song isn't on your list anymore." }, 404);
  const [current] = await db.select().from(schema.songs).where(eq(schema.songs.id, id));
  if (!current)
    return c.json(
      { error: "not_found", message: "That song isn't on your list anymore." },
      404,
    );
  if (body.featured === true) {
    await db.update(schema.songs).set({ featured: false });
    await db
      .update(schema.songs)
      .set({ featured: true, isPublic: true })
      .where(eq(schema.songs.id, id));
  }
  const set = {};
  if (typeof body.isPublic === "boolean") set.isPublic = body.isPublic;
  if (body.title !== undefined) set.title = body.title;
  if (body.artist !== undefined) set.artist = body.artist || null;
  if (body.thumbnail !== undefined) set.thumbnail = body.thumbnail;
  if (body.album !== undefined || body.duration !== undefined) {
    const data = { ...(current.data ?? {}) };
    if (body.album !== undefined) {
      if (body.album) data.album = body.album;
      else delete data.album;
    }
    if (body.duration !== undefined) {
      if (body.duration) data.duration = body.duration;
      else delete data.duration;
    }
    set.data = data;
  }
  if (Object.keys(set).length) await db.update(schema.songs).set(set).where(eq(schema.songs.id, id));
  const [row] = await db
    .select()
    .from(schema.songs)
    .where(eq(schema.songs.id, id));
  return c.json(present(row));
});

songRoutes.delete("/:id", async (c) => {
  const db = await getDb();
  await db.delete(schema.songs).where(eq(schema.songs.id, c.req.param("id")));
  return c.json({ ok: true });
});
