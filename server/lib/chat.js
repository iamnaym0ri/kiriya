import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "../db/client.js";
import { kiriya } from "../content/kiriya.js";
import { TAPS, tapByKey } from "../../shared/taps.js";
import { STICKER_PACKS } from "../../shared/stickers.js";
import { isUploadUrl } from "./media.js";
import { notificationPreview } from "./loveNotes.js";
import { publish } from "./realtime.js";
import { sendToSubscribers } from "../push/webpush.js";

// The private chat between Kiriya ("kiriya") and Josh ("admin"), docs/refactor/PLAN.md phase 4.

export const ROLES = ["kiriya", "admin"];
export const other = (role) => (role === "kiriya" ? "admin" : "kiriya");
export const TEXT_MAX = 4000;
const PAGE = 40;
const TAPS_PER_HOUR = 30;

export const BUBBLES = ["lilac", "paper", "pixel", "kawaii", "cat", "flowers", "fairy", "gothic", "lovey"];
export const BACKGROUNDS = ["petals", "night", "notebook", "photo", "miku", "maomao"];
export const TYPING = ["hearts", "maomao", "pencil", "dots"];
export const DEFAULT_PREFS = { bubble: "lilac", background: "petals", backgroundUrl: null, typing: "hearts" };

async function settingValue(db, key) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value;
}
/** What each of them is called in notifications: "Josh" (from the signature) and "Kiriya". */
export async function names(db) {
  const signature = (await settingValue(db, "signature")) ?? kiriya.signature;
  return { admin: String(signature).replace(/\s*<3\s*$/, "").trim() || "Josh", kiriya: kiriya.name };
}

// ---------- validation ----------

const giphyUrl = z.string().url().max(600).refine((url) => /^https:\/\/(media\d?|i)\.giphy\.com\//.test(url), "giphy only");
const BUILT_IN = new Set(STICKER_PACKS.flatMap((pack) => pack.stickers.map((sticker) => sticker.url)));
const builtInSticker = z.string().refine((url) => BUILT_IN.has(url), "unknown sticker");
const dims = { width: z.number().int().min(1).max(10000).optional(), height: z.number().int().min(1).max(10000).optional() };
const MEDIA = {
  image: z.object({ url: z.string().refine((u) => isUploadUrl(u, ["chat"])), ...dims, alt: z.string().max(200).optional() }).strict(),
  gif: z.object({ url: giphyUrl, still: giphyUrl.optional(), giphyId: z.string().max(80).optional(), ...dims, alt: z.string().max(200).optional() }).strict(),
  sticker: z.object({ url: z.union([builtInSticker, z.string().refine((u) => isUploadUrl(u, ["stickers"]))]), ...dims, alt: z.string().max(200).optional() }).strict(),
  voice: z
    .object({
      url: z.string().refine((u) => isUploadUrl(u, ["chat"])),
      duration: z.number().min(0.3).max(300),
      peaks: z.array(z.number().min(0).max(1)).max(64).optional(),
      mime: z.string().max(40).optional(),
    })
    .strict(),
};
export const sendSchema = z
  .object({
    clientId: z.string().min(8).max(80).regex(/^[\w-]+$/),
    kind: z.enum(["text", "image", "gif", "sticker", "voice", "tap"]),
    body: z.string().max(TEXT_MAX).default(""),
    media: z.unknown().optional(),
    replyTo: z.string().uuid().nullable().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.kind === "text" && !input.body.trim()) ctx.addIssue({ code: "custom", message: "empty" });
    if (input.kind === "tap" && !tapByKey[input.body]) ctx.addIssue({ code: "custom", message: "unknown tap" });
    if (MEDIA[input.kind] && !MEDIA[input.kind].safeParse(input.media).success) ctx.addIssue({ code: "custom", message: "bad media" });
    if (["image", "gif", "sticker", "voice"].includes(input.kind) && input.body.length > 500) ctx.addIssue({ code: "custom", message: "caption too long" });
  });

// ---------- reading ----------

