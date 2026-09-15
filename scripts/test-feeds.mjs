import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq, sql } from "drizzle-orm";
import { hashPassphrase } from "../server/auth/passphrase.js";

// No dotenv, no real database URL, no real API credential, no shared .data/pglite directory.
for (const name of [
  "DATABASE_URL",
  "kData_DATABASE_URL",
  "OPENAI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "VERCEL",
  "VERCEL_ENV",
  "FEED_MODEL_PRICES_JSON",
])
  delete process.env[name];
process.env.NODE_ENV = "test";
process.env.FEEDS_ENABLED = "false";
process.env.FEEDS_FIXTURE_MODE = "true";
process.env.KIRIYA_TZ = "Asia/Singapore";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.CRON_SECRET = randomBytes(32).toString("hex");
const phrase = {
  kiriya: randomBytes(24).toString("hex"),
  admin: randomBytes(24).toString("hex"),
};
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrase.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrase.admin);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("External fetch disabled in feed tests");
};
const s = await import("../server/db/schema.js");
const client = new PGlite(),
  db = drizzle({ client, schema: s });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const { env } = await import("../server/env.js");
const { feedConfig, STAGES, FeedError } = await import(
  "../server/feeds/config.js"
);
const { sourceRegistry, validateAdapterItem } = await import(
  "../server/feeds/sources/registry.js"
);
const {
  createBuild,
  ingestItem,
  eligibleItems,
  hideItems,
  pruneFeeds,
  rows,
  blockItemOrigin,
  setSafety,
} = await import("../server/feeds/repository.js");
const { claimStage, finishStage, checkpointRun, runStage, catchUp } =
  await import("../server/feeds/jobs.js");
const { normalizeItem, canonicalUrl } = await import(
  "../server/feeds/normalize.js"
);
const { readFeed, markSeen } = await import("../server/feeds/editions.js");
const { resolveTaste, getTaste, putTaste, TasteOverridesSchema } = await import(
  "../server/feeds/taste.js"
);
const { createFixtureProvider, createProvider } = await import(
  "../server/feeds/provider.js"
);
const { checkItem } = await import("../server/feeds/moderate.js");
const { inspectBatch, templateBlurb, writeBlurbs } = await import(
  "../server/feeds/writer.js"
);
const { assembleSection } = await import("../server/feeds/score.js");
const { fetchVocaDb } = await import("../server/feeds/sources/vocadb.js");
const { FeedTuningSchema, FEED_TUNING_DEFAULTS, getFeedSettings } =
  await import("../server/feeds/settings.js");
const { sourceHttp, allowedUrl, publicAddress } = await import(
  "../server/feeds/http.js"
);
const { reserveRequest, settleRequest, DEFAULT_PRICES, requestEstimate } =
  await import("../server/feeds/usage.js");
const { ensureSave, reserveCopy, finishCopy, SAVE_LIMITS } = await import(
  "../server/feeds/saves.js"
);
const { localDay, zonedInstant } = await import("../server/lib/time.js");
const { GET, POST, PUT } = await import("../api/index.js");
const tmp = await mkdtemp(path.join(tmpdir(), "kiriya-feed-upgrade-"));

