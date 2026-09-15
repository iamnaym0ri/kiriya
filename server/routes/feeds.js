import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "../db/client.js";
import { requireRole } from "../auth/session.js";
import { env } from "../env.js";
import { localDay } from "../lib/time.js";
import {
  FeedError,
  feedConfig,
  INDEPENDENT_STAGES,
  SECTIONS,
  STAGES,
} from "../feeds/config.js";
import {
  blockItemOrigin,
  createBuild,
  hideItems,
  jsonSql,
  rows,
} from "../feeds/repository.js";
import { getTaste, putTaste, TasteOverridesSchema } from "../feeds/taste.js";
import { markSeen, readFeed } from "../feeds/editions.js";
import { claimCatchUp, nextStage, runStage } from "../feeds/jobs.js";
import { sourceRegistry } from "../feeds/sources/registry.js";
import { DEFAULT_PRICES } from "../feeds/usage.js";
import { ensureSave } from "../feeds/saves.js";
import { copySave, deleteSave, storageStatus } from "../feeds/storage.js";
import { afterStage, background } from "../feeds/orchestrate.js";
import { VoiceLexiconSchema, getFeedSettings } from "../feeds/settings.js";
// Independent stage handlers register themselves with the runner on import.
import "../feeds/maintenance.js";
import "../feeds/diagnostics.js";
import "../feeds/events.js";
import { previewLexicon, rewriteBlurb } from "../feeds/admin-tools.js";

function privateRoutes(...roles) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    await next();
  });
  if (roles.length) app.use("*", requireRole(...roles));
  app.onError((error, c) => {
    if (error instanceof FeedError)
      return c.json(
        { error: error.code, message: error.code.replaceAll("_", " ") },
        error.status,
      );
    if (error instanceof z.ZodError)
      return c.json(
        { error: "invalid_input", message: "Check the submitted fields." },
        400,
      );
    console.error("[feeds]", error.name);
    return c.json(
      {
        error: "feed_unavailable",
        message:
          "Feeds are unavailable right now. Your existing world is still here.",
      },
      503,
    );
  });
  return app;
}
async function body(c, schema) {
  const text = await c.req.text();
  if (Buffer.byteLength(text) > 16000)
    throw new FeedError("request_too_large", 413);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new FeedError("invalid_json");
  }
  return schema.parse(value);
}
const idSchema = z.string().min(1).max(120);
const idsSchema = z.array(idSchema).min(1).max(50);
const isKiriya = (c) => c.get("session").role === "kiriya";

// Presentation of a save: private copy through the authenticated media route when ready,
// otherwise the original link and media (never labelled as a saved copy).
export function presentSave(row) {
  const copy = row.copyState === "ready" && row.blobPath
    ? { url: `/api/uploads/media?path=${encodeURIComponent(row.blobPath)}`, contentType: row.contentType, bytes: row.bytes }
    : null;
  return {
    id: row.id,
    itemId: row.itemId,
    kind: row.kind,
    sections: row.sections,
    title: row.title,
    url: row.url,
    credit: row.credit,
    blurb: row.snapshot?.blurb ? { headline: row.snapshot.blurb.headline, text: row.snapshot.blurb.text } : null,
    facts: row.snapshot?.facts ?? {},
    media: row.removedAt ? [] : (row.snapshot?.media ?? []),
    copy,
    copyState: row.copyState,
    removed: Boolean(row.removedAt),
    removedReason: row.removedAt ? (row.copyError ?? "creator_removed") : null,
    createdAt: row.createdAt,
    signature: "✦ kiriya.love",
  };
}

