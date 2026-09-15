Kiriya’s feeds — Claude continuation and production verification

Assignment: finish the pipeline and page integration after Codex’s completed foundation.
Site: https://kiriya.love
Repository: expected /home/iamnaym0ri/projects/birthday, GitHub iamnaym0ri/kiriya.
Latest owner update: the setup has been deployed to Production, the API credentials have been supplied, and Claude has Vercel access. Production testing is authorized. Verify the actual deployed revision and runtime configuration rather than assuming what the deployment contains.

1. Mandatory first action: ingest Codex’s handoff

Read the reports Codex left for the first half in full before editing code or running production tests. Do not begin from this brief alone. Locate the actual repository paths; the expected folder is docs/feeds/.

Read in this order, after any applicable AGENTS.md:

FOUNDATION-HANDOFF.md — completed work, implementation map, migrations, verification, limitations, and Claude’s starting point.

CONTRACTS.md — implemented exports, runtime schemas, adapter interface, item identity, safety state, editions, private APIs, runner behavior, usage accounting, and save-copy lifecycle.

SETUP.md — resource configuration, environment variables, precedence, test commands, schedule, and remaining runtime checks.

PIPELINE.md — the full product design and Q&A decisions. This remains the authority for the final functionality and appearance.

The phase execution brief referenced by those reports, expected docs/execute.md, and the original site handoff where needed to understand preserved features.

All six research documents: research/maomao-sources.md, cosplay-and-events.md, ai-costs-and-limits.md, meme-sources.md, vocaloid-sources.md, and merch-and-fashion.md. Locate them if their folder differs.

The supplied report attachments correspond to:

Attachment

Repository document

Pasted markdown(20260915-082527).md

Foundation handoff

Pasted markdown (2)(20260915-082556).md

Foundation contracts

Pasted markdown (3)(3).md

Foundation setup and release

Pasted markdown(20260915-073107).md

Complete pipeline design

Then inspect the current Git status/diff and the actual modules the reports name. A report describes an implementation at a point in time; the working tree and deployed commit may have moved since then. Preserve unrelated work, including the birthday, drawing, game, check-in, typography, and mascot changes noted by Codex.

Before implementation, record a short “Codex foundation understood” section in your continuation report: files read, actual revision, verified existing modules, remaining features, and material differences between the report and code. This is an implementation checkpoint, not a request for another approval. Continue directly with the work.

How the latest instructions change older documents

Production inspection and bounded production tests are now authorized. An older instruction requiring a preview first must not block these tests.

The reports’ “credentials absent” and “not deployed” statements are historical. Check whether the owner’s deployment resolved them.

The foundation-only stopping point applied to Codex. Claude is now assigned the remaining implementation through release readiness.

Existing owner-handled Git pushes and deployments remain in force. Vercel access and production-testing permission do not transfer that step. Do not push, merge, deploy, redeploy, or call deployment hooks. Complete implementation and all available verification, then consolidate any owner deployment actions at the end.

2. What is already built

Codex reports a working local fixture pipeline, 45 passing tests, and a small existing-style admin feed panel. Its proof collected 25 synthetic candidates, rejected five disallowed candidates, and exercised collection through private edition reads. Those results are local proof, not measured live provider/source performance.

Extend these existing systems:

Foundation

What to retain and use

Stack and access

React/Vite, Hono through api/index.js, existing signed sessions, roles, CSRF, private media streaming

Data

Thirteen additive tables; migrations 0001_dry_kree and 0002_awesome_wolfsbane; original migration unchanged

Taste

Complete explicit defaults, validated overrides, revision checks, build snapshots, filtered writer context

Identity

Native/URL/media aliases, permanent seen/hidden exclusions, source-payload fingerprints

Sources

Registry, hardened HTTP helper, bounded cursors, health tracking; VocaDB is the only adapted live source

Safety/writer

Moderation, structured still-image vision, Responses API, voice/fact validators, template fallback, provider-result reuse

Jobs

Durable stage leases and checkpoints, generation fencing, atomic edition publication, authenticated catch-up

Accounting

Atomic paid-request reservations and US$5 monthly feed ceiling; saved-copy reservations and completion accounting

