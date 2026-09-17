import { isUploadUrl } from "../lib/media.js";
import { Hono } from "hono";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { localDay, zonedParts } from "../lib/time.js";
import { birthdayInfo } from "../lib/birthday.js";
import { getOrCreateDay } from "../engine/day.js";
import { ADDRESS_OPTIONS, moodByKey, feelingByKey } from "../content/moods.js";
import { readCheckin, saveCheckin, saveAddressPreference } from "../lib/checkin.js";
import { HINT_KEYS, MAX_PINS, PROFILE_LIMITS, SHARING_KEYS, SOCIAL_HANDLE, readPersonState, resolvePrefs, updatePersonState } from "../lib/personState.js";
import { buildPublicProfile, profileFor, socialHandle } from "../lib/publicProfile.js";
import { publicProfileDefaults } from "../content/publicProfile.js";
import { kiriya } from "../content/kiriya.js";
import { maomaoBirthdayLetter } from "../content/birthday.js";
import { collectionCards } from "../content/collection.js";
import { curations } from "../content/curation.js";
import { DISCOVERY_SECTIONS } from "../../shared/feedContent.js";
import { readDiscoveryCollection, readSongCollection } from "../feeds/collections.js";
import { songRoutes } from "./songs.js";
import { atelierRoutes } from "./atelier.js";
import { apothecaryRoutes } from "./apothecary.js";
import { noteJarRoutes } from "./noteJar.js";
import { maomaoRoutes } from "./maomao.js";
import { passphraseRoutes } from "./passphrase.js";
import { meLoveNoteRoutes, reactionBody } from "./loveNotes.js";
import { MAX_ACTIVE_KEYS, createDeviceKey, listDeviceKeys, revokeDeviceKey } from "../lib/deviceKeys.js";
import { scriptableWidget } from "../content/widgetScript.js";
import { artworksWithNotes, markArtworkNotesSeen } from "../lib/artworkNotes.js";

export const meRoutes = new Hono();
meRoutes.route("/note-jar", noteJarRoutes);
meRoutes.route("/maomao", maomaoRoutes);
meRoutes.route("/passphrase", passphraseRoutes);
meRoutes.route("/notes", meLoveNoteRoutes);

function segmentOf(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late";
}

async function getSetting(db, key, fallback) {
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));
  return row?.value ?? fallback;
}

meRoutes.get("/", (c) => c.json({ role: c.get("session").role }));

// Development only: forget today's check-in, drawer and bundle so the fresh-morning flow can be tested.
meRoutes.post("/dev/reset-today", async (c) => {
  if (env.isProd)
    return c.json(
      { error: "not_found", message: "Nothing lives at this address." },
      404,
    );
  const db = await getDb();
  const day = localDay();
  await updatePersonState(db, c.get("session").role, () => ({ status: null }));
  await db.delete(schema.moods).where(eq(schema.moods.day, day));
  await db.delete(schema.settings).where(eq(schema.settings.key, `daily_feeling:${day}`));
  await db.delete(schema.drawers).where(eq(schema.drawers.day, day));
  await db.delete(schema.shownItems).where(eq(schema.shownItems.day, day));
  await db.delete(schema.days).where(eq(schema.days.day, day));
  return c.json({ ok: true, day });
});

meRoutes.get("/today", async (c) => {
  const db = await getDb();
  const day = localDay();
  const bundle = await getOrCreateDay(db, day);
  const [[drawer], signature, letterCount] = await Promise.all([
    db.select().from(schema.drawers).where(eq(schema.drawers.day, day)),
    getSetting(db, "signature", kiriya.signature),
    db
      .select({
        unread: sql`count(*) filter (where ${schema.letters.openedAt} is null)::int`,
        total: sql`count(*)::int`,
      })
      .from(schema.letters),
  ]);

  const segment = segmentOf(zonedParts().hour);
  const greeting = bundle.greetings.birthday ?? bundle.greetings[segment];
  const birthday = birthdayInfo(day);

  return c.json({
    day,
    segment,
    greeting: {
      ...greeting,
      text: greeting.text.replaceAll("{name}", kiriya.name),
    },
    cards: bundle.cards,
    song: bundle.song ?? null,
    drawer: { opened: Boolean(drawer), reward: drawer?.reward ?? null },
    birthday,
    birthdayNote: bundle.birthdayNote ?? null,
    letters: {
      unread: letterCount[0]?.unread ?? 0,
      total: letterCount[0]?.total ?? 0,
    },
    signature,
    city: kiriya.city,
    writer: bundle.writer,
  });
});

