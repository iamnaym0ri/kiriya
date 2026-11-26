# "Thinking of you" widget — progress log

The one-tap signals widget (♡ thinking of you, 🫂 hug, 😘 kiss, ☀️ morning, 🌙 night, 🥺 miss, 💧 water),
redesigned as a sibling of the notification cards (Letter, FormalLetter, Jar). Sources:
`ios/App/KiriyaWidgets/Signals/` (widget target) and `Signals/ForTheApp/` (App target: the heartbeat haptic,
the AHAP and the seven notification sounds). Lab: this folder. Outputs (renders, sheets, overview, GIF,
sounds): `/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/signals/`.

## The design
- **Buttons are little stickers.** Each signal is a pastel tile in its own colour (♡ blush, hug peach, kiss
  rose, morning butter, night periwinkle, miss sky, water mint: the jar's note colours, extended), with a
  white stitched edge (the site's dashed tap card), a glossy top rim, a soft plum-tinted shadow, a few tiny
  doodles in the corner (hearts, x o, sparkles, stars, hollow hearts, droplets), and inside: the emoji on a
  soft white halo, its kaomoji in Hiragino Maru Gothic (the rounded face behind the site's M PLUS Rounded),
  and its words in Gaegu Bold (the site's handwriting). ♡ is drawn: the site's heart, glossy red.
- **Kaomoji** (proposed for shared/taps.js): ♡ `(˘︶˘)♡` · 🫂 `(っ´▽`)っ` · 😘 `(˘ ³˘)♥` · ☀️ `(＾▽＾)ノ` ·
  🌙 `(－ω－)zZ` · 🥺 `(｡•︿•｡)` · 💧 `(˘▽˘)っ旦` (旦 is the classic kaomoji teacup). Every glyph checked in
  Hiragino Maru on iOS and macOS (`probe/`): no boxes, no combining marks (the brief's `(っ˘̩╭╮˘̩)っ` set its
  ╭╮ as a huge arc and leans on U+0329, so it's out).
- **Sizes.** Small: four (default), two, or one big one (Edit Widget → Show). Medium: a "to Josh ♡" header
  and four tall buttons. Large: "to Josh ♡" in Parisienne, the ♡ as a wide banner with a trail of hearts,
  then the pairs that belong together: hug & kiss, morning & night, miss & water. Lock Screen: a round
  button (her first pick) or two side by side. Each group of buttons shares one label size, the largest at
  which its longest label fits (measured with CoreText), so a row reads as a set.
- **Edit Widget** (AppIntentConfiguration): Show (four / two / one big one, small only) and First…Fourth
  (any of the seven). The summary only shows what applies to the size; the large has nothing to edit.
- **Tapping.** Each button is a Toggle wired to `SignalsWidgetSendIntent`: a widget toggle flips the instant
  it's touched, before its intent runs, so the button shows "sending…" (dashed pink ring, softened picture)
  at once instead of sitting still for the network. The intent posts /api/widget/tap and remembers the
  outcome; the system reloads the timeline straight after (no network in the timeline at all).
- **Sent.** The button says "sent ♡" in heart red with a pink glow and a little ♡ badge on its picture, the
  kaomoji turns into `(*´▽`*)♡`, the header says "sent to Josh ♡", and three little hearts pop out of the
  picture and float up into the button's corner (insertion transitions with a soft spring, staggered, all
  done in ~1.2 s, under WidgetKit's 2 s cap; nothing free-running). A minute later the next timeline
  entry puts everything back (the hearts fade).
- **Didn't send.** Offline / server: the button says "try again" `(；ω；)` and the header "no connection · tap
  to try again" (tapping it again retries). 429: the server's own "that's a lot of love for one hour ♡".
  401: "open kiriya.love to reconnect ♡" (the app renews the key). Shown for 10 minutes or until a send works.
- **Not set up yet:** the widget looks the same, a washi-taped note says "open kiriya.love ♡ just once, then
  these go straight to Josh", and a tap anywhere opens the app (no Link: small widgets can't hold one).
- **Appearances.** Dark mode: each pastel becomes a deep jewel tone of the same hue on night plum, kaomoji
  glow in their pastel. Tinted / clear Home Screen (accented): colour emoji would become solid white blobs
  (the system keeps only alpha), so each signal has a one-colour icon drawn with cut-outs (a heart; arms
  around a heart; lips; a sun; a moon and star; a pleading face; a drop). StandBy: the tiles stand on their
  own on black. Lock Screen: system backing, icons, one-word labels. Always-On: no flight.

## Log (2026-11-26)
1. Read the brief, the card agents' logs and code, the current widgets, KiriyaShared/KiriyaIntents, the
   widget routes, taps.js, apns.js, chat.js, the site's tokens and chat tap CSS.
2. Research (sources in the final report): APNs sounds (UNNotificationSound: Linear PCM / IMA4 / µLaw / aLaw
   in aiff / wav / caf, < 30 s, bundle or Library/Sounds); no vibration key exists in a push; custom
   vibrations in Settings attach only to system alert types and contacts, and iOS 17.2's "Default Alerts"
   haptic applies to every third-party app at once; Core Haptics stops when the app is suspended (Apple
   staff: no background haptics). WidgetKit: animations max 2 s, built-in transitions only, no Transaction,
   Always-On doesn't animate; buttons and toggles on a locked phone wait for unlock; accented mode keeps
   only alpha.
3. Font probe (`probe/`): kaomoji coverage in Hiragino Maru / Hiragino Sans on iOS 26.3 and macOS; Gaegu
   lacks ♡ ✓ ✦ · … and its ’ is 0.82 em wide (swapped or set in Hiragino Maru by `SignalsWidgetFonts.hand`).
   The simulator runtime has no usable Apple Color Emoji, but its `CoreAddition/AppleColorEmoji-160px.ttc`
   loads by descriptor: the lab (only, `#if SIGNALS_LAB`) uses it, so simulator renders have real emoji.
4. First renders: cute straight away. Fixed: `Link` in a small widget (not allowed; ImageRenderer drew a
   "no" placeholder), medium buttons' emoji not lining up when one label wraps (fixed-height label box,
   centred block), "drink some water" truncated, ♡ in Gaegu falling back thin and oversized.
5. Large header: script "to Josh ♡" stays, the hint on the right swaps for news (a script → Gaegu jump looked
   wrong when the left side changed).
6. Dark mode: pastels at low alpha went muddy (grey-brown hug, olive morning) → explicit jewel tones per
   signal. Tinted mode: icons read well.
7. Label fitting by CoreText measurement, one size per group (no more per-tile shrinking).
8. Sounds and AHAP (see below). Waveform + spectrum checks (`sounds/viz-all.png`): the heartbeat is
   bit-for-bit the same head in all seven (normalised by it, -3 dBFS), tails decay naturally, 3.2 s each.
9. Lock Screen rectangular: "thinki…" truncated → icon over word in each half.
10. Real WidgetKit on the lab simulator: a lab Xcode project (generated, `tools/make_project.rb`) so
    App Intents metadata is extracted; widgets placed on the Home Screen by rewriting SpringBoard's
    IconState.plist. Found and fixed (lab only): the app also compiled the intents under another module
    name and the system resolved the configuration intent from the app's metadata ("Failed to map
    SignalsWidgetConfigurationIntent to a concrete AppIntent type") → same module name for both lab
    targets. **In the real app the Signals intents must live in the widget extension only.**
11. Fonts on the real Home Screen: Gaegu and the kaomoji rendered; after a reinstall the medium/large showed
    blank with "could not decode view: CodablePlatformFont … invalidFont" (archives pointing at fonts in the
    old bundle). Apple's forums report the same for run-time-registered fonts on devices (the renderer
    can't read them); `UIAppFonts` works. → Fonts are now used by PostScript name (`Font.custom`), the
    extension lists them in `UIAppFonts` (integration item), run-time registration stays as a fallback.
12. Colour emoji on the simulator's Home Screen: a font made from a file descriptor doesn't survive
    archiving → the lab extension draws each emoji into an image (`#if SIGNALS_LAB` only).
13. **The sent moment on the real Home Screen.** Recorded the scripted demo widget: WidgetKit animated the
    label push and the crossfades exactly as written, but the hearts that were meant to fly out of the top
    never appeared: a view whose resting place is outside the widget is dropped from the archive, so it has
    nothing to transition. Redesigned: three little hearts pop out of the sent button's picture (spring,
    staggered 0 / 0.12 / 0.22 s) and settle, floating, in that button's corner, where its doodles were
    (down the right edge on the narrow buttons, a diagonal trail on the wide ones); they fade when the
    minute is up.
14. **Real taps** (my own WebDriverAgent build on port 8200, lab simulator only): tapping 🫂 on the real
    medium widget flipped it to "sending…" at once (the Toggle's optimistic state; the system shimmers the
    header), the intent ran (stub), the timeline reloaded to "sent to Josh ♡" with the hearts in the hug
    button, and about a minute later it went back to idle. Tapping 💧 on the real large (the stub fails it)
    showed "sending…" → "try again (；ω；)" and "no connection · tap to try again". Extension footprint while
    rendering: 17 MB (limit ~30 MB), with the lab's emoji drawing included.
15. Server changes checked on a scratch copy (`apnsNotification` / `chatNotification` run with the
    proposed taps.js): every signal gets its title, `kaomoji  note` body, `SignalsWidget-<key>.caf` and
    `tap` in the payload; chat unchanged. KiriyaNotifications changes typecheck (scratch copy + a stub
    for Capacitor's router).

## The buzz she learns (what iOS allows, and what this does)
- A push can't carry a vibration. iOS plays its own alert vibration with every notification (the one set in
  Settings → Sounds & Haptics → Default Alerts → Haptics, shared by every third-party app); recorded custom
  vibrations can only be given to Apple's own alert types and to contacts. Core Haptics stops when the app
  is suspended. So in her pocket the **sound** is the signature, and in her **hand** (app open) the
  heartbeat haptic plays.
- **Sounds** (`tools/make_sounds.py`, standard-library Python, original): every signal begins with the same
  soft heartbeat, two slow "lub-dub"s (~66 bpm) on felt-mallet tones (A4 lub, D5 dub, 22–26 ms raised-cosine
  attacks, no clicks), normalised by that head so it is identical in all seven (-3 dBFS peak). Then a tail
  in D major: ♡ a strummed glass bloom · hug a warm two-voice swell · kiss two pips, the second sliding up
  ("mwah") · morning a rising chord · night a falling lullaby on dim mallets · miss a slow sigh down ·
  water two droplets. 3.2 s, Linear PCM 16-bit mono 44.1 kHz CAF (APNs custom sound format, < 30 s).
  Recommendation: the family (one learnable head, a tail that tells which); if Josh prefers one sound for
  all, use `SignalsWidget-thinking.caf` for every tap.
- **Haptic** (`ForTheApp/SignalsWidget-heartbeat.ahap`, `tools/make_ahap.py`): the same two lub-dubs (soft
  continuous events with smooth intensity curves, low sharpness 0.12–0.18, a gentle transient at each peak),
  then a faint afterglow under the tail. Parses with CHHapticPattern (2.45 s). `ForTheApp/SignalsWidgetHeartbeat`
  plays it with the signal's sound (as a system sound: silent on the ring switch, never vibrates by itself)
  when a tap arrives with the app open; the notification then presents without its own sound.

## Outputs (scratchpad/widgets/signals/)
`overview.png` (the one picture) · `sent-large.gif`, `sent-medium.gif` (recorded from the real Home Screen) ·
`home-screen/` (real WidgetKit screenshots: idle, sent, tap → sending → sent, water → try again) ·
`renders/` (every family × state × appearance, iPhone 11 @2x and 6.7" @3x) + `renders/sheets/` · `sounds/`
(7 .caf, .wav copies, `viz-all.png` waveforms/spectra, `sounds.txt`).

## Lab
- `./lab.sh stills` (macOS renderer: every family × idle/sending/sent/failed × light/dark/tinted/StandBy, iPhone 11
  @2x and 6.7" @3x, plus Lock Screen and extra states, with contact sheets) · `./lab.sh overview` · `./lab.sh scene
  <prefix> [appearance]` · `./lab.sh typecheck` (the widget target: existing files + Signals, arm64-apple-ios17.0).
- `./sim.sh build|install|place|shot|record|live|render|shutdown`: a generated lab Xcode project
  (`tools/make_project.rb`; host app + widget extension, stubbed network: every press "sends" after 0.9 s,
  except 💧 which fails as if offline) on the "Kiriya Signals Widget Lab" simulator only. `place` writes the
  lab widgets into SpringBoard's IconState.plist (simulator shut down).
- `tools/make_sounds.py <out>` · `tools/make_ahap.py <out.ahap>` · `probe/` (font coverage).

## Host integration (not done here: shared files; exact diffs in the final report)
1. `KiriyaWidgets/WidgetsMain.swift`: in the bundle, `ThinkingOfYouWidget()` → `SignalsWidget()`, and delete the
   old `struct ThinkingOfYouWidget` (same kind string, "ThinkingOfYouWidget", so a widget already placed
   becomes the new one). `WidgetViews.swift`: `TapButton` and `ThinkingOfYouView` are then unused (delete).
2. `KiriyaWidgets/KiriyaWidgets-Info.plist`: `UIAppFonts` = `SignalsWidget-Gaegu-Bold.ttf`,
   `SignalsWidget-Parisienne-Regular.ttf` (so WidgetKit's renderer can always find them).
3. `ios/scripts/add-native-targets.rb`: Signals/*.swift + Signals/Fonts → KiriyaWidgets target only;
   ForTheApp/SignalsWidgetHeartbeat.swift + SignalsWidget-heartbeat.ahap → App target; the seven
   `SignalsWidget-<key>.caf` (copy from ForTheApp/Sounds to ios/App/App/Sounds) → App resources.
   Checked on a scratch copy of the project: targets come out as intended.
4. `App/KiriyaNotifications.swift`: `willPresent` plays the heartbeat for taps and drops the system sound;
   optional per-signal "Hug back 🫂" buttons (TAP_<KEY> categories + BACK_<key> actions). Typechecked.
5. Server: shared/taps.js (`kaomoji`, `note`, "a big hug"), server/lib/chat.js (body = kaomoji + note,
   `tap` key), server/push/apns.js (per-signal sound, `tap` in the payload; optional TAP_<KEY> category),
   server/lib/appTestMode.js (same for the test sample). Run on a scratch copy.
