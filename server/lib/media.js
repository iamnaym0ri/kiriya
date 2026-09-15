import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
export function isUploadUrl(url) {
  if (typeof url !== "string") return false;
  if (
    /^\/api\/uploads\/file\/(art|avatar|cosplay|songs|photos)-[a-f0-9]{16}\.(png|jpg|webp|mp3|m4a|aac|wav)$/.test(
      url,
    )
  )
    return true;
  if (url.startsWith("/api/uploads/media?path=")) {
    const p = new URL(url, "http://local").searchParams.get("path");
    return /^(art|avatar|cosplay|songs|photos)\/[a-zA-Z0-9._-]+$/.test(p ?? "");
  }
  return false;
}
export async function isPublicMedia(url) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "public_profile"));
  const p = row?.value ?? {};
  if (p.avatarUrl === url || p.cosplays?.some((c) => c.photoUrl === url))
    return true;
  const [song] = await db
    .select({ id: schema.songs.id })
    .from(schema.songs)
    .where(
      and(
        eq(schema.songs.url, url),
        eq(schema.songs.featured, true),
        eq(schema.songs.isPublic, true),
      ),
    )
    .limit(1);
  return Boolean(song);
}
