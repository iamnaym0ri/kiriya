import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { FeedError } from "./config.js";
import { getTaste } from "./taste.js";

export const rows = (result) => result.rows ?? result;
export const jsonSql = (value) => sql`${JSON.stringify(value)}::jsonb`;
export function fence(run) {
  if (!run) return sql`true`;
  return sql`EXISTS (SELECT 1 FROM feed_runs r JOIN feed_builds b ON b.id=r.build_id
    WHERE r.build_id=${run.buildId}::uuid AND r.stage=${run.stage} AND r.lease_token=${run.token}::uuid
      AND r.status='running' AND r.lease_until > now()
      AND NOT EXISTS (SELECT 1 FROM feed_builds newer WHERE newer.day=b.day AND newer.generation>b.generation))`;
}
export async function assertLease(db, run) {
  if (!rows(await db.execute(sql`SELECT 1 WHERE ${fence(run)}`)).length)
    throw new FeedError("lease_lost", 409);
}

export async function createBuild(
  db,
  day,
  { mode = "live", force = false } = {},
) {
  const taste = await getTaste(db);
  // A transaction-local lock inside ONE SQL statement is supported by Neon HTTP. It protects
  // generation allocation only; long jobs use lease rows, never connection-held advisory locks.
  const result = await db.execute(sql`
    WITH day_lock AS (SELECT pg_advisory_xact_lock(hashtext(${`feed-build:${day}`}))),
    latest AS (SELECT * FROM feed_builds, day_lock WHERE day=${day} ORDER BY generation DESC LIMIT 1),
    created AS (INSERT INTO feed_builds (id,day,generation,mode,taste_revision,taste)
      SELECT ${randomUUID()}::uuid,${day}::date,coalesce((SELECT generation FROM latest),0)+1,${mode},${taste.revision},${jsonSql(taste.taste)}
      FROM day_lock WHERE ${force} OR NOT EXISTS(SELECT 1 FROM latest)
      ON CONFLICT(day,generation) DO NOTHING RETURNING *)
    SELECT id FROM created UNION ALL SELECT id FROM latest WHERE NOT EXISTS(SELECT 1 FROM created) LIMIT 1`);
  let id = rows(result)[0]?.id;
  if (!id) {
    const [current] = await db
      .select()
      .from(s.feedBuilds)
      .where(eq(s.feedBuilds.day, day))
      .orderBy(desc(s.feedBuilds.generation))
      .limit(1);
    id = current?.id;
  }
  const [build] = await db
    .select()
    .from(s.feedBuilds)
    .where(eq(s.feedBuilds.id, id));
  if (build?.mode !== mode) throw new FeedError("build_mode_mismatch", 409);
  return build;
}

