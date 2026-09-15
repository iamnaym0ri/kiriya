# Research: meme sources (without Reddit)

Checked live on 2026-09-14/15 by a research agent, from a home WSL box (not tested from Vercel). Raw probe outputs were kept only in a temporary scratchpad.

## Verdicts

| Source | Provides | Auth & cost | Verified live? | Verdict |
| --- | --- | --- | --- | --- |
| Reddit | Subreddit memes | Needs approval since Nov 2025 | `.json` 403; RSS 200 from a home IP only | Avoid |
| Bluesky | Feeds, author feeds, search, labels, CDN media | None | Yes | **Use** |
| Lemmy | Community memes with scores and NSFW flags | None | Yes | **Use** |
| Tumblr per-blog RSS | Blog posts with images | None | Yes (tag RSS 404) | **Use** (SEKAI blogs) |
| Tumblr `/v2/tagged` | Tag search | Free consumer key | 401 without key | Maybe (owner is getting a key) |
| Imgur API | Gallery, tag and search | Free Client-ID (non-commercial) | 401/403 without it | Maybe (content unverified; no account agreed) |
| Danbooru | Anime art in meme formats, scores, ratings | None (2-tag cap) | Yes | Maybe |
| Safebooru.org | Same art, no tag cap | None | Yes | Maybe (fallback) |
| 9GAG | — | — | 403 Cloudflare challenge | Avoid |
| Know Your Meme RSS | New entries, news, meme guides | None | 200 | Avoid (terms forbid aggregation) |
| Cheezburger/Memebase RSS | Listicles, no images | None | 200 | Avoid |
| iFunny / me.me / Memedroid | — | — | 401 / 503 / Cloudflare block | Avoid |
| YouTube / TikTok / Instagram | Embeds only | None for oEmbed | oEmbed 200; no keyless discovery | Avoid for discovery |
| Wiktionary / Wikipedia API | New slang, slang glossary | None (CC BY-SA) | 200 | **Use** (writer vocabulary) |
| Urban Dictionary API | Definitions | Terms require permission | 200 | Avoid |

## Source notes

### Reddit
- `r/animemes/top.json?t=day` returns 403 HTML. `/top/.rss` returns 200, but only from a home IP.
- Self-serve API access ended Nov 11, 2025.

### Bluesky
- **Keyless calls that work:** `getFeed`, `getAuthorFeed`, `getPosts`, `searchActors` and `getPopularFeedGenerators` all return 200 on both hosts. public.api.bsky.app responses are cached for 30 s.
- **`searchPosts` limits:**
  - 403 on public.api.bsky.app.
  - 200 on api.bsky.app, but only the first page; any `cursor` gets 403.
  - About 12 quick requests trigger a 403 for about a minute.
  - Combining a `#hashtag` with `since` returns 400.
- **Example:** `GET https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:knoh46c6xff6lrdcfs2q5y4a/app.bsky.feed.generator/aaaaabqzpdxj4&limit=100` returns 200.
  - Sample: `murmurlilies.bsky.social`, "Maomao learns about the video game industry", 358 likes, no labels.
- **Safety labels:**
  - The moderation labeler emits porn, sexual, nudity, sexual-figurative, graphic-media, self-harm, sensitive, intolerant, rude, threat and more. Authors can also carry `!no-unauthenticated`.
  - Labels catch explicit images well but suggestive ones poorly. In one cosplay feed, 27 of 100 posts were labelled, and several plainly suggestive posts were not.
  - Nothing labels drama or dark jokes in text.
- **Media:**
  - Images hotlink fine (WebP, or JPEG with an `@jpeg` suffix; 7-day cache).
  - Video is HLS (`ACAO: *`), which the iPhone plays natively.
- **Terms:** the developer guidelines require honoring deletions. `getPosts` silently drops deleted posts, so use it as the re-check.
- **Culture:** general meme feeds are mostly politics with low engagement. Many anime, Minecraft and relatable meme accounts stopped posting in 2024–25.

