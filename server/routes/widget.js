import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, eq, gte, ne } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { TAPS, tapByKey } from "../../shared/taps.js";
import { unreadTotals } from "../lib/appBadge.js";
import { background } from "../lib/background.js";
import { chatSummary, names, sendMessage } from "../lib/chat.js";
import { env } from "../env.js";
import { ADDRESS_OPTIONS, ENERGY_LEVELS, FEELINGS, MOODS } from "../content/moods.js";
import { readCheckin, saveCheckin } from "../lib/checkin.js";
import { personForKey } from "../lib/deviceKeys.js";
import { inbox, notificationPreview } from "../lib/loveNotes.js";
import { localDay } from "../lib/time.js";

// For the phone widget and Shortcuts, which can't use the site's cookie. A revocable device key
// (Settings → Phone widget) stands in for the passphrase and reaches only these routes: today's
// status, the latest note, and quick status changes.
export const widgetRoutes = new Hono();

widgetRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  const header = c.req.header("authorization");
  // Some widget apps can only fetch a plain URL, so reads also accept ?key=. Changes need the header.
  const key = header?.startsWith("Bearer ") ? header.slice(7).trim() : c.req.method === "GET" ? c.req.query("key") : null;
  const person = await personForKey(await getDb(), key);
  if (!person) return c.json({ error: "locked", message: "This widget key doesn’t work anymore. Make a new one in Settings." }, 401);
  c.set("person", person);
  await next();
});

const link = (path) => new URL(path, env.siteUrl).toString();
const clean = (text) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

async function snapshot(db, person) {
  const [{ current }, notes] = await Promise.all([readCheckin(db, localDay(), person), inbox(db, person, { limit: 20 })]);
  const latest = notes.notes[0];
  const battery = current ? ENERGY_LEVELS[current.energy] : null;
  return {
    name: "kiriya",
    status: current
      ? {
          presentation: { label: current.label, face: current.face },
          pronouns: current.address.label,
          mood: current.feeling ? { label: current.feeling.label, emoji: current.feeling.emoji } : null,
          battery: { level: current.energy, label: battery.label, face: battery.face },
          since: current.setDay,
          updatedAt: current.setAt,
        }
      : null,
    unread: notes.unread,
    latestNote: latest
      ? { title: latest.title, preview: notificationPreview(latest.body, 180), at: latest.at, opened: Boolean(latest.openedAt) }
      : null,
    links: { world: link("/world"), status: link("/world?quick=status"), notes: link("/world/notes") },
  };
}

widgetRoutes.get("/", async (c) => c.json(await snapshot(await getDb(), c.get("person"))));

/** The newest note as plain words, for a Shortcut's "Show Result". */
widgetRoutes.get("/note", async (c) => {
  const { notes } = await inbox(await getDb(), c.get("person"), { limit: 1 });
  const note = notes[0];
  return c.json({ text: note ? `${note.title}\n\n${note.body}` : "no notes yet ♡", title: note?.title ?? null, body: note?.body ?? null, at: note?.at ?? null });
});

// One flat list for a Shortcut's "Choose from List": every quick change she can make.
const PICKS = [
  ...ENERGY_LEVELS.map((level, index) => ({ text: `🔋 battery · ${level.label}`, change: { energy: index } })),
  ...FEELINGS.map((feeling) => ({ text: `${feeling.emoji} mood · ${feeling.label}`, change: { feeling: feeling.key } })),
  { text: "✕ mood · clear it", change: { feeling: null } },
  ...MOODS.map((mood) => ({ text: `${mood.face} presenting · ${mood.label}`, change: { mood: mood.key } })),
];

widgetRoutes.get("/menu", (c) => c.json({ choices: PICKS.map((pick) => pick.text) }));

function resolve(body) {
  if (body.pick !== undefined) return PICKS.find((pick) => clean(pick.text) === clean(body.pick))?.change ?? null;
  const change = {};
  if (body.presentation !== undefined) {
    const mood = MOODS.find((item) => item.key === body.presentation || clean(item.label) === clean(body.presentation));
    if (!mood) return null;
    change.mood = mood.key;
  }
  if (body.mood !== undefined) {
    if (body.mood === null || ["none", "clear"].includes(clean(body.mood))) change.feeling = null;
    else {
      const feeling = FEELINGS.find((item) => item.key === body.mood || clean(item.label) === clean(body.mood) || clean(`${item.emoji} ${item.label}`) === clean(body.mood));
      if (!feeling) return null;
      change.feeling = feeling.key;
    }
  }
  if (body.battery !== undefined) {
    const number = typeof body.battery === "number" ? body.battery : /^\d$/.test(String(body.battery).trim()) ? Number(body.battery) : null;
    const index = number ?? ENERGY_LEVELS.findIndex((level) => clean(level.label) === clean(body.battery));
    if (!Number.isInteger(index) || index < 0 || index > 4) return null;
    change.energy = index;
  }
  if (body.pronouns !== undefined) {
    if (!Object.hasOwn(ADDRESS_OPTIONS, body.pronouns)) return null;
    change.address = body.pronouns;
  }
  return Object.keys(change).length ? change : null;
}

const statusBody = z
  .object({
    pick: z.string().max(120),
    presentation: z.string().max(40),
    mood: z.string().max(60).nullable(),
    battery: z.union([z.number(), z.string().max(60)]),
    pronouns: z.string().max(20),
  })
  .partial()
  .strict();

