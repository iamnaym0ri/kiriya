// Owner tools that need the paid provider path (targeted blurb rewrite, lexicon preview) run under a
// leased "admin-tools" stage row for today's build, so the same ledger, request caps and fencing apply.
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { localDay } from "../lib/time.js";
import { FeedError, feedConfig } from "./config.js";
import { claimStage, finishStage, registerStage } from "./jobs.js";
import { createBuild, jsonSql, rows } from "./repository.js";
import { createProvider } from "./provider.js";
import { sourceRegistry } from "./sources/registry.js";
import { derivedFacts, templateBlurb, writeBlurbs } from "./writer.js";
import { getFeedSettings } from "./settings.js";

registerStage("admin-tools", async () => {
  throw new FeedError("admin_tools_not_a_pipeline_stage", 409);
});

export async function withAdminRun(db, fn, { config = feedConfig() } = {}) {
  const build = await createBuild(db, localDay(), { mode: "live" });
  const run = await claimStage(db, build, "admin-tools");
  if (run.outcome !== "claimed") throw new FeedError(`admin_tools_${run.outcome}`, 409);
  const deadline = Date.now() + 120000;
  try {
    const registry = await sourceRegistry({ fixtures: false });
    const provider = createProvider({ db, run, config, deadline, signal: AbortSignal.timeout(120000), registry });
    return await fn({ build, run, provider, registry, deadline });
  } finally {
    // Pending (not done) keeps the row reusable for the next owner action today.
    await finishStage(db, run, { status: "pending" });
  }
}

/**
 * Rewrites one item's blurb inside a specific edition using the grounded writer. A staged edition is
 * updated in place; a published edition changes only with explicit `published:true`, recording the
 * previous text in meta.rewrites. Saved snapshots are never modified.
 */
export async function rewriteBlurb(db, { buildId, section, id, published = false }) {
  const [edition] = await db
    .select()
    .from(s.feedEditions)
    .where(and(eq(s.feedEditions.buildId, buildId), eq(s.feedEditions.section, section)));
  if (!edition) throw new FeedError("edition_not_found", 404);
  if (edition.state === "published" && !published) throw new FeedError("published_edition_requires_confirmation", 409);
  const ids = [...edition.slots, ...edition.reserve].flatMap((slot) => [slot.primaryId, ...slot.companionIds]);
  if (!ids.includes(id)) throw new FeedError("item_not_in_edition", 404);
  const [item] = await db.select().from(s.feedItems).where(eq(s.feedItems.id, id));
  if (!item || item.safetyStatus !== "approved") throw new FeedError("item_not_rewritable", 409);
  return withAdminRun(db, async ({ provider }) => {
    const [build] = await db.select().from(s.feedBuilds).where(eq(s.feedBuilds.id, buildId));
    const settings = await getFeedSettings(db);
    const [blurb] = await writeBlurbs([item], provider, {
      taste: build.taste,
      lexicon: settings.lexicon,
      day: edition.day,
      section,
      recentOpeners: Object.values(edition.meta.blurbs ?? {}).map((b) => b.text?.split(/\s+/).slice(0, 4).join(" ").toLowerCase()),
      hints: {},
    });
    if (!blurb || blurb.skip) throw new FeedError("rewrite_skipped", 409);
    const previous = edition.meta.blurbs?.[id] ?? null;
    const audit = { at: new Date().toISOString(), previous: previous ? { headline: previous.headline, text: previous.text, model: previous.model } : null, model: blurb.model };
    await db.execute(sql`UPDATE feed_editions SET meta=jsonb_set(jsonb_set(meta,ARRAY['blurbs',${id}],${jsonSql(blurb)}),'{rewrites}',
        coalesce(meta->'rewrites','{}'::jsonb)||jsonb_build_object(${id},${jsonSql(audit)}))
      WHERE build_id=${buildId}::uuid AND section=${section}`);
    return { blurb, audit, appliesTo: edition.state === "published" ? "published_revision" : "staged_revision" };
  });
}

/** Ten sample blurbs with a proposed lexicon, written against current approved items; nothing is saved. */
export async function previewLexicon(db, lexicon, { section = "maomao" } = {}) {
  const items = await db
    .select()
    .from(s.feedItems)
    .where(
      and(
        eq(s.feedItems.safetyStatus, "approved"),
        eq(s.feedItems.visibility, "active"),
        eq(s.feedItems.fixture, false),
        sql`${s.feedItems.sections} ? ${section}`,
      ),
    )
    .orderBy(desc(s.feedItems.fetchedAt))
    .limit(10);
  if (!items.length) return { samples: [], note: "no approved items to preview yet" };
  return withAdminRun(db, async ({ provider, build }) => {
    const stats = {};
    const blurbs = await writeBlurbs(items, provider, {
      taste: build.taste,
      lexicon,
      day: localDay(),
      section,
      recentOpeners: [],
      hints: {},
      stats,
      history: [],
    });
    return {
      samples: blurbs.map((b) => ({ id: b.id, headline: b.headline, text: b.text, model: b.model, skip: b.skip })),
      stats,
      preview: randomUUID(),
    };
  });
}

export { derivedFacts, templateBlurb };
