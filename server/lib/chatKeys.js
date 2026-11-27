import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { blobOptions, blobReadConfigured } from "./blob.js";
import { isUploadUrl } from "./media.js";

// The server's side of the chat's end-to-end encryption (docs/refactor/CHAT-CRYPTO.md). It never
// sees a key it could use: it keeps each person's public key and their private key wrapped under
// their passphrase (src/lib/chatCrypto/core.js), hands those back to their own devices, and moves
// sealed text around without reading it. Everything here treats `body`, `enc` and media `sealed`
// as opaque.

export const ROLES = ["kiriya", "admin"];
const other = (role) => (role === "kiriya" ? "admin" : "kiriya");
const identityKey = (role) => `chatkeys:identity:${role}`;
const MIGRATION_KEY = "chatkeys:migration";
const b64 = /^[A-Za-z0-9_-]+$/;

export const publicKeySchema = z.string().length(87).regex(b64);
export const wrappedSchema = z
  .object({
    v: z.literal(1),
    kdf: z.literal("PBKDF2-SHA256"),
    // The client never wraps with less; a client that tried would weaken her key for good.
    iter: z.number().int().min(600_000).max(10_000_000),
    salt: z.string().regex(b64).min(16).max(64),
    iv: z.string().regex(b64).length(16),
    data: z.string().regex(b64).min(100).max(600),
  })
  .strict();

const fail = (status, message) => Object.assign(new Error(message), { status });

// ---------- identities ----------