### Lemmy
- **Example:** `GET https://lemmy.world/api/v3/post/list?community_name=memes@lemmy.world&sort=TopDay&limit=10` returns 200.
  - Sample: "Opening my inbox these days", score 489, `nsfw: false`, image on `lemmy.world/pictrs/…`, post URL `https://lemmy.world/post/51913271`, creator `lemmy.world/u/gigaqps`.
- **Access:**
  - lemmy.world runs 0.19.19; the v4 API returns 404.
  - Read limit is 999 per 60 s per IP; search is 100 per 600 s.
  - robots.txt sets Crawl-delay 60 and doesn't block `/api`.
  - For ani.social communities, query ani.social directly.
- **Safety flags:**
  - Posts carry `nsfw`, `deleted` and `removed`, and communities carry `nsfw`, but these depend on posters and moderators.
  - memes@lemmy.world bans politics.
  - **Skip lemmyshitpost**: its top posts are political.
- **Media:**
  - pictrs images load cross-origin, and `?thumbnail=640&format=webp` works.
  - Titles are often just "me_irl" with no alt text, so the pipeline needs a vision check to know what the image shows.
- lemmy.world and ani.social sit behind Cloudflare.

### Tumblr
- **Per-blog RSS works.** Example: `https://pjsk--shitposts.tumblr.com/rss` returns 200 with 20 items, e.g. "Project Sekai stories every 5 minutes be like". Images on `64.media.tumblr.com` load cross-origin.
- **Site-wide tag RSS doesn't:** `www.tumblr.com/tagged/…/rss` returns 404.
- **API:** the tagged API needs a key (1,000/hour, 5,000/day, 20 posts per call).
- **API terms:** credit the blog and source, cache for at most 3 days, remove deletions within 24 h.
- **Dead blogs:** cosplaymemes (2013), funnyanimeshit and minecraftmemes (2019), totally-relatable (2017).

### Imgur
- The API needs a Client-ID. Couldn't confirm signups are open while logged out.
- Documented limits: about 12,500 requests/day per app, plus a per-IP hourly cap.
- Endpoints include gallery search, tags and a `mature` flag. `i.imgur.com` images load cross-origin.

### Danbooru and Safebooru
- **Example:** `GET https://danbooru.donmai.us/posts.json?tags=project_sekai+meme+rating:g&limit=20` returns 200, with artist and source fields and 720 px variants.
- **Tag limit:** `rating:` doesn't count toward the 2-tag cap, but `order:` does. `kusuriya_no_hitorigoto meme order:score rating:g` returns 422.
- **Volume:**
  - In the last 30 days, the `meme` tag had 851 general, 419 sensitive, 133 questionable and 102 explicit posts.
  - Among 100 recent general memes, the median score was 4 (top 30). 13% carried fanservice-adjacent tags, so a tag blocklist is required. 22% had English text.
- **Access:** behind Cloudflare; a unique User-Agent is required.
- **Credit:** the artist tag and source link.
- **Safebooru:** all general-rated and allowed by robots.txt, but scores are empty and posts are copied from Danbooru.

### Others
- **9GAG:** blocked by a Cloudflare challenge; its terms forbid circumventing copy restrictions.
- **Know Your Meme:**
  - Some RSS feeds return 200: `memes/submissions.rss`, `newsfeed.rss`, `editorials.rss`, `memes.rss`.
  - Trending RSS returns 404, and the popular feed stops in 2019.
  - Terms: "you may not aggregate the Content on your website or application, whether through an RSS Feed or otherwise". **Not used.**
- **iFunny, me.me, Memedroid:** blocked or unavailable.
- **Slang sources:**
  - Wiktionary's "English internet slang" category works through the API (newest first), but needs a blocklist; the newest entries include crude and political terms.
  - Wikipedia's "Glossary of 2020s slang" is actively edited.
  - Danbooru `tags.json?search[name_matches]=*_(meme)&search[order]=date` lists new anime meme formats.
  - Urban Dictionary's terms require permission.

## Volume: usable SFW memes per day, before taste scoring

