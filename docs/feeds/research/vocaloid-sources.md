# Research: Miku, Vocaloid and Project SEKAI sources

Tested live on 2026-09-15, 05:30–07:05 UTC, by a research agent and three helpers, from a home WSL machine (not Vercel). Raw responses and request scripts were kept only in a temporary scratchpad.

Disclosure from the agent: about 45 YouTube channel-page fetches got the home IP redirected to Google's "sorry" rate-limit page. Channel pages must never be scraped.

## Verdicts

| Source | Provides | Auth & cost | Verified live? | Verdict |
| --- | --- | --- | --- | --- |
| VocaDB API | Songs, PVs, credits, tags, events | None | 200 | **Use** |
| YouTube Data API v3 | Uploads, embeddability, region blocks | Free API key | Up (403 without key) | **Use** |
| YouTube oEmbed + i.ytimg.com | Embed check, author, thumbnails | None | 200 | **Use** |
| YouTube channel RSS | Last 15 uploads | None | 404 on every channel 05:31–06:43 UTC, then 200 for all 26 at 07:03 | Maybe (fallback only) |
| Niconico Snapshot API + getthumbinfo | Japanese uploads, uploader names | None; non-commercial only | 200 | Use (secondary) |
| Odesli / song.link | YouTube → Spotify/Apple links | Key only now | 401 `PUBLIC_API_ACCESS_DEPRECATED` | Avoid |
| VocaDB album links + iTunes Search | Spotify/Apple links | None | 200 | **Use** |
| Sekai-World master DB (JP/EN) | Events, units, songs | None | 200, updated 09-14 | **Use** |
| Official SEKAI news JSON (JP/EN) | News | None | 200 | **Use** |
| storage.sekai.best | Game art | None | 403 when hotlinked | Avoid |
| piapro blog RSS | Crypton news, goods, events (Japanese) | None | 200, newest 09-11 | **Use** |
| ANN press-release RSS / Siliconera tag feed | English news | None | 200 / 200 | Maybe |
| magicalmirai.com news page | Event news | None, HTML only | 200 | Maybe |
| mikufan.com / Vocaloid News Network | — | — | No DNS / last post 2021-12 | Avoid |
| Reddit | Posts | OAuth + approval | `.rss` 200, `.json` 403 | Avoid |
| Good Smile US / MyFigureCollection | Figures | — | Terms ban bots / Cloudflare 403 | Avoid (see merch research for GSC's main site) |
| Danbooru | SFW art with artist and source | None | 200 | **Use** |
| Bluesky | Artist posts | None | Unauthenticated search 403 for this agent; feeds 200 | Maybe |
| piapro.jp | Official fan works | None | No API; crawling banned (Art. 8) | Avoid |
| Tumblr | Tagged posts | API key | 401 without key | Avoid without key |
| GIPHY / KLIPY | GIFs | Key; server caching not allowed | 401 / 404 | Avoid |
| Tenor | GIFs | — | API shut down 2026-06-30 | Avoid |

## Source notes

### VocaDB
- **New Miku songs** (200):
  `GET https://vocadb.net/api/songs?artistId[]=1&childVoicebanks=true&songTypes=Original&pvServices=Youtube&sort=PublishDate&fields=PVs,Artists,Tags&maxResults=10&lang=English`
  - Sample: `{id:1033938, artistString:"Syd feat. Hatsune Miku", publishDate:"2026-09-14", pvs:[{service:"Youtube", pvId:"5Wezy_LTrGg", pvType:"Original"}]}`.
- **Artist IDs** confirmed: Miku 1, Rin 14, Len 15. `childVoicebanks=true` includes the V4X/NT/V6/SP voicebanks.
- **Volume:** 61 new Miku originals in 7 days, but only 5 scored ≥10. Filter hard, and rank new songs 48–72 hours after release, since ratings lag.
- **Top rated:**
  - `/api/songs/top-rated?durationHours=24|168&filterBy=PublishDate` works, but can't filter by artist. `filterBy=Popularity` hung, then returned 500.
  - For a single artist, use `/api/songs?artistId[]=1&childVoicebanks=true&afterDate=…&sort=RatingScore`.
- **Producers:** multiple `artistId[]` values are **ANDed**, so send one request per producer.

  | Producer | ID | Producer | ID | Producer | ID |
  | --- | --- | --- | --- | --- | --- |
  | DECO*27 | 45 | PinocchioP | 28 | Kanaria | 80976 |
  | syudou | 4834 | iyowa | 65229 | Kairiki bear | 885 |
  | MARETU | 1665 | Neru | 137 | 40mP | 8 |
  | HoneyWorks | 855 | mothy | 189 | HitoshizukuP | 103 |
  | NayutalieN | 36280 | ryo | 67 | kz | 89 |
  | Mitchie M | 624 | Chinozo | 67910 | Ayase | 70347 |
  | *Luna | 1620 | Giga | 772 | Kikuo | 470 |
  | TOKOTOKO | 305 | | | | |

- **Project SEKAI:**
  - Tag ID **7323**.
  - Units are artist entries: Nightcord at 25:00 83861, Leo/need 84782, MORE MORE JUMP! 83923, Vivid BAD SQUAD 86692, Wonderlands×Showtime 84505. VIRTUAL SINGER has no entry.
- **Rin & Len story songs:** tag 6965 with artist 14 or 15.
- **Exclusions:** `excludedTagIds[]` 9119, 9887, 10766, 11828 (AI art, video, music, vocals) and 320 (sexual content). All are community-applied.
- **Events:** `/api/releaseEvents?seriesId=82&afterDate=2026-01-01&sort=Date`. Series 81 = Magical Mirai, 82 = MIKU EXPO, 397 = COLORFUL LIVE.
- **Credits for a YouTube video:** `/api/songs/byPv?pvService=Youtube&pvId=l1UOPIr76CA&fields=Artists` returns producer, illustrator and animator.
- **Terms:**
  - No published rate limit, but "thousands per day without prior permission" counts as abuse. Cache, send a custom User-Agent, credit VocaDB.
  - Data is CC BY; images and lyrics are not covered.
  - CORS is `*`. One Cloudflare response was empty, so add retries.

### YouTube
- **Channel RSS:** returned 404 for every channel until 06:43 UTC, then 200. Daily outages are widely reported. robots.txt has `Disallow: /feeds/videos.xml`. Fallback only.
- **Data API quota** (docs updated 2026-09-14): 10,000 units a day.
  - `playlistItems.list`, `videos.list` and `channels.list` cost 1 unit each.
  - `search.list` has its own bucket of 100 calls a day.
- **Plan:**
  1. Read each channel's `UULF…` playlist, long videos only (`UUSH…` is Shorts). About 26 units a day.
  2. Call `videos.list part=status,contentDetails` for embeddability and region blocks.
  3. Search isn't needed.
- **Storage rule:** refresh or delete stored API data within 30 days (Developer Policies III.E.4).
- **oEmbed:** returns `author_name` and thumbnail, and 403 when embedding is disabled.
  - Thumbnails on `i.ytimg.com` hotlink fine.
  - Embeds need a Referer (Error 153); the site's current `strict-origin-when-cross-origin` policy is fine.

### Niconico
- **Search API:** `GET https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?q=初音ミク&targets=tagsExact&fields=contentId,title,startTime,thumbnailUrl&_sort=-startTime&_limit=5&_context=kiriya` returns 200.
- **Rules:**
  - The index rebuilds daily at 05:00 JST.
  - A User-Agent is required.
  - Non-commercial use only.
  - Wait at least as long as the previous response took.
- **Uploader details:** `ext.nicovideo.jp/api/getthumbinfo/{id}` gives the uploader nickname and whether the video is embeddable.

### Spotify and Apple links
- **Odesli:** returns 401; its public API was retired 2026-07-31.
- **Replacements:**
  - VocaDB `/api/albums/{id}?fields=WebLinks` lists Spotify and Apple Music links.
  - `https://itunes.apple.com/search?term=…&entity=song&country=SG` returns `trackViewUrl`, at about 20 calls a minute.
- **Spotify's own API** now requires an app owned by a Premium account (Feb 2026 change).

### Project SEKAI
- **Master DB:**
  - `https://sekai-world.github.io/sekai-master-db-diff/events.json` returns 200 with CORS `*` and ETag support; last modified 2026-09-14.
  - The Global/EN copy is `sekai-master-db-en-diff`.
  - Skip `gachas.json` (47 MB).
- **Event fields:** `name`, `unit` (`school_refusal` = Nightcord), and `startAt`/`aggregateAt` in epoch ms. **Only show rows where `startAt <= now`**: future rows are datamined and unannounced.
- **Images:** storage.sekai.best returns 403 when hotlinked, and SEGA forbids reposting its images. Use text and official links only.
- **Official news:**
  - JP: `https://pjsekai.sega.jp/master-data/json/news/index.json` (`title`, `publishedAt`, `category`).
  - Global/EN: `https://www.colorfulstage.com/news/all/entries.txt`. It's JSON with trailing commas, so parse leniently.

### News
- **piapro blog:** `https://blog.piapro.net/feed` returns 200.
  - About 8 posts a week, Japanese only, supports 304.
  - Topic feeds: `/tag/event-magical-mirai/feed`, `/tag/goods-figure/feed`.
- **ANN:** the press-release feed (`/press-release/rss.xml?ann-edition=w`) had 2 Miku items out of 40; the main feed had 0 out of 212. Credit, link and rewrite.
- **Siliconera:** `/tag/hatsune-miku/feed/` returns 200 but sits behind Cloudflare.
- **Reddit:** robots.txt disallows everything; `.rss` hit its rate limit after one call; new API access needs approval.

### Fan art and GIFs
- **Danbooru:** `GET https://danbooru.donmai.us/posts.json?tags=hatsune_miku -ai-assisted rating:g status:active age:<1w score:>=10&limit=20` returns 200.
  - **Tag limit:** anonymous users get 2 tags. Negations and `order:` count; `rating`, `status`, `age` and `score` don't.
  - **Filtering in code:** Danbooru deletes `ai-generated` posts, but still drop `ai-assisted`, `is_deleted` and `is_banned` yourself.
  - **Access:** about 1 request/second with an honest User-Agent; fake browser UAs get challenged. `cdn.donmai.us` hotlinks.
  - **Real GIFs:** `hatsune_miku animated_gif`.
- **Bluesky:**
  - Unauthenticated search returned 403 for this agent.
  - A public "Miku illustrations, AI excluded" feed returned 200, but 2 of its top 3 posts were labeled porn.
  - Pull only allowlisted artists via `getAuthorFeed`, drop labelled posts, or search with a login.
- **piapro.jp:** crawling banned. **GIPHY and KLIPY:** client-side only, no caching. **Tenor:** shut down.

## Verified channel IDs

All returned RSS 200 at 07:04 UTC on 2026-09-15. "S" means the latest upload was a Short; the date in brackets is the latest long video.

| Channel | channel_id | Last upload |
| --- | --- | --- |
| Project SEKAI COLORFUL STAGE (JP) | UCdMGYXL38w6htx6Yf9YJa-w | 2026-09-15 |
| HATSUNE MIKU: COLORFUL STAGE! (EN / Global) | UCeWCjteIDYK34E7bCZBTcLA | 09-13 S (08-28) |
| Hatsune Miku (Crypton; Magical Mirai / Expo videos) | UCJwGWV914kBlV4dKRn7AEFA | 09-12 S (09-05) |
| piaproTV (Crypton) | UCgfXaWxRyF0WGZtktVliryQ | 09-13 S (08-30) |
| DECO*27 | UCGmO0S4S-AunjRdmxA6TQYg | 09-14 S (09-04) |
| PinocchioP | UCMMBGMjrrWcRZmG_lW4jC-Q | 2026-08-22 |
| Kanaria | UC10BM9XdLdrvB8japwmRUvA | 2025-12-14 S (2025-11-15) |
| syudou | UCraC7460yGQF4GDmSjCecpQ | 09-14 S (09-12) |
| iyowa | UCLz6MG2kx_0xeaW0LowYnMQ | 2026-08-22 |
| Kairiki bear | UCp13SxKXbhCS0lb6Ty774iQ | 2026-01-09 |
| MARETU | UCmj0YkPwo47bPoBt9ma-bxg | 2025-12-30 |
| Neru OFFICIAL | UClxXuM2m0rIL9VCA1ds9HqA | 2026-09-01 |
| 40mP | UCG09qajPDZdPtLsTkW7mJQA | 2026-05-29 |
| HoneyWorks OFFICIAL | UCAaGaynFpku5cAx6OOSrW-w | 08-31 S (08-28) |
| mothy | UCSmHk3xH3nkWqF0nm9z2-2Q | 2026-07-10 |
| HitoshizukuP × Yama△ | UCxKrjx1FDU81UXuwTgwYQHw | 2026-01-16 |
| Nayutan Seijin | UChK8kgGU767nKTxp4f4GD6g | 2026-06-28 |
| ryo (supercell) | UCy9UVm-UjHqcktvxg-sS4qQ | 2026-05-14 S |
| kz (livetune) | UCQcboHvGXFE5vuy2AK2MUOg | 2026-03-09 |
| Mitchie M | UCE0uNSkGhhsNMwAZcIQY7rw | 2026-03-26 |
| TOKOTOKO | UCfdFNsR_tvF8bwp0KhMaJZQ | 2026-05-26 |
| Chinozo | UCft5HulDeuKloukyShxyOZA | 08-23 S (08-16) |
| Ayase | UCoQS4Xewa-LIS2E8CBSjkgA | 08-30 S (08-28) |
| *Luna | UCGGY3oTOQ9g9FCu9hLFJsqw | 2026-09-14 |
| Giga | UCvq3kUGY5Dbsdkr3DZx25Sw | 2025-06-14 S (2025-05-27) |
| Kikuo | UCq3vSkJtBZdBjC8yrG-1xmA | 2026-08-22 |

Traps to avoid:
- VocaDB's Ayase entry links YOASOBI's channel (UCvpredjG93ifbCP1Y77JyFA).
- UCfuBLr03CN1OWKP0XS5GqFA is HoneyWorks' second channel.
- MIKU EXPO has no channel of its own.

## Facts current as of 2026-09-15

**Tours and Magical Mirai**
- **MIKU EXPO 2026 Europe** runs through November: London 11-12, Brussels 11-14, Amsterdam 11-15, Berlin 11-17, Düsseldorf 11-20, Paris 11-22, Madrid 11-24/25, Lisbon 11-27 ([site](https://mikuexpo.com/europe2026/)).
  - The North America leg ran 04-12 to 05-19.
  - **No Asia or Singapore dates are announced for 2026 or 2027.** The last Singapore show was 2025-11-19 ([asia2025](https://mikuexpo.com/asia2025/)).
- **Magical Mirai 2026** is finished (Hamamatsu, Osaka, Tokyo).
  - **2027 is announced for July–August** in Hiroshima, Osaka and Tokyo, with no overseas editions ([site](https://magicalmirai.com/2026/index_en.html)).

**Project SEKAI events and concerts**
- **6th Anniversary Thanks Festival:** 10-03/04 at Tokyo Metropolitan Gymnasium.
  - Cinema live viewings in Japan, Taiwan, Hong Kong, Korea, Malaysia and Indonesia, **but not Singapore** ([LVE](https://www.liveviewing.com/events/pjsekai_6thanniversary/)).
- **COLORFUL LIVE 6th - Crossing -:** Kobe 2026-12-25–27, Yokohama 2027-02-26–28.
  - Overseas live viewing is "coming soon".
- **Next three months:**
  - The JP 6th anniversary is on 09-30.
  - The JP event "Drive to Dream!" (Wonderlands×Showtime) ends 09-20.
  - The **Global (EN) World Link finale "Wishes in Bloom!" runs 09-26 to 09-29.**
  - The EN 5th anniversary is likely around early December, going by last year's timing, but **nothing is announced**.

## Research recommendation
1. **Songs:** VocaDB as the core, with new, top-rated, per-producer and Rin & Len story-song queries. Exclude AI and sexual tags.
2. **Official channels:** YouTube Data API on `UULF` playlists. Match videos back to VocaDB (`byPv`) for credits, and check embeddability and Singapore region blocks. Keep RSS as a fallback outside the 05:30–07:00 UTC outage window.
3. **Project SEKAI:** the Sekai-World JP/EN master DB plus the official news JSON. Text and links only.
4. **Spotify/Apple links:** VocaDB album links first, then iTunes Search on the Singapore store.
5. **News:** piapro blog feeds, plus ANN press releases and Siliconera, filtered by keyword.
6. **Art:** Danbooru `rating:g`, score ≥10 within the week, credited. Use Danbooru `animated_gif` for GIFs.

**Top risks:**
- Cloud IPs (Danbooru and Siliconera sit behind Cloudflare; niconico untested from Vercel).
- Community-applied SFW labels.
- YouTube RSS fragility, and the 30-day data refresh rule.
- SEKAI datamined rows (filter `startAt <= now`).
- Rating lag on new songs.
