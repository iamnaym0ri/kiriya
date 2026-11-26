# kiriya.love refactor: connection first

Started 2026-11-24. Owner: Josh. This replaces the "daily content feed" direction of September (docs/feeds/PIPELINE.md).

## Direction

The site stops trying to supply content. From now on it does three things:

1. **Connects Josh and Kiriya**: letters, little notes, a full chat, the note jar, quizzes sent to each other, games and doodles.
2. **Keeps her informed about what matters to her in Singapore**: conventions, fairs, pop-up shops and merch, all in one section and researched properly.
3. **Keeps her company**: Maomao, joined by a mini Miku.

## Ground rules

- **Open source first.** Import a maintained library or adapt an MIT/Apache project and restyle it wherever one exists. Build from scratch only what nothing covers. Every borrowed piece gets a credit and a licence line in `docs/redesign/ASSETS.md` and the in-site **Art & credits**.
- **Redesign where asked, keep the rest.** The letters & notes hub and the events & merch section get a real redesign. Doodle, the home opening, Maomao and the existing games keep their current look; new games reuse it.
- **Crawl politely.** Respect robots.txt and site terms. Where a source forbids crawling, use its official channels instead: newsletters, organiser feeds, written permission, and Claude's web search during research.
- **Claude API, with a ceiling.** Haiku 5.5 does the cheap "is this a new event?" triage. Opus 5.5 does the research and the write-up. There is a hard **US$20/month** ceiling, and the crawler pauses instead of overspending.

## Decisions (2026-11-24)

| Topic | Decision |
| --- | --- |
| Removed sections | Memes, Maomao appreciation club, the music section, and the dress-up "new drops" (cosplay display) |
| Music | Keep the song Josh picks for her as the small player on the home page. Remove the Miku music feed, the stage page, the pitch trainer and the lyric theater. |
| Her phone | iPhone |
| App | Capacitor 8 (same as Rora), distributed through **TestFlight** (changed from ad hoc on 2026-11-24 because ad hoc needs Developer Mode). It is a real app on her home screen with native push through APNs. A build is re-uploaded every ~80 days. |
| Monitor | An always-on Railway worker runs cheap checks every 15–60 min. Haiku 5.5 triages changes, then Opus 5.5 investigates. No local model. |
| Budget | US$20/month Claude ceiling; pause when it is reached |
| Event scope | Singapore only; the overseas descriptors are dropped |
| Event push | Instant push for big items (cons, pop-ups and merch tied to her fandoms); everything else goes in a weekly digest |
| Instagram/Facebook sources | **Apify as the middleman** (owner's choice, 2026-11-24, aware that Meta's terms forbid scraping): it watches the Instagram accounts that track Singapore cons and pop-ups, both organisers and the accounts that repost what is on at Suntec and other venues, and streams new posts into triage. The crawler supplies the rest. Also: a paste-a-link box in admin and a newsletter Gmail inbox. |
| Blocked sites (Suntec, Singapore EXPO, some malls) | Don't crawl their websites. Tap them as much as possible through other channels: Instagram accounts that cover them (via Apify), written permission (Suntec's terms allow it), their newsletters, organiser feeds, and web search. |
| Chat build | Assembled from open-source parts, with messages in our own database |
| Chat realtime | Ably free tier. Only message IDs pass through Ably, never the text. |
| Josh's side of chat | The same chat screen, signed in as admin, on the site and in his own install of the app. Push goes to both phones. |
| New note-jar notes | Added from admin at any time and held until **08:00 SGT**. A notification goes out only on days with new notes. The jar shows a red heart and an animation until she draws them, and the next draws show the new notes first. |
| Build order | Foundations first (phases below) |

## Site map after the refactor

Home (`/world`), top to bottom:

1. **Opening**: welcome, her portrait, the song Josh picked for her.
2. **Letters & notes hub**, made to stand out: **Messages** (chat), **Letters**, **Little notes** (the inbox), the **Note jar**.
3. **Doodle**: the sketchbook stays as it is.
4. **Games**: the library, grouped into five categories, plus **Quizzes for each other**.
5. **Events & merch**: one large section for everything going on in Singapore.

