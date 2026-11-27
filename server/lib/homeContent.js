import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { schema } from "../db/client.js";
import { isUploadUrl } from "./media.js";
import { PEOPLE } from "./personState.js";

// The app's home section (docs/refactor/RENOVATION.md, owner: the home agent). Josh changes the
// centre stage (greeting, photos, captions) and the pinboard from his own phone; she sees each change
// the next time she opens the app. Everything lives in the settings key-value store:
//   home_content          what the home shows (null parts fall back to the site's built-in defaults,
//                         which live in the client: src/shared/profile/displayRotation.js, praise.js)
//   home_seen:<person>    which songs that person has heard and when they last looked at the pinboard

const CONTENT = "home_content";
const SEEN = (person) => `home_seen:${person}`;

export const HOME_LIMITS = {
  greeting: 60,
  photos: 24,
  alt: 200,
  captions: 200,
  caption: 160,
  pins: 24,
  pinText: 400,
  pinLabel: 40,
  heard: 400,
};
export const PIN_STYLES = ["pin", "tape"];
export const PIN_COLOURS = ["cream", "lilac", "pink", "mint", "butter", "sky"];
export const PIN_STICKERS = ["kitten", "sprig", "leek", "bow", "star", "cake", "brush", "bottle", "mirror"];
export const PHOTO_FOCUS = ["top", "center", "bottom"];

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
// Built-in pictures ship with the site; anything else must be a private upload this site issued.
const STATIC_PHOTO = /^\/images\/[a-z0-9/_-]+\.(?:webp|jpg|jpeg|png)$/;
const photoSrc = z
  .string()
  .max(600)
  .refine((src) => STATIC_PHOTO.test(src) || isUploadUrl(src, ["cosplay", "photos", "avatar"]), "That photo isn’t one of ours.");

