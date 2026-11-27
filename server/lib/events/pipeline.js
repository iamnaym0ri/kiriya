// The signal pipeline: queued signal → triage (Haiku) → investigation (Opus) → one event record with
// its dossier, timeline and sources → update-log entries (the push outbox). Run by the worker.
import { createHash } from "node:crypto";
import { localDay } from "../time.js";
import { BudgetPaused } from "./claude.js";
import { DossierSchema, diffEvent, mergeSources, remapSourceIds } from "./dossier.js";
import { isBig, isHers, normaliseFandoms, fandomsIn } from "./fandoms.js";
import { investigate } from "./investigate.js";
import { LINK_MESSAGES } from "./links.js";
import { carryMerchImages, isOurImage } from "./images.js";
import { addLogEntries, enqueueSignal, getEventRow, getSignal, listEventRows, mergeEvent, queuedSignals, saveEvent, sha, updateSignal } from "./store.js";
import { triageSignal } from "./triage.js";

export const COOLDOWN_HOURS = 20; // one investigation per event per ~day; later signals are batched
const PUSHED_KINDS = new Set(["new", "dates", "venue", "guests", "tickets", "merch", "cancelled"]);

const slug = (s) => String(s).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/\b(20\d\d|singapore|sg)\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 1));
/** Share of the shorter name's words found in the other (0..1). */
export function nameSimilarity(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  return [...small].filter((w) => big.has(w)).length / small.size;
}
const officialKey = (url) => {
  try {
    const u = new URL(url);
    if (/kiriya\.love$|instagram\.com$|facebook\.com$|google\.[a-z.]+$/i.test(u.hostname)) return null;
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
};
const hostKey = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
const datesOverlap = (a, b) => {
  if (!a.startsOn || !b.startsOn) return null; // unknown
  return a.startsOn <= (b.endsOn ?? b.startsOn) && b.startsOn <= (a.endsOn ?? a.startsOn);
};

/**
 * Whether two records describe the same event. Deliberately strict, because a wrong match lets one
 * event overwrite another (and the first one vanishes from her list):
 *   - the same name, and the dates overlap or one side has none yet;
 *   - a similar name (most words shared) or the same official page, and the dates overlap;
 *   - a similar name with no dates on one side only when both cite the same official site.
 */
export function sameEvent(a, b) {
  const overlap = datesOverlap(a, b);
  if (overlap === false) return false;
  const na = norm(a.name);
  const nb = norm(b.name);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const similar = nameSimilarity(a.name, b.name) >= 0.75 && Math.min(tokens(a.name).size, tokens(b.name).size) >= 2;
  const ua = officialKey(a.url ?? a.officialUrl);
  const ub = officialKey(b.url ?? b.officialUrl);
  if (overlap === true) return similar || (ua && ua === ub) || false;
  const ha = hostKey(a.url ?? a.officialUrl);
  return similar && Boolean(ha) && ha === hostKey(b.url ?? b.officialUrl) && Boolean(ua);
}

/** A matching known event (see sameEvent); merged and ruled-out rows never match. */
export function findSameEvent(rows, event) {
  return rows.find((r) => !["merged", "out_of_scope"].includes(r.status) && sameEvent(r, event)) ?? null;
}

/**
 * Whether a draft may update `target` (the event triage or a refresh pointed at). It may unless it
 * clearly describes another event: dates that don't overlap and a name that isn't the same one.
 */
export function draftFitsTarget(target, draftEvent) {
  if (!target) return false;
  const overlap = datesOverlap(target, draftEvent);
  if (overlap !== false) return true;
  // Postponed? Same name or same official page still counts; anything else is a different event.
  return norm(target.name) === norm(draftEvent.name) || nameSimilarity(target.name, draftEvent.name) >= 0.75 || (officialKey(target.url) && officialKey(target.url) === officialKey(draftEvent.officialUrl));
}

/**
 * A new event's id: minted once, never changed (renames keep it). Words are cut whole, so an id never
 * ends mid-word, and the year is added when the name has none.
 */
export function newEventId(event, taken) {
  let words = slug(`${event.name}`).split("-").filter(Boolean);
  let base = "ev";
  for (const w of words) {
    if (`${base}-${w}`.length > 52) break;
    base = `${base}-${w}`;
  }
  if (base === "ev") base = `ev-${(words[0] ?? "event").slice(0, 40)}`;
  if (event.startsOn && !/20\d\d/.test(event.name)) base = `${base}-${event.startsOn.slice(0, 4)}`;
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
  const parsed = DossierSchema.parse(remapSourceIds(draft.dossier, map));
  // Pictures found earlier stay with their merch; a picture link the research saw is kept for the
  // picture step to copy (only our own copies are ever shown).
  const ownOnly = parsed.merch.map((m) => {
    const images = (m.images ?? []).filter(isOurImage);
    return { ...m, images, imageCredit: images.length ? m.imageCredit : null };
  });
  const dossier = { ...parsed, merch: carryMerchImages(ownOnly, stored.merch ?? []) };
  const timeline = remapSourceIds(draft.timeline, map);
  const e = draft.event;
  // Runs that are open-ended (a pop-up "from 1 Dec") keep no end date rather than ending on day one.
  const openEnded = ["popup", "cafe", "merch"].includes(e.kind);
  let startsOn = e.startsOn ?? existing?.startsOn ?? null;
  let endsOn = e.endsOn ?? (e.startsOn ? (openEnded ? (existing?.startsOn === e.startsOn ? existing?.endsOn ?? null : null) : e.startsOn) : existing?.endsOn ?? null);
  // An upcoming event never jumps into the past on one research pass (a misread year, an
  // announcement date taken for the event's): it keeps its dates until a later pass agrees.
  const today = localDay(now);
  const wasAhead = existing?.startsOn && (existing.endsOn ?? existing.startsOn) >= today;
  let pastDatesSeen = null;
  if (wasAhead && startsOn && (endsOn ?? startsOn) < today && !e.cancelled) {
    const seen = stored.pastDatesSeen;
    const again = seen && seen.startsOn === startsOn && (seen.endsOn ?? null) === (endsOn ?? null);
    if (!again) {
      pastDatesSeen = { startsOn, endsOn: endsOn ?? null, at: now.toISOString() };
      startsOn = existing.startsOn;
      endsOn = existing.endsOn;
    }
  }
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
    dossier: { ...dossier, datesTbc: e.datesTbc || !startsOn, sources, timeline: mergedTimeline, ...(pastDatesSeen ? { pastDatesSeen } : {}) },
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
  for (const path of [...(signal.payload?.remoteImages ?? []), ...(signal.payload?.blobPaths ?? [])].slice(0, 2)) {
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
      // A target that was folded into another event means that event (never revive an alias).
      target = followMerges(rows, target);
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
      // Dedupe: the triage match (unless the draft is clearly another event), else a strict
      // name/date/official-page match against everything we have.
      const fits = target ? draftFitsTarget(target, result.draft.event) : false;
      if (target && !fits) log("mismatch", { signal: signal.id, target: target.id, draft: result.draft.event.name });
      if (target && !fits && signal.origin === "refresh") {
        // Asked to update one event, the research came back about another: leave the page as it was.
        await updateSignal(db, signal.id, { status: "skipped", eventId: target.id, message: "the research described a different event; the page was left as it was" });
        summary.skipped++;
        continue;
      }
      const existing = (fits ? target : null) ?? findSameEvent(rows.filter((r) => r.id !== target?.id || fits), result.draft.event);
      const id = existing?.id ?? newEventId(result.draft.event, new Set(rows.map((r) => r.id)));
      const { record, entries } = recordFromDraft(result.draft, { existing: existing ? await getEventRow(db, existing.id) : null, id, origin: signal.origin === "refresh" ? "crawler" : signal.origin, now: now(), triage });
      await saveEvent(db, record, { now: now() });
      if (entries.length) await addLogEntries(db, id, entries, { now: now() });
      // Earlier duplicates of this event fold into the one first spotted; their ids keep working.
      const survivor = await foldDuplicates(db, await getEventRow(db, id), rows, { now: now(), log });
      if (survivor !== id) summary.merged = (summary.merged ?? 0) + 1;
      await updateSignal(db, signal.id, { ...statusFor(signal, existing ? "updated" : "added"), eventId: survivor });
      for (const b of batched.filter(Boolean)) await updateSignal(db, b.id, { status: "updated", eventId: survivor });
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

/** Follows `dossier.mergedInto` within `rows` (a few hops at most). */
export function followMerges(rows, row) {
  let out = row;
  for (let n = 0; out?.status === "merged" && out.dossier?.mergedInto && n < 5; n++) out = rows.find((r) => r.id === out.dossier.mergedInto) ?? out;
  return out?.status === "merged" ? null : out;
}

/**
 * Folds rows that are certainly the same event as `row` (same name or same official page, with
 * overlapping dates) into the one seen first. The others become aliases (status "merged"), so a page
 * she has open, a saved heart or a notification never leads nowhere. Returns the surviving id.
 */
export async function foldDuplicates(db, row, rows, { now = new Date(), log = () => {} } = {}) {
  if (!row || row.status === "hidden") return row?.id;
  const strict = (r) => {
    if (r.id === row.id || ["merged", "out_of_scope", "hidden"].includes(r.status)) return false;
    if (datesOverlap(r, row) !== true) return false;
    const sameName = norm(r.name) === norm(row.name);
    const samePage = officialKey(r.url) && officialKey(r.url) === officialKey(row.url) && nameSimilarity(r.name, row.name) >= 0.5;
    return sameName || samePage;
  };
  const dupes = rows.filter(strict);
  if (!dupes.length) return row.id;
  const all = [row, ...dupes].sort((a, b) => new Date(a.firstSeenAt ?? now) - new Date(b.firstSeenAt ?? now) || a.id.localeCompare(b.id));
  const survivor = all[0];
  // The survivor keeps its id and first sighting but takes the freshest research.
  if (survivor.id !== row.id) {
    const { id, firstSeenAt, origin, status, hers, big, confidence, ...fresh } = row;
    const dossier = { ...(fresh.dossier ?? {}), merch: carryMerchImages(fresh.dossier?.merch ?? [], survivor.dossier?.merch ?? []) };
    await saveEvent(
      db,
      {
        ...survivor,
        ...fresh,
        id: survivor.id,
        dossier,
        image: fresh.image?.url ? fresh.image : survivor.image ?? null,
        weather: fresh.weather ?? survivor.weather ?? null,
        transit: fresh.transit ?? survivor.transit ?? null,
        hers: survivor.hers || hers,
        big: survivor.big || big,
        confidence: survivor.confidence === "owner_confirmed" ? survivor.confidence : confidence,
        status: survivor.status === "cancelled" || status === "cancelled" ? status : survivor.status,
      },
      { now },
    );
  }
  for (const other of all.slice(1)) {
    await mergeEvent(db, other.id, survivor.id, { now, reason: "same event" });
    log("merged", { from: other.id, into: survivor.id });
  }
  return survivor.id;
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
