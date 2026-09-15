import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { addDays, localDay, zonedInstant } from "../lib/time.js";
import { FeedError, SECTIONS, SIGNATURE } from "./config.js";
import { eligibleItems, fence, jsonSql, rows } from "./repository.js";
import { SlotSchema, slotIds } from "./normalize.js";
import { LIVE_ADAPTERS } from "./sources/index.js";

// Sources whose terms require honouring deletions within a deadline: an item is shown only while its
// last successful recheck (or fetch) is inside that deadline, even if a later publish failed.
export function deletionFresh(now = Date.now(), adapters = LIVE_ADAPTERS) {
  const hours = new Map(
    adapters.filter((a) => a.deletionPolicy === "honor_deletions" && a.deletionDeadlineHours).map((a) => [
      a.id,
      a.deletionDeadlineHours,
    ]),
  );
  return (item) => {
    const limit = hours.get(item.source);
    if (!limit) return true;
    const last = item.safety?.recheckedAt ? new Date(item.safety.recheckedAt) : new Date(item.fetchedAt);
    return now - last.getTime() <= limit * 3600000;
  };
}

export async function recentProducers(db, day) {
  const result =
    await db.execute(sql`SELECT DISTINCT jsonb_array_elements_text(i.tags->'producers') AS producer
    FROM feed_items i WHERE i.id IN (SELECT jsonb_array_elements_text(jsonb_build_array(slot->>'primaryId')||coalesce(slot->'companionIds','[]'::jsonb)) FROM feed_editions e,
      jsonb_array_elements(e.slots||e.reserve) slot WHERE e.state='published' AND e.day>=${addDays(day, -6)}::date AND e.day<=${day}::date)`);
  return rows(result).map((r) => r.producer);
}
export async function stageEdition(db, build, section, plan, blurbs, run) {
  const map = Object.fromEntries(
    blurbs.filter((b) => !b.skip).map((b) => [b.id, b]),
  );
  const clean = (list) =>
    list
      .map((slot) => SlotSchema.parse(slot))
      .filter((slot) => slotIds(slot).every((id) => map[id]));
  const slots = clean(plan.slots),
    reserve = clean(plan.reserve);
  const meta = {
    fixture: build.mode === "fixture",
    blurbs: map,
    fingerprints: Object.fromEntries(
      plan.selected.map((p) => [p.item.id, p.item.safety.fingerprint]),
    ),
    scores: Object.fromEntries(
      plan.selected.map((p) => [p.item.id, { score: p.score, parts: p.parts }]),
    ),
    // Planner context (episode day, rotation, her own photo reference, allocation version). Her
    // photo is a private upload reference, never an external feed item ID.
    plan: plan.meta ?? null,
  };
  await db.execute(sql`INSERT INTO feed_editions(build_id,section,day,revision,taste_revision,state,slots,reserve,meta)
    SELECT ${build.id}::uuid,${section},${build.day}::date,${`${build.id}:${section}`},${build.tasteRevision},'staged',${jsonSql(slots)},${jsonSql(reserve)},${jsonSql(meta)} WHERE ${fence(run)}
    ON CONFLICT(build_id,section) DO UPDATE SET slots=excluded.slots,reserve=excluded.reserve,meta=excluded.meta
    WHERE feed_editions.state='staged' AND ${fence(run)}`);
  // A cache for opener history/reuse; published presentation is frozen in edition.meta.blurbs.
  for (const blurb of blurbs)
    await db.execute(
      sql`UPDATE feed_items SET blurb=${jsonSql(blurb)} WHERE id=${blurb.id} AND ${fence(run)}`,
    );
}
export async function publishEditions(db, build, run, { withheld = new Set() } = {}) {
  const live = await eligibleItems(db, { fixture: build.mode === "fixture" });
  const available = new Map(
    live.filter((i) => !withheld.has(i.id)).map((i) => [i.id, i.safety.fingerprint]),
  );
  const editions = await db
    .select()
    .from(s.feedEditions)
    .where(
      and(
        eq(s.feedEditions.buildId, build.id),
        eq(s.feedEditions.state, "staged"),
      ),
    );
  for (const e of editions) {
    const clean = (list) =>
      list.filter((slot) =>
        slotIds(slot).every(
          (id) =>
            available.has(id) &&
            available.get(id) === e.meta.fingerprints?.[id],
        ),
      );
    await db.execute(
      sql`UPDATE feed_editions SET slots=${jsonSql(clean(e.slots))},reserve=${jsonSql(clean(e.reserve))} WHERE build_id=${build.id}::uuid AND section=${e.section} AND state='staged' AND ${fence(run)}`,
    );
  }
  // The publication pointer/state changes together in one Neon HTTP statement.
  const result = await db.execute(sql`WITH published AS (
    UPDATE feed_editions SET state='published',published_at=now()
    WHERE build_id=${build.id}::uuid AND state='staged' AND jsonb_array_length(slots)>0 AND ${fence(run)} RETURNING section),
    finished AS (UPDATE feed_builds SET state='published' WHERE id=${build.id}::uuid AND ${fence(run)} RETURNING id)
    SELECT section FROM published`);
  return { sections: rows(result).map((r) => r.section) };
}

