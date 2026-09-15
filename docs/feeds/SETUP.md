# Feed setup, release and recovery

Updated 2026-09-15 for the completed implementation (Claude continuation). Codex's foundation notes are kept where still accurate; statements marked **historical** describe the foundation phase. Source-by-source evidence is in [SOURCE-VERIFICATION.md](SOURCE-VERIFICATION.md), contracts in [CONTRACTS.md](CONTRACTS.md), and the work log in [CLAUDE-CONTINUATION-REPORT.md](CLAUDE-CONTINUATION-REPORT.md).

Pushes, deployments and production migrations remain the **owner's** steps. Claude never pushed, deployed, redeployed or called a deploy hook; at the owner's request it set the two non-secret feed switches listed below.

## Resources

| Resource | Verified configuration |
| --- | --- |
| Project | Vercel `kiriya` (`prj_4bNqxPCD4r6198yn2GyyzxtasHbM`), repository `iamnaym0ri/kiriya`, branch `main` at `3ab64dc` ("new pipeline", pushed by the owner 2026-09-15) |
| Runtime / plan | Vite, Node 24.x, Hobby, Fluid Compute, region `iad1` |
| Production deployment | `dpl_He264EJ34k4b9ShzH9bDyhxV4MFg`, commit `3ab64dc` ("new pipeline"), READY 2026-09-15 21:17 UTC. Migrations 0001/0002 applied; all eight crons registered. Production checks passed on Vercel at 21:22 UTC (database, Blob, OpenAI, YouTube, Tumblr, Bluesky; see SOURCE-VERIFICATION.md) |
| Domain | `kiriya.love` / `www.kiriya.love` |
| Database | Neon `kiriyaa` (`store_UBEwZtrCDJOvBWok`) attached to Production and Preview (managed `kData_*`). The code prefers an explicit `DATABASE_URL`, but the production runtime has none, so `kData_DATABASE_URL` is effective (Production checks) |
| Blob | Private `kiriya-blob` (`store_8ohnEeAoelCzSaL3`) attached to Production and Preview (`BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`); uploads config reports `presigned` mode |
| Function | `api/index.js` with `maxDuration: 300` and `includeFiles: node_modules/@ffmpeg-installer/linux-x64/**` (ffmpeg for frame sampling, run as a separate process) |

## Environment

All names are server-side. Never add a `VITE_` copy of a secret. Sensitive values can't be read back, so "exists" below means Vercel metadata only; real use is verified by the admin **Production checks** once this revision is deployed.