function shape(row, reactions, replies) {
  const reply = row.replyTo ? replies.get(row.replyTo) : null;
  return {
    id: row.id,
    clientId: row.clientId,
    sender: row.sender,
    kind: row.deletedAt ? "deleted" : row.kind,
    body: row.deletedAt ? "" : row.body,
    media: row.deletedAt ? null : row.media,
    replyTo: reply
      ? { id: reply.id, sender: reply.sender, kind: reply.deletedAt ? "deleted" : reply.kind, body: reply.deletedAt ? "" : reply.body.slice(0, 140) }
      : null,
    reactions: Object.fromEntries(reactions.filter((r) => r.messageId === row.id).map((r) => [r.role, r.emoji])),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}

async function decorate(db, rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const replyIds = [...new Set(rows.map((r) => r.replyTo).filter(Boolean))];
  const [reactions, replies] = await Promise.all([
    db.select().from(schema.chatReactions).where(inArray(schema.chatReactions.messageId, ids)),
    replyIds.length ? db.select().from(schema.chatMessages).where(inArray(schema.chatMessages.id, replyIds)) : [],
  ]);
  const byId = new Map(replies.map((r) => [r.id, r]));
  return rows.map((row) => shape(row, reactions, byId));
}

export async function readState(db) {
  const rows = await db.select().from(schema.chatReads);
  return Object.fromEntries(ROLES.map((role) => [role, rows.find((r) => r.role === role)?.readAt.toISOString() ?? null]));
}

/**
 * A page of the conversation, oldest first. `before` pages back through history; `after` catches up
 * from the newest message the phone already has (also used by the polling fallback).
 */
export async function listMessages(db, { before = null, after = null, limit = PAGE } = {}) {
  if (after) {
    const rows = await db
      .select()
      .from(schema.chatMessages)
      .where(gt(schema.chatMessages.createdAt, new Date(after)))
      .orderBy(asc(schema.chatMessages.createdAt))
      .limit(200);
    return { messages: await decorate(db, rows), next: null };
  }
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(before ? lt(schema.chatMessages.createdAt, new Date(before)) : undefined)
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(limit + 1);
  const more = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return { messages: await decorate(db, page), next: more ? page[0].createdAt.toISOString() : null };
}

export async function unreadMessages(db, role) {
  const reads = await readState(db);
  const since = reads[role] ? new Date(reads[role]) : new Date(0);
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.sender, other(role)), gt(schema.chatMessages.createdAt, since), isNull(schema.chatMessages.deletedAt)));
  return unread;
}

/** For the letters hub's Messages door and the app badge: unread count and the latest message. */
export async function chatSummary(db, role) {
  const [[last], unread] = await Promise.all([
    db.select().from(schema.chatMessages).orderBy(desc(schema.chatMessages.createdAt)).limit(1),
    unreadMessages(db, role),
  ]);
  return {
    unread,
    last: last
      ? { sender: last.sender, kind: last.deletedAt ? "deleted" : last.kind, body: last.deletedAt ? "" : last.body.slice(0, 120), createdAt: last.createdAt.toISOString() }
      : null,
  };
}

// ---------- writing ----------

export function chatNotification(message, from) {
  const preview = {
    text: notificationPreview(message.body, 140),
    image: "📷 sent you a photo",
    gif: "sent you a GIF",
    sticker: "sent you a sticker",
    voice: "🎙️ sent you a voice note",
  };
  if (message.kind === "tap") {
    const tap = tapByKey[message.body];
    return { title: tap.push.replace("{from}", from), body: "tap to send one back ♡", navigate: "/world/chat", kind: "tap", threadId: "chat", messageId: message.id };
  }
  const body = message.kind === "text" ? preview.text : message.body ? `${preview[message.kind]}: ${notificationPreview(message.body, 100)}` : preview[message.kind];
  return { title: from, body, navigate: "/world/chat", kind: "chat", threadId: "chat", messageId: message.id };
}

/**
 * Sends a message from `role`. Idempotent on clientId. Then, in the background (`after`), tells the
 * other person's phones and the live channel. Returns the stored message.
 */
