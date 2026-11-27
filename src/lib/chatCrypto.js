// End-to-end encryption for the chat (round 3). The hooks the chat calls (the contract in
// docs/refactor/RENOVATION.md "Chat contract, round 3"):
// - every outgoing message and edit goes through `sealOutgoing` just before it leaves the phone,
// - everything that arrives (pages, realtime catch-ups, a send's echo, reply previews, the summary,
//   memories) goes through `openIncoming` before anything renders it,
// - every photo, video and voice note is sealed with `sealFile` before upload, and shown with
//   `useMediaUrl`.
// The crypto is ./chatCrypto/core.js, the keys ./chatCrypto/keyring.js, and the design is written
// up in docs/refactor/CHAT-CRYPTO.md. Until both of them have a key pair, messages go as they are
// (and are sealed in place later, ./chatCrypto/history.js).
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiUrl, authHeaders, isBundledApp } from "./api.js";
import { CryptoError, aadFor, isSealedMessage, openBytes, openMessage, openPreview, openValue, sealBytes, sealMessage, sealValue } from "./chatCrypto/core.js";
import { chatKeyState, currentKey, ensureChatKeys, hasChatKey, keyFor, subscribeChatKeys } from "./chatCrypto/keyring.js";

export { rememberPassphrase, unlockChatKeys, rewrapForPassphraseChange, ensureChatKeys, chatKeyState } from "./chatCrypto/keyring.js";
export { sealHistory } from "./chatCrypto/history.js";

const locked = () => new CryptoError("chat_locked", "Open your messages on this device first ♡");

/** Whether this device can send right now: false only while it waits for the passphrase. */
export function chatCryptoReady() {
  return chatKeyState().status !== "locked";
}

/** React: the keys' state ({ status, me, current, safety, … }), live. */
export function useChatKeys() {
  const value = useSyncExternalStore(subscribeChatKeys, chatKeyState, chatKeyState);
  useEffect(() => {
    ensureChatKeys();
  }, []);
  return value;
}

// ---------- notification previews ----------

const KIND_LINE = { image: "📷 sent you a photo", gif: "sent you a GIF", sticker: "sent you a sticker", voice: "🎙️ sent you a voice note", video: "🎬 sent you a video" };

/** The line her notification shows, made on the phone (the server only ever sees it sealed). */
export function previewLine({ kind, body = "", media }) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (kind === "text") return text.slice(0, 180);
  const items = Array.isArray(media?.items) ? media.items : null;
  let line = KIND_LINE[kind] ?? "sent you something";
  if (items?.length) {
    const videos = items.filter((item) => item.type === "video").length;
    const photos = items.length - videos;
    line =
      videos && photos ? `📷 sent you ${items.length} photos & videos`
      : videos ? (videos > 1 ? `🎬 sent you ${videos} videos` : KIND_LINE.video)
      : photos > 1 ? `📷 sent you ${photos} photos`
      : KIND_LINE.image;
  }
  return text ? `${line}: ${text}`.slice(0, 180) : line;
}

// ---------- sending ----------

/**
 * Seals a message before it is sent or edited. Takes the request body ({ clientId, kind, body,
 * media, replyTo, … }; for an edit, the original message's clientId and kind) and returns it with
 * `body` sealed, the media entries' private parts sealed and an `enc` field. Signals (kind "tap")
 * stay plain: their body is one of seven known keys. Throws { code: "chat_locked" } when the chat
 * is sealed but this device hasn't been opened with the passphrase yet.
 */
export async function sealOutgoing(message) {
  if (!message || message.kind === "tap") return message;
  await ensureChatKeys();
  const state = chatKeyState();
  const key = currentKey();
  if (state.status === "ready" && key?.key) return sealMessage(key, { ...message, sender: state.me, preview: previewLine(message) });
  if (state.status === "locked") throw locked();
  // Before both of them have a key pair: plain, as before (sealed in place once they do).
  return stripFileKeys(message);
}

function stripFileKeys(message) {
  const strip = (entry) => {
    if (!entry || typeof entry !== "object" || !("sealed" in entry)) return entry;
    const { sealed: _sealed, ...rest } = entry;
    return rest;
  };
  if (!message.media) return message;
  const media = Array.isArray(message.media.items) ? { ...message.media, items: message.media.items.map((item) => ({ ...strip(item), ...(item.poster ? { poster: strip(item.poster) } : {}) })) } : strip(message.media);
  return { ...message, media };
}

/**
 * Seals a file before upload. Returns `{ blob, sealed }`: upload `blob` (opaque bytes) and keep
 * `sealed` (its key, only ever sent inside the sealed message) on the media entry. Before both of
 * them have keys, files go as they are (`sealed: null`).
 */
export async function sealFile(file) {
  await ensureChatKeys();
  const state = chatKeyState();
  if (state.status === "ready") {
    const { data, key } = await sealBytes(await file.arrayBuffer());
    const blob = new File([data], "sealed.bin", { type: "application/octet-stream" });
    return { blob, sealed: { key, mime: file.type || "application/octet-stream" } };
  }
  if (state.status === "locked") throw locked();
  return { blob: file, sealed: null };
}

// ---------- receiving ----------

const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

async function openReply(reply) {
  if (!reply || !isSealedMessage(reply) || reply.kind === "deleted") return reply ? withoutEnc(reply) : reply;
  try {
    const opened = await openMessage(keyFor, reply);
    return { ...withoutEnc(reply), body: clip(opened.body, 140), media: opened.media ?? reply.media ?? null };
  } catch {
    return { ...withoutEnc(reply), body: "", locked: true };
  }
}

const withoutEnc = ({ enc: _enc, ...rest }) => rest;

