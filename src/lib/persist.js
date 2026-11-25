// The query cache is kept on the device (IndexedDB), so every page opens straight away with what
// she saw last while fresh data loads behind it (docs/refactor/PLAN.md 4b "smoothness"). The session
// itself is never kept, so a locked or expired session still shows the passphrase or Face ID first;
// locking wipes the copy (session.js forgetSession).
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, del, get, set } from "idb-keyval";

// Bump when a cached response's shape changes in a way old pages can't read.
const CACHE_VERSION = "2026-11-24";
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
    shouldDehydrateQuery: (query) => query.state.status === "success" && query.queryKey[0] !== "session" && query.meta?.persist !== false,
  },
};

export async function clearPersistedCache() {
  await persister.removeClient().catch(() => {});
}
