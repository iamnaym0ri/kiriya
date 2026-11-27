// Words, dates and little labels for the events & merch screens. Everything is shown in Singapore
// time, whatever time zone the phone is in.

const SG = "Asia/Singapore";
const fmt = (options) => new Intl.DateTimeFormat("en-SG", { timeZone: SG, ...options });
const DAY = fmt({ day: "numeric" });
const MONTH = fmt({ month: "short" });
const MONTH_LONG = fmt({ month: "long" });
const YEAR = fmt({ year: "numeric" });
const WEEKDAY = fmt({ weekday: "short" });
const TIME = fmt({ hour: "numeric", minute: "2-digit", hourCycle: "h23" });

export const KINDS = {
  con: { label: "con", plural: "cons" },
  fair: { label: "fair", plural: "fairs & markets" },
  popup: { label: "pop-up", plural: "pop-ups" },
  cafe: { label: "collab café", plural: "collab cafés" },
  concert: { label: "concert", plural: "concerts" },
  merch: { label: "merch drop", plural: "merch drops" },
  event: { label: "event", plural: "events" },
};
export const kindLabel = (kind) => KINDS[kind]?.label ?? "event";

/** "2026-11-28" for a moment, as a Singapore calendar day. */
export const sgDay = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: SG }).format(new Date(value));
const asDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+08:00`) : new Date(value));

/** Whole Singapore days from today to `value` (0 = today, negative once it has passed). */
export function daysAway(value, now = new Date()) {
  if (!value) return null;
  const a = Date.parse(`${sgDay(asDate(value))}T00:00:00Z`);
  const b = Date.parse(`${sgDay(now)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export const dayNumber = (value) => DAY.format(asDate(value));
export const monthShort = (value) => MONTH.format(asDate(value)).toLowerCase();
export const monthLong = (value) => MONTH_LONG.format(asDate(value)).toLowerCase();
export const weekday = (value) => WEEKDAY.format(asDate(value)).toLowerCase();
export const timeOf = (value) => TIME.format(asDate(value));
const yearOf = (value) => YEAR.format(asDate(value));

/** "sat 28 nov" */
export const dayLabel = (value) => `${weekday(value)} ${dayNumber(value)} ${monthShort(value)}`;

/** "28–30 nov", "30 nov – 2 dec", "28 nov 2026 – 3 jan 2027", or the "dates tbc" note. */
export function dateRange(item, { withYear = false, now = new Date() } = {}) {
  if (!item) return "";
  if (item.datesTbc || !item.startsAt) return item.datesNote ? `dates tbc · ${item.datesNote}` : "dates tbc";
  const start = item.startsAt;
  const end = item.endsAt ?? item.startsAt;
  const sameDay = sgDay(asDate(start)) === sgDay(asDate(end));
  const year = (v) => (withYear || yearOf(v) !== yearOf(now) ? ` ${yearOf(v)}` : "");
  if (sameDay) return `${dayLabel(start)}${year(start)}`;
  if (yearOf(start) !== yearOf(end))
    return `${dayNumber(start)} ${monthShort(start)} ${yearOf(start)} – ${dayNumber(end)} ${monthShort(end)} ${yearOf(end)}`;
  if (monthShort(start) === monthShort(end)) return `${dayNumber(start)}–${dayNumber(end)} ${monthShort(end)}${year(end)}`;
  return `${dayNumber(start)} ${monthShort(start)} – ${dayNumber(end)} ${monthShort(end)}${year(end)}`;
}

/** "10:00–21:00" for one open day. */
export const hours = (d) => (d?.opens && d?.closes ? `${d.opens}–${d.closes}` : d?.opens ? `from ${d.opens}` : "hours tbc");

/** The open days as moments: [{ date, start, end, note }], oldest first. */
export function openings(item) {
  const days = (item?.days ?? []).filter((d) => d.date);
  if (days.length)
    return days.map((d) => {
      const start = new Date(`${d.date}T${d.opens ?? "00:00"}:00+08:00`);
      let end = new Date(`${d.date}T${d.closes ?? "23:59"}:00+08:00`);
      if (end <= start) end = new Date(end.getTime() + 86_400_000);
      return { date: d.date, start, end, note: d.note ?? null };
    });
  // A pop-up or café open every day between two dates, with the same hours each day.
  if (item?.hours && item.startsAt && !item.datesTbc) {
    const first = sgDay(asDate(item.startsAt));
    const last = sgDay(asDate(item.endsAt ?? item.startsAt));
    const out = [];
    for (let d = first, i = 0; d <= last && i < 400; i++) {
      const start = new Date(`${d}T${item.hours.opens ?? "00:00"}:00+08:00`);
      let end = new Date(`${d}T${item.hours.closes ?? "23:59"}:00+08:00`);
      if (end <= start) end = new Date(end.getTime() + 86_400_000);
      out.push({ date: d, start, end, note: null });
      d = sgDay(new Date(Date.parse(`${d}T12:00:00+08:00`) + 86_400_000));
    }
    return out;
  }
  if (item?.startsAt && !item.datesTbc) {
    const start = asDate(item.startsAt);
    const end = item.endsAt ? asDate(item.endsAt) : new Date(start.getTime() + 3 * 3600_000);
    return [{ date: sgDay(start), start, end, note: null }];
  }
  return [];
}

/**
 * Where an item is in its life right now:
 * { phase: "tbc" | "soon" | "today" | "open" | "between" | "ended" | "cancelled", next, closesAt, day, of }
 * `next` is the moment the countdown counts to.
 */
export function phaseOf(item, now = new Date()) {
  if (!item) return { phase: "tbc" };
  if (item.state === "cancelled") return { phase: "cancelled" };
  if (item.kind === "merch") return merchPhase(item, now);
  const open = openings(item);
  if (!open.length) return { phase: "tbc" };
  const t = now.getTime();
  const last = open[open.length - 1];
  if (t >= last.end.getTime()) return { phase: "ended", endedAt: last.end };
  // A pop-up or café that runs for weeks is simply "on" from its first morning to its last night.
  if (item.hours && open.length > 1) {
    const first = open[0].start;
    if (t < first.getTime()) return { phase: sgDay(first) === sgDay(now) ? "today" : "soon", next: first };
    return { phase: "open", run: true, until: last.end };
  }
  const index = open.findIndex((o) => t < o.end.getTime());
  const current = open[index];
  if (t >= current.start.getTime()) return { phase: "open", closesAt: current.end, day: index + 1, of: open.length };
  if (index === 0) return { phase: sgDay(current.start) === sgDay(now) ? "today" : "soon", next: current.start };
  return { phase: "between", next: current.start, day: index + 1, of: open.length };
}

function merchPhase(item, now) {
  const drop = item.drop ?? {};
  const t = now.getTime();
  if (drop.status === "sold_out") return { phase: "sold_out" };
  if (drop.dropAt && t < Date.parse(drop.dropAt)) return { phase: "soon", next: new Date(drop.dropAt) };
  if (drop.until && t >= Date.parse(drop.until)) return { phase: "ended", endedAt: new Date(drop.until) };
  if (drop.until) return { phase: "open", closesAt: new Date(drop.until) };
  return { phase: "open" };
}

/** The moment an item sorts by: when it starts (or drops), else when it ends. */
export function sortTime(item) {
  if (item.kind === "merch") return Date.parse(item.drop?.dropAt ?? item.drop?.until ?? item.startsAt ?? "") || Infinity;
  return Date.parse(openings(item)[0]?.start ?? "") || Infinity;
}

/** Split a duration into { days, hours, minutes, seconds }. */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** "in 3 days", "tomorrow", "today", "in 5 hours" — for rows where a ticking clock is too much. */
export function whenLabel(item, now = new Date()) {
  const p = phaseOf(item, now);
  const merch = item.kind === "merch";
  switch (p.phase) {
    case "cancelled":
      return "cancelled";
    case "sold_out":
      return "sold out";
    case "tbc":
      return "dates tbc";
    case "ended":
      return merch ? "closed" : "ended";
    case "open":
      if (merch) {
        if (!p.closesAt) return "out now";
        const d = daysAway(p.closesAt, now);
        return d <= 0 ? `closes ${timeOf(p.closesAt)} today` : d === 1 ? "closes tomorrow" : `closes in ${d} days`;
      }
      if (p.run) {
        const left = daysAway(p.until, now);
        return left <= 0 ? "last day today" : left === 1 ? "ends tomorrow" : left <= 7 ? `${left} days left` : `on till ${dayNumber(p.until)} ${monthShort(p.until)}`;
      }
      return p.of > 1 ? `on now · day ${p.day} of ${p.of}` : "on now";
    case "between":
      return `day ${p.day} ${daysAway(p.next, now) === 1 ? "tomorrow" : `on ${weekday(p.next)}`}`;
    case "today":
      return `${merch ? "drops" : "opens"} ${timeOf(p.next)} today`;
    case "soon": {
      const d = daysAway(p.next, now);
      const pre = merch ? "drops " : "";
      if (d <= 1) return `${pre}tomorrow`;
      if (d < 7) return `${pre}in ${d} days`;
      const weeks = Math.round(d / 7);
      if (d < 35) return `${pre}in ${weeks} week${weeks === 1 ? "" : "s"}`;
      return `${pre || "on "}${dayNumber(p.next)} ${monthShort(p.next)}`;
    }
    default:
      return "";
  }
}

const MONEY = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** "S$38", "S$12.50", "free" */
export function price(p) {
  if (!p) return null;
  if (p.free || p.amount === 0) return "free";
  if (p.currency && p.currency !== "SGD")
    return new Intl.NumberFormat("en-SG", { style: "currency", currency: p.currency, maximumFractionDigits: p.currency === "JPY" || p.currency === "KRW" ? 0 : 2 }).format(p.amount);
  return MONEY.format(p.amount).replace(/^SGD\s?/, "S$").replace(/^\$/, "S$");
}

// Status chips: tone picks the colour (mint = go, rose = hurry, plum = waiting, mute = done).
const TICKET_CHIPS = {
  on_sale: { tone: "mint", label: "tickets on sale" },
  selling_fast: { tone: "rose", label: "selling fast" },
  sold_out: { tone: "mute", label: "sold out" },
  soon: { tone: "plum", label: "tickets soon" },
  free: { tone: "mint", label: "free entry" },
  at_door: { tone: "plum", label: "pay at the door" },
  tbc: { tone: "plum", label: "tickets tbc" },
};
const TIER_CHIPS = {
  on_sale: { tone: "mint", label: "on sale" },
  selling_fast: { tone: "rose", label: "selling fast" },
  sold_out: { tone: "mute", label: "sold out" },
  soon: { tone: "plum", label: "soon" },
  free: { tone: "mint", label: "free" },
  at_door: { tone: "plum", label: "at the door" },
  tbc: { tone: "plum", label: "tbc" },
};
const DROP_CHIPS = {
  preorder: { tone: "mint", label: "preorder open" },
  in_stores: { tone: "mint", label: "in stores" },
  online: { tone: "mint", label: "online now" },
  soon: { tone: "plum", label: "dropping soon" },
  restock: { tone: "rose", label: "restocked" },
  selling_fast: { tone: "rose", label: "selling fast" },
  sold_out: { tone: "mute", label: "sold out" },
};

export const tierChip = (status) => TIER_CHIPS[status] ?? null;

/** The one or two chips a row shows. */
export function chipsFor(item, now = new Date()) {
  const chips = [];
  const p = phaseOf(item, now);
  if (p.phase === "cancelled") return [{ tone: "mute", label: "cancelled" }];
  if (item.kind === "merch") {
    const drop = item.drop ?? {};
    if (p.phase === "soon") chips.push({ tone: "plum", label: `drops ${dayNumber(p.next)} ${monthShort(p.next)}` });
    else if (p.phase === "ended") chips.push({ tone: "mute", label: "closed" });
    else if (DROP_CHIPS[drop.status]) chips.push(DROP_CHIPS[drop.status]);
    if (p.phase === "open" && p.closesAt && daysAway(p.closesAt, now) <= 3) chips.push({ tone: "rose", label: whenLabel(item, now) });
    return chips;
  }
  if (p.phase === "open") chips.push({ tone: "rose", label: "on now" });
  if (p.phase === "ended") return [{ tone: "mute", label: "ended" }];
  const ticket = TICKET_CHIPS[item.tickets?.status];
  if (ticket) chips.push(ticket);
  return chips;
}

/** Apple Maps: the place, and transit directions to it. */
export function mapsLinks(venue) {
  if (!venue) return null;
  const label = [venue.name, venue.hall].filter(Boolean).join(", ");
  const q = encodeURIComponent(venue.name ?? label);
  const ll = venue.lat != null && venue.lng != null ? `${venue.lat},${venue.lng}` : null;
  const address = venue.address ? encodeURIComponent(venue.address) : null;
  const place = `https://maps.apple.com/?q=${q}${ll ? `&ll=${ll}` : ""}${address ? `&address=${address}` : ""}`;
  const destination = ll ?? address ?? q;
  return { place, directions: `https://maps.apple.com/?daddr=${destination}&dirflg=r`, label };
}

/** "animefestival.asia" from a link. */
export function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}

/** "2 hours ago", "yesterday", "3 days ago", "12 nov" */
export function ago(value, now = new Date()) {
  if (!value) return "";
  const ms = now.getTime() - Date.parse(value);
  const minutes = Math.round(ms / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hoursAgo = Math.round(minutes / 60);
  if (hoursAgo < 24 && daysAway(value, now) === 0) return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  const d = -daysAway(value, now);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return `${dayNumber(value)} ${monthShort(value)}`;
}

/** Group header for a list: "on now", "december", "january 2027", "dates tbc", "just ended". */
export function groupOf(item, now = new Date()) {
  const p = phaseOf(item, now);
  if (p.phase === "open" || p.phase === "between") return { key: "0-now", label: "on now" };
  if (p.phase === "ended" || p.phase === "sold_out" || p.phase === "cancelled") return { key: "9-ended", label: "just ended" };
  if (p.phase === "tbc") return { key: "8-tbc", label: "dates to be announced" };
  const at = p.next ?? new Date(sortTime(item));
  const month = monthLong(at);
  const year = yearOf(at);
  return { key: `1-${sgDay(at).slice(0, 7)}`, label: year === yearOf(now) ? month : `${month} ${year}` };
}
