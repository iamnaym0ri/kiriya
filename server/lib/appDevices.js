import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { schema } from "../db/client.js";
import { keyVersion } from "../auth/session.js";
import { createDeviceKey } from "./deviceKeys.js";

// Installs of the kiriya.love iPhone app. The secret is generated here, shown to the app once, and
// kept in the iPhone Keychain behind Face ID; the database holds only its hash.

const hash = (secret) => createHash("sha256").update(secret).digest("hex");
const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// APNs device tokens are 64+ hex characters.
export const isApnsToken = (token) => typeof token === "string" && /^[0-9a-f]{64,200}$/i.test(token);

export async function enrollDevice(db, role, { label = "iPhone" } = {}) {
  const secret = randomBytes(32).toString("base64url");
  const widget = await createDeviceKey(db, role, "iPhone app");
  const [row] = await db
    .insert(schema.appDevices)
    .values({ role, label: String(label).slice(0, 60) || "iPhone", secretHash: hash(secret), keyVersion: await keyVersion(role), widgetKeyId: widget?.id ?? null })
    .returning();
  // widgetKey is null only when all five widget keys are in use (Settings → Phone widget frees one).
  return { id: row.id, secret, role: row.role, widgetKey: widget?.key ?? null };
}

/** A fresh widget key for an install that lost its own (the old one, if any, stops working). */
export async function renewWidgetKey(db, id, role) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(schema.appDevices).where(and(eq(schema.appDevices.id, id), eq(schema.appDevices.role, role), isNull(schema.appDevices.revokedAt)));
  if (!row) return null;
  if (row.widgetKeyId) await db.update(schema.deviceKeys).set({ revokedAt: new Date() }).where(eq(schema.deviceKeys.id, row.widgetKeyId));
  const widget = await createDeviceKey(db, role, "iPhone app");
  await db.update(schema.appDevices).set({ widgetKeyId: widget?.id ?? null }).where(eq(schema.appDevices.id, id));
  return { widgetKey: widget?.key ?? null };
}

/**
 * Signs an app back in with its Keychain secret. Fails for an unknown or revoked device, a wrong
 * secret, or when the role's passphrase changed since the device was set up (that revokes it).
 */
export async function verifyDevice(db, id, secret, { now = new Date() } = {}) {
  if (!isUuid(id) || typeof secret !== "string" || secret.length < 20 || secret.length > 200) return null;
  const [row] = await db.select().from(schema.appDevices).where(eq(schema.appDevices.id, id));
  if (!row || row.revokedAt) return null;
  const expected = Buffer.from(row.secretHash, "hex");
  const given = Buffer.from(hash(secret), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (row.keyVersion !== (await keyVersion(row.role))) {
    await db.update(schema.appDevices).set({ revokedAt: now }).where(eq(schema.appDevices.id, id));
    return null;
  }
  await db.update(schema.appDevices).set({ lastSeenAt: now }).where(eq(schema.appDevices.id, id));
  return row;
}

/** Records where this app's notifications go. A token moves with the phone, so it's cleared elsewhere. */
export async function setPushToken(db, id, role, token, { env: apnsEnv = "production" } = {}) {
  if (!isUuid(id) || !isApnsToken(token)) return null;
  const normalized = token.toLowerCase();
  await db.update(schema.appDevices).set({ apnsToken: null }).where(and(eq(schema.appDevices.apnsToken, normalized), ne(schema.appDevices.id, id)));
  const [row] = await db
    .update(schema.appDevices)
    .set({ apnsToken: normalized, apnsEnv: apnsEnv === "development" ? "development" : "production", lastSeenAt: new Date(), lastError: null })
    .where(and(eq(schema.appDevices.id, id), eq(schema.appDevices.role, role), isNull(schema.appDevices.revokedAt)))
    .returning();
  return row ?? null;
}

/** She turned notifications off inside the app: keep the install, stop sending to it. */
export async function clearPushToken(db, id, role) {
  if (!isUuid(id)) return false;
  const [row] = await db
    .update(schema.appDevices)
    .set({ apnsToken: null })
    .where(and(eq(schema.appDevices.id, id), eq(schema.appDevices.role, role)))
    .returning({ id: schema.appDevices.id });
  return Boolean(row);
}

export async function revokeDevice(db, id, { role = null, now = new Date() } = {}) {
  if (!isUuid(id)) return false;
  const where = role ? and(eq(schema.appDevices.id, id), eq(schema.appDevices.role, role)) : eq(schema.appDevices.id, id);
  const [row] = await db.update(schema.appDevices).set({ revokedAt: now, apnsToken: null }).where(where).returning({ id: schema.appDevices.id, widgetKeyId: schema.appDevices.widgetKeyId });
  // Its widgets and notification buttons stop working with it.
  if (row?.widgetKeyId) await db.update(schema.deviceKeys).set({ revokedAt: now }).where(eq(schema.deviceKeys.id, row.widgetKeyId));
  return Boolean(row);
}

export async function listDevices(db) {
  const rows = await db.select().from(schema.appDevices).where(isNull(schema.appDevices.revokedAt)).orderBy(desc(schema.appDevices.lastSeenAt));
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    label: row.label,
    push: Boolean(row.apnsToken),
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError,
  }));
}
