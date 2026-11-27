// Where this device's chat keys live and how they get there (the pure crypto is ./core.js).
//
// - IndexedDB keeps, per person signed in here, their private key and every chat key derived from
//   it, all as non-extractable CryptoKeys: script can use them but never read them out.
// - In the iPhone app the Keychain keeps a copy too (./native.js), so the notification extension
//   can open previews and a phone that opens with Face ID never needs the passphrase again.
// - A fresh device needs the passphrase once: the one typed at sign-in is handed over in memory
//   (rememberPassphrase), used straight away and dropped. It is never stored, logged or cached.
//   A device that signed in with Face ID and somehow has no key asks once (lock/ChatGate.jsx).
import { createStore, get, set } from "idb-keyval";
import { api } from "../api.js";
import { viewingAs } from "../viewAs.js";
import {
  CryptoError,
  deriveChatKey,
  exportPrivate,
  generateIdentity,
  importChatKey,
  importPrivate,
  keyIdOf,
  samePair,
  unwrapIdentity,
  wrapIdentity,
} from "./core.js";
import { loadNativeIdentity, nativeHasKey, saveNativeIdentity, saveNativeKeys } from "./native.js";

const other = (role) => (role === "kiriya" ? "admin" : "kiriya");
const store = typeof indexedDB !== "undefined" ? createStore("kiriya-chat-keys", "keys") : null;
// If IndexedDB can't hold CryptoKeys (very old browsers), keys live for this visit only.
const memory = new Map();

async function readLocal(role) {
  if (memory.has(role)) return memory.get(role);
  let record = null;
  try {
    record = store ? ((await get(role, store)) ?? null) : null;
  } catch {
    record = null;
  }
  if (record) memory.set(role, record);
  return record;
}
async function writeLocal(role, record) {
  memory.set(role, record);
  try {
    if (store) await set(role, record, store);
  } catch {
    // Kept in memory for this visit; the Keychain copy (in the app) covers the next one.
  }
}

// ---------- state ----------
// status: "idle" (not looked yet) · "loading" · "plain" (they don't both have a key yet: messages
// go as they are) · "ready" (this device seals and opens) · "locked" (both have keys but this device
// needs the passphrase once) · "offline" (couldn't ask the server; tries again later)

let state = { status: "idle", me: null, current: null, setUp: false, partnerSetUp: false, safety: null, partnerChangedAt: null };
const keyring = new Map(); // key id → CryptoKey
const listeners = new Set();
let loading = null;
let loadedAt = 0;

export const chatKeyState = () => state;
// Locking forgets the keys held in memory (the device copy stays, so Face ID can reopen).
if (typeof window !== "undefined")
  window.addEventListener("kiriya:locked", () => {
    keyring.clear();
    memory.clear();
    loadedAt = 0;
    update({ status: "idle", me: null, current: null, safety: null });
  });

export function subscribeChatKeys(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function update(change) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kiriya:chat-keys", { detail: { status: state.status } }));
}

/** The key for an id, if this device has it. */
export const keyFor = async (id) => (id ? (keyring.get(id) ?? null) : null);
export const hasChatKey = (id) => keyring.has(id);
export const currentKey = () => (state.status === "ready" && state.current ? { key: keyring.get(state.current), keyId: state.current } : null);

