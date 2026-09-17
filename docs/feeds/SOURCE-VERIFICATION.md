# Source verification matrix

Checked 2026-09-15. Policies are declared in each module under `server/feeds/sources/` (and `server/feeds/events/sources.js`) and validated by `defineSource`. This file records what was verified, how, from where, and what is still unverified.

## How to read this

- **Execution location.** Every live probe below ran from the **local machine** (home WSL network), not Vercel. A local success proves the endpoint, response shape and our parser. It does **not** prove access from Vercel's network (Danbooru, Fandom and Crunchyroll sit behind Cloudflare) or function packaging. Those need the deployed pipeline (see "Production verification").
- **Keyed sources.** `YOUTUBE_API_KEY`, `TUMBLR_API_KEY`, `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` exist only as Vercel **Sensitive** variables and can't be read locally. YouTube and keyed Tumblr paths were tested against recorded mocks written from the official docs, and were **not called live**. Bluesky was probed keyless; its login path is mock-tested.
- **Probe.** `node scripts/probe-feed-sources.mjs --module … --export … --pages 1`: one page, with a private record in `.data/feed-probes/`. Items are validated exactly as in collection. "Items" means valid normalized candidates **before** the safety checks; nothing was approved, since approval needs the OpenAI path.
- **Tests.** Fixture-driven `node:test` suites (recorded real responses, trimmed, no credentials) run through the real `sourceHttp` guard. An unrecorded request fails the test.
  - `test-feed-sources-anime.mjs` 24/24
  - `test-feed-sources-social.mjs` 22/22
  - `test-feed-sources-music.mjs` 35/35
  - `test-feed-sources-shop.mjs` 32/32
  - `test-feed-sources-events.mjs` 21/21
- **Policy keys.**
  - Media: `still_only`, `moving_sampled`, `embed_provenance`, `link_only`.
  - Copy: `private_copy` (with a recorded basis) or `link_only`.
  - Deletion: `honor_deletions` (with a deadline), `recheck_before_publish` or `none`.

## Matrix