async function readKv(db, key) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? null;
}
async function writeKv(db, key, value) {
  await db.insert(schema.kv).values({ key, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
}

export const readIdentity = (db, role) => readKv(db, identityKey(role));

/** The same id the phones compute (core.js keyIdOf): names the chat key two public keys make. */
export function keyIdOf(kiriyaPublic, adminPublic) {
  return createHash("sha256").update(`kiriya.love/chat-key-id/v1|${kiriyaPublic}|${adminPublic}`).digest().subarray(0, 9).toString("base64url");
}

/** The chat key now in use, once both of them have a key pair; null before that. */
export async function currentKeyId(db) {
  const [kiriya, admin] = await Promise.all(ROLES.map((role) => readIdentity(db, role)));
  return kiriya && admin ? keyIdOf(kiriya.publicKey, admin.publicKey) : null;
}

const publicPart = (identity) => (identity ? { publicKey: identity.publicKey, version: identity.version, createdAt: identity.createdAt } : null);

/**
 * What a device of `role` needs: both public keys (and older ones, for messages sealed before a
 * reset), its own wrapped private key, and the id of the key in use.
 */
export async function keysFor(db, role) {
  const [kiriya, admin] = await Promise.all(ROLES.map((who) => readIdentity(db, who)));
  const mine = role === "kiriya" ? kiriya : admin;
  return {
    me: role,
    keys: { kiriya: publicPart(kiriya), admin: publicPart(admin) },
    history: { kiriya: kiriya?.previous ?? [], admin: admin?.previous ?? [] },
    wrapped: mine?.wrapped ?? null,
    current: kiriya && admin ? keyIdOf(kiriya.publicKey, admin.publicKey) : null,
  };
}

const putBody = z.object({ publicKey: publicKeySchema, wrapped: wrappedSchema, replace: z.boolean().optional() }).strict();

/**
 * Stores a device's new key pair (the public half and the wrapped private half). The first one
 * wins: a second device racing to make one gets 409 and opens the stored one instead. `replace`
 * (after a passphrase reset, when the stored copy no longer opens) keeps the old public key in
 * `previous`, so messages sealed with it can still be opened by whoever holds that key.
 */
export async function putIdentity(db, role, input, now = new Date()) {
  const data = putBody.parse(input);
  const existing = await readIdentity(db, role);
  if (existing && existing.publicKey === data.publicKey) {
    const next = { ...existing, wrapped: data.wrapped, updatedAt: now.toISOString() };
    await writeKv(db, identityKey(role), next);
    return next;
  }
  if (existing && !data.replace) throw Object.assign(fail(409, "A key already exists."), { code: "exists" });
  const next = {
    publicKey: data.publicKey,
    wrapped: data.wrapped,
    version: (existing?.version ?? 0) + 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    previous: existing ? [...(existing.previous ?? []), { publicKey: existing.publicKey, version: existing.version, retiredAt: now.toISOString() }].slice(-8) : [],
  };
  if (existing) await writeKv(db, identityKey(role), next);
  else {
    const inserted = await db.insert(schema.kv).values({ key: identityKey(role), value: next }).onConflictDoNothing({ target: schema.kv.key }).returning();
    if (!inserted.length) throw Object.assign(fail(409, "A key already exists."), { code: "exists" });
  }
  return next;
}

/** A passphrase change: the same key pair, wrapped under the new passphrase. */
export async function rewrapIdentity(db, role, wrapped, now = new Date()) {
  const data = wrappedSchema.parse(wrapped);
  const existing = await readIdentity(db, role);
  if (!existing) return null;
  const next = { ...existing, wrapped: data, updatedAt: now.toISOString() };
  await writeKv(db, identityKey(role), next);
  return next;
}

// ---------- sealed messages ----------

/** Whether a stored message (or a reply preview, or a memory's copy) is sealed. */
export const isSealed = (row) => Boolean(row?.enc && row.enc.v === 1 && typeof row.enc.k === "string");

const SEALED_BODY_MAX = 24_000;
const sealedValue = z.string().regex(b64).min(38);
export const encSchema = z.object({ v: z.literal(1), k: z.string().regex(b64).max(24), n: sealedValue.max(800).optional() }).strict();

// What a sealed message's media may hold, checked when a device seals history in place: the shape
// chat-core stores, with each entry's private parts inside its `sealed`.
const plainNumber = z.number().min(0).max(100_000);
const sealedEntry = z
  .object({
    type: z.enum(["image", "video"]).optional(),
    url: z.string().refine((u) => isUploadUrl(u, ["chat"])).optional(),
    width: plainNumber.optional(),
    height: plainNumber.optional(),
    duration: plainNumber.optional(),
    mime: z.string().max(60).optional(),
    poster: z.lazy(() => sealedEntry).optional(),
    sealed: sealedValue.max(2048).optional(),
  })
  .strict();
const sealedMedia = z.union([z.null(), sealedEntry, z.object({ items: z.array(sealedEntry).min(1).max(10) }).strict()]);

/** Every upload link a message's media points at (old shape, items and posters). */
export function uploadLinks(media) {
  const links = [];
  const visit = (entry) => {
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.url === "string" && isUploadUrl(entry.url, ["chat"])) links.push(entry.url);
    if (entry.poster) visit(entry.poster);
  };
  if (Array.isArray(media?.items)) media.items.forEach(visit);
  else visit(media);
  return links;
}

// ---------- notifications ----------

const GENERIC = "a new message ♡";
// APNs refuses payloads over 4 KB. A sealed preview is small (the phone seals at most 180
// characters); the whole sealed text only rides along when it fits easily.
const BODY_IN_PUSH = 2400;

/**
 * A chat notification for a sealed message: the words are only on the phones, so the alert says
 * "a new message ♡" and carries the sealed preview, which the app's notification extension opens
 * with the chat key from the Keychain (ios/App/KiriyaNotificationService). Web push can't open
 * anything, so it says just that.
 */
export function sealedNotification(message, from) {
  const sealed = { k: message.enc.k, s: message.sender, t: message.kind, c: message.clientId };
  if (message.enc.n) sealed.n = message.enc.n;
  else if (typeof message.body === "string" && message.body.length <= BODY_IN_PUSH) sealed.b = message.body;
  return { title: from, body: GENERIC, navigate: "/world/chat", kind: "chat", threadId: "chat", messageId: message.id, sealed };
}

/** The widget's "last message": the words are opened on the phone (KiriyaShared/KiriyaChatCrypto). */
export function sealedPreview(last) {
  return { preview: null, sealed: { k: last.enc.k, s: last.sender, t: last.kind, c: last.clientId ?? null, ...(last.body.length <= 8000 ? { b: last.body } : {}) } };
}

// ---------- sealing the plain history in place ----------
// Messages from before both of them had a key pair (and messages sealed with a key that a reset
// retired) are sealed again by whichever device holds the key, in small batches. A lease keeps two
// devices from doing it at once; a fingerprint of each row keeps a batch from overwriting anything
// that changed after the device read it.

const fingerprint = (body, enc) => createHash("sha256").update(JSON.stringify([body ?? "", enc ?? null])).digest("base64url").slice(0, 22);
const LEASE_MS = 3 * 60 * 1000;

export async function claimMigration(db, role, device, now = new Date()) {
  const current = await readKv(db, MIGRATION_KEY);
  if (current && current.until > now.getTime() && current.device !== device) return { ok: false, until: new Date(current.until).toISOString() };
  await writeKv(db, MIGRATION_KEY, { role, device, until: now.getTime() + LEASE_MS });
  return { ok: true };
}

/** The device is done: another may start at once. */
export async function releaseMigration(db, device) {
  const current = await readKv(db, MIGRATION_KEY);
  if (current?.device === device) await db.delete(schema.kv).where(eq(schema.kv.key, MIGRATION_KEY));
  return { ok: true };
}

const stale = (key) => or(isNull(schema.chatMessages.enc), sql`coalesce(${schema.chatMessages.enc}->>'k', '') <> ${key}`);

/** What still needs sealing with the current key, oldest first. */
export async function pendingWork(db, { limit = 20, after = null, memoriesAfter = null } = {}) {
  const key = await currentKeyId(db);
  if (!key) return { current: null, messages: [], memories: [] };
  // `after`: a device skips what it couldn't open (a key it never had) and moves on.
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(and(isNull(schema.chatMessages.deletedAt), ne(schema.chatMessages.kind, "tap"), stale(key), after ? gt(schema.chatMessages.createdAt, new Date(after)) : undefined))
    .orderBy(asc(schema.chatMessages.createdAt))
    .limit(limit);
  const memories = await db
    .select()
    .from(schema.memories)
    .where(
      and(
        eq(schema.memories.kind, "message"),
        or(sql`coalesce(${schema.memories.snapshot}->'enc', 'null'::jsonb) = 'null'::jsonb`, sql`${schema.memories.snapshot}->'enc'->>'k' <> ${key}`),
        sql`${schema.memories.snapshot}->>'kind' <> 'tap'`,
        memoriesAfter ? gt(schema.memories.createdAt, new Date(memoriesAfter)) : undefined,
      ),
    )
    .orderBy(asc(schema.memories.createdAt))
    .limit(limit);
  return {
    current: key,
    messages: rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      sender: row.sender,
      kind: row.kind,
      body: row.body,
      media: row.media,
      enc: row.enc ?? null,
      createdAt: row.createdAt.toISOString(),
      was: fingerprint(row.body, row.enc),
    })),
    memories: memories.map((row) => ({ id: row.id, sourceId: row.sourceId, snapshot: row.snapshot, createdAt: row.createdAt.toISOString(), was: fingerprint(row.snapshot.body, row.snapshot.enc) })),
  };
}

