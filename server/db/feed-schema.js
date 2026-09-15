import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  date,
  uuid,
  index,
  primaryKey,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

const stamp = (name) => timestamp(name, { withTimezone: true });
const created = () => stamp("created_at").notNull().defaultNow();
const json = (name, fallback) => jsonb(name).notNull().default(fallback);

// Compact aliases are permanent. They intentionally have no cascading payload foreign key.
export const feedIdentities = pgTable(
  "feed_identities",
  {
    key: text("key").primaryKey(),
    canonicalId: text("canonical_id").notNull(),
    seenAt: stamp("seen_at"),
    hiddenAt: stamp("hidden_at"),
    hiddenBy: text("hidden_by"),
    createdAt: created(),
  },
  (t) => [index("feed_identity_canonical").on(t.canonicalId)],
);

export const feedItems = pgTable(
  "feed_items",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    nativeId: text("native_id").notNull(),
    sections: json("sections", []),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    media: json("media", []),
    credit: json("credit", {}),
    tags: json("tags", {}),
    facts: json("facts", {}),
    identityKeys: json("identity_keys", []),
    safety: json("safety", {}),
    safetyStatus: text("safety_status").notNull().default("pending"),
    visibility: text("visibility").notNull().default("active"),
    reason: text("reason"),
    hiddenBy: text("hidden_by"),
    score: real("score"),
    blurb: jsonb("blurb"),
    fixture: boolean("fixture").notNull().default(false),
    publishedAt: stamp("published_at"),
    fetchedAt: stamp("fetched_at").notNull().defaultNow(),
    expiresAt: stamp("expires_at"),
  },
  (t) => [
    uniqueIndex("feed_item_native").on(t.source, t.nativeId),
    index("feed_item_eligibility").on(t.safetyStatus, t.visibility),
    index("feed_item_expiry").on(t.expiresAt),
  ],
);

export const feedBuilds = pgTable(
  "feed_builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day").notNull(),
    generation: integer("generation").notNull(),
    mode: text("mode").notNull(),
    tasteRevision: text("taste_revision").notNull(),
    taste: json("taste", {}),
    state: text("state").notNull().default("building"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("feed_build_generation").on(t.day, t.generation)],
);

export const feedEditions = pgTable(
  "feed_editions",
  {
    buildId: uuid("build_id").notNull(),
    section: text("section").notNull(),
    day: date("day").notNull(),
    revision: text("revision").notNull(),
    tasteRevision: text("taste_revision").notNull(),
    state: text("state").notNull().default("staged"),
    slots: json("slots", []),
    reserve: json("reserve", []),
    meta: json("meta", {}),
    publishedAt: stamp("published_at"),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.buildId, t.section] }),
    index("feed_edition_read").on(t.section, t.state, t.day),
  ],
);

export const feedSeen = pgTable("feed_seen", {
  itemId: text("item_id").primaryKey(),
  firstSeenAt: stamp("first_seen_at").notNull().defaultNow(),
});

export const feedRuns = pgTable(
  "feed_runs",
  {
    buildId: uuid("build_id").notNull(),
    stage: text("stage").notNull(),
    day: date("day").notNull(),
    status: text("status").notNull().default("pending"),
    leaseToken: uuid("lease_token"),
    leaseUntil: stamp("lease_until"),
    attempt: integer("attempt").notNull().default(0),
    checkpoint: json("checkpoint", {}),
    stats: json("stats", {}),
    startedAt: stamp("started_at"),
    finishedAt: stamp("finished_at"),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.buildId, t.stage] })],
);

export const feedSourceHealth = pgTable("feed_source_health", {
  source: text("source").primaryKey(),
  status: text("status").notNull(),
  lastOkAt: stamp("last_ok_at"),
  lastErrorAt: stamp("last_error_at"),
  lastError: text("last_error"),
  lastCount: integer("last_count").notNull().default(0),
  failStreak: integer("fail_streak").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  requests: integer("requests").notNull().default(0),
});

export const feedBudgets = pgTable("feed_budgets", {
  month: text("month").primaryKey(),
  committedMicros: bigint("committed_micros", { mode: "number" })
    .notNull()
    .default(0),
});
export const feedUsage = pgTable("feed_usage", {
  id: uuid("id").primaryKey(),
  requestKey: text("request_key").notNull().unique(),
  month: text("month").notNull(),
  buildId: uuid("build_id").notNull(),
  stage: text("stage").notNull(),
  purpose: text("purpose").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("reserved"),
  reservedMicros: integer("reserved_micros").notNull(),
  chargedMicros: integer("charged_micros").notNull(),
  usage: json("usage", {}),
  prices: json("prices", {}),
  result: jsonb("result"),
  createdAt: created(),
  settledAt: stamp("settled_at"),
});
export const feedControls = pgTable("feed_controls", {
  key: text("key").primaryKey(),
  until: stamp("until").notNull(),
});

// Save snapshots/identity remain valid after feed payload pruning. No binaries and no cascading FK.
export const saves = pgTable("saves", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalId: text("canonical_id").notNull().unique(),
  itemId: text("item_id"),
  identityKeys: json("identity_keys", []),
  source: text("source").notNull(),
  kind: text("kind").notNull(),
  sections: json("sections", []),
  title: text("title").notNull(),
  url: text("url").notNull(),
  credit: json("credit", {}),
  snapshot: json("snapshot", {}),
  copyPolicy: text("copy_policy").notNull().default("link_only"),
  copyState: text("copy_state").notNull().default("link_only"),
  copyToken: uuid("copy_token"),
  copyLeaseUntil: stamp("copy_lease_until"),
  copyAttempts: integer("copy_attempts").notNull().default(0),
  reservedBytes: integer("reserved_bytes").notNull().default(0),
  blobPath: text("blob_path"),
  bytes: integer("bytes").notNull().default(0),
  contentType: text("content_type"),
  copyError: text("copy_error"),
  lastCheckedAt: stamp("last_checked_at"),
  removedAt: stamp("removed_at"),
  note: text("note"),
  createdAt: created(),
});
export const feedStorage = pgTable("feed_storage", {
  key: text("key").primaryKey(),
  reservedBytes: bigint("reserved_bytes", { mode: "number" })
    .notNull()
    .default(0),
  copyBytes: bigint("copy_bytes", { mode: "number" }).notNull().default(0),
  totalStoreBytes: bigint("total_store_bytes", { mode: "number" }),
  measuredAt: stamp("measured_at"),
});
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
});
