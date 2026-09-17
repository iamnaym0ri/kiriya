import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "../db/client.js";
import { publicProfileDefaults } from "../content/publicProfile.js";
import { ENERGY_LEVELS } from "../content/moods.js";
import { birthdayInfo } from "./birthday.js";
import { checkinFor } from "./checkin.js";
import { parseSongUrl } from "./songs.js";
import { localDay } from "./time.js";
import { readPersonState, resolvePrefs } from "./personState.js";

async function totalViews(db) {
  const [{ total }] = await db.select({ total: sql`coalesce(sum(${schema.views.count}), 0)::int` }).from(schema.views);
  return total;
}

async function featuredSong(db) {
  const [featured] = await db
    .select()
    .from(schema.songs)
    .where(and(eq(schema.songs.featured, true), eq(schema.songs.isPublic, true)))
    .orderBy(desc(schema.songs.createdAt))
    .limit(1);
  if (!featured) return null;
  const parsed = featured.kind === "upload" ? { provider: "audio", embedId: featured.url } : parseSongUrl(featured.url);
  return { kind: featured.kind, ...parsed, url: featured.url, title: featured.title, artist: featured.artist, thumbnail: featured.thumbnail };
}

/**
 * Only the parts of the current check-in this person chose to share. Labels travel with the data,
 * so the public build never carries identity wording of its own.
 */
export async function sharedToday(db, state, day = localDay()) {
  const { sharing } = resolvePrefs(state.prefs);
  const { current } = await checkinFor(db, state, day);
  if (!current) return null;
  const items = [];
  if (sharing.address) items.push({ key: "address", label: "pronouns", value: current.address.label });
  if (sharing.presentation) items.push({ key: "presentation", label: "presenting", value: current.label, face: current.face });
  if (sharing.feeling && current.feeling)
    items.push({ key: "feeling", label: "mood", value: current.feeling.label, emoji: current.feeling.emoji, note: current.feeling.hint });
  if (sharing.energy) {
    const level = ENERGY_LEVELS[current.energy];
    items.push({ key: "energy", label: "social battery", value: level.label, level: current.energy, face: level.face, note: level.comment });
  }
  return items.length ? { items, updatedAt: current.setAt } : null;
}

/** Pinned artwork that still exists, in the order she pinned it. */
export async function pinnedArtworks(db, state) {
  const { pins } = resolvePrefs(state.prefs);
  if (!pins.length) return [];
  const rows = await db.select().from(schema.artworks).where(inArray(schema.artworks.id, pins.map((pin) => pin.id)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return pins
    .filter((pin) => byId.has(pin.id))
    .map((pin) => {
      const art = byId.get(pin.id);
      return { id: art.id, url: art.url, caption: art.prompt, width: art.width, height: art.height, pinnedAt: pin.at };
    });
}

/** Everything a visitor sees. `person` is "kiriya" for the real page, or the admin's test copy in preview. */
export async function buildPublicProfile(db, person = "kiriya") {
  const [[override], song, state] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.key, "public_profile")),
    featuredSong(db),
    readPersonState(db, person),
  ]);
  const profile = { ...publicProfileDefaults, ...(override?.value ?? {}) };
  const [today, pins, views] = await Promise.all([
    sharedToday(db, state),
    pinnedArtworks(db, state),
    profile.showViews ? totalViews(db) : null,
  ]);
  return { ...profile, views, song, birthday: birthdayInfo(), today, pins };
}
