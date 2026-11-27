import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

// The app's notes & letters section (src/world/mail): opening a letter opens its announcement, Josh
// reading her mail leaves it unread for her, and his view of her inbox. Real API, in-memory database.
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
  await test("Opening a letter opens its announcement; Josh reading it leaves it sealed for her", async () => {
    const letter = await json(await request("admin/letters", { method: "POST", cookie: admin, body: { kind: "note", title: "for today", body: "hi", notify: true } }));
    const announcement = letter.announcement.note;
    assert.equal(announcement.link, `/world/letters?open=${letter.id}`);
    assert.equal((await json(await request("me/notes", { cookie: kiriya }))).unread, 1);

    // Josh opens it on his phone: nothing changes for her.
    assert.equal((await json(await request(`me/letters/${letter.id}/open`, { method: "POST", cookie: admin, body: {} }))).preview, true);
    assert.equal((await json(await request("me/letters", { cookie: kiriya }))).letters.find((l) => l.id === letter.id).openedAt, null);
    assert.equal((await json(await request("me/notes", { cookie: kiriya }))).unread, 1);

    // She opens it: the letter and its announcement are both opened.
    await json(await request(`me/letters/${letter.id}/open`, { method: "POST", cookie: kiriya, body: {} }));
    assert.ok((await json(await request("me/letters", { cookie: kiriya }))).letters.find((l) => l.id === letter.id).openedAt);
    const inbox = await json(await request("me/notes", { cookie: kiriya }));
    assert.equal(inbox.unread, 0);
    assert.ok(inbox.notes.find((n) => n.id === announcement.id).openedAt);

    assert.equal((await request("me/letters/not-a-letter/open", { method: "POST", cookie: kiriya, body: {} })).status, 404);
  });

  await test("Josh's view of her inbox: her notes with her marks, what's on its way, and his test notes", async () => {
    const now = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "hello", body: "♡", when: { mode: "now" } } }));
    const later = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "kiriya", title: "later", body: "tonight", when: { mode: "at", at: new Date(Date.now() + 3_600_000).toISOString() } } }));
    const test = await json(await request("admin/love-notes", { method: "POST", cookie: admin, body: { recipient: "admin", title: "a try", body: "only mine", when: { mode: "now" } } }));
    await json(await request(`me/notes/${now.note.id}/reaction`, { method: "PUT", cookie: kiriya, body: { reaction: "heart" } }));

    assert.equal((await request("admin/love-notes/inbox", { cookie: kiriya })).status, 401);
    const view = await json(await request("admin/love-notes/inbox", { cookie: admin }));
    const hers = view.notes.find((n) => n.id === now.note.id);
    assert.equal(hers.reaction, "heart");
    assert.equal(hers.openedAt, null);
    assert.ok(!view.notes.some((n) => n.id === later.note.id), "A note on its way isn't in her inbox yet");
    assert.equal(view.upcoming.find((n) => n.id === later.note.id).title, "later");
    assert.ok(!view.notes.some((n) => n.id === test.note.id), "His test notes aren't hers");
    assert.equal(view.test.find((n) => n.id === test.note.id).title, "a try");
    assert.equal(typeof view.unread, "number");
  });

  await test("The jar's API: the next note comes ready, pulls keep it, reactions are hers, Josh sees them", async () => {
    const empty = await json(await request("me/note-jar", { cookie: kiriya }));
    assert.equal(empty.next, null, "an empty jar has nothing ready");
    for (const text of ["one", "two", "three"]) {
      const added = await json(await request("admin/note-jar", { method: "POST", cookie: admin, body: { text } }), 201);
      await json(await request(`admin/note-jar/${added.id}`, { method: "PATCH", cookie: admin, body: { releaseNow: true } }));
    }
    let jar = await json(await request("me/note-jar", { cookie: kiriya }));
    assert.equal(jar.total, 3);
    assert.equal(jar.next.note.text, "one", "new notes first, oldest first");
    // As often as she likes: each pull keeps the note she was shown and brings the next one.
    let pull;
    for (let i = 0; i < 7; i++) {
      const shown = jar.next.note;
      pull = await json(await request("me/note-jar/pull", { method: "POST", cookie: kiriya, body: { requestId: crypto.randomUUID(), prefer: shown.id } }));
      assert.equal(pull.note.id, shown.id);
      assert.ok(pull.jar.next.note.id);
      jar = pull.jar;
    }
    assert.equal(pull.jar.fresh, 0);
    assert.equal(pull.jar.pulled, 7);
    assert.equal((await request("me/note-jar/pull", { method: "POST", cookie: kiriya, body: { requestId: "nope" } })).status, 400);

    // Her reaction, and Josh can't give one for her.
    const reacted = await json(await request(`me/note-jar/${pull.id}/reaction`, { method: "PUT", cookie: kiriya, body: { reaction: "🥰" } }));
    assert.equal(reacted.reaction, "🥰");
    assert.equal((await request(`me/note-jar/${pull.id}/reaction`, { method: "PUT", cookie: kiriya, body: { reaction: "not one" } })).status, 400);
    assert.equal((await request(`me/note-jar/${pull.id}/reaction`, { method: "PUT", cookie: admin, body: { reaction: "heart" } })).status, 403);
    assert.equal((await request(`me/note-jar/${crypto.randomUUID()}/reaction`, { method: "PUT", cookie: kiriya, body: { reaction: "heart" } })).status, 404);

    // Josh: his jar notes say how they went with her, and his own pulls are previews with her marks.
    const desk = await json(await request("admin/note-jar", { cookie: admin }));
    assert.equal(desk.notes.find((n) => n.id === pull.note.id).her.reaction, "🥰");
    const his = await json(await request("me/note-jar", { cookie: admin }));
    assert.equal(his.her.reacted, 1, "his island counts the notes she reacted to");
    assert.equal((await json(await request("me/note-jar", { cookie: kiriya }))).her, undefined, "hers doesn't carry that");
    const peek = await json(await request("me/note-jar/pull", { method: "POST", cookie: admin, body: { requestId: crypto.randomUUID(), prefer: his.next.note.id } }));
    assert.equal(peek.preview, true);
    assert.equal(peek.note.id, his.next.note.id);
    assert.equal(typeof peek.her.pulls, "number");
    assert.notEqual(peek.jar.next.note.id, peek.note.id, "his next preview is a different note");
    assert.equal((await json(await request("me/note-jar", { cookie: kiriya }))).pulled, 7, "his previews change nothing for her");
    // Saving one of her pulls to our memories works from its pull id.
    const memory = await json(await request("me/memories", { method: "POST", cookie: kiriya, body: { kind: "jar", sourceId: pull.id } }), 201);
    assert.equal(memory.snapshot.text, pull.note.text);
  });
} finally {
  await client.close();
}
