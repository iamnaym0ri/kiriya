import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "../db/client.js";
import { kiriya } from "../content/kiriya.js";
import { TAPS, tapByKey } from "../../shared/taps.js";
import { STICKER_PACKS } from "../../shared/stickers.js";
import { isUploadUrl } from "./media.js";
import { notificationPreview } from "./loveNotes.js";
import { publish } from "./realtime.js";
import { sendToSubscribers } from "../push/webpush.js";
import { interceptTestSend } from "./appTestMode.js";

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

// Round 3: photos and videos travel as albums (1–10 per message, laid out like Discord's grid), and
// end-to-end encryption (src/lib/chatCrypto.js, owned by chat-room) seals bodies and media. The
// server never inspects sealed data: `enc` (on the message) and `sealed` (on each media entry) are
// opaque, size-capped JSON that is stored and handed back as is.
export const ALBUM_MAX = 10;
export const VIDEO_MAX_SECONDS = 180;
const ENC_MAX = 4096;
const SEALED_MAX = 2048;
const SEALED_BODY_MAX = 16000;
const CAPTION_MAX = 500;
const opaque = (max) => z.custom((value) => value !== undefined && value !== null && JSON.stringify(value).length <= max, "too big");
const sealed = { sealed: opaque(SEALED_MAX).optional() };

