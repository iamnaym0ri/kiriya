// The event as an .ics file for "Add to Calendar". The events screens' generator
// (shared/eventCalendar.js, toIcs(event) → string) is used when present; this fallback keeps the route
// working without it. Public facts only: name, days and times in SGT, venue and address, official URL.

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
};
const compactDay = (d) => d.replaceAll("-", "");
const nextDay = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1)).toISOString().slice(0, 10);

/**
 * The public subset of an event detail (GET /api/events/:id → `event`), in the same shape, so the
 * shared generator works on either: no per-person fields, no update log, no sources.
 */
export function publicEvent(detail) {
  const v = detail.dossier?.venue;
  return {
    id: detail.id,
    name: detail.name,
    kind: detail.kind,
    tagline: detail.tagline,
    startsOn: detail.startsOn,
    endsOn: detail.endsOn,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    datesTbc: detail.datesTbc,
    url: detail.url,
    venueName: detail.venueName,
    venueArea: detail.venueArea,
    dossier: {
      days: (detail.dossier?.days ?? []).map((d) => ({ date: d.date, opens: d.opens, closes: d.closes, label: d.label, startsAt: d.startsAt, endsAt: d.endsAt })),
      venue: v ? { name: v.name, hall: v.hall, address: v.address, area: v.area, lat: v.lat, lng: v.lng } : null,
    },
  };
}

export function fallbackIcs(event, { now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const venue = event.dossier?.venue;
  const where = [venue?.name ?? event.venueName, venue?.hall, venue?.address].filter(Boolean).join(", ");
  const timed = (event.dossier?.days ?? []).filter((d) => d.opens);
  const blocks = timed.length
    ? timed.map((d, i) => [
        `UID:${event.id}-${i}@kiriya.love`,
        `DTSTART;TZID=Asia/Singapore:${compactDay(d.date)}T${d.opens.replace(":", "")}00`,
        `DTEND;TZID=Asia/Singapore:${compactDay(d.date)}T${(d.closes ?? d.opens).replace(":", "")}00`,
      ])
    : event.startsOn
      ? [[`UID:${event.id}@kiriya.love`, `DTSTART;VALUE=DATE:${compactDay(event.startsOn)}`, `DTEND;VALUE=DATE:${compactDay(nextDay(event.endsOn ?? event.startsOn))}`]]
      : [];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kiriya.love//events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Singapore",
    "BEGIN:STANDARD",
    "DTSTART:19820101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:SGT",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...blocks.flatMap((b) => [
      "BEGIN:VEVENT",
      ...b,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${esc(event.name)}`,
      ...(where ? [`LOCATION:${esc(where)}`] : []),
      ...(venue?.lat != null && venue?.lng != null ? [`GEO:${venue.lat};${venue.lng}`] : []),
      ...(event.url ? [`URL:${event.url}`] : []),
      ...(event.tagline ? [`DESCRIPTION:${esc(event.tagline + (event.url ? `\n${event.url}` : ""))}`] : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Uses the shared generator when the events screens have shipped it. */
export async function eventIcs(detail) {
  const event = publicEvent(detail);
  try {
    const shared = await import("../../../shared/eventCalendar.js");
    if (typeof shared.toIcs === "function") return shared.toIcs(event);
  } catch {
    // Not merged yet: use the fallback below.
  }
  return fallbackIcs(event);
}
