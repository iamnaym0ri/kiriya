// Verified event source descriptors and deterministic page readers for the weekly events stage.
// Research leads are not facts: every descriptor below was checked live on 2026-09-15 (home WSL
// machine, not Vercel). Readers never guess a year or a date. Structured candidates come only from
// schema.org Event JSON-LD; everything else is returned as bounded, verbatim text excerpts for the
// orchestrator's grounded extraction, whose dates must then pass `verbatimDateEvidence`.
import { createHash } from "node:crypto";
import { FeedError } from "../config.js";

const HTML_TYPES = ["text/html", "application/xhtml+xml"];
const JSON_TYPES = ["application/json"];

// ---------------------------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------------------------

/**
 * One descriptor per event family. `pages` are the only URLs the weekly reader fetches (exact hosts
 * in `hosts`). `verified` records what was confirmed at `checkedAt`, with verbatim evidence; it is a
 * seed for review, not a substitute for the weekly verbatim check. Restricted sources (terms that
 * forbid automated access) have no hosts and no pages, which also keeps the weekly scout off them.
 */
export const EVENT_SOURCES = [
  {
    id: "afa-singapore",
    name: "AFA Singapore",
    keywords: ["AFA Singapore", "Anime Festival Asia", "AFA"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: true,
    confidence: "official",
    tags: ["anime", "cosplay", "music"],
    hosts: ["animefestival.asia"],
    pages: [
      {
        // WordPress `modified_gmt` gates the heavier homepage read, where the dates are published.
        url: "https://animefestival.asia/wp-json/wp/v2/pages/2729?_fields=id,modified_gmt,link",
        kind: "wp-json",
        types: JSON_TYPES,
        htmlUrl: "https://animefestival.asia/",
      },
    ],
    edition: {
      pattern: "afasg{YY}",
      current: 26,
      probeUrl: "https://animefestival.asia/afasg{YY}/wp-json/wp/v2/pages?per_page=1&_fields=id,link",
      probeKind: "wp-json",
      pageUrl: "https://animefestival.asia/afasg{YY}/",
    },
    officialUrl: "https://animefestival.asia/afasg26/",
    verified: {
      startsOn: "2026-11-27",
      endsOn: "2026-11-29",
      datePrecision: "day",
      venue: "Suntec Singapore Convention & Exhibition Centre",
      confidence: "official",
      evidence: {
        text: "AFA Singapore 2026 Celebrate 60 years of Singapore-Japan Diplomatic Relations in 2026 atone of the most established ACG events in the region! 27-29 November 2026 Suntec Singapore Convention & Exhibition Centre",
        sourceUrl: "https://animefestival.asia/",
        method: "html",
      },
      checkedAt: "2026-09-15T14:35:00Z",
    },
    notes:
      "Official organiser site (SOZO). Dates are only in the homepage HTML; the afasg26 subsite lists the Cosplay Singles Competition and hub applications and mentions SJ60 Musubi Festival (28 & 29 November 2026), which must not be read as AFA's dates. No ETag/Last-Modified; wp-json modified_gmt plus pageHash gate re-reads. robots.txt allows all.",
  },
  {
    id: "singapore-comic-con",
    name: "Singapore Comic Con",
    keywords: ["Singapore Comic Con", "SGCC", "Comic Con"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: true,
    confidence: "official",
    tags: ["comics", "cosplay", "pop culture"],
    hosts: ["www.singaporecomiccon.com"],
    pages: [{ url: "https://www.singaporecomiccon.com/", kind: "html", types: HTML_TYPES }],
    edition: null,
    officialUrl: "https://www.singaporecomiccon.com/",
    verified: {
      startsOn: "2026-12-04",
      endsOn: "2026-12-06",
      datePrecision: "day",
      venue: "Marina Bay Sands Expo & Convention Centre",
      confidence: "official",
      evidence: {
        text: "Event Details Dates - 4 December 2026: Ultimate Preview Night 5pm - 9pm 5 - 6 December 2026 Venue: Marina Bay Sands Expo & Convention Centre",
        sourceUrl: "https://www.singaporecomiccon.com/",
        method: "html",
      },
      checkedAt: "2026-09-15T14:36:00Z",
    },
    notes:
      "Official Wix site. 4 Dec is the ticketed Ultimate Preview Night (5pm - 9pm); public days are 5 - 6 December 2026 at Sands Expo & Convention Centre, Level 1 & Basement 2. The dated 'Event Details' block sits in the page footer, so readers use the whole body. Weak ETag; conditional GET returned 304. No bot clause found in the FAQ/policy page.",
  },
  {
    id: "apothecary-diaries-exhibition-sg",
    name: "The Apothecary Diaries Exhibition",
    keywords: ["Apothecary Diaries Exhibition", "Apothecary Diaries"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: true,
    confidence: "official",
    status: "restricted",
    tags: ["the apothecary diaries", "exhibition"],
    hosts: [],
    linkHosts: ["feverup.com"],
    pages: [],
    edition: null,
    officialUrl: "https://feverup.com/m/700676",
    termsUrl: "https://feverup.com/legal/terms_en.html",
    verified: {
      startsOn: "2026-09-30",
      endsOn: "2026-11-01",
      datePrecision: "day",
      venue: "Fever Exhibition Hall, 25 Scotts Road, Singapore 228220",
      confidence: "official",
      evidence: {
        text: "📅 Dates: September 30 – November 1, 2026 🕒 Times: 10:00 AM – 8:00 PM daily (Last entry at 7:00 PM)",
        sourceUrl: "https://feverup.com/m/700676",
        method: "manual-html",
      },
      checkedAt: "2026-09-15T14:38:00Z",
    },
    notes:
      "Fever's Terms of Use forbid 'accessing, monitoring or copying any content from the Website using any “robot,” “spider,” “scraper” or other automated means' without written permission, so this source has no hosts and no pages (the weekly reader and scout never touch it). Verified once by hand on 2026-09-15: page text 'Only from 30 September to 1 November 2026!' and Event JSON-LD startDate 2026-09-30T10:00:00+08:00 / endDate 2026-11-01T19:00:00+08:00; address 'Fever Exhibition Hall 25 Scotts Road, Singapore, 228220 Singapore'. Re-check by hand or ask Fever. The anime's official site is behind a Cloudflare challenge (research).",
  },
  {
    id: "anime-earth",
    name: "Anime Earth",
    keywords: ["Anime Earth", "Singapore Cosplay Club"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "official",
    tags: ["anime", "cosplay", "marketplace"],
    hosts: [],
    linkHosts: ["www.citysquaremall.com.sg"],
    pages: [],
    edition: null,
    officialUrl: "https://www.citysquaremall.com.sg/events-promotions/enter-the-playverse-shop-play-discover/",
    verified: {
      startsOn: "2026-09-28",
      endsOn: "2026-10-04",
      datePrecision: "day",
      venue: "L1 Atrium, City Square Mall",
      confidence: "official",
      evidence: {
        text: "Anime Earth by Singapore Cosplay Club (SCC) Date: 28 September – 4 October 2026 Venue: L1 Atrium",
        sourceUrl:
          "https://www.citysquaremall.com.sg/wp-content/uploads/2026/09/Press-Release-Enter-the-PlayVerse_-City-Square-Mall-Celebrates-Japanese-Pop-Culture-Festive-Delights-and-Wellness-Website.pdf",
        method: "manual-pdf-text",
      },
      checkedAt: "2026-09-15T14:44:00Z",
    },
    notes:
      "Dates are only in City Square Mall's press release PDF dated 1 September 2026 (text extracted locally; whitespace collapsed). The event HTML page has no dates and PDFs are outside the reader's text types, so there are no weekly pages. City Square Mall's wp-json search is blocked by a Cloudflare rule (403); not bypassed. Free drawing workshops on 3 and 4 October per the same release.",
  },
  {
    id: "sj60-musubi-festival",
    name: "SJ60 Musubi Festival",
    keywords: ["SJ60", "Musubi"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "official",
    tags: ["japan culture", "anime", "music"],
    hosts: ["sj60.sg"],
    pages: [{ url: "https://sj60.sg/", kind: "html", types: HTML_TYPES }],
    edition: null,
    officialUrl: "https://sj60.sg/",
    verified: {
      startsOn: "2026-11-28",
      endsOn: "2026-11-29",
      datePrecision: "day",
      venue: "Marina Bay Sands, Hall D&E",
      confidence: "official",
      evidence: {
        text: "Event Date & Details Date 28, 29 November 2026 (Sat & Sun) Venue Marina Bay Sands, Hall D&E",
        sourceUrl: "https://sj60.sg/",
        method: "html",
      },
      checkedAt: "2026-09-15T14:40:00Z",
    },
    notes:
      "Official page of the executive committee for the 60th anniversary of Japan-Singapore diplomatic relations (JTB PTE LTD). Same weekend as AFA Singapore. ETag + Last-Modified; conditional GET returned 304. robots.txt is absent (404).",
  },
  {
    id: "doujin-market",
    name: "Doujin Market / Doumini",
    keywords: ["Doujin Market", "Doujima", "Doumini", "Doujin Market Mini"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "official",
    tags: ["doujin", "artist alley", "comics"],
    hosts: ["neotokyoproject.com"],
    crawlDelaySeconds: 30,
    pages: [
      {
        // One request a week (robots.txt Crawl-delay: 30). Content is included, so no second request.
        url: "https://neotokyoproject.com/doujima/wp-json/wp/v2/pages?per_page=5&orderby=modified&order=desc&_fields=id,modified_gmt,link,title,content",
        kind: "wp-json",
        types: JSON_TYPES,
      },
    ],
    edition: null,
    officialUrl: "https://neotokyoproject.com/doujima/",
    verified: {
      startsOn: "2026-12-12",
      endsOn: "2026-12-13",
      datePrecision: "day",
      venue: "Hall 405, Suntec Singapore Convention & Exhibition Centre",
      confidence: "listing",
      evidence: {
        text: "Event: 2026 Doumini Date: 12 (Sat) – 13 (Sun) December 2026 Time: 12pm – 8pm | Sat & 11am – 7pm | Sun Venue: Hall 405, Suntec Singapore Convention & Exhibition Centre",
        sourceUrl: "https://xtemujin.wordpress.com/2025/12/12/2026-anime-cosplay-games-and-fashion-events-singapore/",
        method: "manual-html",
      },
      checkedAt: "2026-09-15T14:48:00Z",
    },
    notes:
      "Listing only (hand-maintained xtemujin list, updated 6 Jun 2026). The official Neo Tokyo Project site shows Doujin Market 2026 was held '9-10 May (Sat & Sun) 2026' (past), a 'Shortlisted Artists for Doujima 2027' page without dates, and no Doumini 2026 announcement. Treat Doumini as TBC until the official site states it.",
  },
  {
    id: "cosset",
    name: "COSSET cosplay flea market",
    keywords: ["COSSET"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "unconfirmed",
    status: "social_only",
    tags: ["cosplay", "flea market"],
    hosts: [],
    pages: [],
    edition: null,
    officialUrl: null,
    verified: null,
    notes:
      "No official website found. The research lead (COSSET 03, The Cathay, 7-8 Nov 2026) came from acgevents.sg, which is not used (its terms ban bots and the owner chose not to ask), and from Instagram, which is not scraped. Unconfirmed; show as TBC only if the owner adds it.",
  },
  {
    id: "eoy-festival",
    name: "EOY Music, Comics & Arts Festival",
    keywords: ["EOY", "EOY Music, Comics"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "official",
    tags: ["comics", "music", "artist alley"],
    hosts: ["www.theeoy.com"],
    pages: [
      {
        url: "https://www.theeoy.com/eoy/wp-json/wp/v2/pages/5134?_fields=id,modified_gmt,link",
        kind: "wp-json",
        types: JSON_TYPES,
        htmlUrl: "https://www.theeoy.com/eoy/eoy-booth-2026/",
      },
    ],
    edition: {
      pattern: "eoy-booth-{YYYY}",
      current: 2026,
      probeUrl: "https://www.theeoy.com/eoy/eoy-booth-{YYYY}/",
      probeKind: "html",
      pageUrl: "https://www.theeoy.com/eoy/eoy-booth-{YYYY}/",
    },
    officialUrl: "https://www.theeoy.com/eoy/eoy-booth-2026/",
    verified: {
      startsOn: "2026-12-25",
      endsOn: "2026-12-26",
      datePrecision: "day",
      venue: "Suntec City Convention Centre, Hall 405",
      confidence: "official",
      evidence: {
        text: "Event Information Dates: December 25 & 26, 2026 Time: TBC (Typically 12.30pm – 8pm both days) Venue: Suntec City Convention Centre, Hall 405",
        sourceUrl: "https://www.theeoy.com/eoy/eoy-booth-2026/",
        method: "html",
      },
      checkedAt: "2026-09-15T14:52:00Z",
    },
    notes:
      "Organiser's booth-registration page (wp-json page 5134, modified 2026-04-10). Hours and admission price TBC on the page. robots.txt is absent (404).",
  },
  {
    id: "anime-garden",
    name: "Anime Garden",
    keywords: ["Anime Garden"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "unconfirmed",
    status: "recurring",
    tags: ["anime", "music"],
    hosts: [],
    pages: [],
    edition: null,
    officialUrl: null,
    verified: null,
    notes:
      "Recurring (March). The 2026 edition was 21 (Sat) - 22 (Sun) March 2026 at Supertree Grove, Gardens by the Bay per the xtemujin listing, which links only AFA's Instagram. No official web page found on animefestival.asia (site search) and no 2027 date announced.",
  },
  {
    id: "doki-doki-anime-market",
    name: "DOKI! DOKI! Anime Market",
    keywords: ["DOKI! DOKI!", "Doki Doki Anime Market"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "unconfirmed",
    status: "restricted",
    tags: ["anime", "artist alley"],
    hosts: [],
    linkHosts: ["dokidokianimemarket.com"],
    pages: [],
    edition: null,
    officialUrl: "https://dokidokianimemarket.com/",
    termsUrl: "https://dokidokianimemarket.com/policies/terms-of-service",
    verified: null,
    notes:
      "Recurring (June). 2026 edition 6 (Sat) - 7 (Sun) June 2026 per the xtemujin listing (past). Its Shopify terms forbid use 'to spam, phish, pharm, pretext, spider, crawl, or scrape', so it is link-only. The homepage showed no dates on 2026-09-15.",
  },
  {
    id: "hoyofest-sg",
    name: "HoYoFEST Singapore",
    keywords: ["HoYoFEST", "HoYo FEST"],
    tier: "sg",
    city: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
    hers: false,
    confidence: "unconfirmed",
    status: "recurring",
    tags: ["genshin impact", "honkai: star rail", "games"],
    hosts: [],
    pages: [],
    edition: null,
    officialUrl: null,
    verified: null,
    notes:
      "Recurring (July/August per research). No official HoYoverse page could be located on 2026-09-15 (web search was unavailable in this session); nothing verified. Beware fake HoYoverse store domains (PIPELINE §5.5).",
  },
  {
    id: "comic-fiesta",
    name: "Comic Fiesta",
    keywords: ["Comic Fiesta"],
    tier: "regional",
    city: "Kuala Lumpur",
    country: "Malaysia",
    timezone: "Asia/Kuala_Lumpur",
    hers: false,
    confidence: "official",
    tags: ["anime", "comics", "cosplay"],
    hosts: ["comicfiesta.org"],
    pages: [{ url: "https://comicfiesta.org/cf26", kind: "html", types: HTML_TYPES }],
    edition: {
      pattern: "cf{YY}",
      current: 26,
      probeUrl: "https://comicfiesta.org/cf{YY}",
      probeKind: "html",
      pageUrl: "https://comicfiesta.org/cf{YY}",
    },
    officialUrl: "https://comicfiesta.org/cf26",
    verified: null,
    notes:
      "Official /cf26 page says Comic Fiesta 2026 art/cosplay market applications are open and 'MORE INFO SOON'; its <title> still reads 'Comic Fiesta 2025 ⬢ 20-21 December' (stale, excluded from page text). AnimeCons (listing, JSON-LD) states 'December 19-20, 2026' at Kuala Lumpur Convention Centre; not accepted until the official site says so. ETag; conditional GET returned 304. /cf27 returned 404.",
  },
  {
    id: "comiket",
    name: "Comic Market (Comiket)",
    keywords: ["コミックマーケット", "Comic Market", "Comiket", "C109"],
    tier: "regional",
    city: "Tokyo",
    country: "Japan",
    timezone: "Asia/Tokyo",
    hers: false,
    confidence: "official",
    tags: ["doujin", "cosplay", "comics"],
    hosts: ["www.comiket.co.jp"],
    pages: [{ url: "https://www.comiket.co.jp/info-a/C109/C109Info.html", kind: "html", types: HTML_TYPES }],
    edition: {
      pattern: "C{N}",
      current: 109,
      probeUrl: "https://www.comiket.co.jp/info-a/C{N}/C{N}Info.html",
      probeKind: "html",
      pageUrl: "https://www.comiket.co.jp/info-a/C{N}/C{N}Info.html",
    },
    officialUrl: "https://www.comiket.co.jp/info-a/C109/C109Info.html",
    verified: {
      startsOn: "2026-12-29",
      endsOn: "2026-12-31",
      datePrecision: "day",
      venue: "東京ビッグサイト (Tokyo Big Sight)",
      confidence: "official",
      evidence: {
        text: "開催日 ２０２６年１２月２９日（火）～３１日（木）",
        sourceUrl: "https://www.comiket.co.jp/info-a/C109/C109Info.html",
        method: "html",
      },
      checkedAt: "2026-09-15T14:55:00Z",
    },
    notes:
      "Official page in ISO-2022-JP with full-width digits (decoded by charset). East Halls 4-6 unavailable for C109 (renovation). C110 期日 未定 (undetermined) on the same page; C110Info.html returned 404. ETag; conditional GET returned 304.",
  },
  {
    id: "animejapan",
    name: "AnimeJapan",
    keywords: ["AnimeJapan"],
    tier: "regional",
    city: "Osaka",
    country: "Japan",
    timezone: "Asia/Tokyo",
    hers: false,
    confidence: "official",
    tags: ["anime"],
    hosts: ["anime-japan.jp"],
    pages: [{ url: "https://anime-japan.jp/en/about/", kind: "html", types: HTML_TYPES }],
    edition: null,
    officialUrl: "https://anime-japan.jp/en/about/",
    verified: {
      startsOn: "2027-03-27",
      endsOn: "2027-03-28",
      datePrecision: "day",
      venue: "INTEX Osaka Halls 2–6",
      confidence: "official",
      evidence: {
        text: "Event Name AnimeJapan 2027 Public Day Venue INTEX Osaka Halls 2–6 1-5-102 Nanko-kita, Suminoe-ku, Osaka City, Osaka 559-0034, Japan Dates March 27 [Sat] - March 28 [Sun] 2027",
        sourceUrl: "https://anime-japan.jp/en/about/",
        method: "html",
      },
      checkedAt: "2026-09-15T14:57:00Z",
    },
    notes:
      "Public days only; Business Day is March 26 [Fri] 2027 and March 27 [Sat] 2027 at INTEX Osaka Hall 1 (same page), so extraction must keep the public-day block. robots.txt returns 403 (S3), treated as no rules. Last-Modified; conditional GET returned 304.",
  },
  {
    id: "world-cosplay-summit",
    name: "World Cosplay Summit",
    keywords: ["World Cosplay Summit", "世界コスプレサミット", "WCS"],
    tier: "regional",
    city: "Nagoya",
    country: "Japan",
    timezone: "Asia/Tokyo",
    hers: false,
    confidence: "official",
    tags: ["cosplay"],
    hosts: ["worldcosplaysummit.jp"],
    pages: [{ url: "https://worldcosplaysummit.jp/", kind: "json-ld", types: HTML_TYPES }],
    edition: null,
    officialUrl: "https://worldcosplaysummit.jp/",
    verified: {
      startsOn: "2027-11-12",
      endsOn: "2027-11-14",
      datePrecision: "day",
      venue: "Nagoya",
      confidence: "official",
      evidence: {
        text: "World Cosplay Summit 2027 — November 12 (Fri) · 13 (Sat) · 14 (Sun), 2027 · Nagoya · SAVE THE DATE!",
        sourceUrl: "https://worldcosplaysummit.jp/2026/assets/index-Df6xw7w3-r27.js",
        method: "manual-js-bundle",
      },
      checkedAt: "2026-09-15T15:00:00Z",
    },
    notes:
      "The 2027 dates exist only in the official site's 3.2 MB JavaScript bundle (also '2027年11月12日（金）～14日（日）'), which the text reader cannot fetch. The homepage JSON-LD still describes WCS 2026 (startDate 2026-07-31, endDate 2026-08-02, past), so weekly reads pick up 2027 once the JSON-LD changes. The SPA answers every path with 200, so no edition probe.",
  },
  {
    id: "japan-expo-thailand",
    name: "Japan Expo Thailand",
    keywords: ["JAPAN EXPO THAILAND", "Japan Expo Thailand"],
    tier: "regional",
    city: "Bangkok",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    hers: false,
    confidence: "official",
    tags: ["japan culture", "anime"],
    hosts: ["www.japanexpothailand.com"],
    pages: [
      {
        url: "https://www.japanexpothailand.com/wp-json/wp/v2/pages/820?_fields=id,modified_gmt,link",
        kind: "wp-json",
        types: JSON_TYPES,
        htmlUrl: "https://www.japanexpothailand.com/how-to-exhibit/",
      },
    ],
    edition: null,
    officialUrl: "https://www.japanexpothailand.com/",
    verified: {
      startsOn: "2027-02-26",
      endsOn: "2027-02-28",
      datePrecision: "day",
      venue: "CentralWorld, Bangkok",
      confidence: "official",
      evidence: {
        text: "📍 VENUE: CentralWorld, Bangkok 📅 DATE: 26–28 February 2027",
        sourceUrl: "https://www.japanexpothailand.com/how-to-exhibit/",
        method: "html",
      },
      checkedAt: "2026-09-15T15:02:00Z",
    },
    notes:
      "Organiser G-Yu Creative. The same page also says 'Friday 26 – Sunday 28 February 2027 / 2027年2月26日(金)〜2月28日(日)'. robots.txt (Yoast) allows all.",
  },
  {
    id: "cosplay-mania",
    name: "Cosplay Mania",
    keywords: ["Cosplay Mania"],
    tier: "regional",
    city: "Manila",
    country: "Philippines",
    timezone: "Asia/Manila",
    hers: false,
    confidence: "official",
    tags: ["cosplay", "anime"],
    hosts: ["cosplay.ph"],
    pages: [
      {
        // The HTML article is 2.1 MB (over the reader cap); the post JSON carries the same content.
        url: "https://cosplay.ph/wp-json/wp/v2/posts/35319?_fields=id,modified_gmt,link,title,content",
        kind: "wp-json",
        types: JSON_TYPES,
      },
    ],
    edition: null,
    officialUrl: "https://cosplay.ph/cosplay-mania-2026-exhibit-booth-slots-now-open/",
    verified: {
      startsOn: "2026-10-02",
      endsOn: "2026-10-04",
      datePrecision: "day",
      venue: "SMX Convention Center Manila",
      confidence: "official",
      evidence: {
        text: "🎟️ Join us on 02-04 October 2026 at SMX Convention Center Manila for “Dazzling Diamond”.",
        sourceUrl: "https://cosplay.ph/cosplay-mania-2026-exhibit-booth-slots-now-open/",
        method: "wp-json",
      },
      checkedAt: "2026-09-15T15:05:00Z",
    },
    notes:
      "Organiser's own post ('Our flagship event'). Cloudflare-managed robots.txt allows '*' with Content-Signal search=yes, ai-train=no, use=reference (no ai-input signal). The 2027 edition will be a new post, so there is no predictable probe URL.",
  },
];

/** A `sourceHttp` entry for one descriptor, honouring any robots.txt crawl delay. */
export function eventHttpPolicy(descriptor, overrides = {}) {
  return {
    id: `events-${descriptor.id}`,
    hosts: [...descriptor.hosts],
    mediaHosts: [],
    maxRequests: 6,
    maxBytes: 1024 * 1024,
    paceMs: Math.max(1500, (descriptor.crawlDelaySeconds ?? 0) * 1000),
    timeoutMs: 15000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  zwnj: "", zwj: "", lrm: "", rlm: "", shy: "", ndash: "–", mdash: "—", minus: "−", lsquo: "‘",
  rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", hellip: "…", middot: "·", bull: "•",
  copy: "©", reg: "®", trade: "™", deg: "°", times: "×", divide: "÷", plusmn: "±", laquo: "«",
  raquo: "»", cent: "¢", pound: "£", yen: "¥", euro: "€", sect: "§", para: "¶", frac12: "½",
  frac14: "¼", frac34: "¾", eacute: "é", Eacute: "É", egrave: "è", agrave: "à", uuml: "ü", ouml: "ö",
  auml: "ä", ccedil: "ç", ntilde: "ñ", iexcl: "¡", iquest: "¿", star: "☆", hearts: "♥",
};
const codePoint = (n) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "");
function decodeHtml(value) {
  return String(value ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body) => {
    if (body[0] === "#") return codePoint(body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : Number(body.slice(1)));
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}
const BLOCK_TAGS =
  "address|article|aside|blockquote|br|button|caption|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|label|legend|li|main|nav|ol|option|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul";
const SPACES = new RegExp(`[\\s${String.fromCharCode(0x200b)}]+`, "g"); // \s already covers NBSP, U+2000-200A, U+3000, BOM

/**
 * Visible text from untrusted HTML: block elements separate words, inline elements do not (so
 * "<b>27</b>-29" stays "27-29"). Never used to render HTML.
 */
export function renderText(html) {
  return decodeHtml(
    String(html ?? "")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg|iframe|object|canvas|select|textarea|head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(SPACES, " ")
    .trim();
}

/** Page-builder shortcodes ([et_pb_text …]…[/et_pb_text]) from WordPress `content.rendered`. */
function stripShortcodes(html) {
  const closed = new Set([...String(html).matchAll(/\[\/([a-z][\w-]*)\]/gi)].map((m) => m[1].toLowerCase()));
  return String(html).replace(/\[\/?([a-z][\w-]*)(?:\s[^\]]*)?\/?\]/gi, (m, name) =>
    closed.has(name.toLowerCase()) || name.includes("_") ? " " : m,
  );
}

/**
 * The cleaned main text used for hashing and excerpts: the <article> when it carries real content,
 * otherwise the whole <body> without navigation. Footers stay: some sites publish dates there.
 */
export function mainText(html) {
  const source = String(html ?? "");
  const body = source.match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i)?.[1] ?? source;
  const start = body.search(/<article\b/i);
  let end = -1;
  for (const m of body.matchAll(/<\/article\s*>/gi)) end = m.index;
  if (start >= 0 && end > start) {
    const article = renderText(body.slice(start, end));
    if (article.length >= 200) return article;
  }
  return renderText(body.replace(/<nav\b[^>]*>[\s\S]*?<\/nav\s*>/gi, " "));
}

export const pageHashOf = (text) => createHash("sha256").update(String(text ?? "")).digest("hex");

// ---------------------------------------------------------------------------------------------
// Date expressions
// ---------------------------------------------------------------------------------------------

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};

// Full-width ASCII forms (U+FF01-FF5E), the ideographic space, the wave dash and hyphen/dash variants.
const FOLD_RE = new RegExp(
  `[${String.fromCharCode(0xff01)}-${String.fromCharCode(0xff5e)}${String.fromCharCode(0x3000, 0x301c)}${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}${String.fromCharCode(0x2212)}]`,
  "g",
);
/** Length-preserving width fold: full-width ASCII forms and ideographic spaces become ASCII. */
function foldWidth(text) {
  return String(text ?? "").replace(FOLD_RE, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x3000) return " ";
    if (code === 0x301c) return "~";
    if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0);
    return "-";
  });
}

const TOKEN_RE = new RegExp(
  [
    String.raw`(?<iso>(?<!\d)(?:19|20)\d{2}([-/.])(?:1[0-2]|0?[1-9])\2(?:3[01]|[12]\d|0?[1-9])(?!\d))`,
    String.raw`(?<yja>(?<!\d)(?:19|20)\d{2}\s*年)`,
    String.raw`(?<mja>(?<!\d)(?:1[0-2]|0?[1-9])\s*月)`,
    String.raw`(?<dja>(?<!\d)(?:3[01]|[12]\d|0?[1-9])\s*日)`,
    String.raw`(?<year>(?<!\d)(?<!\d[.:/])(?:19|20)\d{2}(?!\d)(?![-/.:]\d))`,
    String.raw`(?<day>(?<!\d)(?<!\d[.:/])(?:3[01]|[12]\d|0?[1-9])(?:st|nd|rd|th)?(?![a-z\d])(?![.:]\d)(?!\s?[ap]\.?m\.?(?![a-z]))(?!\s*%))`,
    String.raw`(?<mon>(?<![a-z])(?:january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?(?![a-z]))`,
    String.raw`(?<wd>(?<![a-z])(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|weds|thurs|thur|sun|mon|tue|wed|thu|fri|sat)\.?(?![a-z]))`,
    String.raw`(?<wdja>(?<=[(\[]\s*|[・&,]\s*)[日月火水木金土](?:曜日?)?(?=\s*[)\]・&,]))`,
    String.raw`(?<range>\s(?:to|until|till|thru|through)\s|[-–—~])`,
    String.raw`(?<list>,|&|(?<![a-z])and(?![a-z])|・|·|、|\+)`,
  ].join("|"),
  "giu",
);
// Only brackets, dots and whitespace may sit between tokens of one expression.
const GAP_RE = /^[\s()[\].]*$/;

function tokenize(folded) {
  const tokens = [];
  for (const m of folded.matchAll(TOKEN_RE)) {
    const g = m.groups;
    const type = Object.keys(g).find((k) => g[k] !== undefined);
    const raw = m[0];
    const token = { type, index: m.index, end: m.index + raw.length, raw };
    if (type === "iso") {
      const [y, mo, d] = raw.split(/[-/.]/).map(Number);
      Object.assign(token, { y, m: mo, d });
    } else if (type === "yja" || type === "year") token.y = Number(raw.match(/\d{4}/)[0]);
    else if (type === "mja") token.m = Number(raw.match(/\d+/)[0]);
    else if (type === "dja" || type === "day") token.d = Number(raw.match(/\d+/)[0]);
    else if (type === "mon") token.m = MONTHS[raw.toLowerCase().replace(".", "")];
    else if (type === "wd") token.w = WEEKDAYS[raw.toLowerCase().replace(".", "")];
    else if (type === "wdja") token.w = WEEKDAYS[raw[0]];
    tokens.push(token);
  }
  return tokens;
}

function groupTokens(folded, tokens) {
  const groups = [];
  let current = [];
  for (const token of tokens) {
    const previous = current.at(-1);
    if (previous && !GAP_RE.test(folded.slice(previous.end, token.index))) {
      groups.push(current);
      current = [];
    }
    current.push(token);
  }
  if (current.length) groups.push(current);
  return groups;
}

const pad = (n) => String(n).padStart(2, "0");
const isoOf = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
function validDay({ y, m, d }) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const year = y ?? 2024; // leap year while unresolved; rechecked after resolution
  return new Date(Date.UTC(year, m - 1, d)).getUTCDate() === d;
}
const weekdayOf = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** Items (day/month/year parts) and separators from one token group. */
function parseGroup(group) {
  const items = [];
  const seps = [];
  let pendingMonth = null, pendingYear = null, pendingWeekday = null, sep = null, last = null;
  const push = (item) => {
    if (items.length) seps.push(sep ?? "list");
    sep = null;
    items.push(item);
  };
  const assignWeekdays = (weekdays, directlyAfterDay) => {
    if (directlyAfterDay && weekdays.length === 1 && items.length && items.at(-1).w === undefined) {
      items.at(-1).w = weekdays[0];
      return;
    }
    const open = items.filter((item) => item.w === undefined);
    weekdays.forEach((w, i) => open[i] && (open[i].w = w));
  };
  for (let i = 0; i < group.length; i++) {
    const t = group[i];
    if (t.type === "wd" || t.type === "wdja") {
      const weekdays = [t.w];
      while (group[i + 1]?.type === "list" && ["wd", "wdja"].includes(group[i + 2]?.type)) {
        weekdays.push(group[i + 2].w);
        i += 2;
      }
      const next = group[i + 1];
      if (weekdays.length === 1 && t.type === "wd" && (last === null || last === "sep") && ["day", "list"].includes(next?.type)) {
        pendingWeekday = weekdays[0];
        if (next?.type === "list") i++;
      } else assignWeekdays(weekdays, last === "day");
      last = last === "day" ? "day" : "weekday";
      continue;
    }
    switch (t.type) {
      case "iso":
        push({ y: t.y, m: t.m, d: t.d, yLead: true, mLead: true, start: t.index });
        last = "day";
        break;
      case "yja":
        pendingYear = t.y;
        last = "year";
        break;
      case "mja":
        pendingMonth = t.m;
        last = "month";
        break;
      case "dja":
      case "day":
        push({
          d: t.d,
          ...(pendingMonth !== null ? { m: pendingMonth, mLead: true } : {}),
          ...(pendingYear !== null ? { y: pendingYear, yLead: true } : {}),
          ...(pendingWeekday !== null ? { w: pendingWeekday } : {}),
          start: t.index,
        });
        pendingMonth = pendingYear = pendingWeekday = null;
        last = "day";
        break;
      case "mon": {
        const trailing = [];
        for (let k = items.length - 1; k >= 0 && items[k].m === undefined; k--) trailing.push(items[k]);
        if (trailing.length && (last === "day" || last === "weekday")) trailing.forEach((item) => (item.m = t.m));
        else pendingMonth = t.m;
        last = "month";
        break;
      }
      case "year":
        // A trailing year ("November 27-29, 2026") applies to every earlier day still without one.
        if (items.length) items.forEach((item) => item.y === undefined && (item.y = t.y));
        else pendingYear = t.y;
        last = "year";
        break;
      case "range":
        sep = "range";
        last = "sep";
        break;
      case "list":
        if (sep !== "range") sep = "list";
        last = "sep";
        break;
    }
  }
  // Month-first lists ("November 12 · 13 · 14") and ISO/Japanese leading dates carry month and year
  // forward; trailing years were already applied backwards.
  for (let k = 1; k < items.length; k++) {
    const item = items[k], prev = items[k - 1];
    if (item.m === undefined && prev.m !== undefined && prev.mLead) Object.assign(item, { m: prev.m, mLead: true });
    if (item.y === undefined && prev.y !== undefined && prev.yLead) Object.assign(item, { y: prev.y, yLead: true, yInherited: true });
  }
  return { items, seps };
}

function segmentsOf(items, seps) {
  const segments = [];
  for (let k = 0; k < items.length; k++) {
    const start = items[k];
    if (seps[k] === "range" && items[k + 1]) {
      const end = items[k + 1];
      k++;
      if (start.m === undefined || end.m === undefined) continue;
      const s = { ...start }, e = { ...end };
      if (s.y !== undefined && e.y !== undefined && s.y === e.y && s.m > e.m) {
        if (e.yInherited) e.y = s.y + 1; // 2026年12月30日～1月2日
        else if (!s.yLead) s.y = e.y - 1; // 30 December – 2 January 2027
      }
      segments.push({ start: s, end: e });
    } else if (start.m !== undefined) segments.push({ start: { ...start }, end: { ...start } });
  }
  return segments.filter((seg) => validDay(seg.start) && validDay(seg.end));
}

// A year-less date borrows the nearest year only when it is this close (characters) in the same text.
const YEAR_REACH = 200;

/**
 * All date expressions in `text`: `{index, end, text, startsOn, endsOn, explicitYear}` (or
 * `{monthOnly, years}` for "November 2026"). Year-less expressions take the nearest year within
 * YEAR_REACH characters; ambiguous year-less December/January ranges and weekday mismatches are dropped.
 */
export function findDateExpressions(text) {
  const folded = foldWidth(text);
  const tokens = tokenize(folded);
  const years = tokens.filter((t) => t.y !== undefined).map((t) => ({ y: t.y, index: t.index, end: t.end }));
  const out = [];
  for (const raw of groupTokens(folded, tokens)) {
    let a = 0, b = raw.length - 1;
    while (a <= b && ["range", "list"].includes(raw[a].type)) a++;
    while (b >= a && ["range", "list"].includes(raw[b].type)) b--;
    if (a > b) continue;
    const group = raw.slice(a, b + 1);
    const hasDay = group.some((t) => ["day", "dja", "iso"].includes(t.type));
    const hasMonth = group.some((t) => ["mon", "mja", "iso"].includes(t.type));
    const closing = /^\s*[)\]]/.exec(folded.slice(group.at(-1).end));
    const span = { index: group[0].index, end: group.at(-1).end + (closing ? closing[0].length : 0) };
    if (!hasDay || !hasMonth) {
      const monthYear = group.some((t) => ["mon", "mja"].includes(t.type)) && group.some((t) => t.y !== undefined);
      if (monthYear) out.push({ ...span, text: String(text).slice(span.index, span.end), monthOnly: true, years: group.filter((t) => t.y).map((t) => t.y) });
      continue;
    }
    const { items, seps } = parseGroup(group);
    for (const seg of segmentsOf(items, seps)) {
      const explicitYear = seg.start.y !== undefined && seg.end.y !== undefined;
      if (!explicitYear) {
        if (seg.start.y !== undefined || seg.end.y !== undefined) continue;
        let best = null;
        for (const y of years) {
          const distance = y.end <= span.index ? span.index - y.end : y.index >= span.end ? y.index - span.end : 0;
          if (best === null || distance < best.distance) best = { y: y.y, distance };
        }
        if (!best || best.distance > YEAR_REACH || seg.start.m > seg.end.m) continue;
        seg.start.y = seg.end.y = best.y;
      }
      if (!validDay(seg.start) || !validDay(seg.end)) continue;
      if (isoOf(seg.end) < isoOf(seg.start)) continue;
      if ([seg.start, seg.end].some((part) => part.w !== undefined && weekdayOf(part) !== part.w)) continue;
      out.push({
        ...span,
        text: String(text).slice(span.index, span.end),
        startsOn: isoOf(seg.start),
        endsOn: isoOf(seg.end),
        explicitYear,
      });
    }
  }
  return out;
}

const DAY_MS = 86400000;
const dayNumber = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS;
const validIsoDay = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && validDay({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)), d: Number(value.slice(8, 10)) });

/**
 * True only when the evidence text itself renders the claimed dates: one expression for the whole
 * range, contiguous expressions covering every day ("4 December 2026 … 5 - 6 December 2026"), or a
 * JSON-LD startDate/endDate pair. A year-less rendering ("Dec 29–31") counts only when the nearest
 * year in the same text (within YEAR_REACH characters) is the claimed year. Single-day claims need a
 * single-day rendering.
 */
export function verbatimDateEvidence(text, { startsOn, endsOn } = {}) {
  if (typeof text !== "string" || !text.trim() || !validIsoDay(startsOn)) return false;
  const end = endsOn === undefined || endsOn === null || endsOn === "" ? startsOn : endsOn;
  if (!validIsoDay(end) || end < startsOn || dayNumber(end) - dayNumber(startsOn) > 400) return false;
  const expressions = findDateExpressions(text).filter((e) => !e.monthOnly);
  // Structured evidence: "startDate": "2026-09-30T10:00:00+08:00" / "endDate": "2026-11-01…".
  const member = (name) => [...text.matchAll(new RegExp(`"${name}"\\s*:\\s*"(\\d{4}-\\d{2}-\\d{2})(?:[T ][^"]*)?"`, "g"))].map((m) => m[1]);
  const starts = member("startDate"), ends = member("endDate");
  if (starts.includes(startsOn) && (end === startsOn ? ends.length === 0 || ends.includes(end) : ends.includes(end))) return true;
  if (expressions.some((e) => e.startsOn === startsOn && e.endsOn === end)) return true;
  if (end === startsOn) return false;
  const first = dayNumber(startsOn), last = dayNumber(end);
  const inside = expressions
    .filter((e) => e.startsOn >= startsOn && e.endsOn <= end)
    .map((e) => [dayNumber(e.startsOn), dayNumber(e.endsOn)])
    .sort((a, b) => a[0] - b[0]);
  let covered = first - 1;
  for (const [s, e] of inside) {
    if (s > covered + 1) return false;
    covered = Math.max(covered, e);
  }
  return covered >= last && inside.length > 0 && inside[0][0] === first;
}

// ---------------------------------------------------------------------------------------------
// Excerpts
// ---------------------------------------------------------------------------------------------

const MAX_EXCERPTS = 6;
const MAX_EXCERPT = 600;
const isHigh = (code) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code) => code >= 0xdc00 && code <= 0xdfff;