function presentItem(item, edition) {
  return {
    id: item.id,
    kind: item.kind,
    source: item.source,
    sections: item.sections,
    title: item.title,
    url: item.url,
    media: item.media,
    credit: item.credit,
    facts: item.facts,
    tags: {
      characters: item.tags?.characters ?? [],
      fandoms: item.tags?.fandoms ?? [],
      formats: item.tags?.formats ?? [],
      voicebanks: item.tags?.voicebanks ?? [],
    },
    publishedAt: item.publishedAt,
    blurb: edition.meta.blurbs[item.id],
    signature: SIGNATURE,
    fixture: item.fixture,
  };
}
export async function readFeed(
  db,
  section,
  { day = localDay(), fixture = false, previewBuildId } = {},
) {
  if (!SECTIONS.includes(section)) throw new FeedError("unknown_section", 404);
  const base = and(
    eq(s.feedEditions.section, section),
    previewBuildId
      ? eq(s.feedEditions.buildId, previewBuildId)
      : eq(s.feedEditions.state, "published"),
  );
  const editions = await db
    .select()
    .from(s.feedEditions)
    .where(base)
    .orderBy(desc(s.feedEditions.day), desc(s.feedEditions.publishedAt))
    .limit(20);
  const edition = editions.find(
    (e) => e.meta.fixture === fixture && e.day <= day,
  );
  const empty = {
    section,
    day,
    revision: null,
    publishedAt: null,
    slots: [],
    reserve: [],
    seenEarlier: [],
    counts: { new: 0, seenEarlier: 0 },
    nextRefreshAt: zonedInstant(addDays(day, 1), 0).toISOString(),
    revalidateAfterSeconds: 60,
  };
  if (!edition) return empty;
  const items = await eligibleItems(db, { fixture, includeSeen: true });
  const byId = new Map(items.map((i) => [i.id, i]));
  const seenRows = await db.select().from(s.feedSeen);
  const seen = new Map(seenRows.map((r) => [r.itemId, r.firstSeenAt]));
  const seenIds = new Set(
    rows(
      await db.execute(
        sql`SELECT DISTINCT canonical_id FROM feed_identities WHERE seen_at IS NOT NULL`,
      ),
    ).map((r) => r.canonical_id),
  );
  const fresh_ = deletionFresh();
  const materialize = (slot) => {
    const ids = slotIds(slot);
    if (
      ids.some(
        (id) =>
          !byId.has(id) ||
          !fresh_(byId.get(id)) ||
          byId.get(id).safety.fingerprint !== edition.meta.fingerprints?.[id] ||
          !edition.meta.blurbs[id] ||
          edition.meta.blurbs[id].skip,
      )
    )
      return null;
    return {
      ...slot,
      primary: presentItem(byId.get(slot.primaryId), edition),
      companions: slot.companionIds.map((id) =>
        presentItem(byId.get(id), edition),
      ),
    };
  };
  const fresh = (slot) => slotIds(slot).every((id) => !seenIds.has(id));
  const earlier = (slot) =>
    slotIds(slot).some((id) => seenIds.has(id)) &&
    slotIds(slot).every(
      (id) =>
        !seenIds.has(id) || (seen.has(id) && localDay(seen.get(id)) === day),
    );
  const slots = edition.slots.map(materialize).filter(Boolean),
    reserve = edition.reserve.map(materialize).filter(Boolean);
  // The merch shelf is a catalogue (planned with seen items included): looking doesn't remove.
  const catalogue = section === "merch";
  const tail = catalogue ? [] : [...slots, ...reserve].filter(earlier);
  return {
    ...empty,
    editionDay: edition.day,
    revision: edition.revision,
    publishedAt: edition.publishedAt,
    tasteRevision: edition.tasteRevision,
    plan: edition.meta.plan ?? null,
    slots: catalogue ? slots : slots.filter(fresh),
    reserve: catalogue ? reserve : reserve.filter(fresh),
    seenEarlier: tail,
    counts: {
      new: [...slots, ...reserve].filter(fresh).length,
      seenEarlier: tail.length,
    },
    // Midnight changes the day; morning publication changes the revision. The client revalidates
    // on focus/visit and at this short interval while open, not only at midnight.
    closing:
      catalogue || [...slots, ...reserve].some(fresh)
        ? null
        : "that's literally everything. go touch grass. or don't, i'm a website.",
    fixture: edition.meta.fixture,
  };
}

export async function markSeen(db, { revision, ids }, who) {
  if (who === "admin") return { marked: [], preview: true };
  const [edition] = await db
    .select()
    .from(s.feedEditions)
    .where(
      and(
        eq(s.feedEditions.revision, revision),
        eq(s.feedEditions.state, "published"),
      ),
    );
  if (!edition) throw new FeedError("edition_not_found", 404);
  const allowed = new Set(
    [...edition.slots, ...edition.reserve].flatMap(slotIds),
  );
  if (ids.some((id) => !allowed.has(id)))
    throw new FeedError("item_not_in_edition");
  const eligible = new Set(
    (
      await eligibleItems(db, {
        fixture: edition.meta.fixture,
        includeSeen: true,
      })
    ).map((i) => i.id),
  );
  const selected = [...new Set(ids)].filter((id) => eligible.has(id));
  const result =
    await db.execute(sql`WITH marked AS (INSERT INTO feed_seen(item_id)
    SELECT jsonb_array_elements_text(${jsonSql(selected)}) ON CONFLICT(item_id) DO NOTHING RETURNING item_id)
    UPDATE feed_identities SET seen_at=coalesce(seen_at,now()) WHERE canonical_id IN (SELECT jsonb_array_elements_text(${jsonSql(selected)})) RETURNING canonical_id`);
  return { marked: [...new Set(rows(result).map((r) => r.canonical_id))] };
}
