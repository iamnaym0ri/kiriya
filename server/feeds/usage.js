import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { feedUsage } from "../db/schema.js";
import { localDay, zonedInstant } from "../lib/time.js";
import { FeedError } from "./config.js";
import { fence, jsonSql, rows } from "./repository.js";

// USD per million tokens; a token at this rate costs the same number of microdollars.
// Sources and verification date are recorded in docs/feeds/SETUP.md. Unknown models fail closed.
export const DEFAULT_PRICES = {
  "gpt-5.6-luna": {
    asOf: "2026-09-15",
    input: 0.2,
    cached: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    search: 10000,
  },
  "gpt-5.4-mini-2026-03-17": {
    asOf: "2026-09-15",
    input: 0.75,
    cached: 0.075,
    cacheWrite: 0.75,
    output: 4.5,
    search: 10000,
  },
  "omni-moderation-latest": {
    asOf: "2026-09-15",
    input: 0,
    cached: 0,
    cacheWrite: 0,
    output: 0,
    search: 0,
  },
};
const priceSchema = z.record(
  z.string().max(100),
  z
    .object({
      asOf: z.string().date(),
      input: z.number().min(0),
      cached: z.number().min(0),
      cacheWrite: z.number().min(0),
      output: z.number().min(0),
      search: z.number().min(0),
    })
    .strict(),
);
export function pricesFor(model) {
  let overrides = {};
  if (process.env.FEED_MODEL_PRICES_JSON) {
    try {
      overrides = priceSchema.parse(
        JSON.parse(process.env.FEED_MODEL_PRICES_JSON),
      );
    } catch {
      return null;
    }
  }
  return { ...DEFAULT_PRICES, ...overrides }[model] ?? null;
}
export function requestEstimate(
  prices,
  { inputTokens, outputTokens, searchCalls = 0 },
) {
  return Math.ceil(
    inputTokens * Math.max(prices.input, prices.cached, prices.cacheWrite) +
      outputTokens * prices.output +
      searchCalls * prices.search,
  );
}
export function measuredCost(prices, usage) {
  const input = usage.input_tokens,
    output = usage.output_tokens;
  if (
    !Number.isSafeInteger(input) ||
    input < 0 ||
    !Number.isSafeInteger(output) ||
    output < 0
  )
    return null;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0,
    written = usage.input_tokens_details?.cache_write_tokens ?? 0;
  if (
    !Number.isSafeInteger(cached) ||
    !Number.isSafeInteger(written) ||
    cached < 0 ||
    written < 0 ||
    cached + written > input
  )
    return null;
  return Math.ceil(
    (input - cached - written) * prices.input +
      cached * prices.cached +
      written * prices.cacheWrite +
      output * prices.output +
      (usage.search_calls ?? 0) * prices.search,
  );
}

/** Pipeline spend (charged or still reserved) since Singapore midnight; diagnostics/owner tools excluded. */
export async function spentToday(db, now = new Date()) {
  const since = zonedInstant(localDay(now), 0);
  const [row] = rows(
    await db.execute(sql`SELECT coalesce(sum(charged_micros),0)::bigint AS micros FROM feed_usage
      WHERE created_at>=${since.toISOString()}::timestamptz AND status<>'denied'
        AND purpose NOT LIKE 'diagnostic%' AND stage<>'admin-tools'`),
  );
  return Number(row?.micros ?? 0);
}
const paced = (run, purpose) =>
  !String(purpose).startsWith("diagnostic") && run.stage !== "admin-tools";

