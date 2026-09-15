import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { isPassphraseHash, verifyPassphrase } from "../auth/passphrase.js";
import { clearSession, issueSession, passphraseHashes, readSession } from "../auth/session.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function clientIpHash(c) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || c.req.header("x-real-ip") || "local";
  return createHmac("sha256", env.sessionSecret ?? "dev").update(ip).digest("base64url").slice(0, 24);
}

export const sessionRoutes = new Hono();

sessionRoutes.get("/", (c) => {
  c.header("Cache-Control", "private, no-store");
  const session = readSession(c);
  return c.json({ role: session?.role ?? null });
});

sessionRoutes.post("/unlock", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const hashes = await passphraseHashes();
  if (!env.sessionSecret || (!isPassphraseHash(hashes.kiriya) && !isPassphraseHash(hashes.admin))) {
    return c.json({ error: "not_configured", message: "The private door isn't ready yet. Please try again later." }, 503);
  }
  const db = await getDb();
  const ipHash = clientIpHash(c);
  const since = new Date(Date.now() - WINDOW_MS);

  const [{ failures }] = await db
    .select({ failures: count() })
    .from(schema.unlockAttempts)
    .where(and(eq(schema.unlockAttempts.ipHash, ipHash), eq(schema.unlockAttempts.ok, false), gte(schema.unlockAttempts.at, since)));

  if (failures >= MAX_FAILURES) {
    c.header("Retry-After", String(WINDOW_MS / 1000));
    return c.json({ error: "slow_down", message: "Too many tries. Take a breath and try again in 15 minutes." }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.slice(0, 200) : "";

  let role = null;
  if (passphrase && hashes.kiriya && (await verifyPassphrase(passphrase, hashes.kiriya))) role = "kiriya";
  else if (passphrase && hashes.admin && (await verifyPassphrase(passphrase, hashes.admin))) role = "admin";

  await db.insert(schema.unlockAttempts).values({ ipHash, ok: Boolean(role), role });

  if (!role) {
    return c.json({ error: "wrong_passphrase", message: "That's not the passphrase. Check for typos and try again." }, 401);
  }
  return c.json(issueSession(c, role));
});

sessionRoutes.post("/lock", (c) => {
  clearSession(c);
  return c.json({ role: null });
});