meRoutes.get("/mood", async (c) => c.json(await readCheckin(await getDb(), localDay(), c.get("session").role)));

const checkinBody = z.object({
  mood: z.enum(Object.keys(moodByKey)),
  energy: z.number().int().min(0).max(4).default(2),
  address: z.enum(Object.keys(ADDRESS_OPTIONS)).optional(),
  feeling: z.enum(Object.keys(feelingByKey)).nullable().optional(),
});
meRoutes.put("/mood", async (c) => {
  const parsed = checkinBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_choice", message: "Choose one of today’s options and try again." }, 400);
  return c.json(await saveCheckin(await getDb(), localDay(), parsed.data, c.get("session").role));
});

meRoutes.get("/address", async (c) => {
  const { choices, addressOptions } = await readCheckin(await getDb(), localDay(), c.get("session").role);
  return c.json({
    options: addressOptions,
    moods: choices.map((m) => ({ key: m.key, label: m.label, current: m.address.label })),
  });
});

meRoutes.put("/address", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!Object.hasOwn(moodByKey, body.mood) || !Object.hasOwn(ADDRESS_OPTIONS, body.address))
    return c.json(
      { error: "bad_choice", message: "Pick one of the options on the list." },
      400,
    );
  await saveAddressPreference(await getDb(), body.mood, body.address, c.get("session").role);
  return c.json({ ok: true, mood: body.mood, address: body.address });
});

// ---------- remembered preferences, sharing and the public pin board ----------

// Settings wording for each shareable part of the check-in. Kept on the server with the rest of
// the identity wording, so no client bundle carries it.
const SHARING_LABELS = [
  { key: "address", label: "Your pronouns", hint: "the ones you picked for how you’re presenting" },
  { key: "presentation", label: "How you’re presenting", hint: "femme, fluid, masc or just you" },
  { key: "feeling", label: "Your mood", hint: "happy, sad, playful… with its little emoji" },
  { key: "energy", label: "Your social battery", hint: "from “kindly fuck off” to full yap" },
];

async function prefsResponse(db, person) {
  const state = await readPersonState(db, person);
  return { ...resolvePrefs(state.prefs), revision: state.revision, maxPins: MAX_PINS, sharingLabels: SHARING_LABELS };
}

meRoutes.get("/prefs", async (c) => c.json(await prefsResponse(await getDb(), c.get("session").role)));

const prefsPatch = z
  .object({
    motion: z.enum(["lively", "quiet"]),
    cornerSmall: z.boolean(),
    sharing: z.object(Object.fromEntries(SHARING_KEYS.map((key) => [key, z.boolean()]))).partial().strict(),
    hints: z.partialRecord(z.enum(HINT_KEYS), z.boolean()),
  })
  .partial()
  .strict();

meRoutes.patch("/prefs", async (c) => {
  const parsed = prefsPatch.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_prefs", message: "That setting couldn’t be saved." }, 400);
  const { sharing, hints, ...rest } = parsed.data;
  const db = await getDb();
  const person = c.get("session").role;
  await updatePersonState(db, person, (state) => ({
    prefs: {
      ...state.prefs,
      ...rest,
      ...(sharing ? { sharing: { ...state.prefs.sharing, ...sharing } } : {}),
      ...(hints ? { hints: { ...state.prefs.hints, ...hints } } : {}),
    },
  }));
  return c.json(await prefsResponse(db, person));
});

