// The Claude spend ledger and the hard monthly ceiling (PLAN.md: US$20/month; pause, never overspend).
// Every call is priced from its `usage` and written here; before a call, `canSpend` checks that the
// month's total plus the call's worst case stays under the ceiling, and that the month isn't being
// spent faster than it passes (a burst early in the month can't eat the whole budget).
import { desc, eq, sql } from "drizzle-orm";
import { schema } from "../../db/client.js";
import { readSetting, writeSetting } from "./store.js";

export const HARD_CEILING_USD = 20;

// US$ per million tokens (Claude API list prices, 2026-11; see the claude-api skill). Cache writes are
// 1.25× input (5-minute TTL), cache reads as listed. Web search is US$10 per 1,000 searches; web
// fetch costs only the tokens it adds.
export const PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, longInput: 0.5, longOutput: 2.5, longAfter: 100_000 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  // What a server-side refusal fallback may answer with ("fallbacks": "default").
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};
// An unknown model is priced like the dearest Opus above, so the ledger never under-counts.
const FALLBACK_PRICE = PRICES["claude-opus-5"];
export const WEB_SEARCH_USD = 0.01;

// The most a single call may cost; a call is only started when this much is left.
export const RESERVE_USD = { triage: 0.02, investigate: 1.5, refresh: 1.0 };

export const monthOf = (date = new Date()) => date.toISOString().slice(0, 7);
const dayOf = (date = new Date()) => date.toISOString().slice(0, 10);
const daysInMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();

/** Micro-dollars for one response's usage (`usage` as the Messages API returns it). */
export function priceUsage(model, usage = {}) {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  const long = p.longAfter && input + write + read > p.longAfter;
  const inRate = long ? p.longInput : p.input;
  const outRate = long ? p.longOutput : p.output;
  const usd =
    (input * inRate + output * outRate + write * (long ? p.longInput * 1.25 : p.cacheWrite) + read * (long ? p.longInput * 0.1 : p.cacheRead)) / 1e6 +
    searches * WEB_SEARCH_USD;
  return { microUsd: Math.ceil(usd * 1e6), input, output, write, read, searches };
}

/** The ceiling in force: the env/admin value, never above US$20. */
export async function ceilingUsd(db) {
  const asNumber = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));
  const fromEnv = asNumber(process.env.EVENTS_CLAUDE_CEILING_USD);
  const fromAdmin = asNumber((await readSetting(db, "events_budget", {}))?.ceilingUsd);
  const values = [HARD_CEILING_USD, fromEnv, fromAdmin].filter((n) => Number.isFinite(n) && n >= 0);
  return Math.min(...values);
}

export async function monthTotal(db, month = monthOf()) {
  const result = await db.execute(sql`SELECT coalesce(sum(micro_usd),0)::bigint AS total, count(*)::int AS calls FROM event_spend WHERE month=${month} AND dry_run=false`);
  const row = (Array.isArray(result) ? result : result.rows)[0] ?? {};
  return { microUsd: Number(row.total ?? 0), calls: Number(row.calls ?? 0) };
}

/**
 * Whether a call of this purpose may start now. Returns `{ok, reason, spentUsd, ceilingUsd, allowanceUsd}`.
 * reason: "ceiling" (the month's money is gone) or "pace" (wait for tomorrow's share).
 */
export async function canSpend(db, purpose, { now = new Date() } = {}) {
  const ceiling = await ceilingUsd(db);
  const { microUsd } = await monthTotal(db, monthOf(now));
  const spent = microUsd / 1e6;
  const reserve = RESERVE_USD[purpose] ?? 1;
  // Pace: by day d of an n-day month, at most ceiling × d/n plus a US$4 cushion may be gone.
  const allowance = Math.min(ceiling, (ceiling * now.getUTCDate()) / daysInMonth(now) + 4);
  const base = { spentUsd: round(spent), ceilingUsd: ceiling, allowanceUsd: round(allowance) };
  if (spent + reserve > ceiling) return { ok: false, reason: "ceiling", ...base };
  if (spent + reserve > allowance) return { ok: false, reason: "pace", ...base };
  return { ok: true, reason: null, ...base };
}