export const feedRoutes = privateRoutes("kiriya", "admin");
feedRoutes.get("/feed/:section", async (c) =>
  c.json(
    await readFeed(await getDb(), c.req.param("section"), {
      fixture: feedConfig().fixtureMode,
    }),
  ),
);
feedRoutes.post("/feed/seen", async (c) => {
  const input = await body(
    c,
    z.object({ revision: z.string().max(200), ids: idsSchema }).strict(),
  );
  return c.json(await markSeen(await getDb(), input, c.get("session").role));
});
feedRoutes.post("/feed/hide", async (c) => {
  const { id } = await body(c, z.object({ id: idSchema }).strict());
  const db = await getDb();
  const [item] = await db
    .select()
    .from(s.feedItems)
    .where(eq(s.feedItems.id, id));
  if (!item) throw new FeedError("item_not_found", 404);
  if (!isKiriya(c)) return c.json({ hidden: [], preview: true });
  return c.json({ hidden: await hideItems(db, [id], "kiriya") });
});
feedRoutes.post("/feed/recheck", async (c) => {
  const { id } = await body(c, z.object({ id: idSchema }).strict());
  const db = await getDb();
  const result = await db.execute(
    sql`UPDATE feed_items SET safety=jsonb_set(safety,'{recheckHintAt}',to_jsonb(now())) WHERE id=${id} AND visibility='active' RETURNING id`,
  );
  if (!rows(result).length) throw new FeedError("item_not_found", 404);
  return c.json({ outcome: "recheck_requested" });
});
// Never blocks the page: the throttled claim is quick; the stage itself runs in the background.
feedRoutes.post("/feed/catchup", async (c) => {
  if (!isKiriya(c)) return c.json({ outcome: "preview" });
  const db = await getDb();
  const claim = await claimCatchUp(db);
  if (claim.outcome !== "claimed") return c.json(claim);
  background(
    runStage(db, { buildId: claim.buildId, stage: claim.stage }).then((result) => afterStage(db, result)),
  );
  return c.json({ outcome: "scheduled", stage: claim.stage });
});
feedRoutes.get("/faves", async (c) =>
  c.json({ ...(await getTaste(await getDb())), applies: "next_build" }),
);
feedRoutes.put("/faves", async (c) => {
  const input = await body(
    c,
    z
      .object({
        overrides: TasteOverridesSchema,
        expectedRevision: z.string().max(100),
      })
      .strict(),
  );
  if (!isKiriya(c)) throw new FeedError("use_kiriya_session", 403);
  return c.json({
    ...(await putTaste(await getDb(), input.overrides, input.expectedRevision)),
    applies: "next_build",
  });
});

// ---------- saves ----------
feedRoutes.get("/saves", async (c) => {
  const db = await getDb();
  const list = await db.select().from(s.saves).orderBy(desc(s.saves.createdAt)).limit(300);
  return c.json({ saves: list.map(presentSave), storage: { warning: (await storageStatus(db)).warning } });
});
feedRoutes.get("/saves/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const [row] = await (await getDb()).select().from(s.saves).where(eq(s.saves.id, id));
  if (!row) throw new FeedError("save_not_found", 404);
  return c.json(presentSave(row));
});
// Keep: item ID only. The server resolves the approved item, its source policy and media.
feedRoutes.post("/saves", async (c) => {
  const { id } = await body(c, z.object({ id: idSchema }).strict());
  if (!isKiriya(c)) return c.json({ preview: true, saved: false });
  const db = await getDb();
  const [item] = await db.select().from(s.feedItems).where(eq(s.feedItems.id, id));
  if (!item) throw new FeedError("item_not_found", 404);
  const registry = await sourceRegistry({ fixtures: item.fixture && feedConfig().fixtureMode });
  const source = registry.find((e) => e.id === item.source);
  if (!source) throw new FeedError("item_not_saveable", 409);
  const saved = await ensureSave(db, item, source);
  if (["pending", "retryable"].includes(saved.copyState))
    background(copySave(db, saved.id, { registry }));
  return c.json({ save: presentSave(saved), copy: saved.copyState === "pending" ? "copying_in_background" : saved.copyState });
});
feedRoutes.delete("/saves/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  if (!isKiriya(c)) throw new FeedError("use_kiriya_session", 403);
  return c.json(await deleteSave(await getDb(), id));
});

// ---------- events (read) ----------
feedRoutes.get("/events", async (c) => {
  const db = await getDb();
  const list = await db
    .select()
    .from(s.events)
    .where(eq(s.events.status, "upcoming"))
    .orderBy(s.events.startsOn)
    .limit(60);
  return c.json({
    events: list.map((e) => ({
      id: e.id,
      name: e.name,
      city: e.city,
      country: e.country,
      venue: e.venue,
      startsOn: e.startsOn,
      endsOn: e.endsOn,
      tier: e.tier,
      url: e.url,
      confidence: e.confidence,
      tbc: !e.startsOn || e.confidence === "unconfirmed",
      hers: e.hers,
    })),
  });
});

