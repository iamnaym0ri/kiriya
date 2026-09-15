// Merch collectors for her fandoms: Solaris Japan (Shopify products.json + product JSON-LD) and Good
// Smile Company (homepage preorder tiles + shipping calendar + product JSON-LD). Singapore shops and
// Taobao are plain search links only: they are never fetched by any adapter.
//
// Source verification (2026-09-15, home WSL machine with a US exit, not Vercel):
// - Solaris: robots.txt (Shopify 2026 wording) allows public product/collection pages; /agents.md lists
//   product and collection JSON under "Read-Only Browsing (No Authentication Required)". The merchant
//   terms (/policies/terms-of-service) contain no crawling/scraping clause. /meta.json ships_to_countries
//   includes "*" (rest of world). Release dates are shown as a month's last day ("31. Jan 2027").
// - GSC: robots.txt only disallows /*/search (never requested). Terms of Use Article 13(11) prohibits
//   improperly accessing the server, so requests stay few and paced. Product JSON-LD carries JPY price,
//   PreOrder, availabilityStarts/availabilityEnds (the preorder deadline, a JST date) and gtin.
//   Shipping to Singapore: /en/news/5786 rate table lists "South East Asia $8.00" per preorder item type.
// - SG search URLs: each shop's /agents.md documents `GET /search?q={query}&type=product` (ToyCoin, TOG,
//   Candytoyo, Kinokuniya); Otaku House's storefront form is `action="/search"` with `q` and
//   `type=product`. Taobao's homepage links use `https://s.taobao.com/search?q=<UTF-8 percent-encoded>`.
import { FeedError } from "../config.js";
import {
  asArray,
  clip,
  cursor as cursorCodec,
  decodeEntities,
  hostOf,
  httpsOnly,
  jsonLd,
  metaContent,
  stripHtml,
  toIso,
} from "./util.js";
import { CHARACTER_ALIASES, FANDOM_ALIASES, MERCH_TYPES, mentions } from "./tags.js";
import { FX_HOST, sgdRates, toSgd } from "./fx.js";

const DAY_MS = 86_400_000;
/** Merch price/availability claims expire 48 h after they were read (continuation contract). */
export const PRICE_TTL_MS = 48 * 3_600_000;
const SOFT_DEADLINE_MS = 8_000;
const PAGE_BYTES = 768 * 1024;

// ---------------------------------------------------------------------------------------------------
// Search links (plain links; the shops' Shopify terms forbid crawling, so nothing here is requested).

export const SG_SHOPS = [
  { name: "ToyCoin", host: "toycoin.com.sg" },
  { name: "TOG", host: "toyorgame.com.sg" },
  { name: "Otaku House", host: "shop.otakuhouse.com" },
  { name: "Candytoyo", host: "www.candytoyo.sg" },
  { name: "Kinokuniya", host: "kinokuniya.com.sg" },
];
export const SG_LINK_HOSTS = SG_SHOPS.map((shop) => shop.host);
export const TAOBAO_HOST = "s.taobao.com";
export const TAOBAO_LABEL = "search Taobao — check it says 正版";

