import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { ADDRESS_OPTIONS, FEELINGS } from "../server/content/moods.js";
import { checkinCopy, readCheckin, saveAddressPreference, saveCheckin } from "../server/lib/checkin.js";
const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
try {
  await test("Daily presentation and energy persist, with independently chosen address preferences", async () => {
    const empty = await readCheckin(db, "2026-09-14");
    assert.equal(empty.current, null); assert.equal(empty.choices.length, 4);
    const chosen = await saveCheckin(db, "2026-09-14", { mood: "night", energy: 1, address: "they/them" });
    assert.equal(chosen.current.label, "Masc"); assert.equal(chosen.current.address.label, "they/them"); assert.equal(chosen.current.energy, 1);
    assert.equal(chosen.copy.ownWorld, "a world of their own"); assert.equal(chosen.copy.birthdayStamp, "🎂 SEPTEMBER STAR");
    const again = await readCheckin(db, "2026-09-14"); assert.deepEqual(again.current, chosen.current);
    const nextDay = await readCheckin(db, "2026-09-15"); assert.equal(nextDay.current, null);
    assert.equal(nextDay.choices.find(m => m.key === "night").address.label, "they/them", "Preferred address survives a new day without reusing yesterday’s check-in");
    await saveCheckin(db, "2026-09-15", { mood: "rose", energy: 4, address: "he/him" });
    assert.equal((await readCheckin(db, "2026-09-15")).copy.ownWorld, "a world of his own");
    assert.equal((await readCheckin(db, "2026-09-14")).current.key, "night", "Another day remains intact");
  });
  await test("Each saved address preference merges without dropping other presentations", async () => {
    await saveAddressPreference(db, "cloud", ADDRESS_OPTIONS["any/all"]);
    await saveAddressPreference(db, "iris", ADDRESS_OPTIONS["he/they"]);
    const data = await readCheckin(db, "2026-09-15");
    const map = Object.fromEntries(data.choices.map(m => [m.key, m.address.label]));
    assert.deepEqual(map, { rose: "he/him", iris: "he/they", night: "they/them", cloud: "any/all" });
    await saveAddressPreference(db, "rose", ADDRESS_OPTIONS["she/her"]);
    const updated = await readCheckin(db, "2026-09-15"); assert.equal(updated.current.address.label, "she/her"); assert.equal(updated.copy.ownWorld, "a world of her own");
  });
  await test("Emotional mood is independent of presentation, address and energy, and scoped by day", async () => {
    for (const feeling of FEELINGS) {
      const selected = await saveCheckin(db, "2026-09-17", { mood: "iris", address: "he/they", energy: 1, feeling: feeling.key });
      assert.equal(selected.current.feeling.key, feeling.key);
      assert.equal(selected.current.key, "iris");
      assert.equal(selected.current.address.label, "he/they");
      assert.equal(selected.current.energy, 1);
      assert.equal((await readCheckin(db, "2026-09-17")).current.feeling.key, feeling.key);
    }
    const old = await readCheckin(db, "2026-09-17");
    const changed = await saveCheckin(db, "2026-09-17", { mood: "night", energy: 4 });
    assert.equal(changed.current.feeling.key, old.current.feeling.key, "Older clients do not erase the feeling");
    assert.equal((await readCheckin(db, "2026-09-18")).current, null);
    await saveCheckin(db, "2026-09-18", { mood: "rose", feeling: "content" });
    assert.equal((await readCheckin(db, "2026-09-17")).current.feeling.key, old.current.feeling.key);
    const cleared = await saveCheckin(db, "2026-09-17", { mood: "night", energy: 4, feeling: null });
    assert.equal(cleared.current.feeling, null);
    assert.equal(cleared.current.key, "night");
  });
  await test("Invalid check-ins cannot change either saved choices or the day", async () => {
    const before = await readCheckin(db, "2026-09-15");
    for (const body of [{ mood: "missing" }, { mood: "constructor" }, { mood: "rose", energy: 5 }, { mood: "rose", energy: 1.5 }, { mood: "rose", address: "__proto__" }, { mood: "rose", feeling: "constructor" }, { mood: "rose", feeling: "missing" }]) await assert.rejects(saveCheckin(db, "2026-09-15", body));
    assert.deepEqual(await readCheckin(db, "2026-09-15"), before);
    assert.equal((await db.select().from(schema.moods).where(eq(schema.moods.day, "2026-09-15"))).length, 1);
  });
  await test("Personal wording follows permitted address forms, including mixed and any/all choices", () => {
    for (const [label, address] of Object.entries(ADDRESS_OPTIONS)) {
      const copy = checkinCopy(address);
      const own = label === "he/him" ? "his" : label === "she/her" ? "her" : "their";
      assert.equal(copy.ownWorld, `a world of ${own} own`);
      assert.match(copy.example, label === "he/him" ? /^He belongs/ : label === "she/her" ? /^She belongs/ : /^They belong/);
    }
  });
  await test("The production HTTP driver saves both choices in a transactional batch", async () => {
    const queries = [], batches = [];
    const http = {
      query: (query, params) => {
        queries.push({ query, params });
        const rows = query.includes('from "moods"') ? [["2026-09-15", "night", 3, null, "2026-09-15T10:00:00Z"]]
          : query.includes('from "settings"') ? [[params[0], params[0].startsWith("daily_feeling:") ? { key: "happy" } : { night: ADDRESS_OPTIONS["he/him"] }, "2026-09-15T10:00:00Z"]] : [];
        return Promise.resolve({ rows });
      },
      transaction: async statements => { batches.push(statements.length); return Promise.all(statements); },
    };
    const production = neonDrizzle({ client: http, schema });
    const saved = await saveCheckin(production, "2026-09-15", { mood: "night", energy: 3, address: "he/him", feeling: "happy" });
    assert.deepEqual(batches, [3]);
    assert.equal(queries.filter(q => q.query.startsWith("insert")).length, 3);
    assert.equal(saved.current.feeling.key, "happy");
    assert.equal(saved.current.key, "night");
    assert.equal(saved.copy.ownWorld, "a world of his own");
  });
} finally { await client.close(); }
