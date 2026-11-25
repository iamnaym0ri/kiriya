# Handoff: kiriya.love connection refactor → the Mac session

Written 2026-11-25 by the Claude session that built phases 1–4b on Josh's Linux (WSL) machine. A fresh Claude Code session on Josh's Mac takes over from here: build and ship the iPhone app, deploy, then build what's left (phases 5–7). Read this first, then `docs/refactor/PLAN.md` (the master plan and decisions) and `docs/refactor/MAC-BUILD.md` (Xcode steps).

The previous session's memory lives on the other machine and is not available on the Mac. Everything it knew that matters is in this file.

---

## 1. Who and what

- **Josh** (git user `iamnaym0ri`) owns this repo. It's **kiriya.love**, a private gift site for his partner **Kiriya**, who lives in Singapore. It's deployed on Vercel Hobby.
- **The site's direction (since 2026-11-24).** In his words, it should be "not providing content but to be a connection from me to her", plus information on "things super important to her which are conventions and merch".
- **How Josh works:**
  - He writes casually, with typos.
  - He decides quickly and usually takes the recommended option, often adding a typed note that widens the scope.
  - **Ask him things through the question UI** (AskUserQuestion, up to 4 questions per round, with concrete options and a recommended one first). Never send a free-text list of questions. He's happy to answer many rounds.
- **Rules he set** (follow them):
  - **Open source first.** Search GitHub and npm and import or adapt a maintained, permissively licensed project before building from scratch. Credit every borrowed piece in `docs/redesign/ASSETS.md` and in the site's Art & credits.
  - **Additive UI only**, except where he asked for a redesign. The letters & notes hub, the events & merch section, the chat and the app-only UI may be designed freely. The home opening, doodle, Maomao and the existing games keep their look; new things there reuse existing components and classes.
  - **Commit, push and deploy only when he says.** His instruction was "hold, we will deploy as much work as possible together".
  - **Keys** go into Vercel env and `.env.local`, never into chat. Ask for a key only when the phase that needs it starts.
  - **Claude API ceiling:** US$20/month (phase 6).
  - Don't crawl sites that forbid it (Suntec, Singapore EXPO, some malls). Use official channels. Apify for Instagram is his explicit choice, made knowing Meta's terms forbid scraping.
  - The Miku and Maomao wallpapers are official art, built in only because the repo is private. They're served only after login and never redistributed.

## 2. State of the code

- **Nothing from phases 1–4b is committed.** It was all built in the WSL working copy on `main`. It reaches the Mac through git: the plan is a commit on a branch, pushed, then checked out on the Mac. Run `git log -1` and `git status` to see what you have.
- **Last full run on Linux:** `npm test` gave 282 tests with 281 passing. The one failure, "Media gates require recorded YouTube playback…", **was failing before this work and is unrelated**. `npm run build` passes, including the leak check.
- **`docs/note.md`** is an untracked note about Instagram/Meta APIs that the previous session did not write. Leave it alone unless Josh says.

### Stack (quick map)

- **Web:** Vite 8 + React 19 SPA (JS/JSX), react-router 8, TanStack Query 5 (persisted to IndexedDB), motion.
- **API:** Hono in `server/`, served by one Vercel function (`api/index.js`). `vercel.json` rewrites `/api/*`.
- **Database:**
  - Neon Postgres via Drizzle in production; PGlite locally and in tests.
  - Migrations live in `server/db/migrations` and are generated with `npm run db:generate`.
  - `vercel-build` runs `scripts/migrate.mjs`, so **0006–0009 apply on the next deploy**.
- **Storage and timed jobs:** private Vercel Blob (served through `/api/uploads/media`). QStash for timed callbacks. Vercel Hobby crons run once a day.
- **Push:** web push (VAPID) plus native APNs (`@parse/node-apn`, token `.p8` key), fanned out by `server/push/webpush.js` → `sendToSubscribers`.
- **iPhone app:**
  - Capacitor 8.6 with SPM, in `ios/App`. Bundle id `love.kiriya.app`, display name "kiriya.love", team `9W8CN9V8NR`. iOS 17+ (owner approved).
  - Distribution is TestFlight (`ios/build.sh testflight`). Install guide at `/install/`.
- **Local development:**
  - `npm run dev` runs Vite on 5173 and the Hono API inside it.
  - The dev passphrases are `kiriya` and `admin`.
  - `npm test` runs the suites, using PGlite in memory with network off.

## 3. What's built (phases 1–4b)

