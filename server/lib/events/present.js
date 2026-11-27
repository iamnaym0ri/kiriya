// Shapes the events API responses (docs/refactor/EVENTS-API.md). Pure: rows in, JSON out.
import {
  KIND_LABELS,
  currentPhase,
  dateRangeText,
  merchSummary,
  priceLabel,
  ticketSummary,
  timeRangeText,
  timelineFor,
} from "./dossier.js";
import { fandomLabel } from "./fandoms.js";

const DAY_MS = 86400000;
const dayNum = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS;
const iso = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString());
const sgt = (day, time) => (day && time ? `${day}T${time}:00+08:00` : null);

/** upcoming | on_now | past | cancelled, by the Singapore calendar day. */
export function eventStatus(row, today) {
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "hidden") return "hidden";
  const end = row.endsOn ?? row.startsOn;
  if (row.startsOn && today >= row.startsOn && today <= end) return "on_now";
  if (end && today > end) return "past";
  return "upcoming";
}

export function countdown(row, today) {
  if (!row.startsOn) return { days: null, label: "dates tbc" };
  const end = row.endsOn ?? row.startsOn;
  const toStart = dayNum(row.startsOn) - dayNum(today);
  if (today > end) return { days: dayNum(end) - dayNum(today), label: "ended" };
  if (toStart <= 0) {
    const total = dayNum(end) - dayNum(row.startsOn) + 1;
    const n = dayNum(today) - dayNum(row.startsOn) + 1;
    return { days: 0, label: total > 1 ? `on now · day ${n} of ${total}` : "today!!" };
  }
  if (toStart === 1) return { days: 1, label: "tomorrow" };
  if (toStart < 14) return { days: toStart, label: `in ${toStart} days` };
  if (toStart < 60) return { days: toStart, label: `in ${Math.round(toStart / 7)} weeks` };
  return { days: toStart, label: `in ${Math.round(toStart / 30)} months` };
}

/** Adds `sourceId` (the first of `sourceIds`) to every claim-like object, as the UI expects. */
export function withSourceId(value) {
  if (Array.isArray(value)) return value.map(withSourceId);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = withSourceId(v);
  if (Array.isArray(value.sourceIds)) out.sourceId = value.sourceIds[0] ?? null;
  return out;
}

const datesTbcOf = (row) => !row.startsOn || row.confidence === "unconfirmed" || Boolean(row.dossier?.datesTbc);

export function eventCard(row, { today, me, log = [] }) {
  const dossier = row.dossier ?? {};
  const days = dossier.days ?? [];
  const first = days.find((d) => d.date === row.startsOn) ?? days[0];
  const last = [...days].reverse().find((d) => d.date === (row.endsOn ?? row.startsOn)) ?? days.at(-1);
  const status = eventStatus(row, today);
  const steps = timelineFor({ timeline: dossier.timeline ?? [], startsOn: row.startsOn, endsOn: row.endsOn, status, dossier }, today);
  const looked = me?.looked?.[row.id] ?? null;
  const since = looked ?? me?.lastLookedAt ?? null;
  const updates = log.filter((e) => e.eventId === row.id);
  const unseen = updates.filter((e) => !since || iso(e.at) > since).length;
  const lastUpdate = updates[0] ? { at: iso(updates[0].at), title: updates[0].title, kind: updates[0].kind } : null;
  return {
    id: row.id,
    kind: row.kind ?? "con",
    kindLabel: KIND_LABELS[row.kind] ?? "event",
    name: row.name,
    tagline: row.tagline ?? dossier.about?.summary?.text?.slice(0, 140) ?? null,
    startsOn: row.startsOn ?? null,
    endsOn: row.endsOn ?? row.startsOn ?? null,
    startsAt: sgt(row.startsOn, first?.date === row.startsOn ? first?.opens : null),
    endsAt: sgt(row.endsOn ?? row.startsOn, last?.date === (row.endsOn ?? row.startsOn) ? last?.closes : null),
    datesTbc: datesTbcOf(row),
    dateLabel: dateRangeText(row.startsOn, row.endsOn, { year: Number(today.slice(0, 4)) }),
    timeLabel: first?.opens ? timeRangeText(first.opens, first.closes) : null,
    venueName: dossier.venue?.name ?? row.venue ?? null,
    venueArea: dossier.venue?.area ?? null,
    city: row.city ?? "Singapore",
    hers: Boolean(row.hers),
    big: Boolean(row.big),
    fandoms: row.fandoms ?? [],
    fandomLabels: (row.fandoms ?? []).map(fandomLabel),
    tags: row.tags ?? [],
    tickets: ticketSummary(dossier.tickets),
    merch: merchSummary(dossier.merch),
    status,
    phase: currentPhase(steps),
    countdown: countdown(row, today),
    image: row.image ? { url: row.image.url, alt: row.image.alt ?? row.name, credit: row.image.credit ?? null } : null,
    url: row.url ?? null,
    updatedAt: iso(row.updatedAt ?? row.lastVerifiedAt),
    lastUpdate,
    unseenUpdates: unseen,
    saved: Boolean(me?.saved?.events?.[row.id]),
    lastLookedAt: looked,
    confidence: row.confidence,
    ...(row.origin === "fixture" ? { fixture: true } : {}),
  };
}

