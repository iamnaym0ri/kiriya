// The chat kept on the phone (round 3), so it opens at once with the latest messages while a quiet
// refresh runs behind them. What's kept is the newest few pages exactly as the server sent them:
// sealed when the chat is end-to-end encrypted (src/lib/chatCrypto.js), so nothing on the device
// is readable without the chat key; they're opened again when the chat starts. (Messages from before
// both of them had keys are plain on the server too, and are kept as they are, like letters and
// notes.) It's dropped when the app locks or signs out, and when someone else signs in.
//
// The rest of the app's cache (src/lib/persist.js) skips the chat's queries: those hold opened words.
import { createStore, del, get, set } from "idb-keyval";

const store = typeof indexedDB !== "undefined" ? createStore("kiriya-chat", "cache") : null;
const KEY = "latest";
const VERSION = 1;
const KEEP_PAGES = 3; // about 120 messages: a screen and plenty of scroll-back, and fast to open

/** The server's own copy of each message seen this session (sealed as stored), by id. */
const raw = new Map();
const RAW_MAX = 2000;

export function rememberRaw(messages) {
  for (const message of messages ?? []) if (message?.id) raw.set(message.id, message);
  if (raw.size > RAW_MAX) for (const id of [...raw.keys()].slice(0, raw.size - RAW_MAX)) raw.delete(id);
}

/** A message as it's kept: the server's copy, with what live events changed since (reactions, deletion). */
function keepable(message) {
  const original = raw.get(message.id);
  if (!original || message.pending || message.failed) return null;
  if (message.kind === "deleted") return { ...original, kind: "deleted", body: "", media: null, enc: null, editedAt: null, reactions: {} };
  return { ...original, reactions: message.reactions ?? original.reactions ?? {} };
}

const PAGE_FIELDS = ["me", "names", "live", "reads", "unread"];

/** What's written to the phone for the chat's current pages (null when there's nothing to keep). */
export function cacheRecord(data, now = Date.now()) {
  if (!data?.pages?.length) return null;
  const pages = data.pages.slice(0, KEEP_PAGES).map((page, i) => ({
    ...(i === 0 ? Object.fromEntries(PAGE_FIELDS.map((field) => [field, page[field]])) : {}),
    next: page.next ?? null,
    messages: page.messages.map(keepable).filter(Boolean),
  }));
  if (!pages[0].me) return null;
  return { v: VERSION, savedAt: now, pageParams: (data.pageParams ?? [null]).slice(0, KEEP_PAGES), pages };
}

export async function saveChat(data) {
  const record = store ? cacheRecord(data) : null;
  if (record) await set(KEY, record, store);
}

export async function loadChat() {
  if (!store) return null;
  const kept = await get(KEY, store).catch(() => null);
  if (!kept || kept.v !== VERSION || !kept.pages?.length) return null;
  for (const page of kept.pages) rememberRaw(page.messages);
  return kept;
}

export async function forgetChat() {
  raw.clear();
  if (store) await del(KEY, store).catch(() => {});
}