const giphyUrl = z.string().url().max(600).refine((url) => /^https:\/\/(media\d?|i)\.giphy\.com\//.test(url), "giphy only");
const BUILT_IN = new Set(STICKER_PACKS.flatMap((pack) => pack.stickers.map((sticker) => sticker.url)));
const builtInSticker = z.string().refine((url) => BUILT_IN.has(url), "unknown sticker");
const chatUpload = z.string().refine((u) => isUploadUrl(u, ["chat"]), "not one of ours");
const dims = { width: z.number().int().min(1).max(10000).optional(), height: z.number().int().min(1).max(10000).optional() };
const alt = { alt: z.string().max(200).optional() };
const mime = { mime: z.string().max(60).optional() };
const poster = z.object({ url: chatUpload, ...dims, ...mime, ...sealed }).strict();
const albumItem = z
  .object({
    type: z.enum(["image", "video"]),
    url: chatUpload,
    ...dims,
    ...alt,
    ...mime,
    ...sealed,
    duration: z.number().min(0).max(VIDEO_MAX_SECONDS + 5).optional(),
    poster: poster.optional(),
  })
  .strict()
  .refine((item) => (item.type === "video" ? item.duration !== undefined : item.duration === undefined && item.poster === undefined), "a video needs its length; a photo has none");
const legacyImage = z.object({ url: chatUpload, ...dims, ...alt, ...mime, ...sealed }).strict();
// While a message is sealed, a GIF's or sticker's link travels inside `sealed` (chat-room's choice).
const sealedOnly = z.object({ ...dims, sealed: opaque(SEALED_MAX) }).strict();
const MEDIA = {
  image: z.union([z.object({ items: z.array(albumItem).min(1).max(ALBUM_MAX) }).strict(), legacyImage]),
  gif: z.object({ url: giphyUrl, mp4: giphyUrl.optional(), webp: giphyUrl.optional(), still: giphyUrl.optional(), giphyId: z.string().max(80).optional(), ...dims, ...alt, ...sealed }).strict(),
  sticker: z.object({ url: z.union([builtInSticker, z.string().refine((u) => isUploadUrl(u, ["stickers"]))]), ...dims, ...alt, ...sealed }).strict(),
  voice: z
    .object({
      url: chatUpload,
      duration: z.number().min(0.3).max(300),
      peaks: z.array(z.number().min(0).max(1)).max(64).optional(),
      ...mime,
      ...sealed,
    })
    .strict(),
};
/** Whether `media` is valid for a message of `kind` (sealed messages may carry gif/sticker links sealed). */
const mediaOk = (kind, media, isSealed) => MEDIA[kind].safeParse(media).success || (isSealed && (kind === "gif" || kind === "sticker") && sealedOnly.safeParse(media).success);

export const sendSchema = z
  .object({
    clientId: z.string().min(8).max(80).regex(/^[\w-]+$/),
    kind: z.enum(["text", "image", "gif", "sticker", "voice", "tap"]),
    body: z.string().max(SEALED_BODY_MAX).default(""),
    media: z.unknown().optional(),
    replyTo: z.string().uuid().nullable().optional(),
    enc: opaque(ENC_MAX).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const isSealed = input.enc !== undefined;
    if (input.kind === "text" && !input.body.trim()) ctx.addIssue({ code: "custom", message: "empty" });
    if (input.kind === "tap" && (isSealed || !tapByKey[input.body])) ctx.addIssue({ code: "custom", message: "unknown tap" });
    if (!isSealed && input.body.length > TEXT_MAX) ctx.addIssue({ code: "custom", message: "too long" });
    if (MEDIA[input.kind] && !mediaOk(input.kind, input.media, isSealed)) ctx.addIssue({ code: "custom", message: "bad media" });
    if (!isSealed && ["image", "gif", "sticker", "voice"].includes(input.kind) && input.body.length > CAPTION_MAX) ctx.addIssue({ code: "custom", message: "caption too long" });
  });

/** An edit: new text for a text message, or a new caption for photos and videos (sealed again when the chat is sealed). */
export const editSchema = z
  .object({
    body: z.string().max(SEALED_BODY_MAX),
    enc: opaque(ENC_MAX).optional(),
    media: z.unknown().optional(),
  })
  .strict();
export const EDITABLE = ["text", "image"];

/** Every file a message's media points at (photos, videos, their posters, voice notes). */
export function mediaUrls(media) {
  if (!media || typeof media !== "object") return [];
  const entries = Array.isArray(media.items) ? media.items : [media];
  return entries.flatMap((entry) => [entry?.url, entry?.poster?.url]).filter((url) => typeof url === "string");
}

// ---------- reading ----------

/** What a quoted message shows above a reply: a line of text and, for media, its first picture. */
function replyPreviewMedia(row) {
  if (!row.media) return null;
  if (row.kind === "image") {
    const items = Array.isArray(row.media.items) ? row.media.items : [{ type: "image", ...row.media }];
    return { items: items.slice(0, 1), count: items.length };
  }
  if (row.kind === "voice") return { duration: row.media.duration };
  return row.media;
}

function shape(row, reactions, replies) {
  const reply = row.replyTo ? replies.get(row.replyTo) : null;
  const replyGone = reply?.deletedAt;
  return {
    id: row.id,
    clientId: row.clientId,
    sender: row.sender,
    kind: row.deletedAt ? "deleted" : row.kind,
    body: row.deletedAt ? "" : row.body,
    media: row.deletedAt ? null : row.media,
    enc: row.deletedAt ? null : (row.enc ?? null),
    replyTo: reply
      ? {
          id: reply.id,
          clientId: reply.clientId,
          sender: reply.sender,
          kind: replyGone ? "deleted" : reply.kind,
          // A sealed body can't be cut short without breaking it, so it travels whole.
          body: replyGone ? "" : reply.enc ? reply.body : reply.body.slice(0, 140),
          media: replyGone ? null : replyPreviewMedia(reply),
          enc: replyGone ? null : (reply.enc ?? null),
        }
      : row.replyTo
        ? { id: row.replyTo, sender: null, kind: "deleted", body: "", media: null, enc: null }
        : null,
    reactions: Object.fromEntries(reactions.filter((r) => r.messageId === row.id).map((r) => [r.role, r.emoji])),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.deletedAt ? null : (row.editedAt?.toISOString() ?? null),
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
    // New messages, plus any edited or deleted since (a live "edited"/"deleted" event, or a phone
    // catching up after a dropped connection, picks those changes up here too).
    const since = new Date(after);
    const rows = await db
      .select()
      .from(schema.chatMessages)
      .where(or(gt(schema.chatMessages.createdAt, since), gt(schema.chatMessages.editedAt, since), gt(schema.chatMessages.deletedAt, since)))
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
    db.select().from(schema.chatMessages).where(isNull(schema.chatMessages.deletedAt)).orderBy(desc(schema.chatMessages.createdAt)).limit(1),
    unreadMessages(db, role),
  ]);
  return {
    unread,
    last: last
      ? {
          sender: last.sender,
          kind: last.deletedAt ? "deleted" : last.kind,
          body: last.deletedAt ? "" : last.enc ? last.body : last.body.slice(0, 120),
          enc: last.deletedAt ? null : (last.enc ?? null),
          createdAt: last.createdAt.toISOString(),
        }
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
    return { title: tap.push.replace("{from}", from), body: `${tap.kaomoji}  ${tap.note}`, navigate: "/world/chat", kind: "tap", tap: tap.key, threadId: "chat", messageId: message.id };
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
  // Josh trying the app's buttons in test mode: checked like a real send, but never saved or sent to her.
  const test = await interceptTestSend(db, role, data, { after, now });
  if (test) return test;
  const [inserted] = await db
    .insert(schema.chatMessages)
    .values({
      clientId: data.clientId,
      sender: role,
      kind: data.kind,
      body: data.kind === "text" && !data.enc ? data.body.trim() : data.body,
      media: data.media ?? null,
      enc: data.enc ?? null,
      replyTo: data.replyTo ?? null,
      createdAt: now,
    })
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

/**
 * Edits one of your own messages: a text's words, or the caption under photos and videos. The other
 * phone hears "edited" and catches up. Returns the message, or null when it isn't yours to edit.
 */
export async function editMessage(db, role, id, input, { now = new Date() } = {}) {
  const data = editSchema.parse(input);
  const [row] = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, id));
  if (!row || row.sender !== role || row.deletedAt || !EDITABLE.includes(row.kind)) return null;
  const isSealed = data.enc !== undefined;
  const body = row.kind === "text" && !isSealed ? data.body.trim() : data.body;
  if (row.kind === "text" && !body.trim()) throw Object.assign(new Error("A message can’t be empty. Delete it instead?"), { status: 400 });
  if (!isSealed && body.length > (row.kind === "text" ? TEXT_MAX : CAPTION_MAX)) throw Object.assign(new Error("That’s a little too long."), { status: 400 });
  if (data.media !== undefined && !mediaOk(row.kind, data.media, isSealed)) throw Object.assign(new Error("bad media"), { status: 400 });
  const [updated] = await db
    .update(schema.chatMessages)
    .set({ body, editedAt: now, ...(isSealed ? { enc: data.enc } : row.enc ? { enc: null } : {}), ...(data.media !== undefined ? { media: data.media } : {}) })
    .where(and(eq(schema.chatMessages.id, id), isNull(schema.chatMessages.deletedAt)))
    .returning();
  if (!updated) return null;
  await publish("edited", { id, sender: role, at: now.toISOString() });
  return (await decorate(db, [updated]))[0];
}

