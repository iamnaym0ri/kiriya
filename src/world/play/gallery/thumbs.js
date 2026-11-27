// Small copies of her saved pictures for the gallery's tiles. Every piece is stored full size (a
// 1600 px doodle is about 10 MB once the phone decodes it), so a grid of fifty of them would hold
// hundreds of MB and can make iOS close the app. A tile shows a 320 px copy instead (about 0.4 MB
// decoded), made on the phone the first time it's needed and kept in IndexedDB, so it is made once
// per piece. The big viewer still shows the full picture.

const EDGE = 320; // the short edge in px: crisp in a 122 pt tile at 2×
const DB_NAME = "kiriya-gallery-thumbs";
const STORE = "thumbs";
const AT_ONCE = 2;

const ready = new Map(); // art id → object URL (this visit)
const waiting = new Map(); // art id → Promise<string>
const failed = new Set(); // art ids whose copy couldn't be made (the tile shows the full picture)
const queue = []; // { run, where }: the job whose tile is nearest the middle of the screen goes first
let running = 0;

// ---------- the cache on the phone ----------
let opening = null;
function database() {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null); // private mode or blocked storage: copies are made each visit instead
    }
  });
  return opening;
}
async function inStore(mode, work) {
  const db = await database();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result ?? null);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ---------- making a copy ----------
async function makeCopy(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`picture ${response.status}`);
  const original = await response.blob();
  const link = URL.createObjectURL(original);
  const image = new Image();
  try {
    image.decoding = "async";
    image.src = link;
    await image.decode(); // off the main thread in WebKit
    const { naturalWidth: w, naturalHeight: h } = image;
    const scale = Math.min(1, EDGE / Math.min(w, h));
    if (scale > 0.8) return original; // already small
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdfb"; // the tile's paper, under any see-through parts
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const copy = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    canvas.width = canvas.height = 0;
    if (!copy) throw new Error("no copy");
    return copy;
  } finally {
    image.src = "";
    URL.revokeObjectURL(link);
  }
}

/** The waiting job nearest the screen (a tile scrolled to just now beats ones that went by). */
function nextJob() {
  let best = 0, bestDistance = Infinity;
  queue.forEach((job, i) => {
    const distance = job.where?.() ?? Infinity;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return queue.splice(best, 1)[0];
}

function pump() {
  while (running < AT_ONCE && queue.length) {
    const job = nextJob().run;
    running += 1;
    job()
      .catch(() => {})
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

/**
 * The tile-sized copy of `art` as an object URL. Resolves to null when one can't be made (an odd
 * picture, no network): the tile then shows the picture itself, as before. `element` (the tile)
 * lets the copies on screen be made before the ones above and below it.
 */
export function thumbFor(art, element = null) {
  const id = art?.id;
  if (!id || !art.url) return Promise.resolve(null);
  if (ready.has(id)) return Promise.resolve(ready.get(id));
  if (failed.has(id)) return Promise.resolve(null);
  if (waiting.has(id)) return waiting.get(id);
  const where = element
    ? () => {
        if (!element.isConnected) return Infinity;
        const box = element.getBoundingClientRect();
        return Math.abs(box.top + box.height / 2 - innerHeight / 2) + Math.abs(box.left + box.width / 2 - innerWidth / 2);
      }
    : null;
  const promise = new Promise((resolve) => {
    queue.push({ where, run: async () => {
      try {
        let blob = await inStore("readonly", (store) => store.get(id));
        if (!(blob instanceof Blob)) {
          blob = await makeCopy(art.url);
          inStore("readwrite", (store) => store.put(blob, id));
        }
        const url = URL.createObjectURL(blob);
        ready.set(id, url);
        resolve(url);
      } catch {
        failed.add(id);
        resolve(null);
      } finally {
        waiting.delete(id);
      }
    } });
    pump();
  });
  waiting.set(id, promise);
  return promise;
}

/** The copy, if it's already made this visit (so a tile can draw it at once). */
export const thumbNow = (id) => ready.get(id) ?? null;
export const thumbFailed = (id) => failed.has(id);

/** Forgets copies of pieces that are gone from her gallery (deleted). */
export async function keepOnly(ids) {
  const keep = new Set(ids);
  const keys = (await inStore("readonly", (store) => store.getAllKeys())) ?? [];
  const gone = keys.filter((key) => !keep.has(key));
  if (gone.length) await inStore("readwrite", (store) => gone.forEach((key) => store.delete(key)));
  for (const id of ready.keys())
    if (!keep.has(id)) {
      URL.revokeObjectURL(ready.get(id));
      ready.delete(id);
    }
}
