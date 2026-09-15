# Feed foundation contracts

Implemented contract, 2026-09-15. [PIPELINE.md](PIPELINE.md) remains the product design; [FOUNDATION-HANDOFF.md](FOUNDATION-HANDOFF.md) defines the completed boundary. Examples below are synthetic; shortened IDs represent server-generated IDs.

## Runtime schemas and exports

All implementation modules below live under `server/feeds/` and remain server-side.

| Module | Public exports / purpose |
| --- | --- |
| `config.js` | `feedConfig`, `FeedError`, `STAGES`, `SECTIONS`, `SIGNATURE`, `FOUNDATION_VERSION` |
| `taste.js` | `TasteOverridesSchema`, `ResolvedTasteSchema`, `resolveTaste`, `getTaste`, `putTaste`, `writerTaste`, `tasteRevision`, `stableJson` |
| `normalize.js` | `FeedItemSchema`, `TagsSchema`, `MediaSchema`, `SlotSchema`, `normalizeItem`, `canonicalUrl`, `digest`, `slotIds` |
| `sources/registry.js` | `SourcePageSchema`, `sourceRegistry`, `validateAdapterItem` |
| `http.js` | `sourceHttp`, `allowedUrl`, `publicAddress` |
| `repository.js` | `createBuild`, `ingestItem`, `eligibleItems`, `hideItems`, `blockItemOrigin`, `blocklist`, `creatorKey`, `setSafety`, `recordHealth`, `pruneFeeds`, `assertLease`, `fence`, `rows`, `jsonSql` |
| `rules.js`, `settings.js` | Versioned core rules; `FeedTuningSchema`, `VoiceLexiconSchema`, safe defaults, `getFeedSettings` |
| `moderate.js`, `provider.js` | `VisionSchema`, `checkItem`, `createProvider`, `createFixtureProvider` |
| `voice.js`, `writer.js` | `VOICE`, `PROMPT_VERSION`, `opener`, `validateVoice`, `voiceBudget`; `BlurbSchema`, `WriterSchema`, `writerInput`, `inspectBatch`, `templateBlurb`, `writeBlurbs` |
| `usage.js` | `DEFAULT_PRICES`, `pricesFor`, `requestEstimate`, `measuredCost`, `reserveRequest`, `settleRequest` |
| `score.js`, `editions.js` | `scoreItem`, `assembleSection`; `recentProducers`, `stageEdition`, `publishEditions`, `readFeed`, `markSeen` |
| `jobs.js` | `claimStage`, `checkpointRun`, `finishStage`, `runStage`, `nextStage`, `catchUp`, `registerEventsStage` |
| `saves.js` | `SAVE_LIMITS`, `saveSnapshot`, `ensureSave`, `reserveCopy`, `finishCopy` |

## Taste and settings

`getTaste(db)` returns `{taste, revision, overrides, invalidOverrides}`. `resolveTaste(overrides)` validates the full resolved shape. Weighted maps merge with defaults; use weight `0` to remove that preference's contribution. Supplied lists replace their editable list. Core off-limits rules are always retained; malformed overrides fall back to defaults. Weights are 0–1, maps/lists/URLs are bounded, unknown keys fail validation. `spoilers: "none"` means **no spoiler restriction**. Ships are allowed; Global/released-only SEKAI, Minecraft-only-in-memes and the empty inside-joke list are fixed.

The existing `settings` table stores:

- `taste_overrides`: `{overrides, revision}`. `putTaste(db, overrides, expectedRevision)` uses compare-and-set; stale edits return `taste_changed` (409). Each build stores its resolved taste snapshot/revision; edits apply to the next build.
- `feed_blocklist`: `{sources: string[], creators: string[]}`. Creator keys are lowercase `source:handle`, falling back to `source:credit.name`. Blocking also hides existing matching payloads/identities; it does not change taste.
- `feed_tuning`: validated rules version, moderation thresholds that can only become stricter, extra literal blocked terms, and minimum booru scores. Scoring coefficients are currently code constants; a general weights editor is not implemented.
- `voice_lexicon`: `{formats: string[], fresh: string[]}`, at most 30 entries each, with core prohibited terms rejected. Missing/malformed tuning or lexicon uses safe defaults. Editors/refresh jobs are later work.

`writerTaste` explicitly selects positive-weight characters/fandoms/voicebanks, eras, past cosplays, wishlist and off-limits topics. It never spreads the personal profile, settings rows, letters, moods, credentials or request data into a prompt.

## Normalized source items

`FeedItemSchema` is strict. Required: source slug, native ID, eligible sections, kind, title, canonical HTTPS source URL and credit. Optional/defaulted: media, tags, facts, source safety flags, publication/expiry timestamps, independent media identity. `sections` is a nonempty subset of `maomao | music | dressup | meme | merch`. Tags have arrays for `characters`, `fandoms`, `voicebanks`, `producers`, `units`, `formats`, `topics`.

Media types: `image | gif | mp4 | hls | youtube`; each has HTTPS `url`, optional dimensions/poster/alt/identity. There are at most four media entries. Facts allow up to three 600-character excerpts, bounded names/dates/prices, source score, release/event/preorder timestamps and a numeric SGD price. Facts remain source claims until source-specific verification establishes them.

Example adapter input (defaults omitted):

```json
{
  "source": "fixture",
  "nativeId": "sample-1",
  "sections": ["maomao", "dressup"],
  "kind": "lore",
  "title": "synthetic maomao note",
  "url": "https://fixtures.kiriya.invalid/sample-1",
  "credit": {"name": "foundation fixture", "platform": "local test"},
  "tags": {"characters": ["maomao"]},
  "facts": {"excerpts": ["a controlled note for testing"]},
  "safety": {"rating": "g"}
}
```

`normalizeItem` lowercases/deduplicates tags and adds:

- `id = source + ':' + sha256(nativeId).slice(0,32)`.
- Independent hashed aliases for the native identity, canonical source URL, explicit media identity and media URL where no identity is available. Tracking query parameters/fragments are removed; useful source-specific query parameters remain. A media hash must stand alone, not be concatenated with a post URL. Prefer an existing verified hash/asset ID; no blanket full-size downloading for hashing.
- A fingerprint of the normalized payload. A changed payload from the same native source resets safety/blurb to pending. Different-source reposts retain the canonical record's original credit.