export async function sendMessage(db, role, input, { after = (task) => task(), now = new Date() } = {}) {
  const data = sendSchema.parse(input);
  if (data.kind === "tap") {
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(schema.chatMessages)
      .where(and(eq(schema.chatMessages.sender, role), eq(schema.chatMessages.kind, "tap"), gte(schema.chatMessages.createdAt, new Date(now.getTime() - 3600_000))));
    if (recent >= TAPS_PER_HOUR) throw Object.assign(new Error("That's a lot of love for one hour ♡ try again in a bit."), { status: 429 });
  }
  if (data.replyTo) {
    const [target] = await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(eq(schema.chatMessages.id, data.replyTo));
    if (!target) data.replyTo = null;
  }
  const [inserted] = await db
    .insert(schema.chatMessages)
    .values({ clientId: data.clientId, sender: role, kind: data.kind, body: data.kind === "text" ? data.body.trim() : data.body, media: data.media ?? null, replyTo: data.replyTo ?? null, createdAt: now })
    .onConflictDoNothing({ target: schema.chatMessages.clientId })
    .returning();
  let row = inserted;
  if (!row) {
    [row] = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.clientId, data.clientId));
    if (row.sender !== role) throw Object.assign(new Error("conflict"), { status: 409 });
    return (await decorate(db, [row]))[0];
  }
  // Sending counts as having read everything up to now.
  await markRead(db, role, now, { quiet: true });
  const [message] = await decorate(db, [row]);
  const from = (await names(db))[role];
  await after(() =>
    Promise.allSettled([
      publish("message", { id: message.id, sender: role, at: message.createdAt }),
      sendToSubscribers(db, chatNotification(message, from), { role: other(role), ttlSeconds: 24 * 3600 }),
    ]),
  );
  return message;
}

export async function deleteMessage(db, role, id) {
  const [row] = await db
    .update(schema.chatMessages)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.chatMessages.id, id), eq(schema.chatMessages.sender, role), isNull(schema.chatMessages.deletedAt)))
    .returning({ id: schema.chatMessages.id });
  if (row) await publish("deleted", { id });
  return Boolean(row);
}

export async function react(db, role, messageId, emoji) {
  const [message] = await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(eq(schema.chatMessages.id, messageId));
  if (!message) return null;
  if (!emoji) await db.delete(schema.chatReactions).where(and(eq(schema.chatReactions.messageId, messageId), eq(schema.chatReactions.role, role)));
  else
    await db
      .insert(schema.chatReactions)
      .values({ messageId, role, emoji })
      .onConflictDoUpdate({ target: [schema.chatReactions.messageId, schema.chatReactions.role], set: { emoji, createdAt: new Date() } });
  await publish("reaction", { messageId, role, emoji: emoji ?? null });
  return { messageId, role, emoji: emoji ?? null };
}

/** Moves the read marker forward (never back). */
export async function markRead(db, role, at = new Date(), { quiet = false } = {}) {
  await db.execute(sql`INSERT INTO chat_reads(role, read_at) VALUES (${role}, ${at.toISOString()}::timestamptz)
    ON CONFLICT(role) DO UPDATE SET read_at = GREATEST(chat_reads.read_at, excluded.read_at)`);
  if (!quiet) await publish("read", { role, at: at.toISOString() });
  return readState(db);
}

// ---------- typing without Ably (polling fallback) ----------

export async function setTyping(db, role, now = new Date()) {
  const value = { at: now.toISOString() };
  await db.insert(schema.kv).values({ key: `chat:typing:${role}`, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: now } });
}
export async function typingOf(db, role, now = new Date()) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, `chat:typing:${role}`));
  return Boolean(row && now.getTime() - Date.parse(row.value.at) < 6000);
}

// ---------- preferences ----------

const prefsSchema = z
  .object({
    bubble: z.enum(BUBBLES).optional(),
    background: z.enum(BACKGROUNDS).optional(),
    backgroundUrl: z.string().refine((u) => isUploadUrl(u, ["backgrounds"])).nullable().optional(),
    typing: z.enum(TYPING).optional(),
  })
  .strict();
