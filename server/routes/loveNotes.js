import { Hono } from "hono";
import { z } from "zod";
import { getDb, schema } from "../db/client.js";
import { notificationSettings, qstashConfigured } from "../push/planner.js";
import { pushConfigured } from "../push/webpush.js";
import {
  NOTE_BODY_MAX,
  NOTE_KINDS,
  NOTE_TITLE_MAX,
  cancelLoveNote,
  createLoveNote,
  deliverLoveNote,
  inbox,
  openLoveNote,
  recentLoveNotes,
  scheduleLoveNote,
  surpriseTime,
  sweepLoveNotes,
} from "../lib/loveNotes.js";

const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

/** Sends a note now, or schedules it; shared by the note composer and letter announcements. */
export async function sendOrSchedule(db, fields) {
  const note = await createLoveNote(db, fields);
  if (note.sendAt.getTime() <= Date.now()) return { note: (await deliverLoveNote(db, note.id)) ?? note, schedule: null };
  const schedule = await scheduleLoveNote(note).catch(() => ({ scheduled: false, error: "The scheduler didn’t accept it; the daily backstop will still deliver it." }));
  return { note, schedule };
}

// ---------- admin desk ----------

export const adminLoveNoteRoutes = new Hono();

const composeBody = z.object({
  recipient: z.enum(["kiriya", "admin"]),
  kind: z.enum(NOTE_KINDS).default("note"),
  title: z.string().trim().min(1).max(NOTE_TITLE_MAX),
  body: z.string().trim().min(1).max(NOTE_BODY_MAX),
  when: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("now") }),
    z.object({ mode: z.literal("at"), at: z.string().datetime({ offset: true }) }),
    z.object({ mode: z.literal("surprise") }),
  ]),
});

adminLoveNoteRoutes.get("/", async (c) => {
  const db = await getDb();
  const [notes, settings, devices] = await Promise.all([
    recentLoveNotes(db),
    notificationSettings(db),
    db.select({ role: schema.pushSubscriptions.role }).from(schema.pushSubscriptions),
  ]);
  return c.json({
    notes,
    window: { startHour: settings.startHour, endHour: settings.endHour, enabled: settings.enabled },
    devices: { kiriya: devices.filter((d) => d.role === "kiriya").length, admin: devices.filter((d) => d.role === "admin").length },
    push: pushConfigured(),
    scheduler: qstashConfigured(),
  });
});

adminLoveNoteRoutes.post("/", async (c) => {
  const parsed = composeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ error: "bad_note", message: `A title up to ${NOTE_TITLE_MAX} characters, a note up to ${NOTE_BODY_MAX}, and when to send it.` }, 400);
  const { when, ...fields } = parsed.data;
  const db = await getDb();
  let sendAt = new Date();
  if (when.mode === "at") {
    sendAt = new Date(when.at);
    if (sendAt.getTime() < Date.now() - 60_000 || sendAt.getTime() > Date.now() + MAX_AHEAD_MS)
      return c.json({ error: "bad_time", message: "Pick a time from now up to three months ahead." }, 400);
  } else if (when.mode === "surprise") {
    sendAt = surpriseTime(await notificationSettings(db));
  }
  return c.json(await sendOrSchedule(db, { ...fields, sendAt }));
});

adminLoveNoteRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That note doesn’t exist." }, 404);
  const note = await cancelLoveNote(await getDb(), id);
  return note ? c.json({ note }) : c.json({ error: "not_pending", message: "That note was already sent or canceled." }, 409);
});

adminLoveNoteRoutes.post("/sweep", async (c) => c.json(await sweepLoveNotes(await getDb())));

// ---------- the recipient's own notes ----------

export const meLoveNoteRoutes = new Hono();

meLoveNoteRoutes.get("/", async (c) => c.json(await inbox(await getDb(), c.get("session").role)));

meLoveNoteRoutes.post("/:id/open", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
  const note = await openLoveNote(await getDb(), c.get("session").role, id);
  return note ? c.json({ note }) : c.json({ error: "not_found", message: "That note couldn’t be found." }, 404);
});
