# Research: Maomao / Apothecary Diaries sources

Checked live 2026-09-14/15 by a research agent. Requests ran from a home WSL machine whose traffic exits in Texas, not from Vercel. Anything marked as a cloud-IP risk still needs a check from a Vercel preview deployment. Raw responses were kept only in a temporary scratchpad.

## Verdicts

| Source | Provides | Auth & cost | Verified live? | Verdict |
| --- | --- | --- | --- | --- |
| Danbooru API | Fan and official art, a few MP4 clips | None; requires a custom User-Agent | 200 | **Use**: primary |
| Bluesky `searchPosts` on `api.bsky.app` | Fan art, video, posts | None | 200; `public.api.bsky.app` returns 403 | **Use**: secondary |
| Bluesky "Kusuriya no Hitorigoto" custom feed | Posts with images | None | 200 | **Use**: fallback |
| Sakugabooru API | Anime cuts as MP4, credited to animators | None | 200 | Maybe |
| Safebooru.org | Partial mirror of Danbooru | None | 200 | Maybe: fallback |
| Tumblr `/tagged` | Art, GIF sets | Consumer key (needs an account) | 401 without key | Maybe (key agreed by owner) |
| Zerochan JSON | Art | User-Agent must include a Zerochan username | 200 | Avoid |
| Gelbooru | Art | api_key + user_id | 401 | Avoid |
| Reddit | Discussion, fan art | OAuth, approval required | 403 / 429 / login wall | Avoid |
| Pixiv | Art | No official API | Image CDN 403 without Referer | Avoid; link via Danbooru source |
| DeviantArt | Art | API needs an app; RSS is keyless | API 401, RSS 200 | Avoid |
| GIPHY | GIFs | Key (account); beta key 100 calls/hour | 401 | Avoid: terms forbid filtering or mixing |
| Tenor | GIFs | — | 403; API shut down | Avoid |
| KLIPY | GIFs | Key (account); test key 100 requests/hour | 204 without key | Avoid: terms |
| AniList GraphQL | IDs, airing schedule | None; non-commercial use only | 200 | **Use** |
| Anime News Network RSS (SEA edition) | News | None | 200 | **Use** |
| Crunchyroll News RSS | News | None; undocumented host | 200 | **Use** |
| Anime Corner RSS | News | None | 200 | **Use** |
| MyAnimeList news RSS | News | None | 200 | Maybe |
| Official site | News | — | 403 Cloudflare challenge | Avoid; link only |
| Jikan | MyAnimeList data | None | 504 unless cached | Avoid |
| Fandom MediaWiki API | Lore, episode tables | None; CC BY-SA | 200 | **Use** |
| Wikipedia API | Episode list, volume dates | None; CC BY-SA 4.0 | 200 | **Use** |
| oEmbed (YouTube, X, Bluesky, Tumblr) | Embeds for URLs already in hand | None | 200 | **Use** |

## Source notes

### Danbooru
- **Tag:** `maomao_(kusuriya_no_hitorigoto)` has 2,062 posts. Skip `maomao_(bubbles)_…`, an April Fools costume.
- **Example request** (200, 37 posts):
  `GET https://danbooru.donmai.us/posts.json?tags=maomao_(kusuriya_no_hitorigoto)+-ai-generated+rating:g+score:>=10+age:<60d&limit=50&only=id,rating,score,fav_count,file_ext,tag_string_artist,tag_string_character,tag_string_meta,source,pixiv_id,media_asset[variants]`
- **Tag limit:** anonymous searches allow 2 tags.
  - `rating`, `score`, `favcount`, `age`, `date`, `filetype`, `status` and `limit` don't count.
  - `order:score` and `order:favcount` do count. Tag + `-ai-generated` + `order:score` returns a 422 tag-limit error.
  - So filter AI tags in code, using `tag_string_meta`.
- **Counts:**
  - Ratings: general 1,239; sensitive 420; questionable 110; explicit 293.
  - Animated: 21 posts, all MP4; 10 are general-rated.
  - `ai-generated` 10, `ai-assisted` 8.
  - Jinshi appears on 562 of the general-rated posts. Ships are allowed, so he isn't filtered.
- **Rate limits:** bursts of 10 requests/second; "around 1 request per second" sustained.
- **Blocking:** Node fetch's default User-Agent gets 403 (`cf-mitigated: challenge`); a custom User-Agent gets 200. Cloudflare is tightening against bots, so blocking from Vercel IPs is a moderate risk.
- **Media:**
  - Sizes 180/360/720 (webp), sample and original.
  - `cdn.donmai.us` returns 206 with a foreign Referer, plus `access-control-allow-origin: *` and `cross-origin-resource-policy: cross-origin`. Hotlinking works; use 720 or sample.
