// The chat's end-to-end encryption (round 3, docs/refactor/CHAT-CRYPTO.md): the crypto under Node's
// WebCrypto, and the client modules running as separate "devices" against the real API and an
// in-memory database. Nothing here reaches the network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { eq as sqlEq } from "drizzle-orm";
import { hashPassphrase } from "../server/auth/passphrase.js";

register("./test-support/chat-crypto-hooks.mjs", import.meta.url);

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "ABLY_API_KEY", "GIPHY_API_KEY"])
  process.env[name] = "";
const phrases = { kiriya: `Strawberry  Milk ${randomBytes(4).toString("hex")}`, admin: `lilac moon ${randomBytes(4).toString("hex")}` };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
const realFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("External network is disabled in these tests");
};
void realFetch;

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
app.onError((error) => {
  throw error;
});
const core = await import("../src/lib/chatCrypto/core.js");
const serverKeys = await import("../server/lib/chatKeys.js");

function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  rewritten.searchParams.set("route", original.pathname.slice(5));
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
async function unlock(role, passphrase = phrases[role]) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

// ---------- simulated devices ----------
globalThis.__chatDevices = {};
globalThis.__chatViewAs = {};
/** A fresh "phone": its own copy of the client modules (own keyring, own storage), signed in as `role`. */
async function device(name, role, { cookie } = {}) {
  const session = { cookie: cookie ?? (await unlock(role)) };
  globalThis.__chatDevices[name] = async (path, { method = "GET", body } = {}) => {
    const response = await request(path.replace(/^\//, ""), { method, cookie: session.cookie, body, headers: globalThis.__chatViewAs[name] ? { "x-view-as": "kiriya" } : {} });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith("kw=")) session.cookie = setCookie.split(";")[0];
    return { status: response.status, data: await response.json().catch(() => null) };
  };
  const hooks = await import(`../src/lib/chatCrypto.js?device=${name}`);
  return { name, role, session, ...hooks };
}

const ITER = core.KDF_ITERATIONS;
const newId = () => `${Date.now().toString(36)}-${randomUUID().slice(0, 13)}`;
const sendRaw = (cookie, body, status = 201) => request("me/chat/messages", { method: "POST", cookie, body }).then((r) => json(r, status));
const plainHistory = {};
// Stand-ins for Blob storage: what each upload link holds.
const PLAIN_PHOTO = "/api/uploads/media?path=chat%2F171-plainphoto.webp";
const PLAIN_VOICE = "/api/uploads/media?path=chat%2F172-plainvoice.m4a";
const files = new Map([
  [PLAIN_PHOTO, { bytes: new TextEncoder().encode("PLAINPHOTOBYTES-beach-day"), type: "image/webp" }],
  [PLAIN_VOICE, { bytes: new TextEncoder().encode("PLAINVOICEBYTES-hello"), type: "audio/mp4" }],
]);
let uploads = 0;
const fakeUpload = async (file) => {
  const url = `/api/uploads/media?path=chat%2Fsealed-${++uploads}.bin`;
  files.set(url, { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type });
  return { url };
};
const fakeFetch = async (url) => {
  const file = files.get(url);
  if (!file) throw new Error(`no file ${url}`);
  return { bytes: file.bytes.slice().buffer, type: file.type };
};
// The client's media fetches (mediaBlob) go to the same stand-in.
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https:\/\/kiriya\.love/, "");
  const file = files.get(path);
  if (!file) throw new Error("External network is disabled in these tests");
  return new Response(file.bytes, { headers: { "content-type": file.type } });
};
const dump = async () => JSON.stringify([await db.select().from(schema.chatMessages), await db.select().from(schema.memories), await db.select().from(schema.kv)]);

