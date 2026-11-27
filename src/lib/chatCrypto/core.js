// The chat's end-to-end encryption, the pure part: WebCrypto only, so the same code runs in the
// phone's web view, any browser and Node (the tests). No state, no network: see ./keyring.js for
// where keys live and ../chatCrypto.js for the hooks the chat calls.
//
// The design (docs/refactor/CHAT-CRYPTO.md has the long version):
// - Each of them has a P-256 key pair, made on their own device the first time. The private half is
//   wrapped (AES-256-GCM) under a key stretched from their passphrase (PBKDF2-SHA256, 600 000
//   rounds, a random salt), and the server keeps only that wrapped copy and the public half, so any
//   device where they type their passphrase can open it, and neither has to be online for the other.
// - The chat key is HKDF-SHA256 over ECDH(mine, theirs): both phones arrive at the same key on
//   their own. Its id names the two public keys it came from, so a reset later starts a new key and
//   old messages say which key they need.
// - Every message is sealed with AES-256-GCM under the chat key, a fresh 96-bit IV each time, with
//   its sender and kind as additional data and its clientId inside, checked when it's opened. Each
//   photo, video or voice note gets its own random key; that key rides inside the message, sealed.
// - Plaintexts are padded to 32-byte steps, so a ciphertext's length says little about the text.
//
// Formats (the Swift side, ios/App/KiriyaShared/KiriyaChatCrypto.swift, reads the same ones):
//   sealed value   base64url( iv[12] ‖ ciphertext ‖ tag[16] )
//   message AAD    "kiriya.love/chat/v1|<field>|<sender>|<kind>"   field: message | media | notify
//   file           iv[12] ‖ ciphertext ‖ tag[16], AAD "kiriya.love/file/v1"

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const KDF_ITERATIONS = 600_000;
// A server could hand back a blob claiming a silly count; refuse anything outside this range.
const KDF_RANGE = [100_000, 10_000_000];
export const ROLES = ["kiriya", "admin"];
const PAD = 32;

// ---------- bytes ----------

export function toBase64Url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text)) throw new CryptoError("bad_encoding");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const random = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

export class CryptoError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

// ---------- passphrases ----------

/** Exactly server/auth/passphrase.js normalizePassphrase: the same words always make the same key. */
export function normalizePassphrase(input) {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", encoder.encode(normalizePassphrase(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
}

const identityAad = (role) => encoder.encode(`kiriya.love/chat-identity/v1|${role}`);

// ---------- identities (one key pair per person) ----------

const ECDH = { name: "ECDH", namedCurve: "P-256" };

/** A new key pair. The private half is extractable only so it can be wrapped (and kept natively). */
export async function generateIdentity() {
  const pair = await subtle.generateKey(ECDH, true, ["deriveBits"]);
  return { privateKey: pair.privateKey, publicKey: toBase64Url(await subtle.exportKey("raw", pair.publicKey)) };
}

/** The private key wrapped under the passphrase, as the server stores it. */
export async function wrapIdentity(privateKey, passphrase, role, { iterations = KDF_ITERATIONS } = {}) {
  if (!ROLES.includes(role)) throw new CryptoError("bad_role");
  const salt = random(16);
  const iv = random(12);
  const wrapping = await passphraseKey(passphrase, salt, iterations);
  const data = await subtle.wrapKey("pkcs8", privateKey, wrapping, { name: "AES-GCM", iv, additionalData: identityAad(role) });
  return { v: 1, kdf: "PBKDF2-SHA256", iter: iterations, salt: toBase64Url(salt), iv: toBase64Url(iv), data: toBase64Url(data) };
}

/** Opens a wrapped private key. Throws CryptoError("wrong_passphrase") when it doesn't open. */
export async function unwrapIdentity(wrapped, passphrase, role, { extractable = false } = {}) {
  if (!wrapped || wrapped.v !== 1 || wrapped.kdf !== "PBKDF2-SHA256") throw new CryptoError("bad_wrapped");
  const iterations = Number(wrapped.iter);
  if (!Number.isInteger(iterations) || iterations < KDF_RANGE[0] || iterations > KDF_RANGE[1]) throw new CryptoError("bad_wrapped");
  const wrapping = await passphraseKey(passphrase, fromBase64Url(wrapped.salt), iterations);
  try {
    return await subtle.unwrapKey(
      "pkcs8",
      fromBase64Url(wrapped.data),
      wrapping,
      { name: "AES-GCM", iv: fromBase64Url(wrapped.iv), additionalData: identityAad(role) },
      ECDH,
      extractable,
      ["deriveBits"],
    );
  } catch {
    throw new CryptoError("wrong_passphrase");
  }
}

