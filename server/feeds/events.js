// Weekly events stage: verified event pages (conditional reads, structured data, grounded extraction
// with verbatim date evidence), bounded next-edition probes, the weekly web-search scout (≤5 tool
// calls), lexicon refresh, and expiry. Dates are accepted only when the exact date text, including
// its year, appears in cited evidence; everything else stays TBC.
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema.js";
import { addDays } from "../lib/time.js";
import { FeedError } from "./config.js";
import { checkpointRun, registerEventsStage } from "./jobs.js";
import { jsonSql, rows } from "./repository.js";
import { sourceHttp } from "./http.js";
import { VoiceLexiconSchema } from "./settings.js";

const PHASES = ["seed", "pages", "probes", "scout", "lexicon", "expire"];
export const NEWS_DOMAINS = ["animenewsnetwork.com", "soranews24.com", "animecorner.me", "crunchyroll.com"];

const ExtractSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            name: z.string().max(160),
            startsOn: z.string().nullable(),
            endsOn: z.string().nullable(),
            venue: z.string().max(200).nullable(),
            city: z.string().max(100).nullable(),
            evidenceText: z.string().max(600),
            datePrecision: z.enum(["day", "month", "year", "unknown"]),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
const ScoutSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            name: z.string().max(160),
            city: z.string().max(100),
            country: z.string().max(100),
            startsOn: z.string().nullable(),
            endsOn: z.string().nullable(),
            venue: z.string().max(200).nullable(),
            sourceUrl: z.string().max(600),
            evidenceText: z.string().max(600),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
const LexiconCheckSchema = z
  .object({ keep: z.array(z.object({ term: z.string().max(80), reason: z.string().max(120) }).strict()).max(30) })
  .strict();

const isoDay = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
export const eventId = (descriptorId, startsOn, name) =>
  `${descriptorId}:${startsOn ? startsOn.slice(0, 4) : createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 8)}`;

async function loadModules() {
  const events = await import("./events/sources.js");
  const lexicon = await import("./lexicon-sources.js");
  return { events, lexicon };
}

async function pageState(db) {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "events_pages"));
  return row?.value ?? {};
}
async function savePageState(db, state, run) {
  await db.execute(sql`INSERT INTO settings(key,value) VALUES ('events_pages',${jsonSql(state)})
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`);
}

/** Upserts a verified or TBC event. Owner-confirmed rows keep their confirmed dates. */
export async function upsertEvent(db, descriptor, candidate, { confidence, evidence, now = new Date() }) {
  const startsOn = isoDay(candidate.startsOn);
  const endsOn = isoDay(candidate.endsOn) ?? startsOn;
  const id = eventId(descriptor.id, startsOn, candidate.name ?? descriptor.name);
  await db.execute(sql`INSERT INTO events(id,name,city,country,venue,starts_on,ends_on,tier,url,source_url,confidence,date_evidence,last_verified_at,status,tags,hers)
    VALUES (${id},${candidate.name ?? descriptor.name},${candidate.city ?? descriptor.city ?? null},${descriptor.country ?? null},${candidate.venue ?? null},
      ${startsOn}::date,${endsOn}::date,${descriptor.tier},${descriptor.officialUrl ?? candidate.sourceUrl},${evidence?.sourceUrl ?? null},${confidence},
      ${jsonSql(evidence ?? {})},${now.toISOString()}::timestamptz,'upcoming',${jsonSql(descriptor.tags ?? [])},${Boolean(descriptor.hers)})
    ON CONFLICT(id) DO UPDATE SET
      name=CASE WHEN events.confidence='owner_confirmed' THEN events.name ELSE excluded.name END,
      venue=CASE WHEN events.confidence='owner_confirmed' THEN events.venue ELSE coalesce(excluded.venue,events.venue) END,
      starts_on=CASE WHEN events.confidence='owner_confirmed' THEN events.starts_on ELSE coalesce(excluded.starts_on,events.starts_on) END,
      ends_on=CASE WHEN events.confidence='owner_confirmed' THEN events.ends_on ELSE coalesce(excluded.ends_on,events.ends_on) END,
      confidence=CASE WHEN events.confidence='owner_confirmed' THEN events.confidence
        WHEN excluded.starts_on IS NULL THEN events.confidence ELSE excluded.confidence END,
      date_evidence=CASE WHEN events.confidence='owner_confirmed' OR excluded.starts_on IS NULL THEN events.date_evidence ELSE excluded.date_evidence END,
      last_verified_at=excluded.last_verified_at, hers=events.hers OR excluded.hers
    WHERE events.status<>'hidden'`);
  return id;
}

