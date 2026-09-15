import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { env } from "../env.js";
import { hashPassphrase } from "./passphrase.js";

export const COOKIE_NAME = "kw";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

// Development runs without any secrets configured: the passphrases are simply "kiriya" and "admin".
let devHashes;
export async function passphraseHashes() {
  if (env.isProd || (env.kiriyaPassphraseHash && env.adminPassphraseHash)) {
    return { kiriya: env.kiriyaPassphraseHash, admin: env.adminPassphraseHash };
  }
  devHashes ??= Promise.all([hashPassphrase("kiriya"), hashPassphrase("admin")]);
  const [kiriya, admin] = await devHashes;
  return { kiriya: env.kiriyaPassphraseHash ?? kiriya, admin: env.adminPassphraseHash ?? admin };
}

// A session remembers which passphrase opened it. Changing that passphrase in the environment
// changes its key version, which quietly signs out every device that used the old one.
// (Dev stand-ins are re-salted on every restart, so they share a fixed version instead.)
function keyVersion(role) {
  const configured = role === "kiriya" ? env.kiriyaPassphraseHash : env.adminPassphraseHash;
  if (!configured) return "dev";
  return createHash("sha256").update(configured).digest("base64url").slice(0, 10);
}

function sign(payload) {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function issueSession(c, role) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ r: role, iat: now, exp: now + MAX_AGE_SECONDS, k: keyVersion(role) }),
  ).toString("base64url");
  const token = `v1.${payload}.${sign(payload)}`;
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return { role, expiresAt: new Date((now + MAX_AGE_SECONDS) * 1000).toISOString() };
}

export function clearSession(c) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export function readSession(c) {
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
  if (data.k !== keyVersion(data.r)) return null;
  return { role: data.r, issuedAt: data.iat, expiresAt: data.exp };
}

/** Middleware: only these roles get through; everyone else gets a plain 401. */
export function requireRole(...roles) {
  return async (c, next) => {
    const session = readSession(c);
    if (!session || !roles.includes(session.role)) {
      return c.json({ error: "locked", message: "Enter the passphrase to open this." }, 401);
    }
    c.set("session", session);
    c.header("Cache-Control", "private, no-store");
    await next();
  };
}