export const feedAdminRoutes = privateRoutes("admin");
feedAdminRoutes.get("/status", async (c) => {
  const db = await getDb(),
    config = feedConfig();
  const [builds, runs, health, rejected, usage, budgets, items, pendingCounts, events, hidden] =
    await Promise.all([
      db.select().from(s.feedBuilds).orderBy(desc(s.feedBuilds.createdAt)).limit(8),
      db.select().from(s.feedRuns).orderBy(desc(s.feedRuns.startedAt)).limit(40),
      db.select().from(s.feedSourceHealth),
      db.select().from(s.feedItems).where(eq(s.feedItems.safetyStatus, "rejected")).orderBy(desc(s.feedItems.fetchedAt)).limit(20),
      db.select().from(s.feedUsage).orderBy(desc(s.feedUsage.createdAt)).limit(100),
      db.select().from(s.feedBudgets),
      db.select().from(s.feedItems).orderBy(desc(s.feedItems.fetchedAt)).limit(60),
      db.execute(sql`SELECT safety_status, coalesce(reason,'') AS reason, count(*)::int AS n FROM feed_items GROUP BY 1,2 ORDER BY 3 DESC LIMIT 40`),
      db.select().from(s.events).orderBy(s.events.startsOn).limit(80),
      // Her hides sit next to the owner's so a filter gap can be spotted. Hides never train scoring.
      db
        .select({ id: s.feedItems.id, title: s.feedItems.title, source: s.feedItems.source, kind: s.feedItems.kind, hiddenBy: s.feedItems.hiddenBy, credit: s.feedItems.credit })
        .from(s.feedItems)
        .where(eq(s.feedItems.visibility, "hidden"))
        .orderBy(desc(s.feedItems.fetchedAt))
        .limit(40),
    ]);
  const registry = await sourceRegistry();
  const settings = await getFeedSettings(db);
  const diagnostics = runs.find((r) => r.stage === "diagnostics");
  return c.json({
    enabled: config.enabled,
    manualRuns: config.manualRuns,
    fixtureMode: config.fixtureMode,
    setup: {
      openai: Boolean(config.apiKey),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      tumblr: Boolean(process.env.TUMBLR_API_KEY),
      bluesky: Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD),
      cron: Boolean(env.cronSecret),
      model: config.model,
      fallbackModel: config.fallbackModel,
      maxRequestsPerInvocation: config.maxRequests,
    },
    sources: registry.map(({ fetch, recheck, ...entry }) => entry),
    stages: STAGES,
    independentStages: INDEPENDENT_STAGES,
    builds: builds.map(({ taste, ...build }) => build),
    runs: runs.map(({ leaseToken, checkpoint, ...run }) => ({
      ...run,
      // Checkpoint details are safe summaries (counts/outcomes); cursors are omitted.
      checkpoint: run.stage === "diagnostics" || run.stage === "maintenance" || run.stage === "events" ? checkpoint : undefined,
    })),
    diagnostics: diagnostics?.checkpoint?.results ?? null,
    health,
    safetyCounts: rows(pendingCounts),
    rejected: rejected.map(({ id, title, reason, source, credit, url }) => ({ id, title, reason, source, credit, url })),
    items: items.map(({ id, title, reason, source, credit, safetyStatus, visibility, blurb, fixture, kind, url, safety }) => ({
      id, title, reason, source, credit, safetyStatus, visibility, blurb, fixture, kind, url,
      scope: safety?.scope ?? null,
      uncertain: Boolean(safety?.uncertain),
    })),
    events,
    hidden,
    lexicon: settings.lexicon,
    storage: await storageStatus(db),
    usage: {
      monthlyLimitUsd: config.monthlyLimitMicros / 1e6,
      months: budgets.map((b) => ({ month: b.month, committedUsd: b.committedMicros / 1e6 })),
      requests: usage.map(({ result, requestKey, ...u }) => u),
      priceDate: DEFAULT_PRICES["gpt-5.6-luna"].asOf,
    },
  });
});
feedAdminRoutes.get("/preview/:build/:section", async (c) => {
  const buildId = z.string().uuid().parse(c.req.param("build"));
  const db = await getDb();
  const [build] = await db.select().from(s.feedBuilds).where(eq(s.feedBuilds.id, buildId));
  if (!build) throw new FeedError("build_not_found", 404);
  const section = c.req.param("section");
  const feed = await readFeed(db, section, {
    previewBuildId: buildId,
    fixture: build.mode === "fixture",
    day: build.day,
  });
  const [edition] = SECTIONS.includes(section)
    ? await db
        .select({ state: s.feedEditions.state, meta: s.feedEditions.meta })
        .from(s.feedEditions)
        .where(and(eq(s.feedEditions.buildId, buildId), eq(s.feedEditions.section, section)))
    : [];
  // Owner-only extras: score parts per item, edition state (rewrites of a published edition need
  // confirmation) and the rewrite audit trail.
  return c.json({
    ...feed,
    buildId,
    editionState: edition?.state ?? null,
    scores: edition?.meta?.scores ?? {},
    rewrites: edition?.meta?.rewrites ?? {},
  });
});
feedAdminRoutes.post("/run", async (c) => {
  const input = await body(
    c,
    z
      .object({
        stage: z.enum([...STAGES, "events", "maintenance"]).optional(),
        buildId: z.string().uuid().optional(),
        force: z.boolean().default(false),
        fixture: z.boolean().default(false),
      })
      .strict(),
  );
  const config = feedConfig();
  if (input.fixture && !config.fixtureMode)
    throw new FeedError("fixtures_disabled", 403);
  if (!config.enabled && !config.manualRuns && !config.fixtureMode)
    return c.json({ outcome: "disabled" });
  const db = await getDb();
  const build = input.buildId
    ? (await db.select().from(s.feedBuilds).where(eq(s.feedBuilds.id, input.buildId)))[0]
    : await createBuild(db, localDay(), {
        mode: input.fixture ? "fixture" : "live",
        force: input.force,
      });
  if (!build) throw new FeedError("build_not_found", 404);
  const stage = input.stage ?? (await nextStage(db, build.id));
  return c.json(
    stage
      ? await runStage(db, { buildId: build.id, stage })
      : { outcome: "completed", buildId: build.id },
  );
});
feedAdminRoutes.post("/hide", async (c) => {
  const { id } = await body(c, z.object({ id: idSchema }).strict());
  return c.json({ hidden: await hideItems(await getDb(), [id], "owner") });
});
feedAdminRoutes.post("/block", async (c) => {
  const { id, type } = await body(
    c,
    z.object({ id: idSchema, type: z.enum(["source", "creator"]) }).strict(),
  );
  await blockItemOrigin(await getDb(), id, type);
  return c.json({ blocked: true });
});
// Bounded, redacted production probes. Allowed while the live switch is off; re-runs after 10 min.
feedAdminRoutes.post("/diagnostics", async (c) => {
  const input = await body(
    c,
    z.object({ checks: z.array(z.enum(["database", "blob", "openai", "youtube", "tumblr", "bluesky"])).min(1).max(6).optional() }).strict(),
  );
  const db = await getDb();
  const build = await createBuild(db, localDay(), { mode: "live" });
  const reset = await db.execute(sql`UPDATE feed_runs SET status='pending',checkpoint=${jsonSql(input.checks ? { checks: input.checks } : {})},
      stats='{}'::jsonb,error=NULL WHERE build_id=${build.id}::uuid AND stage='diagnostics'
      AND (lease_until IS NULL OR lease_until<now()) AND (finished_at IS NULL OR finished_at<now()-interval '10 minutes') RETURNING stage`);
  const [existing] = rows(await db.execute(sql`SELECT status FROM feed_runs WHERE build_id=${build.id}::uuid AND stage='diagnostics'`));
  if (existing && !rows(reset).length) return c.json({ outcome: "rate_limited" });
  if (!existing && input.checks)
    await db.execute(sql`INSERT INTO feed_runs(build_id,stage,day,status,checkpoint) VALUES (${build.id}::uuid,'diagnostics',${build.day}::date,'pending',${jsonSql({ checks: input.checks })}) ON CONFLICT DO NOTHING`);
  background(runStage(db, { buildId: build.id, stage: "diagnostics" }));
  return c.json({ outcome: "scheduled", buildId: build.id }, 202);
});
feedAdminRoutes.post("/rewrite", async (c) => {
  const input = await body(
    c,
    z.object({ buildId: z.string().uuid(), section: z.enum(SECTIONS), id: idSchema, published: z.boolean().default(false) }).strict(),
  );
  return c.json(await rewriteBlurb(await getDb(), input));
});
feedAdminRoutes.put("/lexicon", async (c) => {
  const input = await body(c, VoiceLexiconSchema);
  const db = await getDb();
  await db.execute(sql`INSERT INTO settings(key,value) VALUES ('voice_lexicon',${jsonSql(input)})
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`);
  return c.json({ lexicon: input });
});
feedAdminRoutes.post("/lexicon/preview", async (c) => {
  const input = await body(c, z.object({ lexicon: VoiceLexiconSchema, section: z.enum(["maomao", "music", "dressup"]).default("maomao") }).strict());
  return c.json(await previewLexicon(await getDb(), input.lexicon, { section: input.section }));
});
const EventEdit = z
  .object({
    id: z.string().max(160).optional(),
    name: z.string().trim().min(1).max(160),
    city: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    venue: z.string().max(200).nullable().optional(),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    tier: z.enum(["sg", "regional"]).default("sg"),
    url: z.string().url().max(600).refine((v) => v.startsWith("https://")),
    status: z.enum(["upcoming", "cancelled", "hidden", "past"]).default("upcoming"),
    hers: z.boolean().default(false),
  })
  .strict();