/**
 * Dates verified against the official (or listing) page and recorded with verbatim evidence in the
 * descriptor. This covers pages the weekly reader may not fetch (a PDF-only release, or terms that
 * forbid automated reads). Idempotent; owner-confirmed rows keep their dates; past editions are skipped.
 */
export async function seedVerifiedEvents(ctx, mods) {
  const { EVENT_SOURCES, verbatimDateEvidence } = mods.events;
  let seeded = 0;
  for (const descriptor of EVENT_SOURCES) {
    const v = descriptor.verified;
    if (!v?.startsOn || !["official", "listing"].includes(v.confidence)) continue;
    if ((v.endsOn ?? v.startsOn) < ctx.build.day) continue;
    if (!verbatimDateEvidence(v.evidence?.text ?? "", { startsOn: v.startsOn, endsOn: v.endsOn })) continue;
    await upsertEvent(
      ctx.db,
      descriptor,
      { name: descriptor.name, startsOn: v.startsOn, endsOn: v.endsOn, venue: v.venue ?? null },
      { confidence: v.confidence, evidence: { ...v.evidence, verified: true, seeded: true } },
    );
    seeded++;
  }
  return { seeded };
}

async function readPages(ctx, mods, state) {
  const { EVENT_SOURCES, readEventPage, verbatimDateEvidence, eventHttpPolicy } = mods.events;
  let index = ctx.run.checkpoint.index ?? 0;
  const results = ctx.run.checkpoint.results ?? { pages: 0, notModified: 0, accepted: 0, tbc: 0, failed: 0 };
  while (index < EVENT_SOURCES.length) {
    if (Date.now() + 40000 > ctx.deadline) return false;
    const descriptor = EVENT_SOURCES[index];
    // The descriptor's policy honours each site's robots crawl delay.
    const http = sourceHttp(eventHttpPolicy(descriptor), { deadline: ctx.deadline, signal: ctx.signal });
    for (const page of descriptor.pages ?? []) {
      if (page.kind === "probe") continue;
      results.pages++;
      try {
        const read = await readEventPage(descriptor, page, http, state[page.url] ?? {});
        state[page.url] = { etag: read.etag ?? null, lastModified: read.lastModified ?? null, pageHash: read.pageHash ?? state[page.url]?.pageHash ?? null, modified: read.modified ?? null, checkedAt: new Date().toISOString(), status: read.status };
        if (read.status === "not_modified") {
          results.notModified++;
          await ctx.db.execute(sql`UPDATE events SET last_verified_at=now() WHERE id LIKE ${`${descriptor.id}:%`} AND status='upcoming'`);
          continue;
        }
        for (const candidate of read.structured ?? []) {
          const ok = candidate.startsOn && verbatimDateEvidence(candidate.evidence?.text ?? "", { startsOn: candidate.startsOn, endsOn: candidate.endsOn });
          await upsertEvent(ctx.db, descriptor, ok ? candidate : { ...candidate, startsOn: null, endsOn: null }, {
            confidence: ok ? (descriptor.confidence ?? "official") : "unconfirmed",
            evidence: { ...candidate.evidence, method: candidate.evidence?.method ?? "structured", verified: Boolean(ok) },
          });
          ok ? results.accepted++ : results.tbc++;
        }
        const excerpts = (read.textExcerpts ?? []).slice(0, 6);
        if (!(read.structured ?? []).length && excerpts.length && ctx.provider?.extract) {
          const extracted = await ctx.provider.extract({
            key: `${descriptor.id}:${read.pageHash ?? "page"}`,
            schema: z.toJSONSchema(ExtractSchema),
            instructions: `Extract the event "${descriptor.name}" (${descriptor.city}, ${descriptor.country}) and any dated edition of it. startsOn/endsOn as YYYY-MM-DD only if the exact date including the year is written in the evidence; otherwise null. evidenceText must be copied exactly from one excerpt.`,
            data: { event: descriptor.name, excerpts },
          });
          const parsed = ExtractSchema.safeParse(extracted);
          for (const candidate of parsed.success ? parsed.data.events : []) {
            const quoted = excerpts.some((e) => e.text.includes(candidate.evidenceText));
            const ok = quoted && candidate.startsOn && verbatimDateEvidence(candidate.evidenceText, { startsOn: candidate.startsOn, endsOn: candidate.endsOn });
            await upsertEvent(ctx.db, descriptor, ok ? candidate : { ...candidate, startsOn: null, endsOn: null }, {
              confidence: ok ? (descriptor.confidence ?? "official") : "unconfirmed",
              evidence: { text: candidate.evidenceText.slice(0, 600), sourceUrl: excerpts.find((e) => e.text.includes(candidate.evidenceText))?.sourceUrl ?? page.url, method: "grounded-extraction", verified: Boolean(ok) },
            });
            ok ? results.accepted++ : results.tbc++;
          }
        }
      } catch (error) {
        if (["deadline", "lease_lost", "paused_for_budget", "request_limit", "invocation_request_limit", "request_uncertain"].includes(error.code)) throw error;
        results.failed++;
        state[page.url] = { ...(state[page.url] ?? {}), checkedAt: new Date().toISOString(), status: "failed", error: error.code ?? "error" };
      }
    }
    index++;
    await savePageState(ctx.db, state, ctx.run);
    await checkpointRun(ctx.db, ctx.run, { phase: "pages", index, results, summary: ctx.run.checkpoint.summary });
  }
  ctx.run.checkpoint.results = results;
  return true;
}

