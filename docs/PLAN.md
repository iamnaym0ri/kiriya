# iloveukiriya.com — Kiriya's World

A birthday gift that keeps giving: a guns.lol × strawpage public profile, and behind a passphrase a
private PWA that knows Kiriya's interests, talks in a Maomao-inspired voice, and surprises her on her
iPhone every day.

## Who it's for (facts that shape everything)

- **Kiriya.** Birthday **September 15** (2026 is the gift year; a *birthday week* runs Sep 15–21).
  Lives in **Singapore** (`Asia/Singapore`, UTC+8). Uses an **iPhone**.
- Pansexual and genderfluid. **This is private.** It must never appear on the public profile or in
  any file a visitor's browser can download without the passphrase.
- Pronouns follow a **daily mood check-in** (femme / fluid / masc / neither). Copy is written in the
  second person wherever possible so pronouns rarely matter.
- Interests:
  - **The Apothecary Diaries**, Maomao above all ("Maomao solo queen", not shipping). Read the
    **manga**, so manga events are fine; light-novel-only reveals sit behind a tap.
  - **Vocaloid**: Hatsune Miku, Kagamine Rin & Len. Classics, newer hits / Project SEKAI, Rin & Len
    story songs.
  - **Art**: digital (iPad / Procreate) and traditional drawing.
  - **Cosplay**, experienced: has done Maomao, Miku, Lynette (Genshin). Styles wigs.
  - **Ballet**: trains. Reminders "here and there".
  - **Singing and dancing.**
  - **Fashion**: Harajuku/kawaii, jirai kei/sweet goth, streetwear/skater tomboy, Y2K/alt.
  - **Japanese**: wants to study it. Reads simplified Chinese, used *lightly*. The site is English.
- What makes her special (from the person giving the gift): passionate about her interests, many
  complex talents (ballet), kind, sassy, animals love her, pretty, caring, a kind soul, the happiness
  she brings, her sense of humor.
- Public socials: TikTok, Discord. No pets: an original calico kitten companion (the series' cat is
  literally named Maomao) follows her around.

## Product

### Public (no passphrase) — `/`
guns.lol × strawpage profile, phone first:
- "tap to enter" splash (unlocks audio + motion permission in one gesture).
- Tilt profile card: doily-framed avatar, animated name, badges, typewriter bio, real view counter,
  TikTok / Discord.
- Favourite song card (YouTube/Spotify/SoundCloud link or an uploaded cover she sang).
- Birthday-week banner, scrapbook widgets from v1 (public-safe content only).
- A locked medicine drawer: "for kiriya only" → passphrase.

### Private (passphrase) — `/world/*`, installable PWA
- **Today**: Maomao greeting, mood check-in, today's cards (Maomao fact, herb, Vocaloid, cosplay,
  art prompt, ballet, Japanese word, outfit, "what makes you special"), fresh finds from the web,
  a daily medicine-drawer surprise, birthday takeover during birthday week (letters, candles).
- **Studio**: pressure-aware drawing canvas (Apple Pencil), prompt of the day, Mixbox paint mixing,
  gallery, artwork of the day.
- **Stage**: favourite songs, Vocaloid song of the day, karaoke pitch meter, TextAlive lyric theatre
  (optional token), ballet corner (term, practice timer, balance challenge).
- **Atelier**: cosplay project planner, advanced tips, wardrobe generator (vibe × mood × Singapore
  weather).
- **Apothecary**: S3 / film countdowns, spoiler-aware fact deck, herb cabinet, "poison or
  medicine?" quiz.
- **Letters**: birthday letters (from the giver, signed with their name, and from Maomao),
  open-when notes.
