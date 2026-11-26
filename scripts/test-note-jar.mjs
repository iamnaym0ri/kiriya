import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, like } from "drizzle-orm";
import * as schema from "../server/db/schema.js";

// Never a delivery provider: pushes are captured by a fake sender, and QStash stays off. Set before
// the server modules load, because env.js reads the environment once.
process.env.QSTASH_TOKEN = "";
process.env.VAPID_PUBLIC_KEY = "test-public";
process.env.VAPID_PRIVATE_KEY = "test-private";
const {
  addJarNote, announceJar, announceTime, remindJar, reminderTime, chooseNote, deleteJarNote, editJarNote, jarNote, keepNote,
  listJarNotes, nextRelease, noteHistory, pullNote, readNoteJar,
} = await import("../server/lib/noteJar.js");
const { saveCheckin } = await import("../server/lib/checkin.js");
const { birthdayInfo } = await import("../server/lib/birthday.js");
const client = new PGlite(), db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });

// Monday 2026-11-23, Singapore (UTC+8).
const at = (iso) => new Date(iso);
const evening = at("2026-11-23T14:00:00Z"); // 22:00 SGT
const morning = at("2026-11-24T00:00:00Z"); // 08:00 SGT
const later = at("2026-11-24T03:00:00Z"); // 11:00 SGT
const day = "2026-11-24";
const opts = (now = later) => ({ day, now, random: () => 0.3 });
const blank = () => ({ revision: 0, seen: [], ever: [], recent: [], last: null, daily: null });
const sent = [];
const fakeSend = async (_db, message, options) => { sent.push({ message, options }); return { sent: 1, failed: 0, targets: 1 }; };

