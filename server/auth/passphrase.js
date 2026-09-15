import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEY_LENGTH = 32;

// Typed on a phone, a passphrase picks up autocapitals, doubled spaces and smart punctuation.
// Normalising means "Strawberry  milk" and "strawberry milk" unlock the same door.
export function normalizePassphrase(input) {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export async function hashPassphrase(passphrase) {
  const salt = randomBytes(16);
  const key = await scrypt(
    normalizePassphrase(passphrase),
    salt,
    KEY_LENGTH,
    PARAMS,
  );
  return `scrypt$${Math.log2(PARAMS.N)}$${PARAMS.r}$${PARAMS.p}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassphrase(passphrase, stored) {
  if (!isPassphraseHash(stored)) return false;
  const [scheme, logN, r, p, saltText, keyText] = stored.split("$");
  const expected = Buffer.from(keyText, "base64url");
  try {
    const actual = await scrypt(
      normalizePassphrase(passphrase),
      Buffer.from(saltText, "base64url"),
      expected.length,
      {
        N: 2 ** Number(logN),
        r: Number(r),
        p: Number(p),
        maxmem: PARAMS.maxmem,
      },
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

// Reject malformed or unbounded parameters before scrypt allocates memory. This also lets the
// production build validate configuration without knowing either person's original phrase.
export function isPassphraseHash(stored) {
  if (typeof stored !== "string") return false;
  const match =
    /^scrypt\$(14|15|16)\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/.exec(
      stored,
    );
  if (!match) return false;
  return (
    Buffer.from(match[2], "base64url").toString("base64url") === match[2] &&
    Buffer.from(match[3], "base64url").toString("base64url") === match[3]
  );
}
