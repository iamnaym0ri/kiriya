// Music, YouTube and Project SEKAI source adapters. Offline: every request goes through the real sourceHttp
// helper and is answered from scripts/fixtures/feeds/{vocadb,youtube,sekai,piapro,musicnews}/.
// VocaDB, SEKAI, piapro and ANN fixtures are trimmed live responses (2026-09-15); YouTube fixtures are
// documentation-faithful mocks because the API key exists only as a Vercel Sensitive value.
import assert from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";
import { FeedError } from "../server/feeds/config.js";
import { sourceHttp } from "../server/feeds/http.js";
import { defineSource, validateAdapterItem } from "../server/feeds/sources/registry.js";
import { ERAS, VOICEBANKS, UNIT_ALIASES } from "../server/feeds/sources/tags.js";
import { cursor as pageCursor } from "../server/feeds/sources/util.js";
import * as V from "../server/feeds/sources/vocadb.js";
import * as Y from "../server/feeds/sources/youtube.js";
import * as S from "../server/feeds/sources/sekai.js";
import * as P from "../server/feeds/sources/piapro.js";
import * as N from "../server/feeds/sources/musicnews.js";
import { fixture, fixtureTransport, publicLookup, runAdapterAll, runAdapterPage } from "./lib/feed-source-harness.mjs";

const DAY = "2026-09-15";
const NOW = Date.parse("2026-09-15T15:00:00Z"); // 23:00 in Singapore
const KEY = "test-youtube-key-never-in-output-8c1f";
const credentials = { YOUTUBE_API_KEY: KEY };
const json = async (dir, name) => JSON.parse((await fixture(dir, name)).toString("utf8"));
const rejectsWith = (promise, code) => assert.rejects(promise, (error) => error instanceof FeedError && error.code === code);
const googleCalls = (calls) => calls.filter((c) => c.url.startsWith("https://www.googleapis.com/"));
const param = (url, name) => new URL(url).searchParams.get(name);
const noKey = (value) => assert.ok(!JSON.stringify(value).includes(KEY), "the API key leaked into adapter output");
const empty = { items: [], term: "", totalCount: 0 };

function httpFor(entry, routes, calls = []) {
  const e = defineSource(entry);
  return sourceHttp({ ...e, paceMs: 0 }, { deadline: Date.now() + 60_000, stats: {}, send: fixtureTransport(e.id, routes, calls), lookup: publicLookup });
}

