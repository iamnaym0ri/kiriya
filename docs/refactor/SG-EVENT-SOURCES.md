# Singapore anime / cosplay / J-fashion event sources: inventory for a change-detecting crawler

Checked 2026-11-24 (SGT early 25 Nov) from the home WSL machine. The exit IP is in the US, so some blocks may be geo-based.

**Legend**
- **VERIFIED**: fetched in this session. The probe recorded status, ETag/Last-Modified, feed/REST/JSON-LD presence and keyword hits, and read robots.txt for `*` and for `ClaudeBot`.
- **INFERRED**: comes from search results or prior knowledge and was not fetched.
- **Robots** is the robots.txt stance for the URL in question.
- **Terms** is recorded only where the terms page was actually read. Otherwise it says "terms not checked", and the pipeline's existing rule applies: check before enabling.
- **Signal** is the value to an anime/cosplay/J-fashion fan in Singapore: H (high), M (medium) or L (low).
- The probe used a desktop browser UA. Eventbrite's robots.txt specifically disallows `Python-urllib`, so the real crawler needs its own honest UA and may see different results.
- Raw probe output was kept in a session scratchpad and is not part of the repo.

**Cheapest change detection, best first:** RSS/Atom or WordPress REST `modified_gmt`, then sitemap `<lastmod>`, then a conditional GET with ETag/Last-Modified, then the set of item IDs/links on a listing page, then a normalised HTML text hash.

---

## 0. Top sources ranked by value (signal × monitorability × legitimacy)

| # | Source | Method | Why |
|---|---|---|---|
| 1 | AFA Singapore (animefestival.asia) | WP REST `pages` modified_gmt → homepage HTML | Flagship; already covered |
| 2 | Singapore Comic Con | Wix `blog-feed.xml` RSS + homepage ETag | Blog feed was live (12 items, newest 2026-11-20); not used yet |
| 3 | xtemujin yearly "Anime, Cosplay, Games and Fashion Events, Singapore" list | RSS + WP.com REST `modified` (2026 post modified 2026-11-14) | Best legitimate hand-maintained SG list, including J-fashion |
| 4 | Geek Culture | RSS + category feeds `/anime-comics/feed/`, `/cosplay/feed/`, `/toys/feed/` | SG geek outlet; covers collab cafés, pop-ups, conventions |
| 5 | *SCAPE | WP REST `events` CPT | Hosts Konbini (J-fashion), Doki Doki, Randamu Creator Fiesta |
| 6 | Eventbrite SG "anime" directory / API by organiser | 20 Event JSON-LD per page; API v3 per organiser | Doki Doki, Asia Comics Expo, Randamu ticketing (terms caveat) |
| 7 | TheSmartLocal | RSS + WP REST `?search=` | Anime-convention roundups, pop-ups |
| 8 | Little Big Red Dot | RSS | Practical guides (Konbini, HoYo FEST, AFA, CSF) |
| 9 | Doujin Market / Doumini | WP REST pages (Crawl-delay 30) | Covered; Doumini 2026 now venue-confirmed |
| 10 | Game On, Dreamers! (G.O.D.) | Event JSON-LD on homepage | **Gap**: 11–13 Dec 2026, MBS, cosplay battles |
| 11 | VivoCity | WP RSS `/feed/` | Mall pop-ups (Sanrio Moonlit Garden, Super Mario) |
| 12 | ANIPLUS Café | Homepage 302 target = current collab | Main anime collab café |
| 13 | Pokémon SG official topics | Diff the set of `/topics/post-N` IDs | Pokémon Center SG events and merch |
| 14 | The Magic Rain | RSS | SG geek news (ANIPLUS collabs, Pokémon) |
| 15 | Mothership | RSS | Mainstream SG news; picks up big cosplay/anime items |
| 16 | Jewel Changi (Telegram channel + shop pages) | `t.me/s/jewelchangiairportofficial` diff; AEM pages with ETag/LM | Pokémon Center, Gundam Base, Sanrio pop-ups |
| 17 | Esplanade | sitemap `<lastmod>` filter (robots explicitly allow ClaudeBot) | Anime concerts (Jujutsu Kaisen in Concert, Pokémon brass, anime-game piano) |
| 18 | Little Day Out / Eatbook | RSS | Collab cafés, character pop-ups |
| 19 | Gardens by the Bay calendar | AEM ETag/LM; probe the Anime Garden URL | Anime Garden (March) is published here |
| 20 | EOY festival | WP REST pages | Covered |
| 21 | Honeycombers | RSS | General listings; pop-ups |
| 22 | Everyday People SG / BYKidO | RSS / Shopify Atom | Randamu World, G.O.D., Gundam Base, Pokémon |
| 23 | Reddit r/singapore | Existing Data API collector: search `anime OR cosplay OR pop-up` | Community chatter; no SG anime/cosplay subreddit found |
| 24 | HardwareZone "TV-Mania & AnimeMania" | XenForo RSS | Low-noise forum signal |
| 25 | Filmhouse (JFF) / The Star / Marina Square / Cineleisure | WP or HTML diff | Anime films, J-pop concerts, mall pop-ups |

---

## 1. Already covered in `server/feeds/events/sources.js` (status today)

