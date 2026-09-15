// Merch, FX, cosplay-news and fashion adapters, run through the real sourceHttp with recorded fixtures.
// Fixtures are trimmed live responses captured on 2026-09-15 (scripts/fixtures/feeds/{merch,fx,cosplaynews}).
import test from "node:test";
import assert from "node:assert/strict";
import { fixtureTransport, publicLookup, runAdapterAll, runAdapterPage } from "./lib/feed-source-harness.mjs";
import { sourceHttp } from "../server/feeds/http.js";
import { FeedError } from "../server/feeds/config.js";
import { normalizeItem } from "../server/feeds/normalize.js";
import { defineSource, validateAdapterItem } from "../server/feeds/sources/registry.js";
import { COSPLAY_FORMATS, FASHION_STYLES, MERCH_TYPES } from "../server/feeds/sources/tags.js";
import * as merch from "../server/feeds/sources/merch.js";
import * as fx from "../server/feeds/sources/fx.js";
import * as news from "../server/feeds/sources/cosplaynews.js";
import * as fashion from "../server/feeds/sources/fashion.js";

const NOW = Date.parse("2026-09-15T15:00:00Z"); // 23:00 in Singapore
const DAY = "2026-09-15";
const clock = () => NOW;
const HTML = "text/html; charset=utf-8";
const JSON_TYPE = "application/json; charset=utf-8";
const exact = (url) => (href) => href === url;
const FX_ROUTE = { match: exact(fx.FX_URL), file: "frankfurter-sgd-jpy-usd.json", source: "fx", type: JSON_TYPE };
const SG_HOSTS = ["toycoin.com.sg", "toyorgame.com.sg", "shop.otakuhouse.com", "www.candytoyo.sg", "kinokuniya.com.sg"];

// ---------------------------------------------------------------------------------------------------
// Route builders.

const SOLARIS_PAGES = {
  "good-smile-racing-hatsune-miku-blind-box-series-racing-miku-all-stars-figure-collection-vol-1-good-smile-company": "solaris-page-racing-miku.html",
  "sousou-no-frieren-fern-nendoroid-3130-nendoroid-basic-winter-clothes-ver-good-smile-company": "solaris-page-fern.html",
  "piapro-characters-hatsune-miku-s-fire-new-semester-sega-fave-shop-exclusive": "solaris-page-s-fire.html",
  "bocchi-the-rock-kita-ikuyo-digsta-digism": "solaris-page-bocchi-kita.html",
  "sousou-no-frieren-frieren-uon-bandai-spirits": "solaris-page-frieren-uon.html",
  "kusuriya-no-hitorigoto-jinshi-break-time-collection-vol-2-bandai-spirits": "solaris-page-jinshi-prize.html",
  "tongari-boushi-no-atelier-coco-1-6-2027-re-release-ques-q": "solaris-page-coco.html",
  "kusuriya-no-hitorigoto-nendoroid-surprise-nendoroid-surprise-kusuriya-no-hitorigoto-maomao-jinshi-collection-good-smile-company": "solaris-page-surprise.html",
  "genshin-impact-durin-piccodo-1-12-genesis": "solaris-page-durin.html",
  "vocaloid-hatsune-miku-nendoroid-3139-v6-good-smile-company": "solaris-page-miku-v6.html",
};
const solarisPage = (handle) => `https://solarisjapan.com/products/${handle}`;
function solarisRoutes({ listing = "solaris-products.json", extra = [] } = {}) {
  return [
    ...extra,
    { match: exact(merch.SOLARIS_LISTING_URL), file: listing, source: "merch", type: JSON_TYPE },
    FX_ROUTE,
    ...Object.entries(SOLARIS_PAGES).map(([handle, file]) => ({ match: exact(solarisPage(handle)), file, source: "merch", type: HTML })),
  ];
}

const GSC_IDS = [
  "1146565", "1139166", "1146663", "1138612", "3668", "5200", "1143946", "1141385", "1141388", "1141381",
  "1142551", "60897", "1138675", "1139076", "1137014", "1138393", "1142608",
];
function gscRoutes({ extra = [] } = {}) {
  return [
    ...extra,
    { match: exact(merch.GSC_HOME_URL), file: "gsc-home.html", source: "merch", type: HTML },
    { match: exact(merch.GSC_CALENDAR_URL), file: "gsc-releaseinfo.html", source: "merch", type: HTML },
    FX_ROUTE,
    ...GSC_IDS.map((id) => ({ match: new RegExp(`^https://www\\.goodsmile\\.com/en/product/${id}/.+`), file: `gsc-product-${id}.html`, source: "merch", type: HTML })),
    // Calendar links have no slug; GSC answers with a same-origin 302 to the canonical page.
    ...GSC_IDS.map((id) => ({
      match: exact(`https://www.goodsmile.com/en/product/${id}`),
      status: 302,
      body: "",
      type: HTML,
      headers: { location: `https://www.goodsmile.com/en/product/${id}/canonical` },
    })),
  ];
}
const newsRoute = (url, file, extra = {}) => ({ match: exact(url), file, source: "cosplaynews", type: "application/rss+xml; charset=UTF-8", ...extra });

/** Raw (pre-normalization) page through the real sourceHttp, for contract checks on adapter output. */
async function rawPage(rawEntry, routes, { cursor = null, day = DAY, items = 8, deadline = Date.now() + 60_000, calls = [], send } = {}) {
  const entry = defineSource(rawEntry);
  const http = sourceHttp({ ...entry, paceMs: 0 }, {
    deadline: Date.now() + 60_000,
    stats: {},
    send: send ?? fixtureTransport(entry.id, routes, calls),
    lookup: publicLookup,
  });
  const page = await entry.fetch({ day, cursor, deadline, signal: AbortSignal.timeout(60_000), run: null, limits: { items }, credentials: {}, http });
  return { entry, page, calls, http };
}
const byNative = (items) => Object.fromEntries(items.map((i) => [i.nativeId, i]));
const hosts = (items) => [...new Set(items.flatMap((i) => i.facts.links.map((l) => new URL(l.url).hostname)))];

// ---------------------------------------------------------------------------------------------------
// Fandom matching, routing, types.

test("fandom matching uses canonical tags and rejects look-alike names", () => {
  const m = merch.matchFandoms;
  assert.deepEqual(m("Sousou no Frieren - Fern - Nendoroid (#3130)"), { fandoms: ["frieren"], characters: ["fern"], voicebanks: [] });
  assert.deepEqual(m("Kusuriya no Hitorigoto - Nendoroid Surprise: Maomao & Jinshi Collection").characters, ["maomao", "jinshi"]);
  assert.deepEqual(m("Piapro Characters - Hatsune Miku - S-Fire").fandoms, ["vocaloid"]);
  assert.deepEqual(m("KADOKAWA PLASTIC MODEL SERIES 【OSHI NO KO】 - Ruby").fandoms, ["oshi no ko"]);
  assert.deepEqual(m("Honkai: Star Rail - March 7th").fandoms, ["honkai: star rail"]);
  assert.deepEqual(m("Project Sekai: Colorful Stage! feat. Hatsune Miku").fandoms, ["vocaloid", "project sekai"]);
  // Crypton's all-caps names count; short names need Vocaloid context.
  assert.deepEqual(m("Nendoroid Doll KAITO: Guilty Ver.").voicebanks, ["kaito"]);
  assert.deepEqual(m("Vocaloid - Luka - figure").voicebanks, ["luka"]);
  for (const unrelated of [
    "Gotoubun no Hanayome ∬ - Nakano Miku - 1/6 - Date Style Ver. (Good Smile Company)",
    "Girls' Frontline 2: Exilium - HK416 - Klukai",
    "THE iDOLM@STER Million Live! - Tokoro Megumi",
    "Kono Subarashii Sekai ni Shukufuku o! 3 - Megumin",
    "Honkai Impact 3rd - Bronya Zaychik - Limepie - 1/8",
    "Original - Shiino Mikuro - 1/6 - Nurse Ver.",
    "Hololive - Kiryu Coco",
    "Minecraft - Creeper plush",
    "VOICEROID - Yuzuki Yukari",
  ])
    assert.deepEqual(m(unrelated).fandoms, [], unrelated);
});

