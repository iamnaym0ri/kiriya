// Event sources, shoot spots and lexicon candidates against trimmed real responses recorded on
// 2026-09-15 (scripts/fixtures/feeds/{events,shootspots,lexicon}/), through the real sourceHttp
// helper. No network: every request must match a recorded route.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.fetch = () => {
  throw new Error("global fetch is not allowed in adapter tests");
};

const { runAdapterPage, fixtureTransport, publicLookup } = await import("./lib/feed-source-harness.mjs");
const { sourceHttp } = await import("../server/feeds/http.js");
const { validateAdapterItem } = await import("../server/feeds/sources/registry.js");
const { sourceVerdict } = await import("../server/feeds/rules.js");
const { CHARACTER_ALIASES, FANDOM_ALIASES } = await import("../server/feeds/sources/tags.js");
const events = await import("../server/feeds/events/sources.js");
const { SHOOT_SPOTS } = await import("../server/content/shootSpots.js");
const spots = await import("../server/feeds/sources/shootspots.js");
const lexicon = await import("../server/feeds/lexicon-sources.js");

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/feeds");
const raw = (family, file) => readFileSync(path.join(FIXTURES, family, file));
const text = (family, file) => raw(family, file).toString("utf8");
const NOW = new Date("2026-09-15T12:00:00Z");
const HTML = "text/html; charset=UTF-8";
const JSONT = "application/json; charset=UTF-8";
const descriptor = (id) => {
  const d = events.EVENT_SOURCES.find((x) => x.id === id);
  assert.ok(d, `descriptor ${id}`);
  return d;
};
const exact = (url, file, extra = {}) => ({ match: (href) => href === url, file, source: "events", ...extra });

function eventHttp(d, routes, calls = [], overrides = {}) {
  return sourceHttp(events.eventHttpPolicy(d, { paceMs: 0, ...overrides }), {
    deadline: Date.now() + 30_000,
    stats: {},
    send: fixtureTransport(`events-${d.id}`, routes, calls),
    lookup: publicLookup,
  });
}
function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}
function assertExcerpts(read, pageText) {
  assert.ok(read.textExcerpts.length <= 6);
  for (const e of read.textExcerpts) {
    assert.ok(e.text.length > 0 && e.text.length <= 600, `excerpt length ${e.text.length}`);
    assert.ok(!hasLoneSurrogate(e.text), "excerpt splits a surrogate pair");
    if (pageText !== undefined) assert.ok(pageText.includes(e.text), `excerpt is not verbatim page text: ${e.text.slice(0, 80)}`);
    assert.match(e.sourceUrl, /^https:\/\//);
  }
}
async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------------------------

test("event descriptors are well-formed, host-exact and never read restricted sources", () => {
  const ids = new Set();
  for (const d of events.EVENT_SOURCES) {
    assert.ok(!ids.has(d.id), `duplicate ${d.id}`);
    ids.add(d.id);
    assert.match(d.id, /^[a-z][a-z0-9-]{1,50}$/);
    assert.ok(["sg", "regional"].includes(d.tier));
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: d.timezone }));
    assert.ok(["official", "listing", "social", "unconfirmed"].includes(d.confidence), d.id);
    assert.equal(typeof d.notes, "string");
    for (const host of d.hosts) assert.match(host, /^[a-z0-9.-]+\.[a-z]{2,}$/, `host ${host}`);
    assert.ok(!d.hosts.some((h) => /acgevents\.sg$|feverup\.com$|instagram\.com$|facebook\.com$|tiktok\.com$/.test(h)), `${d.id} lists a banned host`);
    for (const page of d.pages) {
      const u = new URL(page.url);
      assert.equal(u.protocol, "https:");
      assert.ok(d.hosts.includes(u.hostname), `${d.id} page off-host`);
      assert.ok(["wp-json", "json-ld", "html"].includes(page.kind));
      if (page.htmlUrl) assert.ok(d.hosts.includes(new URL(page.htmlUrl).hostname));
    }
    if (["restricted", "social_only"].includes(d.status)) assert.deepEqual([d.hosts, d.pages], [[], []], `${d.id} must not be read`);
    if (d.edition?.pattern) assert.ok(events.nextEditionUrl(d), `${d.id} edition pattern`);
    const policy = events.eventHttpPolicy(d);
    assert.ok(d.pages.length * 2 <= policy.maxRequests);
    if (d.verified) {
      const v = d.verified;
      assert.match(v.startsOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!v.endsOn || v.endsOn >= v.startsOn);
      assert.ok(["official", "listing"].includes(v.confidence));
      assert.ok(events.verbatimDateEvidence(v.evidence.text, v), `${d.id} evidence does not render its dates`);
      assert.match(v.evidence.sourceUrl, /^https:\/\//);
      assert.ok(Number.isFinite(Date.parse(v.checkedAt)));
    }
  }
  assert.deepEqual(
    events.EVENT_SOURCES.filter((d) => d.hers).map((d) => d.id).sort(),
    ["afa-singapore", "apothecary-diaries-exhibition-sg", "singapore-comic-con"],
  );
  assert.equal(events.eventHttpPolicy(descriptor("doujin-market")).paceMs, 30_000, "robots.txt crawl-delay");
  assert.equal(descriptor("doujin-market").pages.length, 1);
  assert.equal(descriptor("comic-fiesta").verified, null, "official page has no 2026 dates");
});