`ingestItem` returns the winning canonical ID and unions section eligibility/aliases. `feed_identities` stores permanent seen/hidden flags independently of payload rows. Aliases bridge recognized reposts, including exclusions; altered/unrecognized repost detection is not guaranteed.

### Safety state is separate from placement

- `safetyStatus`: `pending → approved | rejected`; changed source data can return to `pending`.
- `visibility`: `active | hidden | gone`. Hidden/deleted/blocked items are filtered on every read, including older editions.
- Persisted `safety` holds source flags/fingerprint, rule version, inspection scope, moderation scores and validated vision evidence. `reason` explains rejection/pending/hiding. A check can update only the fingerprint it inspected; an older worker cannot approve refreshed source content.
- `checkItem` runs source rules, moderation, then still-image vision. Missing/malformed/unavailable checks stay pending. Non-still media stays `moving_review_required`; a poster does not approve the clip/GIF. Current adapters cannot publish moving media automatically.
- `VisionSchema` requires character identities, cosplay flag, meme format/humour/topics/text/fandom/politics, suggestiveness, gore/horror, quality and AI-likelihood/confidence. Uncertainty remains withheld; no claim of infallible classification.

## Adapter interface and policies

An entry returned by `sourceRegistry()` provides:

```js
{
  id, stage, enabled, fixture, sections,
  requiredCredentials, hosts, mediaHosts,
  maxRequests, maxBytes, paceMs, timeoutMs, cacheSeconds,
  attributionRequired, copyPolicy, deletionPolicy,
  fetch, recheck
}
```

`fetch(ctx)` receives `{day, cursor, deadline, signal, run, limits: {items}, credentials, http}` and returns **strict** `{items, cursor, done}`. Pages have at most eight items and cannot exceed `ctx.limits.items`. Cursor is `null`, a bounded string or a nonnegative integer; unfinished pages must advance it. Encode compound cursors into a bounded string. The runner persists `{sourceIndex,cursor}` after each page. Ingest is idempotent if a page must repeat.

Use `ctx.http.json(url)` for collection. The helper permits exact configured HTTPS hosts only, rejects private/internal DNS destinations, pins the vetted address, checks same-origin GET redirects, bounds bytes/types/time, paces calls and retries once with `Retry-After`. Requests share per-source limits across pages within an invocation. `http.image(url)` is for bounded still-image inspection, not the future 8 MiB copy worker. Health records `ok`, `not_configured`, `blocked` or `failed`; missing credentials and blocked access are never successful empty fetches. A source failure preserves successful collection from other sources. Last health counters describe the most recent page/attempt; aggregate paid usage is in `feed_usage`.

The foundation registry has a guarded local fixture source or the adapted existing VocaDB source. VocaDB is keyless, credited, link-only and still needs cloud/playback/source-policy verification. This phase adds no other live collector.

`recheck(item, ctx)` returns `{state: 'present'|'removed'|'restricted'|'transient', scope}`. Publication invokes it when the source's deletion policy requires it. Confirmed removal hides the payload; restricted/transient responses do not assert deletion and leave publication pending. A browser error merely records a recheck hint. Claude must implement scheduled deletion reconciliation and policy-specific deadlines.

No source gets private-copy permission merely because its media is reachable. Policy verification needs an explicit documented basis, source URL, date and the relevant creator/source conditions. Cache TTL, expiry/deletion handling and attribution remain adapter obligations.

## Scoring, slots, editions and seen state

`scoreItem(item,taste,{day,section,...})` returns `{score,parts,tie}` using `0.45*taste + 0.20*freshness + 0.20*quality + 0.15*variety + boosts - penalties`. It supports the documented wishlist/moment/merch/event hints; date/section/ID ties are deterministic. `assembleSection` demonstrates three slots plus two reserves and hard producer exclusion, not the final section planner. `recentProducers` includes primaries/companions/reserves in published editions in the seven-day window. Pass its result to every music selection; sparse supply does not loosen safety or producer rules.

`SlotSchema`:

```json
{"key":"maomao-0","primaryId":"fixture:visual-id","companionIds":["fixture:note-id"]}
```

One canonical item can qualify for multiple sections; editions own its placement. `stageEdition(db,build,section,plan,blurbs,run)` expects `{slots,reserve,selected}`; each selected entry contains `{item,score,parts}`. Every referenced item needs a validated non-skipped blurb and a selected-item fingerprint. Blurbs/scores/fingerprints are frozen in edition metadata; the item-level blurb is only a history cache. `publishEditions` re-filters eligibility/fingerprints and changes ready nonempty sections to published in one SQL statement. Reads also exclude content whose fingerprint changed. Empty sections retain their previous published revision.

`feed_builds` holds day, generation, mode, taste snapshot/revision and state. `feed_editions` has `(buildId,section)` identity, ordered slots/reserves, staged/published state, revision (`build UUID:section`) and publication time. A forced rebuild allocates a new generation and invalidates earlier workers without exposing its staged rows.

Read result, abbreviated:

```json
{
  "section":"maomao", "day":"2026-09-15", "editionDay":"2026-09-15",
  "revision":"build-uuid:maomao", "tasteRevision":"taste-hash",
  "publishedAt":"2026-09-14T22:10:00.000Z",
  "slots":[{"key":"maomao-0","primaryId":"fixture:visual-id","companionIds":[],
    "primary":{"id":"fixture:visual-id","title":"synthetic maomao note",
      "url":"https://fixtures.kiriya.invalid/sample-1","credit":{"name":"foundation fixture","platform":"local test"},
      "media":[],"blurb":{"headline":"synthetic maomao note","text":"synthetic maomao note. worth a look.","cta":"read"},
      "signature":"✦ kiriya.love","fixture":true},"companions":[]}],
  "reserve":[], "seenEarlier":[], "counts":{"new":1,"seenEarlier":0},
  "nextRefreshAt":"2026-09-15T16:00:00.000Z", "revalidateAfterSeconds":60
}
```

No published edition returns `revision:null`, empty arrays/counts and the same refresh hints. The future UI must keep authored fallback slides and revalidate on visit/focus and roughly every 60 seconds while open; waiting only for midnight misses morning publication. Promote the ordered reserve as main slots are consumed. Do not put external item IDs on deliberately recurring personal/authored slides.