test("merch items get section merch plus exactly one home section", () => {
  assert.deepEqual(merch.merchSections(["the apothecary diaries", "vocaloid"]), ["merch", "maomao"]);
  assert.deepEqual(merch.merchSections(["vocaloid"]), ["merch", "music"]);
  assert.deepEqual(merch.merchSections(["project sekai", "genshin impact"]), ["merch", "music"]);
  for (const f of ["genshin impact", "honkai: star rail", "frieren", "bungo stray dogs", "witch hat atelier", "oshi no ko", "bocchi the rock!", "girls band cry"])
    assert.deepEqual(merch.merchSections([f]), ["merch", "dressup"], f);
  assert.ok(!merch.MERCH_FANDOMS.includes("minecraft"));
});

test("merch type mapping only emits MERCH_TYPES values", () => {
  const t = merch.merchType;
  assert.equal(t({ title: "Hatsune Miku Miku Hug Series HUGGY DOLL PLUS Plushie: Flower Ver.", category: "Plushie" }), "plushies");
  assert.equal(t({ title: "Hatsune Miku Miku Hug Series Acrylic Stand: Flower Ver.", category: "Goods" }), "acrylic stands");
  assert.equal(t({ title: "Hatsune Miku Miku Hug Series Pinback Button: Flower Ver." }), "badges");
  assert.equal(t({ title: "Hatsune Miku Miku Hug Series T-Shirt: Flower Ver.", category: "Goods" }), "shirts");
  assert.equal(t({ title: "figma Snow Miku: Crystal Snow ver." }), "figma");
  assert.equal(t({ title: "Nendoroid Fern: Winter Clothes Ver. [Basic]", category: "Nendoroid" }), "nendoroids");
  assert.equal(t({ title: "Nendoroid Plus: Osamu Dazai Rubber Mascot", category: "Nendoroid Plus" }), "other goods");
  assert.equal(t({ title: "Sousou no Frieren - Frieren - Uon (Bandai Spirits)", figure: ["Prize"] }), "prize figures");
  assert.equal(t({ title: "Frieren 1/7 Scale Figure", category: "Scale Figure" }), "scale figures");
  assert.equal(t({ title: "Blind Box Series: Racing Miku All Stars", category: "Collectible/Trading/Capsule Toy" }), "gacha");
  assert.equal(t({ title: "Hatsune Miku Miku Hug Series Hoodie: Flower Ver.", category: "Goods" }), "other goods");
  for (const title of ["x", "Acrylic Keychain", "Enamel Pin Set"]) assert.ok(MERCH_TYPES.includes(t({ title })));
});

test("GTIN/JAN identity is check-digit validated and normalized", () => {
  assert.equal(merch.normalizeGtin("4570232592971"), "4570232592971");
  assert.equal(merch.normalizeGtin("04570232592971"), "4570232592971");
  assert.equal(merch.normalizeGtin("4570232592972"), null);
  assert.equal(merch.normalizeGtin("NOEAN8106034324"), null);
  assert.equal(merch.normalizeGtin("012345678905"), "0012345678905");
  assert.equal(merch.normalizeGtin(""), null);
});

test("release precision: Solaris month-end dates and GSC shipping months are month precision", () => {
  assert.deepEqual(merch.parseSolarisRelease("31. Jan 2027"), {
    releaseAt: "2027-01-01T03:00:00.000Z",
    releasePrecision: "month",
    endsAt: Date.parse("2027-01-31T23:59:59+09:00"),
  });
  assert.equal(merch.parseSolarisRelease("28. Feb 2027").releasePrecision, "month");
  assert.equal(merch.parseSolarisRelease("29. Feb 2028").releasePrecision, "month"); // leap year month end
  const day = merch.parseSolarisRelease("25. Sep 2026");
  assert.equal(day.releasePrecision, "day");
  assert.equal(day.releaseAt, "2026-09-25T03:00:00.000Z");
  assert.equal(merch.parseSolarisRelease("31. Feb 2027"), null);
  assert.equal(merch.parseSolarisRelease("TBA"), null);
  assert.equal(merch.parseShippingMonth("Shipping 01/2027・Limit 3 per person").releaseAt, "2027-01-01T03:00:00.000Z");
  assert.equal(merch.parseShippingMonth("Preorder Period: 2026/01/08~2026/03/25 (JST) Shipping 2026/09").releaseAt, "2026-09-01T03:00:00.000Z");
  assert.equal(merch.parseShippingMonth("Shipping 13/2027"), null);
  // The month instant renders as the same month in Singapore (the writer formats in Asia/Singapore).
  const sg = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Singapore" });
  assert.equal(sg.format(new Date(merch.parseShippingMonth("Shipping 01/2027").releaseAt)), "January 2027");
  assert.deepEqual(merch.parseCalendarHeading("Shipping out from the 24th of September 2026:"), {
    day: "2026-09-24",
    text: "Shipping out from the 24th of September 2026",
  });
});

test("preorder deadline: availabilityEnds JST date becomes the end of that JST day", () => {
  assert.equal(merch.preorderDeadline("2026-10-21"), "2026-10-21T14:59:59.000Z");
  assert.equal(merch.preorderDeadline("2026-10-21T12:00:00+09:00"), "2026-10-21T03:00:00.000Z");
  assert.equal(merch.preorderDeadline("2026-02-30"), null);
  assert.equal(merch.preorderDeadline(undefined), null);
  const sg = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
  assert.equal(sg.format(new Date(merch.preorderDeadline("2026-10-21"))), "21 Oct");
});

// ---------------------------------------------------------------------------------------------------
// FX.

test("Frankfurter rates are parsed, inverted, dated and cached per invocation", async () => {
  const body = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("./fixtures/feeds/fx/frankfurter-sgd-jpy-usd.json", import.meta.url), "utf8"));
  const rates = fx.parseSgdRates(body);
  assert.deepEqual(rates, { JPY: 0.00822368, USD: 1.27102, asOf: "2026-09-15", source: fx.FX_SOURCE });
  assert.deepEqual(fx.toSgd(3900, "JPY", rates), { sgd: 32.07, fx: { rate: 0.00822368, asOf: "2026-09-15", source: fx.FX_SOURCE } });
  assert.deepEqual(fx.toSgd(33.47, "USD", rates), { sgd: 42.54, fx: { rate: 1.27102, asOf: "2026-09-15", source: fx.FX_SOURCE } });
  assert.deepEqual(fx.toSgd(40, "SGD", rates), { sgd: 40, fx: null });
  assert.equal(fx.toSgd(10, "EUR", rates), null); // unknown currency → null, never a guess
  assert.equal(fx.toSgd(10, "USD", null), null);
  assert.equal(fx.toSgd(10, "USD", { ...rates, USD: null }), null);
  assert.equal(fx.toSgd(-1, "USD", rates), null);
  assert.equal(fx.toSgd(null, "USD", rates), null);
  assert.equal(fx.parseSgdRates({ rates: { SGD: 1 } }), null);
  assert.equal(fx.parseSgdRates([{ date: "2026-09-15", base: "EUR", quote: "SGD", rate: 1.5 }]), null);

  const calls = [];
  const make = () =>
    sourceHttp({ id: "fx-test", hosts: [fx.FX_HOST], mediaHosts: [], maxRequests: 4, maxBytes: 64_000, paceMs: 0 }, {
      deadline: Date.now() + 30_000,
      send: fixtureTransport("fx", [FX_ROUTE], calls),
      lookup: publicLookup,
    });
  const http = make();
  const [a, b] = await Promise.all([fx.sgdRates(http), fx.sgdRates(http)]);
  assert.equal(a, b);
  assert.equal(calls.length, 1, "one FX request per invocation");
  await fx.sgdRates(make());
  assert.equal(calls.length, 2, "a new invocation reads a fresh rate");
});

