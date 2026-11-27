// The event dossier: what the investigation writes, how it is stored, and how a new investigation is
// merged into the last one so the update log can say what changed. Shapes: docs/refactor/EVENTS-API.md.
import { z } from "zod";

export const KINDS = ["con", "fair", "popup", "merch", "concert", "cafe", "other"];
export const KIND_LABELS = { con: "convention", fair: "fair & market", popup: "pop-up", merch: "merch drop", concert: "concert", cafe: "collab café", other: "event" };
export const STAGES = ["announced", "guests", "tickets", "merch", "schedule", "day", "after"];
export const STAGE_TITLES = {
  announced: "announced",
  guests: "guests revealed",
  tickets: "tickets on sale",
  merch: "merch & exclusives revealed",
  schedule: "schedule out",
  day: "the day itself",
  after: "after the event",
};
export const TICKET_STATUSES = ["on_sale", "soon", "sold_out", "free", "tbc", "closed"];
export const SOURCE_KINDS = ["official", "venue", "ticketing", "news", "listing", "social", "newsletter", "owner"];
export const LINK_KINDS = ["official", "tickets", "instagram", "map", "venue", "news", "other"];
export const MERCH_KINDS = ["exclusive", "merch", "collab", "limited", "freebie"];
export const MERCH_STATUSES = ["revealed", "preorder", "on_sale", "sold_out"];
export const SIZES = ["small", "medium", "large", "huge"];
export const UPDATE_KINDS = ["new", "dates", "venue", "guests", "tickets", "merch", "schedule", "cancelled", "weather", "transit", "note", "after"];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const httpsUrl = z
  .string()
  .max(800)
  .url()
  .refine((v) => /^https:\/\//.test(v), "https only");
const sourceId = z.string().regex(/^s\d{1,3}$/);
const text = (max) => z.string().trim().min(1).max(max);
const sourceIds = z.array(sourceId).max(8).default([]);

export const ClaimSchema = z.object({ text: text(700), sourceIds }).strict();
const nullableClaim = ClaimSchema.nullable().default(null);

export const SourceSchema = z
  .object({
    id: sourceId,
    label: text(160),
    url: httpsUrl,
    kind: z.enum(SOURCE_KINDS),
    publisher: z.string().trim().max(120).nullable().default(null),
    // When we saw it (ISO). Kept from the first sighting when a later investigation cites it again.
    at: z.string().max(40).nullable().default(null),
    // An Instagram post's images, copied to our Blob because Instagram's links expire.
    images: z.array(z.string().max(800)).max(6).default([]),
  })
  .strict();

export const MerchSchema = z
  .object({
    id: z.string().regex(/^m[\w-]{1,40}$/),
    name: text(160),
    kind: z.enum(MERCH_KINDS),
    fandoms: z.array(text(60)).max(6).default([]),
    price: z.number().min(0).max(100000).nullable().default(null),
    currency: z.string().length(3).default("SGD"),
    where: z.string().trim().max(200).nullable().default(null),
    when: z.string().trim().max(120).nullable().default(null),
    limited: z.boolean().default(false),
    status: z.enum(MERCH_STATUSES).default("revealed"),
    note: z.string().trim().max(400).nullable().default(null),
    // A picture link: our stored copy, or (from the research) a page's picture still to be copied.
    image: z.string().max(800).nullable().default(null),
    // Our stored copies (lib/events/images.js); filled by the worker, never by the research.
    images: z.array(z.string().max(800)).max(6).default([]),
    imageCredit: z.string().trim().max(120).nullable().default(null),
    sourceIds,
  })
  .strict();

export const DossierSchema = z
  .object({
    about: z
      .object({ summary: ClaimSchema, like: nullableClaim, highlights: z.array(ClaimSchema).max(8).default([]) })
      .strict(),
    days: z
      .array(
        z
          .object({
            date: isoDay,
            opens: hhmm.nullable().default(null),
            closes: hhmm.nullable().default(null),
            label: z.string().trim().max(80).nullable().default(null),
            note: z.string().trim().max(300).nullable().default(null),
            sourceIds,
          })
          .strict(),
      )
      .max(60)
      .default([]),
    datesNote: nullableClaim,
    venue: z
      .object({
        name: text(200),
        hall: z.string().trim().max(120).nullable().default(null),
        address: z.string().trim().max(300).nullable().default(null),
        area: z.string().trim().max(80).nullable().default(null),
        lat: z.number().min(1.1).max(1.5).nullable().default(null),
        lng: z.number().min(103.5).max(104.1).nullable().default(null),
        directions: z.array(ClaimSchema).max(6).default([]),
        sourceIds,
      })
      .strict()
      .nullable()
      .default(null),
    tickets: z
      .object({
        status: z.enum(TICKET_STATUSES).default("tbc"),
        opensAt: z.string().max(40).nullable().default(null),
        buyUrl: httpsUrl.nullable().default(null),
        tiers: z
          .array(
            z
              .object({
                name: text(120),
                price: z.number().min(0).max(100000).nullable().default(null),
                currency: z.string().length(3).default("SGD"),
                status: z.enum(TICKET_STATUSES).default("on_sale"),
                note: z.string().trim().max(300).nullable().default(null),
                sourceIds,
              })
              .strict(),
          )
          .max(20)
          .default([]),
        note: nullableClaim,
      })
      .strict()
      .default({ status: "tbc", opensAt: null, buyUrl: null, tiers: [], note: null }),
    links: z
      .array(z.object({ label: text(80), url: httpsUrl, kind: z.enum(LINK_KINDS).default("other") }).strict())
      .max(12)
      .default([]),
    guests: z
      .array(
        z
          .object({
            name: text(120),
            role: z.string().trim().max(120).nullable().default(null),
            day: isoDay.nullable().default(null),
            fandoms: z.array(text(60)).max(6).default([]),
            note: z.string().trim().max(300).nullable().default(null),
            sourceIds,
          })
          .strict(),
      )
      .max(40)
      .default([]),
    merch: z.array(MerchSchema).max(40).default([]),
    size: z
      .object({ scale: z.enum(SIZES).nullable().default(null), text: text(300), sourceIds })
      .strict()
      .nullable()
      .default(null),
    tips: z.array(ClaimSchema).max(10).default([]),
    popup: z.object({ about: ClaimSchema, sold: z.array(ClaimSchema).max(10).default([]) }).strict().nullable().default(null),
  })
  .strict();

export const TimelineSchema = z
  .array(
    z
      .object({
        stage: z.enum(STAGES),
        at: z.string().max(40).nullable().default(null),
        title: z.string().trim().max(120).nullable().default(null),
        text: z.string().trim().max(400).nullable().default(null),
        sourceIds,
      })
      .strict(),
  )
  .max(14)
  .default([]);

/** What the investigation submits (the `submit_dossier` tool's input). */
export const DraftSchema = z
  .object({
    isEvent: z.boolean(),
    reason: z.string().trim().max(300).nullable().default(null),
    event: z
      .object({
        name: text(160),
        kind: z.enum(KINDS),
        tagline: text(140),
        startsOn: isoDay.nullable().default(null),
        endsOn: isoDay.nullable().default(null),
        datesTbc: z.boolean().default(false),
        venueName: z.string().trim().max(200).nullable().default(null),
        city: z.string().trim().max(80).default("Singapore"),
        fandoms: z.array(text(60)).max(10).default([]),
        tags: z.array(text(40)).max(12).default([]),
        officialUrl: httpsUrl.nullable().default(null),
        cancelled: z.boolean().default(false),
      })
      .strict()
      .nullable()
      .default(null),
    dossier: DossierSchema.nullable().default(null),
    timeline: TimelineSchema,
    sources: z.array(SourceSchema).max(40).default([]),
  })
  .strict();

/** The `submit_dossier` tool's JSON Schema, from the same zod schema the result is checked with. */
export function draftJsonSchema() {
  const schema = z.toJSONSchema(DraftSchema, { io: "input", unrepresentable: "any" });
  delete schema.$schema;
  return schema;
}

// ---------------------------------------------------------------------------------------------
// Sources: renumbered and merged so ids stay stable across investigations.
// ---------------------------------------------------------------------------------------------

const normUrl = (u) => {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^igsh$/i.test(key)) url.searchParams.delete(key);
    return url.href.replace(/\/$/, "");
  } catch {
    return String(u);
  }
};

