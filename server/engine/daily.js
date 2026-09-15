// Reuse the daily job and shown-item history. Nothing fetched from a broad source is auto-published.
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { birthdayInfo } from "../lib/birthday.js";
import { composeDay } from "./compose.js";
import { getOrCreateDay, recentUsage } from "./day.js";
import { loadPersonal } from "./personal.js";
export async function prepareDay(db, day, { force = false } = {}) {
  let bundle;
  if (force) {
    bundle = composeDay(day, {
      recent: await recentUsage(db, day),
      birthday: birthdayInfo(day),
      ...(await loadPersonal(db)),
    });
    await db
      .insert(schema.days)
      .values({ day, bundle, writer: "template" })
      .onConflictDoUpdate({
        target: schema.days.day,
        set: { bundle, writer: "template", generatedAt: new Date() },
      });
    if (bundle.used.length)
      await db
        .insert(schema.shownItems)
        .values(bundle.used.map((itemKey) => ({ itemKey, day })))
        .onConflictDoNothing();
  } else bundle = await getOrCreateDay(db, day);
  return {
    day,
    writer: "template",
    writerError: null,
    finds: bundle.cards.length,
    song: bundle.song?.title ?? null,
    artwork: null,
    sources: [
      { source: "Approved collection", ok: true, count: bundle.cards.length },
    ],
  };
}