`markSeen` validates revision membership and current eligibility server-side. The future client marks the visual after it is actually active/visible, and a companion note only once the note is visible or tapped; do not mark both just because the page fetched them. A partly seen composite is in `seenEarlier`, retaining its unconsumed companion. Prior-day seen content is excluded; same-day seen content can be revisited in that group. Admin preview makes no seen/hide history mutation through Kiriya's endpoints. Owner hide/block routes are explicit actions.

Retention: unshown payloads 14 days, rejected payloads 30 days, seen payloads/editions 90 days; old provider result bodies are cleared after 90 days while accounting remains. Permanent aliases and save snapshots survive. Cleanup never deletes identity exclusions.

## Durable jobs and usage

Order: `fetch-a → fetch-b → check → plan-write → publish`. `registerEventsStage(handler)` is an explicit once-only future extension; without one, events returns `not_implemented`.

`claimStage(db,build,stage)` atomically claims a `(buildId,stage)` row after its predecessor is `done`. A claimed run is `{buildId,stage,token,checkpoint,stats}`. Lease expiry defaults to 300 seconds; work checkpoints before 270 seconds. State transitions: `pending/failed/paused → running → done | pending | failed | paused`. Expired/null leases can be reclaimed. Every consequential worker write checks the token, lease expiry, running status and current generation. `finishStage` returns false for a stale worker.

Checkpoint shapes: collection `{sourceIndex,cursor}`, safety `{after:itemId}`, plan/write `{sectionIndex}`, publish `{recheckIndex}`. Public outcomes include `completed`, `checkpointed`, `in_progress`, `waiting_for_dependency`, `superseded`, `paused_for_budget` (with a specific reason), `failed`, `disabled`, `not_implemented`. Reinvoke the same stage/build to resume. A completed duplicate is a no-op. Source ordering must remain stable within a build.

`catchUp` uses the same runner after 07:00 Singapore and a durable five-minute throttle. It advances one pending stage per call; it is synchronous and bounded. Claude wires the private-page POST trigger. It is not a queue or unlimited background task.

Provider settings: Luna by default, the configured mini snapshot for one retry, reasoning `none`, strict JSON Schema, `store:false`, 24 KB bounded text input and 2,400 output tokens. Still images are bounded and resized to ≤512px. Luna alone gets explicit cache controls. Blurbs have required `id`, `skip`, `skipReason`, `headline` ≤60, `text` ≤200, CTA enum and `drawPrompt`. The signature is outside model text. Unsupported IDs/facts/wording, repetitions and voice budgets cause a retry, grounded template or skip; templates require approved content too. Grounding is conservative lexical/numeric validation, not semantic proof.

`reserveRequest` atomically reserves a conservative microdollar estimate against the Singapore calendar month's ceiling before sending. Per-stage/build request counts also include free moderation and retries. `settleRequest` reconciles actual input/output/cache-read/cache-write/search usage once. Unknown/time-out outcomes keep the reservation. Completed successes or recorded provider errors are reused on resume, avoiding a duplicate charge for that request key; an uncertain response blocks that request. A higher permitted budget allows a denied reservation to retry. Do not delete uncertain ledger rows to manufacture capacity.

`feed_usage` links requests to build/stage/purpose/model, stores prices/usage/reserved and charged amounts, and keeps a private response envelope. `feed_budgets` is the aggregate guard. Admin returns accounting without provider result bodies or lease tokens. Search-cost support is accounting only; no search tool call exists yet. This ceiling covers this feed provider path, not the old daily writer, other apps, or source API/hosting fees.

## Private API

All routes use the existing signed session and `Cache-Control: private, no-store`. Cookie-authenticated writes require the existing `x-kw: 1` header. Bodies are strict, bounded JSON. Typical errors are `{error, message}` with 400/401/403/404/409/413/503 status; expected runner outcomes are JSON with HTTP 200. Admin can read/preview private data but does not simulate Kiriya's activity.

| Method / path | Body or result |
| --- | --- |
| `GET /api/me/feed/:section` | Private read result above |
| `POST /api/me/feed/seen` | `{revision,ids}`; 1–50 IDs → `{marked}`; admin → `{marked:[],preview:true}` |
| `POST /api/me/feed/hide` | `{id}` → `{hidden}`; admin preview is a no-op |
| `POST /api/me/feed/recheck` | `{id}` → `{outcome:"recheck_requested"}`; hint only |
| `POST /api/me/feed/catchup` | Next-stage outcome; admin → `preview` |
| `GET /api/me/faves` | Resolved taste/overrides/revision plus `applies:"next_build"` |
| `PUT /api/me/faves` | Kiriya only: `{overrides,expectedRevision}` → next resolved taste; stale revision 409 |
| `GET /api/admin/feeds/status` | Setup booleans, registry, health, builds/runs, rejection reasons, recent items, budget/usage |
| `GET /api/admin/feeds/preview/:build/:section` | Staged or published private preview, no seen writes |
| `POST /api/admin/feeds/run` | `{stage?,buildId?,force?,fixture?}` → runner outcome; omit stage to advance one; force without buildId creates a revision |
| `POST /api/admin/feeds/hide` | `{id}` → `{hidden}` |
| `POST /api/admin/feeds/block` | `{id,type:"source"|"creator"}` → `{blocked:true}` |
| `GET /api/jobs/feeds/:stage` | Requires `Authorization: Bearer <CRON_SECRET>`; disabled unless live switch is on |

There are **no saves, merch or events CRUD routes** in this phase. Do not make a future UI treat missing functionality as a successful save.

## Save-copy continuation contract

Future Keep request: **item ID only**. Resolve the canonical approved item, source policy, media and attribution on the server. Never accept an arbitrary client fetch URL or a claimed license. `ensureSave` is canonical-ID idempotent; snapshots/credit/source references outlive feed cleanup. Metadata lives in Neon; binary media never does.

`saveSnapshot` defaults to `copyState:'link_only'`. A source with `copyPolicy:'private_copy'` also needs `copyPermission:{basis,sourceUrl,verifiedAt}`. One eligible media asset may become `copyPolicy:'kept',copyState:'pending'`; YouTube/HLS stay link-only. The policy fields record a verified decision; their presence is not itself legal permission.