async function probes(ctx, mods, state) {
  const { EVENT_SOURCES, probeNextEdition } = mods.events;
  if (typeof probeNextEdition !== "function") return { skipped: true };
  const found = [];
  for (const descriptor of EVENT_SOURCES.filter((d) => d.edition?.pattern)) {
    if (Date.now() + 30000 > ctx.deadline) break;
    const http = sourceHttp(
      { id: `events-probe-${descriptor.id}`, hosts: descriptor.hosts, mediaHosts: [], maxRequests: 2, maxBytes: 512 * 1024, paceMs: 1500, timeoutMs: 12000 },
      { deadline: ctx.deadline, signal: ctx.signal },
    );
    try {
      const probe = await probeNextEdition(descriptor, http);
      if (probe?.exists) {
        found.push({ id: descriptor.id, url: probe.url });
        state[`probe:${descriptor.id}`] = { url: probe.url, checkedAt: new Date().toISOString() };
      }
    } catch {
      // A failed probe is simply retried next week.
    }
  }
  await savePageState(ctx.db, state, ctx.run);
  return { found };
}

async function scout(ctx, mods) {
  if (!ctx.provider?.search) return { skipped: "provider_unavailable" };
  const { EVENT_SOURCES, verbatimDateEvidence } = mods.events;
  const officialHosts = [...new Set(EVENT_SOURCES.flatMap((d) => d.hosts))];
  const allowed = [...new Set([...officialHosts.map((h) => h.replace(/^www\./, "")), ...NEWS_DOMAINS])].slice(0, 100);
  const result = await ctx.provider.search({
    key: `weekly:${ctx.build.day}`,
    schema: z.toJSONSchema(ScoutSchema),
    instructions:
      "Find anime, cosplay and Vocaloid/Project SEKAI events in Singapore, plus major regional anime/cosplay conventions in Asia, happening in the next 150 days. Only include an event when a cited page states it. startsOn/endsOn as YYYY-MM-DD only if the exact date with year appears in evidenceText copied from that page; otherwise null. sourceUrl must be the cited page.",
    data: { today: ctx.build.day, focus: "Singapore first; big regional events second" },
    allowedDomains: allowed,
    maxToolCalls: 5,
  });
  const parsed = ScoutSchema.safeParse(result?.value);
  const cited = new Set([...(result?.sources ?? []), ...(result?.citations ?? []).map((c) => c.url)]);
  const out = { proposed: 0, verified: 0, tbc: 0 };
  for (const candidate of parsed.success ? parsed.data.events : []) {
    out.proposed++;
    let host = "";
    try {
      host = new URL(candidate.sourceUrl).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!cited.has(candidate.sourceUrl) && ![...cited].some((u) => u.startsWith(candidate.sourceUrl))) continue;
    const descriptor = EVENT_SOURCES.find((d) => d.hosts.includes(host)) ?? {
      id: `scout-${createHash("sha256").update(candidate.name.toLowerCase()).digest("hex").slice(0, 10)}`,
      name: candidate.name,
      tier: /singapore/i.test(candidate.city + candidate.country) ? "sg" : "regional",
      city: candidate.city,
      country: candidate.country,
      hosts: [host],
      officialUrl: candidate.sourceUrl,
    };
    // Scout output is never trusted alone: dates are kept only after re-reading an allowlisted page.
    let verified = false;
    if (officialHosts.includes(host) && candidate.startsOn) {
      try {
        const http = sourceHttp({ id: "events-scout-verify", hosts: officialHosts, mediaHosts: [], maxRequests: 1, maxBytes: 1024 * 1024, paceMs: 0, timeoutMs: 15000 }, { deadline: ctx.deadline });
        // Decodes the page's declared charset (e.g. Shift_JIS/EUC-JP) and renders text like the reader.
        const page = await mods.events.fetchPageText(http, candidate.sourceUrl);
        verified = page.text.includes(candidate.evidenceText) && verbatimDateEvidence(candidate.evidenceText, { startsOn: candidate.startsOn, endsOn: candidate.endsOn });
      } catch {
        verified = false;
      }
    }
    await upsertEvent(ctx.db, descriptor, verified ? candidate : { ...candidate, startsOn: null, endsOn: null }, {
      confidence: verified ? "listing" : "unconfirmed",
      evidence: { text: candidate.evidenceText.slice(0, 600), sourceUrl: candidate.sourceUrl, method: "weekly-scout", verified },
    });
    verified ? out.verified++ : out.tbc++;
  }
  return out;
}

