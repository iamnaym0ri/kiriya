import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { hashPassphrase, normalizePassphrase, verifyPassphrase } from "../auth/passphrase.js";
import { clientIpHash, recordAttempt, slowDown, tooManyFailures } from "../auth/attempts.js";
import { configuredKeyVersion, issueSession, passphraseHashes } from "../auth/session.js";
import { newSessionKey, readCredential, writeCredential } from "../auth/credentials.js";
import { revokeAllDeviceKeys } from "../lib/deviceKeys.js";

export const MIN_PASSPHRASE_LENGTH = 8;
const otherRole = (role) => (role === "kiriya" ? "admin" : "kiriya");

export const passphraseRoutes = new Hono();

passphraseRoutes.get("/", async (c) => {
  const credential = await readCredential(c.get("session").role, await getDb());
  return c.json({ custom: Boolean(credential?.hash), changedAt: credential?.hash ? credential.changedAt : null, minLength: MIN_PASSPHRASE_LENGTH });
});

const changeBody = z.object({
  current: z.string().max(200),
  next: z.string().max(200),
  signOutOthers: z.boolean().default(true),
});

passphraseRoutes.put("/", async (c) => {
  const parsed = changeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_passphrase", message: "Fill in both passphrases and try again." }, 400);
  const { current, next, signOutOthers } = parsed.data;
  const role = c.get("session").role;
  const db = await getDb();
  const ipHash = clientIpHash(c);
  if (await tooManyFailures(db, ipHash)) return slowDown(c);

  const hashes = await passphraseHashes();
  if (!(await verifyPassphrase(current, hashes[role]))) {
    await recordAttempt(db, ipHash, null);
    return c.json({ error: "wrong_passphrase", message: "Your current passphrase didn’t match. Try it again." }, 401);
  }
  const normalized = normalizePassphrase(next);
  if (normalized.length < MIN_PASSPHRASE_LENGTH) {
    return c.json({ error: "too_short", message: `Use at least ${MIN_PASSPHRASE_LENGTH} characters. A few words together works well.` }, 400);
  }
  if (normalized === normalizePassphrase(current)) {
    return c.json({ error: "unchanged", message: "That’s the passphrase you already have. Pick a new one." }, 400);
  }
  // Unlocking tries each role's phrase in turn, so two roles can never share one.
  if (await verifyPassphrase(next, hashes[otherRole(role)])) {
    return c.json({ error: "unavailable", message: "Pick something a little more unique." }, 400);
  }

  const stored = await readCredential(role, db);
  await writeCredential(db, role, {
    hash: await hashPassphrase(next),
    sessionKey: signOutOthers ? newSessionKey() : (stored?.sessionKey ?? configuredKeyVersion(role)),
  });
  // A lost phone may also hold a widget key; signing out elsewhere turns those off too.
  if (signOutOthers) await revokeAllDeviceKeys(db, role);
  await issueSession(c, role);
  return c.json({ ok: true, signedOutOthers: signOutOthers });
});

// For a lost or borrowed device: every other session for this role stops working.
passphraseRoutes.post("/sign-out-others", async (c) => {
  const role = c.get("session").role;
  const db = await getDb();
  await writeCredential(db, role, { sessionKey: newSessionKey() });
  await revokeAllDeviceKeys(db, role);
  await issueSession(c, role);
  return c.json({ ok: true });
});
