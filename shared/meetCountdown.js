// "Until we meet" (her tab and Josh's, src/world/me/MeetCard.jsx; the setting lives in
// server/routes/meSection.js). Pure date maths, shared by the app, the server and the tests.

export const MEET_ZONES = {
  "Asia/Singapore": { city: "Singapore", who: "kiriya" },
  "America/Chicago": { city: "Houston", who: "Josh" },
};
export const MEET_ZONE_IDS = Object.keys(MEET_ZONES);

/** The two of them on the map. */
export const PLACES = {
  houston: { name: "Houston", who: "Josh", lat: 29.7604, lon: -95.3698, zone: "America/Chicago" },
  singapore: { name: "Singapore", who: "kiriya", lat: 1.3521, lon: 103.8198, zone: "Asia/Singapore" },
};

/** Great-circle distance in km (haversine on the mean Earth radius). */
export function greatCircleKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const KM_PER_MILE = 1.609344;

// ---------- wall clocks ----------

const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone))
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );
  return formatters.get(timeZone);
}

/** The wall clock in `timeZone` at `instant`, as numbers. */
export function wallClock(instant, timeZone) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour % 24, minute: +parts.minute, second: +parts.second };
}

const floating = (w) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second ?? 0);
const offsetAt = (instant, timeZone) => floating(wallClock(instant, timeZone)) - Math.floor(instant / 1000) * 1000;

/**
 * The instant a wall-clock time happens in `timeZone`. A time skipped by a daylight-saving jump
 * lands just after it (2:30 on the spring-forward night is 3:30); a time that happens twice is the
 * first one.
 */
export function zonedToInstant(wall, timeZone) {
  const guess = floating({ second: 0, ...wall });
  const offsets = [offsetAt(guess - 86_400_000, timeZone), offsetAt(guess + 86_400_000, timeZone)];
  const candidates = [...new Set(offsets)].map((offset) => guess - offset).filter((instant) => floating(wallClock(instant, timeZone)) === guess);
  if (candidates.length) return Math.min(...candidates);
  // Skipped by the clocks going forward: the offset before the jump puts it just after.
  return guess - offsets[0];
}

/** "2026-12-24T21:30" ⇄ the instant, in `timeZone` (for the editor's datetime-local field). */
export function parseLocal(text, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text ?? "");
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || hour > 23 || minute > 59) return null;
  return zonedToInstant({ year, month, day, hour, minute }, timeZone);
}
export function formatLocal(instant, timeZone) {
  const w = wallClock(instant, timeZone);
  const pad = (n) => String(n).padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

// ---------- the countdown ----------

const daysIn = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
/** Adds whole months to a wall date, keeping the day where it fits (31 Jan + 1 month = 28/29 Feb). */
function addMonths(wall, n) {
  const index = wall.year * 12 + (wall.month - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { ...wall, year, month, day: Math.min(wall.day, daysIn(year, month)) };
}
const addDays = (wall, n) => {
  const t = new Date(floating(wall) + n * 86_400_000);
  return { ...wall, year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
};

/**
 * Years, months, days, hours, minutes and seconds from `now` until `target`, counted on the calendar
 * of `timeZone` (the clock the meeting was set in): real months, and a day across a daylight-saving
 * change is still one day. Counted back from the meeting ("1 month and 2 days until 1 March"), so it
 * only ever goes down as time passes, even around short months. `done` once the moment has come.
 */
export function countdown(now, target, timeZone = "Asia/Singapore") {
  const zero = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (!(target > now)) return { ...zero, done: true };
  const from = wallClock(now, timeZone);
  const to = wallClock(target, timeZone);
  const fits = (wall) => floating(wall) >= floating(from);

  let months = (to.year - from.year) * 12 + (to.month - from.month);
  while (months > 0 && !fits(addMonths(to, -months))) months -= 1;
  const anchor = addMonths(to, -months);
  let days = Math.max(0, Math.floor((floating(anchor) - floating(from)) / 86_400_000));
  while (days > 0 && !fits(addDays(anchor, -days))) days -= 1;

  // What's left is real time between two instants, so an hour gained or lost to daylight saving
  // shows in the hours instead of breaking the day count.
  const restFor = (d) => zonedToInstant(addDays(anchor, -d), timeZone) - now;
  let rest = restFor(days);
  while (rest < 0 && days > 0) rest = restFor(--days);
  while (rest >= 86_400_000) {
    days += 1;
    rest -= 86_400_000;
  }
  rest = Math.max(0, Math.floor(rest / 1000));
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days,
    hours: Math.floor(rest / 3600),
    minutes: Math.floor((rest % 3600) / 60),
    seconds: rest % 60,
    done: false,
  };
}

/** How much of the wait is behind them, 0–100 with one decimal. */
export function progress(now, start, target) {
  if (!(target > start)) return now >= target ? 100 : 0;
  const share = (now - start) / (target - start);
  return Math.round(Math.min(1, Math.max(0, share)) * 1000) / 10;
}
