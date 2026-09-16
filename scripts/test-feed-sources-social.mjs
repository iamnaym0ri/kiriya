// Social source adapters (Bluesky, Tumblr, Lemmy) through the real sourceHttp helper with recorded fixtures.
// Keyless fixtures are trimmed live responses captured 2026-09-15; credentialed paths (Bluesky app-password
// sessions, Tumblr API) use documentation-faithful mocks with synthetic tokens, keys and blogs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("global fetch is not allowed in adapter tests");
};

const { fixture, fixtureTransport, publicLookup, runAdapterAll, runAdapterPage } = await import(
  "./lib/feed-source-harness.mjs"
);
const { sourceHttp } = await import("../server/feeds/http.js");
const { defineSource } = await import("../server/feeds/sources/registry.js");
const bsky = await import("../server/feeds/sources/bluesky.js");
const tumblr = await import("../server/feeds/sources/tumblr.js");
const lemmy = await import("../server/feeds/sources/lemmy.js");

bsky.BLUESKY_PACING.keylessSearchGapMs = 0;
const root = path.dirname(fileURLToPath(import.meta.url));

// Routes are tagged in place (not spread) so getter-based bodies stay live.
const inFamily = (family, routes) =>
  routes.map((r) => {
    if (!("source" in r)) r.source = family;
    return r;
  });
const json = async (family, name) => JSON.parse((await fixture(family, name)).toString("utf8"));
function httpFor(rawEntry, family, routes, calls = []) {
  const entry = defineSource(rawEntry);
  return sourceHttp(
    { ...entry, paceMs: 0 },
    {
      deadline: Date.now() + 60_000,
      stats: {},
      send: fixtureTransport(family, inFamily(family, routes), calls),
      lookup: publicLookup,
    },
  );
}
const byNative = (items) => Object.fromEntries(items.map((i) => [i.nativeId, i]));

// ---------------------------------------------------------------------------------------------------------
// Bluesky

const KUSURIYA = /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getFeed\?feed=at%3A%2F%2Fdid%3Aplc%3Aknoh46c6xff6lrdcfs2q5y4a/;
const VOCALOID = /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getFeed\?feed=[^&]*aaaixmavfk7jw/;
const SEKAI = /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getFeed\?feed=[^&]*aaaixpmeevmx6/;
const KEYLESS_SEARCH = /^https:\/\/api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts\?/;
const post = (did, rkey) => `at://${did}/app.bsky.feed.post/${rkey}`;

