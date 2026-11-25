// The bundled iPhone app's bridge to the API (docs/refactor/PLAN.md phase 4b): bearer sessions,
// CORS for capacitor://localhost, signed private-media links, and the widget/notification routes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "ABLY_API_KEY", "GIPHY_API_KEY", "APP_ORIGINS"])
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
const links = await import("../server/lib/mediaLinks.js");
app.onError((error) => { throw error; });

const APP = "capacitor://localhost";
function request(route, { method = "GET", token, cookie, body, headers = {}, origin = APP } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(method !== "GET" && method !== "OPTIONS" ? { "x-kw": "1" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
const json = async (response, status = 200) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
async function appToken(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] }, headers: { "x-kw-token": "1" } });
  const data = await json(response);
  assert.match(data.token, /^v1\./);
  return data.token;
}

const her = await appToken("kiriya");
const josh = await appToken("admin");

await test("The app's sign-in hands back a token only when it asks for one", async () => {
  const plain = await json(await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya }, origin: null }));
  assert.equal(plain.token, undefined);
  assert.equal((await json(await request("me/chat/summary", { token: her }))).unread, 0);
  assert.equal((await request("me/chat/summary", { token: "v1.forged.token" })).status, 401);
});

await test("Preflights from the app are answered; other origins get no CORS headers", async () => {
  const pre = await request("me/chat/messages", { method: "OPTIONS", headers: { "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type,x-kw" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), APP);
  assert.match(pre.headers.get("access-control-allow-headers"), /authorization/i);
  assert.equal(pre.headers.get("access-control-allow-credentials"), null);
  const evil = await request("me/chat/summary", { token: her, origin: "https://evil.example" });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
});

await test("Private media links go out signed to the app and come back plain", async () => {
  const path = `backgrounds/${Date.now()}-abcd1234.jpg`;
  const relative = `/api/uploads/media?path=${encodeURIComponent(path)}`;
  const saved = await json(await request("me/chat/prefs", { method: "PUT", token: her, body: { background: "photo", backgroundUrl: `https://kiriya.love${relative}&s=${links.mediaSignature(`media:${path}`)}` } }));
  assert.equal(saved.backgroundUrl, `https://kiriya.love${relative}&s=${links.mediaSignature(`media:${path}`)}`);
  const [row] = await db.select().from(schema.chatPrefs);
  assert.equal(row.prefs.backgroundUrl, relative, "the database keeps the website's plain link");
  assert.match(saved.wallpapers.miku, /^https:\/\/kiriya\.love\/api\/uploads\/wallpapers\/miku\?v=1&s=[\w-]{22}$/);
  const resolved = await json(await request(`uploads/resolve?path=${encodeURIComponent(path)}`, { token: her }));
  assert.equal(resolved.url, saved.backgroundUrl);
});

await test("Signed links open without a session; unsigned or tampered ones don't", async () => {
  const prefs = await json(await request("me/chat/prefs", { token: her }));
  const signed = new URL(prefs.wallpapers.maomao);
  const ok = await request(`uploads/wallpapers/maomao?${signed.searchParams}`, { origin: null });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.equal((await request("uploads/wallpapers/maomao?v=1", { origin: null })).status, 401);
  assert.equal((await request(`uploads/wallpapers/miku?v=1&s=${signed.searchParams.get("s")}`, { origin: null })).status, 401);
  // The website's cookie still works for the same file.
  const unlock = await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya }, origin: null });
  const cookie = unlock.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("uploads/wallpapers/miku?v=1", { cookie, origin: null })).status, 200);
  // A forged media signature doesn't open someone else's path.
  assert.equal((await request(`uploads/media?path=chat%2F1-aaaaaaaa.jpg&s=${links.mediaSignature("media:chat/2-bbbbbbbb.jpg")}`, { origin: null })).status, 401);
});

await test("The website's own responses keep plain links", async () => {
  const unlock = await request("session/unlock", { method: "POST", body: { passphrase: phrases.kiriya }, origin: null });
  const cookie = unlock.headers.get("set-cookie").split(";")[0];
  const prefs = await json(await request("me/chat/prefs", { cookie, origin: null }));
  assert.equal(prefs.wallpapers.miku, "/api/uploads/wallpapers/miku?v=1");
  assert.match(prefs.backgroundUrl, /^\/api\/uploads\/media\?path=backgrounds%2F/);
});

