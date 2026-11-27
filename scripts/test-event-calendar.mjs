// "Add to calendar" files (shared/eventCalendar.js): both the API's public event and the screens'
// item shape, every day with its own hours in SGT, plain days as all-day entries, safe text.
import assert from "node:assert/strict";
import test from "node:test";
import { foldLine, icsFileName, icsText, toIcs } from "../shared/eventCalendar.js";

const now = new Date("2026-11-26T03:00:00Z");
const apiEvent = {
  id: "fx-afa-singapore-2026",
  name: "AFA Singapore 2026",
  kind: "con",
  tagline: "the big one",
  startsOn: "2026-11-27",
  endsOn: "2026-11-29",
  startsAt: "2026-11-27T10:00:00+08:00",
  endsAt: "2026-11-29T20:00:00+08:00",
  datesTbc: false,
  url: "https://animefestival.asia/afasg26/",
  venueName: "Suntec Singapore Convention & Exhibition Centre",
  venueArea: "City Hall",
  dossier: {
    days: [
      { date: "2026-11-27", opens: "10:00", closes: "21:00" },
      { date: "2026-11-28", opens: "10:00", closes: "21:00" },
      { date: "2026-11-29", opens: "10:00", closes: "20:00" },
    ],
    venue: { name: "Suntec Singapore Convention & Exhibition Centre", hall: "Halls 401–404, Level 4", address: "1 Raffles Boulevard, Singapore 039593", lat: 1.2937, lng: 103.8572 },
  },
};

const unfold = (ics) => ics.replace(/\r\n /g, "");

test("one entry per day, each with its own hours, in UTC", () => {
  const ics = toIcs(apiEvent, { now });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 3);
  assert.match(ics, /DTSTART:20261127T020000Z\r\nDTEND:20261127T130000Z/);
  assert.match(ics, /DTSTART:20261129T020000Z\r\nDTEND:20261129T120000Z/);
  const flat = unfold(ics);
  assert.match(flat, /SUMMARY:AFA Singapore 2026 · day 1/);
  assert.match(flat, /LOCATION:Suntec Singapore Convention & Exhibition Centre\\, Halls 401–404\\, Level 4\\, 1 Raffles Boulevard\\, Singapore 039593/);
  assert.match(flat, /GEO:1.2937;103.8572/);
  assert.match(flat, /URL:https:\/\/animefestival.asia\/afasg26\//);
  // A reminder the day before, on the first day only.
  assert.equal(ics.match(/BEGIN:VALARM/g).length, 1);
  assert.match(ics, /TRIGGER:-P1D/);
});

test("plain days without hours become an all-day run", () => {
  const ics = toIcs({ id: "fx-sanrio", name: "Sanrio Characters Moonlit Garden", kind: "popup", startsOn: "2026-11-20", endsOn: "2027-01-04", startsAt: null, endsAt: null, datesTbc: false, url: "https://www.vivocity.com.sg/", venueName: "VivoCity", dossier: { days: [], venue: null } }, { now });
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert.match(ics, /DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20270105/);
  assert.match(unfold(ics), /LOCATION:VivoCity/);
});

test("a card's start and end times without day hours still give whole days", () => {
  const { dossier, ...card } = apiEvent;
  const ics = toIcs(card, { now });
  assert.match(ics, /DTSTART;VALUE=DATE:20261127\r\nDTEND;VALUE=DATE:20261130/);
});

test("the screens' item shape works too, and dates tbc gives nothing", () => {
  const item = { id: "x", name: "Doujin Market Mini", kind: "fair", days: [{ date: "2026-12-12", opens: "12:00", closes: "19:00" }], venue: { name: "Suntec", hall: "Hall 405" }, links: [{ kind: "official", label: "site", url: "https://example.sg/" }] };
  const ics = toIcs(item, { now });
  assert.match(ics, /DTSTART:20261212T040000Z\r\nDTEND:20261212T110000Z/);
  assert.match(ics, /SUMMARY:Doujin Market Mini\r\n/);
  assert.equal(toIcs({ id: "y", name: "JJK in Concert", datesTbc: true, startsOn: null }), null);
});

test("closing after midnight ends the next day", () => {
  const ics = toIcs({ id: "late", name: "late night", days: [{ date: "2026-12-11", opens: "20:00", closes: "02:00" }] }, { now });
  assert.match(ics, /DTSTART:20261211T120000Z\r\nDTEND:20261211T180000Z/);
});

test("text is escaped and long lines fold without splitting characters", () => {
  assert.equal(icsText("a, b; c\\d\ne"), "a\\, b\\; c\\\\d\\ne");
  const long = `DESCRIPTION:${"✿".repeat(40)}`;
  const folded = foldLine(long);
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  assert.equal(icsFileName({ name: "AFA Singapore 2026!" }), "afa-singapore-2026.ics");
});