APIs

Private feed/seen/hide/recheck/faves, admin status/preview/run/hide/block, protected job routes

Storage

Private Blob helpers and authenticated streaming for future saves/ objects

The real gaps are collectors, complete section planners, moving-content policy, Keep/copy/deletion workflows, events, merch, my faves UI, richer admin controls, page integration, and measured production operation. Repair a foundation defect when evidence requires it; do so inside the existing design rather than adding parallel implementations.

3. Start with bounded production verification

Use the existing Vercel access. Do not request credentials again when they are already available through the authorized environment. Never print secret values or copy production credentials into tracked files.

Establish the deployed state

Record the active production deployment ID, deployed Git revision, actual runtime/function settings, recent build/migration outcome, and current feed switch state. Confirm whether the owner deployed the foundation code as well as the environment variables.

Verify the effective connection targets, not just resource attachments:

Vercel project kiriya; Neon resource kiriyaa; private Blob kiriya-blob.

The code uses DATABASE_URL before kData_DATABASE_URL. Confirm which actually wins without logging its password or complete connection string.

Confirm the installed Blob authentication path, expected store ID, and streaming behavior; preserve working OIDC/token configuration.

Check that both feed migrations are recorded in the deployed database. Do not rerun a reset or initialize a fresh schema over production.

Check the presence of OPENAI_API_KEY, YOUTUBE_API_KEY, TUMBLR_API_KEY, BLUESKY_HANDLE, and BLUESKY_APP_PASSWORD, then verify the credentials with real requests.

Verify each available integration

Check

Evidence to collect

Site and access

Public page works; private APIs reject anonymous requests; existing authorized roles retain intended access

Neon

Small read through the deployed app confirms effective target/schema; durable job/database behavior checked with bounded real work when available

Blob

Tiny uniquely named test object can be written privately, read through authorized streaming, rejected anonymously, and deleted by its recorded test ID

OpenAI

One small structured writer request, one appropriate image/vision check, and moderation; confirm configured primary/fallback access without a batch run

YouTube

A small public channel/video request succeeds; confirm embeddability and Singapore-region checks can be evaluated

Tumblr

Consumer-key request succeeds for the planned public endpoint; record quota/access or approval failures distinctly

Bluesky

App-password session plus a small intended read/search succeeds; no social posting, following, or messaging

Use the existing usage ledger and ceiling for paid probes; record any necessary standalone probe cost separately and count it toward the same testing allowance. Start with at most a few items per source and a US$0.50 maximum initial paid-probe allowance within the existing US$5 feed budget. Do not increase the monthly budget to make a test pass. Stop repeated failed probes and fix the cause.

Test deployed routes from the production deployment when available. A request from the local machine verifies credentials/provider access, but does not establish Vercel network access or function packaging. Record the execution location honestly. If a diagnostic needs code that is not deployed, implement it locally and include its owner deployment dependency in the final report; do not invent a production pass.

Use admin previews and uniquely identified disposable test artifacts. Do not mark Kiriya’s existing items seen, alter her faves, delete her saves/uploads, or overwrite her content for testing. Cleanup is limited to the exact artifacts created by that test. Keep synthetic fixtures and fake-provider bypasses disabled in production; ordinary private-storage probes are not permission to enable the fixture pipeline.

Do not enable the whole unfinished feed pipeline merely to unlock a test. Use available bounded diagnostic paths. New diagnostics must require admin authorization, enforce request limits, redact results, and avoid touching the published edition. If new code or environment changes need deployment, prepare that work and keep proceeding with other implementation.

4. Complete the remaining implementation

Work through these phases in order. Complete each phase’s code and meaningful local tests, update the same continuation report, and keep going. Do not stop after Maomao or the first successful source.

Phase A — Maomao, source lifecycle, and saves

Implement the approved Maomao collectors from PIPELINE.md §5.1: Danbooru, Bluesky, Tumblr, Sakugabooru, AniList, the named news feeds, Fandom/Wikipedia, and relevant official YouTube material. Verify source IDs and present-day access from primary sources and actual calls. Reuse the foundation registry and HTTP helper.