export const exportPrivate = async (privateKey) => toBase64Url(await subtle.exportKey("pkcs8", privateKey));
export const importPrivate = (pkcs8, { extractable = false } = {}) => subtle.importKey("pkcs8", fromBase64Url(pkcs8), ECDH, extractable, ["deriveBits"]);

/** A public key from the server. Importing checks the point is really on the curve. */
export async function importPublic(publicKey) {
  const raw = fromBase64Url(publicKey);
  if (raw.length !== 65 || raw[0] !== 4) throw new CryptoError("bad_public_key");
  try {
    return await subtle.importKey("raw", raw, ECDH, true, []);
  } catch {
    throw new CryptoError("bad_public_key");
  }
}

/** Whether a private key belongs to this public key (a stored key pair still matches the server's). */
export async function samePair(privateKey, publicKey) {
  // Derive with a throwaway key on both sides: equal only if the private key matches the public one.
  const probe = await subtle.generateKey(ECDH, false, ["deriveBits"]);
  const probePublic = await subtle.exportKey("raw", probe.publicKey);
  const a = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: await subtle.importKey("raw", probePublic, ECDH, true, []) }, privateKey, 256));
  const b = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: await importPublic(publicKey) }, probe.privateKey, 256));
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

// ---------- the chat key ----------

/** Names a chat key by the two public keys it came from (hers first, always). */
export async function keyIdOf(kiriyaPublic, adminPublic) {
  const digest = await subtle.digest("SHA-256", encoder.encode(`kiriya.love/chat-key-id/v1|${kiriyaPublic}|${adminPublic}`));
  return toBase64Url(new Uint8Array(digest).subarray(0, 9));
}

/**
 * The shared chat key from my private key and their public key: the same 32 bytes on both phones.
 * Returns the raw bytes (for the notification extension's Keychain copy) and its id.
 */
export async function deriveChatKey(myPrivate, { kiriya, admin }, me) {
  const theirs = me === "kiriya" ? admin : kiriya;
  const shared = await subtle.deriveBits({ name: "ECDH", public: await importPublic(theirs) }, myPrivate, 256);
  const base = await subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const raw = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("kiriya.love/chat/v1"), info: encoder.encode(`chat-key|${kiriya}|${admin}`) },
    base,
    256,
  );
  return { keyId: await keyIdOf(kiriya, admin), raw: new Uint8Array(raw) };
}

/** A usable chat key; never extractable once it's in the web view. */
export const importChatKey = (raw, { extractable = false } = {}) => subtle.importKey("raw", raw, { name: "AES-GCM" }, extractable, ["encrypt", "decrypt"]);

// ---------- sealing values ----------

export const aadFor = (field, sender, kind) => encoder.encode(`kiriya.love/chat/v1|${field}|${sender}|${kind}`);

function pad(bytes) {
  const size = Math.ceil((bytes.length + 1) / PAD) * PAD;
  const out = new Uint8Array(size).fill(0x20); // JSON ignores trailing spaces
  out.set(bytes);
  return out;
}

/** Seals a JSON value under a chat key. */
export async function sealValue(key, value, aad) {
  const iv = random(12);
  const data = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, pad(encoder.encode(JSON.stringify(value))));
  return toBase64Url(concat(iv, new Uint8Array(data)));
}

/** Opens a sealed value. Throws CryptoError("cant_open") for a wrong key, tampering or junk. */
export async function openValue(key, sealed, aad) {
  let bytes;
  try {
    bytes = fromBase64Url(sealed);
  } catch {
    throw new CryptoError("cant_open");
  }
  if (bytes.length < 12 + 16) throw new CryptoError("cant_open");
  try {
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12), additionalData: aad }, key, bytes.subarray(12));
    return JSON.parse(decoder.decode(plain));
  } catch {
    throw new CryptoError("cant_open");
  }
}

// ---------- files ----------

const FILE_AAD = encoder.encode("kiriya.love/file/v1");

/** Encrypts a file's bytes under a fresh random key. */
export async function sealBytes(bytes) {
  const raw = random(32);
  const key = await subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = random(12);
  const data = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: FILE_AAD }, key, bytes);
  return { data: concat(iv, new Uint8Array(data)), key: toBase64Url(raw) };
}

export async function openBytes(bytes, fileKey) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length < 28) throw new CryptoError("cant_open");
  try {
    const key = await subtle.importKey("raw", fromBase64Url(fileKey), { name: "AES-GCM" }, false, ["decrypt"]);
    return await subtle.decrypt({ name: "AES-GCM", iv: view.subarray(0, 12), additionalData: FILE_AAD }, key, view.subarray(12));
  } catch {
    throw new CryptoError("cant_open");
  }
}

