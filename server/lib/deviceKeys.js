import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { schema } from "../db/client.js";

export const MAX_ACTIVE_KEYS = 5;
const PREFIX = "kw_";
// Avoid a database write on every widget refresh.
const TOUCH_AFTER_MS = 10 * 60 * 1000;

const hashKey = (key) => createHash("sha256").update(key).digest("base64url");
const listed = (row) => ({ id: row.id, label: row.label, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt });
const active = (person) => and(eq(schema.deviceKeys.person, person), isNull(schema.deviceKeys.revokedAt));

/** Makes a key and returns it once. Only its hash is stored. */
export async function createDeviceKey(db, person, label) {
  const [{ used }] = await db.select({ used: count() }).from(schema.deviceKeys).where(active(person));
  if (used >= MAX_ACTIVE_KEYS) return null;
  const key = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  const [row] = await db.insert(schema.deviceKeys).values({ person, label, keyHash: hashKey(key) }).returning();
  return { key, ...listed(row) };
}

export async function listDeviceKeys(db, person) {
  const rows = await db.select().from(schema.deviceKeys).where(active(person)).orderBy(desc(schema.deviceKeys.createdAt));
  return rows.map(listed);
}

export async function revokeDeviceKey(db, person, id) {
  const [row] = await db
    .update(schema.deviceKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.deviceKeys.id, id), active(person)))
    .returning();
  return Boolean(row);
}

export async function revokeAllDeviceKeys(db, person) {
  await db.update(schema.deviceKeys).set({ revokedAt: new Date() }).where(active(person));
}

/** The person a key belongs to, or null for a missing, malformed or revoked key. */
export async function personForKey(db, key, now = new Date()) {
  if (typeof key !== "string" || !key.startsWith(PREFIX) || key.length > 80) return null;
  const [row] = await db
    .select()
    .from(schema.deviceKeys)
    .where(and(eq(schema.deviceKeys.keyHash, hashKey(key)), isNull(schema.deviceKeys.revokedAt)));
  if (!row) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOUCH_AFTER_MS)
    await db.update(schema.deviceKeys).set({ lastUsedAt: now }).where(eq(schema.deviceKeys.id, row.id));
  return row.person;
}
