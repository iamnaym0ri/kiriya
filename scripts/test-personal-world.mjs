import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

// The remembered-choices, public/private, passphrase, love note and widget flows, through the real
// production API adapter with an isolated in-memory database and no external network.
for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET", "OPENAI_API_KEY"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.KIRIYA_TZ = "Asia/Singapore";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
globalThis.fetch = () => {
  throw new Error("External network is disabled in these tests");
};

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const { env } = await import("../server/env.js");
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
const { forgetCredential } = await import("../server/auth/credentials.js");
const { isPublicMedia } = await import("../server/lib/media.js");
const loveNotes = await import("../server/lib/loveNotes.js");
app.onError((error) => {
  throw error;
});

function request(route, { method = "GET", cookie, body, headers = {}, csrf = true } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](
    new Request(rewritten, {
      method,
      headers: {
        ...(csrf ? { "x-kw": "1" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const json = async (response, status = 200) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
async function unlock(passphrase, expectedRole) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase } });
  if (!expectedRole) {
    assert.equal(response.status, 401);
    return null;
  }
  assert.equal((await json(response)).role, expectedRole);
  return response.headers.get("set-cookie").split(";")[0];
}
const cookieFrom = (response, fallback) => response.headers.get("set-cookie")?.split(";")[0] ?? fallback;
const role = async (cookie) => (await json(await request("session", { cookie }))).role;
// Signing fresh tokens directly lets the tests reach old sessions without waiting days.
function forgeSession(roleName, key, { issuedDaysAgo = 0 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ r: roleName, iat: now - issuedDaysAgo * 86400, exp: now + 86400 * 30, k: key })).toString("base64url");
  return `kw=v1.${payload}.${createHmac("sha256", env.sessionSecret).update(payload).digest("base64url")}`;
}

let kiriya = await unlock(phrases.kiriya, "kiriya");
let admin = await unlock(phrases.admin, "admin");

