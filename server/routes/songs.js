import { isUploadUrl } from "../lib/media.js";
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { fetchSongMeta, parseSongUrl } from "../lib/songs.js";
import { getJson } from "../lib/http.js";

export const songRoutes = new Hono();

function present(row) {
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

const addBody = z.union([
  z.object({ url: z.string().min(8).max(500) }),
  z.object({
    upload: z.object({
      url: z.string().min(1).max(600),
      title: z.string().trim().min(1).max(120),
      artist: z.string().trim().max(120).optional().default(""),
    }),
  }),
]);

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

  let values;
  if ("url" in parsedBody.data) {
    const parsed = parseSongUrl(parsedBody.data.url);
    if (parsed.error)
      return c.json({ error: "bad_link", message: parsed.error }, 400);
    const [meta, vocadb] = await Promise.all([
      fetchSongMeta(parsed),
      vocadbLookup(parsed),
    ]);
    values = {
      kind: "link",
      provider: parsed.provider,
      url: parsed.url,
      title: vocadb?.title ?? meta.title ?? "A favourite song",
      artist: vocadb?.artist ?? meta.artist ?? null,
      thumbnail:
        meta.thumbnail ??
        (parsed.provider === "youtube"
          ? `https://i.ytimg.com/vi/${parsed.embedId}/hqdefault.jpg`
          : null),
      data: vocadb ? { vocadbId: vocadb.id } : null,
    };
  } else {
    const { url, title, artist } = parsedBody.data.upload;
    const allowed = isUploadUrl(url);
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
      thumbnail: null,
      data: null,
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
  const body = await c.req.json().catch(() => ({}));
  const db = await getDb();
  const id = c.req.param("id");
  if (body.featured === true) {
    await db.update(schema.songs).set({ featured: false });
    await db
      .update(schema.songs)
      .set({ featured: true, isPublic: true })
      .where(eq(schema.songs.id, id));
  }
  if (typeof body.isPublic === "boolean")
    await db
      .update(schema.songs)
      .set({ isPublic: body.isPublic })
      .where(eq(schema.songs.id, id));
  const [row] = await db
    .select()
    .from(schema.songs)
    .where(eq(schema.songs.id, id));
  if (!row)
    return c.json(
      { error: "not_found", message: "That song isn't on your list anymore." },
      404,
    );
  return c.json(present(row));
});

songRoutes.delete("/:id", async (c) => {
  const db = await getDb();
  await db.delete(schema.songs).where(eq(schema.songs.id, c.req.param("id")));
  return c.json({ ok: true });
});
