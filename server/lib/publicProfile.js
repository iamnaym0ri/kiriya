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

const presentSong = (row) => {
  if (!row) return null;
  const parsed = row.kind === "upload" ? { provider: "audio", embedId: row.url } : parseSongUrl(row.url);
  return { kind: row.kind, ...parsed, url: row.url, title: row.title, artist: row.artist, thumbnail: row.thumbnail };
};

async function featuredSong(db) {
  const [featured] = await db
    .select()
    .from(schema.songs)
    .where(and(eq(schema.songs.featured, true), eq(schema.songs.isPublic, true)))
    .orderBy(desc(schema.songs.createdAt))
    .limit(1);
  return presentSong(featured);
}

/** Accepts "@name", "name" or a profile link, and keeps just the handle. */
export function socialHandle(input) {
  const text = String(input ?? "").trim();
  const link = text.match(/(?:tiktok\.com\/@|instagram\.com\/)([A-Za-z0-9._]+)/i);
  return (link ? link[1] : text).replace(/^@+/, "");
}

/** This person's public bio, socials, loves, intro song and view counter, over the site defaults. */
export function profileFor(siteProfile, prefs = {}) {
  const own = prefs.profile ?? {};
  return {
    bioLines: own.bioLines ?? siteProfile.bioLines ?? [],
    socials: {
      tiktok: own.socials?.tiktok ?? socialHandle(siteProfile.socials?.tiktok?.handle),
      instagram: own.socials?.instagram ?? socialHandle(siteProfile.socials?.instagram?.handle),
    },
    loves: own.loves ?? (siteProfile.interests ?? []).map((interest) => interest.title),
    // Unset: the featured song from her music shelf. "none": no intro song.
    introSongId: own.introSongId ?? null,
    showViews: own.showViews ?? siteProfile.showViews ?? true,
  };
}

const socialLinks = ({ tiktok, instagram }) => ({
  tiktok: tiktok ? { handle: tiktok, url: `https://www.tiktok.com/@${tiktok}` } : null,
  instagram: instagram ? { handle: instagram, url: `https://www.instagram.com/${instagram}/` } : null,
});

async function introSong(db, introSongId) {
  if (introSongId === "none") return null;
  if (!introSongId) return featuredSong(db);
  const [row] = await db.select().from(schema.songs).where(eq(schema.songs.id, introSongId));
  return row ? presentSong(row) : featuredSong(db);
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
  if (sharing.presentation) items.push({ key: "presentation", label: "presenting", value: current.label, face: current.face, tone: current.key });
  if (sharing.feeling && current.feeling)
    items.push({ key: "feeling", label: "mood", value: current.feeling.label, emoji: current.feeling.emoji, note: current.feeling.hint, tone: current.feeling.key });
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
  const [[override], state] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.key, "public_profile")),
    readPersonState(db, person),
  ]);
  const site = { ...publicProfileDefaults, ...(override?.value ?? {}) };
  const own = profileFor(site, state.prefs);
  const [today, pins, views, song] = await Promise.all([
    sharedToday(db, state),
    pinnedArtworks(db, state),
    own.showViews ? totalViews(db) : null,
    introSong(db, own.introSongId),
  ]);
  return {
    name: site.name,
    displayName: site.displayName,
    badges: site.badges,
    avatarUrl: site.avatarUrl,
    cosplays: site.cosplays,
    bioLines: own.bioLines,
    socials: socialLinks(own.socials),
    loves: own.loves,
    showViews: own.showViews,
    views,
    song,
    birthday: birthdayInfo(),
    today,
    pins,
  };
}
