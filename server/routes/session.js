import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { env } from "../env.js";
import { isPassphraseHash, verifyPassphrase } from "../auth/passphrase.js";
import { clientIpHash, recordAttempt, slowDown, tooManyFailures } from "../auth/attempts.js";
import { clearSession, issueSession, passphraseHashes, readSession } from "../auth/session.js";

export const sessionRoutes = new Hono();

sessionRoutes.get("/", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const session = await readSession(c);
  return c.json({ role: session?.role ?? null });
});

sessionRoutes.post("/unlock", async (c) => {
  c.header("Cache-Control", "private, no-store");
  if (!env.sessionSecret) {
    return c.json({ error: "not_configured", message: "The private door isn't ready yet. Please try again later." }, 503);
  }
  const hashes = await passphraseHashes();
  if (!isPassphraseHash(hashes.kiriya) && !isPassphraseHash(hashes.admin)) {
    return c.json({ error: "not_configured", message: "The private door isn't ready yet. Please try again later." }, 503);
  }
  const db = await getDb();
  const ipHash = clientIpHash(c);
  if (await tooManyFailures(db, ipHash)) return slowDown(c);

  const body = await c.req.json().catch(() => ({}));
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.slice(0, 200) : "";

  let role = null;
  if (passphrase && hashes.kiriya && (await verifyPassphrase(passphrase, hashes.kiriya))) role = "kiriya";
  else if (passphrase && hashes.admin && (await verifyPassphrase(passphrase, hashes.admin))) role = "admin";

  await recordAttempt(db, ipHash, role);

  if (!role) {
    return c.json({ error: "wrong_passphrase", message: "Wrong passphrase. Please check it and try again." }, 401);
  }
  return c.json(await issueSession(c, role));
});

sessionRoutes.post("/lock", (c) => {
  clearSession(c);
  return c.json({ role: null });
});