test("FX unavailability keeps sgd null; deadline errors still propagate", async () => {
  const blocked = sourceHttp({ id: "fx-test", hosts: [fx.FX_HOST], mediaHosts: [], maxRequests: 4, maxBytes: 64_000, paceMs: 0 }, {
    deadline: Date.now() + 30_000,
    send: fixtureTransport("fx", [{ match: exact(fx.FX_URL), status: 422, file: "frankfurter-422.json", source: "fx", type: JSON_TYPE }]),
    lookup: publicLookup,
  });
  assert.equal(await fx.sgdRates(blocked), null);
  const deadline = { json: async () => { throw new FeedError("deadline", 409); } };
  await assert.rejects(fx.sgdRates(deadline), { code: "deadline" });
  assert.throws(() => fx.sgdRates(null), { code: "fx_http_required" });

  const { items } = await runAdapterAll(merch.makeSolarisMerch({ now: clock }), {
    routes: solarisRoutes({ extra: [{ match: exact(fx.FX_URL), status: 403, body: "", type: JSON_TYPE }] }),
  });
  const fern = byNative(items)["8105076359211"];
  assert.deepEqual(fern.facts.priceOriginal, { amount: 33.47, currency: "USD", asOf: "2026-09-15T15:00:00.000Z" });
  assert.equal(fern.facts.sgd, null);
  assert.equal(fern.facts.fx, null);
});

// ---------------------------------------------------------------------------------------------------
// Solaris Japan.

test("solaris: fandom products only, routed, typed, priced in USD with dated SGD", async () => {
  const { items, calls } = await runAdapterAll(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes() });
  const got = byNative(items);
  assert.deepEqual(Object.keys(got).sort(), [
    "8090380861483", "8092236251179", "8092236972075", "8094878498859", "8095554895915",
    "8100810489899", "8100879237163", "8105076359211", "8105081962539",
  ]);
  const expect = {
    "8105081962539": { sections: ["merch", "music"], topics: ["gacha"], fandoms: ["vocaloid"], price: 125.54, sgd: 159.56, availability: "preorder" },
    "8105076359211": { sections: ["merch", "dressup"], topics: ["nendoroids"], fandoms: ["frieren"], price: 33.47, sgd: 42.54, availability: "preorder" },
    "8100879237163": { sections: ["merch", "music"], topics: ["other goods"], fandoms: ["vocaloid"], price: null, sgd: null, availability: "preorder" },
    "8100810489899": { sections: ["merch", "dressup"], topics: ["other goods"], fandoms: ["bocchi the rock!"], price: 85.94, sgd: 109.23, availability: "preorder" },
    "8095554895915": { sections: ["merch", "dressup"], topics: ["prize figures"], fandoms: ["frieren"], price: null, sgd: null, availability: "sold_out" },
    "8094878498859": { sections: ["merch", "maomao"], topics: ["prize figures"], fandoms: ["the apothecary diaries"], price: 25.24, sgd: 32.08, availability: "in_stock" },
    "8092236972075": { sections: ["merch", "dressup"], topics: ["scale figures"], fandoms: ["witch hat atelier"], price: 168.78, sgd: 214.52, availability: "preorder" },
    "8092236251179": { sections: ["merch", "maomao"], topics: ["nendoroids"], fandoms: ["the apothecary diaries"], price: 79.89, sgd: 101.54, availability: "preorder" },
    "8090380861483": { sections: ["merch", "dressup"], topics: ["scale figures"], fandoms: ["genshin impact"], price: null, sgd: null, availability: "preorder" },
  };
  for (const [id, e] of Object.entries(expect)) {
    const item = got[id];
    assert.equal(item.kind, "merch", id);
    assert.deepEqual(item.sections, e.sections, id);
    assert.deepEqual(item.tags.topics, e.topics, id);
    assert.deepEqual(item.tags.fandoms, e.fandoms, id);
    assert.equal(item.facts.priceOriginal?.amount ?? null, e.price, id);
    assert.equal(item.facts.sgd, e.sgd, id);
    assert.equal(item.facts.availability, e.availability, id);
    assert.equal(item.facts.availabilityCheckedAt, "2026-09-15T15:00:00.000Z", id);
    assert.equal(item.expiresAt, "2026-09-17T15:00:00.000Z", id); // ≤ 48 h price freshness
    if (e.price !== null) {
      assert.equal(item.facts.priceOriginal.currency, "USD");
      assert.equal(item.facts.priceOriginal.asOf, "2026-09-15T15:00:00.000Z");
      assert.deepEqual(item.facts.fx, { rate: 1.27102, asOf: "2026-09-15", source: fx.FX_SOURCE });
    } else assert.equal(item.facts.fx, null, id);
    for (const t of item.tags.topics) assert.ok(MERCH_TYPES.includes(t));
    assert.ok(item.media.every((m) => m.type === "image" && new URL(m.url).hostname === "cdn.shopify.com"));
    assert.equal(item.credit.platform, "Solaris Japan");
  }
  assert.deepEqual(got["8105076359211"].tags.characters, ["fern"]);
  assert.deepEqual(got["8092236251179"].tags.characters, ["maomao", "jinshi"]);
  assert.deepEqual(got["8105081962539"].tags.voicebanks, ["hatsune miku"]);
  // Only matched products' pages were requested; nothing on other hosts or /search.
  const pageCalls = calls.filter((c) => c.url.startsWith("https://solarisjapan.com/products/")).map((c) => c.url);
  assert.equal(new Set(pageCalls).size, 9);
  for (const handle of ["the-idolm-ster", "girls-frontline", "kono-subarashii", "honkai-impact", "original-shiino", "vocaloid-hatsune-miku-nendoroid-3139"])
    assert.ok(!pageCalls.some((u) => u.includes(handle)), handle);
  assert.ok(calls.every((c) => !/\/search/.test(c.url)));
});

test("solaris: sold-out, $0.00 and Early Bird-only variants never become a price", async () => {
  const { items } = await runAdapterAll(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes() });
  const got = byNative(items);
  const uon = got["8095554895915"]; // Brand New unavailable at $29.04, only Pre Owned in stock
  assert.equal(uon.facts.availability, "sold_out");
  assert.equal(uon.facts.priceOriginal, null);
  assert.deepEqual(uon.facts.prices, []);
  const sfire = got["8100879237163"]; // Brand New $0.00 sold out, Shop Exclusive available
  assert.equal(sfire.facts.priceOriginal, null);
  assert.equal(sfire.facts.sgd, null);
  assert.deepEqual(sfire.facts.prices, ["Shop Exclusive US$111.03"]);
  const durin = got["8090380861483"]; // Brand New placeholder $0.61 unavailable, Early Bird available
  assert.equal(durin.facts.priceOriginal, null);
  assert.deepEqual(durin.facts.prices, ["Early Bird US$81.61"]);
  assert.equal(durin.facts.availability, "preorder");
});

