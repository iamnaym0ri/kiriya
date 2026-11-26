# Next con widget — progress log

The "Next con" Home Screen / Lock Screen widget, redesigned as a con **ticket** that counts down
live. Sources: `ios/App/KiriyaWidgets/Con/` (every file and type prefixed `ConWidget`). Lab: this
folder. Outputs (boards, tiles, overview, simulator shots, GIF):
`/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/con/`:
`overview.png` (every state and family, light/dark/tinted, Lock Screen, StandBy), `countdown.gif`
(the clock running out and the ticket turning to "today!!"), `homescreen.png` + `homescreen-live.gif`
(the real widget on the lab simulator's Home Screen: light, dark, Tinted, ticking),
`renders/boards/{iphone11,max67}/<scenario>.png` (one sheet per scenario and size), `integration/`
(the server diff, its scratch test, the targets-script dry run). `.build/` is made by `./sim.sh build`
and was deleted at the end (not for committing).

## The design
- **A ticket, sibling of the note cards.** Cream paper (`#fffaf2 → #fff1e2`) with the little note's
  plum outline, a dotted tear line between two punched half-moon notches, a lilac stub with
  "ADMIT ONE ♡", a made-up barcode (seeded by the con's id, so each con has its own) and a ticket
  number from its first day ("N° 271126"). Her picks (`events.hers`) get the red heart wax seal stuck
  on the ticket's corner (a small cousin of the letter's seal) and "ur pick!" in the header, as the
  site says "UR PICK". The sky behind is the cards' lilac with a few sparkles, confetti and a heart.
- **Type.** SF Rounded for the con's name, dates and every number (the live timers are drawn by the
  system, so they must be a system face); Gaegu Bold (the site's handwriting, OFL, renamed
  `ConWidgetGaegu-*`) for the warm words: "days to go!", "tomorrow!", "today!!", "happening now!",
  "coming up". The big day count is SF Rounded Black, printed in plum over a pink offset like a
  two-colour con poster.
- **The countdown follows the distance** (`ConWidgetMoment`):
  - 3+ days: the big day count ("10 days to go!").
  - 1–2 days (the last 48 h before day one): "tomorrow!" / "in 2 days!" over a live `h:mm:ss` clock.
  - Day one: "today!!" with day dots ("day 1 of 3"), or a live "doors in 0:30:00" if the server ever
    sends a doors time.
  - Day two on: "happening now!" over a big "day 2 of 3" (a festival wristband), "last day!" on the last.
    Exhibitions longer than a week show a live progress bar across their run.
  - The day after a con: the header says "AFA was lovely ♡ · next up" and the ticket is already the
    next con (WidgetKit animates the change: the number ticks over, the ticket pushes up).
  - Nothing booked: a "TBA" ticket, "I'll keep watch ✦".