export async function ingestItem(db, item, { run, fixture = false } = {}) {
  // All aliases get the same winner. Existing exclusion flags propagate when a repost connects
  // formerly separate identities. Anchor conflict arbitration also handles concurrent inserts.
  const keys = item.identityKeys;
  const changed = sql`(feed_items.source=excluded.source AND feed_items.native_id=excluded.native_id AND feed_items.safety->>'fingerprint' IS DISTINCT FROM excluded.safety->>'fingerprint')`;
  // Same post re-fetched with the same stable fingerprint: only volatile facts (scores, FX-derived
  // prices, check times) and expiry can differ, so they refresh without resetting safety.
  const sameNative = sql`(feed_items.source=excluded.source AND feed_items.native_id=excluded.native_id)`;
  const result = await db.execute(sql`
    WITH known AS MATERIALIZED (SELECT * FROM feed_identities WHERE key IN (SELECT jsonb_array_elements_text(${jsonSql(keys)}))),
    anchor AS (INSERT INTO feed_identities (key,canonical_id,seen_at,hidden_at,hidden_by)
      SELECT ${keys.at(-1)},coalesce((SELECT canonical_id FROM known ORDER BY canonical_id LIMIT 1),${item.id}),
        (SELECT min(seen_at) FROM known),(SELECT min(hidden_at) FROM known),(SELECT hidden_by FROM known WHERE hidden_by IS NOT NULL LIMIT 1)
      WHERE ${fence(run)}
      ON CONFLICT(key) DO UPDATE SET key=excluded.key RETURNING *),
    aliases AS (INSERT INTO feed_identities (key,canonical_id,seen_at,hidden_at,hidden_by)
      SELECT k.identity_key,a.canonical_id,a.seen_at,a.hidden_at,a.hidden_by FROM anchor a,
        jsonb_array_elements_text(${jsonSql(keys.filter((k) => k !== keys.at(-1)))}) AS k(identity_key)
      ON CONFLICT(key) DO UPDATE SET canonical_id=excluded.canonical_id,
        seen_at=coalesce(feed_identities.seen_at,excluded.seen_at),hidden_at=coalesce(feed_identities.hidden_at,excluded.hidden_at),
        hidden_by=coalesce(feed_identities.hidden_by,excluded.hidden_by) RETURNING canonical_id),
    merged AS (UPDATE feed_items SET visibility='gone',reason='identity_merged'
      WHERE id IN (SELECT canonical_id FROM known) AND id<>(SELECT canonical_id FROM anchor) RETURNING id)
    INSERT INTO feed_items (id,source,native_id,sections,kind,title,url,media,credit,tags,facts,identity_keys,safety,safety_status,visibility,fixture,published_at,expires_at)
      SELECT canonical_id,${item.source},${item.nativeId},${jsonSql(item.sections)},${item.kind},${item.title},${item.url},${jsonSql(item.media)},${jsonSql(item.credit)},${jsonSql(item.tags)},${jsonSql(item.facts)},${jsonSql(keys)},
        ${jsonSql({ source: item.safety, fingerprint: item.fingerprint })},'pending',CASE WHEN hidden_at IS NULL THEN 'active' ELSE 'hidden' END,${fixture},${item.publishedAt}::timestamptz,${item.expiresAt}::timestamptz FROM anchor
      ON CONFLICT(id) DO UPDATE SET sections=(SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(feed_items.sections||excluded.sections) v),
        identity_keys=(SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(feed_items.identity_keys||excluded.identity_keys) v),
        title=CASE WHEN ${changed} THEN excluded.title ELSE feed_items.title END,
        url=CASE WHEN ${changed} THEN excluded.url ELSE feed_items.url END,
        media=CASE WHEN ${changed} THEN excluded.media ELSE feed_items.media END,
        credit=CASE WHEN ${changed} THEN excluded.credit ELSE feed_items.credit END,
        tags=CASE WHEN ${changed} THEN excluded.tags ELSE feed_items.tags END,
        facts=CASE WHEN ${changed} OR ${sameNative} THEN excluded.facts ELSE feed_items.facts END,
        safety=CASE WHEN ${changed} THEN excluded.safety ELSE feed_items.safety END,
        safety_status=CASE WHEN ${changed} THEN 'pending' ELSE feed_items.safety_status END,
        blurb=CASE WHEN ${changed} THEN NULL ELSE feed_items.blurb END,
        published_at=CASE WHEN ${changed} THEN excluded.published_at ELSE feed_items.published_at END,
        expires_at=CASE WHEN ${changed} OR ${sameNative} THEN excluded.expires_at ELSE feed_items.expires_at END,
        fetched_at=CASE WHEN ${changed} THEN now() ELSE feed_items.fetched_at END
      RETURNING id`);
  if (!rows(result).length) throw new FeedError("lease_lost", 409);
  return rows(result)[0].id;
}

export async function blocklist(db) {
  const [row] = await db
    .select()
    .from(s.settings)
    .where(eq(s.settings.key, "feed_blocklist"));
  return {
    sources: Array.isArray(row?.value?.sources) ? row.value.sources : [],
    creators: Array.isArray(row?.value?.creators) ? row.value.creators : [],
  };
}
export const creatorKey = (item) =>
  `${item.source}:${item.credit.handle || item.credit.name}`.toLowerCase();
export async function eligibleItems(
  db,
  { fixture = false, includeSeen = false } = {},
) {
  const items = await db
    .select()
    .from(s.feedItems)
    .where(
      and(
        eq(s.feedItems.safetyStatus, "approved"),
        eq(s.feedItems.visibility, "active"),
        eq(s.feedItems.fixture, fixture),
      ),
    )
    .orderBy(desc(s.feedItems.fetchedAt))
    .limit(600);
  const exclusions = rows(
    await db.execute(
      sql`SELECT DISTINCT canonical_id FROM feed_identities WHERE hidden_at IS NOT NULL ${includeSeen ? sql`` : sql`OR seen_at IS NOT NULL`}`,
    ),
  );
  const excluded = new Set(exclusions.map((r) => r.canonical_id));
  const blocked = await blocklist(db);
  return items.filter(
    (i) =>
      !excluded.has(i.id) &&
      (!i.expiresAt || i.expiresAt > new Date()) &&
      !blocked.sources.includes(i.source) &&
      !blocked.creators.includes(creatorKey(i)),
  );
}
/**
 * What "not for me" has taught us. Owner decision (2026-09-16, second pass): hiding should filter
 * out more than the one post, so her hides now feed scoring. Only HER hides count (the owner's
 * moderation hides are not preferences), and a tag has to be hidden `minCount` times before it
 * counts, so a single hide never buries a whole fandom. Creators are penalised from the first hide
 * because "not this person again" is the usual intent.
 */