test("solaris: release precision, GTIN identity, names and links", async () => {
  const { items, entry } = await runAdapterPage(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes() });
  const fern = items.find((i) => i.nativeId === "8105076359211");
  assert.equal(fern.facts.releaseAt, "2027-01-01T03:00:00.000Z");
  assert.equal(fern.facts.releasePrecision, "month");
  assert.deepEqual(fern.facts.dates, ["Release Date 31. Jan 2027"]);
  assert.deepEqual(fern.facts.names, ["Good Smile Company", "JAN 4570232592971"]);
  assert.equal(fern.mediaIdentity, "gtin:4570232592971");
  assert.equal(fern.url, "https://solarisjapan.com/products/sousou-no-frieren-fern-nendoroid-3130-nendoroid-basic-winter-clothes-ver-good-smile-company");
  assert.deepEqual(fern.facts.links.map((l) => l.kind), ["sg_search", "sg_search", "sg_search", "sg_search", "sg_search", "retailer", "taobao_search"]);
  assert.deepEqual(fern.facts.links.slice(0, 5).map((l) => l.url), [
    "https://toycoin.com.sg/search?q=Fern+Nendoroid+Basic+Winter+Clothes&type=product",
    "https://toyorgame.com.sg/search?q=Fern+Nendoroid+Basic+Winter+Clothes&type=product",
    "https://shop.otakuhouse.com/search?q=Fern+Nendoroid+Basic+Winter+Clothes&type=product",
    "https://www.candytoyo.sg/search?q=Fern+Nendoroid+Basic+Winter+Clothes&type=product",
    "https://kinokuniya.com.sg/search?q=Fern+Nendoroid+Basic+Winter+Clothes&type=product",
  ]);
  assert.equal(fern.facts.links[6].url, "https://s.taobao.com/search?q=Fern%20Nendoroid%20Basic%20Winter%20Clothes");
  assert.equal(fern.facts.links[6].label, "search Taobao — check it says 正版");
  for (const host of hosts(items)) assert.ok(entry.linkHosts.includes(host), host);
  // A prize figure without a JAN has no media identity rather than a made-up one.
  const jinshi = items.find((i) => i.nativeId === "8094878498859");
  assert.equal(jinshi.mediaIdentity, undefined);
  assert.equal(jinshi.facts.releasePrecision, "month");
});

test("solaris: bounded pages advance a cursor and resume after the listing is re-read", async () => {
  const all = await runAdapterAll(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes(), items: 3 });
  assert.equal(all.pages, 3);
  assert.equal(all.items.length, 9);
  const first = await runAdapterPage(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes(), items: 3 });
  assert.equal(first.items.length, 3);
  assert.equal(first.page.done, false);
  assert.ok(first.page.cursor.length < 400);
  // Near the invocation deadline the adapter stops early with a resumable cursor.
  const { page } = await rawPage(merch.makeSolarisMerch({ now: clock }), solarisRoutes(), { deadline: Date.now() + 5_000 });
  assert.equal(page.items.length, 1);
  assert.equal(page.done, false);
  const resumed = await runAdapterAll(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes(), cursor: page.cursor });
  assert.equal(resumed.items.length, 8);
});

test("solaris: the 14-day window and per-build cap bound product-page requests", async () => {
  assert.equal(merch.SOLARIS_WINDOW_DAYS, 14);
  assert.equal(merch.SOLARIS_MAX_PRODUCTS, 12);
  const earlier = await runAdapterAll(merch.makeSolarisMerch({ now: () => Date.parse("2026-09-10T00:00:00Z") }), { routes: solarisRoutes() });
  const ids = earlier.items.map((i) => i.nativeId);
  assert.ok(ids.includes("8083357302827"), "Miku Nendoroid V6 (31 Aug) is inside the window on 10 Sep");
  const v6 = byNative(earlier.items)["8083357302827"];
  assert.deepEqual(v6.sections, ["merch", "music"]);
  assert.equal(v6.mediaIdentity, "gtin:4570232593107");
  assert.ok(!ids.includes("8083465764907"), "nsfw-tagged listing is skipped");
});

test("solaris: unrelated listings (Nakano Miku) cost no product page or FX request", async () => {
  const calls = [];
  const { items, page } = await runAdapterPage(merch.makeSolarisMerch({ now: () => Date.parse("2020-01-01T00:00:00Z") }), {
    routes: solarisRoutes({ listing: "solaris-collection-gotoubun.json" }),
    calls,
  });
  assert.equal(items.length, 0);
  assert.equal(page.done, true);
  assert.deepEqual(calls.map((c) => c.url), [merch.SOLARIS_LISTING_URL]);
});

test("solaris: failures propagate; a delisted product page is skipped", async () => {
  const s = () => merch.makeSolarisMerch({ now: clock });
  await assert.rejects(runAdapterPage(s(), { routes: solarisRoutes({ extra: [{ match: exact(merch.SOLARIS_LISTING_URL), status: 403, body: "" }] }) }), { code: "blocked" });
  await assert.rejects(
    runAdapterPage(s(), { routes: solarisRoutes({ extra: [{ match: exact(merch.SOLARIS_LISTING_URL), status: 429, body: "", headers: { "retry-after": "0" } }] }) }),
    { code: "rate_limited" },
  );
  await assert.rejects(runAdapterPage(s(), { routes: solarisRoutes({ extra: [{ match: exact(merch.SOLARIS_LISTING_URL), body: { products: [] } }] }) }), {
    code: "unexpected_source_format",
  });
  const fernUrl = solarisPage("sousou-no-frieren-fern-nendoroid-3130-nendoroid-basic-winter-clothes-ver-good-smile-company");
  await assert.rejects(
    runAdapterPage(s(), { routes: solarisRoutes({ extra: [{ match: exact(fernUrl), body: "<html><body>maintenance</body></html>", type: HTML }] }) }),
    { code: "unexpected_source_format" },
  );
  await assert.rejects(
    runAdapterPage(s(), { routes: solarisRoutes({ extra: [{ match: exact(fernUrl), status: 500, body: "", headers: { "retry-after": "0" } }] }) }),
    { code: "source_http_500" },
  );
  const { items } = await runAdapterAll(s(), { routes: solarisRoutes({ extra: [{ match: exact(fernUrl), status: 404, body: "" }] }) });
  assert.equal(items.length, 8);
  assert.ok(!items.some((i) => i.nativeId === "8105076359211"));
});

// ---------------------------------------------------------------------------------------------------
// Good Smile Company.

