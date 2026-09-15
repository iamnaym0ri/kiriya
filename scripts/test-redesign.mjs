import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
// An isolated in-memory database; never connect to the gift's database or a delivery provider.
process.env.QSTASH_TOKEN = "";
const { composeDay } = await import("../server/engine/compose.js");
const { getOrCreateDay } = await import("../server/engine/day.js");
const { prepareDay } = await import("../server/engine/daily.js");
const { planDay, claimPush } = await import("../server/push/planner.js");
const { birthdayInfo } = await import("../server/lib/birthday.js");
const { localDay, addDays, zonedInstant } = await import(
  "../server/lib/time.js"
);
const { COLLECTION_VERSION, collectionCards, isApprovedPush } = await import(
  "../server/content/collection.js"
);
const { isUploadUrl } = await import("../server/lib/media.js");
const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, {
  migrationsFolder: new URL("../server/db/migrations", import.meta.url)
    .pathname,
});
await test("Birthday and curated content survive September 15, September 22 and late delivery", () => {
  for (const day of ["2026-09-15", "2026-09-22", "2026-11-04"]) {
    const one = composeDay(day, { birthday: birthdayInfo(day) });
    assert.deepEqual(one, composeDay(day, { birthday: birthdayInfo(day) }));
    assert.equal(one.collectionVersion, COLLECTION_VERSION);
    assert.deepEqual(
      one.cards.map((c) => c.kind),
      ["maomao", "vocaloid", "cosplay", "art"],
    );
    assert(!("outfits" in one));
    assert(!("apothecary" in one));
    assert(one.pushes.every(isApprovedPush));
    assert(one.cards.every((c) => c.spoiler !== "novel"));
  }
  assert.equal(birthdayInfo("2026-09-15").isBirthday, true);
  assert.equal(birthdayInfo("2026-09-22").isBirthdayWeek, false);
  assert(collectionCards.maomao.some((c) => c.spoiler === "manga"));
  assert(!collectionCards.maomao.some((c) => c.spoiler === "novel"));
});
await test("Legacy cached topics and live feeds cannot surface; stored work is preserved", async () => {
  const day = "2026-09-22";
  const [art] = await db
    .insert(schema.artworks)
    .values({ url: "/private-original", prompt: "An existing drawing" })
    .returning();
  await db.insert(schema.days).values({
    day,
    writer: "ai",
    bundle: {
      day,
      writer: "ai",
      cards: [
        { kind: "ballet", body: "old" },
        { kind: "herb", body: "old" },
      ],
      finds: [{ headline: "unreviewed" }],
      outfits: { rose: {} },
      pushes: [{ title: "herb", navigate: "/world" }],
    },
  });
  const bundle = await getOrCreateDay(db, day);
  assert.equal(bundle.collectionVersion, COLLECTION_VERSION);
  assert(!JSON.stringify(bundle).includes("unreviewed"));
  assert(
    !bundle.cards.some((c) => ["ballet", "herb", "japanese"].includes(c.kind)),
  );
  assert.equal(
    (
      await db
        .select()
        .from(schema.artworks)
        .where(eq(schema.artworks.id, art.id))
    ).length,
    1,
  );
  const again = await getOrCreateDay(db, day);
  assert.deepEqual(again, bundle);
  const savedFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("No external request is allowed in the daily job");
  };
  try {
    assert.equal(
      (await prepareDay(db, day, { force: true })).writer,
      "template",
    );
  } finally {
    globalThis.fetch = savedFetch;
  }
});
await test("Preference changes replace pending deliveries; stale callbacks, removed topics and disabled delivery are rejected", async () => {
  const day = addDays(localDay(), 1);
  const bundle = composeDay(day);
  let settings = { enabled: true, perDay: 3, startHour: 10, endHour: 22 };
  await db
    .insert(schema.settings)
    .values({ key: "notifications", value: settings });
  assert.equal((await planDay(db, day, bundle, settings)).planned, 3);
  const before = await db
    .select()
    .from(schema.plannedPushes)
    .where(eq(schema.plannedPushes.day, day));
  settings = { ...settings, perDay: 1, startHour: 14, endHour: 18 };
  await db
    .update(schema.settings)
    .set({ value: settings })
    .where(eq(schema.settings.key, "notifications"));
  assert.equal((await planDay(db, day, bundle, settings)).planned, 1);
  let rows = await db
    .select()
    .from(schema.plannedPushes)
    .where(eq(schema.plannedPushes.day, day));
  let pending = rows.filter((r) => r.status === "planned");
  assert.equal(pending.length, 1);
  assert(pending[0].sendAt >= zonedInstant(day, 14));
  assert(pending[0].sendAt < zonedInstant(day, 18));
  assert.equal(
    await claimPush(db, pending[0].id, {
      expectedTime: before[0].sendAt.toISOString(),
      now: pending[0].sendAt,
    }),
    null,
  );
  assert.equal(
    await claimPush(db, pending[0].id, { now: zonedInstant(day, 13) }),
    null,
  );
  const row = await claimPush(db, pending[0].id, {
    expectedTime: pending[0].sendAt.toISOString(),
    now: pending[0].sendAt,
  });
  assert(row);
  assert.equal(await claimPush(db, row.id, { now: row.sendAt }), null);
  const next = addDays(day, 1);
  await planDay(db, next, composeDay(next), settings);
  await db
    .update(schema.settings)
    .set({ value: { ...settings, enabled: false } })
    .where(eq(schema.settings.key, "notifications"));
  const [nextRow] = (
    await db
      .select()
      .from(schema.plannedPushes)
      .where(eq(schema.plannedPushes.day, next))
  ).filter((r) => r.status === "planned");
  assert.equal(await claimPush(db, nextRow.id, { now: nextRow.sendAt }), null);
  const future = addDays(next, 1);
  await planDay(db, future, composeDay(future), settings);
  await planDay(db, day, bundle, { ...settings, enabled: false });
  assert.equal(
    (await db.select().from(schema.plannedPushes)).filter(
      (r) => r.status === "planned",
    ).length,
    0,
  );
  const [old] = await db
    .insert(schema.plannedPushes)
    .values({
      day: future,
      slot: 8,
      kind: "special",
      sendAt: zonedInstant(future, 15),
      payload: { title: "Herb cabinet", body: "old", navigate: "/world" },
    })
    .returning();
  await db
    .update(schema.settings)
    .set({ value: settings })
    .where(eq(schema.settings.key, "notifications"));
  assert.equal(await claimPush(db, old.id, { now: old.sendAt }), null);
});
await test("Media validators reject arbitrary external and traversal URLs", () => {
  assert(isUploadUrl("/api/uploads/file/art-0123456789abcdef.png"));
  assert(isUploadUrl("/api/uploads/media?path=art%2F123-test.png"));
  for (const url of [
    "https://anything.public.blob.vercel-storage.com/private.png",
    "https://example.com/a.png",
    "/api/uploads/media?path=..%2Fsecret",
    "/api/uploads/file/../x",
    "/api/uploads/media?path=art%2F..%2Fsecret",
  ])
    assert(!isUploadUrl(url));
});
await client.close();
