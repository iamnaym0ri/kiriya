// The phase 6 events engine (docs/refactor/PLAN.md §6, docs/refactor/EVENTS-API.md): polite crawling,
// change detection, Claude triage and investigation, the spend ceiling, pushes, weather, Instagram
// and newsletters. No network: every response is recorded or faked, Claude included.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "../server/db/schema.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "ANTHROPIC_API_KEY", "APIFY_TOKEN", "GMAIL_CLIENT_ID", "LTA_DATAMALL_KEY", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "APNS_KEY", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "EVENTS_PUSH_AUDIENCE", "EVENTS_CLAUDE_CEILING_USD", "CRON_SECRET"])
  process.env[name] = "";
process.env.EVENTS_FIXTURES = "0";
globalThis.fetch = () => {
  throw new Error("External network is disabled in these tests");
};

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (...p) => readFileSync(path.join(here, "fixtures", ...p), "utf8");
const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: path.join(here, "../server/db/migrations") });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });

const robots = await import("../server/lib/events/robots.js");
const registry = await import("../server/lib/events/registry.js");
const { politeFetcher } = await import("../server/lib/events/fetch.js");
const { detect, parseFeed } = await import("../server/lib/events/detect.js");
const { claudeFor } = await import("../server/lib/events/claude.js");
const triage = await import("../server/lib/events/triage.js");
const { investigate, investigationParams } = await import("../server/lib/events/investigate.js");
const pipeline = await import("../server/lib/events/pipeline.js");
const spend = await import("../server/lib/events/spend.js");
const push = await import("../server/lib/events/push.js");
const weather = await import("../server/lib/events/weather.js");
const instagram = await import("../server/lib/events/instagram.js");
const gmail = await import("../server/lib/events/gmail.js");
const store = await import("../server/lib/events/store.js");
const images = await import("../server/lib/events/images.js");
const present = await import("../server/lib/events/present.js");
const dossier = await import("../server/lib/events/dossier.js");
const { setTestMode } = await import("../server/lib/appTestMode.js");
const { checkSources, refreshWeather, tick } = await import("../worker/tick.js");

// A fake web: routes are [matcher, response]; every request is recorded.
function fakeWeb(routes) {
  const calls = [];
  const send = async (url, { method = "GET", headers = {}, body } = {}) => {
    const href = url.href ?? String(url);
    calls.push({ href, method, headers, body });
    const route = routes.find(([m]) => (typeof m === "string" ? m === href : m.test(href)));
    const r = route ? (typeof route[1] === "function" ? route[1]({ href, headers, body }) : route[1]) : { status: 404, type: "text/plain", body: "not found" };
    return { status: r.status ?? 200, headers: { "content-type": r.type ?? "text/html", ...(r.headers ?? {}) }, buffer: Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body ?? "") };
  };
  return { send, calls };
}
const okRobots = (extra = "") => ({ type: "text/plain", body: `User-agent: *\nAllow: /\n${extra}` });
const json = (value, extra = {}) => ({ type: "application/json", body: JSON.stringify(value), ...extra });
const rss = (items) => ({
  type: "application/rss+xml",
  body: `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items.map((i) => `<item><title>${i.title}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>${i.date}</pubDate><description><![CDATA[${i.text}]]></description></item>`).join("")}</channel></rss>`,
});
const NOW = new Date("2026-11-27T04:00:00Z"); // Friday 12:00 in Singapore
// A real (tiny) JPEG header: enough for the picture checks, which read the first bytes.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), Buffer.alloc(64, 7)]);
const jpeg = (n) => Buffer.concat([JPEG, Buffer.from([n])]);
const usage = (input = 1000, output = 100, extra = {}) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...extra });

