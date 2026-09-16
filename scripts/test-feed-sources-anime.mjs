// Anime/Maomao source adapters against trimmed real responses (scripts/fixtures/feeds/<family>/), through
// the real sourceHttp helper. No network: every request must match a recorded route.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.fetch = () => {
  throw new Error("global fetch is not allowed in adapter tests");
};

const { runAdapterPage, runAdapterAll, fixtureTransport, publicLookup } = await import("./lib/feed-source-harness.mjs");
const { sourceHttp } = await import("../server/feeds/http.js");
const { defineSource, validateAdapterItem } = await import("../server/feeds/sources/registry.js");
const { cursor, feedEntries } = await import("../server/feeds/sources/util.js");
const danbooru = await import("../server/feeds/sources/danbooru.js");
const sakuga = await import("../server/feeds/sources/sakugabooru.js");
const anilist = await import("../server/feeds/sources/anilist.js");
const news = await import("../server/feeds/sources/animenews.js");
const fandom = await import("../server/feeds/sources/fandom.js");
const wikipedia = await import("../server/feeds/sources/wikipedia.js");

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/feeds");
const load = (family, file) => JSON.parse(readFileSync(path.join(FIXTURES, family, file), "utf8"));
const route = (family, match, file, extra = {}) => ({ match, file, source: family, ...extra });
const status = (match, code, extra = {}) => ({ match, status: code, body: "", headers: { "retry-after": "0" }, ...extra });
const MIB = 1024 * 1024;

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    return true;
  });
}
function recheckWith(rawEntry, item, routes) {
  const entry = defineSource(rawEntry);
  const http = sourceHttp({ ...entry, paceMs: 0 }, {
    deadline: Date.now() + 30_000,
    stats: {},
    send: fixtureTransport(entry.id, routes),
    lookup: publicLookup,
  });
  return entry.recheck(item, { http });
}
const danbooruQuery = (key) =>
  [...danbooru.MAOMAO_QUERIES, ...danbooru.VOCALOID_QUERIES, ...danbooru.MEME_QUERIES].find((q) => q.key === key).tags;
const firstPage = (tags) => (href) => href === danbooru.postsUrl(tags);
const laterPage = (tags) => (href) => href.startsWith(danbooru.postsUrl(tags)) && /[?&]page=b\d+/.test(href);

test("anime source entries satisfy the registry contract with explicit policies", () => {
  const all = [
    danbooru.danbooruMaomao,
    danbooru.danbooruVocaloid,
    danbooru.danbooruMemes,
    sakuga.sakugabooruMaomao,
    anilist.anilistApothecary,
    news.newsAnn,
    news.newsCrunchyroll,
    news.newsAnimeCorner,
    news.newsMal,
    fandom.fandomApothecary,
    wikipedia.wikipediaApothecary,
  ].map(defineSource);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length);
  for (const entry of all) {
    assert.equal(entry.stage, "fetch-a", entry.id);
    assert.ok(entry.termsUrl && entry.notes, entry.id);
    assert.ok(entry.maxRequests <= 10 && entry.maxBytes <= 2 * MIB && entry.paceMs >= 1000, entry.id);
    if (entry.deletionPolicy !== "none") assert.equal(typeof entry.recheck, "function", entry.id);
    assert.deepEqual(entry.requiredCredentials, [], entry.id);
  }
  const byId = Object.fromEntries(all.map((e) => [e.id, e]));
  assert.equal(byId["danbooru-maomao"].copyPolicy, "private_copy");
  assert.equal(byId["danbooru-maomao"].copyPermission.sourceUrl, "https://danbooru.donmai.us/terms_of_service");
  assert.equal(byId["danbooru-maomao"].deletionDeadlineHours, 72);
  assert.equal(byId["sakugabooru-maomao"].copyPolicy, "link_only");
  assert.equal(byId["sakugabooru-maomao"].mediaPolicy, "moving_sampled");
  assert.deepEqual([byId["news-mal"].enabled, byId["news-mal"].status], [false, "restricted"]);
  for (const id of ["anilist-apothecary", "news-ann", "fandom-apothecary", "wikipedia-apothecary"]) assert.deepEqual(byId[id].mediaHosts, []);
});