`reserveCopy(db,saveId,bytes)` requires a fresh `feed_storage` measurement and atomically reserves against 8 MiB/item, 500 MiB saved copies, 1 GB total store capacity with 50 MiB headroom. Warn at 400 MiB. It returns `{outcome:'reserved',token,bytes}` or a link-only/busy/limit outcome. Rows track attempts, lease/token, bytes, errors, removal and last check times.

Later worker flow:

1. Resolve approved ID/policy; verify source metadata/type/length through the hardened host/DNS policy. Reserve a safe bounded byte count before copying.
2. Fetch server-side with a byte cap; privately write to an idempotent `saves/<safe-name>` path using existing Blob authentication. Do not proxy an 8 MiB request body through a Vercel function.
3. On success call `finishCopy(...,{pathname,bytes,contentType})`. It checks token, allowed path/type and reserved size; duplicate completion cannot charge twice.
4. On failure delete partial/orphan objects, then call `finishCopy(...,{cleanedUp:true})`. Do not release a reservation merely because its worker timed out; reconcile the object first. Expired leases/retries/deletion reconciliation are Claude's worker responsibilities.
5. Creator deletion can require removal of the copied Blob while retaining credit/source metadata and a removal state. Implement atomic accounting release after confirmed deletion.

The storage meter/cleanup worker and coordination with personal uploads are still required; current helpers cannot police out-of-band store writes. Delivery is `/api/uploads/media?path=saves%2F<name>` through the existing authenticated streaming route, even if a public-photo setting were to reference it. Client upload grants and public-photo URL validation exclude the `saves/` namespace.

---

# Continuation contracts (Claude, 2026-09-15)

The sections below extend the foundation contract. Where they differ from the text above, they win.

## Source adapter authoring

### Files and wiring
- **One module per source family** in `server/feeds/sources/<family>.js`. It exports one or more plain entry objects, one per purpose, e.g. `danbooruMaomao`, `danbooruVocaloid`, `danbooruMemes`.
- **No imports** of `sources/registry.js` or `sources/index.js` from an adapter; that would be circular.
- **Wiring:** `sources/index.js` lists live entries in stable order and `registry.js` validates each with `defineSource`. Append new entries; reordering invalidates checkpoints for builds already in flight.
- **Shared helpers:**
  - `sources/util.js`: `stripHtml`, `decodeEntities`, `clip`, `feedEntries` (RSS/Atom/RDF), `jsonLd`, `metaContent`, `firstImage`, `toIso`, `cursor.encode/decode`, `asArray`, `nodeText`.
  - `sources/tags.js`: canonical characters, voicebanks, units and fandoms; `ERAS`, `MERCH_TYPES`, `MEME_FORMATS`, `COSPLAY_FORMATS`, `FASHION_STYLES`; `mentions()`.
  - Tags must match taste keys exactly. Unknown names are dropped, never invented.

### Entry fields (`defineSource` validates)

| Field | Meaning |
| --- | --- |
| `id` | Lowercase slug, unique per purpose (`bluesky-cosplay`) |
| `stage` | `fetch-a` keyless/fast; `fetch-b` credentialed, paced or slow |
| `status` / `enabled` | `enabled`, `optional` (works, lower priority), `restricted` (blocked or needs approval), `unavailable`. `enabled:false` means it is never collected |
| `sections` | Sections this entry may contribute to |
| `hosts`, `mediaHosts`, `linkHosts`, `profileHosts` | **Exact** hostnames. Item URLs, media/posters, `facts.links` and credit profile URLs are validated against them |
| `requiredCredentials`, `optionalCredentials` | Environment variable names. A missing required one makes health `not_configured`; optional ones are passed only when present |
| `maxRequests`, `maxBytes`, `paceMs`, `timeoutMs` | Per-invocation bounds enforced by `sourceHttp` (`maxBytes` ≤ 2 MB for JSON/text) |
| `cacheSeconds` | Freshness/cache rule from the source's terms |
| `mediaPolicy` | `still_only` (images only), `moving_sampled` (gif/mp4/hls, frames sampled before approval), `embed_provenance` (YouTube embeds with recorded playback/provenance checks), `link_only` (no media shown) |
| `copyPolicy`, `copyPermission` | `private_copy` needs `{basis, sourceUrl, verifiedAt}` from a live review of the source's terms plus the owner's decision (PIPELINE §10/§19). A caching/storage restriction means `link_only` |
| `deletionPolicy`, `deletionDeadlineHours` | `honor_deletions` (with a deadline), `recheck_before_publish`, `none`. Anything other than `none` needs `recheck` |
| `termsUrl`, `docsUrl`, `notes` | Primary-source references used in `SOURCE-VERIFICATION.md` |
| `fetch`, `recheck` | See below |

### `fetch(ctx)`
- **Context:** `{day, cursor, deadline, signal, run, limits:{items}, credentials, http}`. `day` is the Singapore date.
- **Return:** `{items, cursor, done}`, with at most `min(8, limits.items)` items. An unfinished page must advance the cursor; use `cursor.encode` for compound state.
- **Network:** only through `ctx.http`:
  - `json(url, opts)` → parsed JSON
  - `text(url, {types})` → `{text, headers, notModified}`
  - `xml(url)` → `{doc, headers}`
  - `image(url)` → still images ≤ 4 MiB
  - `binary(url, {types, maxBytes})` → ≤ 8 MiB
  - `opts.allowNotModified` with `If-None-Match` / `If-Modified-Since` headers returns `{notModified:true}` on 304
  - `request(url, {method:"POST", body, headers})` for APIs that require POST
  - Never use global `fetch`.
- **Credentials:** only in the request headers or query parameters the provider requires. Never in item fields, cursors, thrown messages or logs.
- **Failures:** don't turn blocked, rate-limited or failed access into an empty successful page. Let the helper's `FeedError` (`blocked`, `not_found`, `rate_limited`, `source_unavailable`, `deadline`…) propagate so health records it. Ineligible objects (non-general rating, NSFW flag, deleted, off-topic) may be skipped early to save requests.