const sealedRow = z.object({ id: z.string().uuid(), was: z.string().max(40), body: sealedValue.max(SEALED_BODY_MAX), enc: encSchema, media: sealedMedia }).strict();
const sealedMemory = z
  .object({
    id: z.string().uuid(),
    was: z.string().max(40),
    snapshot: z.object({ body: sealedValue.max(SEALED_BODY_MAX), enc: encSchema, media: sealedMedia, clientId: z.string().max(80) }).strict(),
  })
  .strict();
const batchBody = z.object({ device: z.string().max(80), messages: z.array(sealedRow).max(40).default([]), memories: z.array(sealedMemory).max(40).default([]) }).strict();

/**
 * Stores a batch the device sealed. Each row is written only if it is still what the device read
 * and the new copy uses the key in use now. Upload links the old copy pointed at and the new one
 * doesn't (photos the device sealed and uploaded again) are deleted once nothing refers to them.
 */
export async function storeSealed(db, role, input, { after = (task) => task(), now = new Date() } = {}) {
  const data = batchBody.parse(input);
  const lease = await readKv(db, MIGRATION_KEY);
  if (!lease || lease.device !== data.device || lease.until < now.getTime()) throw fail(409, "Another device is tidying up.");
  const key = await currentKeyId(db);
  if (!key) throw fail(409, "Not ready yet.");
  const dropped = new Set();
  let sealed = 0;
  for (const item of data.messages) {
    if (item.enc.k !== key) continue;
    const [row] = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, item.id));
    if (!row || row.deletedAt || row.kind === "tap" || fingerprint(row.body, row.enc) !== item.was) continue;
    await db.update(schema.chatMessages).set({ body: item.body, enc: item.enc, media: item.media }).where(eq(schema.chatMessages.id, item.id));
    const kept = new Set(uploadLinks(item.media));
    for (const link of uploadLinks(row.media)) if (!kept.has(link)) dropped.add(link);
    sealed++;
  }
  for (const item of data.memories) {
    if (item.snapshot.enc.k !== key) continue;
    const [row] = await db.select().from(schema.memories).where(eq(schema.memories.id, item.id));
    if (!row || row.kind !== "message" || fingerprint(row.snapshot.body, row.snapshot.enc) !== item.was) continue;
    const { body: _b, media: _m, enc: _e, ...rest } = row.snapshot;
    await db.update(schema.memories).set({ snapshot: { ...rest, ...item.snapshot } }).where(eq(schema.memories.id, item.id));
    const kept = new Set(uploadLinks(item.snapshot.media));
    for (const link of uploadLinks(row.snapshot.media)) if (!kept.has(link)) dropped.add(link);
    sealed++;
  }
  await writeKv(db, MIGRATION_KEY, { role, device: data.device, until: now.getTime() + LEASE_MS });
  if (dropped.size) await after(() => forgetUploads(db, [...dropped]));
  return { sealed };
}

