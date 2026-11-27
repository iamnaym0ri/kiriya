// "Add to calendar" for an event or a merch drop (docs/refactor/PLAN.md phase 6). Pure, so the
// website builds the file in the browser and the server can serve the same file to the iPhone app
// (inside the app a downloaded blob can't reach Calendar; Safari opening a real .ics link can).
//
// toIcs(item) takes the events-ui item shape (src/world/events/eventsData.js): times are ISO
// strings with their Singapore offset, `days` lists each open day with its hours, `drop` describes a
// merch drop. One calendar entry per open day, so each day keeps its own hours; a reminder the day
// before the first one.

const pad = (n) => String(n).padStart(2, "0");

/** 20261128T020000Z */
export function icsStamp(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const dateOnly = (day) => day.replaceAll("-", "");
function nextDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** RFC 5545 text: backslash, comma, semicolon and newlines escaped. */
export function icsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Lines longer than 75 octets continue on the next line after a space (never inside a character). */
export function foldLine(line) {
  const bytes = (s) => new TextEncoder().encode(s).length;
  if (bytes(line) <= 75) return line;
  const parts = [];
  let current = "";
  for (const ch of line) {
    const limit = parts.length ? 74 : 75;
    if (bytes(current + ch) > limit) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const sgAt = (day, time) => `${day}T${time.length === 5 ? `${time}:00` : time}+08:00`;

function locationOf(item) {
  const v = item.venue;
  if (!v) return null;
  return [v.name, v.hall, v.address].filter(Boolean).join(", ");
}

function describe(item, extra) {
  const official = (item.links ?? []).find((l) => l.kind === "official") ?? (item.links ?? [])[0];
  return [extra, item.tagline, official ? `${official.label}: ${official.url}` : null, "♡ from kiriya.love"]
    .filter(Boolean)
    .join("\n");
}

/** The calendar entries for an item: [{ uid, summary, start, end, allDay, description }]. */
export function calendarEntries(item) {
  if (!item || item.datesTbc) return [];
  const entries = [];
  if (item.kind === "merch" && item.drop) {
    const { dropAt, until } = item.drop;
    if (dropAt) {
      const start = new Date(dropAt);
      entries.push({
        uid: `${item.id}-drop`,
        summary: `${item.name} · drops`,
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        description: describe(item, item.drop.where?.length ? `where: ${item.drop.where.map((w) => w.name).join(", ")}` : null),
      });
    }
    if (until) {
      const end = new Date(until);
      entries.push({
        uid: `${item.id}-closes`,
        summary: `${item.name} · preorder closes`,
        start: new Date(end.getTime() - 60 * 60_000),
        end,
        description: describe(item, "last hour to order"),
      });
    }
    return entries;
  }
  const days = (item.days ?? []).filter((d) => d.date);
  if (days.length) {
    days.forEach((d, i) => {
      const label = days.length > 1 ? `${item.name} · day ${i + 1}` : item.name;
      if (d.opens && d.closes) {
        const end = d.closes <= d.opens ? sgAt(nextDay(d.date), d.closes) : sgAt(d.date, d.closes);
        entries.push({ uid: `${item.id}-${d.date}`, summary: label, start: new Date(sgAt(d.date, d.opens)), end: new Date(end), description: describe(item, d.note) });
      } else entries.push({ uid: `${item.id}-${d.date}`, summary: label, allDay: [d.date, nextDay(d.date)], description: describe(item, d.note) });
    });
    return entries;
  }
  if (item.startsAt) {
    const start = new Date(item.startsAt);
    const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 2 * 3600_000);
    // A plain date (no time) spans whole days.
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.startsAt))
      entries.push({ uid: item.id, summary: item.name, allDay: [item.startsAt, nextDay(item.endsAt ?? item.startsAt)], description: describe(item) });
    else entries.push({ uid: item.id, summary: item.name, start, end, description: describe(item) });
  }
  return entries;
}

/** The whole .ics file (CRLF line endings), or null when the dates aren't known yet. */
export function toIcs(item, { now = new Date() } = {}) {
  const entries = calendarEntries(item);
  if (!entries.length) return null;
  const location = locationOf(item);
  const official = (item.links ?? []).find((l) => l.kind === "official");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//kiriya.love//events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  entries.forEach((entry, i) => {
    lines.push("BEGIN:VEVENT", `UID:${icsText(entry.uid)}@kiriya.love`, `DTSTAMP:${icsStamp(now)}`);
    if (entry.allDay) lines.push(`DTSTART;VALUE=DATE:${dateOnly(entry.allDay[0])}`, `DTEND;VALUE=DATE:${dateOnly(entry.allDay[1])}`);
    else lines.push(`DTSTART:${icsStamp(entry.start)}`, `DTEND:${icsStamp(entry.end)}`);
    lines.push(`SUMMARY:${icsText(entry.summary)}`);
    if (location) lines.push(`LOCATION:${icsText(location)}`);
    if (item.venue?.lat != null && item.venue?.lng != null) lines.push(`GEO:${item.venue.lat};${item.venue.lng}`);
    if (entry.description) lines.push(`DESCRIPTION:${icsText(entry.description)}`);
    if (official?.url) lines.push(`URL:${official.url}`);
    if (i === 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`${item.name} is tomorrow ♡`)}`, "TRIGGER:-P1D", "END:VALARM");
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** A tidy file name: "afa-singapore-2026.ics". */
export const icsFileName = (item) =>
  `${String(item?.name ?? "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event"}.ics`;
