import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export * from "./feed-schema.js";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Small key/value settings edited from admin: signature, public profile, notification preferences…
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// A passphrase changed from settings. `hash` null means the Vercel-configured phrase still applies;
// `session_key` is stamped into that role's sessions, so replacing it signs out other devices.
export const credentials = pgTable("credentials", {
  role: text("role").primaryKey(),
  hash: text("hash"),
  sessionKey: text("session_key").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Profile views per Singapore calendar day.
export const views = pgTable("views", {
  day: date("day").primaryKey(),
  count: integer("count").notNull().default(0),
});

export const unlockAttempts = pgTable(
  "unlock_attempts",
  {
    id: serial("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    ok: boolean("ok").notNull(),
    role: text("role"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("unlock_attempts_ip_at").on(t.ipHash, t.at)],
);

// What each person has chosen, kept until they change it: the current check-in, address
// preferences, what the public profile may show, pinned artwork and small interface choices.
// `person` is the session role, so testing as admin never changes Kiriya's own choices.
export const personState = pgTable("person_state", {
  person: text("person").primaryKey(),
  status: jsonb("status"),
  prefs: jsonb("prefs").notNull().default({}),
  revision: integer("revision").notNull().default(0),
  updatedAt: updatedAt(),
});

// Her check-ins from before person_state, one per day. Read only as a fallback for her status.
// `mood` is an opaque key; its labels live in server content.
export const moods = pgTable("moods", {
  day: date("day").primaryKey(),
  mood: text("mood").notNull(),
  energy: smallint("energy"),
  note: text("note"),
  updatedAt: updatedAt(),
});

// The curated bundle for one Singapore day: cards, fresh finds, push texts, drawer reward.
export const days = pgTable("days", {
  day: date("day").primaryKey(),
  bundle: jsonb("bundle").notNull(),
  writer: text("writer").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Which pool items were used on which day, so nothing repeats too soon.
export const shownItems = pgTable(
  "shown_items",
  {
    itemKey: text("item_key").notNull(),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemKey, t.day] })],
);

// Things fetched from the web by the daily job.
export const sourceItems = pgTable(
  "source_items",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data"),
  },
  (t) => [index("source_items_category_published").on(t.category, t.publishedAt)],
);

export const drawers = pgTable("drawers", {
  day: date("day").primaryKey(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  reward: jsonb("reward").notNull(),
});

export const songs = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // link | upload
  provider: text("provider"), // youtube | spotify | soundcloud | niconico | audio
  url: text("url").notNull(),
  title: text("title"),
  artist: text("artist"),
  thumbnail: text("thumbnail"),
  featured: boolean("featured").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  data: jsonb("data"),
  createdAt: createdAt(),
});

export const letters = pgTable("letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // birthday | open_when | note
  author: text("author").notNull(), // giver | maomao
  title: text("title").notNull(),
  body: text("body").notNull(),
  openWhen: text("open_when"),
  unlockAt: timestamp("unlock_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  // Kiriya's reaction: "heart" or one emoji. The admin preview can't set it.
  reaction: text("reaction"),
  reactedAt: timestamp("reacted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const traits = pgTable("traits", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: createdAt(),
});

export const specialDates = pgTable("special_dates", {
  id: serial("id").primaryKey(),
  month: smallint("month").notNull(),
  dayOfMonth: smallint("day_of_month").notNull(),
  year: smallint("year"),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  message: text("message"),
  createdAt: createdAt(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  role: text("role").notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const plannedPushes = pgTable(
  "planned_pushes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day").notNull(),
    slot: smallint("slot").notNull(),
    kind: text("kind").notNull(), // surprise | special | test
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("planned"), // planned | sending | sent | failed | skipped
    payload: jsonb("payload"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("planned_pushes_day_slot").on(t.day, t.slot)],
);

// Notes sent to someone's phone. Each lands in their private world at `send_at`, whether or not a
// notification could be delivered. `recipient` is a role, so the admin's test notes stay apart.
export const loveNotes = pgTable(
  "love_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipient: text("recipient").notNull(),
    kind: text("kind").notNull().default("note"), // note | update | surprise
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"), // where tapping goes instead of the note itself, e.g. /world/letters
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | sending | sent | failed | canceled
    pushResult: jsonb("push_result"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    // The recipient's reaction: "heart" or one emoji.
    reaction: text("reaction"),
    reactedAt: timestamp("reacted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("love_notes_recipient_send_at").on(t.recipient, t.sendAt), index("love_notes_status_send_at").on(t.status, t.sendAt)],
);

// Revocable keys for the phone widget and Shortcuts, which can't carry the site's cookie.
// Only a hash is stored; the key itself is shown once when it's made.
export const deviceKeys = pgTable("device_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  person: text("person").notNull(),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  pathname: text("pathname"),
  prompt: text("prompt"),
  width: integer("width"),
  height: integer("height"),
  // The admin's reaction to her doodle: "heart" or one emoji.
  reaction: text("reaction"),
  reactedAt: timestamp("reacted_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Little notes the admin leaves on her saved doodles. They show beside the doodle in her gallery;
// `seen_at` is set the first time she opens that doodle.
export const artworkNotes = pgTable(
  "artwork_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("artwork_notes_artwork_created").on(t.artworkId, t.createdAt)],
);

export const cosplayProjects = pgTable("cosplay_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  character: text("character").notNull(),
  series: text("series"),
  status: text("status").notNull().default("dreaming"), // dreaming | planning | building | done
  deadline: date("deadline"),
  budgetCents: integer("budget_cents"),
  spentCents: integer("spent_cents"),
  checklist: jsonb("checklist").notNull().default([]),
  notes: text("notes"),
  coverUrl: text("cover_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const savedLooks = pgTable("saved_looks", {
  id: uuid("id").primaryKey().defaultRandom(),
  look: jsonb("look").notNull(),
  createdAt: createdAt(),
});

// Small bits of per-feature state (quiz streaks, ballet practice log, collected stickers…).
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});