/**
 * Merges the draft's sources into the stored list. Returns the merged list and a map from the draft's
 * ids to the stored ids, so claims can be rewritten. A source already known (same URL) keeps its id
 * and first-seen time.
 */
export function mergeSources(stored = [], drafted = [], { now = new Date() } = {}) {
  const out = stored.map((s) => ({ ...s }));
  const byUrl = new Map(out.map((s) => [normUrl(s.url), s]));
  let next = out.reduce((n, s) => Math.max(n, Number(s.id.slice(1)) || 0), 0) + 1;
  const map = {};
  for (const source of drafted) {
    const known = byUrl.get(normUrl(source.url));
    if (known) {
      map[source.id] = known.id;
      if (source.images?.length && !known.images?.length) known.images = source.images;
      continue;
    }
    const id = `s${next++}`;
    const fresh = { ...source, id, at: source.at ?? now.toISOString() };
    out.push(fresh);
    byUrl.set(normUrl(fresh.url), fresh);
    map[source.id] = id;
  }
  return { sources: out, map };
}

/** Rewrites every `sourceIds` array in a value through `map`, dropping ids that cite nothing. */
export function remapSourceIds(value, map) {
  if (Array.isArray(value)) return value.map((v) => remapSourceIds(v, map));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = key === "sourceIds" && Array.isArray(v) ? [...new Set(v.map((id) => map[id]).filter(Boolean))] : remapSourceIds(v, map);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// What changed: the update log entries a new investigation produces.
// ---------------------------------------------------------------------------------------------

const daysKey = (days = []) => days.map((d) => `${d.date} ${d.opens ?? ""}-${d.closes ?? ""}`).join("|");
const names = (list = []) => new Set(list.map((g) => g.name.trim().toLowerCase()));
const firstSources = (...lists) => [...new Set(lists.flat().filter(Boolean))].slice(0, 4);

/**
 * Compares the stored event (columns + dossier) with the merged result of a new investigation and
 * returns update-log entries `{kind, title, text, sourceIds}`. A brand-new event yields one "new".
 */
export function diffEvent(before, after) {
  if (!before) return [{ kind: "new", title: "first spotted", text: after.tagline ?? "", sourceIds: firstSources(after.dossier?.about?.summary?.sourceIds) }];
  const out = [];
  const b = before.dossier ?? {};
  const a = after.dossier ?? {};
  if (after.status === "cancelled" && before.status !== "cancelled")
    out.push({ kind: "cancelled", title: "cancelled", text: a.datesNote?.text ?? "the organiser called it off.", sourceIds: firstSources(a.datesNote?.sourceIds) });
  if ((before.startsOn ?? null) !== (after.startsOn ?? null) || (before.endsOn ?? null) !== (after.endsOn ?? null)) {
    if (after.startsOn)
      out.push({ kind: "dates", title: before.startsOn ? "new dates" : "dates confirmed", text: dateRangeText(after.startsOn, after.endsOn), sourceIds: firstSources(...(a.days ?? []).map((d) => d.sourceIds)) });
  }
  if (a.venue?.name && a.venue.name !== b.venue?.name)
    out.push({ kind: "venue", title: b.venue?.name ? "new venue" : "venue confirmed", text: [a.venue.name, a.venue.hall].filter(Boolean).join(", "), sourceIds: firstSources(a.venue.sourceIds) });
  const oldGuests = names(b.guests);
  const newGuests = (a.guests ?? []).filter((g) => !oldGuests.has(g.name.trim().toLowerCase()));
  if (newGuests.length)
    out.push({
      kind: "guests",
      title: newGuests.length === 1 ? "a guest announced" : `${newGuests.length} guests announced`,
      text: newGuests.slice(0, 6).map((g) => g.name).join(", ") + (newGuests.length > 6 ? "…" : ""),
      sourceIds: firstSources(...newGuests.map((g) => g.sourceIds)),
    });
  const bt = b.tickets ?? {};
  const at = a.tickets ?? {};
  if (at.status && at.status !== (bt.status ?? "tbc") && at.status !== "tbc")
    out.push({ kind: "tickets", title: TICKET_TITLES[at.status], text: ticketLine(at), sourceIds: firstSources(at.note?.sourceIds, ...(at.tiers ?? []).map((t) => t.sourceIds)) });
  const oldMerch = names(b.merch);
  const newMerch = (a.merch ?? []).filter((m) => !oldMerch.has(m.name.trim().toLowerCase()));
  if (newMerch.length) {
    const exclusive = newMerch.some((m) => m.kind === "exclusive" || m.limited);
    out.push({
      kind: "merch",
      title: exclusive ? "exclusives revealed" : "merch revealed",
      text: newMerch.slice(0, 5).map((m) => m.name).join(", ") + (newMerch.length > 5 ? "…" : ""),
      sourceIds: firstSources(...newMerch.map((m) => m.sourceIds)),
    });
  }
  const hadTimes = (b.days ?? []).some((d) => d.opens);
  if ((a.days ?? []).some((d) => d.opens) && daysKey(a.days) !== daysKey(b.days) && before.startsOn === after.startsOn)
    out.push({ kind: "schedule", title: hadTimes ? "times changed" : "opening times out", text: (a.days ?? []).map(dayLine).join(" · "), sourceIds: firstSources(...(a.days ?? []).map((d) => d.sourceIds)) });
  return out;
}

const TICKET_TITLES = { on_sale: "tickets on sale", soon: "tickets coming soon", sold_out: "sold out", free: "free entry confirmed", closed: "ticket sales closed" };
export function ticketLine(tickets) {
  const priced = (tickets.tiers ?? []).filter((t) => t.price != null);
  if (tickets.status === "free") return "free entry";
  if (!priced.length) return tickets.note?.text ?? "";
  const min = Math.min(...priced.map((t) => t.price));
  return `from ${priceLabel(min, priced[0].currency)}${priced.length > 1 ? ` · ${priced.length} kinds` : ""}`;
}
export const priceLabel = (price, currency = "SGD") =>
  price == null ? null : price === 0 ? "free" : `${currency === "SGD" ? "S$" : `${currency} `}${Number.isInteger(price) ? price : price.toFixed(2)}`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const parts = (iso) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
/** "27–29 nov", "30 nov – 2 dec", "25 dec 2026 – 3 jan 2027", "12 dec". Lowercase, like the site. */
export function dateRangeText(startsOn, endsOn, { year = null } = {}) {
  if (!startsOn) return "dates tbc";
  const a = parts(startsOn);
  const b = parts(endsOn ?? startsOn);
  const showYear = (y) => (year != null && y !== year ? ` ${y}` : "");
  if (startsOn === (endsOn ?? startsOn)) return `${a.d} ${MONTHS[a.m - 1]}${showYear(a.y)}`;
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS[a.m - 1]}${showYear(a.y)}`;
  return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}${showYear(b.y)}`;
}
const clock = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}.${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
};
export const timeRangeText = (opens, closes) => (opens ? `${clock(opens)}${closes ? ` – ${clock(closes)}` : ""}` : null);
export const dayLine = (d) => `${dateRangeText(d.date)}${d.opens ? ` ${timeRangeText(d.opens, d.closes)}` : ""}`;

