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
| Characters | Five: **Maomao** (refined), **Miku as in "Confessions of a Rotten Girl"** (SAWTOWNE, 2025; the agent confirms the look), **Bamby** (PLAVE), **Hatsune Miku**, **KAITO**. She picks one in her settings; another one drops by for a visit now and then (call-and-response bubbles). |
| Where they live | The app's home section only (the website keeps Maomao on every page, as now). |
| Movement | Invisible levels across the screen. Wherever a character walks, a cloud platform forms under its feet (in front of it as it goes, fading away behind). Each character has its own platform design and its own way of moving: Miku sits on her cloud swinging her legs, Maomao stands and ponders, Bamby roams and does what he does best. |
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
  Natsu Hyuuga / Shufunotomo / Square Enix) and Bamby (PLAVE, © VLAST) as fan art credits.
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

  **Styled by the frame** in `src/styles/app-shell.css` (imported by WorldShell),
  all under `html.app-shell`. What each class gives you, so sections only style what is their own:

  | Class | What the frame does |
  | --- | --- |
  | `.app-section`, `.app-screen` | The column: 16 pt gutters (or the safe area if wider), max 680 px, centred. |
  | `.app-section__head` | Grid: back button row, then title + actions, then subtitle. 14 pt above, 18 pt below. |
  | `.app-section__title` | Large title: Gaegu 700, 36 px, `--theme-ink`. `data-short="…"` sets the compact bar's text if the title is long. |
  | `.app-section__subtitle` | 14 px, `--theme-muted`, 4 pt under the title. |
  | `.app-section__actions` | Trailing row, 8 pt gaps, vertically centred on the title. Use `.app-action` for a round 40 pt button (paper, accent icon). |
  | `.app-section__body` | One column, 16 pt between children, never wider than the screen (`minmax(0, 1fr)`). |
  | `.app-group-title` | Optional small lowercase label between groups of cards (iOS grouped-list header). |
  | `.app-card` | Paper card: 1 px `--theme-line`, `--app-card-radius` (20 px), soft purple shadow, 16 pt padding. `--tint` = soft lilac fill, `--flush` = no padding + clipped corners (photos, lists). |
  | `.app-card__head` / `__title` / `__action` | Title row: Gaegu 700 22 px left, accent 14 px link/button right. `__body`: 15 px/1.5 body text. |
  | `.app-list` / `.app-row` | Inset grouped rows: 52 pt min height, hairlines inset 16 pt. A row that is (or holds only) an `<a>`/`<button>` fills the row and highlights on press; add `.app-row--more` for a chevron. Parts: `.app-row__icon` (32 pt tinted tile), `.app-row__text` (with `<small>` second line), `.app-row__detail` (muted, right). A list inside a card runs to the card's edges. |
  | `.app-empty` | Centred empty state: `<strong>` handwritten line + muted text. |
  | `.app-bleed` | Cancels the gutter, for edge-to-edge strips (carousels, photo rows). |
  | `.app-screen__back` | iOS back button: the frame draws the chevron, so put **only the parent's name** in it ("notes & letters"). |

  CSS variables the frame sets on `html.app-shell`: `--app-gutter` (16px), `--app-tabs-h` (tab bar
  height including the home-indicator inset), `--app-bottom` (what the tab bar covers right now: it
  becomes 0 while the keyboard is up; use it for `bottom:` of anything fixed and for the padding
  under anything that scrolls on its own), `--app-card-radius`, `--app-safe-top`, `--app-bar-h` (44).
  `.world-content` already pads its bottom by `--app-bottom` + 32 pt, so a normal section needs
  nothing. `body.keyboard-open` is set while the keyboard is up (Capacitor Keyboard, or
  `visualViewport`/focus in Safari); the tab bar hides then. The tab bar stays visible in chat.
  `body[data-tab]` names the current tab.
