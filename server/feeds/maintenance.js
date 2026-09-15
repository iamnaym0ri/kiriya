// Daily maintenance stage: storage meter, copy reconciliation, orphan cleanup, pending copies,
// source-deadline rechecks for saved copies, and payload retention. Each step checkpoints.
import { and, eq, inArray, sql } from "drizzle-orm";
import * as s from "../db/schema.js";
import { checkpointRun, registerStage } from "./jobs.js";
import { assertLease, pruneFeeds } from "./repository.js";
import {
  cleanupOrphans,
  copySave,
  measureStorage,
  recheckSavedCopies,
  reconcileCopies,
} from "./storage.js";

export const MAINTENANCE_STEPS = ["meter", "reconcile", "orphans", "copies", "rechecks", "retention"];

export async function runMaintenance(ctx, { ops } = {}) {
  const results = { ...(ctx.run.checkpoint.results ?? {}) };
  let step = ctx.run.checkpoint.step ?? 0;
  while (step < MAINTENANCE_STEPS.length) {
    if (Date.now() + 30000 > ctx.deadline) return false;
    await assertLease(ctx.db, ctx.run);
    const name = MAINTENANCE_STEPS[step];
    try {
      if (name === "meter") results.meter = await measureStorage(ctx.db, { ops });
      else if (name === "reconcile") results.reconcile = await reconcileCopies(ctx.db, { ops });
      else if (name === "orphans") results.orphans = await cleanupOrphans(ctx.db, { ops });
      else if (name === "copies") {
        const waiting = await ctx.db
          .select({ id: s.saves.id })
          .from(s.saves)
          .where(inArray(s.saves.copyState, ["pending", "retryable"]))
          .limit(10);
        results.copies = [];
        for (const { id } of waiting) {
          if (Date.now() + 40000 > ctx.deadline) break;
          results.copies.push(await copySave(ctx.db, id, { registry: ctx.registry, ops, deadline: ctx.deadline }));
        }
      } else if (name === "rechecks")
        results.rechecks = await recheckSavedCopies(ctx.db, { registry: ctx.registry, ops, deadline: ctx.deadline });
      else if (name === "retention") results.retention = await pruneFeeds(ctx.db);
    } catch (error) {
      if (["deadline", "lease_lost"].includes(error.code)) throw error;
      results[name] = { outcome: "failed", reason: error.code ?? error.name ?? "error" };
    }
    step++;
    await checkpointRun(ctx.db, ctx.run, { step, results });
  }
  return true;
}

registerStage("maintenance", (ctx) => runMaintenance(ctx));
