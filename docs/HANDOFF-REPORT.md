# iloveukiriya.com: full build report and planning context

> **Private.** This report contains personal details about Kiriya, including her sexual orientation
> and gender identity, which she keeps private. Share it only with people or agents Josh trusts, and
> never publish it. Everything else here is safe to hand to an engineer or planning agent.

Prepared 2026-09-14 (US Pacific) / 2026-09-15 (Singapore) at the end of the first build session.
Project folder: `~/projects/birthday`. Status: **fully built and verified locally; not deployed, not
committed to git.**

---

## Contents

1. [What this is](#1-what-this-is)
2. [How the project evolved](#2-how-the-project-evolved)
3. [Everything we know about Kiriya](#3-everything-we-know-about-kiriya)
4. [Requirements, in the owner's words](#4-requirements-in-the-owners-words)
5. [Decision log: what was chosen and why](#5-decision-log-what-was-chosen-and-why)
6. [Research findings that shaped the build](#6-research-findings-that-shaped-the-build)
7. [Architecture](#7-architecture)
8. [Design system](#8-design-system)
9. [Features, section by section](#9-features-section-by-section)
10. [The content engine](#10-the-content-engine)
11. [Notifications](#11-notifications)
12. [Privacy and security model](#12-privacy-and-security-model)
13. [Verification: what was tested and how](#13-verification-what-was-tested-and-how)
14. [Known gaps, risks and technical debt](#14-known-gaps-risks-and-technical-debt)
15. [Deployment status and next steps](#15-deployment-status-and-next-steps)
16. [Open questions for the next planning round](#16-open-questions-for-the-next-planning-round)
17. [Appendices](#17-appendices)

---

## 1. What this is

A birthday gift from **Josh** (signs as "Josh <3") to **Kiriya**, hosted on the domain
**iloveukiriya.com**. It has two faces:

- **A public profile** anyone can see: a guns.lol × strawpage-style "link in bio" page (enter
  splash, tilting profile card, badges, typewriter bio, favourite song, interests, cosplays, view
  counter), styled clean and premium in her colours (purple and pink, with black and white).
- **A private world** behind a single passphrase: an installable phone app (PWA) that greets her in
  a Maomao-inspired voice, pulls fresh content about her interests from the internet every day,
  gives her tools for drawing, singing, ballet, cosplay and outfits, holds letters, and sends 2–3
  surprise notifications a day to her iPhone.

The owner's stated goals: "it shouldn't just look pretty", "remind her what makes her special every
day through random surprises to her phone", "engage her with her interests", "useful as it is cool
and cute", "more than a strawpage", "clean premium looking personal website that's also heavily
personalized towards the one and only".

---

## 2. How the project evolved

### 2.1 Version 1: the strawpage (first request)
Request: a separate React site in `~/projects/birthday`, "decorated as if it's a strawpage site",
"revealing information about the user", "cool animations, very girly ones and alternative at the
same time", to be hosted on Vercel with a new domain. Mid-request additions: "import any libraries
you need" and "this will primarily be a phone UI website but also desktop and tablet".

Built (Vite + React): a maximalist "sweet goth scrapbook" with pink gingham, black lace, a Mac OS 8
window chrome, an envelope intro that opened with confetti, an `about_me.txt` notebook whose answers
were hidden under heart covers ("secrets"), a gacha machine dispensing facts, a birthday countdown
cake, angel/devil loves-hates card, flip-card photobooth strip, CD player, blinkies and stamps,
draggable die-cut stickers, a glitter cursor trail and a "secrets found" meter.

**What happened to it:** superseded. The owner later asked for "clean premium looking" design in
purple-led colours, so the v1 look was retired and its code deleted (`src/legacy/` removed at the
end of the session). Concepts that survived in new form: the reveal-and-collect mechanic (daily
drawer and stickers), the birthday cake (now blown out through the microphone), the envelope (now
letters), die-cut stickers, sparkle bursts, confetti.

### 2.2 Version 2: "Kiriya's world" (second request)
The owner asked to go "even deeper": incorporate guns.lol design, a favourite song she can add,
Vocaloid, singing, dancing, art (drawing, painting), cosplay, The Apothecary Diaries (Maomao), daily
cute messages and curated lore/facts/tips, notifications to her phone, fashion (cutesy and tomboy),
her identity (pansexual, genderfluid) opening "more options in fashion", a backend and database if
needed (Rora's was offered), "import as many libraries and animations as possible", and permission to
ask question after question to personalise it. "No limits to the scope."

Process followed:
1. Four research agents ran in parallel (guns.lol design and libraries; Vocaloid, singing and dance
   tech; Apothecary Diaries, art, cosplay and fashion data; push notifications and backend).
2. Eight rounds of multiple-choice questions to the owner (answers in §3 and §4).
3. A written plan (`docs/PLAN.md`), then nine build phases (0–8), each verified before moving on.

### 2.3 Timing context
- The owner revealed mid-session that **Kiriya's birthday is September 15, which was already "today"
  in Singapore** (02:01 SGT when discovered). Offered a "ship a birthday version before she wakes"
  path; the owner chose **"build everything first"** and give it later.
- Because of that, the site runs a **birthday week, Sept 15–21**, instead of a single day. If the
  gift is handed over after Sept 21, the birthday takeover will not appear (see §16).

---

## 3. Everything we know about Kiriya

| Topic | Fact (source: the owner's answers) |
| --- | --- |
| Name | Kiriya. Wordmark renders lowercase "kiriya". |
| Birthday | **September 15**. |
| Location / timezone | **Singapore** (`Asia/Singapore`, UTC+8). |
| Phone | **iPhone** (drives the PWA and web-push design). |
| Identity (**private**) | **Pansexual and genderfluid.** Owner confirmed it must not be public. |
| Pronouns | Follow her **daily mood**. Defaults: Femme → she/her, Fluid → she/they, **Masc → he/him**, **Just me → she/they**. She can change each in Settings. |
| Favourite colours | **Purple (main) and pink (co-lead)**, "a dash of black", "some white", neutrals to balance. "Different shades of each colour, especially purple and pink." |
| Anime | **The Apothecary Diaries**, obsessed with **Maomao** ("Maomao solo queen", not into shipping Maomao × Jinshi). Has read the **manga** (spoilers up to the manga are fine). |
| Vocaloid | **Hatsune Miku, Kagamine Rin & Len.** Likes classics, newer hits / Project SEKAI, and Rin & Len story songs. |
| Singing, dancing | Loves both. **Trains in ballet** ("stuff to remind her about it here and there"). |
| Art | **Digital (iPad / Procreate)** and **traditional drawing**. |
| Cosplay | **Experienced.** Has cosplayed **Maomao, Hatsune Miku, Lynette (Genshin Impact)**; does **wig styling**. |
| Fashion | Cutesy **and** tomboy: **Harajuku/kawaii, jirai kei/sweet goth, streetwear/skater, Y2K/alt** (all four). |
| Languages | Wants to study **Japanese**. Reads **simplified Chinese** ("use lightly"). Site language **English**. |
| Pets | None. |
| Socials to show publicly | **TikTok, Discord** (handles not yet provided). |
| What makes her special (owner's words) | "Passionate about her interests. Many complex talents such as ballet. Kind and sassy, and animals love her. Pretty, caring, a kind soul. Her passion and the happiness she brings, plus her sense of humour. Mix all that with her interests." |
| From | **Josh**, signature **"Josh <3"** (first given as "Joshuaaa", then changed). |
| Domain | **iloveukiriya.com**. |

---

## 4. Requirements, in the owner's words

Answers to the question rounds, lightly trimmed:

| Question | Owner's answer |
| --- | --- |
| Who can see the site? | "Public profile + private space. For the authentication just keep it simple, a passphrase for the whole site to appear… If anyone goes to the domain they see a more enhanced guns/strawpage version, but when the passphrase is entered the full site in all its glory appears for Kiriya to showcase." |
| Her phone | iPhone |
| Backend | Standalone on Vercel (offered Rora's infrastructure; declined in favour of standalone) |
| Pronouns | Follow her daily mood |
| Surprise frequency | 2–3 a day at random times |
| Voice of messages | "Maomao mascot plus curated facts from the internet… a cron job to pull data from different sites and curate them for her, fresh data every day, encouraging ones curated to her tastes such as sarcasm or Maomao's persona, but overall all about her." |
| Spoiler level | Manga |
| AI provider | OpenAI API key |
| Birthday | "Today, September 15th, so make it extra special for her birthday." |
| Launch pacing | Build everything first |
| Birthday letter | Both: Josh writes one, Maomao writes one |
| Cosplay level | Experienced |
| Genshin cosplay | Lynette |
| Chinese | "Simplified but use lightly, not too much, the site should be English." |

Design direction messages sent mid-build:
- "Her favourite colours are purple and pink and a dash of black too plus some white, so make it
  cutesy and alt with purple as sort of the main with pink in lead as well, then general colours to
  balance it all out. We are going for a clean premium looking personal website here that's also
  heavily personalised towards the one and only."
- "Use different shades of each colour, especially purple and pink, play around with them."

---

## 5. Decision log: what was chosen and why

| # | Decision | Alternatives considered | Why |
| --- | --- | --- | --- |
| D1 | **Public profile + passphrase-gated private world** | Fully public; fully private | Owner's choice. Identity is private, but a public profile was wanted for showcasing. |
| D2 | **Private content is only ever served by the API after unlock; never in the JS bundle** | Hide sections in the UI | Anything in the bundle can be read by any visitor with dev tools. Enforced by a build-time leak check (§12). |
| D3 | **Standalone Vercel backend** (not Rora's) | Rora's Railway backend + self-hosted Supabase | Owner's choice after this recommendation: Rora's DB is on a private network Vercel can't reach, would couple a gift to Rora production deploys, and would put sensitive personal data in a company database. |
| D4 | **Hono in one Vercel Node function** (`api/index.js`) with `vercel.json` rewrites | One file per endpoint | One cold start, shared code, avoids per-deployment function limits; the same app runs inside Vite in development. |
| D5 | **Postgres via Drizzle: Neon in production, PGlite locally** | Supabase (free projects pause after a week idle, pg_cron activity may not count); Upstash Redis; Turso | Neon never pauses and is Vercel-native; PGlite is real Postgres in WASM, so development needs zero services. Research warned not to poll Neon (compute cost), so nothing polls it. |
| D6 | **Upstash QStash for random-time pushes**, Vercel Cron as a backstop | Vercel Pro per-minute cron ($20/mo); GitHub Actions; cron-job.org; Supabase pg_cron | Vercel Hobby cron can only run once a day ±59 min. QStash supports a timezone cron and delayed messages with signatures, on a free tier. |
| D7 | **Simple passphrase** (scrypt-hashed, signed cookie), plus a separate admin passphrase | Passkeys (better-auth / SimpleWebAuthn), email magic links | Owner asked to "keep it simple". Research also flagged that magic links open in Safari, not the installed iPhone app. |
| D8 | **Web Push via PWA, Declarative Web Push payload** (`web_push: 8030`) with service worker fallback | Telegram bot, Discord DMs, email | Owner wanted surprises "to her phone"; iOS 16.4+ supports push for Home Screen apps and 18.4+ shows declarative pushes without running JS (more reliable). Telegram noted as a future fallback (§16). |
| D9 | **OpenAI Responses API, `gpt-5.4-mini-2026-03-17`, strict JSON schema, `store: false`, low reasoning effort** | Claude; templates only | Owner chose OpenAI. The exact request shape was copied from Rora's live-proven adapter (`backend-logic/intelligenceArch/adapters/openaiAdapter.mjs`); Rora's notes found mini models beat larger ones on structured tasks. |
| D10 | **AI only rephrases facts it's given; template writer is the default and the fallback** | Let the model generate lore | Accuracy about Maomao/Vocaloid matters and models invent details. Templates keep the site working with no key, no network, no cost. |
| D11 | **Curated fact pools with a source URL per fact**, spoiler-tagged | Scraping wikis live; model knowledge | Verified content, spoiler control (manga level), stable quality. Live sources add freshness on top. |
| D12 | **Maomao-inspired mascot drawn as original SVG fan art** | Official art, Live2D models | No copyright reuse; full control of expressions; tiny. Live2D and MMD models have restrictive modeller licences (research). |
| D13 | **Calico kitten companion** that follows her | Generic pet | "Animals love her" + a calico cat literally named Maomao appears in the series (S2 E1). |
| D14 | **Clean premium visual language** replacing v1's maximalism | Keep the strawpage collage | Owner's direction change. Personality kept in a few deliberate details (lace, doily avatar, pixel-gothic wordmark, stickers). |
| D15 | **11-step OKLCH ramps for purple, pink, and purple-tinted neutrals** | Hand-picked hexes | "Different shades… play around with them." Perceptual ramps keep any two shades harmonious; contrast measured per step. |
| D16 | **Daily mood check-in re-balances only her own palette** (keys `rose/iris/night/cloud`) and drives pronouns and outfit leaning | Pride-flag colour themes | Keeps her favourite colours every day; colour keys reveal nothing, and labels live on the server. |
| D17 | **Second-person copy everywhere** | Third-person with pronoun tokens | Pronouns change daily; "you" is always right. Pronoun data is still exposed for any third-person UI. |
| D18 | **Birthday week (7 days)** rather than a single day | Birthday-only mode | The gift will be handed over after the birthday; this stretches the celebration. |
| D19 | **YouTube/Spotify/SoundCloud/niconico embeds and uploaded audio** for her songs | Hidden background audio like guns.lol | YouTube's policy requires a visible player of at least 200×200 px and forbids background audio. Uploads (her own covers) can autoplay after the splash tap. |
| D20 | **VocaDB for Vocaloid data** (song of the day, lookups by pasted link) | Scraping, Spotify API | Free, CORS-open, CC BY data with BPM, producers and YouTube IDs. |
| D21 | **AniList for anime data**, The Met for artwork, Open-Meteo for weather | Jikan, Art Institute of Chicago | Jikan was returning 504s; AIC images are Cloudflare-blocked for browsers; Open-Meteo needs no key (credit link required). |
| D22 | **perfect-freehand + Mixbox** for the studio | tldraw (licence key + watermark), Excalidraw (heavy), fabric (no pressure) | Pressure-aware strokes for Apple Pencil in ~2 KB; Mixbox gives real pigment mixing (CC BY-NC, fine for personal use). |
| D23 | **pitchy** for pitch practice | pitchfinder (GPL), CREPE (needs porting) | MIT, accurate McLeod method, works with iPhone mic. |
| D24 | **TextAlive App API, gated by an optional token** | Not including lyrics | Official AIST API for Vocaloid lyric animation; needs a free token; mobile support unverified, so it's hidden without a token. |
| D25 | **No MMD (3D dance models) and no Live2D** | babylon-mmd, pixi Live2D successors | Model licences forbid redistribution on a public site; heavy; React Three Fiber blocks React 19.3. |
| D26 | **Fonts: Jacquard 24 (wordmark), M PLUS Rounded 1c (UI and Japanese)** | DotGothic16 (v1), system fonts | Pixel blackletter keeps the "alt" signature; M PLUS Rounded is soft, premium and covers kana and kanji for the Japanese cards. |
| D27 | **Lock screens never show spoilers** (spoiler facts are teased in pushes) | Quote facts directly | Notifications are visible to anyone near her phone. |
| D28 | **Nothing identity-related is sent to OpenAI** | Send the full profile | Least data to third parties; interests and traits are enough for voice. |
| D29 | **Build fully first, no deploy or commit without asking** | Deploy immediately | Owner's pacing choice; deploying and committing are outward-facing actions. |

---

## 6. Research findings that shaped the build

All checked live on 2026-09-14 by research agents. The most decision-relevant points:

### 6.1 guns.lol design language
- Profile = centred card over a full-screen background; "click to enter" splash exists to satisfy
  browser autoplay rules (sound only after a tap); card tilt is **react-parallax-tilt**; typewriter bio
  is **typewriter-effect**; cursor effects from **cursor-effects**; view counter; badges; Discord
  presence; audio player card.
- iOS: device-orientation tilt needs `requestPermission()` inside a tap (react-parallax-tilt asks at
  the wrong time, so the site asks in the splash tap); iOS can't set media volume from code; Low
  Power Mode caps animation at 30 fps.
- **React Three Fiber currently refuses React 19.3** (peer range `<19.3`), which ruled out r3f-based
  3D backgrounds.

### 6.2 Vocaloid, singing, dancing
- **VocaDB API**: CORS `*`, array params need `[]`, `maxResults` caps at 100, Miku=1, Rin=14, Len=15;
  songs expose BPM and YouTube PV IDs; `byPv` looks up a pasted YouTube/niconico link.
- **TextAlive App API 0.5.2**: token required; Magical Mirai 2026 contest songs have pinned timing
  IDs (hard-coded in `src/world/stage/LyricTheater.jsx`); credit link required; phone support
  officially unclear.
- **pitchy 4.1.0** (MIT) recommended; Miku's best range per Crypton is A3–E5, favourite tempo
  70–150 BPM.
- **MMD**: three.js removed its MMD loader; babylon-mmd works but model licences forbid web
  redistribution. Skipped.
- Verified lore used in the pools (birthdays, Senbonzakura 2011 and the 2015 Kōhaku, Melt 2007,
  the Ievan Polkka leek origin, Magical Mirai 2013 first show, Snow Miku since 2010, Miku V6 released
  2026-04-14, Teto's April Fools' origin).

### 6.3 The Apothecary Diaries, art, cosplay, fashion
- **Season 3 premieres 2026-10-02 23:00 JST (22:00 Singapore)** on NTV, split-cour with part 2 in
  April 2027; **film opens in Japan 2026-12-11**; live-action Prime Video series announced for 2028;
  console game early 2027. AniList IDs: S1 161645, S2 176301, **S3 195516**, S3 part 2 200927,
  film 200929, Maomao 126824, Jinshi 127278.
- AniList is temporarily limited to 30 requests/minute; Jikan was failing with 504s.
- Maomao facts sourced and tagged by episode and spoiler level; real herbs and poisons from the
  series paired with real-world facts (final pool sizes in §10.1).
- **The Met**: public-domain JSON with CORS; `/v1/search` retires 2026-10-01 (the site uses
  `/v1.1/search`). **Art Institute of Chicago** images are Cloudflare-blocked for browsers.
- Sourced cosplay tips (foam, Worbla, wigs, contacts safety, contouring, binding safety with the
  stricter "under 8 hours" guidance, con prep, consent).
- **Open-Meteo**: free, CORS, requires a visible credit link.

### 6.4 Push notifications and backend
- iOS web push requires **16.4+ and a Home Screen install**; every push must show a notification or
  Safari revokes permission; iOS has no `pushsubscriptionchange` event, so the app **re-sends the
  subscription on every open**; `notificationclick` is unreliable on iOS, so declarative `navigate`
  URLs are used; iOS ignores action buttons, images, custom icons.
- Apple rejects VAPID subjects like `mailto:user@localhost` (use a real email or https URL).
- `web-push` 3.6.7 is the current release; an ESM-only breaking major is coming, so it's pinned to 3.x.
- `vite-plugin-pwa` 1.3.0 supports Vite 8; use `injectManifest` for a custom push handler and
  `autoUpdate` (the "prompt" flow can hang on iOS).
- Vercel Hobby cron: once a day, UTC, best-effort. QStash free tier: 1,000 messages/day, timezone
  crons, delayed messages up to 7 days, signed requests, at-least-once delivery (handlers must be
  idempotent).
- Neon free: 100 CU-hours/month, 0.5 GB; scales to zero after 5 idle minutes (don't poll it).

---

## 7. Architecture

### 7.1 Overview
```
Phone / browser
  ├─ Public profile  (/)                    ← main JS chunk, no private data
  ├─ Private world   (/world/*)             ← lazy chunk, data only via /api/me/*
  ├─ Admin desk      (/admin)               ← lazy chunk, data only via /api/admin/*
  └─ Service worker  (/sw.js)               ← precache, offline shell, push fallback

Vercel
  ├─ Static build (Vite 8, React 19.3)
  ├─ api/index.js  → server/app.js (Hono)   ← one Node function for every /api/* route
  └─ Cron backstop: GET /api/jobs/backstop at 16:20 UTC (00:20 Singapore)

External services
  ├─ Neon Postgres (Drizzle ORM)            ← PGlite file DB in development
  ├─ Vercel Blob                            ← drawings, cosplay photos, avatar, uploaded songs
  ├─ Upstash QStash                         ← 00:10 SGT daily schedule + delayed push messages
  ├─ OpenAI Responses API                   ← Maomao-voice writer (optional)
  ├─ Apple / Google push services           ← via web-push (VAPID)
  └─ Content sources: VocaDB, AniList, The Met, Open-Meteo (client), 9 RSS feeds
```

### 7.2 Stack (installed versions)
React 19.3.0, react-dom 19.3.0, react-router 8.3.1, @tanstack/react-query 5.102.8, motion 13.3.0,
Vite 8.3.0, @vitejs/plugin-react 6.1.1, vite-plugin-pwa 1.3.0, workbox 7.4.1; Hono 4.13.7,
@hono/node-server 2.1.1, drizzle-orm 0.45.2, drizzle-kit 0.31.10, @neondatabase/serverless 1.1.0,
@electric-sql/pglite 0.5.8, zod 4.6.5; web-push 3.6.7, @upstash/qstash 2.11.3, @vercel/blob 2.8.0,
openai 7.15.0, fast-xml-parser 5.11.1; react-parallax-tilt 1.7.342, typewriter-effect 2.22.0,
canvas-confetti 1.9.4, simple-icons 16.31.0, perfect-freehand 1.2.3, mixbox 2.0.0, pitchy 4.1.0,
textalive-app-api 0.5.2; fonts @fontsource/jacquard-24 and @fontsource/m-plus-rounded-1c 5.3.0;
sharp 0.35.4 (icon generation). Node 22+ (developed on 24.14.1). Unused leftovers: `culori`,
`@fontsource/dotgothic16` (see §14).

### 7.3 Directory map
```
api/index.js                 Vercel entry; restores the /api path from the rewrite query
server/app.js                Hono app: CSRF header check, route mounting, role gates, errors
server/env.js                Environment config, dev stand-ins, server-only marker
server/auth/                 passphrase.js (scrypt), session.js (signed cookie, requireRole)
server/db/                   schema.js (18 tables), client.js (Neon or PGlite), migrations/
server/routes/               session, public, me, songs, atelier, apothecary, push, admin, jobs, uploads
server/engine/               pick.js (seeded choice), compose.js (templates), day.js, daily.js (job),
                             writer.js (OpenAI), personal.js (Josh's notes), sources/ (vocadb, anilist,
                             feeds, met)
server/push/                 webpush.js (send), planner.js (plan day, QStash, claim)
server/content/              kiriya.js (PRIVATE profile), moods.js, voice.js (persona + lines),
                             birthday.js, publicProfile.js, pools/ (maomao, herbs, vocaloid, cosplay,
                             cosplayIdeas, ballet, japanese, art, fashion)
server/lib/                  time.js (Singapore calendar maths), birthday.js, songs.js (link parsing,
                             oEmbed), http.js (timeouts, settle)
src/main.jsx                 Router, QueryClient, MotionConfig(reducedMotion="user")
src/styles/                  tokens.css (palette, type, shadows, moods), base.css, fonts.css,
                             japanese-fonts.css (world only)
src/public/                  ProfilePage, EnterSplash, ProfileCard, SongCard, BirthdayBanner,
                             InterestTiles, CosplayShelf, Door
src/world/                   World (gate + routes), WorldShell (header, tabs, kitten, SW),
                             today/, studio/, stage/, atelier/, apothecary/, letters/, settings/, mascot/
src/admin/                   Admin desk
src/shared/                  UnlockSheet, Wordmark, Doily, Kitten, PageLoader, effects.js (sparkles,
                             confetti), icons/, stickers/StickerArt, music/SongPlayer
src/lib/                     api.js, session.js, profile.js, world.js, pwa.js, uploads.js
src/sw.js                    Service worker (precache, navigation fallback, push, notificationclick)
scripts/                     setup-dev, hash-passphrase, migrate, make-icons, check-leaks, setup-qstash
docs/                        PLAN.md, SETUP.md, this report
vercel.json                  build command, rewrites, headers, cron
```
Size: ~3,800 lines of server code, ~10,500 lines of frontend (JS + CSS).

### 7.4 Data model (18 tables, `server/db/schema.js`)
| Table | Purpose |
| --- | --- |
| `settings` | Key/value config: `public_profile` overrides, `signature`, `notifications`, `address_overrides` |
| `views` | Profile views per Singapore day |
| `unlock_attempts` | Rate limiting (hashed IP, ok, role, time) |
| `moods` | Daily check-in (day, mood key, energy 0–4) |
| `days` | The composed bundle per day (cards, song, artwork, finds, pushes, drawer, greetings) and which writer produced it |
| `shown_items` | Pool item keys used per day (novelty tracking) |
| `source_items` | Items fetched from feeds/APIs (deduped by id) |
| `drawers` | The daily drawer opening and its reward |
| `songs` | Her song list (link or upload), featured flag for the public profile |
| `letters` | Letters from Josh (birthday / open-when / note, optional unlock date, read receipt) |
| `push_subscriptions` | Push endpoints per device and role, last success and error |
| `planned_pushes` | Each planned notification (day, slot, send time, status, payload, result) |
| `artworks` | Studio gallery |
| `cosplay_projects` | Cosplay planner (status, deadline, budget/spent, checklist, notes, cover) |
| `saved_looks` | Saved outfits |
| `kv` | Small feature state: sticker collection, VocaDB song pool cache, Josh's notes, quiz/balance/pitch bests |
| `traits`, `special_dates` | Created but unused (see §14) |

### 7.5 API surface (63 endpoints)
- **Session:** `GET /api/session`, `POST /api/session/unlock`, `POST /api/session/lock`
- **Public:** `GET /api/public/profile` (public fields only), `POST /api/public/view`
- **Her world (`kiriya` or `admin` role):** `GET /api/me`, `GET /api/me/today`, `PUT /api/me/mood`,
  `GET|PUT /api/me/address`, `GET|PUT /api/me/profile`, `GET|POST /api/me/artworks`,
  `DELETE /api/me/artworks/:id`, `GET|PUT /api/me/kv/:key` (allowlisted keys), `POST /api/me/drawer`,
  `GET /api/me/stickers`, `GET /api/me/letters`, `POST /api/me/letters/:id/open`,
  `GET|POST /api/me/songs`, `PATCH|DELETE /api/me/songs/:id`,
  `GET|POST /api/me/atelier/cosplay`, `PATCH|DELETE /api/me/atelier/cosplay/:id`,
  `GET /api/me/atelier/library`, `POST /api/me/atelier/outfit`, `GET|POST /api/me/atelier/looks`,
  `DELETE /api/me/atelier/looks/:id`, `GET /api/me/apothecary`,
  `POST /api/me/dev/reset-today` (development only)
- **Push (`kiriya` or `admin`):** `GET /api/push/status`, `POST /api/push/subscribe`,
  `POST /api/push/unsubscribe`, `POST /api/push/test`, `PUT /api/push/settings`
- **Admin (`admin` role):** `GET /api/admin/status`, `POST /api/admin/daily/run`, `GET /api/admin/days`,
  `GET /api/admin/pushes`, `POST /api/admin/pushes/:id/send-now`, `POST /api/admin/pushes/custom`,
  `GET|POST /api/admin/letters`, `PUT|DELETE /api/admin/letters/:id`, `GET|PUT /api/admin/notes`,
  `GET /api/admin/profile`, `PUT /api/admin/signature`, `PUT /api/admin/profile/media`
- **Jobs (Cron bearer secret or QStash signature):** `GET /api/jobs/backstop`, `POST /api/jobs/daily`,
  `POST /api/jobs/send-push`
- **Uploads:** `GET /api/uploads/config`, `POST /api/uploads/blob` (Blob client-upload handshake),
  `POST /api/uploads/local` and `GET /api/uploads/file/:name` (development only)
- `GET /api/health`

### 7.6 Build and deploy pipeline
- `vercel.json`: `buildCommand: npm run vercel-build` → `node scripts/migrate.mjs && vite build && node scripts/check-leaks.mjs`.
  Migrations run against Neon before each deploy; the leak check fails the build if private terms appear in `dist/`.
- Rewrites: `/api/:route*` → `/api?__route=:route*` (restored in `api/index.js`); everything else →
  `index.html` (SPA). Headers: `sw.js` no-cache, manifest content type, immutable assets,
  `Permissions-Policy: microphone=(self)`.
- PWA: `vite-plugin-pwa` injectManifest; manifest id/start_url `/world`, `display: standalone`,
  theme `#632bb5`; icons generated by `scripts/make-icons.mjs` (192, 512, maskable 512,
  apple-touch 180, badge 96). Precache excludes the 448 Japanese font slices (each built as woff2 and woff).
- Local development: `npm run setup` writes `.env.local` (session secret, cron secret, VAPID keys);
  `npm run dev` serves the Hono API inside Vite via `ssrLoadModule`; dev passphrases are
  `kiriya` and `admin`.

---

## 8. Design system

### 8.1 Principles applied
- **Purple leads, pink co-leads, black and white as accents, purple-tinted neutrals to balance.**
- Clean and premium: generous spacing, soft purple-tinted shadows (never grey), varied card
  treatments by content type instead of identical cards, one signature gradient used on purpose
  (wordmark, primary buttons, progress), not as wallpaper.
- Cute-alt personality concentrated in a few details: black lace edge on the profile card, doily
  avatar frame with black eyelets, pixel-blackletter wordmark, die-cut stickers, sparkles, the
  kitten, the mascot.
- Avoided generic defaults on purpose: no cream-and-terracotta, no identical SaaS cards, no
  all-caps eyebrow labels, no middle-dot metadata strings.
- Phone first; tablet uses a centred column (max 600 px); desktop profile is two columns (sticky card).
- Motion answers actions (flips, drawer, cake, mascot pokes); ambient motion is limited
  (twinkles, disc spin, kitten); `prefers-reduced-motion` respected globally and via
  `MotionConfig reducedMotion="user"`.

### 8.2 Palette (`src/styles/tokens.css`)
Generated as OKLCH ramps (purple hue ~297, pink ~356, mist ~305) and contrast-checked.
| Step | Purple | Pink | Mist |
| --- | --- | --- | --- |
| 50 | `#f8f5ff` | `#fff3f8` | `#f8f5fb` |
| 100 | `#f1e8ff` | `#ffe5ef` | `#eeebf2` |
| 200 | `#e3d4ff` | `#ffcce0` | `#dedae3` |
| 300 | `#cfb4ff` | `#ffa4c9` | `#c6c2cd` |
| 400 | `#b589ff` | `#f96cab` | `#a8a1b0` |
| 500 | `#995cf7` | `#e52f8c` | `#8a8294` |
| 600 | `#7e39df` (5.9:1 on white) | `#c2006f` (6.0:1) | `#6f6879` |
| 700 | `#632bb5` | `#9c0057` | `#585261` |
| 800 | `#491e8c` | `#770040` | `#423d49` |
| 900 | `#301262` | `#52002a` | `#2c2831` |
| 950 | `#19083a` | `#300015` | `#17151a` |

Roles: page `purple-50`, text `purple-950`, lead `purple-600`, co-lead `pink-500`, night surfaces
`purple-900 → purple-950` gradient, signature gradient `purple-600 → purple-500 → pink-500`.
Mood re-balancing: `rose` (pink leads), `iris` (default, purple/pink mix), `night` (deep purple +
pink), `cloud` (neutral mist + purple). Only the colour key is in CSS; labels come from the API.

### 8.3 Typography
- **Jacquard 24** (pixel blackletter) for the "kiriya" wordmark, filled with the signature gradient.
- **M PLUS Rounded 1c** (400/500/700/800) for everything else, including kana/kanji. Latin faces
  are declared by hand with `unicode-range` (fontsource's `latin-*.css` files omit it, which hid the
  Japanese glyphs); Japanese slices load only inside the private world.
- Scale: 12, 14, 16, 19, 23, 29, 37, 48 px.

### 8.4 Signature illustrations (all original SVG)
- **Maomao-inspired mascot** (`src/world/mascot/MaomaoMascot.jsx`): dark hair in a bun tied with a
  purple ribbon, painted freckles, pale green top, burgundy skirt, herb sprig. Expressions:
  deadpan, smug, sparkle, happy, sleepy, party (birthday hat), ew. Floats, blinks; tap to poke (it
  replies with a dry line).
- **Calico kitten** (`src/shared/Kitten.jsx`): walks to taps (phone) or follows the cursor
  (desktop), naps after 14 s, purrs when tapped.
- **Doily avatar frame**, **cosplay emblems** (herb sprig for Maomao, spring onion and notes for Miku,
  magician's star for Lynette), **interest icons**, **10 collectible stickers** (kitten, sprig, leek, pointe shoe, bow,
  brush, star, tonic bottle, mirror, birthday cake).
- **App icon**: purple→pink gradient, white heart with a purple cross, sparkle.

---

## 9. Features, section by section

### 9.1 Public profile `/` (`src/public/`)
- **Enter splash** (guns.lol "click to enter"): night gradient with twinkles, doily avatar,
  wordmark, "tap to enter". The tap unlocks audio, asks iOS for motion permission, starts the song,
  counts a view (once per tab).
- **Profile card**: tilt (desktop hover; phone gyroscope if allowed; off with reduced motion) with
  glare; doily avatar (her photo once uploaded, else a monogram); gradient wordmark with a letter
  rise; badges (Vocaloid lover, Apothecary apprentice, Artist, Cosplayer, Ballet dancer, plus
  "Birthday week" during birthday week) that show a label when tapped; typewriter bio (5 editable lines);
  TikTok and Discord (copy username) once handles are set; view counter.
- **Song card**: her starred song (default: the original Senbonzakura video, YouTube `shs0rAiwsGQ`)
  with a spinning disc and a provider link.
- **Birthday banner** (Sept 15–21 only) with a confetti button.
- **"Things I'm into"**: 6 tiles in different purple/pink shades that flip to a sourced fun fact.
- **Cosplays**: polaroids for Maomao, Hatsune Miku, Lynette (emblems until photos are uploaded).
- **Locked drawer**: "One drawer is locked… only Kiriya has the passphrase", opens the passphrase
  sheet; when already unlocked it says "Enter your world".
- Credits line (VocaDB).

### 9.2 App shell `/world` (`src/world/WorldShell.jsx`)
Sticky blurred header (wordmark linking to the public profile, today's mood chip with pronouns,
settings); floating glass tab bar (Today, Studio, Stage, Atelier, Apothecary); the kitten; registers
the service worker and re-syncs her push subscription on every open; applies the mood colour key.

### 9.3 Today (`src/world/today/`)
In order on the page:
1. **Maomao greeting** chosen by time of day (morning/afternoon/evening/late) or birthday, typed
   out; poke the mascot for reactions; after check-in a mood-specific line appears under it.
2. **Coming up** strip: Season 3 episode countdown (live from AniList), manga volume, film, and
   Vocaloid birthdays within 14 days.
3. **Birthday takeover** (birthday week): "Happy birthday, Kiriya", an animated cake whose candles go
   out when she **blows into the microphone** (RMS detector) or taps, smoke and confetti, the day's
   birthday-week note (7 notes), a button to her letters, "with love from Josh <3".
4. **Mood check-in**: Femme / Fluid / Masc / Just me with hints and pronoun labels, plus an energy
   slider; collapses to a summary with "Change".
5. **Daily drawer**: a medicine chest; opening it plays a spring animation and confetti and adds a
   sticker to her collection.
6. **Song of the day** (VocaDB) with an embedded player, BPM note and tags.
7. **Today's cards** (8, each styled differently): Maomao file (manga spoilers blurred
   behind a tap), herb label (poison/medicine/myth/caution/curiosity), Vocaloid lore, cosplay tip,
   ballet (term with pronunciation, barre reminder, or history), Japanese word (big kanji, kana,
   romaji, meaning, light simplified-Chinese note, "false friend" badge), drawing prompt (with a
   Procreate or traditional tip and a link to the Studio), and "Why you're you" (or a note from Josh).
8. **Fresh from the internet**: up to 4 curated items (AI-rewritten when available) linking to the
   originals.
9. **Outfit idea** for today's mood: top, bottom, shoes, extra, plus notes based on live Singapore
   weather (Open-Meteo, credited).
10. **Artwork of the day** from The Met, with why it was picked.

### 9.4 Letters `/world/letters`
Envelopes for Josh's letters (unread badge, optional unlock date) and Maomao's birthday letter ("A
prescription for your birthday"), opened on lined paper with read receipts sent to the admin.
**Bug:** the only link to this page is the button inside the birthday takeover, which shows only
Sept 15–21. There is no tab or other link, so outside birthday week the letters can only be reached
by typing the URL (see §14).

### 9.5 Studio `/world/studio`
- Today's prompt; 5/15/30-minute timers.
- **Canvas**: pressure from Apple Pencil (simulated for fingers), 3 brush sizes, eraser, undo/redo,
  clear, paper (white / lavender / night), 12-colour palette including Miku teal.
- **Paint mixing** (Mixbox): pick two paints, slide, see a 6-step pigment ramp, "Paint with this"
  adds the mix to the palette.
- **Save to gallery** (PNG upload to Blob) with confetti, or **share/save** via the iOS share sheet.
- **Gallery** grid with a viewer and delete.

### 9.6 Stage `/world/stage`
- Vocaloid birthdays within two weeks; **song of the day** plus a **dance break** suggestion based
  on BPM.
- **Your songs**: paste YouTube/Spotify/SoundCloud/niconico links (auto-titled via VocaDB or
  oEmbed) or upload recordings such as her own covers; star one for the public profile; play inline.
- **Pitch practice**: live pitch from the mic (pitchy), Miku's A3–E5 band, a target note to hold
  for 1.5 s, sparkles on success, score and personal best.
- **Lyric theatre** (only with a TextAlive token): 6 Magical Mirai 2026 songs with character-by-character
  animated lyrics and a beat pulse.
- **Ballet corner**: today's term, a guided **barre timer** (pliés → tendus → … → stretch, with
  chimes), and a **balance challenge** stopwatch with a saved best.

### 9.7 Atelier `/world/atelier`
- **Cosplay planner**: add a character; status (dreaming/planning/building/done), 9-item checklist
  (reference, wig, wig styling, costume, props, makeup test, contacts from an optician, shoes,
  photos) with progress bar and confetti on completion, deadline countdown, budget vs spent, notes,
  cover photo upload.
- **Ideas for your next cosplay**: 12 curated characters (Jinshi, Gaoshun, Lakan, Consort Gyokuyou,
  Suirei, Kagamine Len, Kagamine Rin, Megurine Luka, Snow Miku, Lyney, Freminet, Furina), sorted to
  match today's mood leaning; "Plan it" adds one to the planner.
- **Tips library** by topic (props, wigs, makeup, crossplay, con), each with a source.
- **Wardrobe**: vibe (Harajuku sweet, sweet goth, skater comfort, Y2K alt, or any), leaning
  (anything / cute and soft / in between / sharp and baggy, defaulting to today's mood), weather
  (hot / rainy / freezing aircon) → generated outfit; save looks.

### 9.8 Apothecary `/world/apothecary`
- **Countdown** clock to the next episode (AniList) or Season 3 premiere, with Singapore time, plus
  English manga vol. 16, the film, and S3 part 2.
- **Case files** deck: all 32 facts with previous/shuffle/next; manga spoilers blurred behind a tap,
  light-novel spoilers behind a stronger warning.
- **"Poison, medicine, or neither?"** quiz using the herb cabinet, with the mascot reacting, a streak
  and a saved best.
- **Herb cabinet**: 18 drawers; each opens a label with the series context, the real-world fact, a
  kind badge and a source.

### 9.9 Settings `/world/settings`
- **Surprises on your phone**: detects iPhone-not-installed and shows a 3-step Add to Home Screen
  guide; otherwise "Turn on surprises" (subscribes inside the tap, as iOS requires), "Send a test",
  "Turn off", per-day count (1–3) and waking window; explains how to fix blocked permissions.
- **How the site talks about you**: pronoun set per mood (she/her, she/they, they/them, he/him,
  he/they, any/all).
- **Your public profile**: typewriter bio lines, TikTok handle, Discord username, view counter toggle.
- **Lock kiriya on this device**.

### 9.10 Admin desk `/admin` (Josh)
- **Status**: database, passphrases, AI writer, scheduler, cron secret, push keys, file storage;
  today's writer and finds; number of Kiriya's subscribed devices.
- **Letters**: write/edit/delete (birthday, open-when with label, note), optional unlock date,
  read status.
- **Little notes**: short notes that replace the "Why you're you" card on some days (40% chance per
  day when notes exist), with a push saying Josh left a note.
- **Signature and profile photos**: signature; upload her profile picture and a photo per cosplay.
- **Today's content and surprises**: run the daily job, rebuild from scratch, see the result and
  failed sources, list planned pushes with "Send now", send a custom surprise immediately.
- "Preview her world" link; lock.

---

## 10. The content engine

### 10.1 Curated pools (`server/content/pools/`, all private, every fact sourced)
| Pool | Count | Notes |
| --- | --- | --- |
| Maomao facts | 32 (27 anime, 3 manga, 2 novel) | Novel facts never become daily cards; manga facts blurred; lock screens only tease spoilers |
| Apothecary dates | 4 | S3 premiere, EN manga vol 16, film, S3 part 2 (pinned to midday local time to avoid date shifts) |
| Herbs/poisons | 18 | Series context + real-world fact + source; "don't taste-test" disclaimer |
| Vocaloid lore | 21 | Weighted: Miku/Rin/Len always, the wider family ~20% of days |
| Vocaloid birthdays | 6 | Miku 8/31, Rin & Len 12/27, Luka 1/30, Teto 4/1, MEIKO 11/5, KAITO 2/17 |
| Cosplay tips | 22 | Topics: props, wigs, makeup, crossplay (binding safety), con |
| Cosplay ideas | 12 | Tagged with leaning and difficulty |
| Ballet | 34 terms (with pronunciation), 8 history facts, 9 barre reminders | Daily mix ~45% term / 30% reminder / 25% history |
| Japanese words | 31 (10 kanji false friends for Chinese readers) | Kanji, kana, romaji, meaning, light simplified-Chinese note |
| Drawing prompts | 20 subjects × 12 twists | Plus 14 tips (Procreate and traditional) |
| Fashion pieces | 12 tops, 8 bottoms, 6 shoes, 10 accessories | Tagged by vibe, leaning, weather |
| Maomao voice | Greetings 4/3/3/3 by time of day, 3 birthday, 2 birthday-week; 8 mood lines; 10 "why you're you" notes built from Josh's list of what makes her special | Persona guide for the AI writer lives in `voice.js` |
| Birthday | Maomao's letter, 7 birthday-week notes, 10 stickers | |

Corrections made while writing the pools (to stay accurate): lead-white cosmetics "regulated" (not
"banned") in the 1930s; silver's poison-detection claim softened to "mostly folklore"; Snow Miku
fan-designed outfits "since 2012" (not "each year"); an unsourced line about Furina's eyes and
contact lenses cut from the cosplay ideas; film and part-2 dates pinned to midday Japan time
because midnight JST showed the film as December 10 in Singapore.

### 10.2 Daily composition (`server/engine/compose.js`)
- **Deterministic randomness**: xorshift seeded from `sha256(day | salt)`, so a card doesn't change
  on refresh but tomorrow differs.
- **Novelty**: items used in the last 60 days (`shown_items`) are skipped; if a pool is exhausted,
  the least recently used return first.
- Outputs per day: 8 cards, 4 outfits (one per mood), greetings for each time of day plus birthday,
  mood lines, the drawer sticker (birthday cake on Sept 15), the birthday-week note, 3 push texts,
  and the list of used item keys.
- Josh's notes (admin) and signature are mixed in via `server/engine/personal.js`.

### 10.3 Live sources (`server/engine/sources/`, status as of 2026-09-14)
| Source | Used for | Status |
| --- | --- | --- |
| VocaDB `songs` (Miku/Rin/Len originals, YouTube PVs, sorted by rating) | Song-of-the-day pool (up to 300: top-rated Miku originals scoring ≥400, Rin and Len ≥150; 250 in testing; cached a week in `kv`) + song details (BPM, tags) | Working |
| VocaDB `top-rated` (last 168 h) | Rising Miku/Rin/Len songs as fresh finds | Working |
| AniList GraphQL | S3 / S3 part 2 / film status and next episode airing time | Working |
| The Met Open Access `v1.1/search` + `v1/objects` | Artwork of the day from 12 themed searches (Degas dancers, ballet, cat, cherry blossoms, butterfly, medicinal plants, peony, moon, kimono, theater mask, wisteria, musical instrument), public-domain only | Working |
| Anime News Network RSS | Apothecary / Vocaloid / cosplay news by keyword | Working |
| Crypton piapro blog RSS (Japanese) | Official Vocaloid news | Working |
| r/Vocaloid top of day RSS | Fan art and news (NSFW/spoiler words excluded) | Working locally; may be rate-limited from Vercel IPs |
| Anime Corner cosplay RSS | Cosplay news | Working, often 0 matches |
| Kamui Cosplay RSS | Cosplay tutorials | **Timing out** (tolerated) |
| Pointe Magazine, Dance Magazine RSS | Ballet | Working |
| Colossal RSS | Art | Working |
| Parka Blogs RSS | Procreate / drawing | Working |
| Open-Meteo (browser) | Singapore weather for outfits | Working |
Rejected: Art Institute of Chicago (images blocked), Jikan (504s), Tokyo Fashion and Crunchyroll
feeds (blocked/empty), CosplayCentral (503), mikufan/vocaloidnews (unreachable), r/procreate (429).

### 10.4 The daily job (`server/engine/daily.js`, run at 00:10 Singapore)
1. Gather all sources in parallel with timeouts; each fails independently (`settle`).
2. Store fetched items in `source_items`.
3. Candidates = up to 120 items fetched in the last 4 days, never shown before, and not matching
   the "unpleasant news" regex (`UNWANTED` in `daily.js`). **Bug:** the regex ends in `\b`, so it
   only catches exact words ("died", "scandal", "war") and misses plurals and longer forms: tested,
   "deaths", "racism", "controversy", "harassment", "layoffs", "allegations", "arrested", "lawsuits",
   "incidents" and "shootings" all pass. With an OpenAI key the writer's rules filter these a second
   time; with the template writer they can reach her page.
4. Compose the day (or keep today's cards if she already opened the site) and add the live layer:
   song, artwork, Apothecary status, Vocaloid birthdays, template finds (one per category, max 4).
5. If an OpenAI key is set, run the AI writer; on any failure keep the template text.
6. Save the bundle and used items; plan the day's pushes (§11).
- Idempotent: skips if today already has a live bundle, unless run with `force` from admin.
- Measured: ~15 seconds for all sources locally.

### 10.5 The AI writer (`server/engine/writer.js`)
- Request: `responses.create({ model, instructions: persona + rules, input: [JSON], text.format:
  json_schema strict, reasoning.effort: "low", max_output_tokens: 6000, store: false })`.
- Input: date, city, birthday flags, her interests/favourites/cosplays/traits (no identity), today's
  cards (with spoiler flags), song and artwork metadata, Apothecary status, Vocaloid birthdays, up to
  16 candidate items.
- Output schema: greetings for each time of day plus birthday (text + mascot expression), up to 4
  finds (sourceId, headline, blurb), exactly 3 pushes (title, body), song note, art note.
- Rules: English, second person only (no he/she/they about Kiriya), only facts present in the input,
  skip negative or off-topic items, translate Japanese items faithfully, length limits, no quoting
  spoiler cards in pushes, one of the pushes a sincere "what makes you special" reminder.
- Validation: zod length checks; finds with unknown sourceIds are dropped; any error keeps templates.
- Cost: one call per day.

---

## 11. Notifications

- **Subscribe** (`src/lib/pwa.js`): the service worker registration is prepared in advance so
  `pushManager.subscribe()` runs directly inside the "Turn on surprises" tap (iOS requirement);
  the subscription is stored per device and role; re-sent on every app open.
- **Plan** (`server/push/planner.js`): 1–3 surprise pushes per day (default 3) spread across the
  waking window (default 10:00–22:00 Singapore) by splitting it into equal slices with random jitter
  and a minimum gap; plus a heads-up 30 minutes before a new Apothecary episode airs that day, and a
  09:30 note on Vocaloid birthdays. Each row is published to QStash with `notBefore` and
  `deduplicationId`. Example plan from testing: 10:50, 15:42, 20:30.
- **Send** (`POST /api/jobs/send-push`, QStash-signed): the row is claimed atomically
  (`planned → sending`), so retries never double-send; payload is Declarative Web Push
  (`web_push: 8030`, title, body, absolute `navigate` URL, `app_badge`), TTL 3 h, urgency high;
  404/410 subscriptions are deleted; results stored on the row.
- **Service worker fallback** (`src/sw.js`): for browsers without declarative push, always shows a
  notification inside `waitUntil`; tap opens the target page.
- **Admin tools**: send a planned push now, send a custom surprise, see device status.

---

## 12. Privacy and security model

| Area | Implementation |
| --- | --- |
| Private data placement | Identity, traits, letters, notes, mood labels live in `server/` and reach the browser only via `/api/me/*` or `/api/admin/*` after the session check. |
| Leak check | `scripts/check-leaks.mjs` scans `dist/` for: pansexual, panromantic, gender fluid, non binary, binder, transtape, "pronoun", and the server-only marker `KIRIYA_SERVER_ONLY` (set in `server/env.js`, so any accidental server import fails the build). Because of this, API fields avoid those words (`address` instead of pronouns). Passed on every build. |
| Passphrases | scrypt (N=2^15, r=8, p=1, 32-byte key) hashes in env vars; input normalised (NFKC, lowercase, trimmed, single spaces) so phone autocapitals don't matter. Separate `kiriya` and `admin` roles. |
| Sessions | Cookie `kw` = `v1.<payload>.<HMAC-SHA256>`; payload role, issued-at, expiry (180 days), key version (hash of the role's passphrase hash, so changing a passphrase signs out that role everywhere). HttpOnly, Secure in production, SameSite=Lax. |
| Brute force | 8 failed unlocks per 15 minutes per HMAC-hashed IP, then 429. |
| CSRF | Every non-GET request needs header `x-kw: 1` (plus SameSite=Lax). Exempt: signed job callbacks and the Blob upload handshake (which checks the session cookie itself). |
| Role gates | `/api/me/*` and `/api/push/*`: kiriya or admin. `/api/admin/*`: admin only (verified: a kiriya session gets 401). Private responses are `Cache-Control: private, no-store`. |
| Jobs | Accept only Vercel Cron's bearer `CRON_SECRET` or a valid QStash signature on the raw body. |
| Uploads | Allowed types (png/jpeg/webp, mp3/m4a/aac/wav), 15 MB max, folder allowlist, client-side image shrinking; stored URLs must be Blob URLs (or the local dev path). |
| Development-only endpoints | `POST /api/me/dev/reset-today`, local uploads and file serving return 404 in production. |
| Third parties | OpenAI receives interests and traits only (verified against a mock). Lock-screen pushes never quote spoilers. The public profile API returns public fields only (verified). |

---

## 13. Verification: what was tested and how

Local dev server with PGlite; `curl` for API flows; Playwright (headless Chromium, 390×844 phone,
820×1180 tablet, 1440×900 desktop) for UI flows and screenshots; a mock OpenAI server.

| Area | Result |
| --- | --- |
| Auth | Wrong passphrase 401; "  Kiriya " unlocks (normalisation); HttpOnly cookie; tampered cookie 401; admin unlock; lock clears; 9th wrong try → 429. |
| Role separation | Kiriya session → `/api/admin/status` 401. Public profile returns only public keys. |
| Build | `vite build` + service worker + leak check pass (26 files scanned); precache 69 entries (~2.2 MB). |
| Public profile | Splash → landed; no horizontal overflow at phone/tablet/desktop; tiles flip; kitten walks; confetti works. Two layout bugs found and fixed (grid `minmax(0,1fr)` overflow). |
| Today | Template bundle composes correctly (8 cards, outfits, greetings); mood check-in recolours and shows he/him for Masc; drawer awards the birthday-cake sticker on Sept 15; Japanese glyphs render (after the unicode-range fix); letters open at the top. |
| Daily job | All sources gathered in ~15 s (Kamui Cosplay timeout tolerated); song of the day, artwork, 4 finds, S3 date stored; re-running is skipped unless forced. |
| AI writer | Against a mock Responses API: correct endpoint and request keys, `store:false`, strict schema; invented finds dropped; birthday greeting and notes merged; no identity words sent. **Not run against the real OpenAI API.** |
| Push planning | 3 pushes planned at 10:50 / 15:42 / 20:30 SGT; spoiler facts teased; subscription validation rejects bad input; test push with no devices returns a clear 409. **No real push delivered** (needs deployment + a real device). |
| Studio | Drew strokes, mixed colours with Mixbox, saved to gallery through the local upload path, gallery shows the drawing. |
| Stage | Pasting `youtube.com/watch?v=sV7ODBvxw38` resolved via VocaDB to "The princess of Lucifer — mothy feat. Kagamine Rin", auto-starred, and the public profile switched to it. Pitch trainer and ballet corner render (mic flows not exercised headlessly). |
| Atelier / Apothecary | Render correctly; countdown correct in Singapore time; cabinet drawers open; quiz works. |
| Admin | Letter create → visible in her Letters signed "Josh <3"; notes saved; custom push without devices → 409; non-Blob media URL rejected. |
| Not verified | iPhone Safari and the installed PWA; real web push on iOS/Android; the real OpenAI call; QStash scheduling; Vercel Blob uploads; Neon migrations; TextAlive (needs token, phone support unclear); microphone flows on a real phone. |

---

## 14. Known gaps, risks and technical debt

### Bugs found while checking this report (not fixed)
1. **Letters are unreachable outside birthday week.** `src/world/today/BirthdayTakeover.jsx:162` holds
   the only link to `/world/letters`, and the takeover renders only when `isBirthdayWeek`
   (`TodayPage.jsx:37`). After Sept 21 her letters and any open-when notes have no entry point.
   Fix: add Letters to the header or tab bar, or show an "unread letters" card on Today.
2. **News filter misses word forms.** `server/engine/daily.js:20` wraps the word list in `\b…\b`, so
   "deaths", "racism", "shootings" and similar pass (details in §10.4). Fix: drop the trailing `\b`
   or list the stems with `\w*`.
3. **Changing notification settings only takes effect the next day.** `planDay` returns "already
   planned" when any row exists for the day (`server/push/planner.js:35`), so today's times and count
   stay as they were.

### Product gaps
1. **Birthday takeover ends Sept 21.** If the gift is given later she won't see it (no "belated" or
   "first unlock" mode yet).
2. **One passphrase shows everything.** Showing the site to friends ("to showcase") means giving them
   her letters, mood check-in and pronoun settings too. A limited guest/showcase passphrase may be
   wanted.
3. Public "things I'm into" tiles and cosplay names are defaults in server code; she can edit bio,
   socials, songs, avatar/cosplay photos (via admin) but not the tiles or the cosplay list from the UI.
4. TikTok/Discord handles not provided yet (hidden until set).
5. No fallback notification channel (Telegram was the research recommendation) and no email.
6. Letters are plain text (no images or rich formatting).
7. Pitch practice uses random target notes, not song melodies.
8. Studio: single layer, no zoom/pan, exported image uses a flat paper colour (no dot pattern).
9. No guestbook, Discord presence (Lanyard), or friends-leave-a-note feature (common on guns.lol/strawpage).

### Technical debt
1. Unused tables `traits` and `special_dates`; unused dependencies `culori` and `@fontsource/dotgothic16`
   (the `--font-pixel` token in `tokens.css` still names DotGothic16).
2. No automated test suite; verification scripts lived in a temporary folder (only `.data/qa/*.mjs`
   remain, git-ignored).
3. Main public JS chunk is 344 KB (110 KB gzip) because motion, react-router and react-query load up
   front; could be split further.
4. Rate limiting exists only on unlock.
5. Blob files are public-access URLs (unguessable, but not private).
6. `api/index.js` path restoration depends on the `__route` rewrite; verify on the first Vercel deploy.

### External risks
1. iOS can silently drop push subscriptions (mitigated by re-sync on open); Focus/DND hides pushes;
   iOS below 18.4 uses the service-worker path.
2. Reddit may rate-limit Vercel; some feeds break over time (the job tolerates it).
3. AniList is temporarily 30 req/min (one call a day is fine). The Met retires `/v1/search` on
   2026-10-01 (the site already uses `/v1.1`).
4. `web-push` has an unreleased ESM-only major; `vite-plugin-pwa` is heading into maintenance mode.
5. Free tiers: Vercel Hobby (non-commercial, 1-hour logs), Neon (0.5 GB, 100 CU-h), QStash (1,000
   messages/day, 10 schedules, 7-day max delay). Check Vercel Blob's current free allowance before
   uploading a lot of photos and covers.
6. Licences to keep honouring: Mixbox CC BY-NC (credited), VocaDB CC BY (credited), Open-Meteo
   CC BY (credited), TextAlive credit link, Crypton character guidelines, AniList non-commercial.

### Development traps discovered (for whoever continues)
- `pkill -f "vite --port 5188"` matches its own shell and kills it (exit 144); use `[v]ite`.
- Killing the dev server can corrupt the PGlite folder; `server/db/client.js` now moves a broken copy
  aside and starts fresh. Stop the dev server with Ctrl+C.
- Libraries imported lazily must be listed in `optimizeDeps.include` or Vite serves a 504
  "Outdated Optimize Dep".
- fontsource `latin-*.css` files omit `unicode-range` and hide the Japanese slices (hence the hand
  declared faces in `fonts.css`).
- CSS grids without `grid-template-columns: minmax(0, 1fr)` let wide children (scroll rows, iframes)
  stretch the page.
- Several live Playwright browser contexts at once made screenshots hang; close each context.

---

## 15. Deployment status and next steps

**Status:** code complete locally; git initialised with **no commits**; nothing deployed; no
production accounts or secrets exist yet. Local dev secrets are in `.env.local` (git-ignored).

**Owner actions** (full walkthrough in `docs/SETUP.md`):
1. Create a private GitHub repo; commit and push.
2. Vercel project (Vite preset) with **Neon** and **Blob** storage connected.
3. **Upstash QStash** tokens and signing keys.
4. Generate secrets: `npm run hash -- "<phrase>"` for both passphrases, `SESSION_SECRET`,
   `CRON_SECRET`, VAPID keys (`npx web-push generate-vapid-keys`), a real `VAPID_SUBJECT` email.
5. A new **OpenAI API key** with a spend limit; optional **TextAlive** token.
6. Set every variable in `.env.example` (mark secrets Sensitive), deploy, add the domain
   `iloveukiriya.com` and DNS records.
7. `npm run setup:qstash` once to create the 00:10 SGT schedule.
8. In `/admin`: write the birthday letter, add notes, upload her avatar and cosplay photos, run the
   daily job, preview her world; confirm the status panel is all "ready".
9. On her iPhone: open the site in Safari, unlock, Add to Home Screen, open the app, unlock again,
   Settings → Turn on surprises → Send a test.

**Recommended before handing it over:** fix the two bugs in §14 (Letters link, news filter), decide
the birthday-week question (§16 Q1), and do one real iPhone test of install, unlock, notifications
and microphone features.

---

## 16. Open questions for the next planning round

1. **Gift timing:** when will she receive it? Extend birthday week, add a "belated birthday" mode,
   or trigger the takeover on her first unlock regardless of date?
2. **Showcasing to friends:** add a second, limited passphrase (public profile + safe sections, no
   letters/mood/pronouns)?
3. **Her control:** should Kiriya be able to edit the public interests, cosplay list and badges
   herself (not just Josh via admin)?
4. **More personal content:** inside jokes, nicknames, memories, favourite foods/flowers, specific
   Vocaloid producers and songs, favourite Maomao moments, ballet goals, upcoming cons, photos of the
   two of them. All of these would make daily messages more personal.
5. **Notification fallback:** add Telegram (free, reliable) in case iOS web push is flaky?
6. **Social features:** guestbook or ask box on the public profile, Discord presence (Lanyard), a
   visitor wall of stickers? These need moderation.
7. **Deeper interests:** Project SEKAI event calendar, con calendar for Singapore, Procreate brush
   packs, a Japanese study streak (SRS), ballet practice log with streaks, AniList episode tracking.
8. **Performance and quality:** add automated tests, split the public bundle, remove unused
   tables/deps, add backups for Neon.
9. **Rora infrastructure:** confirm the site should stay fully separate from Rora (current design).

---

## 17. Appendices

### A. Commands
```bash
npm install
npm run setup          # .env.local for development
npm run dev            # http://localhost:5173 (passphrases: kiriya / admin)
npm run build          # production build + leak check
npm run hash -- "..."  # passphrase hash for Vercel
npm run db:generate    # new migration after schema changes
npm run db:migrate     # apply migrations to DATABASE_URL
npm run setup:qstash   # create the daily schedule (production, once)
npm run icons          # regenerate app icons
```

### B. Environment variables
`SITE_URL`, `KIRIYA_TZ`, `KIRIYA_PASSPHRASE_HASH`, `ADMIN_PASSPHRASE_HASH`, `SESSION_SECRET`,
`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
`QSTASH_NEXT_SIGNING_KEY`, `QSTASH_URL` (optional), `CRON_SECRET`, `VITE_VAPID_PUBLIC_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`VITE_TEXTALIVE_TOKEN` (optional).

### C. Key identifiers
- VocaDB artists used in code: Miku 1, Rin 14, Len 15. Others from research (not used yet): Luka 2,
  GUMI 3, KAITO 71, Teto 116, MEIKO 176, IA 504.
- Default song: Senbonzakura original PV, YouTube `shs0rAiwsGQ` (VocaDB 8394).
- AniList: S3 195516, S3 part 2 200927, film 200929, Maomao 126824.
- Magical Mirai 2026 TextAlive songs: 6W2N, zoqO, PNpQ, B3yJ, QBdL, E2i3 (timing IDs in
  `src/world/stage/LyricTheater.jsx`).
- Mood keys: `rose` (Femme), `iris` (Fluid), `night` (Masc), `cloud` (Just me).

### D. Related documents in the repo
- `docs/PLAN.md`: the plan written before building, updated with phase status.
- `docs/SETUP.md`: step-by-step deployment and iPhone onboarding.
- `README.md`: developer overview.
- `.env.example`: every variable with where to get it.
