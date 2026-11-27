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

const OPEN_ENDED_DAYS = 60;
const addDaysIso = (iso, n) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
const OPEN_ENDED = new Set(["popup", "cafe", "merch"]);

/** The last day an event can be on: its end, its start, or for an open-ended run its start + 60 days. */
export function lastDayOf(row) {
  if (row.endsOn) return row.endsOn;
  if (!row.startsOn) return null;
  return OPEN_ENDED.has(row.kind) ? addDaysIso(row.startsOn, OPEN_ENDED_DAYS) : row.startsOn;
}

/**
 * upcoming | on_now | past | cancelled | hidden | merged | out_of_scope, by the Singapore calendar day.
 * An event is "past" only once its last day is over; a cancelled one says so until then.
 */
export function eventStatus(row, today) {
  if (["hidden", "merged", "out_of_scope"].includes(row.status)) return row.status;
  const end = lastDayOf(row);
  if (row.status === "cancelled") return end && today > end ? "past" : "cancelled";
  if (row.startsOn && today >= row.startsOn && today <= end) return "on_now";
  if (end && today > end) return "past";
  return "upcoming";
}

export function countdown(row, today) {
  if (!row.startsOn) return { days: null, label: "dates tbc" };
  if (row.status === "cancelled") return { days: null, label: "cancelled" };
  const end = lastDayOf(row);
  const toStart = dayNum(row.startsOn) - dayNum(today);
  if (today > end) return { days: dayNum(end) - dayNum(today), label: "ended" };
  if (toStart <= 0) {
    const total = dayNum(end) - dayNum(row.startsOn) + 1;
    const n = dayNum(today) - dayNum(row.startsOn) + 1;
    if (!row.endsOn && OPEN_ENDED.has(row.kind)) return { days: 0, label: "on now" };
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
  const openEnded = Boolean(!row.endsOn && row.startsOn && OPEN_ENDED.has(row.kind));
  return {
    id: row.id,
    kind: row.kind ?? "con",
    kindLabel: KIND_LABELS[row.kind] ?? "event",
    name: row.name,
    tagline: row.tagline ?? dossier.about?.summary?.text?.slice(0, 140) ?? null,
    startsOn: row.startsOn ?? null,
    endsOn: openEnded ? lastDayOf(row) : row.endsOn ?? row.startsOn ?? null,
    openEnded,
    startsAt: sgt(row.startsOn, first?.date === row.startsOn ? first?.opens : null),
    endsAt: sgt(row.endsOn ?? row.startsOn, last?.date === (row.endsOn ?? row.startsOn) ? last?.closes : null),
    datesTbc: datesTbcOf(row),
    dateLabel: openEnded ? `from ${dateRangeText(row.startsOn, null, { year: Number(today.slice(0, 4)) })}` : dateRangeText(row.startsOn, row.endsOn, { year: Number(today.slice(0, 4)) }),
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

/** Our own copies only: a link the research saw but that wasn't copied yet is never shown. */
const OUR_IMAGE = /^\/api\/(?:uploads\/(?:media\?path=events(?:%2F|\/)|file\/events-)|events\/fixture-art\/)/;
export const merchImages = (item) => [...new Set([...(item.images ?? []), item.image].filter((u) => typeof u === "string" && OUR_IMAGE.test(u)))];

export function presentMerch(item, row, { today, me }) {
  const id = `${row.id}~${item.id}`;
  const images = merchImages(item);
  return withSourceId({
    ...item,
    id,
    itemId: item.id,
    image: images[0] ?? null,
    images,
    imageCredit: images.length ? item.imageCredit ?? null : null,
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
      venueArea: row.dossier?.venue?.area ?? null,
      status: eventStatus(row, today),
      image: row.image?.url ? { url: row.image.url, alt: row.image.alt ?? row.name } : null,
    },
  });
}

/**
 * One merch piece, everything about it: the piece, where it is (its event, venue and how to get
 * there) and a few more pieces from the same event.
 */
export function merchDetail(item, row, { today, me }) {
  const merch = presentMerch(item, row, { today, me });
  const venue = row.dossier?.venue ?? null;
  const sources = presentSources(row.dossier?.sources ?? []).filter((s) => (item.sourceIds ?? []).includes(s.id));
  return {
    ...merch,
    sources,
    event: {
      ...merch.event,
      tagline: row.tagline ?? null,
      timeLabel: eventCard(row, { today, me, log: [] }).timeLabel,
      venue: venue ? { name: venue.name, hall: venue.hall ?? null, area: venue.area ?? null, address: venue.address ?? null, lat: venue.lat ?? null, lng: venue.lng ?? null } : row.venue ? { name: row.venue } : null,
      tickets: ticketSummary(row.dossier?.tickets),
      url: row.url ?? null,
    },
    more: (row.dossier?.merch ?? []).filter((m) => m.id !== item.id).slice(0, 8).map((m) => presentMerch(m, row, { today, me })),
  };
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
    // Hidden by Josh, folded into another event (its id still opens that one) or ruled out.
    if (["hidden", "merged", "out_of_scope"].includes(status)) return false;
    if (when === "upcoming") return status === "upcoming" || status === "on_now" || status === "cancelled";
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
