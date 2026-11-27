// The signal pipeline: queued signal → triage (Haiku) → investigation (Opus) → one event record with
// its dossier, timeline and sources → update-log entries (the push outbox). Run by the worker.
import { createHash } from "node:crypto";
import { localDay } from "../time.js";
import { BudgetPaused } from "./claude.js";
import { DossierSchema, diffEvent, mergeSources, remapSourceIds } from "./dossier.js";
import { isBig, isHers, normaliseFandoms, fandomsIn } from "./fandoms.js";
import { investigate } from "./investigate.js";
import { LINK_MESSAGES } from "./links.js";
import { addLogEntries, enqueueSignal, getEventRow, getSignal, listEventRows, queuedSignals, saveEvent, sha, updateSignal } from "./store.js";
import { triageSignal } from "./triage.js";

export const COOLDOWN_HOURS = 20; // one investigation per event per ~day; later signals are batched
const PUSHED_KINDS = new Set(["new", "dates", "venue", "guests", "tickets", "merch", "cancelled"]);

const slug = (s) => String(s).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/\b(20\d\d|singapore|sg)\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A matching known event: same normalised name and overlapping (or unknown) dates. */
export function findSameEvent(rows, event) {
  const name = norm(event.name);
  if (!name) return null;
  return (
    rows.find((r) => {
      if (norm(r.name) !== name && !(name.length > 8 && (norm(r.name).includes(name) || name.includes(norm(r.name))))) return false;
      if (!event.startsOn || !r.startsOn) return true;
      const a = [event.startsOn, event.endsOn ?? event.startsOn];
      const b = [r.startsOn, r.endsOn ?? r.startsOn];
      return a[0] <= b[1] && b[0] <= a[1];
    }) ?? null
  );
}

