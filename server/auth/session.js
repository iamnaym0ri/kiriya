import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { env } from "../env.js";
import { hashPassphrase } from "./passphrase.js";
import { readCredential } from "./credentials.js";

export const COOKIE_NAME = "kw";
// Every device asks for the passphrase again two days after it was unlocked, even while in use.
export const SESSION_SECONDS = 2 * 24 * 60 * 60;

const configuredHash = (role) => (role === "kiriya" ? env.kiriyaPassphraseHash : env.adminPassphraseHash);

// Development runs without any secrets configured: the passphrases are simply "kiriya" and "admin".
let devHashes;
async function configuredHashes() {
  if (env.isProd || (env.kiriyaPassphraseHash && env.adminPassphraseHash)) {
    return { kiriya: env.kiriyaPassphraseHash, admin: env.adminPassphraseHash };
  }
  devHashes ??= Promise.all([hashPassphrase("kiriya"), hashPassphrase("admin")]);
  const [kiriya, admin] = await devHashes;
  return { kiriya: env.kiriyaPassphraseHash ?? kiriya, admin: env.adminPassphraseHash ?? admin };
}

/** The hash that opens each role. A phrase changed from settings wins over the configured one. */
export async function passphraseHashes() {
  const [configured, kiriya, admin] = await Promise.all([
    configuredHashes(),
    readCredential("kiriya"),
    readCredential("admin"),
  ]);
  return { kiriya: kiriya?.hash ?? configured.kiriya, admin: admin?.hash ?? configured.admin };
}

// A session remembers which passphrase opened it. Changing that passphrase in the environment
// changes its key version, which quietly signs out every device that used the old one.
// (Dev stand-ins are re-salted on every restart, so they share a fixed version instead.)
// Once a role has a credential row, its stored session key takes over that job.
export function configuredKeyVersion(role) {
  const configured = configuredHash(role);
  if (!configured) return "dev";
  return createHash("sha256").update(configured).digest("base64url").slice(0, 10);
}

async function keyVersion(role) {
  return (await readCredential(role))?.sessionKey ?? configuredKeyVersion(role);
}

function sign(payload) {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export async function issueSession(c, role) {
  const now = Math.floor(Date.now() / 1000);
  const k = await keyVersion(role);
  const payload = Buffer.from(JSON.stringify({ r: role, iat: now, exp: now + SESSION_SECONDS, k })).toString("base64url");
  const token = `v1.${payload}.${sign(payload)}`;
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  const session = { role, issuedAt: now, expiresAt: now + SESSION_SECONDS };
  c.set("kwSession", session);
  return { role, expiresAt: new Date(session.expiresAt * 1000).toISOString() };
}

export function clearSession(c) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  c.set("kwSession", null);
}

async function verifySession(c) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token || !env.sessionSecret) return null;
  const [version, payload, signature] = token.split(".");
  if (version !== "v1" || !payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || (data.r !== "kiriya" && data.r !== "admin")) return null;
  if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
  // Also covers cookies issued before the two-day limit, which carry a later expiry.
  if (typeof data.iat !== "number" || Date.now() / 1000 - data.iat > SESSION_SECONDS) return null;
  if (data.k !== (await keyVersion(data.r))) return null;
  return { role: data.r, issuedAt: data.iat, expiresAt: data.exp };
}

/** The request's session, or null. Checked once per request; later calls reuse the answer. */
export async function readSession(c) {
  const known = c.get("kwSession");
  if (known !== undefined) return known;
  const session = await verifySession(c);
  c.set("kwSession", session);
  return session;
}

/** Middleware: only these roles get through; everyone else gets a plain 401. */
export function requireRole(...roles) {
  return async (c, next) => {
    const session = await readSession(c);
    if (!session || !roles.includes(session.role)) {
      return c.json({ error: "locked", message: "Enter the passphrase to open this." }, 401);
    }
    c.set("session", session);
    c.header("Cache-Control", "private, no-store");
    await next();
  };
}