// Owner confirmation/editing. Confirmed dates are recorded as owner-confirmed evidence.
feedAdminRoutes.post("/events", async (c) => {
  const input = await body(c, EventEdit);
  const db = await getDb();
  const id = input.id ?? `owner:${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}:${(input.startsOn ?? "tbc").slice(0, 4)}`;
  await db.execute(sql`INSERT INTO events(id,name,city,country,venue,starts_on,ends_on,tier,url,source_url,confidence,date_evidence,last_verified_at,status,tags,hers)
    VALUES (${id},${input.name},${input.city ?? null},${input.country ?? null},${input.venue ?? null},${input.startsOn ?? null}::date,${input.endsOn ?? input.startsOn ?? null}::date,
      ${input.tier},${input.url},${input.url},${input.startsOn ? "owner_confirmed" : "unconfirmed"},${jsonSql({ method: "owner", at: new Date().toISOString() })},now(),${input.status},'[]'::jsonb,${input.hers})
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,country=excluded.country,venue=excluded.venue,starts_on=excluded.starts_on,ends_on=excluded.ends_on,
      tier=excluded.tier,url=excluded.url,confidence=excluded.confidence,date_evidence=excluded.date_evidence,last_verified_at=now(),status=excluded.status,hers=excluded.hers`);
  return c.json({ id });
});
feedAdminRoutes.get("/saves", async (c) => {
  const db = await getDb();
  return c.json({
    storage: await storageStatus(db),
    saves: (await db.select().from(s.saves).orderBy(desc(s.saves.createdAt)).limit(100)).map((r) => ({
      id: r.id, title: r.title, source: r.source, copyPolicy: r.copyPolicy, copyState: r.copyState, bytes: r.bytes,
      attempts: r.copyAttempts, error: r.copyError, lastCheckedAt: r.lastCheckedAt, removedAt: r.removedAt,
    })),
  });
});