// ---------------------------------------------------------------------------------------------
// The timeline: always the seven stages, in order, each done / now / next / unknown.
// ---------------------------------------------------------------------------------------------

/**
 * Builds the seven-stage timeline from what the investigation recorded plus what the dates imply
 * (the day itself and after). `today` is the Singapore calendar day.
 */
export function timelineFor({ timeline = [], startsOn, endsOn, status, dossier = {} }, today) {
  const recorded = new Map();
  for (const step of timeline) if (!recorded.has(step.stage) || step.at) recorded.set(step.stage, step);
  const end = endsOn ?? startsOn;
  const on = startsOn && today >= startsOn && today <= end;
  const after = end && today > end;
  const implied = {
    guests: (dossier.guests ?? []).length > 0,
    tickets: ["on_sale", "sold_out", "free", "closed"].includes(dossier.tickets?.status),
    merch: (dossier.merch ?? []).length > 0,
    schedule: (dossier.days ?? []).some((d) => d.opens),
  };
  const steps = STAGES.map((stage) => {
    const step = recorded.get(stage);
    // A milestone dated in the future (tickets go on sale on 2 Dec) is coming, not done.
    const atDay = step?.at ? String(step.at).slice(0, 10) : null;
    const ahead = Boolean(atDay && /^\d{4}-\d{2}-\d{2}$/.test(atDay) && atDay > today);
    let state = ahead ? "next" : step?.at || step?.text || implied[stage] ? "done" : "unknown";
    if (stage === "announced" && !ahead) state = "done";
    if (stage === "day") state = after ? "done" : on ? "now" : startsOn ? "next" : "unknown";
    if (stage === "after") state = after ? (step?.text ? "done" : "now") : "unknown";
    if (status === "cancelled" && (stage === "day" || stage === "after")) state = "unknown";
    return {
      stage,
      title: step?.title ?? STAGE_TITLES[stage],
      text: step?.text ?? (stage === "day" && startsOn ? dateRangeText(startsOn, endsOn) : null),
      at: step?.at ?? (stage === "day" ? startsOn ?? null : null),
      state,
      sourceIds: step?.sourceIds ?? [],
    };
  });
  // The first stage that hasn't happened yet is "next" (unless the day already is).
  if (!steps.some((s) => s.state === "now" || (s.state === "next" && s.stage !== "day"))) {
    const next = steps.find((s) => s.state === "unknown" && s.stage !== "after");
    if (next && next.stage !== "day") next.state = "next";
  }
  return steps;
}