Always present: **your little corner** (bottom-left), Maomao, and later the mini Miku.

Retired routes `/world/stage`, `/world/atelier` and `/world/apothecary` redirect home. `/world/saves` is kept and later becomes "events and merch I saved".

## Phases

Each phase ships on its own.

### 1. Clear the stage (done 2026-11-24, not yet committed or deployed)

What changed, beyond the list below:
- The song shelf (adding links, uploading recordings, starring her profile song) was not dropped with the music page. It moved into **Settings → Your songs**, next to the intro-song picker, because admin has no song controls and her public page depends on it.
- The home player starts on the starred song.
- Her own dress-up diary photos are no longer shown in her world. They stay in the database and on her public profile.
- The retired feed sections can be switched back on with `FEED_RETIRED_SECTIONS=""`.
- `scripts/verify-redesign.mjs` was already stale before this phase: it expects four daily cards, and there is now one. It will be rebuilt alongside the phase 4 hub.


- Remove the memes, Maomao club, music and dress-up sections from home, the bookmarks bar and the mobile menu, and remove the routes listed above.
- Reorder home to the new site map. Until their phases land, the hub links to the existing letters, notes and jar.
- Stop the collectors that fed only the retired sections, so they no longer spend the feed budget. The current events strip and merch shelf stay live until phase 6 replaces them.
- Point notification links that named retired pages back to home.

### 2. Note jar from admin (done 2026-11-24, not yet committed or deployed)

As built:
- The bundled library (`server/content/noteJar.js`) is **erased**. Her pull history and hearted favourites are kept, as Josh chose.
- Admin → **The note jar ♡** (top of the desk):
  - Type a note and press ⌘/Ctrl+Enter or "Put it in the jar ♡". The cursor stays in the box for the next one.
  - Mood chips are optional: "any day" by default, or the check-in feelings.
  - Each note can be edited or removed. A waiting note has **Skip the wait**, which puts it in her jar right away.
- New notes join her jar at the next 08:00 SGT. They show a red heart with a count on the jar and the "letters & notes" door, and come out first, oldest first.
- One push that morning: a cron at 00:00 UTC, plus an exact QStash callback when QStash is configured. If her own "not before" hour is later than 08:00, the push waits until then, and it is never sent after her end hour.
- Until Josh adds notes, an empty jar says "the jar is filling up…".


- Add a `jar_notes` table, seeded from the existing library in `server/content/noteJar.js` so nothing is lost.
- Add a quick-add form in admin: type a note, save, and it goes into the jar. Notes can be edited or hidden. Optionally tag a mood so the existing mood-aware picking still works.
- Each new note starts unannounced. A daily job at 08:00 SGT (00:00 UTC) sends one push ("new little notes in your jar ♡") when there are any, then marks them announced.
- Until she draws them, the jar shows a red heart badge and a little wiggle. Draws pick the unread new notes first, oldest first, before going back to the usual mood-aware selection.

### 3. iPhone app shell (code done 2026-11-24; needs the Mac build, Apple keys and a deploy)

As built: see `docs/refactor/IOS-APP.md`.
- A Capacitor 8 project in `ios/` that opens the live https://kiriya.love/world.
- Face ID via `@capgo/capacitor-native-biometric`, with the sign-in key in the Keychain behind biometry.
- Native push via `@parse/node-apn`, fanned out from every existing notification.
- The icon is "kiriya" in Parisienne on lilac.
- The install page is `/install/`.
- **Distribution: TestFlight** (Josh, 2026-11-24). She installs TestFlight and accepts the invite. There's no Developer Mode, and a re-upload is due about every 80 days. `ios/build.sh testflight|run`; ad hoc was removed.


- A Capacitor 8 iOS project, reusing Rora's setup: splash screen, safe areas, haptics. The app is called **kiriya.love** on her home screen.
- **App icon:** the word "kiriya" in the site's cursive wordmark on lilac, which is also the app's colour (owner, 2026-11-24).
- **Face ID unlock:** the passphrase is entered once, then the app opens with Face ID (owner, 2026-11-24).
- Native push over APNs, sent from the server with a token-based `.p8` key through an open-source APNs client. Phones register their device tokens per role, so pushes reach her phone, his phone, or both. Web push stays as the fallback.
- TestFlight distribution (see IOS-APP.md).
- Site updates appear in the app without a rebuild.