test("danbooru-maomao normalizes real posts into credited, tagged image items", async () => {
  const tags = danbooruQuery("maomao");
  const { page, items, calls } = await runAdapterPage(danbooru.danbooruMaomao, {
    routes: [route("danbooru", firstPage(tags), "maomao-page1.json")],
  });
  assert.equal(items.length, 8);
  assert.equal(page.done, false);
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  // Owner decision (2026-09-16, second pass): "sensitive" joins "general"; q/e stay excluded.
  assert.equal(url.searchParams.get("tags"), "maomao_(kusuriya_no_hitorigoto) rating:g,s status:active age:<30d score:>=8");
  assert.equal(url.searchParams.get("page"), null);
  assert.match(calls[0].headers["user-agent"], /^kiriya\.love personal feed\/1\.0/);

  const first = items[0];
  assert.equal(first.nativeId, "12174230");
  assert.equal(first.url, "https://danbooru.donmai.us/posts/12174230");
  assert.deepEqual([first.kind, first.sections], ["image", ["maomao"]]);
  assert.equal(first.title, "maomao art by ryeongrry11");
  assert.deepEqual(first.media.map((m) => [m.type, m.url, m.width, m.height]), [
    ["image", "https://cdn.donmai.us/720x720/b5/c3/b5c3428d2260288485dd9b9fe3214135.webp", 557, 720],
  ]);
  assert.equal(first.mediaIdentity, "b5c3428d2260288485dd9b9fe3214135");
  assert.deepEqual(first.credit, {
    name: "ryeongrry11",
    handle: "ryeongrry11",
    profileUrl: "https://danbooru.donmai.us/posts?tags=ryeongrry11",
    platform: "Danbooru",
    license: "",
  });
  assert.deepEqual(first.facts.links, [
    { kind: "source", label: "original post (X)", url: "https://x.com/Ryeongrry11/status/2016521120888111196" },
  ]);
  assert.deepEqual(first.tags.characters, ["maomao"]);
  assert.deepEqual(first.tags.fandoms, ["the apothecary diaries"]);
  assert.equal(first.safety.rating, "g");
  assert.ok(first.safety.sourceTags.includes("highres") && first.safety.sourceTags.length <= 40);
  assert.equal(first.facts.sourceScore, 8);
  assert.equal(first.publishedAt, "2026-09-12T00:03:45.645Z");

  const pixiv = items.find((i) => i.nativeId === "12165589");
  assert.deepEqual(pixiv.facts.links, [{ kind: "source", label: "original post (pixiv)", url: "https://www.pixiv.net/artworks/146598644" }]);
  const pair = load("danbooru", "maomao-page1.json").find((p) => /jinshi/.test(p.tag_string_character));
  if (pair) {
    const item = items.find((i) => i.nativeId === String(pair.id));
    if (item) assert.deepEqual(item.tags.characters.sort(), ["jinshi", "maomao"]);
  }
});

test("danbooru-maomao skips AI, deleted, banned, non-general, unsupported, oversized and fanservice posts", async () => {
  const tags = danbooruQuery("maomao");
  const { page, items } = await runAdapterPage(danbooru.danbooruMaomao, {
    routes: [route("danbooru", firstPage(tags), "filters.json")],
  });
  assert.equal(page.done, true, "14 posts < page size ends the only query");
  assert.deepEqual(items.map((i) => i.nativeId), ["12174230", "12165589", "11714874", "11610295", "11046117", "8069387"]);
  const reasons = Object.fromEntries(load("danbooru", "filters.json").map((p) => [p.id, danbooru.skipReason(p)]));
  assert.deepEqual(
    [reasons[12176035], reasons[12177386], reasons[12148818], reasons[11962050], reasons[7463054], reasons[12174204], reasons[12148766]],
    ["ai", "deleted", "banned", "rating", "unsupported_media", "clip_too_large", "blocked_tag"],
  );
  for (const post of load("danbooru", "vocaloid-miku-gif.json").filter((p) => !p.tag_string_artist && !p.is_deleted && p.rating === "g"))
    assert.equal(danbooru.skipReason(post), "no_artist");

  const clip = items.find((i) => i.nativeId === "11714874");
  assert.equal(clip.kind, "clip");
  assert.deepEqual(clip.media, [
    {
      type: "mp4",
      url: "https://cdn.donmai.us/original/0b/26/0b26b0ab17b84777ecbeb01d1d76b160.mp4",
      width: 1120,
      height: 630,
      poster: "https://cdn.donmai.us/720x720/0b/26/0b26b0ab17b84777ecbeb01d1d76b160.webp",
      alt: "",
      duration: 1.8,
      bytes: 169072,
      identity: "0b26b0ab17b84777ecbeb01d1d76b160",
    },
  ]);
  assert.equal(clip.title, "maomao animation by tenten (chan4545)");
  assert.deepEqual(items.find((i) => i.nativeId === "11610295").tags.topics, ["disgusted face"]);
  assert.deepEqual(items.find((i) => i.nativeId === "11046117").tags.topics, ["herbs"]);
  assert.deepEqual(items.find((i) => i.nativeId === "8069387").tags.topics, ["poison"]);
  assert.deepEqual(items.find((i) => i.nativeId === "12174230").tags.topics, []);
  const street = load("danbooru", "filters.json").find((p) => p.id === 12174230);
  const unitless = danbooru.postItem(danbooru.danbooruMaomao, { ...street, tag_string_general: `${street.tag_string_general} idol street` }, "maomao");
  assert.equal(unitless.tags.units, undefined, "general tags never become SEKAI units");
});

test("danbooru-maomao paginates with page=b<last examined id> and stops at its request bound", async () => {
  const tags = danbooruQuery("maomao");
  const page1 = load("danbooru", "maomao-page1.json");
  const { items, calls, pages } = await runAdapterAll(danbooru.danbooruMaomao, {
    routes: [route("danbooru", firstPage(tags), "maomao-page1.json"), route("danbooru", laterPage(tags), "maomao-page2.json")],
  });
  assert.equal(pages, 2);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).searchParams.get("page"), `b${page1[7].id}`);
  assert.equal(items.length, 16);
  assert.equal(new Set(items.map((i) => i.nativeId)).size, 16);
  assert.ok(items.every((i) => Number(i.nativeId) < page1[7].id || page1.slice(0, 8).some((p) => String(p.id) === i.nativeId)));

  // A page that fills up keeps its query; the second request for a 2-page query moves on regardless.
  const bounded = await runAdapterAll(danbooru.danbooruMaomao, {
    routes: [route("danbooru", firstPage(tags), "maomao-page1.json"), route("danbooru", laterPage(tags), "vocaloid-miku.json")],
  });
  assert.equal(bounded.calls.length, 2);
});