### Item content rules
- **Identity:** `nativeId` is stable per source object. `url` is the canonical HTTPS post/page. `mediaIdentity` is a provided hash or asset ID (Danbooru md5, Bluesky blob CID), never a downloaded hash.
- **`credit`:** the original creator when the source states one (artist tag, account, blog, channel, outlet), plus `platform` and `license` text when stated.
- **`media`:** direct media on `mediaHosts` only. Type `image|gif|mp4|hls|youtube`, with dimensions, `duration`, `bytes` and `poster` when known. Omit media that fail the host policy; never rehost.
- **`tags`:** canonical helpers only. Eras use `ERAS` strings, merch uses `MERCH_TYPES`, memes `MEME_FORMATS`, cosplay `COSPLAY_FORMATS`, fashion `FASHION_STYLES`.
- **`facts`:**
  - `excerpts`: plain verbatim source text (≤3 × 600 chars). `names`/`dates`/`prices`: exact source strings.
  - `sourceScore`: numeric popularity.
  - Instants: `releaseAt`, `eventAt`/`eventEndAt`, `airingAt`, `preorderUntil`, each with `releasePrecision`/`datePrecision`.
  - Merch: `links` (validated hosts), `priceOriginal` + `fx` + `sgd`, `availability` + `availabilityCheckedAt`.
  - YouTube: `playback`. Japanese text: `lang:"ja"`.
- **`safety`:** pass through source signals: `rating`, `labels`, `sourceTags`, `nsfw`, `deleted`, `removed`, `communityNsfw`. Decisions live in `rules.js`/`moderate.js`.
- **`expiresAt`:** required when a rule demands it: Tumblr ≤ 72 h after fetch, YouTube API metadata ≤ 30 days, merch price/availability ≤ 48 h, events at their end.

### `recheck(item, ctx)`
- Returns `{state: present|removed|restricted|transient, scope}` from a minimal request confirming the object still exists and is still eligible.
- Only a confirmed removal returns `removed`. `restricted`/`transient` never assert deletion.

### Tests and probes
- **Tests:** `scripts/test-feed-sources-<group>.mjs` (`node:test`) uses `scripts/lib/feed-source-harness.mjs` (`runAdapterPage`, `runAdapterAll`). It runs the real `sourceHttp` through a recorded-fixture transport, so an unrecorded request fails.
- **Fixtures:** `scripts/fixtures/feeds/<entry-or-family>/`, trimmed real responses with no credentials or private data, ≤200 KB each.
- **Live probes:** `node scripts/probe-feed-sources.mjs --module <path> --export <name> --pages 1` is local-only and bounded. It writes a private record to `.data/feed-probes/` and never prints credentials. Keyed sources report `not_configured_locally` because Vercel Sensitive values can't be read here.

## Modules added or changed

| Module | Exports / purpose |
| --- | --- |
| `config.js` | Adds `INDEPENDENT_STAGES` (`events`, `maintenance`, `diagnostics`, `admin-tools`). `feedConfig()` adds `stageRequestCaps`, `workLimits`, `maxContinuations` (16), `diagnosticsAllowanceMicros` (US$0.50), `dailyLimitMicros` (2 × monthly ÷ 30), `checkDailyShare` (0.7), `checkQuotas` |
| `normalize.js` | Adds `FactsSchema` (links, dated `priceOriginal`/`fx`, availability, precision fields, episode/airing, event ids/venue, `playback`, `lang`), `LINK_KINDS`, `SLOT_TYPES` (slots may carry `type`/`hook`), `VOLATILE_FACTS`, `stableProjection` |
| `http.js` | `text`, `xml`, `binary`, conditional requests (`allowNotModified` → `{notModified:true}`), POST `request`, 429 → `rate_limited` |
| `sources/registry.js`, `sources/index.js` | `BASE_POLICY`, `defineSource` (policy validation), `LIVE_ADAPTERS` |
| `sources/internal.js` | `eventMilestones`, `fetchEventCountdowns`, `fetchFavesCreators`, entries `eventsCountdown`, `favesCreators` (read Neon, `internal:true`) |
| `motion.js` | `MOTION_LIMITS`, `evenlySpaced`, `ffmpegBinary`, `contactSheets`, `sampleAnimatedImage`, `sampleVideoFile`, `parsePlaylist`, `sampleHls`, `sampleMotion` |
| `provider.js` | `views(item)`; `moderate(item, viewIndex)`, `vision(item, index)`, `classifyText`, `extract`, `search` (web search, ≤5 tool calls), `probe`, `moderateText` |
| `moderate.js` | `mediaGate(item, source, now)`; `checkItem(item, provider, {blocklist, tuning, source})` records `evidence.scope`, per-view moderation/vision, `eligibleSections`, `characters` |
| `planners.js` | `QUOTAS`, `inSection`, `episodeState`, `planMaomao`, `planMusic`, `rotatingFandom`, `planDressup`, `planMeme`, `planMerch`, `PLANNERS` |
| `voice.js`, `writer.js` | `PROMPT_VERSION "bestie-2"`; claim/entity/number/time grounding in `validateVoice(blurb, item, {derived, tasteNames, …})`; `derivedFacts(item, day, hint)` |
| `editions.js` | `deletionFresh(now, adapters)`; `publishEditions(…, {withheld})`; read results add `plan`, item `source`/`tags`/`publishedAt` |
| `saves.js` | `saveSnapshot` records `nativeId` and `tags`; `savesSummary(db, {days})` (counts only, for the writer) |
| `storage.js` | `COPY_TYPES`, `MAX_COPY_ATTEMPTS`, `blobOps`, `measureStorage`, `uploadCapacity`, `storageStatus`, `copySave`, `reconcileCopies`, `cleanupOrphans`, `recheckSavedCopies`, `deleteSave` |
| `usage.js` | `spentToday(db, now)`; `reserveRequest` adds soft daily pacing |
| `jobs.js` | `registerStage`, `checkQueue`, `claimCatchUp`, `RECHECK_REQUESTS` |
| `orchestrate.js` | `background`, `continuationBase`, `claimContinuation`, `requestContinuation`, `afterStage` |
| `maintenance.js` | `MAINTENANCE_STEPS`, `runMaintenance` (registered stage) |
| `events.js`, `events/sources.js`, `lexicon-sources.js` | `upsertEvent`, `eventId`, `seedVerifiedEvents`, `runEvents` (registered); `EVENT_SOURCES`, `readEventPage`, `verbatimDateEvidence`, `probeNextEdition`, `eventHttpPolicy`, `fetchPageText`; `fetchLexiconCandidates`, `filterLexiconTerms`, `lexiconSourceEntry` |
| `diagnostics.js` | `DIAGNOSTIC_CHECKS`, `databaseTargets`, `runDiagnostics` (registered stage) |
| `admin-tools.js` | `withAdminRun`, `rewriteBlurb`, `previewLexicon` |