function windowAround(text, index, end, size = MAX_EXCERPT) {
  const length = end - index;
  if (length >= size) return [index, Math.min(text.length, index + size)];
  let from = Math.max(0, index - Math.floor((size - length) / 2));
  let to = Math.min(text.length, from + size);
  from = Math.max(0, to - size);
  // Prefer word boundaries for spaced scripts; never split a surrogate pair.
  if (from > 0 && /\S/.test(text[from - 1]) && /[a-z0-9]/i.test(text[from])) {
    const next = text.indexOf(" ", from);
    if (next !== -1 && next < index) from = next + 1;
  }
  if (to < text.length && /[a-z0-9]/i.test(text[to - 1]) && /\S/.test(text[to])) {
    const prev = text.lastIndexOf(" ", to);
    if (prev > end) to = prev;
  }
  if (from > 0 && isLow(text.charCodeAt(from))) from++;
  if (to < text.length && isHigh(text.charCodeAt(to - 1))) to--;
  return [from, to];
}

/**
 * Up to six verbatim windows (≤600 chars) around date expressions, preferring dates with an explicit
 * current-or-future year, then year-less dates near such a year, then month-year mentions; windows
 * naming the event rank higher. Past-only windows are dropped.
 */
export function dateExcerpts(text, { sourceUrl, now = new Date(), timezone = "Asia/Singapore", keywords = [] } = {}) {
  const source = String(text ?? "");
  const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric" }).format(now));
  const lowered = source.toLowerCase();
  const words = keywords.map((k) => String(k).toLowerCase()).filter((k) => k.length >= 3);
  const candidates = [];
  for (const expr of findDateExpressions(source)) {
    let score;
    if (expr.monthOnly) score = expr.years.some((y) => y >= currentYear) ? 1 : 0;
    else if (expr.explicitYear) score = Number(expr.endsOn.slice(0, 4)) >= currentYear ? 3 : 0;
    else score = Number(expr.endsOn.slice(0, 4)) >= currentYear ? 2 : 0;
    if (!score) continue;
    const [from, to] = windowAround(source, expr.index, expr.end);
    if (words.some((w) => lowered.slice(from, to).includes(w))) score += 0.5;
    candidates.push({ from, to, score, index: expr.index });
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.length >= MAX_EXCERPTS) break;
    if (chosen.some((w) => c.index >= w.from && c.index < w.to)) continue; // already quoted
    const overlap = chosen.find((w) => c.from < w.to && c.to > w.from);
    if (overlap && Math.max(overlap.to, c.to) - Math.min(overlap.from, c.from) <= MAX_EXCERPT) {
      overlap.from = Math.min(overlap.from, c.from);
      overlap.to = Math.max(overlap.to, c.to);
      continue;
    }
    chosen.push({ ...c });
  }
  return chosen
    .sort((a, b) => a.from - b.from)
    .map((w) => ({ text: source.slice(w.from, w.to).trim(), sourceUrl }))
    .filter((e) => e.text);
}