before(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
after(() => mock.timers.reset());

describe("entry contracts", () => {
  const entries = [V.vocadb, V.vocadbSongs, Y.youtubeMusic, Y.youtubeTutorials, Y.youtubeApothecary, S.sekaiGlobal, S.sekaiNewsGlobal, P.piaproNews, P.piaproGoods, N.annPressVocaloid, N.siliconeraMiku];

  test("every entry passes defineSource with exact hosts, bounded bytes and declared policies", () => {
    const ids = new Set();
    for (const raw of entries) {
      const entry = defineSource(raw);
      assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
      ids.add(entry.id);
      for (const host of [...entry.hosts, ...entry.mediaHosts, ...(entry.linkHosts ?? []), ...(entry.profileHosts ?? [])])
        assert.match(host, /^[a-z0-9.-]+\.[a-z]{2,}$/, `${entry.id}: ${host} must be an exact hostname`);
      assert.ok(entry.maxBytes <= 2 * 1024 * 1024, `${entry.id} maxBytes`);
      assert.ok(entry.maxRequests > 0 && entry.timeoutMs > 0 && entry.cacheSeconds > 0);
      if (entry.deletionPolicy !== "none") assert.equal(typeof entry.recheck, "function");
      if (entry.id !== "vocadb") {
        assert.ok(entry.notes.length > 40, `${entry.id} notes`);
        assert.ok(entry.docsUrl || entry.termsUrl, `${entry.id} policy URL`);
      }
    }
    for (const entry of [Y.youtubeMusic, Y.youtubeTutorials, Y.youtubeApothecary]) {
      assert.deepEqual(entry.requiredCredentials, ["YOUTUBE_API_KEY"]);
      assert.equal(entry.stage, "fetch-b");
      assert.equal(entry.mediaPolicy, "embed_provenance");
      assert.equal(entry.copyPolicy, "link_only");
      assert.equal(entry.cacheSeconds, 30 * 86400);
    }
    assert.deepEqual(V.vocadbSongs.optionalCredentials, ["YOUTUBE_API_KEY"]);
    assert.deepEqual(V.vocadbSongs.requiredCredentials, []);
    for (const entry of [S.sekaiGlobal, S.sekaiNewsGlobal, P.piaproNews, N.annPressVocaloid]) {
      assert.equal(entry.mediaPolicy, "link_only");
      assert.deepEqual(entry.mediaHosts, []);
    }
    assert.equal(N.siliconeraMiku.enabled, false);
    assert.equal(N.siliconeraMiku.status, "restricted");
  });

  test("the foundation fetchVocaDb export and vocadb entry still work unchanged", async () => {
    const result = await V.fetchVocaDb({
      limits: { items: 8 },
      http: { json: async () => [{ id: 123, name: "synthetic song", artistString: "Hatsune Miku, test producer", ratingScore: 500, pvs: [{ service: "Youtube", pvType: "Original", pvId: "abcdefghijk", disabled: false }] }] },
    });
    const song = validateAdapterItem(result.items[0], defineSource(V.vocadb));
    assert.equal(song.source, "vocadb");
    assert.equal(song.media[0].type, "youtube");
    assert.equal(defineSource(V.vocadb).enabled, true);
    assert.equal(defineSource(V.vocadb).copyPolicy, "link_only");
  });
});

describe("vocadb-songs", () => {
  const plan = V.vocadbPlan(DAY);
  const fixtureFor = new Map([
    ["new:hatsune miku", "songs-new-miku.json"],
    ["classics", "songs-classics.json"],
    ["story", "songs-story.json"],
    ["sekai", "songs-sekai.json"],
    ["unit", "songs-unit.json"],
    [`producer:${plan.find((s) => s.kind === "producer").producer}`, "songs-producer.json"],
  ]);
  const stepKey = (step) => (step.kind === "new" ? `new:${step.voicebank}` : step.kind === "producer" ? `producer:${step.producer}` : step.kind);
  const routes = plan.map((step) => {
    const file = fixtureFor.get(stepKey(step));
    return file ? { match: V.vocadbStepUrl(step, DAY), source: "vocadb", file } : { match: V.vocadbStepUrl(step, DAY), body: empty };
  });

  test("the day plan rotates deterministically: Miku new originals first, 3-4 producers, one of her units", () => {
    assert.deepEqual(plan[0], { kind: "new", voicebank: "hatsune miku" });
    assert.deepEqual(V.vocadbPlan(DAY), plan, "same day, same plan");
    const kinds = plan.map((s) => s.kind);
    assert.equal(kinds.filter((k) => k === "new").length, 3);
    for (const kind of ["classics", "story", "modern", "sekai", "unit"]) assert.equal(kinds.filter((k) => k === kind).length, 1, kind);
    const tomorrow = V.vocadbPlan("2026-09-16");
    assert.deepEqual(tomorrow[0], plan[0]);
    assert.notDeepEqual(tomorrow.slice(1).map(stepKey), plan.slice(1).map(stepKey), "order and picks change by day");
    assert.notEqual(tomorrow.find((s) => s.kind === "classics").offset, plan.find((s) => s.kind === "classics").offset);

    const counts = new Map();
    const dark = new Set(V.DARK_INTENSE_PRODUCERS.map((p) => p.id));
    for (let d = 0; d < 36; d++) {
      const day = new Date(NOW + d * 86_400_000).toISOString().slice(0, 10);
      const producers = V.producersForDay(day);
      assert.ok(producers.length === 3 || producers.length === 4);
      assert.equal(new Set(producers.map((p) => p.id)).size, producers.length);
      for (const p of producers) {
        assert.ok(!dark.has(p.id), `dark & intense producer ${p.name} rotated in`);
        counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      }
      const units = V.vocadbPlan(day).filter((s) => s.kind === "unit").map((s) => s.unit);
      assert.ok(units.every((u) => V.HER_UNIT_ARTIST_IDS.includes(u)));
      assert.ok(V.vocadbPlan(day).some((s) => s.kind === "new" && ["kagamine rin", "kagamine len"].includes(s.voicebank)));
    }
    assert.equal(counts.size, V.ROTATION_PRODUCERS.length, "every rotation producer gets a smidge within 36 days");
  });

  test("queries follow the plan with exclusions, child voicebanks and dated windows", () => {
    for (const step of plan) {
      const url = new URL(V.vocadbStepUrl(step, DAY));
      assert.equal(url.hostname, "vocadb.net");
      const excluded = url.searchParams.getAll("excludedTagIds[]").map(Number);
      for (const id of [9119, 9887, 10766, 11828, 320]) assert.ok(excluded.includes(id), `tag ${id} excluded`);
      assert.ok(excluded.includes(3151) && excluded.includes(10648), "child tags listed explicitly");
      assert.equal(url.searchParams.get("maxResults"), String(V.VOCADB_PAGE_SIZE));
      assert.ok(url.href.length < 1600);
      assert.ok(url.searchParams.getAll("artistId[]").length <= 1, "one artist per request (VocaDB ANDs artistId[])");
    }
    const newMiku = new URL(V.vocadbStepUrl(plan[0], DAY)).searchParams;
    assert.deepEqual(newMiku.getAll("artistId[]"), ["1"]);
    assert.equal(newMiku.get("childVoicebanks"), "true");
    assert.equal(newMiku.get("afterDate"), "2026-09-01");
    assert.equal(newMiku.get("beforeDate"), "2026-09-13");
    const teto = new URL(V.vocadbStepUrl({ kind: "new", voicebank: "kasane teto" }, DAY)).searchParams;
    assert.deepEqual(teto.getAll("artistId[]"), ["140308"]);
    const story = new URL(V.vocadbStepUrl(plan.find((s) => s.kind === "story"), DAY)).searchParams;
    assert.deepEqual(story.getAll("tagId[]"), ["6965"]);
    assert.ok(["14", "15"].includes(story.get("artistId[]")));
    const classics = new URL(V.vocadbStepUrl(plan.find((s) => s.kind === "classics"), DAY)).searchParams;
    assert.equal(classics.get("afterDate"), "2007-01-01");
    assert.equal(classics.get("beforeDate"), "2014-01-01");
    assert.deepEqual(new URL(V.vocadbStepUrl(plan.find((s) => s.kind === "sekai"), DAY)).searchParams.getAll("tagId[]"), ["7323"]);
  });

  test("a full keyless run pages through every step, tags songs and leaves playback null", async () => {
    const { items, calls, pages } = await runAdapterAll(V.vocadbSongs, { routes });
    assert.equal(pages, plan.length);
    assert.equal(calls.length, plan.length, "one VocaDB request per page and no YouTube calls without a key");
    assert.ok(calls.every((c) => c.url.startsWith("https://vocadb.net/api/songs?")));
    assert.ok(items.length >= 30);
    for (const item of items) {
      assert.equal(item.kind, "song");
      assert.equal(item.facts.playback, null);
      assert.equal(item.media.length, 1);
      assert.equal(item.media[0].type, "youtube");
      assert.match(item.media[0].poster, /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/hqdefault\.jpg$/);
      assert.match(item.url, /^https:\/\/vocadb\.net\/S\/\d+$/);
      assert.ok(item.facts.links.some((l) => l.kind === "listen" && l.url.startsWith("https://www.youtube.com/watch?v=")));
      assert.ok(item.facts.links.some((l) => l.kind === "source" && l.url === item.url));
      assert.equal(item.credit.platform, "VocaDB");
      assert.equal(item.credit.license, "VocaDB data CC BY; media retains its own rights");
      assert.ok(item.tags.voicebanks.length > 0 && item.tags.voicebanks.every((v) => VOICEBANKS.includes(v)));
      assert.ok(item.tags.fandoms.includes("vocaloid"));
      assert.ok(Date.parse(item.expiresAt) - NOW <= 30 * 86_400_000 && Date.parse(item.expiresAt) > NOW);
      assert.equal(item.tags.producers.join(), item.tags.producers.join().toLowerCase());
    }
    const byTitle = (title) => items.find((i) => i.title === title);
    // Child voicebanks: V6 for Miku, SV/UTAU for Teto, SP versions in SEKAI unit covers.
    assert.deepEqual(byTitle("Make Me♡").tags.voicebanks, ["hatsune miku"]);
    // Past the 8-item page limit, so checked directly: Kasane Teto SV/UTAU children map to "kasane teto".
    const teto = (await json("vocadb", "songs-story.json")).items.find((s) => s.id === 984470);
    assert.deepEqual(V.songVerdict(teto, { now: NOW }).voicebanks.sort(), ["gumi", "kagamine len", "kagamine rin", "kasane teto", "luka"]);
    assert.ok(!items.some((i) => i.nativeId === "984470"), "pages never exceed 8 items");
    const leo = byTitle("A balance scale, Touch with my fingertips");
    assert.deepEqual(leo.tags.units, ["leo/need"]);
    assert.deepEqual(leo.tags.voicebanks, ["kagamine rin"]);
    assert.ok(leo.tags.fandoms.includes("project sekai"));
    // Eras use the exact ERAS strings; producers are lowercase VocaDB names.
    assert.deepEqual(byTitle("Sakura Rain").tags.topics, [ERAS.classics]);
    assert.ok(byTitle("Dewdrops").tags.topics.includes(ERAS.story));
    assert.ok(byTitle("KING").tags.topics.includes(ERAS.modern));
    assert.deepEqual(byTitle("KING").tags.units, ["virtual singer"]);
    assert.deepEqual(byTitle("KING").tags.producers, ["kanaria"]);
    assert.deepEqual(byTitle("BRAINWASHED").tags.producers, ["deco*27", "hayato yamamoto"]);
    assert.equal(byTitle("BRAINWASHED").media[0].url, "https://www.youtube.com/watch?v=l1UOPIr76CA", "artist upload before the Topic track");
    assert.equal(byTitle("BRAINWASHED").media[0].identity, "youtube:l1UOPIr76CA");
    assert.equal(byTitle("BRAINWASHED").credit.profileUrl, "https://vocadb.net/Ar/45");
    assert.ok(byTitle("KING").facts.links.some((l) => l.label === "Spotify" && l.url.startsWith("https://open.spotify.com/")));
    // SEKAI pages put virtual singer songs first.
    const sekaiPage = await runAdapterPage(V.vocadbSongs, { routes, cursor: pageCursor.encode({ v: 1, d: DAY, i: plan.findIndex((s) => s.kind === "sekai") }) });
    assert.ok(sekaiPage.items.every((i) => i.tags.units.includes("virtual singer")));
  });

  test("dark & intense producers, excluded tags, unreleased songs and missing PVs are skipped", async () => {
    const { items } = await runAdapterAll(V.vocadbSongs, { routes });
    const titles = items.map((i) => i.title);
    for (const title of ["I’m a Part-timer!! lol", "And Then You Became the Moon", "Let's Say the P Names!", "World Domination How-To"])
      assert.ok(!titles.includes(title), `${title} credits MARETU, Kikuo or Neru`);
    const darkNames = V.DARK_INTENSE_PRODUCERS.map((p) => p.name.toLowerCase());
    assert.ok(items.every((i) => !i.tags.producers.some((p) => darkNames.includes(p))));
    assert.ok(!titles.includes("Lower one's eyes"), "no voicebank she follows");
    assert.ok(!titles.includes("Dark Woods Circus"), "no original YouTube PV");

    const songs = (await json("vocadb", "songs-new-miku.json")).items;
    const base = songs[0];
    assert.equal(V.songVerdict(base, { now: NOW }).ok, true);
    const tagged = (tag) => ({ ...base, tags: [...base.tags, { count: 1, tag }] });
    assert.equal(V.songVerdict(tagged({ id: 3151, name: "suggestive", categoryName: "Themes" }), { now: NOW }).reason, "excluded_tag");
    assert.equal(V.songVerdict(tagged({ id: 99999, name: "Udio", categoryName: "Sources" }), { now: NOW }).reason, "excluded_tag");
    assert.equal(V.songVerdict(tagged({ id: 99998, name: "bisexual", categoryName: "Themes" }), { now: NOW }).ok, true, "no substring false positives");
    const neru = { ...base, artists: [...base.artists, { artist: { id: 137, name: "Neru", artistType: "Producer" }, categories: "Producer", isSupport: false, name: "Neru" }] };
    assert.equal(V.songVerdict(neru, { now: NOW }).reason, "dark_intense_producer");
    assert.equal(V.songVerdict({ ...base, publishDate: "2026-10-01T00:00:00Z" }, { now: NOW }).reason, "unreleased");
    const disabled = { ...base, pvs: base.pvs.map((pv) => ({ ...pv, disabled: true })) };
    assert.equal(V.songVerdict(disabled, { now: NOW }).reason, "no_youtube_original");
    const gore = V.songVerdict(tagged({ id: 2971, name: "gore", categoryName: "Themes" }), { now: NOW });
    assert.ok(gore.ok && gore.warnings.includes("gore"), "content warnings pass through as source tags");
    const death = V.songVerdict(tagged({ id: 2821, name: "death", categoryName: "Themes" }), { now: NOW });
    assert.ok(!death.warnings.includes("death"), "narrative theme tags are not warnings");
  });

  test("with a key, one videos.list call per page records SG playback and drops unplayable songs", async () => {
    const calls = [];
    const { items, page } = await runAdapterPage(V.vocadbSongs, {
      credentials,
      calls,
      routes: [routes[0], { match: /^https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?/, source: "youtube", file: "videos-vocadb-page.json" }],
    });
    const google = googleCalls(calls);
    assert.equal(google.length, 1, "one batched videos.list call (1 quota unit)");
    assert.equal(param(google[0].url, "part"), "status,contentDetails");
    assert.equal(param(google[0].url, "key"), KEY);
    const ids = param(google[0].url, "id").split(",");
    assert.ok(ids.length <= V.YOUTUBE_BATCH && ids.includes("l1UOPIr76CA") && ids.includes("jqj1B18-oqg"));
    assert.deepEqual(items.map((i) => i.title), ["BRAINWASHED", "UNFEELING", "You're Alien too", "反転", "Party Monster"]);
    const brainwashed = items[0];
    assert.equal(brainwashed.media[0].url, "https://www.youtube.com/watch?v=jqj1B18-oqg", "falls back to the PV that plays in SG");
    assert.deepEqual(brainwashed.facts.playback, { embeddable: true, regionOk: true, ageRestricted: false, checkedAt: new Date(NOW).toISOString(), provenance: "vocadb_original" });
    assert.equal(items[1].media[0].url, "https://www.youtube.com/watch?v=BWppTirxFr0", "SG on the allowed list");
    assert.deepEqual(items[2].safety.labels, ["youtube:made_for_kids"]);
    assert.ok(items.every((i) => i.facts.playback.embeddable && i.facts.playback.regionOk && !i.facts.playback.ageRestricted));
    noKey({ items, page });
  });

  test("YouTube playback mapping: embeddable, SG allowed/blocked lists and age restriction", () => {
    const at = new Date(NOW).toISOString();
    const video = (patch = {}) => ({ id: "abcdefghijk", status: { embeddable: true, privacyStatus: "public", uploadStatus: "processed", ...patch.status }, contentDetails: { contentRating: {}, ...patch.contentDetails } });
    const map = (patch) => V.playbackFrom(video(patch), { provenance: "official_channel", checkedAt: at });
    assert.deepEqual(map(), { embeddable: true, regionOk: true, ageRestricted: false, checkedAt: at, provenance: "official_channel" });
    assert.equal(map({ status: { embeddable: false } }).embeddable, false);
    assert.equal(map({ status: { privacyStatus: "private" } }).embeddable, false);
    assert.equal(map({ status: { uploadStatus: "uploaded" } }).embeddable, false);
    assert.equal(map({ contentDetails: { regionRestriction: { blocked: ["SG"] } } }).regionOk, false);
    assert.equal(map({ contentDetails: { regionRestriction: { blocked: ["sg"] } } }).regionOk, false);
    assert.equal(map({ contentDetails: { regionRestriction: { blocked: ["MY", "US"] } } }).regionOk, true);
    assert.equal(map({ contentDetails: { regionRestriction: { blocked: [] } } }).regionOk, true, "empty blocked list: viewable everywhere");
    assert.equal(map({ contentDetails: { regionRestriction: { allowed: ["SG", "JP"] } } }).regionOk, true);
    assert.equal(map({ contentDetails: { regionRestriction: { allowed: ["JP"] } } }).regionOk, false);
    assert.equal(map({ contentDetails: { regionRestriction: { allowed: [] } } }).regionOk, false, "empty allowed list: blocked everywhere");
    assert.equal(map({ contentDetails: { contentRating: { ytRating: "ytAgeRestricted" } } }).ageRestricted, true);
    assert.equal(V.playable(map({ contentDetails: { contentRating: { ytRating: "ytAgeRestricted" } } })), false);
    assert.equal(V.playable(map()), true);
  });

  test("videos.list batches at most 50 IDs per call and drops invalid or duplicate IDs", async () => {
    const calls = [];
    const http = httpFor(V.vocadbSongs, [{ match: /googleapis\.com\/youtube\/v3\/videos\?/, body: { kind: "youtube#videoListResponse", items: [] } }], calls);
    const ids = Array.from({ length: 120 }, (_, i) => `vid${String(i).padStart(8, "0")}`);
    const videos = await V.youtubeVideos(http, KEY, [...ids, ids[0], "bad id", "short"], ["status"]);
    assert.equal(videos.size, 0);
    assert.deepEqual(calls.map((c) => param(c.url, "id").split(",").length), [50, 50, 20]);
    await rejectsWith(V.youtubeVideos(http, "", ids, ["status"]), "not_configured");
  });

  test("failures propagate instead of becoming empty pages", async () => {
    const step = routes[0].match;
    await rejectsWith(runAdapterPage(V.vocadbSongs, { routes: [{ match: step, status: 403, body: {} }] }), "blocked");
    await rejectsWith(runAdapterPage(V.vocadbSongs, { routes: [{ match: step, status: 429, body: {} }] }), "rate_limited");
    await rejectsWith(runAdapterPage(V.vocadbSongs, { routes: [{ match: step, body: "<html>", type: "text/html" }] }), "unexpected_content_type");
    await rejectsWith(runAdapterPage(V.vocadbSongs, { routes: [{ match: step, body: { unexpected: true } }] }), "invalid_source_json");
    await rejectsWith(
      runAdapterPage(V.vocadbSongs, {
        credentials,
        routes: [routes[0], { match: /googleapis\.com\/youtube\/v3\/videos\?/, status: 403, source: "youtube", file: "error-quota.json" }],
      }),
      "blocked",
    );
  });

  test("recheck: song present, deleted (302 to the 404 page), PV disabled, and YouTube status with a key", async () => {
    const song = await json("vocadb", "song-1028685.json");
    const item = { nativeId: "1028685", media: [{ type: "youtube", url: "https://www.youtube.com/watch?v=l1UOPIr76CA", identity: "youtube:l1UOPIr76CA" }] };
    const songRoute = (body, extra = {}) => ({ match: "https://vocadb.net/api/songs/1028685?", body, ...extra });
    const recheck = (routes, ctx = {}) => V.vocadbSongs.recheck(item, { http: httpFor(V.vocadbSongs, routes), ...ctx });

    assert.deepEqual(await recheck([songRoute(song)]), { state: "present", scope: "vocadb_pv" });
    assert.deepEqual(
      await recheck([songRoute("", { status: 302, headers: { location: "/Error?code=404&redirect=True" } }), { match: "https://vocadb.net/Error?code=404", status: 404, type: "text/html", body: "Not found" }]),
      { state: "removed", scope: "vocadb_song" },
    );
    const disabled = { ...song, pvs: song.pvs.map((pv) => (pv.pvId === "l1UOPIr76CA" ? { ...pv, disabled: true } : pv)) };
    assert.deepEqual(await recheck([songRoute(disabled)]), { state: "removed", scope: "vocadb_pv" });
    assert.deepEqual(await recheck([songRoute({ ...song, pvs: [] })]), { state: "restricted", scope: "vocadb_pv" });
    assert.deepEqual(await recheck([songRoute("", { status: 503 })]), { state: "transient", scope: "vocadb_song" });
    assert.deepEqual(await recheck([songRoute("", { status: 403 })]), { state: "restricted", scope: "vocadb_song" });

    const withVideos = (file) => [songRoute(song), { match: /googleapis\.com\/youtube\/v3\/videos\?/, source: "youtube", file }];
    assert.deepEqual(await recheck(withVideos("videos-recheck-ok.json"), { credentials }), { state: "present", scope: "youtube_playback" });
    assert.deepEqual(await recheck(withVideos("videos-recheck-blocked.json"), { credentials }), { state: "restricted", scope: "youtube_playback" });
    assert.deepEqual(await recheck(withVideos("videos-empty.json"), { credentials }), { state: "removed", scope: "youtube_video" });
  });
});

describe("youtube-music", () => {
  const plan = Y.youtubeMusicPlan(DAY);
  const uu = (channelId) => `UU${channelId.slice(2)}`;
  const byName = (name) => plan.find((c) => c.name === name);
  const playlistRoute = (channelName, extra) => ({ match: (url) => url.includes("/youtube/v3/playlistItems?") && url.includes(`playlistId=${uu(byName(channelName).id)}`), source: "youtube", ...extra });
  const videosRoute = (id, file) => ({ match: (url) => url.includes("/youtube/v3/videos?") && param(url, "id").split(",").includes(id), source: "youtube", file });

  async function routes() {
    const producer = (await json("vocadb", "songs-producer.json")).items.find((s) => s.id === 324798);
    const dark = (await json("vocadb", "songs-classics.json")).items.find((s) => s.id === 12328);
    const byPv = (id) => (url) => url.startsWith("https://vocadb.net/api/songs/byPv?") && param(url, "pvId") === id;
    return [
      { match: /\/youtube\/v3\/channels\?/, source: "youtube", file: "channels-music.json" },
      playlistRoute("Project SEKAI COLORFUL STAGE! (JP)", { file: "playlist-sekai-jp.json" }),
      playlistRoute("HATSUNE MIKU: COLORFUL STAGE! (Global)", { file: "playlist-sekai-en.json" }),
      playlistRoute("Hatsune Miku (Crypton)", { file: "playlist-empty.json" }),
      playlistRoute("piaproTV (Crypton)", { status: 404, file: "error-quota.json" }),
      playlistRoute("syudou", { file: "playlist-syudou.json" }),
      { match: (url) => url.includes("/youtube/v3/playlistItems?"), source: "youtube", file: "playlist-empty.json" },
      videosRoute("ul97PWn9gtk", "videos-sekai-jp.json"),
      videosRoute("EnTrailer01", "videos-sekai-en.json"),
      videosRoute("2TIVqjfzwQA", "videos-syudou.json"),
      { match: byPv("ul97PWn9gtk"), source: "vocadb", file: "bypv-sekai-unit.json" },
      { match: byPv("2TIVqjfzwQA"), body: producer },
      { match: byPv("DarkMatch01"), body: dark },
      { match: byPv("NoVocaDB001"), body: "null" },
    ];
  }

  test("the channel rotation keeps official channels daily and never includes dark & intense channels", () => {
    assert.equal(plan.length, 9);
    assert.deepEqual(plan.slice(0, 4).map((c) => c.official), [true, true, true, true]);
    const dark = new Set(Y.DARK_INTENSE_CHANNELS.map((c) => c.id));
    const seen = new Set();
    for (let d = 0; d < 8; d++) {
      const day = new Date(NOW + d * 86_400_000).toISOString().slice(0, 10);
      for (const channel of Y.youtubeMusicPlan(day)) {
        assert.ok(!dark.has(channel.id));
        seen.add(channel.id);
      }
    }
    assert.equal(seen.size, Y.MUSIC_CHANNELS.length, "all 22 channels covered within 8 days");
    assert.ok(Y.MUSIC_CHANNELS.every((c) => /^UC[\w-]{22}$/.test(c.id)));
  });

  test("requires the API key: missing credentials are not an empty success", async () => {
    await rejectsWith(runAdapterPage(Y.youtubeMusic, { routes: [] }), "not_configured");
  });

  test("a full run: channels.list once, uploads per channel, batched videos.list, byPv credits, strict playback filter", async () => {
    const { items, calls, pages } = await runAdapterAll(Y.youtubeMusic, { routes: await routes(), credentials });
    assert.equal(pages, 9);
    const google = googleCalls(calls);
    const method = (m) => google.filter((c) => c.url.includes(`/youtube/v3/${m}?`));
    assert.equal(method("channels").length, 1, "uploads playlists resolved once and carried in the cursor");
    assert.equal(param(method("channels")[0].url, "id").split(",").length, 9);
    assert.equal(method("playlistItems").length, 8, "Kanaria is not returned by channels.list, so it is skipped");
    assert.equal(method("videos").length, 3, "empty playlists cost no videos.list call");
    assert.equal(method("search").length, 0);
    assert.equal(google.length, 12, "quota units for this run");
    for (const call of method("videos")) {
      assert.equal(param(call.url, "part"), "snippet,status,contentDetails,statistics,player");
      assert.equal(param(call.url, "maxWidth"), "480");
      assert.ok(param(call.url, "id").split(",").length <= 50);
      assert.ok(!param(call.url, "id").includes("JpOldVideo1"), "uploads outside the 7-day window are not looked up");
    }
    assert.ok(google.every((c) => param(c.url, "key") === KEY));
    assert.ok(!calls.some((c) => Y.DARK_INTENSE_CHANNELS.some((d) => c.url.includes(d.id.slice(2)))));
    assert.equal(calls.filter((c) => c.url.includes("/api/songs/byPv?")).length, 4);

    assert.deepEqual(items.map((i) => i.nativeId), ["ul97PWn9gtk", "EnTrailer01", "2TIVqjfzwQA"]);
    const [unit, trailer, syudou] = items;
    assert.equal(unit.kind, "song");
    assert.deepEqual(unit.tags.units, ["leo/need"]);
    assert.ok(unit.tags.voicebanks.includes("kagamine rin"));
    assert.deepEqual(unit.tags.producers, ["ukaroku"]);
    assert.ok(unit.tags.fandoms.includes("project sekai"));
    assert.ok(unit.facts.links.some((l) => l.url === "https://vocadb.net/S/1011070"));
    assert.equal(trailer.kind, "video");
    assert.equal(trailer.credit.name, "HATSUNE MIKU: COLORFUL STAGE!");
    assert.equal(trailer.credit.profileUrl, "https://www.youtube.com/channel/UCeWCjteIDYK34E7bCZBTcLA");
    assert.equal(trailer.facts.sourceScore, 48000);
    assert.equal(trailer.media[0].duration, 65);
    assert.equal(syudou.kind, "song");
    assert.deepEqual(syudou.tags.producers, ["syudou"]);
    for (const item of items) {
      assert.equal(item.url, `https://www.youtube.com/watch?v=${item.nativeId}`);
      assert.deepEqual(item.facts.playback, { embeddable: true, regionOk: true, ageRestricted: false, checkedAt: new Date(NOW).toISOString(), provenance: "official_channel" });
      assert.equal(item.mediaIdentity, `youtube:${item.nativeId}`);
      assert.ok(Date.parse(item.expiresAt) - NOW <= 30 * 86_400_000);
    }
    const ids = items.map((i) => i.nativeId);
    for (const dropped of ["JpTrailer01", "JpShort0001", "EnBlockedSG", "EnAllowUSCA", "EnUpcoming1", "EnAgeLimit1", "DarkMatch01", "NoVocaDB001"])
      assert.ok(!ids.includes(dropped), `${dropped} must be dropped`);
    noKey({ items, calls: calls.filter((c) => !c.url.startsWith("https://www.googleapis.com/")) });
  });

  test("cursors carry the day, page index and uploads playlists but never the key", async () => {
    const { page } = await runAdapterPage(Y.youtubeMusic, { routes: await routes(), credentials });
    const state = pageCursor.decode(page.cursor);
    assert.equal(state.d, DAY);
    assert.equal(state.i, 1);
    assert.equal(state.u.length, 9);
    assert.deepEqual(plan.map((c) => c.name).slice(4), ["PinocchioP", "Kanaria", "syudou", "iyowa", "40mP"]);
    assert.equal(state.t, "111110111", "title check per channel; Kanaria (position 5) was not returned");
    assert.ok(page.cursor.length < 2000);
    noKey(page);
    const calls = [];
    await runAdapterPage(Y.youtubeMusic, { routes: await routes(), credentials, cursor: page.cursor, calls });
    assert.equal(calls.filter((c) => c.url.includes("/youtube/v3/channels?")).length, 0);
  });

  test("a channel whose returned title does not match its expected names keeps items but not owner provenance", async () => {
    const channels = await json("youtube", "channels-music.json");
    const renamed = { ...channels, items: channels.items.map((c) => (c.snippet.title === "syudou" ? { ...c, snippet: { ...c.snippet, title: "Someone Else Entirely" } } : c)) };
    const base = await routes();
    const { items } = await runAdapterAll(Y.youtubeMusic, { routes: [{ match: /\/youtube\/v3\/channels\?/, body: renamed }, ...base.slice(1)], credentials });
    assert.equal(items.find((i) => i.nativeId === "2TIVqjfzwQA").facts.playback.provenance, "unknown");
    assert.equal(items.find((i) => i.nativeId === "EnTrailer01").facts.playback.provenance, "official_channel");
    assert.equal(Y.channelTitleMatches(Y.MUSIC_CHANNELS[0], "プロジェクトセカイ カラフルステージ! feat. 初音ミク"), true);
    assert.equal(Y.channelTitleMatches(Y.MUSIC_CHANNELS.find((c) => c.name === "DECO*27"), "DECO＊27"), true, "full-width asterisk");
    assert.equal(Y.channelTitleMatches(Y.MUSIC_CHANNELS.find((c) => c.name === "Kanaria"), "YOASOBI"), false);
  });

  test("quota exhaustion and API errors propagate", async () => {
    await rejectsWith(runAdapterPage(Y.youtubeMusic, { credentials, routes: [{ match: /\/youtube\/v3\/channels\?/, status: 403, source: "youtube", file: "error-quota.json" }] }), "blocked");
    await rejectsWith(runAdapterPage(Y.youtubeMusic, { credentials, routes: [{ match: /\/youtube\/v3\/channels\?/, source: "youtube", file: "videos-empty.json" }] }), "invalid_source_json");
    await rejectsWith(
      runAdapterPage(Y.youtubeMusic, { credentials, routes: [{ match: /\/youtube\/v3\/channels\?/, body: { kind: "youtube#channelListResponse", items: [] } }] }),
      "youtube_channels_unavailable",
    );
  });

  test("Shorts detection and ISO 8601 durations", () => {
    assert.equal(Y.isoDurationSeconds("PT3M30S"), 210);
    assert.equal(Y.isoDurationSeconds("PT1H2M3S"), 3723);
    assert.equal(Y.isoDurationSeconds("P1DT1S"), 86401);
    assert.equal(Y.isoDurationSeconds("P0D"), 0);
    assert.equal(Y.isoDurationSeconds("nonsense"), null);
    const v = (duration, w, h, title = "a video") => ({ snippet: { title }, contentDetails: { duration }, player: w ? { embedWidth: String(w), embedHeight: String(h) } : undefined });
    assert.equal(Y.isShort(v("PT45S", 270, 480)), true);
    assert.equal(Y.isShort(v("PT2M50S", 270, 480)), true);
    assert.equal(Y.isShort(v("PT4M", 270, 480)), false, "a long vertical video is not a Short");
    assert.equal(Y.isShort(v("PT45S", 480, 270)), false, "a short landscape clip is not a Short");
    assert.equal(Y.isShort(v("PT45S")), true, "unknown shape, at most 60 s");
    assert.equal(Y.isShort(v("PT5M", 480, 270, "wig flip #shorts")), true);
  });

  test("recheck: present, removed, restricted, and transient without a key", async () => {
    const item = { nativeId: "l1UOPIr76CA" };
    const recheck = (file, ctx = { credentials }) => Y.youtubeMusic.recheck(item, { http: httpFor(Y.youtubeMusic, [{ match: /\/youtube\/v3\/videos\?/, source: "youtube", file }]), ...ctx });
    assert.deepEqual(await recheck("videos-recheck-ok.json"), { state: "present", scope: "youtube_playback" });
    assert.deepEqual(await recheck("videos-recheck-blocked.json"), { state: "restricted", scope: "youtube_playback" });
    assert.deepEqual(await recheck("videos-empty.json"), { state: "removed", scope: "youtube_video" });
    assert.deepEqual(await recheck("videos-empty.json", {}), { state: "transient", scope: "youtube_not_configured" });
    const quota = await Y.youtubeMusic.recheck(item, { credentials, http: httpFor(Y.youtubeMusic, [{ match: /\/youtube\/v3\/videos\?/, status: 403, source: "youtube", file: "error-quota.json" }]) });
    assert.deepEqual(quota, { state: "restricted", scope: "youtube_video" });
  });
});

describe("youtube-tutorials", () => {
  const routes = [
    { match: /\/youtube\/v3\/channels\?/, source: "youtube", file: "channels-tutorials.json" },
    { match: (url) => url.includes("/youtube/v3/playlistItems?") && url.includes("playlistId=UUbSST-QoAQKqtgZbmf3gI3g"), source: "youtube", file: "playlist-cowbutt.json" },
    { match: (url) => url.includes("/youtube/v3/playlistItems?") && url.includes("playlistId=UUiDvE4FTPu2oPIXyn6EJNcw"), status: 404, body: {} },
    { match: (url) => url.includes("/youtube/v3/playlistItems?"), source: "youtube", file: "playlist-empty.json" },
    { match: /\/youtube\/v3\/search\?/, source: "youtube", file: "search-tutorials.json" },
    { match: (url) => url.includes("/youtube/v3/videos?") && url.includes("CowWig00001"), source: "youtube", file: "videos-cowbutt.json" },
    { match: (url) => url.includes("/youtube/v3/videos?") && url.includes("SearchMake1"), source: "youtube", file: "videos-search.json" },
  ];

  test("channel uploads and strict searches become tutorials with cosplay formats and character mentions", async () => {
    const { items, calls, pages } = await runAdapterAll(Y.youtubeTutorials, { routes, credentials });
    assert.equal(pages, 6);
    const google = googleCalls(calls);
    const searches = google.filter((c) => c.url.includes("/youtube/v3/search?"));
    assert.equal(searches.length, Y.SEARCH_CALLS_PER_DAY, "at most 3 search.list calls a day (separate 100/day bucket)");
    for (const call of searches) {
      assert.equal(param(call.url, "safeSearch"), "strict");
      assert.equal(param(call.url, "type"), "video");
      assert.equal(param(call.url, "videoEmbeddable"), "true");
      assert.equal(param(call.url, "regionCode"), "SG");
      assert.ok(Y.TUTORIAL_QUERIES.includes(param(call.url, "q")));
    }
    assert.equal(google.filter((c) => c.url.includes("/youtube/v3/videos?")).length, 2, "a search result already emitted is not looked up again");
    assert.deepEqual(items.map((i) => i.nativeId), ["CowWig00001", "SearchMake1"]);
    const [wig, makeup] = items;
    assert.equal(wig.kind, "tutorial");
    assert.deepEqual(wig.sections, ["dressup"]);
    assert.deepEqual(wig.tags.formats, ["wig", "tutorial"]);
    assert.deepEqual(wig.tags.characters, ["hatsune miku"]);
    assert.deepEqual(wig.tags.voicebanks, [], "voicebank tags are for music items only");
    assert.equal(wig.facts.playback.provenance, "creator_upload");
    assert.deepEqual(makeup.tags.formats, ["makeup", "transformation"]);
    assert.deepEqual(makeup.tags.characters, ["frieren", "fern"], "tags.js mentions(): the series name also names Frieren");
    assert.deepEqual(makeup.tags.fandoms, ["frieren"]);
    assert.equal(makeup.facts.playback.provenance, "unknown");
    noKey(items);
  });

  test("cosplay format detection uses COSPLAY_FORMATS values only", () => {
    assert.deepEqual(Y.cosplayFormats("EVA foam armor props WIP and a photoshoot"), ["props", "wip", "photoshoot"]);
    assert.deepEqual(Y.cosplayFormats("How to style a wig"), ["wig", "tutorial"]);
    assert.deepEqual(Y.cosplayFormats("my con vlog"), []);
  });
});

describe("youtube-apothecary", () => {
  const routes = [
    { match: (url) => url.includes("/youtube/v3/channels?") && param(url, "forHandle") === "@TOHOanimation", source: "youtube", file: "channel-toho.json" },
    { match: (url) => url.includes("/youtube/v3/playlistItems?") && url.includes("playlistId=UUmockTOHOanimation00000"), source: "youtube", file: "playlist-toho.json" },
    { match: /\/youtube\/v3\/videos\?/, source: "youtube", file: "videos-toho.json" },
  ];

  test("resolves the verified handle once, keeps official Apothecary Diaries PVs from that channel only", async () => {
    Y.clearChannelCache();
    const calls = [];
    const { items, page } = await runAdapterPage(Y.youtubeApothecary, { routes, credentials, calls });
    assert.equal(page.done, true);
    assert.deepEqual(googleCalls(calls).map((c) => new URL(c.url).pathname.split("/").pop()), ["channels", "playlistItems", "videos"]);
    const videoIds = param(googleCalls(calls)[2].url, "id").split(",");
    assert.ok(videoIds.includes("KusuPV00001") && !videoIds.includes("OtherAnime1"), "uploads filtered by title before videos.list");
    assert.ok(videoIds.includes("9rProUQlD-I") && videoIds.includes("HP5wg0kTh54"), "official-site PVs are checked");
    assert.deepEqual(items.map((i) => i.nativeId), ["KusuPV00001", "9rProUQlD-I"]);
    for (const item of items) {
      assert.equal(item.kind, "video");
      assert.deepEqual(item.sections, ["maomao"]);
      assert.deepEqual(item.tags.fandoms, ["the apothecary diaries"]);
      assert.equal(item.facts.playback.provenance, "official_channel");
    }
    assert.deepEqual(items[0].tags.characters, ["maomao", "jinshi"]);
    const again = [];
    await runAdapterPage(Y.youtubeApothecary, { routes, credentials, calls: again });
    assert.equal(again.filter((c) => c.url.includes("/youtube/v3/channels?")).length, 0, "handle lookup cached");
    noKey(items);
  });
});

describe("sekai-global", () => {
  const DB = "https://sekai-world.github.io/sekai-master-db-en-diff/";
  const routes = [
    { match: `${DB}events.json`, status: 206, source: "sekai", file: "events-tail.txt" },
    { match: `${DB}worldBlooms.json`, source: "sekai", file: "worldBlooms.json" },
    { match: S.NEWS_URL, type: "text/plain", source: "sekai", file: "entries.txt" },
    { match: `${DB}musics.json`, source: "sekai", file: "musics.json" },
    { match: `${DB}musicTags.json`, source: "sekai", file: "musicTags.json" },
    { match: `${DB}musicVocals.json`, source: "sekai", file: "musicVocals.json" },
  ];

  test("current Global events only (future datamined rows excluded), read as a bounded tail range", async () => {
    const calls = [];
    const { items, page } = await runAdapterPage(S.sekaiGlobal, { routes, calls });
    assert.equal(page.done, false);
    assert.equal(calls[0].headers.range, `bytes=-${S.EVENTS_TAIL_BYTES}`);
    assert.ok(!calls.some((c) => /gachas|cards\.json/.test(c.url)));
    assert.equal(items.length, 1, "event 179 runs now; 176-178 ended and 180 starts on 26 Sep");
    const [event] = items;
    assert.equal(event.kind, "event");
    assert.equal(event.nativeId, "event:179");
    assert.equal(event.title, "Project SEKAI Global World Link: Link the Beats!");
    assert.equal(event.url, "https://www.colorfulstage.com/news/detail/001156.html", "official article matched by title and date");
    assert.equal(event.facts.eventAt, "2026-09-07T03:00:00.000Z");
    assert.equal(event.facts.eventEndAt, "2026-09-19T02:59:59.000Z");
    assert.equal(event.expiresAt, "2026-09-20T21:59:59.000Z");
    assert.deepEqual(event.tags.voicebanks.sort(), ["hatsune miku", "kagamine len", "kagamine rin", "kaito", "luka", "meiko"]);
    assert.deepEqual(event.tags.units, ["virtual singer"]);
    assert.deepEqual(event.media, []);
    assert.equal(event.credit.name, "Sekai-World community data");
  });

  test("new Global songs: published within 14 days and never in the future, virtual singers first", async () => {
    const { items, calls } = await runAdapterAll(S.sekaiGlobal, { routes });
    const songs = items.filter((i) => i.nativeId.startsWith("music:"));
    assert.deepEqual(songs.map((i) => i.nativeId), ["music:650", "music:629"]);
    for (const future of ["music:645", "music:656", "music:571"]) assert.ok(!items.some((i) => i.nativeId === future));
    assert.ok(songs.every((s) => Date.parse(s.facts.releaseAt) <= NOW));
    const [summer, eight] = songs;
    assert.equal(summer.title, "New song on Project SEKAI Global: That Summer Saturates");
    assert.deepEqual(summer.tags.units, ["nightcord at 25:00"], "school_refusal maps to Nightcord");
    assert.deepEqual(summer.tags.voicebanks.sort(), ["kagamine len", "kagamine rin"]);
    assert.ok(summer.facts.names.includes("Iori Kanzaki"));
    assert.deepEqual(eight.tags.units, ["more more jump!"]);
    assert.ok(items.every((i) => i.media.length === 0));
    assert.equal(calls.length, 6);
  });

  test("unit codes map through UNIT_ALIASES with fallbacks for codes it lacks", () => {
    assert.deepEqual(S.sekaiUnits(["school_refusal"]), ["nightcord at 25:00"]);
    assert.deepEqual(S.sekaiUnits(["light_sound"]), ["leo/need"]);
    assert.deepEqual(S.sekaiUnits(["light_music_club"]), ["leo/need"]);
    assert.deepEqual(S.sekaiUnits(["street"]), ["vivid bad squad"]);
    assert.deepEqual(S.sekaiUnits(["idol"]), ["more more jump!"]);
    assert.deepEqual(S.sekaiUnits(["theme_park"]), ["wonderlands×showtime"]);
    assert.deepEqual(S.sekaiUnits(["piapro"]), ["virtual singer"]);
    assert.deepEqual(S.sekaiUnits(["vocaloid"]), ["virtual singer"]);
    assert.deepEqual(S.sekaiUnits(["none", "all", "other", "unknown_code"]), []);
    assert.ok(S.sekaiUnits(["theme_park"]).every((u) => Object.keys(UNIT_ALIASES).includes(u)));
  });

  test("format changes, oversize files and blocked hosts fail loudly", async () => {
    await rejectsWith(runAdapterPage(S.sekaiGlobal, { routes: [{ match: `${DB}events.json`, status: 206, body: "<html>not json</html>" }] }), "sekai_events_format_changed");
    await rejectsWith(runAdapterPage(S.sekaiGlobal, { routes: [{ match: `${DB}events.json`, status: 200, body: "x".repeat(S.sekaiGlobal.maxBytes + 1) }] }), "response_too_large");
    await rejectsWith(runAdapterPage(S.sekaiGlobal, { routes: [{ match: `${DB}events.json`, status: 403, body: {} }] }), "blocked");
    assert.equal(S.parseEventsTail(await fixture("sekai", "events-full.json")).length, 5, "a whole file parses too");
  });
});

describe("sekai-news-global", () => {
  test("lenient parsing drops trailing commas outside strings only", async () => {
    const raw = (await fixture("sekai", "entries.txt")).toString("utf8");
    assert.throws(() => JSON.parse(raw));
    assert.equal(S.parseLenientJson(raw).news.length, 14);
    assert.deepEqual(S.parseLenientJson('{"a":[1,2,],"b":{"c":"x, ]",},}'), { a: [1, 2], b: { c: "x, ]" } });
    assert.deepEqual(S.parseLenientJson('{"q":"say \\"hi\\",}"}'), { q: 'say "hi",}' });
    assert.throws(() => S.parseLenientJson("{nope"), (e) => e.code === "invalid_source_json");
  });

  test("official news from the last 21 days, newest first, text and link only", async () => {
    const { items, calls } = await runAdapterPage(S.sekaiNewsGlobal, { routes: [{ match: S.NEWS_URL, type: "text/plain", source: "sekai", file: "entries.txt" }] });
    assert.equal(calls.length, 1);
    assert.equal(items.length, 8);
    assert.equal(items[0].title, "2026 Sep. Premium Gift Gacha");
    assert.equal(items[0].publishedAt, "2026-09-11T07:00:00.000Z", "newsDate is Pacific Time");
    assert.deepEqual(items[0].facts.dates, ["09.11.2026"]);
    assert.ok(items.every((i, n) => n === 0 || Date.parse(items[n - 1].publishedAt) >= Date.parse(i.publishedAt)));
    assert.ok(!items.some((i) => /Known Issue|Web Store|Media Tutorial/.test(i.title)), "old pinned posts are outside the window");
    for (const item of items) {
      assert.deepEqual(item.media, []);
      assert.deepEqual(item.facts.links, [{ kind: "official", label: "colorfulstage.com", url: item.url }]);
      assert.match(item.url, /^https:\/\/www\.colorfulstage\.com\/news\/detail\/\d+\.html$/);
    }
  });

  test("future-dated entries are excluded and PT dates convert across DST", async () => {
    const raw = (await fixture("sekai", "entries.txt")).toString("utf8");
    const future = raw.replace('"news": [', '"news": [\n{"targetUrl":"/news/detail/009999.html","thumimg":"/img/x.png","title":"Future Collab Reveal","newsDate":"2026年09月20日 00時00分00秒","updated":"09.20.2026","categoryBaseName":"news","category":"NEWS","description":"","pinArticle":"","newMark": true},');
    const { items } = await runAdapterPage(S.sekaiNewsGlobal, { routes: [{ match: S.NEWS_URL, type: "text/plain", body: future }] });
    assert.ok(!items.some((i) => i.title === "Future Collab Reveal"));
    assert.equal(S.newsDateToIso("2026年12月01日 09時30分00秒"), "2026-12-01T17:30:00.000Z");
    assert.equal(S.newsDateToIso("not a date"), null);
  });
});

describe("piapro", () => {
  const BLOG = "https://blog.piapro.net";
  const rss = (match, file) => ({ match, type: "application/rss+xml", source: "piapro", file });

  test("piapro-news rotates main, event and one tag feed per day, skips goods and repeats, keeps Japanese", async () => {
    assert.deepEqual(P.piaproNewsPlan(DAY), [`${BLOG}/feed`, `${BLOG}/category/event/feed`, `${BLOG}/tag/project-sekai/feed`]);
    assert.notDeepEqual(P.piaproNewsPlan("2026-09-16")[2], P.piaproNewsPlan(DAY)[2]);
    const { items, calls, pages } = await runAdapterAll(P.piaproNews, {
      routes: [rss(`${BLOG}/feed`, "feed.xml"), rss(`${BLOG}/category/event/feed`, "event.xml"), rss(`${BLOG}/tag/project-sekai/feed`, "tag-project-sekai.xml")],
    });
    assert.equal(pages, 3);
    assert.equal(calls.length, 3);
    assert.equal(items.length, 6);
    assert.equal(new Set(items.map((i) => i.nativeId)).size, 6, "a post in two feeds is emitted once");
    assert.ok(items.every((i) => !/グッズが登場|コラボグッズ/.test(i.title)), "goods posts belong to piapro-goods");
    for (const item of items) {
      assert.equal(item.kind, "news");
      assert.equal(item.facts.lang, "ja");
      assert.ok(item.facts.excerpts.every((e) => !e.includes("続きを読む")));
      assert.deepEqual(item.media, []);
      assert.equal(item.facts.links[0].kind, "official");
    }
    const leo = items.find((i) => i.title.startsWith("Leo/need"));
    assert.deepEqual(leo.tags.units, ["leo/need"]);
    assert.ok(leo.tags.fandoms.includes("project sekai"));
    assert.deepEqual(items.find((i) => i.title.startsWith("MORE MORE JUMP")).tags.units, ["more more jump!"], "full-width punctuation normalized");
  });

  test("piapro-goods copies only stated names, prices and dates, with a blog-hosted image", async () => {
    const { items } = await runAdapterPage(P.piaproGoods, { routes: [rss(`${BLOG}/category/goods/feed`, "goods.xml")] });
    assert.equal(items.length, 3);
    const [creco, figure, collab] = items;
    assert.deepEqual(creco.sections, ["merch", "music"]);
    assert.equal(creco.kind, "merch");
    assert.deepEqual(creco.facts.prices, [], "no price stated, none invented");
    assert.equal(creco.expiresAt, null);
    assert.ok(creco.facts.names.includes("きみとぼくのレゾナンス") && creco.facts.names.includes("レイニースノードロップ"));
    assert.ok(creco.facts.dates.includes("2026年9月11日(金) 12:00 ～ 2026年10月7日(水) 23:59"));
    assert.equal(creco.facts.preorderUntil, "2026-10-07T14:59:00.000Z");
    assert.deepEqual(creco.tags.topics, ["other goods"]);
    assert.equal(creco.media[0].url, `${BLOG}/wp-content/uploads/2026/09/e26091101.jpg`);
    assert.deepEqual(figure.facts.prices, ["12,980円（税込）"]);
    assert.ok(figure.facts.names.includes("初音ミク 新学期 フィギュア"));
    assert.ok(figure.facts.dates.includes("2027年8月予定"));
    assert.equal(figure.facts.preorderUntil, "2026-12-07T14:59:00.000Z");
    assert.equal(figure.facts.datePrecision, "datetime");
    assert.deepEqual(figure.tags.topics, ["scale figures"]);
    assert.equal(figure.media[0].url, `${BLOG}/wp-content/uploads/2036/09/ft2609101_1.jpg`, "emoji images from s.w.org are skipped");
    assert.equal(figure.expiresAt, "2026-09-16T16:00:00.000Z", "stated prices expire 48 h after the build day starts");
    assert.ok(collab.facts.prices.includes("1個：990円／1BOX：5,940円（税込）"));
    assert.ok(collab.tags.fandoms.includes("project sekai"));
    for (const item of items) {
      assert.equal(item.facts.lang, "ja");
      assert.deepEqual(item.facts.links, [{ kind: "official", label: "piapro blog", url: item.url }]);
    }
  });

  test("goods helpers: merch types, exact-period deadlines and image host policy", () => {
    assert.equal(P.piaproMerchType("グッドスマイルカンパニーより「ねんどろいど 初音ミク V6」が登場！"), "nendoroids");
    assert.equal(P.piaproMerchType("ピアプロキャラクターズ×OZaKKa 「肩乗りぬいぐるみショルダーパッド」"), "plushies");
    assert.equal(P.piaproMerchType("新作", ["グッズ", "アパレル"]), "fashion collab");
    assert.deepEqual(P.preorderDeadline(["9月10日～10月1日"]), { preorderUntil: null, datePrecision: null }, "no year stated, no deadline");
    assert.deepEqual(P.preorderDeadline(["2026年9月10日（木）～10月1日（木）"]), { preorderUntil: "2026-10-01T14:59:00.000Z", datePrecision: "day" });
    assert.equal(P.postImage('<img src="https://cdn.example.com/a.jpg"><img src="https://blog.piapro.net/wp-content/uploads/x.png">'), `${BLOG}/wp-content/uploads/x.png`);
    assert.equal(P.postImage('<img src="https://blog.piapro.net/wp-admin/x.png">'), null);
    assert.equal(P.goodsFacts("t", "<p>価格：ask the shop</p>").prices.length, 0, "a price key without a price is not a price");
  });

  test("feed failures propagate", async () => {
    await rejectsWith(runAdapterPage(P.piaproGoods, { routes: [{ match: `${BLOG}/category/goods/feed`, status: 403, body: "" }] }), "blocked");
    await rejectsWith(runAdapterPage(P.piaproGoods, { routes: [{ match: `${BLOG}/category/goods/feed`, type: "application/rss+xml", body: "<html><body>maintenance</body></html>" }] }), "invalid_source_xml");
  });
});

describe("music news", () => {
  test("ANN press releases are keyword-filtered to Miku, Vocaloid and SEKAI", async () => {
    const { items, calls } = await runAdapterPage(N.annPressVocaloid, {
      routes: [{ match: N.ANN_PRESS_FEED, type: "application/rss+xml", source: "musicnews", file: "ann-press.xml" }],
    });
    assert.equal(calls.length, 1);
    assert.equal(items.length, 2);
    assert.ok(items.every((i) => /Hatsune Miku/.test(i.title)));
    assert.ok(items.every((i) => i.credit.name === "Anime News Network" && i.facts.lang === "en" && i.media.length === 0));
    assert.ok(items.every((i) => i.tags.voicebanks.includes("hatsune miku")));
    assert.ok(N.MUSIC_KEYWORDS.test("Project SEKAI anniversary"));
    assert.ok(!N.MUSIC_KEYWORDS.test("Kaito Kid returns in Detective Conan"), "bare voicebank names are too ambiguous");
  });

  test("Siliconera is implemented but restricted and disabled", async () => {
    const { items } = await runAdapterPage(N.siliconeraMiku, {
      routes: [{ match: N.SILICONERA_MIKU_FEED, type: "application/rss+xml", source: "musicnews", file: "siliconera-miku.xml" }],
    });
    assert.ok(items.length > 0);
    assert.equal(defineSource(N.siliconeraMiku).enabled, false);
  });
});
