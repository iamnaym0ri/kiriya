import { isUploadUrl } from "../lib/media.js";
import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { localDay, zonedParts } from "../lib/time.js";
import { birthdayInfo } from "../lib/birthday.js";
import { getOrCreateDay } from "../engine/day.js";
import { ADDRESS_OPTIONS, MOODS, moodByKey, feelingByKey } from "../content/moods.js";
import { readCheckin, saveCheckin, saveAddressPreference } from "../lib/checkin.js";
import { publicProfileDefaults } from "../content/publicProfile.js";
import { kiriya } from "../content/kiriya.js";
import { maomaoBirthdayLetter } from "../content/birthday.js";
import { collectionCards, musicPicks } from "../content/collection.js";
import { curations } from "../content/curation.js";
import { songRoutes } from "./songs.js";
import { atelierRoutes } from "./atelier.js";
import { apothecaryRoutes } from "./apothecary.js";
import { noteJarRoutes } from "./noteJar.js";

export const meRoutes = new Hono();
meRoutes.route("/note-jar", noteJarRoutes);

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

meRoutes.get("/mood", async (c) => c.json(await readCheckin(await getDb(), localDay())));

const checkinBody = z.object({
  mood: z.enum(Object.keys(moodByKey)),
  energy: z.number().int().min(0).max(4).default(2),
  address: z.enum(Object.keys(ADDRESS_OPTIONS)).optional(),
  feeling: z.enum(Object.keys(feelingByKey)).nullable().optional(),
});
meRoutes.put("/mood", async (c) => {
  const parsed = checkinBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_choice", message: "Choose one of today’s options and try again." }, 400);
  return c.json(await saveCheckin(await getDb(), localDay(), parsed.data));
});

meRoutes.get("/address", async (c) => {
  const db = await getDb();
  const overrides = (await getSetting(db, "address_overrides", null)) ?? {};
  return c.json({
    options: Object.keys(ADDRESS_OPTIONS),
    moods: MOODS.map((m) => ({
      key: m.key,
      label: m.label,
      current: (overrides[m.key] ?? m.address).label,
    })),
  });
});

meRoutes.put("/address", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const moodKey = body.mood;
  const option = ADDRESS_OPTIONS[body.address];
  if (!Object.hasOwn(moodByKey, moodKey) || !Object.hasOwn(ADDRESS_OPTIONS, body.address))
    return c.json(
      { error: "bad_choice", message: "Pick one of the options on the list." },
      400,
    );
  const db = await getDb();
  await saveAddressPreference(db, moodKey, option);
  return c.json({ ok: true, mood: moodKey, address: option.label });
});

const profileBody = z.object({
  bioLines: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
  socials: z.object({
    tiktok: z.object({ handle: z.string().trim().max(40) }),
    discord: z.object({ username: z.string().trim().max(40) }),
  }),
  showViews: z.boolean(),
});

meRoutes.get("/profile", async (c) => {
  const db = await getDb();
  const profile = {
    ...publicProfileDefaults,
    ...((await getSetting(db, "public_profile", null)) ?? {}),
  };
  return c.json({
    bioLines: profile.bioLines,
    socials: profile.socials,
    showViews: profile.showViews,
  });
});

meRoutes.put("/profile", async (c) => {
  const parsed = profileBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "bad_profile",
        message: "Each bio line needs 1–80 characters, and handles up to 40.",
      },
      400,
    );
  const db = await getDb();
  const current = (await getSetting(db, "public_profile", null)) ?? {};
  const next = {
    ...current,
    ...parsed.data,
    socials: {
      tiktok: {
        handle: parsed.data.socials.tiktok.handle.replace(/^@/, ""),
        url: "",
      },
      discord: parsed.data.socials.discord,
    },
  };
  await db
    .insert(schema.settings)
    .values({ key: "public_profile", value: next })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return c.json({ ok: true });
});

// ---------- studio gallery ----------

const artworkBody = z.object({
  url: z.string().min(1).max(600),
  pathname: z.string().max(300).nullable().optional(),
  prompt: z.string().max(300).nullable().optional(),
  width: z.number().int().positive().max(8000).nullable().optional(),
  height: z.number().int().positive().max(8000).nullable().optional(),
});

meRoutes.get("/artworks", async (c) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.artworks)
    .orderBy(desc(schema.artworks.createdAt))
    .limit(200);
  return c.json({ artworks: rows });
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

// Browsable approved items, never ranked or inferred from behaviour.
meRoutes.get("/discoveries", (c) => {
  const kind = c.req.query("kind");
  if (!collectionCards[kind]) return c.json({ error: "not_found" }, 404);
  return c.json({ items: collectionCards[kind] });
});
meRoutes.get("/music-picks", (c) => c.json({ songs: musicPicks }));
meRoutes.get("/curation", (c) => {
  const kind = c.req.query("kind");
  if (!Object.hasOwn(curations, kind)) return c.json({ error: "not_found" }, 404);
  return c.json({ slides: curations[kind] });
});
