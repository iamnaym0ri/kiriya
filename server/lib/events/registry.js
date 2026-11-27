// The source registry: everything the worker checks for change, cheapest method first, from
// docs/refactor/SG-EVENT-SOURCES.md (checked 2026-11-24) plus the Singapore descriptors of the old
// weekly events stage (server/feeds/events/sources.js). Singapore only.
//
// method (cheapest first, as PLAN.md §6 orders them):
//   rss        RSS/Atom, conditional GET; new item ids are signals
//   wp-json    WordPress REST list with modified_gmt; new or re-modified ids are signals
//   sitemap    <lastmod> per URL, filtered by slug words
//   page       conditional GET (ETag/Last-Modified) → normalised main-text hash
//   listing    the set of item ids/links on a listing page
//   json-ld    schema.org Event JSON-LD on the page
//   redirect   where the page redirects to (a café's current collab; an annual page coming back)
// every: minutes between checks. filter: "keywords" sends only items passing the fandom/event
// prefilter to triage (editorial feeds); "none" sends everything (organisers and event pages).
// terms: what we know of the site's terms ("ok" read and fine, "not_checked", "link_only": we may
// read it to learn about events but only ever link to it).

export const BLOCKED_HOSTS = [
  // Terms forbid automated access (PLAN.md: never fetched directly; use Instagram, newsletters,
  // written permission and web search instead).
  { host: "suntecsingapore.com", reason: "Suntec Singapore's terms §2 forbid automated queries without written permission (asked: docs/refactor/events-permission-emails.md)" },
  { host: "sunteccity.com.sg", reason: "Suntec group; treated like Suntec Singapore until permission" },
  { host: "singaporeexpo.com.sg", reason: "Constellar's terms §4.8(d) ban robots, spiders and scrapers (asked: docs/refactor/events-permission-emails.md)" },
  { host: "acgevents.sg", reason: "terms ban bots; the owner chose not to ask" },
  { host: "anihk.com", reason: "robots.txt disallows ClaudeBot / anthropic-ai" },
  { host: "feverup.com", reason: "terms ban robots" },
  { host: "dokidokianimemarket.com", reason: "Shopify terms ban crawling" },
  { host: "kinokuniya.com.sg", reason: "terms forbid crawling" },
  { host: "fareastmalls.com.sg", reason: "robots.txt disallows ClaudeBot" },
  { host: "gametrader.sg", reason: "robots.txt disallows ClaudeBot; ai-train=no" },
  // Bot walls: not bypassed.
  { host: "capitaland.com", reason: "Imperva bot wall (CapitaLand malls)" },
  { host: "marinabaysands.com", reason: "bot wall (HTTP/2 resets non-browsers)" },
  { host: "sportshub.com.sg", reason: "Cloudflare challenge" },
  { host: "timeout.com", reason: "Cloudflare challenge" },
  { host: "alvinology.com", reason: "Cloudflare challenge" },
  { host: "klook.com", reason: "Cloudflare challenge" },
  { host: "animecons.com", reason: "Cloudflare challenge" },
  { host: "fancons.com", reason: "Cloudflare challenge" },
  { host: "bandainamcoent.asia", reason: "Vercel security checkpoint" },
  { host: "sg.emb-japan.go.jp", reason: "WAF (access denied)" },
  // Social networks: no legitimate free automated access. Instagram comes in through Apify only
  // (trigger-only, the owner's choice); posts are never fetched by the crawler.
  { host: "instagram.com", reason: "Meta: through the Apify trigger only" },
  { host: "cdninstagram.com", reason: "Meta: images are copied once by the Apify step" },
  { host: "facebook.com", reason: "Meta: robots.txt disallows all" },
  { host: "x.com", reason: "paid API only" },
  { host: "twitter.com", reason: "paid API only" },
  { host: "reddit.com", reason: "robots.txt disallows all" },
  { host: "tiktok.com", reason: "no access" },
];

const hostOf = (url) => new URL(url).hostname.toLowerCase().replace(/\.$/, "");

