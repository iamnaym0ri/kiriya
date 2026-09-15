# Research: merch, J-fashion, wigs and Singapore shoot spots

Checked live on 2026-09-15 by a research agent. Requests came from a US mobile-carrier IP, with spot checks from a cloud fetcher. Nothing was tested from Vercel. Raw evidence was kept only in a temporary scratchpad.

The agent reported three lapses. It sent one request to a path disallowed by Otaku House's robots.txt (`/search/suggest.json`). It made a few requests faster than the stated crawl-delays at CDJapan (5 s) and animate (1180 s). No accounts or credentials were used.

## Verdicts

| Source | Provides | Auth & cost | Ships to SG? | Verified live? | Verdict |
| --- | --- | --- | --- | --- | --- |
| Solaris Japan `/products.json` (Shopify) | New listings, including prizes; franchise/character tags; USD | None | Yes | 200 (also from a cloud fetcher) | **Use** |
| Good Smile Company: `/en/releaseinfo` + product JSON-LD | Shipping calendar with JAN codes; preorder start/end; JPY price; image; GTIN | None | Yes (Southeast Asia US$8 per item type) | 200 | **Use** |
| SG GSC partner shops on Shopify (ToyCoin, TOG, Candytoyo, Otaku House) | SGD price; preorder deadline and ETA in the description text | None | Local | 200 | Use only with permission (terms clause, see notes) |
| Crypton blog goods RSS | Official Miku/Vocaloid/PJSK goods news (Japanese) | None | n/a | 200 | **Use** |
| Frankfurter v2 | JPY/USD → SGD rates | None, no quotas | n/a | 200 | **Use** |
| HobbyLink Japan | Search pages (HTML) + product JSON-LD | None | Yes | 200 | Maybe |
| SEGA Plaza calendar | Prize lineup and dates (JP) | None | Arcade | 200 | Maybe |
| Colorful Palette Store (official PJSK, JP) | Goods, preorder windows (HTML only) | None | DHL; some countries excluded | 200 | Maybe |
| Nin-Nin Game | New-products page (HTML) + JSON-LD (USD) | None | "100+ countries" | 200 | Maybe (low) |
| ACDC RAG, WunderWelt (Shopify) | J-fashion new items | None | Yes | 200 | Use |
| Arda Wigs (Shopify Atom) | Wig lines | None | Yes | 200 | Use (low volume) |
| Wig Is Fashion, Rolecosplay, Epic, L-email, Uniqso | Wig catalog JSON | None | Yes | 200 | Maybe (terms clause) |
| Bluesky `searchPosts` | Tagged J-fashion posts with images | None (fragile); login is the stable route | n/a | 200 with limits | Maybe |
| MyFigureCollection | No public API | — | n/a | 403 Cloudflare | Avoid |
| AmiAmi | Internal API only | — | Yes | 403 Cloudflare block | Avoid |
| Play-Asia | Old affiliate API | Affiliate ID | ? | 403 Cloudflare | Avoid |
| Tokyo Otaku Mode | News/art RSS only; shop is a JS app | None | 150+ countries | 200 | Avoid |
| CDJapan | Feed dead since 2014 | Affiliate | Yes | 200 / 502 | Avoid |
| Big in Japan | Domain for sale | — | — | Parked | Avoid |
| Taito / FuRyu prize sites | JS-rendered | — | — | 200 / Cloudflare | Avoid |
| Square Enix e-STORE, Movic, animate | JP official goods | — | No / no / proxy only | 200 | Avoid |
| Shopee / Lazada | — | Registered seller apps | — | 403 / captcha | Avoid |
| Tokyo Fashion RSS | Last item 2024-10-06 | None | — | 200 | Avoid (stale) |
| Liz Lisa, MA\*RS, Angelic Pretty, Listen Flavor, Ank Rouge | No feeds | — | Proxy / closing | 200 | Avoid |

## Source notes

### Solaris Japan
- **Request:** `GET https://solarisjapan.com/products.json?limit=250` returns 200 (771 KB, 1.1 s), newest first. About 12 new items a day.
- **Sample item:**
  - Title: "Sousou no Frieren - Fern - Nendoroid (#3130) … (Good Smile Company)"
  - Vendor: "Good Smile Company"
  - Variants: Brand New $33.47, Early Bird $22.24
  - Tags: `meta-franchise-Sousou no Frieren`, `meta-figure-Nendoroid` / `meta-figure-Prize`
  - Image on `cdn.shopify.com`
- **Details on the product page only:** release date ("Release Date 31. Jan 2027"); JSON-LD carries `gtin14` (the JAN code).
- **Access and terms:**
  - robots.txt (Shopify 2026 wording) says public product and collection pages are crawlable, and `/agents.md` lists product/collection JSON as read-only browsing.
  - The shop's terms have no scraping clause.
  - Shopify throttles unsigned bots, without published numbers.