| Family · entries (status) | Reference | Credentials | Probe (UTC, local) | Result | Kinds · media | Copy · deletion · cache | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Danbooru** · `danbooru-maomao`, `danbooru-vocaloid`, `danbooru-memes` (enabled) | [API help](https://danbooru.donmai.us/wiki_pages/help:api), [ToS](https://danbooru.donmai.us/terms_of_service) | none (optional `DANBOORU_USER_ID` for the User-Agent) | 15:26:25–15:26:32 | ok: 8 / 8 / 8 items, 1 request each | image, clip, meme · `moving_sampled` (GIF/MP4 ≤8 MiB; webm/zip skipped) | **private_copy** · honor 72 h · 1 d | Bluesky, Tumblr, reserve |
| **Sakugabooru** · `sakugabooru-maomao` (optional) | [API](https://www.sakugabooru.com/help/api), ToS | none | 15:26:45 | ok: 8 items | clip · `moving_sampled` | link_only · recheck before publish · 1 d | Danbooru clips |
| **AniList** · `anilist-apothecary` (enabled) | [Terms](https://docs.anilist.co/guide/terms-of-use), [rate limits](https://docs.anilist.co/guide/rate-limiting) | none | 15:26:49 | ok: 3 items (S3 ep 1 airing 2026-10-02T14:00Z; S3 part 2 start 2027-04 month precision; film 2026-12-11) | news (airing schedule) · link_only | link_only · none · 1 h | Wikipedia S3 rows, news |
| **Anime news** · `news-ann` (enabled), `news-crunchyroll` (optional), `news-animecorner` (enabled), `news-mal` (**restricted, disabled**) | ANN [copyright policy](https://www.animenewsnetwork.com/copyright-policy); Crunchyroll ToS (Cloudflare); Anime Corner robots; MAL [terms](https://myanimelist.net/about/terms_of_use) | none | 15:26:51–15:26:58 | ANN 1 item; Crunchyroll and Anime Corner 0 (feeds OK with 50/25 entries, none matched the 7-day routes); MAL not collected | news · link_only | link_only · none · 1–4 h | whichever outlets work |
| **Fandom** · `fandom-apothecary` (enabled) | Wiki API; licence from the wiki's Copyrights page (CC BY-SA 3.0) | none | 15:27:01 | ok: 3 lore excerpts | lore · link_only | link_only · none · 1 d | Wikipedia |
| **Wikipedia** · `wikipedia-apothecary` (enabled) | [Wikimedia ToU](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use), [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) | none | 15:27:04 | ok: 3 episode rows | lore · link_only | link_only · none · 1 d | Fandom |
| **Bluesky** · `bluesky-maomao`, `bluesky-art`, `bluesky-cosplay`, `bluesky-fashion`, `bluesky-memes` (enabled, fetch-b) | [Developer guidelines](https://bsky.network/docs/developer-guidelines), [API directory](https://bsky.network/docs/api-directory) | none (optional `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD`; reads only) | 19:16:47–19:20:17 (keyless) | maomao 8 (probed twice), art 8, memes 8, fashion 8; cosplay first **403 `blocked`** (recorded as a failure), then 200 with 0 items in the 48 h window at 19:19:51 | image, clip, cosplay, look, meme · `moving_sampled` (HLS video) | **private_copy** · honor 24 h · 1 d | Tumblr, Danbooru, reserve |
| **Tumblr** · `tumblr-memes` (enabled, keyless RSS), `tumblr-maomao`, `tumblr-cosplay` (optional, key) | [API License Agreement](https://www.tumblr.com/docs/en/api_agreement), [API v2](https://www.tumblr.com/docs/en/api/v2) | memes: none (key optional for recheck); maomao/cosplay: `TUMBLR_API_KEY` | 19:18:13 | memes 4 items; maomao/cosplay `not_configured_locally` (mock-tested) | meme, image, clip, cosplay · `moving_sampled` | link_only · honor 24 h · **retention 72 h** (payloads expire; saves keep credit + link only) | Bluesky |
| **Lemmy** · `lemmy-memes` (enabled, fetch-b) | lemmy.world [ToS](https://legal.lemmy.world/tos/), ani.social terms, robots crawl delay 60 s | none | 19:18:16 | ok: 6 items | meme · `moving_sampled` | link_only · honor 24 h · 1 d | Bluesky/Tumblr memes |
| **VocaDB** · `vocadb-songs` (enabled); foundation `vocadb` (disabled, superseded) | [Licence](https://wiki.vocadb.net/docs/license) (data CC BY 4.0), [public API](https://wiki.vocadb.net/docs/public-api) | none (optional `YOUTUBE_API_KEY` for playback checks) | 19:20:17 | ok: 7 songs; without a key `playback:null`, so YouTube media stays pending by design | song · `embed_provenance` | link_only · recheck before publish · 30 d | YouTube channel uploads |
| **YouTube Data API** · `youtube-music`, `youtube-tutorials`, `youtube-apothecary` (enabled, fetch-b), `youtube-memes` (enabled, fetch-a) | [Developer policies](https://developers.google.com/youtube/terms/developer-policies), [API docs](https://developers.google.com/youtube/v3/docs) | `YOUTUBE_API_KEY` | 19:20:36 | **verified live 2026-09-17** from this machine (the owner put a readable key in `.env.local`): all 32 channel IDs resolve and pass `channelTitleMatches`, and `youtube-memes`, `youtube-tutorials` and `youtube-apothecary` each returned real items (probe records in `.data/feed-probes/`). Two Apothecary queries returned trailer reuploads and were replaced (≈1,200 quota units/day — 11 `search.list` calls at 100 units each plus ≈60 list units — and ≈1 unit per published YouTube item at recheck) | song, video, clip, tutorial, cosplay, meme · `embed_provenance` (embeddable, SG region, age restriction, provenance recorded) | link_only · recheck before publish · data expires ≤30 d | VocaDB songs, news |
| **Project SEKAI Global** · `sekai-global` (master DB), `sekai-news-global` (colorfulstage.com) (enabled) | [Sekai-World EN master DB](https://github.com/Sekai-World/sekai-master-db-en-diff) (no licence file; text and links only, no images); colorfulstage.com news | none | 19:20:19 / 19:20:21 | 1 running event (3 requests); 8 news items | event, news · link_only | link_only · none · 1 d | piapro/ANN news |
| **piapro** · `piapro-news`, `piapro-goods` (enabled) | blog.piapro.net robots (blocks only `/wp-admin/`) | none | 19:20:22 / 19:20:24 | 5 news; 8 goods | news; merch · still images | link_only · none · 1 d | ANN press |
| **ANN press releases** · `ann-press-vocaloid` (enabled); **Siliconera** `siliconera-miku` (**restricted, disabled**) | ANN copyright policy (crawl delay 2 s); Siliconera robots returned a Cloudflare challenge | none | 19:20:26 | ANN 2 items; Siliconera not probed | news · link_only | link_only · none · 4 h | piapro, SEKAI news |
| **Solaris Japan** · `solaris-merch` (enabled) | [ToS](https://solarisjapan.com/policies/terms-of-service), `/agents.md` (product JSON listed as read-only browsing), robots allows products | none (FX via [Frankfurter](https://api.frankfurter.dev), no key) | 19:10:25 | ok: 8 items, 10 requests, 18.7 s | merch · still images | link_only · none · 1 d (prices dated; FX dated) | GSC |
| **Good Smile Company** · `gsc-merch` (enabled) | [Terms of use](https://www.goodsmile.com/en/terms-of-use) (Art. 13(11): capped at 24 paced requests); robots disallows only `/*/search` | none | 19:10:56 | ok: 8 items, 13 requests, 20.1 s; preorder deadlines from `availabilityEnds` (Japan date, stored 23:59:59 JST) | merch · still images | link_only · none · 1 d | Solaris |
| **Singapore shop / Taobao search links** (not collectors) | ToyCoin, TOG, Candytoyo and Kinokuniya document `/search?q=` in their `/agents.md`; Otaku House homepage form; all on GSC's SG partner list. Taobao robots `Disallow: /` (never fetched) | none | 2026-09-15 (robots/agents.md reads only) | links only; no `/search` page requested | `facts.links` (`sg_search`, `taobao_search` with the 正版 reminder) | – | – |
| **Arda Wigs** · `arda-wigs` (enabled) | ToS page body empty; robots allows blogs | none | 19:11:30 | ok: 0 items (latest post was a shipping notice, correctly skipped) | tutorial/news · still images | link_only · none · 1 d | YouTube tutorials |
| **SoraNews24** · `soranews-cosplay` (enabled) | robots allows the feed; no terms page | none | 19:11:33 failed `private_destination` (our address guard wrongly blocked 192.0.66.x). **Fixed in `http.js`**; re-probed once at 19:29:40 → ok, 3 items, 1 request, 516 ms | news · still images | link_only · none · 1 d | – |
| **Kamui Cosplay** · `kamui-cosplay` (**optional, disabled**) | robots allows `/feed/` | none | 19:12:28 failed (a plain GET took 101 s; timeout after 1 request) | – | – | – | YouTube tutorials |
| **ACDC RAG** · `acdcrag-looks` (**optional, disabled**) | ToS forbids spidering, crawling and scraping | none | no network (fails closed `restricted_by_source_terms`) | – | – | – | Bluesky fashion |
| **Singapore shoot spots** · `shootspots` (enabled) | NParks, Gardens by the Bay, PUB pages checked by hand 15:16–15:38 (NParks terms forbid automated monitoring/copying) | none | 19:15:06 | ok: 1 item, **0 requests** (static verified pool; this week Fort Canning Park) | spot · link_only | link_only · none · 7 d; entries older than 180 d stop serving | none (weekly extra) |
| **Events** · `events` stage (`server/feeds/events/sources.js`, 23 descriptors) | Official event pages (see below) | none | pass at 19:15 | 18 requests; 11 pages ok; verified dates found in the live excerpts on all 8 official pages that carry them; 4 next-edition probes returned `exists:false` (afasg27, cf27, eoy-booth-2027, C110) | event (via `events-countdown`) · link_only | – | owner confirmation in admin; TBC tags |
| **Lexicon refresh** (weekly) | Wiktionary, a Wikipedia glossary diff, Danbooru meme tags | none | 19:07 | Wiktionary 2 requests (17 candidates), Wikipedia 2 (5), Danbooru 1 (19); 41 candidates filtered to 16 | – | – | existing lexicon |
| **Internal** · `events-countdown`, `faves-creators` (enabled) | Neon `events` table / her faves | none | local tests | countdown milestones; creator link cards (no platform requests) | event, creator · link_only | – | – |

## Permission and access evidence

- **Danbooru `private_copy`.**
  - The Terms of Service (last updated 2022-10-23, read live 14:32 UTC) don't restrict API clients from caching or storing content. They do require following the API rate limits.
  - Combined with the owner's decision to keep private copies (PIPELINE §10/§19), copies are allowed.
  - Copies are removed within 72 h if Danbooru deletes, bans or re-rates the post. That deadline is our choice.
  - Copyright stays with the artist, and credit is always shown.
- **Bluesky `private_copy`.** The developer guidelines set no caching limit or deadline; they require acting on deletion requests. The owner decided on private copies removed after creator deletion (PIPELINE §19 decision 1), so the deletion deadline is 24 h. The Community Guidelines forbid bypassing rate limits, so keyless search makes one first-page request at least 15 s apart.
- **Tumblr.** The API License Agreement requires crediting the blog and source, honouring deletions within 24 h and storing nothing longer than 3 days. Items therefore expire 72 h after fetch, payloads are purged on expiry (`pruneFeeds`) and saves keep only credit and link (`retentionHours`). Inline GIFs don't autoplay for Tumblr items, and the credits dialog says "powered by Tumblr".
- **YouTube.** Developer Policies III.E.4.d (refresh or delete API data within 30 days) and III.E.4.j (made-for-kids status recorded as a safety label). Undocumented endpoints (oEmbed, channel RSS) are not used (III.D.7). Embeds keep the site's `strict-origin-when-cross-origin` referrer (error 153 otherwise).
- **VocaDB.** Data is CC BY 4.0 with a link back; images, audio and lyrics aren't covered. Volume stays far below "thousands per day". Content-warning tags (gore, horror, self-harm) pass to `safety.sourceTags`; theme tags common in story songs ("death", "murder") do not.
- **AniList.** Non-commercial use, no hoarding, 30 requests/minute. No cover images are used.
- **Fandom.** API only. Article pages, robots.txt and fandom.com terms returned a Cloudflare challenge, which was **not bypassed**. The licence comes from the wiki's own Copyrights page via the API.
- **Wikipedia.** CC BY-SA 4.0 with attribution. One parse call per build with `maxlag`, following API etiquette.
- **Events.** Dates are accepted only with verbatim evidence (`verbatimDateEvidence`), including the year.
  - AFA Singapore: 27–29 Nov 2026, official.
  - Singapore Comic Con: 4–6 Dec 2026, official (the dates sit in the page footer).
  - Apothecary Diaries Exhibition: 30 Sep–1 Nov 2026, read once by hand. Fever's terms ban robots and "any manual process", so the weekly reader and scout never touch it; the entry is seeded from recorded evidence.
  - Anime Earth: 28 Sep–4 Oct 2026, from a PDF press release; seeded.
  - SJ60 Musubi Festival: 28–29 Nov 2026.
  - EOY Festival: 25–26 Dec 2026.
  - Doumini: 12–13 Dec 2026, listing only.
  - Comiket C109: 29–31 Dec 2026.
  - AnimeJapan 2027: 27–28 Mar 2027.
  - World Cosplay Summit 2027: 12–14 Nov 2027 (found only in the site's JavaScript).
  - Japan Expo Thailand 2027: 26–28 Feb 2027.
  - Cosplay Mania 2026: 2–4 Oct 2026.
  - No accepted dates: Comic Fiesta ("more info soon"; AnimeCons' dates are not accepted), COSSET (social media only), Anime Garden and HoYoFEST (no official page found), Doki Doki Anime Market (terms ban crawling).
- **Merch pricing.**
  - Solaris prices come only from an available "Brand New" variant, since placeholder prices sit on unavailable variants. Release dates are month precision.
  - GSC preorder deadlines come from `availabilityEnds`, a date in Japan time.
  - FX rates are inverted from Frankfurter with the rate date recorded, and SGD is shown as approximate beside the dated source price.
  - Identical products merge only by check-digit-validated GTIN/JAN (`mediaIdentity: gtin:<code>`).

## Disabled or restricted sources, and why

| Source | Status | Reason | Fallback |
| --- | --- | --- | --- |
| MyAnimeList news | restricted, disabled | Terms of Use (updated 2025-12-16): "you agree not to collate or aggregate any of the content … for use elsewhere" | ANN, Crunchyroll, Anime Corner |
| Siliconera | restricted, disabled | robots.txt only reachable through a Cloudflare challenge | ANN press, piapro |
| Kamui Cosplay | optional, disabled | Feed read takes ~100 s; unstable validators | YouTube tutorials, Arda Wigs |
| ACDC RAG | optional, disabled | Terms forbid crawling/scraping; style also a poor fit | Bluesky fashion |
| `lemmyshitpost`, `onehundredninetysix@lemmy.blahaj.zone` | not collected | Political content, no politics rule | memes@lemmy.world and ani.social communities |
| Tumblr `ghostinthegutter` | not collected | All reblogs of other fandoms | allowlisted SEKAI blogs |
| Bluesky "Project Sekai – Latest" feed, `#skaterfashion`, `#girlykei` | not collected | News noise; negligible volume | tag searches plus the vision check |
| iTunes Search | not used | robots.txt `Disallow: /search*` | Spotify/Apple links from VocaDB |
| Doki Doki Anime Market | link only | Shopify terms ban crawling | events table entry without dates |

## Safety policy, as set by the owner (2026-09-16, second pass)

The acceptance bar was deliberately lowered so the dress-up and meme shelves actually fill. Recorded
here because it changes what the pipeline will surface, and `RULE_VERSION` was bumped to
`2026-09-16.2` so earlier vision/moderation rejections are re-decided under these rules.

- **Sexiness:** "suggestive" and mildly sexy art now pass. Only **explicit** is rejected. Danbooru's
  `sensitive` tier joins `general` (`rating:g,s`); questionable and explicit stay excluded. Swimwear,
  underwear and cleavage tags no longer fail the pre-check — the vision pass judges the actual image.
- **Apparent minors — not negotiable, and not the owner's call to relax.** Anything sexualised must
  read as an adult. The vision schema gained a required `apparentMinor` field, and this is the one
  axis where *uncertainty rejects*: `suggestive !== "none" && apparentMinor` → `apparent_minor`.
  A non-sexualised picture of a young-looking character is ordinary content and stays. The OpenAI
  `sexual/minors` threshold stays at 0.01. Lowering the bar on sexiness raises the risk here, which
  is exactly why the age gate was added at the same time.
- **Gore, horror and politics** were not part of the relaxation and still reject.
- **Meme relevance has two routes** (fixed 2026-09-16 after the section published empty): a meme
  counts when it is ABOUT something she follows (taste affinity), or when it came FROM one of her
  communities — `!animemes`, `!anime_irl`, `!hatsunemiku`, `!vocaloid`, `!minecraft`, the SEKAI
  Tumblr blogs. Requiring taste tags alone dropped almost every community meme, because a picture
  from an anime community carries no taggable subject. `!memes`, `!me_irl` and `!lemmyshitpost`
  still need a subject she follows. The meme check quota also rose from 15 to 40 a build, because
  most meme candidates were sitting unchecked.
- **Memes** must carry an image or video (text-only posts are dropped at the adapter, saving the
  collection and check budget) and must be **relevant to her taste** — positive affinity against her
  characters, voicebanks, fandoms or units. Humour style no longer filters anything. Fandom memes are
  eligible for the home carousel, with a small rank penalty so the sections don't repeat.
- **"Not for me" now trains scoring.** Her hides (never the owner's moderation hides) feed
  `dislikeSignals`: a tag counts after 2 hides, a creator from the first. Both are capped, so a run of
  hides damps a subject rather than erasing it.

## Decisions for the owner

1. **Danbooru robots.txt** disallows `/*.json` for crawlers, while Danbooru's API documentation invites API clients who respect its rate limits. The collectors use the documented API (≈1 request/s, bounded pages). The weekly lexicon refresh makes one request to the same API. Keep this reading, or drop Danbooru (Maomao art and memes would then rely on Bluesky and Tumblr).
2. **Wikipedia robots.txt** disallows `/w/` (which includes `api.php`) for crawlers. MediaWiki's API etiquette explicitly allows API clients, and that etiquette is followed. The same kind of choice as item 1.
3. **Tumblr's API License Agreement** also asks applications to offer OAuth login, which a read-only personal feed doesn't do. Tumblr entries stay as designed (the owner supplied the key). Disable `tumblr-*` in `server/feeds/sources/index.js` if this clause should rule them out.
4. **Dark and intense producers** (MARETU, Kairiki bear, Neru, Kikuo) are skipped entirely in music queries and their channels aren't collected. Confirm, or ask to allow them.
5. **Fever (Apothecary Diaries Exhibition)**: the dates were read once by hand; the page is never fetched automatically. Confirm or adjust dates in admin → Events if they change.
6. **Hero images for news, lore and events.** These cards carry no picture because their sources give
   no clear display permission: ANN/Crunchyroll ("no thumbnails are shown"), AniList ("No cover images
   are used"), Sekai-World ("text and links only, no images"), and SEGA forbids reposting while the
   SEKAI image host blocks hotlinking. The RSS feeds *do* already parse `media:content`/`enclosure`,
   so turning thumbnails on is a small code change — but it is a licensing decision, not a technical
   one, so nothing was switched on. Meanwhile those cards borrow the lore carousel's chibi instead of
   going out as plain text. Wikipedia and Fandom images are freely licensed (CC BY-SA) and would be
   the safest ones to enable first, but that depends on decision 2 above.

## Research traffic disclosure (2026-09-15)

Beyond the probes above, verification sent read-only requests, all spaced and bounded:
- **Danbooru:** about 90 requests (≥1.1 s apart).
- **Other anime sources:** about 25 to news sites, 14 to Sakugabooru and about 12 to Fandom, plus a handful to Wikipedia and AniList.
- **Social:** about 30 to Bluesky, spaced 16–31 s, including one deliberate cursor search, which was refused with 403.
- **Merch and shops:** about 40 to Solaris and GSC; one robots.txt per Singapore shop; one `agents.md` each to four shops; one Otaku House homepage; one Taobao homepage.
- **VocaDB:** about 75 requests (≥1.3 s apart) while verifying IDs.
- **YouTube docs:** a research helper downloaded about 530 pages from developers.google.com and was rate-limited (HTTP 429). No youtube.com or googleapis.com requests were made.
- **Third-party check:** one noembed.com lookup confirmed that two Apothecary Diaries PVs were uploaded by TOHO.
- **Other checks:** manual event-page checks (see above) and one iTunes `/search` request, made before its robots rule was found.

No accounts were created, no challenge or access control was bypassed, and no credential was printed or stored.

## Production verification

**Production checks, 2026-09-15 21:22 UTC**
- **Run:** executed by the deployed function on Vercel (`vercel production iad1`), deployment `dpl_He264EJ34k4b9ShzH9bDyhxV4MFg`, commit `3ab64dc`. Triggered from `/admin` → Production checks; results are redacted.

| Check | Result |
| --- | --- |
| Database | ok: effective variable `kData_DATABASE_URL` (no explicit `DATABASE_URL` in the production runtime), migrations applied 3 of 3 tracked, feed tables present |
| Blob | ok: private put, private read (bytes match), anonymous read **401**, delete confirmed. Test artifact `saves/diagnostic-2026-09-16-c8367aae.png` (test ID `2026-09-16-c8367aae`) created and deleted by the check |
| OpenAI | ok: `omni-moderation-latest` (not flagged), `gpt-5.6-luna`, `gpt-5.4-mini-2026-03-17` and a Luna vision probe, 8.1 s in total |
| YouTube Data API | ok: channel found; sample video embeddable, allowed in SG, not age-restricted; 2 quota units |
| Tumblr API | ok: HTTP 200, 1 tagged item |
| Bluesky | ok: app-password session created, 1 search result, no writes |

- **Deployment state:**
  - The build log shows production configuration valid, migrations applied, build and leak check passed.
  - Function `api/index.js`: `maxDuration: 300` with ffmpeg included; npm skipped the package's `chmod` install script, but the published tarball already stores the binary as `0755`.
  - All eight cron jobs are registered.
- **Before the checks:** the switch was `FEEDS_ENABLED=false` (no builds, runs, events or storage measurement yet).
- **Collection still pending:** these checks prove credentials, storage and database from Vercel. Per-source collection from Vercel's network is recorded when the first pipeline run completes (admin → source health).
