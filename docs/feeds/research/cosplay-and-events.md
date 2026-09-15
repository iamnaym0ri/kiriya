# Research: cosplay sources and events

Checked live 2026-09-15 by a research agent. Requests ran from a home WSL machine whose traffic exits in the US. Nothing was tested from Singapore or from Vercel. Raw evidence was kept only in a temporary scratchpad.

Disclosure from the agent: one helper sent a single request to RedNote's internal web API, which RedNote's robots.txt disallows. It returned an error. No other rule was broken.

## Verdicts

| Source | Provides | Auth & cost | Verified live? | Verdict |
| --- | --- | --- | --- | --- |
| Bluesky search (`api.bsky.app`) | Cosplay photos by tag or character, safety labels | None | 200; `public.api.bsky.app` 403 | **Use** (primary) |
| YouTube Data API + oEmbed | Tutorials, channel uploads | Free API key | 403 without key; oEmbed 200 | **Use** |
| Arda Wigs Atom feed, SoraNews24 cosplay tag feed | Wig news and contests, cosplay news | None | 200 | **Use** |
| Official event pages | Dates | None | Mostly 200 | **Use** |
| Flickr REST API | Convention photos, license, safe search | Key requires Flickr Pro | Keyless feed works, but robots.txt disallows it | Maybe |
| Tumblr | Cosplayer blogs | `/tagged` needs an app key; per-blog RSS keyless | 401 / 200 | Maybe (blog RSS, or the key agreed by the owner) |
| TikTok oEmbed | Embeds for known links | None | 200; thumbnails expire in ~48 h | Maybe (hand-picked links only) |
| Kamui Cosplay RSS | About 2 posts a year | None | 200, body takes ~100 s | Maybe |
| acgevents.sg JSON | Best Singapore anime/comics/games event listing | Terms ban bots without permission | 200 | Maybe (needs permission; owner declined to ask) |
| Reddit | Best character-specific cosplays | App self-service closed Nov 2025; RSS ~1 request/min | `.json` 403; RSS 200/429; robots `Disallow: /` | **Avoid** |
| Instagram | Embed markup only, no author | Hashtag API needs a Business account + app review | oEmbed 200 | Avoid |
| DeviantArt | Mostly fan art and AI art | App required | API 401; RSS 200 | Avoid |
| WorldCosplay | Nothing | — | Domain serves gambling spam | **Avoid** |
| Pinterest | Search covers only your own pins | OAuth | 401 | Avoid |
| RedNote, Lemon8 | Nothing usable | — | robots `Disallow: /`; oEmbed 404 | Avoid |
| Epic Cosplay Wigs blog | Dormant since 2023 | None | 200 | Avoid (use their YouTube) |
| Eventbrite, Peatix search | Nothing relevant | — | 404 / 302 | Avoid |
| Telegram @CosEventSG | Singapore events | None | Last post 2025-07-23 | Avoid (stale) |

## Source notes

### Bluesky
- **Example:** `GET https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=cosplay&tag=maomao&sort=latest&limit=25` returns 200 with `hitsTotal` 212; 23 of the 25 posts have images.
  - Sample post: `leviacosplays.bsky.social`, "Day 2 🌸♥️ #cosplay #maomao #mangacon".
  - `q=miku cosplay&sort=top` finds 5,162 hits.
- **Limits:** passing any `cursor` returns 403, so logged-out searches get one page (up to 100 posts) per query. Run many narrow queries with `since=` instead of paging.
- **Safety:**
  - 12 of the 100 latest `q=cosplay` posts carried labels (porn, sexual, nudity).
  - 5 authors carried `!no-unauthenticated` or `!hide`.
  - Drop any labelled post or author. Labels lag, so still moderate images.
- **Credit:** `author.displayName` and `@handle`. Post URL: `https://bsky.app/profile/{handle}/post/{rkey}`.
- **Media:** `https://cdn.bsky.app/img/feed_fullsize/plain/{did}/{cid}` returns 200 (webp, cached 7 days), fine in `<img>`.
- **Terms:** the developer guidelines require honouring deletions. Re-check displayed posts with `app.bsky.feed.getPosts` (200 keyless).

### YouTube
- **Quota** (docs updated 2026-09-14): `search.list` has its own bucket of 100 calls/day at 1 unit each. Every other method shares 10,000 units/day. `playlistItems.list` costs 1 unit.
- **Channel RSS** (`/feeds/videos.xml`) is disallowed in robots.txt and reported flaky, so don't use it.
- **oEmbed** returns 200 with `author_name` and a stable `i.ytimg.com` thumbnail (CORS open).
- **Safety:** `safeSearch=strict`, and check `contentRating.ytRating` via `videos.list`.
- **Terms:** stored API data must be refreshed or deleted within 30 days.
- **Tutorial channels.** Uploads playlist ID = `UU` + the channel ID with its leading `UC` removed.