test("danbooru-vocaloid walks Miku, Miku GIFs and the voicebank pairs with the cursor", async () => {
  const q = Object.fromEntries(danbooru.VOCALOID_QUERIES.map((x) => [x.key, x.tags]));
  const { items, calls, pages } = await runAdapterAll(danbooru.danbooruVocaloid, {
    routes: [
      route("danbooru", firstPage(q.miku), "vocaloid-miku.json"),
      route("danbooru", laterPage(q.miku), "memes-sekai.json"),
      route("danbooru", firstPage(q["miku-gif"]), "vocaloid-miku-gif.json"),
      { match: firstPage(q["rin-len"]), body: [] },
      { match: firstPage(q["luka-kaito"]), body: [] },
      { match: firstPage(q["meiko-teto"]), body: [] },
      { match: firstPage(q.gumi), body: [] },
    ],
  });
  assert.equal(pages, 7);
  assert.deepEqual(
    calls.map((c) => new URL(c.url).searchParams.get("tags")),
    [q.miku, q.miku, q["miku-gif"], q["rin-len"], q["luka-kaito"], q["meiko-teto"], q.gumi],
  );
  assert.ok(q["rin-len"].startsWith("~kagamine_rin ~kagamine_len "));
  assert.ok(items.every((i) => i.sections.length === 1 && i.sections[0] === "music"));
  const gif = items.find((i) => i.media[0].type === "gif");
  assert.ok(gif, "animated_gif posts become gif clips");
  assert.equal(gif.kind, "clip");
  assert.match(gif.media[0].url, /^https:\/\/cdn\.donmai\.us\/original\/.+\.gif$/);
  assert.match(gif.media[0].poster, /^https:\/\/cdn\.donmai\.us\/720x720\/.+\.webp$/);
  assert.ok(gif.media[0].bytes <= 8 * MIB);
  const miku = items.filter((i) => i.tags.voicebanks.includes("hatsune miku"));
  assert.ok(miku.length >= 8);
  assert.ok(miku.every((i) => i.tags.characters.includes("hatsune miku") && i.title.startsWith("hatsune miku")));
  const sekai = items.filter((i) => i.tags.fandoms.includes("project sekai"));
  assert.ok(sekai.length > 0, "project_sekai copyright tag maps to the project sekai fandom");
  const teto = items.find((i) => i.tags.voicebanks.includes("kasane teto"));
  if (teto) assert.ok(teto.tags.characters.includes("kasane teto"));
});

test("danbooru-memes routes sections by fandom, maps only clear formats and blocks lewd/off-limits formats", async () => {
  const q = Object.fromEntries(danbooru.MEME_QUERIES.map((x) => [x.key, x.tags]));
  const anime = await runAdapterPage(danbooru.danbooruMemes, { routes: [route("danbooru", firstPage(q.anime), "memes-anime.json")] });
  assert.ok(anime.items.length > 0 && anime.items.every((i) => i.kind === "meme" && i.sections[0] === "meme"));

  const apothecary = await runAdapterPage(danbooru.danbooruMemes, {
    cursor: cursor.encode({ q: 1 }),
    routes: [route("danbooru", firstPage(q.apothecary), "memes-apothecary.json")],
  });
  assert.ok(apothecary.items.length > 0);
  assert.ok(apothecary.items.every((i) => i.sections.includes("meme") && i.sections.includes("maomao") && !i.sections.includes("music")));
  assert.ok(apothecary.items.every((i) => i.tags.fandoms.includes("the apothecary diaries")));

  const sekai = await runAdapterPage(danbooru.danbooruMemes, {
    cursor: cursor.encode({ q: 2 }),
    routes: [route("danbooru", firstPage(q.sekai), "memes-sekai.json")],
  });
  assert.ok(sekai.items.length > 0 && sekai.items.every((i) => i.sections.includes("music") && i.tags.fandoms.includes("project sekai")));

  const filtered = await runAdapterPage(danbooru.danbooruMemes, {
    cursor: cursor.encode({ q: 4 }),
    routes: [route("danbooru", firstPage(q.minecraft), "memes-filters.json")],
  });
  assert.equal(filtered.page.done, true);
  assert.deepEqual(filtered.items.map((i) => [i.nativeId, i.tags.formats, i.sections]), [
    ["12196581", ["comic"], ["meme"]],
    ["12177945", ["comic"], ["meme"]],
  ]);
  const reasons = load("danbooru", "memes-filters.json").map((p) => [p.id, danbooru.skipReason(p)]);
  assert.deepEqual(Object.fromEntries(reasons)[12187389], "blocked_tag"); // piper_perri_surrounded_(meme)
  assert.deepEqual(Object.fromEntries(reasons)[12187027], "blocked_tag"); // 114514_(meme), 67_(meme)
  assert.ok(danbooru.LEWD_MEME_TAGS.has("piper_perri_surrounded_(meme)"));
  assert.equal(danbooru.skipReason({ ...load("danbooru", "memes-filters.json")[0], tag_string_general: "comic some_new_boobs_joke_(meme)" }), "blocked_tag");
});

