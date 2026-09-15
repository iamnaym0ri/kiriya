import { env } from "../env.js";

// Kiriya's calendar is Singapore's calendar. Every "today" on the server goes through here.

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: env.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function zonedParts(date = new Date()) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** YYYY-MM-DD for the Singapore day containing `date`. */
export function localDay(date = new Date()) {
  const { year, month, day } = zonedParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The UTC offset (ms) of the configured zone at an instant. */
function offsetAt(date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant when the zone's wall clock reads `day` (YYYY-MM-DD) at hour:minute. DST-safe. */
export function zonedInstant(day, hour = 0, minute = 0) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - offsetAt(new Date(guess));
  return new Date(guess - offsetAt(new Date(first)));
}

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Whole days from `fromDay` to `toDay` (both YYYY-MM-DD). */
export function daysBetween(fromDay, toDay) {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** The next occurrence (today counts) of month/day, as YYYY-MM-DD. */
export function nextOccurrence(month, dayOfMonth, fromDay = localDay()) {
  const year = Number(fromDay.slice(0, 4));
  const pad = (n) => String(n).padStart(2, "0");
  const candidate = `${year}-${pad(month)}-${pad(dayOfMonth)}`;
  return candidate >= fromDay ? candidate : `${year + 1}-${pad(month)}-${pad(dayOfMonth)}`;
}
