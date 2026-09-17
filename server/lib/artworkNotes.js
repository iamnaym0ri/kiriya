import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "../db/client.js";

export const ARTWORK_NOTE_MAX = 300;

// Where a note's notification takes her: the gallery, opened on that doodle.
export const artworkLink = (artworkId) => `/world?gallery=1&doodle=${artworkId}#play-desk`;

/** Saved artwork, newest first, each with the little notes left on it (oldest note first). */
export async function artworksWithNotes(db) {
  const rows = await db.select().from(schema.artworks).orderBy(desc(schema.artworks.createdAt)).limit(200);
  const notes = rows.length
    ? await db
        .select()
        .from(schema.artworkNotes)
        .where(inArray(schema.artworkNotes.artworkId, rows.map((row) => row.id)))
        .orderBy(asc(schema.artworkNotes.createdAt))
    : [];
  return rows.map((row) => ({
    ...row,
    notes: notes
      .filter((note) => note.artworkId === row.id)
      .map(({ id, body, seenAt, createdAt }) => ({ id, body, seenAt, createdAt })),
  }));
}

/** Returns the new note and its artwork, or null when the artwork is gone. */
export async function addArtworkNote(db, artworkId, body) {
  const [artwork] = await db.select().from(schema.artworks).where(eq(schema.artworks.id, artworkId));
  if (!artwork) return null;
  const [note] = await db.insert(schema.artworkNotes).values({ artworkId, body }).returning();
  return { note, artwork };
}

export async function deleteArtworkNote(db, id) {
  const [note] = await db.delete(schema.artworkNotes).where(eq(schema.artworkNotes.id, id)).returning();
  return note ?? null;
}

/** Hearts (or one emoji) her doodle; null takes it back. Returns null when the artwork is gone. */
export async function reactToArtwork(db, id, reaction, now = new Date()) {
  const [artwork] = await db
    .update(schema.artworks)
    .set({ reaction, reactedAt: reaction ? now : null })
    .where(eq(schema.artworks.id, id))
    .returning({ id: schema.artworks.id, reaction: schema.artworks.reaction });
  return artwork ?? null;
}

export async function markArtworkNotesSeen(db, artworkId, now = new Date()) {
  const seen = await db
    .update(schema.artworkNotes)
    .set({ seenAt: now })
    .where(and(eq(schema.artworkNotes.artworkId, artworkId), isNull(schema.artworkNotes.seenAt)))
    .returning({ id: schema.artworkNotes.id });
  return seen.length;
}