export async function dislikeSignals(db, { minCount = 2, days = 90 } = {}) {
  const hidden = await db
    .select({ tags: s.feedItems.tags, source: s.feedItems.source, credit: s.feedItems.credit })
    .from(s.feedItems)
    .where(and(eq(s.feedItems.visibility, "hidden"), eq(s.feedItems.hiddenBy, "kiriya")))
    .orderBy(desc(s.feedItems.fetchedAt))
    .limit(400);
  const tally = new Map();
  const creators = new Map();
  for (const item of hidden) {
    for (const key of ["characters", "fandoms", "topics", "formats"])
      for (const value of item.tags?.[key] ?? []) {
        const tag = `${key}:${String(value).toLowerCase()}`;
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      }
    const creator = creatorKey({ source: item.source, credit: item.credit });
    creators.set(creator, (creators.get(creator) ?? 0) + 1);
  }
  return {
    tags: Object.fromEntries([...tally].filter(([, n]) => n >= minCount)),
    creators: Object.fromEntries(creators),
  };
}
export async function hideItems(db, ids, who = "kiriya") {
  const result = await db.execute(sql`
    WITH hidden AS (UPDATE feed_items SET visibility='hidden',hidden_by=${who},reason='hidden'
      WHERE id IN (SELECT jsonb_array_elements_text(${jsonSql(ids)})) RETURNING id)
    UPDATE feed_identities SET hidden_at=coalesce(hidden_at,now()),hidden_by=${who}
      WHERE canonical_id IN (SELECT id FROM hidden) RETURNING canonical_id`);
  return [...new Set(rows(result).map((r) => r.canonical_id))];
}
export async function blockItemOrigin(db, itemId, type) {
  const [item] = await db
    .select()
    .from(s.feedItems)
    .where(eq(s.feedItems.id, itemId));
  if (!item) throw new FeedError("item_not_found", 404);
  const key = type === "source" ? "sources" : "creators",
    value = type === "source" ? item.source : creatorKey(item);
  await db.execute(sql`
    INSERT INTO settings (key,value) VALUES ('feed_blocklist',${jsonSql({ [key]: [value] })})
    ON CONFLICT(key) DO UPDATE SET value=jsonb_set(settings.value,ARRAY[${key}],
      (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(coalesce(settings.value->${key},'[]'::jsonb)||${jsonSql([value])}) v)),updated_at=now()`);
  const items = await db
    .select()
    .from(s.feedItems)
    .where(eq(s.feedItems.source, item.source));
  await hideItems(
    db,
    items
      .filter((i) => type === "source" || creatorKey(i) === value)
      .map((i) => i.id),
    "owner",
  );
}
export async function setSafety(db, item, result, run) {
  await db.execute(sql`UPDATE feed_items SET safety=${jsonSql({ ...item.safety, ...result.evidence })},safety_status=${result.status},reason=${result.reason}
    WHERE id=${item.id} AND visibility='active' AND safety->>'fingerprint'=${item.safety.fingerprint} AND ${fence(run)}`);
}
export async function recordHealth(
  db,
  entry,
  { status, count = 0, durationMs = 0, requests = 0, error = null },
) {
  await db.execute(sql`INSERT INTO feed_source_health (source,status,last_ok_at,last_error_at,last_error,last_count,fail_streak,duration_ms,requests)
    VALUES (${entry.id},${status},CASE WHEN ${status}='ok' THEN now() END,CASE WHEN ${status}<>'ok' THEN now() END,${error},${count},CASE WHEN ${status}='ok' THEN 0 ELSE 1 END,${durationMs},${requests})
    ON CONFLICT(source) DO UPDATE SET status=excluded.status,last_ok_at=coalesce(excluded.last_ok_at,feed_source_health.last_ok_at),last_error_at=coalesce(excluded.last_error_at,feed_source_health.last_error_at),
      last_error=excluded.last_error,last_count=excluded.last_count,fail_streak=CASE WHEN excluded.status='ok' THEN 0 ELSE feed_source_health.fail_streak+1 END,duration_ms=excluded.duration_ms,requests=excluded.requests`);
}
export async function pruneFeeds(db, now = new Date()) {
  // Identities and saves intentionally survive every payload/edition retention branch.
  const cutoff = (days) =>
    new Date(now.getTime() - days * 86400000).toISOString();
  // Expired payloads go as soon as they expire (source storage ceilings such as Tumblr's 72 h, YouTube
  // API data after 30 days); seen/hidden identity flags survive in feed_identities.
  const deleted = await db.execute(sql`DELETE FROM feed_items WHERE
    (expires_at IS NOT NULL AND expires_at<${now.toISOString()}::timestamptz) OR
    (safety_status='rejected' AND fetched_at<${cutoff(30)}::timestamptz) OR
    (id IN (SELECT item_id FROM feed_seen WHERE first_seen_at<${cutoff(90)}::timestamptz)) OR
    (safety_status<>'rejected' AND fetched_at<${cutoff(14)}::timestamptz AND id NOT IN (SELECT item_id FROM feed_seen)) RETURNING id`);
  await db.execute(
    sql`DELETE FROM feed_editions WHERE day<${cutoff(90).slice(0, 10)}::date`,
  );
  await db.execute(
    sql`UPDATE feed_usage SET result=NULL WHERE settled_at<${cutoff(90)}::timestamptz AND result IS NOT NULL`,
  );
  return { payloadsRemoved: rows(deleted).length };
}
