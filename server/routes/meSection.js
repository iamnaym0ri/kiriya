import { Hono } from "hono";
import { and, count, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { localDay, daysBetween } from "../lib/time.js";
import { birthdayInfo } from "../lib/birthday.js";
import { names } from "../lib/chat.js";
import { publicProfileDefaults } from "../content/publicProfile.js";
import { stickers as stickerCatalogue } from "../content/birthday.js";
import { appSnapshot } from "./widget.js";

// The app's last tab (docs/refactor/RENOVATION.md, owner: the me agent). Mounted at /api/me/glance
// behind a kiriya/admin session, and at /api/admin/hub behind the admin one.

const TOGETHER = "together_since"; // settings key: "YYYY-MM-DD", the day they count from

async function setting(db, key) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? null;
}

const total = async (query) => Number((await query)[0]?.n ?? 0);

/**
 * Her little world at a glance, for the top of her tab. It's always about Kiriya's world: on Josh's
 * phone the same card shows exactly what she sees.
 */
export async function glance(db, now = new Date()) {
  const today = localDay(now);
  const [who, profile, together, letters, notes, doodles, memories, jar, stickerRow] = await Promise.all([
    names(db),
    setting(db, "public_profile"),
    setting(db, TOGETHER),
    // Letters she can open (a letter waiting for its day isn't hers yet).
    total(db.select({ n: count() }).from(schema.letters).where(or(isNull(schema.letters.unlockAt), lte(schema.letters.unlockAt, now)))),
    total(db.select({ n: count() }).from(schema.loveNotes).where(and(eq(schema.loveNotes.recipient, "kiriya"), eq(schema.loveNotes.status, "sent")))),
    total(db.select({ n: count() }).from(schema.artworks)),
    total(db.select({ n: count() }).from(schema.memories)),
    total(db.select({ n: count() }).from(schema.jarNotes).where(isNotNull(schema.jarNotes.firstPulledAt))),
    db.select({ value: schema.kv.value }).from(schema.kv).where(eq(schema.kv.key, "stickers")),
  ]);
  const collected = Array.isArray(stickerRow[0]?.value) ? stickerRow[0].value : [];
  const site = { ...publicProfileDefaults, ...(profile ?? {}) };
  const since = typeof together === "string" && /^\d{4}-\d{2}-\d{2}$/.test(together) ? together : null;
  const birthday = birthdayInfo(today);
  return {
    name: who.kiriya,
    displayName: site.displayName ?? who.kiriya,
    avatarUrl: site.avatarUrl ?? null,
    counts: {
      letters,
      notes,
      doodles,
      memories,
      jar,
      stickers: new Set(collected.map((item) => item?.id).filter(Boolean)).size,
      stickersTotal: stickerCatalogue.length,
    },
    together: since ? { since, days: Math.max(0, daysBetween(since, today)) + 1 } : null,
    birthday: { daysUntil: birthday.daysUntil ?? null, isBirthday: Boolean(birthday.isBirthday) },
    today,
  };
}

export const glanceRoutes = new Hono();
glanceRoutes.get("/", async (c) => c.json(await glance(await getDb())));

export const hubRoutes = new Hono();

// The day they count "days of us" from. null clears it (the card then leaves the line out).
const togetherBody = z
  .object({
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)), "not a real day")
      .nullable(),
  })
  .strict();

hubRoutes.put("/together", async (c) => {
  const parsed = togetherBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_day", message: "Pick a day from the calendar." }, 400);
  const db = await getDb();
  const { since } = parsed.data;
  if (since && since > localDay()) return c.json({ error: "future_day", message: "That day hasn’t happened yet ♡" }, 400);
  if (since)
    await db
      .insert(schema.settings)
      .values({ key: TOGETHER, value: since })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: since, updatedAt: sql`now()` } });
  else await db.delete(schema.settings).where(eq(schema.settings.key, TOGETHER));
  return c.json(await glance(db));
});

// What her Home Screen widgets show right now (the same snapshot her phone's widgets read).
hubRoutes.get("/widgets", async (c) => c.json(await appSnapshot(await getDb(), "kiriya")));
