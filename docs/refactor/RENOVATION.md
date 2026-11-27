# The app renovation (started 2026-11-26)

Owner: Josh. Coordinator: the main Claude Code session on the iMac. This round turns the iPhone app
into a real five-section app, makes the home page editable from Josh's own phone, adds five
companion characters, and builds phases 5 (quizzes + game library) and 6 (events & merch) of
`PLAN.md`. Phase 7 (mini Miku) is replaced by the five characters below.

Read `PLAN.md` (ground rules, decisions) and `HANDOFF.md` (how the code fits together) first.

## Josh's decisions (2026-11-26)

| Topic | Decision |
| --- | --- |
| Sections | Five tabs: **home**, **chat**, **play**, **notes & letters**, and a last tab named after whoever is signed in (**kiriya** on hers, **josh** on his). |
| One app, two roles | No separate admin app. Josh signs in to the same app as admin: he sees exactly what she sees and gets extra controls, in place and in his settings. |
| Header | Remove the inbox (letters) button, the ☰ menu and the ✦ "stop the carousel" star from the app's header. Everything from the menu moves into the last tab. "Your little corner" becomes its own widget near the top of home. |
| Native feel | Each section must feel like a section of a real iPhone app, not a web page: no clipping, no misalignment, clear separation, clean layout. Keep the lilac theme. |
| Home centre stage | Editable by Josh: the greeting ("there you are, lovely."), the photo carousel, the caption under it ("ur cosplay is cute. u make it unforgettable."). |
| Songs | Josh uploads **audio files** (name, artist, cover art and length read from the file's own tags; cover art looked up in an open database when missing) or pastes **YouTube links** (YouTube's own small player, inside the card, as its terms require). A file plays in our own player and keeps playing with the screen locked. Several songs, for her to discover each time she opens the app. |
| Pinboard | The birthday wish and the "From Josh" note become a pinboard: the birthday wish stays pinned; below it, notes Josh pins and changes from his phone. Something new pinned shows as new. |
| Characters | Five: **Maomao** (refined), **Miku as in "Confessions of a Rotten Girl"** (SAWTOWNE, 2025; the agent confirms the look), **Bambi** (PLAVE), **Hatsune Miku**, **KAITO**. She picks one in her settings; another one drops by for a visit now and then (call-and-response bubbles). |
| Where they live | The app's home section only (the website keeps Maomao on every page, as now). |
| Movement | Invisible levels across the screen. Wherever a character walks, a cloud platform forms under its feet (in front of it as it goes, fading away behind). Each character has its own platform design and its own way of moving: Miku sits on her cloud swinging her legs, Maomao stands and ponders, Bambi roams and does what he does best. |
| Scope | Everything: the renovation, the characters, phase 5 (quizzes + 25 games) and phase 6 (events & merch). |
| Shipping | Josh pushes nothing until everything is done; then the coordinator deploys this as one new version. Local commits are fine. |

## Ground rules for every agent

- **Josh's rules** (`PLAN.md`): open source first, with a credit and licence line in
  `docs/redesign/ASSETS.md` and the in-app Art & credits. Additive UI only on the **website**: the
  new layout is app-only (`isAppShell()`), so the website keeps its look. Never set
  `VITE_API_ORIGIN` in `.env.local`. Don't crawl sites that forbid it (robots.txt, terms).
- **Keys:** never ask for, print or commit a key. If you need one, build against a mock and say in
  your report exactly which key, where Josh gets it, and where it goes (Vercel env + `.env.local`).
- **The surprise:** the app is a secret from Kiriya. Nothing you do may reach her: no pushes, no
  emails, no writes to the production database. You only ever use your local dev server.
- **Characters are fan art for a private gift.** Draw everything yourself (SVG/CSS, in the
  existing Maomao style). Never copy, trace or embed official art, screenshots, sprites, 3D models,
  voice clips or song audio, and never quote song lyrics beyond a few words. Dialogue is original
  and in character. Credits: Crypton characters (Miku, KAITO) under the Piapro Character License
  ("© Crypton Future Media, INC. www.piapro.net" + PCL link); Maomao (The Apothecary Diaries, ©
  Natsu Hyuuga / Shufunotomo / Square Enix) and Bambi (PLAVE, © VLAST) as fan art credits.
- **Writing in the UI:** short, warm, lowercase-friendly, in the voice the site already uses.
  Never mention AI, agents or how something was made, in the UI or in any copy she sees.
- **Phone first:** iPhone 11 (414×896 pt, the real test phone) and 375 pt wide phones. Safe areas,
  44 pt tap targets, no horizontal scroll, `prefers-reduced-motion` respected, smooth on an
  iPhone 11 (animate transform/opacity, no layout thrash, no long main-thread work).

