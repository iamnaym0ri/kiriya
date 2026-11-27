import assert from "node:assert/strict";
import { test } from "node:test";
import { PLACES, countdown, formatLocal, greatCircleKm, KM_PER_MILE, parseLocal, progress, wallClock, zonedToInstant } from "../shared/meetCountdown.js";

// "Until we meet" (shared/meetCountdown.js): calendar-aware countdowns across month ends, leap
// years and Houston's daylight saving, the progress bar, and the distance on the map.

const SG = "Asia/Singapore";
const HOU = "America/Chicago";
const at = (iso) => Date.parse(iso);
const parts = (c) => [c.years, c.months, c.days, c.hours, c.minutes, c.seconds];

test("Wall clocks turn into the right instants, daylight saving included", () => {
  assert.equal(zonedToInstant({ year: 2026, month: 12, day: 24, hour: 21, minute: 30 }, SG), at("2026-12-24T13:30:00Z"), "Singapore is UTC+8, always");
  assert.equal(zonedToInstant({ year: 2027, month: 1, day: 15, hour: 9, minute: 0 }, HOU), at("2027-01-15T15:00:00Z"), "Houston in winter is UTC−6");
  assert.equal(zonedToInstant({ year: 2027, month: 7, day: 4, hour: 9, minute: 0 }, HOU), at("2027-07-04T14:00:00Z"), "and UTC−5 in summer");
  // 2027-03-14 02:30 never happens in Houston (02:00 → 03:00): it lands just after the jump.
  assert.equal(zonedToInstant({ year: 2027, month: 3, day: 14, hour: 2, minute: 30 }, HOU), at("2027-03-14T08:30:00Z"));
  assert.deepEqual(wallClock(at("2027-03-14T08:30:00Z"), HOU).hour, 3);
  // 2027-11-07 01:30 happens twice; the first one counts.
  assert.equal(zonedToInstant({ year: 2027, month: 11, day: 7, hour: 1, minute: 30 }, HOU), at("2027-11-07T06:30:00Z"));
  assert.equal(parseLocal("2027-02-29T10:00", SG), null, "2027 isn't a leap year");
  assert.equal(parseLocal("2028-02-29T10:00", SG), at("2028-02-29T02:00:00Z"));
  assert.equal(formatLocal(at("2026-12-24T13:30:00Z"), SG), "2026-12-24T21:30");
  assert.equal(formatLocal(at("2026-12-24T13:30:00Z"), HOU), "2026-12-24T07:30");
});

test("The countdown counts real months and days", () => {
  assert.deepEqual(parts(countdown(at("2026-11-27T04:00:00Z"), at("2026-12-27T04:00:00Z"), SG)), [0, 1, 0, 0, 0, 0], "27 Nov → 27 Dec is one month");
  assert.deepEqual(parts(countdown(at("2026-11-27T04:00:00Z"), at("2028-01-28T05:06:07Z"), SG)), [1, 2, 1, 1, 6, 7]);
  // 31 Jan + 1 month doesn't exist: the month ends on 28 Feb, then days.
  assert.deepEqual(parts(countdown(at("2027-01-31T02:00:00Z"), at("2027-03-01T02:00:00Z"), SG)), [0, 1, 1, 0, 0, 0]);
  // Leap year: 29 Feb 2028 is a day of its own.
  assert.deepEqual(parts(countdown(at("2028-02-28T02:00:00Z"), at("2028-03-01T02:00:00Z"), SG)), [0, 0, 2, 0, 0, 0]);
  assert.deepEqual(parts(countdown(at("2027-02-28T02:00:00Z"), at("2027-03-01T02:00:00Z"), SG)), [0, 0, 1, 0, 0, 0]);
  assert.deepEqual(parts(countdown(at("2026-12-31T23:59:59Z"), at("2027-01-01T00:00:00Z"), SG)), [0, 0, 0, 0, 0, 1]);
  assert.equal(countdown(at("2027-01-01T00:00:00Z"), at("2027-01-01T00:00:00Z"), SG).done, true, "the moment itself is done");
  assert.equal(countdown(at("2027-01-02T00:00:00Z"), at("2027-01-01T00:00:00Z"), SG).done, true);
});

