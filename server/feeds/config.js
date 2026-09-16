import { env } from "../env.js";

const bounded = (value, fallback, max) => {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) && n >= 0
    ? Math.min(n, max)
    : fallback;
};

export function feedConfig() {
  const hosted = Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || env.isProd,
  );
  return {
    enabled: process.env.FEEDS_ENABLED === "true",
    // FEEDS_ENABLED=manual: the owner can run stages from admin (e.g. a reviewed first real edition)
    // while cron runs, continuations and page catch-up stay off.
    manualRuns: ["true", "manual"].includes(process.env.FEEDS_ENABLED),
    fixtureMode:
      process.env.FEEDS_FIXTURE_MODE === "true" && !hosted && !env.databaseUrl,
    hosted,
    apiKey: env.openaiApiKey,
    model: process.env.OPENAI_FEED_MODEL || "gpt-5.6-luna",
    fallbackModel:
      process.env.OPENAI_FEED_FALLBACK_MODEL || "gpt-5.4-mini-2026-03-17",
    monthlyLimitMicros: Math.floor(
      bounded(process.env.FEED_MONTHLY_BUDGET_USD, 5, 100) * 1_000_000,
    ),
    // Soft daily pacing inside the monthly ceiling: at most twice an average day (Singapore day), so
    // one busy night (a backlog or repeated catch-up) cannot spend the month. Production diagnostics
    // and owner tools are outside it but still inside the monthly ceiling.
    dailyLimitMicros: Math.floor(
      (bounded(process.env.FEED_MONTHLY_BUDGET_USD, 5, 100) * 1_000_000 * 2) / 30,
    ),
    // Paid inspection stops at this share of the daily limit so the writer keeps room the same day.
    checkDailyShare: 0.7,
    // Paid (image, moving-media, meme) checks queued per build, by the items most likely to be
    // planned in each section. Unchecked items stay pending for the next build.
    checkQuotas: { maomao: 45, music: 35, dressup: 45, meme: 40, merch: 45 },
    // Provider requests (including free moderation and retries) per stage INVOCATION. Each claim
    // resets this counter; `stageRequestCaps` bounds the cumulative total per build and stage.
    maxRequests: Math.floor(
      bounded(process.env.FEED_MAX_REQUESTS_PER_RUN, 60, 120),
    ),
    stageRequestCaps: {
      "fetch-a": 40,
      "fetch-b": 40,
      check: 720,
      "plan-write": 90,
      publish: 40,
      events: 40,
      maintenance: 80,
      diagnostics: 8,
      "admin-tools": 40,
    },
    // Items/sections/rechecks processed per invocation; stages checkpoint before the deadline.
    workLimits: {
      "fetch-a": 400,
      "fetch-b": 400,
      check: 120,
      "plan-write": 5,
      publish: 400,
      events: 60,
      maintenance: 200,
      diagnostics: 10,
    },
    // Initial paid-probe allowance for production diagnostics, inside the monthly feed ceiling.
    diagnosticsAllowanceMicros: 500_000,
    maxItems: 60,
    // Authenticated self-continuations per build and stage (see routes/feeds.js).
    maxContinuations: 16,
    maxInputBytes: 24_000,
    maxOutputTokens: 2400,
    deadlineMs: 270_000,
  };
}

export const STAGES = ["fetch-a", "fetch-b", "check", "plan-write", "publish"];
// Independent stages keyed to the day's build but outside the daily dependency chain.
export const INDEPENDENT_STAGES = ["events", "maintenance", "diagnostics", "admin-tools"];
export const SECTIONS = ["maomao", "music", "dressup", "meme", "merch"];
export const SIGNATURE = "✦ kiriya.love";
export const FOUNDATION_VERSION = "feeds-v1";

export class FeedError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "FeedError";
    this.code = code;
    this.status = status;
  }
}