## Who owns what

Each agent works in its **own git worktree** on its own branch and edits only what it owns. If you
need a change in someone else's file, make the smallest possible change, list it in your report, or
message the coordinator (`SendMessage` to `main`).

| Agent | Branch / worktree | Owns |
| --- | --- | --- |
| frame | `reno/frame` | `src/shared/AppTabBar.*`, `src/world/WorldShell.*`, `src/styles/in-app.css`, `src/shared/PullToRefresh.jsx`, `src/shared/NativeApp.*` (layout parts), `src/world/play/PlaySection.jsx` + the play hub, `src/world/play/games/registry.js`, routes in `src/world/World.jsx` |
| home | `reno/home` | `src/world/home/**`, home content API (`server/routes/home.js`, `server/lib/homeContent.js`), songs (`server/lib/songs.js`, `server/routes/songs.js`, `src/shared/music/**`), the pinboard, the at-a-glance card, the little-corner widget |
| mail | `reno/mail` | `src/world/chat/**`, `src/world/mail/**`, `src/world/letters/**`, `src/world/notes/**`, their server routes, Josh's in-place send/write controls for notes and letters |
| me | `reno/me` | `src/world/me/**`, `src/world/settings/**`, `src/shared/admin/**`, Josh's admin hub (note jar inputs, widgets and test pushes, passphrases, app test mode, links to every in-place editor) |
| stage | `reno/stage` | `src/world/companions/**` except the character folders, `shared/companions.js`, the old `src/world/mascot/MaomaoCompanion.*`/`CompanionScene`/`CompanionShelf` (engine parts) |
| maomao, miku-rotten, bambi, miku, kaito | `reno/c-<id>` | `src/world/companions/characters/<id>/**` only (Maomao may also refine `src/world/mascot/MaomaoMascot.*`, `MaomaoFace.jsx`, `src/shared/play/maomaoDialogue.js`) |
| quizzes | `reno/quizzes` | `src/world/play/quizzes/**`, `server/routes/quizzes.js`, `server/lib/quizzes.js` |
| games-<shelf> | `reno/games-<shelf>` | `src/world/play/games/<shelf>/**` |
| events | `reno/events` | phase 6 engine: `worker/**` (the Railway worker), `server/routes/events*.js`, `server/lib/events/**`, the events tables, the admin paste-a-link box's API |
| events-ui | `reno/events-ui` | phase 6 screens: `src/world/events/**` (event pages, timeline, update log, saves, merch), the home events & merch block (`src/world/events/HomeEvents.jsx`), the admin paste-a-link box |

Shared files everyone may touch with a one-line change (expect a trivial merge): `server/app.js`
(mounting your route file), `docs/redesign/ASSETS.md` (credits), `src/shared/WorldPrimitives.jsx`
Credits list.

**Database:** prefer the existing key-value stores (`putSetting`/`getSetting` in server code,
per-person state in `server/lib/personState.js`) over new tables. If you need a table, add it to
`server/db/schema.js` and generate a migration in your worktree for testing (`npm run
db:generate`), and say so in your report: the coordinator regenerates migrations in order at merge
time.

## Contracts

### App layout

- `isAppShell()` (`src/lib/native.js`) is true in the app, and in local dev with `?app=1`. The class
  `html.app-shell` is set before first paint. Website-only and app-only differences hang off these.
- Routes: home `/world`, chat `/world/chat`, play `/world/play`, notes & letters `/world/mail`, the
  last tab `/world/me`. Old routes (`/world/notes`, `/world/letters`, `/world/settings`, notification
  `navigate` paths such as `/world/notes?open=<id>`) must keep working and land in the right tab.
- `useIsAdmin()` (`src/lib/session.js`): Josh's sign-in.
- **Section markup** (decided 2026-11-26; the frame agent styles it, everything scoped to
  `html.app-shell`; until frame's styles land, keep your own fallback styles for these classes in
  your own stylesheet):

  ```html
  <div class="app-section app-section--home">        <!-- one per tab root -->
    <header class="app-section__head">               <!-- right under the status bar -->
      <h1 class="app-section__title">home</h1>       <!-- large title -->
      <p class="app-section__subtitle">…</p>         <!-- optional -->
      <div class="app-section__actions">…</div>      <!-- optional trailing buttons (AdminEdit, compose) -->
    </header>
    <div class="app-section__body">                  <!-- the content column -->
      <section class="app-card">                     <!-- a grouped card -->
        <header class="app-card__head"><h2 class="app-card__title">…</h2><div class="app-card__action">…</div></header>
        <div class="app-card__body">…</div>
      </section>
      <ul class="app-list"><li class="app-row">…</li></ul>  <!-- iOS-style inset grouped rows -->
    </div>
  </div>
  <div class="app-screen">                           <!-- a pushed screen inside a tab -->
    <header class="app-section__head"><button class="app-screen__back">…</button><h1 class="app-section__title">…</h1></header>
    <div class="app-section__body">…</div>
  </div>
  ```

  CSS variables the frame sets on `html.app-shell`: `--app-gutter` (16px), `--app-tabs-h` (tab bar
  height including the home-indicator inset; pad the bottom of anything that scrolls to the end),
  `--app-card-radius`. `body.keyboard-open` is set while the keyboard is up (Capacitor Keyboard, or
  `visualViewport` in Safari); the tab bar hides then. The tab bar stays visible in chat.