async function lexicon(ctx, mods) {
  const { fetchLexiconCandidates, filterLexiconTerms, lexiconSourceEntry } = mods.lexicon;
  const http = sourceHttp(lexiconSourceEntry, { deadline: ctx.deadline, signal: ctx.signal });
  const since = addDays(ctx.build.day, -7);
  const { terms = [], errors = [] } = await fetchLexiconCandidates(http, { since });
  const filtered = filterLexiconTerms(terms).slice(0, 40);
  if (!filtered.length || !ctx.provider?.extract) return { candidates: terms.length, filtered: filtered.length, kept: 0, errors };
  const checked = await ctx.provider.extract({
    purpose: "lexicon",
    key: `lexicon:${ctx.build.day}`,
    schema: z.toJSONSchema(LexiconCheckSchema),
    instructions:
      "From the candidate slang terms, keep only terms that are current, widely understood Gen Z internet slang or anime meme formats, not brainrot (e.g. skibidi-style), not crude, sexual, political, hateful or about real people, and suitable for a playful, deadpan note to an adult anime/Vocaloid/cosplay fan. Keep the exact term spelling.",
    data: { candidates: filtered.map((t) => t.term) },
  });
  const parsed = LexiconCheckSchema.safeParse(checked);
  const keep = (parsed.success ? parsed.data.keep : []).map((k) => k.term).filter((t) => filtered.some((f) => f.term === t));
  const [row] = await ctx.db.select().from(s.settings).where(eq(s.settings.key, "voice_lexicon"));
  const current = VoiceLexiconSchema.safeParse(row?.value);
  const base = current.success ? current.data : { formats: ["pov:", "me when", "nobody: / kiriya:"], fresh: [] };
  const next = { formats: base.formats, fresh: [...new Set([...keep, ...base.fresh])].slice(0, 30) };
  const valid = VoiceLexiconSchema.safeParse(next);
  if (valid.success)
    await ctx.db.execute(sql`INSERT INTO settings(key,value) VALUES ('voice_lexicon',${jsonSql({ ...valid.data, refreshedAt: undefined })})
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`);
  return { candidates: terms.length, filtered: filtered.length, kept: keep.length, errors: errors.length };
}

export async function runEvents(ctx) {
  const mods = await loadModules();
  const state = await pageState(ctx.db);
  let phase = PHASES.indexOf(ctx.run.checkpoint.phase ?? "seed");
  if (phase < 0) phase = 0;
  const summary = { ...(ctx.run.checkpoint.summary ?? {}) };
  while (phase < PHASES.length) {
    const name = PHASES[phase];
    try {
      if (name === "seed") summary.seed = await seedVerifiedEvents(ctx, mods);
      else if (name === "pages") {
        if (!(await readPages(ctx, mods, state))) return false;
        summary.pages = ctx.run.checkpoint.results;
      } else if (name === "probes") summary.probes = await probes(ctx, mods, state);
      else if (name === "scout") summary.scout = await scout(ctx, mods);
      else if (name === "lexicon") summary.lexicon = await lexicon(ctx, mods);
      else if (name === "expire") {
        const expired = await ctx.db.execute(sql`UPDATE events SET status='past'
          WHERE status='upcoming' AND coalesce(ends_on,starts_on) < ${ctx.build.day}::date RETURNING id`);
        summary.expired = rows(expired).length;
      }
    } catch (error) {
      if (["deadline", "lease_lost", "invocation_request_limit"].includes(error.code)) throw error;
      summary[name] = { outcome: "failed", reason: error.code ?? error.name ?? "error" };
    }
    phase++;
    await checkpointRun(ctx.db, ctx.run, { phase: PHASES[phase] ?? "done", index: 0, summary });
  }
  return true;
}

registerEventsStage((ctx) => runEvents(ctx));
export { FeedError };