test("danbooru fetches propagate blocked, missing, throttled, rejected and malformed responses", async () => {
  const tags = danbooruQuery("maomao");
  const one = (r) => runAdapterPage(danbooru.danbooruMaomao, { routes: [r] });
  await rejects(one(route("fandom", firstPage(tags), "cloudflare-challenge-403.html", { status: 403, type: "text/html" })), "blocked");
  await rejects(one(route("danbooru", firstPage(tags), "not-found-404.json", { status: 404 })), "not_found");
  await rejects(one(status(firstPage(tags), 429)), "rate_limited");
  await rejects(one(route("danbooru", firstPage(tags), "tag-limit-422.json", { status: 422 })), "source_http_422");
  await rejects(one(route("fandom", firstPage(tags), "cloudflare-challenge-403.html", { type: "text/html" })), "unexpected_content_type");
  await rejects(one({ match: firstPage(tags), body: { success: false } }), "source_shape");
});

test("danbooru recheck reports present, removed, restricted and transient states", async () => {
  const item = { nativeId: "12174230" };
  const lookup = "https://danbooru.donmai.us/posts/12174230.json?only=id,rating,is_deleted,is_banned";
  const check = (r) => recheckWith(danbooru.danbooruMaomao, item, [r]);
  assert.deepEqual(await check(route("danbooru", lookup, "recheck-present.json")), { state: "present", scope: "post" });
  assert.equal((await check(route("danbooru", lookup, "recheck-deleted.json"))).state, "removed");
  assert.equal((await check(route("danbooru", lookup, "recheck-banned.json"))).state, "removed");
  const questionable = load("danbooru", "filters.json").find((p) => p.id === 11962050);
  const rerated = { id: questionable.id, rating: questionable.rating, is_deleted: questionable.is_deleted, is_banned: questionable.is_banned };
  assert.equal((await check({ match: lookup, body: rerated })).state, "removed");
  assert.equal((await check(route("danbooru", lookup, "not-found-404.json", { status: 404 }))).state, "removed");
  assert.equal((await check(route("fandom", lookup, "cloudflare-challenge-403.html", { status: 403, type: "text/html" }))).state, "restricted");
  assert.equal((await check(status(lookup, 503))).state, "transient");
  assert.equal((await check(status(lookup, 429))).state, "transient");
  assert.equal((await recheckWith(danbooru.danbooruMaomao, { nativeId: "not-a-post" }, [])).state, "transient");
});

test("danbooru sends an owner-configured user id only as a User-Agent suffix", async () => {
  const tags = danbooruQuery("maomao");
  const routes = [route("danbooru", firstPage(tags), "filters.json")];
  const withId = await runAdapterPage(danbooru.danbooruMaomao, { routes, credentials: { DANBOORU_USER_ID: "123456" } });
  assert.equal(withId.calls[0].headers["user-agent"], "kiriya.love personal feed/1.0 (+https://kiriya.love; user #123456)");
  assert.ok(!withId.calls[0].url.includes("123456"));
  const invalid = await runAdapterPage(danbooru.danbooruMaomao, { routes, credentials: { DANBOORU_USER_ID: "me; evil" } });
  assert.equal(invalid.calls[0].headers["user-agent"], "kiriya.love personal feed/1.0 (+https://kiriya.love)");
});