try {
  await test("robots.txt: groups, longest match, wildcards, and AI opt-outs all count", () => {
    const parsed = robots.parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok$\n\nUser-agent: ClaudeBot\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Bingbot\nCrawl-delay: 5\nDisallow: /*.pdf$");
    assert.equal(robots.isAllowed(parsed, "kiriya-love-events", "/events"), true);
    assert.equal(robots.isAllowed(parsed, "kiriya-love-events", "/private/x"), false);
    assert.equal(robots.isAllowed(parsed, "kiriya-love-events", "/private/ok"), true);
    assert.equal(robots.isAllowed(parsed, "ClaudeBot", "/events"), false);
    assert.equal(robots.isAllowed(parsed, "bingbot/2.0", "/a.pdf"), false);
    assert.equal(robots.isAllowed(parsed, "bingbot", "/a.pdf?x=1"), true);
    // Our verdict needs every Anthropic token to be allowed too.
    assert.match(robots.robotsVerdict({ status: 200, text: "User-agent: ClaudeBot\nDisallow: /" }, "https://x.sg/a").reason, /ClaudeBot/);
    assert.equal(robots.robotsVerdict({ status: 404, text: "" }, "https://x.sg/a").allowed, true);
    assert.equal(robots.robotsVerdict({ status: 403, text: "" }, "https://x.sg/a").allowed, false);
    assert.equal(robots.robotsVerdict({ status: 503, text: "" }, "https://x.sg/a").allowed, false);
    assert.equal(robots.robotsVerdict({ status: 200, text: "User-agent: *\nCrawl-delay: 30" }, "https://x.sg/a").crawlDelay, 30);
  });

  await test("The registry has 40+ Singapore sources, all https, none on a blocked site", () => {
    assert.deepEqual(registry.checkRegistry(), []);
    assert.ok(registry.enabledSources().length >= 40, `only ${registry.enabledSources().length}`);
    for (const url of ["https://www.suntecsingapore.com/visit-events/x", "https://suntecsingapore.com/sitemap.xml", "https://www.singaporeexpo.com.sg/wp-json/wp/v2/event", "https://www.capitaland.com/sg/malls/bugisplus/en/events.html", "https://www.instagram.com/p/abc/"])
      assert.ok(registry.blockedHost(url), url);
    assert.equal(registry.blockedHost("https://geekculture.co/feed/"), null);
  });

  await test("Blocked sites are never requested, not even their robots.txt; robots.txt is read once and obeyed", async () => {
    const web = fakeWeb([
      ["https://www.suntecsingapore.com/robots.txt", okRobots()],
      ["https://good.example.sg/robots.txt", okRobots("User-agent: ClaudeBot\nDisallow: /secret")],
      [/good\.example\.sg\/(page|secret)/, { body: "<html><body>hello</body></html>" }],
    ]);
    const fetcher = politeFetcher({ db, send: web.send });
    await assert.rejects(fetcher.get("https://www.suntecsingapore.com/visit-events/afa"), (e) => e.code === "blocked_host");
    assert.equal(web.calls.length, 0, "nothing was sent to Suntec");
    await assert.rejects(fetcher.get("https://good.example.sg/secret"), (e) => e.code === "robots_denied");
    const page = await fetcher.get("https://good.example.sg/page", { types: ["text/html"], etag: '"v1"' });
    assert.equal(page.status, 200);
    assert.equal(web.calls.filter((c) => c.href.endsWith("/robots.txt")).length, 1, "robots.txt cached");
    const sent = web.calls.at(-1).headers;
    assert.equal(sent["if-none-match"], '"v1"');
    assert.match(sent["user-agent"], /^kiriya-love-events\//);
  });

  await test("Change detection: RSS ids, WordPress modified_gmt, sitemap lastmod, page hash, listing ids, redirects", async () => {
    let feedItems = [{ title: "Sanrio pop-up opens at VivoCity", link: "https://vivocity.example/sanrio", date: "Wed, 25 Nov 2026 02:00:00 GMT", text: "A Sanrio Characters pop-up with limited plush." }, { title: "Year-end sale", link: "https://vivocity.example/sale", date: "Wed, 25 Nov 2026 02:00:00 GMT", text: "Shoes and bags." }, { title: "Old post", link: "https://vivocity.example/old", date: "Mon, 01 Jun 2026 02:00:00 GMT", text: "Pokémon pop-up" }];
    const pages = { sitemap: "", wp: [], page: fixture("feeds/events/sgcc-home.html"), list: "", target: "https://cafe.example.sg/frieren/" };
    const web = fakeWeb([
      [/\/robots\.txt$/, okRobots()],
      ["https://feed.example.sg/feed/", () => rss(feedItems)],
      [/wp-json/, () => json(pages.wp)],
      ["https://venue.example.sg/sitemap.xml", () => ({ type: "application/xml", body: pages.sitemap })],
      ["https://page.example.sg/", ({ headers }) => (headers["if-none-match"] === '"p1"' ? { status: 304 } : { body: pages.page, headers: { etag: '"p1"' } })],
      ["https://list.example.sg/topics/", () => ({ body: pages.list })],
      ["https://cafe.example.sg/", () => ({ status: 302, headers: { location: pages.target } })],
      [/https:\/\/cafe\.example\.sg\/(frieren|miku)\//, { body: "<html><body><h1>collab café</h1><p>Hatsune Miku collab 1 Dec 2026 – 31 Jan 2027</p></body></html>" }],
    ]);
    const fetcher = politeFetcher({ db, send: web.send });
    const now = NOW.getTime();
    const s = (method, url, extra = {}) => ({ id: `t-${method}`, name: `test ${method}`, method, url, every: 60, filter: "none", ...extra });

    const feedSource = s("rss", "https://feed.example.sg/feed/", { filter: "keywords" });
    let r = await detect(feedSource, fetcher, {}, { now });
    assert.deepEqual(r.items.map((i) => i.url), ["https://vivocity.example/sanrio"], "first run: recent + keyword items only");
    feedItems = [{ title: "Hatsune Miku café collab announced", link: "https://vivocity.example/miku", date: "Thu, 26 Nov 2026 02:00:00 GMT", text: "Miku collab menu" }, ...feedItems];
    r = await detect(feedSource, fetcher, r.state, { now });
    assert.deepEqual(r.items.map((i) => i.url), ["https://vivocity.example/miku"]);
    r = await detect(feedSource, fetcher, r.state, { now });
    assert.equal(r.outcome, "unchanged");

    const wpSource = s("wp-json", "https://wp.example.sg/wp-json/wp/v2/pages?orderby=modified");
    pages.wp = [{ id: 1, modified_gmt: "2026-11-20T00:00:00", link: "https://wp.example.sg/a", title: { rendered: "AFA 2026" } }];
    r = await detect(wpSource, fetcher, {}, { now });
    assert.equal(r.items.length, 1);
    r = await detect(wpSource, fetcher, r.state, { now });
    assert.equal(r.items.length, 0, "same modified_gmt");
    pages.wp = [{ id: 1, modified_gmt: "2026-11-26T09:00:00", link: "https://wp.example.sg/a", title: { rendered: "AFA 2026: guests" } }];
    r = await detect(wpSource, fetcher, r.state, { now });
    assert.equal(r.items[0].title, "AFA 2026: guests");

    const mapSource = s("sitemap", "https://venue.example.sg/sitemap.xml", { sitemapFilter: "anime|pokemon" });
    pages.sitemap = `<urlset><url><loc>https://venue.example.sg/whats-on/jujutsu-kaisen-anime-concert</loc><lastmod>2026-11-20</lastmod></url><url><loc>https://venue.example.sg/whats-on/opera</loc><lastmod>2026-11-25</lastmod></url></urlset>`;
    r = await detect(mapSource, fetcher, {}, { now });
    assert.deepEqual(r.items.map((i) => i.url), ["https://venue.example.sg/whats-on/jujutsu-kaisen-anime-concert"]);
    pages.sitemap = pages.sitemap.replace("2026-11-20", "2026-11-26");
    r = await detect(mapSource, fetcher, r.state, { now });
    assert.equal(r.items.length, 1, "a newer lastmod is a change");

    const pageSource = s("page", "https://page.example.sg/");
    r = await detect(pageSource, fetcher, {}, { now });
    assert.equal(r.outcome, "baseline", "first read only remembers the page");
    r = await detect(pageSource, fetcher, r.state, { now });
    assert.equal(r.outcome, "unchanged", "304 Not Modified");
    r = await detect(pageSource, fetcher, { ...r.state, etag: null }, { now });
    assert.equal(r.outcome, "unchanged", "same text hash");
    pages.page = pages.page.replace("Ultimate Preview Night", "Ultimate Preview Night and a new guest");
    r = await detect(pageSource, fetcher, { ...r.state, etag: null }, { now });
    assert.equal(r.outcome, "changed");
    assert.match(r.items[0].excerpt, /December 2026/);

    const listSource = s("listing", "https://list.example.sg/topics/", { listing: { pattern: "/topics/post-(\\d+)", link: "https://list.example.sg/topics/post-{id}" } });
    pages.list = '<a href="/topics/post-10">a</a><a href="/topics/post-11">b</a>';
    r = await detect(listSource, fetcher, {}, { now });
    pages.list = '<a href="/topics/post-12">Pokémon Center pop-up</a>' + pages.list;
    r = await detect(listSource, fetcher, r.state, { now });
    assert.deepEqual(r.items.map((i) => i.url), ["https://list.example.sg/topics/post-12"]);

    const cafe = s("redirect", "https://cafe.example.sg/");
    r = await detect(cafe, fetcher, {}, { now });
    pages.target = "https://cafe.example.sg/miku/";
    r = await detect(cafe, fetcher, r.state, { now });
    assert.equal(r.outcome, "changed");
    assert.equal(r.items[0].url, "https://cafe.example.sg/miku/");
    assert.equal(parseFeed(rss(feedItems).body).length, 4);
  });

  await test("Sources back off when robots.txt says no, and say why in admin", async () => {
    const web = fakeWeb([["https://nope.example.sg/robots.txt", okRobots("User-agent: anthropic-ai\nDisallow: /")]]);
    const fetcher = politeFetcher({ db, send: web.send });
    const out = await checkSources(db, { fetcher, now: NOW, sources: [{ id: "nope", name: "nope", method: "page", url: "https://nope.example.sg/", every: 60, filter: "none" }] });
    assert.equal(out[0].outcome, "error");
    const state = await store.readKv(db, "events:src:nope");
    assert.equal(state.status, "robots_denied");
    assert.ok(new Date(state.nextAt) > NOW);
    assert.equal(web.calls.length, 1, "only robots.txt was read");
  });

  // --- Claude ------------------------------------------------------------------------------
  const known = [{ id: "ev-afa-2026", name: "AFA Singapore 2026", startsOn: "2026-11-27", endsOn: "2026-11-29", venue: "Suntec", kind: "con", tier: "sg", status: "upcoming" }];

  await test("Triage uses Haiku 5.5 with structured output and a cached known-events block; bad answers never count as news", () => {
    const p = triage.triageParams({ origin: "crawler", title: "x", excerpt: "y" }, known, { today: "2026-11-27" });
    assert.equal(p.model, "claude-haiku-5-5");
    assert.equal(p.output_config.format.type, "json_schema");
    assert.equal(p.output_config.effort, "low");
    assert.deepEqual(p.system[1].cache_control, { type: "ephemeral" });
    assert.match(p.system[1].text, /ev-afa-2026 \| AFA Singapore 2026/);
    const read = (obj) => triage.readTriage({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }] }, known);
    assert.equal(read({ verdict: "update", eventId: "ev-made-up", singapore: true, investigate: true }).verdict, "new");
    assert.equal(read({ verdict: "new", eventId: null, singapore: false, investigate: true }).verdict, "not_event");
    assert.equal(triage.readTriage({ stop_reason: "end_turn", content: [{ type: "text", text: "{oops" }] }, known).verdict, "not_event");
    assert.equal(triage.readTriage({ stop_reason: "refusal", content: [] }, known).investigate, false);
  });

  const draft = (over = {}) => ({
    isEvent: true,
    reason: null,
    event: { name: "Konbini 6.0", kind: "fair", tagline: "the j-fashion market is back at *scape", startsOn: "2027-06-05", endsOn: "2027-06-06", datesTbc: false, venueName: "*SCAPE", city: "Singapore", fandoms: ["J-fashion"], tags: ["market"], officialUrl: "https://www.scape.sg/whats-on/konbini/", cancelled: false, ...over.event },
    dossier: {
      about: { summary: { text: "A J-fashion and kawaii market with a runway show.", sourceIds: ["s1"] }, like: null, highlights: [] },
      days: [{ date: "2027-06-05", opens: "11:00", closes: "20:00", label: null, note: null, sourceIds: ["s1"] }, { date: "2027-06-06", opens: "11:00", closes: "19:00", label: null, note: null, sourceIds: ["s1"] }],
      datesNote: null,
      venue: { name: "*SCAPE", hall: "Ground Theatre, L2", address: "2 Orchard Link, Singapore 237978", area: "Orchard", lat: 1.3016, lng: 103.8364, directions: [{ text: "Somerset MRT, exit B.", sourceIds: ["s1"] }], sourceIds: ["s1"] },
      tickets: { status: "free", opensAt: null, buyUrl: null, tiers: [], note: null },
      links: [{ label: "official", url: "https://www.scape.sg/whats-on/konbini/", kind: "official" }],
      guests: [],
      merch: [],
      size: null,
      tips: [],
      popup: null,
      ...over.dossier,
    },
    timeline: [{ stage: "announced", at: "2026-11-27T09:00:00+08:00", title: null, text: null, sourceIds: ["s1"] }],
    sources: [{ id: "s1", label: "*SCAPE: Konbini", url: "https://www.scape.sg/whats-on/konbini/", kind: "venue", publisher: "*SCAPE", at: null, images: [] }, ...(over.sources ?? [])],
  });
  const tool = (input, id = "toolu_1") => ({ type: "tool_use", id, name: "submit_dossier", input });

  await test("Investigation uses Opus 5.5 with web search/fetch, never fetches blocked sites, resumes pause_turn and fixes an invalid dossier once", async () => {
    const p = investigationParams({ signals: [{ origin: "crawler", title: "Konbini", excerpt: "…" }], today: "2026-11-27" });
    assert.equal(p.model, "claude-opus-5-5");
    assert.deepEqual(p.tools.map((t) => t.type ?? t.name), ["web_search_20260209", "web_fetch_20260209", "submit_dossier"]);
    assert.ok(p.tools[1].blocked_domains.includes("suntecsingapore.com"));
    assert.ok(p.tools[1].blocked_domains.includes("singaporeexpo.com.sg"));
    assert.deepEqual(p.system[0].cache_control, { type: "ephemeral" });
    assert.equal(p.output_config.effort, "medium");
    assert.equal(p.fallbacks, "default");
    const seen = [];
    const answers = [
      { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "konbini singapore 2027" } }], usage: usage(3000, 200, { server_tool_use: { web_search_requests: 1 } }) },
      { stop_reason: "tool_use", content: [tool({ ...draft(), event: { ...draft().event, kind: "festival" } })], usage: usage(6000, 900) },
      { stop_reason: "tool_use", content: [tool(draft(), "toolu_2")], usage: usage(7000, 900) },
    ];
    const claude = claudeFor(db, { responder: async (params) => (seen.push(params), answers.shift()) });
    const result = await investigate(claude, { signals: [{ origin: "crawler", title: "Konbini" }], today: "2026-11-27" });
    assert.equal(result.outcome, "submitted");
    assert.equal(result.draft.event.name, "Konbini 6.0");
    assert.equal(seen.length, 3);
    assert.equal(seen[1].messages.at(-1).role, "assistant", "pause_turn: the paused turn is sent back as is");
    assert.equal(seen[2].messages.at(-1).content[0].is_error, true, "the validation errors go back as a tool result");
    assert.ok(result.usd > 0);
  });

  await test("Pipeline: a crawler signal becomes one event with dossier, timeline, sources and a pushed 'new'; news is merged and logged", async () => {
    const { signal } = await store.enqueueSignal(db, { origin: "crawler", sourceId: "scape-events", url: "https://www.scape.sg/whats-on/konbini/", title: "Konbini 6.0", excerpt: "Konbini 6.0 5-6 June 2027 *SCAPE" });
    const triageAnswer = (obj) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ eventId: null, singapore: true, name: "Konbini 6.0", kind: "fair", startsOn: null, fandoms: ["j-fashion"], importance: "big", change: null, investigate: true, reason: "x", ...obj }) }], usage: usage(1500, 80) });
    let answers = [triageAnswer({ verdict: "new" }), { stop_reason: "tool_use", content: [tool(draft())], usage: usage(8000, 1200) }];
    const claude = claudeFor(db, { responder: async () => answers.shift(), now: () => NOW });
    let summary = await pipeline.processQueue(db, claude, { now: () => NOW });
    assert.equal(summary.added, 1, JSON.stringify(summary));
    const [row] = await db.select().from(schema.events).where(eq(schema.events.name, "Konbini 6.0"));
    assert.equal(row.id, "ev-konbini-6-0-2027");
    assert.equal(row.kind, "fair");
    assert.equal(row.confidence, "official", "dates cited from the venue's page");
    assert.ok(row.fandoms.includes("j-fashion"));
    assert.equal(row.hers, true);
    assert.equal(row.big, true);
    assert.equal(row.dossier.sources[0].id, "s1");
    let log = await store.logFor(db, [row.id]);
    assert.deepEqual(log.map((e) => [e.kind, e.push]), [["new", "instant"]]);
    assert.equal((await store.getSignal(db, signal.id)).status, "added");

    // A day later an Instagram post reveals exclusives; it's merged into the same event.
    const later = new Date(NOW.getTime() + 26 * 3600_000);
    await store.enqueueSignal(db, { origin: "instagram", url: "https://www.instagram.com/p/xyz/", title: "@konbini.sg: exclusives!", excerpt: "Konbini exclusive totes", payload: { caption: "Konbini exclusive totes" } });
    const withMerch = draft({ dossier: { merch: [{ id: "m-tote", name: "Konbini 6.0 tote", kind: "exclusive", fandoms: [], price: 20, currency: "SGD", where: "info booth", when: null, limited: true, status: "revealed", note: null, image: null, sourceIds: ["s2"] }] }, sources: [{ id: "s2", label: "Konbini on Instagram", url: "https://www.instagram.com/p/xyz/", kind: "social", publisher: null, at: null, images: [] }] });
    answers = [triageAnswer({ verdict: "update", eventId: row.id }), { stop_reason: "tool_use", content: [tool(withMerch)], usage: usage(9000, 1300) }];
    summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => later }), { now: () => later });
    assert.equal(summary.updated, 1, JSON.stringify(summary));
    log = await store.logFor(db, [row.id]);
    assert.deepEqual(log.map((e) => e.kind), ["merch", "new"]);
    assert.equal(log[0].title, "exclusives revealed");
    assert.equal(log[0].push, "instant");
    const after = await store.getEventRow(db, row.id);
    assert.deepEqual(after.dossier.sources.map((s) => s.id), ["s1", "s2"]);
    assert.deepEqual(after.dossier.merch[0].sourceIds, ["s2"]);

    // More news within the cooldown is batched into one refresh instead of another investigation.
    await store.enqueueSignal(db, { origin: "crawler", sourceId: "x", url: "https://geekculture.co/konbini", title: "Konbini returns", excerpt: "Konbini" });
    answers = [triageAnswer({ verdict: "update", eventId: row.id })];
    summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => later }), { now: () => later });
    assert.equal(summary.investigated, 0);
    const refresh = await store.queuedSignals(db, { now: new Date(later.getTime() + 21 * 3600_000) });
    assert.equal(refresh[0].origin, "refresh");
    assert.equal(refresh[0].payload.batched.length, 1);
    assert.equal((await store.queuedSignals(db, { now: later })).length, 0, "not before the cooldown ends");
  });

  await test("A pasted link skips triage; an Opus 'not an event' answer is shown to Josh as such", async () => {
    const { signal } = await store.enqueueSignal(db, { origin: "link", url: "https://example.sg/news", by: "admin" });
    const calls = [];
    const claude = claudeFor(db, { responder: async (params) => (calls.push(params.model), { stop_reason: "tool_use", content: [tool({ isEvent: false, reason: "a review of a past concert", event: null, dossier: null, timeline: [], sources: [] })], usage: usage(5000, 300) }) });
    await pipeline.processQueue(db, claude, { now: () => NOW });
    assert.deepEqual(calls, ["claude-opus-5-5"]);
    const s = await store.getSignal(db, signal.id);
    assert.equal(s.status, "not_an_event");
    assert.equal(s.message, "a review of a past concert");
  });


  await test("An event never vanishes: ids are minted once, a different event can't overwrite it, dates never jump into the past", async () => {
    const ffName = "FINAL FANTASY XIV ORCHESTRA CONCERT 2027 -Eorzean Symphony- (Singapore)";
    const ffId = pipeline.newEventId({ name: ffName, startsOn: "2027-05-14" }, new Set());
    assert.equal(ffId, "ev-final-fantasy-xiv-orchestra-concert-2027-eorzean", "cut on a whole word, never mid-word");
    assert.equal(pipeline.newEventId({ name: "Konbini", startsOn: "2027-06-05" }, new Set(["ev-konbini-2027"])), "ev-konbini-2027-2");
    const lodestone = "https://na.finalfantasyxiv.com/lodestone/topics/detail/6980c068417272551bdafc3f215858b2bb08a3a8";
    await store.saveEvent(db, { id: ffId, name: ffName, kind: "concert", tagline: "one night only", city: "Singapore", country: "Singapore", tier: "sg", venue: "The Star Theatre", startsOn: "2027-05-14", endsOn: "2027-05-14", url: lodestone, confidence: "official", dossier: draft().dossier, origin: "crawler" }, { now: NOW });
    const ff = await store.getEventRow(db, ffId);

    // The old matcher let "Final Fantasy XIV" (no dates) match the concert and overwrite it.
    assert.equal(pipeline.sameEvent(ff, { name: "Final Fantasy XIV", startsOn: null }), false);
    assert.equal(pipeline.findSameEvent([ff], { name: "FINAL FANTASY XIV pop-up store", startsOn: "2026-12-10", endsOn: "2026-12-20" }), null);
    assert.equal(pipeline.sameEvent({ name: "Doujin Market 2026", startsOn: "2026-12-12", endsOn: "2026-12-13" }, { name: "Doujin Market Mini 2026 (Doumini)", startsOn: "2026-12-12", endsOn: "2026-12-13" }), true);
    assert.equal(pipeline.sameEvent(ff, { name: "Eorzean Symphony World Tour", startsOn: "2027-05-14", officialUrl: lodestone }), true, "same official page and the same day");
    assert.equal(pipeline.sameEvent({ name: "Cosfest", startsOn: null, url: "https://cosfest.sg/" }, { name: "Cosfest XXV", startsOn: "2027-07-04", officialUrl: "https://cosfest.sg/" }), false, "a lone shared word is not enough");
    assert.equal(pipeline.draftFitsTarget(ff, { name: "FINAL FANTASY pop-up store", startsOn: "2026-12-10", endsOn: "2026-12-20" }), false);
    assert.equal(pipeline.draftFitsTarget(ff, { name: ffName, startsOn: "2027-06-01", endsOn: "2027-06-01" }), true, "a postponed show is still the same show");

    // Triage points a pop-up's news at the concert by mistake: the pop-up becomes its own event.
    const before = await store.getEventRow(db, ffId);
    await store.enqueueSignal(db, { origin: "crawler", sourceId: "geekculture", url: "https://geekculture.co/ff-popup", title: "FINAL FANTASY pop-up store", excerpt: "FF pop-up 10–20 Dec" });
    const triageTo = (eventId) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ verdict: "update", eventId, singapore: true, name: "FF pop-up", kind: "popup", startsOn: null, fandoms: [], importance: "normal", change: "pop-up", investigate: true, reason: "x" }) }], usage: usage(1500, 80) });
    const popup = draft({ event: { name: "FINAL FANTASY pop-up store", kind: "popup", tagline: "a pop-up shop", startsOn: "2026-12-10", endsOn: "2026-12-20", officialUrl: "https://geekculture.co/ff-popup" } });
    let answers = [triageTo(ffId), { stop_reason: "tool_use", content: [tool(popup)], usage: usage(8000, 900) }];
    let summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => NOW }), { now: () => NOW });
    assert.equal(summary.added, 1, JSON.stringify(summary));
    const after = await store.getEventRow(db, ffId);
    assert.deepEqual([after.name, after.startsOn, after.status], [before.name, before.startsOn, "upcoming"], "the concert is untouched");

    // A refresh that misreads the year keeps the concert's dates; a rename keeps its id.
    const misread = draft({ event: { name: "Eorzean Symphony World Tour – Singapore", kind: "concert", tagline: "one night only", startsOn: "2026-05-14", endsOn: "2026-05-14", officialUrl: lodestone } });
    await store.enqueueSignal(db, { origin: "refresh", eventId: ffId, url: lodestone, title: ffName, hash: store.sha("refresh-test", ffId) });
    answers = [{ stop_reason: "tool_use", content: [tool(misread)], usage: usage(8000, 900) }];
    summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => NOW }), { now: () => NOW });
    assert.equal(summary.updated, 1, JSON.stringify(summary));
    const renamed = await store.getEventRow(db, ffId);
    assert.equal(renamed.name, "Eorzean Symphony World Tour – Singapore", "renamed in place");
    assert.equal(renamed.startsOn, "2027-05-14", "never moved into the past on one pass");
    const listed = present.filterRows(await store.listEventRows(db), { when: "upcoming", today: "2026-11-27" }).rows.map((r) => r.id);
    assert.ok(listed.includes(ffId), "still on her list");
    assert.equal(renamed.dossier.pastDatesSeen.startsOn, "2026-05-14", "the doubtful dates are remembered");

    // Asked to refresh the concert, the research describes something else entirely: nothing changes.
    const unrelated = draft({ event: { name: "Konbini 7.0", kind: "fair", tagline: "a market", startsOn: "2027-09-01", endsOn: "2027-09-02", officialUrl: "https://www.scape.sg/whats-on/konbini-7/" } });
    await store.enqueueSignal(db, { origin: "refresh", eventId: ffId, url: lodestone, title: ffName, hash: store.sha("refresh-test-2", ffId) });
    answers = [{ stop_reason: "tool_use", content: [tool(unrelated)], usage: usage(8000, 900) }];
    const countBefore = (await store.listEventRows(db, { includeHidden: true })).length;
    summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => NOW }), { now: () => NOW });
    assert.deepEqual([summary.skipped, summary.added, summary.updated], [1, 0, 0], JSON.stringify(summary));
    assert.equal((await store.listEventRows(db, { includeHidden: true })).length, countBefore, "no stray event");
    assert.equal((await store.getEventRow(db, ffId)).name, "Eorzean Symphony World Tour – Singapore");

    // A second, independent pass that agrees on the earlier dates is believed (it really was then).
    await store.enqueueSignal(db, { origin: "refresh", eventId: ffId, url: lodestone, title: ffName, hash: store.sha("refresh-test-3", ffId) });
    answers = [{ stop_reason: "tool_use", content: [tool(misread)], usage: usage(8000, 900) }];
    await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => NOW }), { now: () => NOW });
    assert.equal((await store.getEventRow(db, ffId)).startsOn, "2026-05-14");
    assert.equal(present.eventStatus(await store.getEventRow(db, ffId), "2026-11-27"), "past", "and only then does it leave, as over");
  });

  await test("Duplicates fold into the one first spotted; the old id keeps opening it and her saves follow", async () => {
    const base = { name: "Cosfest XXV", kind: "con", tagline: "cosplay festival", city: "Singapore", country: "Singapore", tier: "sg", startsOn: "2027-07-04", endsOn: "2027-07-05", url: "https://cosfest.sg/", confidence: "official", origin: "crawler", dossier: { merch: [{ id: "m-badge", name: "Cosfest badge" }] } };
    await store.saveEvent(db, { ...base, id: "ev-cosfest-xxv" }, { now: new Date("2026-10-01T00:00:00Z") });
    await store.saveEvent(db, { ...base, id: "ev-cosfest-xxv-2", tagline: "newer research" }, { now: NOW });
    await store.addLogEntries(db, "ev-cosfest-xxv-2", [{ kind: "new", title: "first spotted" }, { kind: "tickets", title: "tickets on sale" }], { now: NOW });
    await store.updateMe(db, (me) => ((me.saved.events["ev-cosfest-xxv-2"] = NOW.toISOString()), (me.saved.merch["ev-cosfest-xxv-2~m-badge"] = NOW.toISOString()), me));
    const rows = await store.listEventRows(db, { includeHidden: true });
    const survivor = await pipeline.foldDuplicates(db, await store.getEventRow(db, "ev-cosfest-xxv-2"), rows, { now: NOW });
    assert.equal(survivor, "ev-cosfest-xxv", "the first one spotted stays");
    assert.equal((await store.getEventRow(db, "ev-cosfest-xxv")).tagline, "newer research", "and takes the freshest research");
    const { row, from } = await store.resolveEventRow(db, "ev-cosfest-xxv-2");
    assert.deepEqual([row.id, from], ["ev-cosfest-xxv", "ev-cosfest-xxv-2"]);
    const me = await store.readMe(db);
    assert.ok(me.saved.events["ev-cosfest-xxv"] && !me.saved.events["ev-cosfest-xxv-2"]);
    assert.ok(me.saved.merch["ev-cosfest-xxv~m-badge"]);
    const log = await store.logFor(db, ["ev-cosfest-xxv"]);
    assert.deepEqual(log.map((e) => e.kind), ["tickets"], "its news moved over, without a second 'first spotted'");
    assert.ok((await store.getEventRow(db, "ev-cosfest-xxv-2")), "nothing is deleted");
    const listed = present.filterRows(await store.listEventRows(db), { when: "all", today: "2026-11-27" }).rows.map((r) => r.id);
    assert.ok(listed.includes("ev-cosfest-xxv") && !listed.includes("ev-cosfest-xxv-2"));

    // News that triage pins on the old id updates the event it became; the alias is never revived.
    await store.enqueueSignal(db, { origin: "crawler", sourceId: "x", url: "https://cosfest.sg/news/tickets", title: "Cosfest tickets", excerpt: "Cosfest XXV tickets" });
    const cosfest = draft({ event: { name: "Cosfest XXV", kind: "con", tagline: "cosplay festival, tickets out", startsOn: "2027-07-04", endsOn: "2027-07-05", officialUrl: "https://cosfest.sg/" } });
    const answers = [
      { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ verdict: "update", eventId: "ev-cosfest-xxv-2", singapore: true, name: "Cosfest XXV", kind: "con", startsOn: null, fandoms: [], importance: "normal", change: "tickets", investigate: true, reason: "x" }) }], usage: usage(1500, 80) },
      { stop_reason: "tool_use", content: [tool(cosfest)], usage: usage(8000, 900) },
    ];
    const summary = await pipeline.processQueue(db, claudeFor(db, { responder: async () => answers.shift(), now: () => NOW }), { now: () => NOW });
    assert.equal(summary.updated, 1, JSON.stringify(summary));
    assert.equal((await store.getEventRow(db, "ev-cosfest-xxv-2")).status, "merged");
    assert.equal((await store.getEventRow(db, "ev-cosfest-xxv")).tagline, "cosplay festival, tickets out");
    assert.ok(!triage.knownEventsBlock(await store.listEventRows(db, { includeHidden: true })).includes("ev-cosfest-xxv-2"), "aliases aren't offered to triage");
  });

  await test("Housekeeping rules out the old overseas rows explicitly and deletes nothing; statuses say why something left", async () => {
    for (const id of ["comiket:de67209c", "comiket:6b27de1d", "animejapan:2027"])
      await db.insert(schema.events).values({ id, name: "Comic Market", tier: "regional", url: "https://www.comiket.co.jp/", status: "upcoming", startsOn: id.endsWith("2027") ? "2027-03-27" : null });
    const count = async () => (await db.select({ id: schema.events.id }).from(schema.events)).length;
    const n = await count();
    assert.equal(await store.ruleOutOverseas(db, { now: NOW }), 3);
    assert.equal(await store.ruleOutOverseas(db, { now: NOW }), 0, "idempotent");
    assert.equal(await count(), n);
    assert.equal((await store.getEventRow(db, "comiket:de67209c")).status, "out_of_scope");

    const today = "2026-11-27";
    const row = (o) => ({ id: "x", name: "x", kind: "con", status: "upcoming", ...o });
    assert.equal(present.eventStatus(row({ status: "cancelled", startsOn: "2026-12-04", endsOn: "2026-12-06" }), today), "cancelled");
    assert.equal(present.eventStatus(row({ status: "cancelled", startsOn: "2026-11-01", endsOn: "2026-11-02" }), today), "past");
    assert.equal(present.eventStatus(row({ kind: "popup", startsOn: "2026-11-20", endsOn: null }), today), "on_now", "an open-ended pop-up doesn't end on its first day");
    assert.equal(present.eventStatus(row({ kind: "concert", startsOn: "2026-11-20", endsOn: null }), today), "past");
    const { rows } = present.filterRows([row({ id: "a", status: "cancelled", startsOn: "2026-12-04" }), row({ id: "b", status: "merged", startsOn: "2026-12-04" }), row({ id: "c", status: "out_of_scope", startsOn: "2026-12-04" })], { when: "upcoming", today });
    assert.deepEqual(rows.map((r) => r.id), ["a"], "cancelled stays (marked) until its day; merged and ruled-out rows don't show");
    const card = present.eventCard(row({ kind: "popup", startsOn: "2026-11-20", endsOn: null }), { today, me: null });
    assert.deepEqual([card.openEnded, card.dateLabel, card.endsOn], [true, "from 20 nov", "2027-01-19"]);
    const steps = dossier.timelineFor({ timeline: [{ stage: "tickets", at: "2026-12-02 12:00", title: "tickets on sale", text: "SISTIC", sourceIds: [] }], startsOn: "2027-05-14", endsOn: "2027-05-14", status: "upcoming", dossier: {} }, today);
    assert.equal(steps.find((x) => x.stage === "tickets").state, "next", "a sale date still to come isn't 'done'");
  });

  await test("Pictures: share pictures and Instagram posts, copied through the site's API, robots.txt obeyed, no Claude calls", async () => {
    assert.equal(images.sniffImage(JPEG), "image/jpeg");
    assert.equal(images.sniffImage(Buffer.from("<html>not a picture</html>")), null);
    assert.equal(images.shareImageOf(`<head><meta property="og:image" content="/img/key-visual.jpg?v=2&amp;w=1200"></head>`, "https://cosfest.sg/2027/"), "https://cosfest.sg/img/key-visual.jpg?v=2&w=1200");
    assert.equal(images.shareImageOf(`<meta name="twitter:image" content="http://insecure.example/x.jpg">`, "https://a.sg/"), null, "https only");
    assert.equal(images.captionMentions("AFA exclusive: Miku acrylic stand, one per person!", "AFA × Hatsune Miku acrylic stand"), true);
    assert.equal(images.captionMentions("happy friday ☕", "Hatsune Miku acrylic stand"), false);

    // The worker's store hands pictures to the site's API with CRON_SECRET and keeps the plain link.
    const posted = [];
    const store_ = images.imageStore({ apiOrigin: "https://kiriya.love", cronSecret: "s3cret", post: async (url, init) => (posted.push({ url, auth: init.headers.authorization, type: init.headers["content-type"], n: init.body.length }), { ok: true, json: async () => ({ url: `/api/uploads/media?path=events%2F${posted.length}.jpg` }) }) });
    assert.equal(store_.via, "api");
    assert.equal(images.imageStore({}), null, "no key, no store: pictures simply wait");
    const web = fakeWeb([
      [/cosfest\.sg\/robots\.txt$/, okRobots()],
      [/cdn\.cosfest\.sg\/robots\.txt$/, okRobots()],
      [/news\.example\/robots\.txt$/, okRobots("Disallow: /private")],
      ["https://cosfest.sg/2027/", { body: `<html><head><meta property="og:image" content="https://cdn.cosfest.sg/kv.jpg"></head></html>` }],
      ["https://cdn.cosfest.sg/kv.jpg", { type: "image/jpeg", body: jpeg(1) }],
      ["https://news.example/badges", { body: `<meta property="og:image" content="https://cdn.cosfest.sg/badges.jpg">` }],
      ["https://cdn.cosfest.sg/badges.jpg", { type: "image/jpeg", body: jpeg(2) }],
      ["https://news.example/private/plush", { body: `<meta property="og:image" content="https://cdn.cosfest.sg/plush.jpg">` }],
    ]);
    const fetcher = politeFetcher({ db, send: web.send, now: (() => { let t = 0; return () => (t += 5000); })() });
    const row = {
      id: "ev-pictures", name: "Cosfest 2027", url: "https://cosfest.sg/2027/", image: null,
      dossier: {
        about: { summary: { text: "x", sourceIds: ["s1"] } },
        sources: [
          { id: "s1", url: "https://cosfest.sg/2027/", kind: "official" },
          { id: "s2", url: "https://www.instagram.com/p/POST1/", kind: "social" },
          { id: "s3", url: "https://news.example/badges", kind: "news", publisher: "News" },
          { id: "s4", url: "https://news.example/private/plush", kind: "news" },
        ],
        merch: [
          { id: "m-tote", name: "Cosfest tote", sourceIds: ["s2"] },
          { id: "m-stand", name: "Hatsune Miku acrylic stand", sourceIds: ["s1"] },
          { id: "m-badges", name: "Cosfest badge set", sourceIds: ["s3"] },
          { id: "m-plush", name: "Cosfest plush", sourceIds: ["s4"] },
        ],
      },
    };
    const posts = [
      { url: "https://www.instagram.com/p/POST1/", account: "cosfest", caption: "our tote!", images: ["/api/uploads/media?path=events%2Fpost1.jpg"] },
      { url: "https://www.instagram.com/p/POST2/", account: "cosfest", caption: "Miku acrylic stand revealed", images: ["/api/uploads/media?path=events%2Fpost2.jpg"] },
    ];
    let claudeCalls = 0;
    const result = await images.picturesFor(row, { posts, fetcher, store: { put: async (b) => (claudeCalls += 0, store_.put(b)) } });
    assert.equal(result.image.url, "/api/uploads/media?path=events%2F1.jpg", "the official page's share picture");
    assert.equal(result.image.credit, "cosfest.sg");
    const by = Object.fromEntries(result.merch.map((m) => [m.id, m]));
    assert.deepEqual(by["m-tote"].images, ["/api/uploads/media?path=events%2Fpost1.jpg"], "its own Instagram post");
    assert.equal(by["m-tote"].imageCredit, "@cosfest");
    assert.deepEqual(by["m-stand"].images, ["/api/uploads/media?path=events%2Fpost2.jpg"], "a post whose caption names it");
    assert.deepEqual(by["m-badges"].images, ["/api/uploads/media?path=events%2F2.jpg"], "a page cited only for the merch");
    assert.equal(by["m-plush"].images?.length ?? 0, 0, "robots.txt said no");
    assert.ok(!web.calls.some((c) => c.href.includes("/private/")), "the disallowed page was never fetched");
    assert.ok(posted.every((p) => p.auth === "Bearer s3cret" && p.type === "image/jpeg"));
    assert.equal(claudeCalls, 0);

    // A later investigation keeps the pictures; the worker step retries a few days later at most.
    const carried = images.carryMerchImages([{ id: "m-new-id", name: "Cosfest Tote", images: [] }], result.merch);
    assert.deepEqual(carried[0].images, ["/api/uploads/media?path=events%2Fpost1.jpg"]);
    await store.saveEvent(db, { id: "ev-pictures", name: "Cosfest 2027", kind: "con", tier: "sg", city: "Singapore", url: "https://cosfest.sg/2027/", startsOn: "2027-07-04", dossier: { merch: [{ id: "m-x", name: "Mystery charm", sourceIds: [] }], sources: [] } }, { now: NOW });
    const save = (r, patch) => db.update(schema.events).set(patch).where(eq(schema.events.id, r.id));
    const first = await images.refreshPictures(db, [await store.getEventRow(db, "ev-pictures")], { fetcher, store: store_, postsFor: async () => [], save, now: NOW });
    assert.deepEqual([first.looked, first.covers], [1, 1]);
    assert.match((await store.getEventRow(db, "ev-pictures")).image.url, /^\/api\/uploads\/media\?path=events/);
    const second = await images.refreshPictures(db, [await store.getEventRow(db, "ev-pictures")], { fetcher, store: store_, postsFor: async () => [], save, now: new Date(NOW.getTime() + 3600_000) });
    assert.equal(second.looked, 0, "not again within three days when nothing changed");
    const post = { url: "https://www.instagram.com/p/NEW1/", account: "cosfest", caption: "Mystery charm revealed", images: ["/api/uploads/media?path=events%2Fnew1.jpg"] };
    const third = await images.refreshPictures(db, [await store.getEventRow(db, "ev-pictures")], { fetcher, store: store_, postsFor: async () => [post], save, now: new Date(NOW.getTime() + 7200_000) });
    assert.deepEqual([third.looked, third.merch], [1, 1], "a new post with pictures is used at once");
    assert.deepEqual((await store.getEventRow(db, "ev-pictures")).dossier.merch[0].images, ["/api/uploads/media?path=events%2Fnew1.jpg"]);
    assert.equal((await images.refreshPictures(db, [], { store: null })).ran, false);
    // Keep the push test below about Konbini's news only.
    await db.update(schema.eventLog).set({ push: "none" }).where(sql`${schema.eventLog.eventId} <> 'ev-konbini-6-0-2027'`);
  });

  await test("Spend: priced from usage, dry runs excluded, and the US$20 ceiling pauses instead of overspending", async () => {
    assert.equal(spend.priceUsage("claude-opus-5-5", { input_tokens: 1_000_000 }).microUsd, 4_000_000);
    assert.equal(spend.priceUsage("claude-haiku-5-5", { input_tokens: 50_000, output_tokens: 50_000 }).microUsd, 30_000);
    assert.equal(spend.priceUsage("claude-haiku-5-5", { input_tokens: 200_000 }).microUsd, 100_000, "prompts over 100K tokens cost more");
    assert.equal(spend.priceUsage("claude-opus-5-5", { server_tool_use: { web_search_requests: 3 } }).microUsd, 30_000);
    assert.equal(spend.priceUsage("claude-opus-5-5", { cache_read_input_tokens: 1_000_000 }).microUsd, 200_000);
    const before = await spend.monthTotal(db, "2026-11");
    assert.equal(before.microUsd, 0, "everything so far was a dry run");
    process.env.EVENTS_CLAUDE_CEILING_USD = "50";
    assert.equal(await spend.ceilingUsd(db), 20, "never above US$20");
    process.env.EVENTS_CLAUDE_CEILING_USD = "";
    const late = new Date("2026-11-28T04:00:00Z");
    await db.insert(schema.eventSpend).values({ at: late, month: "2026-11", day: "2026-11-28", model: "claude-opus-5-5", purpose: "investigate", microUsd: 19_000_000 });
    const gate = await spend.canSpend(db, "investigate", { now: late });
    assert.deepEqual([gate.ok, gate.reason], [false, "ceiling"]);
    const cheap = await spend.canSpend(db, "triage", { now: late });
    assert.equal(cheap.ok, true, JSON.stringify(cheap));
    // Pace: early in a month, most of the budget is out of reach.
    const early = new Date("2026-12-02T04:00:00Z");
    await db.insert(schema.eventSpend).values({ at: early, month: "2026-12", day: "2026-12-02", model: "claude-opus-5-5", purpose: "investigate", microUsd: 5_200_000 });
    assert.equal((await spend.canSpend(db, "investigate", { now: early })).reason, "pace");
    // A real (non-dry) client refuses to call at all when paused, and the signal waits.
    process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
    const real = claudeFor(db, { now: () => late });
    await store.enqueueSignal(db, { origin: "link", url: "https://example.sg/pause", by: "admin" });
    const summary = await pipeline.processQueue(db, real, { now: () => late });
    process.env.ANTHROPIC_API_KEY = "";
    assert.equal(summary.paused, 1);
    const report = await spend.spendReport(db, { now: late });
    assert.equal(report.spentUsd, 19);
    assert.equal(report.paused, true);
    await db.delete(schema.eventSpend).where(eq(schema.eventSpend.dryRun, false));
  });

  await test("Pushes: Josh only by default, test mode keeps everything off her phone, quiet hours hold instant news, a weekly digest for the rest", async () => {
    const sent = [];
    const fake = async (_db, message, options) => (sent.push({ message, role: options.role }), { sent: 1, failed: 0, targets: 1 });
    const id = "ev-konbini-6-0-2027";
    await store.addLogEntries(db, id, [{ kind: "tickets", title: "free entry confirmed", text: "", push: "digest" }], { now: NOW });
    let out = await push.deliverEventPushes(db, { now: NOW, send: fake });
    assert.equal(out.audience, "admin");
    assert.deepEqual(sent.map((s) => s.role), ["admin"], "the two instant entries of one event make one push");
    assert.equal(sent[0].message.navigate, `/world?event=${id}#events`);
    assert.equal(sent[0].message.kind, "event");
    assert.equal(out.digest, null, "Friday: no digest");
    out = await push.deliverEventPushes(db, { now: NOW, send: fake });
    assert.equal(sent.length, 1, "never sent twice");

    process.env.EVENTS_PUSH_AUDIENCE = "kiriya";
    await store.addLogEntries(db, id, [{ kind: "guests", title: "a guest announced", text: "a lolita model", push: "instant" }], { now: NOW });
    const night = new Date("2026-11-27T16:30:00Z"); // 00:30 in Singapore
    out = await push.deliverEventPushes(db, { now: night, send: fake });
    assert.equal(out.held, 1);
    assert.equal(sent.length, 1, "held until her notification hours");
    await setTestMode(db, true, NOW);
    out = await push.deliverEventPushes(db, { now: NOW, send: fake });
    assert.equal(out.test, true);
    assert.deepEqual(sent.slice(1).map((s) => s.role), ["admin"], "test mode: Josh's phones only");
    assert.match(sent[1].message.title, /^test · /);
    await setTestMode(db, false, NOW);

    const sunday = new Date("2026-11-29T03:00:00Z"); // 11:00 SGT
    out = await push.deliverEventPushes(db, { now: sunday, send: fake });
    assert.equal(out.digest.entries, 1);
    assert.deepEqual(sent.at(-1), { message: sent.at(-1).message, role: "kiriya" });
    assert.match(sent.at(-1).message.title, /this week in events/);
    process.env.EVENTS_PUSH_AUDIENCE = "";
  });

  await test("Weather: Open-Meteo 5–16 days out, NEA four-day within 4, NEA 2-hour on the day; LTA alerts parsed", async () => {
    const feeds = {
      fourDay: weather.readFourDay(JSON.parse(fixture("events", "four-day-outlook.json"))),
      twoHour: weather.readTwoHour(JSON.parse(fixture("events", "two-hr-forecast.json"))),
      openMeteo: async () => weather.readOpenMeteo(JSON.parse(fixture("events", "open-meteo.json"))),
    };
    const venue = { lat: 1.2937, lng: 103.8572 };
    const ev = (startsOn, endsOn) => ({ startsOn, endsOn, status: "upcoming", dossier: { venue } });
    const far = await weather.weatherFor(ev("2026-12-05", "2026-12-06"), "2026-11-27", feeds);
    assert.equal(far.source, "open-meteo");
    assert.deepEqual(far.days.map((d) => d.date), ["2026-12-05", "2026-12-06"]);
    assert.match(far.credit, /Open-Meteo/);
    const near = await weather.weatherFor(ev("2026-11-28", "2026-11-29"), "2026-11-27", feeds);
    assert.equal(near.source, "nea-4day");
    assert.equal(near.days[0].date, "2026-11-28");
    assert.equal(near.days[0].icon, "thundery");
    assert.match(near.credit, /National Environment Agency/);
    const today = await weather.weatherFor(ev("2026-11-27", "2026-11-29"), "2026-11-27", feeds);
    assert.equal(today.source, "nea-2h");
    assert.equal(today.now.area, weather.nearestArea(feeds.twoHour.areas, venue));
    assert.equal(await weather.weatherFor(ev("2027-01-23", "2027-01-24"), "2026-11-27", feeds), null, "too far out");
    const alerts = weather.readTrainAlerts({ value: { Status: 2, AffectedSegments: [{ Line: "CCL", Direction: "HarbourFront", Stations: "CC3,CC4", FreePublicBus: "CC3-CC4" }], Message: [{ Content: "CCL: no train service between Esplanade and Promenade", CreatedDate: "2026-11-27 09:00:00" }] } });
    assert.equal(alerts.status, "disrupted");
    assert.deepEqual(alerts.alerts[0].stations, ["CC3", "CC4"]);
    assert.equal(weather.readTrainAlerts({ value: { Status: 1, AffectedSegments: [], Message: [] } }).status, "normal");
  });

  await test("The worker stores weather for event days, and only asks LTA when a key is set", async () => {
    await store.saveEvent(db, { id: "ev-weather", name: "Weather test con", kind: "con", tier: "sg", url: "https://x.sg/", startsOn: "2026-11-28", endsOn: "2026-11-29", dossier: { venue: { name: "Suntec", lat: 1.2937, lng: 103.8572 } } }, { now: NOW });
    const web = fakeWeb([[/four-day-outlook/, json(JSON.parse(fixture("events", "four-day-outlook.json")))], [/two-hr-forecast/, json(JSON.parse(fixture("events", "two-hr-forecast.json")))], [/open-meteo/, json(JSON.parse(fixture("events", "open-meteo.json")))]]);
    const result = await refreshWeather(db, { api: weather.apiClient({ send: web.send }), now: NOW });
    assert.ok(result.updated >= 1);
    const row = await store.getEventRow(db, "ev-weather");
    assert.equal(row.weather.source, "nea-4day");
    assert.ok(!web.calls.some((c) => c.href.includes("mytransport")), "no LTA key, no LTA call");
  });

  await test("Instagram via Apify: trigger-only, pictures copied to our storage, each post queued once, old posts' pictures filled once", async () => {
    // A post queued before pictures were stored (production until now): it has no pictures.
    await store.enqueueSignal(db, { origin: "instagram", sourceId: "ig:animefestivalasia", url: "https://www.instagram.com/p/OLD111/", title: "@animefestivalasia: exclusives", excerpt: "AFA exclusives", payload: { caption: "AFA exclusives", images: [] }, hash: store.sha("instagram", "OLD111") });
    await store.writeKv(db, "events:instagram", { seen: ["OLD111"], lastRunAt: new Date(NOW.getTime() - 9 * 3600_000).toISOString() });
    const items = [
      { shortCode: "ABC123", url: "https://www.instagram.com/p/ABC123/", caption: "AFA 2026 exclusive Miku merch revealed! See you at Suntec 27-29 Nov", timestamp: "2026-11-26T10:00:00.000Z", ownerUsername: "animefestivalasia", displayUrl: "https://scontent-sin6-1.cdninstagram.com/v/t51/abc.jpg?x=1", images: [] },
      { shortCode: "DEF456", url: "https://www.instagram.com/p/DEF456/", caption: "happy friday ☕", timestamp: "2026-11-26T11:00:00.000Z", ownerUsername: "anipluscafesg", displayUrl: "https://scontent-sin6-1.cdninstagram.com/v/t51/def.jpg" },
      { shortCode: "OLD111", url: "https://www.instagram.com/p/OLD111/", caption: "AFA exclusives", timestamp: "2026-11-20T11:00:00.000Z", ownerUsername: "animefestivalasia", displayUrl: "https://scontent-sin6-1.cdninstagram.com/v/t51/old.jpg" },
    ];
    const posts = instagram.readPosts(items);
    assert.equal(posts[0].account, "animefestivalasia");
    const inputs = [];
    const web = fakeWeb([[/cdninstagram\.com\/v\/t51\/abc/, { type: "image/jpeg", body: jpeg(10) }], [/cdninstagram\.com/, { type: "image/jpeg", body: jpeg(11) }], [/api\.apify\.com/, ({ headers, body }) => (assert.match(headers.authorization, /^Bearer /), inputs.push(JSON.parse(body)), json(items))]]);
    const puts = [];
    const blob = { put: async (p, buf, type) => puts.push({ p, type, n: buf.length }) };
    const first = await instagram.checkInstagram(db, { token: "apify-test", now: NOW, blob, send: web.send });
    assert.deepEqual([first.posts, first.queued, first.backfilled], [3, 1, 1], "the coffee post isn't an event lead; the old post got its picture");
    assert.equal(inputs[0].resultsLimit, 8, "the one-time look back reads a few more posts");
    assert.ok(puts.every((x) => /^events\/[0-9a-f]{32}\.jpg$/.test(x.p) && x.type === "image/jpeg"), JSON.stringify(puts));
    const signals = await store.signalsByOrigin(db, "instagram");
    const fresh = signals.find((x) => x.url.includes("ABC123"));
    assert.equal(fresh.payload.images.length, 1);
    assert.match(fresh.payload.images[0], /^\/api\/uploads\/media\?path=events%2F[0-9a-f]{32}\.jpg$/);
    assert.deepEqual(fresh.payload.remoteImages, ["https://scontent-sin6-1.cdninstagram.com/v/t51/abc.jpg?x=1"], "kept for the investigation to look at");
    assert.equal(signals.find((x) => x.url.includes("OLD111")).payload.images.length, 1);
    assert.equal((await instagram.checkInstagram(db, { token: "apify-test", now: new Date(NOW.getTime() + 3600_000), blob, send: web.send })).reason, "not due");
    const later = await instagram.checkInstagram(db, { token: "apify-test", now: new Date(NOW.getTime() + 9 * 3600_000), blob, send: web.send });
    assert.equal(later.backfilled, undefined, "the look back happens once");
    assert.equal(inputs.at(-1).resultsLimit, 3);
    assert.equal((await instagram.checkInstagram(db, { token: "", now: NOW })).ran, false);
    // Linked to an event, a post's pictures are that event's (the picture step reads them).
    await store.updateSignal(db, fresh.id, { eventId: "ev-pictures" });
    assert.deepEqual((await instagram.postsForEvent(db, "ev-pictures")).map((p) => p.images.length), [1]);
  });

  await test("Newsletters from the Gmail inbox become signals (read-only API, refresh token)", async () => {
    const b64 = (s) => Buffer.from(s).toString("base64url");
    const message = { id: "m1", payload: { mimeType: "multipart/alternative", headers: [{ name: "Subject", value: "Doumini 2026: artist list is out!" }, { name: "From", value: "Neo Tokyo Project <hello@neotokyoproject.com>" }], parts: [{ mimeType: "text/plain", body: { data: b64("Doujin Market Mini 12-13 December 2026, Suntec Hall 405. Artist alley list inside.") } }, { mimeType: "text/html", body: { data: b64('<a href="https://neotokyoproject.com/doujima/doumini-2026/">list</a> <a href="https://x.list-manage.com/unsubscribe?u=1">unsubscribe</a>') } }] } };
    const read = gmail.readMessage(message);
    assert.deepEqual(read.links, ["https://neotokyoproject.com/doujima/doumini-2026/"]);
    const web = fakeWeb([["https://oauth2.googleapis.com/token", json({ access_token: "at" })], [/messages\?/, json({ messages: [{ id: "m1" }] })], [/messages\/m1/, json(message)]]);
    const out = await gmail.checkGmail(db, { config: { clientId: "c", clientSecret: "s", refreshToken: "r", query: "newer_than:7d" }, now: NOW, send: web.send });
    assert.deepEqual([out.read, out.queued], [1, 1]);
    assert.ok(web.calls.find((c) => c.href.includes("messages/m1")).headers.authorization === "Bearer at");
    const [signal] = await store.signalsByOrigin(db, "newsletter");
    assert.equal(signal.url, "https://neotokyoproject.com/doujima/doumini-2026/");
  });

  await test("A whole worker tick runs offline in dry-run mode and leaves a heartbeat", async () => {
    const web = fakeWeb([[/robots\.txt$/, { status: 404, body: "" }]]);
    const report = await tick(db, { now: new Date(NOW.getTime() + 3 * 86400_000), send: web.send, responder: (await import("../server/lib/events/claude.js")).builtInResponder, config: { dryRun: true, sourcesPerTick: 2, signalsPerTick: 2, weatherEveryMinutes: 180, deliverEveryMinutes: 10, apiOrigin: "https://kiriya.love", cronSecret: null }, localDeliver: async () => ({ sent: 0, failed: 0, targets: 0 }) });
    assert.equal(report.sources.length, 2);
    assert.ok(!web.calls.some((c) => registry.blockedHost(c.href)), "no blocked host was contacted");
    const beat = await store.readSetting(db, "events_worker");
    assert.equal(beat.dryRun, true);
    assert.ok(beat.lastTickAt);
  });

  await test("Dossier helpers: date labels, stable source ids, the seven-stage timeline", () => {
    assert.equal(dossier.dateRangeText("2026-11-30", "2026-12-02"), "30 nov – 2 dec");
    assert.equal(dossier.dateRangeText("2026-12-25", "2027-01-03"), "25 dec 2026 – 3 jan 2027");
    const { sources, map } = dossier.mergeSources([{ id: "s1", label: "a", url: "https://a.sg/x?utm_source=ig", kind: "official", publisher: null, at: "2026-01-01", images: [] }], [{ id: "s1", label: "b", url: "https://b.sg/", kind: "news", publisher: null, at: null, images: [] }, { id: "s2", label: "a again", url: "https://a.sg/x", kind: "official", publisher: null, at: null, images: [] }]);
    assert.deepEqual(sources.map((s) => s.id), ["s1", "s2"]);
    assert.deepEqual(map, { s1: "s2", s2: "s1" });
    const steps = dossier.timelineFor({ timeline: [], startsOn: "2026-11-27", endsOn: "2026-11-29", dossier: { tickets: { status: "on_sale" } } }, "2026-11-28");
    assert.deepEqual(steps.map((s) => s.stage), dossier.STAGES);
    assert.equal(steps.find((s) => s.stage === "day").state, "now");
    assert.equal(steps.find((s) => s.stage === "tickets").state, "done");
  });
} finally {
  await client.close();
}