// ---------------------------------------------------------------------------------------------
// Structured data (schema.org Event JSON-LD)
// ---------------------------------------------------------------------------------------------

const EVENT_TYPES = new Set([
  "Event", "BusinessEvent", "ChildrensEvent", "ComedyEvent", "CourseInstance", "DanceEvent", "DeliveryEvent",
  "EducationEvent", "EventSeries", "ExhibitionEvent", "Festival", "FoodEvent", "Hackathon", "LiteraryEvent",
  "MusicEvent", "PublicationEvent", "SaleEvent", "ScreeningEvent", "SocialEvent", "SportsEvent", "TheaterEvent",
  "VisualArtsEvent",
]);
const isEvent = (type) => [type].flat().some((t) => EVENT_TYPES.has(String(t).replace(/^https?:\/\/schema\.org\//, "")));

function* ldNodes(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) yield* ldNodes(v, depth + 1);
    return;
  }
  yield value;
  for (const key of ["@graph", "itemListElement", "item", "subEvent", "event", "mainEntity"])
    if (value[key]) yield* ldNodes(value[key], depth + 1);
}

const localDayFormatter = (timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** A schema.org date value as a local calendar day, never guessing missing parts. */
export function localDateOf(value, timezone) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?\s*$/i.exec(String(value ?? ""));
  if (!m) return { date: null, precision: /^\s*\d{4}-\d{2}\s*$/.test(String(value)) ? "month" : null };
  const literal = `${m[1]}-${m[2]}-${m[3]}`;
  if (!validIsoDay(literal)) return { date: null, precision: null };
  if (m[4] === undefined) return { date: literal, precision: "day" };
  if (!m[7]) return { date: literal, precision: "datetime", dateTime: null };
  const instant = new Date(`${literal}T${m[4]}:${m[5]}:${m[6] ?? "00"}${m[7].length === 5 ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : m[7]}`);
  if (!Number.isFinite(instant.getTime())) return { date: null, precision: null };
  return { date: localDayFormatter(timezone).format(instant), precision: "datetime", dateTime: instant.toISOString() };
}

const clean = (value, max) => {
  const text = renderText(typeof value === "string" ? value : "").slice(0, max).trim();
  return text || null;
};

/** Event candidates from JSON-LD blocks, with the exact date members as evidence. */
export function jsonLdEvents(html, { sourceUrl, timezone = "Asia/Singapore", city = null } = {}) {
  const out = [];
  for (const block of String(html ?? "").matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const raw = block[1];
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      continue; // malformed blocks are untrusted source data
    }
    const members = (name) =>
      [...raw.matchAll(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g"))].map((m) => {
        let value = null;
        try {
          value = JSON.parse(`"${m[1]}"`);
        } catch {
          // keep null: an undecodable member is not evidence
        }
        return { text: m[0], value };
      });
    for (const node of ldNodes(parsed)) {
      if (!isEvent(node["@type"]) || typeof node.startDate !== "string" || out.length >= 10) continue;
      const startMember = members("startDate").find((m) => m.value === node.startDate);
      if (!startMember) continue; // never reconstruct evidence
      const endMember = typeof node.endDate === "string" ? members("endDate").find((m) => m.value === node.endDate) : null;
      const start = localDateOf(node.startDate, timezone);
      const endValue = endMember ? localDateOf(node.endDate, timezone) : { date: null };
      const location = [node.location].flat()[0];
      const place = typeof location === "string" ? location : location?.name;
      out.push({
        name: clean(node.name, 160) ?? clean(node.alternateName, 160),
        startsOn: start.date,
        endsOn: endValue.date && start.date && endValue.date >= start.date ? endValue.date : null,
        ...(start.dateTime ? { startDateTime: start.dateTime } : {}),
        ...(endValue.dateTime ? { endDateTime: endValue.dateTime } : {}),
        datePrecision: start.precision,
        venue: clean(place, 200),
        city: clean(location?.address?.addressLocality, 100) ?? city,
        eventStatus: typeof node.eventStatus === "string" ? node.eventStatus.replace(/^https?:\/\/schema\.org\//, "") : null,
        evidence: {
          text: [startMember.text, endMember?.text].filter(Boolean).join("\n"),
          sourceUrl,
          method: "json-ld",
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Page reader
// ---------------------------------------------------------------------------------------------

function decodeBody(buffer, contentType) {
  let charset = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType ?? "")?.[1];
  if (!charset) {
    const head = buffer.subarray(0, 4096).toString("latin1");
    charset = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder((charset ?? "utf-8").toLowerCase()).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

const header = (headers, name) => {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : (value ?? null);
};

function conditionalHeaders(previous = {}) {
  const headers = {};
  if (previous.etag) headers["if-none-match"] = previous.etag;
  if (previous.lastModified) headers["if-modified-since"] = previous.lastModified;
  return headers;
}

function assertPage(descriptor, page) {
  if (!page || typeof page.url !== "string") throw new FeedError("invalid_event_page");
  let host;
  try {
    host = new URL(page.url).hostname.toLowerCase();
  } catch {
    throw new FeedError("invalid_source_url");
  }
  if (!descriptor.hosts.includes(host)) throw new FeedError("source_host_denied");
  if (!["wp-json", "json-ld", "html"].includes(page.kind)) throw new FeedError("unsupported_page_kind");
}

/** Link from an API response, kept only when it is HTTPS on the descriptor's hosts. */
function sameHostLink(descriptor, value, fallback) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && descriptor.hosts.includes(u.hostname.toLowerCase()) ? u.href : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Visible text of an allowlisted page, charset-decoded (ISO-2022-JP, Shift_JIS…), for re-checking
 * scout evidence: `{text, mainText, url}`. `text` covers the whole document body.
 */
export async function fetchPageText(http, url, { types = HTML_TYPES } = {}) {
  const response = await http.request(url, { as: "text", types });
  const html = decodeBody(response.buffer, header(response.headers, "content-type"));
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i)?.[1] ?? html;
  return { text: renderText(body), mainText: mainText(html), url: response.url ?? url };
}

const unchanged = (previous, extra) => ({
  status: "not_modified",
  pageHash: previous.pageHash ?? null,
  etag: previous.etag ?? null,
  lastModified: previous.lastModified ?? null,
  modified: previous.modified ?? null,
  structured: [],
  textExcerpts: [],
  ...extra,
});

async function readHtml(descriptor, url, http, previous, { types, now, conditional }) {
  const response = await http.request(url, {
    as: "text",
    types: types ?? HTML_TYPES,
    headers: conditional ? conditionalHeaders(previous) : {},
    allowNotModified: Boolean(conditional && (previous.etag || previous.lastModified)),
  });
  const etag = header(response.headers, "etag") ?? previous.etag ?? null;
  const lastModified = header(response.headers, "last-modified") ?? previous.lastModified ?? null;
  if (response.notModified) return { notModified: true, etag, lastModified };
  const html = decodeBody(response.buffer, header(response.headers, "content-type"));
  const finalUrl = sameHostLink(descriptor, response.url ?? url, url);
  const text = mainText(html);
  return {
    etag,
    lastModified,
    text,
    pageHash: pageHashOf(text),
    structured: jsonLdEvents(html, { sourceUrl: finalUrl, timezone: descriptor.timezone, city: descriptor.city }),
    textExcerpts: dateExcerpts(text, { sourceUrl: finalUrl, now, timezone: descriptor.timezone, keywords: descriptor.keywords ?? [descriptor.name] }),
  };
}

/**
 * Reads one descriptor page. `previous` is the stored `{etag, lastModified, pageHash, modified}`.
 * Returns `not_modified` on 304, on an unchanged WordPress `modified_gmt`, or when the cleaned main
 * text hashes the same; otherwise `ok` with JSON-LD candidates and verbatim date excerpts.
 */
export async function readEventPage(descriptor, page, http, previous = {}, { now = new Date() } = {}) {
  assertPage(descriptor, page);
  previous = previous ?? {};
  if (page.kind === "wp-json") {
    const response = await http.request(page.url, {
      as: "text",
      types: JSON_TYPES,
      headers: conditionalHeaders(previous),
      allowNotModified: Boolean(previous.etag || previous.lastModified),
    });
    const etag = header(response.headers, "etag") ?? previous.etag ?? null;
    const lastModified = header(response.headers, "last-modified") ?? previous.lastModified ?? null;
    if (response.notModified) return unchanged(previous, { etag, lastModified });
    let json;
    try {
      json = JSON.parse(decodeBody(response.buffer, header(response.headers, "content-type")));
    } catch {
      throw new FeedError("invalid_source_json");
    }
    const entries = [json].flat().filter((e) => e && typeof e === "object");
    const stamps = entries
      .map((e) => (typeof e.modified_gmt === "string" ? `${e.modified_gmt.replace(/Z$/, "")}Z` : typeof e.modified === "string" ? e.modified : null))
      .filter((s) => s && Number.isFinite(Date.parse(s)))
      .sort();
    const modified = stamps.at(-1) ?? null;
    if (modified && previous.modified === modified) return unchanged(previous, { etag, lastModified, modified });
    if (page.htmlUrl) {
      const read = await readHtml(descriptor, page.htmlUrl, http, previous, { types: HTML_TYPES, now, conditional: false });
      if (previous.pageHash && previous.pageHash === read.pageHash)
        return unchanged(previous, { etag, lastModified, modified, pageHash: read.pageHash });
      return { status: "ok", etag, lastModified, modified, pageHash: read.pageHash, structured: read.structured, textExcerpts: read.textExcerpts };
    }
    const keywords = descriptor.keywords ?? [descriptor.name];
    const parts = entries
      .map((e) => ({
        sourceUrl: sameHostLink(descriptor, e.link, page.url),
        text: renderText(stripShortcodes(`${e.title?.rendered ? `<h1>${e.title.rendered}</h1>` : ""}${e.content?.rendered ?? ""}`)),
      }))
      .filter((p) => p.text);
    const pageHash = pageHashOf(parts.map((p) => p.text).join("\n"));
    if (previous.pageHash && previous.pageHash === pageHash) return unchanged(previous, { etag, lastModified, modified, pageHash });
    const textExcerpts = parts
      .flatMap((p) => dateExcerpts(p.text, { sourceUrl: p.sourceUrl, now, timezone: descriptor.timezone, keywords }))
      .slice(0, MAX_EXCERPTS);
    return { status: "ok", etag, lastModified, modified, pageHash, structured: [], textExcerpts };
  }
  const read = await readHtml(descriptor, page.url, http, previous, { types: page.types, now, conditional: true });
  if (read.notModified) return unchanged(previous, { etag: read.etag, lastModified: read.lastModified });
  if (previous.pageHash && previous.pageHash === read.pageHash)
    return unchanged(previous, { etag: read.etag, lastModified: read.lastModified, pageHash: read.pageHash });
  return {
    status: "ok",
    etag: read.etag,
    lastModified: read.lastModified,
    modified: previous.modified ?? null,
    pageHash: read.pageHash,
    structured: read.structured,
    textExcerpts: read.textExcerpts,
  };
}

// ---------------------------------------------------------------------------------------------
// Next-edition probes
// ---------------------------------------------------------------------------------------------

function editionValue(pattern, current) {
  const placeholder = String(pattern).match(/\{(N|YY|YYYY)\}/)?.[1];
  if (!placeholder || !Number.isInteger(current)) return null;
  const next = current + 1;
  if (placeholder === "YY") return { placeholder, next, label: pad(next % 100) };
  return { placeholder, next, label: String(next) };
}

/** URL of the next edition from a predictable pattern (`C{N}`, `afasg{YY}`, `eoy-booth-{YYYY}`). */
export function nextEditionUrl(descriptor) {
  const edition = descriptor?.edition;
  if (!edition?.pattern || !edition.probeUrl) return null;
  const value = editionValue(edition.pattern, edition.current);
  if (!value) return null;
  const fill = (template) => template.replaceAll(`{${value.placeholder}}`, value.label);
  return { url: fill(edition.probeUrl), pageUrl: edition.pageUrl ? fill(edition.pageUrl) : null, edition: fill(edition.pattern) };
}

/**
 * One GET for the next edition's predictable URL. `exists` is true on a 200 (for WordPress probes, a
 * non-empty JSON array), false on 404/410. Blocked or failed requests throw for the caller to retry.
 */
export async function probeNextEdition(descriptor, http) {
  const next = nextEditionUrl(descriptor);
  if (!next) throw new FeedError("no_edition_pattern");
  const host = new URL(next.url).hostname.toLowerCase();
  if (!descriptor.hosts.includes(host)) throw new FeedError("source_host_denied");
  try {
    const response = await http.request(next.url, {
      as: "text",
      types: descriptor.edition.probeKind === "wp-json" ? JSON_TYPES : [...HTML_TYPES, "text/plain"],
    });
    let exists = true;
    if (descriptor.edition.probeKind === "wp-json") {
      try {
        const parsed = JSON.parse(response.buffer.toString("utf8"));
        exists = Array.isArray(parsed) && parsed.length > 0;
      } catch {
        exists = false;
      }
    }
    return { url: next.url, exists, edition: next.edition, pageUrl: next.pageUrl };
  } catch (error) {
    if (error?.code === "not_found") return { url: next.url, exists: false, edition: next.edition, pageUrl: next.pageUrl };
    throw error;
  }
}