test("sakugabooru-maomao credits animators from tag types and reads episodes from the source", async () => {
  const { page, items, calls } = await runAdapterPage(sakuga.sakugabooruMaomao, {
    routes: [route("sakugabooru", sakuga.postsUrl(), "kusuriya-page1.json")],
  });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.get("include_tags"), "1");
  assert.equal(items.length, 8);
  assert.equal(page.done, false);
  const first = items[0];
  assert.equal(first.nativeId, "290333");
  assert.equal(first.url, "https://www.sakugabooru.com/post/show/290333");
  assert.equal(first.title, "The Apothecary Diaries sakuga · NCED4 · tsutomu kikuchi");
  assert.deepEqual([first.kind, first.sections, first.safety.rating], ["clip", ["maomao"], "s"]);
  assert.deepEqual(first.credit, {
    name: "tsutomu kikuchi",
    handle: "tsutomu_kikuchi",
    profileUrl: "https://www.sakugabooru.com/post?tags=tsutomu_kikuchi",
    platform: "Sakugabooru",
    license: "",
  });
  assert.equal(first.media[0].type, "mp4");
  assert.equal(first.media[0].url, "https://www.sakugabooru.com/data/af20cd3220de30d2ac1b98185182f8fa.mp4");
  assert.equal(first.media[0].poster, "https://www.sakugabooru.com/data/preview/af20cd3220de30d2ac1b98185182f8fa.jpg");
  assert.equal(first.mediaIdentity, "af20cd3220de30d2ac1b98185182f8fa");
  assert.deepEqual(first.tags.fandoms, ["the apothecary diaries"]);
  const unknown = items.find((i) => i.credit.name === "unknown animator");
  assert.ok(unknown && unknown.credit.profileUrl === null);
  const pair = items.find((i) => i.nativeId === "290331");
  assert.equal(pair.credit.name, "china (animator) & corcoran mark kenta");
  assert.ok(items.every((i) => i.media[0].bytes <= 8 * MIB));

  const all = await runAdapterAll(sakuga.sakugabooruMaomao, {
    routes: [
      route("sakugabooru", sakuga.postsUrl(), "kusuriya-page1.json"),
      route("sakugabooru", (href) => /id%3A%3C\d+/.test(href), "kusuriya-page2.json"),
    ],
  });
  assert.equal(all.pages, 2, "two requests, then done");
  const page1 = load("sakugabooru", "kusuriya-page1.json");
  const lastExamined = page1.posts.filter((p) => !sakuga.skipReason(p))[7].id;
  assert.equal(new URL(all.calls[1].url).searchParams.get("tags"), `kusuriya_no_hitorigoto rating:s id:<${lastExamined}`);
  assert.equal(all.items.find((i) => i.nativeId === "269843").facts.episode, 4);
  assert.ok(!all.items.some((i) => ["275576", "269844", "269839"].includes(i.nativeId)), "cuts over 8 MiB are skipped");
  assert.deepEqual(
    page1.posts.filter((p) => ["288098", "278364"].includes(String(p.id))).map((p) => sakuga.skipReason(p)),
    ["clip_too_large", "clip_too_large"],
  );
  const entry = defineSource(sakuga.sakugabooruMaomao);
  const ep48 = validateAdapterItem(sakuga.cutItem(page1.posts.find((p) => p.id === 286624), page1.tags), entry);
  assert.deepEqual([ep48.facts.episode, ep48.title], [48, "The Apothecary Diaries sakuga · episode #48 · unknown animator"]);
  const ep44 = validateAdapterItem(sakuga.cutItem(page1.posts.find((p) => p.id === 284166), page1.tags), entry);
  assert.deepEqual([ep44.facts.episode, ep44.credit.name], [44, "tsutomu kikuchi"]);
  assert.deepEqual([sakuga.episodeFrom("NCOP1 (BD)"), sakuga.episodeFrom("https://twitter.com/k2tom009/status/1"), sakuga.episodeFrom("#04 (AD: Moaang)(BD)")], [null, null, 4]);
});

test("sakugabooru-maomao propagates access errors and rechecks deletions", async () => {
  const url = sakuga.postsUrl();
  await rejects(runAdapterPage(sakuga.sakugabooruMaomao, { routes: [route("fandom", url, "cloudflare-challenge-403.html", { status: 403, type: "text/html" })] }), "blocked");
  await rejects(runAdapterPage(sakuga.sakugabooruMaomao, { routes: [{ match: url, body: [] }] }), "source_shape");
  await rejects(runAdapterPage(sakuga.sakugabooruMaomao, { routes: [status(url, 503)] }), "source_http_503");

  const lookup = "https://www.sakugabooru.com/post.json?tags=id%3A269839&api_version=2";
  const check = (r) => recheckWith(sakuga.sakugabooruMaomao, { nativeId: "269839" }, [r]);
  assert.deepEqual(await check(route("sakugabooru", lookup, "recheck-present.json")), { state: "present", scope: "post" });
  assert.equal((await check(route("sakugabooru", lookup, "recheck-empty.json"))).state, "removed");
  assert.equal((await check(status(lookup, 404))).state, "removed");
  assert.equal((await check(route("fandom", lookup, "cloudflare-challenge-403.html", { status: 403, type: "text/html" }))).state, "restricted");
  assert.equal((await check(status(lookup, 502))).state, "transient");
});

