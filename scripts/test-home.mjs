// The app's home section (docs/refactor/RENOVATION.md): Josh's in-place edits to the centre stage,
// the pinboard and the songs for her to discover, through the real API.
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
globalThis.fetch = () => { throw new Error("External network is disabled in these tests"); };

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
const { lookupCovers, coverImage } = await import("../server/lib/songs.js");
app.onError((error) => { throw error; });

function request(route, { method = "GET", cookie, body, bearer } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: {
      "x-kw": "1",
      ...(cookie ? { cookie } : {}),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
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
const photo = (name, extra = {}) => ({ id: name, src: `/api/uploads/media?path=${encodeURIComponent(`cosplay/${name}.webp`)}`, alt: `photo ${name}`, ...extra });

try {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");

  await test("Both of them can open home; nobody else can", async () => {
    assert.equal((await request("me/home")).status, 401);
    const home = await json(await request("me/home", { cookie: her }));
    assert.deepEqual(
      [home.greeting, home.photos, home.captions, home.pinnedCaption, home.pins, home.songs],
      [null, null, null, null, [], []],
      "nothing chosen yet: the app falls back to today's greeting, photos and captions",
    );
    await json(await request("me/home", { cookie: josh }));
  });

  await test("Only Josh can change what she sees", async () => {
    for (const [method, route, body] of [
      ["PUT", "me/home/greeting", { greeting: "hi" }],
      ["PUT", "me/home/photos", { photos: null }],
      ["PUT", "me/home/captions", { captions: null }],
      ["POST", "me/home/pins", { text: "hello" }],
    ])
      assert.equal((await request(route, { method, cookie: her, body })).status, 403, route);
    assert.equal((await request("me/home/covers?title=x", { cookie: her })).status, 403);
  });

  await test("The greeting is one short line, and can go back to the default", async () => {
    const saved = await json(await request("me/home/greeting", { method: "PUT", cookie: josh, body: { greeting: "  there you are, my lovely.  " } }));
    assert.equal(saved.greeting, "there you are, my lovely.");
    assert.equal((await json(await request("me/home", { cookie: her }))).greeting, "there you are, my lovely.");
    await json(await request("me/home/greeting", { method: "PUT", cookie: josh, body: { greeting: "x".repeat(61) } }), 400);
    const reset = await json(await request("me/home/greeting", { method: "PUT", cookie: josh, body: { greeting: null } }));
    assert.equal(reset.greeting, null);
  });

  await test("Photos: only this site's own uploads or built-in pictures, in Josh's order", async () => {
    const saved = await json(await request("me/home/photos", {
      method: "PUT",
      cookie: josh,
      body: { photos: [photo("b", { focus: "top" }), { id: "default-1", src: "/images/display/img-5446.webp", alt: "her", ownCaptionsOnly: false }, photo("a")] },
    }));
    assert.deepEqual(saved.photos.map((item) => item.id), ["b", "default-1", "a"]);
    assert.equal(saved.photos[0].focus, "top");
    assert.equal(saved.photos[2].focus, "center", "focus defaults to the middle");
    await json(await request("me/home/photos", { method: "PUT", cookie: josh, body: { photos: [{ id: "x", src: "https://example.com/a.jpg" }] } }), 400);
    await json(await request("me/home/photos", { method: "PUT", cookie: josh, body: { photos: [{ id: "x", src: "/api/uploads/media?path=chat%2Fa.webp" }] } }), 400);
    await json(await request("me/home/photos", { method: "PUT", cookie: josh, body: { photos: [photo("a"), photo("a")] } }), 400);
    await json(await request("me/home/photos", { method: "PUT", cookie: josh, body: { photos: [{ ...photo("a"), alt: "x".repeat(201) }] } }), 400);
  });

  await test("Inside the app, photo links go out signed and come back plain", async () => {
    // Signed in the way the app does: it asks for a token instead of a cookie.
    const appUnlock = await handlers.POST(new Request("https://kiriya.love/api?__route=session/unlock", {
      method: "POST",
      headers: { "x-kw": "1", "x-kw-token": "1", "content-type": "application/json" },
      body: JSON.stringify({ passphrase: phrases.admin }),
    }));
    const bearer = (await appUnlock.json()).token;
    assert.ok(bearer, "the app gets a token");
    const home = await json(await request("me/home", { bearer }));
    assert.match(home.photos[0].src, /^https:\/\/kiriya\.love\/api\/uploads\/media\?path=cosplay%2Fb\.webp&s=/);
    // Saving what the app holds stores the website's plain link again.
    await json(await request("me/home/photos", { method: "PUT", bearer, body: { photos: home.photos } }));
    const stored = await json(await request("me/home", { cookie: josh }));
    assert.equal(stored.photos[0].src, "/api/uploads/media?path=cosplay%2Fb.webp");
  });

  await test("Captions: a custom list, one pinned; removing the pinned one unpins it", async () => {
    const captions = [
      { id: "c1", text: "ur cosplay is cute. u make it unforgettable. ♡" },
      { id: "c2", text: "only under photo b", photo: "b" },
    ];
    const saved = await json(await request("me/home/captions", { method: "PUT", cookie: josh, body: { captions, pinned: "c2" } }));
    assert.equal(saved.pinnedCaption, "c2");
    assert.equal(saved.captions[1].photo, "b");
    const dropped = await json(await request("me/home/captions", { method: "PUT", cookie: josh, body: { captions: [captions[0]] } }));
    assert.equal(dropped.pinnedCaption, null);
    // Pinning a built-in caption while still using the built-in list.
    const builtIn = await json(await request("me/home/captions", { method: "PUT", cookie: josh, body: { captions: null, pinned: "cosplay-praise-001" } }));
    assert.equal(builtIn.pinnedCaption, "cosplay-praise-001");
    await json(await request("me/home/captions", { method: "PUT", cookie: josh, body: { captions: [{ id: "c1", text: "   " }] } }), 400);
    await json(await request("me/home/captions", { method: "PUT", cookie: josh, body: { captions: [{ id: "c1", text: "x".repeat(161) }] } }), 400);
  });

  let first, second;
  await test("Pins: newest first, new for her until she has looked at the board", async () => {
    first = (await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: "drink some water ♡", colour: "mint", style: "tape" } }), 201)).pin;
    await new Promise((resolve) => setTimeout(resolve, 5));
    second = (await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: "you've got this", sticker: "kitten" } }), 201)).pin;
    assert.equal(second.style, "pin");
    assert.equal(second.colour, "cream");
    let home = await json(await request("me/home", { cookie: her }));
    assert.deepEqual(home.pins.map((pin) => [pin.text, pin.new]), [["you've got this", true], ["drink some water ♡", true]]);
    assert.equal(home.pins[0].seenByHer, undefined, "her phone never sees the admin-only flags");
    const josh1 = await json(await request("me/home", { cookie: josh }));
    assert.equal(josh1.pins[0].seenByHer, false);

    await json(await request("me/home/seen", { method: "POST", cookie: her, body: { pinsAt: home.pins[0].updatedAt } }));
    home = await json(await request("me/home", { cookie: her }));
    assert.ok(home.pins.every((pin) => !pin.new));
    assert.equal((await json(await request("me/home", { cookie: josh }))).pins[0].seenByHer, true);
    // An older tab can't wind the clock back.
    await json(await request("me/home/seen", { method: "POST", cookie: her, body: { pinsAt: "2020-01-01T00:00:00.000Z" } }));
    assert.ok((await json(await request("me/home", { cookie: her }))).pins.every((pin) => !pin.new));
  });

  await test("Changing a pin makes it new again, unless it's a quiet fix; bump moves it to the top", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await json(await request(`me/home/pins/${first.id}`, { method: "PATCH", cookie: josh, body: { text: "drink some water ♡♡", quiet: true } }));
    let home = await json(await request("me/home", { cookie: her }));
    assert.equal(home.pins.find((pin) => pin.id === first.id).text, "drink some water ♡♡");
    assert.equal(home.pins.find((pin) => pin.id === first.id).new, false);
    await json(await request(`me/home/pins/${first.id}`, { method: "PATCH", cookie: josh, body: { colour: "pink", bump: true } }));
    home = await json(await request("me/home", { cookie: her }));
    assert.equal(home.pins[0].id, first.id);
    assert.equal(home.pins[0].new, true);
    assert.equal(home.pins[0].colour, "pink");
    await json(await request(`me/home/pins/${first.id}`, { method: "PATCH", cookie: josh, body: { colour: "neon" } }), 400);
    await json(await request("me/home/pins/nope", { method: "PATCH", cookie: josh, body: { text: "x" } }), 404);
    await json(await request(`me/home/pins/${second.id}`, { method: "DELETE", cookie: josh }));
    assert.deepEqual((await json(await request("me/home", { cookie: her }))).pins.map((pin) => pin.id), [first.id]);
    await json(await request(`me/home/pins/${second.id}`, { method: "DELETE", cookie: josh }), 404);
    await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: "x".repeat(401) } }), 400);
    await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: "hi", sticker: "dragon" } }), 400);
  });

  await test("The board holds 24 notes", async () => {
    for (let i = 0; i < 23; i++) await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: `note ${i}` } }), 201);
    const full = await json(await request("me/home/pins", { method: "POST", cookie: josh, body: { text: "one too many" } }), 409);
    assert.match(full.message, /24/);
  });

  let upload, link, shelf;
  await test("Songs Josh uploads keep their tags, cover and length; her own shelf songs stay off the card", async () => {
    upload = await json(await request("me/songs", {
      method: "POST",
      cookie: josh,
      body: { upload: { url: "/api/uploads/media?path=songs%2Fa.mp3", title: "World is Mine", artist: "ryo", album: "supercell", duration: 254.3, thumbnail: "/api/uploads/media?path=songs%2Fa.webp", art: "tags" } },
    }));
    assert.deepEqual([upload.provider, upload.title, upload.artist, upload.album, upload.duration, upload.addedBy, upload.thumbnail],
      ["audio", "World is Mine", "ryo", "supercell", 254.3, "admin", "/api/uploads/media?path=songs%2Fa.webp"]);
    link = await json(await request("me/songs", { method: "POST", cookie: josh, body: { url: "https://youtu.be/dQw4w9WgXcQ", duration: 213, title: "a song" } }));
    assert.deepEqual([link.provider, link.duration, link.title], ["youtube", 213, "a song"]);
    shelf = await json(await request("me/songs", { method: "POST", cookie: her, body: { url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" } }));
    assert.equal(shelf.addedBy, "kiriya");
    const home = await json(await request("me/home", { cookie: her }));
    assert.deepEqual(home.songs.map((song) => song.id).sort(), [upload.id, link.id].sort());
    assert.ok(home.songs.every((song) => song.heard === false));
    // Her whole shelf (Settings → Your songs, and the website's player) still lists everything.
    assert.equal((await json(await request("me/songs", { cookie: her }))).songs.length, 3);
    await json(await request("me/songs", { method: "POST", cookie: josh, body: { upload: { url: "/api/uploads/media?path=chat%2Fa.mp3", title: "x" } } }), 400);
    await json(await request("me/songs", { method: "POST", cookie: josh, body: { upload: { url: "/api/uploads/media?path=songs%2Fb.mp3", title: "x", thumbnail: "https://example.com/a.jpg" } } }), 400);
  });

  await test("A song she has played is heard (each of them keeps their own); Josh sees whether she has", async () => {
    await json(await request("me/home/seen", { method: "POST", cookie: her, body: { songs: [upload.id] } }));
    const hers = await json(await request("me/home", { cookie: her }));
    assert.equal(hers.songs.find((song) => song.id === upload.id).heard, true);
    assert.equal(hers.songs.find((song) => song.id === link.id).heard, false);
    const his = await json(await request("me/home", { cookie: josh }));
    assert.equal(his.songs.find((song) => song.id === upload.id).heard, false);
    assert.equal(his.songs.find((song) => song.id === upload.id).heardByHer, true);
    await json(await request("me/home/seen", { method: "POST", cookie: her, body: { songs: ["not-a-uuid"] } }), 400);
  });

  await test("Josh can fix a song's title, artist, album, length and cover", async () => {
    const fixed = await json(await request(`me/songs/${upload.id}`, { method: "PATCH", cookie: josh, body: { title: "World is Mine ♡", artist: "", album: "", duration: null, thumbnail: null } }));
    assert.deepEqual([fixed.title, fixed.artist, fixed.album, fixed.duration, fixed.thumbnail], ["World is Mine ♡", null, null, null, null]);
    await json(await request(`me/songs/${upload.id}`, { method: "PATCH", cookie: josh, body: { title: "" } }), 400);
    await json(await request(`me/songs/${upload.id}`, { method: "PATCH", cookie: josh, body: { thumbnail: "https://example.com/x.jpg" } }), 400);
    await json(await request("me/songs/00000000-0000-4000-8000-000000000000", { method: "PATCH", cookie: josh, body: { title: "x" } }), 404);
    // Starring for her public profile still works as before.
    const starred = await json(await request(`me/songs/${link.id}`, { method: "PATCH", cookie: her, body: { featured: true } }));
    assert.equal(starred.featured, true);
  });

  await test("Cover lookup: MusicBrainz candidates, one request a second, nothing personal sent", async () => {
    const calls = [];
    const fake = async (url, options) => {
      calls.push({ url, at: Date.now(), agent: options.headers["User-Agent"] });
      if (url.includes("/release-group?"))
        return Response.json({ "release-groups": [{ id: "11111111-1111-4111-8111-111111111111", title: "supercell", score: 100, "primary-type": "Album", "first-release-date": "2009-03-04", "artist-credit": [{ name: "supercell" }] }] });
      return Response.json({ recordings: [{ score: 95, "artist-credit": [{ name: "supercell", joinphrase: " feat. " }, { name: "Hatsune Miku" }], releases: [
        { title: "World is Mine", date: "2008-05-31", "release-group": { id: "22222222-2222-4222-8222-222222222222", title: "World is Mine", "primary-type": "Single" } },
        { title: "supercell", "release-group": { id: "11111111-1111-4111-8111-111111111111" } },
      ] }, { score: 20, releases: [{ "release-group": { id: "33333333-3333-4333-8333-333333333333" } }] }] });
    };
    const covers = await lookupCovers({ title: "World is Mine", artist: "supercell", album: "supercell" }, { fetch: fake });
    assert.deepEqual(covers.map((cover) => cover.id), ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]);
    assert.equal(covers[1].artist, "supercell feat. Hatsune Miku");
    assert.equal(covers[0].year, "2009");
    assert.equal(calls.length, 2);
    assert.ok(calls[1].at - calls[0].at >= 1000, "a second apart");
    assert.ok(calls.every((call) => !/kiriya|josh/i.test(call.agent) && !/kiriya|josh/i.test(call.url)));
    // Same question again within ten minutes: answered from memory.
    await lookupCovers({ title: "World is Mine", artist: "supercell", album: "supercell" }, { fetch: fake });
    assert.equal(calls.length, 2);
    // MusicBrainz down: an empty list, never an error.
    assert.deepEqual(await lookupCovers({ title: "x" }, { fetch: async () => new Response("busy", { status: 503 }) }), []);
    assert.equal(await coverImage("../../etc/passwd", { fetch: fake }), null);
    const image = await coverImage("11111111-1111-4111-8111-111111111111", { fetch: async (url) => {
      assert.equal(url, "https://coverartarchive.org/release-group/11111111-1111-4111-8111-111111111111/front-500");
      return new Response(Buffer.from([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
    } });
    assert.deepEqual([image.type, image.bytes.length], ["image/jpeg", 3]);
    assert.equal(await coverImage("11111111-1111-4111-8111-111111111111", { fetch: async () => new Response("<html>", { headers: { "content-type": "text/html" } }) }), null);
  });

  await test("YouTube's player page, from this site's address, for the app", async () => {
    const page = await request("embed/youtube?v=dQw4w9WgXcQ&probe=1");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    const html = await page.text();
    assert.match(html, /"id":"dQw4w9WgXcQ"/);
    assert.match(html, /"probe":true/);
    assert.match(html, /youtube\.com\/iframe_api/);
    assert.equal((await request("embed/youtube?v=<script>")).status, 404);
  });
} finally {
  await client.close();
}