### 4. Letters hub + chat

- Redesign the hub as its own section, with Messages, Letters, Little notes and the Note jar as four doors that stand out from the rest of home.
- **Chat stack:**
  - Our own bubble, background and typing-indicator components, chosen per person in the chat's settings.
  - `@shadcn/react` message-scroller (MIT, unstyled) for scrolling: stick-to-bottom, keeps its place when older messages load, jumps to replies.
  - `emoji-picker-react` (MIT) for emoji, including custom emoji and the quick-reaction bar.
  - GIPHY through a Hono proxy route that keeps the key server-side and caches results. Tenor's API is shut down.
  - Stickers: Microsoft Fluent Emoji and Fluent Emoji Animated (MIT), Noto Animated Emoji (CC BY 4.0, credited), and custom packs Josh uploads.
  - Realtime: Ably. A session-checked route issues tokens. Presence shows "online now". Read receipts and typing ride on Ably.
  - Cache: TanStack Query persisted to IndexedDB with `idb-keyval`, so the chat opens instantly.
- Database tables: messages, reactions, reads, per-person chat preferences, sticker packs.
- Uploads: add a `chat` folder, allow GIFs, and serve chat media as `private, immutable` so images aren't downloaded again.
- Push for new messages when the app is closed.

### 4. Progress (2026-11-24, uncommitted)

**Done and tested** (11 API tests; a two-person browser run with no errors):
- `/world/chat`:
  - text, photos, GIFs (GIPHY proxy), 30 animated stickers (Fluent Emoji Animated, MIT) plus their own uploaded stickers, voice notes and the 7 taps
  - replies, one reaction per person, unsend, "seen ♡", unread counts
  - typing indicators (4 styles), and per-person bubble (9), background (4 for now) and typing choices
- `/world/memories` scrapbook.
- The Messages door at the top of the letters hub.
- Live delivery uses Ably when `ABLY_API_KEY` is set, otherwise a light 4-second refresh while the chat is open.
- Pushes for chat, taps, letters, notes and the jar each carry their own category and thread.

**Still to do in phase 4:**
- ~~The native app upgrades~~ built (see 4b progress below); the Mac build is next.
- ~~The Miku and Maomao backgrounds~~ **done**. The repo is private, so per the owner's choice they're built in: official Crypton Miku V6 art on a soft backdrop, and the official Halloween 2025 Maomao phone wallpaper. Both are in `server/assets/wallpapers/`, served only after login and shown with their credit lines.
- ~~Saving letters, little notes and jar notes to memories from their own pages~~ done.
- ~~Persisting the cache to IndexedDB~~ done.

### 4a. Chat design choices (owner, 2026-11-24)

- **Bubble themes** (she picks one; Soft lilac is the default): Soft lilac, Paper notes, Pixel retro, Sparkly kawaii, Cat (ears and paw prints), Flowers, Fairy / pixie sparkles, Dark gothic, Lovey-dovey. All are original designs; nothing is copied from another app's look.
- **Backgrounds:** Lilac petals, Night sky, Notebook paper, Her own photo, **Miku** and **Maomao**. For the last two the owner said no generated images; use real, officially distributed wallpapers whose terms allow personal use. If none can be found, an upload of a picture they choose fills the slot.
- **Typing indicators:** Bouncing hearts, Maomao grinding herbs, Pencil scribble, Classic dots.
- **Extras:** voice notes, "Our memories" scrapbook, pick-your-icon (alternate app icons), and **"thinking of you" taps**.
  - One-tap messages: ♡ thinking of you, 🫂 hug, 😘 kiss, ☀️ good morning, 🌙 goodnight, 🥺 miss you, 💧 drink water.
  - They can be sent **without opening the app**: an interactive Home Screen widget, icon quick actions, a "♡ back" button on notifications, and a Siri / Shortcuts action.

### 4b. A solid native app, built alongside the chat (owner, 2026-11-24)

The goal is an app that feels native, not a website in a frame. Owner's words: "extreme app smoothness via UX designs and caching for latency".