| Descriptor | What I saw today | Suggested change | Status |
|---|---|---|---|
| afa-singapore | `/feed/` exists but has **0 items** (lastBuildDate 2026-09-22); `wp-json/wp/v2/pages?orderby=modified` works; `/wp-json/wp/v2/posts` returns `[]`; robots allows all; Cloudflare passes | Keep the WP REST gate; the RSS is useless | VERIFIED |
| singapore-comic-con | Homepage ETag (Wix). **`/blog-feed.xml` RSS works**: 12 items, newest 2026-11-20 | Add the blog feed as a cheap first gate for announcements | VERIFIED |
| doujin-market | WP RSS is stale (newest 2025-05-31). **Suntec venue page** `suntecsingapore.com/visit-events/doujin-market-mini-2026` says "Event Dates: 12 - 13 December 2026 (Saturday – Sunday) Event Timing: 12:00 - 19:00 daily … Level 4, Hall 405" | Upgrade from `listing` to venue-confirmed. Read by hand: Suntec's terms forbid automated queries (§4) | VERIFIED |
| eoy-festival | WP RSS stale (2024-10); WP REST pages work; robots 404 | Keep WP REST | VERIFIED |
| anime-garden | GBTB **has official pages**: `gardensbythebay.com.sg/en/things-to-do/calendar-of-events/anime-garden.html` plus `/cosplayer.html` and `/concert.html` (search results). It now **302s to the calendar** because the event ended | Probe that URL weekly: 200 means a new edition is announced. Fixes the note "No official web page found" | VERIFIED (redirect) |
| hoyofest-sg | Suntec page `/visit-events/hoyo-fest-2026` exists (sitemap lastmod 2026-07-02). Search: 31 Jul–2 Aug 2026, Suntec Hall 403, per a HoYoLAB post | Official announcements are on HoYoLAB and socials; read the Suntec page by hand | VERIFIED (sitemap) / INFERRED (dates) |
| doki-doki-anime-market | Shopify terms restrict; Suntec page `doki-doki-anime-market-singapore-2026` exists; Eventbrite listings exist | Eventbrite API by organiser is the legitimate route | VERIFIED (sitemap) |
| comic-fiesta | robots.txt groups ClaudeBot together with `*` (Squarespace style), so it is **allowed**. `/our-events` lists CF and CFmJ (Comic Fiesta mini Johor) | Add `/our-events` for CFmJ (Johor) | VERIFIED |
| cosset, anime-earth, sj60, apothecary (Fever) | No change: COSSET is IG-only, Anime Earth's dates were in a PDF, SJ60 is static, Fever's terms ban automation | — | — |

---

## 2. Singapore conventions and organisers

| Name | URL | Category | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|---|
| Game On, Dreamers! (G.O.D.) | https://www.gameondreamers.com/ | Gaming/culture playfest | 11–13 Dec 2026, MBS Halls D–F B2; Cosplay Fight Club, Gyeonggi Int'l Cosplay qualifier | **schema.org Event JSON-LD** on homepage (`startDate 2026-12-11T10:00+08:00`, `endDate 2026-12-13T22:00+08:00`, AggregateOffer) | robots allows (8 rules); terms not checked | M–H | VERIFIED |
| Asia Comics Expo (ACE) | Suntec page `/visit-events/asia-comic-expo-005`; Eventbrite organiser | Artist alley/comics/cosplay | "23 - 24 January 2027 … Level 4, Hall 403" | Eventbrite organiser API or the Suntec page (manual) | Suntec terms restrict automation | M–H | VERIFIED (Suntec page) |
| Randamu World / Randamu Creator Fiesta | Suntec `/visit-events/randamu-world-2026`; Eventbrite; Telegram `t.me/s/RandamuAnimeNews` | Free ACG + TCG con (Suntec, Aug); creator fiesta (*SCAPE, Jun) | Dates, artist alley | Eventbrite organiser API; Telegram preview is **stale** (last post 2024-10-03) | — | M | VERIFIED (Telegram, sitemap) / INFERRED (dates) |
| Konbini | https://www.scape.sg/whats-on/konbini/ (+ IG; `konbini.sg` has a TLS mismatch) | J-fashion / alt-fashion / kawaii market | Konbini 5.0: "6 -7 June 2026 11:00 am *SCAPE Ground Theatre, L2"; runway + concert | *SCAPE WP REST `events` CPT; IG for the next edition | *SCAPE robots allows; terms: no automation clause, no reproduction (read) | **H** for J-fashion | VERIFIED |
| AFA Creators Super Fest | animefestival.asia (`/csf2026/` 404s); Suntec `/visit-events/creators-super-fest-singapore-2026` | Creator/cosplay fest (SOZO), July | 11–12 Jul 2026, Suntec 403–405 (Bandwagon) | AFA WP REST probe for a `csf{YYYY}` subsite; Suntec page by hand | AFA robots allows | M–H | VERIFIED (404, sitemap) / INFERRED (dates) |
| Cosfest / Singapore Cosplay Club (SCC Square) | No official site found; NTUC Club media releases https://www.ntucclub.com/news/media-releases ; Downtown East https://www.downtowneast.com.sg/ | Community cosplay con (Downtown East, July) | Cosfest; SCC also runs Anime Earth | NTUC media-release page HTML diff (200, no ETag); otherwise FB/IG | robots allows (0 rules); terms not checked | M | VERIFIED (pages) / INFERRED (Cosfest 2026) |
| COSSET | — | Cosplay flea market | — | IG only | — | M | INFERRED |
| Cos Haven | — | Free cosplay studio shoot (Suntec, Jun 2026 per TSL) | — | IG only | — | L–M | INFERRED |
| Doki Doki Anime Market | https://dokidokianimemarket.com/ | Fan market (June) | — | Restricted (Shopify terms); Eventbrite API by organiser | Shopify terms ban crawling | M | VERIFIED |
| HoYo FEST SG | HoYoLAB article (app) | HoYoverse fan fest (Jul/Aug) | Dates/passes | Socials/HoYoLAB; editorial RSS picks it up (Geek Culture, Magic Rain, LBRD) | — | M | INFERRED |
| Bushiroad (Expo / card fests SG) | https://en.bushiroad.com/feed/ | TCG + BanG Dream etc. | SG card fests, autograph sessions | RSS (10 items, newest 2026-11-20) | robots allows | L–M | VERIFIED |
| hololive OCG exStreamer Cup SG finals | Suntec `/visit-events/hololive-official-card-game-exstreamer-cup-25-26-regional-finals-singapore` | VTuber TCG | Finals | Manual / hololive news | — | M (VTuber fans) | VERIFIED (sitemap) |
| Card Con / Singapore Card Show | Suntec `/visit-events/card-con-2026`; EXPO WP `event` "SINGAPORE CARD SHOW – WORLD EDITION" | TCG | Dates | EXPO WP REST (restricted by terms) | — | L | VERIFIED |
| GameStart Asia | https://gamestart.asia/ | Games + cosplay | — | TLS certificate **expired**; likely defunct | — | L | VERIFIED (cert error) |

