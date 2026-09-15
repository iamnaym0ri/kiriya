# Feed foundation handoff

## Baseline — 2026-09-15

- Checkout: `/home/iamnaym0ri/projects/birthday`, branch `main`, GitHub `iamnaym0ri/kiriya`. No applicable `AGENTS.md` was present.
- Substantial uncommitted birthday, drawing, game, check-in, typography and mascot work predates this phase. It is preserved; a private baseline diff is in `.data/feed-foundation/`.
- Authoritative product design: [PIPELINE.md](PIPELINE.md). Phase assignment: [../execute.md](../execute.md). All six referenced research files are present under `research/`. Research dates, source IDs and permissions are claims to verify before live collection, not seed facts.
- Existing stack: React/Vite, Hono through `api/index.js`, Drizzle, local PGlite and Neon HTTP, private Blob using SDK OIDC support. Existing login, role checks, `x-kw`, media streaming, daily bundle, notifications and admin are reused.
- Existing migration: `0000_init`. Production builds validate configuration and run tracked migrations before the frontend build. This phase tests only isolated databases.
- Missing at baseline: feed tables, durable stage jobs, permanent identity exclusions, private edition API, budget ledger, feed safety/writer, taste overrides, save-copy accounting and feed admin controls.
- Scope: working local fixture pipeline and shared backend contracts. Public/private page presentation, real collectors, full section planners, Keep workflow and feed page integration stay with Claude's continuation.

## Delivered

The Codex foundation is implemented. A controlled, local-only pipeline collects 25 synthetic candidates, rejects the five deliberately disallowed candidates, checks and writes the others, stages section revisions, publishes them atomically, and serves authenticated reads. The existing admin can run this demonstration, preview credited items, inspect health/usage/rejection reasons, and hide or block an origin.

The visible change is one card in the existing admin. Existing public/private presentation, letters, drawing tools, games, personal uploads, authored slides, motion controls and player remain in place. The old server profile/writer now permits light-novel spoilers and ships, as the new design requests.

### Implementation map

| Files | Responsibility |
| --- | --- |
| `server/content/taste.js`, `server/feeds/taste.js` | Full explicit defaults, validated overrides, optimistic revision checks, stable build snapshots, limited writer context |
| `server/db/feed-schema.js`, `server/db/schema.js` | Thirteen additive tables, exported through the existing schema |
| `server/feeds/normalize.js`, `repository.js` | Runtime item/slot validation, independent native/URL/media identity aliases, eligibility, permanent seen/hidden exclusions, health and retention |
| `server/feeds/sources/`, `http.js` | Registry/policies, bounded source pages, synthetic adapter, adapted existing VocaDB source, HTTPS/DNS/redirect/size controls |
| `server/feeds/rules.js`, `settings.js`, `moderate.js` | Versioned source rules, validated tuning/lexicon, moderation, structured still-image checks, pending outcomes for incomplete checks |
| `server/feeds/provider.js`, `usage.js`, `voice.js`, `writer.js` | Real Responses/moderation clients, local fake, strict outputs, voice/fact validators, fallback, request ledger and atomic spending reservations |
| `server/feeds/score.js`, `editions.js`, `jobs.js` | Shared scoring, hard producer exclusion, slots/reserves, staged publication, durable leased stages, checkpointing, catch-up |
| `server/feeds/saves.js` | Immutable save snapshots, copy-policy gate, concurrent byte reservations and completion accounting; no remote copy worker |
| `server/routes/feeds.js`, `server/app.js` | Existing-session private APIs, existing CSRF mechanism, admin actions, authenticated job endpoints |
| `server/routes/uploads.js` | Authenticated streaming delivery accepts future `saves/` objects; that namespace cannot become a public profile image |
| `src/admin/FeedPanel.jsx`, two additions to `Admin.jsx` | Modest existing-style admin integration |
| `scripts/test-feeds.mjs`, `scripts/verify-feed-foundation.mjs` | Isolated behavioral tests and repeatable phone/desktop browser verification |
| `.env.example`, `package.json`, lockfile, `vercel.json` | Feed settings, verification command, runtime Sharp dependency, 300-second function duration |

`sharp` was already installed at the same version; it moved from development to runtime dependencies for bounded image inspection. No framework, queue service, database or Blob store was added.

### Migrations

- `0001_dry_kree.sql`: `feed_identities`, `feed_items`, `feed_builds`, `feed_editions`, `feed_seen`, `feed_runs`, `feed_source_health`, `feed_budgets`, `feed_usage`, `feed_controls`, `saves`, `feed_storage`, `events`.
- `0002_awesome_wolfsbane.sql`: adds the durable provider-result field to `feed_usage` so a resumed request can reuse a completed response.
- Both have Drizzle snapshots and journal entries. `0000_init.sql` is unchanged. Tests upgrade an existing synthetic database, preserve its personal/auth records, and apply the complete migration journal twice.
- **No production migration ran.** The existing `vercel-build` applies these additive migrations before building on the owner's next deployment. Preview database isolation must be checked first; see [SETUP.md](SETUP.md).

## Verification

Run from the project root:

```bash
npm run verify:feeds
```