export async function reserveRequest(
  db,
  { run, key, model, purpose, estimate, prices, config, now = new Date() },
) {
  const requestKey = `${run.buildId}:${run.stage}:${key}`;
  const [existing] = await db
    .select()
    .from(feedUsage)
    .where(eq(feedUsage.requestKey, requestKey));
  if (existing) {
    if (existing.status === "settled" && existing.result !== null)
      return { cached: existing.result, id: existing.id };
    if (existing.status === "denied") {
      await db
        .delete(feedUsage)
        .where(
          and(eq(feedUsage.id, existing.id), eq(feedUsage.status, "denied")),
        );
      return reserveRequest(db, {
        run,
        key,
        model,
        purpose,
        estimate,
        prices,
        config,
        now,
      });
    }
    throw new FeedError(
      existing.status === "denied" ? "paused_for_budget" : "request_uncertain",
      409,
    );
  }
  // Soft daily pacing (not atomic across concurrent workers; the monthly ceiling below is the hard gate).
  if (
    estimate > 0 &&
    config.dailyLimitMicros &&
    paced(run, purpose) &&
    (await spentToday(db, now)) + estimate > config.dailyLimitMicros
  )
    throw new FeedError("paused_for_budget", 409);
  // Two atomic bounds: requests in this invocation, and the cumulative total for this build/stage.
  const stageCap = config.stageRequestCaps?.[run.stage] ?? config.maxRequests;
  const counter =
    await db.execute(sql`UPDATE feed_runs SET stats=stats||jsonb_build_object(
      'requests',coalesce((stats->>'requests')::integer,0)+1,
      'invocationRequests',coalesce((stats->>'invocationRequests')::integer,0)+1)
    WHERE build_id=${run.buildId}::uuid AND stage=${run.stage} AND ${fence(run)}
      AND coalesce((stats->>'invocationRequests')::integer,0)<${config.maxRequests}
      AND coalesce((stats->>'requests')::integer,0)<${stageCap} RETURNING stage`);
  if (!rows(counter).length) {
    const [current] = rows(
      await db.execute(
        sql`SELECT stats FROM feed_runs WHERE build_id=${run.buildId}::uuid AND stage=${run.stage}`,
      ),
    );
    const used = Number(current?.stats?.requests ?? 0);
    // The cumulative cap pauses the stage; an exhausted invocation simply continues later.
    throw used >= stageCap || config.maxRequests <= 0
      ? new FeedError("request_limit", 429)
      : new FeedError("invocation_request_limit", 429);
  }
  const id = randomUUID(),
    month = localDay(now).slice(0, 7);
  const inserted = await db
    .insert(feedUsage)
    .values({
      id,
      requestKey,
      month,
      buildId: run.buildId,
      stage: run.stage,
      purpose,
      model,
      status: "claiming",
      reservedMicros: estimate,
      chargedMicros: estimate,
      prices,
    })
    .onConflictDoNothing()
    .returning({ id: feedUsage.id });
  if (!inserted.length) throw new FeedError("request_in_progress", 409);
  const money =
    await db.execute(sql`INSERT INTO feed_budgets(month,committed_micros)
    SELECT ${month},${estimate} WHERE ${estimate}::bigint<=${config.monthlyLimitMicros}::bigint AND ${fence(run)}
    ON CONFLICT(month) DO UPDATE SET committed_micros=feed_budgets.committed_micros+excluded.committed_micros
    WHERE feed_budgets.committed_micros+excluded.committed_micros<=${config.monthlyLimitMicros} RETURNING month`);
  if (!rows(money).length) {
    await db
      .update(feedUsage)
      .set({ status: "denied", chargedMicros: 0 })
      .where(eq(feedUsage.id, id));
    throw new FeedError("paused_for_budget", 409);
  }
  await db
    .update(feedUsage)
    .set({ status: "reserved" })
    .where(eq(feedUsage.id, id));
  return { id };
}
export async function settleRequest(
  db,
  id,
  { usage, result, uncertain = false },
) {
  const [entry] = await db.select().from(feedUsage).where(eq(feedUsage.id, id));
  if (!entry) return;
  const cost = uncertain ? null : measuredCost(entry.prices, usage ?? {});
  const charge = cost ?? entry.reservedMicros;
  // Ledger reconciliation is one atomic statement. Unknown/time-out usage keeps the reservation.
  await db.execute(sql`WITH settled AS (UPDATE feed_usage SET status=${uncertain ? "uncertain" : "settled"},charged_micros=${charge},usage=${jsonSql(usage ?? {})},result=${result === undefined ? sql`NULL` : jsonSql(result)},settled_at=now()
    WHERE id=${id}::uuid AND status='reserved' RETURNING month,reserved_micros)
    UPDATE feed_budgets SET committed_micros=committed_micros-${entry.reservedMicros}+${charge} WHERE month IN(SELECT month FROM settled)`);
}
