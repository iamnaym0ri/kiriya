// "See it as kiriya" (src/lib/viewAs.js): Josh's session, answered as hers, read-only.
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

function request(route, { method = "GET", cookie, body, viewAs } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  // Vercel also echoes the rewrite's named parameter as its own query value.
  rewritten.searchParams.set("route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: { "x-kw": "1", ...(viewAs ? { "x-view-as": viewAs } : {}), ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
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
  await request("me/chat/messages", { method: "POST", cookie: her, body: { clientId: randomUUID(), kind: "text", body: "hi from her" } });

  await test("Previewing, Josh's reads come back exactly as hers", async () => {
    const his = await json(await request("me/chat/messages", { cookie: josh }));
    const asHer = await json(await request("me/chat/messages", { cookie: josh, viewAs: "kiriya" }));
    assert.equal(his.me, "admin");
    assert.equal(asHer.me, "kiriya");
    assert.equal(asHer.live, false);
    assert.equal(asHer.messages.length, 1);
    assert.deepEqual(await json(await request("me", { cookie: josh, viewAs: "kiriya" })), { role: "kiriya" });
  });

  await test("Nothing can change while previewing", async () => {
    const sent = await request("me/chat/messages", { method: "POST", cookie: josh, viewAs: "kiriya", body: { clientId: randomUUID(), kind: "text", body: "sneaky" } });
    assert.equal(sent.status, 403);
    assert.equal((await sent.json()).error, "preview");
    assert.equal((await request("me/chat/realtime", { cookie: josh, viewAs: "kiriya" })).status, 403);
    assert.equal((await json(await request("me/chat/messages", { cookie: her }))).messages.length, 1);
  });

  await test("Only Josh can preview, and his own desk still answers as him", async () => {
    assert.equal((await json(await request("me", { cookie: her, viewAs: "kiriya" }))).role, "kiriya");
    assert.equal((await request("me/chat/messages", { method: "POST", cookie: her, viewAs: "kiriya", body: { clientId: randomUUID(), kind: "text", body: "still me" } })).status, 201);
    assert.equal((await request("admin/app-test", { cookie: josh, viewAs: "kiriya" })).status, 200);
    assert.equal((await request("me/chat/messages")).status, 401);
  });
} finally {
  await client.close();
}
