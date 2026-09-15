# Research: AI costs and platform limits

Checked 2026-09-14 against official docs and pricing pages; links are at the end. No paid API was called.

## OpenAI models (per 1M tokens)

`gpt-5.4-mini-2026-03-17` is still listed and not on the deprecations page. The newest lineup is GPT-6 Astra and GPT-5.6 Sol, Terra and Luna; there is no 5.6 mini. `gpt-5.6-luna` "roughly corresponds to the nano model tier". Luna, 5.4-mini and 5.4-nano all support Structured Outputs, web search and image input.

| Model | Input | Cached input | Output | Batch/Flex in / out |
| --- | --- | --- | --- | --- |
| gpt-5.6-luna | $0.20 | $0.02 (cache writes $0.25) | $1.20 | $0.10 / $0.60 |
| gpt-5.4-mini | $0.75 | $0.075 | $4.50 | $0.375 / $2.25 |
| gpt-5.4-nano | $0.20 | $0.02 | $1.25 | $0.10 / $0.625 |

### Monthly estimates (30 days)

| Scenario | Arithmetic | Luna | 5.4-mini |
| --- | --- | --- | --- |
| **(a)** Daily writer: 60 items, batches of 15 with a 2k-token prompt, 250 input tokens and 60 output tokens per item | 23,000 input/day → 0.69M/month; 3,600 output/day → 0.108M/month | **$0.27** | **$1.00** |
| **(b)** (a) plus 10 web searches/day | 300 calls × $10 per 1K = $3.00, plus assumed search content tokens | **$4.19** | **$7.45** |
| **(c)** (b) plus 30 low-detail image checks/day | 900 images × (≤308 image + 200 prompt tokens) | **$4.32** | **$7.95** |

Notes:
- **Search content tokens are an assumption.** OpenAI publishes a fixed count only for older models.
- **Luna settings:** its default `reasoning.effort` is `medium`, and reasoning tokens are billed as output. Set `none` for the writer and `low` for search. It has no dated snapshot to pin. GPT-5.6 cache writes cost 1.25× input, so place an explicit cache breakpoint after the static persona prompt.
- **Vision:** on 5.6 models, low detail shrinks images to fit 512×512 (≤308 tokens). On the 5.4 family, "low" can still use many tokens, so resize to ≤512 px first.
- **Moderation is free**, and screens images for the sexual category.
- **Batch/Flex** halves token prices (no discount on the search fee); Flex can return 429s.
- **`web_search` tool:**
  - Pricing: $10 per 1K calls plus content tokens.
  - `allowed_domains` and `blocked_domains` (up to 100 each); user location, e.g. Singapore; `max_tool_calls` caps spend.
  - Citations come as `url_citation` annotations and must be shown clickable.

## Platform limits

| Service | Limit |
| --- | --- |
| Vercel Hobby functions | 300 s default and max (Fluid compute); 2 GB / 1 vCPU; 4.5 MB request/response body |
| Hobby included usage | 1M invocations; 4 active CPU-hours (I/O waiting not counted); 360 GB-hours memory; 100 GB Fast Data Transfer; 10 GB Fast Origin Transfer. Over the limit, you usually wait 30 days. Runtime logs are kept for 1 hour |
| Cron (Hobby) | 100 per project, each at most once a day. Fires anywhere within the scheduled hour (±59 min), in UTC. No retries, and a run may fire more than once. `CRON_SECRET` is sent as a Bearer token |
| `waitUntil` | Node and Edge; shares the function's timeout and is cancelled when it times out |
| Image Optimization (Hobby) | 5K transformations, 300K cache reads and 100K cache writes per month; after that, new images return 402. GIFs are served as-is |
| Blob (Hobby) | 1 GB-month storage, 10K simple ops, 2K advanced ops (put/copy/list), 10 GB transfer. **Over the limit, Blob is blocked for 30 days.** Private stores cost the same; streaming through a function adds transfer |
| Hobby eligibility | "Hobby teams are restricted to non-commercial personal use only." "Never fair use" includes "Proxies and VPNs", "Media hosting for hot-linking" and "Scrapers" |
| QStash free tier | 1,000 messages/day (soft limit); 10 active schedules; 7-day max delay; 15-minute response window; `CRON_TZ=Asia/Singapore` supported |
| Neon free tier | 100 CU-hours/month; 0.5 GB storage; 5 GB egress; scales to zero after 5 min idle. Out of compute hours: suspended until next month. Storage full: writes fail |
| GitHub Actions (private repo) | 2,000 min/month on Free. 5-minute minimum interval. Scheduled runs can be delayed or dropped |