- **The website's top bar (`.world-mast`) shows on home only** in the app; every other tab starts
  right under the status bar with its own `.app-section__head` (in-app.css already pads the body by
  the status bar). The floating "little corner" (`.daily-style-corner`) is hidden in the app; the home
  section shows it as a widget instead.
- **Deep links in the app:** `/world/notes?open=<id>` → `/world/mail?note=<id>`,
  `/world/letters?open=<id>` → `/world/mail?letter=<id>` (the mail agent redirects from its pages),
  `/world#letters-hub` → `/world/mail`, `/world#note-jar` and the "pull a note" quick action →
  `/world/mail#note-jar`, `/world?event=<id>#events` → that event's page (events-ui),
  `/world#play-desk` → `/world/play`, `/world/settings` → `/world/me`. The frame agent implements the
  mapping in one place and documents the full list here.

### Admin in place

Josh changes what she sees where she sees it. Next to anything editable, render
`<AdminEdit label="…" onClick={…} />` (`src/shared/admin/AdminEdit.jsx`; nothing on her phone) and
edit in an `<EditSheet>` bottom sheet. Admin API routes go under `/api/admin/...` (the existing
`adminRoutes` guard) or your own router with the same `requireRole("admin")` check. Every edit
shows on her phone the next time she opens the app (invalidate or refetch on focus); new content
can carry a small "new" mark until she has seen it.

### Companions

A character is a folder `src/world/companions/characters/<id>/` with an `index.js` default export:

```js
export default {
  id: "maomao",                    // matches shared/companions.js
  name: "Maomao",
  credit: "…",                     // one line for Art & credits
  size: { width: 96, height: 128 },  // the body's box at scale 1, in CSS px; feet at bottom centre
  Body,                            // React component: ({ pose, expression, facing, playing, frame }) => SVG
  poses: ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", ...own],
  Platform,                        // React component: ({ width, state }) => the cloud under the feet
                                   //   state: "forming" | "steady" | "fading"
  movement: {
    walkSpeed: 38,                 // px per second
    jumpiness: 0.3,                // 0..1, how often it hops between levels
    restPose: "sit",               // what it does when it stops (Miku: "sit", Maomao: "ponder")
    ...                            // anything else the engine supports, documented by the stage agent
  },
  behaviours: [                    // what it does when left alone, weighted
    { id: "ponder", weight: 3, pose: "ponder", expression: "thinking", seconds: [6, 12], topic: "musing" },
  ],
  lines: {                         // original dialogue for its speech bubbles, by topic
    greet: ["…"], idle: ["…"], tapped: ["…"], picked: ["…"], visit: ["…"], ...
  },
  visit: {                         // call-and-response lines when another character drops by
    with: { miku: [["…", "…"]] },
  },
  Thumb,                           // small portrait for her settings picker
};
```

`src/world/companions/registry.js` finds every character by folder, so adding one needs no shared
file. Until the engine lands, the dev-only lab `/world/companion-lab?c=<id>` shows a character's
poses, its platform and a simple walk.

Names every character uses (agreed 2026-11-26): shared poses `idle`, `walk`, `jump`, `fall`,
`land`, `sit`, `wave`, `react`, `sleep`, `held` (picked up, dangling), plus their own (Maomao's rest
pose is `ponder`). Line topics: `greet` (fallback) and `greetMorning` / `greetAfternoon` /
`greetEvening` / `greetNight`, `idle`, `tapped`, `picked`, `putDown`, `birthday`, `sweet`, plus
their own; visits in `visit.with.<id>` as pairs `[mine, theirs]`: the first line is this
character's, the second is the other one's reply, so a pair lives in the file of whoever speaks
first. Sitting poses may hang legs below the feet line over the cloud's front edge, so the engine
draws `Body` above `Platform`. The engine anchors the `Platform` box's top centre at the feet
point (the bottom centre of the body box), letting puffs overflow upward a little; a character may
set `Platform.surface` (px from the top of the platform box to where the feet stand, default 0) to
sink its feet into a fluffier cloud. Every line (in `lines` and `visit`) is either a string or
`{ text, expression }`: the engine passes that expression to `Body` while the bubble shows. Her
pick can also be `"none"` (a quiet home): the engine then shows nobody, visits included.