| Channel | ID | Focus |
| --- | --- | --- |
| Kleiner Pixel | `UCJifGeBP7fl59XwxeUYM7ag` | Anime and Genshin makeup |
| Kamui Cosplay | `UC79qFuymkVas5dCScbLF9fw` | Armour and props |
| Hanie Comb | `UCn5_or6x8HqYbl3kVDimgJg` | Wigs, including Project SEKAI |
| Epic Cosplay Wigs | `UCJRIterpI7fH_c7U6p0jHOg` | Wigs |
| Cowbutt Crunchies | `UCbSST-QoAQKqtgZbmf3gI3g` | Wigs |
| Franciscosplays | `UCiDvE4FTPu2oPIXyn6EJNcw` | Miku wigs |

### Flickr
- **Keyless feed:** `photos_public.gne?tags=cosplay,maomao&tagmode=all&format=json&nojsoncallback=1` returns 200.
- **Why not:** www.flickr.com robots.txt is `Disallow: /`, so don't automate the feed. REST API keys now require Flickr Pro.
- **Credit caveat:** the uploader is usually the photographer, not the cosplayer.

### Tumblr
- **API:** `/v2/tagged` needs a key. Limits: 1,000/hour and 5,000/day.
- **API agreement:** credit the posting blog and source, cache for at most 3 days, remove deleted posts within 24 h. The terms (2026-01-16) forbid scraping.
- **Per-blog RSS works keyless.** Example: `https://tabithacerberus.tumblr.com/rss` has a 2026-09-14 Maomao cosplay post.
- **Media:** `64.media.tumblr.com` hotlinks (ACAO *).

### Reddit
- JSON returns 403 even from a home IP. RSS works at about 1 request/min per IP. robots.txt is `Disallow: /`.
- Self-service API access closed on 11 Nov 2025, and Reddit is reported to block AWS IP ranges (Vercel runs on AWS).
- Subreddits confirmed: r/cosplay, r/cosplayers, r/KusuriyaNoHitorigoto, r/TheApothecaryDiaries, r/hatsune, r/ProjectSekai, r/cosplayhelp.

### Instagram, TikTok, Pinterest, RedNote, Lemon8
- **Instagram:** oEmbed returns 200 without a token but has had no author or thumbnail since Nov 2025. Hashtag search needs a Business account and app review, and never returns usernames.
- **TikTok:** oEmbed returns 200 with `author_unique_id`. The thumbnail expires in ~48 h. There's no discovery API for personal apps.
- **Pinterest:** search covers only your own pins.
- **RedNote:** robots.txt is `Disallow: /`, and pages redirect to login.
- **Lemon8:** oEmbed returns 404.

### Tutorials and news feeds
- **Arda Wigs:** moved to `https://arda-wigs.com/blogs/news.atom` (200; newest post 2026-08-12). Includes "Iron Wig" contest posts.
- **Kamui Cosplay:** `https://www.kamuicosplay.com/feed/` returns 200, but the first byte takes ~15 s and the full body ~101 s. With `If-Modified-Since` it returns 304 in 2 s. Newest post 2025-11-27.
- **SoraNews24:** `https://soranews24.com/tag/cosplay/feed/` returns 200; newest 2026-09-11.

### Event listings
- **acgevents.sg:** `GET https://acgevents.sg/api/events?limit=50&offset=0` returns 200.
  - 182 events. Fields include `startDate` (UTC), `eventTags` (including "18+ Only"), `enableCosplayerAttendance` and `ticketLink`.
  - Its terms (20 Apr 2026) ban automated access without permission. The owner chose not to ask, so it is **not used**.
- **Other listings:**
  - MDoujin's API is encrypted.
  - Anime Yokocho is down (402).
  - Eventbrite's search API returns 404.
  - Peatix search redirects to its US site.
  - The best hand-maintained list is xtemujin.wordpress.com's yearly Singapore events post (updated 2026-06-06).

## Events