/** The stage she's at right now: the last one done, or "day" while it's on. */
export function currentPhase(steps) {
  return steps.find((s) => s.state === "now")?.stage ?? [...steps].reverse().find((s) => s.state === "done")?.stage ?? "announced";
}

/** "2026-12-02 12:00", "2026-12-02T12:00:00+08:00" or "2026-12-02" (Singapore time) → epoch ms, or null. */
export function sgMoment(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(value.trim())) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(`${m[1]}T${m[2] ?? "00"}:${m[3] ?? "00"}:00+08:00`);
  return Number.isFinite(t) ? t : null;
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

/** Who sells the tickets: the ticketing source's publisher ("SISTIC"), else the link's site. */
export function ticketSeller(url, { sources = [], links = [] } = {}) {
  const host = hostOf(url);
  if (!host) return null;
  const source = sources.find((s) => hostOf(s.url) === host && s.publisher && ["ticketing", "official", "venue"].includes(s.kind));
  if (source) return source.publisher.split(/\s+[–—-]\s+/)[0].trim().slice(0, 40);
  const link = links.find((l) => hostOf(l.url) === host && l.label);
  const named = link?.label.replace(/\b(tickets?|ticketing|page|official|on)\b/gi, "").replace(/\s+/g, " ").trim();
  return named && named.length <= 24 ? named : host;
}