For every planned adapter, document enabled, verified, restricted, unavailable, or intentionally optional status. Keep source-specific attribution, cache TTL, deletion recheck, media-host policy, and copy permission explicit. A missing/blocked source must not be counted as a successful empty response. Do not bypass challenges, access controls, or excluded-source decisions. Implement permitted fallback sources so an unavailable optional collector does not stall the section.

Replace the three-slot demonstration with the full Maomao plan: roughly 12 slots and 20 reserves when supply allows, imagery paired with relevant notes, lore/news, memes, cosplay crossovers, merch/event hooks, and verified episode-day behavior. The original eight-visual/twelve-slide wording needs a clear slot allocation using the existing primary/companion contract; record that allocation once. Use fresh verified airing data instead of hardcoded dates from the research document.

Complete moving-content handling for GIFs, MP4, HLS, and source embeds. The foundation currently leaves all moving media pending. Establish what was actually inspected: source provenance/ratings, text/captions, and bounded frame inspection or recorded owner review where appropriate. Poster approval must not silently allow unreviewed animation/video. Uncertain material stays withheld or is represented only by its separately approved still/link. Preserve the design’s clips/GIFs where their source and review policy support them; do not claim that sampling guarantees every frame is safe.

Implement the Keep workflow using ensureSave, reserveCopy, and finishCopy: server resolves the approved item ID, records immutable credit/snapshot, and copies only permitted media. Respect the contract’s 8 MiB/item, 400 MiB warning, 500 MiB saved-copy ceiling, total capacity/headroom, and fresh-meter requirement. Include all personal uploads in shared capacity accounting and handle out-of-band changes through reconciliation. Never release an uncertain reservation until the object state is reconciled.

Add the bounded remote-copy worker, retry/reconciliation, orphan cleanup, source deletion/cache refresh jobs, private media delivery, and real /world/saves UI. YouTube remains embed/link-only. A failed or disallowed copy becomes an honest link-only save with credit; never show “saved a copy” prematurely. Creator removal updates the saved media and accounting while retaining permitted attribution/removal metadata. Match deletion-check frequency to the stricter applicable source rule, not an unconditional weekly interval.

Wire Maomao feed data into the existing MaomaoSpread/LoreCarousel. Keep the authored slides and old discovery slips intact.

Phase B — Music and meme of the day

Finish VocaDB, YouTube, released Global SEKAI data/news, piapro/approved news feeds, artist posts, and optional music links. Implement the actual voicebank IDs, producer rotation, metadata refresh, embeddability, and Singapore-region checks.

Implement the approximately 13-item music mix plus 20 reserves: two new originals, a classic, a Rin/Len story song, a modern/SEKAI song, Global news, lore, visuals, meme, and merch. Miku leads; non-Miku representation and the hard seven-day producer rule remain. Preserve the existing visible shared player and her personal song shelf. Scope image referrer rules so they do not break YouTube playback.

Global SEKAI uses released content only. Keep official card/gacha news text-and-link-only under the approved design, paired with permitted fan art where relevant.

Implement the approved Lemmy/Bluesky/Tumblr/booru meme sources, OCR/vision classification, and section meme selection. Keep the political, suggestive, brainrot, self-harm, family/body-joke, and other approved exclusions. Home gets one featured meme and five reserves behind “one more”; thin fandom supply may reallocate a slot rather than fabricate a meme.

Phase C — Dress-up, fashion, and events

Implement the daily Miku/Maomao/rotating-fandom cosplay selection, her least-recently-shown own photo when available, process/tutorials, wig/makeup material, a grounded cosplay dare, and the approved extras. Use the exact fandom rotation and style preferences from the design. Preserve personal uploads and the existing lookbook.

Implement the approved cosplay/fashion sources and grounded Singapore shoot-spot pool. Instagram/TikTok creators she explicitly adds are link cards, not new scraping integrations. Do not infer personal habits or claim she created someone else’s cosplay.

Implement events CRUD/read presentation and registerEventsStage: source verification, conditional refresh, structured extraction, confidence/TBC, cancellation/expiry, selected events, and countdowns. Dates and years must be present in cited evidence; resolve timezone and date precision explicitly. Research candidates are not verified seed facts.