- **Screens built into the app, updated over the air.**
  - The web app is bundled inside the iOS app, so it opens instantly and cached things work with weak signal.
  - Updates arrive through Capgo's open-source live-update plugin (`@capgo/capacitor-updater`, bundles hosted by us), so most changes need no new TestFlight build.
  - The app signs in with a bearer token, not a cookie, because the bundled app runs on its own origin.
- **Native navigation.** A bottom tab bar (Home, Letters & chat, Games, Events, Me), swipe-back, pull-to-refresh, and haptics on pulls, sends and reactions.
- **Home Screen and Lock Screen widgets (WidgetKit, Swift, built on the Mac).**
  - The latest little note from Josh.
  - Today's jar note or the new-notes heart.
  - The countdown to the next con.
  - They reuse the existing widget API (`server/routes/widget.js`, device keys).
- **Icon extras.** A red badge with unread notes and messages. Long-press quick actions: "Pull a note", "Open chat", "Send a ♡".
- **Notifications that feel different by kind.**
  - Chat messages: grouped into one conversation thread, with a "Reply" action that opens the composer.
  - Letters and little notes: their own chime, an envelope picture attached by a Notification Service Extension (as Rora does), and "Open" and "♡" actions.
  - Gentle reminders: "a new note has been waiting since this morning", or a quiz waiting for her answer. These respect her notification hours.
  - Events (phase 6): when tickets open, day-before reminders, and morning-of weather.
- **Smoothness.**
  - The query cache is persisted to IndexedDB, so everything opens with last-known data.
  - Optimistic sends, image prefetch and immutable media caching.
  - View transitions between pages, skeletons instead of spinners, and reduced motion respected.

### 4b. Progress (2026-11-25, uncommitted; the Mac part is next)

Everything that can be built and tested on Linux is done. The Swift half is written but **has never been compiled**. `docs/refactor/HANDOFF.md` is the starting point for the Mac session, and `docs/refactor/MAC-BUILD.md` has the Xcode steps.

- **Site bundled into the app.** `capacitor.config.json` → `webDir: "dist-app"` (made by `scripts/build-app-bundle.mjs` after `vite build`), no `server.url`.
  - Over-the-air updates: every deploy publishes `/app-bundle/latest.json` (version + SHA-256 of every file); `src/lib/appUpdates.js` drives `@capgo/capacitor-updater` in manual mode (no Capgo cloud, `statsUrl: ""`), downloading only changed files and switching on the next background.
  - `mobile/app-native.json` `minBuild` holds back web versions that need a newer TestFlight build.
- **Sign-in from the app:** bearer token (`x-kw-token: 1` → token in the JSON; `Authorization: Bearer v1.…`), CORS for `capacitor://localhost` (+ `APP_ORIGINS` for local tests), private media sent to the app as absolute signed links and turned back into plain links on the way in (`server/lib/mediaLinks.js`, middleware in `server/app.js`). Wallpapers moved to `/api/uploads/wallpapers/:key`.
- **Widgets, notification buttons, Siri:** each app install gets a widget key at Face ID setup (`app_devices.widget_key_id`, migration 0009); `/api/widget/app` (snapshot), `/api/widget/tap`, `/api/widget/reply`. Swift: `ios/App/KiriyaWidgets`, `KiriyaShared`, `KiriyaNotificationService`, `App/KiriyaNotifications.swift`.
- **Pushes:** per-kind sounds (`ios/App/App/Sounds`), icon badge = unread chat + notes + new jar notes (`server/lib/appBadge.js`), `messageId` for Reply, jar notes get a picture, a new REMINDER kind: the evening nudge when the morning's jar notes are still undrawn (`remindJar`, QStash at 19:00 SGT).
- **In the app:** bottom tab bar, pull-to-refresh, haptics, quick actions, icon picker (Night, Blush, Mint, Paper), keyboard tracking, `kiriyalove://open/...` deep links, badge/widget sync (`src/shared/NativeApp.jsx`, `AppTabBar.jsx`, `PullToRefresh.jsx`, `src/lib/native.js`).
- **Everywhere:** the query cache is kept in IndexedDB (`src/lib/persist.js`; never the session; wiped on lock); "save to our memories" on letters, little notes and jar notes.
- Tests: `scripts/test-app-bridge.mjs` (8) plus additions to the chat, jar and app tests; browser checks of the bundled flow cross-origin (token only, no cookies; signed wallpaper and photo load).