test("verified evidence is verbatim text of the recorded official pages", () => {
  const cases = [
    ["afa-singapore", events.mainText(text("events", "afa-home.html"))],
    ["singapore-comic-con", events.mainText(text("events", "sgcc-home.html"))],
    ["sj60-musubi-festival", events.mainText(text("events", "sj60-home.html"))],
    ["eoy-festival", events.mainText(text("events", "eoy-booth-2026.html"))],
    ["comiket", events.mainText(new TextDecoder("iso-2022-jp").decode(raw("events", "comiket-c109-info.iso2022jp.html")))],
    ["animejapan", events.mainText(text("events", "animejapan-about-en.html"))],
    ["japan-expo-thailand", events.mainText(text("events", "jet-how-to-exhibit.html"))],
    ["cosplay-mania", events.renderText(JSON.parse(text("events", "cosplayph-wp-post-35319.json")).content.rendered)],
  ];
  for (const [id, pageText] of cases) assert.ok(pageText.includes(descriptor(id).verified.evidence.text), `${id} evidence not found verbatim`);
});

// ---------------------------------------------------------------------------------------------
// verbatimDateEvidence
// ---------------------------------------------------------------------------------------------

test("verbatimDateEvidence accepts common English, Japanese, ISO and structured renderings", () => {
  const yes = [
    ["27–29 Nov 2026", "2026-11-27", "2026-11-29"],
    ["27-29 November 2026 Suntec Singapore", "2026-11-27", "2026-11-29"],
    ["November 27-29, 2026", "2026-11-27", "2026-11-29"],
    ["Nov 27 – 29, 2026", "2026-11-27", "2026-11-29"],
    ["27th-29th November 2026", "2026-11-27", "2026-11-29"],
    ["2026年12月29日", "2026-12-29", null],
    ["2026-12-29", "2026-12-29", null],
    ["2026/12/29", "2026-12-29", undefined],
    ["Comiket 2026: Dec 29–31", "2026-12-29", "2026-12-31"],
    ["開催日 ２０２６年１２月２９日（火）～３１日（木）", "2026-12-29", "2026-12-31"],
    ["2027年2月26日(金)〜2月28日(日)", "2027-02-26", "2027-02-28"],
    ["2026年7月31日・8月1日・8月2日の三日間", "2026-07-31", "2026-08-02"],
    ["2026年12月30日～1月2日", "2026-12-30", "2027-01-02"],
    ["Date 28, 29 November 2026 (Sat & Sun)", "2026-11-28", "2026-11-29"],
    ["SJ60 MUSUBI FESTIVAL (28 & 29 November 2026)", "2026-11-28", "2026-11-29"],
    ["Dates: December 25 & 26, 2026 Time: TBC", "2026-12-25", "2026-12-26"],
    ["Only from 30 September to 1 November 2026!", "2026-09-30", "2026-11-01"],
    ["Dates: September 30 – November 1, 2026", "2026-09-30", "2026-11-01"],
    ["Dates March 27 [Sat] - March 28 [Sun] 2027", "2027-03-27", "2027-03-28"],
    ["Friday 26 – Sunday 28 February 2027", "2027-02-26", "2027-02-28"],
    ["Date: 25 (Fri) – 26 (Sat) December 2026", "2026-12-25", "2026-12-26"],
    ["9-10 May (Sat & Sun) 2026", "2026-05-09", "2026-05-10"],
    ["November 12 (Fri) · 13 (Sat) · 14 (Sun), 2027", "2027-11-12", "2027-11-14"],
    ["NOV 12–14, 2027", "2027-11-12", "2027-11-14"],
    ["2027.11.12–14", "2027-11-12", "2027-11-14"],
    ["30 December 2026 – 2 January 2027", "2026-12-30", "2027-01-02"],
    ["30 December – 2 January 2027", "2026-12-30", "2027-01-02"],
    ["Join us on 02-04 October 2026 at SMX", "2026-10-02", "2026-10-04"],
    ["Dates - 4 December 2026: Ultimate Preview Night 5pm - 9pm 5 - 6 December 2026 Venue", "2026-12-04", "2026-12-06"],
    ["10.30am - 8pm on 5 December 2026", "2026-12-05", null],
    ['"startDate": "2026-09-30T10:00:00+08:00"\n"endDate": "2026-11-01T19:00:00+08:00"', "2026-09-30", "2026-11-01"],
    ["Comic Fiesta 2025 ⬢ 20-21 December", "2025-12-20", "2025-12-21"],
  ];
  for (const [evidence, startsOn, endsOn] of yes)
    assert.equal(events.verbatimDateEvidence(evidence, { startsOn, endsOn }), true, `${evidence} => ${startsOn}..${endsOn}`);
});