## Identity refresh (supersedes the fingerprint note above)

- **Stable fingerprint:** `fingerprint = sha256(stableJson(stableProjection(item)))`. The projection drops volatile source metadata: `facts.sourceScore`, `facts.sgd`, `facts.fx`, `facts.availabilityCheckedAt`, `facts.playback.checkedAt`, `facts.priceOriginal.asOf` and `expiresAt`.
- **Re-fetch with an unchanged fingerprint:** `ingestItem` refreshes `facts` and `expires_at` in place. Safety, the blurb cache and edition membership are kept.
- **Any other change** (title, media, tags, availability, playback flags, price amount) resets safety to `pending`. It also drops the item from staged or published editions that froze the old fingerprint.

## Moving media and inspection scope

| `mediaPolicy` | Media it may carry | Before approval |
| --- | --- | --- |
| `still_only` | `image` | Moderation + vision per image |
| `moving_sampled` | `image`, `gif`, `mp4`, `hls` | `sampleMotion`: evenly spaced frames (GIF/WebP pages via sharp; MP4 and the lowest-bandwidth HLS rendition via ffmpeg, 4 segments × 2 frames), tiled into ≤2 contact sheets of 2×2 at 512 px. Moderation + vision per sheet; every sheet must pass. Encrypted HLS, >15 min, >8 MiB or decode failure stays pending |
| `embed_provenance` | `youtube` | `mediaGate` needs `facts.playback` with `embeddable`, SG `regionOk`, not `ageRestricted`, provenance `official_channel`/`vocadb_original`, checked ≤7 days ago, plus a poster. The poster is moderated and vision-checked; the video itself is not inspected |
| `link_only` | none | Text moderation only |

- **Recorded `evidence.scope`:** `text`, `still-images`, `sampled-frames`, `embed-provenance+thumbnail`, `text-classification` (text memes) or `unreviewed-moving-media`. Sampling is not proof that every frame is safe; the admin panel shows the scope for each item.
- **Other gate results:** a policy mismatch stays `pending: moving_review_required`. A visual in `maomao` must show Maomao (`evidence.eligibleSections`), and a visual in `music` must show a listed voicebank.

## Check queue and spend pacing

- **Queue:** the `check` stage builds a per-build queue once (`checkpoint {queue, position}`).
  - Text-only items (free moderation) come first.
  - Then paid items (media or memes): each section's top `checkQuotas[section]` by `scoreItem`, interleaved across sections.
  - Unqueued items stay `pending` for later builds; retention prunes them.
- **Daily pacing:** `reserveRequest` refuses a pipeline request (`paused_for_budget`) once today's Singapore-day spend plus the estimate exceeds `dailyLimitMicros`. Diagnostics and `admin-tools` are exempt but stay inside the atomic monthly ceiling.
- **Early finish:** paid checks stop at `checkDailyShare` of the daily limit, and `check` finishes as done (`stats.stoppedForDailyBudget`). Today's plan uses what is already approved.
- **Invocation limits:** `FEED_MAX_REQUESTS_PER_RUN` (default 60, max 120) bounds provider requests per invocation. `stageRequestCaps` bounds each build/stage cumulatively (check 720, plan-write 90, events 40, maintenance 80, diagnostics 8, admin-tools 40). `invocation_request_limit` checkpoints; `request_limit` pauses.

## Section planners (recorded allocation)

The primary/companion contract is unchanged. `plan.meta.allocation` names the version.

| Section | Slots | Reserve | Rules |
| --- | --- | --- | --- |
| `maomao` (`maomao-v1`) | 12: 8 visuals each paired with a note companion when one exists, 2 memes, 1 merch (with media), 1 note | 20 | ≤2 cosplay and ≤1 video visual; ≥2 clips preferred. **Episode day** (Singapore date of AniList `airingAt`): slot 1 is the episode note (`hook episode_tonight`). **Day after:** up to 3 episode-related visuals first (`episode_reactions`). An open exhibition leads otherwise (`exhibition_open`). Empty categories reallocate to visuals/notes |
| `music` (`music-v1`) | ≈13: 5 songs (2 new originals ≤14 days, preferring ≥48 h old, Miku first; a classic; a Rin & Len story song; a modern hit or SEKAI song), 2 SEKAI, 2 notes, 2 visuals, 1 meme, 1 merch | 20 | Hard 7-day producer exclusion from published editions plus within-edition uniqueness. A non-Miku song is guaranteed when yesterday had none |
| `dressup` (`dressup-v1`) | ≈12: today's three (Miku, Maomao, the rotating fandom that has an approved candidate), 2 process, 1 dare (wishlist match), 2 events (countdowns first), 1 extra (look/spot/wig/scene by day), meme, merch, news | 20 | `plan.meta.personal` = her least-recently-shown cosplay photo `{photoId, character, series, note, coverUrl}` (private upload reference, never an item ID). `rotatingFandom` is set in meta |
| `meme` (`meme-v1`) | 1 featured | 5 | General memes only (not maomao/music); humour weights; no creator or Lemmy community twice in a row |
| `merch` (`merch-shelf-v1`) | up to 40 | – | Planned **including seen items**; sold-out excluded; preorder urgency, taste and budget fit. `readFeed` treats merch as a catalogue: seen items stay in `slots`, no closing text |

- **Creator cap:** at most 2 items per creator applies to image, clip, cosplay, meme and look kinds only.
- **Writer hints per item:** `hook`, `why`, `derived` (e.g. `daysUntil`, `episode`), `pairedWith`, `slotType`.

## Voice grounding (supersedes the allowlist)

- **Free vocabulary:** ordinary words are allowed.
- **Must be supported:** numbers, time words (`today`, `tonight`, `this weekend`, …), claim stems (`announc`, `releas`, `preorder`, `exhibition`, `episode`, `sold out`, …) and known character/fandom/unit names. Support comes from the item's title, credit, excerpts, names, dates, prices, venue/city, tags, `derivedFacts` values, the reader's listed tastes (`tasteNames`) or the lexicon.
- **Rejection reasons:** `voice_off_limits`, `taste_off_limits`, `repeated_opener`, `unsupported_number`, `unsupported_claim`, `unsupported_entity`. Fallbacks and prompts are unchanged; the signature is outside the text.

