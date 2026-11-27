// Claude for the events engine: Haiku 5.5 triages, Opus 5.5 investigates (PLAN.md §6).
// Every call passes the spend gate first and is written to the ledger after; with no
// ANTHROPIC_API_KEY (or EVENTS_DRY_RUN=1) a stand-in answers instead and nothing is billed.
import { canSpend, recordSpend } from "./spend.js";

export const MODELS = { triage: "claude-haiku-5-5", investigate: "claude-opus-5-5" };

export class BudgetPaused extends Error {
  constructor(gate) {
    super(`events budget paused: ${gate.reason}`);
    this.code = "budget_paused";
    this.gate = gate;
  }
}

export const dryRunOn = () => process.env.EVENTS_DRY_RUN === "1" || !process.env.ANTHROPIC_API_KEY;

let sdk;
async function realClient() {
  if (!sdk) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // Long investigations run several server-side tool rounds; give them room.
    sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 9 * 60_000 });
  }
  return sdk;
}

/**
 * `responder(params, {purpose})` stands in for the API in dry runs and tests: it returns a Messages
 * API response object (`content`, `stop_reason`, `usage`, `model`).
 */
export function claudeFor(db, { responder = null, dryRun = responder ? true : dryRunOn(), now = () => new Date() } = {}) {
  async function call({ purpose, params, signalId = null, eventId = null }) {
    const gate = await canSpend(db, purpose === "triage" ? "triage" : purpose, { now: now() });
    if (!gate.ok && !dryRun) throw new BudgetPaused(gate);
    let response;
    if (dryRun) {
      response = await (responder ?? builtInResponder)(params, { purpose });
    } else {
      const client = await realClient();
      const { betas, ...rest } = params;
      response = betas?.length ? await client.beta.messages.create({ ...rest, betas }) : await client.messages.create(rest);
    }
    const spent = await recordSpend(db, { model: response.model ?? params.model, purpose, usage: response.usage ?? {}, signalId, eventId, dryRun, now: now() });
    return { response, spent };
  }
  return { call, dryRun };
}

// ---------------------------------------------------------------------------------------------
// Dry-run stand-in: lets the whole pipeline run locally with no key. It never invents facts: it
// only repeats what the signal itself says, with no dates, so every result shows as "dates tbc".
// ---------------------------------------------------------------------------------------------

const usage = (input, output) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } });

function lastUserText(params) {
  const last = [...params.messages].reverse().find((m) => m.role === "user");
  const content = typeof last?.content === "string" ? last.content : (last?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return content;
}

export async function builtInResponder(params, { purpose }) {
  const input = lastUserText(params);
  const signal = (() => {
    try {
      return JSON.parse(input.match(/<signal>\s*([\s\S]*?)\s*<\/signal>/)?.[1] ?? "{}");
    } catch {
      return {};
    }
  })();
  if (purpose === "triage") {
    const { prefilterMatch, fandomsIn } = await import("./fandoms.js");
    const hay = `${signal.title ?? ""} ${signal.excerpt ?? ""} ${signal.caption ?? ""}`;
    const relevant = prefilterMatch(hay);
    const verdict = { verdict: relevant ? "new" : "not_event", eventId: null, singapore: relevant, name: signal.title ?? null, kind: null, startsOn: null, fandoms: fandomsIn(hay), importance: "normal", change: null, investigate: relevant, reason: "dry run: keyword check only" };
    return { model: params.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(verdict) }], usage: usage(1200, 80) };
  }
  // Investigation: if the last turn was a tool result, finish.
  const draft = {
    isEvent: Boolean(signal.title),
    reason: "dry run: no research was done",
    event: signal.title
      ? { name: String(signal.title).slice(0, 160), kind: "other", tagline: "details still to come", startsOn: null, endsOn: null, datesTbc: true, venueName: null, city: "Singapore", fandoms: [], tags: [], officialUrl: null, cancelled: false }
      : null,
    dossier: signal.title
      ? { about: { summary: { text: String(signal.excerpt || signal.caption || signal.title).slice(0, 600), sourceIds: ["s1"] }, like: null, highlights: [] }, days: [], datesNote: { text: "dates not confirmed yet", sourceIds: [] }, venue: null, tickets: { status: "tbc", opensAt: null, buyUrl: null, tiers: [], note: null }, links: [], guests: [], merch: [], size: null, tips: [], popup: null }
      : null,
    timeline: [],
    sources: signal.url && /^https:\/\//.test(signal.url) ? [{ id: "s1", label: String(signal.title ?? "the post").slice(0, 160), url: signal.url, kind: signal.origin === "instagram" ? "social" : signal.origin === "newsletter" ? "newsletter" : "news", publisher: null, at: null, images: signal.images ?? [] }] : [],
  };
  return { model: params.model, stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_dry", name: "submit_dossier", input: draft }], usage: usage(4000, 600) };
}
