// The play hub's server side (docs/refactor/RENOVATION.md, "Games"): game rewards into her sticker
// collection (once per game + reason, never from Josh's sign-in), and the per-person "new" marks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
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
app.onError((error) => { throw error; });

function request(route, { method = "GET", cookie, body } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: {
      ...(method !== "GET" ? { "x-kw": "1" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
async function signIn(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } });
  return response.headers.get("set-cookie").split(";")[0];
}
const her = await signIn("kiriya");
const josh = await signIn("admin");

await test("A game's sticker lands in her collection once per game and reason", async () => {
  const first = await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-sprig", game: "herb-match", reason: "first garden cleared" } });
  assert.equal(first.status, 201);
  const saved = await first.json();
  assert.equal(saved.saved, true);
  assert.equal(saved.sticker.name, "Herb sprig");
  assert.equal(saved.firstOfKind, true);

  const again = await (await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-sprig", game: "herb-match", reason: "first garden cleared" } })).json();
  assert.deepEqual([again.saved, again.already], [false, true]);

  const other = await (await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-sprig", game: "herb-match", reason: "ten gardens" } })).json();
  assert.deepEqual([other.saved, other.firstOfKind], [true, false]);

  // The drawer's list and the play hub read the same collection.
  const drawerView = await (await request("me/stickers", { cookie: her })).json();
  assert.equal(drawerView.collected.filter((entry) => entry.id === "st-sprig").length, 2);
  const state = await (await request("me/play", { cookie: her })).json();
  assert.deepEqual(state.collected.map((entry) => [entry.id, entry.count]), [["st-sprig", 2]]);
  assert.ok(state.catalogue.some((entry) => entry.id === "st-kitten"));
  assert.ok(!state.catalogue.some((entry) => entry.id === "st-cake"), "the birthday cake stays a birthday surprise");
});

await test("Josh's rewards are a preview and never reach her collection", async () => {
  const preview = await request("me/stickers", { method: "POST", cookie: josh, body: { sticker: "st-star", game: "petal-catch", reason: "hundred petals" } });
  assert.equal(preview.status, 200);
  const body = await preview.json();
  assert.deepEqual([body.saved, body.preview], [false, true]);
  const state = await (await request("me/play", { cookie: her })).json();
  assert.ok(!state.collected.some((entry) => entry.id === "st-star"));
});

await test("Rewards are checked: well-formed ids only, no birthday-only stickers, signed in", async () => {
  assert.equal((await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "kitten", game: "x", reason: "y" } })).status, 400);
  assert.equal((await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-kitten", game: "Bad Id!", reason: "y" } })).status, 400);
  assert.equal((await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-kitten", game: "x", reason: "" } })).status, 400);
  assert.equal((await request("me/stickers", { method: "POST", cookie: her, body: { sticker: "st-cake", game: "x", reason: "y" } })).status, 400);
  assert.equal((await request("me/stickers", { method: "POST", body: { sticker: "st-kitten", game: "x", reason: "y" } })).status, 401);
});

await test("Each of them has their own 'new' marks", async () => {
  assert.deepEqual((await (await request("me/play", { cookie: her })).json()).played, []);
  const marked = await (await request("me/play/played", { method: "POST", cookie: her, body: { game: "memory-drawer" } })).json();
  assert.deepEqual(marked.played, ["memory-drawer"]);
  await request("me/play/played", { method: "POST", cookie: her, body: { game: "memory-drawer" } });
  assert.deepEqual((await (await request("me/play", { cookie: her })).json()).played, ["memory-drawer"]);
  assert.deepEqual((await (await request("me/play", { cookie: josh })).json()).played, []);
  assert.equal((await request("me/play/played", { method: "POST", cookie: her, body: { game: "../etc" } })).status, 400);
});

// ---------------------------------------------------------------- her gallery (pure helpers)
const { KINDS, artKind, artTitle, groupByMonth, kindsIn } = await import("../src/world/play/gallery/kinds.js");

await test("Her gallery tells doodles, kaleidoscopes, paper dolls and bouquets apart by the titles the games save", () => {
  assert.equal(artKind({ prompt: "a little kaleidoscope" }), "kaleidoscope");
  assert.equal(artKind({ prompt: "paper doll · idol stage" }), "doll");
  assert.equal(artKind({ prompt: "bouquet · roses & peony" }), "bouquet");
  assert.equal(artKind({ prompt: "A little birthday doodle" }), "doodle");
  assert.equal(artKind({ prompt: null }), "doodle");
  assert.equal(artTitle({ prompt: "paper doll · idol stage" }), "idol stage");
  assert.equal(artTitle({ prompt: "bouquet · roses & peony" }), "roses & peony");
  assert.equal(artTitle({ prompt: "  " }), "a little untitled thing");
  assert.equal(artTitle({ prompt: "my cat · sleeping" }), "my cat · sleeping", "only the games' own prefixes come off");
  const counted = kindsIn([{ prompt: "bouquet · x" }, { prompt: "doodle" }, { prompt: "a little kaleidoscope" }, { prompt: "bouquet · y" }]);
  assert.deepEqual(counted.map((kind) => [kind.id, kind.count]), [["doodle", 1], ["kaleidoscope", 1], ["bouquet", 2]], "in the gallery's order, only kinds she has");
  assert.equal(KINDS.length, 4);
});

await test("Her gallery groups by month in Singapore time, newest first", () => {
  const groups = groupByMonth([{ id: "a", createdAt: "2026-11-30T17:00:00Z" }, { id: "b", createdAt: "2026-11-02T00:00:00Z" }, { id: "c", createdAt: "2026-10-31T16:30:00Z" }, { id: "d" }]);
  assert.deepEqual(groups.map((group) => [group.key, group.label, group.artworks.map((art) => art.id)]), [
    ["2026-12", "december 2026", ["a"]],
    ["2026-11", "november 2026", ["b", "c"]],
    ["undated", "a little while ago", ["d"]],
  ]);
});