export function presentSources(sources = []) {
  return sources.map((s) => ({ id: s.id, label: s.label, url: s.url, kind: s.kind, publisher: s.publisher ?? null, at: s.at ?? null, images: s.images ?? [] }));
}

export function presentMerch(item, row, { today, me }) {
  const id = `${row.id}~${item.id}`;
  return withSourceId({
    ...item,
    id,
    itemId: item.id,
    priceLabel: priceLabel(item.price, item.currency),
    saved: Boolean(me?.saved?.merch?.[id]),
    event: {
      id: row.id,
      name: row.name,
      kind: row.kind,
      startsOn: row.startsOn ?? null,
      endsOn: row.endsOn ?? row.startsOn ?? null,
      dateLabel: dateRangeText(row.startsOn, row.endsOn, { year: Number(today.slice(0, 4)) }),
      venueName: row.dossier?.venue?.name ?? row.venue ?? null,
      status: eventStatus(row, today),
    },
  });
}

/** One event, everything she can read about it. */
export function eventDetail(row, { today, me, log = [], admin = false }) {
  const card = eventCard(row, { today, me, log });
  const dossier = row.dossier ?? {};
  const { sources = [], timeline = [], datesTbc, ...body } = dossier;
  const since = card.lastLookedAt ?? me?.lastLookedAt ?? null;
  const updates = log
    .filter((e) => e.eventId === row.id)
    .map((e) => ({ id: e.id, at: iso(e.at), kind: e.kind, title: e.title, text: e.text, sourceIds: e.sourceIds ?? [], sourceId: (e.sourceIds ?? [])[0] ?? null, big: e.big, unseen: !since || iso(e.at) > since }));
  const merch = (body.merch ?? []).map((m) => presentMerch(m, row, { today, me }));
  const tickets = body.tickets ? { ...body.tickets, tiers: (body.tickets.tiers ?? []).map((t) => ({ ...t, priceLabel: priceLabel(t.price, t.currency) })) } : null;
  const days = (body.days ?? []).map((d) => ({ ...d, startsAt: sgt(d.date, d.opens), endsAt: sgt(d.date, d.closes), timeLabel: timeRangeText(d.opens, d.closes), dateLabel: dateRangeText(d.date) }));
  return {
    ...card,
    dossier: { ...withSourceId({ ...body, days, tickets }), merch },
    timeline: withSourceId(timelineFor({ timeline, startsOn: row.startsOn, endsOn: row.endsOn, status: card.status, dossier }, today)),
    updates,
    sources: presentSources(sources),
    weather: presentWeather(row.weather, today),
    transit: presentTransit(row.transit),
    ...(admin ? { admin: { origin: row.origin, hidden: row.status === "hidden", investigatedAt: iso(row.investigatedAt), firstSeenAt: iso(row.firstSeenAt), confidence: row.confidence } } : {}),
  };
}

export function presentWeather(weather, today) {
  if (!weather?.days?.length && !weather?.now) return null;
  const days = (weather.days ?? []).filter((d) => d.date >= today);
  if (!days.length && !weather.now) return null;
  return { ...weather, days };
}

export function presentTransit(transit) {
  if (!transit) return null;
  return { status: transit.status ?? "normal", alerts: transit.alerts ?? [], fetchedAt: transit.fetchedAt ?? null, credit: transit.credit ?? "LTA DataMall" };
}

/** List filters: `when`, `kind`, `fandom`, `saved`. Returns the filtered rows and facet counts. */
export function filterRows(rows, { when = "upcoming", kinds = [], fandoms = [], saved = false, me, today }) {
  const byWhen = rows.filter((row) => {
    const status = eventStatus(row, today);
    if (status === "hidden") return false;
    if (when === "upcoming") return status === "upcoming" || status === "on_now";
    if (when === "past") return status === "past";
    return true;
  });
  const facets = { kinds: {}, fandoms: {} };
  for (const row of byWhen) {
    facets.kinds[row.kind ?? "con"] = (facets.kinds[row.kind ?? "con"] ?? 0) + 1;
    for (const f of row.fandoms ?? []) facets.fandoms[f] = (facets.fandoms[f] ?? 0) + 1;
  }
  const out = byWhen.filter(
    (row) =>
      (!kinds.length || kinds.includes(row.kind)) &&
      (!fandoms.length || (row.fandoms ?? []).some((f) => fandoms.includes(f))) &&
      (!saved || me?.saved?.events?.[row.id]),
  );
  // Upcoming: soonest first, dated before tbc. Past: most recent first.
  const key = (row) => row.startsOn ?? "9999-12-31";
  out.sort((a, b) => (when === "past" ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))) || a.name.localeCompare(b.name));
  return {
    rows: out,
    filters: {
      kinds: Object.entries(facets.kinds).map(([id, count]) => ({ id, label: KIND_LABELS[id] ?? id, count })),
      fandoms: Object.entries(facets.fandoms)
        .map(([id, count]) => ({ id, label: fandomLabel(id), count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export function meBlock(me, role) {
  return {
    role,
    preview: role !== "kiriya",
    lastLookedAt: me.lastLookedAt ?? null,
    saved: { events: Object.keys(me.saved?.events ?? {}), merch: Object.keys(me.saved?.merch ?? {}) },
  };
}
