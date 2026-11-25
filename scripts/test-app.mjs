// The kiriya.love iPhone app (docs/refactor/PLAN.md, phase 3): Face ID sign-in and native push.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "APNS_KEY_ID"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
globalThis.fetch = () => { throw new Error("External network is disabled in these tests"); };

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
const { apnsNotification, sendNative } = await import("../server/push/apns.js");
const { sendToSubscribers, pushConfigured } = await import("../server/push/webpush.js");
app.onError((error) => { throw error; });

function request(route, { method = "GET", cookie, body } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: { "x-kw": "1", ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
const json = async (response, status = 200) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
const cookieOf = (response) => response.headers.get("set-cookie").split(";")[0];
async function unlock(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } });
  assert.equal(response.status, 200);
  return cookieOf(response);
}
const TOKEN = "ab".repeat(32);

try {
  let her, device;
  await test("Setting up the app needs the passphrase first; the secret is shown once and only its hash is kept", async () => {
    assert.equal((await request("app/devices", { method: "POST", body: {} })).status, 401);
    her = await unlock("kiriya");
    device = await json(await request("app/devices", { method: "POST", cookie: her, body: { label: "Kiriya’s iPhone" } }), 201);
    assert.equal(device.role, "kiriya");
    assert(device.secret.length >= 40);
    const [row] = await db.select().from(schema.appDevices).where(eq(schema.appDevices.id, device.id));
    assert.notEqual(row.secretHash, device.secret);
    assert(!JSON.stringify(row).includes(device.secret));
  });

  await test("Face ID's Keychain secret signs the app back in as her, without the passphrase", async () => {
    const response = await request("session/app", { method: "POST", body: { id: device.id, secret: device.secret } });
    assert.equal((await json(response)).role, "kiriya");
    assert.match(response.headers.get("set-cookie"), /Max-Age=172800/);
    assert.equal((await json(await request("session", { cookie: cookieOf(response) }))).role, "kiriya");
  });

  await test("A wrong secret or unknown phone is refused and counts against the unlock budget", async () => {
    assert.equal((await request("session/app", { method: "POST", body: { id: device.id, secret: "x".repeat(43) } })).status, 401);
    assert.equal((await request("session/app", { method: "POST", body: { id: crypto.randomUUID(), secret: device.secret } })).status, 401);
    assert.equal((await request("session/app", { method: "POST", body: { id: "not-a-uuid", secret: device.secret } })).status, 401);
    const failures = (await db.select().from(schema.unlockAttempts)).filter((a) => !a.ok).length;
    assert(failures >= 3);
  });

  await test("Push tokens: validated, tied to her role, and moved when a phone changes hands", async () => {
    assert.equal((await request(`app/devices/${device.id}/push`, { method: "PUT", cookie: her, body: { token: "not-hex" } })).status, 400);
    await json(await request(`app/devices/${device.id}/push`, { method: "PUT", cookie: her, body: { token: TOKEN.toUpperCase() } }));
    const admin = await unlock("admin");
    assert.equal((await request(`app/devices/${device.id}/push`, { method: "PUT", cookie: admin, body: { token: TOKEN } })).status, 404, "another role can't claim her device");
    const mine = await json(await request("app/devices", { method: "POST", cookie: admin, body: {} }), 201);
    await json(await request(`app/devices/${mine.id}/push`, { method: "PUT", cookie: admin, body: { token: TOKEN } }));
    const rows = await db.select().from(schema.appDevices);
    assert.equal(rows.find((r) => r.id === mine.id).apnsToken, TOKEN);
    assert.equal(rows.find((r) => r.id === device.id).apnsToken, null, "one phone, one token");
    const listed = await json(await request("admin/love-notes", { cookie: admin }));
    assert.equal(listed.apps.length, 2);
    assert(listed.apps.some((a) => a.role === "admin" && a.push));
  });

  await test("Changing her passphrase retires the app's Face ID key", async () => {
    const fresh = await json(await request("app/devices", { method: "POST", cookie: her, body: {} }), 201);
    await db.update(schema.appDevices).set({ keyVersion: "an-older-passphrase" }).where(eq(schema.appDevices.id, fresh.id));
    assert.equal((await request("session/app", { method: "POST", body: { id: fresh.id, secret: fresh.secret } })).status, 401);
    const [row] = await db.select().from(schema.appDevices).where(eq(schema.appDevices.id, fresh.id));
    assert(row.revokedAt);
  });

  await test("Locking the app (or admin forgetting the phone) revokes it", async () => {
    await json(await request(`app/devices/${device.id}`, { method: "DELETE", cookie: her }));
    assert.equal((await request("session/app", { method: "POST", body: { id: device.id, secret: device.secret } })).status, 401);
    const admin = await unlock("admin");
    const another = await json(await request("app/devices", { method: "POST", cookie: her, body: {} }), 201);
    await json(await request(`admin/love-notes/apps/${another.id}`, { method: "DELETE", cookie: admin }));
    assert.equal((await request("session/app", { method: "POST", body: { id: another.id, secret: another.secret } })).status, 401);
  });

  await test("Notifications reach the app as APNs alerts carrying where to go; nothing is sent unconfigured", async () => {
    const note = apnsNotification({ title: "a new little note in your jar ♡", body: "Pull it whenever you like.", navigate: "/world#note-jar" }, { now: Date.parse("2026-11-25T00:00:00Z") });
    const payload = JSON.parse(note.compile());
    assert.equal(payload.aps.alert.title, "a new little note in your jar ♡");
    assert.equal(payload.navigate, "/world#note-jar");
    assert.equal(note.topic, "love.kiriya.app");
    assert.equal(pushConfigured(), false);
    assert.deepEqual(await sendNative(db, { title: "t", body: "b" }, { role: "kiriya" }), { sent: 0, failed: 0, targets: 0, skipped: "apns_not_configured" });
    assert.deepEqual(await sendToSubscribers(db, { title: "t", body: "b" }, { role: "kiriya" }), { sent: 0, failed: 0, targets: 0 });
  });
  await test("The iPhone project bundles the site, asks for Face ID properly and can receive pushes", async () => {
    const { readFile } = await import("node:fs/promises");
    const file = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const config = JSON.parse(await file("capacitor.config.json"));
    assert.equal(config.appId, "love.kiriya.app");
    assert.equal(config.appName, "kiriya.love");
    // Phase 4b: the site is built into the app (dist-app) and updated over the air, never the live URL.
    assert.equal(config.webDir, "dist-app");
    assert.equal(config.server?.url, undefined);
    assert.equal(config.plugins.CapacitorUpdater.statsUrl, "", "the updater must not report to Capgo's cloud");
    assert.equal(config.plugins.CapacitorUpdater.autoUpdate, false);
    assert.equal(config.plugins.Badge.persist, false, "the badge comes from the server's pushes");
    const info = await file("ios/App/App/Info.plist");
    assert.match(info, /<key>CFBundleDisplayName<\/key>\s*<string>kiriya\.love<\/string>/);
    assert.match(info, /<key>NSFaceIDUsageDescription<\/key>\s*<string>[^<]{10,}<\/string>/, "Face ID crashes the app without a usage description");
    assert.match(await file("ios/App/App/App.entitlements"), /<key>aps-environment<\/key>/);
    const delegate = await file("ios/App/App/AppDelegate.swift");
    assert.match(delegate, /capacitorDidRegisterForRemoteNotifications/);
    assert.match(delegate, /capacitorDidFailToRegisterForRemoteNotifications/);
    const project = await file("ios/App/App.xcodeproj/project.pbxproj");
    assert.equal(project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)?.length, 2);
    // The app plus its two extensions (widgets, notification pictures), Debug and Release each.
    assert.equal(project.match(/DEVELOPMENT_TEAM = 9W8CN9V8NR;/g)?.length, 6);
    for (const id of ["love.kiriya.app.widgets", "love.kiriya.app.notifications"])
      assert.equal(project.match(new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${id.replaceAll(".", "\\.")};`, "g"))?.length, 2, id);
    assert.match(project, /KiriyaWidgets\.appex in Embed Foundation Extensions/);
    assert.match(project, /KiriyaNotificationService\.appex in Embed Foundation Extensions/);
    const { default: sharp } = await import("sharp");
    const icon = await sharp(new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", import.meta.url).pathname).metadata();
    assert.deepEqual([icon.width, icon.height, icon.hasAlpha], [1024, 1024, false], "Apple rejects icons with transparency");
    const sw = await file("src/sw.js");
    assert.match(sw, /denylist: \[[^\]]*\\\/install/, "the install page must not be swallowed by the app shell");
  });
} finally {
  await client.close();
}