const photo = z.object({
  id,
  src: photoSrc,
  alt: z.string().trim().max(HOME_LIMITS.alt).default(""),
  focus: z.enum(PHOTO_FOCUS).default("center"),
  // The built-in Maomao portrait keeps to captions written for it; Josh's photos can do the same.
  ownCaptionsOnly: z.boolean().default(false),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

const caption = z.object({
  id,
  text: z.string().trim().min(1).max(HOME_LIMITS.caption),
  photo: id.nullable().optional(),
});

export const greetingBody = z.object({ greeting: z.string().trim().max(HOME_LIMITS.greeting).nullable() }).strict();
export const photosBody = z.object({ photos: z.array(photo).max(HOME_LIMITS.photos).nullable() }).strict();
export const captionsBody = z
  .object({ captions: z.array(caption).max(HOME_LIMITS.captions).nullable(), pinned: id.nullable().optional() })
  .strict();
export const pinBody = z
  .object({
    text: z.string().trim().min(1).max(HOME_LIMITS.pinText),
    label: z.string().trim().max(HOME_LIMITS.pinLabel).optional().default(""),
    style: z.enum(PIN_STYLES).default("pin"),
    colour: z.enum(PIN_COLOURS).default("cream"),
    sticker: z.enum(PIN_STICKERS).nullable().optional().default(null),
  })
  .strict();
export const pinPatchBody = pinBody.partial().extend({
  // A typo fix shouldn't make it "new" again on her phone.
  quiet: z.boolean().optional(),
  // Moves it back to the top of the board.
  bump: z.boolean().optional(),
}).strict();
export const seenBody = z
  .object({ songs: z.array(z.string().uuid()).max(50).optional(), pinsAt: z.string().datetime().optional() })
  .strict();

const empty = () => ({ greeting: null, photos: null, captions: null, pinned: null, pins: [], updatedAt: null });

async function getSetting(db, key) {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? null;
}

async function putSetting(db, key, value) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export async function readHomeContent(db) {
  return { ...empty(), ...((await getSetting(db, CONTENT)) ?? {}) };
}

async function changeContent(db, change, now = new Date()) {
  const current = await readHomeContent(db);
  const next = { ...current, ...change(current), updatedAt: now.toISOString() };
  await putSetting(db, CONTENT, next);
  return next;
}

export const setGreeting = (db, greeting, now) => changeContent(db, () => ({ greeting: greeting || null }), now);

export function setPhotos(db, photos, now) {
  const ids = new Set();
  for (const item of photos ?? []) {
    if (ids.has(item.id)) throw Object.assign(new Error("Two photos share one id."), { status: 400 });
    ids.add(item.id);
  }
  return changeContent(db, () => ({ photos }), now);
}

export function setCaptions(db, captions, pinned, now) {
  return changeContent(
    db,
    (current) => {
      const next = { captions };
      if (pinned !== undefined) next.pinned = pinned;
      // A pinned caption that was just removed from a custom list can't stay pinned.
      const keep = pinned === undefined ? current.pinned : pinned;
      if (keep && captions && !captions.some((item) => item.id === keep)) next.pinned = null;
      return next;
    },
    now,
  );
}

const pinOut = (pin) => pin;

export async function addPin(db, body, now = new Date()) {
  const at = now.toISOString();
  const pin = { id: randomUUID(), ...body, createdAt: at, updatedAt: at, sortAt: at };
  const content = await changeContent(
    db,
    (current) => {
      if (current.pins.length >= HOME_LIMITS.pins)
        throw Object.assign(new Error(`The board holds ${HOME_LIMITS.pins} notes. Take one down first.`), { status: 409, code: "board_full" });
      return { pins: [pin, ...current.pins] };
    },
    now,
  );
  return { pin: pinOut(pin), content };
}

export async function editPin(db, pinId, body, now = new Date()) {
  let found = null;
  const { quiet = false, bump = false, ...fields } = body;
  const content = await changeContent(
    db,
    (current) => ({
      pins: current.pins.map((pin) => {
        if (pin.id !== pinId) return pin;
        const at = now.toISOString();
        found = { ...pin, ...fields, ...(quiet ? {} : { updatedAt: at }), ...(bump ? { sortAt: at } : {}) };
        return found;
      }),
    }),
    now,
  );
  return found ? { pin: pinOut(found), content } : null;
}

export async function removePin(db, pinId, now) {
  let removed = false;
  await changeContent(
    db,
    (current) => ({
      pins: current.pins.filter((pin) => {
        if (pin.id === pinId) removed = true;
        return pin.id !== pinId;
      }),
    }),
    now,
  );
  return removed;
}

/** Newest (or most recently moved up) first. */
export const sortPins = (pins) => [...pins].sort((a, b) => (b.sortAt ?? b.createdAt).localeCompare(a.sortAt ?? a.createdAt));

// ---------- what each of them has seen ----------

export async function readSeen(db, person) {
  if (!PEOPLE.includes(person)) throw new Error("Unknown person");
  const value = (await getSetting(db, SEEN(person))) ?? {};
  return { songs: Array.isArray(value.songs) ? value.songs : [], pinsAt: value.pinsAt ?? null };
}

export async function markSeen(db, person, { songs = [], pinsAt } = {}) {
  const current = await readSeen(db, person);
  const heard = [...new Set([...songs, ...current.songs])].slice(0, HOME_LIMITS.heard);
  const next = {
    songs: heard,
    // Only ever moves forward, so an old tab can't make a seen pin look new again.
    pinsAt: pinsAt && (!current.pinsAt || pinsAt > current.pinsAt) ? pinsAt : current.pinsAt,
  };
  await putSetting(db, SEEN(person), next);
  return next;
}

// ---------- songs for her to discover ----------

/** The songs the home card plays: everything except the ones she added to her own shelf. */
export async function homeSongs(db) {
  const rows = await db.select().from(schema.songs).orderBy(desc(schema.songs.createdAt));
  return rows.filter((row) => row.data?.addedBy !== "kiriya");
}

/**
 * What the home section shows one person. `heard` marks the songs they've played; on Josh's phone
 * each song and pin also says whether *she* has heard or seen it yet.
 */
export async function homeFor(db, person, present) {
  const [content, seen, songs, hers] = await Promise.all([
    readHomeContent(db),
    readSeen(db, person),
    homeSongs(db),
    person === "admin" ? readSeen(db, "kiriya") : null,
  ]);
  const heard = new Set(seen.songs);
  const herHeard = hers ? new Set(hers.songs) : null;
  const pins = sortPins(content.pins).map((pin) => ({
    ...pin,
    new: Boolean(!seen.pinsAt || pin.updatedAt > seen.pinsAt),
    ...(hers ? { seenByHer: Boolean(hers.pinsAt && pin.updatedAt <= hers.pinsAt) } : {}),
  }));
  return {
    greeting: content.greeting,
    photos: content.photos,
    captions: content.captions,
    pinnedCaption: content.pinned,
    pins,
    songs: songs.map((row) => ({
      ...present(row),
      heard: heard.has(row.id),
      ...(herHeard ? { heardByHer: herHeard.has(row.id) } : {}),
    })),
    seen: { pinsAt: seen.pinsAt },
    updatedAt: content.updatedAt,
  };
}