export function newEventId(event, taken) {
  const base = `ev-${slug(event.name)}${event.startsOn && !/20\d\d/.test(event.name) ? `-${event.startsOn.slice(0, 4)}` : ""}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** official when an official/venue/ticketing source backs the dates, else listing/social, else unconfirmed. */
export function confidenceOf(dossier, sources, startsOn) {
  if (!startsOn) return "unconfirmed";
  const kinds = new Map(sources.map((s) => [s.id, s.kind]));
  const dateSources = [...(dossier.days ?? []).flatMap((d) => d.sourceIds), ...(dossier.datesNote?.sourceIds ?? [])].map((id) => kinds.get(id)).filter(Boolean);
  if (dateSources.some((k) => ["official", "venue", "ticketing", "owner"].includes(k))) return "official";
  if (dateSources.some((k) => ["listing", "news", "newsletter"].includes(k))) return "listing";
  if (dateSources.length) return "social";
  return "unconfirmed";
}

/**
 * The event row for a validated draft, merged into the existing row (if any). Returns
 * `{record, entries}`: entries are the update-log lines describing what changed.
 */
export function recordFromDraft(draft, { existing = null, id, origin, now = new Date(), triage = null }) {
  const before = existing ? { ...existing } : null;
  const stored = existing?.dossier ?? {};
  const { sources, map } = mergeSources(stored.sources ?? [], draft.sources, { now });
  const dossier = DossierSchema.parse(remapSourceIds(draft.dossier, map));
  const timeline = remapSourceIds(draft.timeline, map);
  const e = draft.event;
  const startsOn = e.startsOn ?? existing?.startsOn ?? null;
  const endsOn = e.endsOn ?? (e.startsOn ? e.startsOn : existing?.endsOn ?? null);
  const fandoms = normaliseFandoms([...e.fandoms, ...(triage?.fandoms ?? []), ...fandomsIn(e.name, e.tagline, dossier.about.summary.text)]);
  const kind = e.kind;
  // Keep earlier timeline milestones the new draft didn't repeat.
  const mergedTimeline = [...timeline, ...(stored.timeline ?? []).filter((old) => !timeline.some((t) => t.stage === old.stage))];
  const record = {
    id,
    name: e.name,
    kind,
    tagline: e.tagline,
    city: "Singapore",
    country: "Singapore",
    tier: "sg",
    venue: dossier.venue?.name ?? e.venueName ?? existing?.venue ?? null,
    startsOn,
    endsOn,
    url: e.officialUrl ?? dossier.links.find((l) => l.kind === "official")?.url ?? existing?.url ?? sources[0]?.url ?? "https://kiriya.love/world",
    sourceUrl: sources[0]?.url ?? existing?.sourceUrl ?? null,
    confidence: existing?.confidence === "owner_confirmed" ? "owner_confirmed" : confidenceOf(dossier, sources, startsOn),
    dateEvidence: existing?.dateEvidence ?? {},
    status: e.cancelled ? "cancelled" : existing?.status === "hidden" ? "hidden" : "upcoming",
    tags: e.tags,
    fandoms,
    hers: Boolean(existing?.hers) || isHers({ kind, fandoms }),
    big: Boolean(existing?.big) || isBig({ kind, fandoms }) || triage?.importance === "big",
    dossier: { ...dossier, datesTbc: e.datesTbc || !startsOn, sources, timeline: mergedTimeline },
    origin: existing?.origin ?? origin,
    lastVerifiedAt: now,
    investigatedAt: now,
  };
  const entries = diffEvent(before, record).map((entry) => ({ ...entry, push: record.big && PUSHED_KINDS.has(entry.kind) ? "instant" : "digest", big: record.big }));
  if (before && !entries.length) return { record, entries: [] };
  return { record, entries };
}

/** Pictures of an Instagram signal for Opus to read (posters often carry the dates). */
async function imageBlocks(signal, loadImage) {
  if (!loadImage) return [];
  const out = [];
  for (const path of (signal.payload?.blobPaths ?? []).slice(0, 2)) {
    try {
      const image = await loadImage(path);
      if (image) out.push({ type: "image", source: { type: "base64", media_type: image.contentType, data: image.data } });
    } catch {
      // A missing picture just means less to go on.
    }
  }
  return out;
}

const statusFor = (signal, status) => ({ status, message: LINK_MESSAGES[status] ?? null });

/**
 * Processes up to `limit` queued signals. `claude` is lib/events/claude.js claudeFor(db).
 * Returns a summary for the worker log.
 */
export async function processQueue(db, claude, { limit = 4, now = () => new Date(), loadImage = null, log = () => {} } = {}) {
  const summary = { triaged: 0, investigated: 0, added: 0, updated: 0, skipped: 0, paused: 0, failed: 0 };
  const signals = await queuedSignals(db, { limit, now: now() });
  for (const signal of signals) {
    const today = localDay(now());
    try {
      const rows = await listEventRows(db, { includeHidden: true });
      let triage = null;
      let target = signal.eventId ? rows.find((r) => r.id === signal.eventId) ?? null : null;
      // Pasted links skip triage: a bare link has nothing to judge; the investigation decides.
      if (signal.origin !== "refresh" && signal.origin !== "link") {
        await updateSignal(db, signal.id, statusFor(signal, "checking"));
        const known = rows.filter((r) => r.status !== "past" && (!r.endsOn || r.endsOn >= today) || (r.updatedAt && now() - new Date(r.updatedAt) < 30 * 86400_000));
        triage = await triageSignal(claude, signal, known, { today });
        summary.triaged++;
        await updateSignal(db, signal.id, { triage });
        if (triage.verdict === "not_event" || !triage.investigate) {
          const status = triage.verdict === "not_event" ? "skipped" : "duplicate";
          await updateSignal(db, signal.id, { ...statusFor(signal, status), eventId: triage.eventId ?? null });
          summary.skipped++;
          continue;
        }
        target = triage.eventId ? rows.find((r) => r.id === triage.eventId) ?? null : null;
      }
      // One investigation per event per cooldown: later news is batched into a refresh.
      if (target?.investigatedAt && now() - new Date(target.investigatedAt) < COOLDOWN_HOURS * 3600_000 && signal.origin !== "link" && signal.origin !== "refresh") {
        const due = new Date(new Date(target.investigatedAt).getTime() + COOLDOWN_HOURS * 3600_000);
        const { signal: refresh, created } = await enqueueSignal(db, { origin: "refresh", eventId: target.id, url: target.url, title: target.name, hash: sha("refresh", target.id, due.toISOString().slice(0, 13)), payload: { batched: [signal.id], notBefore: due.toISOString() } });
        if (!created) await updateSignal(db, refresh.id, { payload: { ...refresh.payload, batched: [...new Set([...(refresh.payload?.batched ?? []), signal.id])] } });
        await updateSignal(db, signal.id, { status: "updated", eventId: target.id, message: "batched into the event's next refresh" });
        summary.skipped++;
        continue;
      }
      await updateSignal(db, signal.id, statusFor(signal, "researching"));
      const batched = signal.payload?.batched?.length ? await Promise.all(signal.payload.batched.map((id) => getSignal(db, id))) : [];
      const leads = [signal, ...batched.filter(Boolean)];
      for (const lead of leads) lead.imageBlocks = await imageBlocks(lead, loadImage);
      const current = target ? { id: target.id, name: target.name, startsOn: target.startsOn, endsOn: target.endsOn, kind: target.kind, tagline: target.tagline, dossier: target.dossier } : null;
      const result = await investigate(claude, { signals: leads, current, today, refresh: Boolean(target), signalId: signal.id, eventId: target?.id ?? null });
      summary.investigated++;
      if (!result.draft) {
        await updateSignal(db, signal.id, { status: "failed", message: `couldn't finish the research (${result.outcome}); it will be retried`, attempts: (signal.attempts ?? 0) + 1 });
        summary.failed++;
        continue;
      }
      if (!result.draft.isEvent || !result.draft.event || !result.draft.dossier) {
        await updateSignal(db, signal.id, { ...statusFor(signal, signal.origin === "link" ? "not_an_event" : "skipped"), message: result.draft.reason ?? LINK_MESSAGES.not_an_event });
        summary.skipped++;
        continue;
      }
      // Dedupe: the triage match, else a name/date match against everything we have.
      const existing = target ?? findSameEvent(rows, result.draft.event);
      const id = existing?.id ?? newEventId(result.draft.event, new Set(rows.map((r) => r.id)));
      const { record, entries } = recordFromDraft(result.draft, { existing: existing ? await getEventRow(db, existing.id) : null, id, origin: signal.origin === "refresh" ? "crawler" : signal.origin, now: now(), triage });
      await saveEvent(db, record, { now: now() });
      if (entries.length) await addLogEntries(db, id, entries, { now: now() });
      await updateSignal(db, signal.id, { ...statusFor(signal, existing ? "updated" : "added"), eventId: id });
      for (const b of batched.filter(Boolean)) await updateSignal(db, b.id, { status: "updated", eventId: id });
      existing ? summary.updated++ : summary.added++;
      log("event", { id, name: record.name, entries: entries.map((e) => e.kind), usd: result.usd });
    } catch (error) {
      if (error instanceof BudgetPaused) {
        await updateSignal(db, signal.id, { ...statusFor(signal, "paused"), message: error.gate.reason === "pace" ? "waiting for tomorrow's share of the research budget" : LINK_MESSAGES.paused });
        summary.paused++;
        break;
      }
      await updateSignal(db, signal.id, { status: (signal.attempts ?? 0) >= 2 ? "failed" : "queued", message: `error: ${String(error.code ?? error.message).slice(0, 120)}`, attempts: (signal.attempts ?? 0) + 1 });
      summary.failed++;
      log("error", { signal: signal.id, error: String(error.message).slice(0, 200) });
    }
  }
  return summary;
}

/** Paused signals go back in the queue once the budget allows (the next day, or the next month). */
export async function requeuePaused(db, gate) {
  if (!gate.ok) return 0;
  const { schema } = await import("../../db/client.js");
  const { eq } = await import("drizzle-orm");
  const rows = await db.update(schema.eventSignals).set({ status: "queued", updatedAt: new Date() }).where(eq(schema.eventSignals.status, "paused")).returning({ id: schema.eventSignals.id });
  return rows.length;
}

export const hashOf = (...parts) => createHash("sha256").update(parts.join("\u0000")).digest("hex");
