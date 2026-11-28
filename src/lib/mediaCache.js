// Sealed chat files kept on the phone (round 3): photos, videos, posters and voice notes are stored
// once fetched, as the sealed bytes the server holds (AES-GCM, src/lib/chatCrypto.js). Their keys
// travel only inside sealed messages, so this cache is unreadable on its own: nothing here can be
// opened by another app or from a backup without the chat key. Opening happens in memory each time
// (fast); the network is skipped. Capped by size, oldest-used first out.
import { createStore, del, get, set } from "idb-keyval";

const store = typeof indexedDB !== "undefined" ? createStore("kiriya-media", "files") : null;
const CAP_BYTES = 250 * 1024 * 1024;
const ITEM_MAX_BYTES = 64 * 1024 * 1024;
const INDEX = "__index";

let index = null; // key → { size, at }
let indexWrite = 0;

async function loadIndex() {
  if (index) return index;
  const saved = store ? await get(INDEX, store).catch(() => null) : null;
  index = new Map(Object.entries(saved ?? {}));
  return index;
}

function saveIndexSoon() {
  clearTimeout(indexWrite);
  indexWrite = setTimeout(() => store && set(INDEX, Object.fromEntries(index), store).catch(() => {}), 800);
}

/** The same file whatever link it came by (the app's links carry a changing signature). */
export function mediaKey(url) {
  try {
    const parsed = new URL(url, "https://kiriya.love");
    if (parsed.pathname === "/api/uploads/media") return `media:${parsed.searchParams.get("path")}`;
    const file = parsed.pathname.match(/^\/api\/uploads\/file\/(.+)$/);
    if (file) return `file:${file[1]}`;
  } catch {
    // Not a link we know: not cached.
  }
  return null;
}

async function evict() {
  let total = 0;
  for (const entry of index.values()) total += entry.size;
  if (total <= CAP_BYTES) return;
  const oldest = [...index.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [key, entry] of oldest) {
    if (total <= CAP_BYTES * 0.8) break;
    index.delete(key);
    total -= entry.size;
    await del(key, store).catch(() => {});
  }
  saveIndexSoon();
}

/**
 * The sealed bytes of one chat file: from the phone when kept, else `fetcher()` (which returns
 * `{ bytes, type }`), kept for next time.
 */
export async function cachedBytes(url, fetcher) {
  const key = store ? mediaKey(url) : null;
  if (!key) return fetcher();
  await loadIndex();
  const hit = await get(key, store).catch(() => null);
  if (hit?.bytes) {
    index.set(key, { size: hit.bytes.byteLength, at: Date.now() });
    saveIndexSoon();
    return hit;
  }
  const fresh = await fetcher();
  const size = fresh?.bytes?.byteLength ?? 0;
  if (size && size <= ITEM_MAX_BYTES)
    set(key, { bytes: fresh.bytes, type: fresh.type ?? null }, store)
      .then(() => {
        index.set(key, { size, at: Date.now() });
        saveIndexSoon();
        return evict();
      })
      .catch(() => {});
  return fresh;
}

/** How much is kept (for the tests and a future settings line). */
export async function mediaCacheSize() {
  await loadIndex();
  let total = 0;
  for (const entry of index.values()) total += entry.size;
  return { files: index.size, bytes: total };
}