test("gsc: discovery parses tiles and the calendar; candidates exclude unrelated names", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (name) => readFile(new URL(`./fixtures/feeds/merch/${name}`, import.meta.url), "utf8");
  const tiles = merch.parseGscHome(await read("gsc-home.html"));
  const calendar = merch.parseGscCalendar(await read("gsc-releaseinfo.html"));
  assert.equal(tiles.filter((t) => t.kind === "pre-order").length, 24);
  assert.equal(tiles.filter((t) => t.kind === "limited").length, 16);
  const hug = calendar.find((e) => e.id === "1141385");
  assert.deepEqual(hug, {
    id: "1141385",
    url: "https://www.goodsmile.com/en/product/1141385",
    name: "Hatsune Miku Miku Hug Series HUGGY DOLL PLUS Plushie: Flower Ver.",
    note: "",
    jan: "4580828665866",
    maker: "Good Smile Company",
    shipping: { day: "2026-09-16", text: "Shipping out from the 16th of September 2026" },
  });
  const candidates = merch.gscCandidates({ tiles, calendar, day: DAY });
  // Six open preorders/exclusives interleaved by fandom (Magical Mirai 2017 is the third item of one
  // product line), then upcoming calendar goods, one per fandom: Miku Hug, Hyacine, Übel, Dazai.
  assert.deepEqual(candidates.map((c) => c.id), ["1146565", "1139166", "1143946", "1146663", "1138612", "3668", "1141385", "1139076", "1137014", "1138393"]);
  assert.equal(candidates.length, merch.GSC_MAX_PRODUCTS);
  assert.deepEqual(candidates[6], {
    id: "1141385",
    url: "https://www.goodsmile.com/en/product/1141385",
    name: "Hatsune Miku Miku Hug Series HUGGY DOLL PLUS Plushie: Flower Ver.",
    maker: "Good Smile Company",
    jans: ["4580828665866"],
    notes: [],
    shipping: { day: "2026-09-16", text: "Shipping out from the 16th of September 2026" },
  });
  const names = calendar.map((e) => e.name);
  for (const unrelated of [
    "Marin Kitagawa: Swimsuit Ver.",
    "Rinami Himesaki: Bunny Ver.",
    "Nendoroid Satoru Gojo: Tokyo Jujutsu High School Ver.",
    "POP UP PARADE Chisato Nishikigi: After Party! Ver. L Size",
    "Plushie Anya",
    "Cycling Jersey Shiroko: Riding Ver. M",
  ]) {
    assert.ok(names.includes(unrelated), unrelated);
    assert.equal(merch.discoveryStrength(unrelated), 0, unrelated);
  }
  // Names without a series are hints only; the product page's series label must confirm them.
  for (const hint of ["Nendoroid Plus: Osamu Dazai Rubber Mascot", "POP UP PARADE Übel", "Nendoroid Hyacine", "Huggy Good Smile Sparxie Plushie"]) {
    assert.ok(names.includes(hint), hint);
    assert.equal(merch.discoveryStrength(hint), 1, hint);
  }
});

test("gsc: one product line cannot flood the bounded candidate list", async () => {
  const { readFile } = await import("node:fs/promises");
  const calendar = merch.parseGscCalendar(await readFile(new URL("./fixtures/feeds/merch/gsc-releaseinfo.html", import.meta.url), "utf8"));
  const hug = calendar.filter((e) => e.name.startsWith("Hatsune Miku Miku Hug Series"));
  assert.equal(hug.length, 9);
  assert.equal(new Set(hug.map((e) => merch.productLine(e.name))).size, 1);
  const candidates = merch.gscCandidates({ tiles: [], calendar, day: DAY });
  assert.equal(candidates.length, merch.GSC_MAX_PRODUCTS);
  assert.equal(candidates.filter((c) => c.name.startsWith("Hatsune Miku Miku Hug Series")).length, merch.GSC_MAX_PER_LINE);
  const fandoms = new Set(candidates.map((c) => merch.discoveryFandom(c.name)));
  assert.deepEqual([...fandoms].sort(), ["bungo stray dogs", "frieren", "honkai: star rail", "vocaloid"]);
  assert.deepEqual(merch.interleaveByFandom(["a1", "a2", "b1", "a3", "c1"], (x) => x[0]), ["a1", "b1", "c1", "a2", "a3"]);
});

test("gsc: preorders carry JPY price, dated SGD, deadline, shipping month and GTIN", async () => {
  const { items, calls } = await runAdapterAll(merch.makeGscMerch({ now: clock }), { routes: gscRoutes() });
  assert.equal(items.length, 10);
  const got = byNative(items);
  const fern = got["1143946"];
  assert.equal(fern.title, "Nendoroid Fern: Winter Clothes Ver. [Basic]");
  assert.equal(fern.url, "https://www.goodsmile.com/en/product/1143946");
  assert.deepEqual(fern.sections, ["merch", "dressup"]);
  assert.deepEqual(fern.tags.topics, ["nendoroids"]);
  assert.deepEqual(fern.facts.priceOriginal, { amount: 3900, currency: "JPY", asOf: "2026-09-15T15:00:00.000Z" });
  assert.equal(fern.facts.sgd, 32.07);
  assert.deepEqual(fern.facts.fx, { rate: 0.00822368, asOf: "2026-09-15", source: fx.FX_SOURCE });
  assert.equal(fern.facts.availability, "preorder");
  assert.equal(fern.facts.preorderUntil, "2026-10-21T14:59:59.000Z");
  assert.equal(fern.facts.releaseAt, "2027-01-01T03:00:00.000Z");
  assert.equal(fern.facts.releasePrecision, "month");
  assert.deepEqual(fern.facts.dates, ["Preorder Period: 2026/09/11〜2026/10/21 (JST)", "Shipping 01/2027"]);
  assert.deepEqual(fern.facts.prices, ["￥3,900"]);
  assert.equal(fern.mediaIdentity, "gtin:4570232592971");
  assert.equal(fern.publishedAt, "2026-09-10T15:00:00.000Z");
  assert.equal(fern.expiresAt, "2026-09-17T15:00:00.000Z");
  assert.deepEqual(fern.media.map((m) => new URL(m.url).hostname), ["www.goodsmile.com"]);
  assert.deepEqual(fern.facts.links.map((l) => l.kind), ["official", "sg_search", "sg_search", "sg_search", "sg_search", "sg_search", "taobao_search"]);
  assert.equal(fern.facts.links[0].url, "https://www.goodsmile.com/en/product/1143946");

  const expected = {
    "1146565": ["merch", "dressup", "other goods", 76.89, "2026-10-28T14:59:59.000Z"],
    "1139166": ["merch", "music", "gacha", 18.09, "2026-10-21T14:59:59.000Z"],
    "1146663": ["merch", "music", "gacha", 144.74, "2026-10-21T14:59:59.000Z"],
    "1138612": ["merch", "music", "nendoroids", 65.79, "2026-10-14T14:59:59.000Z"],
    "3668": ["merch", "music", "nendoroids", 56.74, "2026-10-14T14:59:59.000Z"],
  };
  for (const [id, [a, b, type, sgd, until]] of Object.entries(expected)) {
    assert.deepEqual(got[id].sections, [a, b], id);
    assert.deepEqual(got[id].tags.topics, [type], id);
    assert.equal(got[id].facts.sgd, sgd, id);
    assert.equal(got[id].facts.preorderUntil, until, id);
    assert.equal(got[id].facts.availability, "preorder", id);
  }
  assert.equal(got["3668"].title, "Nendoroid Hatsune Miku: Magical Mirai 2016 Ver. (Rerelease)");
  // Hint-only discoveries were confirmed by each page's series label before becoming items.
  const hinted = {
    "1139076": [["honkai: star rail"], "nendoroids", 61.68],
    "1137014": [["frieren"], "other goods", 45.23],
    "1138393": [["bungo stray dogs"], "other goods", 10.69],
  };
  for (const [id, [fandoms, type, sgd]] of Object.entries(hinted)) {
    assert.deepEqual(got[id].tags.fandoms, fandoms, id);
    assert.deepEqual(got[id].sections, ["merch", "dressup"], id);
    assert.deepEqual(got[id].tags.topics, [type], id);
    assert.equal(got[id].facts.sgd, sgd, id);
    assert.equal(got[id].facts.preorderUntil, null, id);
    assert.equal(got[id].facts.availability, "announced", id); // ships 17 Sep, after the 15 Sep build
  }
  // The Racing Miku box shares its JAN with Solaris' listing, so both merge on media identity.
  assert.equal(got["1146663"].mediaIdentity, "gtin:4570232593343");
  assert.ok(calls.every((c) => !/\/search/.test(c.url)), "robots: no search paths");
  assert.ok(calls.every((c) => ["www.goodsmile.com", "api.frankfurter.dev"].includes(new URL(c.url).hostname)));
});