test("bluesky-maomao keyless: Kusuriya feed normalizes images/clips and drops labelled, bot, text-only and trade posts", async () => {
  bsky.resetBlueskySessions();
  const calls = [];
  const { page, items } = await runAdapterPage(bsky.blueskyMaomao, {
    day: "2026-09-14",
    calls,
    routes: inFamily("bluesky", [{ match: KUSURIYA, file: "feed-kusuriya.json" }]),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(page.done, false);
  assert.ok(page.cursor);
  const handles = items.map((i) => i.credit.handle).sort();
  assert.deepEqual(handles, [
    "miavalley.bsky.social",
    "murmurlilies.bsky.social",
    "owleyrie.bsky.social",
    "sadisticss.bsky.social",
    "tuiwkoo.bsky.social",
  ]);
  // porn label, !no-unauthenticated author, bot self-label, text-only, trade post, and a link to a shop
  // (sarumarux reaches the feed through bluesky-memes instead).
  for (const skipped of ["fusionduck", "irisopranta", "n1gpbot", "sanguogeo", "trade-aya-ken", "sarumarux"])
    assert.ok(!handles.some((h) => h.startsWith(skipped)), `${skipped} should be skipped`);
  const mother = items.find((i) => i.credit.handle === "tuiwkoo.bsky.social");
  assert.equal(mother.kind, "image");
  assert.deepEqual(mother.sections, ["maomao"]);
  assert.equal(mother.title, "Maomao sending off her mother");
  assert.match(mother.url, /^https:\/\/bsky\.app\/profile\/tuiwkoo\.bsky\.social\/post\/[a-z0-9]+$/);
  assert.equal(mother.credit.profileUrl, "https://bsky.app/profile/tuiwkoo.bsky.social");
  assert.equal(mother.credit.platform, "Bluesky");
  assert.ok(mother.tags.characters.includes("maomao"));
  assert.ok(mother.safety.sourceTags.includes("theapothecarydiaries"));
  assert.equal(mother.media[0].type, "image");
  assert.equal(new URL(mother.media[0].url).hostname, "cdn.bsky.app");
  assert.equal(mother.mediaIdentity, mother.media[0].identity);
  assert.match(mother.nativeId, /^at:\/\/did:plc:[a-z0-9]+\/app\.bsky\.feed\.post\//);
  const frog = items.find((i) => i.credit.handle === "owleyrie.bsky.social");
  assert.equal(frog.kind, "clip");
  assert.equal(frog.media[0].type, "hls");
  assert.equal(new URL(frog.media[0].url).hostname, "video.bsky.app");
  assert.equal(new URL(frog.media[0].poster).hostname, "video.bsky.app");
  assert.equal(frog.mediaIdentity, "bafkreid75b5fkzcazsx4okpqzpseu5xfkp4xzv6wsm3qsavfb6muq3o7ne");
  assert.ok(frog.tags.fandoms.includes("the apothecary diaries"), "hashtag #apothecarydiaries maps to the fandom");
  assert.equal(
    items.find((i) => i.credit.handle === "miavalley.bsky.social").title,
    "Is that some maomao from that poison show!?",
  );
  assert.ok(items.find((i) => i.credit.handle === "miavalley.bsky.social").tags.topics.includes("poison"));
  for (const item of items) {
    assert.deepEqual(item.safety.labels, []);
    assert.ok(item.facts.excerpts.every((e) => e.length <= 600));
  }
});

test("bluesky-maomao keyless: steps rotate through the cursor, searches hit api.bsky.app first page only", async () => {
  bsky.resetBlueskySessions();
  const { items, calls, pages } = await runAdapterAll(bsky.blueskyMaomao, {
    day: "2026-09-14",
    routes: inFamily("bluesky", [
      { match: KUSURIYA, file: "feed-kusuriya.json" },
      { match: KEYLESS_SEARCH, file: "search-maomao.json" },
    ]),
  });
  // Feed + three keyless searches; '#apothecarydiaries' needs a login and is skipped without one.
  assert.equal(pages, 4);
  assert.equal(calls.length, 4);
  const searches = calls.slice(1).map((c) => new URL(c.url));
  assert.deepEqual(
    searches.map((u) => u.searchParams.get("q")),
    ["maomao fanart", "#maomao", "猫猫 薬屋のひとりごと"],
  );
  for (const u of searches) {
    assert.equal(u.hostname, "api.bsky.app");
    assert.equal(u.searchParams.has("cursor"), false);
  }
  assert.equal(searches[0].searchParams.get("since"), "2026-09-12T15:59:59Z");
  assert.equal(searches[1].searchParams.has("since"), false, "a #hashtag query cannot be combined with since");
  assert.equal(searches[1].searchParams.get("sort"), "latest");
  // search-maomao.json: reply, text-only, porn-labelled and !no-unauthenticated posts are all skipped.
  const fromSearch = items.slice(5);
  assert.ok(fromSearch.every((i) => i.credit.handle === "murmurlilies.bsky.social"));
});

test("bluesky-cosplay: daily rotation, 48 h windows, fandom sections and adult/label skips", async () => {
  bsky.resetBlueskySessions();
  const monday = bsky.cosplaySteps("2026-09-13").map((s) => s.key);
  const tuesday = bsky.cosplaySteps("2026-09-14").map((s) => s.key);
  assert.equal(monday.length, 7);
  assert.deepEqual(monday.slice(0, 5), tuesday.slice(0, 5));
  assert.notDeepEqual(monday.slice(5), tuesday.slice(5));
  const routes = inFamily("bluesky", [{ match: KEYLESS_SEARCH, file: "search-mikucosplay.json" }]);
  const first = await runAdapterPage(bsky.blueskyCosplay, { day: "2026-09-13", routes });
  assert.deepEqual(first.items.map((i) => i.credit.handle).sort(), ["aya-kig.bsky.social", "maioliz.bsky.social"]);
  for (const item of first.items) {
    assert.equal(item.kind, "cosplay");
    assert.deepEqual(item.sections, ["dressup", "music"]);
    assert.ok(item.tags.voicebanks.includes("hatsune miku"));
  }
  const calls = [];
  const second = await runAdapterPage(bsky.blueskyCosplay, { day: "2026-09-13", routes, cursor: first.page.cursor, calls });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("q"), "miku cosplay");
  assert.equal(url.searchParams.get("since"), "2026-09-11T15:59:59Z");
  assert.notEqual(second.page.cursor, first.page.cursor);
  const all = await runAdapterAll(bsky.blueskyCosplay, { day: "2026-09-13", routes });
  assert.equal(all.pages, 7);
  assert.equal(new Set(all.calls.map((c) => c.url)).size, 7);
  const handles = new Set(all.items.map((i) => i.credit.handle));
  for (const skipped of ["theeroxyshow.bsky.social", "succubotnsfw.social.succuk.bsky.social"]) assert.ok(!handles.has(skipped));
});

test("bluesky-art: Miku/SEKAI fan art only; merch, #ad, video, card art, reposts and cosplay skipped", async () => {
  bsky.resetBlueskySessions();
  const { items, calls } = await runAdapterAll(bsky.blueskyArt, {
    day: "2026-09-14",
    routes: inFamily("bluesky", [
      { match: VOCALOID, file: "feed-vocaloid.json" },
      { match: SEKAI, file: "feed-sekai.json" },
    ]),
  });
  assert.equal(calls.length, 2, "logged-out art uses only the two feeds");
  assert.deepEqual(items.map((i) => i.credit.handle).sort(), [
    "agyou.bsky.social",
    "kaeidexi.bsky.social",
    "kanniiepan.bsky.social",
    "kitkatandcat1227.bsky.social",
    "mluckas.bsky.social",
  ]);
  for (const item of items) {
    assert.equal(item.kind, "image");
    assert.deepEqual(item.sections, ["music"]);
    assert.ok(item.media.every((m) => m.type === "image"));
  }
  assert.ok(items.find((i) => i.credit.handle === "kaeidexi.bsky.social").tags.fandoms.includes("project sekai"));
});

test("bluesky-fashion: J-fashion looks with FASHION_STYLES only from explicit tags", async () => {
  bsky.resetBlueskySessions();
  const { items } = await runAdapterPage(bsky.blueskyFashion, {
    day: "2026-09-14",
    routes: inFamily("bluesky", [{ match: KEYLESS_SEARCH, file: "search-lolitafashion.json" }]),
  });
  assert.deepEqual(items.map((i) => i.credit.handle).sort(), [
    "celestiayulamoon.bsky.social",
    "frillana.bsky.social",
    "mollymetaphora.bsky.social",
    "repede.bsky.social",
  ]);
  for (const item of items) {
    assert.equal(item.kind, "look");
    assert.deepEqual(item.sections, ["dressup"]);
  }
  assert.deepEqual(items.find((i) => i.credit.handle === "celestiayulamoon.bsky.social").tags.formats, ["sweet"]);
  assert.deepEqual(items.find((i) => i.credit.handle === "frillana.bsky.social").tags.formats, []);
});

test("bluesky-memes: text-only posts are dropped even from allowlisted accounts; feeds need meme cues", async () => {
  bsky.resetBlueskySessions();
  const { items, calls } = await runAdapterAll(bsky.blueskyMemes, {
    day: "2026-09-12",
    routes: inFamily("bluesky", [
      { match: /getAuthorFeed\?actor=adhdforreal\.bsky\.social/, file: "author-adhdforreal.json" },
      { match: /getAuthorFeed\?actor=/, body: { feed: [] } },
      { match: KUSURIYA, file: "feed-kusuriya.json" },
      { match: VOCALOID, file: "feed-vocaloid.json" },
      { match: SEKAI, file: "feed-sekai.json" },
    ]),
  });
  assert.equal(calls.length, 6);
  // Owner decision (2026-09-16, second pass): memes must carry an image or video. The allowlisted
  // text-post account contributes nothing now, and its images here are older than the 72 h window.
  const text = items.filter((i) => i.credit.handle === "adhdforreal.bsky.social");
  assert.deepEqual(text, [], "text-only posts no longer become memes");
  assert.ok(items.every((i) => i.media.length), "every meme carries media");
  assert.ok(items.every((i) => !i.tags.formats.includes("text_post")), "no text_post formats remain");
  const feedMemes = items.filter((i) => i.credit.handle !== "adhdforreal.bsky.social");
  assert.deepEqual(feedMemes.map((i) => i.credit.handle), ["sarumarux.bsky.social"]);
  assert.deepEqual(feedMemes[0].sections, ["meme", "maomao"]);
});

// --- Bluesky authenticated path (documented createSession/refreshSession shapes, synthetic tokens) -------

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const FIXTURE_DID = "did:plc:fixturefixturefixturefix";
const CREDENTIALS = { BLUESKY_HANDLE: "fixture-account.example", BLUESKY_APP_PASSWORD: "fixture-app-pass-0000" };
const CREATE = "https://bsky.social/xrpc/com.atproto.server.createSession";
const REFRESH = "https://bsky.social/xrpc/com.atproto.server.refreshSession";
let serial = 0;
function sessionResponse({ accessTtl = 7200, refreshTtl = 90 * 86400 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const n = ++serial;
  const jwt = (typ, scope, ttl) =>
    `${b64({ typ, alg: "ES256K" })}.${b64({ scope, sub: FIXTURE_DID, aud: "did:web:fixture.invalid", iat: now, exp: now + ttl, jti: `${typ}-${n}` })}.fixture-signature`;
  return {
    accessJwt: jwt("at+jwt", "com.atproto.appPass", accessTtl),
    refreshJwt: jwt("refresh+jwt", "com.atproto.refresh", refreshTtl),
    handle: "fixture-account.example",
    did: FIXTURE_DID,
    email: "fixture@example.invalid",
    emailConfirmed: true,
    active: true,
  };
}
function sessionServer({ accessTtl } = {}) {
  const issued = [];
  let current = null;
  const creates = {
    match: (href, options) => {
      if (href !== CREATE) return false;
      assert.equal(options.method, "POST");
      assert.equal(options.headers["content-type"], "application/json");
      assert.deepEqual(JSON.parse(options.body), {
        identifier: CREDENTIALS.BLUESKY_HANDLE,
        password: CREDENTIALS.BLUESKY_APP_PASSWORD,
      });
      current = sessionResponse({ accessTtl });
      issued.push(current);
      return true;
    },
    get body() {
      return current;
    },
  };
  const refreshes = {
    match: (href, options) => {
      if (href !== REFRESH) return false;
      assert.equal(options.method, "POST");
      assert.equal(options.headers.authorization, `Bearer ${issued.at(-1).refreshJwt}`);
      current = sessionResponse();
      issued.push(current);
      return true;
    },
    get body() {
      return current;
    },
  };
  return { issued, routes: [creates, refreshes] };
}
const authed = (issuedIndex, issued, prefix) => (href, options) =>
  href.startsWith(prefix) &&
  issued[issuedIndex] !== undefined &&
  options.headers.authorization === `Bearer ${issued[issuedIndex].accessJwt}` &&
  options.headers["atproto-proxy"] === "did:web:api.bsky.app#bsky_appview";
const FEED_VIA_ENTRYWAY = "https://bsky.social/xrpc/app.bsky.feed.getFeed?";
const SEARCH_VIA_ENTRYWAY = "https://bsky.social/xrpc/app.bsky.feed.searchPosts?";

test("bluesky auth: one createSession, reads through bsky.social with atproto-proxy, tokens never in output", async () => {
  bsky.resetBlueskySessions();
  const server = sessionServer();
  const routes = inFamily("bluesky", [
    ...server.routes,
    { match: authed(0, server.issued, FEED_VIA_ENTRYWAY), file: "feed-kusuriya.json" },
    { match: authed(0, server.issued, SEARCH_VIA_ENTRYWAY), file: "search-maomao.json" },
  ]);
  const result = await runAdapterAll(bsky.blueskyMaomao, { day: "2026-09-14", credentials: CREDENTIALS, routes });
  assert.equal(result.pages, 5, "the login unlocks the #apothecarydiaries step");
  assert.equal(server.issued.length, 1, "the session is reused across pages and entries");
  const hosts = result.calls.map((c) => new URL(c.url).hostname);
  assert.deepEqual(hosts, ["bsky.social", "bsky.social", "bsky.social", "bsky.social", "bsky.social", "bsky.social"]);
  assert.ok(result.calls.slice(1).every((c) => !new URL(c.url).searchParams.has("cursor")));
  const secrets = [
    server.issued[0].accessJwt,
    server.issued[0].refreshJwt,
    CREDENTIALS.BLUESKY_APP_PASSWORD,
    "fixture@example.invalid",
  ];
  const output = JSON.stringify(result.items);
  for (const secret of secrets) assert.ok(!output.includes(secret));
  // A second entry in the same process reuses the cached session instead of logging in again.
  const art = await runAdapterPage(bsky.blueskyArt, {
    day: "2026-09-14",
    credentials: CREDENTIALS,
    routes: inFamily("bluesky", [...server.routes, { match: authed(0, server.issued, FEED_VIA_ENTRYWAY), file: "feed-vocaloid.json" }]),
  });
  assert.equal(server.issued.length, 1);
  assert.ok(art.items.length > 0);
  assert.ok(!JSON.stringify(art.page).includes(server.issued[0].accessJwt));
});

test("bluesky auth: expired tokens refresh once and retry; a rejected login is blocked with a cooldown", async () => {
  bsky.resetBlueskySessions();
  // Rejected by the server (400 ExpiredToken): refresh, then retry with the new token.
  const server = sessionServer();
  const calls = [];
  const expired = await runAdapterPage(bsky.blueskyMaomao, {
    day: "2026-09-14",
    credentials: CREDENTIALS,
    calls,
    routes: inFamily("bluesky", [
      ...server.routes,
      { match: authed(0, server.issued, FEED_VIA_ENTRYWAY), status: 400, body: { error: "ExpiredToken", message: "Token has expired" } },
      { match: authed(1, server.issued, FEED_VIA_ENTRYWAY), file: "feed-kusuriya.json" },
    ]),
  });
  assert.equal(expired.items.length, 5);
  assert.deepEqual(
    calls.map((c) => c.url.split("?")[0]),
    [CREATE, "https://bsky.social/xrpc/app.bsky.feed.getFeed", REFRESH, "https://bsky.social/xrpc/app.bsky.feed.getFeed"],
  );

  // Near expiry by its `exp` claim: the next page refreshes before reading.
  bsky.resetBlueskySessions();
  const shortLived = sessionServer({ accessTtl: 30 });
  const pageCalls = [];
  const routes = inFamily("bluesky", [
    ...shortLived.routes,
    { match: authed(0, shortLived.issued, FEED_VIA_ENTRYWAY), file: "feed-kusuriya.json" },
    { match: authed(1, shortLived.issued, SEARCH_VIA_ENTRYWAY), file: "search-maomao.json" },
  ]);
  const one = await runAdapterPage(bsky.blueskyMaomao, { day: "2026-09-14", credentials: CREDENTIALS, routes, calls: pageCalls });
  await runAdapterPage(bsky.blueskyMaomao, { day: "2026-09-14", credentials: CREDENTIALS, routes, calls: pageCalls, cursor: one.page.cursor });
  assert.deepEqual(
    pageCalls.map((c) => c.url.split("?")[0]),
    [CREATE, "https://bsky.social/xrpc/app.bsky.feed.getFeed", REFRESH, "https://bsky.social/xrpc/app.bsky.feed.searchPosts"],
  );

  // Wrong app password: 401 → blocked, and no further createSession attempts during the cooldown.
  bsky.resetBlueskySessions();
  const denied = [];
  const denyRoutes = inFamily("bluesky", [
    { match: CREATE, status: 401, body: { error: "AuthenticationRequired", message: "Invalid identifier or password" } },
  ]);
  await assert.rejects(
    runAdapterPage(bsky.blueskyMaomao, { day: "2026-09-14", credentials: CREDENTIALS, routes: denyRoutes, calls: denied }),
    (error) => error.code === "blocked" && !String(error.message).includes(CREDENTIALS.BLUESKY_APP_PASSWORD),
  );
  assert.equal(denied.length, 1);
  await assert.rejects(
    runAdapterPage(bsky.blueskyCosplay, { day: "2026-09-14", credentials: CREDENTIALS, routes: denyRoutes, calls: denied }),
    (error) => error.code === "blocked",
  );
  assert.equal(denied.length, 1, "cooldown prevents hammering createSession");
  bsky.resetBlueskySessions();
});

test("bluesky errors propagate: 403 search, 429 rate limit, 5xx and malformed bodies are never empty pages", async () => {
  bsky.resetBlueskySessions();
  const searchCursor = (await runAdapterPage(bsky.blueskyMaomao, {
    day: "2026-09-14",
    routes: inFamily("bluesky", [{ match: KUSURIYA, file: "feed-kusuriya.json" }]),
  })).page.cursor;
  const attempt = (route, cursor = searchCursor) =>
    runAdapterPage(bsky.blueskyMaomao, { day: "2026-09-14", cursor, routes: inFamily("bluesky", [route]) });
  await assert.rejects(
    attempt({ match: KEYLESS_SEARCH, status: 403, type: "text/html", body: "<h1>403 Forbidden</h1>Request forbidden by administrative rules." }),
    (e) => e.code === "blocked",
  );
  await assert.rejects(
    attempt({ match: KEYLESS_SEARCH, status: 429, headers: { "retry-after": "0" }, body: { error: "RateLimitExceeded" } }),
    (e) => e.code === "rate_limited",
  );
  await assert.rejects(attempt({ match: KUSURIYA, status: 502, headers: { "retry-after": "0" }, body: {} }, null), (e) => e.code === "source_http_502");
  await assert.rejects(attempt({ match: KUSURIYA, body: { unexpected: true } }, null), (e) => e.code === "source_shape");
});

test("bluesky recheck: batched getPosts → present, removed, ineligible labels, restricted and transient", async () => {
  const live = post("did:plc:tmpdeyklvkf7n5v4x5tjltjp", "3mvj627tbg22x");
  const gone = post("did:plc:tmpdeyklvkf7n5v4x5tjltjp", "3aaaaaaaaaaaa");
  const calls = [];
  const http = httpFor(bsky.blueskyMemes, "bluesky", [{ match: /getPosts\?/, file: "getposts.json" }], calls);
  const verdicts = await bsky.recheckBlueskyMany(
    [{ nativeId: live }, { nativeId: gone }, { nativeId: "https://bsky.app/not-an-at-uri" }],
    { http },
  );
  assert.deepEqual(verdicts, [
    { state: "present", scope: "post" },
    { state: "removed", scope: "post" },
    { state: "restricted", scope: "unverifiable_id" },
  ]);
  assert.equal(calls.length, 1);
  assert.deepEqual(new URL(calls[0].url).searchParams.getAll("uris"), [live, gone]);
  assert.equal(new URL(calls[0].url).hostname, "public.api.bsky.app");

  const labelled = await json("bluesky", "getposts.json");
  labelled.posts[0].author.labels = [
    { src: "did:plc:tmpdeyklvkf7n5v4x5tjltjp", uri: "at://did:plc:tmpdeyklvkf7n5v4x5tjltjp/app.bsky.actor.profile/self", val: "!no-unauthenticated", cts: "1970-01-01T00:00:00.000Z" },
  ];
  const relabelled = httpFor(bsky.blueskyMemes, "bluesky", [{ match: /getPosts\?/, body: labelled }]);
  assert.deepEqual(await bsky.blueskyMemes.recheck({ nativeId: live }, { http: relabelled }), {
    state: "removed",
    scope: "ineligible_labels",
  });
  const down = httpFor(bsky.blueskyMemes, "bluesky", [{ match: /getPosts\?/, status: 503, headers: { "retry-after": "0" }, body: {} }]);
  assert.deepEqual(await bsky.recheckBluesky({ nativeId: live }, { http: down }), { state: "transient", scope: "post" });
  const forbidden = httpFor(bsky.blueskyMemes, "bluesky", [{ match: /getPosts\?/, status: 403, body: {} }]);
  assert.deepEqual(await bsky.recheckBluesky({ nativeId: live }, { http: forbidden }), { state: "restricted", scope: "post" });

  const batchCalls = [];
  const batchHttp = httpFor({ ...bsky.blueskyMemes, maxRequests: 5 }, "bluesky", [{ match: /getPosts\?/, file: "getposts.json" }], batchCalls);
  const many = Array.from({ length: 30 }, (_, i) => ({ nativeId: post("did:plc:tmpdeyklvkf7n5v4x5tjltjp", `3zz${String(i).padStart(4, "0")}`) }));
  const batch = await bsky.recheckBlueskyMany(many, { http: batchHttp });
  assert.equal(batchCalls.length, 2);
  assert.deepEqual(batchCalls.map((c) => new URL(c.url).searchParams.getAll("uris").length), [25, 5]);
  assert.ok(batch.every((v) => v.state === "removed"));
});

// ---------------------------------------------------------------------------------------------------------
// Tumblr

const RSS_TYPE = "text/xml; charset=utf-8";
const TUMBLR_KEY = { TUMBLR_API_KEY: "fixture-consumer-key-not-real" };
const tagged = (tag) => (href) =>
  href.startsWith("https://api.tumblr.com/v2/tagged?") && new URL(href).searchParams.get("tag") === tag;

test("tumblr-memes RSS: canonical URLs, text-only/reblog/off-topic posts skipped, expiresAt ≤ 72 h", async () => {
  const before = Date.now();
  const { items, calls, pages } = await runAdapterAll(tumblr.tumblrMemes, {
    day: "2026-09-09",
    routes: inFamily("tumblr", [
      { match: "https://pjsk--shitposts.tumblr.com/rss", type: RSS_TYPE, file: "rss-pjsk--shitposts.xml" },
      { match: "https://project-sekai-but-incorrect.tumblr.com/rss", type: RSS_TYPE, file: "rss-project-sekai-but-incorrect.xml" },
    ]),
  });
  assert.equal(pages, 2);
  assert.equal(calls.length, 2);
  const found = byNative(items);
  // Owner decision (2026-09-16, second pass): a meme must be something you can look at, so text-only
  // posts (including the quote posts this blog favours) are dropped at the adapter rather than
  // collected and rejected later. Only the two posts carrying images survive.
  assert.deepEqual(Object.keys(found).sort(), ["827305658892337152", "827770718343331840"]);
  for (const skipped of [
    "827246622567202816", "827032510046339072", "826867435873370112", "827212982434070528",
    // Text-only from here down: a plain text post, two quote posts and a dialogue quote.
    "827790989093715969", "827306251538087937", "827757145859719168", "827757146956546048",
    "827757148759015424",
  ])
    assert.equal(found[skipped], undefined);
  assert.ok(items.every((i) => i.media.length), "every meme carries media");
  assert.ok(items.every((i) => !i.tags.formats.includes("text_post")), "no text_post formats remain");
  const image = found["827770718343331840"];
  assert.equal(image.credit.name, "pjsk--shitposts");
  assert.equal(image.credit.profileUrl, "https://www.tumblr.com/pjsk--shitposts");
  assert.equal(image.media.length, 1);
  assert.equal(new URL(image.media[0].url).hostname, "64.media.tumblr.com");
  assert.match(image.media[0].url, /\/s1280x1920\//);
  assert.equal(image.media[0].width, 1280);
  assert.match(image.mediaIdentity, /^tumblr-media:[0-9a-f]{32}\/[0-9a-z]+-[0-9a-z]+$/);
  for (const item of items) {
    const expires = Date.parse(item.expiresAt);
    assert.ok(expires <= Date.now() + 72 * 3600_000 && expires >= before + 71 * 3600_000);
  }
  assert.equal(defineSource(tumblr.tumblrMemes).copyPolicy, "link_only");
});

test("tumblr-maomao (mocked API): NPF and legacy posts, GIF posters, source attribution and skips", async () => {
  const calls = [];
  const { items, pages } = await runAdapterAll(tumblr.tumblrMaomao, {
    day: "2026-09-14",
    credentials: TUMBLR_KEY,
    calls,
    routes: inFamily("tumblr", [
      { match: tagged("the apothecary diaries"), file: "tagged-apothecary-npf.json" },
      { match: tagged("kusuriya no hitorigoto"), file: "tagged-kusuriya-legacy.json" },
      { match: tagged("maomao"), file: "tagged-maomao-npf.json" },
    ]),
  });
  assert.equal(pages, 3);
  const found = byNative(items);
  assert.deepEqual(Object.keys(found).sort(), [
    "790000000000000001",
    "790000000000000002",
    "790000000000000004",
    "790000000000000101",
    "790000000000000102",
    "790000000000000202",
  ]);
  const still = found["790000000000000001"];
  assert.equal(still.kind, "image");
  assert.equal(still.url, "https://www.tumblr.com/example-herbalist-art/790000000000000001");
  assert.equal(still.media[0].width, 1280);
  assert.equal(still.media[0].alt, "maomao holding a small vial");
  assert.ok(still.tags.topics.length === 0 && still.tags.fandoms.includes("the apothecary diaries"));
  const gif = found["790000000000000002"];
  assert.equal(gif.kind, "clip");
  assert.equal(gif.media[0].type, "gif");
  assert.match(gif.media[0].poster, /^https:\/\/64\.media\.tumblr\.com\/.+\.jpg$/);
  const sourced = found["790000000000000004"];
  assert.deepEqual(sourced.facts.links, [
    { kind: "source", label: "original source: example_artist", url: "https://x.com/example_artist/status/1" },
  ]);
  assert.equal(sourced.credit.name, "example-fanart-archive");
  assert.equal(found["790000000000000101"].media[0].url.endsWith("tumblr_fixture101o1_1280.jpg"), true);
  assert.match(found["790000000000000102"].media[0].url, /\/s1280x1920\//);
  assert.ok(found["790000000000000202"].tags.fandoms.includes("the apothecary diaries"));
  const output = JSON.stringify(items);
  assert.ok(!output.includes(TUMBLR_KEY.TUMBLR_API_KEY), "the API key stays in request URLs only");
  assert.ok(calls.every((c) => new URL(c.url).searchParams.get("api_key") === TUMBLR_KEY.TUMBLR_API_KEY));
  assert.ok(calls.every((c) => new URL(c.url).searchParams.get("npf") === "true"));
  for (const item of items) assert.ok(Date.parse(item.expiresAt) <= Date.now() + 72 * 3600_000);
});

test("tumblr-cosplay: key required, daily tag rotation, sections from tags", async () => {
  await assert.rejects(
    runAdapterPage(tumblr.tumblrCosplay, { day: "2026-09-14", routes: [] }),
    (e) => e.code === "not_configured",
  );
  assert.deepEqual(defineSource(tumblr.tumblrCosplay).requiredCredentials, ["TUMBLR_API_KEY"]);
  const a = tumblr.tumblrCosplayTags("2026-09-14").map((t) => t.tag);
  const b = tumblr.tumblrCosplayTags("2026-09-15").map((t) => t.tag);
  assert.deepEqual(a.slice(0, 3), ["maomao cosplay", "hatsune miku cosplay", "miku cosplay"]);
  assert.notDeepEqual(a.slice(3), b.slice(3));
  const { items, page } = await runAdapterPage(tumblr.tumblrCosplay, {
    day: "2026-09-14",
    credentials: TUMBLR_KEY,
    routes: inFamily("tumblr", [{ match: tagged("maomao cosplay"), file: "tagged-cosplay-npf.json" }]),
  });
  assert.equal(page.done, false);
  const found = byNative(items);
  assert.deepEqual(Object.keys(found).sort(), ["790000000000000301", "790000000000000302"]);
  assert.deepEqual(found["790000000000000301"].sections, ["dressup", "maomao"]);
  assert.deepEqual(found["790000000000000301"].tags.formats, ["wig"]);
  assert.deepEqual(found["790000000000000302"].sections, ["dressup", "music"]);
});

test("tumblr errors propagate: 401 blocked, 429 rate limited, RSS 404 not found", async () => {
  const run = (entry, route, credentials = TUMBLR_KEY) =>
    runAdapterPage(entry, { day: "2026-09-14", credentials, routes: inFamily("tumblr", [route]) });
  await assert.rejects(
    run(tumblr.tumblrMaomao, { match: tagged("the apothecary diaries"), status: 401, body: { meta: { status: 401, msg: "Unauthorized" } } }),
    (e) => e.code === "blocked",
  );
  await assert.rejects(
    run(tumblr.tumblrMaomao, { match: tagged("the apothecary diaries"), status: 429, headers: { "retry-after": "0" }, body: { meta: { status: 429 } } }),
    (e) => e.code === "rate_limited",
  );
  await assert.rejects(
    run(tumblr.tumblrMemes, { match: "https://pjsk--shitposts.tumblr.com/rss", status: 404, type: "text/html", body: "not found" }, {}),
    (e) => e.code === "not_found",
  );
});

test("tumblr recheck: API present/removed/labelled/restricted/transient; keyless RSS never asserts deletion", async () => {
  const item = { nativeId: "790000000000000001", url: "https://www.tumblr.com/example-herbalist-art/790000000000000001" };
  const lookup = (href) => href.startsWith("https://api.tumblr.com/v2/blog/example-herbalist-art/posts?");
  const calls = [];
  const ok = httpFor(tumblr.tumblrMaomao, "tumblr", [{ match: lookup, file: "blog-post-lookup.json" }], calls);
  assert.deepEqual(await tumblr.recheckTumblr(item, { http: ok, credentials: TUMBLR_KEY }), { state: "present", scope: "api_post" });
  assert.equal(new URL(calls[0].url).searchParams.get("id"), "790000000000000001");
  const labelled = await json("tumblr", "blog-post-lookup.json");
  labelled.response.posts[0].community = { has_content_label: true, content_label_categories: ["mature"] };
  const verdict = async (route, credentials = TUMBLR_KEY, target = item) =>
    tumblr.recheckTumblr(target, { http: httpFor(tumblr.tumblrMemes, "tumblr", [route]), credentials });
  assert.deepEqual(await verdict({ match: lookup, body: labelled }), { state: "removed", scope: "ineligible_labels" });
  assert.deepEqual(await verdict({ match: lookup, status: 404, body: { meta: { status: 404 } } }), { state: "removed", scope: "api_post" });
  assert.deepEqual(await verdict({ match: lookup, status: 401, body: {} }), { state: "restricted", scope: "api_post" });
  assert.deepEqual(await verdict({ match: lookup, status: 500, headers: { "retry-after": "0" }, body: {} }), { state: "transient", scope: "api_post" });
  // No key: RSS presence only.
  const rss = { match: "https://pjsk--shitposts.tumblr.com/rss", type: RSS_TYPE, file: "rss-pjsk--shitposts.xml" };
  const memeItem = { nativeId: "827790989093715969", url: "https://www.tumblr.com/pjsk--shitposts/827790989093715969" };
  assert.deepEqual(await verdict(rss, {}, memeItem), { state: "present", scope: "rss_window" });
  assert.deepEqual(
    await verdict(rss, {}, { nativeId: "827000000000000000", url: "https://www.tumblr.com/pjsk--shitposts/827000000000000000" }),
    { state: "transient", scope: "rss_window" },
  );
  assert.deepEqual(await tumblr.recheckTumblr(item, { http: null, credentials: {} }), { state: "transient", scope: "no_api_key" });
  assert.deepEqual(await tumblr.recheckTumblr({ nativeId: "1", url: "https://example.invalid/1" }, { http: null }), {
    state: "restricted",
    scope: "unverifiable_id",
  });
});

// ---------------------------------------------------------------------------------------------------------
// Lemmy

const LEMMY_ROUTES = inFamily(
  "lemmy",
  lemmy.LEMMY_COMMUNITIES.map((c) => ({
    match: (href) => {
      const u = new URL(href);
      return u.hostname === c.host && u.pathname === "/api/v3/post/list" && u.searchParams.get("community_name") === c.name;
    },
    file: `${c.name}-${c.host}.json`,
  })),
);

test("lemmy-memes: TopDay page normalization, own-pictrs media, ap_id URLs and eligibility flags", async () => {
  const calls = [];
  const { items, page } = await runAdapterPage(lemmy.lemmyMemes, { routes: LEMMY_ROUTES, calls });
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("sort"), "TopDay");
  assert.equal(page.done, false);
  assert.equal(items.length, 6, "the lemmy.ml-origin post is skipped (foreign host)");
  const inbox = byNative(items)["lemmy.world:51913271"];
  assert.equal(inbox.url, "https://lemmy.world/post/51913271");
  assert.equal(inbox.kind, "meme");
  assert.deepEqual(inbox.sections, ["meme"]);
  assert.deepEqual(inbox.media.map((m) => m.url), ["https://lemmy.world/pictrs/image/cfcb1154-ca88-474f-a161-c4c0da1963da.jpeg"]);
  assert.equal(inbox.mediaIdentity, "pictrs:lemmy.world/cfcb1154-ca88-474f-a161-c4c0da1963da");
  assert.equal(inbox.credit.handle, "gigaqps@lemmy.world");
  assert.equal(inbox.credit.profileUrl, "https://lemmy.world/u/gigaqps");
  assert.equal(inbox.credit.platform, "Lemmy · !memes@lemmy.world");
  assert.equal(inbox.facts.sourceScore, 563);

  const base = await json("lemmy", "memes-lemmy.world.json");
  const flagged = structuredClone(base);
  flagged.posts[0].post.nsfw = true;
  flagged.posts[1].post.deleted = true;
  flagged.posts[2].post.removed = true;
  flagged.posts[3].creator.bot_account = true;
  flagged.posts[4].post.featured_community = true;
  const reduced = await runAdapterPage(lemmy.lemmyMemes, {
    routes: inFamily("lemmy", [{ match: /\/api\/v3\/post\/list\?/, body: flagged }]),
  });
  assert.equal(reduced.items.length, 1);
  const nsfwCommunity = structuredClone(base);
  for (const view of nsfwCommunity.posts) view.community.nsfw = true;
  const none = await runAdapterPage(lemmy.lemmyMemes, {
    routes: inFamily("lemmy", [{ match: /\/api\/v3\/post\/list\?/, body: nsfwCommunity }]),
  });
  assert.equal(none.items.length, 0);
  assert.equal(none.page.done, false, "an empty community page still advances the cursor");
});

test("lemmy-memes: rotation alternates instances, unwraps own-instance proxies, minecraft is memes-only", async () => {
  const { items, calls, pages } = await runAdapterAll(lemmy.lemmyMemes, { routes: LEMMY_ROUTES });
  assert.equal(pages, 7);
  assert.deepEqual(
    calls.map((c) => new URL(c.url).hostname),
    ["lemmy.world", "ani.social", "lemmy.world", "ani.social", "lemmy.world", "ani.social", "lemmy.world"],
  );
  assert.equal(items.length, 10);
  const found = byNative(items);
  const proxied = items.find((i) => i.credit.platform === "Lemmy · !animemes@ani.social");
  assert.ok(proxied && found[proxied.nativeId], "the lemmy.world-origin animemes post is kept");
  assert.equal(proxied.url, "https://lemmy.world/post/51932553");
  assert.equal(proxied.media[0].url, "https://lemmy.world/pictrs/image/046f4e7e-7305-43cb-bc0e-3cda6588b2f8.png");
  assert.equal(proxied.credit.platform, "Lemmy · !animemes@ani.social");
  const miku = items.find((i) => i.credit.platform === "Lemmy · !hatsunemiku@lemmy.world");
  assert.deepEqual(miku.sections, ["meme", "music"]);
  assert.equal(new URL(miku.media[0].url).hostname, "ani.social");
  assert.ok(!items.some((i) => i.credit.platform.includes("minecraft")), "no Minecraft post had a meme cue");
});

test("lemmy recheck: post lookup → present, deleted, removed, nsfw, not found, restricted, transient", async () => {
  const item = { nativeId: "lemmy.world:51913271" };
  const lookup = (href) => href === "https://lemmy.world/api/v3/post?id=51913271";
  const base = await json("lemmy", "post-51913271.json");
  const verdict = async (route) => lemmy.recheckLemmy(item, { http: httpFor(lemmy.lemmyMemes, "lemmy", [route]) });
  assert.deepEqual(await verdict({ match: lookup, file: "post-51913271.json" }), { state: "present", scope: "post" });
  const variant = (mutate) => {
    const copy = structuredClone(base);
    mutate(copy.post_view);
    return { match: lookup, body: copy };
  };
  assert.deepEqual(await verdict(variant((v) => (v.post.deleted = true))), { state: "removed", scope: "creator_deleted" });
  assert.deepEqual(await verdict(variant((v) => (v.post.removed = true))), { state: "removed", scope: "moderator_removed" });
  assert.deepEqual(await verdict(variant((v) => (v.community.nsfw = true))), { state: "removed", scope: "ineligible_labels" });
  assert.deepEqual(await verdict({ match: lookup, status: 400, body: { error: "couldnt_find_post" } }), {
    state: "removed",
    scope: "post_not_found",
  });
  assert.deepEqual(await verdict({ match: lookup, status: 403, body: {} }), { state: "restricted", scope: "post" });
  assert.deepEqual(await verdict({ match: lookup, status: 503, headers: { "retry-after": "0" }, body: {} }), {
    state: "transient",
    scope: "post",
  });
  assert.deepEqual(await lemmy.recheckLemmy({ nativeId: "lemmy.blahaj.zone:1" }, { http: null }), {
    state: "restricted",
    scope: "unverifiable_id",
  });
});

test("lemmy errors propagate: 403 blocked, 429 rate limited, malformed body", async () => {
  const attempt = (route) => runAdapterPage(lemmy.lemmyMemes, { routes: inFamily("lemmy", [route]) });
  const list = /\/api\/v3\/post\/list\?/;
  await assert.rejects(attempt({ match: list, status: 403, type: "text/html", body: "Cloudflare" }), (e) => e.code === "blocked");
  await assert.rejects(attempt({ match: list, status: 429, headers: { "retry-after": "0" }, body: { error: "rate_limit_error" } }), (e) => e.code === "rate_limited");
  await assert.rejects(attempt({ match: list, body: { error: "unknown" } }), (e) => e.code === "source_shape");
});

test("adult self-labelled profiles and shop announcements are skipped before any paid check", async () => {
  bsky.resetBlueskySessions();
  const feed = await json("bluesky", "feed-kusuriya.json");
  const target = feed.feed.find((e) => e.post.author.handle === "tuiwkoo.bsky.social");
  target.post.author.displayName = "tuiwkoo 🔞 art";
  const shop = feed.feed.find((e) => e.post.author.handle === "sadisticss.bsky.social");
  shop.post.record.text = "Leftover sales open in 5 days\n#KusuriyanoHitorigoto";
  const bskyPage = await runAdapterPage(bsky.blueskyMaomao, {
    day: "2026-09-14",
    routes: inFamily("bluesky", [{ match: KUSURIYA, body: feed }]),
  });
  const handles = bskyPage.items.map((i) => i.credit.handle);
  assert.ok(!handles.includes("tuiwkoo.bsky.social"));
  assert.ok(!handles.includes("sadisticss.bsky.social"));
  assert.equal(bskyPage.items.length, 3);

  const taggedBody = await json("tumblr", "tagged-apothecary-npf.json");
  taggedBody.response[0].blog_name = "example-nsfw-art";
  taggedBody.response[0].blog.name = "example-nsfw-art";
  const tumblrPage = await runAdapterPage(tumblr.tumblrMaomao, {
    day: "2026-09-14",
    credentials: TUMBLR_KEY,
    routes: inFamily("tumblr", [{ match: tagged("the apothecary diaries"), body: taggedBody }]),
  });
  assert.deepEqual(tumblrPage.items.map((i) => i.nativeId).sort(), ["790000000000000002", "790000000000000004"]);

  const lemmyBody = await json("lemmy", "memes-lemmy.world.json");
  lemmyBody.posts[0].creator.display_name = "NSFW memes";
  const lemmyPage = await runAdapterPage(lemmy.lemmyMemes, {
    routes: inFamily("lemmy", [{ match: /\/api\/v3\/post\/list\?/, body: lemmyBody }]),
  });
  assert.equal(lemmyPage.items.length, 5);
});

// ---------------------------------------------------------------------------------------------------------
// Declarations and fixtures

test("entry declarations validate with exact hosts, policies and deletion rechecks", () => {
  const entries = [
    [bsky.blueskyMaomao, "bluesky-maomao", "fetch-b", ["maomao"]],
    [bsky.blueskyArt, "bluesky-art", "fetch-b", ["music"]],
    [bsky.blueskyCosplay, "bluesky-cosplay", "fetch-b", ["dressup", "maomao", "music"]],
    [bsky.blueskyFashion, "bluesky-fashion", "fetch-b", ["dressup"]],
    [bsky.blueskyMemes, "bluesky-memes", "fetch-b", ["meme", "maomao", "music"]],
    [tumblr.tumblrMaomao, "tumblr-maomao", "fetch-b", ["maomao"]],
    [tumblr.tumblrCosplay, "tumblr-cosplay", "fetch-b", ["dressup", "maomao", "music"]],
    [tumblr.tumblrMemes, "tumblr-memes", "fetch-a", ["meme", "music", "maomao"]],
    [lemmy.lemmyMemes, "lemmy-memes", "fetch-b", ["meme", "music"]],
  ];
  for (const [raw, id, stage, sections] of entries) {
    const entry = defineSource(raw);
    assert.equal(entry.id, id);
    assert.equal(entry.stage, stage);
    assert.deepEqual(entry.sections, sections);
    assert.equal(entry.enabled, true);
    assert.equal(entry.deletionPolicy, "honor_deletions");
    assert.equal(entry.deletionDeadlineHours, 24);
    assert.equal(typeof entry.recheck, "function");
    assert.equal(entry.mediaPolicy, "moving_sampled");
    assert.ok(entry.maxBytes <= 2 * 1024 * 1024 && entry.maxRequests > 0 && entry.timeoutMs > 0);
    for (const host of [...entry.hosts, ...entry.mediaHosts, ...(entry.profileHosts ?? []), ...(entry.linkHosts ?? [])])
      assert.match(host, /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/, `${id}: ${host} must be an exact hostname`);
    assert.match(entry.termsUrl, /^https:\/\//);
    assert.match(entry.docsUrl, /^https:\/\//);
    assert.ok(entry.notes.length > 100);
  }
  const bluesky = defineSource(bsky.blueskyMemes);
  assert.equal(bluesky.copyPolicy, "private_copy");
  assert.equal(bluesky.copyPermission.sourceUrl, "https://bsky.network/docs/developer-guidelines");
  assert.ok(!Number.isNaN(Date.parse(bluesky.copyPermission.verifiedAt)));
  assert.deepEqual(bluesky.optionalCredentials, ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"]);
  assert.deepEqual(bluesky.requiredCredentials, []);
  for (const raw of [tumblr.tumblrMaomao, tumblr.tumblrCosplay, tumblr.tumblrMemes, lemmy.lemmyMemes])
    assert.equal(defineSource(raw).copyPolicy, "link_only");
  assert.equal(defineSource(tumblr.tumblrMemes).cacheSeconds, 72 * 3600);
  assert.ok(!lemmy.LEMMY_COMMUNITIES.some((c) => c.name === "lemmyshitpost" || c.host === "lemmy.blahaj.zone"));
});

test("fixtures are bounded (≤ 200 KB) and contain no credentials", async () => {
  for (const family of ["bluesky", "tumblr", "lemmy"]) {
    const dir = path.join(root, "fixtures/feeds", family);
    const names = await readdir(dir);
    assert.ok(names.length >= 5);
    for (const name of names) {
      const file = path.join(dir, name);
      assert.ok((await stat(file)).size <= 200 * 1024, `${family}/${name} too large`);
      const text = await readFile(file, "utf8");
      assert.doesNotMatch(text, /accessJwt|refreshJwt|api_key=|app[_-]?password|authorization|bearer /i, `${family}/${name}`);
    }
  }
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