try {
  await test("The bundled library is gone: an empty jar says so instead of breaking", async () => {
    const jar = await readNoteJar(db, day, { now: later });
    assert.equal(jar.total, 0);
    assert.equal(jar.fresh, 0);
    await assert.rejects(pullNote(db, randomUUID(), opts()), (error) => error.code === "jar_empty");
    assert.equal(chooseNote(blank(), { pool: [] }), null);
    // Josh's preview gets a marked sample instead, and nothing is saved.
    const sample = await pullNote(db, randomUUID(), { ...opts(), preview: true });
    assert.equal(sample.preview, true);
    assert.equal(sample.sample, true);
    assert.equal(sample.note.id, "sample");
    assert.equal((await readNoteJar(db, day, { now: later })).pulled, 0);
  });

  await test("A note written tonight waits for 08:00 tomorrow; one written before 08:00 joins that morning", () => {
    assert.equal(nextRelease(evening).toISOString(), "2026-11-24T00:00:00.000Z");
    assert.equal(nextRelease(at("2026-11-23T23:30:00Z")).toISOString(), "2026-11-24T00:00:00.000Z");
    assert.equal(nextRelease(at("2026-11-24T00:00:01Z")).toISOString(), "2026-11-25T00:00:00.000Z");
    assert.equal(announceTime(day, 10).toISOString(), "2026-11-24T02:00:00.000Z", "her later 'not before' hour wins");
    assert.equal(announceTime(day, 7).toISOString(), "2026-11-24T00:00:00.000Z", "never earlier than 08:00");
  });

  let first, second, sadNote;
  await test("Josh's notes stay hidden until morning, then light the heart and come out first, oldest first", async () => {
    first = await addJarNote(db, { text: "  first little note  " }, { now: evening });
    second = await addJarNote(db, { text: "second little note" }, { now: at("2026-11-23T14:05:00Z") });
    sadNote = await addJarNote(db, { text: "for the heavy days", feelings: ["sad", "not-a-feeling", "sad"] }, { now: at("2026-11-23T14:10:00Z") });
    assert.equal(first.text, "first little note");
    assert.deepEqual(sadNote.feelings, ["sad"]);
    const tonight = await readNoteJar(db, "2026-11-23", { now: evening });
    assert.equal(tonight.total, 0, "nothing joins the jar before 08:00");
    await assert.rejects(pullNote(db, randomUUID(), { day: "2026-11-23", now: evening }), (e) => e.code === "jar_empty");
    const jar = await readNoteJar(db, day, { now: morning });
    assert.equal(jar.total, 3);
    assert.equal(jar.fresh, 3);
    // Her mood doesn't hold a new note back: new notes come out first, in the order he wrote them.
    await saveCheckin(db, day, { mood: "cloud", address: "she/they", energy: 2, feeling: "happy" });
    const a = await pullNote(db, randomUUID(), opts(morning));
    const b = await pullNote(db, randomUUID(), opts(morning));
    assert.deepEqual([a.note.text, b.note.text], ["first little note", "second little note"]);
    assert(a.fresh && b.fresh);
    assert.match(a.note.byline, /^— /);
    assert.equal(a.note.label, "a little note, just for u");
    assert.equal((await readNoteJar(db, day, { now: morning })).fresh, 1);
  });

  await test("After the new ones, the mood-aware rotation takes over and never repeats a note back to back", async () => {
    const c = await pullNote(db, randomUUID(), opts());
    assert.equal(c.note.text, "for the heavy days");
    assert.equal(c.note.label, "for the heavy days");
    assert.equal((await readNoteJar(db, day, { now: later })).fresh, 0);
    let last = c.note.id;
    for (let i = 0; i < 6; i++) {
      const next = await pullNote(db, randomUUID(), opts());
      assert.notEqual(next.note.id, last);
      assert.notEqual(next.note.text, "for the heavy days", "a sad-day note stays out of a happy day once it's no longer new");
      assert(!next.fresh);
      last = next.note.id;
    }
    // A note written only for another mood still beats an empty jar.
    const pool = [jarNote({ id: "x", text: "only for sad days", feelings: ["sad"] })];
    assert.equal(chooseNote(blank(), { pool, feeling: "happy" }).note.id, "x");
  });

  await test("Editing or deleting a note never rewrites what she already pulled or kept", async () => {
    const [pulled] = (await noteHistory(db)).items.filter((item) => item.note.id === first.id);
    await keepNote(db, pulled.id, true);
    await editJarNote(db, first.id, { text: "edited later", feelings: ["playful"] });
    assert(await deleteJarNote(db, second.id));
    assert(!(await deleteJarNote(db, second.id)));
    const history = await noteHistory(db, { saved: true });
    assert.equal(history.items.find((item) => item.id === pulled.id).note.text, "first little note");
    assert.equal((await readNoteJar(db, day, { now: later })).total, 2);
  });

  await test("Her history from the old library survives the erase", async () => {
    const old = { id: randomUUID(), note: { id: "old-library-note", label: "ur art deserves some love", text: "an original kept note from before.", byline: "✦ kiriya.love", feelings: [], theme: "art" }, day: "2026-09-16", at: "2026-09-16T02:00:00.000Z", ordinal: 0, saved: true, revisited: false };
    await db.insert(schema.kv).values({ key: "notejar:pull:" + old.id, value: old });
    assert.deepEqual((await noteHistory(db, { saved: true })).items.find((item) => item.id === old.id), old);
    assert.notEqual((await pullNote(db, randomUUID(), opts())).note.id, "old-library-note");
  });

  await test("Admin preview shows what she gets next, including notes still waiting, and changes nothing", async () => {
    const waiting = await addJarNote(db, { text: "a preview of tomorrow" }, { now: later });
    const before = await readNoteJar(db, day, { now: later }), history = await noteHistory(db);
    const preview = await pullNote(db, randomUUID(), { ...opts(), preview: true });
    assert(preview.preview);
    assert.equal(preview.note.id, waiting.id);
    assert.deepEqual(await readNoteJar(db, day, { now: later }), before);
    assert.deepEqual(await noteHistory(db), history);
    const listed = await listJarNotes(db, { now: later });
    assert.equal(listed.notes.find((n) => n.id === waiting.id).status, "waiting");
    assert.equal(listed.notes.find((n) => n.id === first.id).status, "read");
    assert.deepEqual(listed.counts, { total: 3, waiting: 1, inJar: 0, read: 2 });
  });

  await test("Repeated and concurrent pulls with one request ID return one delivery", async () => {
    const id = randomUUID(), before = (await readNoteJar(db, day, { now: later })).pulled;
    const results = await Promise.all(Array.from({ length: 6 }, () => pullNote(db, id, opts())));
    assert.equal(new Set(results.map((r) => r.note.id)).size, 1);
    assert.equal((await readNoteJar(db, day, { now: later })).pulled, before + 1);
  });

  await test("The morning push goes out once, counts only unread new notes, and respects her hours", async () => {
    await db.update(schema.jarNotes).set({ announcedAt: null });
    // Wednesday 08:00: tomorrow's preview note is now released and unread.
    const wednesday = at("2026-11-25T00:00:30Z");
    const report = await announceJar(db, { now: wednesday, send: fakeSend });
    assert.equal(report.unread, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].message.title, "a new little note in your jar ♡");
    assert.equal(sent[0].message.navigate, "/world#note-jar");
    assert.equal(sent[0].options.role, "kiriya");
    const again = await announceJar(db, { now: wednesday, send: fakeSend });
    assert.equal(again.announced, 0);
    assert.equal(sent.length, 1, "a second call can't buzz her twice");
    assert.equal((await db.select().from(schema.kv).where(eq(schema.kv.key, "notejar:announce:last")))[0].value.unread, 1);
    // Notes she already drew before the push don't get announced as new.
    const read = await addJarNote(db, { text: "read before the push" }, { now: at("2026-11-25T01:00:00Z") });
    await db.update(schema.jarNotes).set({ firstPulledAt: at("2026-11-26T00:10:00Z") }).where(eq(schema.jarNotes.id, read.id));
    const quiet = await announceJar(db, { now: at("2026-11-26T00:30:00Z"), send: fakeSend });
    assert.equal(quiet.unread, 0);
    assert.equal(sent.length, 1);
    // Late at night (after her window) nothing is sent and nothing is claimed.
    await addJarNote(db, { text: "late" }, { now: at("2026-11-26T01:00:00Z") });
    const night = await announceJar(db, { now: at("2026-11-27T15:00:00Z"), send: fakeSend });
    assert.equal(night.skipped, "after her notification hours");
    assert.equal(sent.length, 1);
  });

  await test("The evening nudge comes once, only while new notes are still undrawn, inside her hours", async () => {
    sent.length = 0;
    assert.equal(reminderTime("2026-11-27", 22).toISOString(), "2026-11-27T11:00:00.000Z", "19:00 SGT");
    assert.equal(reminderTime("2026-11-27", 18).toISOString(), "2026-11-27T09:00:00.000Z", "an hour before her quiet time");
    const seven = at("2026-11-27T11:00:30Z");
    assert((await readNoteJar(db, "2026-11-27", { now: seven })).fresh >= 1, "yesterday's late note is still in the jar");
    const report = await remindJar(db, { now: seven, send: fakeSend });
    assert.equal(report.reminded, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].message.kind, "reminder");
    assert.match(sent[0].message.title, /waiting since this morning/);
    assert.equal((await remindJar(db, { now: seven, send: fakeSend })).skipped, "already reminded today");
    assert.equal((await remindJar(db, { now: at("2026-11-28T15:30:00Z"), send: fakeSend })).skipped, "outside her notification hours");
    assert.equal(sent.length, 1);
  });

  await test("Birthday returns every September 15 and stops the next day, including future years", () => {
    for (const year of [2026, 2027, 2028, 2030]) {
      assert(!birthdayInfo(`${year}-09-14`).isBirthday); assert(birthdayInfo(`${year}-09-15`).isBirthday); assert(!birthdayInfo(`${year}-09-16`).isBirthday);
    }
  });

  await test("Pull snapshots stay immutable rows in kv", async () => {
    const count = (await db.select().from(schema.kv).where(like(schema.kv.key, "notejar:pull:%"))).length;
    const state = (await db.select().from(schema.kv).where(eq(schema.kv.key, "notejar:state")))[0].value;
    assert.equal(count, state.revision + 1, "every real pull plus the one carried over from the old library");
  });
} finally { await client.close(); }
