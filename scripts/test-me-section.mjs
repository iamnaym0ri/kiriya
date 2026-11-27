import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

// The app's last tab (docs/refactor/RENOVATION.md, the me agent): her glance card, Josh's hub, her
// companion pick, and changing a passphrase from inside the app without signing that phone out.
for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "APNS_KEY_ID"])
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
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
const { forgetCredential } = await import("../server/auth/credentials.js");
app.onError((error) => {
  throw error;
});

function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](
    new Request(rewritten, {
      method,
      headers: {
        "x-kw": "1",
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
async function unlock(passphrase) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase } });
  if (response.status !== 200) return null;
  return response.headers.get("set-cookie").split(";")[0];
}
const cookieFrom = (response, fallback) => response.headers.get("set-cookie")?.split(";")[0] ?? fallback;
const roleOf = async (headers) => (await json(await request("session", headers))).role;

let kiriya = await unlock(phrases.kiriya);
const admin = await unlock(phrases.admin);

await test("Her companion pick is saved, survives a fresh read, and can be nobody", async () => {
  assert.equal((await json(await request("me/prefs", { cookie: kiriya }))).companion, "maomao", "Maomao until she picks");
  const saved = await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { companion: "miku" } }));
  assert.equal(saved.companion, "miku");
  assert.equal((await json(await request("me/prefs", { cookie: kiriya }))).companion, "miku", "A fresh read keeps it");
  assert.equal((await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { companion: "none" } }))).companion, "none");
  assert.equal((await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { companion: "rin" } })).status, 400);
  assert.equal((await json(await request("me/prefs", { cookie: admin }))).companion, "maomao", "Josh's test copy is his own");
  // Another setting saved later doesn't drop the pick.
  await json(await request("me/prefs", { method: "PATCH", cookie: kiriya, body: { motion: "quiet" } }));
  assert.equal((await json(await request("me/prefs", { cookie: kiriya }))).companion, "none");
});

await test("Her glance counts what she has, and only Josh sets the day they count from", async () => {
  await db.insert(schema.letters).values([
    { kind: "note", author: "giver", title: "one", body: "hi" },
    { kind: "open_when", author: "giver", title: "later", body: "not yet", unlockAt: new Date(Date.now() + 86_400_000) },
  ]);
  await db.insert(schema.loveNotes).values([
    { recipient: "kiriya", title: "a", body: "b", sendAt: new Date(), status: "sent", sentAt: new Date() },
    { recipient: "kiriya", title: "c", body: "d", sendAt: new Date(Date.now() + 3_600_000), status: "scheduled" },
    { recipient: "admin", title: "e", body: "f", sendAt: new Date(), status: "sent", sentAt: new Date() },
  ]);
  await db.insert(schema.artworks).values([{ url: "/api/uploads/media?path=art/a.png" }, { url: "/api/uploads/media?path=art/b.png" }]);
  await db.insert(schema.kv).values({ key: "stickers", value: [{ id: "st-kitten", day: "2026-11-01" }, { id: "st-kitten", day: "2026-11-02" }, { id: "st-bow", day: "2026-11-03" }] });

  const glance = await json(await request("me/glance", { cookie: kiriya }));
  assert.deepEqual(
    { letters: glance.counts.letters, notes: glance.counts.notes, doodles: glance.counts.doodles, stickers: glance.counts.stickers },
    { letters: 1, notes: 1, doodles: 2, stickers: 2 },
    "Locked letters, scheduled notes and his own notes don't count; stickers count once each",
  );
  assert.equal(glance.together, null);
  assert.deepEqual(await json(await request("me/glance", { cookie: admin })), glance, "Josh sees exactly her card");
  assert.equal((await request("me/glance")).status, 401);

  assert.equal((await request("admin/hub/together", { method: "PUT", cookie: kiriya, body: { since: "2024-02-14" } })).status, 401);
  assert.equal((await request("admin/hub/together", { method: "PUT", cookie: admin, body: { since: "2024-02-30" } })).status, 400);
  assert.equal((await request("admin/hub/together", { method: "PUT", cookie: admin, body: { since: "2999-01-01" } })).status, 400);
  const set = await json(await request("admin/hub/together", { method: "PUT", cookie: admin, body: { since: glance.today } }));
  assert.deepEqual(set.together, { since: glance.today, days: 1 }, "The first day counts as day one");
  assert.equal((await json(await request("me/glance", { cookie: kiriya }))).together.days, 1);
  const cleared = await json(await request("admin/hub/together", { method: "PUT", cookie: admin, body: { since: null } }));
  assert.equal(cleared.together, null);
});

await test("Josh's hub shows her widgets' snapshot; she can't open it", async () => {
  assert.equal((await request("admin/hub/widgets", { cookie: kiriya })).status, 401);
  const snapshot = await json(await request("admin/hub/widgets", { cookie: admin }));
  assert.equal(snapshot.role, "kiriya");
  assert.equal(snapshot.latestNote.title, "a", "Her newest note, as her widget shows it");
  assert.equal(snapshot.taps.length, 7);
});