## Read model additions

- **Item fields:** `readFeed` items add `source`, `tags` (characters, fandoms, formats, voicebanks) and `publishedAt`.
- **Plan:** the result adds `plan` (the edition's planner meta).
- **Closing text:** `"that's literally everything. go touch grass. or don't, i'm a website."` when nothing unseen remains (not for merch).
- **Deletion deadlines:** items from `honor_deletions` sources are hidden on read once their last successful recheck (`safety.recheckedAt`, else `fetchedAt`) is older than `deletionDeadlineHours`.

## Saves, storage and copies

| Method / path | Behaviour |
| --- | --- |
| `GET /api/me/saves` | `{saves: presentSave[], storage: {warning}}`, newest first (≤300) |
| `GET /api/me/saves/:id` | One save |
| `POST /api/me/saves` | Kiriya only, `{id}` (approved item ID). `ensureSave` then background `copySave`. → `{save, copy: "copying_in_background" \| state}`. Admin → `{preview:true, saved:false}` |
| `DELETE /api/me/saves/:id` | Kiriya only. Deletes the object first, then accounting and the row. 409 `copy_in_progress` while copying |

- **`presentSave`:** `{id, itemId, kind, sections, title, url, credit, blurb, facts, media, copy: {url, contentType, bytes} | null, copyState, removed, removedReason, createdAt, signature}`. `copy.url` is the authenticated `/api/uploads/media?path=saves%2F…` route. `blobPath` is never exposed. A removed save has no media.
- **`copySave`:**
  1. Checks the permission policy, the eligible media type and a fresh meter (re-measured when older than 24 h).
  2. Reserves 8 MiB, then downloads through the source's hardened HTTP policy.
  3. Writes `saves/<saveId>-<sha16>.<ext>` privately with no overwrite, and verifies size with `head`.
  4. Finishes with `finishCopy`.
  - Any failure deletes the partial object before releasing the reservation. If cleanup can't be confirmed, the reservation is kept (`reconcile_later`).
  - Three attempts, or a permanent error (`blocked`, `not_found`, wrong type, too large), make the save `link_only`.
- **`reconcileCopies`:** for an expired `copying` lease, lists `saves/<id>-`. It completes from a stored object of valid size, or deletes and releases.
- **`cleanupOrphans`:** deletes `saves/` objects older than 1 h that no row references and no copy in progress owns. Other prefixes are never touched.
- **`recheckSavedCopies`:** runs at half of each source's deletion deadline, in publish and in maintenance. `removed` deletes the object and releases its bytes, and sets `copy_state='removed'`, `removed_at` and `copy_error` (`creator_removed`/`source_labels`). Title and credit remain.
- **Shared meter:** `measureStorage` lists the whole private store (personal uploads plus copies). `uploadCapacity(bytes)` refuses an upload grant (HTTP 507 `storage_full`) when a meter less than 24 h old projects above 1 GB minus 50 MiB headroom. An unmeasured or stale meter allows uploads.

## Orchestration

- **Cron route:** `GET /api/jobs/feeds/:stage` (cron bearer; `disabled` unless `FEEDS_ENABLED=true`) runs one stage, then `afterStage` in the background.
- **Continuation route:** `POST /api/jobs/feeds/:stage/continue` (cron bearer, `{buildId}`, same Singapore day) acknowledges `202` and runs in the same invocation's lifetime via `waitUntil`.
- **Chaining:** `afterStage` continues a checkpointed stage or requests the next stage after `completed`. It is capped at `maxContinuations` per build/stage and targets only the production domain (`VERCEL_PROJECT_PRODUCTION_URL`). Local development continues against the localhost site URL; previews never continue themselves.
- **Durable state wins:** a lost continuation waits for the next cron hour or catch-up.
- **Catch-up:** `POST /api/me/feed/catchup` performs the throttled claim only and returns `{outcome:"scheduled", stage}` immediately. The stage runs in the background. The client sends it at most once per Singapore day per tab, after 07:00, when the edition is missing or from an earlier day.
- **Independent stages:** `registerStage(name, handler)` registers them. They need no predecessor and run while the pipeline is otherwise off only for `diagnostics`.
  - **`maintenance`** (daily): meter → reconcile → orphans → ≤10 pending copies → saved-copy rechecks → retention.
  - **`events`** (weekly): seed verified events → conditional page reads with grounded extraction → next-edition probes → web-search scout (≤5 tool calls, allowed domains, Singapore location; dates re-read from an allowlisted page) → lexicon refresh (filtered and model-checked) → expiry.
- **Publish:** rechecks each item once per invocation with one paced connection per source (`RECHECK_REQUESTS` budget). A `restricted`/`transient` result withholds only that item's slots.

## Admin additions

| Method / path | Behaviour |
| --- | --- |
| `GET /api/admin/feeds/status` | Adds setup booleans (YouTube, Tumblr, Bluesky, cron), models, requests per invocation, diagnostics results, maintenance/events checkpoints, safety counts, recent items with `scope`, events, `hidden` (with `hiddenBy`), lexicon and storage |
| `GET /api/admin/feeds/preview/:build/:section` | Adds `buildId`, `editionState`, `scores` (score parts per item) and `rewrites` |
| `POST /api/admin/feeds/run` | Also accepts `stage: "events" \| "maintenance"` |
| `POST /api/admin/feeds/diagnostics` | `{checks?}` → 202 `scheduled`, or `rate_limited` within 10 min. The background run records redacted results in the diagnostics checkpoint |
| `POST /api/admin/feeds/rewrite` | `{buildId, section, id, published}`. A staged edition is rewritten in place; a published one needs `published:true`, with the previous text kept in `meta.rewrites`. Saves never change |
| `PUT /api/admin/feeds/lexicon`, `POST /api/admin/feeds/lexicon/preview` | Save a lexicon, or write 10 sample blurbs with a proposed one (paid, nothing saved) |
| `POST /api/admin/feeds/events` | Owner create/confirm/edit `{id?, name, url, startsOn, endsOn, venue, city, country, tier, status, hers}` → `owner_confirmed` when dated |
| `GET /api/admin/feeds/saves` | Storage status plus copy state per save |

- **Diagnostics checks** (admin only, bounded, redacted, no published-edition writes):
  - **database:** effective variable, same host/database/Neon endpoint as booleans, host fingerprint, applied vs tracked migrations, feed tables.
  - **blob:** put/read/anonymous-401/delete of `saves/diagnostic-<day>-<nonce>.png`.
  - **openai:** moderation, primary, fallback and a vision probe, within US$0.50 per month of diagnostic spend.
  - **youtube:** 2 quota units, including embeddable and SG-region evaluation.
  - **tumblr:** one tagged request.
  - **bluesky:** app-password session plus one search; no writes.

## Frontend read models (additive UI)

- **`src/lib/feeds.js`:**
  - `useFeed(section)`: private read, refetch on focus and every `revalidateAfterSeconds` while visible, background catch-up trigger.
  - `useFeedEntries(feed)`: stable order within a revision (unseen, reserve, seen-earlier on arrival; positions kept while open).
  - `useMarkSeen(section, revision)`: Kiriya's session only, visible tab, batched ≤50, `keepalive` on page hide.
  - `useSeenOnView(ref, cb)`: ≥50% on screen for 1 s.
  - `useKeep`, `useKept`, `useHide`, `useReportGone`.
  - Formatting helpers: `sgDate`, `sgTime`, `daysUntil`, `approxSgd`, `originalPrice`, `creditLine`, `youtubeSong`.
- **`src/world/feeds/FeedPieces.jsx`** (existing classes; new `feed-*` layout classes only): `useSectionFeed`, `FeedMedia`, `FeedByline`, `FeedLinks`, `FeedFacts`, `FeedActions`, `FeedViewer`, `FeedCard` (note-slip), `FeedPhoto` (lookbook-photo), `FeedSleeve` (record-sleeve), `PersonalPhoto`, `EpisodeBanner`, `FeedProgress`, `NewCount`, `MerchLine`, `MemeOfTheDay`, `EventsStrip`, `FeedPlaces`.
- **Seen timing:** a carousel slide is seen after 1.5 s as the active slide while the carousel is on screen in a visible tab. Cards are seen at ≥50% visibility for 1 s, or on any tap (open, play, source link, keep).
- **Media behaviour:** feed images use `referrerPolicy="no-referrer"` (YouTube embeds keep the site referrer). Motion plays only on the active, on-screen slide while motion is allowed; paused or reduced motion shows posters, and the viewer plays on tap. HLS plays where native, otherwise opens at the source. A broken image hides the entry and sends a recheck hint.
- **Routes and settings:** `/world/saves`, `/world/merch`, and the settings card `MyFaves` (chip lists over `GET/PUT /api/me/faves` with compare-and-set).

## Policy and helper additions from source integration

- **`retentionHours`** (entry field, default `null`): a storage ceiling from the source's terms (Tumblr: 72). Items carry `expiresAt` within it, and `pruneFeeds` deletes payloads once `expires_at` passes. `saveSnapshot` keeps only credit, URL, canonical tags and the site's own blurb (title becomes `a post by <handle>`; no media or facts; link-only).
- **`UNIT_CODES`** (`sources/tags.js`): Project SEKAI master-data unit codes (`street`, `idol`, `light_sound`, `light_music_club`, `school_refusal`, `theme_park`, `piapro`). They resolve through `canonicalUnits` only and never through free-text `mentions`, so ordinary words don't tag or reject text. `mentions` now matches two-character CJK names (猫猫, 壬氏).
- **`sources/util.js` `clip`:** strips C0 control characters (Postgres jsonb rejects NUL) and never splits a surrogate pair.
- **HTTP redirects:** same-origin GET redirects as before. A plain media GET (no `authorization`/`cookie` header) may also redirect to another host on the entry's `mediaHosts` (for example a video thumbnail moving to its CDN).
- **Recheck connections:** publish and saved-copy rechecks use one paced connection per source with a separate request budget (`RECHECK_REQUESTS` 120 per publish invocation).
- **Rules:** the booru rating family map is Danbooru `g`, Sakugabooru `s`. `minimumScores` apply by source ID, then family. `unreleased_sekai` doesn't apply to merch preorders. `BAD_TEXT` matches `\bsue[sd]?\b` (so "skill issue" passes).
- **`FEEDS_ENABLED`:** `false` means off; `manual` means admin stage runs only (no cron, continuations or catch-up); `true` means scheduled automation. `feedConfig()` exposes `enabled` and `manualRuns`.
- **Client:** Tumblr media never autoplays inline (still plus tap to play in the viewer). The credits dialog lists the feed data sources and "powered by Tumblr".

## Owner policy updates after the first production run (2026-09-16)

- **Uncertainty approves.** `checkItem` approves an uncertain vision or text classification (`suggestive: "uncertain"`, `aiLikelihood: "uncertain"` or `aiConfidence < 0.75`) and records `evidence.uncertain: true`; the admin's recent items show it. Still rejected: `suggestive` or `explicit`, gore, horror, political, confident AI art (`high` with confidence ≥ 0.75), quality < 3, moderation flags or thresholds, meme rules, and missing required characters or cosplay.
- **Moderation:** reject when OpenAI's moderation flags the input (or any category is true), plus the strict `sexual/minors` score threshold (0.01). The other `THRESHOLDS` scores are recorded as evidence and no longer reject (owner decision, 2026-09-16).
- **Re-evaluation:** `RULE_VERSION` is now `2026-09-16.1`. `checkQueue` re-queues vision/moderation rejections whose `safety.rulesVersion` is older, once, ahead of the section quotas.
- **YouTube provenance:** `official_channel`, `vocadb_original` and `creator_upload` (a channel verified as the uploader's own) pass `mediaGate`; `unknown` stays pending.
- **Check queue:** free text items first, then paid items previously held back as `vision_uncertain`, then each section's quota. The `meme` quota counts only home-eligible memes (not maomao or music); fandom memes use their own sections' quotas.
- **Dress-up filler:** empty slots fill from cosplay, then non-merch and non-event kinds.
- **Runner errors:** `invocation_request_limit` and `request_in_progress` pass through `checkItem` and checkpoint the stage. `check` runs one retry pass per build for queued items left `safety_unavailable`; after the daily-budget stop it skips paid items (left pending) while free checks and the retry continue.
- **Events:** `upsertEvent` skips an undated candidate that duplicates a dated upcoming edition of the same event (`duplicatesDatedEdition`).

