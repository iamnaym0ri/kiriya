// Bounded background continuation on Vercel. A checkpointed stage asks the SAME production
// deployment to continue via an authenticated request; the callee acknowledges immediately and
// works inside its own function lifetime (waitUntil shares that invocation's 300 s limit). Durable
// leases/checkpoints stay the source of truth, so a lost continuation only waits for the next cron
// hour or catch-up. Continuations are capped per build and stage.
import { sql } from "drizzle-orm";
import { env } from "../env.js";
import { feedConfig, STAGES } from "./config.js";
import { rows } from "./repository.js";

/** Runs a promise beyond the response when the platform supports it; otherwise just lets it run. */
export async function background(promise) {
  const guarded = Promise.resolve(promise).catch((error) =>
    console.error("[feeds] background", error?.code ?? error?.name ?? "error"),
  );
  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(guarded);
  } catch {
    // Local development: the promise keeps running in this long-lived process.
  }
  return guarded;
}

/**
 * Where continuations go. Production uses the production domain (preview deployment URLs sit behind
 * deployment protection). Local development calls the dev server. Anything else: no continuation.
 */
export function continuationBase() {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (!process.env.VERCEL && !env.isProd && env.siteUrl?.startsWith("http://localhost"))
    return env.siteUrl;
  return null;
}

/** Atomically consumes one continuation allowance for (build, stage). */
export async function claimContinuation(db, buildId, stage, config = feedConfig()) {
  const result = await db.execute(sql`UPDATE feed_runs SET stats=stats||jsonb_build_object('continuations',coalesce((stats->>'continuations')::integer,0)+1)
    WHERE build_id=${buildId}::uuid AND stage=${stage} AND coalesce((stats->>'continuations')::integer,0)<${config.maxContinuations}
      AND status<>'done' RETURNING stage`);
  return rows(result).length > 0;
}

export async function requestContinuation(db, { buildId, stage, fetchImpl = fetch, config = feedConfig() }) {
  const base = continuationBase();
  if (!base || !env.cronSecret) return { scheduled: false, reason: "no_continuation_target" };
  if (STAGES.includes(stage) || ["events", "maintenance"].includes(stage)) {
    // The next stage of the chain may not have a run row yet; only cap existing rows.
    const [existing] = rows(
      await db.execute(sql`SELECT 1 FROM feed_runs WHERE build_id=${buildId}::uuid AND stage=${stage}`),
    );
    if (existing && !(await claimContinuation(db, buildId, stage, config)))
      return { scheduled: false, reason: "continuation_cap" };
  }
  try {
    const response = await fetchImpl(`${base}/api/jobs/feeds/${stage}/continue`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ buildId }),
      signal: AbortSignal.timeout(10000),
    });
    return { scheduled: response.status === 202, status: response.status };
  } catch {
    return { scheduled: false, reason: "continuation_unreachable" };
  }
}

/** After a stage invocation: continue the same stage or start the next one in the chain. */
export async function afterStage(db, result, deps = {}) {
  if (!result?.buildId || !result.stage) return { next: null };
  if (result.outcome === "checkpointed")
    return { next: result.stage, ...(await requestContinuation(db, { buildId: result.buildId, stage: result.stage, ...deps })) };
  const index = STAGES.indexOf(result.stage);
  if (result.outcome === "completed" && index >= 0 && index < STAGES.length - 1)
    return { next: STAGES[index + 1], ...(await requestContinuation(db, { buildId: result.buildId, stage: STAGES[index + 1], ...deps })) };
  return { next: null };
}