test("anilist-apothecary posts one GraphQL query and builds episode and release-date items", async () => {
  const { page, items, calls } = await runAdapterPage(anilist.anilistApothecary, {
    day: "2026-09-15",
    routes: [route("anilist", "https://graphql.anilist.co/", "apothecary-media.json")],
  });
  assert.equal(page.done, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.deepEqual(items.map((i) => i.title), [
    "The Apothecary Diaries Season 3 · episode 1",
    "Kusuriya no Hitorigoto 3rd Season Part 2 · start date 2027-04",
    "Kusuriya no Hitorigoto: Bouhi no Hihou · release date 2026-12-11",
  ]);
  const [episode, part2, film] = items;
  assert.equal(episode.url, "https://anilist.co/anime/195516?episode=1");
  assert.deepEqual(
    [episode.kind, episode.sections, episode.facts.episode, episode.facts.airingAt, episode.facts.datePrecision, episode.expiresAt],
    ["news", ["maomao"], 1, "2026-10-02T14:00:00.000Z", "datetime", "2026-10-09T14:00:00.000Z"],
  );
  assert.deepEqual([part2.url, part2.facts.releaseAt, part2.facts.releasePrecision, part2.facts.dates], [
    "https://anilist.co/anime/200927",
    "2027-04-01T00:00:00+09:00",
    "month",
    ["2027-04"],
  ]);
  assert.deepEqual([film.facts.releaseAt, film.facts.releasePrecision, film.facts.airingAt], ["2026-12-11T00:00:00+09:00", "day", null]);
  assert.ok(items.every((i) => i.media.length === 0 && i.credit.name === "AniList" && i.tags.fandoms[0] === "the apothecary diaries"));
  assert.ok(film.facts.names.includes("薬屋のひとりごと 亡妃の秘宝"));
});

test("anilist-apothecary windows the fetched schedule around the build day", async () => {
  const { items } = await runAdapterPage(anilist.anilistApothecary, {
    day: "2026-10-12",
    routes: [route("anilist", "https://graphql.anilist.co/", "apothecary-media.json")],
  });
  const episodes = items.filter((i) => i.facts.episode !== null).map((i) => i.facts.episode);
  assert.ok(episodes.includes(2) && episodes.includes(3), "aired within 7 days and airing within 8 days");
  assert.ok(!episodes.some((n) => n >= 4));
  assert.ok(items.some((i) => i.nativeId === "200929:release"));
});

test("anilist-apothecary propagates throttling, disabled API and changed IDs", async () => {
  const at = (r) => runAdapterPage(anilist.anilistApothecary, { routes: [r] });
  await rejects(at(route("anilist", "https://graphql.anilist.co/", "docs-rate-limited-429.json", { status: 429, headers: { "retry-after": "0" } })), "rate_limited");
  await rejects(at(route("anilist", "https://graphql.anilist.co/", "docs-api-disabled-403.json", { status: 403 })), "blocked");
  await rejects(at(route("anilist", "https://graphql.anilist.co/", "docs-rate-limited-429.json")), "rate_limited");
  const media = load("anilist", "apothecary-media.json").data.Page.media.filter((m) => m.id !== 195516);
  await rejects(at({ match: "https://graphql.anilist.co/", body: { data: { Page: { media } } } }), "not_found");
  await rejects(at({ match: "https://graphql.anilist.co/", body: { data: null } }), "source_shape");
});

test("news-ann routes Apothecary Diaries news into maomao with the feed's verbatim summary", async () => {
  const { page, items } = await runAdapterPage(news.newsAnn, {
    day: "2026-09-15",
    routes: [route("animenews", news.newsAnn.docsUrl, "ann-sea.xml", { type: "application/rss+xml; charset=UTF-8" })],
  });
  assert.equal(page.done, true);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.title, "The Apothecary Diaries Series Gets New Mystery Game for Consoles, PC");
  assert.equal(item.url, "https://www.animenewsnetwork.com/news/2026-09-09/the-apothecary-diaries-series-gets-new-mystery-game-for-consoles-pc/.241582");
  assert.deepEqual([item.kind, item.sections, item.nativeId], ["news", ["maomao"], "https://www.animenewsnetwork.com/cms/.241582"]);
  assert.deepEqual(item.facts.excerpts, ["The Apothecary Diaries: The False Imperial Brother launches in early 2027 for Switch 2, Switch, PS5, PC"]);
  assert.deepEqual(item.tags.fandoms, ["the apothecary diaries"]);
  assert.deepEqual([item.credit.name, item.credit.profileUrl], ["Anime News Network", "https://www.animenewsnetwork.com/"]);
  assert.deepEqual(item.safety.sourceTags, ["Games"]);
  assert.equal(item.publishedAt, "2026-09-09T17:35:21.000Z");
  assert.deepEqual(item.media, []);

  const later = await runAdapterPage(news.newsAnn, {
    day: "2026-09-18",
    routes: [route("animenews", news.newsAnn.docsUrl, "ann-sea.xml", { type: "application/rss+xml" })],
  });
  assert.deepEqual([later.items.length, later.page.done], [0, true], "items older than 7 days are skipped");
});

test("news routes music and dress-up keywords, skips unrouted items and pages with a stable cursor", async () => {
  const routes = [route("animenews", news.newsAnn.docsUrl, "ann-press-release-sea.xml", { type: "application/rss+xml" })];
  // 2026-09-13 keeps the 7 September Manta release inside the 7-day window.
  const { items } = await runAdapterPage(news.newsAnn, { day: "2026-09-13", routes });
  assert.deepEqual(items.map((i) => [i.title.slice(0, 32), i.sections]), [
    ["OC Japan Fair Returns This Octob", ["dressup"]],
    ["Hatsune Miku “Magical Mirai 2026", ["music"]],
    ['"Dream on Stage" Premium DLC Com', ["music"]],
    ["Manta to Distribute Manga from K", ["maomao"]],
  ]);
  const mirai = items[1];
  assert.deepEqual([mirai.tags.characters, mirai.tags.voicebanks], [["hatsune miku"], ["hatsune miku"]]);
  assert.ok(!items.some((i) => /Dōkyūsei|Scimagic/.test(i.title)));

  const paged = await runAdapterAll(news.newsAnn, { day: "2026-09-13", items: 3, routes });
  assert.equal(paged.pages, 2);
  assert.deepEqual(paged.items.map((i) => i.nativeId), items.map((i) => i.nativeId));
});

