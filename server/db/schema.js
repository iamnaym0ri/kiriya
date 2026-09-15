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

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Small key/value settings edited from admin: signature, public profile, notification preferences…
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
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

// Her daily check-in. `mood` is an opaque key; its labels live in server content.
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

export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  pathname: text("pathname"),
  prompt: text("prompt"),
  width: integer("width"),
  height: integer("height"),
  createdAt: createdAt(),
});

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