- **Frame behaviour (src/shared/AppFrame.jsx):**
  - Each tab remembers its last page (pushed screen included) and its scroll position; switching tabs
    replaces history instead of adding to it, so the edge swipe only ever goes back inside a tab.
    Tapping the tab she's on pops to its first screen, then scrolls to the top, then fires
    `document` event `app:tab-reselect` (`detail.tab`) for sections that want to do more.
  - A small frosted bar fades in at the top once the section's `.app-section__title` (home: the
    wordmark) scrolls under the status bar, showing that title (and the back button on a
    `.app-screen`). Don't add your own sticky title bar.
  - **Pushed screens** open with `navigate(url)` (a real history entry), so the iPhone's edge swipe
    works. They slide in from the right (`html[data-nav="push"] .app-screen`; none with Reduce
    Motion). For the back button use `const back = useAppBack(fallback)` from
    `src/shared/AppFrame.jsx`: it goes back when she came from inside the tab and otherwise replaces
    the screen with `fallback` (default: the tab's first screen), e.g. when a notification opened it.
  - Pull to refresh (invalidates `["me"]` queries) is on in home and notes & letters only.
- **The website's top bar (`.world-mast`) shows on home only** in the app, as a compact wordmark
  (no buttons) with the daily ribbon under it; every other tab starts right under the status bar
  with its own `.app-section__head`. No footer in the app. The floating "little corner"
  (`.daily-style-corner`) is hidden in the app; the home section shows it as a widget instead.
- **Deep links in the app** (`src/lib/appLinks.js` `appPath()`, applied by the shell to every
  navigation and by NativeApp before it navigates; `tabOf()` says which tab a path belongs to):

  | Old path (notifications, widgets, Siri, quick actions, links in content) | Lands on |
  | --- | --- |
  | `/world/notes?open=<id>` (note push, Little note widget) | `/world/mail?note=<id>` (mail opens it) |
  | `/world/letters?open=<id>` (letter push) | `/world/mail?letter=<id>` (mail opens it) |
  | `/world/notes`, `/world/letters` (bare) | stay; they are in the notes & letters tab |
  | `/world#letters-hub` | `/world/mail` |
  | `/world#note-jar` (jar push, reminder, Note jar widget, "pull a note" quick action) | `/world/mail#note-jar` |
  | `/world?event=<id>#events` (event push) | `/world/events/<id>` (events-ui), pushed from home |
  | `/world#events` (Next con widget) | `/world/events` (events-ui list), pushed from home |
  | `/world/events/*`, `/world/saves`, `/world/merch` | stay; pushed screens of home |
  | `/world#play-desk`, `/world?gallery=1&doodle=<id>#play-desk` (doodle note push), `?paint=` | `/world/play` keeping `doodle`, `gallery`, `paint` (the play hub opens the doodle) |
  | `/world/settings[/…]` | `/world/me[/…]` |
  | `/world/chat` (chat and tap pushes, chat quick action, Thinking of you widget) | stays (chat tab) |
  | `/world/art`, `/world/studio` | stay; in the play tab |
  | `/world?quick=status` (check-in shortcut) | stays; DailyStyle opens her corner's check-in |
  | `/world/stage`, `/world/atelier`, `/world/apothecary` (retired) | `/world` (World.jsx) |

### Admin in place

Josh changes what she sees where she sees it. Next to anything editable, render
`<AdminEdit label="…" onClick={…} />` (`src/shared/admin/AdminEdit.jsx`; nothing on her phone;
`compact` for a pencil only) and edit in an `<EditSheet>` bottom sheet, with `<EditField label hint>`
around each input. `onSave` may return a promise: the sheet shows "Saving…", closes when it resolves
(resolve `false` to stay open) and shows the error when it rejects, so
`onSave={() => save.mutateAsync(draft)}` is all you need. Optional: `subtitle`, `saveDisabled`,
`dirty` (asks before throwing changes away), `onDelete` + `deleteLabel`.
Shortcuts into Josh's in-place composers: `/world/mail?compose=note`, `?compose=letter`,
`?compose=jar` (the mail agent opens the sheet on arrival). Admin API routes go under `/api/admin/...` (the existing
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
flows. The dev game lab mimics the sheet exactly. The sheet is portalled to `<body>`
(`createPortal`), because the page's content column is its own stacking context.

`Game.jsx` gets `({ onExit, onReward })`. A reward is `onReward({ sticker: "st-…", game: "<game-id>",
reason: "first garden cleared" })`, with a sticker id from her collection's catalogue
(`server/content/birthday.js`, the `st-*` ids; `shared/stickers.js` is the chat's sticker pack, not
this). The frame agent's hub saves it (a `POST /me/stickers` route the frame agent adds) and shows a
small "you got a sticker" moment. New sticker designs: put them in your game folder as
`stickers.js` (`[{ id: "st-…", art: <svg component or path>, name, line }]`) and list them in your
report; the coordinator adds them to the catalogue. `src/world/play/games/registry.js` finds every game by folder (`import.meta.glob`), so
adding a game needs no shared file.

**The hub as built (frame agent):** the sheet is `src/world/play/games/GameSheet.jsx` (the hub and
the lab share it; add `game-sheet__stage--scroll` to a stage that should scroll). A game opens as a
history entry (`/world/play?game=<id>`), so back and the edge swipe close it; the sketchbook opens
the same way (`?sketchbook=1`). `onReward({ sticker, reason })` is enough (the hub adds `game`).
Optional `order` (default 50) sorts a shelf before the title does. `stickers.js` art may be a
component, 64×64 SVG inner markup, an image path, or a name the module's exported `AnySticker`
draws. Quizzes: the hub renders `QuizzesEntry`, the named export of
`src/world/play/quizzes/index.js`, as one card in the play section body. The **frame agent** owns the registry and the play hub. Until
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
  then `xcrun simctl io booted screenshot <file>`, inside a `--sim` slot. (Round 2: address the
  kiriya simulator by its UDID, `C9144E09-A43A-4544-AA1C-BA92D68EBB59`; the other booted one
  belongs to another project.) **Every `openurl` opens a new Safari tab that keeps animating**: end
  each simulator run with `xcrun simctl terminate C9144E09-A43A-4544-AA1C-BA92D68EBB59
  com.apple.mobilesafari`, inside the same slot. On 2026-11-27, 69 forgotten tabs pushed the
  iMac's load average to ~970 and made every agent's frame-time measurement meaningless.
- **No Xcode builds and no real phone**: the coordinator builds the app and tests on Josh's iPhone.
- Run the tests that cover what you touched (`node --test scripts/test-<area>.mjs`) and add tests
  for new server code.

## Git in a shared repository

All worktrees share one repository, so **`git stash` is shared between agents**: one agent's
`stash pop` can take another's changes (it happened on 2026-11-26). **Never use `git stash`.**
Commit your work in progress on your own branch before merging anything (`git commit -am "wip …"`
is fine; tidy later), then `git merge connection-refactor`. Never run `git checkout`/`reset`/
`clean` on paths outside your own work, and never touch another worktree.

## Finishing

- Commit on your branch as you go (small commits, clear messages, ending with the session's
  Co-Authored-By lines). Never push. Never merge into `connection-refactor` yourself.
- Your final report: what you built, where, what you checked and how (with screenshot paths), what
  is left or uncertain, any key Josh must provide, and any change you made outside what you own.

## Round 2 (Josh's review, 2026-11-27)

Josh tested the first build on his iPhone. What he asked for, and who does it:

| Agent | Branch / worktree, dev port | Does |
| --- | --- | --- |
| r2-events | `r2/events`, `~/kiriya-wt/r2-events`, 5311 | Events and merch, engine and screens (`worker/**`, `server/routes/events*.js`, `server/lib/events/**`, the events tables, `src/world/events/**`, `src/world/merch/**`, `src/world/home/EventsBlock.jsx`). |
| r2-stage | `r2/stage`, `~/kiriya-wt/r2-stage`, 5312 | The companion engine (tap menu, "stay"), plus refining **Maomao**, **Hatsune Miku** and **KAITO** (`src/world/companions/**` except `characters/miku-rotten` and `characters/bambi`; `shared/companions.js`). |
| r2-chars | `r2/chars`, `~/kiriya-wt/r2-chars`, 5313 | Refining **Rotten Girl Miku** and **Bamby** (`src/world/companions/characters/miku-rotten/**`, `characters/bambi/**`). |
| r2-play | `r2/play`, `~/kiriya-wt/r2-play`, 5314 | Play: paper doll, a new game in place of the sticker scene, kaleidoscope, a dedicated doodle gallery (`src/world/play/**` except quizzes, `src/world/studio/**`). |
| r2-home | `r2/home`, `~/kiriya-wt/r2-home`, 5315 | Home layout and header, the background animation's smoothness, the note jar, and the spacing/overflow pass over home, chat, notes & letters and the last tab (`src/world/home/**` except `EventsBlock.jsx`, `src/world/WorldShell.*`, `src/styles/**`, `src/shared/AppTabBar.*`, `src/shared/play/PlayfulWorld.*`, `src/world/mail/**`, `src/world/notes/**`, `src/world/letters/**`, `src/world/chat/**` (layout), `src/world/me/**` (layout)). |
| coordinator | `connection-refactor` | Chat not loading (fixed d0ae76c: Vercel's rewrite echoes `route=`), the "see it as kiriya" preview for Josh, merging, the iPhone and simulator pass, the deploy. |

Same ground rules, testing and git rules as round 1 (above). Agents first run `git merge
connection-refactor` in their worktree if it is behind.

### Companion contract, round 2: the tap menu and "stay"

Josh: every character gets interactions like the website's Maomao (tap her, choose something to
show her). A tap always shows **two** choices next to the character: one of its own, and **stay**.

```js
// characters/<id>/index.js, new optional field
action: {
  id: "herb",                    // unique within the character
  label: "show her an herb",     // the chip's words: lowercase, at most ~20 characters
  icon: "🌿",                    // one emoji, or a tiny component ({ size }) drawn in the chip
  pose: "inspect",               // a pose from `poses`, held while it plays
  prop: "herb",                  // optional: Body gets `prop="herb"` while it plays
  expression: "curious",         // optional
  seconds: [3, 5],               // how long it lasts
  topic: "action",               // the lines topic said as it starts (default "action")
  steps: [ /* optional: a little sequence of { pose, prop, expression, seconds, topic } */ ],
}
```

- **Body** gets one new prop, `prop` (string or `null`): the running action's prop, for a
  character to draw in its hand (Rotten Girl's paddle, Miku's leek, KAITO's ice cream…). Characters
  may also hold a prop in their own behaviours by their own means.
- **Lines**, new topics: `action` (default for the custom action), `stay` (told to stay), `wander`
  (let go again), optional `stayIdle` (idle lines while staying; falls back to `idle`).
- **The menu** (engine): a tap keeps today's `react` pose and `tapped` line, and opens a small
  frosted menu beside the character with exactly two 44 pt chips: `[icon label]` and `[📍 stay]`
  (while staying, the second reads `[🌸 wander]`). Always fully on screen, never under the status
  bar or tab bar. A chip runs its choice; a tap elsewhere, a scroll, a drag or 5 s of nothing
  closes it. Three quick taps still give `pester`.
- **Stay** (engine): the character stops travelling: no walks, jumps, level changes, roaming,
  "somewhere clearer" moves or visit choreography that moves it (visitors still come and go). It
  keeps doing everything it can do in place, chosen from behaviours without `roam` or `level`,
  all treated as `stay: true`. Picked up and dropped while staying, it lands where it was dropped
  (the level below the drop point) and that becomes its spot. Kept per character in
  `localStorage` `kiriya:companion-stay` (`{ [id]: { x: 0..1 share of the width, level: index from
  the bottom } }`, wrapped in try/catch), restored on the next visit to home. **wander** lets it go.
- Each character needs **at least three in-place behaviours** (a little dance or fidget, a
  pondering or humming moment, something of its own), so staying looks alive.

### Character writing, round 2

Josh wants each character much closer to the original in looks, speech and behaviour, after deep
research (official profiles, wikis, the source works, fan consensus; looking at official art for
reference is fine, but everything drawn is original SVG, nothing traced or embedded). Lines don't
have to be SFW where the character would go there: **Rotten Girl Miku** is a fujoshi, so BL
shipping, seme/uke talk, fanfic and doujin jokes, nosebleeds, flustered yelling and her paddle are
in character. Keep it to innuendo and comedy, never explicit sexual description. **Bamby** (official romanisation; the id stays `bambi`) is the
avatar of a real performer: playful and flirty-cute is fine, nothing sexual. Nothing may name
real people other than the characters themselves.

### Round 2 status (2026-11-27, all merged into `connection-refactor`)

| Branch | What landed | Coordinator QC on top |
| --- | --- | --- |
| `r2/events` | Events never vanish (stable ids, aliases, strict dedupe, two-pass "past"); event page: what, when, where, tickets, weather first, then a short gist with icons, the rest folded; merch has its own list and detail page (gallery, price, where, which event); pictures from Instagram posts and official pages stored through `POST /api/jobs/events/images` (CRON_SECRET), no new keys. | Ticket line shows the real on-sale moment (FF XIV: SISTIC, 2 Dec 12:00 SGT); freebies say "free", not "price tbc". |
| `r2/stage` | Engine: two-chip tap menu (own action + stay/wander), stay mode with drops, props, steps; Maomao, Hatsune Miku, KAITO refined after research. | Maomao's bandaged left forearm; subtler freckles (Josh: "look like a mustache"); a speech bubble takes the clearest side; `data-companion-never` keeps characters and bubbles off home's greeting and her name (0 of 12 fresh loads covered it). |
| `r2/chars` | Rotten Girl Miku from SAWTOWNE's own concept art (green tails, cross ties, round glasses, crossed red ribbon, navy plaid, the SINNER paddle, the Yaoi Note) and Bamby (PLBBUU look; short, dry, deadpan voice from the Korean wiki; peaches, pigeons). | Bamby is never a shipping target; nothing about him reads as suggestive; every reply in every file is in the speaker's own voice (scan: 0 mismatches). |
| `r2/play` | A real chibi paper doll (95 garments, 17 hairstyles, 8 themed sets with scenes); a bouquet maker in place of the sticker scenes; the kaleidoscope's coach, labelled controls and "kept" moment; her own gallery (card on play, full screen, Josh's hearts and notes). | — |
| `r2/home` | Centre stage first, what's new under it; her little corner as a chip at the right of a 68 pt header; 17 pt under her name; background charms fall evenly (no stop-and-go, no restarts after the background, behind the page); the note jar as notes & letters' centrepiece; new notes badge the tab and lead what's new; spacing pass. | — |
| coordinator | Chat/memories/quizzes (Vercel's `route=` echo); "see it as kiriya" (read-only preview of her side). | — |

Checks on the merged code: `npm test` 505/509 (the 4 cancelled are the shop-feed environment quirk),
production build + leak check pass, a 44-screen WebKit tour (11 screens × 414/375 pt × her/Josh: no
sideways scroll, no clipped text, every tap area ≥ 44 pt, no page errors), and an iOS Simulator pass.

Still to see on Josh's iPhone 11: charm smoothness by eye and frame times against the baseline
(production bundle `index-BXI6zpQS`, home at rest and scrolling: 60 fps, 0 frames over 20 ms);
Rotten Girl's repaint cost; the bouquet's pinch and drag; the kaleidoscope at 12 slices; the gallery's
memory with many full-size pieces; whether the hand font's missing glyphs (é, ×, ♡ in Gaegu) fall
back cleanly on a real device (the Simulator draws boxes).

## Round 3 (Josh's second review, 2026-11-27)

Josh's asks, by agent. Five run at a time (Josh's choice): wave 1 is chat-core, chat-room, notes,
shell and chars; wave 2 (motion and three game checkers) starts as wave-1 agents finish. Same
ground rules, testing and git rules as rounds 1–2. Worktrees `~/kiriya-wt/r3-<role>`, branches
`r3/<role>`.

| Agent | Port | Does | Owns |
| --- | --- | --- | --- |
| r3-chat-core | 5321 | The chat itself: composer, message list, reply / edit / delete, hold menu, swipe-to-reply, up to 10 photos per message (Discord-style grid), videos, the photo viewer, GIF quality, typing indicator, how messages arrive, the keyboard, signals, the header. | `src/world/chat/**` except chat-room's files; `src/lib/chat.js`; messages, edits, typing and media in `server/lib/chat.js`, `server/routes/chat.js`; video limits in `server/routes/uploads.js`, `src/lib/uploads.js`. |
| r3-chat-room | 5322 | Memories by kind, the design sheet (whole-chat themes, bubble designs, background photo), chat lock with Face ID, end-to-end encryption. | `src/lib/chatCrypto.js` (+ `src/lib/chatCrypto/**`), `src/world/chat/ChatLook.jsx`, `MemoriesPage.jsx`, `SaveMemory.*`, `wallpapers.js`, new `src/world/chat/{theme,lock,memories}/**`; prefs and memories in `server/lib/chat.js`; new `server/lib/chatKeys.js` + its route; the chat parts of `ios/App/KiriyaNotificationService/**`, `ios/App/KiriyaWidgets/**`, `ios/App/KiriyaShared/**`. |
| r3-notes | 5323 | Pulling a note from the jar and opening a letter: the note appears in the middle of the screen, with react and save under it; the jar's own details on its island; a bigger jar. | `src/world/mail/**`, `src/world/notes/**`, `src/world/letters/**`, `server/lib/noteJar.js`, `server/routes/noteJar*.js`, `server/lib/loveNotes.js`, `server/routes/loveNotes.js`. |
| r3-shell | 5324 | Her little corner's sheet (opening, closing, scrolling, swipe down), the greeting centred with her name, the photo display's frame and decorations, the falling charms above everything, ten opening animations, Face ID first. | `src/world/home/**` except `EventsBlock.jsx`, `src/shared/DailyStyle.*`, `src/shared/play/PlayfulWorld.*`, `src/world/WorldShell.*`, `src/main.jsx`, `src/shared/NativeApp.*`, `src/lib/native.js`, `src/lib/session.js`, the sign-in screen, new `src/shared/opening/**`, splash settings in `capacitor.config.json`. |
| r3-chars | 5325 | Bamby (face, what he does and says most), Rotten Girl, Maomao's frank side. | `src/world/companions/characters/{bambi,miku-rotten}/**`, `characters/maomao/lines.js`. |
| r3-motion (wave 2) | 5326 | Seamless transitions from one pose or behaviour to the next, for every character. | `src/world/companions/engine/**`, `CompanionHost.jsx`, the smallest pose plumbing in each character's Body. |
| r3-games-a/b/c (wave 2) | 5327–5329 | Quality check of every game, fixing what isn't up to par. a: brain + quizzes + the play hub; b: pastime + luck; c: artsy + dexterity + the sketchbook, studio and gallery. | Their shelves' folders. |

### Chat contract, round 3 (chat-core ↔ chat-room)

- **Encryption hooks** (`src/lib/chatCrypto.js`, a pass-through stub until chat-room lands it):
  chat-core sends every outgoing message and edit through `sealOutgoing`, opens every incoming
  message (pages, realtime, edits, reply previews, the summary) with `openIncoming` before
  rendering, seals every photo, video and voice note with `sealFile` before `uploadFile`, and
  shows media only through `useMediaUrl(media)`. A message with `locked: true` renders as a quiet
  "this one is still unlocking ♡" bubble. Nothing else in the chat may read `body` or `media.url`
  from the server directly.
- **Theme**: the `.chat` root carries `data-theme` (whole-chat theme), `data-bubble` (bubble
  design) and `data-background` (preset or `photo`), from `useChatPrefs()`. chat-core styles
  layout only and takes every colour from these variables, which chat-room defines for each theme:
  `--chat-bg --chat-ink --chat-meta --chat-line --chat-accent --chat-accent-ink --chat-mine
  --chat-mine-ink --chat-theirs --chat-theirs-ink --chat-bar --chat-bar-ink --chat-field
  --chat-field-ink --chat-menu --chat-menu-ink --chat-reply --chat-radius --chat-wallpaper
  --chat-photo`. Bubble designs style `.chat[data-bubble="…"] .bubble` (and `.msg[data-mine]
  .bubble`): chat-core keeps the class names `.chat`, `.msg` (`data-mine`, `data-kind`), `.bubble`.
  New variables are added by telling the coordinator, who tells the other agent.
- **Header**: name and activity dot on the left; on the right a memories button
  (`/world/chat/memories`) and a design button (opens chat-room's design sheet). chat-room wires
  its sheet and the Face ID lock gate into `ChatPage.jsx` with one-line changes.
- **Server**: both edit `server/lib/chat.js`; keep your changes in your own functions so the
  merge stays easy. Encryption-specific server code goes in `server/lib/chatKeys.js`.

### Character writing, round 3

Josh: "don't be afraid to make her nsfw, same as Bambi and maomao if it matches her character".
Rotten Girl can be much bolder: thirsty shipping commentary about fictional adult men, R-18
doujinshi and fanfic jokes, seme/uke debates, flustered yelling, nosebleeds, the SINNER paddle.
It stays innuendo and comedy about the pairings she ships, never explicit sexual description, and
never sexualises Miku herself (canonically 16). Maomao can be her frank, clinical self about
aphrodisiacs, poisons and the pleasure quarter she grew up in, without being sexualised. Bamby is
a real performer's avatar: nothing sexual. Nothing may name real people other than the
characters themselves.

### Round 3 status (2026-11-27, merged into `connection-refactor`)

| Branch | What landed | Coordinator QC on top |
| --- | --- | --- |
| `r3/chat-core` | Composer (signal · GIF · 📎 · "talk to me baby" · voice), no in-app emoji/sticker pickers; header with name + activity; Discord-style replies, edits, deletes; hold menu; swipe to reply; up to 10 photos/videos per message in a Discord grid; PhotoSwipe viewer; GIPHY mp4 renditions; typing; signals redesign; keyboard follows the keyboard (Keyboard.setResizeMode "none" while the chat is open); iPhone stickers and Genmoji through a plain-text contenteditable plus `supportsAdaptiveImageGlyph` (MainViewController). | Header: the script name never clips; status **active** (green) / **inactive** (grey) / **sleep** (amber crescent, night where they are) from a presence check-in on `/me/chat/summary` (never while previewing); the hold menu crash after the theme merge (44d9645, found by chat-core). |
| `r3/chat-room` | Memories in four shelves; the design sheet (8 themes, 9 bubble designs, presets or her own sealed photo); Face ID chat lock (off by default); end-to-end encryption (`docs/refactor/CHAT-CRYPTO.md`: P-256 keys wrapped by a PBKDF2 passphrase key, AES-GCM, sealed previews opened by the notification extension and widget, history sealed in place, safety code). | Status colours per theme (`--chat-active`, `--chat-sleep`); the design preview's header matches the real one. |
| `r3/notes` | The jar pulls a note into the middle of the screen (next one prefetched, no daily limit, react / save / another one); notes and letters unfold the same way; bigger jar with its details on its island; Josh sees how each jar note fared. | "Pull a note" quick action pulls at once (`/world/mail?jar=pull`). |
| `r3/shell` | Her corner's sheet (slides, swipe down, pinned bottom bar); greeting and name centred by their ink; the display's bow, star, heart and stitched frame; charms in the top layer; ten opening scenes around the wordmark (Josh: broad, stars/love/moon, complement the logo); Face ID first, passphrase fallback, a first-run choice. | Tiny heart off the k's swash; lock-sheet copy; pull-to-refresh ignores edit sheets. |
| `r3/chars` | Bamby's real face (pink wavy fringe, pink eyes, round blushing face), habits and words; Rotten Girl truer to the MV and bolder (innuendo only, never about her); Maomao's frank apothecary side. | Bamby facts checked against namu.wiki (bambiriring is a word he made up, not his hello; an unverified count replaced). |
| `r3/motion` | Poses cross-fade and glide instead of snapping (engine `ghost.js`, `blend.js`), settle and lean, KAITO's arms sweep, props pop in. | — (frame times to check on the iPhone 11). |
| `r3/games-a` | Brain shelf: memory drawer, odd jar, herb sequence and lantern corridor rebuilt; charm grid, shy shade, quizzes and hub fixes. | Play hub inert behind an open game. |
| `r3/games-b` | Pastime and luck: ten games fixed, first-time how-tos, the luck games give the page's audio mode back (Josh's songs). | — |
| coordinator | Play hub: sketchbook card padding, quiz cards stacked inside their card, no sticker-book button; Gaegu's curly quotes and ellipsis drawn narrow; tab labels below 340 pt. | — |

Native changes since the last phone build: the chat plugin and sealing code (App, widgets, both
notification extensions; `ruby ios/scripts/add-native-targets.rb`), `supportsAdaptiveImageGlyph`,
the splash auto-hide cap (3 s). The iOS 26.3 Simulator lacks system fonts (✧ ✦ ✿ and even 😊 draw as
boxes with `-apple-system`): check symbols on the real iPhone before bundling a symbol font.

### Round 3b (Josh on his iPhone, 2026-11-27, deployed 19:31, bundle 1.20261128.13154)

Plain "sent <3" / "read ♡"; seven signals in one row, each with its own colour and motion; the
composer's red heart beats every 3.6 s; the chat's newest pages and sealed files cached on the
phone (encrypted at rest, 250 MB cap), scroll-back paging that holds its place, opened chat text no
longer in the general persisted cache; theme and background shared ("ours"), bubble design and
typing indicator per person (each message in its sender's design; typing in the typer's style);
5 new bubble designs and 5 new typing indicators; the Maomao background is the official episode 6
garden-party wallpaper (Josh's pick), cropped to its three panels, credit on its own line above the
composer; the "seal our messages" bar is a slim row under the header; lighter pose blends (no full
copies or style reads in the flip frame): on Josh's iPhone 11, home at rest went from 18 frames
over 20 ms in 20 s to 0 (6 blends). Header-overlay report: the compact top bar is hidden on the
chat page (likely cause); confirmation pending from the recorder on Josh's phone.

### Round 3c (2026-11-27): Josh observes, she's the main stage; chibis on every page

- **Observer admin** (Josh's rule; memory `kiriya-observer-admin`): on Josh's phone her corner,
  check-in, prefs (companion, animations, sharing), public page and pin board read as hers with
  `readOnly: true`; his writes get 403 `hers`. His own phone's settings ("this phone", "you") and
  every sender tool stay his. His game plays and sketchbook keeps are tries that never touch her
  records (`scripts/test-her-world.mjs`).
- **Companions everywhere**: one stage in the app shell, kept across tabs; her pick on both phones
  (`usePrefs().data?.companion`); hidden and paused under games, the sketchbook, sheets, dialogs and
  the viewer (`data-companion-hide` for more). **Contract:** the engine reads the chat's class names
  `.chat`, `.chat__head`, `.chat-nudge`, `.composer`, `.chat__credit`, `.msg`, `.bubble`: keep them.

### Round 3d (2026-11-28): snow, and the chibi stays free

- **Snow** (Josh: "like an actual snowflake falling… not one line then another line"): 22 flakes
  (16 on a phone) in three depths; every flake of one depth falls at exactly the same speed with
  golden-ratio starts, so the gaps never close. Per-flake speeds (2078d1a) drifted into rows of 4–6
  about 20% of the time after a couple of minutes (measured on Josh's phone); now at most 3 meet
  (one per depth), checked over 15 simulated minutes for every feeling's speed.
- **Companion placement**: a stricter rule set (bubbles and body never over titles, perches, a
  per-frame guard; r3/motion ec484df + e3697ed) was built and then **not merged**. Josh: "Just let
  the chibi do whatever around the page, that was the reason of the stay command". She roams as in
  round 3c; "stay" is how Kiriya parks her. Don't reopen this unless Josh asks.
- Feed test `kamui: a body slower…` holds the event loop open (AbortSignal.timeout's timer is
  unref'd), so node:test no longer cancels it and the three after it.