### Good Smile Company
- **Release list:** `GET https://www.goodsmile.com/en/releaseinfo` returns 200 with 450 product links and JAN codes.
- **Product page JSON-LD:**
  - `price` "3900" (JPY)
  - `availability` PreOrder
  - `availabilityStarts` 2026-09-11 and `availabilityEnds` 2026-10-21. **`availabilityEnds` is the preorder deadline.**
  - `gtin` 4570232592971
  - Image: use `og:image`, since `image` is a relative path
  - The page text says "Shipping 01/2027"
- **Not available:** no RSS or sitemap. robots.txt disallows only `/*/search`, which rules out the full "Preorders Open Now" list; the homepage shows 24 of them.
- **Terms and limits:** the terms ban improperly accessing the server, but have no bot clause. A site-wide rate-limit header suggests keeping requests few.
- **Shipping:** non-Japan accounts are charged in USD.

### Singapore partner shops (Shopify)
- **Sample listings:**
  - ToyCoin: "LookUp Hatsune Miku", SGD 55.00, "Preorder (Deadline: 16/10/2026)".
  - TOG: "Nendoroid 3139 Hatsune Miku V6", SGD 81.00, "Preorder Deposit: S$20.00, Preorder Deadline: 01.10.2026, Estimated Release Date: March 2027".
  - Candytoyo: Nendoroid Fern [Basic], SGD 40.00, "Pre-order Ends: 18.10.2026".
- **Terms clause:** these shops use Shopify's template terms, which forbid use "to spam, phish, pharm, pretext, spider, crawl, or scrape":
  - ToyCoin, TOG, Otaku House
  - Chronicles Inc, Ani Mecha, Toymana
  - wig shops: Epic, Wig Is Fashion, Rolecosplay, Uniqso, L-email

  That contradicts their robots.txt. **Don't poll these without permission.** Plain search links are fine.

### Crypton goods RSS
- **Request:** `GET https://blog.piapro.net/category/goods/feed` returns 200, about 1 item a day.
- **Sample:** "グッドスマイルカンパニーより「ねんどろいど 初音ミク V6」が登場！" (07 Sep 2026).
- **Images:** fetch the post's `og:image`.
- No first-party online Miku goods shop was found; the Harajuku Miku Store is physical.

### Frankfurter
- **Request:** `GET https://api.frankfurter.dev/v2/rates?base=JPY&quotes=SGD` returns rate 0.00823 (2026-09-15). USD→SGD was 1.2705 on 2026-09-14.
- **Terms:** no key and no quotas; abuse is rate-limited; rates update about daily.

### HobbyLink Japan
- **Search** (HTML, allowed by robots.txt): `https://www.hlj.com/search/?Word=hatsune+miku&StockLevel=All+Future+Release`.
- **Product page JSON-LD:** brand, JPY price, gtin13, PreOrder, image. The release month is in the page text.
- **Terms:** no bot clause.

### Prize figures and official Project SEKAI goods
- **SEGA Plaza:** `https://segaplaza.jp/calendar/` is server-rendered, e.g. "初音ミクシリーズ FIGURIZMα "初音ミク"-Sailor- … 2026年9月25日 より順次登場".
- **Taito and FuRyu:** both sites are JS-rendered.
- **Solaris:** its `meta-figure-Prize` tag already catches SEGA, Taito and FuRyu prizes.
- **Colorful Palette Store:** product pages show the preorder window and delivery month (HTML only, no JSON-LD). No global PJSK goods store was found.

### Blocked or unsuitable
- **MFC, AmiAmi, Play-Asia:** Cloudflare challenges or blocks.
- **Square Enix e-STORE:** no shipping outside Japan.
- **animate:** its crawl-delay is 1180 s and its RSS feed is empty.
- **Shopee / Lazada:** API 403 / captcha.
- **Fake "official" stores:** hoyo.global, hoyoversemerch.com, hoyoverseofficial.store and theapothecarydiariesmerch.com are third-party sites. No first-party HoYoverse online store was found.
- **Hijacked domains:**
  - marsjp.com is gambling spam; MA\*RS's real shop is lilimpark.jp (no feed).
  - hakkenonline.com redirects to a gambling site.

### Bluesky (J-fashion)
- **Request:** `GET https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%23jiraikei&limit=100&sort=latest` returns 200 with 95 posts.
- **Active tags:** #地雷系, #lolitafashion, #gothiclolita, #y2kfashion, #harajukufashion. #sweetgoth returned nothing.
- **Limits:**
  - Six rapid queries triggered a 403; spacing requests 4 s apart fixed it.
  - `cursor` paging returns 403.
  - Unauthenticated search reportedly fails from datacenter IPs.
- **Safety:** 15 of 98 posts had `!no-unauthenticated` authors (exclude them); nudity, sexual and porn labels occur.

### J-fashion and wig feeds
- **ACDC RAG:** `acdcrag.com/en/products.json`, 942 products, JPY, with new-arrival tags. Harajuku punk.
- **WunderWelt:** second-hand gothic/lolita shop with per-brand collection JSON.
- **Arda Wigs:** `arda-wigs.com/collections/all.atom` returns 25 entries; newest product 2026-04-23.
- **Wig Is Fashion:** adds items daily, but lists junk "Commission" products.
- **Ank Rouge:** its store is password-protected and reportedly closing (June 2026 notice).