function request(
  route,
  { method = "GET", cookie, body, csrf = true, headers = {} } = {},
) {
  const u = new URL("/api", "https://kiriya.love");
  u.searchParams.set("__route", route);
  return { GET, POST, PUT }[method](
    new Request(u, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { "x-kw": "1" } : {}),
        ...headers,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
async function login(role) {
  const r = await request("session/unlock", {
    method: "POST",
    body: { passphrase: phrase[role] },
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
async function fixtureItem(id, extra = {}) {
  const [entry] = await sourceRegistry();
  const { items } = await entry.fetch({
    day: localDay(),
    limits: { items: 8 },
  });
  return normalizeItem({
    ...items[0],
    nativeId: id,
    url: `https://fixtures.kiriya.invalid/item/${id}`,
    ...extra,
  });
}
async function approved(id, extra = {}) {
  const raw = await fixtureItem(id, extra);
  const key = await ingestItem(db, raw, { fixture: true });
  await db
    .update(s.feedItems)
    .set({ safetyStatus: "approved" })
    .where(eq(s.feedItems.id, key));
  return (
    await db.select().from(s.feedItems).where(eq(s.feedItems.id, key))
  )[0];
}
let cookie, admin, build;

try {
  await test("Additive tracked migrations preserve existing personal and auth data and can run twice", async () => {
    await mkdir(path.join(tmp, "meta"));
    const journal = JSON.parse(
      await readFile("server/db/migrations/meta/_journal.json", "utf8"),
    );
    await writeFile(
      path.join(tmp, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
    );
    await writeFile(
      path.join(tmp, "0000_init.sql"),
      await readFile("server/db/migrations/0000_init.sql"),
    );
    await migrate(db, { migrationsFolder: tmp });
    await db.insert(s.letters).values({
      kind: "note",
      author: "giver",
      title: "keep letter",
      body: "synthetic migration fixture",
    });
    await db
      .insert(s.artworks)
      .values({ url: "/api/uploads/file/art-0123456789abcdef.png" });
    await db
      .insert(s.songs)
      .values({ kind: "link", url: "https://example.invalid/test-song" });
    await db.insert(s.cosplayProjects).values({ character: "keep cosplay" });
    await db
      .insert(s.settings)
      .values({ key: "keep-setting", value: { preserved: true } });
    await db
      .insert(s.unlockAttempts)
      .values({ ipHash: "synthetic", ok: true, role: "kiriya" });
    await migrate(db, { migrationsFolder: "server/db/migrations" });
    await migrate(db, { migrationsFolder: "server/db/migrations" });
    for (const table of [
      s.letters,
      s.artworks,
      s.songs,
      s.cosplayProjects,
      s.settings,
      s.unlockAttempts,
    ])
      assert.equal((await db.select().from(table)).length, 1);
    assert.equal(
      (await client.query("select * from drizzle.__drizzle_migrations")).rows
        .length,
      journal.entries.length,
    );
  });

  await test("Privacy, role and CSRF boundaries protect feeds, preferences, stage runs and save media", async () => {
    for (const route of [
      "me/feed/maomao",
      "me/faves",
      "admin/feeds/status",
      "jobs/feeds/check",
    ])
      assert.equal((await request(route)).status, 401);
    assert.equal(
      (
        await request("me/feed/seen", {
          method: "POST",
          body: { revision: "x", ids: ["x"] },
          csrf: false,
        })
      ).status,
      400,
    );
    cookie = await login("kiriya");
    admin = await login("admin");
    assert.equal((await request("admin/feeds/status", { cookie })).status, 401);
    const status = await request("admin/feeds/status", { cookie: admin });
    assert.equal(status.status, 200);
    assert.match(status.headers.get("cache-control"), /private.*no-store/);
    assert.equal(
      (await request("uploads/media?path=saves/test.png")).status,
      404,
    ); // canonical query tested below
    const media = await GET(
      new Request(
        "https://kiriya.love/api?__route=uploads/media&path=saves/test.png",
      ),
    );
    assert.equal(media.status, 401);
    const disabled = await request("jobs/feeds/check", {
      headers: { authorization: `Bearer ${env.cronSecret}` },
    });
    assert.equal((await disabled.json()).outcome, "disabled");
  });

  await test("Taste keeps the approved preferences, rejects malformed overrides and freezes a build snapshot", async () => {
    const before = await getTaste(db);
    assert.equal(before.taste.characters.maomao, 1);
    assert.equal(before.taste.spoilers, "none");
    assert.equal(before.taste.sekai.server, "global");
    assert.equal(before.taste.voicebanks["kagamine rin"], 0.8);
    assert.equal(before.taste.merch.maxSgd, 100);
    assert.equal(
      resolveTaste({ characters: { maomao: 0.4 } }).taste.characters[
        "hatsune miku"
      ],
      1,
    );
    assert.equal(
      FeedTuningSchema.safeParse({
        ...FEED_TUNING_DEFAULTS,
        thresholds: { ...FEED_TUNING_DEFAULTS.thresholds, sexual: 1 },
      }).success,
      false,
    );
    assert.equal((await getFeedSettings(db)).invalid, false);
    assert.equal(
      TasteOverridesSchema.safeParse({ offLimits: [], unknown: "no" }).success,
      false,
    );
    assert(
      resolveTaste({ offLimits: [] }).taste.offLimits.includes("self-harm"),
    );
    assert.equal(
      resolveTaste({ characters: { maomao: 99 } }).invalidOverrides,
      true,
    );
    build = await createBuild(db, localDay(), { mode: "fixture" });
    const next = await putTaste(
      db,
      { cosplayWishlist: ["frieren"], offLimits: ["clowns"] },
      before.revision,
    );
    assert.notEqual(next.revision, before.revision);
    assert(!build.taste.offLimits.includes("clowns"));
    await assert.rejects(
      () => putTaste(db, {}, before.revision),
      (e) => e.code === "taste_changed",
    );
  });

  await test("Lease claims serialize concurrent workers, respect dependencies and reject stale completion", async () => {
    assert.equal(
      (await claimStage(db, build, "publish")).outcome,
      "waiting_for_dependency",
    );
    const attempts = await Promise.all([
      claimStage(db, build, "fetch-a"),
      claimStage(db, build, "fetch-a"),
    ]);
    const old = attempts.find((r) => r.outcome === "claimed");
    assert(old);
    assert.equal(attempts.filter((r) => r.outcome === "claimed").length, 1);
    await checkpointRun(db, old, {
      sourceIndex: 0,
      cursor: null,
      testCursor: 3,
    });
    await db
      .update(s.feedRuns)
      .set({ leaseUntil: new Date(Date.now() - 1) })
      .where(
        and(eq(s.feedRuns.buildId, build.id), eq(s.feedRuns.stage, "fetch-a")),
      );
    const next = await claimStage(db, build, "fetch-a");
    assert.equal(next.outcome, "claimed");
    assert.equal(next.checkpoint.testCursor, 3);
    assert.equal(await finishStage(db, old), false);
    assert.equal(
      await finishStage(db, next, {
        status: "failed",
        error: "retryable_test",
      }),
      true,
    );
    const retry = await claimStage(db, build, "fetch-a");
    assert.equal(retry.outcome, "claimed");
    await finishStage(db, retry, { status: "pending" });
  });

  await test("Fixture collection, checks, writing, staged preview and publication work with checkpoint continuation", async () => {
    let result = await runStage(db, {
      buildId: build.id,
      stage: "fetch-a",
      workLimit: 2,
    });
    assert.equal(result.outcome, "checkpointed");
    for (let i = 0; i < 20 && result.outcome === "checkpointed"; i++)
      result = await runStage(db, {
        buildId: build.id,
        stage: "fetch-a",
        workLimit: 2,
      });
    assert.equal(result.outcome, "completed");
    assert.equal((await db.select().from(s.feedItems)).length, 25);
    assert.equal(
      (await runStage(db, { buildId: build.id, stage: "fetch-a" })).outcome,
      "completed",
    );
    await runStage(db, { buildId: build.id, stage: "fetch-b" });
    result = await runStage(db, {
      buildId: build.id,
      stage: "check",
      workLimit: 3,
    });
    for (let i = 0; i < 20 && result.outcome === "checkpointed"; i++)
      result = await runStage(db, {
        buildId: build.id,
        stage: "check",
        workLimit: 3,
      });
    assert.equal(result.outcome, "completed");
    assert.equal(
      (
        await db
          .select()
          .from(s.feedItems)
          .where(eq(s.feedItems.safetyStatus, "rejected"))
      ).length,
      5,
    );
    assert.equal(
      (await runStage(db, { buildId: build.id, stage: "plan-write" })).outcome,
      "completed",
    );
    assert.equal(
      (await readFeed(db, "maomao", { fixture: true })).revision,
      null,
    );
    const preview = await request(`admin/feeds/preview/${build.id}/maomao`, {
      cookie: admin,
    });
    assert.equal(preview.status, 200);
    assert((await preview.json()).slots.length > 0);
    assert.equal((await db.select().from(s.feedSeen)).length, 0);
    assert.equal(
      (await runStage(db, { buildId: build.id, stage: "publish" })).outcome,
      "completed",
    );
    const feed = await readFeed(db, "maomao", { fixture: true });
    // Full planner (planners.js): four approved text-only maomao notes, no visuals/memes/merch in
    // the fixture, so every category reallocates to notes. Nothing is invented to fill 12 slots.
    assert.equal(feed.slots.length + feed.reserve.length, 4);
    assert(feed.slots.every((slot) => slot.type === "note"));
    assert.equal(feed.plan.allocation, "maomao-v1");
    assert(
      feed.slots.every(
        (slot) =>
          slot.primary.fixture && slot.primary.signature === "✦ kiriya.love",
      ),
    );
  });

  await test("Seen/hide mutations validate edition IDs; admin previews do not alter history; old editions filter hides", async () => {
    const feed = await readFeed(db, "maomao", { fixture: true }),
      id = feed.slots[0].primaryId;
    await assert.rejects(
      () =>
        markSeen(
          db,
          { revision: feed.revision, ids: ["unserved:item"] },
          "kiriya",
        ),
      (e) => e.code === "item_not_in_edition",
    );
    await markSeen(db, { revision: feed.revision, ids: [id] }, "admin");
    assert.equal((await db.select().from(s.feedSeen)).length, 0);
    await markSeen(db, { revision: feed.revision, ids: [id] }, "kiriya");
    let next = await readFeed(db, "maomao", { fixture: true });
    assert.equal(next.seenEarlier.length, 1);
    assert(!next.slots.some((s) => s.primaryId === id));
    await hideItems(db, [id]);
    next = await readFeed(db, "maomao", { fixture: true });
    assert(
      ![...next.slots, ...next.seenEarlier].some((s) => s.primaryId === id),
    );
    assert.equal((await request("me/feed/maomao", { cookie })).status, 200);
  });

  await test("Existing VocaDB adapter satisfies the contract and one failed source cannot erase another", async () => {
    const [vocadb] = await sourceRegistry({ fixtures: false });
    const result = await fetchVocaDb({
      limits: { items: 8 },
      http: {
        json: async () => [
          {
            id: 123,
            name: "synthetic song",
            artistString: "Hatsune Miku, test producer",
            ratingScore: 500,
            pvs: [
              {
                service: "Youtube",
                pvType: "Original",
                pvId: "abcdefghijk",
                disabled: false,
              },
            ],
          },
        ],
      },
    });
    assert.equal(result.done, true);
    const song = validateAdapterItem(result.items[0], vocadb);
    assert.equal(song.source, "vocadb");
    assert.equal(song.media[0].type, "youtube");
    assert.equal(vocadb.copyPolicy, "link_only");
    const [fixture] = await sourceRegistry();
    const raw = (await fixture.fetch({ day: localDay(), limits: { items: 1 } }))
      .items[0];
    delete process.env.KIRIYA_TEST_MISSING_CREDENTIAL;
    const registry = [
      {
        ...fixture,
        id: "missing-test",
        requiredCredentials: ["KIRIYA_TEST_MISSING_CREDENTIAL"],
      },
      {
        ...fixture,
        id: "blocked-test",
        fetch: async () => {
          throw new FeedError("blocked");
        },
      },
      {
        ...fixture,
        id: "broken-test",
        fetch: async () => {
          throw new Error("synthetic transport failure");
        },
      },
      {
        ...fixture,
        fetch: async () => ({
          items: [
            {
              ...raw,
              nativeId: "isolation-success",
              url: "https://fixtures.kiriya.invalid/isolation-success",
            },
          ],
          cursor: null,
          done: true,
        }),
      },
    ];
    const sourceBuild = await createBuild(db, "2026-09-22", {
      mode: "fixture",
    });
    const collected = await runStage(db, {
      buildId: sourceBuild.id,
      stage: "fetch-a",
      registry,
    });
    assert.equal(collected.outcome, "completed");
    const health = await db.select().from(s.feedSourceHealth);
    for (const [id, status] of [
      ["missing-test", "not_configured"],
      ["blocked-test", "blocked"],
      ["broken-test", "failed"],
      ["fixture", "ok"],
    ])
      assert.equal(health.find((row) => row.source === id).status, status);
    assert.equal(
      (
        await db
          .select()
          .from(s.feedItems)
          .where(eq(s.feedItems.nativeId, "isolation-success"))
      ).length,
      1,
    );
  });

  await test("Recognized reposts dedupe independently by URL/media and exclusions/saved snapshots survive pruning", async () => {
    const first = await approved("identity-one", {
      mediaIdentity: "verified-image-sha256-one",
    });
    const second = await fixtureItem("identity-two", {
      mediaIdentity: "verified-image-sha256-one",
      sections: ["music"],
    });
    assert.equal(await ingestItem(db, second, { fixture: true }), first.id);
    const [entry] = await sourceRegistry();
    const saved = await ensureSave(db, first, entry);
    await hideItems(db, [first.id]);
    await db
      .update(s.feedItems)
      .set({ fetchedAt: new Date(Date.now() - 100 * 86400000) })
      .where(eq(s.feedItems.id, first.id));
    await pruneFeeds(db);
    assert.equal(
      (await db.select().from(s.feedItems).where(eq(s.feedItems.id, first.id)))
        .length,
      0,
    );
    assert.equal(
      (await db.select().from(s.saves).where(eq(s.saves.id, saved.id)))[0]
        .snapshot.facts.excerpts[0],
      first.facts.excerpts[0],
    );
    await ingestItem(
      db,
      await fixtureItem("identity-three", {
        mediaIdentity: "verified-image-sha256-one",
      }),
      { fixture: true },
    );
    await db
      .update(s.feedItems)
      .set({ safetyStatus: "approved" })
      .where(eq(s.feedItems.id, first.id));
    assert(
      !(await eligibleItems(db, { fixture: true })).some(
        (i) => i.id === first.id,
      ),
    );
    assert.equal(
      canonicalUrl("https://example.com/post?utm_source=x&b=2&a=1#hi"),
      "https://example.com/post?a=1&b=2",
    );
  });

  await test("Source, moderation and vision failures withhold content; a poster never approves motion", async () => {
    const good = await approved("safety-good");
    const fake = createFixtureProvider();
    assert.equal((await checkItem(good, fake)).status, "approved");
    assert.equal(
      (await checkItem({ ...good, title: "AI-generated synthetic art" }, fake))
        .status,
      "rejected",
    );
    const inconsistent = await fake.moderate();
    inconsistent.categories.sexual = true;
    assert.equal(
      (await checkItem(good, { moderate: async () => inconsistent })).status,
      "rejected",
    );
    assert.equal(
      (
        await checkItem(
          {
            ...good,
            safety: {
              source: { ...good.safety.source, sourceTags: ["ai-assisted"] },
            },
          },
          fake,
        )
      ).status,
      "rejected",
    );
    for (const bad of [
      null,
      {},
      { flagged: false, categories: {}, category_scores: {} },
    ])
      assert.equal(
        (await checkItem(good, { moderate: async () => bad })).status,
        "pending",
      );
    assert.equal(
      (
        await checkItem(good, {
          moderate: async () => {
            throw new Error("offline");
          },
        })
      ).status,
      "pending",
    );
    const visual = {
      ...good,
      media: [
        { type: "image", url: "https://fixtures.kiriya.invalid/image.png" },
      ],
    };
    assert.equal(
      (await checkItem(visual, { ...fake, vision: async () => ({}) })).status,
      "pending",
    );
    const vision = await fake.vision();
    assert.equal(
      (
        await checkItem(visual, {
          ...fake,
          vision: async () => ({ ...vision, aiLikelihood: "uncertain" }),
        })
      ).status,
      "pending",
    );
    assert.equal(
      (
        await checkItem(
          {
            ...visual,
            media: [
              {
                type: "mp4",
                poster: "https://fixtures.kiriya.invalid/image.png",
              },
            ],
          },
          fake,
        )
      ).reason,
      "moving_review_required",
    );
    await ingestItem(
      db,
      await fixtureItem("safety-good", {
        title: "changed synthetic candidate",
      }),
      { fixture: true },
    );
    await setSafety(db, good, {
      status: "approved",
      reason: null,
      evidence: {},
    });
    const [changed] = await db
      .select()
      .from(s.feedItems)
      .where(eq(s.feedItems.id, good.id));
    assert.equal(
      changed.safetyStatus,
      "pending",
      "an old check cannot approve a refreshed payload",
    );
  });

  await test("Writer rejects ID attacks, unsupported facts, prohibited wording and unsafe fallback bypass", async () => {
    const item = await approved("writer-item");
    const context = {
      taste: resolveTaste().taste,
      day: localDay(),
      section: "maomao",
      recentOpeners: [],
    };
    const good = templateBlurb(item);
    assert.equal(
      inspectBatch({ items: [good] }, [item], context).accepted.length,
      1,
    );
    for (const items of [
      [{ ...good, id: "invented:id" }],
      [good, good],
      [],
      [{ ...good, text: "miku launches on 2099-12-31 for $999" }],
      [{ ...good, text: "hey girlie kms" }],
      [{ ...good, text: "maomao married the emperor yesterday" }],
    ])
      assert.equal(inspectBatch({ items }, [item], context).accepted.length, 0);
    let calls = 0;
    const bad = {
      model: "mock",
      fallbackModel: "mock-fallback",
      write: async () => {
        calls++;
        return { items: [{ ...good, text: "2099 apocalypse launch" }] };
      },
    };
    const result = await writeBlurbs([item], bad, context);
    assert.equal(calls, 2);
    assert.equal(result[0].model, "template");
    assert.equal(
      (await writeBlurbs([{ ...item, safetyStatus: "pending" }], bad, context))
        .length,
      0,
    );
  });

  await test("Scoring is deterministic and the seven-day producer exclusion is a hard rule", async () => {
    const a = await approved("producer-a", {
      sections: ["music"],
      tags: { producers: ["producer one"] },
    });
    const b = await approved("producer-b", {
      sections: ["music"],
      tags: { producers: ["producer one"] },
      facts: { sourceScore: 1000000000 },
    });
    const c = await approved("producer-c", {
      sections: ["music"],
      tags: { producers: ["producer two"] },
    });
    const opts = {
      day: localDay(),
      section: "music",
      recentProducers: ["producer one"],
    };
    const plan = assembleSection([a, b, c], resolveTaste().taste, opts);
    assert.deepEqual(
      plan.selected.map((p) => p.item.id),
      [c.id],
    );
    assert.deepEqual(
      plan.slots,
      assembleSection([c, b, a], resolveTaste().taste, opts).slots,
    );
  });

  await test("Budget reservations are atomic, reconciliation idempotent, unknown/time-out usage stays charged", async () => {
    const budgetBuild = await createBuild(db, "2026-09-20", {
      mode: "fixture",
    });
    const run = await claimStage(db, budgetBuild, "fetch-a");
    const config = {
      ...feedConfig(),
      monthlyLimitMicros: 100,
      maxRequests: 20,
    };
    const prices = DEFAULT_PRICES["gpt-5.6-luna"];
    const base = {
      run,
      model: "gpt-5.6-luna",
      purpose: "test",
      estimate: 60,
      prices,
      config,
    };
    const attempts = await Promise.allSettled([
      reserveRequest(db, { ...base, key: "a" }),
      reserveRequest(db, { ...base, key: "b" }),
    ]);
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    const reservation = attempts.find((r) => r.status === "fulfilled").value;
    await settleRequest(db, reservation.id, {
      usage: {
        input_tokens: 10,
        output_tokens: 10,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      },
      result: { ok: true },
    });
    await settleRequest(db, reservation.id, {
      usage: { input_tokens: 0, output_tokens: 0 },
      result: { ok: true },
    });
    const [budget] = await db.select().from(s.feedBudgets);
    assert.equal(budget.committedMicros, 14);
    const uncertain = await reserveRequest(db, { ...base, key: "uncertain" });
    await settleRequest(db, uncertain.id, { uncertain: true });
    assert.equal(
      (await db.select().from(s.feedBudgets))[0].committedMicros,
      74,
    );
    await assert.rejects(
      () => reserveRequest(db, { ...base, key: "uncertain" }),
      (e) => e.code === "request_uncertain",
    );
    assert.equal(
      requestEstimate(prices, { inputTokens: 100, outputTokens: 100 }),
      145,
    );
    const deniedKey = attempts[0].status === "rejected" ? "a" : "b";
    const resumed = await reserveRequest(db, {
      ...base,
      key: deniedKey,
      config: { ...config, monthlyLimitMicros: 500 },
    });
    await settleRequest(db, resumed.id, {
      usage: { input_tokens: 0, output_tokens: 0 },
      result: { ok: true },
    });
    assert.equal(
      (await db.select().from(s.feedBudgets))[0].committedMicros,
      74,
    );
    await assert.rejects(
      () =>
        reserveRequest(db, {
          ...base,
          key: "request-limit",
          config: { ...config, maxRequests: 0 },
        }),
      (error) => error.code === "request_limit",
    );
  });

  await test("Real Responses request shape uses bounded strict output, explicit Luna cache and a compatible fallback", async () => {
    const b = await createBuild(db, "2026-09-21", { mode: "fixture" }),
      run = await claimStage(db, b, "fetch-a");
    const payloads = [];
    const config = {
      ...feedConfig(),
      apiKey: "mock-only",
      monthlyLimitMicros: 5000000,
    };
    const sdk = {
      responses: {
        create: async (input) => {
          payloads.push(input);
          return {
            status: "completed",
            output_text: '{"items":[]}',
            usage: {
              input_tokens: 10,
              output_tokens: 10,
              input_tokens_details: { cached_tokens: 3, cache_write_tokens: 2 },
            },
          };
        },
      },
    };
    const provider = createProvider({
      db,
      run,
      config,
      deadline: Date.now() + 120000,
      registry: [],
      client: sdk,
    });
    const input = {
      day: localDay(),
      section: "maomao",
      items: [],
      taste: { characters: ["maomao"] },
    };
    await provider.write(input, { attempt: 0, violations: [] });
    await provider.write(input, { attempt: 1, violations: [] });
    assert.equal(payloads[0].model, "gpt-5.6-luna");
    assert.equal(payloads[0].reasoning.effort, "none");
    assert.equal(payloads[0].store, false);
    assert.equal(payloads[0].text.format.strict, true);
    assert.deepEqual(payloads[0].prompt_cache_options, {
      mode: "explicit",
      ttl: "30m",
    });
    assert.equal(payloads[1].prompt_cache_options, undefined);
    assert.equal(
      payloads[1].input[0].content[0].prompt_cache_breakpoint,
      undefined,
    );
    assert(!JSON.stringify(payloads).includes(process.env.SESSION_SECRET));
    await provider.write(input, { attempt: 0, violations: [] });
    assert.equal(payloads.length, 2, "resuming reuses the recorded response");
    const unavailablePrice = createProvider({
      db,
      run,
      config: { ...config, model: "unpriced-test-model" },
      deadline: Date.now() + 120000,
      registry: [],
      client: sdk,
    });
    await assert.rejects(
      () =>
        unavailablePrice.write(
          { ...input, section: "merch" },
          { attempt: 0, violations: [] },
        ),
      (error) => error.code === "unknown_model_price",
    );
    assert.equal(payloads.length, 2);
    let badCalls = 0;
    const malformed = createProvider({
      db,
      run,
      config,
      deadline: Date.now() + 120000,
      registry: [],
      client: {
        responses: {
          create: async () => {
            badCalls++;
            return {
              status: "completed",
              output_text: "invalid json",
              usage: { input_tokens: 10, output_tokens: 10 },
            };
          },
        },
      },
    });
    for (let i = 0; i < 2; i++)
      await assert.rejects(
        () =>
          malformed.write(
            { ...input, section: "music" },
            { attempt: 0, violations: [] },
          ),
        (error) => error.code === "malformed_provider_output",
      );
    assert.equal(badCalls, 1);
    const badUsage = (
      await db.select().from(s.feedUsage).where(eq(s.feedUsage.buildId, b.id))
    ).find((row) => row.result?.error === "malformed_provider_output");
    assert.equal(badUsage.chargedMicros, 14);
  });

  await test("HTTP adapter enforces hosts, public destinations, byte/type bounds, retries and pacing deadlines", async () => {
    for (const value of [
      "https://127.0.0.1",
      "http://vocadb.net/api",
      "https://vocadb.net@localhost",
      "https://vocadb.net:444/api",
    ])
      assert.throws(() => allowedUrl(value, ["vocadb.net"]));
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ])
      assert.equal(publicAddress(address), false);
    assert.equal(publicAddress("8.8.8.8"), true);
    const entry = {
      hosts: ["vocadb.net"],
      mediaHosts: ["images.example.com"],
      maxRequests: 3,
      maxBytes: 100,
      paceMs: 0,
      timeoutMs: 1000,
    };
    let calls = 0;
    const http = sourceHttp(entry, {
      deadline: Date.now() + 10000,
      send: async () =>
        ++calls === 1
          ? {
              status: 429,
              headers: { "retry-after": "0" },
              buffer: Buffer.alloc(0),
            }
          : {
              status: 200,
              headers: { "content-type": "application/json" },
              buffer: Buffer.from('{"ok":true}'),
            },
    });
    assert.deepEqual(await http.json("https://vocadb.net/api"), { ok: true });
    assert.equal(calls, 2);
    const redirect = sourceHttp(entry, {
      deadline: Date.now() + 5000,
      send: async () => ({
        status: 302,
        headers: { location: "https://127.0.0.1/private" },
        buffer: Buffer.alloc(0),
      }),
    });
    await assert.rejects(
      () => redirect.json("https://vocadb.net/api"),
      (e) => e.code === "source_host_denied",
    );
    const oversize = sourceHttp(entry, {
      deadline: Date.now() + 5000,
      send: async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        buffer: Buffer.alloc(101),
      }),
    });
    await assert.rejects(
      () => oversize.json("https://vocadb.net/api"),
      (e) => e.code === "response_too_large",
    );
  });

  await test("Save contracts default to links; copy reservations cap concurrent requests and require cleanup", async () => {
    const item = await approved("save-contract");
    const [source] = await sourceRegistry();
    const link = await ensureSave(db, item, source);
    assert.equal(link.copyState, "link_only");
    const other = await approved("copy-contract", {
      media: [
        { type: "image", url: "https://fixtures.kiriya.invalid/copy.png" },
      ],
    });
    const copy = await ensureSave(db, other, {
      ...source,
      copyPolicy: "private_copy",
      copyPermission: {
        basis: "synthetic fixture permission",
        sourceUrl: "https://fixtures.kiriya.invalid/license",
        verifiedAt: new Date().toISOString(),
      },
    });
    await db.insert(s.feedStorage).values({
      key: "private-blob",
      copyBytes: SAVE_LIMITS.copyBytes - 1000,
      totalStoreBytes: 0,
      measuredAt: new Date(),
    });
    const concurrent = await Promise.all([
      reserveCopy(db, copy.id, 800),
      reserveCopy(db, copy.id, 800),
    ]);
    assert.equal(concurrent.filter((r) => r.outcome === "reserved").length, 1);
    const reservation = concurrent.find((r) => r.outcome === "reserved");
    await assert.rejects(
      () => finishCopy(db, copy.id, reservation.token, {}),
      (e) => e.code === "copy_cleanup_required",
    );
    assert.equal(
      (await finishCopy(db, copy.id, reservation.token, { cleanedUp: true }))
        .finished,
      true,
    );
    assert.equal((await db.select().from(s.feedStorage))[0].reservedBytes, 0);
    assert.equal((await ensureSave(db, other, source)).id, copy.id);
    const retried = await reserveCopy(db, copy.id, 800);
    assert.equal(retried.outcome, "reserved");
    const finish = {
      pathname: "saves/synthetic-fixture.png",
      bytes: 700,
      contentType: "image/png",
    };
    assert.equal(
      (await finishCopy(db, copy.id, retried.token, finish)).finished,
      true,
    );
    assert.equal(
      (await finishCopy(db, copy.id, retried.token, finish)).finished,
      false,
    );
    const [storage] = await db.select().from(s.feedStorage);
    assert.equal(storage.copyBytes, SAVE_LIMITS.copyBytes - 300);
    assert.equal(storage.reservedBytes, 0);
  });

  await test("Seen identities and bridged repost exclusions survive payload retention", async () => {
    const feed = await readFeed(db, "music", { fixture: true });
    const id = feed.slots[0].primaryId;
    const [item] = await db
      .select()
      .from(s.feedItems)
      .where(eq(s.feedItems.id, id));
    await markSeen(db, { revision: feed.revision, ids: [id] }, "kiriya");
    await db
      .update(s.feedSeen)
      .set({ firstSeenAt: new Date(Date.now() - 91 * 86400000) })
      .where(eq(s.feedSeen.itemId, id));
    await pruneFeeds(db);
    assert.equal(
      (await db.select().from(s.feedItems).where(eq(s.feedItems.id, id)))
        .length,
      0,
    );
    // Even losing the detailed seen timestamp cannot remove the permanent alias exclusion.
    await db.delete(s.feedSeen).where(eq(s.feedSeen.itemId, id));
    await ingestItem(db, await fixtureItem(item.nativeId, { url: item.url }), {
      fixture: true,
    });
    await db
      .update(s.feedItems)
      .set({ safetyStatus: "approved" })
      .where(eq(s.feedItems.id, id));
    assert(
      !(await eligibleItems(db, { fixture: true })).some(
        (row) => row.id === id,
      ),
    );
    const a = await approved("bridge-one", {
      mediaIdentity: "bridge-media-one",
    });
    const b = await approved("bridge-two", {
      mediaIdentity: "bridge-media-two",
    });
    await hideItems(db, [a.id]);
    const merged = await ingestItem(
      db,
      await fixtureItem("bridge-two", {
        url: a.url,
        mediaIdentity: "bridge-media-two",
      }),
      { fixture: true },
    );
    assert.equal(merged, b.id);
    await db
      .update(s.feedItems)
      .set({ safetyStatus: "approved" })
      .where(eq(s.feedItems.id, merged));
    assert(
      !(await eligibleItems(db, { fixture: true })).some(
        (row) => row.id === merged,
      ),
    );
  });

  await test("Failed rebuilds retain the published edition; Singapore catch-up and fixture production guards work", async () => {
    const current = await readFeed(db, "maomao", { fixture: true });
    assert(current.revision);
    const newer = await createBuild(db, build.day, {
      mode: "fixture",
      force: true,
    });
    assert.notEqual(newer.id, build.id);
    assert.equal(
      (await runStage(db, { buildId: newer.id, stage: "publish" })).outcome,
      "waiting_for_dependency",
    );
    assert.equal(
      (await readFeed(db, "maomao", { fixture: true })).revision,
      current.revision,
    );
    assert.equal(localDay(new Date("2026-09-15T17:05:00Z")), "2026-09-16");
    assert.equal(
      (await catchUp(db, { now: new Date("2026-09-15T22:59:00Z") })).outcome,
      "before_catchup_window",
    );
    const original = env.isProd;
    env.isProd = true;
    assert.equal(feedConfig().fixtureMode, false);
    assert.throws(
      () => createFixtureProvider(),
      (e) => e.code === "fixtures_disabled",
    );
    assert.equal(
      (
        await request("admin/feeds/run", {
          method: "POST",
          cookie: admin,
          body: { fixture: true },
        })
      ).status,
      403,
    );
    env.isProd = original;
    const afterSeven = { now: new Date("2026-09-17T00:00:00Z") };
    assert.equal((await catchUp(db, afterSeven)).outcome, "completed");
    assert.equal((await catchUp(db, afterSeven)).outcome, "rate_limited");
  });
} finally {
  globalThis.fetch = originalFetch;
  await client.close();
  await rm(tmp, { recursive: true, force: true });
}