/**
 * Opens a message from the server or realtime and returns it with a plain `body` and `media` (and
 * a plain `replyTo` preview), or with `locked: true` when this device can't read it (yet).
 * Plain messages (from before both of them had keys) pass through as they are.
 */
export async function openIncoming(message) {
  if (!message || typeof message !== "object") return message;
  const replyTo = message.replyTo ? await openReply(message.replyTo) : message.replyTo;
  if (!isSealedMessage(message)) return replyTo === message.replyTo ? message : { ...message, replyTo };
  if (message.kind === "deleted") return { ...withoutEnc(message), body: "", media: null, replyTo };
  if (!hasChatKey(message.enc.k)) await ensureChatKeys();
  try {
    const opened = await openMessage(keyFor, message);
    return { ...withoutEnc(message), body: opened.body, media: opened.media, replyTo, sealed: true };
  } catch {
    return { ...withoutEnc(message), body: "", media: null, replyTo, locked: true };
  }
}

/** A memory's copy of a message (`snapshot`), opened the same way. */
export async function openMemorySnapshot(snapshot) {
  if (!snapshot || !isSealedMessage(snapshot)) return snapshot;
  return openIncoming(snapshot);
}

// ---------- small private values (her chat background photo's key) ----------

/** Seals a small value under the chat key: { k, sealed }, or null before the chat is sealed. */
export async function sealPrivate(field, value) {
  await ensureChatKeys();
  const key = currentKey();
  if (chatKeyState().status !== "ready" || !key?.key) return null;
  return { k: key.keyId, sealed: await sealValue(key.key, value, aadFor(field, "prefs", "value")) };
}

/** Opens what sealPrivate made; null when this device can't. */
export async function openPrivate(field, envelope) {
  if (!envelope?.k || !envelope?.sealed) return null;
  if (!hasChatKey(envelope.k)) await ensureChatKeys();
  const key = await keyFor(envelope.k);
  if (!key) return null;
  return openValue(key, envelope.sealed, aadFor(field, "prefs", "value")).catch(() => null);
}

/** The words of a sealed notification preview (for tests and the in-app banner). */
export const openNotificationPreview = (message) => openPreview(keyFor, message);

// ---------- media ----------
// Sealed files are fetched as bytes, opened here and shown through an object URL. Plain private
// files inside a sealed message (whose links the server can't sign for the app) are fetched with
// the app's token the same way; everything else (GIFs, built-in stickers) is used as it is.

const opened = new Map(); // link → Promise<object URL>
const MAX_OPENED = 80;

const isPrivateUpload = (url) => /^(?:https:\/\/[^/]+)?\/api\/uploads\/(?:media\?|file\/)/.test(url);
const isSignedForApp = (url) => /^https:\/\/[^/]+\/api\/uploads\/.*[?&]s=[A-Za-z0-9_-]{22}/.test(url);
const absolute = (url) => (url.startsWith("/api/") ? apiUrl(url.slice(4)) : url);

async function fetchBytes(url) {
  const response = await fetch(absolute(url), { credentials: isBundledApp ? "omit" : "same-origin", headers: isSignedForApp(url) ? {} : authHeaders() });
  if (!response.ok) throw new Error(`media ${response.status}`);
  return { bytes: await response.arrayBuffer(), type: response.headers.get("content-type") };
}

function remember(link, promise) {
  opened.set(link, promise);
  if (opened.size > MAX_OPENED) {
    const [oldest] = opened.keys();
    opened.get(oldest)?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
    opened.delete(oldest);
  }
  promise.catch(() => opened.delete(link));
  return promise;
}

/** The bytes of one media entry, opened (sealed) or as stored. For players that need a Blob. */
export async function mediaBlob(media) {
  if (media?.sealed?.key) {
    const { bytes } = await fetchBytes(media.url);
    return new Blob([await openBytes(bytes, media.sealed.key)], { type: media.sealed.mime ?? media.mime ?? "application/octet-stream" });
  }
  const { bytes, type } = await fetchBytes(media.url);
  return new Blob([bytes], { type: media?.mime ?? type ?? "application/octet-stream" });
}

function objectUrlFor(media) {
  const link = `${media.url}#${media.sealed?.key ?? ""}`;
  return opened.get(link) ?? remember(link, mediaBlob(media).then((blob) => URL.createObjectURL(blob)));
}

/** Whether this entry's link can go straight into an <img>/<video>/<audio>. */
function directUrl(media) {
  const url = media?.url;
  if (typeof url !== "string" || !url) return null;
  if (media.sealed) return null;
  if (!isPrivateUpload(url)) return url; // GIFs, built-in stickers, wallpapers
  if (!isBundledApp || isSignedForApp(url)) return url; // the website's cookie, or a signed link
  return null;
}

/**
 * React hook: a URL an <img>, <video> or <audio> can use for one media entry (an object URL of the
 * opened bytes when it was sealed, else the stored URL). Null while it is still opening.
 */
export function useMediaUrl(media) {
  const direct = directUrl(media);
  const link = media?.url ? `${media.url}#${media?.sealed?.key ?? ""}` : null;
  const [state, setState] = useState({ link: null, url: null });
  useEffect(() => {
    if (direct || !link || typeof media?.url !== "string") return undefined;
    if (media.sealed && typeof media.sealed !== "object") return undefined; // not opened: nothing to show
    let alive = true;
    objectUrlFor(media).then(
      (url) => alive && setState({ link, url }),
      () => alive && setState({ link, url: null }),
    );
    return () => {
      alive = false;
    };
    // The link names the file and its key; nothing else about the entry changes what is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direct, link]);
  if (direct) return direct;
  return state.link === link ? state.url : null;
}