Implement the approved weekly event scout with current supported search-tool parameters, allowed domains, Singapore context, at most five tool calls per weekly pass, and accounted cost. Add the bounded lexicon-refresh path described in the design, keeping prohibited wording blocked. Do not add a daily open-ended search agent.

Phase D — Merch shelf

Implement allowed Solaris/Good Smile/Crypton sources and the specified optional sources where verified. Merge identical products by reliable identity such as JAN/GTIN; do not merge unrelated items merely because names resemble each other.

Provide source images, maker/type, dated original price and approximate SGD conversion, preorder deadline/release precision, official/retailer/search links, and availability freshness. S$30–100 receives the intended preference without hiding other prices. Build /world/merch, fandom/type filters, and section merch lines. Singapore/Taobao search-only sources remain links with the approved wording; do not turn them into crawlers or add purchasing functionality.

Phase E — My faves, complete private integration, and admin

Build my faves using GET/PUT /api/me/faves, the existing strict schema, and optimistic revision checks. Preserve defaults and fixed safety constraints. Cover the editable characters/fandoms, voicebanks, SEKAI units, eras/producers, wishlist, events, merch, fashion, meme preferences, and additional joke exclusions. Changes affect the next build; show that clearly.

Finish seen timing, companion visibility, reserve progression, same-day “seen earlier,” new counts, and closing states. Avoid firing seen events on fetch, admin preview, hidden tabs, or offscreen content. Revalidate on visit/focus and the existing revision-aware refresh contract, including the morning publish after midnight.

The existing catch-up helper is synchronous and bounded, not a background queue. Wire it so the page renders usable content immediately and never blocks on a long pipeline request. If using a supported background continuation, retain the durable checkpoints, request lifetime limit, and five-minute throttle. Do not assume waitUntil supplies unlimited execution or permanent scheduling.

Complete the existing admin panel: credited review and rejection samples, source health, stage progress/retries/rebuilds, hide/block, targeted rewrite, non-mutating preview, events confirmation/editing, lexicon preview, storage/copy state, and actual/estimated usage. Rewrites use the same grounded writer and budget rules. Clarify whether a rewrite affects future content or an explicitly published revision; do not silently mutate saved snapshots.

Review a representative batch of real blurbs across all sections. Preserve the exact voice rules and signature ✦ kiriya.love. Measure retries, template fallbacks, and rejection reasons. Fix excessive false rejection without weakening safety or allowing invented facts. Her interests and supplied history are the personalization; no invented memories or implicit behavior profile.

5. Complete orchestration and source verification

Connect the implemented stages, weekly events/lexicon work, deletion refresh, storage reconciliation, and retention to the existing durable runner. Prepare the final schedule in vercel.json while preserving existing backstop/notification entries. Use the design’s UTC schedules and Singapore day semantics. Source-required deletion deadlines may require separate bounded maintenance work; document how they are met within current plan limits.

Measure actual requests, latency, checked/approved/written/published counts, and costs. The foundation’s limits of 24 provider requests per stage/build and 60 items per invocation were intentionally small. Tune bounded batching/checkpoints and these limits to support the intended feeds within the existing monthly ceiling; do not disable accounting, reset the ledger, or raise spending to hide a capacity problem.

Preserve lease fencing and idempotency through every new side effect. Jobs must resume partial collection, moderation, copy/reconciliation, and writing without republishing duplicate editions or charging completed provider work again. Test current generation checks and checkpoint ordering when adapters change.

Create a source verification matrix covering every planned source family. Record official/reference URL, credentials required, probe timestamp, execution location, result, item/media kinds supported, copy/deletion policy, and fallback. Claims about current permissions, access, quota, price, event dates, or model capabilities need primary-source verification. Avoid repeated probing of known-blocked optional sources.

Do not declare the pipeline finished just because all sources are disabled without errors. Deliver working sources and real approved samples for Maomao, music, cosplay, memes, events, and merch; separately identify any genuinely unavailable optional sources or thin-supply gaps. Never invent source items to reach the daily target.

6. Appearance and behavior that must survive

The current site is the design baseline. This is an additive content/pipeline implementation:

