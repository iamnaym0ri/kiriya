// Phase 6, events & merch (docs/refactor/PLAN.md §6, docs/refactor/EVENTS-API.md).
// The Railway worker (worker/**) writes these tables; the API (server/routes/events.js) reads them.
// `events` predates phase 6 (the weekly OpenAI events stage, the widget's "Next con"); its original
// columns keep their meaning so the widget and the old /me/events keep working.
import { boolean, date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const stamp = (name) => timestamp(name, { withTimezone: true });
const created = () => stamp("created_at").notNull().defaultNow();
const json = (name, fallback) => jsonb(name).notNull().default(fallback);

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  country: text("country"),
  venue: text("venue"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  tier: text("tier"),
  url: text("url").notNull(),
  sourceUrl: text("source_url"),
  confidence: text("confidence").notNull().default("unconfirmed"),
  dateEvidence: json("date_evidence", {}),
  lastVerifiedAt: stamp("last_verified_at"),
  pageHash: text("page_hash"),
  status: text("status").notNull().default("upcoming"),
  tags: json("tags", []),
  hers: boolean("hers").notNull().default(false),
  // Phase 6. kind: con | fair | popup | merch | concert | cafe | other.
  kind: text("kind").notNull().default("con"),
  tagline: text("tagline"),
  fandoms: json("fandoms", []),
  // A big item: a con, pop-up or merch tied to her fandoms. Big news about it is pushed at once.
  big: boolean("big").notNull().default(false),
  // The structured dossier, its sources and timeline (lib/events/dossier.js DossierSchema).
  dossier: json("dossier", {}),
  // Latest weather and train snapshots for the event days, written by the worker.
  weather: jsonb("weather"),
  transit: jsonb("transit"),
  image: jsonb("image"),
  // Where the event first came from: descriptor | crawler | instagram | link | newsletter | owner | fixture.
  origin: text("origin").notNull().default("descriptor"),
  firstSeenAt: stamp("first_seen_at").notNull().defaultNow(),
  updatedAt: stamp("updated_at").notNull().defaultNow(),
  investigatedAt: stamp("investigated_at"),
});

// The update log. One row per change she can see ("tickets are on sale"); also the push outbox:
// `push` is instant | digest | none, `pushedAt` when it went out (or was folded into a digest).
export const eventLog = pgTable(
  "event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    at: stamp("at").notNull().defaultNow(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    text: text("text").notNull().default(""),
    sourceIds: json("source_ids", []),
    big: boolean("big").notNull().default(false),
    push: text("push").notNull().default("digest"),
    pushedAt: stamp("pushed_at"),
    pushResult: jsonb("push_result"),
    createdAt: created(),
  },
  (t) => [index("event_log_event_at").on(t.eventId, t.at), index("event_log_push").on(t.push, t.pushedAt)],
);

// Everything that might be news: a changed source page, an Instagram post, a pasted link, a newsletter.
// The worker triages each (Haiku), then investigates the ones that matter (Opus).
export const eventSignals = pgTable(
  "event_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    origin: text("origin").notNull(), // crawler | instagram | link | newsletter | refresh
    sourceId: text("source_id"),
    url: text("url"),
    title: text("title"),
    excerpt: text("excerpt"),
    payload: json("payload", {}),
    // Dedupe key: one signal per (origin, item). A changed item gets a new hash.
    hash: text("hash").notNull(),
    status: text("status").notNull().default("queued"),
    triage: jsonb("triage"),
    eventId: text("event_id"),
    message: text("message"),
    attempts: integer("attempts").notNull().default(0),
    by: text("by"),
    createdAt: created(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_signals_hash").on(t.hash), index("event_signals_status").on(t.status, t.createdAt)],
);

// The Claude spend ledger: one row per API call, priced in micro-dollars. The month's total is
// checked before every call; at the ceiling the worker pauses instead of overspending.
export const eventSpend = pgTable(
  "event_spend",
  {
    id: serial("id").primaryKey(),
    at: stamp("at").notNull().defaultNow(),
    month: text("month").notNull(), // YYYY-MM in UTC (Anthropic bills by UTC month)
    day: date("day").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(), // triage | investigate | refresh
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    webSearches: integer("web_searches").notNull().default(0),
    microUsd: integer("micro_usd").notNull().default(0),
    signalId: uuid("signal_id"),
    eventId: text("event_id"),
    dryRun: boolean("dry_run").notNull().default(false),
  },
  (t) => [index("event_spend_month").on(t.month)],
);

// Per-event quick lookup of the merch items in dossiers is computed on read; there is no table.
export const EVENT_TABLES = ["events", "event_log", "event_signals", "event_spend"];
