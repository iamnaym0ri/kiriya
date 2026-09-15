# Claude continuation report

Continuation of Codex's feed foundation, following [`../execute.md`](../execute.md). This is a working log, updated phase by phase. Credentials and private content stay out of it.

## 1. Codex foundation understood — 2026-09-15

### Files read
- **Codex handoff:** [FOUNDATION-HANDOFF.md](FOUNDATION-HANDOFF.md), [CONTRACTS.md](CONTRACTS.md), [SETUP.md](SETUP.md).
- **Design and brief:** [PIPELINE.md](PIPELINE.md) (product authority) and [`../execute.md`](../execute.md) (this continuation brief).
- **Research:** all six files in [`research/`](research/).
- **Repository instructions:** none exist; there is no `AGENTS.md` or `CLAUDE.md`.
- **Code read in full:**
  - `server/feeds/` (config, taste, normalize, sources/registry, sources/vocadb, sources/fixtures, http, repository, rules, settings, moderate, provider, voice, writer, usage, score, editions, jobs, saves)
  - `server/content/taste.js`, `server/db/feed-schema.js`, `server/routes/feeds.js`, `src/admin/FeedPanel.jsx`
  - the foundation diffs to `server/app.js`, `server/routes/uploads.js`, `server/routes/me.js`, `server/content/kiriya.js`, `server/engine/writer.js`, `server/engine/sources/vocadb.js` and `src/admin/Admin.jsx`
  - the test harness setup in `scripts/test-feeds.mjs`

### Actual revision and deployment state

