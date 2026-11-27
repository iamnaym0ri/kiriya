// The events & merch API (docs/refactor/EVENTS-API.md) through the real app, against the sample
// events, in production mode with an in-memory database and no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "OPENAI_API_KEY", "APNS_KEY", "ANTHROPIC_API_KEY", "EVENTS_PUSH_AUDIENCE"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.CRON_SECRET = randomBytes(16).toString("hex");
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
const { seedFixtures, fixturesAllowed } = await import("../server/lib/events/fixtures.js");

function rawRequest(route, { method = "POST", body, headers = {} } = {}) {
  const rewritten = new URL("/api", "https://kiriya.love");
  rewritten.searchParams.set("__route", route);
  return handlers[method](new Request(rewritten, { method, headers, body }));
}
function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](new Request(rewritten, {
    method,
    headers: { "x-kw": "1", ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
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

try {
  assert.equal(fixturesAllowed(), false, "production never seeds samples");
  await seedFixtures(db, { force: true });
  const her = await unlock("kiriya");
  const josh = await unlock("admin");
  const afa = "fx-afa-singapore-2026";

  await test("Only the two of them can read events; the calendar file needs no session", async () => {
    assert.equal((await request("events")).status, 401);
    assert.ok([401, 403].includes((await request(`admin/events/spend`, { cookie: her })).status), "admin only");
    const ics = await request(`events/${afa}/calendar.ics`);
    assert.equal(ics.status, 200);
    assert.match(ics.headers.get("content-type"), /^text\/calendar/);
    const text = await ics.text();
    assert.match(text, /BEGIN:VCALENDAR/);
    // 10:00 in Singapore, written either with its time zone or in UTC (shared/eventCalendar.js uses UTC).
    assert.match(text, /DTSTART(;TZID=Asia\/Singapore:20261127T100000|:20261127T020000Z)/);
    assert.doesNotMatch(text, /sample cosplay guest|S\$18/, "public facts only");
    assert.equal((await request("events/nope/calendar.ics")).status, 404);
    assert.equal((await request("events/fixture-art/afa.svg")).status, 404, "sample art is dev-only");
  });

  await test("The list: Singapore events with filters and her marks; past events apart", async () => {
    const list = await json(await request("events", { cookie: her }));
    assert.ok(list.events.length >= 10);
    assert.ok(!list.events.some((e) => e.status === "past"));
    const first = list.events.find((e) => e.id === afa);
    for (const key of ["kind", "tagline", "startsOn", "endsOn", "startsAt", "datesTbc", "dateLabel", "venueName", "hers", "big", "fandoms", "tickets", "merch", "status", "phase", "countdown", "updatedAt", "saved", "lastLookedAt", "unseenUpdates"])
      assert.ok(key in first, key);
    assert.ok(list.filters.kinds.some((k) => k.id === "con"));
    assert.deepEqual(list.me.saved, { events: [], merch: [] });
    const popups = await json(await request("events?kind=popup,cafe", { cookie: her }));
    assert.ok(popups.events.every((e) => ["popup", "cafe"].includes(e.kind)));
    const past = await json(await request("events?when=past", { cookie: her }));
    assert.deepEqual(past.events.map((e) => e.id), ["fx-apothecary-exhibition-2026"]);
    const miku = await json(await request("events?fandom=apothecary", { cookie: her }));
    assert.ok(miku.events.every((e) => e.fandoms.includes("apothecary")));
  });

  await test("One event: dossier, seven-stage timeline, update log and sources, every claim with a source id", async () => {
    const { event } = await json(await request(`events/${encodeURIComponent(afa)}`, { cookie: her }));
    assert.equal(event.dossier.about.summary.sourceId, "s1");
    assert.equal(event.dossier.days.length, 3);
    assert.equal(event.dossier.days[0].startsAt, "2026-11-27T10:00:00+08:00");
    assert.equal(event.dossier.tickets.tiers[0].priceLabel, "S$18");
    assert.equal(event.dossier.merch[0].id, `${afa}~m-afa-miku-acrylic`);
    assert.deepEqual(event.timeline.map((s) => s.stage), ["announced", "guests", "tickets", "merch", "schedule", "day", "after"]);
    assert.ok(event.updates.length >= 3);
    assert.ok(event.updates.every((u) => "sourceId" in u && typeof u.unseen === "boolean"));
    assert.ok(event.sources.every((s) => s.id && s.url.startsWith("https://")));
    assert.ok(event.weather.credit);
    assert.equal(event.admin, undefined, "no admin block for her");
    const ids = new Set(event.sources.map((s) => s.id));
    const walk = (v) => (Array.isArray(v) ? v.forEach(walk) : v && typeof v === "object" ? (Array.isArray(v.sourceIds) && v.sourceIds.forEach((id) => assert.ok(ids.has(id), id)), Object.values(v).forEach(walk)) : null);
    walk(event.dossier);
    const asJosh = await json(await request(`events/${afa}`, { cookie: josh }));
    assert.equal(asJosh.event.admin.origin, "fixture");
    assert.equal((await request("events/missing", { cookie: her })).status, 404);
  });

  await test("Saves and seen marks are hers; Josh's taps are previews", async () => {
    const preview = await json(await request(`events/${afa}/save`, { method: "POST", cookie: josh, body: { saved: true } }));
    assert.equal(preview.preview, true);
    assert.deepEqual((await json(await request("events/saved", { cookie: her }))).events, []);
    await json(await request(`events/${afa}/save`, { method: "POST", cookie: her, body: { saved: true } }));
    const merchId = `${afa}~m-afa-miku-acrylic`;
    await json(await request(`events/merch/${encodeURIComponent(merchId)}/save`, { method: "POST", cookie: her, body: {} }));
    const saved = await json(await request("events/saved", { cookie: josh }));
    assert.deepEqual([saved.events.map((e) => e.id), saved.merch.map((m) => m.id)], [[afa], [merchId]], "Josh sees what she saved");
    assert.equal((await request("events/merch/nope~x/save", { method: "POST", cookie: her, body: {} })).status, 404);

    const before = (await json(await request(`events/${afa}`, { cookie: her }))).event;
    assert.ok(before.unseenUpdates > 0);
    assert.equal((await json(await request("events/seen", { method: "POST", cookie: josh, body: { eventId: afa } }))).preview, true);
    assert.ok((await json(await request(`events/${afa}`, { cookie: her }))).event.unseenUpdates > 0, "Josh looking doesn't count");
    await json(await request("events/seen", { method: "POST", cookie: her, body: { eventId: afa } }));
    const after = (await json(await request(`events/${afa}`, { cookie: her }))).event;
    assert.equal(after.unseenUpdates, 0);
    assert.ok(after.lastLookedAt);
    await json(await request("events/seen", { method: "POST", cookie: her, body: {} }));
    const home = await json(await request("events/home", { cookie: her }));
    assert.equal(home.counts.unseenUpdates, 0);
    assert.equal(home.counts.saved, 2);
  });

  await test("Home block and merch shelf", async () => {
    const home = await json(await request("events/home", { cookie: her }));
    assert.ok(home.onNow.some((e) => e.id === afa));
    assert.ok(home.next && home.next.status === "upcoming");
    assert.ok(home.merch.length <= 6);
    assert.ok(home.merch[0].image, "pieces with a picture lead");
    assert.ok(home.merch.every((m) => m.status !== "sold_out"));
    const merch = await json(await request("events/merch", { cookie: her }));
    assert.ok(merch.merch.every((m) => m.event && m.id.includes("~")));
    assert.ok(merch.merch.find((m) => m.id.endsWith("m-afa-miku-acrylic")).saved);
  });

  await test("Admin: paste a link, follow its status, see the spend ledger and worker status, hide an event", async () => {
    assert.equal((await request("admin/events/links", { method: "POST", cookie: josh, body: { url: "not a link" } })).status, 400);
    const link = await json(await request("admin/events/links", { method: "POST", cookie: josh, body: { url: "http://www.instagram.com/p/abc/?igsh=xyz&utm_source=ig" } }), 201);
    assert.equal(link.url, "https://www.instagram.com/p/abc/");
    assert.equal(link.status, "queued");
    assert.equal(link.eventId, null);
    const again = await json(await request("admin/events/links", { method: "POST", cookie: josh, body: { url: "https://www.instagram.com/p/abc/" } }));
    assert.equal(again.id, link.id, "the same link in the same hour is one entry");
    assert.equal((await json(await request(`admin/events/links/${link.id}`, { cookie: josh }))).status, "queued");
    assert.equal((await json(await request("admin/events/links", { cookie: josh }))).links.length, 1);
    const ledger = await json(await request("admin/events/spend", { cookie: josh }));
    assert.equal(ledger.ceilingUsd, 20);
    assert.equal(ledger.spentUsd, 0);
    assert.equal((await request("admin/events/spend", { method: "PUT", cookie: josh, body: { ceilingUsd: 25 } })).status, 400, "never above 20");
    assert.equal((await json(await request("admin/events/spend", { method: "PUT", cookie: josh, body: { ceilingUsd: 12 } }))).ceilingUsd, 12);
    const status = await json(await request("admin/events/status", { cookie: josh }));
    assert.equal(status.worker.healthy, false);
    assert.equal(status.queue.queued, 1);
    await json(await request(`admin/events/fx-jjk-concert`, { method: "PATCH", cookie: josh, body: { hidden: true } }));
    assert.equal((await request("events/fx-jjk-concert", { cookie: her })).status, 404);
    assert.ok(!(await json(await request("events", { cookie: her }))).events.some((e) => e.id === "fx-jjk-concert"));
    const refresh = await json(await request(`admin/events/${afa}/refresh`, { method: "POST", cookie: josh, body: {} }), 202);
    assert.equal(refresh.eventId, afa);
  });


  await test("Ids never die: an old id opens the event it became; saves and the calendar follow; merged and overseas rows stay off the list", async () => {
    const store = await import("../server/lib/events/store.js");
    const [row] = await db.select().from(schema.events).where(eq(schema.events.id, afa));
    await db.insert(schema.events).values({ ...row, id: "fx-afa-older-id", firstSeenAt: new Date("2026-11-20T00:00:00Z") });
    await store.mergeEvent(db, "fx-afa-older-id", afa, { reason: "test" });
    const moved = await json(await request("events/fx-afa-older-id", { cookie: her }));
    assert.equal(moved.event.id, afa);
    assert.equal(moved.redirectedFrom, "fx-afa-older-id");
    assert.equal((await json(await request("events/fx-afa-older-id/save", { method: "POST", cookie: her, body: { saved: true } }))).id, afa);
    assert.equal((await request("events/fx-afa-older-id/calendar.ics")).status, 200);
    const piece = await json(await request(`events/merch/${encodeURIComponent("fx-afa-older-id~m-afa-tote")}`, { cookie: her }));
    assert.equal(piece.merch.id, `${afa}~m-afa-tote`);
    assert.equal(piece.redirectedFrom, "fx-afa-older-id~m-afa-tote");
    await db.insert(schema.events).values({ id: "comiket:de67209c", name: "Comic Market", tier: "regional", url: "https://www.comiket.co.jp/", status: "out_of_scope" });
    assert.equal((await request("events/comiket%3Ade67209c", { cookie: her })).status, 404);
    const all = await json(await request("events?when=all", { cookie: her }));
    assert.ok(!all.events.some((e) => ["fx-afa-older-id", "comiket:de67209c"].includes(e.id)));
    assert.equal(all.events.filter((e) => e.id === afa).length, 1);
    // Cancelled: still on her list, marked, until its day has passed.
    await db.update(schema.events).set({ status: "cancelled" }).where(eq(schema.events.id, "fx-doumini-2026"));
    const upcoming = await json(await request("events", { cookie: her }));
    assert.equal(upcoming.events.find((e) => e.id === "fx-doumini-2026")?.status, "cancelled");
    await db.update(schema.events).set({ status: "upcoming" }).where(eq(schema.events.id, "fx-doumini-2026"));
  });

  await test("A merch piece on its own: pictures, price, kind, and where it is", async () => {
    const id = `${afa}~m-afa-miku-acrylic`;
    const { merch } = await json(await request(`events/merch/${encodeURIComponent(id)}`, { cookie: her }));
    assert.equal(merch.name, "AFA × Hatsune Miku acrylic stand (sample)");
    assert.equal(merch.images.length, 3);
    assert.equal(merch.image, merch.images[0]);
    assert.equal(merch.priceLabel, "S$25");
    assert.equal(merch.kind, "exclusive");
    assert.equal(merch.where, "official merch booth, hall 402");
    assert.equal(merch.event.id, afa);
    assert.equal(merch.event.venue.name, "Suntec Singapore Convention & Exhibition Centre");
    assert.ok(merch.event.dateLabel && merch.event.tickets.status);
    assert.ok(merch.more.length >= 4 && merch.more.every((m) => m.id !== id && m.id.startsWith(`${afa}~`)));
    assert.ok(merch.sources.every((s) => s.url.startsWith("https://")));
    const list = await json(await request("events/merch", { cookie: her }));
    assert.ok(list.merch.filter((m) => m.images.length).length >= 4, "pictures on the merch list");
    assert.ok(list.merch.every((m) => m.images.every((u) => /^\/api\/(uploads|events\/fixture-art)\//.test(u))), "only our own copies are ever shown");
    assert.equal((await request(`events/merch/${encodeURIComponent(`${afa}~m-nope`)}`, { cookie: her })).status, 404);
    assert.equal((await request(`events/merch/${encodeURIComponent(id)}`)).status, 401);
  });

  await test("Pictures from the worker: CRON_SECRET only, pictures only, stored with the other private uploads", async () => {
    const auth = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]), Buffer.alloc(40, 1)]);
    assert.equal((await rawRequest("jobs/events/images", { body: jpeg, headers: { "content-type": "image/jpeg" } })).status, 401);
    assert.equal((await rawRequest("jobs/events/images", { body: Buffer.from("hello"), headers: { ...auth, "content-type": "text/plain" } })).status, 415);
    assert.equal((await rawRequest("jobs/events/images", { body: Buffer.from("<svg/> pretending to be a jpeg"), headers: { ...auth, "content-type": "image/jpeg" } })).status, 415);
    // Production with no Blob store connected (as in these tests) says so instead of pretending.
    const none = await rawRequest("jobs/events/images", { body: jpeg, headers: { ...auth, "content-type": "image/jpeg" } });
    assert.equal(none.status, 503);
    assert.equal((await none.json()).error, "not_configured");
    const { storeImageBytes } = await import("../server/lib/events/images.js");
    const puts = [];
    const stored = await storeImageBytes(jpeg, { blob: { put: async (p, b, t) => puts.push([p, t]) } });
    assert.match(stored.url, /^\/api\/uploads\/media\?path=events%2F[0-9a-f]{32}\.jpg$/);
    assert.deepEqual(puts[0][1], "image/jpeg");
    assert.equal((await storeImageBytes(jpeg, { blob: { put: async () => puts.push(1) } })).url, stored.url, "the same picture is stored once, under one name");
  });

  await test("Push delivery is for the worker only (CRON_SECRET)", async () => {
    assert.equal((await request("jobs/events/deliver", { method: "POST", body: {} })).status, 401);
    const ok = await json(await request("jobs/events/deliver", { method: "POST", body: {}, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    assert.equal(ok.audience, "admin");
  });
} finally {
  await client.close();
}
