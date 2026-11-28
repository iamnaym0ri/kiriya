// The chat's look, round 4 (src/world/chat/theme): the theme and background are theirs together;
// bubbles, the typing indicator and the lock are each person's own, and each phone learns the other's
// bubbles and typing style so it can draw them their way. Through the real API, PGlite, no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "ABLY_API_KEY", "GIPHY_API_KEY"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
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
const handlers = await import("../api/index.js");

function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](
    new Request(rewritten, {
      method,
      headers: { "x-kw": "1", ...headers, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const json = async (response, status = 200) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
const unlock = async (role) => (await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } })).headers.get("set-cookie").split(";")[0];
const prefsOf = (cookie, headers) => request("me/chat/prefs", { cookie, headers }).then((r) => json(r));
const save = (cookie, body, status = 200) => request("me/chat/prefs", { method: "PUT", cookie, body }).then((r) => json(r, status));

try {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");

  await test("The look Josh had before becomes theirs together; each keeps their own bubbles and typing", async () => {
    // Round 3 kept everything per person.
    await db.insert(schema.chatPrefs).values([
      { role: "admin", prefs: { theme: "dark", background: "night", bubble: "gothic", typing: "dots" } },
      { role: "kiriya", prefs: { theme: "love", background: "hearts", bubble: "kawaii" } },
    ]);
    const hers = await prefsOf(her);
    assert.deepEqual([hers.theme, hers.background], ["dark", "night"], "his theme and background are theirs now");
    assert.deepEqual([hers.bubble, hers.typing], ["kawaii", "hearts"], "her own bubbles stay hers");
    assert.deepEqual(hers.theirs, { bubble: "gothic", typing: "dots" }, "and her phone learns his");
    const his = await prefsOf(josh);
    assert.deepEqual([his.theme, his.background, his.bubble, his.typing], ["dark", "night", "gothic", "dots"]);
    assert.deepEqual(his.theirs, { bubble: "kawaii", typing: "hearts" });
    assert.equal(his.lock.on, false, "the lock is each person's own");
  });

  await test("Either of them changes the theme or background for both; bubbles and typing only for themselves", async () => {
    await save(her, { theme: "cream", background: "clouds" });
    let his = await prefsOf(josh);
    assert.deepEqual([his.theme, his.background], ["cream", "clouds"], "he sees her change at once");
    await save(josh, { theme: "miku" });
    assert.equal((await prefsOf(her)).theme, "miku", "and she sees his");
    await save(her, { bubble: "ribbon", typing: "bunny" });
    his = await prefsOf(josh);
    assert.deepEqual([his.bubble, his.typing], ["gothic", "dots"], "his own choices didn't move");
    assert.deepEqual(his.theirs, { bubble: "ribbon", typing: "bunny" }, "he draws her messages in her bubbles and her typing her way");
  });

  await test("The chat lock stays each person's own, and never reaches the other phone", async () => {
    await save(her, { lock: { on: true, after: 0, previews: false } });
    assert.equal((await prefsOf(her)).lock.on, true);
    const his = await prefsOf(josh);
    assert.equal(his.lock.on, false);
    assert.equal(his.theirs.lock, undefined);
  });

  await test("Every new bubble design and typing style is accepted; anything unknown isn't", async () => {
    for (const bubble of ["cloud", "stamp", "ribbon", "melody", "jelly"]) assert.equal((await save(josh, { bubble })).bubble, bubble);
    for (const typing of ["bunny", "paws", "notes", "stars", "boba"]) assert.equal((await save(josh, { typing })).typing, typing);
    await save(josh, { bubble: "scythe" }, 400);
    await save(josh, { typing: "fireworks" }, 400);
  });

  await test("Josh peeking at her side sees her look, with his own bubbles as hers sees them", async () => {
    const peek = await prefsOf(josh, { "x-view-as": "kiriya" });
    assert.deepEqual([peek.bubble, peek.typing, peek.lock.on], ["ribbon", "bunny", true]);
    assert.equal(peek.theirs.bubble, "jelly");
    assert.equal((await request("me/chat/prefs", { method: "PUT", cookie: josh, headers: { "x-view-as": "kiriya" }, body: { theme: "dark" } })).status, 403);
  });
} finally {
  await client.close();
}