## Media on iOS

- **Referrer:** `referrerpolicy="no-referrer"` works on `<img>` in Safari 14+. `<video>` has no such attribute, so use `<meta name="referrer" content="no-referrer">`. A blank Referer is a fine privacy default. Using it on purpose to get around a site's hotlink blocking isn't acceptable; link out or use that site's API instead.
- **Autoplaying loops:** use `<video autoplay muted loop playsinline preload="metadata" poster>`.
  - Low Power Mode disables autoplay, so catch the rejected `play()` promise and show the poster.
  - Prefer MP4 over GIF: GIFs are "up to 12 times as expensive in bandwidth and twice as expensive in energy". GIPHY itself says to use MP4.

## Recommendation

- **Scheduling:**
  - Run the daily job from Vercel Cron in the early Singapore morning.
  - Guard it with `CRON_SECRET`, a Postgres advisory lock and idempotent upserts, since runs can be missed or doubled.
  - Split stages into separate invocations (each ≤300 s) and keep all state in Neon.
  - Don't stack crons to fake hourly runs.
- **AI:**
  - Make AI calls only in the daily job, never per visit.
  - Use Luna with strict schemas and 5.4-mini as fallback.
  - Run free moderation first, then vision checks at ≤512 px.
  - For AI-art detection, trust source tags over the model's guess.
- **Media:**
  - Hotlink source media, preferring MP4.
  - Cache only small thumbnails in private Blob.
  - Don't run an open image proxy.

## Sources

**OpenAI**
- Pricing: https://developers.openai.com/api/docs/pricing
- Models: https://developers.openai.com/api/docs/models/gpt-5.4-mini, https://developers.openai.com/api/docs/models/all, https://developers.openai.com/api/docs/models/gpt-5.6-luna, https://developers.openai.com/api/docs/models/gpt-5.4-nano
- Deprecations: https://developers.openai.com/api/docs/deprecations
- Guides: https://developers.openai.com/api/docs/guides/images-vision, https://developers.openai.com/api/docs/guides/prompt-caching, https://developers.openai.com/api/docs/guides/reasoning, https://developers.openai.com/api/docs/guides/moderation, https://developers.openai.com/api/docs/guides/flex-processing, https://developers.openai.com/api/docs/guides/tools-web-search
- API reference: https://developers.openai.com/api/reference/resources/responses/methods/create

**Vercel**
- Functions: https://vercel.com/docs/functions/configuring-functions/duration, https://vercel.com/docs/functions/configuring-functions/memory, https://vercel.com/docs/functions/limitations, https://vercel.com/docs/functions/usage-and-pricing, https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- Plans and limits: https://vercel.com/docs/plans/hobby, https://vercel.com/docs/limits/fair-use-guidelines, https://vercel.com/pricing
- Cron: https://vercel.com/docs/cron-jobs/usage-and-pricing, https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Image Optimization: https://vercel.com/docs/image-optimization/limits-and-pricing
- Blob: https://vercel.com/docs/vercel-blob/usage-and-pricing, https://vercel.com/docs/vercel-blob/vercel-signed-urls

**Schedulers and database**
- Upstash QStash: https://upstash.com/pricing/qstash, https://upstash.com/docs/qstash/features/schedules
- Neon: https://neon.com/pricing, https://neon.com/docs/introduction/plans
- GitHub Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions, https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

**Media**
- GIPHY: https://developers.giphy.com/docs/optional-settings/
- Tenor shutdown: https://support.google.com/tenor/answer/10455265
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img
- Apple/WebKit video: https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari, https://webkit.org/blog/6784/new-video-policies-for-ios/
