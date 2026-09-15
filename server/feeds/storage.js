// Saved-copy worker, private Blob storage meter, copy reconciliation and creator-deletion handling.
// Binary media lives only in the private Blob store under `saves/`; Neon holds metadata/accounting.
import { createHash } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { blobOptions, blobReadConfigured } from "../lib/blob.js";
import { FeedError } from "./config.js";
import { sourceHttp } from "./http.js";
import { rows } from "./repository.js";
import { SAVE_LIMITS, reserveCopy, finishCopy } from "./saves.js";

export const COPY_TYPES = {
  image: ["image/png", "image/jpeg", "image/webp"],
  gif: ["image/gif", "image/webp"],
  mp4: ["video/mp4"],
};
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4" };
export const MAX_COPY_ATTEMPTS = 3;
const STORE_KEY = "private-blob";

/** Default Blob operations; tests inject fakes with the same shape. */
export async function blobOps() {
  if (!blobReadConfigured()) return null;
  const sdk = await import("@vercel/blob");
  const options = blobOptions();
  return {
    put: (pathname, body, contentType) =>
      sdk.put(pathname, body, {
        access: "private",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
        ...options,
      }),
    head: async (pathname) => {
      try {
        return await sdk.head(pathname, options);
      } catch (error) {
        if (error?.constructor?.name === "BlobNotFoundError" || /not.?found/i.test(error?.message ?? "")) return null;
        throw error;
      }
    },
    del: (pathname) => sdk.del(pathname, options),
    list: (cursor, prefix) =>
      sdk.list({ cursor, limit: 1000, ...(prefix ? { prefix } : {}), ...options }),
  };
}

/**
 * Fresh measurement of the whole private store: personal uploads (art, avatar, cosplay, songs,
 * photos) and saved copies share one capacity. `list` is a Blob advanced operation, so callers
 * measure at most daily unless a copy finds the meter stale.
 */