/** The block entry for a URL's host (or any parent domain), or null. */
export function blockedHost(url) {
  let host;
  try {
    host = hostOf(url);
  } catch {
    return { host: String(url), reason: "not a URL" };
  }
  return BLOCKED_HOSTS.find((b) => host === b.host || host.endsWith(`.${b.host}`)) ?? null;
}

const H = 60;
const D = 24 * H;
const src = (s) => ({ filter: "none", terms: "not_checked", enabled: true, every: D, ...s, hosts: [hostOf(s.url)] });

// Slug words for sitemaps of general venues.
const VENUE_WORDS = "anime|manga|cosplay|pokemon|sanrio|hello-kitty|miku|vocaloid|sekai|gundam|ghibli|jujutsu|demon-slayer|one-piece|final-fantasy|square-enix|zelda|kirby|game-music|anisong|j-pop|jpop|japan|otaku|hololive|genshin|hoyo|frieren|apothecary";

export const SOURCES = [
  // --- Organisers and conventions ------------------------------------------------------------
  src({ id: "afa-singapore", name: "AFA Singapore", signal: "H", category: "organiser", method: "wp-json", every: 6 * H, terms: "ok",
    url: "https://animefestival.asia/wp-json/wp/v2/pages?orderby=modified&order=desc&per_page=10&_fields=id,modified_gmt,link,title",
    descriptor: "afa-singapore", notes: "WP REST pages; /feed/ is empty. Dates sit in the homepage HTML." }),
  src({ id: "afa-next-edition", name: "AFA Singapore next edition", signal: "H", category: "organiser", method: "redirect", every: 7 * D, terms: "ok",
    url: "https://animefestival.asia/afasg27/", descriptor: "afa-singapore", notes: "Probe: 200 here means AFA 2027 has a site." }),
  src({ id: "sgcc-blog", name: "Singapore Comic Con blog", signal: "H", category: "organiser", method: "rss", every: 3 * H, terms: "ok",
    url: "https://www.singaporecomiccon.com/blog-feed.xml", descriptor: "singapore-comic-con", notes: "Wix blog feed; cheaper and earlier than the homepage." }),
  src({ id: "sgcc-home", name: "Singapore Comic Con", signal: "H", category: "organiser", method: "page", every: D, terms: "ok",
    url: "https://www.singaporecomiccon.com/", descriptor: "singapore-comic-con" }),
  src({ id: "sj60", name: "SJ60", signal: "M", category: "organiser", method: "page", every: D, url: "https://sj60.sg/", descriptor: "sj60-musubi-festival" }),
  src({ id: "doujin-market", name: "Doujin Market / Doumini", signal: "H", category: "organiser", method: "wp-json", every: D,
    url: "https://neotokyoproject.com/doujima/wp-json/wp/v2/pages?per_page=5&orderby=modified&order=desc&_fields=id,modified_gmt,link,title",
    crawlDelaySeconds: 30, descriptor: "doujin-market", notes: "robots.txt Crawl-delay: 30." }),
  src({ id: "eoy-festival", name: "EOY festival", signal: "M", category: "organiser", method: "wp-json", every: D,
    url: "https://www.theeoy.com/eoy/wp-json/wp/v2/pages?per_page=5&orderby=modified&order=desc&_fields=id,modified_gmt,link,title", descriptor: "eoy-festival" }),
  src({ id: "game-on-dreamers", name: "Game On, Dreamers!", signal: "M", category: "organiser", method: "json-ld", every: D, url: "https://www.gameondreamers.com/" }),
  src({ id: "scape-events", name: "*SCAPE events", signal: "H", category: "venue", method: "wp-json", every: 6 * H, terms: "link_only",
    url: "https://www.scape.sg/wp-json/wp/v2/events?orderby=modified&order=desc&_fields=id,modified_gmt,link,title",
    notes: "Konbini (J-fashion), Doki Doki, Randamu Creator Fiesta. Terms: no automation clause, no reproduction → link-only." }),
  src({ id: "bushiroad", name: "Bushiroad news", signal: "L", category: "organiser", method: "rss", every: 12 * H, filter: "keywords", url: "https://en.bushiroad.com/feed/" }),
  src({ id: "ntuc-club-media", name: "NTUC Club media releases (Cosfest)", signal: "M", category: "organiser", method: "page", every: D, url: "https://www.ntucclub.com/news/media-releases" }),
  src({ id: "gbtb-anime-garden", name: "Gardens by the Bay: Anime Garden", signal: "M", category: "venue", method: "redirect", every: 7 * D, terms: "ok",
    url: "https://www.gardensbythebay.com.sg/en/things-to-do/calendar-of-events/anime-garden.html", descriptor: "anime-garden",
    notes: "302s to the calendar between editions; a 200 means a new Anime Garden is announced." }),
  src({ id: "gbtb-calendar", name: "Gardens by the Bay calendar", signal: "M", category: "venue", method: "page", every: D, terms: "ok", filter: "keywords",
    url: "https://www.gardensbythebay.com.sg/en/things-to-do/calendar-of-events.html" }),

  // --- Listings ------------------------------------------------------------------------------
  src({ id: "xtemujin-feed", name: "xtemujin 360° (new yearly lists)", signal: "H", category: "listing", method: "rss", every: 12 * H, url: "https://xtemujin.wordpress.com/feed/" }),
  src({ id: "xtemujin-2026", name: "xtemujin: 2026 SG anime, cosplay, games & fashion events", signal: "H", category: "listing", method: "page", every: 12 * H,
    url: "https://xtemujin.wordpress.com/2025/12/12/2026-anime-cosplay-games-and-fashion-events-singapore/",
    notes: "Hand-maintained list, edited in place; no ETag, so the text hash decides. (The WordPress.com REST API's robots.txt disallows all, so it isn't used.)" }),
  src({ id: "visit-singapore", name: "Visit Singapore happenings", signal: "L", category: "listing", method: "page", every: D, filter: "keywords", url: "https://www.visitsingapore.com/whats-happening/all-happenings/" }),
  src({ id: "allevents-sg-anime", name: "allevents.in Singapore anime", signal: "L", category: "listing", method: "listing", every: D, enabled: false,
    url: "https://allevents.in/singapore/anime", listing: { pattern: "https://allevents\\.in/singapore/[a-z0-9-]+/(\\d{6,})", link: "https://allevents.in/singapore/e/{id}" },
    notes: "Off: terms not checked yet (robots allows ClaudeBot with Crawl-delay 10)." }),

  // --- Venues --------------------------------------------------------------------------------
  src({ id: "esplanade", name: "Esplanade", signal: "M", category: "venue", method: "sitemap", every: D, url: "https://www.esplanade.com/sitemap.xml", sitemapFilter: VENUE_WORDS,
    notes: "robots.txt explicitly allows ClaudeBot. Anime concerts (Jujutsu Kaisen in Concert, Pokémon brass)." }),
  src({ id: "the-star", name: "The Star Theatre", signal: "M", category: "venue", method: "page", every: D, filter: "keywords", url: "https://www.thestar.sg/whats-on" }),
  src({ id: "rws", name: "Resorts World Sentosa", signal: "L", category: "venue", method: "sitemap", every: D, url: "https://www.rwsentosa.com/sitemap.xml", sitemapFilter: VENUE_WORDS }),
  src({ id: "filmhouse-jff", name: "Japanese Film Festival", signal: "M", category: "venue", method: "page", every: D, filter: "keywords", url: "https://filmhouse.sg/seasons-events/jff26/" }),
  src({ id: "downtown-east", name: "Downtown East (Cosfest venue)", signal: "L", category: "venue", method: "page", every: D, filter: "keywords", url: "https://www.downtowneast.com.sg/" }),

  // --- Malls (pop-ups) -----------------------------------------------------------------------
  src({ id: "jewel-telegram", name: "Jewel Changi on Telegram", signal: "M", category: "mall", method: "listing", every: 6 * H, filter: "keywords",
    url: "https://t.me/s/jewelchangiairportofficial", listing: { pattern: "data-post=\"jewelchangiairportofficial/(\\d+)\"", link: "https://t.me/jewelchangiairportofficial/{id}" },
    notes: "Public channel preview; new post ids are signals (Pokémon Center, Gundam Base, Sanrio pop-ups)." }),
  src({ id: "jewel-gundam-base", name: "The Gundam Base Singapore (Jewel)", signal: "M", category: "retail", method: "page", every: D, url: "https://www.jewelchangiairport.com/en/shop/the-gundam-base-singapore.html" }),
  src({ id: "vivocity", name: "VivoCity", signal: "M", category: "mall", method: "rss", every: 6 * H, filter: "keywords", url: "https://www.vivocity.com.sg/feed/" }),
  src({ id: "marina-square", name: "Marina Square events", signal: "M", category: "mall", method: "listing", every: 12 * H, filter: "keywords",
    url: "https://www.marinasquare.com.sg/?categories=Events-Web", listing: { pattern: "href=\"(?:https://www\\.marinasquare\\.com\\.sg)?(/[a-z0-9-]+/[a-z0-9-]+/?)\"" } }),
  src({ id: "cineleisure", name: "Cathay Cineleisure", signal: "M", category: "mall", method: "rss", every: 12 * H, filter: "keywords", url: "https://cineleisure.com.sg/feed/" }),
  src({ id: "city-square-mall", name: "City Square Mall (Anime Earth)", signal: "M", category: "mall", method: "page", every: D, filter: "keywords", url: "https://www.citysquaremall.com.sg/happenings/events-promotions/" }),
  src({ id: "wisma-atria", name: "Wisma Atria campaigns", signal: "L", category: "mall", method: "wp-json", every: 12 * H, filter: "keywords",
    url: "https://www.wismaonline.com/wp-json/wp/v2/campaign?orderby=modified&order=desc&_fields=id,modified_gmt,link,title" }),
  src({ id: "ion-orchard", name: "ION Orchard events", signal: "L", category: "mall", method: "page", every: D, filter: "keywords", url: "https://www.ionorchard.com/en/events.html" }),
  src({ id: "takashimaya", name: "Takashimaya Singapore", signal: "L", category: "mall", method: "page", every: D, filter: "keywords", url: "https://www.takashimaya.com.sg/" }),
  src({ id: "fairprice-xtra-sanrio", name: "FairPrice Xtra × Sanrio", signal: "L", category: "mall", method: "page", every: 3 * D, url: "https://www.fairprice.com.sg/events/xtra/xtra-sanrio/" }),

  // --- Collab cafés and character stores -----------------------------------------------------
  src({ id: "aniplus-cafe", name: "ANIPLUS Café", signal: "H", category: "retail", method: "redirect", every: 12 * H, url: "https://www.anipluscafe.com/",
    notes: "The homepage redirects to the current collab; a new target is a new collab." }),
  src({ id: "pokemon-sg-topics", name: "Pokémon Singapore topics", signal: "M", category: "retail", method: "listing", every: 12 * H,
    url: "https://sg.portal-pokemon.com/topics/", listing: { pattern: "/topics/post-(\\d+)", link: "https://sg.portal-pokemon.com/topics/post-{id}" } }),
  src({ id: "hololive-news", name: "hololive production news", signal: "L", category: "retail", method: "page", every: D, filter: "singapore", url: "https://hololivepro.com/en/news/" }),

  // --- Editorial (link-only; keyword prefilter) ----------------------------------------------
  ...[
    ["geekculture", "Geek Culture", "https://geekculture.co/feed/", "H", 3 * H],
    ["geekculture-anime", "Geek Culture: anime & comics", "https://geekculture.co/anime-comics/feed/", "H", 6 * H],
    ["geekculture-cosplay", "Geek Culture: cosplay", "https://geekculture.co/cosplay/feed/", "H", 12 * H],
    ["geekculture-toys", "Geek Culture: toys", "https://geekculture.co/toys/feed/", "M", 6 * H],
    ["thesmartlocal", "TheSmartLocal", "https://thesmartlocal.com/feed/", "H", 3 * H],
    ["littlebigreddot", "Little Big Red Dot", "https://littlebigreddot.com/feed/", "M", 6 * H],
    ["themagicrain", "The Magic Rain", "https://themagicrain.com/feed/", "M", 6 * H],
    ["mothership", "Mothership", "https://mothership.sg/feed/", "M", 3 * H],
    ["honeycombers", "Honeycombers", "https://thehoneycombers.com/singapore/feed/", "M", 6 * H],
    ["littledayout", "Little Day Out", "https://www.littledayout.com/feed/", "M", 12 * H],
    ["eatbook", "Eatbook (collab cafés)", "https://eatbook.sg/feed/", "M", 6 * H],
    ["everydaypeople", "Everyday People SG", "https://everydaypeople.sg/feed/", "M", 12 * H],
    ["bykido", "BYKidO events", "https://www.bykido.com/blogs/events-and-activities.atom", "M", 12 * H],
    ["reimarufiles", "The Reimaru Files", "https://www.reimarufiles.com/feed/", "M", 12 * H],
    ["hardwarezone-anime", "HardwareZone TV-Mania & AnimeMania", "https://forums.hardwarezone.com.sg/forums/tv-mania-animemania.266/index.rss", "L", 12 * H],
    ["jcci", "JCCI Singapore", "https://www.jcci.org.sg/feed/", "L", D],
  ].map(([id, name, url, signal, every]) => src({ id, name, signal, category: "editorial", method: "rss", every, filter: "keywords", url, terms: "link_only" })),
  src({ id: "sethlui", name: "Seth Lui", signal: "L", category: "editorial", method: "rss", every: D, filter: "keywords", url: "https://sethlui.com/feed/", enabled: false, notes: "Off: robots.txt answered 403 (status unknown)." }),
  src({ id: "fzine", name: "FZINE (J-fashion)", signal: "L", category: "editorial", method: "page", every: D, filter: "keywords", url: "https://www.fzine.com/" }),
  src({ id: "thebeat-asia", name: "The Beat Asia: the list", signal: "L", category: "editorial", method: "page", every: D, filter: "keywords", url: "https://thebeat.asia/singapore/the-list/events" }),

  // --- Japanese cultural institutions --------------------------------------------------------
  src({ id: "japan-foundation-sg", name: "Japan Foundation: Singapore 2026", signal: "L", category: "institution", method: "page", every: 7 * D, url: "https://www.jpf.go.jp/e/about/area/2026/singapore_2026.html" }),
];