Verified locally on 2026-09-15:

- **45 passing tests**: 28 existing tests plus 17 feed tests. Coverage includes migration compatibility, login/role/CSRF boundaries, fixture production guards, concurrent leases, stale-worker rejection, checkpoint/retry/dependency behavior, Singapore boundaries and catch-up throttling.
- Complete fixture collection → safety → writing → staging → publication → private read → seen/hide flow. Admin preview leaves seen history untouched. Failed rebuilds retain the preceding published revision.
- URL/media deduplication and bridged aliases; permanent seen/hidden exclusion after payload pruning; preserved saved snapshots; concurrent copy reservations and idempotent completion.
- Unavailable/malformed safety results stay withheld; moving media stays pending. Writer rejects unsupported IDs, invented numbers, disallowed wording and malformed output. Mocked real SDK calls verify model-specific cache fields, response reuse, usage for malformed outputs, request ceilings and concurrent spending reservations.
- Adapted VocaDB normalization and source-failure isolation using mocks. HTTPS host/private-address/redirect/retry/size controls tested without contacting sources.
- `npm run build` and the existing public-bundle leak check pass.
- Chromium at 390px and 1440px: admin login, fixture run, credited preview, hide action and no horizontal overflow. Existing public and private birthday pages render without a feed presentation change.

The verification command creates an in-memory PGlite database and synthetic login secrets, starts an isolated local server on `127.0.0.1:5178`, then closes it. It does not use `.data/pglite`, production Neon, Blob, or paid APIs. Logs/screenshots are private ignored artifacts under `.data/feed-foundation/`; `verification.json` records the browser checks. This is browser emulation, not a physical iPhone/iPad test.

## External setup and limits

The authenticated Vercel API confirms the local project link, Hobby/Fluid configuration, the existing domain, and Production/Preview attachments for `kiriyaa` and private `kiriya-blob`. Five non-secret feed settings were added and read back; **`FEEDS_ENABLED=false`**. Existing secrets and integrations were preserved. Production deployment identity remained unchanged. See [SETUP.md](SETUP.md) for the exact distinction between configuration, local proof, external metadata and pending runtime checks.

Known boundaries:

- The real provider implementation is locally tested through a mock SDK. `OPENAI_API_KEY` is absent; account/model access, actual cache hits, cost and classifier/writer quality remain unverified.
- VocaDB is the only adapted live-source entry. Its media is intentionally pending until Claude supplies playback/source/moving-content checks. No new source collector or cloud source probe was built.
- Safety classifiers and lexical grounding are fallible. The conservative writer can reject legitimate paraphrases or use templates; semantic fact verification is not claimed. Review real blurbs and measure fallbacks before activation.
- Source refreshes that change a normalized item reset its approval. Old checks cannot approve the replacement payload, and editions with an older fingerprint withhold it until a matching replacement edition is ready. Only recognized native/URL/media aliases deduplicate; edited reposts may evade recognition.
- Planning is a small three-slot/two-reserve proof. Full quotas, fandom/voicebank rotations, paired content policies, event/episode hooks, merch ranking and Keep UI remain Claude's work.
- Events are an additive schema and an explicit unimplemented extension, with no dates seeded. Recheck hints have no background deletion worker yet.
- Saved-copy helpers are ready, but no Keep endpoint, copier, storage meter or deletion reconciliation is implemented. The total-store guard needs a fresh measurement and coordination with other uploads before live copying.
- Default limits are deliberately small: 24 provider requests per stage/build, 60 items per invocation, a 270-second work deadline and US$5 monthly feed ceiling. Claude must measure real volumes and tune within the ceiling. Limits do not cover the older daily writer or other account consumers.
- Concurrent PostgreSQL behaviors were exercised in PGlite. The SQL uses single-statement claims/updates suitable for Neon HTTP; Neon/cloud concurrency and function packaging still require the owner's preview.

## Claude begins here

Read [PIPELINE.md](PIPELINE.md), [../execute.md](../execute.md), this handoff, [CONTRACTS.md](CONTRACTS.md), [SETUP.md](SETUP.md), the current Git diff, and the actual modules before editing. The six research documents remain unchanged reference material; verify current source permissions, IDs, release dates and event dates before use.

Continue in the assigned order:

1. **Maomao club + saves:** approved collectors, source policy verification, exact planner/episode hooks, Keep/copy/deletion lifecycle, existing carousel and saves view.
2. **Music + meme of the day:** approved VocaDB/YouTube/source checks, released Global SEKAI news, producer diversity, exact music/meme presentation.
3. **Dress-up + events:** planned rotation plus the recurring personal photo, fashion/shoot spots and independently verified dates.
4. **Merch:** allowed collectors, product identity, dated prices/conversion/deadlines and search-only shop links.
5. **My faves + voice tuning:** settings UI, richer admin controls and review of actual generated blurbs.
6. **Owner-created preview verification and release preparation.** Preserve the authored fallback, existing styles/motion/player, and private access throughout.

Extend these modules; do not create parallel auth, scheduler, registry, writer or tables. The owner still handles Git pushes/deployments. No new live cron is registered, and no push, deployment, hook or production migration was performed in this phase.
