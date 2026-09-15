import { and, asc, eq, gte } from "drizzle-orm";
import { schema } from "../db/client.js";
import { addDays } from "../lib/time.js";
import { birthdayInfo } from "../lib/birthday.js";
import { composeDay } from "./compose.js";
import { COLLECTION_VERSION } from "../content/collection.js";
import { loadPersonal } from "./personal.js";

const NOVELTY_WINDOW_DAYS = 60;

/** Pool item ids used recently, grouped by pool, oldest first. */
export async function recentUsage(db, day) {
  const rows = await db
    .select()
    .from(schema.shownItems)
    .where(and(gte(schema.shownItems.day, addDays(day, -NOVELTY_WINDOW_DAYS))))
    .orderBy(asc(schema.shownItems.day));
  const recent = {};
  for (const row of rows) {
    const split = row.itemKey.indexOf(":");
    const pool = row.itemKey.slice(0, split);
    const id = row.itemKey.slice(split + 1);
    (recent[pool] ??= []).push(id);
  }
  return recent;
}

async function saveBundle(db, day, bundle) {
  const inserted = await db
    .insert(schema.days)
    .values({ day, bundle, writer: bundle.writer })
    .onConflictDoNothing()
    .returning({ day: schema.days.day });
  if (inserted.length && bundle.used?.length) {
    await db
      .insert(schema.shownItems)
      .values(bundle.used.map((itemKey) => ({ itemKey, day })))
      .onConflictDoNothing();
  }
  if (inserted.length) return bundle;
  // Someone else (the daily job, or a second tab) got there first: use theirs.
  const [existing] = await db
    .select()
    .from(schema.days)
    .where(eq(schema.days.day, day));
  return existing.bundle;
}

/**
 * Returns the bundle for `day`, composing it from the pools if the daily job hasn't run yet.
 * `writer` lets the daily job substitute the AI writer; the default is the template.
 */
export async function getOrCreateDay(db, day, { writer } = {}) {
  const [existing] = await db
    .select()
    .from(schema.days)
    .where(eq(schema.days.day, day));
  if (existing?.bundle?.collectionVersion === COLLECTION_VERSION)
    return existing.bundle;
  if (existing) {
    // Upgrade the visible bundle without deleting saved work, letters or history.
    const bundle = composeDay(day, {
      birthday: birthdayInfo(day),
      ...(await loadPersonal(db)),
    });
    await db
      .update(schema.days)
      .set({ bundle, writer: bundle.writer })
      .where(eq(schema.days.day, day));
    if (bundle.used.length)
      await db
        .insert(schema.shownItems)
        .values(bundle.used.map((itemKey) => ({ itemKey, day })))
        .onConflictDoNothing();
    return bundle;
  }

  const context = {
    recent: await recentUsage(db, day),
    birthday: birthdayInfo(day),
    ...(await loadPersonal(db)),
  };
  let bundle = composeDay(day, context);
  if (writer) {
    try {
      bundle = await writer(bundle, context);
    } catch (error) {
      console.error(
        "[day] writer failed, keeping the template bundle:",
        error.message,
      );
    }
  }
  return saveBundle(db, day, bundle);
}