The **stage agent** builds the engine that runs any character to this contract and documents every
engine option in `src/world/companions/README.md` (it may extend the contract; tell the character
agents through the coordinator). Until the engine lands, character agents build and test their
character in their own lab page (see Testing) with the same contract, so it drops straight in.

### Games

A game is a folder `src/world/play/games/<shelf>/<game-id>/` with an `index.js` default export:

```js
export default {
  id: "herb-match",
  shelf: "pastime",                // pastime | brain | luck | artsy | dexterity
  title: "herb match",
  blurb: "swap herbs, make rows of three",
  Icon,                            // small SVG for the shelf
  load: () => import("./Game.jsx"), // lazy: the play hub stays light
  credit: "adapted from <project> (MIT)",
};
```

**Layout:** the play hub opens a game in its own full-screen sheet (above the header and the tab
bar, safe areas padded, a 44 pt top bar with "‹ play" and the game's title). `Game.jsx` fills its
container (`height: 100%`, `position: relative`; measure the container, not the window) and does
not draw its own back button or fixed full-screen layer; it calls `onExit()` only for its own "done"
flows. The dev game lab mimics the sheet exactly.

`Game.jsx` gets `({ onExit, onReward })`. A reward is `onReward({ sticker: "st-…", game: "<game-id>",
reason: "first garden cleared" })`, with a sticker id from her collection's catalogue
(`server/content/birthday.js`, the `st-*` ids; `shared/stickers.js` is the chat's sticker pack, not
this). The frame agent's hub saves it (a `POST /me/stickers` route the frame agent adds) and shows a
small "you got a sticker" moment. New sticker designs: put them in your game folder as
`stickers.js` (`[{ id: "st-…", art: <svg component or path>, name, line }]`) and list them in your
report; the coordinator adds them to the catalogue. `src/world/play/games/registry.js` finds every game by folder (`import.meta.glob`), so
adding a game needs no shared file. The **frame agent** owns the registry and the play hub. Until
the hub lands, open a game in the dev-only lab: `/world/game-lab?g=<id>`.

## Testing without clashing (the iMac has 4 cores)

- Your worktree is `~/kiriya-wt/<agent>`. Its `node_modules` is a private copy. Don't touch
  `~/kiriya` (the coordinator's checkout) or another agent's worktree.
- Run the dev server on **your own port** (in your brief): `npx vite --port <port> --strictPort`.
  Your local database lives in your worktree's `.data/pglite`, so it is yours alone.
  Sign in locally with the dev passphrases: `kiriya` (her view) and `admin` (Josh's view). In
  Playwright: `await context.request.post("http://localhost:<port>/api/session/unlock", { headers:
  { "x-kw": "1" }, data: { passphrase: "admin" } })`, then open pages in that context.
- Use the app layout with `http://localhost:<port>/world?app=1`.
- **Heavy work takes a slot.** Wrap every browser run, simulator run, `vite build` and full test
  suite in `~/.cache/kiriya-agents/slot.sh <command>` (at most 3 at once across all agents; it waits
  for a free slot). The iOS Simulator is one shared device: use `~/.cache/kiriya-agents/slot.sh
  --sim <command>` for anything that drives it (one at a time).
- Browser checks: Playwright **WebKit** with the `iPhone 11` device descriptor (plus a 375 pt pass),
  against your own dev server. Save screenshots under `~/kiriya-wt/<agent>/.lab/` (gitignored) and
  look at them: you are judged on what it looks like on a phone.
- iOS Simulator (real iOS WebKit): `xcrun simctl openurl booted "http://localhost:<port>/world?app=1"`
  then `xcrun simctl io booted screenshot <file>`, inside a `--sim` slot.
- **No Xcode builds and no real phone**: the coordinator builds the app and tests on Josh's iPhone.
- Run the tests that cover what you touched (`node --test scripts/test-<area>.mjs`) and add tests
  for new server code.

## Finishing

- Commit on your branch as you go (small commits, clear messages, ending with the session's
  Co-Authored-By lines). Never push. Never merge into `connection-refactor` yourself.
- Your final report: what you built, where, what you checked and how (with screenshot paths), what
  is left or uncertain, any key Josh must provide, and any change you made outside what you own.