export async function measureStorage(db, { ops, now = new Date() } = {}) {
  const blob = ops ?? (await blobOps());
  if (!blob) return { outcome: "not_configured" };
  let cursor, total = 0, saves = 0, objects = 0, pages = 0;
  do {
    const page = await blob.list(cursor);
    pages++;
    for (const item of page.blobs ?? []) {
      objects++;
      total += Number(item.size) || 0;
      if (String(item.pathname).startsWith("saves/")) saves += Number(item.size) || 0;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && pages < 50);
  await db.execute(sql`INSERT INTO feed_storage(key,reserved_bytes,copy_bytes,total_store_bytes,measured_at)
    VALUES (${STORE_KEY},0,${saves},${total},${now.toISOString()}::timestamptz)
    ON CONFLICT(key) DO UPDATE SET copy_bytes=excluded.copy_bytes,total_store_bytes=excluded.total_store_bytes,measured_at=excluded.measured_at`);
  return { outcome: "measured", totalBytes: total, saveBytes: saves, objects, pages };
}

/**
 * Upload grant guard. Unmeasured or stale meters allow uploads (the meter never blocks her uploads
 * without evidence); a fresh meter blocks a grant that could exceed capacity minus headroom.
 */
export async function uploadCapacity(bytes, { now = new Date() } = {}) {
  const { getDb } = await import("../db/client.js");
  const db = await getDb();
  const [row] = await db.select().from(s.feedStorage).where(eq(s.feedStorage.key, STORE_KEY));
  if (!row?.measuredAt || row.totalStoreBytes === null || row.measuredAt < new Date(now.getTime() - 86400000))
    return { ok: true, measured: false };
  const projected = Number(row.totalStoreBytes) + Number(row.reservedBytes) + bytes + SAVE_LIMITS.headroomBytes;
  return { ok: projected <= SAVE_LIMITS.totalStoreBytes, measured: true };
}

export async function storageStatus(db) {
  const [row] = await db.select().from(s.feedStorage).where(eq(s.feedStorage.key, STORE_KEY));
  const counts = rows(
    await db.execute(sql`SELECT copy_state, count(*)::int AS n, coalesce(sum(bytes),0)::bigint AS bytes FROM saves GROUP BY copy_state`),
  );
  const copyBytes = Number(row?.copyBytes ?? 0);
  return {
    measuredAt: row?.measuredAt ?? null,
    totalStoreBytes: row?.totalStoreBytes === null || row?.totalStoreBytes === undefined ? null : Number(row.totalStoreBytes),
    copyBytes,
    reservedBytes: Number(row?.reservedBytes ?? 0),
    limits: SAVE_LIMITS,
    warning: copyBytes >= SAVE_LIMITS.warnBytes,
    saves: Object.fromEntries(counts.map((c) => [c.copy_state, { count: c.n, bytes: Number(c.bytes) }])),
  };
}

const safeName = (save, contentType, buffer) =>
  `saves/${save.id}-${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}.${EXT[contentType]}`;

async function markLinkOnly(db, saveId, reason) {
  await db.execute(sql`UPDATE saves SET copy_state='link_only',copy_error=${reason},copy_token=NULL,copy_lease_until=NULL
    WHERE id=${saveId}::uuid AND copy_state IN('pending','retryable') AND reserved_bytes=0`);
}

/**
 * Copies one approved save's single permitted media file. Never claims success early: the row is
 * `ready` only after the private object exists and accounting completed.
 */
export async function copySave(db, saveId, { registry, ops, http, now = new Date(), deadline = Date.now() + 60000 } = {}) {
  const [save] = await db.select().from(s.saves).where(eq(s.saves.id, saveId));
  if (!save) throw new FeedError("save_not_found", 404);
  if (!["pending", "retryable"].includes(save.copyState)) return { outcome: save.copyState };
  if (save.copyAttempts >= MAX_COPY_ATTEMPTS) {
    await markLinkOnly(db, saveId, save.copyError ?? "copy_attempts_exhausted");
    return { outcome: "link_only", reason: "copy_attempts_exhausted" };
  }
  const blob = ops ?? (await blobOps());
  if (!blob) {
    await markLinkOnly(db, saveId, "storage_not_configured");
    return { outcome: "link_only", reason: "storage_not_configured" };
  }
  const source = registry.find((e) => e.id === save.source);
  const media = save.snapshot?.media?.[0];
  if (!source || source.copyPolicy !== "private_copy" || !media || !COPY_TYPES[media.type]) {
    await markLinkOnly(db, saveId, "copy_not_permitted");
    return { outcome: "link_only", reason: "copy_not_permitted" };
  }
  const [meter] = await db.select().from(s.feedStorage).where(eq(s.feedStorage.key, STORE_KEY));
  if (!meter?.measuredAt || meter.measuredAt < new Date(now.getTime() - 86400000)) await measureStorage(db, { ops: blob, now });
  // Reserve the item ceiling before downloading; completion records the actual size.
  const reservation = await reserveCopy(db, saveId, SAVE_LIMITS.itemBytes, { now });
  if (reservation.outcome !== "reserved") {
    await db.execute(sql`UPDATE saves SET copy_error=${reservation.reason} WHERE id=${saveId}::uuid`);
    return reservation;
  }
  let pathname = null;
  try {
    const client = http ?? sourceHttp(source, { deadline });
    const response = await client.binary(media.url, { types: COPY_TYPES[media.type], maxBytes: SAVE_LIMITS.itemBytes });
    pathname = safeName(save, response.contentType, response.buffer);
    const existing = await blob.head(pathname);
    if (!existing) await blob.put(pathname, response.buffer, response.contentType);
    const stored = existing ?? (await blob.head(pathname));
    if (!stored || Number(stored.size) !== response.buffer.length) throw new FeedError("copy_verification_failed");
    const done = await finishCopy(db, saveId, reservation.token, {
      pathname,
      bytes: response.buffer.length,
      contentType: response.contentType,
    });
    if (!done.finished) throw new FeedError("copy_finish_rejected");
    return { outcome: "ready", pathname, bytes: response.buffer.length };
  } catch (error) {
    // Remove any partial/unaccounted object before releasing the reservation.
    if (pathname) {
      try {
        const leftover = await blob.head(pathname);
        if (leftover) await blob.del(pathname);
      } catch {
        // Cannot confirm cleanup: keep the reservation; reconciliation retries after the lease.
        await db.execute(sql`UPDATE saves SET copy_error=${"cleanup_unconfirmed"} WHERE id=${saveId}::uuid`);
        return { outcome: "reconcile_later", reason: "cleanup_unconfirmed" };
      }
    }
    await finishCopy(db, saveId, reservation.token, { cleanedUp: true });
    const code = error.code ?? "copy_failed";
    await db.execute(sql`UPDATE saves SET copy_error=${code} WHERE id=${saveId}::uuid`);
    const [after] = await db.select().from(s.saves).where(eq(s.saves.id, saveId));
    if (after.copyAttempts >= MAX_COPY_ATTEMPTS || ["blocked", "not_found", "unexpected_content_type", "response_too_large"].includes(code))
      await markLinkOnly(db, saveId, code);
    return { outcome: "failed", reason: code };
  }
}

/**
 * Reconciles copies whose worker disappeared (expired lease): verifies the object first, then
 * completes or cleans up. A reservation is never released while the object state is unknown.
 */
export async function reconcileCopies(db, { ops, now = new Date(), limit = 50 } = {}) {
  const blob = ops ?? (await blobOps());
  if (!blob) return { outcome: "not_configured" };
  const stuck = await db
    .select()
    .from(s.saves)
    .where(and(eq(s.saves.copyState, "copying"), lt(s.saves.copyLeaseUntil, now)))
    .limit(limit);
  const results = [];
  for (const save of stuck) {
    const prefix = `saves/${save.id}-`;
    let found = null;
    try {
      const page = await blob.list(undefined, prefix);
      found = (page.blobs ?? []).find((b) => String(b.pathname).startsWith(prefix)) ?? null;
    } catch {
      results.push({ id: save.id, outcome: "unknown" });
      continue;
    }
    if (found && Number(found.size) > 0 && Number(found.size) <= save.reservedBytes) {
      const ext = String(found.pathname).split(".").pop();
      const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0];
      const done = await finishCopy(db, save.id, save.copyToken, { pathname: found.pathname, bytes: Number(found.size), contentType: type });
      results.push({ id: save.id, outcome: done.finished ? "completed" : "rejected" });
    } else {
      if (found) await blob.del(found.pathname);
      await finishCopy(db, save.id, save.copyToken, { cleanedUp: true });
      results.push({ id: save.id, outcome: "released" });
    }
  }
  return { outcome: "reconciled", results };
}