/**
 * Deletes one of your own messages for both of them: its words and files are wiped (a row stays
 * behind only so replies can say "original message was deleted" and phones can catch up), its
 * reactions go, and its files are removed from storage unless it was saved to your memories.
 */
export async function deleteMessage(db, role, id, { after = (task) => task() } = {}) {
  const [row] = await db
    .select()
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.id, id), eq(schema.chatMessages.sender, role), isNull(schema.chatMessages.deletedAt)));
  if (!row) return false;
  const [gone] = await db
    .update(schema.chatMessages)
    .set({ deletedAt: new Date(), body: "", media: null, enc: null })
    .where(and(eq(schema.chatMessages.id, id), isNull(schema.chatMessages.deletedAt)))
    .returning({ id: schema.chatMessages.id });
  if (!gone) return false;
  await db.delete(schema.chatReactions).where(eq(schema.chatReactions.messageId, id));
  await publish("deleted", { id });
  const files = mediaUrls(row.media);
  if (files.length)
    await after(async () => {
      const [kept] = await db
        .select({ id: schema.memories.id })
        .from(schema.memories)
        .where(and(eq(schema.memories.kind, "message"), eq(schema.memories.sourceId, id)));
      if (!kept) await forgetFiles(files);
    });
  return true;
}

/** Removes chat files from storage (Blob in production, the dev folder locally). Never throws. */
async function forgetFiles(urls) {
  const { blobReadConfigured, blobOptions } = await import("./blob.js");
  for (const url of urls) {
    try {
      if (url.startsWith("/api/uploads/media?path=")) {
        const pathname = new URL(url, "http://local").searchParams.get("path");
        if (!pathname?.startsWith("chat/") || !blobReadConfigured()) continue;
        const { del } = await import("@vercel/blob");
        await del(pathname, blobOptions());
      } else if (/^\/api\/uploads\/file\/chat-[a-f0-9]{16}\.[a-z0-9]+$/.test(url)) {
        const { unlink } = await import("node:fs/promises");
        const path = await import("node:path");
        await unlink(path.resolve(".data/uploads", url.split("/").pop()));
      }
    } catch {
      // A file that can't be removed now just stays; nothing links to it any more.
    }
  }
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
/** A message sent ends "typing…" at once, instead of a few seconds after it arrived. */
export async function clearTyping(db, role) {
  await db.delete(schema.kv).where(eq(schema.kv.key, `chat:typing:${role}`));
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