/** Deletes old plain uploads nothing points at any more (a message, a memory or a chat background). */
export async function forgetUploads(db, links) {
  let removed = 0;
  for (const link of links) {
    if (!isUploadUrl(link, ["chat"])) continue;
    const [inMessage] = await db.select({ id: schema.chatMessages.id }).from(schema.chatMessages).where(sql`position(${link} in coalesce(${schema.chatMessages.media}::text, '')) > 0`).limit(1);
    const [inMemory] = await db.select({ id: schema.memories.id }).from(schema.memories).where(sql`position(${link} in ${schema.memories.snapshot}::text) > 0`).limit(1);
    if (inMessage || inMemory) continue;
    if (await deleteUpload(link).catch(() => false)) removed++;
  }
  return removed;
}

async function deleteUpload(link) {
  if (link.startsWith("/api/uploads/file/")) {
    if (env.isProd) return false;
    const name = link.slice("/api/uploads/file/".length);
    if (!/^chat-[0-9a-f]{16}\.[a-z0-9]+$/.test(name)) return false;
    await unlink(path.resolve(".data/uploads", name));
    return true;
  }
  const pathname = new URL(link, "http://local").searchParams.get("path");
  if (!pathname?.startsWith("chat/") || !blobReadConfigured()) return false;
  const { del } = await import("@vercel/blob");
  await del(pathname, blobOptions());
  return true;
}

export { other };
