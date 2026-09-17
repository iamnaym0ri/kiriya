import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";

// Every authenticated request checks its role's credential row. A short per-instance cache keeps
// that to one query per few seconds; this instance forgets its copy immediately after a change.
const TTL_MS = 5_000;
const cache = new Map();

export function forgetCredential(role) {
  cache.delete(role);
}

export async function readCredential(role, db) {
  const hit = cache.get(role);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = (async () => {
    const handle = db ?? (await getDb());
    const [row] = await handle.select().from(schema.credentials).where(eq(schema.credentials.role, role));
    return row ?? null;
  })();
  cache.set(role, { value, until: Date.now() + TTL_MS });
  value.catch(() => cache.delete(role));
  return value;
}

export const newSessionKey = () => `s${randomBytes(9).toString("base64url")}`;

/** Upserts a role's credential. `hash` undefined keeps the stored one; null reverts to Vercel's. */
export async function writeCredential(db, role, { hash, sessionKey }) {
  const values = { role, sessionKey, changedAt: new Date(), ...(hash !== undefined ? { hash } : {}) };
  await db
    .insert(schema.credentials)
    .values({ hash: null, ...values })
    .onConflictDoUpdate({ target: schema.credentials.role, set: values });
  forgetCredential(role);
}