| Phase | What | Key files |
|---|---|---|
| 1 | Removed memes, the Maomao club, music and "new drops"; the letters & notes hub stands out; her song shelf moved to Settings → Your songs | `src/world/today/TodayPage.jsx`, `server/feeds/config.js` (`FEED_RETIRED_SECTIONS`) |
| 2 | Note jar from admin, one note at a time; released at 08:00 SGT with one push; red heart on the jar | `server/lib/noteJar.js`, `server/routes/noteJarAdmin.js`, `src/admin/Admin.jsx` (NoteJarAdmin), `src/world/today/NoteJar.jsx` |
| 3 | iPhone app shell: Face ID unlock (Keychain secret → `/api/session/app`), APNs, the cursive lilac icon | `server/lib/appDevices.js`, `server/routes/app.js`, `server/push/apns.js`, `src/lib/native.js`, `src/shared/NativeApp.jsx`, `docs/refactor/IOS-APP.md` |
| 4 | Full chat (text, photos, GIFs, 30 animated stickers plus her own, voice notes, 7 "thinking of you" taps, replies, reactions, unsend, seen, typing), 9 bubble themes, 6 backgrounds (incl. the official Miku/Maomao wallpapers), 4 typing styles, "our memories" scrapbook | `server/lib/chat.js`, `server/routes/chat.js`, `src/lib/chat.js`, `src/world/chat/*` |
| 4b | Native-feeling app: see below | see below |

### Phase 4b in detail (what the Mac has to bring to life)

**Site bundled in the app, updated over the air.**
- `capacitor.config.json` has `webDir: "dist-app"` and **no `server.url`**.
- `npm run build` runs `vite build`, then `scripts/build-app-bundle.mjs`, which:
  - fills `dist-app/` for `cap sync`, leaving out the service worker, the install page and the `.woff` fallbacks, and adding `ota-builtin-hashes.json`;
  - writes `dist/app-bundle/latest.json`: the version, `minBuild`, and every file with its SHA-256 and kiriya.love URL.
- `src/lib/appUpdates.js` calls Capgo's open-source updater in **manual mode** (`autoUpdate: false`, `statsUrl: ""`, so nothing goes to Capgo's cloud):
  - it downloads only the files that changed, then `next()`, so the new version applies the next time the app goes to the background;
  - `markAppReady()` runs on every launch; if it doesn't, the updater rolls back by itself.
- `mobile/app-native.json` → `minBuild`: **raise it** whenever web code starts relying on native code that older TestFlight builds lack.
- The bundle's version is `1.YYYYMMDD.HHMMSS`, stamped by a Vite plugin in `vite.config.js`.

**Sign-in from the app** (it runs on `capacitor://localhost`, where the kiriya.love cookie never travels).
- `src/lib/api.js` sends `x-kw-token: 1` on `/session*` calls; the server then also returns `token`.
  - The app keeps the token in sessionStorage, so it survives an in-app reload but ends when the app closes.
  - It sends the token as `Authorization: Bearer v1.…`, which `readSession` accepts (`server/auth/session.js`).