await test("Setting up the app hands it a widget key; widgets, ♡ back and Reply work with it", async () => {
  const device = await json(await request("app/devices", { method: "POST", token: her, body: { label: "her iPhone" } }), 201);
  assert.match(device.widgetKey, /^kw_/);
  const key = device.widgetKey;
  const hello = await json(await request("me/chat/messages", { method: "POST", token: josh, body: { clientId: randomUUID(), kind: "text", body: "hi baby" } }), 201);
  const snap = await json(await request("widget/app", { token: key }));
  assert.equal(snap.role, "kiriya");
  assert.equal(snap.other, "Josh");
  assert.equal(snap.unread.chat, 1);
  assert.equal(snap.unread.total, snap.unread.chat + snap.unread.notes + snap.unread.jar);
  assert.deepEqual(snap.chat.last, { from: "Josh", mine: false, preview: "hi baby", at: snap.chat.last.at });
  assert.equal(snap.links.chat, "kiriyalove://open/world/chat");
  assert.equal(snap.taps.length, 7);

  const clientId = "n-1234abcd-heart";
  const first = await json(await request("widget/tap", { method: "POST", token: key, body: { kind: "thinking", clientId } }));
  const again = await json(await request("widget/tap", { method: "POST", token: key, body: { kind: "thinking", clientId } }));
  assert.equal(first.id, again.id, "a retried button press doesn't send twice");
  assert.equal((await request("widget/tap", { method: "POST", token: key, body: { kind: "slap" } })).status, 400);
  const reply = await json(await request("widget/reply", { method: "POST", token: key, body: { text: "  hiii ♡ ", replyTo: hello.id } }));
  const page = await json(await request("me/chat/messages", { token: josh }));
  const sent = page.messages.find((m) => m.id === reply.id);
  assert.equal(sent.sender, "kiriya");
  assert.equal(sent.body, "hiii ♡");
  assert.equal(sent.replyTo?.id ?? sent.replyTo, hello.id);
  assert.equal((await json(await request("widget/app", { token: key }))).unread.chat, 0, "replying reads the chat");

  // A session token is not a widget key, and a forgotten phone's key stops working.
  assert.equal((await request("widget/app", { token: her })).status, 401);
  assert.equal((await request(`app/devices/${device.id}`, { method: "DELETE", token: her })).status, 200);
  assert.equal((await request("widget/app", { token: key })).status, 401);
});

await test("A lost widget key can be renewed for a live install only", async () => {
  const device = await json(await request("app/devices", { method: "POST", token: josh, body: {} }), 201);
  const renewed = await json(await request(`app/devices/${device.id}/widget-key`, { method: "POST", token: josh, body: {} }));
  assert.match(renewed.widgetKey, /^kw_/);
  assert.equal((await request("widget/app", { token: device.widgetKey })).status, 401, "the old key stops");
  assert.equal((await json(await request("widget/app", { token: renewed.widgetKey }))).role, "admin");
  assert.equal((await request(`app/devices/${device.id}/widget-key`, { method: "POST", token: her, body: {} })).status, 404, "not someone else's phone");
});

await test("App notifications carry their sound, badge, category and the message they're about", async () => {
  process.env.APNS_KEY = "";
  const { apnsNotification } = await import("../server/push/apns.js");
  const chatNote = apnsNotification({ title: "Josh", body: "hi", kind: "chat", navigate: "/world/chat", messageId: "abc" }, { badge: 3 });
  assert.equal(chatNote.aps.sound, "chat.caf");
  assert.equal(chatNote.aps.badge, 3);
  assert.equal(chatNote.aps.category, "CHAT");
  assert.equal(chatNote.payload.messageId, "abc");
  const letter = apnsNotification({ title: "a letter", body: "…", kind: "letter" });
  assert.equal(letter.aps.sound, "letter.caf");
  assert.equal(letter.aps["mutable-content"], 1);
  assert.equal(letter.aps.badge, undefined);
  const jar = apnsNotification({ title: "new notes", body: "…", kind: "jar" });
  assert.equal(jar.aps["mutable-content"], 1);
  assert.equal(apnsNotification({ title: "x", body: "y", kind: "reminder" }).aps.category, "REMINDER");
  const { unreadTotals } = await import("../server/lib/appBadge.js");
  const totals = await unreadTotals(db, "admin");
  assert.equal(totals.notes, 0);
  assert.equal(totals.total, totals.chat);
});