function queryWords(text) {
  const cleaned = String(text)
    .replace(/【([^】]*)】/g, " $1 ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/#\d+/g, " ")
    .replace(/\b\d+\/\d+\b/g, " ")
    // "2027 Re-release" is listing noise, but years like "Magical Mirai 2025" identify the product.
    .replace(/\b(?:19|20)\d{2}\s+re-?(?:release|issue)\b|\bre-?(?:release|issue)\s+(?:19|20)\d{2}\b/gi, " ")
    .replace(/\b(?:re-?release|re-?issue|ver(?:sion)?)\b\.?/gi, " ")
    .replace(/['’]/g, "")
    .replace(/\s-\s/g, " ")
    .replace(/[:：、,，.!！?？"“”/|~〜・&＆]+/g, " ");
  return cleaned.split(/\s+/).filter(Boolean);
}

/** A short shop-search query: no maker/brackets/JAN/scale/year noise, at most eight distinct words. */
export function searchQuery(name) {
  const title = decodeEntities(String(name ?? "")).replace(/\s+/g, " ").trim();
  const segments = title.split(/\s+-\s+/);
  // Solaris titles read "Franchise - Character - Line - Version (Maker)"; the franchise adds noise
  // unless the rest would be a single ambiguous word ("Coco").
  let words = queryWords(segments.length >= 3 ? segments.slice(1).join(" ") : title);
  if (segments.length >= 3 && words.length <= 1) words = queryWords(title);
  const out = [];
  const seen = new Set();
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length === 8) break;
  }
  return out.join(" ").slice(0, 120).trim();
}

/** "search <shop> (SG)" links for the verified Singapore GSC partner shops. */
export function sgSearchLinks(name) {
  const q = searchQuery(name);
  if (!q) return [];
  return SG_SHOPS.map((shop) => {
    const url = new URL(`https://${shop.host}/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("type", "product");
    return { kind: "sg_search", label: `search ${shop.name} (SG)`, url: url.href };
  });
}

/** Taobao search link with the approved 正版 (genuine) reminder, or null for an empty name. */
export function taobaoSearchLink(name) {
  const q = searchQuery(name);
  if (!q) return null;
  return { kind: "taobao_search", label: TAOBAO_LABEL, url: `https://${TAOBAO_HOST}/search?q=${encodeURIComponent(q)}` };
}

// ---------------------------------------------------------------------------------------------------
// Fandom matching, section routing and merch types.

/** Every canonical fandom except Minecraft (memes only). */
export const MERCH_FANDOMS = Object.keys(FANDOM_ALIASES).filter((f) => f !== "minecraft");
// Shop spellings missing from tags.js. They resolve to canonical keys only; no new tag is invented.
const EXTRA_FANDOM_ALIASES = {
  "honkai: star rail": ["honkai star rail", "崩壊:スターレイル"],
  "project sekai": ["プロセカ"],
};
const FANDOM_MAP = Object.fromEntries(
  MERCH_FANDOMS.map((f) => [
    f,
    // VOICEROID is a different text-to-speech product line, not Vocaloid merch.
    [...FANDOM_ALIASES[f].filter((a) => a !== "voiceroid"), ...(EXTRA_FANDOM_ALIASES[f] ?? [])],
  ]),
);
// Short voicebank names collide with other franchises ("Nakano Miku", "Klukai", "Megumi"), so short
// forms only count next to Vocaloid context. Full names and Crypton's all-caps names always count.
const VOCALOID_CONTEXT =
  /vocaloid|ボーカロイド|piapro|ピアプロ|crypton|character vocal series|hatsune miku|初音ミク|project sekai|プロジェクトセカイ|colorful stage|magical mirai|マジカルミライ|miku expo/i;
const VOICEBANK_RULES = [
  ["hatsune miku", /hatsune\s+miku|初音ミク|初音未来|\b(?:racing|snow|sakura)\s+miku\b/i, /\bmiku\b/i],
  ["kagamine rin", /kagamine\s+rin\b|鏡音リン/i, null],
  ["kagamine len", /kagamine\s+len\b|鏡音レン/i, null],
  ["luka", /megurine\s+luka|巡音ルカ/i, /\bluka\b/i],
  ["kaito", /\bKAITO\b/, /\bkaito\b|カイト/i],
  ["meiko", /\bMEIKO\b/, /\bmeiko\b|メイコ/i],
  ["kasane teto", /kasane\s+teto|重音テト/i, /\bteto\b/i],
  ["gumi", /megpoid|\bGUMI\b/, /\bgumi\b/i],
];
const VOICEBANK_NAMES = VOICEBANK_RULES.map(([name]) => name);
const OTHER_CHARACTERS = Object.fromEntries(
  Object.entries(CHARACTER_ALIASES).filter(([name]) => !VOICEBANK_NAMES.includes(name)),
);
const CHARACTER_FANDOM = {
  maomao: "the apothecary diaries",
  jinshi: "the apothecary diaries",
  pairin: "the apothecary diaries",
  meimei: "the apothecary diaries",
  joka: "the apothecary diaries",
  xiaolan: "the apothecary diaries",
  gaoshun: "the apothecary diaries",
  lakan: "the apothecary diaries",
  luomen: "the apothecary diaries",
  gyokuyou: "the apothecary diaries",
  lynette: "genshin impact",
  frieren: "frieren",
  fern: "frieren",
  coco: "witch hat atelier",
};
// Discovery-only hints for GSC names that omit the series ("Nendoroid Plus: Osamu Dazai ..."). A hint
// only earns a product-page request; the page's series label must still confirm the fandom.
// Common words (Stark, Robin, Kafka, Topaz, Aura) are left out because other franchises use them.
// Verified 2026-09-15: "POP UP PARADE Übel" → Frieren, "Nendoroid Hyacine" and "Huggy Good Smile
// Sparxie Plushie" → Honkai: Star Rail, "Nendoroid Plus: Osamu Dazai ..." → Bungo Stray Dogs.
const DISCOVERY_HINTS = {
  "the apothecary diaries": ["maomao", "jinshi", "猫猫", "壬氏", "gaoshun", "pairin", "meimei", "xiaolan"],
  frieren: ["frieren", "fern", "himmel", "übel", "ubel", "denken", "methode", "heiter", "eisen", "wirbel", "lawine", "kanne", "flamme"],
  "witch hat atelier": ["coco", "agott", "tetia", "richeh", "qifrey"],
  "bungo stray dogs": ["osamu dazai", "atsushi nakajima", "chuya nakahara", "chuuya nakahara", "ryunosuke akutagawa", "ranpo edogawa", "fyodor dostoevsky"],
  "oshi no ko": ["ai hoshino", "ruby hoshino", "aqua hoshino", "kana arima", "akane kurokawa", "mem-cho", "memcho"],
  "bocchi the rock!": ["hitori gotoh", "nijika ijichi", "ryo yamada", "ikuyo kita", "kita ikuyo"],
  "girls band cry": ["nina iseri", "momoka kawaragi", "subaru awa", "tomo ebizuka"],
  "genshin impact": [
    "lynette", "lyney", "paimon", "nahida", "furina", "raiden shogun", "yae miko", "kamisato ayaka", "kamisato ayato",
    "zhongli", "venti", "klee", "ganyu", "keqing", "mavuika", "neuvillette", "navia", "arlecchino", "wriothesley",
    "citlali", "xilonen", "mualani", "kinich", "skirk", "columbina", "yoimiya", "shenhe", "tartaglia", "kaedehara kazuha",
    "sangonomiya kokomi", "arataki itto", "kuki shinobu", "alhaitham", "tighnari", "nilou", "yelan", "beidou", "ningguang",
    "fischl", "sigewinne", "clorinde", "chiori", "eula", "qiqi",
  ],
  "honkai: star rail": [
    "march 7th", "silver wolf", "acheron", "dan heng", "castorice", "aglaea", "the herta", "hyacine", "sparxie", "jingliu",
    "fu xuan", "ruan mei", "black swan", "huohuo", "tribbie", "phainon", "anaxa", "cyrene", "firefly", "stelle", "caelus",
  ],
};

/** Voicebanks named in text, applying the context rule above. */
export function detectVoicebanks(text) {
  const s = String(text ?? "");
  const context = VOCALOID_CONTEXT.test(s);
  return VOICEBANK_RULES.filter(([, full, short]) => full.test(s) || (context && short?.test(s))).map(([name]) => name);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Removes multi-word franchise names so "Sousou no Frieren - Fern" tags Fern, not Frieren. */
function withoutFranchiseNames(text, fandoms) {
  let out = String(text);
  for (const fandom of fandoms)
    for (const alias of FANDOM_MAP[fandom] ?? []) {
      const phrase = alias.replaceAll("_", " ");
      if (phrase.includes(" ")) out = out.replace(new RegExp(escapeRegExp(phrase), "gi"), " | ");
    }
  return out;
}

/** Canonical fandoms/characters/voicebanks for her fandoms. Empty `fandoms` means "not one of hers". */
export function matchFandoms(text) {
  const s = String(text ?? "");
  const found = new Set(mentions(s, FANDOM_MAP));
  const voicebanks = detectVoicebanks(s);
  if (voicebanks.length) found.add("vocaloid");
  const fandoms = MERCH_FANDOMS.filter((f) => found.has(f));
  const others = mentions(withoutFranchiseNames(s, fandoms), OTHER_CHARACTERS).filter((c) =>
    fandoms.includes(CHARACTER_FANDOM[c]),
  );
  return { fandoms, characters: [...voicebanks, ...others], voicebanks };
}
export const matchMerchFandoms = matchFandoms;

/** Discovery strength for a name without series context: 2 = direct match, 1 = hint only, 0 = none. */
export function discoveryStrength(name) {
  if (matchMerchFandoms(name).fandoms.length) return 2;
  return mentions(name, DISCOVERY_HINTS).length ? 1 : 0;
}

/** The fandom a candidate most likely belongs to (direct match first, then a hint), for variety. */
export function discoveryFandom(name) {
  return matchMerchFandoms(name).fandoms[0] ?? mentions(name, DISCOVERY_HINTS)[0] ?? null;
}

/**
 * Round-robin across fandoms in order of first appearance, keeping each fandom's own order, so one
 * big drop (nine "Miku Hug Series" goods) cannot crowd every other fandom out of a bounded build.
 */
export function interleaveByFandom(list, fandomOf) {
  const queues = new Map();
  for (const entry of list) {
    const key = fandomOf(entry) ?? "";
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(entry);
  }
  const out = [];
  for (let round = 0; out.length < list.length; round++)
    for (const queue of queues.values()) if (round < queue.length) out.push(queue[round]);
  return out;
}

/** Every merch item is on the shelf plus exactly one home section. */
export function merchSections(fandoms) {
  if (fandoms.includes("the apothecary diaries")) return ["merch", "maomao"];
  if (fandoms.includes("vocaloid") || fandoms.includes("project sekai")) return ["merch", "music"];
  return ["merch", "dressup"];
}

// Suggestive product lines are skipped before any page request (hard no; rules/vision still run later).
export const SUGGESTIVE =
  /\b(?:swimsuits?|swimwear|mizugi|bikinis?|lingerie|underwear|nude|nudity|cast[- ]?off|bathing|sexy|lewd|r-?18)\b|18\+|\bbunny\s+(?:ver|version|girl|suit|style)\b|水着|下着|バニー/i;

/** One MERCH_TYPES value from a title, a shop category and Solaris `meta-figure-*` tags. */
export function merchType({ title = "", category = "", figure = [] } = {}) {
  const t = `${title} ${category}`.toLowerCase();
  const tags = asArray(figure).map((f) => String(f).toLowerCase().trim());
  let type = "other goods";
  if (/\bplush(?:ie|ies)?\b|\bnuigurumi\b|\bhuggy\b|\bchocopuni\b|\bkuripan\b|ぬいぐるみ/.test(t)) type = "plushies";
  else if (/acrylic\s+(?:stand|standee|figure)s?\b|\bstandees?\b|アクリルスタンド|アクスタ/.test(t)) type = "acrylic stands";
  else if (/\bcan\s+badges?\b|\bbadges?\b|pinback\s+buttons?|缶バッジ/.test(t)) type = "badges";
  else if (/\b(?:enamel\s+|metal\s+)?pins?\b/.test(t)) type = "pins";
  else if (/\bt-?shirts?\b|\btees?\b/.test(t)) type = "shirts";
  else if (/\bfigma\b/.test(t) || tags.includes("figma")) type = "figma";
  else if (tags.includes("nendoroid") || (/\bnendoroid\b/.test(t) && !/nendoroid\s+(?:plus|more)|outfit\s+set|face\s+plate/.test(t)))
    type = "nendoroids";
  else if (tags.includes("prize") || /^prize$/i.test(String(category).trim())) type = "prize figures";
  else if (/\b1\/\d{1,2}\b|scale\s+figure/.test(t)) type = "scale figures";
  else if (/blind\s*box|gashapon|gachapon|capsule\s+toy|trading\s+(?:figure|mini)|ichiban\s+kuji|\bkuji\b/.test(t)) type = "gacha";
  return MERCH_TYPES.includes(type) ? type : "other goods";
}

// ---------------------------------------------------------------------------------------------------
// Identity, dates and cursors.

/** GTIN/JAN with a valid mod-10 check digit, normalized to 13 digits where possible; else null. */
export function normalizeGtin(value) {
  const raw = String(value ?? "").trim();
  if (!/^(?:\d{8}|\d{12,14})$/.test(raw)) return null;
  const code = raw.length === 14 && raw.startsWith("0") ? raw.slice(1) : raw.length === 12 ? `0${raw}` : raw;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, d, i) => total + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? code : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
const daysIn = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const validYear = (year) => year >= 2000 && year <= 2100;
// Month-precision instants sit at 12:00 JST on the 1st, which is the same calendar month in JST,
// Singapore and UTC; day precision uses 12:00 JST for the same reason.
const monthInstant = (y, m) => new Date(`${y}-${pad(m)}-01T12:00:00+09:00`).toISOString();
const dayInstant = (y, m, d) => new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00+09:00`).toISOString();
const endOfDayMs = (y, m, d) => Date.parse(`${y}-${pad(m)}-${pad(d)}T23:59:59+09:00`);

/** Solaris "31. Jan 2027". A month's last day is Solaris' convention for a manufacturer month. */
export function parseSolarisRelease(text) {
  const m = String(text ?? "").match(/\b(\d{1,2})\.\s*([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  const year = Number(m[3]);
  if (!month || !validYear(year) || day < 1 || day > daysIn(year, month)) return null;
  return day === daysIn(year, month)
    ? { releaseAt: monthInstant(year, month), releasePrecision: "month", endsAt: endOfDayMs(year, month, day) }
    : { releaseAt: dayInstant(year, month, day), releasePrecision: "day", endsAt: endOfDayMs(year, month, day) };
}

/** GSC status text "Shipping 01/2027" or "Shipping 2026/09" → month precision. */
export function parseShippingMonth(text) {
  const m = String(text ?? "").match(/\bShipping\s+(?:(\d{1,2})\/(\d{4})|(\d{4})\/(\d{1,2}))\b/i);
  if (!m) return null;
  const month = Number(m[1] ?? m[4]);
  const year = Number(m[2] ?? m[3]);
  if (month < 1 || month > 12 || !validYear(year)) return null;
  return {
    text: m[0],
    releaseAt: monthInstant(year, month),
    releasePrecision: "month",
    endsAt: endOfDayMs(year, month, daysIn(year, month)),
  };
}

/** GSC calendar heading "Shipping out from the 24th of September 2026:" → {day, text}. */
export function parseCalendarHeading(text) {
  const clean = decodeEntities(String(text ?? "")).replace(/\s+/g, " ").trim();
  const m = clean.match(/^((?:Shipping out|Releasing) from the (\d{1,2})(?:st|nd|rd|th) of ([A-Za-z]+) (\d{4}))/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[3].slice(0, 3).toLowerCase()) + 1;
  const year = Number(m[4]);
  const day = Number(m[2]);
  if (!month || !validYear(year) || day < 1 || day > daysIn(year, month)) return null;
  return { day: `${year}-${pad(month)}-${pad(day)}`, text: m[1] };
}

/** JSON-LD availabilityEnds: a JST date means the whole day (23:59:59 JST); a full datetime is kept. */
export function preorderDeadline(value) {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return validYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) ? new Date(endOfDayMs(y, m, d)).toISOString() : null;
  }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? toIso(s) : null;
}

function decodeIds(value, pattern) {
  const state = cursorCodec.decode(value, null);
  return state && state.v === 1 && Array.isArray(state.ids) && state.ids.length <= 40 && state.ids.every((id) => pattern.test(String(id)))
    ? state.ids.map(String)
    : null;
}
const encodeIds = (ids) => cursorCodec.encode({ v: 1, ids });
const nearDeadline = (ctx) => typeof ctx.deadline === "number" && ctx.deadline - Date.now() < SOFT_DEADLINE_MS;
const positiveInt = (value) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
const cleanList = (values, max = 40) =>
  [...new Set(asArray(values).map((v) => clip(decodeEntities(String(v ?? "")).replace(/\s+/g, " "), 100)).filter(Boolean))].slice(0, max);

function stillImage(url, host, pathPrefix, alt) {
  const href = httpsOnly(url);
  if (!href || hostOf(href) !== host) return null;
  const path = new URL(href).pathname;
  if (!path.startsWith(pathPrefix) || !/\.(?:jpe?g|png|webp)$/i.test(path)) return null;
  return { type: "image", url: href, alt: clip(alt, 500) };
}

/** Runs one cursor page over an ordered candidate list, fetching one product page per candidate. */
async function productPages(ctx, ids, load) {
  const take = Math.max(1, Math.min(8, Number(ctx.limits?.items) || 8));
  const items = [];
  let index = 0;
  for (; index < ids.length && items.length < take; index++) {
    // Leave room to checkpoint; the runner resumes this cursor in the next invocation.
    if (index > 0 && nearDeadline(ctx)) break;
    const item = await load(ids[index]);
    if (item) items.push(item);
  }
  const rest = ids.slice(index);
  return rest.length ? { items, cursor: encodeIds(rest), done: false } : { items, cursor: null, done: true };
}

// ---------------------------------------------------------------------------------------------------
// Solaris Japan.

const SOLARIS_HOST = "solarisjapan.com";
export const SOLARIS_LISTING_URL = `https://${SOLARIS_HOST}/products.json?limit=250`;
const SOLARIS_CDN = "cdn.shopify.com";
const SOLARIS_FILES = "/s/files/1/0318/2649/"; // Solaris' own Shopify store files (store id 3182649)
export const SOLARIS_WINDOW_DAYS = 14;
export const SOLARIS_MAX_PRODUCTS = 12;
const solarisListings = new WeakMap();

function solarisTags(product) {
  return asArray(product?.tags).map((t) => String(t));
}
function solarisText(product, extra = "") {
  const tags = solarisTags(product).map((t) => t.replace(/^meta-[a-z]+-/i, ""));
  return [product?.title ?? "", ...tags, extra].join(" | ");
}
function solarisEligible(product) {
  const tags = solarisTags(product).map((t) => t.toLowerCase());
  if (tags.includes("nsfw")) return false;
  const text = solarisText(product);
  return !SUGGESTIVE.test(text) && matchMerchFandoms(text).fandoms.length > 0;
}
/** Her fandoms published within the window, newest first within each fandom, interleaved, capped per build. */
export function solarisCandidates(products, nowMs) {
  const since = nowMs - SOLARIS_WINDOW_DAYS * DAY_MS;
  const matched = asArray(products)
    .filter((p) => p && /^\d{1,20}$/.test(String(p.id)) && Date.parse(p.published_at ?? p.created_at ?? "") >= since)
    .filter(solarisEligible);
  return interleaveByFandom(matched, (p) => matchMerchFandoms(solarisText(p)).fandoms[0])
    .slice(0, SOLARIS_MAX_PRODUCTS)
    .map((p) => String(p.id));
}
function solarisListing(http, now) {
  if (!solarisListings.has(http)) {
    solarisListings.set(
      http,
      http.json(SOLARIS_LISTING_URL, { maxBytes: 1_500_000 }).then((body) => {
        if (!Array.isArray(body?.products) || !body.products.length) throw new FeedError("unexpected_source_format", 503);
        return { products: body.products, fetchedAt: new Date(now()).toISOString() };
      }),
    );
  }
  return solarisListings.get(http);
}
function solarisDetails(html) {
  const details = {};
  for (const m of String(html).matchAll(
    /<div class="product-detail__title">([^<]*)<\/div>\s*<div class="product-detail__content[^"]*">([\s\S]*?)<\/div>/g,
  )) {
    const key = stripHtml(m[1]);
    if (key && !(key in details)) details[key] = stripHtml(m[2]);
  }
  return details;
}
const solarisUrl = (product) => `https://${SOLARIS_HOST}/products/${encodeURIComponent(String(product.handle))}`;

/** Normalizes one Solaris product plus its product page; null when the page does not confirm a fandom. */
export function solarisItem(product, html, { fetchedAt, rates, nowMs }) {
  const nodes = jsonLd(html).filter((n) => asArray(n["@type"]).includes("Product"));
  if (!nodes.length) throw new FeedError("unexpected_source_format", 503);
  const ld = nodes[0];
  const details = solarisDetails(html);
  const match = matchMerchFandoms(solarisText(product, details.Franchise ?? ""));
  if (!match.fandoms.length) return null;
  const title = clip(decodeEntities(product.title), 200);
  const url = solarisUrl(product);
  const brand = clip(
    decodeEntities(typeof ld.brand === "string" ? ld.brand : (ld.brand?.name ?? "")) || details.Brand || String(product.vendor ?? ""),
    100,
  );
  const gtin = normalizeGtin(ld.gtin14 ?? ld.gtin13 ?? ld.gtin12 ?? ld.gtin8 ?? ld.gtin);
  const release = parseSolarisRelease(details["Release Date"]);
  const variants = asArray(product.variants);
  const buyableVariant = (v) => v?.available === true && Number(v.price) > 0;
  const newCondition = (v) => !/pre[\s-]*owned|\bused\b/i.test(String(v?.title ?? ""));
  // Solaris leaves placeholder prices ($0.00, $0.31, $0.61) on unavailable variants: never a price.
  const brandNew = variants.find((v) => /^brand\s+new$/i.test(String(v?.title ?? "").trim()));
  const price = buyableVariant(brandNew) ? Math.round(Number(brandNew.price) * 100) / 100 : null;
  const buyable = variants.filter((v) => newCondition(v) && buyableVariant(v));
  const preorderLabel = /class="product__btn-label">\s*Pre[\s-]?Order/i.test(html);
  const availability = !buyable.length
    ? "sold_out"
    : preorderLabel || (release && release.endsAt > nowMs)
      ? "preorder"
      : "in_stock";
  const conversion = price === null ? null : toSgd(price, "USD", rates);
  const tags = solarisTags(product);
  const lower = tags.map((t) => t.toLowerCase());
  const figure = tags.filter((t) => /^meta-(?:figure|type)-/i.test(t)).map((t) => t.replace(/^meta-[a-z]+-/i, ""));
  const media = asArray(product.images)
    .map((img) => {
      const image = stillImage(img?.src, SOLARIS_CDN, SOLARIS_FILES, title);
      return image && { ...image, width: positiveInt(img.width), height: positiveInt(img.height) };
    })
    .filter(Boolean)
    .slice(0, 2);
  return {
    source: "solaris-merch",
    nativeId: String(product.id),
    sections: merchSections(match.fandoms),
    kind: "merch",
    title,
    url,
    media,
    credit: { name: brand || "Solaris Japan", platform: "Solaris Japan" },
    tags: {
      characters: match.characters,
      fandoms: match.fandoms,
      voicebanks: match.voicebanks,
      producers: [],
      units: [],
      formats: [],
      topics: [merchType({ title, category: details.Type ?? "", figure })],
    },
    facts: {
      excerpts: ld.description ? [clip(stripHtml(decodeEntities(ld.description)), 600)].filter(Boolean) : [],
      names: cleanList([brand, gtin && `JAN ${gtin}`]),
      dates: cleanList(details["Release Date"] ? [`Release Date ${details["Release Date"]}`] : []),
      prices: cleanList(buyable.map((v) => `${String(v.title).trim()} US$${Number(v.price).toFixed(2)}`)),
      releaseAt: release?.releaseAt ?? null,
      releasePrecision: release?.releasePrecision ?? null,
      priceOriginal: price === null ? null : { amount: price, currency: "USD", asOf: fetchedAt },
      fx: conversion?.fx ?? null,
      sgd: conversion?.sgd ?? null,
      availability,
      availabilityCheckedAt: fetchedAt,
      links: [
        ...sgSearchLinks(title),
        { kind: "retailer", label: "Solaris Japan (ships to SG)", url },
        taobaoSearchLink(title),
      ].filter(Boolean),
    },
    safety: {
      rating: lower.includes("sfw") ? "sfw" : "unknown",
      sourceTags: cleanList(tags),
      nsfw: lower.includes("nsfw"),
    },
    publishedAt: toIso(product.published_at),
    expiresAt: new Date(Date.parse(fetchedAt) + PRICE_TTL_MS).toISOString(),
    ...(gtin ? { mediaIdentity: `gtin:${gtin}` } : {}),
  };
}

async function fetchSolaris(ctx, now) {
  const listing = await solarisListing(ctx.http, now);
  const byId = new Map(listing.products.map((p) => [String(p?.id), p]));
  const ids = decodeIds(ctx.cursor, /^\d{1,20}$/) ?? solarisCandidates(listing.products, now());
  let rates;
  return productPages(ctx, ids.slice(0, SOLARIS_MAX_PRODUCTS), async (id) => {
    const product = byId.get(id);
    if (!product) return null; // dropped out of the newest-250 listing since the cursor was written
    let html;
    try {
      html = (await ctx.http.text(solarisUrl(product), { types: ["text/html"], maxBytes: PAGE_BYTES })).text;
    } catch (error) {
      if (error?.code === "not_found") return null; // delisted product; other failures propagate
      throw error;
    }
    rates ??= await sgdRates(ctx.http);
    return solarisItem(product, html, { fetchedAt: listing.fetchedAt, rates, nowMs: now() });
  });
}

export function makeSolarisMerch({ now = Date.now } = {}) {
  return {
    id: "solaris-merch",
    stage: "fetch-a",
    status: "enabled",
    enabled: true,
    sections: ["merch", "maomao", "music", "dressup"],
    kind: "merch",
    hosts: [SOLARIS_HOST, FX_HOST],
    mediaHosts: [SOLARIS_CDN],
    linkHosts: [SOLARIS_HOST, ...SG_LINK_HOSTS, TAOBAO_HOST],
    requiredCredentials: [],
    // 1 listing + ≤12 product pages + 1 FX, plus one listing re-read if the build resumes in a new invocation.
    maxRequests: 16,
    maxBytes: 1_500_000,
    paceMs: 2000,
    timeoutMs: 15000,
    cacheSeconds: 86400,
    mediaPolicy: "still_only",
    copyPolicy: "link_only",
    deletionPolicy: "none",
    attributionRequired: true,
    termsUrl: "https://solarisjapan.com/policies/terms-of-service",
    docsUrl: "https://solarisjapan.com/agents.md",
    notes:
      "Checked 2026-09-15 from a home WSL machine (US exit), not Vercel. robots.txt: public product/collection pages crawlable, /products.json not disallowed; " +
      "/agents.md lists product and collection JSON as read-only browsing; merchant terms have no crawl/scrape clause; /meta.json ships_to_countries includes '*' (rest of world). " +
      "One products.json?limit=250 read (771,692 bytes live) and product-page JSON-LD only for fandom matches published in the last 14 days (max 12 per build). " +
      "Price is the available 'Brand New' variant in USD (placeholder prices on unavailable variants are ignored); release dates are month-end manufacturer months, so releasePrecision is 'month' when the day is the month's last. " +
      "GTIN/JAN from JSON-LD gtin14 becomes mediaIdentity gtin:<code>. Images hotlinked from Solaris' cdn.shopify.com store files; link-only; SG shops/Taobao are search links, never fetched. expiresAt = read time + 48 h. " +
      "Probe 2026-09-15T19:10Z: 8 items, 10 requests, 18.7 s.",
    fetch: (ctx) => fetchSolaris(ctx, now),
  };
}
export const solarisMerch = makeSolarisMerch();

// ---------------------------------------------------------------------------------------------------
// Good Smile Company.

const GSC_HOST = "www.goodsmile.com";
export const GSC_HOME_URL = `https://${GSC_HOST}/en`;
export const GSC_CALENDAR_URL = `https://${GSC_HOST}/en/releaseinfo`;
const GSC_MEDIA_PREFIX = "/gsc-webrevo-sdk-storage-prd/";
export const GSC_MAX_PRODUCTS = 10;
const gscDiscoveries = new WeakMap();
const gscShortUrl = (id) => `https://${GSC_HOST}/en/product/${id}`;

/** "Preorders Open Now" (pre-order) and "Exclusives" (limited) tiles from the /en homepage. */
export function parseGscHome(html) {
  const tiles = [];
  for (const m of String(html).matchAll(
    /<a href="(https:\/\/www\.goodsmile\.com\/en\/product\/(\d{1,10})(?:\/[^"]*)?)" class="c-top-product-list__item c-top-product-list__item-([a-z-]+)[^"]*">([\s\S]*?)<\/a>/g,
  )) {
    const name = m[4].match(/<div class="c-product-item__title">([^<]*)<\/div>/)?.[1];
    if (!name) continue;
    tiles.push({
      id: m[2],
      url: decodeEntities(m[1]),
      kind: m[3],
      name: decodeEntities(name).replace(/\s+/g, " ").trim(),
      maker: decodeEntities(m[4].match(/<div class="c-product-item__maker">([^<]*)<\/div>/)?.[1] ?? "").trim(),
    });
  }
  return tiles;
}

/** Shipping-calendar entries with JAN codes from /en/releaseinfo. */
export function parseGscCalendar(html) {
  const text = String(html);
  const start = text.indexOf('<div class="releaseinfo">');
  if (start < 0) return [];
  const entries = [];
  let heading = null;
  let maker = "";
  for (const m of text
    .slice(start)
    .matchAll(
      /<h5>([^<]*)<\/h5>|<p class="month_text">\s*([^<]*?)\s*<br>|<a href="(https:\/\/www\.goodsmile\.com\/en\/product\/(\d{1,10}))">([^<]*)<\/a>([^<]*)<small>\(JAN:\s*(\d{8,14})\)<\/small>/g,
    )) {
    if (m[1] !== undefined) heading = parseCalendarHeading(m[1]);
    else if (m[2] !== undefined) maker = decodeEntities(m[2]).trim();
    else
      entries.push({
        id: m[4],
        url: m[3],
        name: decodeEntities(m[5]).replace(/\s+/g, " ").trim(),
        note: decodeEntities(m[6]).trim(),
        jan: normalizeGtin(m[7]),
        maker,
        shipping: heading,
      });
  }
  return entries;
}

export const GSC_PREORDER_SHARE = 6;
export const GSC_MAX_PER_LINE = 2;
/** First four words: "Hatsune Miku Miku Hug Series T-Shirt" and "... Acrylic Stand" share one line. */
export const productLine = (name) =>
  String(name ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

/**
 * Bounded, varied candidates. Tier 1: open preorders/exclusives on the homepage (at most
 * GSC_PREORDER_SHARE); tier 2: this month's calendar shipping from the build day, soonest first;
 * tier 3: this month's calendar already shipped, newest first; then unused tier-1 entries. Each tier
 * is interleaved across fandoms (direct matches before hint-only matches within a fandom) and a product
 * line contributes at most GSC_MAX_PER_LINE pages. Calendar JANs, notes and shipping days are merged
 * by product ID whichever tier admitted it.
 */
export function gscCandidates({ tiles = [], calendar = [], day }) {
  const monthStart = `${String(day).slice(0, 7)}-01`;
  const rows = new Map();
  for (const e of calendar) {
    const row = rows.get(e.id) ?? { jans: [], notes: [], shipping: null };
    if (e.jan && !row.jans.includes(e.jan)) row.jans.push(e.jan);
    if (e.note && !row.notes.includes(e.note)) row.notes.push(e.note);
    row.shipping ??= e.shipping ?? null;
    rows.set(e.id, row);
  }
  const scored = (entries) =>
    entries
      .map((entry, i) => ({ entry, i, strength: discoveryStrength(entry.name) }))
      .filter((x) => x.strength > 0)
      .sort((a, b) => b.strength - a.strength || a.i - b.i);
  const tier = (entries) => interleaveByFandom(scored(entries), (x) => discoveryFandom(x.entry.name)).map((x) => x.entry);
  const inMonth = calendar.filter((e) => e.shipping?.day && e.shipping.day >= monthStart);
  const byDay = (dir) => (a, b) => dir * a.shipping.day.localeCompare(b.shipping.day);
  const tier1 = tier(tiles.filter((t) => ["pre-order", "limited"].includes(t.kind)));
  const tier2 = tier(inMonth.filter((e) => e.shipping.day >= day).sort(byDay(1)));
  const tier3 = tier(inMonth.filter((e) => e.shipping.day < day).sort(byDay(-1)));

  const chosen = new Map();
  const lines = new Map();
  const take = (list, limit) => {
    for (const entry of list) {
      if (chosen.size >= GSC_MAX_PRODUCTS || limit <= 0) return;
      if (chosen.has(entry.id)) continue;
      const line = productLine(entry.name);
      if ((lines.get(line) ?? 0) >= GSC_MAX_PER_LINE) continue;
      lines.set(line, (lines.get(line) ?? 0) + 1);
      const row = rows.get(entry.id);
      chosen.set(entry.id, {
        id: entry.id,
        url: entry.url,
        name: entry.name,
        maker: entry.maker ?? "",
        jans: row?.jans ?? (entry.jan ? [entry.jan] : []),
        notes: row?.notes ?? (entry.note ? [entry.note] : []),
        shipping: row?.shipping ?? entry.shipping ?? null,
      });
      limit--;
    }
  };
  take(tier1, GSC_PREORDER_SHARE);
  take(tier2, GSC_MAX_PRODUCTS);
  take(tier3, GSC_MAX_PRODUCTS);
  take(tier1, GSC_MAX_PRODUCTS);
  return [...chosen.values()];
}

function gscDiscovery(http) {
  if (!gscDiscoveries.has(http)) {
    gscDiscoveries.set(
      http,
      (async () => {
        const home = await http.text(GSC_HOME_URL, { types: ["text/html"], maxBytes: PAGE_BYTES });
        if (!home.text.includes("c-top-product-list__item")) throw new FeedError("unexpected_source_format", 503);
        const calendarPage = await http.text(GSC_CALENDAR_URL, { types: ["text/html"], maxBytes: PAGE_BYTES });
        const calendar = parseGscCalendar(calendarPage.text);
        if (!calendar.length) throw new FeedError("unexpected_source_format", 503);
        return { tiles: parseGscHome(home.text), calendar };
      })(),
    );
  }
  return gscDiscoveries.get(http);
}

function gscHeader(html) {
  const text = String(html);
  const start = text.indexOf('<div class="b-product-info__header">');
  const end = text.indexOf("</h1>", start);
  const header = start >= 0 && end > start ? text.slice(start, end + 5) : "";
  const series = [...header.matchAll(/<div class="c-button c-button--hashtag">\s*<a[^>]*>([^<]*)<\/a>/g)].map((m) =>
    decodeEntities(m[1]).trim(),
  );
  const h1 = stripHtml(header.match(/<h1 id="product-name"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const labels = [...text.slice(start, text.indexOf("</ul>", start) + 5).matchAll(/<li class="c-label[^"]*">([^<]*)<\/li>/g)]
    .map((m) => stripHtml(m[1]))
    .filter((l) => l && !/^\d+$/.test(l));
  const status = stripHtml(text.match(/<div id="status-text-block"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
  const priceText = stripHtml(text.match(/<span class="c-price__main">([^<]*)<\/span>/)?.[1] ?? "");
  return { series, h1, labels: start >= 0 ? labels : [], status, priceText };
}

const SCHEMA_AVAILABILITY = {
  preorder: /^(?:PreOrder|PreSale|BackOrder)$/i,
  in_stock: /^(?:InStock|LimitedAvailability|OnlineOnly|InStoreOnly)$/i,
  sold_out: /^(?:OutOfStock|SoldOut|Discontinued)$/i,
};

/** Normalizes one GSC product page; null when the page's series/title is not one of her fandoms. */
export function gscItem(candidate, html, { fetchedAt, rates, day, nowMs }) {
  const nodes = jsonLd(html).filter((n) => asArray(n["@type"]).includes("Product"));
  if (!nodes.length) throw new FeedError("unexpected_source_format", 503);
  const header = gscHeader(html);
  const confirm = [...header.series, header.h1, candidate.name].join(" | ");
  const match = matchMerchFandoms(confirm);
  if (!match.fandoms.length || SUGGESTIVE.test(`${confirm} ${nodes[0].name ?? ""}`)) return null;
  const jans = cleanList([...candidate.jans, ...nodes.map((n) => normalizeGtin(n.gtin13 ?? n.gtin ?? n.gtin14))].filter(Boolean), 8);
  const primary = nodes.find((n) => normalizeGtin(n.gtin13 ?? n.gtin ?? n.gtin14) === candidate.jans[0]) ?? nodes[0];
  const gtin = normalizeGtin(primary.gtin13 ?? primary.gtin ?? primary.gtin14) ?? jans[0] ?? null;
  const offer = asArray(primary.offers)[0] ?? {};
  const rawName = decodeEntities(String(primary.name ?? ""));
  const rerelease = /^[^[]*\bRerelease\b[^[]*\[/i.test(rawName) || candidate.notes.some((n) => /rerelease/i.test(n));
  let title = header.h1 || rawName.replace(/^[^[]*\[(.+)\]$/, "$1") || candidate.name;
  if (rerelease && !/re-?release/i.test(title)) title = `${title} (Rerelease)`;
  title = clip(title, 200);
  const amount = Number(String(offer.price ?? "").replace(/[,\s]/g, ""));
  const currency = String(offer.priceCurrency ?? "").toUpperCase();
  const priced = Number.isFinite(amount) && amount > 0 && ["JPY", "USD", "SGD"].includes(currency);
  const shipping = parseShippingMonth(header.status);
  const schema = String(offer.availability ?? "").replace(/^https?:\/\/schema\.org\//i, "");
  let availability = Object.keys(SCHEMA_AVAILABILITY).find((k) => SCHEMA_AVAILABILITY[k].test(schema)) ?? null;
  if (!availability) {
    if (/preorders open now/i.test(header.status)) availability = "preorder";
    else if (/sold out/i.test(header.status)) availability = "sold_out";
    else if (candidate.shipping?.day) availability = candidate.shipping.day <= day ? "released" : "announced";
    else if (shipping) availability = shipping.endsAt <= nowMs ? "released" : "announced";
    else availability = "unknown";
  }
  const preorderUntil = preorderDeadline(offer.availabilityEnds);
  const starts = String(offer.availabilityStarts ?? "").trim();
  const period = header.status.match(/Preorder Period:\s*\d{4}\/\d{2}\/\d{2}\s*[〜~～-]\s*\d{4}\/\d{2}\/\d{2}\s*\(JST\)/)?.[0];
  const conversion = priced ? toSgd(amount, currency, rates) : null;
  const url = gscShortUrl(candidate.id);
  const brand = clip(decodeEntities(typeof primary.brand === "string" ? primary.brand : (primary.brand?.name ?? "")) || candidate.maker, 100);
  const og = metaContent(html, "og:image");
  const fallbackImage = primary.image ? new URL(String(asArray(primary.image)[0]), `https://${GSC_HOST}`).href : null;
  const image = stillImage(og, GSC_HOST, GSC_MEDIA_PREFIX, title) ?? stillImage(fallbackImage, GSC_HOST, GSC_MEDIA_PREFIX, title);
  const ttl = Date.parse(fetchedAt) + PRICE_TTL_MS;
  const deadlineMs = preorderUntil ? Date.parse(preorderUntil) : NaN;
  const expiresMs = availability === "preorder" && deadlineMs > Date.parse(fetchedAt) ? Math.min(ttl, deadlineMs) : ttl;
  return {
    source: "gsc-merch",
    nativeId: String(candidate.id),
    sections: merchSections(match.fandoms),
    kind: "merch",
    title,
    url,
    media: image ? [image] : [],
    credit: { name: brand || "Good Smile Company", platform: "Good Smile Company Online Store" },
    tags: {
      characters: match.characters,
      fandoms: match.fandoms,
      voicebanks: match.voicebanks,
      producers: [],
      units: [],
      formats: [],
      topics: [merchType({ title, category: String(primary.category ?? "") })],
    },
    facts: {
      excerpts: primary.description ? [clip(stripHtml(decodeEntities(primary.description)), 600)].filter(Boolean) : [],
      names: cleanList([brand, ...jans.map((j) => `JAN ${j}`)]),
      dates: cleanList([period, shipping?.text, candidate.shipping?.text].filter(Boolean)),
      prices: cleanList([header.priceText || (priced ? `${currency} ${amount}` : "")].filter(Boolean)),
      releaseAt: shipping?.releaseAt ?? null,
      releasePrecision: shipping?.releasePrecision ?? null,
      preorderUntil,
      priceOriginal: priced ? { amount, currency, asOf: fetchedAt } : null,
      fx: conversion?.fx ?? null,
      sgd: conversion?.sgd ?? null,
      availability,
      availabilityCheckedAt: fetchedAt,
      links: [
        { kind: "official", label: "Good Smile Company Online Store (ships to SG)", url },
        ...sgSearchLinks(title),
        taobaoSearchLink(title),
      ].filter(Boolean),
    },
    safety: { rating: "unknown", sourceTags: cleanList([primary.category, ...header.labels, ...header.series].filter(Boolean)) },
    // Preorder opening, else the shipping-calendar day that put this release on the shelf.
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(starts)
      ? new Date(`${starts}T00:00:00+09:00`).toISOString()
      : candidate.shipping?.day
        ? new Date(`${candidate.shipping.day}T00:00:00+09:00`).toISOString()
        : null,
    expiresAt: new Date(expiresMs).toISOString(),
    ...(gtin ? { mediaIdentity: `gtin:${gtin}` } : {}),
  };
}

async function fetchGsc(ctx, now) {
  const discovery = await gscDiscovery(ctx.http);
  const candidates = gscCandidates({ ...discovery, day: ctx.day });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ids = decodeIds(ctx.cursor, /^\d{1,10}$/) ?? candidates.map((c) => c.id);
  let rates;
  return productPages(ctx, ids.slice(0, GSC_MAX_PRODUCTS), async (id) => {
    const candidate = byId.get(id);
    if (!candidate) return null; // left the homepage/calendar since the cursor was written
    let page;
    try {
      page = await ctx.http.text(candidate.url, { types: ["text/html"], maxBytes: PAGE_BYTES });
    } catch (error) {
      if (error?.code === "not_found") return null;
      throw error;
    }
    const fetchedAt = new Date(now()).toISOString();
    rates ??= await sgdRates(ctx.http);
    return gscItem(candidate, page.text, { fetchedAt, rates, day: ctx.day, nowMs: now() });
  });
}

export function makeGscMerch({ now = Date.now } = {}) {
  return {
    id: "gsc-merch",
    stage: "fetch-a",
    status: "enabled",
    enabled: true,
    sections: ["merch", "maomao", "music", "dressup"],
    kind: "merch",
    hosts: [GSC_HOST, FX_HOST],
    mediaHosts: [GSC_HOST],
    linkHosts: [GSC_HOST, ...SG_LINK_HOSTS, TAOBAO_HOST],
    requiredCredentials: [],
    // 2 discovery pages + ≤10 product pages (calendar links add one same-origin 302 each) + 1 FX.
    maxRequests: 24,
    maxBytes: PAGE_BYTES,
    paceMs: 1500,
    timeoutMs: 15000,
    cacheSeconds: 86400,
    mediaPolicy: "still_only",
    copyPolicy: "link_only",
    deletionPolicy: "none",
    attributionRequired: true,
    termsUrl: "https://www.goodsmile.com/en/terms-of-use",
    docsUrl: "https://www.goodsmile.com/en/releaseinfo",
    notes:
      "Checked 2026-09-15 from a home WSL machine (US exit), not Vercel. robots.txt disallows only /*/search (never requested; series hashtag links are not followed). " +
      "Terms of Use Art. 13(11) prohibits improperly accessing the server and pages send x-ratelimit-limit: 20000, so at most 24 paced requests per invocation. " +
      "Discovery: /en homepage 'Preorders Open Now' and 'Exclusives' tiles plus /en/releaseinfo shipping calendar (JAN codes; current month only). Product pages (≤10 per build) only for fandom matches confirmed by the page series label. " +
      "JSON-LD: JPY price (asOf = read time), PreOrder availability, availabilityEnds (a JST date, stored as 23:59:59 JST) → preorderUntil only when present, gtin → mediaIdentity. " +
      "Shipping month from the status text ('Shipping 01/2027' or 'Shipping 2026/09') → releasePrecision 'month'. Image from og:image on www.goodsmile.com. " +
      "Ships to SG: /en/news/5786 rate table 'South East Asia $8.00' per preorder item type; partner list names ToyCoin, TOG, Otaku House, Candytoyo, Kinokuniya Singapore. Link-only; expiresAt ≤ 48 h. " +
      "Probe 2026-09-15T19:11Z: 8 items, 13 requests, 20.1 s.",
    fetch: (ctx) => fetchGsc(ctx, now),
  };
}
export const gscMerch = makeGscMerch();