test("crunchyroll, anime corner and MyAnimeList feeds parse and normalize their own links", async () => {
  for (const [entry, file, host] of [
    [news.newsCrunchyroll, "crunchyroll.xml", "crunchyroll.com"],
    [news.newsAnimeCorner, "animecorner.xml", "animecorner.me"],
    [news.newsMal, "mal.xml", "myanimelist.net"],
  ]) {
    const routes = [route("animenews", entry.docsUrl, file, { type: "application/xml" })];
    const { page, items } = await runAdapterPage(entry, { day: "2026-09-15", routes });
    assert.deepEqual([page.done, items.length], [true, 0], `${entry.id}: no current item matches a route`);
    const defined = defineSource(entry);
    const http = sourceHttp({ ...defined, paceMs: 0 }, { deadline: Date.now() + 30_000, stats: {}, send: fixtureTransport(entry.id, routes), lookup: publicLookup });
    const { doc } = await http.xml(entry.docsUrl);
    const parsed = feedEntries(doc);
    assert.ok(parsed.length >= 3);
    const item = validateAdapterItem(news.articleItem({ ...defined, name: defined.id, platform: defined.id, home: null }, parsed[0], ["dressup"]), defined);
    assert.equal(new URL(item.url).hostname, host);
    assert.ok(item.title.length > 0 && item.facts.excerpts[0].length <= 600);
    if (entry === news.newsMal) {
      assert.ok(!item.url.includes("_location"), "MAL tracking parameter removed");
      assert.equal(defined.enabled, false);
    }
    if (entry === news.newsCrunchyroll) assert.ok(!item.facts.excerpts[0].includes("Shueisha Games"), "article bodies are never used");
  }
});

test("news feeds propagate blocked, missing and non-feed responses", async () => {
  const url = news.newsAnimeCorner.docsUrl;
  const at = (r) => runAdapterPage(news.newsAnimeCorner, { routes: [r] });
  await rejects(at(route("fandom", url, "cloudflare-challenge-403.html", { status: 403, type: "text/html" })), "blocked");
  await rejects(at(status(url, 404)), "not_found");
  await rejects(at(route("fandom", url, "cloudflare-challenge-403.html", { type: "text/html" })), "source_shape");
  await rejects(at(status(url, 429)), "rate_limited");
});

const fandomRoutes = () => [
  route("fandom", (href) => href === fandom.parseUrl("Maomao"), "parse-maomao.json"),
  route("fandom", (href) => ["Pairin", "Meimei", "Joka", "Xiaolan", "Gaoshun"].some((t) => href === fandom.parseUrl(t)), "parse-pairin.json"),
  route("fandom", (href) => href === fandom.episodeListUrl(), "categorymembers-anime-episode.json"),
  route("fandom", (href) => href.includes("page=Season%20"), "parse-season-2-episode-24.json"),
];

