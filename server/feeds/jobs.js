import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { addDays, localDay, zonedParts } from "../lib/time.js";
import { PLANNERS } from "./planners.js";
import { savesSummary } from "./saves.js";
import {
  FeedError,
  feedConfig,
  INDEPENDENT_STAGES,
  SECTIONS,
  STAGES,
} from "./config.js";
import {
  assertLease,
  blocklist,
  createBuild,
  dislikeSignals,
  eligibleItems,
  fence,
  ingestItem,
  jsonSql,
  pruneFeeds,
  recordHealth,
  rows,
  setSafety,
} from "./repository.js";
import {
  sourceRegistry,
  validateAdapterItem,
  SourcePageSchema,
} from "./sources/registry.js";
import { sourceHttp } from "./http.js";
import { checkItem } from "./moderate.js";
import { createFixtureProvider, createProvider } from "./provider.js";
import { publishEditions, recentProducers, stageEdition } from "./editions.js";
import { writeBlurbs } from "./writer.js";
import { opener } from "./voice.js";
import { getFeedSettings } from "./settings.js";
import { scoreItem } from "./score.js";
import { spentToday } from "./usage.js";
import { RULE_VERSION } from "./rules.js";

// Independent stage handlers (events, maintenance) are registered once by their modules so this
// runner never imports them (no cycles). `registerEventsStage` remains the documented entry point.
const extensions = {};
// Deletion rechecks per source per invocation (publish checks up to workLimit items, mostly 1 request each).
export const RECHECK_REQUESTS = 120;
export function registerStage(stage, handler) {
  if (
    !INDEPENDENT_STAGES.includes(stage) ||
    typeof handler !== "function" ||
    extensions[stage]
  )
    throw new FeedError(`invalid_${stage}_extension`);
  extensions[stage] = handler;
}
export function registerEventsStage(handler) {
  if (typeof handler !== "function" || extensions.events)
    throw new FeedError("invalid_events_extension");
  extensions.events = handler;
}
export async function claimStage(
  db,
  build,
  stage,
  { now = new Date(), leaseMs = 300000 } = {},
) {
  const index = STAGES.indexOf(stage);
  if (index < 0 && !INDEPENDENT_STAGES.includes(stage))
    throw new FeedError("unknown_stage", 404);
  if (INDEPENDENT_STAGES.includes(stage) && !extensions[stage])
    return { outcome: "not_implemented" };
  const previous = index > 0 ? STAGES[index - 1] : null;
  const token = randomUUID(),
    until = new Date(now.getTime() + leaseMs).toISOString();
  const result =
    await db.execute(sql`INSERT INTO feed_runs(build_id,stage,day,status,lease_token,lease_until,attempt,started_at,stats)
    SELECT ${build.id}::uuid,${stage},${build.day}::date,'running',${token}::uuid,${until}::timestamptz,1,${now.toISOString()}::timestamptz,'{"invocationRequests":0}'::jsonb
    WHERE NOT EXISTS(SELECT 1 FROM feed_builds newer WHERE newer.day=${build.day}::date AND newer.generation>${build.generation})
      AND (${previous}::text IS NULL OR EXISTS(SELECT 1 FROM feed_runs WHERE build_id=${build.id}::uuid AND stage=${previous} AND status='done'))
    ON CONFLICT(build_id,stage) DO UPDATE SET status='running',lease_token=excluded.lease_token,lease_until=excluded.lease_until,
      attempt=feed_runs.attempt+1,started_at=excluded.started_at,finished_at=NULL,error=NULL,
      stats=feed_runs.stats||'{"invocationRequests":0}'::jsonb
    WHERE feed_runs.status<>'done' AND (feed_runs.lease_until IS NULL OR feed_runs.lease_until<=${now.toISOString()}::timestamptz)
    RETURNING checkpoint,stats`);
  const claimed = rows(result)[0];
  if (claimed)
    return {
      outcome: "claimed",
      buildId: build.id,
      stage,
      token,
      checkpoint: claimed.checkpoint,
      stats: claimed.stats,
    };
  const [current] = await db
    .select()
    .from(s.feedRuns)
    .where(and(eq(s.feedRuns.buildId, build.id), eq(s.feedRuns.stage, stage)));
  if (current?.status === "done") return { outcome: "completed" };
  if (current?.leaseUntil && current.leaseUntil > now)
    return { outcome: "in_progress" };
  const [latest] = await db
    .select()
    .from(s.feedBuilds)
    .where(eq(s.feedBuilds.day, build.day))
    .orderBy(desc(s.feedBuilds.generation))
    .limit(1);
  return {
    outcome: latest?.id !== build.id ? "superseded" : "waiting_for_dependency",
  };
}
export async function checkpointRun(db, run, checkpoint, stats = {}) {
  const result =
    await db.execute(sql`UPDATE feed_runs SET checkpoint=${jsonSql(checkpoint)},stats=stats||${jsonSql(stats)}
    WHERE build_id=${run.buildId}::uuid AND stage=${run.stage} AND ${fence(run)} RETURNING stage`);
  if (!rows(result).length) throw new FeedError("lease_lost", 409);
  run.checkpoint = checkpoint;
}
export async function finishStage(
  db,
  run,
  { status = "done", error = null } = {},
) {
  const result =
    await db.execute(sql`UPDATE feed_runs SET status=${status},error=${error},lease_token=NULL,lease_until=NULL,
    finished_at=CASE WHEN ${status}='done' THEN now() ELSE NULL END
    WHERE build_id=${run.buildId}::uuid AND stage=${run.stage} AND ${fence(run)} RETURNING stage`);
  return rows(result).length > 0;
}

