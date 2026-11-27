// Dates in the notes & letters section, always in Singapore time (where she is).
const TZ = "Asia/Singapore";
const dayKey = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });
const time = new Intl.DateTimeFormat("en-SG", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayMonth = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: TZ });
const longDay = new Intl.DateTimeFormat("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const monthYear = new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: TZ });

const lower = (text) => text.replace(/\b(AM|PM)\b/g, (m) => m.toLowerCase()).replace(/\s(am|pm)$/, " $1");

/** "10:55 am", "yesterday", "3 Dec": for list rows. */
export function when(date, now = new Date()) {
  if (!date) return "";
  const key = dayKey(date);
  if (key === dayKey(now)) return lower(time.format(new Date(date)));
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "yesterday";
  return dayMonth.format(new Date(date));
}

/** "today, 10:55 am" / "3 December 2026": on the paper itself. */
export function writtenOn(date, now = new Date()) {
  if (!date) return "";
  const key = dayKey(date);
  if (key === dayKey(now)) return `today, ${lower(time.format(new Date(date)))}`;
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return `yesterday, ${lower(time.format(new Date(date)))}`;
  return fullDate.format(new Date(date));
}

export const longDate = (date) => longDay.format(new Date(date)).toLowerCase();
export const monthOf = (date) => monthYear.format(new Date(date)).toLowerCase();

/** Whole days until a moment, counted in Singapore calendar days. */
export function daysUntil(date, now = new Date()) {
  const a = Date.parse(`${dayKey(now)}T00:00:00Z`);
  const b = Date.parse(`${dayKey(date)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function opensIn(date, now = new Date()) {
  const days = daysUntil(date, now);
  if (days <= 0) return `opens at ${lower(time.format(new Date(date)))}`;
  if (days === 1) return "opens tomorrow";
  if (days < 7) return `opens in ${days} days`;
  return `opens ${dayMonth.format(new Date(date))}`;
}

/** For notes still on their way (Josh's phone): "tonight, 8:00 pm", "tomorrow, 8:00 am", "5 Dec, 9:00 am". */
export function onItsWay(date, now = new Date()) {
  const days = daysUntil(date, now);
  const at = lower(time.format(new Date(date)));
  if (days <= 0) return `today, ${at}`;
  if (days === 1) return `tomorrow, ${at}`;
  return `${dayMonth.format(new Date(date))}, ${at}`;
}