export async function readPrefs(db, role) {
  const [row] = await db.select().from(schema.chatPrefs).where(eq(schema.chatPrefs.role, role));
  return { ...DEFAULT_PREFS, ...(row?.prefs ?? {}) };
}
export async function savePrefs(db, role, input) {
  const next = { ...(await readPrefs(db, role)), ...prefsSchema.parse(input) };
  await db
    .insert(schema.chatPrefs)
    .values({ role, prefs: next })
    .onConflictDoUpdate({ target: schema.chatPrefs.role, set: { prefs: next, updatedAt: new Date() } });
  return next;
}

// ---------- stickers they upload ----------

export async function listStickers(db) {
  return db.select().from(schema.chatStickers).orderBy(desc(schema.chatStickers.createdAt));
}
export async function addSticker(db, role, { url, label = "" }) {
  if (!isUploadUrl(url, ["stickers"])) throw Object.assign(new Error("bad sticker"), { status: 400 });
  const [row] = await db.insert(schema.chatStickers).values({ url, label: String(label).slice(0, 60), createdBy: role }).returning();
  return row;
}
export async function removeSticker(db, id) {
  const [row] = await db.delete(schema.chatStickers).where(eq(schema.chatStickers.id, id)).returning({ id: schema.chatStickers.id });
  return Boolean(row);
}

// ---------- our memories ----------

async function snapshotOf(db, role, kind, sourceId) {
  if (kind === "message") {
    const [row] = await db.select().from(schema.chatMessages).where(and(eq(schema.chatMessages.id, sourceId), isNull(schema.chatMessages.deletedAt)));
    return row && { sender: row.sender, kind: row.kind, body: row.body, media: row.media, at: row.createdAt.toISOString() };
  }
  if (kind === "note") {
    // Little notes: only ones delivered to whoever is saving it (or sent by Josh, when he saves).
    const [row] = await db.select().from(schema.loveNotes).where(eq(schema.loveNotes.id, sourceId));
    if (!row || (role === "kiriya" && row.recipient !== "kiriya")) return null;
    return { title: row.title, body: row.body, at: (row.sentAt ?? row.sendAt).toISOString() };
  }
  if (kind === "letter") {
    const [row] = await db.select().from(schema.letters).where(eq(schema.letters.id, sourceId));
    if (!row || (row.unlockAt && row.unlockAt > new Date())) return null;
    return { title: row.title, body: row.body, at: row.createdAt.toISOString() };
  }
  if (kind === "jar") {
    const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, `notejar:pull:${sourceId}`));
    return row && { label: row.value.note.label, text: row.value.note.text, byline: row.value.note.byline, at: row.value.at };
  }
  return null;
}
const memoryKind = z.enum(["message", "note", "letter", "jar"]);
export async function addMemory(db, role, { kind, sourceId, caption = "" }) {
  memoryKind.parse(kind);
  if (typeof sourceId !== "string" || sourceId.length > 80) throw Object.assign(new Error("bad source"), { status: 400 });
  const snapshot = await snapshotOf(db, role, kind, sourceId);
  if (!snapshot) throw Object.assign(new Error("That can't be saved."), { status: 404 });
  const [row] = await db
    .insert(schema.memories)
    .values({ savedBy: role, kind, sourceId, snapshot, caption: String(caption).slice(0, 300) })
    .onConflictDoNothing({ target: [schema.memories.kind, schema.memories.sourceId] })
    .returning();
  if (row) return row;
  const [existing] = await db.select().from(schema.memories).where(and(eq(schema.memories.kind, kind), eq(schema.memories.sourceId, sourceId)));
  return existing;
}
export async function listMemories(db, { before = null, limit = 30 } = {}) {
  const rows = await db
    .select()
    .from(schema.memories)
    .where(before ? lt(schema.memories.createdAt, new Date(before)) : undefined)
    .orderBy(desc(schema.memories.createdAt))
    .limit(limit + 1);
  return { items: rows.slice(0, limit), next: rows.length > limit ? rows[limit - 1].createdAt.toISOString() : null };
}
export async function removeMemory(db, id) {
  const [row] = await db.delete(schema.memories).where(eq(schema.memories.id, id)).returning({ id: schema.memories.id });
  return Boolean(row);
}

export { TAPS };