| Check | Result (method, execution location) |
| --- | --- |
| Local checkout | Branch `main` at `09acb16`, same as `origin/main` after `git fetch` (no new remote commits). The foundation and all earlier birthday/drawing/game/check-in/typography/mascot work are **uncommitted** in the working tree |
| Active production deployment | `dpl_6qz5cNkXbkCYAcRcFPPiq2Vi7ACM`, READY, created 2026-09-15 08:58 UTC. It is a **redeploy of `09acb16`** (Vercel REST API with the authenticated CLI session, local machine) |
| Foundation deployed? | **No.** Production runs pre-foundation code. `GET /api/jobs/feeds/fetch-a` returns 404 anonymously, and `GET /api/admin/feeds/status` returns 404 with a real admin session (production, from the local machine, 14:16 UTC) |
| Migrations | The production build log shows `✓ Migrations applied`, but `09acb16` only contains `0000_init`. Feed migrations `0001_dry_kree` and `0002_awesome_wolfsbane` are **not** in production |
| Runtime/function | Project `kiriya`, Vite, Node 24.x, Fluid enabled, region `iad1`. `vercel.json` `maxDuration:300` exists only in the uncommitted tree |
| Feed switches (plain values, Vercel API) | `FEEDS_ENABLED=false`, `OPENAI_FEED_MODEL=gpt-5.6-luna`, `OPENAI_FEED_FALLBACK_MODEL=gpt-5.4-mini-2026-03-17`, `FEED_MONTHLY_BUDGET_USD=5`, `FEED_MAX_REQUESTS_PER_RUN=24`; Production + Preview |
| New credentials | `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `TUMBLR_API_KEY`, `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` **exist** as `sensitive` entries for Production + Preview (added 08:35–08:55 UTC). Sensitive values can't be read back, so real credential requests need deployed code |
| Database target variables | Both `DATABASE_URL` (sensitive) and managed `kData_DATABASE_URL` exist. The code prefers `DATABASE_URL`. Whether it matches the managed store needs runtime code; a redacted diagnostic is planned (§3) |
| Existing production behavior | Public page 200; `/api/health` 200; anonymous `/api/me/today`, `/api/admin/status`, `/api/me/feed/maomao` and private media return 401. The admin session works (HttpOnly/Secure/SameSite cookie). Admin status reads Neon. Uploads config reports private Blob `presigned` mode |
| Local tests | `npm test`: **45/45 pass** (isolated in-memory PGlite, local machine) |

### Verified existing modules (the code matches the reports)
- **Taste:** strict defaults and overrides with compare-and-set revision, build snapshots, filtered writer context.
- **Identity:** native, URL and media aliases; permanent seen/hidden flags; fingerprint reset on changed payloads.
- **Runner:** durable leases, generation fencing, per-stage checkpoints, five-minute catch-up throttle. The events stage is a registration hook that returns `not_implemented`.
- **Provider:** Responses API with Luna explicit cache and a mini fallback; moderation; still-image vision through `sharp` at ≤512 px.
- **Usage:** atomic ledger reservations against the US$5 monthly ceiling.
- **Saves:** `ensureSave`, `reserveCopy` and `finishCopy` exist, but there is no endpoint, copier, meter or deletion worker.
- **Private APIs:** feed read, seen, hide, recheck hint, catch-up and faves. Admin status, preview, run, hide and block. Cron-secret job routes.

### Remaining features (Claude's scope)
- **Collectors** for every approved source family; VocaDB is the only live adapter.
- **Moving-media review:** GIF, MP4, HLS and embeds are all pending.
- **Full section planners**, episode-day behavior and rotations.
- **Saves:** Keep, copy, reconcile and delete workflows, plus the `/world/saves` UI.
- **Events:** the events stage, the weekly scout and lexicon refresh.
- **Merch:** collectors and the shelf.
- **Frontend:** the my faves UI and page integration.
- **Admin:** richer controls and production diagnostics.
- **Operations:** the schedule, source verification matrix and docs.

### Material differences between reports and reality
1. **Production doesn't contain the foundation.** The owner's "deployed to Production" was an environment-variable redeploy of the old commit. Every production feed check needs the owner's next push, including feed tables, feed APIs and credential use from Vercel.
2. **Credentials now exist**, but only as Sensitive values. The reports' "credentials absent" is outdated, but they still can't be exercised from this machine or through the deployed code.
3. **The HTTP helper only accepts JSON** (and still images), so RSS/Atom/XML/HTML sources, conditional GET (304) and moving-media downloads need an extension inside the same hardened helper.
4. **The voice validator's allowlist** (`voice.js`: every word must be in a small vocabulary, the facts or the lexicon) will reject most natural blurbs. Real-output measurement needs production OpenAI access; any change must keep numeric and fact grounding.
5. **The planner is the 3-slot/2-reserve demo**, and `planWrite` calls it for all five sections.

## 2. Production verification (§3 of the brief)

- **What ran against production:** everything was read-only.
  - Vercel REST API metadata: deployment, build log, environment variable names and plain values.
  - Public page, `/api/health`.
  - Anonymous 401 checks on private APIs and private media.
  - An admin login, the existing admin status (reads Neon) and the uploads config (private Blob, `presigned`).
  - All from the local machine.
- **No production artifacts** (rows, Blob objects, provider calls) were created or cleaned: the deployed revision has no feed code to host them.
- **Verification needing deployed code** is built as admin-only, bounded, redacted Production checks (`server/feeds/diagnostics.js`). It is pending the owner's deploy:
  - effective database target and migrations
  - a disposable Blob write/read/anonymous-401/delete
  - OpenAI moderation, primary, fallback and vision
  - YouTube, Tumblr and Bluesky
  - a real edition through the real provider path
- **Switches:** `FEEDS_ENABLED` was left `false`. No environment variable, budget or credential was changed.

### Update after the owner's deploy (2026-09-15, 21:17–21:35 UTC)
- **Deployment:** the owner pushed commit `3ab64dc`, deployed as `dpl_He264EJ34k4b9ShzH9bDyhxV4MFg`. The build applied migrations, passed the leak check and registered all 8 crons.
- **Production checks:** passed on Vercel (database, Blob, OpenAI, YouTube, Tumblr, Bluesky). Details and the Blob test artifact ID are in SOURCE-VERIFICATION.md.
- **Settings:** at the owner's request, `FEEDS_ENABLED=true` (Production only; Preview stays `false`) and `FEED_MAX_REQUESTS_PER_RUN=60`. They take effect from the owner's next redeploy.

### First production run (2026-09-15, 21:30–22:10 UTC, build `1e8fd438`, Singapore day 2026-09-16)
- **events:** one invocation, 81 s, 11 provider requests. 12 verified events seeded, 10 of 11 official pages accepted with verbatim dates, 1 TBC, 0 failed; scout 2 proposed and 0 verified; lexicon kept 4 of 41 candidates.
- **fetch-a:** one invocation, 115 s. All 25 enabled sources `ok` from Vercel, including Cloudflare-fronted Danbooru, Fandom and Crunchyroll.
- **fetch-b:** two invocations, 244 s (deadline checkpoint) plus 102 s. All sources `ok`, including the first live YouTube, keyed Tumblr and Bluesky login calls. About 470 candidates collected in total.
- **check: bug found.** An invocation that reached `FEED_MAX_REQUESTS_PER_RUN` swallowed `invocation_request_limit` inside `checkItem`. The rest of that invocation's items became `pending: safety_unavailable` and the queue moved past them: 101 items after 197 of 204 queue positions (71 approved, 15 rejected). The runner was stopped. Fixed locally:
  - `moderate.js` passes `invocation_request_limit` and `request_in_progress` through.
  - `check` gets one retry pass per build for queued items left `safety_unavailable`.
  - After the daily-budget stop, paid items are skipped for the day while text checks and the retry continue.
  - Tests cover all three.
- **events: bug found.** Undated scout mentions of already-dated editions ("AFA Singapore 2026") created duplicate TBC rows. The two duplicates were hidden through admin → Events. A wrongly hidden Comiket 110 row was restored. Fixed locally: `upsertEvent` skips an undated candidate that names no edition beyond the dated row's own year or number.
- **Spend so far:** US$0.038 (diagnostics US$0.0002, events US$0.029, check about US$0.009).
- **Not yet published.** The fix needs the owner's push; the same build then resumes the check (including the retry pass), plan-write and publish.

## 3. Phase log

### Phase A — Maomao, source lifecycle, saves
- **Collectors** (with the source-adapter agents; see [SOURCE-VERIFICATION.md](SOURCE-VERIFICATION.md)):
  - `danbooru-maomao`, `-vocaloid`, `-memes` (private copy, 72 h deletion honour); `sakugabooru-maomao`
  - `anilist-apothecary` (live airing data: S3 ep 1 on 2026-10-02T14:00Z)
  - `news-ann`, `news-crunchyroll`, `news-animecorner`; `news-mal` disabled by its terms
  - `fandom-apothecary`, `wikipedia-apothecary`
  - `bluesky-*` (five purposes; private copy, 24 h), `tumblr-*` (link-only, 72 h retention), `youtube-apothecary`
- **HTTP helper, extended inside the same guard:**
  - text, XML and binary responses; conditional GET (304); POST; 429 → `rate_limited`
  - precise private-range checks (192.0.2/24, 198.51.100/24 instead of /16s)
  - cross-origin redirects between listed media hosts for plain media GETs only
- **Moving media** (`motion.js`, `provider.views`, `moderate.mediaGate`):
  - GIF/WebP pages via sharp; MP4 and the lowest-bandwidth HLS rendition via ffmpeg (evenly spaced frames) into ≤2 contact sheets.
  - Moderation and vision per sheet; every sheet must pass.
  - YouTube needs recorded playback/provenance plus a moderated poster.
  - The evidence scope is recorded (`sampled-frames`, `embed-provenance+thumbnail`, …). A poster never approves a clip.
- **Planner** (`planners.js` `planMaomao`, allocation `maomao-v1`):
  - 12 slots: 8 visuals with note companions, 2 memes, 1 merch, 1 note; 20 reserve.
  - Episode-day and day-after modes come from AniList `airingAt` (Singapore date); an open exhibition leads otherwise.
  - Creator cap of 2 for visual kinds.
- **Keep, copy and deletion workflows** (`storage.js`, `maintenance.js`, routes):
  - Keep takes the item ID only and resolves source policy on the server.
  - The background copy worker checks a fresh meter, reserves 8 MiB, downloads through the source's policy, writes privately with no overwrite, verifies size, then finishes. Partial objects are deleted before any release, and 3 attempts or a permanent error mean honest link-only.
  - Reconciliation of expired leases, orphan cleanup for `saves/` only, and saved-copy rechecks at half each source's deadline (publish plus maintenance).
  - A creator deletion deletes the object, releases bytes and keeps credit.
  - One meter covers uploads and copies; upload grants return 507 when full.
- **UI (additive, existing classes):**
  - Feed slides join `LoreCarousel` before the authored slides, which stay as evergreen fallback. Discovery slips are unchanged.
  - Episode banner, progress/closing, keep and not-for-me, seen timing.
  - `/world/saves` groups songs, pictures & clips, cosplay, news & events, merch and memes, with copy state and creator-removed notes.

### Phase B — Music and meme of the day
- **Collectors:**
  - `vocadb-songs` (voicebank IDs verified; YouTube playback checks when keyed)
  - `youtube-music`, `youtube-tutorials`
  - `sekai-global` (released events from the EN master DB) and `sekai-news-global`
  - `piapro-news`, `piapro-goods`, `ann-press-vocaloid`; `siliconera-miku` disabled
  - Memes: `tumblr-memes`, `bluesky-memes`, `lemmy-memes`, `danbooru-memes`
  - The foundation `vocadb` entry keeps its registry position and contract test but is disabled as superseded.
- **Music planner** (`music-v1`):
  - 5 songs (2 new originals ≥48 h old, Miku first; classic; Rin & Len story; modern/SEKAI), 2 SEKAI, 2 notes, 2 visuals, meme, merch; 20 reserve.
  - Hard 7-day producer rule from published editions plus uniqueness within the edition.
  - A non-Miku song after a Miku-only day.
- **Meme planner** (`meme-v1`): 1 featured plus 5 reserve, general memes only, humour weights, no creator or Lemmy community twice in a row.
- **UI:** feed record sleeves play through the existing listening room (YouTube keeps the site referrer; feed images use `no-referrer`). The music page adds SEKAI/notes cards, a visuals strip and the merch line. Home gets meme of the day with "one more".

### Phase C — Dress-up, fashion and events
- **Collectors:**
  - `bluesky-cosplay`, `bluesky-fashion`, `tumblr-cosplay`, `youtube-tutorials`, `arda-wigs`, `soranews-cosplay`
  - `shootspots`: static pool verified by hand, no network, weekly rotation, 180-day staleness
  - `faves-creators`: link cards, no platform requests
  - `kamui-cosplay` and `acdcrag-looks` disabled (feed unusable; terms)
- **Dress-up planner** (`dressup-v1`): today's three (Miku, Maomao, rotating fandom with fallback), her least-recently-shown photo in plan meta, 2 process, a wishlist dare, 2 events (countdowns first), extra of the day, meme, merch, news; 20 reserve.
- **Events** (`events.js` with `events/sources.js`, registered):
  - Verified-event seed; conditional page reads with robots crawl delay; structured and grounded extraction.
  - Dates only with verbatim evidence including the year, otherwise TBC; owner-confirmed rows are never overwritten.
  - Next-edition probes; the weekly `web_search` scout (≤5 tool calls, allowed domains, Singapore location; dates re-read from an allowlisted page, with correct charset decoding); expiry.
  - Countdown milestones through `events-countdown`.
- **Lexicon refresh:** Wiktionary, a Wikipedia glossary diff and Danbooru meme tags. Filtered for crude, political and real-people terms, model-checked, then merged into `voice_lexicon`.
- **UI:** today's three plus "one of urs" as lookbook photos (references stay as the fallback when there is no three and no photos), a community list, events strip with countdowns and TBC, merch line.

### Phase D — Merch shelf
- **Collectors:** `solaris-merch` and `gsc-merch`. Prices come dated from the source with Frankfurter FX recorded and an approximate SGD figure. GSC preorder deadlines are in JST. Products merge only by check-digit-validated GTIN. Singapore shop and Taobao entries are search links only (never fetched), with the 正版 reminder.
- **Shelf planner** (`merch-shelf-v1`): up to 40 items, preorder urgency, sold-out excluded, planned including seen items. `readFeed` treats merch as a catalogue.
- **UI:** `/world/merch` with fandom/type filters; section merch lines.

### Phase E — My faves, private integration, admin
- **My faves:** a settings card with chip lists for every editable key (characters, voicebanks, SEKAI units, fandoms, eras, producers, wishlist, events with suggestions, fashion, meme formats, off-limits on top of locked defaults, creator links, merch budget and types). It uses revision compare-and-set (409 reloads) and says changes show up in tomorrow's drop.
- **Client read model** (`src/lib/feeds.js`):
  - Stable order within a revision.
  - Seen only from Kiriya's session in a visible tab: slide active ≥1.5 s on screen, or card ≥50% for 1 s, or a tap. Batched with keepalive.
  - Refetch on focus and every `revalidateAfterSeconds` while visible.
  - Non-blocking catch-up once per day after 07:00.
  - New counts on the home index. Broken images hide the entry and send a recheck hint.
  - Motion pause, reduced motion and hidden tabs respected (posters, tap to play). Tumblr GIFs never autoplay.
- **Admin panel:**
  - Production checks with redacted results.
  - Setup for all credentials and models.
  - Stage progress (attempts, duration, stats) with Run now, Rebuild today, independent stages.
  - Source health with media policy, last success and error.
  - Edition preview with score parts, companions, thumbnails, hide item/creator/source and targeted rewrite (published editions need confirmation; audit kept; saves untouched).
  - Safety counts with recent items and scope; rejected samples; hidden items with who hid them.
  - Events create/confirm/edit, lexicon editor with a 10-blurb paid preview, storage and copy states, usage (today and month).
- **Voice grounding** (replaces the over-strict allowlist): numbers, time words, claim stems and known entity names must be supported by facts, `derivedFacts` (SGD, air time, countdown days, preorder dates), tags or her listed tastes. Ordinary words are free. Tests confirm natural blurbs pass and invented numbers, claims and names fail.
- **Real blurb review:** pending. It needs the deployed OpenAI path (admin preview, rewrite and lexicon preview are built for it).

### Orchestration and limits
- **Schedule:** the final `vercel.json` keeps the existing backstop and adds fetch-a, fetch-b, check, plan-write, publish (daily), maintenance (daily 17:35 SGT) and events (weekly).
- **Chaining and catch-up:** authenticated continuations to the production domain (≤16 per build/stage) and next-stage chaining; the catch-up route returns immediately.
- **Spend control:**
  - The check stage builds a per-build priority queue: free text checks first, then each section's likeliest paid items (quotas).
  - Soft daily pacing (2 × monthly ÷ 30) sits inside the atomic monthly ceiling; paid checks stop at 70% of the day so the writer still runs.
  - Per-invocation provider requests default to 60, with cumulative per-stage caps.
- **Identity refresh:** volatile facts (scores, FX/SGD, check timestamps, price `asOf`, expiry) no longer reset safety or drop published slots; they refresh in place.
- **`FEEDS_ENABLED=manual`:** admin stage runs without cron, continuations or catch-up, for a reviewed first real edition.
- **Retention:** expired payloads are purged on expiry (Tumblr 72 h, YouTube 30 d).

### Files (feed scope)
- **Server, new:**
  - `server/feeds/{motion,planners,storage,orchestrate,maintenance,diagnostics,admin-tools,events,lexicon-sources}.js`
  - `server/feeds/events/sources.js`, `server/content/shootSpots.js`
  - `server/feeds/sources/{index,internal,util,tags,danbooru,sakugabooru,anilist,animenews,fandom,wikipedia,bluesky,tumblr,lemmy,youtube,sekai,piapro,musicnews,merch,fx,cosplaynews,fashion,shootspots}.js`
- **Server, changed:**
  - `server/feeds/{config,normalize,http,provider,moderate,rules,usage,jobs,editions,repository,saves,voice,writer}.js`, `server/feeds/sources/{registry,vocadb}.js`
  - `server/routes/feeds.js`, `server/routes/uploads.js` (capacity guard)
- **Client, new:** `src/lib/feeds.js`, `src/world/feeds/FeedPieces.{jsx,css}`, `src/world/saves/SavesPage.jsx`, `src/world/merch/MerchPage.jsx`, `src/world/settings/MyFaves.{jsx,css}`
- **Client, changed (additive):**
  - `src/world/collection/{LoreCarousel,Collections}.jsx`
  - `src/world/today/TodayPage.jsx`, `src/world/World.jsx`, `src/world/WorldShell.jsx` (mobile menu links)
  - `src/world/settings/SettingsPage.jsx`, `src/admin/FeedPanel.jsx`
  - `src/shared/WorldPrimitives.jsx` (data sources in credits)
- **Config:** `vercel.json` (crons, ffmpeg `includeFiles`); `package.json` (`@ffmpeg-installer/ffmpeg`, `@vercel/functions`, test script).
- **Tests and tools:**
  - `scripts/test-feeds-continuation.mjs`, `scripts/test-feed-sources-{anime,social,music,shop,events}.mjs`
  - `scripts/lib/feed-source-harness.mjs`, `scripts/probe-feed-sources.mjs`
  - `scripts/fixtures/feeds/**` (160 trimmed fixtures, no credentials)
  - `scripts/verify-feed-foundation.mjs` (extended browser flows)
- **Migrations:** none added. The continuation uses Codex's `0001_dry_kree` and `0002_awesome_wolfsbane` tables.
- **Unrelated parallel work:** a note-jar change (`scripts/test-note-jar.mjs`, `server/routes/noteJar.js`, TodayPage section index) appeared in the tree during this phase and was preserved. The feed test files were appended after it in `npm test`.

### Decisions recorded here
- **Maomao allocation:** 8 visual slots each with an optional note companion, plus 2 meme, 1 merch and 1 note slots = 12 slides; reserve 20.
- **Safety vs cost:** paid inspection is prioritized per build instead of by ID order, and unchecked items wait. Daily pacing prevents a single night from spending the month.
- **Fingerprint:** stable across volatile metadata. Real content changes still re-check and drop stale slots.
- **Merch:** a catalogue — seen items stay on the shelf and are excluded from section editions.
- **Tumblr compliance:** 72 h payload expiry and purge, link-only saves keeping credit and link, no inline GIF autoplay, "powered by Tumblr" in credits.
- **Admin hide/block** clears the preview, as in the foundation, so the reload never shows stale rows.
- **Foundation contract test:** kept unchanged. The superseded `vocadb` entry stays registered but disabled.

### Tests (local machine)
- **`npm test`:** 207/207. This includes the foundation's 17 feed tests unchanged; continuation 18; anime 24; social 22; music 35; shop 32; events 21; plus existing site suites and the note-jar tests.
- **`npm run verify:feeds`:** tests, build with leak check, and browser flows at 390 px and 1440 px (see SETUP.md).
- **Live local probes:** see SOURCE-VERIFICATION.md (execution location: local machine, not Vercel).

### Remaining limitations
- **Nothing is production-verified yet.** Production runs pre-foundation `09acb16`: feed tables, routes, credentials from Vercel, Vercel network access to Cloudflare-fronted sources, ffmpeg packaging, a real edition, real approved samples, real blurb review and measured spend all wait for the owner's deploy and the activation steps in [SETUP.md](SETUP.md).
- **YouTube and keyed Tumblr** have never been called live, only mock-tested from official docs.
- **Keyless Bluesky search** can intermittently return 403 (seen once and recorded as `blocked`); the login path is the upgrade.
- **Thin supply today:** news matches are sparse, Sakugabooru has no Season 3 material until airing, Tumblr Maomao is untested live, and Apothecary Diaries memes are thin. The planners reallocate, and nothing is invented.
- **Wikipedia/Fandom synopses** mentioning "death" are filtered by the existing news-drama rule (`BAD_TEXT`), reducing lore supply. This is left strict on purpose.
- **Voice grounding is lexical,** not semantic proof. Owner review of the first real edition is part of activation.
- **Owner decisions** are listed in SOURCE-VERIFICATION.md: Danbooru and Wikipedia robots readings, Tumblr's OAuth clause, the dark-producer exclusion, Fever exhibition dates.