## Singapore shops

| Shop | Online/physical | Carries | Machine-readable? | Notes |
| --- | --- | --- | --- | --- |
| ToyCoin | Online | Nendoroid, scale, prize, kuji | Shopify JSON | GSC partner; terms clause |
| TOG Connection | Plaza Sing #06-04, Causeway Point, Jurong Point, Bugis+; online | Figures, games | Shopify JSON | GSC partner; clause |
| Candytoyo | Online | Nendoroid, figma, scale | Shopify JSON | GSC partner; check its terms before polling |
| Otaku House | Suntec #02-489, GV #03-373, PLQ #04-03, Jewel #04-240; online | Figures, kuji, claw prizes | Shopify JSON | GSC partner; clause |
| Kinokuniya | Takashimaya, Bugis Junction, JEM; online | Books, some goods | Shopify JSON | GSC partner |
| Chronicles Inc / Ani Mecha / Toymana | Peninsula / Keong Saik / Kaki Bukit | Figures, Gunpla | Shopify JSON | Clause |
| La Tendo | Suntec #03-354 | Figures, badges, standees | Site returned 403 to the test IP | GSC partner |
| Omocha House, Figmation | Online | Figures | Cloudflare challenge | Omocha is a GSC partner |
| Toy Outpost | Plaza Sing #07-11B, Suntec #03-361 | Consignment lockers (PJSK goods) | None | Check in person |
| Echo Goods / Gashapon Bandai Official Shop | Bugis+ / NEX, Plaza Sing, 313@Somerset, Northpoint | Anime goods / gashapon | None | Check in person |

GSC partner status comes from GSC's official list at partner.goodsmile.info/support/eng/partnershops/.

## Shoot spots and permit rules

**Rules**
- **NParks parks:** "A permit is required for all filming and commercial photography in our parks and nature reserves."
  - Apply at least 1 month ahead ([NParks](https://www.nparks.gov.sg/services/apply-on-location-filming-permit), updated 2026-09-02; another NParks page says 2 weeks).
  - The small-scale permit covers fewer than 16 people and no drones. It excludes nature reserves, Fort Canning, HortPark, Jurong Lake Gardens and the Botanic Gardens.
- **Singapore Botanic Gardens and Jurong Lake Gardens:** "Casual photography sessions (such as family portraits and graduations) do not require submission."
  - At Jurong Lake Gardens: no structures or props without approval; no photography at Clusia Cove, Forest Ramble or Entrance Pavilion.
- **Gardens by the Bay:** "Filming and photography for your personal memories are welcome." No tripods on weekends or public holidays. Commercial shoots need approval 14 days ahead.
- **In practice:** an unpaid, handheld shoot with a friend needs no permit. A paid photographer, a set-up, drones or video need a permit (NParks' "all filming" wording is ambiguous, so confirm with them).
- **Props:** wrap replica weapons in public (2017 cosplay guidelines developed with the Singapore Police).

**Spots**
- Fort Canning spiral staircase and fort gate
- Chinese and Japanese Gardens (reopened September 2024)
- HortPark
- Labrador Park WWII relics
- Bukit Batok quarry
- Punggol rocky beach
- Marina Barrage at night
- Boat Quay alleys
- Sentosa Boardwalk
- Studios: LunarWorks, Creative Brew, Studio Arcus Iris. This comes from a 2020 list, so verify before use.

**Local scene:** automated discovery isn't feasible without accounts.
- #sgcosplay on Bluesky has 16 posts ever, the last in January 2025.
- Instagram and TikTok offer only embeds for known links.

## Research recommendation

**Merch (about 35 requests a day)**
1. Pull Solaris `products.json`, filtered by franchise and character.
2. Pull GSC `releaseinfo`, plus JSON-LD for new matching products.
3. Join items on JAN/GTIN.
4. Add Singapore buy links. Only fetch shop data where terms allow; otherwise ask the shop first.
5. Add Crypton goods RSS (translated).
6. Optionally add a few HLJ searches, the SEGA Plaza calendar and the Colorful Palette list.
7. Convert prices with Frankfurter once a day, labelled "≈S$".

**Dress-up extras**
- Bluesky tags (page 1, ≥4 s apart, labels filtered, 403 fallback).
- ACDC RAG and WunderWelt JSON.
- Arda Atom.
- A static shoot-spot list with permit notes.
- A hand-curated Singapore scene list.

**Top risks**
1. Blocking from Vercel IPs.
2. Shop terms contradicting robots.txt, plus Shopify's bot throttling.
3. Vercel's "Scrapers" fair-use rule for any HTML parsing.
4. Messy data: free-text dates, mixed currencies, $0.00 sold-out variants, junk wig listings.
5. Fake or hijacked domains, so keep an allowlist.
6. NSFW Bluesky posts.