try {
  await test("Choices are remembered per person: Kiriya's are hers, the admin's are a separate test copy", async () => {
    const saved = await json(await request("me/mood", { method: "PUT", cookie: kiriya, body: { mood: "rose", energy: 3, feeling: "happy", address: "she/they" } }));
    assert.equal(saved.current.key, "rose");
    await json(await request("me/mood", { method: "PUT", cookie: admin, body: { mood: "night", energy: 0, feeling: "angry", address: "he/him" } }));
    const mine = await json(await request("me/mood", { cookie: kiriya }));
    assert.equal(mine.current.feeling.key, "happy");
    assert.equal(mine.current.address.label, "she/they");
    assert.equal((await json(await request("me/address", { cookie: kiriya }))).moods.find((m) => m.key === "night").current, "he/him", "The admin's address test didn't reach her");

    const prefs = await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { motion: "quiet", cornerSmall: true, hints: { install: true } } }));
    assert.equal(prefs.motion, "quiet");
    assert.equal(prefs.cornerSmall, true);
    assert.equal(prefs.sharingChosen, false);
    assert.deepEqual(prefs.sharing, { address: false, presentation: false, feeling: false, energy: false });
    assert.equal((await json(await request("me/prefs", { cookie: admin }))).motion, null);
    for (const body of [{ motion: "wild" }, { sharing: { secrets: true } }, { hints: { nope: true } }, { pins: [] }])
      assert.equal((await request("me/prefs", { method: "PATCH", cookie: kiriya, body })).status, 400);
    assert.equal((await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { motion: "lively" }, csrf: false })).status, 400, "Writes still need the site's own header");
    assert.equal((await request("me/prefs")).status, 401);
  });

  await test("Visitors see only what she chose to share; the admin preview uses the admin's own choices", async () => {
    const hidden = await json(await request("public/profile"));
    assert.equal(hidden.today, null, "Nothing is shared until she turns it on");
    assert.deepEqual(hidden.pins, []);
    const cached = await request("public/profile");
    assert.equal(cached.headers.get("cache-control"), "public, max-age=0, must-revalidate", "Browsers never reuse an old status");
    assert.match(cached.headers.get("vercel-cdn-cache-control"), /max-age=15/);

    await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { sharing: { feeling: true, energy: true } } }));
    const shared = await json(await request("public/profile"));
    assert.deepEqual(shared.today.items.map((item) => item.key), ["feeling", "energy"]);
    assert.equal(shared.today.items[0].value, "Happy");
    assert.equal(shared.today.items[1].level, 3);
    assert.ok(!JSON.stringify(shared.today).includes("she/they"), "Unshared address stays private");

    await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { sharing: { address: true, feeling: false } } }));
    const changed = await json(await request("public/profile"));
    assert.deepEqual(changed.today.items.map((item) => [item.key, item.value]), [["address", "she/they"], ["energy", "Feeling good, whatsupp!"]]);

    assert.equal((await request("me/public-preview")).status, 401);
    assert.equal((await json(await request("me/public-preview", { cookie: admin }))).today, null, "The admin's test copy shares nothing yet");
    await json(await request("me/prefs", { method: "PATCH", cookie: admin, body: { sharing: { presentation: true } } }));
    const preview = await json(await request("me/public-preview", { cookie: admin }));
    assert.deepEqual(preview.today.items.map((item) => [item.key, item.value]), [["presentation", "Masc"]]);
    assert.deepEqual((await json(await request("public/profile"))).today.items.map((item) => item.key), ["address", "energy"], "The admin's test never reaches visitors");
    assert.equal((await json(await request("me/public-preview", { cookie: kiriya }))).today.items.length, 2);
  });

  await test("Her bio, socials, loves, intro song and view counter are hers to set; the admin's stay a test copy", async () => {
    const defaults = await json(await request("public/profile"));
    assert.deepEqual(defaults.loves, ["Vocaloid", "The Apothecary Diaries", "Drawing", "Cosplay"]);
    assert.deepEqual(defaults.socials, { tiktok: null, instagram: null }, "No Discord, and nothing until she adds a handle");
    assert.equal((await json(await request("me/profile", { cookie: kiriya }))).introSong, "featured");

    const [upload] = await db.insert(schema.songs).values({ kind: "upload", provider: "audio", url: "/api/uploads/media?path=songs/intro-test.mp3", title: "intro test", artist: "kiriya", featured: false, isPublic: false }).returning();
    const [link] = await db.insert(schema.songs).values({ kind: "link", provider: "youtube", url: "https://www.youtube.com/watch?v=shs0rAiwsGQ", title: "Senbonzakura", artist: "Kurousa-P", featured: true, isPublic: true }).returning();
    assert.equal(defaults.song, null);
    assert.equal((await json(await request("public/profile"))).song.title, "Senbonzakura", "With nothing picked, her featured song is the intro");

    const saved = await json(await request("me/profile", { method: "PUT", cookie: kiriya, body: {
      bioLines: ["maomao's no. 1 apprentice", "  ", "drawing past bedtime"],
      socials: { tiktok: "https://www.tiktok.com/@kiri.ya?lang=en", instagram: "@kiriya_draws" },
      loves: ["vocaloid", "", "cosplay"],
      introSong: upload.id,
      showViews: false,
    } }));
    assert.deepEqual(saved.bioLines, ["maomao's no. 1 apprentice", "drawing past bedtime"]);
    assert.deepEqual(saved.socials, { tiktok: "kiri.ya", instagram: "kiriya_draws" });
    const page = await json(await request("public/profile"));
    assert.deepEqual(page.socials, {
      tiktok: { handle: "kiri.ya", url: "https://www.tiktok.com/@kiri.ya" },
      instagram: { handle: "kiriya_draws", url: "https://www.instagram.com/kiriya_draws/" },
    });
    assert.deepEqual(page.loves, ["vocaloid", "cosplay"]);
    assert.equal(page.song.provider, "audio");
    assert.equal(page.song.title, "intro test");
    assert.equal(page.views, null, "Hidden view counter sends no count");
    assert.equal(await isPublicMedia(upload.url), true, "Her uploaded intro song plays for visitors");

    await json(await request("me/profile", { method: "PUT", cookie: admin, body: { bioLines: ["admin test bio"], socials: { tiktok: "admin.test", instagram: "" }, loves: ["testing"], introSong: "none", showViews: true } }));
    const stillHers = await json(await request("public/profile"));
    assert.deepEqual(stillHers.bioLines, ["maomao's no. 1 apprentice", "drawing past bedtime"], "The admin's test bio never reaches visitors");
    assert.equal(stillHers.song.title, "intro test");
    const adminPreview = await json(await request("me/public-preview", { cookie: admin }));
    assert.deepEqual(adminPreview.bioLines, ["admin test bio"]);
    assert.deepEqual(adminPreview.socials, { tiktok: { handle: "admin.test", url: "https://www.tiktok.com/@admin.test" }, instagram: null });
    assert.equal(adminPreview.song, null, "No intro song, no tap-to-enter screen");
    assert.equal(typeof adminPreview.views, "number");

    for (const body of [
      { socials: { tiktok: "not a handle!", instagram: "" } },
      { socials: { tiktok: "", instagram: "x".repeat(31) } },
      { bioLines: Array.from({ length: 7 }, (_, i) => `line ${i}`) },
      { bioLines: ["x".repeat(81)] },
      { loves: Array.from({ length: 13 }, (_, i) => `love ${i}`) },
      { introSong: "00000000-0000-4000-8000-000000000000" },
      { discord: "someone" },
    ]) {
      const response = await request("me/profile", { method: "PUT", cookie: kiriya, body: { bioLines: [], socials: { tiktok: "", instagram: "" }, loves: [], introSong: "featured", showViews: true, ...body } });
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.match((await json(await request("me/profile", { method: "PUT", cookie: kiriya, body: { bioLines: [], socials: { tiktok: "no spaces allowed", instagram: "" }, loves: [], introSong: "featured", showViews: true } }), 400)).message, /TikTok handle/);

    await json(await request("me/profile", { method: "PUT", cookie: kiriya, body: { bioLines: [], socials: { tiktok: "", instagram: "" }, loves: [], introSong: "featured", showViews: true } }));
    assert.equal(await isPublicMedia(upload.url), false, "Once it's not her intro song, the upload is private again");
    const reset = await json(await request("public/profile"));
    assert.equal(reset.song.title, "Senbonzakura");
    assert.deepEqual(reset.bioLines, []);
    assert.equal(typeof reset.views, "number");
    await db.delete(schema.songs).where(eq(schema.songs.id, link.id));
    await db.delete(schema.songs).where(eq(schema.songs.id, upload.id));
  });

  await test("Pinned artwork becomes public only while it stays pinned on Kiriya's board", async () => {
    const art = [];
    for (let i = 0; i < 8; i++)
      art.push((await db.insert(schema.artworks).values({ url: `/api/uploads/media?path=art/pin-${i}.png`, prompt: `doodle ${i}`, width: 400, height: 400 }).returning())[0]);
    assert.equal(await isPublicMedia(art[0].url), false);
    await json(await request(`me/pins/${art[0].id}`, { method: "PUT", cookie: kiriya, body: { pinned: true } }));
    await json(await request(`me/pins/${art[1].id}`, { method: "PUT", cookie: kiriya, body: { pinned: true } }));
    const board = await json(await request("public/profile"));
    assert.deepEqual(board.pins.map((pin) => pin.caption), ["doodle 1", "doodle 0"]);
    assert.equal(await isPublicMedia(art[0].url), true);

    await json(await request(`me/pins/${art[2].id}`, { method: "PUT", cookie: admin, body: { pinned: true } }));
    assert.equal(await isPublicMedia(art[2].url), false, "An admin test pin never opens media to visitors");
    assert.deepEqual((await json(await request("me/public-preview", { cookie: admin }))).pins.map((pin) => pin.id), [art[2].id]);

    for (const piece of art.slice(2, 6)) await json(await request(`me/pins/${piece.id}`, { method: "PUT", cookie: kiriya, body: { pinned: true } }));
    assert.equal((await json(await request(`me/pins/${art[6].id}`, { method: "PUT", cookie: kiriya, body: { pinned: true } }), 409)).error, "board_full");
    await db.delete(schema.artworks).where(eq(schema.artworks.id, art[5].id));
    assert.equal((await json(await request("public/profile"))).pins.length, 5, "Deleted artwork leaves the board");
    await json(await request(`me/pins/${art[6].id}`, { method: "PUT", cookie: kiriya, body: { pinned: true } }));

    await json(await request(`me/pins/${art[0].id}`, { method: "PUT", cookie: kiriya, body: { pinned: false } }));
    assert.equal(await isPublicMedia(art[0].url), false, "Unpinning makes it private again");
    assert.equal((await request(`me/pins/${randomBytes(4).toString("hex")}`, { method: "PUT", cookie: kiriya, body: { pinned: true } })).status, 400);
    assert.equal((await request("me/pins/00000000-0000-4000-8000-000000000000", { method: "PUT", cookie: kiriya, body: { pinned: true } })).status, 404);
  });

  await test("Sessions last two days, even while in use, including cookies issued before the change", async () => {
    const { configuredKeyVersion } = await import("../server/auth/session.js");
    const unlocked = await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya } });
    assert.match(unlocked.headers.get("set-cookie"), /Max-Age=172800/);
    const expiresAt = Date.parse((await unlocked.json()).expiresAt);
    assert.ok(Math.abs(expiresAt - (Date.now() + 2 * 86400_000)) < 60_000);

    const key = configuredKeyVersion("kiriya");
    const recent = await request("me/mood", { cookie: forgeSession("kiriya", key, { issuedDaysAgo: 1.9 }) });
    assert.equal(recent.status, 200);
    assert.equal(recent.headers.get("set-cookie"), null, "Using the site doesn't extend the two days");
    assert.equal(await role(forgeSession("kiriya", key, { issuedDaysAgo: 2.1 })), null, "Older than two days needs the passphrase");
    const locked = await request("me/mood", { cookie: forgeSession("kiriya", key, { issuedDaysAgo: 2.1 }) });
    assert.equal((await json(locked, 401)).error, "locked", "The app recognises this as a session that ended");
    assert.equal(await role(forgeSession("admin", configuredKeyVersion("admin"), { issuedDaysAgo: 3 })), null);
  });

  await test("Changing a passphrase checks the current one, keeps this device, and can sign out the others", async () => {
    const otherDevice = await unlock(phrases.kiriya, "kiriya");
    const next = "strawberry milk tea";
    assert.equal((await json(await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: "nope nope nope", next } }), 401)).error, "wrong_passphrase");
    assert.equal((await json(await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: phrases.kiriya, next: "short" } }), 400)).error, "too_short");
    assert.equal((await json(await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: phrases.kiriya, next: ` ${phrases.kiriya.toUpperCase()} ` } }), 400)).error, "unchanged");
    assert.equal((await json(await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: phrases.kiriya, next: phrases.admin } }), 400)).error, "unavailable");
    assert.equal((await json(await request("me/passphrase", { cookie: kiriya }))).custom, false);

    const changed = await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: phrases.kiriya, next, signOutOthers: true } });
    assert.equal((await json(changed)).signedOutOthers, true);
    kiriya = cookieFrom(changed, kiriya);
    assert.equal(await role(kiriya), "kiriya", "The device that changed it stays unlocked");
    assert.equal(await role(otherDevice), null, "Other devices are signed out");
    await unlock(phrases.kiriya, null);
    const phone = await unlock("Strawberry  Milk Tea", "kiriya");
    assert.equal((await json(await request("me/passphrase", { cookie: kiriya }))).custom, true);
    const stored = (await db.select().from(schema.credentials).where(eq(schema.credentials.role, "kiriya")))[0];
    assert.match(stored.hash, /^scrypt\$/);
    assert.ok(!JSON.stringify(stored).includes("strawberry"));

    const keepOthers = await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: next, next: "lilac world forever", signOutOthers: false } });
    kiriya = cookieFrom(keepOthers, kiriya);
    assert.equal(await role(phone), "kiriya", "Without sign-out, other devices stay unlocked");
    await unlock("lilac world forever", "kiriya");

    const signOut = await request("me/passphrase/sign-out-others", { method: "POST", cookie: kiriya, body: {} });
    await json(signOut);
    kiriya = cookieFrom(signOut, kiriya);
    assert.equal(await role(phone), null);
    assert.equal(await role(kiriya), "kiriya");
    assert.equal(await role(admin), "admin", "Her changes never touch the admin's sessions");
  });

  await test("The admin can reset Kiriya to the configured passphrase, which signs out her devices", async () => {
    assert.equal((await request("admin/credentials/kiriya/reset", { method: "POST", cookie: kiriya, body: {} })).status, 401);
    assert.deepEqual((await json(await request("admin/credentials", { cookie: admin }))).kiriya.custom, true);
    await json(await request("admin/credentials/kiriya/reset", { method: "POST", cookie: admin, body: {} }));
    assert.equal(await role(kiriya), null);
    await unlock("lilac world forever", null);
    kiriya = await unlock(phrases.kiriya, "kiriya");
    assert.equal((await json(await request("admin/credentials", { cookie: admin }))).kiriya.custom, false);
    forgetCredential("kiriya");
  });

  await test("Love notes reach the right person's world, on time, once, with a record for the admin", async () => {
    assert.equal((await request("admin/love-notes", { cookie: kiriya })).status, 401);
    const now = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "thinking of u", body: "hope ur day is soft ♡", when: { mode: "now" } } }));
    assert.equal(now.note.status, "sent");
    assert.deepEqual(now.note.pushResult, { skipped: "notifications aren't configured" });
    const test = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "admin", kind: "surprise", title: "test", body: "only for the admin phone", when: { mode: "now" } } }));
    const later = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const scheduled = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "later", body: "a note for this evening", when: { mode: "at", at: later.toISOString() } } }));
    assert.equal(scheduled.note.status, "scheduled");
    assert.deepEqual(scheduled.schedule, { scheduled: false });
    const surprise = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "boo", body: "surprise", when: { mode: "surprise" } } }));
    assert.ok(new Date(surprise.note.sendAt) > new Date());
    for (const body of [{ recipient: "visitor", title: "x", body: "y", when: { mode: "now" } }, { recipient: "kiriya", title: "", body: "y", when: { mode: "now" } }, { recipient: "kiriya", title: "x", body: "y", when: { mode: "at", at: "2020-01-01T00:00:00Z" } }])
      assert.equal((await request("admin/love-notes", { method: "POST", cookie: admin, body })).status, 400);

    const hers = await json(await request("me/notes", { cookie: kiriya }));
    assert.deepEqual(hers.notes.map((note) => note.title), ["thinking of u"], "Only arrived notes, only hers");
    assert.equal(hers.unread, 1);
    assert.deepEqual((await json(await request("me/notes", { cookie: admin }))).notes.map((note) => note.title), ["test"]);
    assert.equal((await request(`me/notes/${test.note.id}/open`, { method: "POST", cookie: kiriya, body: {} })).status, 404, "She can't open the admin's test note");
    assert.equal((await request(`me/notes/${scheduled.note.id}/open`, { method: "POST", cookie: kiriya, body: {} })).status, 404, "A note can't be opened before its time");
    const opened = await json(await request(`me/notes/${now.note.id}/open`, { method: "POST", cookie: kiriya, body: {} }));
    assert.ok(opened.note.openedAt);
    assert.equal((await json(await request("me/notes", { cookie: kiriya }))).unread, 0);

    assert.equal((await json(await request(`admin/love-notes/${surprise.note.id}`, { method: "DELETE", cookie: admin }))).note.status, "canceled");
    assert.equal((await request(`admin/love-notes/${surprise.note.id}`, { method: "DELETE", cookie: admin })).status, 409);

    // QStash's callback: signed, idempotent, and quiet about notes that were never due.
    assert.equal((await request("jobs/love-note", { method: "POST", body: { id: scheduled.note.id } })).status, 401);
    env.cronSecret = "test-cron-secret";
    const callback = (id) => request("jobs/love-note", { method: "POST", body: { id }, headers: { authorization: "Bearer test-cron-secret" } });
    assert.equal((await json(await callback(scheduled.note.id))).delivered, false, "Too early: nothing is claimed");
    assert.equal((await callback("not-a-note")).status, 400);
    const arrival = new Date(later.getTime() + 30_000);
    assert.equal((await loveNotes.deliverLoveNote(db, scheduled.note.id, { now: arrival })).status, "sent");
    assert.equal(await loveNotes.deliverLoveNote(db, scheduled.note.id, { now: arrival }), null, "A repeated callback can't send twice");
    assert.deepEqual((await loveNotes.inbox(db, "kiriya", { now: arrival })).notes.map((note) => note.title), ["later", "thinking of u"]);

    const noon = new Date("2030-01-01T04:00:00Z"); // 12:00 in Singapore, inside the default 10–22 window
    const lost = await loveNotes.createLoveNote(db, { recipient: "kiriya", title: "lost", body: "callback never came", sendAt: new Date(noon.getTime() - 5 * 60 * 60 * 1000) });
    assert.equal((await loveNotes.sweepLoveNotes(db, noon)).delivered, 1);
    const [row] = await db.select().from(schema.loveNotes).where(eq(schema.loveNotes.id, lost.id));
    assert.deepEqual(row.pushResult, { skipped: "delivered late, without a notification" }, "Very late notes don't buzz");
    const afterMidnight = new Date("2030-01-01T16:20:00Z"); // 00:20 in Singapore, when the backstop runs
    const missed = await loveNotes.createLoveNote(db, { recipient: "kiriya", title: "missed", body: "callback lost at 23:30", sendAt: new Date(afterMidnight.getTime() - 50 * 60 * 1000) });
    await loveNotes.sweepLoveNotes(db, afterMidnight);
    const [night] = await db.select().from(schema.loveNotes).where(eq(schema.loveNotes.id, missed.id));
    assert.equal(night.status, "sent");
    assert.match(night.pushResult.skipped, /outside notification hours/, "The midnight backstop never buzzes her phone");
    env.cronSecret = undefined;

    const list = await json(await request("admin/love-notes", { cookie: admin }));
    assert.equal(list.notes.find((note) => note.id === now.note.id).openedAt !== null, true, "The admin can see it was read");
    assert.deepEqual(list.devices, { kiriya: 0, admin: 0 });
  });

  await test("Only Kiriya's own settings change her notification hours; the admin phone can still subscribe", async () => {
    const hours = { enabled: true, perDay: 2, startHour: 9, endHour: 21 };
    assert.equal((await json(await request("push/settings", { method: "PUT", cookie: admin, body: { ...hours, enabled: false } }), 403)).error, "hers_only");
    assert.deepEqual(await json(await request("push/settings", { method: "PUT", cookie: kiriya, body: hours })), hours);
    assert.equal((await json(await request("push/status", { cookie: admin }))).settings.enabled, true);
    const subscribed = await request("push/subscribe", { method: "POST", cookie: admin, body: { endpoint: "https://web.push.apple.com/test-admin-phone", keys: { p256dh: "p".repeat(20), auth: "a".repeat(16) } } });
    assert.equal(subscribed.status, 200);
    const [device] = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, "https://web.push.apple.com/test-admin-phone"));
    assert.equal(device.role, "admin", "Test notes reach this phone; Kiriya's notes never do");
    const iphone = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)" };
    await request("push/subscribe", { method: "POST", cookie: kiriya, headers: iphone, body: { endpoint: device.endpoint, keys: { p256dh: "p".repeat(20), auth: "a".repeat(16) } } });
    const switched = await json(await request("admin/love-notes", { cookie: admin }));
    assert.deepEqual(switched.devices, { kiriya: 1, admin: 0 }, "Opening the app with her passphrase makes the phone one of hers");
    await request("push/subscribe", { method: "POST", cookie: admin, headers: iphone, body: { endpoint: device.endpoint, keys: { p256dh: "p".repeat(20), auth: "a".repeat(16) } } });
    const back = await json(await request("admin/love-notes", { cookie: admin }));
    assert.deepEqual(back.devices, { kiriya: 0, admin: 1 }, "And the admin phrase makes it a test device again");
    assert.equal(back.phones[0].role, "admin");
    await request("push/unsubscribe", { method: "POST", cookie: admin, body: { endpoint: device.endpoint } });
    const prefs = await json(await request("me/prefs", { method: "PATCH", cookie: admin, body: { hints: { notifications: true } } }));
    assert.equal(prefs.hints.notifications, true);
  });

  await test("Notification timing and previews stay inside her window and lock-screen sized", () => {
    const settings = { startHour: 10, endHour: 22 };
    const morning = new Date("2026-09-16T00:30:00Z"); // 08:30 in Singapore
    const early = loveNotes.surpriseTime(settings, morning, () => 0);
    assert.equal(early.toISOString(), "2026-09-16T02:00:00.000Z");
    const late = loveNotes.surpriseTime(settings, new Date("2026-09-16T13:55:00Z"), () => 0.999); // 21:55 → tomorrow
    assert.ok(late > new Date("2026-09-17T02:00:00Z") && late < new Date("2026-09-17T13:50:01Z"));
    const long = "a ".repeat(200);
    assert.ok(loveNotes.notificationPreview(long).length <= 150);
    assert.ok(loveNotes.notificationPreview(long).endsWith("…"));
    assert.equal(loveNotes.isNoteLink("/world/letters"), true);
    assert.equal(loveNotes.isNoteLink("https://evil.example"), false);
    assert.equal(loveNotes.isNoteLink("//evil.example/world"), false);
  });

  await test("A new letter can tell her phone, now or when it unlocks", async () => {
    const soon = await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "note", title: "for today", body: "hi", notify: true } }));
    assert.equal(soon.announcement.note.status, "sent");
    assert.equal(soon.announcement.note.link, "/world/letters");
    const unlockAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const locked = await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "open_when", title: "later letter", body: "hi", unlockAt, notify: true } }));
    assert.equal(locked.announcement.note.status, "scheduled");
    assert.equal(new Date(locked.announcement.note.sendAt).toISOString(), unlockAt);
    assert.equal((await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "note", title: "quiet", body: "hi" } }))).announcement, null);

    const lettersBefore = (await db.select().from(schema.letters)).length;
    const tried = await json(await request("admin/letters/test-announcement", { method: "POST", cookie: admin, body: { title: "a draft" } }));
    assert.equal(tried.note.recipient, "admin", "Trying a letter notification only reaches the admin's phone");
    assert.equal(tried.note.link, "/world/letters");
    assert.equal(tried.note.body, "“a draft” is waiting in your letters ♡");
    assert.equal((await db.select().from(schema.letters)).length, lettersBefore, "No letter is saved for her to see");
    assert.ok(!(await json(await request("me/notes", { cookie: kiriya }))).notes.some((note) => note.id === tried.note.id));
    assert.equal((await request("admin/letters/test-announcement", { method: "POST", cookie: kiriya, body: { title: "x" } })).status, 401);
  });

  await test("Widget keys are shown once, stored hashed, scoped to their person and revocable", async () => {
    assert.equal((await request("widget")).status, 401);
    const made = await json(await request("me/device-keys", { method: "POST", cookie: kiriya, body: { label: "her iPhone" } }));
    assert.match(made.key, /^kw_[A-Za-z0-9_-]{32}$/);
    const [stored] = await db.select().from(schema.deviceKeys).where(eq(schema.deviceKeys.id, made.id));
    assert.notEqual(stored.keyHash, made.key);
    assert.ok(!JSON.stringify(await json(await request("me/device-keys", { cookie: kiriya }))).includes(made.key), "The key isn't listed again");
    assert.deepEqual((await json(await request("me/device-keys", { cookie: admin }))).keys, []);
    const bearer = { authorization: `Bearer ${made.key}` };

    const snapshot = await json(await request("widget", { headers: bearer, csrf: false }));
    assert.equal(snapshot.status.pronouns, "she/they");
    assert.equal(snapshot.latestNote.title, "a new letter for you ✉");
    assert.match(snapshot.latestNote.preview, /“for today” is waiting/);
    assert.equal(snapshot.links.status, "https://kiriya.love/world?quick=status");
    assert.equal((await json(await request(`widget?key=${made.key}`, { csrf: false }))).status.battery.level, 3, "Plain-URL widget apps can read");
    assert.equal((await request("widget/status", { method: "PUT", body: { battery: 1 }, headers: {}, csrf: false })).status, 401);
    assert.equal((await request(`widget/status?key=${made.key}`, { method: "PUT", body: { battery: 1 }, csrf: false })).status, 401, "Changes need the header, not a URL key");
    assert.equal((await request("me/mood", { headers: bearer, csrf: false })).status, 401, "A widget key opens nothing else");

    const menu = await json(await request("widget/menu", { headers: bearer, csrf: false }));
    assert.equal(menu.choices.length, 5 + 8 + 1 + 4);
    const battery = await json(await request("widget/status", { method: "PUT", body: { pick: menu.choices[0] }, headers: bearer, csrf: false }));
    assert.equal(battery.message, "social battery: kindly fuck off ✓");
    assert.equal(battery.status.battery.level, 0);
    const mood = await json(await request("widget/status", { method: "PUT", body: { mood: "😏 playful" }, headers: bearer, csrf: false }));
    assert.equal(mood.status.mood.label, "Playful");
    assert.equal(mood.status.pronouns, "she/they", "A quick change keeps everything else");
    const cleared = await json(await request("widget/status", { method: "PUT", body: { pick: "✕ mood · clear it" }, headers: bearer, csrf: false }));
    assert.equal(cleared.status.mood, null);
    assert.equal((await json(await request("widget/status", { method: "PUT", body: { presentation: "fluid", pronouns: "they/them" }, headers: bearer, csrf: false }))).status.pronouns, "they/them");
    for (const body of [{}, { pick: "🔋 battery · infinite" }, { battery: 9 }, { mood: "evil" }, { pronouns: "__proto__" }, { extra: true }])
      assert.equal((await request("widget/status", { method: "PUT", body, headers: bearer, csrf: false })).status, 400);
    assert.equal((await json(await request("me/mood", { cookie: kiriya }))).current.key, "iris", "Widget changes are her real check-in");
    assert.equal((await json(await request("me/mood", { cookie: admin }))).current.key, "night");
    assert.match((await json(await request("widget/note", { headers: bearer, csrf: false }))).text, /^a new letter for you ✉\n\n“for today”/);

    const script = await json(await request("me/widget-script", { cookie: kiriya }));
    assert.ok(script.script.includes(script.placeholder));
    assert.ok(script.script.includes('"https://kiriya.love"'));

    for (let i = 0; i < 4; i++) await json(await request("me/device-keys", { method: "POST", cookie: kiriya, body: { label: `spare ${i}` } }));
    assert.equal((await request("me/device-keys", { method: "POST", cookie: kiriya, body: { label: "one too many" } })).status, 409);
    assert.equal((await request(`me/device-keys/${made.id}`, { method: "DELETE", cookie: admin })).status, 404, "The admin can't revoke her keys from their own settings");
    await json(await request(`me/device-keys/${made.id}`, { method: "DELETE", cookie: kiriya }));
    assert.equal((await request("widget", { headers: bearer, csrf: false })).status, 401);

    const adminKey = await json(await request("me/device-keys", { method: "POST", cookie: admin, body: { label: "test phone" } }));
    assert.equal((await json(await request("widget", { headers: { authorization: `Bearer ${adminKey.key}` }, csrf: false }))).status.presentation.label, "Masc");
    const spare = await json(await request("me/device-keys", { cookie: kiriya }));
    assert.equal(spare.keys.length, 4);
    const signOut = await request("me/passphrase/sign-out-others", { method: "POST", cookie: kiriya, body: {} });
    kiriya = cookieFrom(signOut, kiriya);
    assert.deepEqual((await json(await request("me/device-keys", { cookie: kiriya }))).keys, [], "Signing out other devices also turns off widget keys");
    assert.equal((await request("widget", { headers: { authorization: `Bearer ${adminKey.key}` }, csrf: false })).status, 200, "Only her own keys");
  });

  await test("She can heart a note or letter, or pick one emoji, and the admin desk sees it", async () => {
    const note = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "react to me", body: "♡", when: { mode: "now" } } }));
    const react = (path, reaction, cookie = kiriya) => request(`me/${path}/reaction`, { method: "PUT", cookie, body: { reaction } });
    assert.equal((await json(await react(`notes/${note.note.id}`, "heart"))).note.reaction, "heart");
    assert.equal((await json(await react(`notes/${note.note.id}`, "🥹"))).note.reaction, "🥹", "An emoji replaces the heart");
    assert.equal((await json(await request("me/notes", { cookie: kiriya }))).notes.find((item) => item.id === note.note.id).reaction, "🥹");
    const desk = (await json(await request("admin/love-notes", { cookie: admin }))).notes.find((item) => item.id === note.note.id);
    assert.equal(desk.reaction, "🥹");
    assert.ok(desk.reactedAt);
    for (const reaction of ["hi", "🥹🥹", "<3", "", 3]) assert.equal((await react(`notes/${note.note.id}`, reaction)).status, 400, `rejects ${JSON.stringify(reaction)}`);
    assert.equal((await react(`notes/${note.note.id}`, "heart", admin)).status, 404, "The admin can't react to her notes");
    const future = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "not yet", body: "later", when: { mode: "at", at: new Date(Date.now() + 3_600_000).toISOString() } } }));
    assert.equal((await react(`notes/${future.note.id}`, "heart")).status, 404, "A note can't be reacted to before it arrives");
    const cleared = await json(await react(`notes/${note.note.id}`, null));
    assert.equal(cleared.note.reaction, null);
    assert.equal((await db.select().from(schema.loveNotes).where(eq(schema.loveNotes.id, note.note.id)))[0].reactedAt, null);

    const letter = await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "note", title: "a letter to heart", body: "hi" } }));
    const sealed = await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "open_when", title: "sealed", body: "hi", unlockAt: new Date(Date.now() + 86_400_000).toISOString() } }));
    assert.deepEqual(await json(await react(`letters/${letter.id}`, "heart")), { id: letter.id, reaction: "heart" });
    assert.equal((await json(await request("me/letters", { cookie: kiriya }))).letters.find((item) => item.id === letter.id).reaction, "heart");
    assert.equal((await json(await request("me/letters", { cookie: admin }))).letters.find((item) => item.id === letter.id).reaction, "heart", "The admin preview shows her reaction");
    assert.equal((await json(await react(`letters/${letter.id}`, "😭", admin), 403)).error, "preview_only", "The admin preview can't change it");
    assert.equal((await react(`letters/${sealed.id}`, "heart")).status, 404, "A sealed letter can't be reacted to");
    assert.equal((await react("letters/not-a-letter", "heart")).status, 404);
    assert.equal((await json(await request("admin/letters", { cookie: admin }))).find((item) => item.id === letter.id).reaction, "heart");
  });

  await test("The admin can leave little notes on her doodles; she sees them, and opening one marks them seen", async () => {
    const [doodle] = await db.insert(schema.artworks).values({ url: "/api/uploads/media?path=art/noted.png", prompt: "a cat", width: 400, height: 400 }).returning();
    assert.equal((await request("admin/artworks", { cookie: kiriya })).status, 401);
    assert.ok((await json(await request("admin/artworks", { cookie: admin }))).artworks.some((art) => art.id === doodle.id));
    const quiet = await json(await request(`admin/artworks/${doodle.id}/notes`, { method: "POST", cookie: admin, body: { body: "the whiskers!!" } }));
    assert.equal(quiet.announcement, null);
    const loud = await json(await request(`admin/artworks/${doodle.id}/notes`, { method: "POST", cookie: admin, body: { body: "framing this one", notify: true } }));
    assert.equal(loud.announcement.note.recipient, "kiriya");
    assert.equal(loud.announcement.note.link, `/world?gallery=1&doodle=${doodle.id}#play-desk`);
    assert.ok(loveNotes.isNoteLink(loud.announcement.note.link));
    assert.equal(loud.announcement.note.body, "on “a cat”: framing this one");
    for (const body of [{ body: "" }, { body: "x".repeat(301) }]) assert.equal((await request(`admin/artworks/${doodle.id}/notes`, { method: "POST", cookie: admin, body })).status, 400);
    assert.equal((await request("admin/artworks/00000000-0000-4000-8000-000000000000/notes", { method: "POST", cookie: admin, body: { body: "hi" } })).status, 404);

    const gallery = async (cookie = kiriya) => (await json(await request("me/artworks", { cookie }))).artworks.find((art) => art.id === doodle.id);
    assert.deepEqual((await gallery()).notes.map((note) => [note.body, note.seenAt]), [["the whiskers!!", null], ["framing this one", null]]);
    assert.deepEqual(await json(await request(`me/artworks/${doodle.id}/notes/seen`, { method: "POST", cookie: admin, body: {} })), { seen: 0 });
    assert.equal((await gallery(admin)).notes[0].seenAt, null, "The admin preview leaves them new for her");
    assert.deepEqual(await json(await request(`me/artworks/${doodle.id}/notes/seen`, { method: "POST", cookie: kiriya, body: {} })), { seen: 2 });
    assert.ok((await gallery()).notes.every((note) => note.seenAt));

    const reactToDoodle = (id, reaction, cookie = admin) => request(`admin/artworks/${id}/reaction`, { method: "PUT", cookie, body: { reaction } });
    assert.deepEqual(await json(await reactToDoodle(doodle.id, "heart")), { id: doodle.id, reaction: "heart" });
    assert.equal((await gallery()).reaction, "heart", "She sees the heart in her gallery");
    assert.equal((await json(await reactToDoodle(doodle.id, "🥰"))).reaction, "🥰", "An emoji replaces the heart");
    assert.equal((await json(await request("admin/artworks", { cookie: admin }))).artworks.find((art) => art.id === doodle.id).reaction, "🥰");
    assert.equal((await reactToDoodle(doodle.id, "heart", kiriya)).status, 401, "Only the admin reacts to her doodles");
    for (const reaction of ["hi", "🥰🥰", ""]) assert.equal((await reactToDoodle(doodle.id, reaction)).status, 400, `rejects ${JSON.stringify(reaction)}`);
    assert.equal((await reactToDoodle("00000000-0000-4000-8000-000000000000", "heart")).status, 404);
    assert.equal((await json(await reactToDoodle(doodle.id, null))).reaction, null);
    assert.equal((await db.select().from(schema.artworks).where(eq(schema.artworks.id, doodle.id)))[0].reactedAt, null);

    await json(await request(`admin/artworks/notes/${quiet.note.id}`, { method: "DELETE", cookie: admin }));
    assert.equal((await request(`admin/artworks/notes/${quiet.note.id}`, { method: "DELETE", cookie: admin })).status, 404);
    assert.deepEqual((await gallery()).notes.map((note) => note.body), ["framing this one"]);
    await json(await request(`me/artworks/${doodle.id}`, { method: "DELETE", cookie: kiriya }));
    assert.equal((await db.select().from(schema.artworkNotes).where(eq(schema.artworkNotes.artworkId, doodle.id))).length, 0, "Deleting a doodle takes its notes with it");
  });
} finally {
  await client.close();
}