- **Settings**: install-to-Home-Screen guide, notifications, quiet hours.
- **Admin** (separate passphrase): letters, notes, traits, signature, special dates, public profile
  config, run curation, test push, delivery log.

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19.3 + Vite 8, react-router, TanStack Query, motion, GSAP | Existing base |
| PWA | vite-plugin-pwa 1.3 `injectManifest`, `autoUpdate` | Custom push handler; iOS-safe update |
| API | One Vercel Node function (`api/index.js`) running a Hono app | One cold start, shared code, dev middleware |
| DB | Postgres via Drizzle: **Neon** in prod, **PGlite** file DB in dev | Never pauses; no local services needed |
| Files | Vercel Blob (client uploads, shrunk on device) | Drawings, covers, avatar, photos |
| Scheduling | Upstash **QStash**: `CRON_TZ=Asia/Singapore` daily planner + delayed sends; Vercel Hobby cron as backstop | Hobby cron can't fire at random times |
| Push | `web-push` 3.6.7, Declarative Web Push payload (`web_push: 8030`) + SW fallback | iOS 18.4+ reliability |
| Writer | OpenAI Responses API, `gpt-5.4-mini-2026-03-17`, strict JSON schema, `store: false` | Maomao voice over fetched/curated facts only |
| Auth | Passphrase → scrypt verify → HMAC-signed httpOnly cookie; separate admin passphrase; rate-limited | Asked for "keep it simple" |

### Privacy rules (enforced by `npm run check:leaks` after every build)
1. Private content (identity, traits, letters, notes, mood labels, planner, gallery) is served only
   by `/api/me/*` or `/api/admin/*` after the session check. It never lives in `src/`.
2. Curated pools and the private profile live in `server/`, which the client never imports.
3. The build output is grepped for sensitive terms; any hit fails the check.

### Content engine (daily, 00:10 Singapore)
1. **Fetch**: VocaDB (Miku 1, Rin 14, Len 15), AniList (S3 195516, film 200929), RSS feeds, Art
   Institute of Chicago / The Met, all with timeouts, caching and static fallbacks.
2. **Select**: score candidates by interest weight, novelty (no repeats), spoiler level, special-date
   boosts, and category diversity.
3. **Write**: one strict-JSON OpenAI call turns selected facts into Maomao-voice cards and three push
   texts. The prompt forbids adding facts; failures fall back to templates.
4. **Plan pushes**: 2–3 random times between 10:00 and 22:00 Singapore time (≥2.5 h apart), each a
   QStash delayed message; rows are claimed atomically so retries never double-send.

## Phases (all built and verified locally, 2026-09-14; not deployed yet)

0. **Foundation**: structure, Hono API + dev middleware, Drizzle/PGlite/Neon, passphrase auth,
   PWA shell, leak check. ✓
1. **Public profile** (guns.lol × strawpage). ✓
2. **Private shell + Today + birthday takeover + mascot**. ✓
3. **Content engine**: pools, fetchers, selection, writer, daily job. ✓ (AI writer verified against a
   mock of the OpenAI Responses API; needs a real key to run for real.)
4. **Notifications**: install guide, subscribe, planner, sender, logs. ✓ (real delivery needs the
   deployed site, VAPID keys and QStash; test on her iPhone after install.)
5. **Studio** ✓ 6. **Stage** ✓ 7. **Atelier + Apothecary** ✓ 8. **Admin, QA, deploy guide** ✓
   (`docs/SETUP.md`).

### Verified behaviour worth remembering
- Passphrase: normalised (case and spacing), HttpOnly signed cookie, tamper-proof, 8 wrong tries per
  15 minutes per IP, then 429.
- Daily job: 13 sources in ~15 s; a failing feed only drops its items. Songs come from a VocaDB pool
  of 250 Miku/Rin/Len originals; artwork from The Met; season 3 airing time from AniList.
- Push plan example: 10:50, 15:42, 20:30 Singapore time; spoiler facts are teased, never quoted.
- Nothing personal reaches OpenAI: the writer gets interests and traits, not identity.

## Licences and credits to show on the site
- VocaDB data (CC BY, link back). AniList (non-commercial). Open-Meteo (CC BY 4.0, visible link).
- Mixbox (CC BY-NC 4.0 attribution). TextAlive (credit link to developer.textalive.jp).
- Hatsune Miku © Crypton Future Media (CC BY-NC 3.0 for official illustrations; no fan-model reuse).
- Maomao mascot is original fan art drawn for this site; no official artwork is copied.