| Source | Apothecary Diaries | Vocaloid/SEKAI | Cosplay | Anime | Relatable | Minecraft |
| --- | --- | --- | --- | --- | --- | --- |
| Bluesky | 0.5–1 | 1–2 | 0–0.3 | ~2 | 10+ | 0–0.5 |
| Lemmy | 0 | ~1 | 0 | ~2 | ~20 | ~0.1 |
| Tumblr RSS | ~0.1 | ~3 (1 is text) | 0 | 0 | 0 | 0 |
| Danbooru (general) | ~0 (27 ever) | ~0.3 (192 PJSK / 2,169 Vocaloid ever) | n/a | 2–5 | 0 | ~0.1 (311 ever) |

Specific places that worked:

- **Apothecary Diaries**
  - Bluesky "Kusuriya no Hitorigoto" feed `at://did:plc:knoh46c6xff6lrdcfs2q5y4a/app.bsky.feed.generator/aaaaabqzpdxj4`: 25–30 posts a day, mostly art, some labelled porn.
  - Bluesky search `q=maomao`.
  - Account @murmurlilies.bsky.social.
  - Tumblr `ghostinthegutter` (slow).
- **Vocaloid / SEKAI**
  - Tumblr `pjsk--shitposts` (1.5/day) and `project-sekai-but-incorrect` (2.2/day, text quotes).
  - Lemmy `vocaloid@ani.social` (1.3/day) and `hatsunemiku@lemmy.world` (0.6/day).
  - Bluesky feeds `at://did:plc:bw7yi2j5f7ndhemwcleiblis/app.bsky.feed.generator/aaaixmavfk7jw` (Vocaloid) and `…/aaamthrewdbhi` (Project Sekai). Both are mostly art.
- **Cosplay**
  - Nothing active. The Bluesky "Cosplay Craft" feed has occasional humor mixed with erocosplay.
  - Avoid "Bsky Goes Cosplay".
- **Anime**
  - Lemmy `animemes@ani.social` (2/day, scores 100–190) and `anime_irl@ani.social`.
  - Danbooru `meme rating:g`.
- **Relatable**
  - Lemmy: `memes@lemmy.world` (11/day), `onehundredninetysix@lemmy.blahaj.zone` (15/day), `comicstrips@lemmy.world` (9/day), `me_irl@lemmy.world` (3.5/day), `adhd@lemmy.dbzer0.com` (1/day).
  - Bluesky: @wholesomememe.bsky.social (10/day), @adhdforreal.bsky.social (bursts).
- **Minecraft**
  - Lemmy `minecraft@lemmy.world` (rarely memes).
  - The Danbooru back catalogue.
  - The Bluesky Minecraft meme accounts are dead.

## Research recommendation

**Sources**
- **Lemmy:** use it for relatable and anime memes, with TopDay for the meme of the day.
- **Bluesky:** use a fixed list of feeds and accounts. Search is optional (≤10 first-page queries spaced ≥3 s apart).
- **Vocaloid/SEKAI:** Tumblr blog RSS.
- **Apothecary Diaries:** the Kusuriya feed, with a vision check for "is this a meme".
- **Danbooru back catalogue:** fetch rarely, store IDs only.
- **Cosplay and Minecraft:** allow empty days.

**Filters, in order**
1. Bluesky labels, `!no-unauthenticated`, `automation`.
2. Lemmy `nsfw`, `deleted`, `removed`.
3. Danbooru general-rated only, plus a tag blocklist.
4. A keyword blocklist (nsfw, onlyfans, patreon, political names, death and suicide terms).
5. A vision pass for safety and taste.

**Keeping slang current**
- Daily: new Wiktionary internet-slang entries.
- Weekly: diff the Wikipedia slang glossary and collect new Danbooru `*_(meme)` tags.
- Blocklist-filter everything and give the writer a short list.

**Top risks**
1. **Suggestive content** that labels miss, and meme formats that are lewd even when rated general.
2. **Politics and dark news dominate** meme spaces (this week's political memes appeared on KYM, Wiktionary and Lemmy).
3. **Thin fandom supply** for Apothecary Diaries, cosplay and Minecraft.
4. **Fragile access:** Bluesky search rules are unpublished, Cloudflare-fronted sources are untested from Vercel, and feed generators die.
5. **Compliance:** Tumblr's 3-day cache limit and Bluesky/Tumblr deletion rules. Link rather than rehost.