export const enabledSources = () => SOURCES.filter((s) => s.enabled);
export const sourceById = (id) => SOURCES.find((s) => s.id === id) ?? null;

/** Registry sanity: unique ids, https, nothing on a blocked host. Used by tests and at worker start. */
export function checkRegistry(sources = SOURCES) {
  const problems = [];
  const ids = new Set();
  for (const s of sources) {
    if (ids.has(s.id)) problems.push(`${s.id}: duplicate id`);
    ids.add(s.id);
    if (!s.url.startsWith("https://")) problems.push(`${s.id}: not https`);
    if (blockedHost(s.url)) problems.push(`${s.id}: blocked host`);
    if (!["rss", "wp-json", "sitemap", "page", "listing", "json-ld", "redirect"].includes(s.method)) problems.push(`${s.id}: unknown method ${s.method}`);
  }
  return problems;
}

// Instagram accounts the Apify trigger watches (PLAN.md: a few major accounts; organisers plus the
// SG con/pop-up trackers that cover Suntec, EXPO and the malls). Edit freely; handles only.
// Josh: confirm or replace these before the first paid run (they're the agents' best guesses).
export const INSTAGRAM_ACCOUNTS = [
  // Chosen by Josh on 2026-11-27 from docs/refactor/events-instagram-shortlist.md (each handle is
  // linked from the organiser's own site or a published article; Instagram itself is never crawled).
  { handle: "animefestivalasia", why: "AFA Singapore (organiser)" },
  { handle: "sgcomiccon", why: "Singapore Comic Con (organiser): guests and exclusives" },
  { handle: "neotokyoproject", why: "Doujin Market / Doumini (organiser)" },
  { handle: "anipluscafe.sg", why: "ANIPLUS Café collab cafés (e.g. Hatsune Miku)" },
  { handle: "cossetevent", why: "COSSET cosplay flea market (Instagram first)" },
  { handle: "dokidokianimemarket", why: "Doki Doki anime markets and merch" },
  { handle: "afashop.co", why: "AFA's merch shop: exclusives and drops" },
]
