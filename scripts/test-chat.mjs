// The private chat and "our memories" (docs/refactor/PLAN.md phase 4), through the real API.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
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
globalThis.fetch = () => { throw new Error("External network is disabled in these tests"); };

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
const chat = await import("../server/lib/chat.js");
app.onError((error) => { throw error; });

function request(route, { method = "GET", cookie, body } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  // Vercel also echoes the rewrite's named parameter as its own query value.
  rewritten.searchParams.set("route", original.pathname.slice(5));
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
async function unlock(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
const send = (cookie, body, status = 201) => request("me/chat/messages", { method: "POST", cookie, body: { clientId: randomUUID(), ...body } }).then((r) => json(r, status));

try {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");
  let hello, photo;

  await test("Only the two of them can open the chat", async () => {
    assert.equal((await request("me/chat/messages")).status, 401);
    const page = await json(await request("me/chat/messages", { cookie: her }));
    assert.deepEqual([page.messages, page.me, page.live, page.unread], [[], "kiriya", false, 0]);
  });

  await test("Messages send once even when a flaky connection retries them", async () => {
    const clientId = randomUUID();
    hello = await json(await request("me/chat/messages", { method: "POST", cookie: josh, body: { clientId, kind: "text", body: "  hi baby ♡  " } }), 201);
    assert.equal(hello.body, "hi baby ♡");
    assert.equal(hello.sender, "admin");
    const again = await json(await request("me/chat/messages", { method: "POST", cookie: josh, body: { clientId, kind: "text", body: "hi baby ♡" } }), 201);
    assert.equal(again.id, hello.id);
    assert.equal((await request("me/chat/messages", { method: "POST", cookie: her, body: { clientId, kind: "text", body: "steal" } })).status, 409);
    assert.equal((await json(await request("me/chat/messages", { cookie: her }))).messages.length, 1);
  });

  await test("Only real content gets through: no empty texts, foreign images, or made-up taps", async () => {
    await send(her, { kind: "text", body: "   " }, 400);
    await send(her, { kind: "image", media: { url: "https://evil.example/x.png" } }, 400);
    await send(her, { kind: "image", media: { url: "/api/uploads/media?path=art%2Fx.png" } }, 400);
    await send(her, { kind: "tap", body: "nope" }, 400);
    await send(her, { kind: "gif", media: { url: "https://evil.example/x.gif" } }, 400);
    photo = await send(her, { kind: "image", body: "look!!", media: { url: "/api/uploads/media?path=chat%2F171-ab12cd34.webp", width: 900, height: 1200 } });
    await send(her, { kind: "gif", media: { url: "https://media2.giphy.com/media/abc/200w.gif", giphyId: "abc" } });
    await send(her, { kind: "sticker", media: { url: "/stickers/fluent/sparkling-heart.webp" } });
    await send(her, { kind: "sticker", media: { url: "/stickers/fluent/not-a-real-one.webp" } }, 400);
    await send(her, { kind: "voice", media: { url: "/api/uploads/media?path=chat%2F172-ab12cd34.m4a", duration: 4.2, peaks: [0.1, 0.8, 0.4] } });
    await send(her, { kind: "tap", body: "hug" });
  });

  await test("Replies quote the original; reactions are one per person and can change", async () => {
    const reply = await send(josh, { kind: "text", body: "so cute", replyTo: photo.id });
    assert.deepEqual(reply.replyTo, { id: photo.id, sender: "kiriya", kind: "image", body: "look!!" });
    await json(await request(`me/chat/messages/${photo.id}/reaction`, { method: "PUT", cookie: josh, body: { emoji: "♥" } }));
    await json(await request(`me/chat/messages/${photo.id}/reaction`, { method: "PUT", cookie: josh, body: { emoji: "😭" } }));
    await json(await request(`me/chat/messages/${photo.id}/reaction`, { method: "PUT", cookie: her, body: { emoji: "✨" } }));
    const page = await json(await request("me/chat/messages", { cookie: her }));
    assert.deepEqual(page.messages.find((m) => m.id === photo.id).reactions, { admin: "😭", kiriya: "✨" });
    await json(await request(`me/chat/messages/${photo.id}/reaction`, { method: "PUT", cookie: josh, body: { emoji: null } }));
    assert.deepEqual((await json(await request("me/chat/messages", { cookie: her }))).messages.find((m) => m.id === photo.id).reactions, { kiriya: "✨" });
  });

  await test("Read markers drive \"seen\" and the unread count; sending counts as reading", async () => {
    const before = await json(await request("me/chat/messages", { cookie: her }));
    assert.equal(before.unread, 1, "Josh's reply came after her last send");
    await json(await request("me/chat/read", { method: "POST", cookie: her, body: {} }));
    const after = await json(await request("me/chat/messages", { cookie: her }));
    assert.equal(after.unread, 0);
    assert(after.reads.kiriya);
    const summary = await json(await request("me/chat/summary", { cookie: josh }));
    assert.equal(summary.last.body, "so cute");
    assert.deepEqual(summary.names, { admin: "Josh", kiriya: "Kiriya" });
  });

  await test("Unsending works only on your own messages and leaves a quiet placeholder", async () => {
    assert.equal((await request(`me/chat/messages/${hello.id}`, { method: "DELETE", cookie: her })).status, 404);
    await json(await request(`me/chat/messages/${hello.id}`, { method: "DELETE", cookie: josh }));
    const gone = (await json(await request("me/chat/messages", { cookie: her }))).messages.find((m) => m.id === hello.id);
    assert.deepEqual([gone.kind, gone.body, gone.media], ["deleted", "", null]);
  });

  await test("History pages backwards and catches up forwards without gaps or repeats", async () => {
    const base = Date.parse("2026-11-20T00:00:00Z");
    for (let i = 0; i < 95; i++)
      await chat.sendMessage(db, i % 2 ? "admin" : "kiriya", { clientId: `old-${i}-message`, kind: "text", body: `old ${i}` }, { now: new Date(base + i * 1000) });
    const seen = [];
    let before = null;
    do {
      const page = await json(await request(`me/chat/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cookie: her }));
      seen.unshift(...page.messages.map((m) => m.id));
      before = page.next;
    } while (before);
    assert.equal(new Set(seen).size, seen.length);
    assert.equal(seen.length, (await db.select().from(schema.chatMessages)).length);
    const newest = (await json(await request("me/chat/messages", { cookie: her }))).messages.at(-1);
    const fresh = await send(josh, { kind: "text", body: "new one" });
    const caught = await json(await request(`me/chat/messages?after=${encodeURIComponent(newest.createdAt)}`, { cookie: her }));
    assert.deepEqual(caught.messages.map((m) => m.id), [fresh.id]);
  });

  await test("Taps are capped at 30 an hour so a stuck widget can't flood her phone", async () => {
    const now = new Date("2026-11-25T10:00:00Z");
    for (let i = 0; i < 30; i++) await chat.sendMessage(db, "admin", { clientId: `tap-${i}-xxxxx`, kind: "tap", body: "thinking" }, { now: new Date(now.getTime() + i) });
    await assert.rejects(chat.sendMessage(db, "admin", { clientId: "tap-31-xxxxx", kind: "tap", body: "thinking" }, { now }), (e) => e.status === 429);
    const push = chat.chatNotification({ kind: "tap", body: "thinking" }, "Josh");
    assert.equal(push.title, "Josh is thinking of you ♡");
    assert.equal(push.kind, "tap");
    assert.equal(chat.chatNotification({ kind: "voice", body: "" }, "Kiriya").body, "🎙️ sent you a voice note");
  });

  await test("Each of them keeps their own look; only known themes and their own uploads are accepted", async () => {
    const { wallpapers, ...prefs } = await json(await request("me/chat/prefs", { cookie: her }));
    assert.deepEqual(prefs, chat.DEFAULT_PREFS);
    assert.deepEqual(wallpapers, { miku: "/api/uploads/wallpapers/miku?v=1", maomao: "/api/uploads/wallpapers/maomao?v=1" });
    const saved = await json(await request("me/chat/prefs", { method: "PUT", cookie: her, body: { bubble: "cat", typing: "maomao", background: "photo", backgroundUrl: "/api/uploads/media?path=backgrounds%2F1-ab.webp" } }));
    assert.deepEqual([saved.bubble, saved.typing, saved.background], ["cat", "maomao", "photo"]);
    assert.equal((await json(await request("me/chat/prefs", { cookie: josh }))).bubble, "lilac", "his look is separate");
    assert.equal((await request("me/chat/prefs", { method: "PUT", cookie: her, body: { bubble: "neon" } })).status, 400);
    assert.equal((await request("me/chat/prefs", { method: "PUT", cookie: her, body: { backgroundUrl: "https://x.example/a.png" } })).status, 400);
  });

  await test("Our memories freeze a copy; notes stay private to whoever they were sent to", async () => {
    const memory = await json(await request("me/memories", { method: "POST", cookie: her, body: { kind: "message", sourceId: photo.id, caption: "our first pic" } }), 201);
    assert.equal(memory.snapshot.body, "look!!");
    const again = await json(await request("me/memories", { method: "POST", cookie: josh, body: { kind: "message", sourceId: photo.id } }), 201);
    assert.equal(again.id, memory.id, "saved once for both of them");
    const [note] = await db.insert(schema.loveNotes).values({ recipient: "admin", title: "test", body: "for his test phone", sendAt: new Date() }).returning();
    assert.equal((await request("me/memories", { method: "POST", cookie: her, body: { kind: "note", sourceId: note.id } })).status, 404);
    assert.equal((await request("me/memories", { method: "POST", cookie: her, body: { kind: "spaceship", sourceId: "x" } })).status, 400);
    const list = await json(await request("me/memories", { cookie: josh }));
    assert.equal(list.items.length, 1);
    await json(await request(`me/memories/${memory.id}`, { method: "DELETE", cookie: her }));
    assert.equal((await json(await request("me/memories", { cookie: josh }))).items.length, 0);
  });

  await test("The official wallpapers are only served after login, and cached on the phone", async () => {
    assert.equal((await request("uploads/wallpapers/miku")).status, 401);
    const miku = await request("uploads/wallpapers/miku", { cookie: her });
    assert.equal(miku.status, 200);
    assert.equal(miku.headers.get("content-type"), "image/webp");
    assert.match(miku.headers.get("cache-control"), /^private, max-age=31536000, immutable$/);
    assert((await miku.arrayBuffer()).byteLength > 10_000);
    assert.equal((await request("uploads/wallpapers/maomao", { cookie: josh })).status, 200);
    assert.equal((await request("uploads/wallpapers/zelda", { cookie: josh })).status, 404);
    const saved = await json(await request("me/chat/prefs", { method: "PUT", cookie: her, body: { background: "maomao" } }));
    assert.equal(saved.background, "maomao");
  });

  await test("Live delivery and GIF search say so plainly when their keys aren't set", async () => {
    assert.equal((await request("me/chat/realtime", { cookie: her })).status, 503);
    assert.equal((await request("me/chat/gifs?q=cat", { cookie: her })).status, 503);
    await json(await request("me/chat/typing", { method: "POST", cookie: josh, body: {} }));
    const newest = (await json(await request("me/chat/messages", { cookie: her }))).messages.at(-1);
    assert.equal((await json(await request("me/chat/messages", { cookie: her }))).typing, true);
  });
} finally {
  await client.close();
}