meRoutes.put("/pins/:id", async (c) => {
  const id = c.req.param("id");
  const body = z.object({ pinned: z.boolean() }).strict().safeParse(await c.req.json().catch(() => null));
  if (!body.success || !z.string().uuid().safeParse(id).success)
    return c.json({ error: "bad_pin", message: "That artwork couldn’t be pinned." }, 400);
  const db = await getDb();
  const [art] = await db.select({ id: schema.artworks.id }).from(schema.artworks).where(eq(schema.artworks.id, id));
  if (!art && body.data.pinned) return c.json({ error: "not_found", message: "That artwork isn’t in your gallery anymore." }, 404);
  const person = c.get("session").role;
  let full = false;
  await updatePersonState(db, person, async (state) => {
    const pins = state.prefs.pins ?? [];
    const alive = pins.length
      ? new Set((await db.select({ id: schema.artworks.id }).from(schema.artworks).where(inArray(schema.artworks.id, pins.map((pin) => pin.id)))).map((row) => row.id))
      : new Set();
    const kept = pins.filter((pin) => pin.id !== id && alive.has(pin.id));
    full = body.data.pinned && !pins.some((pin) => pin.id === id) && kept.length >= MAX_PINS;
    if (full) return {};
    const existing = pins.find((pin) => pin.id === id);
    const next = body.data.pinned ? [existing ?? { id, at: new Date().toISOString() }, ...kept] : kept;
    return { prefs: { ...state.prefs, pins: next } };
  });
  if (full)
    return c.json({ error: "board_full", message: `Your board holds ${MAX_PINS} pieces. Unpin one to make room.` }, 409);
  return c.json(await prefsResponse(db, person));
});

// Exactly what a visitor would see, fresh rather than from the public cache. The admin sees the
// public page built from their own test choices.
meRoutes.get("/public-preview", async (c) => c.json(await buildPublicProfile(await getDb(), c.get("session").role)));

// ---------- her public page: bio, socials, things she loves, intro song, view counter ----------

async function ownProfile(db, person) {
  const [site, state] = await Promise.all([getSetting(db, "public_profile", null), readPersonState(db, person)]);
  return { state, profile: profileFor({ ...publicProfileDefaults, ...(site ?? {}) }, state.prefs) };
}

meRoutes.get("/profile", async (c) => {
  const { profile, state } = await ownProfile(await getDb(), c.get("session").role);
  return c.json({ ...profile, introSong: state.prefs.profile?.introSongId ?? "featured", limits: PROFILE_LIMITS });
});

const profileBody = z
  .object({
    bioLines: z.array(z.string().max(200)).max(20),
    socials: z.object({ tiktok: z.string().max(200), instagram: z.string().max(200) }).strict(),
    loves: z.array(z.string().max(200)).max(40),
    introSong: z.union([z.literal("featured"), z.literal("none"), z.string().uuid()]),
    showViews: z.boolean(),
  })
  .strict();

meRoutes.put("/profile", async (c) => {
  const parsed = profileBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_profile", message: "Something in your profile couldn’t be saved. Try again." }, 400);
  const { bioLines, socials, loves, introSong, showViews } = parsed.data;
  const lines = bioLines.map((line) => line.trim()).filter(Boolean);
  const things = loves.map((love) => love.trim()).filter(Boolean);
  if (lines.length > PROFILE_LIMITS.bioLines || lines.some((line) => line.length > PROFILE_LIMITS.bioLine))
    return c.json({ error: "bad_bio", message: `Your bio can have up to ${PROFILE_LIMITS.bioLines} lines, each up to ${PROFILE_LIMITS.bioLine} characters.` }, 400);
  if (things.length > PROFILE_LIMITS.loves || things.some((love) => love.length > PROFILE_LIMITS.love))
    return c.json({ error: "bad_loves", message: `Pick up to ${PROFILE_LIMITS.loves} things you love, each up to ${PROFILE_LIMITS.love} characters.` }, 400);
  const handles = { tiktok: socialHandle(socials.tiktok), instagram: socialHandle(socials.instagram) };
  for (const [site, handle] of Object.entries(handles))
    if (!SOCIAL_HANDLE.test(handle))
      return c.json({ error: "bad_handle", message: `That ${site === "tiktok" ? "TikTok" : "Instagram"} handle doesn’t look right. Just letters, numbers, dots and underscores, like @kiriya.` }, 400);
  const db = await getDb();
  if (introSong !== "featured" && introSong !== "none") {
    const [song] = await db.select({ id: schema.songs.id }).from(schema.songs).where(eq(schema.songs.id, introSong));
    if (!song) return c.json({ error: "bad_song", message: "That song isn’t on your music shelf anymore. Pick another one." }, 400);
  }
  const person = c.get("session").role;
  await updatePersonState(db, person, (state) => ({
    prefs: {
      ...state.prefs,
      profile: {
        bioLines: lines,
        socials: handles,
        loves: things,
        showViews,
        ...(introSong === "featured" ? {} : { introSongId: introSong }),
      },
    },
  }));
  const { profile, state } = await ownProfile(db, person);
  return c.json({ ...profile, introSong: state.prefs.profile?.introSongId ?? "featured", limits: PROFILE_LIMITS });
});