- **Credit:** `tag_string_artist` plus `source` (X, pixiv, Bluesky, bilibili). For pixiv, link `https://www.pixiv.net/artworks/{pixiv_id}`.

### Bluesky
- **Example:** `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=maomao%20fanart&sort=top&limit=50` returns 200.
  - 1,173 hits; all 49 returned posts had media.
  - `tag=` works. `猫猫 薬屋のひとりごと` finds 9,183 hits.
- **Fragile:** the API definition says search "may require authentication". Bursts get 403 "Request forbidden by administrative rules". One request every 15 seconds worked 6 of 6 times.
- **Fallback feed:** `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:knoh46c6xff6lrdcfs2q5y4a/app.bsky.feed.generator/aaaaabqzpdxj4` returns 200.
- **Fields:**
  - `author.handle`, `displayName`, `uri`, image `alt`.
  - Images: `embed.images[].fullsize` (`cdn.bsky.app/img/feed_fullsize/plain/{did}/{cid}`), fine in `<img>`.
  - Video: HLS `video.bsky.app/…/playlist.m3u8`, plays natively on iOS. `presentation: "gif"` marks GIF-style clips.
- **Safety:**
  - Labels mix self-labels with Bluesky moderation labels (`did:plc:ar7c4by46qjdydhdevvrndac`). A "#rule34" post matched `tag=fanart`.
  - Skip authors labelled `!no-unauthenticated`; they opted out of being shown to logged-out viewers.
- **oEmbed:** `embed.bsky.app/oembed` returns 200.

### Sakugabooru
- `https://www.sakugabooru.com/post.json?tags=kusuriya_no_hitorigoto+order:score&limit=5` returns 200; 141 MP4 cuts in total.
- `source` names the episode; tags name the animators. There are no character tags, so Maomao isn't guaranteed to appear (vision-check the sample image).
- Files are about 6 MB. Hotlinking returns 206. robots.txt: `search=yes, ai-train=no`.

### Safebooru and Gelbooru
- Safebooru's JSON API returns 200 (1,168 posts), all copied from Danbooru, with no score, no artist field and no animated posts.
- Gelbooru returns 401 without a key.

### Zerochan
- The JSON API works.
- The User-Agent must include a project name and a Zerochan username; limit 60 requests/minute; Crawl-delay 10.
- There's no rating field, and the full-size image is swapped for a smaller one when the Referer is foreign.

### Tumblr
- `/v2/tagged` returns 401 without a key.
- Up to 20 posts per call; limits 1,000/hour and 5,000/day per key.
- GIFs are NPF image blocks (`image/gif` plus a `poster`).
- `64.media.tumblr.com` works in `<img>` (ACAO *). oEmbed works without a key.

### Reddit
- `/r/KusuriyaNoHitorigoto/about.json` returns 403 "blocked by network security", even from a home IP. `.rss` returns 429.
- Self-serve API keys ended in November 2025 (Responsible Builder Policy).
- r/KusuriyaNoHitorigoto and r/TheApothecaryDiaries both exist.

### Pixiv and DeviantArt
- Pixiv has no public API and its terms ban crawlers. `i.pximg.net` returns 403 without a pixiv Referer.
- DeviantArt's API needs a registered app. Its keyless RSS returned fetish art rated `nonadult` for `q=maomao`.

### GIF APIs
- **GIPHY** terms say "Do not cache media URLs", "requests… directly from the client side", "Do not reorder content or filter out our content" and "Do not mix GIPHY's content with content from other providers". That rules out a filtered, mixed edition built on the server.
- **Tenor:** no new keys since 2026-01-13; the API shut down on 2026-06-30.
- **KLIPY** requirements ban server-side calls, storing media, filtering and mixing.

### AniList
- `POST https://graphql.anilist.co` with `media(id_in:[195516,200927,200929])` returns 200.
- **195516** (3rd Season, MAL 61987): starts 2026-10-02. `nextAiringEpisode` is episode 1 at `airingAt` 1790949600 (23:00 JST / 22:00 SGT). The episode count is null; the weekly schedule is probably a placeholder.
- **200927:** S3 part 2 (MAL 62841), April 2027.
- **200929:** film *Bouhi no Hihou* (MAL 62844), 2026-12-11.
- **Other IDs:** S1 161645, S2 176301, manga 99022, light novel 99026, Maomao 126824.
- **Rate limit:** 30 requests/minute (degraded). Terms: non-commercial use, no hoarding.

### News RSS
All return 200. Filter on `apothecary|kusuriya|maomao|薬屋`, and summarize rather than republish.
- **ANN** `https://www.animenewsnetwork.com/all/rss.xml?ann-edition=sea`: 216 items covering 7 days, with categories.
- **Crunchyroll** `https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss`: 50 items covering about 3 days, with author and thumbnail.
- **Anime Corner** `https://animecorner.me/feed/`: 25 items covering about 3 days.
- **MyAnimeList** `https://myanimelist.net/rss/news.xml`: 20 items covering 5 days.