- **Families.** Small = a portrait ticket with the stub along the bottom (name + "27–29 Nov ·
  Suntec"). Medium = a landscape ticket, con on the left (header, name, dates, venue, tags), countdown
  on the stub. Large = the medium ticket over a "coming up" programme card: the next three cons as
  rows with a tear-off date block, each row its own link. Lock Screen: a ring (fills over the last
  30 days, hour by hour in the last 48 h; one arc per day while a con is on) and a three-line
  rectangular; plus inline.
- **Looks.** Light; dark (night-plum ticket, lilac outline, like Maomao's envelope); tinted/clear and
  StandBy night (`widgetRenderingMode` accented/vibrant → a glass-and-outline ticket, the countdown
  accented); StandBy (no background → the ticket fills the space).

## Log (2026-11-26)
1. Read the brief, the three card labs' logs (lessons: two-stop gradients, fonts from own files,
   Gaegu's wide apostrophe and "1" that reads as "I", no colour emoji on this sim runtime), the
   current widgets, KiriyaShared, `server/routes/widget.js` (`appSnapshot`), the events schema, the
   event sources (real 2026 dates: AFA 27–29 Nov, SJ60 28–29 Nov, SGCC 4–6 Dec, Doujin Market
   12–13 Dec, EOY 25–26 Dec, the Apothecary Diaries exhibition 30 Sep–1 Nov) and the site's events
   strip (`FeedPieces.jsx`: "UR PICK · SINGAPORE", "today!!", "tomorrow", "in N days").
2. Data check: events are date-only (`starts_on`/`ends_on`, Singapore-local); no start time is
   stored (JSON-LD `startDateTime` is parsed but dropped by `upsertEvent`); `ends_on` defaults to
   `starts_on`; rows turn `past` only when the weekly stage runs, the day after they end. The current
   `appSnapshot` drops a con the day after it starts (`startsOn ≥ today`), so "happening now" needs
   the server change in the integration list.
3. First full pass (`./sim.sh render`): ticket reads well in every family and look. Problems seen:
   lab timers showed 0:00 (ImageRenderer runs timers on the real clock → lab now freezes them with
   `pauseTime` via an environment flag); Gaegu's wide letter spacing truncated "today!!" in the small
   and wrapped it in the large stub (→ set 3.5 % tighter and fitted by measuring); "on now!" read
   gappy (→ "happening now!" over a big "day 2 of 3"); "in 11 days" in Gaegu read as "in II days"
   (→ the number in SF Rounded); long "was lovely" headers shrank (→ short names: "AFA was lovely ♡");
   the inline cut off the countdown for long names (→ ViewThatFits alternatives); row subtitles
   truncated (→ venue without the hall in rows); the sky was too pale against the cream ticket.
4. Second pass: clocks read right in stills (frozen at the entry's date: `9:41:12`), "happening now"
   moved into the small ticket's header with a big "day 2 of 3" below (the label didn't fit over
   it), "day 15 of 33" sized to fit the stub by measuring, the exhibition's run bar drawn by hand in
   stills (ImageRenderer ignored the tint and painted it yellow), "TBA" placeholder slots in the
   large programme so one or two cons keep the card's rhythm.
5. **The real widget on the lab simulator's Home Screen.** A lab widget extension (`Lab/ConLabWidgets.swift`,
   built with swiftc, linked with `-e _NSExtensionMain` like Xcode does) carries the real `ConWidget`
   plus lab widgets that feed the same views and timeline with the season moved around today.
   `tools/place.py` writes them into SpringBoard's `IconState.plist` while the simulator is down
   (no UI scripting needed); `tools/style.py` flips the Home Screen to Tinted/Clear/Dark through the
   poster's home screen configuration (`_iconUserInterfaceStyleType` = `accent`/`clear`/`dark`).
   First try: blank widgets — the extension trapped on "Formatted text for configurationDisplayName
   is not supported" (an interpolated display name in the lab widget; the real one is a literal).
6. On the Home Screen: Gaegu renders (registered with CTFontManager from the extension's bundle; no
   `UIAppFonts` needed), the clocks tick, and the medium stub's clock was cut to "18:59:…" — the
   system sizes a timer for its widest value → stubs widened (122/126 pt) and clocks set a size
   smaller (small 26/24, medium 20, large 21). Re-checked live: "18:45:35" fits everywhere.
7. iOS 26.3 on the iPhone 11 simulator measures small 166.5 pt, medium 356 × 166.5, large 356 × 371.5
   (a little under the HIG's 169/360/379 for this screen); every layout is proportional, and the
   renders at 169/360×169/360×376 and 6.7" (170/364×170/364×382) all hold.
8. Dark mode (`simctl ui appearance dark`) and the Tinted Home Screen checked live: the night ticket,
   and the glass-and-outline ticket in accented rendering, both read cleanly.
9. Server proposal tested for real on a scratch copy of the repo (never the repo itself): the new
   `appSnapshot` query + presenter, a new PGlite test (ongoing, starting today, future, no end
   date, over, ended yesterday, unconfirmed, regional) passes, and the existing
   `test-app-bridge.mjs` still passes (13/13 together; the test to append is
   `integration/test-con-widget.snippet.mjs`). Yesterday's con stays in `events` for one more day so
   the "was lovely" header survives the widget's hourly refresh; `nextEvent` skips it.
10. `add-native-targets.rb` snippet dry-run on a scratch copy of the project: KiriyaWidgets gets the
    six `ConWidget*.swift` sources and the Gaegu font + licence as resources.
11. The unused Gaegu Regular dropped (one 38 KB font in the extension).
12. The countdown GIF, on the real Home Screen. A demo widget (its own extension, so moving the day
    boundary can't touch the other lab widgets) stages a Singapore midnight. Three tries taught:
    WidgetKit keeps a placed widget's timeline across reboots (`.atEnd` with entries two weeks
    out), so the first two stagings had already passed when the widgets appeared; `reloadAllTimelines`
    from the lab app didn't reliably re-ask; and opening the app returns SpringBoard to the page
    with its icon. What works: the midnight is 330 s into each ten-minute slot of the clock (every
    process of the extension agrees with nothing shared), and `tools/demo.sh` reinstalls the app at
    the start of a slot (an app update makes WidgetKit ask for fresh timelines) and records across it.
    Then the busy iMac stalled `simctl install` for minutes (another lab's simulator was being
    uninstalled), so the slot run never got its fresh timeline either. The GIF therefore comes from
    the lab app's live page (`./sim.sh live 45`): the same views, the entry dates from
    `ConWidgetTimeline`, switched by a `TimelineView(.explicit(…))` like WidgetKit switches entries,
    and the system's own live timers: 0:10 → 0:00 → "today!!" (`countdown.gif`). The real Home
    Screen's ticking is in `homescreen-live.gif` (WidgetKit, the "tomorrow!" clock), and the real
    Home Screen states are in `homescreen.png`.
13. Device typecheck of the whole widget target with `Con/` (arm64-apple-ios17.0): clean in Swift 5
    and in Swift 6 language mode — no errors, no warnings.

## Running it
- `./sim.sh build [app]` · `./sim.sh render [scenario,…|all] [overview] [tiles]` (boards per scenario at
  iPhone 11 and 6.7", optional single tiles, the overview) · `./sim.sh overview`
- `./sim.sh place states|states2|states3|near|demo` (lab widgets onto the Home Screen) ·
  `./sim.sh style light|dark|tinted|clear` · `./sim.sh shot <name>` · `tools/settle.sh <udid> <png>`
- `tools/demo.sh [seconds]` (records the staged midnight) · `tools/gif.sh <mov> <gif> <start> <dur> [crop] [fps] [width]`
- Scenarios: `Lab/ConLabScenarios.swift` (fixed dates for stills, `ConLab.live` for the Home Screen).
- Only the "Kiriya Con Widget Lab" simulator (iPhone 11, iOS 26.3) is ever used.

## Integration (for the main session; nothing outside Con/ and this lab was touched)
1. `ios/App/KiriyaWidgets/WidgetsMain.swift`: in `KiriyaWidgetsBundle` replace `NextConWidget()` with
   `ConWidget()`, and delete `struct NextConWidget` (ConWidget keeps its kind, "NextConWidget", so a
   widget already on a Home Screen carries on; two widgets may not share a kind).
2. Optional clean-up: `NextConView` in `WidgetViews.swift` and `KiriyaDates` in `WidgetTheme.swift`
   are then unused.
3. `ios/scripts/add-native-targets.rb`: add the `KiriyaWidgets/Con` block (sources + `Con/Fonts`
   resources) just before "Embed the extensions in the app" (diff in the final report; dry-run
   output above). No Info.plist change: the font registers itself with CTFontManager, which the
   lab's real Home Screen widget proved works.
4. `server/routes/widget.js` `appSnapshot`: richer `nextEvent` (adds id, endsOn, city, tags, hers,
   url, link) and a new `events` list (yesterday's con + ongoing + the next ones, up to 5); the
   query keeps cons until the day after they end. Old app builds are unaffected (extra fields are
   ignored; `daysAway` can now be negative while a con is on, which the old widget clamps to
   "today ♡"). Test in `scratchpad/widgets/con/integration/repo/scripts/test-con-widget.mjs`.
5. Optional, web: `?event=<id>` on `/world#events` (the widget's per-con link) could scroll to and
   highlight that con in `EventsStrip`; today it simply opens the events section.