## 3. Listings and aggregators

| Name | URL | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|
| acgevents.sg | https://acgevents.sg/ | The most complete SG ACG list (Next.js; JSON API `/api/events`) | **Restricted**: terms ban bots; the owner chose not to ask | robots.txt returns HTML | H | VERIFIED (reachable) |
| ANIHK | https://anihk.com/en/events/region/sg | SG/MY/HK event hub, ItemList JSON-LD | **Restricted for AI use**: robots has `Disallow: /` for ClaudeBot, Claude-Web, anthropic-ai, GPTBot and others; `*` is allowed | — | H | VERIFIED |
| xtemujin 360° Resources | https://xtemujin.wordpress.com/feed/ ; post https://xtemujin.wordpress.com/2025/12/12/2026-anime-cosplay-games-and-fashion-events-singapore/ | Yearly SG anime/cosplay/games/fashion list; updated in place | RSS for new yearly posts. For edits: `public-api.wordpress.com/rest/v1.1/sites/xtemujin.wordpress.com/posts/?fields=ID,modified` (2026 post modified 2026-11-14). The post page has no ETag/LM, so fall back to a text hash | Blog robots allows. `public-api.wordpress.com` robots is `Disallow: /`; it is an API, the same kind of reading as Danbooru/Wikipedia (owner call) | **H** | VERIFIED |
| Eventbrite SG directory | https://www.eventbrite.sg/d/singapore--singapore/anime/ | Ticketed SG anime/manga/doujin/VTuber events | **20 schema.org Event JSON-LD** per directory page. Better: Eventbrite API v3 `GET /v3/organizers/{id}/events/` (free token) for known organisers (Doki Doki, ACE, Randamu); search was removed from the API | robots allows `/d/` for `*` (disallows `Python-urllib` UA); ToS likely bans scrapers (legal page index fetched; the ToS body is behind a redirect) | M–H | VERIFIED (JSON-LD, robots) / INFERRED (ToS) |
| Peatix | https://peatix.com/ | Smaller community events (Cosfest used it) | Follow specific `/group/{id}` pages (robots `Allow: /group/*`, `Allow: /event/*`, Crawl-delay 1); search geo-redirects to `/us/` | Terms page fetched empty | M | VERIFIED (robots, redirect) |
| Luma | https://luma.com/singapore | Mostly tech/startup | 20 Event JSON-LD; per-calendar ICS | robots allows | L | VERIFIED |
| allevents.in | https://allevents.in/singapore/anime | Scraped FB/IG events, including JB | HTML (FAQ JSON-LD only) | robots: `ClaudeBot` Crawl-delay 10, `*` Crawl-delay 30 for some bots; terms not checked | L–M | VERIFIED |
| Visit Singapore | https://www.visitsingapore.com/whats-happening/all-happenings/ | STB event cards (AFA 2026 listed) | HTML; card JSON embedded (`cardTitle_t`); ETag + LM | robots allows | L–M | VERIFIED |
| STB TIH API | tih.stb.gov.sg | — | **Dead**: DNS does not resolve; an STB FAQ (search) says it was discontinued 31 Jul 2025 | — | — | VERIFIED (DNS) |
| AnimeCons / FanCons | animecons.com, fancons.com | Con listings with JSON-LD | Cloudflare challenge (403) to plain clients | — | M | VERIFIED (blocked) |
| egg.network | https://egg.network/en/cosplay/best-cosplay-events-malaysia-singapore-2026 | MY/SG cosplay calendar | Next.js HTML | robots allows | L (contains errors, e.g. "AFA … October … MBS") | VERIFIED |
| Meetup "Singapore Anime Meetup Group" | meetup.com/singapore-anime-meetup-group | — | Group not found; ICS 404 | — | — | VERIFIED (dead) |

