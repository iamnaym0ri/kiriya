// "us, in pieces" (the slide puzzle): the photo list Josh keeps from the game's own screen.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
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
async function unlock(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
const photo = (n) => `/api/uploads/media?path=${encodeURIComponent(`photos/1764000000000-${n}abc1234.webp`)}`;

test("Slide puzzle photos: both can read the list, only Josh changes it, and only with photos uploaded here", async () => {
  assert.equal((await request("me/games/pastime/slide-photos")).status, 401, "locked without a passphrase");
  const her = await unlock("kiriya");
  const josh = await unlock("admin");

  const empty = await (await request("me/games/pastime/slide-photos", { cookie: her })).json();
  assert.deepEqual(empty.photos, []);

  const forbidden = await request("me/games/pastime/slide-photos", { method: "PUT", cookie: her, body: { photos: [{ url: photo(1) }] } });
  assert.equal(forbidden.status, 403);

  const outside = await request("me/games/pastime/slide-photos", { method: "PUT", cookie: josh, body: { photos: [{ url: "https://example.com/x.jpg" }] } });
  assert.equal(outside.status, 400);
  const wrongFolder = await request("me/games/pastime/slide-photos", {
    method: "PUT", cookie: josh, body: { photos: [{ url: `/api/uploads/media?path=${encodeURIComponent("chat/1-abc.webp")}` }] },
  });
  assert.equal(wrongFolder.status, 400);

  const saved = await request("me/games/pastime/slide-photos", { method: "PUT", cookie: josh, body: { photos: [{ url: photo(1), caption: "  the beach  " }, { url: photo(2) }] } });
  assert.equal(saved.status, 200);
  const { photos } = await saved.json();
  assert.equal(photos.length, 2);
  assert.equal(photos[0].caption, "the beach");
  assert.match(photos[0].id, /^[0-9a-f-]{36}$/);
  assert.ok(photos[1].addedAt);

  const seen = await (await request("me/games/pastime/slide-photos", { cookie: her })).json();
  assert.deepEqual(seen.photos, photos, "she sees what he saved");

  // Keeping ids and dates when he reorders or removes one.
  const kept = await (await request("me/games/pastime/slide-photos", { method: "PUT", cookie: josh, body: { photos: [photos[1]] } })).json();
  assert.deepEqual(kept.photos, [photos[1]]);

  const tooMany = await request("me/games/pastime/slide-photos", { method: "PUT", cookie: josh, body: { photos: Array.from({ length: 41 }, (_, i) => ({ url: photo(i) })) } });
  assert.equal(tooMany.status, 400);
});