try {
  await test("Passphrases stretch the same way the server normalises them, and only the right one opens a key", async () => {
    assert.equal(core.normalizePassphrase("  Strawberry   ‘Milk’ "), "strawberry 'milk'");
    const { privateKey, publicKey } = await core.generateIdentity();
    const wrapped = await core.wrapIdentity(privateKey, "Strawberry  Milk", "kiriya");
    assert.equal(wrapped.iter, ITER);
    assert(ITER >= 600_000, "at least OWASP's 600 000 rounds");
    const opened = await core.unwrapIdentity(wrapped, "strawberry milk", "kiriya");
    assert(await core.samePair(opened, publicKey));
    await assert.rejects(core.unwrapIdentity(wrapped, "strawberry milk!", "kiriya"), (e) => e.code === "wrong_passphrase");
    // Bound to whose key it is: her blob can't be passed off as Josh's.
    await assert.rejects(core.unwrapIdentity(wrapped, "strawberry milk", "admin"), (e) => e.code === "wrong_passphrase");
    await assert.rejects(core.unwrapIdentity({ ...wrapped, iter: 10 }, "strawberry milk", "kiriya"), (e) => e.code === "bad_wrapped");
    const extractable = await core.unwrapIdentity(wrapped, "strawberry milk", "kiriya", { extractable: true });
    await assert.rejects(crypto.subtle.exportKey("pkcs8", opened), "a key opened for use can never be read out");
    assert(await crypto.subtle.exportKey("pkcs8", extractable));
  });

  let her, him, pair, chatKey;
  await test("Both phones arrive at the same chat key on their own, and messages open both ways", async () => {
    her = await core.generateIdentity();
    him = await core.generateIdentity();
    pair = { kiriya: her.publicKey, admin: him.publicKey };
    const mine = await core.deriveChatKey(her.privateKey, pair, "kiriya");
    const his = await core.deriveChatKey(him.privateKey, pair, "admin");
    assert.deepEqual(Buffer.from(mine.raw), Buffer.from(his.raw));
    assert.equal(mine.keyId, his.keyId);
    assert.equal(mine.keyId, serverKeys.keyIdOf(her.publicKey, him.publicKey), "the server names the key the same way");
    chatKey = { key: await core.importChatKey(mine.raw), keyId: mine.keyId };
    const hisKey = { key: await core.importChatKey(his.raw), keyId: his.keyId };
    const keyFor = (k) => async (id) => (id === k.keyId ? k.key : null);

    const fromHer = await core.sealMessage(chatKey, { clientId: "c-1", sender: "kiriya", kind: "text", body: "good morning baby ♡", preview: "good morning baby ♡" });
    assert(!JSON.stringify(fromHer).includes("morning"));
    assert.deepEqual(Object.keys(fromHer.enc).sort(), ["k", "n", "v"]);
    assert.equal((await core.openMessage(keyFor(hisKey), { ...fromHer, sender: "kiriya" })).body, "good morning baby ♡");
    assert.equal(await core.openPreview(keyFor(hisKey), { ...fromHer, sender: "kiriya" }), "good morning baby ♡");
    const fromHim = await core.sealMessage(hisKey, { clientId: "c-2", sender: "admin", kind: "text", body: "morning sunshine" });
    assert.equal((await core.openMessage(keyFor(chatKey), { ...fromHim, sender: "admin" })).body, "morning sunshine");
  });

  await test("A sealed message can't be moved, re-attributed or altered without failing to open", async () => {
    const keyFor = async (id) => (id === chatKey.keyId ? chatKey.key : null);
    const sealed = { ...(await core.sealMessage(chatKey, { clientId: "c-3", sender: "kiriya", kind: "text", body: "only for you" })), sender: "kiriya" };
    await assert.rejects(core.openMessage(keyFor, { ...sealed, sender: "admin" }), (e) => e.code === "cant_open", "re-attributed to Josh");
    await assert.rejects(core.openMessage(keyFor, { ...sealed, kind: "image" }), (e) => e.code === "cant_open", "passed off as another kind");
    await assert.rejects(core.openMessage(keyFor, { ...sealed, clientId: "c-other" }), (e) => e.code === "wrong_message", "moved onto another message");
    const bytes = core.fromBase64Url(sealed.body);
    bytes[20] ^= 1;
    await assert.rejects(core.openMessage(keyFor, { ...sealed, body: core.toBase64Url(bytes) }), (e) => e.code === "cant_open", "one flipped bit");
    const stranger = await core.generateIdentity();
    const wrong = await core.deriveChatKey(stranger.privateKey, { kiriya: her.publicKey, admin: stranger.publicKey }, "admin");
    await assert.rejects(core.openMessage(async () => core.importChatKey(wrong.raw), sealed), (e) => e.code === "cant_open", "someone else's key");
    await assert.rejects(core.openMessage(async () => null, sealed), (e) => e.code === "no_key");
    // Fresh IV every time: the same words never look the same twice.
    const again = await core.sealMessage(chatKey, { clientId: "c-3", sender: "kiriya", kind: "text", body: "only for you" });
    assert.notEqual(again.body, sealed.body);
    // Padded: "hi" and a few more letters look the same length.
    const short = await core.sealMessage(chatKey, { clientId: "c-4", sender: "kiriya", kind: "text", body: "hi" });
    const longer = await core.sealMessage(chatKey, { clientId: "c-4", sender: "kiriya", kind: "text", body: "hi there" });
    assert.equal(short.body.length, longer.body.length);
  });

  await test("Photos, videos and voice notes: each file has its own key, sealed inside the message", async () => {
    const keyFor = async (id) => (id === chatKey.keyId ? chatKey.key : null);
    const photo = new Uint8Array(randomBytes(5000));
    const video = new Uint8Array(randomBytes(9000));
    const poster = new Uint8Array(randomBytes(700));
    const [p, v, pp] = await Promise.all([core.sealBytes(photo), core.sealBytes(video), core.sealBytes(poster)]);
    assert.notEqual(p.key, v.key);
    assert(!Buffer.from(p.data).includes(Buffer.from(photo.subarray(0, 64))), "the stored bytes aren't the photo");
    const media = {
      items: [
        { type: "image", url: "/api/uploads/media?path=chat%2F1-a.bin", width: 900, height: 1200, alt: "us at the beach", sealed: { key: p.key, mime: "image/webp" } },
        { type: "video", url: "/api/uploads/media?path=chat%2F2-b.bin", width: 720, height: 1280, duration: 8.5, sealed: { key: v.key, mime: "video/mp4" }, poster: { url: "/api/uploads/media?path=chat%2F3-c.bin", width: 720, height: 1280, sealed: { key: pp.key, mime: "image/jpeg" } } },
      ],
    };
    const sealed = { ...(await core.sealMessage(chatKey, { clientId: "c-5", sender: "admin", kind: "image", body: "look!!", media })), sender: "admin" };
    const wire = JSON.stringify(sealed);
    for (const secret of [p.key, v.key, pp.key, "beach", "image/webp", "video/mp4", "look!!"]) assert(!wire.includes(secret), `${secret} is hidden`);
    assert.equal(sealed.media.items[1].duration, 8.5, "layout facts stay plain");
    assert.equal(typeof sealed.media.items[0].sealed, "string");
    const opened = await core.openMessage(keyFor, sealed);
    assert.equal(opened.body, "look!!");
    assert.equal(opened.media.items[0].alt, "us at the beach");
    assert.deepEqual(opened.media.items[1].poster.sealed, { key: pp.key, mime: "image/jpeg" });
    assert.deepEqual(new Uint8Array(await core.openBytes(p.data, opened.media.items[0].sealed.key)), photo);
    assert.deepEqual(new Uint8Array(await core.openBytes(v.data, opened.media.items[1].sealed.key)), video);
    await assert.rejects(core.openBytes(p.data, v.key), (e) => e.code === "cant_open", "a file only opens with its own key");

    // A voice note's waveform and a GIF's link are private too.
    const voice = { ...(await core.sealMessage(chatKey, { clientId: "c-6", sender: "kiriya", kind: "voice", media: { url: "/api/uploads/media?path=chat%2F4-d.bin", duration: 4.2, peaks: [0.1, 0.9, 0.4], mime: "audio/mp4", sealed: { key: p.key, mime: "audio/mp4" } } })), sender: "kiriya" };
    assert.equal(voice.media.peaks, undefined);
    assert.deepEqual((await core.openMessage(keyFor, voice)).media.peaks, [0.1, 0.9, 0.4]);
    const gif = { ...(await core.sealMessage(chatKey, { clientId: "c-7", sender: "kiriya", kind: "gif", media: { url: "https://media2.giphy.com/media/abc/200w.gif", giphyId: "abc", width: 200, height: 150 } })), sender: "kiriya" };
    assert.deepEqual(Object.keys(gif.media).sort(), ["height", "sealed", "width"]);
    assert.equal((await core.openMessage(keyFor, gif)).media.url, "https://media2.giphy.com/media/abc/200w.gif");
  });

  // ---------- devices, keys and the server ----------
  let joshPhone, herPhone;
  await test("A first sign-in makes the key from the passphrase just typed; nothing more is asked", async () => {
    joshPhone = await device("josh-phone", "admin");
    assert.equal((await joshPhone.ensureChatKeys()).status, "plain", "no keys anywhere yet");
    await joshPhone.rememberPassphrase(phrases.admin);
    let state = joshPhone.chatKeyState();
    assert.deepEqual([state.status, state.setUp, state.partnerSetUp], ["plain", true, false], "his key exists, hers doesn't yet: messages stay plain");
    // Until her key exists, everything passes through as it is.
    const plain = { clientId: "p-1", kind: "text", body: "hi" };
    assert.deepEqual(await joshPhone.sealOutgoing(plain), plain);
    assert.equal((await joshPhone.sealFile(new File(["x"], "x.png", { type: "image/png" }))).sealed, null);
    // Plain history from before her first sign-in: a text, a photo with a caption, a GIF and a voice note.
    const joshCookie = joshPhone.session.cookie;
    const herCookie = await unlock("kiriya");
    plainHistory.text = await sendRaw(joshCookie, await joshPhone.sealOutgoing({ clientId: newId(), kind: "text", body: "first plain words before the lock" }));
    plainHistory.photo = await sendRaw(herCookie, { clientId: newId(), kind: "image", body: "old beach caption", media: { url: PLAIN_PHOTO, width: 800, height: 600 } });
    plainHistory.gif = await sendRaw(joshCookie, { clientId: newId(), kind: "gif", media: { url: "https://media2.giphy.com/media/oldcat/giphy.gif", giphyId: "oldcat", width: 200, height: 200 } });
    plainHistory.voice = await sendRaw(herCookie, { clientId: newId(), kind: "voice", media: { url: PLAIN_VOICE, duration: 3.5, peaks: [0.2, 0.7], mime: "audio/mp4" } });
    assert.equal(plainHistory.text.enc, null, "stored plain while she has no key");
    // She keeps the photo in her memories while it's still plain.
    plainHistory.memory = await json(await request("me/memories", { method: "POST", cookie: herCookie, body: { kind: "message", sourceId: plainHistory.photo.id } }), 201);

    herPhone = await device("her-phone", "kiriya");
    await herPhone.rememberPassphrase(phrases.kiriya);
    state = herPhone.chatKeyState();
    assert.equal(state.status, "ready");
    assert.equal((await joshPhone.ensureChatKeys({ force: true })).status, "ready", "his phone needs no passphrase to start sealing");
    assert.equal(joshPhone.chatKeyState().current, state.current);
    assert.equal(joshPhone.chatKeyState().safety, state.safety, "both phones show the same safety code");
    assert.match(state.safety, /^(\S+ ){5}\S+$/u);

    const stored = await db.select().from(schema.kv);
    const identities = stored.filter((row) => row.key.startsWith("chatkeys:identity:"));
    assert.equal(identities.length, 2);
    for (const row of identities) {
      assert.deepEqual(Object.keys(row.value.wrapped).sort(), ["data", "iter", "iv", "kdf", "salt", "v"]);
      assert.equal(row.value.wrapped.iter, ITER);
    }
  });

  await test("A phone that opens with Face ID keeps its key; a fresh device asks for the passphrase once", async () => {
    // Face ID: a new session from the device secret, no passphrase typed. The key is already here.
    joshPhone.session.cookie = await unlock("admin");
    assert.equal((await joshPhone.ensureChatKeys({ force: true })).status, "ready");

    const laptop = await device("josh-laptop", "admin");
    assert.equal((await laptop.ensureChatKeys()).status, "locked", "sealed chat, no key on this device yet");
    assert.equal(laptop.chatCryptoReady(), false);
    await assert.rejects(laptop.sealOutgoing({ clientId: "l-1", kind: "text", body: "hi" }), (e) => e.code === "chat_locked", "never sent plain by mistake");
    await assert.rejects(laptop.sealFile(new File(["x"], "x.png", { type: "image/png" })), (e) => e.code === "chat_locked");
    await assert.rejects(laptop.unlockChatKeys("not my passphrase"), (e) => e.status === 401);
    assert.equal(laptop.chatKeyState().status, "locked");
    await laptop.unlockChatKeys(phrases.admin.toUpperCase());
    assert.equal(laptop.chatKeyState().status, "ready", "typed with capitals: normalised like sign-in");
    assert.equal(laptop.chatKeyState().current, herPhone.chatKeyState().current);
    assert.equal((await serverKeys.readIdentity(db, "admin")).version, 1, "the same key pair, not a new one");
  });

  await test("Josh peeking at her side opens the chat with his own key", async () => {
    const peek = await device("josh-peek", "admin", { cookie: joshPhone.session.cookie });
    globalThis.__chatViewAs["josh-peek"] = "kiriya";
    const keys = await json(await request("me/chat/keys", { cookie: joshPhone.session.cookie, headers: { "x-view-as": "kiriya" } }));
    assert.equal(keys.me, "admin", "her wrapped key never goes to his phone");
    assert.equal((await request("me/chat/keys", { method: "PUT", cookie: joshPhone.session.cookie, headers: { "x-view-as": "kiriya" }, body: {} })).status, 403);
    await peek.unlockChatKeys(phrases.admin);
    assert.equal(peek.chatKeyState().status, "ready");
    delete globalThis.__chatViewAs["josh-peek"];
  });

  await test("Keys are checked: no junk public keys, no weak wrapping, and a second key pair can't replace the first by accident", async () => {
    const cookie = await unlock("admin");
    const bad = (body) => request("me/chat/keys", { method: "PUT", cookie, body }).then((r) => r.status);
    const { privateKey, publicKey } = await core.generateIdentity();
    const weak = await core.wrapIdentity(privateKey, phrases.admin, "admin", { iterations: 100_000 });
    assert.equal(await bad({ publicKey, wrapped: weak }), 400);
    assert.equal(await bad({ publicKey: "AAAA", wrapped: await core.wrapIdentity(privateKey, phrases.admin, "admin") }), 400);
    const response = await request("me/chat/keys", { method: "PUT", cookie, body: { publicKey, wrapped: await core.wrapIdentity(privateKey, phrases.admin, "admin") } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).keys.admin.publicKey, (await serverKeys.readIdentity(db, "admin")).publicKey);
  });

  let newPhrase;
  await test("Changing a passphrase re-wraps the key with it; the new one opens a fresh device, the old one doesn't", async () => {
    newPhrase = `peach soda ${randomBytes(3).toString("hex")}`;
    const chatKey = await herPhone.rewrapForPassphraseChange(phrases.kiriya, newPhrase);
    assert(chatKey?.wrapped);
    const before = await serverKeys.readIdentity(db, "kiriya");
    const changed = await json(await request("me/passphrase", { method: "PUT", cookie: herPhone.session.cookie, body: { current: phrases.kiriya, next: newPhrase, signOutOthers: false, chatKey } }));
    assert(changed.ok);
    const after = await serverKeys.readIdentity(db, "kiriya");
    assert.equal(after.publicKey, before.publicKey);
    assert.notDeepEqual(after.wrapped, before.wrapped);
    await assert.rejects(core.unwrapIdentity(after.wrapped, phrases.kiriya, "kiriya"), (e) => e.code === "wrong_passphrase");
    const tablet = await device("her-tablet", "kiriya", { cookie: await unlock("kiriya", newPhrase) });
    await tablet.rememberPassphrase(newPhrase);
    assert.equal(tablet.chatKeyState().status, "ready");
    assert.equal(tablet.chatKeyState().current, herPhone.chatKeyState().current);
  });

  let pancakes;
  await test("Sealed messages go through the real API both ways: replies, edits, the summary", async () => {
    const joshCookie = joshPhone.session.cookie;
    const herCookie = herPhone.session.cookie;
    pancakes = await sendRaw(joshCookie, await joshPhone.sealOutgoing({ clientId: newId(), kind: "text", body: "secret pancakes at 9 ♡", replyTo: null }));
    assert.equal(pancakes.enc.k, joshPhone.chatKeyState().current);
    assert(!JSON.stringify(pancakes).includes("pancakes"));
    const echo = await joshPhone.openIncoming(pancakes);
    assert.deepEqual([echo.body, echo.locked, echo.enc], ["secret pancakes at 9 ♡", undefined, undefined]);

    const reply = await sendRaw(herCookie, await herPhone.sealOutgoing({ clientId: newId(), kind: "text", body: "yesss", replyTo: pancakes.id }));
    const page = await json(await request("me/chat/messages", { cookie: joshCookie }), 200);
    const opened = await joshPhone.openIncoming(page.messages.find((m) => m.id === reply.id));
    assert.equal(opened.body, "yesss");
    assert.equal(opened.replyTo.body, "secret pancakes at 9 ♡", "the quote opens too");

    // An edit is sealed under the original message's identity.
    const edit = await joshPhone.sealOutgoing({ clientId: pancakes.clientId, kind: "text", body: "secret waffles at 9 ♡" });
    const edited = await json(await request(`me/chat/messages/${pancakes.id}`, { method: "PATCH", cookie: joshCookie, body: { body: edit.body, enc: edit.enc } }));
    assert.equal((await herPhone.openIncoming(edited)).body, "secret waffles at 9 ♡");
    assert(edited.editedAt);

    const summary = await json(await request("me/chat/summary", { cookie: joshCookie }));
    assert.equal((await joshPhone.openIncoming(summary.last)).body, "yesss");
    // Once both have keys, the server turns away anything plain (a stale build, a phone without the key).
    await sendRaw(joshCookie, { clientId: newId(), kind: "text", body: "oops, plain" }, 400);
    await json(await request(`me/chat/messages/${pancakes.id}`, { method: "PATCH", cookie: joshCookie, body: { body: "plain edit" } }), 400);
    assert.equal((await sendRaw(joshCookie, { clientId: newId(), kind: "tap", body: "hug" })).kind, "tap", "signals stay plain");
    // A device without the key shows a quiet locked bubble instead of failing.
    const stranger = await device("stranger-browser", "kiriya", { cookie: herPhone.session.cookie });
    const locked = await stranger.openIncoming(page.messages.find((m) => m.id === reply.id));
    assert.deepEqual([locked.locked, locked.body, locked.media], [true, "", null]);
  });

  await test("Photos, videos, voice notes and GIFs: sealed files open on the other phone, byte for byte", async () => {
    const photoBytes = new TextEncoder().encode("JPEG-our-first-date".repeat(50));
    const videoBytes = new TextEncoder().encode("MP4-fireworks".repeat(80));
    const voiceBytes = new TextEncoder().encode("M4A-goodnight".repeat(40));
    const seal = async (bytes, type) => {
      const { blob, sealed } = await joshPhone.sealFile(new File([bytes], "f", { type }));
      assert.equal(blob.type, "application/octet-stream");
      assert(!Buffer.from(await blob.arrayBuffer()).includes(Buffer.from(bytes.subarray(0, 12))));
      return { url: (await fakeUpload(blob)).url, sealed };
    };
    const photo = await seal(photoBytes, "image/jpeg");
    const video = await seal(videoBytes, "video/mp4");
    const poster = await seal(photoBytes.subarray(0, 64), "image/jpeg");
    const album = await sendRaw(
      joshPhone.session.cookie,
      await joshPhone.sealOutgoing({
        clientId: newId(),
        kind: "image",
        body: "our first date",
        media: { items: [{ type: "image", ...photo, width: 900, height: 1200, mime: "image/jpeg" }, { type: "video", ...video, width: 720, height: 1280, duration: 6, mime: "video/mp4", poster: { ...poster, width: 720, height: 1280 } }] },
      }),
    );
    for (const secret of [photo.sealed.key, video.sealed.key, "first date"]) assert(!JSON.stringify(album).includes(secret));
    const opened = await herPhone.openIncoming(album);
    assert.equal(opened.body, "our first date");
    assert.deepEqual(new Uint8Array(await (await herPhone.mediaBlob(opened.media.items[0])).arrayBuffer()), photoBytes);
    const videoBlob = await herPhone.mediaBlob(opened.media.items[1]);
    assert.equal(videoBlob.type, "video/mp4");
    assert.deepEqual(new Uint8Array(await videoBlob.arrayBuffer()), videoBytes);
    assert.equal(opened.media.items[1].poster.sealed.mime, "image/jpeg");

    const voice = await seal(voiceBytes, "audio/mp4");
    const note = await sendRaw(herPhone.session.cookie, await herPhone.sealOutgoing({ clientId: newId(), kind: "voice", media: { ...voice, duration: 2.5, mime: "audio/mp4", peaks: [0.3, 0.9, 0.5] } }));
    assert.equal(note.media.peaks, undefined, "the waveform travels sealed");
    const heard = await joshPhone.openIncoming(note);
    assert.deepEqual(heard.media.peaks, [0.3, 0.9, 0.5]);
    assert.deepEqual(new Uint8Array(await (await joshPhone.mediaBlob(heard.media)).arrayBuffer()), voiceBytes);

    const gif = await sendRaw(herPhone.session.cookie, await herPhone.sealOutgoing({ clientId: newId(), kind: "gif", media: { url: "https://media1.giphy.com/media/xyz/giphy.gif", mp4: "https://media1.giphy.com/media/xyz/giphy.mp4", giphyId: "xyz", width: 480, height: 270 } }));
    assert.deepEqual(Object.keys(gif.media).sort(), ["height", "sealed", "width"], "the server can't tell which GIF");
    assert.equal((await joshPhone.openIncoming(gif)).media.mp4, "https://media1.giphy.com/media/xyz/giphy.mp4");
  });

  await test("Notifications carry only a sealed preview that the phone opens; web push says just \"a new message\"", async () => {
    const { chatNotification } = await import("../server/lib/chat.js");
    const { apnsNotification } = await import("../server/push/apns.js");
    const { buildPayload } = await import("../server/push/webpush.js");
    const message = await sendRaw(joshPhone.session.cookie, await joshPhone.sealOutgoing({ clientId: newId(), kind: "image", body: "look at this sunset", media: { url: "/api/uploads/media?path=chat%2Fx.bin", width: 10, height: 10, sealed: { key: core.toBase64Url(randomBytes(32)), mime: "image/jpeg" } } }));
    const push = chatNotification(message, "Josh");
    assert.equal(push.body, "a new message ♡");
    const apns = apnsNotification(push, { badge: 2 });
    const payload = JSON.parse(apns.compile());
    assert.equal(payload.aps["mutable-content"], 1);
    assert.equal(payload.aps.alert.body, "a new message ♡");
    assert(Buffer.byteLength(apns.compile()) < 4096, "fits in a push");
    assert(!apns.compile().includes("sunset"));
    const preview = await herPhone.openNotificationPreview({ enc: { v: 1, k: payload.sealed.k, n: payload.sealed.n }, sender: payload.sealed.s, kind: payload.sealed.t, clientId: payload.sealed.c });
    assert.equal(preview, "📷 sent you a photo: look at this sunset");
    assert(!buildPayload(push).includes("sunset"));
    // Signals stay what they were: a known key, no words.
    const tap = chatNotification({ kind: "tap", body: "hug", id: randomUUID() }, "Josh");
    assert.match(tap.title, /Josh/);
  });

  await test("The widget, her memories and a reply from a notification all stay sealed", async () => {
    const { appSnapshot } = await import("../server/routes/widget.js");
    const snapshot = await appSnapshot(db, "kiriya");
    assert.equal(snapshot.chat.last.preview, null);
    assert(snapshot.chat.last.sealed.b);
    const opened = await herPhone.openIncoming({ enc: { v: 1, k: snapshot.chat.last.sealed.k }, body: snapshot.chat.last.sealed.b, sender: snapshot.chat.last.sealed.s, kind: snapshot.chat.last.sealed.t });
    assert.equal(opened.body, "look at this sunset");

    const saved = await json(await request("me/memories", { method: "POST", cookie: herPhone.session.cookie, body: { kind: "message", sourceId: pancakes.id } }), 201);
    assert(!JSON.stringify(saved).includes("waffles"));
    const shelf = await json(await request("me/memories?shelf=messages", { cookie: herPhone.session.cookie }));
    const memory = shelf.items.find((item) => item.id === saved.id);
    assert.equal((await herPhone.openMemorySnapshot(memory.snapshot)).body, "secret waffles at 9 ♡");
    assert(shelf.counts.messages >= 1);

    // "Reply" typed into a notification: the phone seals it natively, the way the Swift code does.
    const { createDeviceKey } = await import("../server/lib/deviceKeys.js");
    const widgetKey = (await createDeviceKey(db, "kiriya", "iPhone app")).key;
    const keyNow = herPhone.chatKeyState().current;
    const raw = (await core.deriveChatKey(await core.unwrapIdentity((await serverKeys.readIdentity(db, "kiriya")).wrapped, newPhrase, "kiriya"), { kiriya: (await serverKeys.readIdentity(db, "kiriya")).publicKey, admin: (await serverKeys.readIdentity(db, "admin")).publicKey }, "kiriya")).raw;
    const sealed = await core.sealMessage({ key: await core.importChatKey(raw), keyId: keyNow }, { clientId: "n-push-1234-reply", sender: "kiriya", kind: "text", body: "on my way!!", preview: "on my way!!" });
    const response = await request("widget/reply", { method: "POST", headers: { authorization: `Bearer ${widgetKey}` }, body: { text: sealed.body, enc: sealed.enc, replyTo: pancakes.id, clientId: "n-push-1234-reply" } });
    assert.equal(response.status, 200, await response.clone().text());
    const [row] = await db.select().from(schema.chatMessages).where(sqlEq(schema.chatMessages.clientId, "n-push-1234-reply"));
    assert(row.enc);
    assert.equal((await joshPhone.openIncoming({ ...row, createdAt: row.createdAt.toISOString() })).body, "on my way!!");
  });

  await test("Plain history is sealed in place, files included, and her memory of it too", async () => {
    const result = await herPhone.sealHistory({ upload: fakeUpload, fetchFile: fakeFetch });
    assert.equal(result.skipped, 0);
    assert(result.sealed >= 5, `sealed ${result.sealed}`);
    const pending = await json(await request("me/chat/keys/pending", { cookie: herPhone.session.cookie }));
    assert.deepEqual([pending.messages.length, pending.memories.length], [0, 0]);
    const page = await json(await request("me/chat/messages", { cookie: joshPhone.session.cookie }));
    const find = (id) => page.messages.find((m) => m.id === id);
    assert.equal((await joshPhone.openIncoming(find(plainHistory.text.id))).body, "first plain words before the lock");
    const photo = await joshPhone.openIncoming(find(plainHistory.photo.id));
    assert.equal(photo.body, "old beach caption");
    assert.notEqual(photo.media.url, PLAIN_PHOTO, "uploaded again, sealed");
    assert.equal(new TextDecoder().decode(await (await joshPhone.mediaBlob(photo.media)).arrayBuffer()), "PLAINPHOTOBYTES-beach-day");
    assert.equal((await joshPhone.openIncoming(find(plainHistory.gif.id))).media.giphyId, "oldcat");
    const voice = await joshPhone.openIncoming(find(plainHistory.voice.id));
    assert.deepEqual(voice.media.peaks, [0.2, 0.7]);
    assert.equal(voice.media.sealed.mime, "audio/mp4");
    const memories = await json(await request("me/memories?shelf=pictures", { cookie: joshPhone.session.cookie }));
    const memory = await joshPhone.openMemorySnapshot(memories.items.find((item) => item.id === plainHistory.memory.id).snapshot);
    assert.equal(memory.body, "old beach caption");
    assert.equal(memory.media.url, photo.media.url, "the memory and the message share the one sealed copy");
    const everything = await dump();
    for (const old of [PLAIN_PHOTO, PLAIN_VOICE]) assert(!everything.includes(old), `${old} is no longer referenced`);
    // A second run finds nothing to do.
    assert.equal((await joshPhone.sealHistory({ upload: fakeUpload, fetchFile: fakeFetch })).sealed, 0);
  });

  await test("After an admin reset of her passphrase, her next device starts a new key pair and the old one is kept for history", async () => {
    // She forgot the phrase she chose; Josh resets her to the one configured in Vercel.
    await json(await request("admin/credentials/kiriya/reset", { method: "POST", cookie: await unlock("admin"), body: {} }));
    const oldCurrent = herPhone.chatKeyState().current;
    const fresh = await device("her-new-phone", "kiriya");
    await fresh.rememberPassphrase(phrases.kiriya);
    const identity = await serverKeys.readIdentity(db, "kiriya");
    assert.equal(identity.version, 2);
    assert.equal(identity.previous.length, 1);
    assert.equal(fresh.chatKeyState().status, "ready");
    assert.notEqual(fresh.chatKeyState().current, oldCurrent);
    assert.equal((await joshPhone.ensureChatKeys({ force: true })).current, fresh.chatKeyState().current, "Josh's phone follows to the new key by itself");
    assert(joshPhone.chatKeyState().partnerChangedAt, "and notices her key changed");
    const keys = await json(await request("me/chat/keys", { cookie: joshPhone.session.cookie }));
    assert.equal(keys.history.kiriya.length, 1);

    // Her new phone never had the old key: older messages wait, quietly locked…
    const page = await json(await request("me/chat/messages", { cookie: fresh.session.cookie }));
    const old = page.messages.find((m) => m.id === pancakes.id);
    assert.equal((await fresh.openIncoming(old)).locked, true);
    // …until Josh's phone, which has both keys, seals them again with the new one.
    const result = await joshPhone.sealHistory({ upload: fakeUpload, fetchFile: fakeFetch });
    assert(result.sealed > 5, JSON.stringify(result));
    const again = await json(await request("me/chat/messages", { cookie: fresh.session.cookie }));
    assert.equal((await fresh.openIncoming(again.messages.find((m) => m.id === pancakes.id))).body, "secret waffles at 9 ♡");
    const opened = await Promise.all(again.messages.map((m) => fresh.openIncoming(m)));
    assert.equal(opened.filter((m) => m.locked).length, 0, "every message opens on her new phone");
  });

  await test("A dump of the database holds no readable words, file keys or GIF links", async () => {
    const everything = await dump();
    for (const words of ["pancakes", "waffles", "yesss", "first date", "sunset", "on my way", "first plain words", "beach", "oldcat", "giphy.com", "goodnight", "fireworks"])
      assert(!everything.includes(words), `"${words}" must not be readable in the database`);
    // The wrapped private keys are there, and useless without a passphrase.
    assert(everything.includes('"kdf":"PBKDF2-SHA256"'));
  });
} finally {
  await client.close();
}
