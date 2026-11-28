// The private chat and "our memories" (docs/refactor/PLAN.md phase 4), through the real API.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { eq } from "drizzle-orm";
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

  await test("Each phone's check-in shows the other one as active, and when it's night there", async () => {
    // Nobody has checked in yet.
    const before = await json(await request("me/chat/summary", { cookie: josh }));
    assert.deepEqual(before.presence, { seenAt: null, tz: null });
    // Her phone checks in with its time zone; Josh sees her seen just now, in Singapore.
    await json(await request("me/chat/summary?tz=Asia%2FSingapore", { cookie: her }));
    const seen = await json(await request("me/chat/summary", { cookie: josh }));
    assert.equal(seen.presence.tz, "Asia/Singapore");
    assert(Date.now() - Date.parse(seen.presence.seenAt) < 5000);
    // A made-up zone is ignored, and the known one is kept.
    await json(await request("me/chat/summary?tz=Not%2FAZone", { cookie: her }));
    assert.equal((await chat.presenceOf(db, "kiriya")).tz, "Asia/Singapore");
    // Josh previewing her side never checks in as her.
    const earlier = new Date(Date.now() - 3600e3).toISOString();
    await db.update(schema.kv).set({ value: { at: earlier, tz: "Asia/Singapore" } }).where(eq(schema.kv.key, "chat:presence:kiriya"));
    const original = new URL("/api/me/chat/summary?tz=America%2FChicago", "https://kiriya.love");
    const rewritten = new URL("/api", original);
    rewritten.search = original.search;
    rewritten.searchParams.set("__route", "me/chat/summary");
    const previewed = await handlers.GET(new Request(rewritten, { headers: { "x-kw": "1", cookie: josh, "x-view-as": "kiriya" } }));
    assert.equal(previewed.status, 200);
    assert.deepEqual(await chat.presenceOf(db, "kiriya"), { seenAt: earlier, tz: "Asia/Singapore" });
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
    // The iPhone's own stickers and Genmoji: a PNG uploaded to the chat folder.
    const iphone = await send(her, { kind: "sticker", media: { url: "/api/uploads/media?path=chat%2F173-ab12cd34.png", width: 320, height: 300, mime: "image/png", alt: "cat with a heart" } });
    assert.equal(iphone.media.alt, "cat with a heart");
    await send(her, { kind: "sticker", media: { url: "/api/uploads/media?path=art%2F173-ab12cd34.png", width: 320, height: 300 } }, 400);
    await send(her, { kind: "sticker", media: { url: "https://evil.example/s.png" } }, 400);
    await send(her, { kind: "voice", media: { url: "/api/uploads/media?path=chat%2F172-ab12cd34.m4a", duration: 4.2, peaks: [0.1, 0.8, 0.4] } });
    await send(her, { kind: "tap", body: "hug" });
  });

  await test("Replies quote the original; reactions are one per person and can change", async () => {
    const reply = await send(josh, { kind: "text", body: "so cute", replyTo: photo.id });
    assert.deepEqual(reply.replyTo, {
      id: photo.id,
      clientId: photo.clientId,
      sender: "kiriya",
      kind: "image",
      body: "look!!",
      media: { items: [{ type: "image", url: "/api/uploads/media?path=chat%2F171-ab12cd34.webp", width: 900, height: 1200 }], count: 1 },
      enc: null,
    });
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

  await test("Deleting works only on your own messages, wipes them for both, and replies say the original is gone", async () => {
    const answer = await send(her, { kind: "text", body: "hi you", replyTo: hello.id });
    await json(await request(`me/chat/messages/${hello.id}/reaction`, { method: "PUT", cookie: her, body: { emoji: "♥" } }));
    assert.equal((await request(`me/chat/messages/${hello.id}`, { method: "DELETE", cookie: her })).status, 404);
    await json(await request(`me/chat/messages/${hello.id}`, { method: "DELETE", cookie: josh }));
    assert.equal((await request(`me/chat/messages/${hello.id}`, { method: "DELETE", cookie: josh })).status, 404, "only once");
    const page = await json(await request("me/chat/messages", { cookie: her }));
    const gone = page.messages.find((m) => m.id === hello.id);
    assert.deepEqual([gone.kind, gone.body, gone.media, gone.enc, gone.editedAt, gone.reactions], ["deleted", "", null, null, null, {}]);
    const [row] = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, hello.id));
    assert.deepEqual([row.body, row.media], ["", null], "the words are wiped from the database too");
    const quoted = page.messages.find((m) => m.id === answer.id).replyTo;
    assert.deepEqual([quoted.kind, quoted.body, quoted.media], ["deleted", "", null]);
  });

  await test("Albums carry 1–10 photos and videos; videos need a duration and may carry a poster", async () => {
    const item = (i, extra = {}) => ({ type: "image", url: `/api/uploads/media?path=chat%2F${200 + i}-ab12cd34.webp`, width: 1200, height: 900, ...extra });
    const video = { type: "video", url: "/api/uploads/media?path=chat%2F300-ab12cd34.mp4", width: 1080, height: 1920, duration: 12.4, mime: "video/mp4", poster: { url: "/api/uploads/media?path=chat%2F301-ab12cd34.webp", width: 540, height: 960 } };
    const album = await send(her, { kind: "image", body: "our day ♡", media: { items: [item(1), video, item(2)] } });
    assert.equal(album.media.items.length, 3);
    assert.equal(album.media.items[1].poster.width, 540);
    await send(her, { kind: "image", media: { items: Array.from({ length: 10 }, (_, i) => item(i)) } });
    await send(her, { kind: "image", media: { items: Array.from({ length: 11 }, (_, i) => item(i)) } }, 400);
    await send(her, { kind: "image", media: { items: [] } }, 400);
    await send(her, { kind: "image", media: { items: [{ ...video, duration: undefined }] } }, 400);
    await send(her, { kind: "image", media: { items: [{ ...video, duration: 999 }] } }, 400);
    await send(her, { kind: "image", media: { items: [item(1, { duration: 3 })] } }, 400);
    await send(her, { kind: "image", media: { items: [item(1, { url: "/api/uploads/media?path=art%2Fx.webp" })] } }, 400);
    await send(her, { kind: "image", media: { items: [{ ...video, poster: { url: "https://evil.example/p.jpg" } }] } }, 400);
    const reply = await send(josh, { kind: "text", body: "wow", replyTo: album.id });
    assert.deepEqual(reply.replyTo.media, { items: [album.media.items[0]], count: 3 });
  });

  await test("Better GIFs: the crisp mp4 and a still travel with the GIF; links stay GIPHY's own", async () => {
    const gif = await send(her, {
      kind: "gif",
      media: { url: "https://media2.giphy.com/media/abc/giphy.webp", mp4: "https://media2.giphy.com/media/abc/giphy.mp4", still: "https://media2.giphy.com/media/abc/480w_s.jpg", giphyId: "abc", width: 480, height: 270 },
    });
    assert.equal(gif.media.mp4, "https://media2.giphy.com/media/abc/giphy.mp4");
    await send(her, { kind: "gif", media: { url: "https://media2.giphy.com/media/abc/giphy.webp", mp4: "https://evil.example/x.mp4" } }, 400);
    const { gifShape } = await import("../server/routes/chat.js");
    const shaped = gifShape({
      id: "abc",
      title: "cat",
      images: {
        original: { width: "480", height: "270", url: "https://media.giphy.com/media/abc/giphy.gif", mp4: "https://media.giphy.com/media/abc/giphy.mp4", mp4_size: "900000", webp: "https://media.giphy.com/media/abc/giphy.webp", webp_size: "800000" },
        fixed_width: { width: "200", height: "113", url: "https://media.giphy.com/media/abc/200w.gif", mp4: "https://media.giphy.com/media/abc/200w.mp4", webp: "https://media.giphy.com/media/abc/200w.webp" },
        fixed_width_still: { url: "https://media.giphy.com/media/abc/200w_s.gif" },
        "480w_still": { url: "https://media.giphy.com/media/abc/480w_s.jpg" },
      },
    });
    assert.deepEqual([shaped.mp4, shaped.url, shaped.still, shaped.width, shaped.preview.url], [
      "https://media.giphy.com/media/abc/giphy.mp4",
      "https://media.giphy.com/media/abc/giphy.webp",
      "https://media.giphy.com/media/abc/480w_s.jpg",
      480,
      "https://media.giphy.com/media/abc/200w.webp",
    ]);
    const heavy = gifShape({ id: "big", images: { original: { width: "720", height: "404", mp4: "https://media.giphy.com/media/big/giphy.mp4", mp4_size: "9000000", url: "https://media.giphy.com/media/big/giphy.gif" }, fixed_width: { width: "200", height: "112", mp4: "https://media.giphy.com/media/big/200w.mp4", webp: "https://media.giphy.com/media/big/200w.webp" }, downsized_small: { mp4: "https://media.giphy.com/media/big/giphy-downsized-small.mp4" } } });
    assert.equal(heavy.mp4, "https://media.giphy.com/media/big/giphy-downsized-small.mp4", "a heavy original falls back to a lighter mp4");
  });

  await test("Edits change your own words or captions, mark the message edited, and reach the other phone", async () => {
    const mine = await send(josh, { kind: "text", body: "see u at 7" });
    const before = (await json(await request("me/chat/messages", { cookie: her }))).messages.at(-1).createdAt;
    assert.equal((await request(`me/chat/messages/${mine.id}`, { method: "PATCH", cookie: her, body: { body: "hacked" } })).status, 404, "not hers to edit");
    assert.equal((await request(`me/chat/messages/${mine.id}`, { method: "PATCH", cookie: josh, body: { body: "   " } })).status, 400);
    const edited = await json(await request(`me/chat/messages/${mine.id}`, { method: "PATCH", cookie: josh, body: { body: "  see u at 8 ♡ " } }));
    assert.equal(edited.body, "see u at 8 ♡");
    assert(edited.editedAt);
    const caught = await json(await request(`me/chat/messages?after=${encodeURIComponent(before)}`, { cookie: her }));
    assert(caught.messages.some((m) => m.id === mine.id && m.body === "see u at 8 ♡"), "a catch-up after the edit brings the new words");
    const pic = await send(her, { kind: "image", body: "", media: { items: [{ type: "image", url: "/api/uploads/media?path=chat%2F500-ab12cd34.webp", width: 10, height: 10 }] } });
    const caption = await json(await request(`me/chat/messages/${pic.id}`, { method: "PATCH", cookie: her, body: { body: "look at us!!" } }));
    assert.equal(caption.body, "look at us!!");
    assert.equal((await request(`me/chat/messages/${pic.id}`, { method: "PATCH", cookie: her, body: { body: "x".repeat(501) } })).status, 400, "captions stay short");
    const tap = await send(her, { kind: "tap", body: "kiss" });
    assert.equal((await request(`me/chat/messages/${tap.id}`, { method: "PATCH", cookie: her, body: { body: "x" } })).status, 404, "signals can't be edited");
    await json(await request(`me/chat/messages/${mine.id}`, { method: "DELETE", cookie: josh }));
    const after = await json(await request(`me/chat/messages?after=${encodeURIComponent(before)}`, { cookie: her }));
    assert.equal(after.messages.find((m) => m.id === mine.id).kind, "deleted", "a catch-up brings deletions too");
  });

  await test("Sealed messages pass through untouched: enc, sealed bodies and sealed media", async () => {
    const enc = { v: 1, k: "key-1", n: "c2VhbGVkLXByZXZpZXc" };
    const longBody = "A".repeat(9000);
    const sealedText = await send(her, { kind: "text", body: longBody, enc });
    assert.deepEqual([sealedText.body.length, sealedText.enc], [9000, enc]);
    await send(her, { kind: "text", body: "A".repeat(9000) }, 400);
    await send(her, { kind: "text", body: "x", enc: { blob: "A".repeat(5000) } }, 400);
    await send(her, { kind: "tap", body: "hug", enc }, 400);
    const album = await send(her, { kind: "image", body: "c2VhbGVk", enc, media: { items: [{ type: "image", url: "/api/uploads/media?path=chat%2F400-ab12cd34.bin", width: 800, height: 600, mime: "image/webp", sealed: "a2V5" }] } });
    assert.equal(album.media.items[0].sealed, "a2V5");
    await send(her, { kind: "gif", body: "", enc, media: { sealed: "Z2lm", width: 480, height: 270 } });
    await send(her, { kind: "gif", body: "", media: { sealed: "Z2lm", width: 480, height: 270 } }, 400);
    await send(her, { kind: "voice", body: "", enc, media: { url: "/api/uploads/media?path=chat%2F401-ab12cd34.bin", duration: 3, mime: "audio/mp4", sealed: "dm9pY2U" } });
    const reply = await send(josh, { kind: "text", body: "ok", replyTo: sealedText.id });
    assert.deepEqual([reply.replyTo.body.length, reply.replyTo.enc], [9000, enc], "a sealed quote travels whole");
    const edit = await json(await request(`me/chat/messages/${sealedText.id}`, { method: "PATCH", cookie: her, body: { body: "B".repeat(7000), enc } }));
    assert.deepEqual([edit.body.length, edit.enc], [7000, enc]);
    const summary = await json(await request("me/chat/summary", { cookie: josh }));
    assert.equal(summary.last.body, "ok");
    assert.equal(summary.last.enc, null);
  });

  await test("Typing can be switched off at once (the polling fallback)", async () => {
    await json(await request("me/chat/typing", { method: "POST", cookie: josh, body: {} }));
    assert.equal((await json(await request("me/chat/messages", { cookie: her }))).typing, true);
    await json(await request("me/chat/typing", { method: "POST", cookie: josh, body: { stop: true } }));
    assert.equal((await json(await request("me/chat/messages", { cookie: her }))).typing, false);
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
    // Messages edited or deleted since come along too; the only new one is the fresh one.
    assert.deepEqual(caught.messages.filter((m) => m.createdAt > newest.createdAt).map((m) => m.id), [fresh.id]);
  });

  await test("Taps are capped at 30 an hour so a stuck widget can't flood her phone", async () => {
    const now = new Date("2026-11-25T10:00:00Z");
    for (let i = 0; i < 30; i++) await chat.sendMessage(db, "admin", { clientId: `tap-${i}-xxxxx`, kind: "tap", body: "thinking" }, { now: new Date(now.getTime() + i) });
    await assert.rejects(chat.sendMessage(db, "admin", { clientId: "tap-31-xxxxx", kind: "tap", body: "thinking" }, { now }), (e) => e.status === 429);
    const push = chat.chatNotification({ kind: "tap", body: "thinking" }, "Josh");
    assert.equal(push.title, "Josh is thinking of you ♡");
    assert.equal(push.kind, "tap");
    assert.equal(chat.chatNotification({ kind: "voice", body: "" }, "Kiriya").body, "🎙️ a voice note");
    assert.equal(chat.chatNotification({ kind: "image", body: "us!", media: { items: [{ type: "image" }, { type: "image" }, { type: "image" }, { type: "video" }] } }, "Kiriya").body, "📷 3 photos and a video: us!");
    assert.equal(chat.chatNotification({ kind: "image", body: "", media: { items: [{ type: "video" }] } }, "Kiriya").body, "🎬 a video");
  });

  await test("Signals speak in each sender's own words, with the buttons that go with them (Josh, 2026-11-28)", async () => {
    const his = (body) => chat.chatNotification({ kind: "tap", body, sender: "admin", id: "m" }, "Josh");
    const hers = (body) => chat.chatNotification({ kind: "tap", body, sender: "kiriya", id: "m" }, "Kiriya");
    assert.deepEqual([his("thinking").title, his("thinking").body], ["Josh is thinking of you ♡", "(˘︶˘)♡  Cause I love you soo much!"]);
    assert.deepEqual([his("hug").title, his("hug").body, his("hug").category], ["Josh sent you a big hug 🫂", "(っ´▽`)っ  I'm hugging u now babyy can u feel itt?", "TAP_HUG"]);
    assert.equal(his("kiss").body, "(˘ ³˘)♥  mwaaaaaahhh");
    assert.deepEqual([his("morning").title, his("morning").body], ["morning babyyy❤️", "(＾▽＾)ノ  sleep well hunn?"]);
    assert.deepEqual([his("night").title, his("night").body], ["goodnight my lovee❤️😌", "(－ω－)zZ  sleeep well"]);
    assert.deepEqual([his("miss").title, his("miss").body], ["Josh misses you 🥺", "(｡•︿•｡)  Come here babyy🥺❤️"]);
    assert.deepEqual([his("water").title, his("water").body], ["Josh says: drink some water 💧", "(˘▽˘)っ旦  a little sip, for me?"]);
    assert.deepEqual([hers("thinking").title, hers("thinking").body, hers("thinking").category], ["Kiriya is thinking of you ♡", "(˘︶˘)♡  and I love u moreee🥹", "TAP"]);
    assert.deepEqual([hers("hug").body, hers("hug").category], ["(っ´▽`)っ  squeezing u reallyy tightt, hug me backk🥺", "TAP_HUG_FOR_JOSH"]);
    assert.deepEqual([hers("morning").title, hers("night").title, hers("kiss").category], ["good morninggg babe☀️🥰", "nightyy night baby🌙", "TAP_KISS"]);
    assert.equal(hers("water").body, "(˘▽˘)っ旦  stay hydratedd for mee💧");
  });

  await test("Their look: the theme and background are shared, bubbles and typing each their own; only known choices are accepted", async () => {
    const { wallpapers, theirs, ...prefs } = await json(await request("me/chat/prefs", { cookie: her }));
    assert.deepEqual(prefs, chat.DEFAULT_PREFS);
    assert.deepEqual(theirs, { bubble: "lilac", typing: "hearts" });
    assert.deepEqual(wallpapers, { miku: "/api/uploads/wallpapers/miku?v=1", maomao: "/api/uploads/wallpapers/maomao?v=2" });
    const saved = await json(await request("me/chat/prefs", { method: "PUT", cookie: her, body: { bubble: "cat", typing: "maomao", background: "photo", backgroundUrl: "/api/uploads/media?path=backgrounds%2F1-ab.webp" } }));
    assert.deepEqual([saved.bubble, saved.typing, saved.background], ["cat", "maomao", "photo"]);
    const his = await json(await request("me/chat/prefs", { cookie: josh }));
    assert.equal(his.bubble, "lilac", "his bubbles are his own");
    assert.equal(his.background, "photo", "the background is theirs together");
    assert.deepEqual(his.theirs, { bubble: "cat", typing: "maomao" });
    assert.equal((await request("me/chat/prefs", { method: "PUT", cookie: her, body: { bubble: "neon" } })).status, 400);
    assert.equal((await request("me/chat/prefs", { method: "PUT", cookie: her, body: { backgroundUrl: "https://x.example/a.png" } })).status, 400);
    await json(await request("me/chat/prefs", { method: "PUT", cookie: her, body: { background: "theme", backgroundUrl: null } }));
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