async function collect(ctx) {
  const entries = ctx.registry.filter(
    (e) => e.stage === ctx.run.stage && e.enabled,
  );
  let index = ctx.run.checkpoint.sourceIndex ?? 0,
    cursor = ctx.run.checkpoint.cursor ?? null,
    count = 0;
  const connections = new Map();
  while (index < entries.length) {
    if (count >= ctx.workLimit || Date.now() + 15000 > ctx.deadline)
      return false;
    await assertLease(ctx.db, ctx.run);
    const entry = entries[index],
      start = Date.now();
    if (!connections.has(entry.id)) {
      const stats = {};
      connections.set(entry.id, {
        stats,
        http: sourceHttp(entry, {
          deadline: ctx.deadline,
          signal: ctx.signal,
          stats,
        }),
      });
    }
    const { stats, http } = connections.get(entry.id);
    try {
      if (entry.requiredCredentials.some((k) => !process.env[k]))
        throw new FeedError("not_configured", 503);
      const page = SourcePageSchema.safeParse(
        await entry.fetch({
          day: ctx.build.day,
          cursor,
          deadline: ctx.deadline,
          signal: ctx.signal,
          run: ctx.run,
          // Internal adapters (event countdowns, her creator links) read Neon; external ones never do.
          ...(entry.internal ? { db: ctx.db, taste: ctx.build.taste } : {}),
          limits: { items: Math.min(8, ctx.workLimit - count) },
          // Required credentials are checked above; optional ones (e.g. a login that upgrades a
          // keyless endpoint) are passed only when present. Values never enter logs or storage.
          credentials: Object.fromEntries(
            [...entry.requiredCredentials, ...(entry.optionalCredentials ?? [])]
              .map((k) => [k, process.env[k]])
              .filter(([, v]) => v),
          ),
          http,
        }),
      );
      if (
        !page.success ||
        page.data.items.length > Math.min(8, ctx.workLimit - count) ||
        (!page.data.done && page.data.cursor === cursor)
      )
        throw new FeedError("adapter_contract");
      const result = page.data;
      for (const raw of result.items) {
        const item = validateAdapterItem(raw, entry);
        await ingestItem(ctx.db, item, {
          run: ctx.run,
          fixture: ctx.build.mode === "fixture",
        });
        count++;
      }
      await recordHealth(ctx.db, entry, {
        status: "ok",
        count: result.items.length,
        durationMs: Date.now() - start,
        requests: stats.requests ?? 0,
      });
      cursor = result.cursor;
      if (result.done) {
        index++;
        cursor = null;
      }
    } catch (error) {
      if (["deadline", "lease_lost"].includes(error.code)) throw error;
      await recordHealth(ctx.db, entry, {
        status: ["not_configured", "blocked"].includes(error.code)
          ? error.code
          : "failed",
        error: error.code ?? "source_failed",
        durationMs: Date.now() - start,
        requests: stats.requests ?? 0,
      });
      index++;
      cursor = null;
    }
    await checkpointRun(ctx.db, ctx.run, { sourceIndex: index, cursor });
  }
  return true;
}
// Items whose check needs paid vision/classification (moderation alone is free). A source the
// platform already checks (YouTube) costs nothing, so it never competes for a section's quota.
const platformChecked = async (fixtures = false) =>
  new Set((await sourceRegistry({ fixtures })).filter((e) => e.visionPolicy === "platform").map((e) => e.id));