const round = (n) => Math.round(n * 10000) / 10000;

export async function recordSpend(db, { model, purpose, usage, signalId = null, eventId = null, dryRun = false, now = new Date() }) {
  const priced = priceUsage(model, usage);
  await db.insert(schema.eventSpend).values({
    at: now,
    month: monthOf(now),
    day: dayOf(now),
    model,
    purpose,
    inputTokens: priced.input,
    outputTokens: priced.output,
    cacheWriteTokens: priced.write,
    cacheReadTokens: priced.read,
    webSearches: priced.searches,
    microUsd: priced.microUsd,
    signalId,
    eventId,
    dryRun,
  });
  const total = await monthTotal(db, monthOf(now));
  const ceiling = await ceilingUsd(db);
  if (total.microUsd / 1e6 >= ceiling - RESERVE_USD.triage) await markPaused(db, "ceiling", now);
  return { ...priced, usd: priced.microUsd / 1e6 };
}

export async function markPaused(db, reason, now = new Date()) {
  const current = await readSetting(db, "events_pause", null);
  if (current?.month === monthOf(now) && current.reason === reason) return current;
  return writeSetting(db, "events_pause", { month: monthOf(now), reason, at: now.toISOString() });
}

/** The admin's view of the ledger (GET /api/admin/events/spend). */
export async function spendReport(db, { now = new Date() } = {}) {
  const month = monthOf(now);
  const ceiling = await ceilingUsd(db);
  const { microUsd, calls } = await monthTotal(db, month);
  const spent = microUsd / 1e6;
  const gate = await canSpend(db, "investigate", { now });
  const rowsOf = (r) => (Array.isArray(r) ? r : r.rows);
  const byPurpose = rowsOf(await db.execute(sql`SELECT purpose, model, count(*)::int AS calls, sum(micro_usd)::bigint AS micro, sum(web_searches)::int AS searches
    FROM event_spend WHERE month=${month} AND dry_run=false GROUP BY purpose, model ORDER BY 4 DESC`));
  const days = rowsOf(await db.execute(sql`SELECT day::text AS day, sum(micro_usd)::bigint AS micro FROM event_spend WHERE month=${month} AND dry_run=false GROUP BY day ORDER BY day`));
  const recent = await db.select().from(schema.eventSpend).where(eq(schema.eventSpend.month, month)).orderBy(desc(schema.eventSpend.at)).limit(30);
  const dayOfMonth = now.getUTCDate();
  const projected = dayOfMonth ? (spent / dayOfMonth) * daysInMonth(now) : spent;
  return {
    month,
    ceilingUsd: ceiling,
    spentUsd: round(spent),
    remainingUsd: round(Math.max(0, ceiling - spent)),
    projectedUsd: round(projected),
    calls,
    paused: !gate.ok,
    pausedReason: gate.reason,
    byPurpose: byPurpose.map((r) => ({ purpose: r.purpose, model: r.model, calls: Number(r.calls), usd: Number(r.micro) / 1e6, webSearches: Number(r.searches ?? 0) })),
    days: days.map((r) => ({ day: r.day, usd: Number(r.micro) / 1e6 })),
    recent: recent.map((r) => ({
      at: r.at instanceof Date ? r.at.toISOString() : r.at,
      model: r.model,
      purpose: r.purpose,
      usd: r.microUsd / 1e6,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheWriteTokens: r.cacheWriteTokens,
      webSearches: r.webSearches,
      eventId: r.eventId,
      signalId: r.signalId,
      dryRun: r.dryRun,
    })),
  };
}

export async function setCeiling(db, value) {
  const ceiling = Math.max(0, Math.min(HARD_CEILING_USD, Number(value)));
  await writeSetting(db, "events_budget", { ceilingUsd: ceiling });
  return ceiling;
}

