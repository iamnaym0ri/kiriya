// Sealing the plain history in place. Messages (and memories of them) from before both of them had
// a key pair are plain on the server, and messages sealed with a key that a reset retired need the
// new one. Whichever device holds the key does it, a few at a time, while the chat is open:
// - photos, videos and voice notes are fetched, sealed with their own key and uploaded again; the
//   server deletes the plain copy once nothing points at it (server/lib/chatKeys.js storeSealed);
// - a lease keeps two devices from doing it at once, and the server writes a row only if it is
//   still what the device read.
import { api } from "../api.js";
import { viewingAs } from "../viewAs.js";
import { isSealedMessage, openMessage, sealBytes, sealMessage } from "./core.js";
import { chatKeyState, currentKey, ensureChatKeys, keyFor } from "./keyring.js";

const DEVICE_KEY = "kiriya:chat-device";
let deviceId = null;
function device() {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) localStorage.setItem(DEVICE_KEY, (deviceId = `d-${crypto.randomUUID()}`));
  } catch {
    deviceId = `d-${crypto.randomUUID()}`;
  }
  return deviceId;
}

const isPrivateUpload = (url) => typeof url === "string" && /^(?:https:\/\/[^/]+)?\/api\/uploads\/(?:media\?|file\/)/.test(url);

async function defaultUpload(file) {
  const { uploadFile } = await import("../uploads.js");
  return uploadFile(file, { folder: "chat" });
}
async function defaultFetch(url) {
  const { apiUrl, authHeaders, isBundledApp } = await import("../api.js");
  const signed = /[?&]s=[A-Za-z0-9_-]{22}/.test(url);
  const response = await fetch(url.startsWith("/api/") ? apiUrl(url.slice(4)) : url, { credentials: isBundledApp ? "omit" : "same-origin", headers: signed ? {} : authHeaders() });
  if (!response.ok) throw new Error(`file ${response.status}`);
  return { bytes: await response.arrayBuffer(), type: response.headers.get("content-type") };
}

/** Each plain file in a message's media, sealed and uploaded again (once per file, even if shared). */
async function sealFiles(media, ctx) {
  const visit = async (entry) => {
    if (!entry || typeof entry !== "object") return entry;
    let out = { ...entry };
    if (out.poster) out.poster = await visit(out.poster);
    if (isPrivateUpload(out.url) && !(out.sealed && typeof out.sealed === "object")) {
      if (!ctx.files.has(out.url)) {
        ctx.files.set(
          out.url,
          (async () => {
            const { bytes, type } = await ctx.fetchFile(out.url);
            const { data, key } = await sealBytes(bytes);
            const stored = await ctx.upload(new File([data], "sealed.bin", { type: "application/octet-stream" }));
            return { url: stored.url, sealed: { key, mime: out.mime ?? (type && type !== "application/octet-stream" ? type.split(";")[0] : "application/octet-stream") } };
          })(),
        );
      }
      const fresh = await ctx.files.get(out.url);
      out = { ...out, url: fresh.url, sealed: fresh.sealed };
    }
    return out;
  };
  if (!media || typeof media !== "object") return media ?? null;
  if (Array.isArray(media.items)) return { ...media, items: await Promise.all(media.items.map(visit)) };
  return visit(media);
}

async function plainOf(message) {
  if (!isSealedMessage(message)) return { body: message.body ?? "", media: message.media ?? null };
  const opened = await openMessage(keyFor, message);
  return { body: opened.body, media: opened.media };
}

async function sealRow(row, ctx) {
  const plain = await plainOf(row);
  const media = await sealFiles(plain.media, ctx);
  const sealed = await sealMessage(currentKey(), { clientId: row.clientId, sender: row.sender, kind: row.kind, body: plain.body, media });
  return { id: row.id, was: row.was, body: sealed.body, enc: sealed.enc, media: sealed.media };
}

async function sealMemory(memory, ctx) {
  const snapshot = memory.snapshot;
  const clientId = snapshot.clientId ?? memory.sourceId;
  const plain = await plainOf({ ...snapshot, clientId });
  const media = await sealFiles(plain.media, ctx);
  const sealed = await sealMessage(currentKey(), { clientId, sender: snapshot.sender, kind: snapshot.kind, body: plain.body, media });
  return { id: memory.id, was: memory.was, snapshot: { body: sealed.body, enc: sealed.enc, media: sealed.media, clientId } };
}

let running = null;

/**
 * Seals whatever is still plain (or on a retired key). Resolves to { sealed, skipped }. Safe to call
 * every time the chat opens: it does nothing when there's nothing to do, or another device is on it.
 */
export function sealHistory(options = {}) {
  running ??= run(options).finally(() => {
    running = null;
  });
  return running;
}

async function run({ upload = defaultUpload, fetchFile = defaultFetch, onProgress = () => {} } = {}) {
  await ensureChatKeys();
  if (chatKeyState().status !== "ready" || viewingAs()) return { sealed: 0, skipped: 0, idle: true };
  const job = { ctx: { upload, fetchFile, files: new Map() }, onProgress, sealed: 0, skipped: 0, claimed: false };
  try {
    return await rounds(job);
  } finally {
    // Done (or stopped): another device may start straight away.
    if (job.claimed) await api("/me/chat/keys/claim", { method: "POST", body: { device: device(), release: true } }).catch(() => {});
  }
}

async function rounds(job) {
  let after = null;
  let memoriesAfter = null;
  for (let round = 0; round < 200; round++) {
    const query = new URLSearchParams({ ...(after ? { after } : {}), ...(memoriesAfter ? { memoriesAfter } : {}) });
    const work = await api(`/me/chat/keys/pending${query.size ? `?${query}` : ""}`);
    if (!work.current || work.current !== chatKeyState().current) break;
    if (!work.messages.length && !work.memories.length) break;
    if (!job.claimed) {
      const lease = await api("/me/chat/keys/claim", { method: "POST", body: { device: device() } });
      if (!lease.ok) return { sealed: job.sealed, skipped: job.skipped, busy: true };
      job.claimed = true;
    }
    const messages = [];
    const memories = [];
    for (const row of work.messages) {
      try {
        messages.push(await sealRow(row, job.ctx));
      } catch {
        job.skipped++; // a key this device never had, or a file that's gone: left for another device
      }
    }
    for (const memory of work.memories) {
      try {
        memories.push(await sealMemory(memory, job.ctx));
      } catch {
        job.skipped++;
      }
    }
    after = work.messages.at(-1)?.createdAt ?? after;
    memoriesAfter = work.memories.at(-1)?.createdAt ?? memoriesAfter;
    if (messages.length || memories.length) {
      const result = await api("/me/chat/keys/sealed", { method: "POST", body: { device: device(), messages, memories } });
      job.sealed += result.sealed;
      job.onProgress({ sealed: job.sealed, skipped: job.skipped });
    }
  }
  return { sealed: job.sealed, skipped: job.skipped };
}