### 4b. Progress on the iMac (2026-11-25)

- **Xcode, done.** `ios/scripts/add-native-targets.rb` wires MAC-BUILD.md §1–§5 without clicking. Everything compiled with no Swift errors on the first try. The signed debug build has the App Group on the app and both extensions, and push (development) on the app. It installed and opened on Josh's iPhone 11 (iOS 27).
- **Fixes.**
  - `capacitor.config.json` had `ios.scheme: "kiriya"`. That's the Xcode scheme name for `npx cap run`, not the web view's URL scheme, so it was removed. The app's origin stays `capacitor://localhost`.
  - Silenced one Sendable warning in `KiriyaNotifications.swift`.
- **Reviewed, not yet proven on the phone:** the notification-delegate takeover. Capacitor registers plugins, and with them the push handler, inside the bridge's init, before `capacitorDidLoad`, so taps queued on a cold start are handed over with their handler in place.
- **Seen on the phone:** the site's top bar sat under the status bar. Fixed app-only in `src/styles/in-app.css` (`html.in-app`).
- **Deployed three times on 2026-11-25** (`main` = connection-refactor): the phases 1–4b site, then c541761 (test mode), then 130bb35 (in-place notes and the fixes below).

#### Phone testing on Josh's iPhone 11 (2026-11-25)

Works (verified on the phone):
- bearer sign-in, Face ID enrolment, push registration, the widget key in the App Group;
- note and letter pushes with the envelope picture;
- "send one back" with the app in the background, and Reply with the app fully closed;
- a tapped notification opens its page, warm and cold.

Bugs found and fixed:
- **Native plugins were awaited directly.** Helpers like `async () => (await import(…)).Plugin` make JS call `plugin.then()`, which a Capacitor plugin answers as a native method: "….then() is not implemented on ios". Push registration, the widget key and over-the-air updates all failed silently. Helpers now return the module; see the note in `src/lib/native.js`.
- **A notification tapped while the app was closed landed on /world.** The front page's signed-in redirect won the race; the pending page now waits until the app has left `/`.
- **The updater accepted older versions** (any different version). Now newer-only (`shared/appVersion.js`), so a TestFlight build made from undeployed code never swaps back to the live copy.
- **The content extension crashed on load** (SIGTRAP in `_extensionContextClass`): the linker dropped UserNotificationsUI, so it is now linked explicitly (`add-native-targets.rb`).

New:
- **App test mode.** Admin → "Try the app on my phone" sends sample notifications of each kind to the admin's phones only. While it's on, the admin phone's notification buttons, widgets, Siri and quick action are checked but answered with "test mode ✓", and nothing reaches Kiriya. It is off after 12 h. Josh's wish: the app stays a surprise until he tells her.
- **Little notes open inside the notification.** A new KiriyaNotificationContent extension (`love.kiriya.app.notecard`).
  - "Open note 💌" opens an envelope in place and shows the whole note, which is marked opened.
  - The jar's morning push and the reminder get "Pull one ✨" (a preview on Josh's phone).
  - Buttons: an icon, the words, then a colour emoji ("Send one back ❤️"), at Josh's request.
- **Josh asked for the letter and jar cards to be perfected (2026-11-25).**
  - Two dedicated agents are building them as standalone SwiftUI in `ios/App/KiriyaNotificationContent/Letter/` and `…/Jar/`, each with a render lab in `ios/CardLab/{Letter,Jar}/` that renders frames in its own simulator (logs in `PROGRESS.md`).
  - The jar must match the in-app jar (`src/world/today/NoteJar.*`).
  - The lead integrates them into `NoteCardView.swift` once they're done.