test("gsc: closed preorders from the calendar: no deadline, announced before shipping, released after", async () => {
  const { items } = await runAdapterAll(merch.makeGscMerch({ now: clock }), { routes: gscRoutes() });
  const hug = byNative(items)["1141385"];
  assert.equal(hug.facts.preorderUntil, null);
  assert.equal(hug.facts.availability, "announced"); // ships from 16 Sep; build day is 15 Sep
  assert.deepEqual(hug.facts.dates, ["Preorder Period: 2026/03/09~2026/03/25 (JST)", "Shipping 09/2026", "Shipping out from the 16th of September 2026"]);
  assert.equal(hug.publishedAt, "2026-09-15T15:00:00.000Z");
  assert.deepEqual(hug.tags.topics, ["plushies"]);

  const { readFile } = await import("node:fs/promises");
  const fromCalendar = async (id, day, text) =>
    merch.gscItem(
      { id, url: `https://www.goodsmile.com/en/product/${id}`, name: "", maker: "", jans: [], notes: [], shipping: { day, text } },
      await readFile(new URL(`./fixtures/feeds/merch/gsc-product-${id}.html`, import.meta.url), "utf8"),
      { fetchedAt: "2026-09-15T15:00:00.000Z", rates: null, day: DAY, nowMs: NOW },
    );
  const shirt = await fromCalendar("1141388", "2026-09-16", "Shipping out from the 16th of September 2026");
  assert.deepEqual([shirt.tags.topics[0], shirt.sections[1], shirt.facts.availability], ["shirts", "music", "announced"]);
  const stand = await fromCalendar("1141381", "2026-09-16", "Shipping out from the 16th of September 2026");
  assert.equal(stand.tags.topics[0], "acrylic stands");
  const sparxie = await fromCalendar("1142608", "2026-09-04", "Shipping out from the 4th of September 2026");
  assert.deepEqual(sparxie.tags.fandoms, ["honkai: star rail"]);
  assert.deepEqual(sparxie.sections, ["merch", "dressup"]);
  assert.equal(sparxie.tags.topics[0], "plushies");
  assert.equal(sparxie.facts.availability, "released"); // shipped 4 Sep, before the build day
  assert.equal(sparxie.facts.releaseAt, "2026-09-01T03:00:00.000Z"); // "Shipping 2026/09"
  assert.equal(sparxie.publishedAt, "2026-09-03T15:00:00.000Z");

  const page = await readFile(new URL("./fixtures/feeds/merch/gsc-product-1142551.html", import.meta.url), "utf8");
  const calendar = merch.parseGscCalendar(await readFile(new URL("./fixtures/feeds/merch/gsc-releaseinfo.html", import.meta.url), "utf8"));
  const bsdRows = calendar.filter((e) => e.id === "1142551");
  assert.equal(bsdRows.length, 0, "the trimmed calendar fixture ends before 27 Aug; build the candidate by hand");
  const candidate = {
    id: "1142551",
    url: "https://www.goodsmile.com/en/product/1142551",
    name: "Bungo Stray Dogs Plush Pendant Chuya Nakahara",
    maker: "GoodSmile Moment",
    jans: ["4580828673052"],
    notes: [],
    shipping: { day: "2026-08-27", text: "Shipping out from the 27th of August 2026" },
  };
  const bsd = merch.gscItem(candidate, page, { fetchedAt: "2026-09-15T15:00:00.000Z", rates: null, day: DAY, nowMs: NOW });
  assert.deepEqual(bsd.sections, ["merch", "dressup"]);
  assert.deepEqual(bsd.tags.fandoms, ["bungo stray dogs"]);
  assert.equal(bsd.facts.availability, "released");
  assert.equal(bsd.facts.sgd, null, "no rates → no SGD guess");
  assert.equal(bsd.mediaIdentity, "gtin:4580828673052", "primary variant follows the calendar JAN");
  assert.deepEqual(bsd.facts.names, ["GoodSmile Moment", "JAN 4580828673052", "JAN 4580828673021", "JAN 4580828673038", "JAN 4580828673045"]);
  assert.equal(bsd.facts.releaseAt, "2026-08-01T03:00:00.000Z");
  assert.deepEqual(bsd.tags.topics, ["plushies"]);
  assert.ok(validateAdapterItem(bsd, defineSource(merch.gscMerch)));

  const rerelease = await readFile(new URL("./fixtures/feeds/merch/gsc-product-60897.html", import.meta.url), "utf8");
  const frieren = merch.gscItem(
    { id: "60897", url: "https://www.goodsmile.com/en/product/60897", name: "Frieren 1/7 Scale Figure", maker: "Claynel", jans: ["4571452943482"], notes: ["(Rerelease)"], shipping: { day: "2026-09-10", text: "Shipping out from the 10th of September 2026" } },
    rerelease,
    { fetchedAt: "2026-09-15T15:00:00.000Z", rates: null, day: DAY, nowMs: NOW },
  );
  assert.equal(frieren.title, "Frieren 1/7 Scale Figure (Rerelease)");
  assert.equal(frieren.facts.availability, "released");
  assert.equal(frieren.facts.releaseAt, "2026-09-01T03:00:00.000Z"); // "Shipping 2026/09"
  assert.deepEqual(frieren.tags.topics, ["scale figures"]);
  assert.deepEqual(frieren.tags.characters, ["frieren"]);
});

test("gsc: a product page whose series is not hers is dropped even if discovery was fooled", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(new URL("./fixtures/feeds/merch/gsc-product-1138675.html", import.meta.url), "utf8");
  const fooled = { id: "1138675", url: "https://www.goodsmile.com/en/product/1138675", name: "Nendoroid Plus: Coco Rubber Mascot", maker: "", jans: [], notes: [], shipping: null };
  assert.equal(merch.discoveryStrength(fooled.name), 1);
  assert.equal(merch.gscItem(fooled, page, { fetchedAt: "2026-09-15T15:00:00.000Z", rates: null, day: DAY, nowMs: NOW }), null);
});