Keep the lilac palette, handwriting/pixel labels, scrapbook accessories, imagery hierarchy, responsive layout, and existing animation language.

Reuse note-slip, lookbook-photo, record-sleeve, lore-carousel, settings-card, Modal, and SectionHeading where present.

Keep the public profile compact, existing four top bookmarks, letters, birthday features, drawing/game tools, personal music/photos, and original discovery content.

Respect global motion pause, reduced motion, focus/touch, offscreen and hidden-tab behavior. Reserve media dimensions and provide usable posters/fallbacks.

Keep credits/source links visible and private interests, editions, saves, and settings behind existing access checks.

Keep old daily greeting/drawer/notes and optional existing notifications working. The new feeds send no notifications.

7. Verification and honest completion

Run the existing npm run verify:feeds and add focused coverage for the new behavior. Local fixtures and failure injection use isolated test storage, never the live database. Do not redirect the fixture command to production, run destructive DB utilities there, or bulk-seed synthetic editions.

Verify at least:

Adapter pagination/rate/error handling and real credential/source probes, with local versus Vercel execution identified.

Exact section mix and fallback rules, seven-day producer exclusion, permanent dedupe/seen/hide behavior, and taste revision timing.

Moving/still inspection scope, failure withholding, creator deletion, source changes, and refreshed fingerprints.

Keep idempotency, concurrent byte reservations, copy failure/orphan recovery, private reads, deletion accounting, and surviving snapshots.

Events/date evidence, released-only Global SEKAI, stale merch/FX behavior, and allowed outgoing links.

Complete local private flows on phone and desktop: login, all interest sections, visible music playback, keep/hide, saves, merch, faves, and admin controls. Include existing page regressions and public-bundle leak checks.

Lease/deadline continuation, incomplete-stage recovery, generation supersession, nonblocking catch-up, and preservation of a last-good edition on failure.

A small real edition built through the real provider path, reviewed through admin, with per-stage counts, elapsed time, and usage recorded. If it cannot run in the deployed code yet, mark its production verification pending the owner’s next push.

Production testing is authorized for currently deployed capabilities. Code written in this phase is not production-tested until the owner deploys that revision. Finish the entire local implementation before handing back that final deployment dependency. Do not claim “fully live” based on local checks or a settings save.

Keep FEEDS_ENABLED at its actual current value during diagnosis; do not assume the old reported value still applies. If it is false, leave routine automation off until the completed implementation is ready. Prepare exact activation instructions tied to a verified deployment revision. If it is already true, ensure existing runs do not overlap probes and preserve the last-good published content.

8. Deliverables and stopping condition

Maintain a concise phase log as you work, then leave:

Deliverable

Required contents

docs/feeds/CLAUDE-CONTINUATION-REPORT.md

Codex reports ingested, starting code/deployment, completed features by phase, actual files/migrations, decisions, tests and remaining limitations

docs/feeds/SOURCE-VERIFICATION.md

Full source matrix, real probe results and execution locations, permissions/access evidence, disabled optional sources and fallbacks

Updated docs/feeds/CONTRACTS.md

Actual new APIs, exports, copy/reconciliation jobs, planners, frontend read models and supported media policies

Updated docs/feeds/SETUP.md

Current verified credential/resource status, final job schedule, deployment/activation steps, budget/storage settings and recovery procedure

Do not replace Codex’s historical proof with claims that it tested Claude’s additions. Keep local artifacts and screenshots private and credentials out of reports. List production artifacts created/cleaned by test ID, without exposing private content.

Finish every implementation phase, resolve implementation defects, and perform every authorized check available in the current deployment. Bundle genuine owner-only actions once at the end: any missing account challenge, the owner’s push/deployment, and activation steps that require that new deployment. Do not repeatedly ask the owner to confirm already-approved work.

Your final response must distinguish implemented, verified locally, verified in production, and pending owner deployment/activation. Explain any source or policy limitation precisely. The end result should be Kiriya’s existing beautiful site with working personal daily curation, useful saves, music, cosplay, events, merch, and explicit favorites—built on Codex’s foundation, with no unnecessary new system or redesign.