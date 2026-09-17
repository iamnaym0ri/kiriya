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
import { readPersonState } from "../server/lib/personState.js";
const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
try {
  await test("Her check-in stays chosen on later days until she changes it", async () => {
    const empty = await readCheckin(db, "2026-09-14");
    assert.equal(empty.current, null); assert.equal(empty.choices.length, 4);
    const chosen = await saveCheckin(db, "2026-09-14", { mood: "night", energy: 1, address: "they/them" });
    assert.equal(chosen.current.label, "Masc"); assert.equal(chosen.current.address.label, "they/them"); assert.equal(chosen.current.energy, 1);
    assert.equal(chosen.current.setDay, "2026-09-14"); assert.ok(chosen.current.setAt);
    assert.equal(chosen.copy.ownWorld, "a world of their own"); assert.equal(chosen.copy.birthdayStamp, "🎂 SEPTEMBER STAR");
    assert.deepEqual((await readCheckin(db, "2026-09-14")).current, chosen.current);
    const nextWeek = await readCheckin(db, "2026-09-21");
    assert.deepEqual(nextWeek.current, chosen.current, "A new day keeps the last choice instead of asking again");
    assert.equal(nextWeek.copy.ownWorld, "a world of their own");
    await saveCheckin(db, "2026-09-21", { mood: "rose", energy: 4, address: "he/him" });
    const changed = await readCheckin(db, "2026-10-01");
    assert.equal(changed.current.key, "rose"); assert.equal(changed.current.energy, 4); assert.equal(changed.copy.ownWorld, "a world of his own");
    assert.equal(changed.choices.find(m => m.key === "night").address.label, "they/them", "Each presentation keeps its own address");
  });
  await test("Each saved address preference merges without dropping other presentations", async () => {
    await saveAddressPreference(db, "cloud", "any/all");
    await saveAddressPreference(db, "iris", "he/they");
    const data = await readCheckin(db, "2026-10-01");
    const map = Object.fromEntries(data.choices.map(m => [m.key, m.address.label]));
    assert.deepEqual(map, { rose: "he/him", iris: "he/they", night: "they/them", cloud: "any/all" });
    await saveAddressPreference(db, "rose", "she/her");
    const updated = await readCheckin(db, "2026-10-01"); assert.equal(updated.current.address.label, "she/her"); assert.equal(updated.copy.ownWorld, "a world of her own");
    await assert.rejects(saveAddressPreference(db, "rose", "__proto__"));
    await assert.rejects(saveAddressPreference(db, "constructor", "she/her"));
  });
  await test("Mood is independent of presentation, address and energy, and also carries over", async () => {
    for (const feeling of FEELINGS) {
      const selected = await saveCheckin(db, "2026-10-02", { mood: "iris", address: "he/they", energy: 1, feeling: feeling.key });
      assert.equal(selected.current.feeling.key, feeling.key);
      assert.equal(selected.current.key, "iris");
      assert.equal(selected.current.address.label, "he/they");
      assert.equal(selected.current.energy, 1);
      assert.equal((await readCheckin(db, "2026-10-09")).current.feeling.key, feeling.key);
    }
    const old = await readCheckin(db, "2026-10-02");
    const changed = await saveCheckin(db, "2026-10-03", { mood: "night", energy: 4 });
    assert.equal(changed.current.feeling.key, old.current.feeling.key, "Older clients do not erase the feeling");
    const cleared = await saveCheckin(db, "2026-10-03", { mood: "night", energy: 4, feeling: null });
    assert.equal(cleared.current.feeling, null);
    assert.equal(cleared.current.key, "night");
  });
  await test("Admin test choices never change Kiriya's, and hers never leak into the test copy", async () => {
    const before = await readCheckin(db, "2026-10-03");
    assert.equal((await readCheckin(db, "2026-10-03", "admin")).current, null);
    const tested = await saveCheckin(db, "2026-10-03", { mood: "cloud", energy: 0, address: "she/they", feeling: "sad" }, "admin");
    assert.equal(tested.current.key, "cloud");
    assert.deepEqual(await readCheckin(db, "2026-10-03"), before);
    await saveAddressPreference(db, "night", "any/all", "admin");
    assert.equal((await readCheckin(db, "2026-10-03")).choices.find(m => m.key === "night").address.label, "they/them");
    await assert.rejects(saveCheckin(db, "2026-10-03", { mood: "rose" }, "visitor"));
  });
  await test("Invalid check-ins cannot change saved choices", async () => {
    const before = await readCheckin(db, "2026-10-03");
    const revision = (await readPersonState(db, "kiriya")).revision;
    for (const body of [{ mood: "missing" }, { mood: "constructor" }, { mood: "rose", energy: 5 }, { mood: "rose", energy: 1.5 }, { mood: "rose", address: "__proto__" }, { mood: "rose", feeling: "constructor" }, { mood: "rose", feeling: "missing" }]) await assert.rejects(saveCheckin(db, "2026-10-03", body));
    assert.deepEqual(await readCheckin(db, "2026-10-03"), before);
    assert.equal((await readPersonState(db, "kiriya")).revision, revision);
  });
  await test("Personal wording follows permitted address forms, including mixed and any/all choices", () => {
    for (const [label, address] of Object.entries(ADDRESS_OPTIONS)) {
      const copy = checkinCopy(address);
      const own = label === "he/him" ? "his" : label === "she/her" ? "her" : "their";
      assert.equal(copy.ownWorld, `a world of ${own} own`);
      assert.match(copy.example, label === "he/him" ? /^He belongs/ : label === "she/her" ? /^She belongs/ : /^They belong/);
    }
  });
  await test("Her check-in from before this update is still her current one, and later saves keep old address choices", async () => {
    const legacy = new PGlite();
    const old = drizzle({ client: legacy, schema });
    try {
      await migrate(old, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
      await old.insert(schema.moods).values([{ day: "2026-09-13", mood: "rose", energy: 4 }, { day: "2026-09-15", mood: "night", energy: 3 }]);
      await old.insert(schema.settings).values([
        { key: "daily_feeling:2026-09-15", value: { key: "happy" } },
        { key: "address_overrides", value: { night: ADDRESS_OPTIONS["he/they"], iris: ADDRESS_OPTIONS["any/all"], constructor: ADDRESS_OPTIONS["he/him"] } },
      ]);
      assert.equal((await readCheckin(old, "2026-09-12")).current, null, "A later check-in doesn't reach back in time");
      const carried = await readCheckin(old, "2026-09-20");
      assert.equal(carried.current.key, "night"); assert.equal(carried.current.energy, 3);
      assert.equal(carried.current.feeling.key, "happy"); assert.equal(carried.current.address.label, "he/they");
      assert.equal((await readCheckin(old, "2026-09-20", "admin")).current, null, "The test copy never inherits her history");
      const saved = await saveCheckin(old, "2026-09-20", { mood: "rose", energy: 2 });
      assert.equal(saved.current.feeling.key, "happy");
      assert.equal(saved.choices.find(m => m.key === "iris").address.label, "any/all");
      assert.deepEqual((await readPersonState(old, "kiriya")).prefs.address, { night: "he/they", iris: "any/all" });
    } finally { await legacy.close(); }
  });
  await test("The production HTTP driver saves with one revision-checked write and no interactive transaction", async () => {
    const queries = [];
    let stored = null;
    const http = {
      query: (query, params) => {
        queries.push({ query, params });
        if (query.startsWith('select') && query.includes('from "person_state"')) return Promise.resolve({ rows: stored ? [stored] : [["kiriya", null, {}, 3, "2026-09-15T10:00:00Z"]] });
        if (query.includes('from "moods"')) return Promise.resolve({ rows: [] });
        if (query.includes('from "settings"')) return Promise.resolve({ rows: [[params[0], { night: ADDRESS_OPTIONS["he/him"] }, "2026-09-15T10:00:00Z"]] });
        if (query.startsWith('update "person_state"')) {
          stored = ["kiriya", JSON.parse(params[0]), JSON.parse(params[1]), params[2], params[3]];
          return Promise.resolve({ rows: [stored] });
        }
        return Promise.resolve({ rows: [] });
      },
      transaction: () => { throw new Error("Interactive transactions are unavailable over Neon HTTP"); },
    };
    const production = neonDrizzle({ client: http, schema });
    const saved = await saveCheckin(production, "2026-09-15", { mood: "night", energy: 3, feeling: "happy" });
    const writes = queries.filter(q => /^(insert|update)/.test(q.query));
    assert.equal(writes.length, 1);
    assert.match(writes[0].query, /where \("person_state"\."person" = \$\d+ and "person_state"\."revision" = \$\d+\)/);
    assert.equal(saved.current.feeling.key, "happy");
    assert.equal(saved.current.key, "night");
    assert.equal(saved.copy.ownWorld, "a world of his own");
  });
} finally { await client.close(); }