test("gsc: pages are bounded with a cursor; failures propagate", async () => {
  const paged = await runAdapterAll(merch.makeGscMerch({ now: clock }), { routes: gscRoutes(), items: 4 });
  assert.equal(paged.pages, 3);
  assert.equal(paged.items.length, 10);
  const g = () => merch.makeGscMerch({ now: clock });
  await assert.rejects(runAdapterPage(g(), { routes: gscRoutes({ extra: [{ match: exact(merch.GSC_HOME_URL), status: 403, body: "", type: HTML }] }) }), { code: "blocked" });
  await assert.rejects(
    runAdapterPage(g(), { routes: gscRoutes({ extra: [{ match: exact(merch.GSC_CALENDAR_URL), status: 503, body: "", type: HTML, headers: { "retry-after": "0" } }] }) }),
    { code: "source_http_503" },
  );
  await assert.rejects(
    runAdapterPage(g(), { routes: gscRoutes({ extra: [{ match: exact(merch.GSC_CALENDAR_URL), body: "<html><body>no calendar</body></html>", type: HTML }] }) }),
    { code: "unexpected_source_format" },
  );
  await assert.rejects(
    runAdapterPage(g(), { routes: gscRoutes({ extra: [{ match: /\/en\/product\/1146565\//, body: "<html><body>login</body></html>", type: HTML }] }) }),
    { code: "unexpected_source_format" },
  );
  // Off-origin redirects are refused by the helper instead of being followed.
  await assert.rejects(
    runAdapterPage(g(), { routes: gscRoutes({ extra: [{ match: exact("https://www.goodsmile.com/en/product/1141385"), status: 302, body: "", type: HTML, headers: { location: "https://hakkenonline.com/x" } }] }), items: 8 }),
    { code: "source_host_denied" },
  );
});

// ---------------------------------------------------------------------------------------------------
// Search links and link host validation.

test("SG search and Taobao links use the verified formats and exact hosts", () => {
  const links = merch.sgSearchLinks("Nendoroid Fern: Winter Clothes Ver. [Basic]");
  assert.deepEqual(links.map((l) => new URL(l.url).hostname), SG_HOSTS);
  assert.deepEqual(links.map((l) => l.label), ["search ToyCoin (SG)", "search TOG (SG)", "search Otaku House (SG)", "search Candytoyo (SG)", "search Kinokuniya (SG)"]);
  for (const l of links) {
    const u = new URL(l.url);
    assert.equal(u.pathname, "/search");
    assert.equal(u.searchParams.get("q"), "Nendoroid Fern Winter Clothes");
    assert.equal(u.searchParams.get("type"), "product");
    assert.equal(l.kind, "sg_search");
  }
  assert.deepEqual(merch.taobaoSearchLink("初音ミク ねんどろいど"), {
    kind: "taobao_search",
    label: "search Taobao — check it says 正版",
    url: "https://s.taobao.com/search?q=%E5%88%9D%E9%9F%B3%E3%83%9F%E3%82%AF%20%E3%81%AD%E3%82%93%E3%81%A9%E3%82%8D%E3%81%84%E3%81%A9",
  });
  assert.deepEqual(merch.sgSearchLinks("  "), []);
  assert.equal(merch.taobaoSearchLink(""), null);
  assert.equal(merch.searchQuery("Nendoroid Hatsune Miku: Magical Mirai 2025 Ver."), "Nendoroid Hatsune Miku Magical Mirai 2025");
  assert.equal(merch.searchQuery("Tongari Boushi no Atelier - Coco - 1/6 - 2027 Re-release (Ques Q)"), "Tongari Boushi no Atelier Coco");
  assert.deepEqual(merch.solarisMerch.linkHosts, ["solarisjapan.com", ...SG_HOSTS, "s.taobao.com"]);
  assert.deepEqual(merch.gscMerch.linkHosts, ["www.goodsmile.com", ...SG_HOSTS, "s.taobao.com"]);
});

test("link, media and URL hosts are validated against the entry allowlists", async () => {
  const { page, entry } = await rawPage(merch.makeSolarisMerch({ now: clock }), solarisRoutes());
  const raw = page.items[0];
  assert.ok(validateAdapterItem(raw, entry));
  const fakeShop = structuredClone(raw);
  fakeShop.facts.links.push({ kind: "retailer", label: "official store", url: "https://hoyoverseofficial.store/products/x" });
  assert.throws(() => validateAdapterItem(fakeShop, entry), { code: "source_host_denied" });
  const lookalike = structuredClone(raw);
  lookalike.facts.links[0].url = "https://toycoin.com.sg.evil.example/search?q=x";
  assert.throws(() => validateAdapterItem(lookalike, entry), { code: "source_host_denied" });
  const rehost = structuredClone(raw);
  rehost.media[0].url = "https://solarisjapan.com/cdn/shop/files/x.jpg";
  assert.throws(() => validateAdapterItem(rehost, entry), { code: "source_host_denied" });
  const wrongSection = structuredClone(raw);
  wrongSection.sections = ["merch", "meme"];
  assert.throws(() => validateAdapterItem(wrongSection, entry), { code: "adapter_contract" });
});

test("identical products from Solaris and GSC share a GTIN identity alias", async () => {
  const solaris = await runAdapterPage(merch.makeSolarisMerch({ now: clock }), { routes: solarisRoutes() });
  const gsc = await runAdapterAll(merch.makeGscMerch({ now: clock }), { routes: gscRoutes() });
  const a = solaris.items.find((i) => i.nativeId === "8105076359211");
  const b = gsc.items.find((i) => i.nativeId === "1143946");
  assert.equal(a.mediaIdentity, b.mediaIdentity);
  const shared = a.identityKeys.filter((k) => b.identityKeys.includes(k));
  assert.equal(shared.length, 1);
  assert.notEqual(a.id, b.id);
  const unrelated = normalizeItem({ source: "gsc-merch", nativeId: "1", sections: ["merch"], kind: "merch", title: "x", url: "https://www.goodsmile.com/en/product/1", credit: { name: "x", platform: "x" } });
  assert.equal(unrelated.identityKeys.filter((k) => a.identityKeys.includes(k)).length, 0);
});

// ---------------------------------------------------------------------------------------------------
// Cosplay news.

test("cosplay news routes to dressup and adds maomao/music only on a fandom match", async () => {
  assert.deepEqual(news.newsSections([]), ["dressup"]);
  assert.deepEqual(news.newsSections(["the apothecary diaries"]), ["dressup", "maomao"]);
  assert.deepEqual(news.newsSections(["project sekai"]), ["dressup", "music"]);
  assert.deepEqual(news.newsSections(["genshin impact"]), ["dressup"]);
  const { items } = await runAdapterAll(news.makeSoranewsCosplay({ now: () => Date.parse("2025-01-20T00:00:00Z") }), {
    routes: [newsRoute("https://soranews24.com/tag/cosplay/feed/", "soranews-cosplay-page2.xml")],
  });
  assert.deepEqual(items.map((i) => i.title), ["Will our cosplay lucky bag purchase leave us feeling sew lucky or hemmed in?【Photos】"]);
  assert.deepEqual(items[0].sections, ["dressup", "music"]);
  assert.deepEqual(items[0].tags.fandoms, ["project sekai"]);
  assert.equal(items[0].credit.name, "Krista Rogers");
  assert.equal(items[0].credit.platform, "SoraNews24");
});

test("soranews: recent link-only news with on-host thumbnails; suggestive and stale items skipped", async () => {
  const { items, calls } = await runAdapterAll(news.makeSoranewsCosplay({ now: clock }), {
    routes: [newsRoute("https://soranews24.com/tag/cosplay/feed/", "soranews-cosplay.xml")],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(items.map((i) => i.nativeId), ["https://soranews24.com/?p=744833", "https://soranews24.com/?p=741621"]);
  const [sword, shrine] = items;
  assert.equal(sword.kind, "news");
  assert.deepEqual(sword.sections, ["dressup"]);
  assert.deepEqual(sword.tags.formats, ["props"]);
  assert.deepEqual(sword.media.map((m) => m.url), ["https://soranews24.com/wp-content/uploads/sites/3/2026/09/0_4cccea.jpg"]);
  assert.equal(sword.facts.excerpts.length, 1);
  assert.ok(sword.facts.excerpts[0].length <= 600);
  assert.equal(sword.facts.links.length, 0);
  assert.ok(shrine.safety.sourceTags.includes("World War II"), "category words reach rules.js");
  for (const i of items) for (const f of i.tags.formats) assert.ok(COSPLAY_FORMATS.includes(f));
  assert.equal(items.every((i) => i.expiresAt === null), true);
});

test("arda: contests and wig posts only, own-CDN images, no sales or logistics posts", async () => {
  const route = [newsRoute("https://arda-wigs.com/blogs/news.atom", "arda-news.atom", { type: "application/atom+xml; charset=utf-8" })];
  const spring = await runAdapterAll(news.makeArdaWigs({ now: () => Date.parse("2026-04-10T00:00:00Z") }), { routes: route });
  assert.deepEqual(spring.items.map((i) => i.title), ["Iron Wig 2025 Final Round Results"]);
  const results = spring.items[0];
  assert.equal(results.kind, "news");
  assert.deepEqual(results.tags.formats, ["wig"]);
  assert.deepEqual(results.media.map((m) => m.url), ["https://cdn.shopify.com/s/files/1/1409/1418/files/iw2025r3sailor.png?v=1774877893"]);
  assert.equal(results.credit.name, "Arda Wigs");
  const autumn = await runAdapterAll(news.makeArdaWigs({ now: () => Date.parse("2025-10-01T00:00:00Z") }), { routes: route });
  assert.deepEqual(autumn.items.map((i) => i.title), ["Iron Wig 2025 Round 2: Character Challenge"]);
  assert.deepEqual(autumn.items[0].media, [], "proxied external images are not hotlinked");
  const winter = await runAdapterAll(news.makeArdaWigs({ now: () => Date.parse("2025-12-15T00:00:00Z") }), { routes: route });
  assert.deepEqual(winter.items.map((i) => i.title), ["D&December 2025"], "Cyber Monday sale post is skipped");
  const now = await runAdapterPage(news.makeArdaWigs({ now: clock }), { routes: route });
  assert.deepEqual(now.items, [], "only a shipping-hiatus notice is recent");
  assert.equal(now.page.done, true);
});

test("kamui: disabled optional entry; conditional GET sends validators and handles 304", async () => {
  assert.equal(news.kamuiCosplay.enabled, false);
  assert.equal(news.kamuiCosplay.status, "optional");
  assert.equal(news.kamuiCosplay.timeoutMs, 20000);
  const url = "https://www.kamuicosplay.com/feed/";
  const validators = new Map();
  const make = () => news.makeKamuiCosplay({ now: () => Date.parse("2025-12-01T00:00:00Z"), validators });
  const lastModified = "Tue, 15 Sep 2026 14:11:53 GMT";
  const first = await runAdapterAll(make(), { routes: [newsRoute(url, "kamui-feed.xml", { headers: { "last-modified": lastModified } })] });
  assert.deepEqual(first.items.map((i) => [i.kind, i.title]), [
    ["tutorial", "Creating Mauvika’s Sword from Genshin Impact"],
    ["tutorial", "Bringing Yelan from Genshin Impact to life!"],
  ]);
  assert.deepEqual(first.items[0].tags.fandoms, ["genshin impact"]);
  assert.deepEqual(first.items[0].sections, ["dressup"]);
  assert.equal(first.calls[0].headers["if-modified-since"], undefined);
  assert.deepEqual(validators.get(url), { etag: null, lastModified });

  const calls = [];
  const notModified = await runAdapterPage(make(), {
    routes: [{ match: (href, o) => href === url && o.headers["if-modified-since"] === lastModified, status: 304, body: "", type: "application/rss+xml" }],
    calls,
  });
  assert.deepEqual(notModified.items, []);
  assert.equal(notModified.page.done, true);
  assert.equal(calls.length, 1);

  // A 304 without validators is not a valid "nothing new"; it fails loudly.
  await assert.rejects(
    runAdapterPage(news.makeKamuiCosplay({ now: clock, validators: new Map() }), { routes: [{ match: exact(url), status: 304, body: "" }] }),
    { code: "source_http_304" },
  );
});

test("kamui: a body slower than the 20 s budget fails after one request instead of looking empty", async () => {
  // Mirrors the live probe (2026-09-15T19:12Z): the socket abort is a plain error, the helper's single
  // retry is refused by maxRequests: 1, and health records a failure rather than an empty page.
  let sent = 0;
  const slow = (_url, { signal }) => {
    sent++;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  };
  const entry = defineSource({ ...news.makeKamuiCosplay({ validators: new Map() }), timeoutMs: 50 });
  await assert.rejects(rawPage(entry, [], { send: slow }), { code: "source_request_limit" });
  assert.equal(sent, 1);
});

test("news feeds: blocked or non-feed responses propagate as failures", async () => {
  const url = "https://soranews24.com/tag/cosplay/feed/";
  await assert.rejects(runAdapterPage(news.makeSoranewsCosplay({ now: clock }), { routes: [{ match: exact(url), status: 403, body: "" }] }), { code: "blocked" });
  await assert.rejects(
    runAdapterPage(news.makeSoranewsCosplay({ now: clock }), { routes: [{ match: exact(url), body: "<html><body>Just a moment...</body></html>", type: HTML }] }),
    { code: "unexpected_source_format" },
  );
  await assert.rejects(
    runAdapterPage(news.makeArdaWigs({ now: clock }), { routes: [{ match: exact("https://arda-wigs.com/blogs/news.atom"), body: "{}", type: JSON_TYPE }] }),
    { code: "unexpected_content_type" },
  );
});

// ---------------------------------------------------------------------------------------------------
// Fashion and entry contracts.

test("acdc rag stays disabled and never contacts the shop", async () => {
  const entry = defineSource(fashion.acdcRagLooks);
  assert.equal(entry.enabled, false);
  assert.equal(entry.status, "optional");
  assert.deepEqual(entry.sections, ["dressup"]);
  const calls = [];
  await assert.rejects(runAdapterPage(fashion.acdcRagLooks, { routes: [], calls }), { code: "restricted_by_source_terms" });
  assert.equal(calls.length, 0);
  assert.deepEqual(fashion.styleTopics("Y2K skater streetwear baggy jeans"), ["y2k", "skater streetwear"]);
  assert.deepEqual(fashion.styleTopics("girly sweet lolita one-piece"), ["sweet", "girly"]);
  assert.deepEqual(fashion.styleTopics("Harajuku punk bondage pants"), []);
  for (const s of fashion.styleTopics("y2k girly skater sweet style")) assert.ok(FASHION_STYLES.includes(s));
});

test("every entry passes defineSource with exact hosts and bounded requests", () => {
  const entries = [merch.solarisMerch, merch.gscMerch, news.ardaWigs, news.soranewsCosplay, news.kamuiCosplay, fashion.acdcRagLooks];
  assert.deepEqual(entries.map((e) => e.id), ["solaris-merch", "gsc-merch", "arda-wigs", "soranews-cosplay", "kamui-cosplay", "acdcrag-looks"]);
  for (const raw of entries) {
    const e = defineSource(raw);
    assert.ok(e.maxBytes <= 2 * 1024 * 1024, e.id);
    assert.ok(e.maxRequests >= 1 && e.maxRequests <= 24, e.id);
    assert.ok(e.paceMs >= 1500 && e.timeoutMs <= 20000, e.id);
    assert.ok(e.termsUrl && e.docsUrl && e.notes.length > 80, e.id);
    assert.equal(e.copyPolicy, "link_only", e.id);
    assert.equal(e.deletionPolicy, "none", e.id);
    for (const h of [...e.hosts, ...e.mediaHosts, ...(e.linkHosts ?? [])]) assert.match(h, /^[a-z0-9.-]+\.[a-z]{2,}$/, `${e.id} ${h}`);
  }
  assert.deepEqual(merch.solarisMerch.hosts, ["solarisjapan.com", "api.frankfurter.dev"]);
  assert.deepEqual(merch.gscMerch.hosts, ["www.goodsmile.com", "api.frankfurter.dev"]);
  assert.deepEqual(merch.solarisMerch.sections, ["merch", "maomao", "music", "dressup"]);
  assert.deepEqual(news.soranewsCosplay.sections, ["dressup", "maomao", "music"]);
});