test("verbatimDateEvidence rejects missing years, other months, mismatched ranges and guesses", () => {
  const no = [
    ["Dec 29–31", "2026-12-29", "2026-12-31", "year absent"],
    ["29-31 December", "2026-12-29", "2026-12-31", "year absent"],
    ["Comiket 2025: Dec 29–31", "2026-12-29", "2026-12-31", "nearest year differs"],
    [`Dec 29–31 ${"x".repeat(250)} 2026`, "2026-12-29", "2026-12-31", "year too far away"],
    ["Comic Fiesta 2025 ⬢ 20-21 December ⬢ Kuala Lumpur Convention Centre — Comic Fiesta 2026 is pleased", "2026-12-20", "2026-12-21", "stale title year"],
    ["27-29 November 2026", "2026-12-27", "2026-12-29", "different month"],
    ["27-29 November 2026", "2026-11-27", "2026-11-30", "range end differs"],
    ["27-29 November 2026", "2026-11-28", "2026-11-29", "partial range"],
    ["27-29 November 2026", "2026-11-27", null, "single day claimed for a range"],
    ["27-29 November 2025", "2026-11-27", "2026-11-29", "different year"],
    ["開催日 ２０２６年１２月２９日（水）～３１日（木）", "2026-12-29", "2026-12-31", "weekday contradicts date"],
    ["Date 28, 29 November 2026 (Sun & Mon)", "2026-11-28", "2026-11-29", "weekday contradicts date"],
    ["2026年7月31日・8月2日", "2026-07-31", "2026-08-02", "gap in listed days"],
    ["Registration 10 Aug 2026 – 23 Aug 2026. Event 29–31 Dec 2026", "2026-08-10", "2026-12-31", "unrelated ranges"],
    ['"startDate": "2026-09-30T10:00:00+08:00"', "2026-09-30", "2026-11-01", "no endDate member"],
    ["Dec 30 – Jan 2 (Comiket 2026)", "2026-12-30", "2027-01-02", "ambiguous year-less year crossing"],
    ["until September 16th!", "2026-09-16", null, "year absent"],
    ["AFA 12/12/2026", "2026-12-12", null, "ambiguous numeric date"],
    ["from 10.30 to 20.00", "2026-10-30", null, "times are not dates"],
    ["November 2026", "2026-11-01", "2026-11-30", "month precision only"],
    ["", "2026-12-29", null, "empty evidence"],
    ["27-29 November 2026", "2026-11-31", null, "invalid claim"],
    ["27-29 November 2026", "2026-11-29", "2026-11-27", "reversed claim"],
    ["27-29 November 2026", "27 November 2026", null, "claim not ISO"],
  ];
  for (const [evidence, startsOn, endsOn, why] of no)
    assert.equal(events.verbatimDateEvidence(evidence, { startsOn, endsOn }), false, `${why}: ${evidence.slice(0, 60)}`);
  assert.equal(events.verbatimDateEvidence(null, { startsOn: "2026-12-29" }), false);
});

// ---------------------------------------------------------------------------------------------
// Page reader
// ---------------------------------------------------------------------------------------------

test("json-ld page: Event candidates carry the exact JSON members as evidence", async () => {
  const d = descriptor("world-cosplay-summit");
  const html = text("events", "wcs-home.html");
  const calls = [];
  const read = await events.readEventPage(d, d.pages[0], eventHttp(d, [exact("https://worldcosplaysummit.jp/", "wcs-home.html", { type: "text/html" })], calls), {}, { now: NOW });
  assert.equal(read.status, "ok");
  assert.equal(calls.length, 1);
  assert.equal(read.structured.length, 1);
  const [c] = read.structured;
  assert.equal(c.name, "世界コスプレサミット2026");
  assert.deepEqual([c.startsOn, c.endsOn, c.datePrecision, c.city], ["2026-07-31", "2026-08-02", "day", "名古屋市"]);
  assert.equal(c.evidence.method, "json-ld");
  assert.equal(c.evidence.sourceUrl, "https://worldcosplaysummit.jp/");
  for (const line of c.evidence.text.split("\n")) assert.ok(html.includes(line), `evidence line not verbatim: ${line}`);
  assert.ok(events.verbatimDateEvidence(c.evidence.text, c));
  assert.match(read.pageHash, /^[0-9a-f]{64}$/);
});

test("json-ld dates: offsets resolve in the event timezone and missing parts are never guessed", () => {
  const block = (node) => `<html><body><script type="application/ld+json">${JSON.stringify(node)}</script></body></html>`;
  const [sgt] = events.jsonLdEvents(block({ "@type": "Festival", name: "A &amp; B", startDate: "2026-11-27T02:00:00Z", endDate: "2026-11-29T10:00:00Z", location: { name: "Suntec", address: { addressLocality: "Singapore" } } }), { sourceUrl: "https://example.invalid/", timezone: "Asia/Singapore" });
  assert.deepEqual([sgt.name, sgt.startsOn, sgt.endsOn, sgt.datePrecision, sgt.startDateTime], ["A & B", "2026-11-27", "2026-11-29", "datetime", "2026-11-27T02:00:00.000Z"]);
  assert.ok(events.verbatimDateEvidence(sgt.evidence.text, sgt));
  const [shifted] = events.jsonLdEvents(block({ "@type": "Event", name: "late", startDate: "2026-11-26T20:00:00Z" }), { sourceUrl: "https://example.invalid/", timezone: "Asia/Singapore" });
  assert.equal(shifted.startsOn, "2026-11-27", "local day in Singapore");
  assert.equal(events.verbatimDateEvidence(shifted.evidence.text, shifted), false, "converted day is not written in the evidence, so it stays TBC");
  const [month] = events.jsonLdEvents(block({ "@type": "Event", name: "tba", startDate: "2027-07" }), { sourceUrl: "https://example.invalid/" });
  assert.deepEqual([month.startsOn, month.datePrecision], [null, "month"]);
  assert.deepEqual(events.jsonLdEvents(block({ "@type": "Product", name: "x", startDate: "2026-01-01" }), { sourceUrl: "https://example.invalid/" }), []);
  assert.deepEqual(events.jsonLdEvents('<script type="application/ld+json">{not json</script>', { sourceUrl: "https://example.invalid/" }), []);
  assert.deepEqual(events.localDateOf("2026-02-30", "Asia/Singapore"), { date: null, precision: null });
});