/** Deletes `saves/` objects that no save row references (after a crash between put and finish). */
export async function cleanupOrphans(db, { ops, olderThanMs = 3600000, now = new Date() } = {}) {
  const blob = ops ?? (await blobOps());
  if (!blob) return { outcome: "not_configured" };
  const referenced = new Set(
    rows(await db.execute(sql`SELECT blob_path FROM saves WHERE blob_path IS NOT NULL`)).map((r) => r.blob_path),
  );
  const copying = new Set(
    rows(await db.execute(sql`SELECT id::text FROM saves WHERE copy_state='copying'`)).map((r) => r.id),
  );
  let cursor, removed = 0, pages = 0;
  do {
    const page = await blob.list(cursor, "saves/");
    pages++;
    for (const item of page.blobs ?? []) {
      const path = String(item.pathname);
      const owner = path.slice(6, 42);
      const old = item.uploadedAt ? now - new Date(item.uploadedAt) > olderThanMs : true;
      if (path.startsWith("saves/") && !referenced.has(path) && !copying.has(owner) && old) {
        await blob.del(path);
        removed++;
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && pages < 20);
  return { outcome: "cleaned", removed };
}

/**
 * Creator-deletion handling for saved copies, at the stricter of each source's deadline. Confirmed
 * removal deletes the object and releases its bytes; credit/title/source metadata remain.
 */
export async function recheckSavedCopies(db, { registry, ops, now = new Date(), deadline = Date.now() + 120000, limit = 60 } = {}) {
  const blob = ops ?? (await blobOps());
  const candidates = await db
    .select()
    .from(s.saves)
    .where(and(inArray(s.saves.copyState, ["ready", "link_only", "pending", "retryable"]), sql`${s.saves.removedAt} IS NULL`))
    .limit(500);
  const due = candidates.filter((save) => {
    const source = registry.find((e) => e.id === save.source);
    if (!source || source.deletionPolicy === "none" || !source.recheck) return false;
    const hours = source.deletionDeadlineHours ?? 24 * 7;
    // Recheck at half the deadline so a missed run still meets it.
    return !save.lastCheckedAt || now - save.lastCheckedAt > (hours / 2) * 3600000;
  }).slice(0, limit);
  const out = { checked: 0, removed: 0, transient: 0 };
  const connections = new Map();
  for (const save of due) {
    if (Date.now() + 10000 > deadline) break;
    const source = registry.find((e) => e.id === save.source);
    if (!connections.has(source.id))
      connections.set(
        source.id,
        sourceHttp({ ...source, maxRequests: Math.max(source.maxRequests ?? 0, limit) }, { deadline, stats: {} }),
      );
    const item = {
      id: save.itemId,
      source: save.source,
      nativeId: save.snapshot?.nativeId,
      url: save.url,
      credit: save.credit,
      media: save.snapshot?.media ?? [],
      facts: save.snapshot?.facts ?? {},
    };
    let verdict;
    try {
      verdict = await source.recheck(item, {
        http: connections.get(source.id),
        credentials: Object.fromEntries(
          [...(source.requiredCredentials ?? []), ...(source.optionalCredentials ?? [])].map((k) => [k, process.env[k]]).filter(([, v]) => v),
        ),
      });
    } catch {
      verdict = { state: "transient" };
    }
    out.checked++;
    if (verdict.state === "removed") {
      if (save.blobPath && blob) await blob.del(save.blobPath);
      await db.execute(sql`WITH removed AS (UPDATE saves SET copy_state='removed',removed_at=${now.toISOString()}::timestamptz,last_checked_at=${now.toISOString()}::timestamptz,
          blob_path=NULL,bytes=0,copy_error=${verdict.scope === "ineligible_labels" ? "source_labels" : "creator_removed"}
          WHERE id=${save.id}::uuid AND removed_at IS NULL RETURNING ${save.bytes}::bigint AS freed)
        UPDATE feed_storage SET copy_bytes=greatest(0,copy_bytes-(SELECT coalesce(sum(freed),0) FROM removed)),
          total_store_bytes=greatest(0,coalesce(total_store_bytes,0)-(SELECT coalesce(sum(freed),0) FROM removed)) WHERE key=${STORE_KEY}`);
      out.removed++;
    } else if (verdict.state === "present") {
      await db.update(s.saves).set({ lastCheckedAt: now }).where(eq(s.saves.id, save.id));
    } else out.transient++;
  }
  return out;
}

/** Removes a save she deletes: object first, then accounting and the row. */
export async function deleteSave(db, saveId, { ops } = {}) {
  const [save] = await db.select().from(s.saves).where(eq(s.saves.id, saveId));
  if (!save) throw new FeedError("save_not_found", 404);
  if (save.copyState === "copying") throw new FeedError("copy_in_progress", 409);
  if (save.blobPath) {
    const blob = ops ?? (await blobOps());
    if (!blob) throw new FeedError("storage_not_configured", 503);
    await blob.del(save.blobPath);
  }
  await db.execute(sql`WITH gone AS (DELETE FROM saves WHERE id=${saveId}::uuid AND copy_state<>'copying' RETURNING bytes)
    UPDATE feed_storage SET copy_bytes=greatest(0,copy_bytes-(SELECT coalesce(sum(bytes),0) FROM gone)),
      total_store_bytes=greatest(0,coalesce(total_store_bytes,0)-(SELECT coalesce(sum(bytes),0) FROM gone)) WHERE key=${STORE_KEY}`);
  return { deleted: true };
}