| Name | Status (2026-09-15) | Action |
| --- | --- | --- |
| `FEEDS_ENABLED` | **Production `true`, Preview `false`** (set 2026-09-15 21:3x UTC at the owner's request; takes effect from the next production deployment) | `manual` = admin stage runs only; `true` = nightly automation plus catch-up. Preview stays `false` because it shares the production database |
| `OPENAI_FEED_MODEL` / `OPENAI_FEED_FALLBACK_MODEL` | `gpt-5.6-luna` / `gpt-5.4-mini-2026-03-17` | Keep |
| `FEED_MONTHLY_BUDGET_USD` | `5` | Keep. The hard ceiling for this feed path |
| `FEED_MAX_REQUESTS_PER_RUN` | **`60`** (Production + Preview, set 2026-09-15) | Code default 60, max 120. Each image check is 2 provider requests (moderation + vision) |
| `OPENAI_API_KEY` | Sensitive; **verified on Vercel 2026-09-15** (moderation, Luna, mini fallback, vision) | – |
| `YOUTUBE_API_KEY` | Sensitive; **verified on Vercel** (channel, video status, SG region) | ≈40 quota units/day plus rechecks (10,000/day quota) |
| `TUMBLR_API_KEY` | Sensitive; **verified on Vercel** (tagged request 200) | Needed by `tumblr-maomao` and `tumblr-cosplay`; `tumblr-memes` works keyless |
| `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` | Sensitive; **verified on Vercel** (session plus one search, no writes) | Used for reads only, never posts |
| `CRON_SECRET` | Exists, Sensitive | Required: Vercel cron bearer and authenticated continuations |
| `DATABASE_URL`, `kData_DATABASE_URL` | **Production runtime uses `kData_DATABASE_URL`** (no explicit `DATABASE_URL` present there); migrations 3/3 | – |
| `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`, `BLOB_READ_WRITE_TOKEN` | Existing | Keep; saved copies use the same private store as uploads |
| `DANBOORU_USER_ID` | Absent | Optional: a Danbooru account ID for the User-Agent, as Danbooru's API docs request |
| `FEED_MODEL_PRICES_JSON` | Absent | Optional dated price overrides; unknown model prices block the paid path |
| `FEEDS_FIXTURE_MODE` | Absent | Local isolated PGlite only; refused on Vercel, in production mode or with any database URL |
| `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_ENV` | System | Continuations target only the production domain; previews never continue themselves |
| Passphrase hashes, `SESSION_SECRET`, `SITE_URL`, `KIRIYA_TZ`, QStash, VAPID | Existing | Preserved. New feeds send no notifications |

## Job schedule (`vercel.json`)

Hobby crons run once a day each, somewhere within the scheduled hour. Durable run rows, not cron order, decide what runs. Each invocation stops before 270 s with a checkpoint.

| UTC | Singapore | Endpoint | Work |
| --- | --- | --- | --- |
| `20 16 * * *` | 00:20 | `/api/jobs/backstop` | Existing daily bundle (greeting, drawer, notes), unchanged |
| `5 17 * * *` | 01:05 | `/api/jobs/feeds/fetch-a` | Keyless/fast sources (boorus, AniList, news, wikis, VocaDB, SEKAI, piapro, merch, shoot spot, internal countdowns, Tumblr RSS) |
| `5 18 * * *` | 02:05 | `/api/jobs/feeds/fetch-b` | Paced or credentialed sources (Bluesky, Tumblr API, Lemmy, YouTube) |
| `5 19 * * *` | 03:05 | `/api/jobs/feeds/check` | Prioritized safety queue: moderation, vision, frame sampling |
| `5 20 * * *` | 04:05 | `/api/jobs/feeds/plan-write` | Section planners and grounded writer |
| `5 21 * * *` | 05:05 | `/api/jobs/feeds/publish` | Deletion rechecks, atomic publish, retention, saved-copy rechecks |
| `35 9 * * *` | 17:35 | `/api/jobs/feeds/maintenance` | Storage meter, copy reconciliation, orphans, pending copies, saved-copy rechecks, retention |
| `5 22 * * 0` | Mon 06:05 | `/api/jobs/feeds/events` | Verified-event seed, conditional page reads, next-edition probes, web-search scout (≤5 tool calls), lexicon refresh, expiry |

- **Chaining:** a checkpointed stage asks the production domain to continue it; a completed stage asks for the next. At most 16 continuations per build/stage, each a new 300 s invocation. A lost continuation waits for the next cron hour or for catch-up.
- **Catch-up:** her first visit after 07:00 Singapore with no fresh edition triggers `POST /api/me/feed/catchup`. It is throttled to once per 5 minutes and runs in the background; the page never waits.
- **Deletion deadlines (Bluesky, Tumblr, Lemmy 24 h; Danbooru 72 h):**
  - Publish rechecks every item in the day's editions once a day.
  - Reads hide an item whose last successful recheck is past its source deadline, even if a later run failed.
  - Saved copies are rechecked at half the deadline, in publish (05:05) and maintenance (17:35), about 12 h apart.
  - Tumblr payloads expire 72 h after fetch and are purged; their saves keep only credit and link.
- **Maintenance timing:** the daytime maintenance run avoids overlapping the nightly chain.

## Budget and limits

| Limit | Value | Effect |
| --- | --- | --- |
| Monthly ceiling | `FEED_MONTHLY_BUDGET_USD` (US$5) | Atomic reservation per paid request; unknown/timed-out usage stays charged |
| Daily pacing | 2 × monthly ÷ 30 (≈US$0.33/day) | Pipeline requests pause for the rest of the Singapore day; diagnostics/owner tools are exempt but still inside the monthly ceiling |
| Check share | 70% of the daily pacing | Paid inspection stops early, `check` finishes, and today's edition uses what is approved |
| Paid checks queued per build | maomao 45, music 35, dressup 45, meme 15, merch 45 | Only the items most likely to be planned get vision/frame checks; the rest wait |
| Provider requests per invocation | `FEED_MAX_REQUESTS_PER_RUN` (60) | `invocation_request_limit` checkpoints and continues |
| Cumulative per build/stage | check 720, plan-write 90, events 40, maintenance 80, diagnostics 8, admin-tools 40 | `request_limit` pauses the stage |
| Diagnostic spend | US$0.50/month | Production checks refuse further paid probes after that |
| Web search | ≤5 tool calls per weekly scout | Accounted like other paid requests |

**Prices** (dated inputs, per 1M tokens: input / cached input / cache write / output):
- `gpt-5.6-luna`: 0.20 / 0.02 / 0.25 / 1.20.
- `gpt-5.4-mini-2026-03-17`: 0.75 / 0.075 / 0.75 / 4.50.
- `omni-moderation-latest`: free.

References: [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [moderation](https://developers.openai.com/api/docs/guides/moderation).

The design estimate is ≈US$1.30–1.80/month. **No live spend has been measured yet**; record the first real week's admin usage before tuning quotas.

## Storage

- **Saved copies:** a private copy only when the source's policy allows it (Danbooru, Bluesky); one media file ≤8 MiB. The warning shows at 400 MiB of copies, and new copies stop at 500 MiB, becoming honest link-only saves.
- **Whole store:** personal uploads and copies share the 1 GB private Blob store.
  - The daily meter (one list pass) and each copy check it against 1 GB minus 50 MiB headroom.
  - A fresh meter that projects past capacity refuses new upload grants with HTTP 507 `storage_full`.
  - A missing or stale meter never blocks her uploads.
- **Neon retention:**
  - Expired payloads are removed on expiry; unshown ones after 14 days, rejected ones after 30 days, seen payloads and editions after 90 days.
  - Identity (seen/hidden) and saves are permanent.

## Local verification

```bash
cd ~/projects/birthday
npm test               # all suites, isolated in-memory PGlite, no network
npm run verify:feeds   # npm test + build/leak check + phone/desktop browser flows
git diff --check
```

- **`npm run verify:feeds` browser flows (fixture edition, synthetic secrets):**
  - admin fixture build and credited preview without seen side effects, then item hide (phone and desktop)
  - feed slides in the Maomao carousel, new counts, seen after 1.5 s on screen
  - keep → saves → remove; not for me
  - merch shelf, my faves save
  - existing music player
  - no horizontal overflow on the world, saves, merch and Maomao pages
- **Artifacts:** `.data/feed-foundation/` (private, Git-ignored). Chromium must be installed (`npx playwright install chromium`) and port 5178 must be free.
- **Live source probes (local only, bounded, private record in `.data/feed-probes/`):**
  ```bash
  node scripts/probe-feed-sources.mjs --module server/feeds/sources/danbooru.js --export danbooruMaomao --pages 1
  ```
- **Don't run `npm run vercel-build` locally:** it validates production configuration and migrates the configured database. Never point fixture or reset scripts at Neon.

## Deployment and activation (owner)

1. **Review the whole working tree.** It also contains earlier birthday/drawing/game/check-in/typography/mascot and note-jar work. Run `npm run verify:feeds`, `git diff --check`, `git status --short`.
2. **Preview database check (Codex's warning still applies).** A Preview build runs migrations against whatever `DATABASE_URL` resolves to there. Point Preview at an isolated Neon branch before pushing a preview, or skip previews and deploy straight to production knowingly.
3. **Recommended setting:** `FEED_MAX_REQUESTS_PER_RUN=60` for Production. Keep `FEEDS_ENABLED=false` for now.
4. **Commit, push and deploy** (owner). Confirm the production build log shows migrations `0001_dry_kree` and `0002_awesome_wolfsbane` applied, then note the deployment ID and commit.
5. **Production checks:** `/admin` → kiriya's feeds → Production checks → Run.
   - Expect: database target and migrations ok, Blob put/read/anonymous-401/delete ok (test object `saves/diagnostic-<day>-<nonce>.png`, deleted by the check), OpenAI moderation/primary/fallback/vision ok, YouTube, Tumblr and Bluesky ok.
   - Record the results in SOURCE-VERIFICATION.md. Fix any failure before continuing; don't re-run blindly (10-minute throttle, US$0.50/month allowance).
6. **Reviewed first edition:**
   - Set `FEEDS_ENABLED=manual` and redeploy.
   - In admin, press **Run next stage** until fetch-a, fetch-b, check and plan-write are done (each press is one bounded invocation).
   - Open **Edition preview** for each section. Check credits, blurbs (voice, facts), media scope and rejection samples; hide, block or rewrite as needed.
   - Press **Run next stage** for publish, then visit `/world` as admin (preview, no seen writes).
   - Note per-stage counts, time and usage from the panel.
7. **Turn on automation:** set `FEEDS_ENABLED=true` and redeploy. The next night's crons build and publish automatically. The next morning, check stage runs, source health (Vercel-side blocks show as `blocked`), usage and storage.
8. **Rollback:** set `FEEDS_ENABLED=false` and redeploy. Scheduled work stops, the last published editions stay readable, and the site falls back to the authored slides wherever no edition exists.

## Recovery

| Situation | What to do |
| --- | --- |
| A stage failed or is `pending` | Admin → Stages → **Run now** resumes from its checkpoint (leases prevent overlap; completed provider work is reused, not re-charged) |
| `paused_for_budget` | Daily pacing clears the next Singapore day; the monthly ceiling clears next month. Don't raise the budget to hide it; check usage and quotas first |
| A bad item or blurb is live | Admin preview → Hide item / Hide creator / Hide source, or **Rewrite blurb** (published editions ask for confirmation and keep the previous text) |
| Kiriya hid something that should have been filtered | Admin → Hidden items lists her hides beside yours; tighten `feed_tuning` terms or block the creator/source |
| A source is blocked from Vercel | Health shows `blocked`/`failed` and fallback sources fill the section. To stop probing it, set `enabled:false` on its entry in `server/feeds/sources/index.js` (keep the list order) in the next deploy |
| Today's build is wrong | Admin → **Rebuild today** (new generation; the last good edition stays published until the new one publishes) |
| Copies stuck in `copying`, or storage looks off | Admin → Stages → maintenance **Run now** (meter, reconcile, orphans, pending copies) |
| Storage near full | Admin → Storage; remove old saves (Kiriya) or uploads; new copies already go link-only past 500 MiB |
| Event dates wrong or TBC | Admin → Events → Edit (records owner-confirmed dates, which later reads never overwrite) |
| Credentials rotated | Update the Sensitive variable, redeploy, run Production checks |
| Continuations not arriving | Check `CRON_SECRET` and that the deployment is Production; the next cron hour or catch-up resumes anyway |
