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
  });
} finally {
  await client.close();
}