const paidCheck = (item, trusted = platformChecked()) =>
  (item.media.length > 0 || item.kind === "meme") && !trusted.has(item.source);
// Reasons worth re-deciding after a rules bump. `cosplay_required` and `required_character_missing`
// are included because they depend on the same vision read that the bump re-runs.
const RECHECKABLE = [
  "vision",
  "moderation",
  "cosplay_required",
  "required_character_missing",
  // Relaxed on 2026-09-16: everything turned away by the old humour/is-it-a-meme rules gets
  // another look. "meme_needs_media" is not here — those posts have nothing to show, ever.
  "meme_rules",
];
const staleRejection = (item) =>
  item.safetyStatus === "rejected" &&
  RECHECKABLE.includes(item.reason) &&
  item.safety?.rulesVersion !== RULE_VERSION;

/**
 * Check order for one build. Text-only items (free moderation) first, then paid items most likely to
 * be planned: each section's top `checkQuotas[section]` by taste score, interleaved across sections so
 * a partial run still covers them all. Unqueued items stay pending for a later build.
 */
export async function checkQueue(db, build, config = feedConfig()) {
  const pending = await db
    .select()
    .from(s.feedItems)
    .where(
      and(
        eq(s.feedItems.fixture, build.mode === "fixture"),
        eq(s.feedItems.safetyStatus, "pending"),
        eq(s.feedItems.visibility, "active"),
      ),
    )
    .orderBy(desc(s.feedItems.fetchedAt), asc(s.feedItems.id))
    .limit(2000);
  const trusted = await platformChecked(build.mode === "fixture");
  const free = pending.filter((i) => !paidCheck(i, trusted)).map((i) => i.id);
  // Items an earlier build held back as uncertain, or rejected by vision/moderation under an older
  // rules version, are re-evaluated first under the current rules (once: the new verdict records it).
  const reconsider = await db
    .select({ id: s.feedItems.id })
    .from(s.feedItems)
    .where(
      and(
        eq(s.feedItems.fixture, build.mode === "fixture"),
        eq(s.feedItems.safetyStatus, "rejected"),
        eq(s.feedItems.visibility, "active"),
        sql`${s.feedItems.reason} IN ('vision','moderation') AND ${s.feedItems.safety}->>'rulesVersion' IS DISTINCT FROM ${RULE_VERSION}`,
      ),
    )
    .limit(100);
  const uncertain = [
    ...pending.filter((i) => paidCheck(i, trusted) && i.reason === "vision_uncertain").map((i) => i.id),
    ...reconsider.map((r) => r.id),
  ];
  // Fandom memes are checked through their own sections' quotas; the meme quota is for home memes.
  const inQuota = (i, section) =>
    i.sections.includes(section) &&
    (section !== "meme" || (!i.sections.includes("maomao") && !i.sections.includes("music")));
  const lists = SECTIONS.map((section) =>
    pending
      .filter((i) => paidCheck(i, trusted) && inQuota(i, section))
      .map((i) => ({ id: i.id, score: scoreItem(i, build.taste, { day: build.day, section }).score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, config.checkQuotas?.[section] ?? 30)
      .map((r) => r.id),
  );
  const queued = new Set([...free, ...uncertain]);
  const queue = [...free, ...uncertain.filter((id) => !free.includes(id))];
  for (let i = 0; lists.some((list) => i < list.length); i++)
    for (const list of lists)
      if (i < list.length && !queued.has(list[i])) {
        queued.add(list[i]);
        queue.push(list[i]);
      }
  return queue;
}

async function check(ctx) {
  const trusted = await platformChecked(ctx.build.mode === "fixture");
  let queue = ctx.run.checkpoint.queue ?? (await checkQueue(ctx.db, ctx.build, ctx.config));
  let position = ctx.run.checkpoint.position ?? 0;
  let retried = ctx.run.checkpoint.retried ?? false;
  let budgetStopped = ctx.run.checkpoint.budgetStopped ?? false;
  const blocked = await blocklist(ctx.db);
  const stats = { ...(ctx.run.stats ?? {}) };
  const save = (extra = {}) =>
    checkpointRun(ctx.db, ctx.run, { queue, position, retried, budgetStopped }, {
      checked: stats.checked ?? 0,
      queued: queue.length,
      last_approved: stats.last_approved ?? 0,
      last_rejected: stats.last_rejected ?? 0,
      last_pending: stats.last_pending ?? 0,
      skippedForDailyBudget: stats.skippedForDailyBudget ?? 0,
      ...extra,
    });
  if (!ctx.run.checkpoint.queue) await save();
  let processed = 0;
  for (;;) {
    while (position < queue.length) {
      // Moving media needs download/decoding time on top of provider calls.
      if (processed >= ctx.workLimit || Date.now() + 45000 > ctx.deadline) {
        await save();
        return false;
      }
      const [item] = await ctx.db.select().from(s.feedItems).where(eq(s.feedItems.id, queue[position]));
      // Daily pacing: once paid inspection reaches its share of the day, remaining paid items stay
      // pending for a later build; free text checks (and the retry pass) still run, and today's plan
      // uses what is approved.
      if (
        (item?.safetyStatus === "pending" || (item && staleRejection(item))) &&
        paidCheck(item, trusted) &&
        ctx.config.dailyLimitMicros &&
        (budgetStopped ||
          (await spentToday(ctx.db)) >= ctx.config.dailyLimitMicros * (ctx.config.checkDailyShare ?? 0.7))
      ) {
        budgetStopped = true;
        stats.skippedForDailyBudget = (stats.skippedForDailyBudget ?? 0) + 1;
      } else if (item && item.visibility === "active" && (item.safetyStatus === "pending" || staleRejection(item))) {
        await assertLease(ctx.db, ctx.run);
        const result = await checkItem(item, ctx.provider, {
          blocklist: blocked,
          tuning: ctx.settings.tuning,
          source: ctx.registry.find((e) => e.id === item.source),
        });
        await setSafety(ctx.db, item, result, ctx.run);
        stats.checked = (stats.checked ?? 0) + 1;
        stats[`last_${result.status}`] = (stats[`last_${result.status}`] ?? 0) + 1;
      }
      position++;
      processed++;
      // Re-checking an item after a lost checkpoint reuses its settled provider results, so the
      // position only needs saving every few items.
      if (position % 8 === 0) await save();
    }
    // One retry pass per build for queued items that a transient failure left pending.
    if (retried) break;
    retried = true;
    const again = rows(
      await ctx.db.execute(sql`SELECT id FROM feed_items WHERE safety_status='pending' AND visibility='active'
        AND reason='safety_unavailable' AND id IN (SELECT jsonb_array_elements_text(${jsonSql(queue)}))`),
    ).map((r) => r.id);
    if (!again.length) break;
    queue = [...queue, ...again];
    await save({ retryQueued: again.length });
  }
  await save();
  return true;
}
async function planContext(ctx, section) {
  const { db, build } = ctx;
  const day = build.day;
  const recent = rows(
    await db.execute(sql`SELECT e.section,e.day,e.meta->'plan' AS plan,
        jsonb_path_query_array(e.slots||e.reserve,'$[*].primaryId') AS ids
      FROM feed_editions e WHERE e.state='published' AND e.day>=${addDays(day, -60)}::date AND e.day<${day}::date`),
  );
  const weekIds = [
    ...new Set(
      recent.filter((r) => r.day >= addDays(day, -6)).flatMap((r) => r.ids ?? []),
    ),
  ];
  const creators = weekIds.length
    ? rows(
        await db.execute(
          sql`SELECT DISTINCT lower(source||':'||coalesce(nullif(credit->>'handle',''),credit->>'name')) AS creator FROM feed_items WHERE id IN (SELECT jsonb_array_elements_text(${jsonSql(weekIds)}))`,
        ),
      ).map((r) => r.creator)
    : [];
  const context = {
    day,
    taste: build.taste,
    recentProducers: await recentProducers(db, day),
    recentCreators: creators,
    // What "not for me" has taught us; see dislikeSignals.
    dislikes: await dislikeSignals(db),
  };
  if (section === "music") {
    const yesterday = recent.filter((r) => r.section === "music" && r.day === addDays(day, -1)).flatMap((r) => r.ids ?? []);
    context.nonMikuYesterday = yesterday.length
      ? rows(
          await db.execute(
            sql`SELECT 1 FROM feed_items WHERE id IN (SELECT jsonb_array_elements_text(${jsonSql(yesterday)})) AND kind='song'
              AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags->'voicebanks') v WHERE v<>'hatsune miku') LIMIT 1`,
          ),
        ).length > 0
      : false;
  }
  if (section === "dressup") {
    // Her own photos rotate least-recently-shown first; history comes from published editions.
    const photos = await db
      .select()
      .from(s.cosplayProjects)
      .where(sql`${s.cosplayProjects.coverUrl} IS NOT NULL`);
    const last = new Map();
    for (const r of recent.filter((r) => r.section === "dressup"))
      if (r.plan?.personal?.photoId && (!last.has(r.plan.personal.photoId) || last.get(r.plan.personal.photoId) < r.day))
        last.set(r.plan.personal.photoId, r.day);
    const choice = photos
      .map((p) => ({ p, at: last.get(p.id) ?? "0000-00-00" }))
      .sort((a, b) => a.at.localeCompare(b.at) || String(a.p.id).localeCompare(String(b.p.id)))[0]?.p;
    context.personal = choice
      ? { photoId: choice.id, character: choice.character, series: choice.series ?? null, note: choice.notes ?? null, coverUrl: choice.coverUrl }
      : null;
  }
  return context;
}

async function planWrite(ctx) {
  let index = ctx.run.checkpoint.sectionIndex ?? 0;
  let processed = 0;
  while (index < SECTIONS.length) {
    if (processed >= ctx.workLimit || Date.now() + 60000 > ctx.deadline)
      return false;
    const section = SECTIONS[index],
      items = await eligibleItems(ctx.db, {
        fixture: ctx.build.mode === "fixture",
        // The merch shelf is a catalogue: items already seen stay listed.
        includeSeen: section === "merch",
      });
    const context = await planContext(ctx, section);
    const plan = PLANNERS[section](items, context);
    const previous = await ctx.db
      .select()
      .from(s.feedItems)
      .where(sql`${s.feedItems.blurb} IS NOT NULL`)
      .orderBy(desc(s.feedItems.fetchedAt))
      .limit(30);
    const recent = previous
      .filter((i) => !plan.selected.some((p) => p.item.id === i.id))
      .filter((i) => !i.blurb.skip);
    const history = recent
      .filter(
        (i) =>
          i.sections.includes(section) &&
          i.blurb.writtenAt &&
          localDay(new Date(i.blurb.writtenAt)) === ctx.build.day,
      )
      .map((i) => i.blurb);
    // Companion notes are written knowing which picture they sit beside.
    const pairs = {};
    for (const slot of [...plan.slots, ...plan.reserve])
      for (const id of slot.companionIds) pairs[id] = slot.primaryId;
    const titles = Object.fromEntries(plan.selected.map((p) => [p.item.id, p.item.title]));
    const hints = Object.fromEntries(
      plan.selected.map((p) => [
        p.item.id,
        {
          ...(plan.hints?.[p.item.id] ?? {}),
          ...(pairs[p.item.id] ? { pairedWith: titles[pairs[p.item.id]] ?? "" } : {}),
          slotType: [...plan.slots, ...plan.reserve].find((sl) => sl.primaryId === p.item.id)?.type ?? "companion",
        },
      ]),
    );
    const blurbs = plan.selected.length
      ? await writeBlurbs(
          plan.selected.map((p) => p.item),
          ctx.provider,
          {
            taste: ctx.build.taste,
            lexicon: ctx.settings.lexicon,
            day: ctx.build.day,
            section,
            history,
            hints,
            saves: await savesSummary(ctx.db),
            recentOpeners: recent.map((i) => opener(i.blurb.text)),
          },
        )
      : [];
    await stageEdition(ctx.db, ctx.build, section, plan, blurbs, ctx.run);
    index++;
    processed++;
    await checkpointRun(ctx.db, ctx.run, { sectionIndex: index });
  }
  return true;
}
async function publish(ctx) {
  const editions = await ctx.db
    .select()
    .from(s.feedEditions)
    .where(eq(s.feedEditions.buildId, ctx.build.id));
  const ids = [
    ...new Set(
      editions.flatMap((e) =>
        [...e.slots, ...e.reserve].flatMap((slot) => [
          slot.primaryId,
          ...slot.companionIds,
        ]),
      ),
    ),
  ];
  let index = ctx.run.checkpoint.recheckIndex ?? 0,
    processed = 0;
  // Item-level withholding: an unverifiable recheck (restricted/transient, or a source that is no
  // longer registered) withholds only the slots containing that item, never the whole publication.
  const withheld = new Set(ctx.run.checkpoint.withheld ?? []);
  const connections = new Map();
  while (index < ids.length) {
    if (processed >= ctx.workLimit || Date.now() + 15000 > ctx.deadline)
      return false;
    const [item] = await ctx.db
      .select()
      .from(s.feedItems)
      .where(eq(s.feedItems.id, ids[index]));
    if (item && !item.fixture) {
      const source = ctx.registry.find((e) => e.id === item.source);
      if (!source || !source.enabled) withheld.add(item.id);
      else if (source.deletionPolicy !== "none") {
        // One paced connection per source, with a recheck budget separate from its page budget.
        if (!connections.has(source.id))
          connections.set(
            source.id,
            sourceHttp(
              { ...source, maxRequests: Math.max(source.maxRequests ?? 0, RECHECK_REQUESTS) },
              { deadline: ctx.deadline, signal: ctx.signal, stats: {} },
            ),
          );
        let verdict;
        try {
          verdict = await source.recheck(item, {
            http: connections.get(source.id),
            credentials: Object.fromEntries(
              [...source.requiredCredentials, ...(source.optionalCredentials ?? [])]
                .map((k) => [k, process.env[k]])
                .filter(([, v]) => v),
            ),
          });
        } catch (error) {
          if (["deadline", "lease_lost"].includes(error.code)) throw error;
          verdict = { state: "transient", scope: error.code ?? "recheck_failed" };
        }
        if (verdict.state === "removed")
          await ctx.db.execute(
            sql`UPDATE feed_items SET visibility='gone',reason=${verdict.scope === "ineligible_labels" ? "source_labels" : "creator_removed"} WHERE id=${item.id} AND ${fence(ctx.run)}`,
          );
        else if (verdict.state === "present")
          await ctx.db.execute(
            sql`UPDATE feed_items SET safety=jsonb_set(safety,'{recheckedAt}',to_jsonb(now())) WHERE id=${item.id} AND ${fence(ctx.run)}`,
          );
        else withheld.add(item.id);
      }
    }
    index++;
    processed++;
    await checkpointRun(ctx.db, ctx.run, {
      recheckIndex: index,
      withheld: [...withheld],
    });
  }
  await publishEditions(ctx.db, ctx.build, ctx.run, { withheld });
  await assertLease(ctx.db, ctx.run);
  await pruneFeeds(ctx.db);
  // Saved copies are rechecked here and again in maintenance (~12 h apart), meeting 24 h deadlines.
  if (ctx.build.mode !== "fixture" && Date.now() + 30000 < ctx.deadline) {
    try {
      const { recheckSavedCopies } = await import("./storage.js");
      await recheckSavedCopies(ctx.db, { registry: ctx.registry, deadline: ctx.deadline, limit: 40 });
    } catch (error) {
      if (["deadline", "lease_lost"].includes(error.code)) throw error;
    }
  }
  return true;
}

export async function runStage(
  db,
  {
    buildId,
    stage,
    config = feedConfig(),
    workLimit = config.workLimits?.[stage] ?? 60,
    providerFactory,
    registry: providedRegistry,
  } = {},
) {
  // Admin diagnostics are bounded probes and run while the live switch is still off. Scheduled
  // entry points (cron, continuations, catch-up) check `enabled` themselves before calling this.
  if (!config.enabled && !config.manualRuns && !config.fixtureMode && stage !== "diagnostics")
    return { outcome: "disabled" };
  const [build] = await db
    .select()
    .from(s.feedBuilds)
    .where(eq(s.feedBuilds.id, buildId));
  if (!build) throw new FeedError("build_not_found", 404);
  if (build.mode === "fixture" && !feedConfig().fixtureMode)
    throw new FeedError("fixtures_disabled", 403);
  const run = await claimStage(db, build, stage);
  if (run.outcome !== "claimed") return run;
  const deadline = Date.now() + config.deadlineMs,
    signal = AbortSignal.timeout(config.deadlineMs);
  try {
    const registry =
      providedRegistry ??
      (await sourceRegistry({ fixtures: build.mode === "fixture" }));
    const provider = providerFactory
      ? providerFactory(run)
      : build.mode === "fixture"
        ? createFixtureProvider()
        : createProvider({ db, run, config, deadline, signal, registry });
    const ctx = {
      db,
      build,
      run,
      registry,
      provider,
      config,
      deadline,
      signal,
      workLimit,
      settings: await getFeedSettings(db),
    };
    const done = stage.startsWith("fetch-")
      ? await collect(ctx)
      : stage === "check"
        ? await check(ctx)
        : stage === "plan-write"
          ? await planWrite(ctx)
          : stage === "publish"
            ? await publish(ctx)
            : await extensions[stage](ctx);
    if (!(await finishStage(db, run, { status: done ? "done" : "pending" })))
      return { outcome: "superseded" };
    return {
      outcome: done ? "completed" : "checkpointed",
      buildId,
      stage,
      checkpoint: run.checkpoint,
    };
  } catch (error) {
    const code = error instanceof FeedError ? error.code : "stage_failed";
    if (!(error instanceof FeedError))
      console.error(
        "[feeds] stage",
        stage,
        error?.name,
        String(error?.message ?? "")
          .replace(/([?&](?:key|api_key|access_token|token|password)=)[^&\s]+/gi, "$1<redacted>")
          .replace(/Bearer\s+[\w.-]+/gi, "Bearer <redacted>")
          .slice(0, 160),
      );
    const pending = [
      "paused_for_budget",
      "request_limit",
      "unknown_model_price",
      "request_uncertain",
    ].includes(code)
      ? "paused"
      : ["deadline", "invocation_request_limit"].includes(code)
        ? "pending"
        : "failed";
    if (!(await finishStage(db, run, { status: pending, error: code })))
      return { outcome: "superseded" };
    return {
      outcome:
        pending === "paused"
          ? "paused_for_budget"
          : pending === "pending"
            ? "checkpointed"
            : "failed",
      reason: code,
      buildId,
      stage,
    };
  }
}
export async function nextStage(db, buildId) {
  const runs = await db
    .select()
    .from(s.feedRuns)
    .where(eq(s.feedRuns.buildId, buildId));
  return (
    STAGES.find(
      (stage) => !runs.some((r) => r.stage === stage && r.status === "done"),
    ) ?? null
  );
}
/**
 * The throttled part of catch-up: after 07:00 Singapore, at most once per five minutes, find the
 * next unfinished stage. Callers either run it now (`catchUp`) or in the background (private route).
 */
export async function claimCatchUp(
  db,
  { now = new Date(), config = feedConfig() } = {},
) {
  if (!config.enabled && !config.fixtureMode) return { outcome: "disabled" };
  if (zonedParts(now).hour < 7) return { outcome: "before_catchup_window" };
  const claimed =
    await db.execute(sql`INSERT INTO feed_controls(key,until) VALUES ('catchup',${new Date(now.getTime() + 5 * 60000).toISOString()}::timestamptz)
    ON CONFLICT(key) DO UPDATE SET until=excluded.until WHERE feed_controls.until<=${now.toISOString()}::timestamptz RETURNING key`);
  if (!rows(claimed).length) return { outcome: "rate_limited" };
  let build;
  try {
    build = await createBuild(db, localDay(now), { mode: config.fixtureMode ? "fixture" : "live" });
  } catch (error) {
    // A local fixture session alongside a live build for the same day: nothing to catch up on, and
    // her page must never see an error for it.
    if (error.code === "build_mode_mismatch") return { outcome: "build_mode_mismatch" };
    throw error;
  }
  const stage = await nextStage(db, build.id);
  return stage
    ? { outcome: "claimed", buildId: build.id, stage }
    : { outcome: "completed", buildId: build.id };
}
export async function catchUp(
  db,
  { now = new Date(), config = feedConfig() } = {},
) {
  const claim = await claimCatchUp(db, { now, config });
  return claim.outcome === "claimed"
    ? runStage(db, { buildId: claim.buildId, stage: claim.stage, config })
    : claim;
}
