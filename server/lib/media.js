import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { readPersonState, resolvePrefs } from "./personState.js";
import { UPLOAD_FOLDERS } from "../../shared/uploadFolders.js";
const FOLDERS = UPLOAD_FOLDERS.join("|");
const LOCAL_FILE = new RegExp(`^\\/api\\/uploads\\/file\\/(${FOLDERS})-[a-f0-9]{16}\\.(png|jpg|webp|gif|mp3|m4a|aac|wav|webm)$`);
const BLOB_PATH = new RegExp(`^(${FOLDERS})\\/[a-zA-Z0-9._-]+$`);
/** A private upload URL this site issued, optionally limited to some folders. */
export function isUploadUrl(url, folders = UPLOAD_FOLDERS) {
  if (typeof url !== "string") return false;
  let folder = null;
  if (LOCAL_FILE.test(url)) folder = url.slice("/api/uploads/file/".length).split("-")[0];
  else if (url.startsWith("/api/uploads/media?path=")) {
    const p = new URL(url, "http://local").searchParams.get("path");
    if (BLOB_PATH.test(p ?? "")) folder = p.split("/")[0];
  }
  return Boolean(folder && folders.includes(folder));
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
  // Artwork Kiriya pinned to her public board, only while it stays pinned.
  const kiriyaPrefs = (await readPersonState(db, "kiriya")).prefs;
  const { pins } = resolvePrefs(kiriyaPrefs);
  // Her chosen intro song, when it's an upload, plays for visitors.
  const introSongId = kiriyaPrefs.profile?.introSongId;
  if (introSongId && introSongId !== "none") {
    const [intro] = await db
      .select({ id: schema.songs.id })
      .from(schema.songs)
      .where(and(eq(schema.songs.id, introSongId), eq(schema.songs.url, url)))
      .limit(1);
    if (intro) return true;
  }
  if (pins.length) {
    const [art] = await db
      .select({ id: schema.artworks.id })
      .from(schema.artworks)
      .where(and(inArray(schema.artworks.id, pins.map((pin) => pin.id)), eq(schema.artworks.url, url)))
      .limit(1);
    if (art) return true;
  }
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