await test("A test signal can be any of the seven taps", async () => {
  assert.equal((await request("admin/app-test/try", { method: "POST", cookie: admin, body: { kind: "tap", tap: "nope" } })).status, 400);
  // Push isn't configured in tests: the route answers 503 after validating the tap.
  assert.equal((await request("admin/app-test/try", { method: "POST", cookie: admin, body: { kind: "tap", tap: "hug" } })).status, 503);
  const { tryNotification } = await import("../server/lib/appTestMode.js");
  const sent = [];
  await tryNotification(db, "tap", { kiriya: "Kiriya", admin: "Josh" }, { tap: "water", send: async (_db, message, options) => (sent.push({ message, options }), { app: { sent: 0, targets: 0 } }) });
  assert.equal(sent[0].message.tap, "water");
  assert.match(sent[0].message.title, /drink some water/);
  assert.equal(sent[0].options.role, "admin", "Only Josh's phones");
});

await test("Changing the passphrase in the app keeps that phone: a fresh token, its Face ID and a new widget key", async () => {
  // Two app installs of hers, set up while the original passphrase was in place.
  const bearerFor = async () => {
    const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya }, headers: { "x-kw-token": "1" } });
    return (await json(response)).token;
  };
  const tokenA = await bearerFor();
  const tokenB = await bearerFor();
  const auth = (token) => ({ headers: { authorization: `Bearer ${token}`, "x-kw-token": "1" } });
  const phoneA = await json(await request("app/devices", { method: "POST", body: { label: "her iPhone" }, ...auth(tokenA) }), 201);
  const phoneB = await json(await request("app/devices", { method: "POST", body: { label: "old iPad" }, ...auth(tokenB) }), 201);

  const changed = await json(
    await request("me/passphrase", {
      method: "PUT",
      body: { current: phrases.kiriya, next: "lilac moon tea", signOutOthers: true, keepDevice: phoneA.id },
      ...auth(tokenA),
    }),
  );
  assert.equal(changed.role, "kiriya");
  assert.ok(changed.token?.startsWith("v1."), "The app gets a fresh token to carry on with");
  assert.ok(changed.widgetKey?.startsWith("kw_"), "and a new widget key for its widgets");
  assert.equal(await roleOf({ headers: { authorization: `Bearer ${changed.token}` } }), "kiriya", "This phone stays signed in");
  assert.equal(await roleOf({ headers: { authorization: `Bearer ${tokenA}` } }), null, "Its old token is retired");
  assert.equal(await roleOf({ headers: { authorization: `Bearer ${tokenB}` } }), null, "The other device is signed out");

  const faceId = (device) => request("session/app", { method: "POST", body: { id: device.id, secret: device.secret } });
  assert.equal((await faceId(phoneA)).status, 200, "Face ID still opens this phone");
  assert.equal((await faceId(phoneB)).status, 401, "but not the other one");
  const widget = (key) => request("widget/app", { headers: { authorization: `Bearer ${key}` } });
  assert.equal((await widget(changed.widgetKey)).status, 200, "The new widget key works");
  assert.equal((await widget(phoneA.widgetKey)).status, 401, "The old one doesn't");

  assert.equal(await unlock(phrases.kiriya), null, "The old passphrase stops working");
  kiriya = await unlock("Lilac  Moon Tea");
  assert.ok(kiriya, "The new one works, whatever the capitals and spaces");

  // Someone else's install can't be kept by naming it.
  const adminToken = (await json(await request("session/unlock", { method: "POST", body: { passphrase: phrases.admin }, headers: { "x-kw-token": "1" } }))).token;
  const adminSignOut = await json(await request("me/passphrase/sign-out-others", { method: "POST", body: { keepDevice: phoneA.id }, ...auth(adminToken) }));
  assert.equal(adminSignOut.widgetKey, null);
  assert.equal((await faceId(phoneA)).status, 200, "Her phone is untouched by his sign-out");
  const stored = (await db.select().from(schema.appDevices).where(eq(schema.appDevices.id, phoneA.id)))[0];
  assert.equal(stored.revokedAt, null);
});

await test("Without signing out elsewhere nothing else changes; a website change still works without a device", async () => {
  const response = await request("me/passphrase", { method: "PUT", cookie: kiriya, body: { current: "lilac moon tea", next: "strawberry milk", signOutOthers: false } });
  const data = await json(response);
  assert.equal(data.token, undefined, "The website gets a cookie, not a token");
  assert.equal(data.widgetKey, null);
  kiriya = cookieFrom(response, kiriya);
  assert.equal(await roleOf({ cookie: kiriya }), "kiriya");
  forgetCredential("kiriya");
});