export const feedJobRoutes = privateRoutes();
const authorizeJob = (c) => {
  if (!env.cronSecret || c.req.header("authorization") !== `Bearer ${env.cronSecret}`)
    throw new FeedError("unauthorized", 401);
};
feedJobRoutes.get("/:stage", async (c) => {
  authorizeJob(c);
  const config = feedConfig();
  if (!config.enabled) return c.json({ outcome: "disabled" });
  const stage = z.enum([...STAGES, "events", "maintenance"]).parse(c.req.param("stage"));
  const db = await getDb(),
    build = await createBuild(db, localDay());
  const result = await runStage(db, { buildId: build.id, stage });
  background(afterStage(db, result));
  return c.json(result);
});
// Continuations acknowledge immediately and work inside this invocation's own lifetime.
feedJobRoutes.post("/:stage/continue", async (c) => {
  authorizeJob(c);
  const config = feedConfig();
  if (!config.enabled) return c.json({ outcome: "disabled" });
  const stage = z.enum([...STAGES, "events", "maintenance"]).parse(c.req.param("stage"));
  const { buildId } = await body(c, z.object({ buildId: z.string().uuid() }).strict());
  const db = await getDb();
  const [build] = await db.select().from(s.feedBuilds).where(eq(s.feedBuilds.id, buildId));
  if (!build || build.day !== localDay()) return c.json({ outcome: "stale_build" });
  background(runStage(db, { buildId, stage }).then((result) => afterStage(db, result)));
  return c.json({ outcome: "accepted", stage }, 202);
});
