import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { saves } from "../db/schema.js";
import { FeedError } from "./config.js";
import { rows } from "./repository.js";

export const SAVE_LIMITS = {
  itemBytes: 8 * 1024 * 1024,
  warnBytes: 400 * 1024 * 1024,
  copyBytes: 500 * 1024 * 1024,
  totalStoreBytes: 1_000_000_000,
  headroomBytes: 50 * 1024 * 1024,
};
export function saveSnapshot(item, source) {
  if (
    item.safetyStatus !== "approved" ||
    item.visibility !== "active" ||
    (item.expiresAt && item.expiresAt <= new Date())
  )
    throw new FeedError("item_not_saveable", 409);
  const permission = source.copyPermission;
  const copyPermitted =
    source.copyPolicy === "private_copy" &&
    permission?.basis &&
    permission?.sourceUrl &&
    permission?.verifiedAt;
  const copy =
    copyPermitted &&
    item.media.length === 1 &&
    item.media[0].type !== "youtube" &&
    item.media[0].type !== "hls";
  // Sources with a storage ceiling (e.g. Tumblr's 72 h) keep only attribution and the link past it;
  // the site's own blurb and canonical tags are not source content.
  if (source.retentionHours)
    return {
      canonicalId: item.id,
      itemId: item.id,
      identityKeys: item.identityKeys,
      source: item.source,
      kind: item.kind,
      sections: item.sections,
      title: `a post by ${item.credit.handle || item.credit.name}`.slice(0, 200),
      url: item.url,
      credit: item.credit,
      snapshot: {
        nativeId: item.nativeId,
        blurb: item.blurb,
        facts: {},
        media: [],
        tags: item.tags,
        sourcePolicy: { copyPolicy: "link_only", deletionPolicy: source.deletionPolicy, retentionHours: source.retentionHours },
      },
      copyPolicy: "link_only",
      copyState: "link_only",
    };
  return {
    canonicalId: item.id,
    itemId: item.id,
    identityKeys: item.identityKeys,
    source: item.source,
    kind: item.kind,
    sections: item.sections,
    title: item.title,
    url: item.url,
    credit: item.credit,
    snapshot: {
      nativeId: item.nativeId,
      blurb: item.blurb,
      facts: item.facts,
      media: item.media,
      tags: item.tags,
      sourcePolicy: {
        copyPolicy: source.copyPolicy,
        deletionPolicy: source.deletionPolicy,
        permission: permission ?? null,
      },
    },
    copyPolicy: copy ? "kept" : "link_only",
    copyState: copy ? "pending" : "link_only",
  };
}
/**
 * What she explicitly kept, summarized for the writer ("that's the 4th teto song u've saved").
 * Counts only; no browsing/seen history and no private notes.
 */
export async function savesSummary(db, { days = 30, now = new Date() } = {}) {
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const list = rows(
    await db.execute(
      sql`SELECT title,kind,snapshot->'tags' AS tags FROM saves WHERE created_at>=${since}::timestamptz AND removed_at IS NULL ORDER BY created_at DESC LIMIT 200`,
    ),
  );
  const count = (field) => {
    const tally = {};
    for (const row of list)
      for (const value of row.tags?.[field] ?? []) tally[value] = (tally[value] ?? 0) + 1;
    return Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, n]) => ({ name, saved: n }));
  };
  return {
    windowDays: days,
    total: list.length,
    characters: count("characters"),
    fandoms: count("fandoms"),
    producers: count("producers"),
    recentTitles: list.slice(0, 3).map((r) => r.title.slice(0, 80)),
  };
}

export async function ensureSave(db, item, source) {
  const snapshot = saveSnapshot(item, source);
  await db
    .insert(saves)
    .values(snapshot)
    .onConflictDoNothing({ target: saves.canonicalId });
  const [saved] = await db
    .select()
    .from(saves)
    .where(eq(saves.canonicalId, item.id));
  return saved;
}
export async function reserveCopy(
  db,
  saveId,
  bytes,
  { now = new Date() } = {},
) {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    bytes > SAVE_LIMITS.itemBytes
  )
    throw new FeedError("copy_size_limit");
  const token = randomUUID();
  const result = await db.execute(sql`
    WITH candidate AS MATERIALIZED(SELECT id FROM saves WHERE id=${saveId}::uuid AND copy_policy='kept'
      AND copy_state IN('pending','retryable') AND reserved_bytes=0 FOR UPDATE),
    budget AS(UPDATE feed_storage SET reserved_bytes=reserved_bytes+${bytes}
      WHERE key='private-blob' AND EXISTS(SELECT 1 FROM candidate)
      AND copy_bytes+reserved_bytes+${bytes}<=${SAVE_LIMITS.copyBytes}
      AND total_store_bytes+reserved_bytes+${bytes}+${SAVE_LIMITS.headroomBytes}<=${SAVE_LIMITS.totalStoreBytes}
      AND measured_at>${new Date(now.getTime() - 86400000).toISOString()}::timestamptz RETURNING key)
    UPDATE saves SET copy_state='copying',copy_token=${token}::uuid,copy_lease_until=${new Date(now.getTime() + 300000).toISOString()}::timestamptz,
      reserved_bytes=${bytes},copy_attempts=copy_attempts+1
      WHERE id IN(SELECT id FROM candidate) AND EXISTS(SELECT 1 FROM budget) RETURNING id`);
  return rows(result).length
    ? { outcome: "reserved", token, bytes }
    : { outcome: "link_only", reason: "copy_busy_or_storage_limit" };
}
export async function finishCopy(
  db,
  saveId,
  token,
  { pathname, bytes, contentType, cleanedUp = false } = {},
) {
  if (pathname && !/^saves\/[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(pathname))
    throw new FeedError("invalid_copy_path");
  if (
    pathname &&
    (!Number.isSafeInteger(bytes) ||
      bytes <= 0 ||
      bytes > SAVE_LIMITS.itemBytes ||
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "video/mp4",
      ].includes(contentType))
  )
    throw new FeedError("invalid_copy_result");
  if (!pathname && !cleanedUp)
    throw new FeedError("copy_cleanup_required", 409);
  const result =
    await db.execute(sql`WITH finished AS(UPDATE saves SET copy_state=${pathname ? "ready" : "retryable"},blob_path=${pathname ?? null},bytes=${pathname ? bytes : 0},content_type=${contentType ?? null},
      copy_token=NULL,copy_lease_until=NULL,reserved_bytes=0
      WHERE id=${saveId}::uuid AND copy_token=${token}::uuid AND copy_state='copying' AND (${pathname ? bytes : 0}<=reserved_bytes)
      RETURNING id), old AS (SELECT reserved_bytes FROM saves WHERE id=${saveId}::uuid)
    UPDATE feed_storage SET reserved_bytes=reserved_bytes-(SELECT reserved_bytes FROM old),copy_bytes=copy_bytes+${pathname ? bytes : 0},total_store_bytes=total_store_bytes+${pathname ? bytes : 0}
      WHERE key='private-blob' AND EXISTS(SELECT 1 FROM finished) RETURNING key`);
  return { finished: rows(result).length > 0 };
}