await test("Test mode: Josh's phone buttons are checked but nothing reaches Kiriya", async () => {
  const device = await json(await request("app/devices", { method: "POST", token: josh, body: { label: "his iPhone" } }), 201);
  const key = device.widgetKey;
  const herUnread = async () => (await json(await request("me/chat/summary", { token: her }))).unread;
  const before = await herUnread();

  // Only the admin can see or switch it, and it starts off.
  assert.equal((await request("admin/app-test", { token: her })).status, 401);
  const start = await json(await request("admin/app-test", { token: josh }));
  assert.equal(start.mode.on, false);
  assert.deepEqual(start.kinds, ["chat", "tap", "letter", "note", "jar", "reminder"]);
  assert.equal(start.phones, 0, "no push token yet");

  const on = await json(await request("admin/app-test/mode", { method: "POST", token: josh, body: { on: true } }));
  assert.equal(on.mode.on, true);
  assert.ok(new Date(on.mode.until) - Date.now() > 11 * 3600_000);

  // ♡ back, a widget or Siri, Reply, and the icon's quick action: all answered, none saved or sent to her.
  const heart = await json(await request("widget/tap", { method: "POST", token: key, body: { kind: "thinking", clientId: "n-test1234-heart" } }));
  assert.deepEqual([heart.ok, heart.id, heart.test], [true, null, true]);
  const hug = await json(await request("widget/tap", { method: "POST", token: key, body: { kind: "hug", clientId: "w-test1234-hug" } }));
  assert.equal(hug.test, true);
  const reply = await json(await request("widget/reply", { method: "POST", token: key, body: { text: "surprise!", clientId: "n-test1234-reply" } }));
  assert.equal(reply.test, true);
  const quick = await json(await request("me/chat/messages", { method: "POST", token: josh, body: { clientId: "q-test1234-heart", kind: "tap", body: "thinking" } }), 201);
  assert.equal(quick.test, true);
  // Still validated like a real send.
  assert.equal((await request("widget/tap", { method: "POST", token: key, body: { kind: "slap", clientId: "n-test1234-slap" } })).status, 400);

  assert.equal(await herUnread(), before, "nothing new in her chat");
  const page = await json(await request("me/chat/messages", { token: her }));
  assert.ok(!page.messages.some((m) => ["surprise!"].includes(m.body) || String(m.clientId ?? "").includes("test1234")));
  const log = (await json(await request("admin/app-test", { token: josh }))).log;
  assert.equal(log.length, 4);
  assert.match(log[0].what, /♡ thinking of you/);
  assert.equal(log[0].channel, "the icon’s quick action");
  assert.equal(log[1].what, "“surprise!”");

  // The chat screen itself, and Kiriya's own buttons, are never held back.
  const typed = await json(await request("me/chat/messages", { method: "POST", token: josh, body: { clientId: randomUUID(), kind: "text", body: "typed in the chat" } }), 201);
  assert.ok(typed.id);
  assert.equal(await herUnread(), before + 1);
  const herDevice = await json(await request("app/devices", { method: "POST", token: her, body: { label: "her iPhone" } }), 201);
  assert.ok((await json(await request("widget/tap", { method: "POST", token: herDevice.widgetKey, body: { kind: "thinking", clientId: "n-hers1234-heart" } }))).id);

  // Off again: his buttons send for real.
  assert.equal((await json(await request("admin/app-test/mode", { method: "POST", token: josh, body: { on: false } }))).mode.on, false);
  const real = await json(await request("widget/tap", { method: "POST", token: key, body: { kind: "thinking", clientId: "n-real1234-heart" } }));
  assert.ok(real.id);
  assert.equal(real.test, undefined);

  // Trying a notification needs push configured; with it, test mode switches itself on.
  assert.equal((await request("admin/app-test/try", { method: "POST", token: josh, body: { kind: "chat" } })).status, 503);
  assert.equal((await request("admin/app-test/try", { method: "POST", token: josh, body: { kind: "nope" } })).status, 400);
  const { tryNotification } = await import("../server/lib/appTestMode.js");
  const sent = [];
  const tried = await tryNotification(db, "jar", { kiriya: "Kiriya", admin: "Josh" }, { send: async (_db, message, options) => (sent.push({ message, options }), { sent: 1, targets: 1 }) });
  assert.equal(tried.mode.on, true);
  assert.equal(sent[0].options.role, "admin");
  assert.equal(sent[0].message.kind, "jar");
  await json(await request("admin/app-test/mode", { method: "POST", token: josh, body: { on: false } }));
});

await test("The app only takes newer over-the-air versions", async () => {
  const { isNewerVersion } = await import("../shared/appVersion.js");
  assert.equal(isNewerVersion("1.20261126.080000", "1.20261125.231608"), true);
  assert.equal(isNewerVersion("1.20261125.230433", "1.20261125.231608"), false, "an older live copy never replaces a newer build");
  assert.equal(isNewerVersion("1.20261125.231608", "1.20261125.231608"), false);
  assert.equal(isNewerVersion("1.20261125.231608", "dev"), true);
  assert.equal(isNewerVersion("garbage", "1.20261125.231608"), false);
});