## 4. Venues

| Name | URL | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|
| **Suntec Singapore** | https://www.suntecsingapore.com/sitemap.xml (`/visit-events/{slug}`) | Nearly every SG anime/TCG con: AFA, Doumini, ACE, HoYo FEST, Randamu, CSF, Doki Doki, hololive OCG | **Sitemap with `<lastmod>` per event page** (3,349 event URLs); event pages carry "Event Dates: … Venue: … Hall …" text | robots allows (Squarespace; AI bots grouped with `*`; disallows `?format=json/ical`). **Terms §2: no "automated queries of any sort" without written permission** (read) → restricted unless Suntec agrees | **H** | VERIFIED |
| Singapore EXPO | https://www.singaporeexpo.com.sg/wp-json/wp/v2/event?orderby=modified&order=desc | Consumer fairs, TCG card shows | **WP REST `event` CPT** with `modified_gmt` (works) | robots allows; **Constellar terms §4.8(d) ban "any robot, spider, scraper"** (read) → restricted | L–M | VERIFIED |
| Marina Bay Sands Expo | https://www.marinabaysands.com/ (sitemap `/content/sitemap.xml`) | SGCC, G.O.D., SJ60 | Pages and sitemap **time out / HTTP2 reset** for non-browser clients (Akamai-style bot wall) | robots allows | H (venue) / unmonitorable | VERIFIED (blocked) |
| Esplanade | https://www.esplanade.com/sitemap.xml | Anime concerts: "jujutsu-kaisen-in-concert" (lastmod 2026-10-20), "pokemon-brass-concert", "piano-realms-anime-and-game-soundscapes" | **Sitemap lastmod** (3,533 URLs) filtered by keywords; pages ETag | robots **explicitly `Allow: /` for ClaudeBot**; terms not found | M | VERIFIED |
| The Star (Star Theatre) | https://www.thestar.sg/whats-on | Anime/J-pop concerts (Arknights, Square Enix music, ZUTOMAYO) | Last-Modified on `/whats-on`; event slugs are JS-rendered; sitemap has only top pages | robots allows all | M | VERIFIED |
| Singapore Sports Hub / Indoor Stadium | https://www.sportshub.com.sg/ | Big concerts | Cloudflare challenge (403) | — | M | VERIFIED (blocked) |
| Gardens by the Bay | https://www.gardensbythebay.com.sg/en/things-to-do/calendar-of-events.html | Anime Garden (Mar): cosplay singles, concert | AEM ETag + LM; probe the anime-garden URL (302 when inactive) | robots allows (0 rules); terms: no automation clause (read) | M–H | VERIFIED |
| *SCAPE | https://www.scape.sg/wp-json/wp/v2/events?orderby=modified&order=desc&_fields=id,modified_gmt,link,title | Youth hub: Konbini, Doki Doki, Randamu Creator Fiesta | WP REST `events` CPT (works; `/feed/` is empty) | robots allows; terms: no automation clause, no reproduction (read) → link-only | **H** | VERIFIED |
| Resorts World Sentosa | https://www.rwsentosa.com/en/events ; https://www.rwsentosa.com/sitemap.xml | Pokémon Aqua Adventure (Adventure Cove), Sanrio at USS | Sitemap lastmod (3,236 URLs); page ETag | robots allows | L–M | VERIFIED |
| Filmhouse (JFF) | https://filmhouse.sg/seasons-events/jff26/ | Japanese Film Festival anime strand (Oct) | WP (RSS empty; REST types available) | robots allows | M | VERIFIED |
| Downtown East (D'Marquee) | https://www.downtowneast.com.sg/ | Cosfest venue | HTML diff | robots allows | L–M | VERIFIED |
| Fever Exhibition Hall | feverup.com | Character exhibitions | Restricted (existing) | Terms ban robots | M | VERIFIED (prior) |

## 5. Malls (pop-ups)

| Name | URL | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|
| CapitaLand malls (Plaza Singapura, Bugis Junction, **Bugis+**, Funan, Raffles City, IMM…) | `capitaland.com/sg/malls/{mall}/en/events.html` | Anime pop-ups; e.g. a Gundam Base pop-up at Bugis+ 2–9 Nov 2026 (search) | **Imperva/Incapsula bot wall**: even robots.txt returns the challenge iframe. Not bypassed. Rely on editorial RSS or manual | Unknown | **H** / unmonitorable | VERIFIED (blocked) |
| Jewel Changi Airport | Shop pages, e.g. https://www.jewelchangiairport.com/en/shop/the-gundam-base-singapore.html ; Telegram https://t.me/s/jewelchangiairportofficial | Pokémon Center SG, Gundam Base SG, Sanrio pop-ups | AEM pages have ETag + LM; **Telegram public preview** (latest post 2026-11-24) as a diff feed; no sitemap (404), no events index found | robots.txt 404 | M–H | VERIFIED |
| VivoCity | https://www.vivocity.com.sg/feed/ | "Super Mario Holiday Power-Up", "Sanrio Characters Moonlit Garden" | **WP RSS** (newest 2026-11-05); `wp-json` returns 401 | robots allows | M–H | VERIFIED |
| Marina Square | https://www.marinasquare.com.sg/ (articles `?categories=Events-Web`) | Sanrio "Hello Singapore" pop-up (Aug 2026) | HTML: set of article IDs | robots.txt 404 | M | VERIFIED |
| Cathay Cineleisure | https://cineleisure.com.sg/feed/ | Youth/J-fashion mall events ("Something Strange Festival") | WP RSS (newest 2026-11-06) | robots allows | M | VERIFIED |
| City Square Mall | https://www.citysquaremall.com.sg/happenings/events-promotions/ | Anime Earth (SCC) | HTML (LM header); `/feed/` 403; wp-json search blocked by a Cloudflare rule | robots allows | M | VERIFIED |
| Wisma Atria | https://www.wismaonline.com/wp-json/wp/v2/campaign?orderby=modified&order=desc | Pop-ups | WP REST `campaign` CPT (works); RSS returns 500 | robots.txt returns HTML | L–M | VERIFIED |
| ION Orchard | https://www.ionorchard.com/en/events.html | Pop-ups | AEM ETag + LM | robots.txt returns HTML | L–M | VERIFIED |
| Far East Malls (Orchard Central, Clarke Quay Central…) | https://www.fareastmalls.com.sg/ | Sanrio Christmas pop-ups (2025) | — | **robots `Disallow: /` for ClaudeBot** (allows Claude-Web/anthropic-ai); restricted for AI crawl | M | VERIFIED |
| Suntec City (mall) | https://www.sunteccity.com.sg/ | Atrium pop-ups | ETag; event links JS-rendered | robots.txt 404 | L–M | VERIFIED |
| Takashimaya SG | https://www.takashimaya.com.sg/ | Japan fairs, character pop-ups | HTML hash | robots.txt 404 | L–M | VERIFIED |
| 313@somerset | https://www.313somerset.com.sg/ | — | HTML | robots allows | L | VERIFIED |
| FairPrice Xtra Sanrio | https://www.fairprice.com.sg/events/xtra/xtra-sanrio/ | "Hello Singapore! Sanrio Characters Collection" | WP page LM | robots allows | L–M | VERIFIED |

## 6. Ticketing platforms

| Name | URL | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|
| Eventbrite / Peatix / Luma | See §3 | — | — | — | VERIFIED |
| SISTIC | https://www.sistic.com.sg/ | Next.js shell plus Cloudflare markers; nothing cheap to diff | robots.txt 404 | M–L | VERIFIED |
| Ticketmaster SG | https://ticketmaster.sg/ | Returns 401 to plain clients. Hige Dandism and similar shows sold here. Discovery API coverage of SG unknown | robots allows | M–L | VERIFIED (401) / INFERRED (API) |
| Klook | https://www.klook.com/en-SG/ | Cloudflare 403 | — | L | VERIFIED (blocked) |
| Megatix | https://megatix.com.sg/events | HTML (200 through Cloudflare); sells G.O.D. passes | robots allows `/events` (disallows `/find/`, `/v1/`) | L–M | VERIFIED |
| Ticketmelon | https://www.ticketmelon.com/ | Next.js; G.O.D.'s R.E.M party | robots allows | L | VERIFIED |
| BookMyShow SG | https://bookmyshow.sg/ | Next.js; SG Game Fest | robots allows | L | VERIFIED |
| Fever | https://feverup.com/en/singapore | Restricted (existing) | Terms ban robots | M | VERIFIED |

## 7. Editorial (RSS unless noted)

All are link-only (headline + link). Feed the LLM only items that match keywords (anime, cosplay, manga, pop-up, collab, Sanrio, Pokémon, Gundam, hololive, J-fashion, lolita, convention).

| Outlet | Feed | Newest item seen | Robots | Signal | Status |
|---|---|---|---|---|---|
| Geek Culture | https://geekculture.co/feed/ ; `/anime-comics/feed/`, `/cosplay/feed/`, `/toys/feed/` | 2026-11-24 (cosplay category last 2025-12-02) | allows | **H** | VERIFIED |
| TheSmartLocal | https://thesmartlocal.com/feed/ ; `wp-json/wp/v2/posts?search=anime` | 2026-11-24 | allows | **H** | VERIFIED |
| Little Big Red Dot | https://littlebigreddot.com/feed/ | 2026-11-24 | allows | M–H | VERIFIED |
| The Magic Rain | https://themagicrain.com/feed/ | 2026-11-24 | allows | M–H | VERIFIED |
| Mothership | https://mothership.sg/feed/ | 2026-11-24 | allows | M | VERIFIED |
| Honeycombers | https://thehoneycombers.com/singapore/feed/ | 2026-11-24 (no event CPT in REST) | allows | M | VERIFIED |
| Little Day Out | https://www.littledayout.com/feed/ | 2026-11-23 | allows | M | VERIFIED |
| Eatbook | https://eatbook.sg/feed/ | 2026-11-24 (collab cafés) | allows | M | VERIFIED |
| Everyday People SG | https://everydaypeople.sg/feed/ | 2026-11-24 | allows | M | VERIFIED |
| BYKidO | https://www.bykido.com/blogs/events-and-activities.atom | 2026-11-23 (Shopify Atom, 30 entries) | allows | M | VERIFIED |
| The Reimaru Files | https://www.reimarufiles.com/feed/ | 2026-11-24 | allows | M | VERIFIED |
| Seth Lui | https://sethlui.com/feed/ | 2026-11-24 | robots.txt 403 to my client | L–M | VERIFIED |
| Bandwagon | https://www.bandwagon.asia/ (4 feed link tags) | — | allows | M–L (J-pop concerts) | VERIFIED |
| The Beat Asia | https://thebeat.asia/singapore/the-list/events | HTML (LM) | allows | L–M | VERIFIED |
| FZINE (FEMALE) | https://www.fzine.com/ | HTML ETag/LM; Konbini and Harajuku coverage | allows | L–M (J-fashion) | VERIFIED |
| ANN press releases | (existing `ann-press`) | SG concert PRs (e.g. Hige Dandism) | existing | M | — |
| SG Magazine | https://sgmagazine.com/feed/ | **Stale** (2024-12-31) | allows | L | VERIFIED |
| Time Out SG | https://www.timeout.com/singapore | Cloudflare 403; `news_sitemap.xml` returns 410 | — | M / blocked | VERIFIED |
| Alvinology | https://alvinology.com/feed/ | Cloudflare challenge 403 (publishes PRs for Anime Earth, CSF, G.O.D.) | — | M / blocked | VERIFIED |
| GameTrader.sg blog | https://www.gametrader.sg/blog/feed/ | Feed works (2026-11-24), but **robots `Disallow: /` for ClaudeBot**, plus `Content-Signal: search=yes,ai-train=no,use=reference` | restricted for AI | M | VERIFIED |

## 8. Character / merch retail and collab cafés

| Name | URL | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|
| ANIPLUS Café (Esplanade Mall) | https://www.anipluscafe.com/ | Collab cafés (Frieren now; past: Miku Colorful Stage 31 Jul–10 Sep 2026, Persona 5 Royal, BanG Dream) | **Homepage redirect target = current collab** (now `/frieren-beyond-journeys-end/`); no wp-json, no feed | robots.txt 404 | **H** | VERIFIED |
| Japan Rail Café | japanrailcafe.com.sg | Collabs (Monster Hunter Stories 3 Mar–Apr 2026, Pompompurin May–Jun 2026) | Site shows "Index of /" (dead). Socials only; editorial RSS covers it | — | M | VERIFIED (dead) |
| Pokémon SG official | https://sg.portal-pokemon.com/topics/ | Pokémon Center SG (reopened 1 Jul 2026), events, merch | Next.js listing; diff the set of `/topics/post-N` IDs | robots allows | M–H | VERIFIED |
| Pokémon Asia press | asia-press.portal-pokemon.com | Press releases | Next.js; `/press-release/` 404 | — | M | VERIFIED |
| The Gundam Base SG (Jewel) | Jewel shop page (above) | Store events, releases | ETag/LM on the shop page; IG for events | robots.txt 404 | M | VERIFIED |
| Sanrio SG | No official SG site (`sanrio.com.sg` does not resolve); Jewel "Sanrio Characters Store" page | Pop-ups, Chinatown store | Jewel page ETag; editorial RSS | — | M | VERIFIED |
| hololive production news | https://hololivepro.com/en/news/ | Global; SG items occasionally (e.g. Albirex Niigata SG "Special Day" May 2026) | HTML diff filtered on "Singapore" (`/en/news/feed/` stale since 2023) | — | M–L | VERIFIED |
| COVER Corp news | https://cover-corp.com/en/news | Global | Next.js HTML | robots allows | L | VERIFIED |
| Kinokuniya SG | https://kinokuniya.com.sg/ | Manga events, signings | Shopify; terms forbid crawling (merch.js) → link-only | — | L–M | VERIFIED (prior) |
| Don Don Donki SG | https://www.dondondonki.com/sg/ | Promos | HTML | — | L | VERIFIED |
| POP MART SG | https://www.popmart.com/sg | Drops | Next.js | robots allows (sitemap) | L | VERIFIED |
| Bandai Namco Ent. Asia | https://www.bandainamcoent.asia/ | — | Vercel Security Checkpoint (429) | — | L | VERIFIED (blocked) |
| SEGA Asia | https://asia.sega.com/ | Collab announcements | Minimal page | — | L | VERIFIED |
| SG hobby shops (ToyCoin, TOG, Otaku House, Candytoyo) | — | Restocks | Search links only (Shopify terms); unchanged | — | L–M | (existing) |

## 9. Communities and social

| Name | URL | Monitoring method | Notes | Signal | Status |
|---|---|---|---|---|---|
| Instagram (AFA, SCC/Cosfest, COSSET, Konbini, Gundam Base SG, ANIPLUS, Japan Rail Café, Harajuku Fashion Walk SG, lolita community) | — | **Instagram-only**: needs a paid scraper (e.g. an Apify Instagram actor) or manual input | No discovery API; Meta terms ban automated collection | H (aggregate) | INFERRED |
| Facebook groups/events (SCC, HappyRori Lolita Fashion Singapore, cosplay groups) | facebook.com | **Manual only** | robots `User-agent: * Disallow: /` (verified); groups are mostly private | M | VERIFIED (robots) |
| X / Twitter | — | Paid API only | — | M | INFERRED |
| Telegram public channels | `https://t.me/s/{channel}` | Public preview HTML: diff `data-post` IDs and `datetime` | robots.txt 404. **CosEventSG stale** (last 2025-07-23); **RandamuAnimeNews stale** (2024-10-03); Jewel official channel active | Varies | VERIFIED |
| Reddit | r/singapore (and r/SingaporeRaw) | Existing OAuth Data API collector: `GET /r/singapore/search?q=anime OR cosplay OR "pop-up"&restrict_sr=1&sort=new` | robots `Disallow: /` (verified); **no SG anime/cosplay subreddit found** (r/SGAnime, r/sgcosplay and r/AnimeSingapore not found in search; confirm with the API's `/about`) | L–M | VERIFIED (robots) / INFERRED (subs) |
| HardwareZone forums | https://forums.hardwarezone.com.sg/forums/tv-mania-animemania.266/index.rss ; `hobby-lovers.229`, `events-entertainment-celebrity-buzz.242` | **XenForo RSS** (20 items each, newest 2026-11-24) | robots.txt 404; terms not checked | L–M | VERIFIED |
| Bluesky | (existing collector) | Search "Singapore cosplay" | Already in pipeline | L–M | — |
| Discord, TikTok, Lemon8, RedNote | — | No access | — | — | INFERRED |
| Art/zine markets | Singapore Art Book Fair (`singaporeartbookfair.com` is parked, for sale); Artbox / Public Garden / Boutique Fairs (guessed domains don't resolve) | Editorial RSS (Time Out/Honeycombers) or IG | Low anime relevance; Artbox SG likely defunct | L | VERIFIED (DNS/parked) / INFERRED |

## 10. Japanese cultural institutions

| Name | URL | Announces | Monitoring method | Robots / terms | Signal | Status |
|---|---|---|---|---|---|---|
| Japan Creative Centre (JCC) / Embassy of Japan | https://www.sg.emb-japan.go.jp/JCC/ ; `/JCC/archive.htm` ; monthly `/JCC/E-Magazine-{Mon}-{YYYY}.html` | SJ60, JFF masterclasses, exhibitions, occasional anime screenings | **403 "Access Denied"** to curl and WebFetch (WAF, possibly geo). Options: retry from an SG IP; probe the predictable E-Magazine URL monthly; or subscribe a mailbox to "Friends of JCC" | robots.txt 404 | M | VERIFIED (blocked) |
| Japan Foundation | https://www.jpf.go.jp/e/about/area/2026/singapore_2026.html | SJ60 programme; JFF co-organiser | ETag + LM conditional GET | robots allows | L–M | VERIFIED |
| JNTO Singapore office | https://www.japan.travel/en/sg/ | Travel fairs | HTML | robots.txt returns HTML | L | VERIFIED |
| Japanese Association Singapore | https://www.jas.org.sg/ | Natsu Matsuri / Bon Odori (summer) | HTML (`/events` redirects home) | robots.txt returns HTML | L–M | VERIFIED |
| JCCI Singapore | https://www.jcci.org.sg/feed/ | Business events | WP RSS | robots allows | L | VERIFIED |
| SJ60 | https://sj60.sg/ | (covered) | — | — | — | — |

## 11. Nearby events Singaporean fans travel to (JB / KL)

| Name | Where / when | URL | Method | Status |
|---|---|---|---|---|
| Comic Fiesta (+ CFmJ, Comic Fiesta mini Johor) | KLCC, Dec; Johor mini (TBC) | https://comicfiesta.org/our-events | Squarespace HTML/ETag; robots allows | VERIFIED |
| AniManGaki | MIECC Seri Kembangan, 28–30 Aug 2026 | https://www.animangaki.com/ | WP (RSS stale since 2022; use REST pages) | VERIFIED |
| Japan Expo Malaysia | KLCC, 24–26 Jul 2026 | japanexpomalaysia.com | `www.` has a TLS hostname mismatch | VERIFIED (error) / INFERRED (dates) |
| HoYo FEST KL | KL, Jul–Aug | — | Socials | INFERRED |
| YUME ACG Fest | Sutera Mall, JB, 30 Oct–1 Nov 2026 | https://allevents.in/johor-bahru/yume-acg-fest-2026-easy-mode/200030041659827 | allevents page | VERIFIED |
| JCOS Cosplay Party / CosTime JB | R&F Mall JB (Jun 2026); JB (Oct 2026) | allevents / RosterCon | Social | INFERRED |
| Lowyat "Anime Shrine" forum (MY) | — | forum.lowyat.net/AnimeShrine | Forum | INFERRED |

## 12. Weather and transit (free)

| Source | Endpoint | What it gives | Limits / auth | Status |
|---|---|---|---|---|
| **NEA 4-day outlook** (data.gov.sg v2) | `https://api-open.data.gov.sg/v2/real-time/api/four-day-outlook` | 4 days: `forecast.code/text/summary` (e.g. "Afternoon thundery showers"), temp high/low, RH, wind | v2 Realtime: **6 calls/10 s without a key, 12 (dev key), 30 (prod key)**; free key from data.gov.sg; header `x-api-key` (INFERRED from client docs) | VERIFIED |
| NEA 24-hour forecast | `https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast` | `general` (forecast, temp, RH, wind) + 6-hour `periods` for 5 regions | same | VERIFIED |
| NEA 2-hour nowcast | `https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast` | 47 areas with lat/long (`City`, `Kallang`, `Sentosa`, `Changi`, `Tampines`, `Pasir Ris`, `Tanglin`…) | same | VERIFIED |
| **Open-Meteo** | `https://api.open-meteo.com/v1/forecast?latitude=1.2937&longitude=103.8572&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=Asia%2FSingapore&forecast_days=16` | **16-day** daily forecast (returned 2026-11-25 → 2026-12-10) | Free **non-commercial only**: <10,000 calls/day, 5,000/h, 600/min; CC-BY 4.0. `api.` robots is `Disallow: /` (an API, not a crawl target) | VERIFIED |
| LTA DataMall | `https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts` ; `/ltaodataservice/v3/BusArrival?BusStopCode=` | MRT disruptions on event day; bus arrivals | Free `AccountKey` header (both returned 401 without a valid key) | VERIFIED (401) |
| OneMap Search | `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=Suntec%20City&returnGeom=Y&getAddrDetails=Y&pageNum=1` | Venue geocoding (lat/long, postal) | Works keyless today, but the response says "Authentication token missing…" (free token; expect enforcement). Routing needs a token | VERIFIED |
| data.gov.sg MRT station exits (GeoJSON) | data.gov.sg dataset | Nearest exit to a venue | Static download | INFERRED |

**Recommendation.** Use **Open-Meteo for 5–16 days out** (geocode the venue with OneMap; free, no key). Switch to the **NEA four-day outlook** once the event is within 4 days, then use the **NEA two-hour nowcast** on the day for the nearest area by `label_location` (Suntec/MBS/Esplanade → `City`; Jewel/EXPO → `Changi`; RWS → `Sentosa`; Downtown East → `Pasir Ris`). For a site with ads or subscriptions, Open-Meteo's free tier does not apply; NEA has no such restriction. Add LTA `TrainServiceAlerts` for "MRT disruption" warnings.

---

## 13. Gaps compared with the existing descriptors

1. **Game On, Dreamers!**: 11–13 Dec 2026, MBS Halls D–F, cosplay battles. Has clean Event JSON-LD.
2. **Asia Comics Expo 005**: 23–24 Jan 2027, Suntec Hall 403 (venue page). The organiser sells on Eventbrite.
3. **Doumini 2026** is now **venue-confirmed**: 12–13 Dec 2026, 12:00–19:00, Hall 405. The descriptor still says "listing / TBC".
4. **Konbini** (J-fashion / alt-fashion market at *SCAPE). Not in the descriptors, and the strongest J-fashion signal in SG.
5. **Randamu World / Creator Fiesta**, **AFA Creators Super Fest** (Jul), **Cosfest** (SCC, Jul, Downtown East).
6. **Anime concerts**: Esplanade (Jujutsu Kaisen in Concert, Pokémon brass), Star Theatre, Indoor Stadium.
7. **Collab cafés and store events**: ANIPLUS Café, Japan Rail Café, Pokémon Center SG, Gundam Base SG, Sanrio.
8. **Mall pop-ups**: VivoCity, Marina Square, Jewel, Cineleisure, Bugis+/Plaza Singapura (CapitaLand is blocked).
9. **Japanese Film Festival** (Oct) anime strand.
10. **Anime Garden**: the official GBTB URL exists, so probe it for a 200.
11. **SGCC blog feed**: a cheaper and earlier gate than the homepage.
12. TCG-only events (Card Con, Singapore Card Show, Bushiroad, hololive OCG) are lower priority unless she plays.
13. Nearby: AniManGaki, Japan Expo Malaysia, CFmJ / YUME ACG / JCOS in Johor.

## 14. Restricted or blocked (do not crawl without an owner decision)

| Source | Reason |
|---|---|
| acgevents.sg | Terms ban bots; the owner declined to ask |
| ANIHK | robots `Disallow: /` for ClaudeBot / anthropic-ai / GPTBot |
| Suntec Singapore | Terms forbid automated queries without written permission (the sitemap is otherwise ideal; worth asking) |
| Singapore EXPO (Constellar) | Terms ban robots/scrapers |
| Fever, Doki Doki (Shopify), Kinokuniya and SG Shopify shops | Terms ban crawling (existing) |
| Far East Malls, GameTrader.sg | robots disallow ClaudeBot (GameTrader also sets ai-train=no) |
| MBS, CapitaLand (Incapsula), Sports Hub, Time Out, Alvinology, Klook, AnimeCons/FanCons, Bandai Namco Asia, JCC/Embassy | Bot walls / WAF (not bypassed) |
| Instagram, Facebook, X | No legitimate free automated access |

## 15. Crawler notes

- **Tier A (hourly to daily, near-zero cost):** RSS/Atom feeds; WP REST `?orderby=modified&_fields=id,modified_gmt,link,title`; Event JSON-LD pages. Hand off only new or changed IDs, and only if a keyword prefilter matches.
- **Tier B (daily to weekly):** sitemap `<lastmod>` filtered by keyword slugs (Esplanade, RWS); conditional GET with ETag/LM (GBTB, ION, Jewel pages, JPF); a redirect-target check (ANIPLUS Café); listing-ID sets (Pokémon SG topics, Telegram `t.me/s/`, Marina Square articles).
- **Tier C (manual / email):** IG/FB-only organisers. A cheap legitimate alternative to a paid scraper is a dedicated mailbox subscribed to organiser newsletters (AFA/SOZO, SGCC, JCC "Friends of JCC", Eventbrite/Peatix "follow organiser" emails), read through the existing Gmail connector.
- Keep the pipeline's existing verbatim-date rule: editorial and aggregator hits only *trigger* an investigation, and dates must be confirmed on an official or venue page.