// ---------- messages ----------
// A sealed message on the wire (server/lib/chat.js stores it as given):
//   body   the sealed { c: clientId, t: text }
//   enc    { v: 1, k: chat key id, n?: the sealed notification preview { c, t } }
//   media  as the chat built it, except each entry's private parts (its file key and type, alt
//          text, a voice note's waveform, a GIF's or sticker's link) move into that entry's
//          `sealed`, itself a sealed value. Width, height, duration and the upload link stay plain.

const LINKED = new Set(["gif", "sticker"]);
const PLAIN_LINKED = new Set(["width", "height"]);
const PRIVATE_FIELDS = ["alt", "peaks", "name"];

export const isSealedMessage = (message) => Boolean(message?.enc && message.enc.v === 1 && typeof message.enc.k === "string");

function mapEntries(media, map) {
  if (!media || typeof media !== "object") return Promise.resolve(media ?? null);
  if (Array.isArray(media.items)) return Promise.all(media.items.map((item) => map(item, false))).then((items) => ({ ...media, items }));
  return map(media, true);
}

async function sealEntry(entry, { key, aad, clientId, kind, top }) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  const hidden = {};
  if (out.sealed && typeof out.sealed === "object") {
    if (typeof out.sealed.key !== "string") throw new CryptoError("bad_file_key");
    hidden.key = out.sealed.key;
    if (out.sealed.mime) hidden.mime = out.sealed.mime;
  } else if (typeof out.sealed === "string") {
    throw new CryptoError("already_sealed");
  }
  delete out.sealed;
  for (const field of PRIVATE_FIELDS) if (out[field] !== undefined) (hidden[field] = out[field]), delete out[field];
  // A GIF's or sticker's every link (url, mp4, webp, still, its id) says what was sent: all sealed.
  if (top && LINKED.has(kind)) for (const field of Object.keys(out)) if (!PLAIN_LINKED.has(field)) (hidden[field] = out[field]), delete out[field];
  if (out.poster && typeof out.poster === "object") out.poster = await sealEntry(out.poster, { key, aad, clientId, kind, top: false });
  if (Object.keys(hidden).length) out.sealed = await sealValue(key, { c: clientId, ...hidden }, aad);
  return out;
}

async function openEntry(entry, { key, aad, clientId }) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  if (out.poster && typeof out.poster === "object") out.poster = await openEntry(out.poster, { key, aad, clientId });
  if (typeof out.sealed !== "string") return out;
  const hidden = await openValue(key, out.sealed, aad);
  if (clientId && hidden.c !== clientId) throw new CryptoError("wrong_message");
  delete out.sealed;
  const { c: _c, key: fileKey, mime, ...rest } = hidden;
  Object.assign(out, rest);
  if (fileKey) out.sealed = { key: fileKey, ...(mime ? { mime } : {}) };
  return out;
}

/**
 * Seals a message about to be sent (or an edit, with the original's clientId and kind). `preview`
 * is the short line a notification shows ("good morning ♡", "📷 a photo: look!!").
 */
export async function sealMessage({ key, keyId }, { clientId, sender, kind, body = "", media = null, preview = null, ...rest }) {
  if (!clientId || !sender || !kind) throw new CryptoError("bad_message");
  const sealedBody = await sealValue(key, { c: clientId, t: String(body ?? "") }, aadFor("message", sender, kind));
  const sealedMedia = await mapEntries(media, (entry, top) => sealEntry(entry, { key, aad: aadFor("media", sender, kind), clientId, kind, top }));
  const enc = { v: 1, k: keyId };
  if (preview) enc.n = await sealValue(key, { c: clientId, t: String(preview).slice(0, 180) }, aadFor("notify", sender, kind));
  return { ...rest, clientId, kind, body: sealedBody, media: sealedMedia, enc };
}

/**
 * Opens a sealed message (or a reply preview, or a memory's copy) with the right chat key.
 * `keyFor(id)` returns the CryptoKey for a key id, or null. Throws when it can't be opened.
 */
export async function openMessage(keyFor, message) {
  const key = await keyFor(message.enc.k);
  if (!key) throw new CryptoError("no_key");
  const { sender, kind } = message;
  const opened = await openValue(key, message.body, aadFor("message", sender, kind));
  if (message.clientId && opened.c !== message.clientId) throw new CryptoError("wrong_message");
  const media = await mapEntries(message.media, (entry) => openEntry(entry, { key, aad: aadFor("media", sender, kind), clientId: opened.c }));
  return { body: typeof opened.t === "string" ? opened.t : "", media, clientId: opened.c };
}

/** The notification preview inside `enc.n`. */
export async function openPreview(keyFor, { enc, sender, kind, clientId }) {
  const key = await keyFor(enc?.k);
  if (!key || !enc?.n) throw new CryptoError("no_key");
  const opened = await openValue(key, enc.n, aadFor("notify", sender, kind));
  if (clientId && opened.c !== clientId) throw new CryptoError("wrong_message");
  return opened.t;
}