// ---------- phone widget and Shortcuts keys ----------

meRoutes.get("/device-keys", async (c) =>
  c.json({ keys: await listDeviceKeys(await getDb(), c.get("session").role), max: MAX_ACTIVE_KEYS, site: env.siteUrl }),
);

meRoutes.post("/device-keys", async (c) => {
  const parsed = z.object({ label: z.string().trim().min(1).max(40) }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_label", message: "Give this key a short name, like “my iPhone”." }, 400);
  const made = await createDeviceKey(await getDb(), c.get("session").role, parsed.data.label);
  if (!made) return c.json({ error: "too_many", message: `You can have ${MAX_ACTIVE_KEYS} keys at once. Turn off one you don’t use.` }, 409);
  return c.json(made);
});

meRoutes.delete("/device-keys/:id", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That key doesn’t exist." }, 404);
  const revoked = await revokeDeviceKey(await getDb(), c.get("session").role, id);
  return revoked ? c.json({ ok: true }) : c.json({ error: "not_found", message: "That key doesn’t exist." }, 404);
});

meRoutes.get("/widget-script", (c) => c.json({ script: scriptableWidget(env.siteUrl), placeholder: "__KIRIYA_WIDGET_KEY__" }));

// ---------- studio gallery ----------

const artworkBody = z.object({
  url: z.string().min(1).max(600),
  pathname: z.string().max(300).nullable().optional(),
  prompt: z.string().max(300).nullable().optional(),
  width: z.number().int().positive().max(8000).nullable().optional(),
  height: z.number().int().positive().max(8000).nullable().optional(),
});

meRoutes.get("/artworks", async (c) => c.json({ artworks: await artworksWithNotes(await getDb()) }));

// Opening a doodle marks its notes as seen. The admin's preview leaves them new for her.
meRoutes.post("/artworks/:id/notes/seen", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That artwork isn’t in your gallery." }, 404);
  if (c.get("session").role !== "kiriya") return c.json({ seen: 0 });
  return c.json({ seen: await markArtworkNotesSeen(await getDb(), id) });
});

meRoutes.post("/artworks", async (c) => {
  const parsed = artworkBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_artwork",
        message: "That drawing didn't save properly. Try again.",
      },
      400,
    );
  const url = parsed.data.url;
  const allowed = isUploadUrl(url);
  if (!allowed)
    return c.json(
      {
        error: "bad_artwork",
        message: "Drawings have to be uploaded through the studio.",
      },
      400,
    );
  const db = await getDb();
  const [row] = await db
    .insert(schema.artworks)
    .values(parsed.data)
    .returning();
  return c.json(row);
});

meRoutes.delete("/artworks/:id", async (c) => {
  const db = await getDb();
  const [row] = await db
    .delete(schema.artworks)
    .where(eq(schema.artworks.id, c.req.param("id")))
    .returning();
  if (row && env.blobToken && row.url.includes("blob.vercel-storage.com")) {
    const { del } = await import("@vercel/blob");
    await del(row.url, { token: env.blobToken }).catch(() => {});
  }
  return c.json({ ok: true });
});

// ---------- small per-feature state ----------

const KV_KEYS = new Set([]);

meRoutes.get("/kv/:key", async (c) => {
  const key = c.req.param("key");
  if (!KV_KEYS.has(key))
    return c.json({ error: "not_found", message: "Unknown setting." }, 404);
  const db = await getDb();
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, key));
  return c.json({ key, value: row?.value ?? null });
});

meRoutes.put("/kv/:key", async (c) => {
  const key = c.req.param("key");
  if (!KV_KEYS.has(key))
    return c.json({ error: "not_found", message: "Unknown setting." }, 404);
  const body = await c.req.json().catch(() => null);
  if (
    !body ||
    !("value" in body) ||
    JSON.stringify(body.value).length > 50_000
  ) {
    return c.json(
      { error: "bad_value", message: "That value can't be saved." },
      400,
    );
  }
  const db = await getDb();
  await db
    .insert(schema.kv)
    .values({ key, value: body.value })
    .onConflictDoUpdate({
      target: schema.kv.key,
      set: { value: body.value, updatedAt: new Date() },
    });
  return c.json({ key, value: body.value });
});