- **Both cards are done and wired in (2026-11-25, evening).**
  - **Letter** (`Letter/`): a sealed envelope that idles while it waits, a 2.8 s opening, and the note resting on the open envelope. It uses the site's Gaegu and Parisienne fonts (OFL, shipped in the extension).
  - **Jar** (`Jar/`): the app's own jar, ported path by path from `NoteJar.jsx`. It waits, rattles while pulling, then pulls. "Pull another" works, and so do the failed state and Reduce Motion.
  - `NoteCardView.swift` is now only the model, the buttons and the host. The old hand-drawn envelope and jar are gone, and so is the copy of `envelope.png`/`jar.png` in the content extension.
  - `add-native-targets.rb` adds every file in `Letter/` and `Jar/` (`CARDS=Letter` limits it to one).
  - Built and installed on Josh's phone. Josh: the letter is "perfect".
  - The render outputs live in the scratchpad (`cardlab/`); the labs can recreate them.
- **The jar "got stuck" on Josh's phone because the live jar was empty** (0 notes).
  - An admin preview pull of an empty jar now returns a marked sample note (`pullNote`, label "a sample note", `sample: true`, nothing saved). The site's jar shows the same sample to the admin.
  - Her real pulls still answer `jar_empty`, and the card says "the jar is waiting for new notes ❤️" instead of "stuck".
