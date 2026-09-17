import { createHmac } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { schema } from "../db/client.js";
import { env } from "../env.js";

// Unlocking and changing a passphrase share one failure budget per network address.
export const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export function clientIpHash(c) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || c.req.header("x-real-ip") || "local";
  return createHmac("sha256", env.sessionSecret ?? "dev").update(ip).digest("base64url").slice(0, 24);
}

export async function tooManyFailures(db, ipHash) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [{ failures }] = await db
    .select({ failures: count() })
    .from(schema.unlockAttempts)
    .where(and(eq(schema.unlockAttempts.ipHash, ipHash), eq(schema.unlockAttempts.ok, false), gte(schema.unlockAttempts.at, since)));
  return failures >= MAX_FAILURES;
}

export function slowDown(c) {
  c.header("Retry-After", String(WINDOW_MS / 1000));
  return c.json({ error: "slow_down", message: "Too many tries. Take a breath and try again in 15 minutes." }, 429);
}

export function recordAttempt(db, ipHash, role) {
  return db.insert(schema.unlockAttempts).values({ ipHash, ok: Boolean(role), role });
}