// ---------- the safety code ----------
// Both phones show the same little code when nothing sits between them (the key id names both
// public keys). A server handing each of them someone else's key would make the codes differ.
const SAFETY = ["🌸", "🍓", "🌙", "⭐", "🍑", "🐰", "🐱", "🦋", "🍰", "🎀", "🌷", "🍒", "☁️", "🫧", "🍡", "🌈"];
async function safetyCode(keyId) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kiriya.love/safety/v1|${keyId}`)));
  return Array.from(digest.subarray(0, 6), (byte) => SAFETY[byte % SAFETY.length]).join(" ");
}

// ---------- loading ----------

/** Loads (or reloads) this device's keys. Safe to call often: one load runs at a time. */
export function ensureChatKeys({ force = false } = {}) {
  if (loading) return loading;
  if (!force && ["ready", "plain", "locked"].includes(state.status) && Date.now() - loadedAt < 5 * 60_000) return Promise.resolve(state);
  if (!force && state.status === "offline" && Date.now() - loadedAt < 15_000) return Promise.resolve(state);
  loading = load()
    .catch((error) => {
      update({ status: state.status === "ready" ? "ready" : "offline", error: error?.message ?? "offline" });
      return state;
    })
    .finally(() => {
      loading = null;
      loadedAt = Date.now();
    });
  return loading;
}

async function load({ passphrase = null, verified = false } = {}) {
  if (state.status === "idle") update({ status: "loading" });
  let info = await api("/me/chat/keys");
  const me = info.me;
  let local = await readLocal(me);
  // A record from another sign-in on this browser belongs to that person; this one starts empty.
  if (local && local.role !== me) local = null;

  // 1. My own key pair.
  const mine = info.keys[me];
  let privateKey = local?.privateKey && mine && local.publicKey === mine.publicKey ? local.privateKey : null;
  if (!privateKey && mine) {
    // The web view's storage may have been cleared; the phone's Keychain still has it.
    const kept = await loadNativeIdentity(me);
    if (kept && kept.publicKey === mine.publicKey) {
      const key = await importPrivate(kept.privateKey);
      if (await samePair(key, mine.publicKey)) privateKey = key;
    }
  }
  if (!privateKey && passphrase) {
    // While Josh peeks at her side nothing may change on the server: opening his key is fine.
    ({ info, privateKey } = await adoptIdentity(info, passphrase, { verified, readOnly: Boolean(viewingAs()) }));
    local = await readLocal(me);
  }

  // 2. Chat keys: with their current key and any key a reset retired.
  const keys = { ...(local?.keys ?? {}) };
  const myPublic = info.keys[me]?.publicKey ?? null;
  const theirs = info.keys[other(me)];
  if (privateKey && myPublic) {
    const theirPublics = [theirs?.publicKey, ...(info.history[other(me)] ?? []).map((old) => old.publicKey)].filter(Boolean);
    const forKeychain = {};
    for (const theirPublic of theirPublics) {
      const pair = me === "kiriya" ? { kiriya: myPublic, admin: theirPublic } : { kiriya: theirPublic, admin: myPublic };
      const id = await keyIdOf(pair.kiriya, pair.admin);
      // The key in use must also be in the Keychain (a reinstall keeps one and loses the other).
      const missingNatively = id === info.current && !(await nativeHasKey(id));
      if (keys[id] && !missingNatively) continue;
      const { raw } = await deriveChatKey(privateKey, pair, me);
      keys[id] ??= await importChatKey(raw);
      forKeychain[id] = raw;
    }
    // The notification extension and the widgets read this copy (they can't reach IndexedDB).
    await saveNativeKeys(forKeychain, info.current);
    Object.values(forKeychain).forEach((raw) => raw.fill(0));
  }
  for (const [id, key] of Object.entries(keys)) keyring.set(id, key);

  // 3. Remember what we saw of their key, to notice when it changes (a reset on their side).
  const seen = local?.seen ?? {};
  let partnerChangedAt = local?.partnerChangedAt ?? null;
  if (theirs?.publicKey && seen[other(me)] && seen[other(me)] !== theirs.publicKey) partnerChangedAt = new Date().toISOString();
  if (theirs?.publicKey) seen[other(me)] = theirs.publicKey;
  // (A private key and its public key are only ever written together, so they can't mismatch.)
  const pairToKeep = privateKey ? { publicKey: myPublic, privateKey } : { publicKey: local?.publicKey ?? null, privateKey: local?.privateKey ?? null };
  if (local || privateKey) await writeLocal(me, { ...(local ?? {}), role: me, ...pairToKeep, keys, seen, partnerChangedAt });

  const current = info.current;
  const status = !current ? "plain" : keyring.has(current) ? "ready" : "locked";
  update({
    status,
    me,
    current,
    setUp: Boolean(info.keys[me] && privateKey),
    serverHasMine: Boolean(info.keys[me]),
    partnerSetUp: Boolean(theirs),
    safety: current && keyring.has(current) ? await safetyCode(current) : null,
    partnerChangedAt,
    error: null,
  });
  return state;
}

/**
 * With the passphrase: opens the stored key pair, or makes the first one, or (when the stored
 * copy was wrapped under a passphrase that has since been reset) wraps this phone's copy again or
 * starts a new pair. Stores the private key on this device. The passphrase goes nowhere else.
 */
async function adoptIdentity(info, passphrase, { verified, readOnly = false }) {
  const me = info.me;
  if (info.wrapped && info.keys[me]) {
    try {
      const key = await unwrapIdentity(info.wrapped, passphrase, me, { extractable: true });
      return { info, privateKey: await keepIdentity(me, key, info.keys[me].publicKey) };
    } catch (error) {
      if (error.code !== "wrong_passphrase" || readOnly) throw error;
    }
    // Wrapped under an older passphrase. Make sure this one is right before changing anything.
    if (!verified) await api("/me/passphrase/check", { method: "POST", body: { passphrase } });
    const kept = await loadNativeIdentity(me);
    if (kept && kept.publicKey === info.keys[me].publicKey) {
      const key = await importPrivate(kept.privateKey, { extractable: true });
      const next = await api("/me/chat/keys", { method: "PUT", body: { publicKey: kept.publicKey, wrapped: await wrapIdentity(key, passphrase, me) } });
      return { info: next, privateKey: await keepIdentity(me, key, kept.publicKey) };
    }
    return createIdentity(me, passphrase, { replace: true });
  }
  if (readOnly) throw new CryptoError("preview");
  return createIdentity(me, passphrase, { replace: false });
}

async function createIdentity(me, passphrase, { replace }) {
  const pair = await generateIdentity();
  const wrapped = await wrapIdentity(pair.privateKey, passphrase, me);
  try {
    const info = await api("/me/chat/keys", { method: "PUT", body: { publicKey: pair.publicKey, wrapped, ...(replace ? { replace: true } : {}) } });
    return { info, privateKey: await keepIdentity(me, pair.privateKey, pair.publicKey) };
  } catch (error) {
    // Another of my devices made one a moment ago: open that one instead.
    if (error?.status === 409 && error.body?.wrapped) {
      const key = await unwrapIdentity(error.body.wrapped, passphrase, me, { extractable: true });
      return { info: error.body, privateKey: await keepIdentity(me, key, error.body.keys[me].publicKey) };
    }
    throw error;
  }
}

/** Keeps a private key on this device: non-extractable in IndexedDB, and in the app's Keychain. */
async function keepIdentity(me, extractableKey, publicKey) {
  const pkcs8 = await exportPrivate(extractableKey);
  await saveNativeIdentity(me, publicKey, pkcs8);
  const privateKey = await importPrivate(pkcs8);
  const local = await readLocal(me);
  await writeLocal(me, { ...(local?.role === me ? local : {}), role: me, publicKey, privateKey, keys: local?.role === me ? (local.keys ?? {}) : {} });
  return privateKey;
}

// ---------- the passphrase ----------

/**
 * Sign-in hands over the passphrase it just checked (src/lib/session.js useUnlock). It is used at
 * once to open (or make) this device's key and then dropped: no copy stays in this module.
 */
export function rememberPassphrase(passphrase) {
  if (typeof passphrase !== "string" || !passphrase) return Promise.resolve(state);
  return unlockChatKeys(passphrase, { verified: true }).catch(() => state);
}

/**
 * Opens this device's keys with the passphrase (the chat gate's "type it once" sheet, or sign-in).
 * Unverified passphrases are checked with the server first (the same budget as signing in).
 */
export async function unlockChatKeys(passphrase, { verified = false } = {}) {
  while (loading) await loading.catch(() => {});
  loading = load({ passphrase, verified }).finally(() => {
    loading = null;
    loadedAt = Date.now();
  });
  return loading;
}

// ---------- passphrase changes ----------

/**
 * For a passphrase change (src/world/me): the same key pair wrapped under the new passphrase, to
 * send with the change so both land together. Null when there's no key yet or it can't be opened.
 */
export async function rewrapForPassphraseChange(current, next) {
  const info = await api("/me/chat/keys").catch(() => null);
  if (!info?.wrapped) return null;
  try {
    const key = await unwrapIdentity(info.wrapped, current, info.me, { extractable: true });
    return { wrapped: await wrapIdentity(key, next, info.me) };
  } catch {
    const kept = await loadNativeIdentity(info.me);
    if (!kept || kept.publicKey !== info.keys[info.me]?.publicKey) return null;
    return { wrapped: await wrapIdentity(await importPrivate(kept.privateKey, { extractable: true }), next, info.me) };
  }
}

export { CryptoError };