test("wp-json + htmlUrl: modified_gmt gates the homepage read; unchanged text is not_modified", async () => {
  const d = descriptor("afa-singapore");
  const page = d.pages[0];
  const routes = [
    exact(page.url, "afa-wp-page-2729.json", { type: JSONT }),
    exact("https://animefestival.asia/", "afa-home.html", { type: HTML }),
  ];
  const calls = [];
  const first = await events.readEventPage(d, page, eventHttp(d, routes, calls), {}, { now: NOW });
  assert.equal(first.status, "ok");
  assert.equal(first.modified, "2026-08-26T12:50:34Z");
  assert.deepEqual(calls.map((c) => c.url), [page.url, "https://animefestival.asia/"]);
  assert.deepEqual(first.structured, []);
  assertExcerpts(first, events.mainText(text("events", "afa-home.html")));
  assert.ok(first.textExcerpts.some((e) => e.sourceUrl === "https://animefestival.asia/" && events.verbatimDateEvidence(e.text, { startsOn: "2026-11-27", endsOn: "2026-11-29" })));

  const again = [];
  const second = await events.readEventPage(d, page, eventHttp(d, routes, again), { modified: first.modified, pageHash: first.pageHash }, { now: NOW });
  assert.equal(second.status, "not_modified");
  assert.equal(again.length, 1, "no homepage request when modified_gmt is unchanged");
  assert.equal(second.pageHash, first.pageHash);

  const touched = [];
  const third = await events.readEventPage(d, page, eventHttp(d, routes, touched), { modified: "2026-01-01T00:00:00Z", pageHash: first.pageHash }, { now: NOW });
  assert.equal(third.status, "not_modified", "modified changed but the cleaned text did not");
  assert.equal(third.modified, "2026-08-26T12:50:34Z");
  assert.equal(touched.length, 2);
});