test("A day across Houston's daylight saving is still a day; the hour shows in the hours", () => {
  // Saturday 9:00 → Sunday 9:00 across the spring-forward night: 23 real hours, one calendar day.
  const sat = zonedToInstant({ year: 2027, month: 3, day: 13, hour: 9, minute: 0 }, HOU);
  const sun = zonedToInstant({ year: 2027, month: 3, day: 14, hour: 9, minute: 0 }, HOU);
  assert.equal(sun - sat, 23 * 3_600_000);
  assert.deepEqual(parts(countdown(sat, sun, HOU)), [0, 0, 1, 0, 0, 0]);
  // The same instants on Singapore's calendar (no daylight saving there): 23 hours.
  assert.deepEqual(parts(countdown(sat, sun, SG)), [0, 0, 0, 23, 0, 0]);
  // Autumn: 25 real hours, still one day.
  const fri = zonedToInstant({ year: 2027, month: 11, day: 6, hour: 9, minute: 0 }, HOU);
  const sat2 = zonedToInstant({ year: 2027, month: 11, day: 7, hour: 9, minute: 0 }, HOU);
  assert.equal(sat2 - fri, 25 * 3_600_000);
  assert.deepEqual(parts(countdown(fri, sat2, HOU)), [0, 0, 1, 0, 0, 0]);
  // Counting down through the night itself never goes negative or past 23 hours.
  for (let t = sat; t < sun; t += 7 * 60_000) {
    const c = countdown(t, sun, HOU);
    assert.ok(c.hours >= 0 && c.hours < 24 && c.days <= 1, JSON.stringify(c));
  }
});

test("The countdown only ever goes down, around short months and daylight saving too", () => {
  const seconds = (c) => ((((c.years * 12 + c.months) * 31 + c.days) * 24 + c.hours) * 60 + c.minutes) * 60 + c.seconds;
  for (const [target, zone, from] of [
    [zonedToInstant({ year: 2027, month: 3, day: 1, hour: 0, minute: 0 }, HOU), HOU, "2027-01-20T00:00:00Z"],
    [zonedToInstant({ year: 2027, month: 3, day: 31, hour: 18, minute: 0 }, SG), SG, "2027-01-25T00:00:00Z"],
    [zonedToInstant({ year: 2027, month: 3, day: 20, hour: 12, minute: 0 }, HOU), HOU, "2027-03-01T00:00:00Z"],
  ]) {
    let last = Infinity;
    for (let t = at(from); t < target; t += 3_571_000) {
      const now = seconds(countdown(t, target, zone));
      assert.ok(now < last, `went up at ${new Date(t).toISOString()}`);
      last = now;
    }
  }
  const c = countdown(at("2027-01-29T15:00:00Z"), zonedToInstant({ year: 2027, month: 3, day: 1, hour: 0, minute: 0 }, SG), SG);
  assert.deepEqual(parts(c), [0, 1, 2, 1, 0, 0], "29 Jan 23:00 → 1 Mar: a month back is 1 Feb, then 2 days and an hour");
});

test("The progress bar fills from the start to the meeting", () => {
  const start = at("2026-11-01T00:00:00Z");
  const end = at("2026-12-01T00:00:00Z");
  assert.equal(progress(start, start, end), 0);
  assert.equal(progress(at("2026-11-16T00:00:00Z"), start, end), 50);
  assert.equal(progress(at("2026-11-11T00:00:00Z"), start, end), 33.3);
  assert.equal(progress(at("2026-12-02T00:00:00Z"), start, end), 100, "never past full");
  assert.equal(progress(at("2026-10-01T00:00:00Z"), start, end), 0, "never below empty");
});

test("Houston to Singapore, as the crow flies", () => {
  const km = greatCircleKm(PLACES.houston, PLACES.singapore);
  assert.ok(Math.abs(km - 16000) < 15, `${km}`);
  assert.equal(Math.round(km / KM_PER_MILE), 9942);
});