- **Letters open inside their notification too (2026-11-26, Josh's request; uncommitted).**
  - Before this, "Open letter" opened the app.
  - **Josh wants a letter card of its own,** "more special … more formal but cute formal" than the note. A dedicated agent designed it: `KiriyaNotificationContent/FormalLetter/` (`FormalLetterCard`), lab in `ios/CardLab/FormalLetter/` (see its `PROGRESS.md`).
    - Sealed: a blush envelope (Maomao's is night plum) with a double gold edge, claret wax pressed with a script K, a lavender sprig, the address in script. A locked letter gets a gold date seal and "opens on …".
    - Opening (3.2 s): the seal breaks, the flap swings over, the letter rises out folded in thirds and unfolds. Reduce Motion: a 0.35 s crossfade.
    - Open: ivory deckled paper with a gilt edge, a K crest, title, date, "my dearest Kiriya," (unless the letter greets her itself), Cormorant body, "yours, always —" and the signature in Allura. Long letters scroll inside the paper.
    - Fonts: Cormorant and Allura (OFL), bundled as `FormalLetter-*`. `add-native-targets.rb` now adds `FormalLetter/` too.
    - Wired into `NoteCardView.letterCard`. Deployed with the letter payload in 8785102.
    - **Round 2 (Josh: "more flowers", "Maomao's face" for the crest, "a little bit of whimsy"; uncommitted):**
      - A pressed-flower spray tucked under the wax rides away with the flap; a small echo spray stays on the pocket.
      - The crest is an original sleepy lilac kitten with a lavender sprig. We can't draw Maomao herself (a copyrighted character), so Josh chose the kitten.
      - Whimsy: a washi-taped flower in the paper's corner, paw prints up to the signature (a rosemary sprig on Maomao's), petals slipping out as the letter unfolds, an ear flick and a heartbeat as it settles, and a slow peek from the kitten every 7.5–11 s at rest. Reduce Motion keeps it all still.
      - Built and installed on Josh's phone; a test letter was sent.
- **First opening stutter (Josh: a few frames skipped the first time a note or letter opened; fine after).**
  - The opening's network call and first widget reload ran on the main thread mid-animation; they now run detached, and the URL session and WidgetKit connection are set up in the background while the card is sealed.
  - 0.7 s after a sealed card appears, its open state is drawn once out of sight (opacity 0.001, behind the opaque card) for 0.3 s, once per kind per process, so the first real opening starts warm.
  - Debug builds log each opening's slow frames to `notecard-frames.log` in the App Group (`FrameProbe`). Waiting on Josh's next try to confirm.
- **Widgets redesigned by three agents (2026-11-26, Josh's request; uncommitted).**
  - **Little note** (`KiriyaWidgets/Notes/`, lab `ios/CardLab/WidgetNotes/`): a taped notepad page; a new note arrives folded and taped shut and is peeled open on the widget (counts as opened). The note push's service extension drops the note into the App Group and reloads the widget, so it shows at once with no fetch (`NotesWidgetMailbox`). On Josh's phone it shows his newest note to her with "not opened yet" / "she opened it" / "she loved it". The snapshot now carries the whole note (`widgetNote`) and, for admin, `sentNote`.
  - **Next con** (`KiriyaWidgets/Con/`, lab `ios/CardLab/WidgetCon/`): a con ticket with a live countdown (days → live clock in the last 48 h → "today!!" → "happening now · day 2 of 3" → "was lovely ♡ · next up"), large shows the next three, Lock Screen ring. The snapshot now carries `events` (up to 5, ongoing and yesterday's included) with endsOn, city, tags, hers, url, link.
  - Both keep their old widget kinds, so placed widgets carry on. Later: iOS 26 WidgetKit push for the notes widget (handler written, `NotesWidgetPush.uploads` off until the server side exists).
  - **Thinking of you** (`KiriyaWidgets/Signals/`, lab `ios/CardLab/WidgetSignals/`): pastel sticker buttons, each an emoji + kaomoji + label (kaomoji and a short note now in `shared/taps.js`); small shows four, two or one (chosen in Edit Widget), medium four, large all seven, Lock Screen one or two. Buttons are Toggles so "sending…" shows at once, then "sent ♡" with hearts settling in the corner; failures say "try again".
    - The buzz: iOS gives third-party pushes one system haptic (no custom vibration; Core Haptics only while the app is open). So each signal plays its own original sound (`App/Sounds/SignalsWidget-<key>.caf`): the same soft two-beat heartbeat, then a short tail that says which. With the app open, a matching heartbeat haptic (AHAP) plays instead of the system sound.
    - Push body is now the kaomoji + note; the payload carries `tap`; every signal but ♡ has its own category (`TAP_<KEY>`) with a "Hug back 🫂"-style button beside "Send one back ❤️".
    - `UIAppFonts` in `KiriyaWidgets-Info.plist` lists its two fonts (fonts registered at runtime came back blank after a reinstall in the lab).
  - **Server (`server/lib/letterCard.js`):**
    - A letter's announcement links to `/world/letters?open=<id>`.
    - The push carries the letter (`apns.js letterPayload`). It's trimmed to 3000 bytes, and a locked letter carries no words.
    - `GET /api/widget/letters/:id` gives the whole letter; the card fetches it while sealed.
    - `POST /api/widget/letters/:id/open` marks it opened, for Kiriya only.
  - **Admin:** "Try this notification on my phone first" sends the draft along, so Josh sees the letter itself. It no longer saves a love note addressed to the admin.
  - **Letters page:** `?open=<id>` opens that letter.
  - **App:**
    - LETTER now has "Open letter 💌" (in place), "Send one back ❤️" and "Open in app".
    - The content extension takes the LETTER category.
    - `NoteCardModel` has `.letter`.

Still to check on the phone: Siri, widgets on the Home Screen, quick actions, swipe-back, the alternate icons, the badge, and the over-the-air update cycle with a real deploy. Then TestFlight.

### 5. Quizzes + game library

- **Quizzes for each other.**
  - Either of them writes a question, attaches an image (an upload or a clean stock photo), and gives multiple-choice answers with emoji. They choose the mode: "about me" (the sender sets the right answer) or "about us".
  - Sending a quiz pushes "Kiriya sent you a quiz question ♡". Answers are revealed with a little celebration, and both of them keep scores and streaks.
  - Pretty cards in the site's style that work cleanly inside the app.
- **Game library: five categories, five games each.** Each game is built by adapting an open-source implementation where one exists, redrawn in the lilac, hand-drawn style under its own name.
  - *Pastime:* herb match-3, merge the charms (merge up to a crown), slide puzzle of us (from photos in admin), charm drop (simple falling blocks), spot the difference.
  - *Brain power:* daily word (Josh picks the word), tic-tac-toe against Maomao, hard colour match, mini symbol sudoku, picture logic (nonogram). The memory drawer, odd jar, herb sequence and lantern puzzle stay as well.
  - *Luck:* capsule machine (collect charms and stickers), daily fortune slip, cup shuffle, higher-or-lower cards, lucky lanterns.
  - *Artsy:* palette party (existing), colour by number, paper-doll dress-up, sticker scene maker (send the result to each other), symmetry/kaleidoscope drawing.
  - *Dexterity:* petal catch, boop the cats, Miku rhythm tap (original chiptune loops only), mochi tower, paper-crane flight.
- Rewards tie into the existing sticker collection, so playing earns keepsakes.

### 6. Events & merch section

- **Railway worker (Node)** with a source registry. It starts from the ~40 legitimately monitorable sources in `SG-EVENT-SOURCES.md` plus the existing Singapore descriptors.
- **Change detection, cheapest first:** RSS/Atom or WordPress `modified_gmt`, then sitemap `lastmod`, then a conditional GET with ETag, then the set of listing IDs, then a normalised text hash.
- **Triage (Haiku 5.5):** is this change a new or updated Singapore anime / cosplay / J-fashion / pop-up / merch event? Dedupe it against known events.
- **Investigation (Opus 5.5 with web search and fetch)** writes a structured dossier:
  - what it is and what it's like
  - dates and times
  - venue and how to get there
  - tickets and prices
  - official links and sources
  - guests and major people
  - merch sold, plus exclusives
  - expected size
  - weather
  - tips to make the visit as good as possible
  - for pop-ups: what it's about and what's sold
- **Weather:** Open-Meteo for 5–16 days out, NEA's four-day outlook within 4 days, and NEA's 2-hour forecast on the day. **Transit:** LTA DataMall train alerts.
- **Inputs beyond the crawler:**
  - **Apify Instagram watcher, trigger-only.** It watches a few major accounts: key organisers and the SG con/pop-up tracker accounts that cover Suntec, EXPO and the malls. Checks are slow (a few times a day), not constant. A **new post is the trigger**: it starts triage and then investigation, where Claude and the crawler gather everything else. Posts are captured with their captions, images and dates, and the images are stored in our Blob because Instagram media URLs expire.
  - A paste-a-link box in admin.
  - A newsletter Gmail inbox.
- **One complete page per event, kept up to date.**
  - A **timeline**: announced, guests revealed, tickets on sale, merch and exclusives revealed, schedule out, the day itself, after-event.
  - An **update log**, so she can see what changed since she last looked.
  - Every claim links back to its source post or page.
- **Push:** instant for big items, a weekly digest for the rest.
- **Spend:** a ledger with the US$20 ceiling, visible in admin.
- **Cleanup:** retire the OpenAI-based events stage.

### 7. Mini Miku

- A hand-drawn SVG chibi in Maomao's style. Nothing on GitHub was both better than the existing engine and clearly licensed for a website; full findings are in the research notes.
- Generalise the companion engine so they share it. Rails, day loop and pick-up move into a `useCompanionBody` hook, and each character's body, scenes and dialogue become data.
- Occasional visits between the two, with call-and-response bubbles. On narrow phones the ledge holds only one of them at a time.
- Credit: "features an adaptation of Hatsune Miku, © Crypton Future Media, Inc. 2007", with the PCL link.

## What Josh needs to provide (when each phase starts)

| Phase | Item |
| --- | --- |
| 3 | An APNs auth key (`.p8`), Key ID and Team ID; a bundle ID; her iPhone's device ID |
| 4 | An Ably API key; a GIPHY API key |
| 6 | `ANTHROPIC_API_KEY` (in Vercel and Railway); a Railway project; an Apify account and API token; a Gmail inbox for newsletters; optionally keys for LTA DataMall and data.gov.sg |
| 6 | Send the permission emails to Suntec and Singapore EXPO (Claude drafts them) |

## Expected monthly cost

| Item | Cost |
| --- | --- |
| Claude API | Ceiling US$20; expected about US$10–15 |
| Railway Hobby | US$5, which includes US$5 of usage; the worker should fit inside it |
| Apify | Starts on the free US$5 monthly credit. Watching many accounts several times a day may need a paid plan; measure in phase 6 before deciding. |
| Ably, GIPHY, Open-Meteo, NEA, LTA | Free tiers |
| OpenAI | Falls to about zero once the retired feeds and the old events stage stop |
| Vercel Hobby, Neon, Apple Developer | Unchanged |

## Open item

Maomao's little spoken replies (`POST /me/maomao/ask`) still use OpenAI. Moving them to Claude Haiku 5.5 would leave one bill and one key. Recommended for phase 6, but it is Josh's call.