test("fandom-apothecary turns wikitext into verbatim, credited lore excerpts", async () => {
  const { page, items, calls } = await runAdapterPage(fandom.fandomApothecary, { day: "2026-09-15", routes: fandomRoutes() });
  assert.equal(calls[0].url, fandom.parseUrl("Maomao"));
  assert.equal(page.done, false);
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map((i) => i.url)).size, 3, "excerpts from one page keep distinct canonical URLs");
  for (const item of items) {
    assert.deepEqual([item.kind, item.sections, item.media], ["lore", ["maomao"], []]);
    assert.match(item.url, /^https:\/\/kusuriya\.fandom\.com\/wiki\/Maomao\?excerpt=[a-z0-9-]+-\d+/);
    assert.deepEqual(item.credit, {
      name: "The Apothecary Diaries Wiki contributors",
      handle: "",
      profileUrl: "https://kusuriya.fandom.com/wiki/Maomao?action=history",
      platform: "Fandom",
      license: "CC BY-SA 3.0",
    });
    assert.equal(item.facts.excerpts.length, 1);
    const [text] = item.facts.excerpts;
    assert.ok(text.length >= 60 && text.length <= 600);
    assert.doesNotMatch(text, /\{\{|\}\}|\[\[|<ref|'''|self-inflicted/);
    assert.ok(item.tags.characters.includes("maomao"));
    assert.match(item.nativeId, /^84:[a-z0-9-]+:\d+$/);
  }

  const excerpts = fandom.pageExcerpts(load("fandom", "parse-maomao.json").parse.wikitext);
  const lead = excerpts.find((e) => e.slug === "overview");
  assert.ok(lead.text.startsWith("Maomao is the protagonist of The Apothecary Diaries series."));
  assert.ok(excerpts.some((e) => e.section === "Appearance" && e.text.startsWith("Maomao is a petite teenage girl")));
  assert.ok(excerpts.some((e) => e.text === "“If I should die, I'd want to die of poison.” — Maomao, Light Novel"));
  assert.ok(!excerpts.some((e) => wikipedia.SENSITIVE_LORE.test(e.text)));
  assert.ok(!excerpts.some((e) => /Were you looking for/.test(e.text)));
  const monday = fandom.rotate(excerpts, "2026-09-15", 3).map((e) => `${e.slug}:${e.n}`);
  const tuesday = fandom.rotate(excerpts, "2026-09-16", 3).map((e) => `${e.slug}:${e.n}`);
  assert.equal(monday.filter((k) => tuesday.includes(k)).length, 0, "consecutive days offer different excerpts");
});

test("fandom-apothecary rotates through the character pages, then the latest and one older episode page", async () => {
  const { items, calls, pages } = await runAdapterAll(fandom.fandomApothecary, { day: "2026-09-15", routes: fandomRoutes() });
  assert.equal(pages, 9);
  assert.deepEqual(calls.slice(0, 7).map((c) => c.url), [
    ...fandom.FANDOM_PAGES.map((t) => fandom.parseUrl(t)),
    fandom.episodeListUrl(),
  ]);
  const episodeTitles = calls.slice(7).map((c) => decodeURIComponent(new URL(c.url).searchParams.get("page")));
  assert.equal(episodeTitles[0], "Season 2 Episode 24");
  assert.match(episodeTitles[1], /^Season [12] Episode \d{2}$/);
  assert.ok(items.length <= 3 + 5 * 2 + 2 * 2);
  assert.ok(items.some((i) => i.title.startsWith("Season 2 Episode 24 · ")));
  assert.deepEqual(fandom.chooseEpisodes(["Season 1 Episode 01", "The Apothecary Diaries (Anime)/Episodes S3", "Season 3 Episode 02", "Season 3 Episode 01"], "2026-10-10")[0], "Season 3 Episode 02");
});

test("fandom-apothecary surfaces API errors instead of empty pages", async () => {
  const at = (r) => runAdapterPage(fandom.fandomApothecary, { routes: [r] });
  const url = fandom.parseUrl("Maomao");
  await rejects(at(route("fandom", url, "error-missingtitle.json")), "not_found");
  await rejects(at(route("fandom", url, "cloudflare-challenge-403.html", { status: 403, type: "text/html" })), "blocked");
  await rejects(at({ match: url, body: { batchcomplete: true } }), "source_shape");
  await rejects(
    runAdapterPage(fandom.fandomApothecary, { cursor: cursor.encode({ s: 6, eps: [] }), routes: [{ match: fandom.episodeListUrl(), body: { query: {} } }] }),
    "source_shape",
  );
});

test("wikipedia-apothecary parses Episode list rows nested in episode tables", () => {
  const rows = wikipedia.episodeEntries(load("wikipedia", "parse-episode-list.json").parse.wikitext);
  assert.deepEqual(rows.map((r) => [r.season, r.overall, r.number]), [
    [1, 1, 1], [1, 2, 2], [1, 3, 3], [1, 7, 7], [1, 8, 8], [2, 44, 20], [2, 47, 23], [2, 48, 24],
  ]);
  assert.deepEqual([rows[0].title, rows[0].native, rows[0].airDate], ["Maomao", "猫猫", "2023-10-22"]);
  assert.deepEqual([rows[1].title, rows[1].translit], ["Chilly Apothecary", "Buaisō na Kusushi"]);
  assert.ok(rows[5].summary.includes("original name – Shisui"), "{{snd}} renders as a spaced en dash");
  assert.ok(rows.every((r) => r.summary && !/\{\{|\[\[|<ref/.test(r.summary)));
});

test("wikipedia-apothecary puts recently aired rows first and rotates the rest", async () => {
  const routes = [route("wikipedia", (href) => href.startsWith("https://en.wikipedia.org/w/api.php?action=parse"), "parse-episode-list.json")];
  const { page, items, calls } = await runAdapterPage(wikipedia.wikipediaApothecary, { day: "2025-07-01", routes });
  assert.equal(page.done, true);
  assert.equal(new URL(calls[0].url).searchParams.get("maxlag"), "5");
  assert.deepEqual(items.slice(0, 2).map((i) => i.nativeId), ["episode:47", "episode:48"]);
  assert.ok(items.length <= 2 + wikipedia.ROTATING_EPISODES);
  assert.ok(!items.some((i) => i.nativeId === "episode:8"), "episode 8's summary mentions suicide");
  const last = items.find((i) => i.nativeId === "episode:48");
  assert.equal(last.title, "The Apothecary Diaries · S2 E24 “The Beginning”");
  assert.equal(last.url, "https://en.wikipedia.org/wiki/List_of_The_Apothecary_Diaries_episodes?episode=48#ep48");
  assert.deepEqual([last.facts.airingAt, last.facts.datePrecision, last.facts.dates, last.facts.episode], ["2025-07-04T00:00:00+09:00", "day", ["2025-07-04"], 24]);
  assert.deepEqual([last.credit.name, last.credit.license], ["Wikipedia contributors", "CC BY-SA 4.0"]);
  for (const item of items) {
    const [text] = item.facts.excerpts;
    assert.ok(text.length <= 600 && /[.!?]["”’)]?$/.test(text), item.nativeId);
    assert.ok(item.tags.characters.every((c) => wikipedia.APOTHECARY_CHARACTERS.includes(c)));
  }
  const today = await runAdapterPage(wikipedia.wikipediaApothecary, { day: "2026-09-15", routes });
  assert.equal(today.items.length, wikipedia.ROTATING_EPISODES, "no recent rows: daily rotation only");
});

test("wikipedia-apothecary maps API errors", async () => {
  const match = (href) => href.startsWith("https://en.wikipedia.org/w/api.php");
  const at = (r) => runAdapterPage(wikipedia.wikipediaApothecary, { routes: [r] });
  await rejects(at(route("wikipedia", match, "error-missingtitle.json")), "not_found");
  await rejects(at({ match, body: { error: { code: "maxlag", info: "Waiting for a database server" } } }), "rate_limited");
  await rejects(at(status(match, 429)), "rate_limited");
  await rejects(at(route("fandom", match, "cloudflare-challenge-403.html", { status: 403, type: "text/html" })), "blocked");
  await rejects(at({ match, body: { parse: { title: "x", wikitext: "no rows" } } }), "source_shape");
});