meRoutes.route("/songs", songRoutes);
meRoutes.route("/atelier", atelierRoutes);
meRoutes.route("/apothecary", apothecaryRoutes);

meRoutes.post("/drawer", async (c) => {
  const db = await getDb();
  const day = localDay();
  const bundle = await getOrCreateDay(db, day);
  const reward = bundle.drawer;
  const inserted = await db
    .insert(schema.drawers)
    .values({ day, reward })
    .onConflictDoNothing()
    .returning();

  if (inserted.length && reward.sticker) {
    const [row] = await db
      .select()
      .from(schema.kv)
      .where(eq(schema.kv.key, "stickers"));
    const collection = row?.value ?? [];
    if (!collection.some((s) => s.id === reward.sticker.id && s.day === day))
      collection.push({ id: reward.sticker.id, day });
    await db
      .insert(schema.kv)
      .values({ key: "stickers", value: collection })
      .onConflictDoUpdate({
        target: schema.kv.key,
        set: { value: collection, updatedAt: new Date() },
      });
  }
  return c.json({ opened: true, reward, firstTime: inserted.length > 0 });
});

meRoutes.get("/stickers", async (c) => {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.kv)
    .where(eq(schema.kv.key, "stickers"));
  return c.json({ collected: row?.value ?? [] });
});

meRoutes.get("/letters", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.letters)
    .orderBy(desc(schema.letters.createdAt));
  const signature = await getSetting(db, "signature", kiriya.signature);
  const now = Date.now();
  return c.json({
    signature,
    maomao: maomaoBirthdayLetter,
    letters: rows.map((l) => {
      const locked = l.unlockAt && l.unlockAt.getTime() > now;
      return {
        id: l.id,
        kind: l.kind,
        author: l.author,
        title: l.title,
        openWhen: l.openWhen,
        unlockAt: l.unlockAt,
        openedAt: l.openedAt,
        reaction: l.reaction,
        locked: Boolean(locked),
        body: locked ? null : l.body,
      };
    }),
  });
});

meRoutes.post("/letters/:id/open", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const [letter] = await db
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, id));
  if (!letter)
    return c.json(
      { error: "not_found", message: "That letter doesn't exist." },
      404,
    );
  if (letter.unlockAt && letter.unlockAt.getTime() > Date.now()) {
    return c.json(
      { error: "not_yet", message: "This one isn't ready to open yet." },
      403,
    );
  }
  if (!letter.openedAt)
    await db
      .update(schema.letters)
      .set({ openedAt: new Date() })
      .where(eq(schema.letters.id, id));
  return c.json({ ok: true });
});

// Letters are hers, so only her own session can react; the admin preview shows her reaction as is.
meRoutes.put("/letters/:id/reaction", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success)
    return c.json({ error: "not_found", message: "That letter doesn't exist." }, 404);
  if (c.get("session").role !== "kiriya")
    return c.json({ error: "preview_only", message: "Reactions on letters are Kiriya’s to give." }, 403);
  const parsed = reactionBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ error: "bad_reaction", message: "A heart or one emoji, please." }, 400);
  const { reaction } = parsed.data;
  const now = new Date();
  const [letter] = await (await getDb())
    .update(schema.letters)
    .set({ reaction, reactedAt: reaction ? now : null })
    .where(
      and(
        eq(schema.letters.id, id),
        or(isNull(schema.letters.unlockAt), lte(schema.letters.unlockAt, now)),
      ),
    )
    .returning({ id: schema.letters.id, reaction: schema.letters.reaction });
  return letter
    ? c.json(letter)
    : c.json({ error: "not_found", message: "That letter isn’t open yet." }, 404);
});

// Old entry points now read the same published editions as the main feed sections.
meRoutes.get("/discoveries", async (c) => {
  const kind = c.req.query("kind");
  if (kind === "art") return c.json({ items: collectionCards.art });
  if (!Object.hasOwn(DISCOVERY_SECTIONS, kind)) return c.json({ error: "not_found" }, 404);
  return c.json(await readDiscoveryCollection(await getDb(), kind));
});
meRoutes.get("/music-picks", async (c) => c.json(await readSongCollection(await getDb())));
meRoutes.get("/curation", (c) => {
  const kind = c.req.query("kind");
  if (!Object.hasOwn(curations, kind)) return c.json({ error: "not_found" }, 404);
  return c.json({ slides: curations[kind] });
});
