// The query cache is kept on the device (IndexedDB), so every page opens straight away with what
// she saw last while fresh data loads behind it (docs/refactor/PLAN.md 4b "smoothness"). The session
// itself is never kept, so a locked or expired session still shows the passphrase or Face ID first;
// locking wipes the copy (session.js forgetSession).
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, del, get, set } from "idb-keyval";

// Bump when a cached response's shape changes in a way old pages can't read.
// 2026-11-28: drops copies made before the chat's opened words were kept out (below).
const CACHE_VERSION = "2026-11-28";

// The chat's messages, its summary and saved memories hold opened (end-to-end decrypted) words, so
// they are never written here; the chat keeps its own sealed copy (src/lib/chatCache.js).
const OPENED_WORDS = new Set(["messages", "summary", "memories"]);
const holdsOpenedWords = (key) => key[0] === "me" && (key[1] === "memories" || (key[1] === "chat" && OPENED_WORDS.has(key[2])));
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const store = typeof indexedDB !== "undefined" ? createStore("kiriya-cache", "queries") : null;
const storage = store
  ? { getItem: (key) => get(key, store), setItem: (key, value) => set(key, value, store), removeItem: (key) => del(key, store) }
  : undefined;

// IndexedDB stores objects as they are, so skip the JSON round trip.
const persister = createAsyncStoragePersister({ storage, key: "kiriya-queries", throttleTime: 1500, serialize: (client) => client, deserialize: (client) => client });

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: CACHE_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === "success" && query.queryKey[0] !== "session" && query.meta?.persist !== false && !holdsOpenedWords(query.queryKey),
  },
};

export async function clearPersistedCache() {
  await persister.removeClient().catch(() => {});
}