widgetRoutes.put("/status", async (c) => {
  const parsed = statusBody.safeParse(await c.req.json().catch(() => null));
  const change = parsed.success ? resolve(parsed.data) : null;
  if (!change) return c.json({ error: "bad_choice", message: "That isn’t one of the choices. Try picking from the list again." }, 400);
  const db = await getDb();
  const person = c.get("person");
  const day = localDay();
  const { current } = await readCheckin(db, day, person);
  const saved = await saveCheckin(
    db,
    day,
    {
      // With nothing chosen yet, a quick change starts from "just me".
      mood: change.mood ?? current?.key ?? "cloud",
      energy: change.energy ?? current?.energy ?? 2,
      ...(change.feeling !== undefined ? { feeling: change.feeling } : {}),
      ...(change.address ? { address: change.address } : {}),
    },
    person,
  );
  const now = saved.current;
  const message =
    change.energy !== undefined ? `social battery: ${ENERGY_LEVELS[now.energy].label} ✓`
    : change.feeling !== undefined ? (now.feeling ? `mood: ${now.feeling.emoji} ${now.feeling.label} ✓` : "mood cleared ✓")
    : change.mood ? `presenting: ${now.label} ✓`
    : `pronouns: ${now.address.label} ✓`;
  return c.json({ message, ...(await snapshot(db, person)) });
});

// ---------- the iPhone app's widgets, notification buttons and Siri (phase 4b) ----------
// The app stores one of these device keys in its App Group when it's set up (lib/appDevices.js), so
// its Home Screen widgets can refresh, and "♡ back" / Reply on a notification can send, without Face ID.

const deep = (path) => `kiriyalove://open${path}`;
const KIND_PREVIEW = { image: "📷 a photo", gif: "a GIF", sticker: "a sticker", voice: "🎙️ a voice note", deleted: "unsent a message" };
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

function chatPreview(last, who, person) {
  if (!last) return null;
  const tap = last.kind === "tap" ? tapByKey[last.body] : null;
  const preview = last.kind === "text" ? notificationPreview(last.body, 120) : tap ? `${tap.emoji} ${tap.label}` : KIND_PREVIEW[last.kind] ?? "a message";
  return { from: who[last.sender], mine: last.sender === person, preview, at: last.createdAt };
}

export async function appSnapshot(db, person) {
  const day = localDay();
  const [who, unread, chat, notes, [event]] = await Promise.all([
    names(db),
    unreadTotals(db, person),
    chatSummary(db, person),
    inbox(db, person, { limit: 1 }),
    db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.status, "upcoming"), eq(schema.events.tier, "sg"), ne(schema.events.confidence, "unconfirmed"), gte(schema.events.startsOn, day)))
      .orderBy(asc(schema.events.startsOn))
      .limit(1),
  ]);
  const latest = notes.notes[0];
  const other = person === "kiriya" ? "admin" : "kiriya";
  return {
    role: person,
    me: who[person],
    other: who[other],
    unread,
    latestNote: latest ? { title: latest.title, preview: notificationPreview(latest.body, 180), at: latest.at, opened: Boolean(latest.openedAt) } : null,
    jar: { fresh: unread.jar },
    chat: { last: chatPreview(chat.last, who, person) },
    nextEvent: event ? { title: event.name, startsOn: event.startsOn, daysAway: Math.round(dayNumber(event.startsOn) - dayNumber(day)), venue: event.venue ?? null } : null,
    taps: TAPS.map(({ key, emoji, label }) => ({ key, emoji, label })),
    links: { world: deep("/world"), chat: deep("/world/chat"), notes: deep("/world/notes"), jar: deep("/world#note-jar"), events: deep("/world#events") },
    updatedAt: new Date().toISOString(),
  };
}

widgetRoutes.get("/app", async (c) => c.json(await appSnapshot(await getDb(), c.get("person"))));

const clientId = z.string().regex(/^[\w-]{8,80}$/);
const tapBody = z.object({ kind: z.enum(TAPS.map((tap) => tap.key)), clientId: clientId.optional() }).strict();
const replyBody = z.object({ text: z.string().trim().min(1).max(2000), replyTo: z.string().uuid().nullable().optional(), clientId: clientId.optional() }).strict();

async function sendFromPhone(c, schemaFor, toMessage) {
  const parsed = schemaFor.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_request", message: "That couldn’t be sent." }, 400);
  try {
    const message = await sendMessage(await getDb(), c.get("person"), { clientId: parsed.data.clientId ?? `w-${randomUUID()}`, ...toMessage(parsed.data) }, { after: background });
    return c.json({ ok: true, id: message.id });
  } catch (error) {
    return c.json({ error: error.status === 429 ? "slow_down" : "bad_request", message: error.status ? error.message : "That couldn’t be sent." }, error.status ?? 400);
  }
}

/** A widget button, "♡ back" on a notification, or Siri: one of the little taps. */
widgetRoutes.post("/tap", (c) => sendFromPhone(c, tapBody, (data) => ({ kind: "tap", body: data.kind })));

/** Reply typed straight into a chat notification. */
widgetRoutes.post("/reply", (c) => sendFromPhone(c, replyBody, (data) => ({ kind: "text", body: data.text, replyTo: data.replyTo ?? null })));