- **CORS** for `capacitor://localhost` sits first in `server/app.js`. Extra origins come from `APP_ORIGINS`, for local tests only.
- **Private media** (`<img>` can't send headers). For bearer requests, middleware in `server/app.js`:
  - rewrites `/api/uploads/media?path=…`, `/api/uploads/file/…` and `/api/uploads/wallpapers/…` in JSON responses into absolute links with a per-file HMAC `s=`;
  - turns them back into plain links in what the app sends, so **the database only ever holds the website's plain links**. See `server/lib/mediaLinks.js`.
  - The media, file and wallpaper routes accept a valid `s`.
- Uploads go straight to Blob with an Authorization header on the handshake, then `/api/uploads/resolve` returns the signed link.
- Verified in a browser: a bundled build was served from another origin, with only the token and no cookies, and the chat, the signed wallpaper and a photo upload all worked with no errors.
- **An alternative if bearer auth misbehaves on a device:** Rora's `TrialBridgeViewController` overrides `instanceDescriptor().urlHostname` so the bundle is served from the API's own host, which may make cookies first-party. It's untested here.
- **Rollback switch:** putting back `"server": { "url": "https://kiriya.love/world", "allowNavigation": ["kiriya.love"] }` returns the app to the phase-3 "live site" mode. Cookies, the website and all native code still work in that mode, but there are no offline starts.

**Widgets, notification buttons, Siri.**
- At Face ID setup, `POST /api/app/devices` returns a `widgetKey` (a `device_keys` row linked through `app_devices.widget_key_id`, migration 0009). Revoking the phone revokes the key.
- JS writes `widgetKey`, `apiBase` and `role` into the App Group `group.love.kiriya.app` through `capacitor-widget-bridge`.
  - `ensureWidgetKey` renews the key (`POST /api/app/devices/:id/widget-key`) after a reinstall.
- **Widget API** (Bearer widget key):
  - `GET /api/widget/app` returns the snapshot.
  - `POST /api/widget/tap {kind, clientId?}` and `POST /api/widget/reply {text, replyTo?, clientId?}` are idempotent on `clientId`.
  - Swift uses `n-<notification id>-heart` / `-reply` as the clientId.
- **Swift** (written by a sub-agent, **never compiled**):
  - `ios/App/KiriyaShared/`: group keys, API client, the `SendTapIntent` App Intent.
  - `ios/App/KiriyaWidgets/`: Little note, Note jar, Thinking of you (interactive buttons plus a Lock Screen heart), Next con.
  - `ios/App/KiriyaNotificationService/`: adds the envelope or jar picture.
  - `ios/App/App/KiriyaNotifications.swift`: categories, plus native "♡ back" and Reply in a background task; everything else is forwarded to Capacitor so JS still opens `navigate`.
  - `KiriyaAppShortcuts.swift`: Siri phrases.
  - `MainViewController.swift`: swipe-back, and takes the notification delegate back from Capacitor.
  - `SceneDelegate.swift`: quick-action forwarding.
  - Plus `PrivacyInfo.xcprivacy`, `Sounds/*.caf`, and the alternate icon sets (Night, Blush, Mint, Paper).

**Pushes** (`server/push/apns.js`):
- Each kind has its own category, thread and sound: chat `chat.caf`, tap `tap.caf`, letter and note `letter.caf`, jar and reminder `jar.caf`, events use the default sound.
- `aps.badge` is the person's unread total (`server/lib/appBadge.js`: chat, plus for Kiriya her unread notes and new jar notes).
- Letters, notes and the jar carry `mutable-content` so the extension can add the picture.
- Chat pushes carry `messageId` for Reply.
- **Evening jar reminder:** `remindJar`, through QStash at 19:00 SGT, but only if the morning's notes are still undrawn and the time is inside her notification hours.

**In the app (web code, active only inside it):**
- `NativeApp.jsx`:
  - Face ID lock: on a cold start, or after 5 minutes away.
  - Runs badge sync (`GET /api/app/unread`) and widget reloads.
  - Quick actions: "Send a ♡", "Open chat", "Pull a note".
  - `kiriyalove://open/…` deep links and notification taps, held until the app is unlocked.
  - Checks for an update on every return to the app.
- `AppTabBar.jsx`: home / letters / play / events / me, with the unread count on letters. It's hidden in the chat and while typing.
- Also: `PullToRefresh.jsx`, haptics, the icon picker in Settings (`AppIconPicker.jsx`), keyboard tracking (`Keyboard.resize: "native"`).

**Everywhere:**
- The query cache is persisted to IndexedDB (`src/lib/persist.js`). The session is never stored, and locking wipes the cache.
- "Save to our memories ✿" on letters, little notes and jar notes.

## 4. Do this next, in order

1. **Get the code onto the Mac.** If Josh hasn't pushed it yet, ask him; it needs a commit from the WSL machine. Then:
   - `npm ci`
   - create `.env.local` (copy from `.env.example`; dev works with almost nothing)
   - `npm test`, which should report one failure, Media gates
   - `npm run build`
   - `npx cap sync ios`
2. **Deploy the server before testing any TestFlight build.** The bundled app talks to https://kiriya.love, so production needs this code: bearer sessions, CORS, the widget routes, `/app-bundle/latest.json`, and migrations 0006–0009. Confirm with Josh first (it's his call when to deploy). Vercel env to add or check:
   - `ABLY_API_KEY` (free Ably app; without it, chat polls every 4 s)
   - `GIPHY_API_KEY` (without it, GIF search is off)
   - `APNS_KEY` (the whole `.p8`), `APNS_KEY_ID`; `APNS_TEAM_ID`/`APNS_BUNDLE_ID` have defaults
   - QStash keys (should already exist; needed for the 08:00 jar release and the reminder)
   - `FEED_RETIRED_SECTIONS` unset: the default retires maomao, music, dressup, meme
   - Don't set `APP_ORIGINS` in production.
3. **Xcode:** follow `docs/refactor/MAC-BUILD.md`. It covers adding the KiriyaWidgets and KiriyaNotificationService targets, target memberships, App Groups, signing for all three targets, sounds as a group, and build settings. Then:
   - `ios/build.sh run <phone-udid>` on Josh's phone first;
   - fix compile errors, which are expected since the Swift was never compiled;
   - then `ios/build.sh testflight`.
4. **Check on Josh's phone first**, using the checklist in MAC-BUILD.md §6. The items most likely to need work, from MAC-BUILD.md's UNVERIFIED list and this side:
   - The notification delegate takeover: a plain tap and "Open" must still reach JS, cold and warm. Also check that "♡ back" and Reply send in the background.
   - Bearer sign-in and Face ID on a real device; that signed images and wallpapers load in WKWebView; uploads (Blob handshake with an Authorization header).
   - The Capgo update cycle: deploy a tiny change, reopen the app twice, and confirm it arrives without a TestFlight build.
   - Widgets: reading the App Group key, the interactive tap buttons, and timeline refresh.
   - Swipe-back with react-router (possible double navigation).
   - The keyboard in the chat (`resize: native`). Note that the research suggested `none` plus a transform might be smoother.
   - Maomao's companion and the "little corner" sitting above the new tab bar: the corner is offset; Maomao wasn't checked.
   - The Settings → Phone widget card still says "iPhones don't let websites make widgets…". Inside the app that's stale; it could be reworded there. Its key list also shows the app's own "iPhone app" key, and revoking that breaks the app's widgets.
   - Locking from Settings shows the passphrase gate but stays on `/world/settings` instead of going to `/`. That was the behaviour before 4b and is harmless.
5. **Then Kiriya:** invite her as an **internal** TestFlight tester, so Apple's beta review never needs access to her private world. Josh tests first, then tells her (see `IOS-APP.md`).

## 5. What's left to build after the app ships

All of it is specified in `PLAN.md`; the decisions there are Josh's and are settled.

- **Phase 5: quizzes and a 25-game library.**
  - **Quizzes sent to each other.** A push says "Kiriya sent you a quiz question ♡". Each question has an image (upload or clean stock) and multiple-choice answers with emoji. There's an "about me" mode where the sender sets the right answer, plus "about us". They keep scores and streaks. It should be very pretty and clean in the app.
  - **Games:** five per category: pastime, brain power, luck, artsy and dexterity. The candidate list is in PLAN.md. Adapt open-source implementations under our own names and art. Rewards tie into the sticker collection.
  - Use `kind: "quiz"` pushes; add a category in `apns.js` and in `KiriyaNotifications.swift`.
- **Phase 6: events & merch.**
  - A Railway worker does change detection over the sources in `SG-EVENT-SOURCES.md`.
  - Haiku 5.5 triages, and Opus 5.5 investigates with web search and fetch, under a US$20/month ceiling with a spend ledger in admin.
  - Apify watches a few key Instagram accounts as a trigger only; there's also a paste-a-link box and a newsletter Gmail inbox.
  - Each event gets a dossier with a timeline and update log.
  - Weather from Open-Meteo and NEA; transit from LTA.
  - Pushes: big items instantly, the rest weekly.
  - Retire the OpenAI events stage. Draft the permission emails to Suntec and EXPO.
  - Josh provides: `ANTHROPIC_API_KEY`, a Railway project, an Apify token, a Gmail inbox, and optionally LTA and data.gov.sg keys.
  - Open question for him: move Maomao's `/me/maomao/ask` from OpenAI to Haiku.
  - The widget's "Next con" already reads the `events` table: SG tier, confirmed, soonest first.
- **Phase 7: mini Miku.** A hand-drawn SVG chibi on a generalised Maomao companion engine, with the Crypton credit line.

## 6. Conventions that kept things working

- **Tests:**
  - `node --test` files in `scripts/test-*.mjs`, which call the real Hono app through `api/index.js` against an in-memory PGlite, with network off.
  - Add new suites to `package.json` → `test`.
  - Browser checks use Playwright against `npm run dev`. Use role selectors and unique text per run, and clean up the test data they create.
- **Server:** zod for input; friendly `message` strings, since they're shown to her; `Cache-Control: private, no-store` on private routes; background work via `server/lib/background.js`.
- **Web:** everything native goes through `src/lib/native.js`, which loads plugins lazily and checks `Capacitor.isPluginAvailable`, so web visitors never download plugin code and old app builds skip missing features.
- **Progress notes** go in PLAN.md under each phase. Docs are written plainly.
- **Licensing:**
  - The updater is MPL-2.0 (fine unmodified).
  - The Fluent Emoji stickers are MIT.
  - The Miku art follows Crypton's guideline §E(3): non-commercial, with credit.
  - The Maomao wallpaper keeps its © line.
  - Credits show in Art & credits.
