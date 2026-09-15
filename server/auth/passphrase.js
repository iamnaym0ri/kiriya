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
  const key = await scrypt(normalizePassphrase(passphrase), salt, KEY_LENGTH, PARAMS);
  return `scrypt$${Math.log2(PARAMS.N)}$${PARAMS.r}$${PARAMS.p}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassphrase(passphrase, stored) {
  if (!stored || typeof stored !== "string") return false;
  const [scheme, logN, r, p, saltText, keyText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, "base64url");
  const actual = await scrypt(normalizePassphrase(passphrase), Buffer.from(saltText, "base64url"), expected.length, {
    N: 2 ** Number(logN),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