### Official site and Jikan
- The official site is WordPress behind a Cloudflare challenge (403 everywhere). News lives at `/news/{id}/`, so link it but don't fetch it.
- Jikan `/v4/anime/61987` returns 504 ("failed to connect to MyAnimeList").

### Fandom
- The wiki is `kusuriya.fandom.com` (582 articles, CC BY-SA).
- `api.php?action=parse&page=Maomao&prop=wikitext&format=json` returns 200; the HTML pages get a Cloudflare challenge.
- Episode tables are at `The_Apothecary_Diaries_(Anime)/Episodes_S3` (a placeholder so far).
- Character infoboxes carry `light_novel`, `manga_main` and `anime` debut fields.
- Blurbs based on wiki text inherit CC BY-SA attribution.

### Wikipedia
- `en.wikipedia.org/w/api.php?action=parse&page=List_of_The_Apothecary_Diaries_episodes&prop=wikitext&format=json` returns 200.
- `{{Episode list}}` entries give Title, OriginalAirDate and ShortSummary for S1–S2.

### oEmbed and YouTube feeds
- YouTube oEmbed (e.g., Netflix's S3 trailer `8MvGAacTwm0`) and `publish.x.com/oembed` both return 200 without keys.
- YouTube channel RSS returned 404 for every channel. The cosplay research also found it disallowed by robots.txt.

## Facts current as of 2026-09-14

- **Season 3:**
  - Premieres Friday 2 Oct 2026, 23:00 JST (22:00 SGT), in NTV's FRIDAY ANIME NIGHT block. The second cour starts April 2027.
  - Sources: [ANN](https://www.animenewsnetwork.com/news/2026-09-09/the-apothecary-diaries-series-gets-new-mystery-game-for-consoles-pc/.241582), [AniList](https://anilist.co/anime/195516).
- **Streaming in Southeast Asia:**
  - Netflix says S3 premieres "only on Netflix in select regions of Asia on October 2" ([Netflix Anime](https://x.com/NetflixAnime/status/2098246404250505557)).
  - [Crunchyroll's S3 territory list](https://www.crunchyroll.com/news/announcements/2026/6/3/the-apothecary-diaries-season-3-gachiakuta-season-2-anime-stream-crunchyroll) leaves out Southeast Asia.
  - No source names Singapore specifically.
- **Film:** *The Deceased Empress' Treasure* opens in Japan on 11 Dec 2026, with an original story. No Southeast Asian date has been announced.
- **Manga and novels:**
  - Japanese manga vol. 17 came out 24 Jul 2026 ([Square Enix](https://magazine.jp.square-enix.com/top/comics/detail/9784301006558/)).
  - English manga vol. 16 is due 3 Nov 2026 ([PRH](https://www.penguinrandomhouse.com/books/829633/the-apothecary-diaries-16-manga-by-story-by-natsu-hyuuga-art-by-nekokurage-compiled-by-itsuki-nanao-character-design-by-touco-shino/)).
  - *Maomao's Notes on the Inner Palace* English vol. 1 is due 20 Oct 2026 ([VIZ](https://www.viz.com/manga-books/manga/apothecary-diaries-maomao-s-notes-on-the-inner-palace-volume-1-0/product/9014)).
  - *Xiaolan's Story* English vol. 1 is due 6 Oct 2026.
  - The English light novel vol. 16 came out 29 May 2026.
- **Game:** *The Apothecary Diaries: The False Imperial Brother* (Koei Tecmo / Gust) arrives early 2027 on Switch 2, Switch, PS5 and PC ([Gematsu](https://www.gematsu.com/2026/09/koei-tecmo-and-gust-announce-the-apothecary-diaries-the-false-imperial-brother-for-ps5-switch-2-switch-and-pc)).

## Research recommendation (before the owner's answers)

The recommended mix:
- **Slides:** Danbooru daily, plus Bluesky top search with the custom feed as fallback.
- **Clips:** Danbooru MP4s, Bluesky GIF-style videos and Sakugabooru cuts, played as muted inline loops.
- **News:** AniList plus the ANN SEA, Crunchyroll and Anime Corner feeds.
- **Lore:** Fandom and Wikipedia.

The owner has since answered that nothing is a spoiler and ships are fine, so the spoiler and Jinshi filters from the original report are dropped.

**Top risks:**
- Cloudflare blocking Vercel IPs (Danbooru, Fandom).
- Bluesky's keyless search is unofficial and throttled.
- SFW ratings and labels are human-applied, so image moderation is still needed.
- Vercel Hobby cron and function limits.
