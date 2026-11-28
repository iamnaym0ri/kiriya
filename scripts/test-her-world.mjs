// The app is hers (round 3b): on Josh's phone it shows her world, and what's hers changes only from
// her side. Her gallery, her drawer and her corner, from both phones.
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
globalThis.fetch = () => {
  throw new Error("External network is disabled in these tests");
};

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
app.onError((error) => {
  throw error;
});

function request(route, { method = "GET", cookie, body, viewAs } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  rewritten.searchParams.set("route", original.pathname.slice(5));
  return handlers[method](
    new Request(rewritten, {
      method,
      headers: { "x-kw": "1", ...(viewAs ? { "x-view-as": viewAs } : {}), ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
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

try {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");
  const art = (name) => ({ url: `/api/uploads/media?path=art%2F${name}.png`, prompt: name, width: 400, height: 400 });

  await test("Josh trying the sketchbook keeps nothing in her gallery; she keeps hers, and only she deletes them", async () => {
    const tried = await json(await request("me/artworks", { method: "POST", cookie: josh, body: art("josh-try") }));
    assert.equal(tried.preview, true, "His keep works, as a try");
    const mine = await json(await request("me/artworks", { method: "POST", cookie: her, body: art("her-doodle") }));
    assert.equal(mine.preview, undefined);
    const seenByHim = (await json(await request("me/artworks", { cookie: josh }))).artworks.map((a) => a.prompt);
    assert.deepEqual(seenByHim, ["her-doodle"], "His phone shows her gallery, without his try");
    assert.equal((await json(await request(`me/artworks/${mine.id}`, { method: "DELETE", cookie: josh }), 403)).error, "hers");
    assert.equal((await json(await request("me/artworks", { cookie: her }))).artworks.length, 1, "Her doodle is still there");
    await json(await request(`me/artworks/${mine.id}`, { method: "DELETE", cookie: her }));
    assert.equal((await json(await request("me/artworks", { cookie: her }))).artworks.length, 0);
  });

  await test("Josh peeking in the daily drawer leaves it closed for her and her sticker book untouched", async () => {
    const peek = await json(await request("me/drawer", { method: "POST", cookie: josh, body: {} }));
    assert.equal(peek.preview, true);
    assert.equal((await db.select().from(schema.drawers)).length, 0, "Still closed for her");
    const opened = await json(await request("me/drawer", { method: "POST", cookie: her, body: {} }));
    assert.equal(opened.firstTime, true, "She still gets to open it first");
  });

  await test("Her corner on his phone is hers, read-only; the preview still reads; her own writes work", async () => {
    await json(await request("me/mood", { method: "PUT", cookie: her, body: { mood: "rose", energy: 4, feeling: "playful", address: "she/they" } }));
    for (const cookie of [her, josh]) assert.equal((await json(await request("me/mood", { cookie }))).current.feeling.key, "playful");
    assert.equal((await json(await request("me/mood", { cookie: josh }))).readOnly, true);
    assert.equal((await json(await request("me/mood", { cookie: josh, viewAs: "kiriya" }))).current.key, "rose", "See it as kiriya still reads");
    assert.equal((await request("me/mood", { method: "PUT", cookie: josh, viewAs: "kiriya", body: { mood: "night" } })).status, 403);
    assert.equal((await json(await request("me/mood", { method: "PUT", cookie: josh, body: { mood: "night", energy: 0 } }), 403)).error, "hers");
    await json(await request("me/mood", { method: "PUT", cookie: her, body: { mood: "night", energy: 1 } }));
    assert.equal((await json(await request("me/mood", { cookie: josh }))).current.key, "night", "Her update reaches his phone");
  });
} finally {
  await client.close();
}