/**
 * The card's ticket line, saying what is actually known: when sales open (from the tickets block,
 * else the timeline's "tickets" milestone), who sells them, the lowest price still on sale. A sale
 * that was "soon" counts as on sale once its moment has passed, without waiting for new research.
 */
export function ticketSummary(tickets = {}, { timeline = [], sources = [], links = [], official = null, now = new Date() } = {}) {
  tickets ??= {};
  const tiers = tickets.tiers ?? [];
  const available = tiers.filter((t) => t.price != null && t.status !== "sold_out");
  const priced = available.length ? available : tiers.filter((t) => t.price != null);
  const opensAt = tickets.opensAt ?? timeline.find((step) => step.stage === "tickets" && sgMoment(step.at))?.at ?? null;
  const opensMs = sgMoment(opensAt);
  let status = tickets.status ?? "tbc";
  if (status === "tbc" && opensMs) status = opensMs > now.getTime() ? "soon" : "on_sale";
  else if (status === "soon" && opensMs && opensMs <= now.getTime()) status = "on_sale";
  const from = priced.length ? Math.min(...priced.map((t) => t.price)) : status === "free" ? 0 : null;
  const url = tickets.buyUrl ?? links.find((l) => l.kind === "tickets")?.url ?? null;
  // Sold on the event's own site: no seller to name. Elsewhere (SISTIC, Ticketmaster…): say who.
  const seller = url && hostOf(url) !== hostOf(official) ? ticketSeller(url, { sources, links }) : null;
  const opens = opensMs ? new Date(opensMs).toISOString() : null;
  const day = opensMs ? dateRangeText(new Date(opensMs + 8 * 3600_000).toISOString().slice(0, 10)) : null;
  const labels = { on_sale: "tickets on sale", soon: day ? `tickets ${day}` : "tickets soon", sold_out: "sold out", free: "free entry", tbc: "tickets tbc", closed: "sales closed" };
  return {
    status,
    from,
    label: status === "on_sale" && from != null ? `from ${priceLabel(from, priced[0]?.currency)}` : labels[status] ?? labels.tbc,
    opensAt: opens,
    opensHasTime: Boolean(opensAt && /\d{2}:\d{2}/.test(opensAt)),
    url,
    seller,
  };
}

export function merchSummary(merch = []) {
  if (!merch.length) return { status: "none", count: 0, label: null };
  const exclusives = merch.filter((m) => m.kind === "exclusive" || m.limited).length;
  return { status: exclusives ? "exclusives" : "revealed", count: merch.length, exclusives, label: exclusives ? `${exclusives} exclusive${exclusives === 1 ? "" : "s"}` : `${merch.length} merch` };
}