| Event | Where | 2026–27 dates (source) | Machine-readable? | Notes |
| --- | --- | --- | --- | --- |
| AFA Singapore 2026 | Suntec, SG | 27–29 Nov 2026 ([animefestival.asia](https://animefestival.asia/)) | WordPress `/afasg26/wp-json/wp/v2/pages` (`modified` signals changes); dates only in homepage HTML | Cosplay Singles competition, Cosplay Hub |
| SJ60 Musubi Festival | Marina Bay Sands Hall D&E, SG | 28–29 Nov 2026 ([sj60.sg](https://sj60.sg/)) | Static page | Same weekend as AFA |
| Singapore Comic Con 2026 | Sands Expo, SG | Preview 4 Dec; 5–6 Dec 2026 ([official](https://www.singaporecomiccon.com/)) | Page, no feed | |
| The Apothecary Diaries Exhibition | Fever Exhibition Hall, 25 Scotts Rd, SG | 30 Sep–1 Nov 2026 ([Fever](https://feverup.com/m/700676)) | schema.org Event JSON-LD | Must-show for the Maomao club |
| Anime Earth | City Square Mall, SG | 28 Sep–4 Oct 2026 ([GameTrader](https://www.gametrader.sg/blog/anime-earth-singapore-city-square-mall-october-2026/)) | None | Run by the Cosfest club; no Cosfest 2026–27 found |
| Doujin Market / Doumini | Suntec, SG | Doumini 12–13 Dec 2026 per [xtemujin](https://xtemujin.wordpress.com/2025/12/12/2026-anime-cosplay-games-and-fashion-events-singapore/); official page says TBA | `neotokyoproject.com/doujima/wp-json/wp/v2/pages?orderby=modified` | Unconfirmed |
| COSSET 03 cosplay flea market | The Cathay, SG | 7–8 Nov 2026 (acgevents.sg only) | Instagram only | Unconfirmed without acgevents |
| "songs we like" Miku & Teto fan concert | SG, venue TBC | 14 Nov 2026 (acgevents.sg only) | Instagram only | Unconfirmed |
| EOY Music, Comics & Arts Festival | Suntec Hall 405, SG | 25–26 Dec 2026 (acgevents.sg, xtemujin) | None | Unconfirmed |
| Recurring SG events | SG | Anime Garden (Mar), Doujin Market (May), Doki Doki Anime Market (Jun), HoYoFEST (Jul/Aug); 2027 TBA | — | |
| Comic Fiesta 2026 | KL Convention Centre, MY | 19–20 Dec 2026 ([AnimeCons](https://animecons.com/events/info/28301/comic-fiesta-2026) JSON-LD) | Official site still shows 2025 | Big regional |
| Comiket C109 | Tokyo Big Sight, JP | 29–31 Dec 2026 ([C109Info](https://www.comiket.co.jp/info-a/C109/C109Info.html)) | Static page in ISO-2022-JP; URL pattern `C{N}` | Big regional |
| AnimeJapan 2027 | INTEX Osaka, JP | Public days 27–28 Mar 2027 ([official](https://anime-japan.jp/en/about/)) | Static page | Moved from Tokyo |
| World Cosplay Summit 2027 | Nagoya, JP | 12–14 Nov 2027 (in the official site's JavaScript bundle) | JavaScript-only | Moves to November |
| Cosplay Mania 2026 | SMX Manila, PH | 2–4 Oct 2026 ([cosplay.ph](https://cosplay.ph/cosplay-mania-2026-exhibit-booth-slots-now-open/)) | WordPress feed and JSON | |
| Japan Expo Thailand 2027 | CentralWorld, Bangkok, TH | 26–28 Feb 2027 ([official](https://www.japanexpothailand.com/how-to-exhibit/)) | WordPress feed | |
| Indonesia Comic Con 2026 | JIExpo, Jakarta, ID | 3–4 Oct 2026 ([official](https://indonesiacomiccon.com/)) | HTML | |
| Fancy Frontier | Taipei, TW | FF48 TBA; Petit Fancy 45 × Reality Fantasy 14 on 7–8 Nov 2026 ([f-2.com.tw](https://www.f-2.com.tw/)) | WordPress feed | |
| ACGHK / AFA Hong Kong | HKCEC, HK | ACGHK 2027 TBA; AFA HK 2026 postponed | Empty WordPress feed | |

## Research recommendation (before the owner's answers)

**Photos**
- Bluesky is the discovery engine: about 15 narrow queries a day with `since=` set to the last 48 h.
- Keep only posts with images, no labels, and self-made cues ("my", "by me").
- Then run a vision check (is this a real photo, SFW, which character?) plus OpenAI moderation, with a manual hide switch as the last resort.
- Tutorials: YouTube uploads playlists for the six channels above, plus a few `search.list` calls a day.

**Events**
- Seed a table with `source_url`, `confidence` and `last_verified`.
- Once a week, re-check official pages with conditional GETs. When a page changes, run an LLM extraction that only accepts a date if it appears verbatim on the page.
- Mark dates that only appear on social media as unconfirmed.
- Hide events that have ended, in Singapore time.

**Top risks**
- NSFW leakage (12% of raw "cosplay" posts were labelled).
- Access churn (Bluesky, Reddit, Instagram).
- Crediting a photographer or reposter instead of the cosplayer.
- Stale dates.
- Nothing has been tested from Vercel IPs yet.