test("wp-json content: excerpts come from rendered post/page content with their own links", async () => {
  const doujin = descriptor("doujin-market");
  const read = await events.readEventPage(doujin, doujin.pages[0], eventHttp(doujin, [exact(doujin.pages[0].url, "doujima-wp-pages.json", { type: JSONT })]), {}, { now: NOW });
  assert.equal(read.status, "ok");
  assert.equal(read.modified, "2026-07-11T07:32:04Z");
  const pages = JSON.parse(text("events", "doujima-wp-pages.json"));
  const rendered = pages.map((p) => events.renderText(`<h1>${p.title.rendered}</h1>${p.content.rendered}`)).join("\n");
  assertExcerpts(read, rendered);
  const faq = read.textExcerpts.find((e) => e.sourceUrl === "https://neotokyoproject.com/doujima/event-faq/");
  assert.ok(faq && events.verbatimDateEvidence(faq.text, { startsOn: "2026-05-09", endsOn: "2026-05-10" }), "past 2026 edition is quoted, never shifted");
  assert.ok(!read.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-12-12", endsOn: "2026-12-13" })), "Doumini listing dates are not on the official site");

  const mania = descriptor("cosplay-mania");
  const post = await events.readEventPage(mania, mania.pages[0], eventHttp(mania, [exact(mania.pages[0].url, "cosplayph-wp-post-35319.json", { type: JSONT })]), {}, { now: NOW });
  assert.equal(post.status, "ok");
  assert.equal(post.modified, "2026-09-01T02:12:01Z");
  assertExcerpts(post);
  assert.ok(post.textExcerpts.every((e) => e.sourceUrl === "https://cosplay.ph/cosplay-mania-2026-exhibit-booth-slots-now-open/"));
  assert.ok(post.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-10-02", endsOn: "2026-10-04" })));
});

test("html page: ETag 304, unchanged pageHash and changed text are told apart", async () => {
  const d = descriptor("singapore-comic-con");
  const url = d.pages[0].url;
  const etag = 'W/"60a06a634accf15378ad1f69b5068c95"';
  const html = text("events", "sgcc-home.html");
  const ok = exact(url, "sgcc-home.html", { type: HTML, headers: { etag } });
  const first = await events.readEventPage(d, d.pages[0], eventHttp(d, [ok]), {}, { now: NOW });
  assert.equal(first.status, "ok");
  assert.equal(first.etag, etag);
  assertExcerpts(first, events.mainText(html));
  assert.ok(first.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-12-04", endsOn: "2026-12-06" })));

  const calls = [];
  const notModified = { match: (href, o) => href === url && o.headers["if-none-match"] === etag, status: 304, body: "", headers: { etag } };
  const second = await events.readEventPage(d, d.pages[0], eventHttp(d, [notModified, ok], calls), { etag, pageHash: first.pageHash }, { now: NOW });
  assert.equal(second.status, "not_modified");
  assert.equal(calls[0].headers["if-none-match"], etag);
  assert.equal(second.pageHash, first.pageHash);

  const ignoresConditional = exact(url, "sgcc-home.html", { type: HTML });
  const third = await events.readEventPage(d, d.pages[0], eventHttp(d, [ignoresConditional]), { etag: 'W/"stale"', pageHash: first.pageHash }, { now: NOW });
  assert.equal(third.status, "not_modified", "same cleaned text");

  const moved = html.replace("5 - 6 December 2026", "6 - 7 December 2026");
  assert.notEqual(moved, html);
  const fourth = await events.readEventPage(d, d.pages[0], eventHttp(d, [{ match: (href) => href === url, body: moved, type: HTML }]), { etag: 'W/"stale"', pageHash: first.pageHash }, { now: NOW });
  assert.equal(fourth.status, "ok");
  assert.notEqual(fourth.pageHash, first.pageHash);
  assert.ok(fourth.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-12-06", endsOn: "2026-12-07" })));
  assert.ok(!fourth.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-12-05", endsOn: "2026-12-06" })));
});

test("html page: Last-Modified conditional read", async () => {
  const d = descriptor("sj60-musubi-festival");
  const url = d.pages[0].url;
  const lastModified = "Thu, 10 Sep 2026 00:44:09 GMT";
  const calls = [];
  const routes = [
    { match: (href, o) => href === url && o.headers["if-modified-since"] === lastModified, status: 304, body: "" },
    exact(url, "sj60-home.html", { type: "text/html", headers: { "last-modified": lastModified, etag: '"6aa1fd59-3868"' } }),
  ];
  const first = await events.readEventPage(d, d.pages[0], eventHttp(d, routes, calls), {}, { now: NOW });
  assert.equal(first.status, "ok");
  assert.deepEqual([first.lastModified, first.etag], [lastModified, '"6aa1fd59-3868"']);
  assert.ok(first.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2026-11-28", endsOn: "2026-11-29" })));
  const second = await events.readEventPage(d, d.pages[0], eventHttp(d, routes, calls), first, { now: NOW });
  assert.equal(second.status, "not_modified");
  assert.equal(calls[1].headers["if-modified-since"], lastModified);
});

test("Japanese page: ISO-2022-JP is decoded and full-width dates are quoted verbatim", async () => {
  const d = descriptor("comiket");
  const read = await events.readEventPage(d, d.pages[0], eventHttp(d, [exact(d.pages[0].url, "comiket-c109-info.iso2022jp.html", { type: "text/html; charset=iso-2022-jp" })]), {}, { now: NOW });
  assert.equal(read.status, "ok");
  const page = events.mainText(new TextDecoder("iso-2022-jp").decode(raw("events", "comiket-c109-info.iso2022jp.html")));
  assertExcerpts(read, page);
  const hit = read.textExcerpts.find((e) => e.text.includes("開催日 ２０２６年１２月２９日（火）～３１日（木）"));
  assert.ok(hit, "C109 dates quoted");
  assert.ok(events.verbatimDateEvidence(hit.text, { startsOn: "2026-12-29", endsOn: "2026-12-31" }));
  const expressions = events.findDateExpressions(page).filter((e) => !e.monthOnly);
  assert.ok(expressions.some((e) => e.startsOn === "2026-08-10" && e.endsOn === "2026-08-23" && e.explicitYear));
  const scout = await events.fetchPageText(eventHttp(d, [exact(d.pages[0].url, "comiket-c109-info.iso2022jp.html", { type: "text/html; charset=iso-2022-jp" })]), d.pages[0].url);
  assert.ok(scout.text.includes("２０２６年１２月２９日（火）～３１日（木）"));
  assert.ok(scout.mainText.length > 0 && scout.text.length >= scout.mainText.length);
});

test("English excerpts: weekday brackets, mixed EN/JA/Thai text and emoji stay intact", async () => {
  const aj = descriptor("animejapan");
  const read = await events.readEventPage(aj, aj.pages[0], eventHttp(aj, [exact(aj.pages[0].url, "animejapan-about-en.html", { type: "text/html" })]), {}, { now: NOW });
  assertExcerpts(read, events.mainText(text("events", "animejapan-about-en.html")));
  assert.ok(read.textExcerpts.some((e) => events.verbatimDateEvidence(e.text, { startsOn: "2027-03-27", endsOn: "2027-03-28" })));

  const jet = descriptor("japan-expo-thailand");
  const routes = [exact(jet.pages[0].url, "jet-wp-page-820.json", { type: JSONT }), exact(jet.pages[0].htmlUrl, "jet-how-to-exhibit.html", { type: HTML })];
  const expo = await events.readEventPage(jet, jet.pages[0], eventHttp(jet, routes), {}, { now: NOW });
  assertExcerpts(expo, events.mainText(text("events", "jet-how-to-exhibit.html")));
  assert.ok(expo.textExcerpts.some((e) => e.text.includes("2027年2月26日(金)〜2月28日(日)") && events.verbatimDateEvidence(e.text, { startsOn: "2027-02-26", endsOn: "2027-02-28" })));

  const long = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}: ${i + 1} December 2026 🎟️ ${"filler words ".repeat(40)}`).join(" ");
  const bounded = events.dateExcerpts(long, { sourceUrl: "https://example.invalid/", now: NOW });
  assert.equal(bounded.length, 6);
  for (const e of bounded) assert.ok(e.text.length <= 600 && long.includes(e.text) && !hasLoneSurrogate(e.text));
  assert.deepEqual(events.dateExcerpts("Doujin Market 2024 was held 11-12 May 2024.", { now: NOW }), [], "past-only windows are dropped");
});

test("stale titles are not page text; restricted hosts and unknown page kinds are refused", async () => {
  const cf = descriptor("comic-fiesta");
  const read = await events.readEventPage(cf, cf.pages[0], eventHttp(cf, [exact(cf.pages[0].url, "comicfiesta-cf26.html", { type: HTML })]), {}, { now: NOW });
  assert.equal(read.status, "ok");
  assert.deepEqual([read.structured, read.textExcerpts], [[], []]);
  assert.ok(text("events", "comicfiesta-cf26.html").includes("Comic Fiesta 2025 ⬢ 20-21 December"), "the stale title is in the raw page");

  const fever = descriptor("apothecary-diaries-exhibition-sg");
  const noNetwork = eventHttp(fever, []);
  await rejects(events.readEventPage(fever, { url: "https://feverup.com/m/700676", kind: "html" }, noNetwork, {}), "source_host_denied");
  const sgcc = descriptor("singapore-comic-con");
  await rejects(events.readEventPage(sgcc, { url: "https://www.singaporecomiccon.com/", kind: "probe" }, eventHttp(sgcc, []), {}), "unsupported_page_kind");
  await rejects(events.readEventPage(sgcc, { url: "https://acgevents.sg/api/events", kind: "html" }, eventHttp(sgcc, []), {}), "source_host_denied");
});

// ---------------------------------------------------------------------------------------------
// Next-edition probes
// ---------------------------------------------------------------------------------------------

test("probeNextEdition: one GET per predictable URL, 404 means not yet, 200 means announced", async () => {
  const comiket = descriptor("comiket");
  assert.equal(events.nextEditionUrl(comiket).url, "https://www.comiket.co.jp/info-a/C110/C110Info.html");
  const calls = [];
  const c110 = await events.probeNextEdition(comiket, eventHttp(comiket, [exact("https://www.comiket.co.jp/info-a/C110/C110Info.html", "comiket-c110-404.html", { status: 404, type: "text/html; charset=iso-8859-1" })], calls));
  assert.deepEqual([c110.exists, c110.edition, calls.length], [false, "C110", 1]);

  const afa = descriptor("afa-singapore");
  const next = "https://animefestival.asia/afasg27/wp-json/wp/v2/pages?per_page=1&_fields=id,link";
  const afasg27 = await events.probeNextEdition(afa, eventHttp(afa, [exact(next, "afasg27-probe-404.html", { status: 404, type: HTML })]));
  assert.deepEqual([afasg27.exists, afasg27.edition, afasg27.pageUrl], [false, "afasg27", "https://animefestival.asia/afasg27/"]);
  const lastYear = { ...afa, edition: { ...afa.edition, current: 25 } };
  const announced = await events.probeNextEdition(lastYear, eventHttp(afa, [exact("https://animefestival.asia/afasg26/wp-json/wp/v2/pages?per_page=1&_fields=id,link", "afasg26-probe.json", { type: JSONT })]));
  assert.equal(announced.exists, true);
  const empty = await events.probeNextEdition(lastYear, eventHttp(afa, [{ match: () => true, body: "[]", type: JSONT }]));
  assert.equal(empty.exists, false, "an empty WordPress page list is not an edition");

  assert.equal(events.nextEditionUrl(descriptor("comic-fiesta")).url, "https://comicfiesta.org/cf27");
  assert.equal(events.nextEditionUrl(descriptor("eoy-festival")).url, "https://www.theeoy.com/eoy/eoy-booth-2027/");
  await rejects(events.probeNextEdition(descriptor("singapore-comic-con"), eventHttp(descriptor("singapore-comic-con"), [])), "no_edition_pattern");
  await rejects(events.probeNextEdition(comiket, eventHttp(comiket, [{ match: () => true, status: 403, body: "" }])), "blocked");
});

// ---------------------------------------------------------------------------------------------
// Shoot spots
// ---------------------------------------------------------------------------------------------

test("shoot-spot pool: bounded verbatim facts, canonical suggestions, official hosts", () => {
  const excerpts = JSON.parse(text("shootspots", "official-excerpts.json"));
  const ids = new Set();
  for (const spot of SHOOT_SPOTS) {
    assert.ok(!ids.has(spot.id));
    ids.add(spot.id);
    for (const url of [spot.officialUrl, spot.permit.sourceUrl, spot.status.sourceUrl, spot.rulesSourceUrl]) {
      assert.equal(new URL(url).protocol, "https:");
      assert.ok(spots.SHOOT_SPOT_HOSTS.includes(new URL(url).hostname));
    }
    assert.ok(spot.permit.summary.length <= 300 && spot.permit.quote.length <= 300);
    assert.ok(spot.rules.length >= 1 && spot.rules.every((r) => typeof r === "string" && r.length <= 300));
    assert.ok(["open", "partly_closed"].includes(spot.status.state));
    assert.match(spot.idea, /^idea: /);
    assert.ok(spot.idea.length <= 160, `${spot.id} idea too long`);
    assert.ok(spot.goodFor.length && spot.goodFor.every((t) => Object.hasOwn(CHARACTER_ALIASES, t) || Object.hasOwn(FANDOM_ALIASES, t)), `${spot.id} goodFor`);
    for (const at of [spot.verifiedAt, spot.permit.verifiedAt, spot.status.verifiedAt]) assert.ok(Number.isFinite(Date.parse(at)));
    const quoted = (url, quote) => (excerpts[url]?.windows ?? []).some((w) => w.includes(quote));
    assert.ok(quoted(spot.permit.sourceUrl, spot.permit.quote), `${spot.id} permit quote`);
    assert.ok(quoted(spot.status.sourceUrl, spot.status.quote), `${spot.id} status quote`);
    for (const rule of spot.rules) assert.ok(quoted(spot.rulesSourceUrl, rule), `${spot.id} rule: ${rule}`);
  }
  assert.deepEqual(spots.SHOOT_SPOT_HOSTS, ["juronglakegardens.nparks.gov.sg", "sbg.nparks.gov.sg", "www.gardensbythebay.com.sg", "www.nparks.gov.sg", "www.pub.gov.sg"]);
});

test("shootspots adapter: valid page contract, no network, credited official guidance", async () => {
  const calls = [];
  const { page, items, entry } = await runAdapterPage(spots.shootSpots, { routes: [], day: "2026-09-15", calls });
  assert.deepEqual([page.done, page.cursor, items.length, calls.length], [true, null, 1, 0]);
  assert.equal(entry.cacheSeconds, 7 * 86400);
  const [item] = items;
  const spot = SHOOT_SPOTS.find((s) => s.id === item.nativeId);
  assert.deepEqual([item.source, item.kind, item.sections, item.url, item.media], ["shootspots", "spot", ["dressup"], spot.officialUrl, []]);
  assert.deepEqual([item.credit.name, item.credit.platform], [spot.organisation, "official guidance"]);
  assert.equal(item.facts.excerpts[0], spot.permit.quote);
  assert.ok(item.facts.excerpts.length <= 3);
  assert.ok(item.facts.links.length >= 1 && item.facts.links.every((l) => l.kind === "source" && spots.SHOOT_SPOT_HOSTS.includes(new URL(l.url).hostname)));
  assert.ok(item.tags.formats.includes("photoshoot"));
  for (const s of SHOOT_SPOTS) assert.equal(sourceVerdict(validateAdapterItem(spots.spotItem(s), entry)), null, `${s.id} passes source rules`);
  const none = await spots.shootSpots.fetch({ day: "2026-09-15", limits: { items: 0 } });
  assert.deepEqual(none, { items: [], cursor: null, done: true });
});

test("shootspots rotation: one spot per Singapore week, every spot in turn, stale pool fails loudly", async () => {
  const monday = "2026-09-14";
  const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
  assert.ok(week.every((day) => spots.spotForDay(day).id === spots.spotForDay(monday).id));
  assert.notEqual(spots.spotForDay("2026-09-21").id, spots.spotForDay("2026-09-20").id);
  assert.equal(spots.weekIndex("2026-09-21") - spots.weekIndex("2026-09-20"), 1);
  const seen = [];
  for (let w = 0; w < SHOOT_SPOTS.length; w++) {
    const day = new Date(Date.UTC(2026, 8, 14 + 7 * w)).toISOString().slice(0, 10);
    seen.push(spots.spotForDay(day).id);
  }
  assert.deepEqual([...seen].sort(), SHOOT_SPOTS.map((s) => s.id).sort(), "each spot once per cycle");
  const stale = new Date(Date.parse("2026-09-15") + (spots.STALE_AFTER_DAYS + 2) * 86400000).toISOString().slice(0, 10);
  await rejects(spots.shootSpots.fetch({ day: stale, limits: { items: 8 } }), "source_stale");
  const closed = SHOOT_SPOTS.map((s, i) => (i === 0 ? { ...s, status: { ...s.status, state: "closed" } } : s));
  assert.ok(!spots.servableSpots("2026-09-15", closed).some((s) => s.id === SHOOT_SPOTS[0].id));
});

// ---------------------------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------------------------

function lexiconHttp(routes, calls = []) {
  return sourceHttp({ ...lexicon.lexiconSourceEntry, paceMs: 0 }, {
    deadline: Date.now() + 30_000,
    stats: {},
    send: fixtureTransport("lexicon", routes, calls),
    lookup: publicLookup,
  });
}
const LEXICON_ROUTES = [
  { match: /^https:\/\/en\.wiktionary\.org\/w\/api\.php\?action=query&list=categorymembers&cmtitle=Category%3AEnglish%20internet%20slang&cmsort=timestamp&cmdir=desc&cmend=2026-09-08T00%3A00%3A00Z&/, file: "wiktionary-members.json", type: "application/json; charset=utf-8" },
  { match: /^https:\/\/en\.wiktionary\.org\/w\/api\.php\?action=query&prop=categories&titles=/, file: "wiktionary-categories.json", type: "application/json; charset=utf-8" },
  { match: /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?action=query&prop=revisions&titles=Glossary_of_2020s_slang&.*rvend=2026-09-08T00%3A00%3A00Z/, file: "wikipedia-revisions.json", type: "application/json; charset=utf-8" },
  { match: /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?action=compare&fromrev=1373782042&torev=1374949280&/, file: "wikipedia-compare.json", type: "application/json; charset=utf-8" },
  { match: /^https:\/\/danbooru\.donmai\.us\/tags\.json\?search%5Bname_matches%5D=\*_\(meme\)&search%5Border%5D=date&limit=40&/, file: "danbooru-meme-tags.json", type: "application/json; charset=utf-8" },
];

test("lexicon candidates: bounded requests to three exact hosts, labelled Wiktionary entries", async () => {
  const calls = [];
  const { terms, errors } = await lexicon.fetchLexiconCandidates(lexiconHttp(LEXICON_ROUTES, calls), { since: "2026-09-08" });
  assert.deepEqual(errors, []);
  assert.equal(calls.length, 5);
  assert.ok(calls.every((c) => lexicon.lexiconSourceEntry.hosts.includes(new URL(c.url).hostname)));
  assert.ok(calls.filter((c) => /wiki/.test(new URL(c.url).hostname)).every((c) => c.url.includes("maxlag=5")));
  const by = (source) => terms.filter((t) => t.source === source);
  // 20 recorded Danbooru tags; one has post_count 0 and is skipped.
  assert.deepEqual([by("wiktionary").length, by("wikipedia").length, by("danbooru").length], [17, 5, 19]);
  assert.ok(!terms.some((t) => t.term === "showing my dog places she has never seen"));
  assert.deepEqual(by("wikipedia").map((t) => t.term), ["in the big [...]", "Kirkination", "neuron activation", "one, two, buckle my shoe", "son"]);
  assert.deepEqual(terms.find((t) => t.term === "kirk").labels, ["English eponyms"]);
  assert.equal(terms.find((t) => t.term === "ok boomer").sourceUrl, "https://danbooru.donmai.us/wiki_pages/ok_boomer_(meme)");
  for (const t of terms) {
    assert.ok(Number.isFinite(Date.parse(t.addedAt)), t.term);
    assert.ok(lexicon.lexiconSourceEntry.hosts.includes(new URL(t.sourceUrl).hostname));
  }
  const later = await lexicon.fetchLexiconCandidates(lexiconHttp(LEXICON_ROUTES), { since: "2026-09-12", sources: ["danbooru"] });
  // created_at carries a -04:00 offset: "healing eyes" (2026-09-11T20:06:38-04:00) is after 2026-09-12T00:00Z.
  assert.deepEqual(later.terms.map((t) => t.term), ["pooh shiesty money spread", "evil x be like", "korra the milk bender", "there's two of me", "there is no queen of england", "shin dragon shine spark pose", "ok boomer", "who's getting the best head", "healing eyes"]);
});

test("filterLexiconTerms removes crude, political, labelled, real-people and malformed candidates", async () => {
  const { terms } = await lexicon.fetchLexiconCandidates(lexiconHttp(LEXICON_ROUTES), { since: "2026-09-08" });
  const kept = lexicon.filterLexiconTerms(terms).map((t) => t.term);
  for (const blocked of ["fuck it we ball", "gooning", "kirk", "Kirkmas", "kirkentine", "Kirkination", "zoophilia", "yams", "Place, Japan", "in the big [...]", "who's getting the best head", "wesley snipes crying", "gun and ball gaming", "sonya strangling yasuna", "cat playing banjo in the middle of the night", "pooh shiesty money spread", "imbrandonfarris milk explosion"])
    assert.ok(!kept.includes(blocked), `kept ${blocked}`);
  assert.deepEqual(kept, ["DWAI", "Tok", "post through it", "nose ring theory", "neuron activation", "one, two, buckle my shoe", "son", "evil x be like", "korra the milk bender", "there's two of me", "shin dragon shine spark pose", "ok boomer", "healing eyes", "aya's tamagokake gohan", "remember me?", "i like it in here"]);

  const reason = (term, labels) => lexicon.lexiconBlockReason({ term, labels });
  assert.equal(reason("skibidi era"), "banned_joke");
  assert.equal(reason("election arc"), "politics");
  assert.equal(reason("drama llama"), "bad_text");
  assert.equal(reason("gen z 2026"), "digits");
  assert.equal(reason("see brainrot.com"), "url");
  assert.equal(reason("me when the the the the the"), "too_long");
  assert.equal(reason("x"), "too_short");
  assert.equal(reason("Fr*nch"), "characters");
  assert.equal(reason("unbothered", ["Category:English vulgarities"]), "blocked_label");
  assert.equal(reason("wanker energy"), "crude");
  assert.equal(reason("thicc era"), "crude");
  assert.equal(reason("Charlie Kirk"), "real_person");
  assert.equal(reason("karen moment"), "real_person");
  assert.equal(reason("elon"), "real_person");
  assert.equal(reason("classy"), null, "stems need a word start");
  assert.equal(reason("peacock era"), null);
  assert.equal(reason("delulu"), null);
  const deduped = lexicon.filterLexiconTerms([{ term: "Delulu", source: "wiktionary" }, { term: "delulu", source: "wikipedia" }, null, { term: 7 }, { term: "  aura   farming " }]);
  assert.deepEqual(deduped.map((t) => t.term), ["Delulu", "aura farming"]);
});

test("lexicon failures are isolated; unlabelled Wiktionary terms are dropped, not passed through", async () => {
  const routes = [LEXICON_ROUTES[0], { match: LEXICON_ROUTES[1].match, status: 503, body: "", headers: { "retry-after": "0" } }, ...LEXICON_ROUTES.slice(2)];
  const { terms, errors } = await lexicon.fetchLexiconCandidates(lexiconHttp(routes), { since: "2026-09-08" });
  assert.deepEqual(errors, [{ source: "wiktionary", code: "source_http_503" }]);
  assert.ok(!terms.some((t) => t.source === "wiktionary"));
  assert.ok(terms.some((t) => t.source === "wikipedia") && terms.some((t) => t.source === "danbooru"));

  const maxlag = [{ match: /en\.wiktionary\.org/, body: { error: { code: "maxlag", info: "Waiting for a database server" } }, type: "application/json" }, ...LEXICON_ROUTES.slice(2)];
  const lagged = await lexicon.fetchLexiconCandidates(lexiconHttp(maxlag), { since: "2026-09-08", sources: ["wiktionary"] });
  assert.deepEqual(lagged, { terms: [], errors: [{ source: "wiktionary", code: "mediawiki_maxlag" }] });

  const none = await lexicon.fetchLexiconCandidates(lexiconHttp([{ match: /wikipedia/, body: { query: { pages: [{ title: "Glossary of 2020s slang", revisions: [] }] } } }]), { since: "2026-09-15", sources: ["wikipedia"] });
  assert.deepEqual(none, { terms: [], errors: [] }, "no revisions means no compare request");
});

test("glossary diff parsing keeps new definition-list terms only", () => {
  assert.deepEqual(lexicon.glossaryLineTerms(";[[Bro culture|bruh/bru]] ({{IPAc-en|b|ɹ|ʌ|audio=En-us-bruh-noun.ogg}})"), ["bruh", "bru"]);
  assert.deepEqual(lexicon.glossaryLineTerms(";'''brochacho/broski'''"), ["brochacho", "broski"]);
  assert.deepEqual(lexicon.glossaryLineTerms(";{{anchor|aura}}aura<ref>{{cite web|url=https://example.invalid}}</ref>"), ["aura"]);
  assert.deepEqual(lexicon.glossaryLineTerms(";[[brain rot]] (or brainrot)"), ["brain rot"]);
  assert.deepEqual(lexicon.glossaryLineTerms(":A variant of \"bro\"."), []);
  const body = JSON.parse(text("lexicon", "wikipedia-compare.json")).compare.body;
  const found = lexicon.glossaryDiffTerms(body);
  assert.ok(!found.includes("brochacho") && !found.includes("jit") && !found.includes("mog"), "reformatted or deleted terms are not new");
  assert.deepEqual(found, ["in the big [...]", "Kirkination", "neuron activation", "one, two, buckle my shoe", "son"]);
  const policy = lexicon.lexiconSourceEntry;
  assert.deepEqual(policy.hosts, ["en.wiktionary.org", "en.wikipedia.org", "danbooru.donmai.us"]);
  assert.ok(policy.maxRequests >= 5 && policy.maxBytes <= 2 * 1024 * 1024 && policy.paceMs >= 1000);
});
