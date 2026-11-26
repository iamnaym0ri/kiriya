# Formal letter card — progress log

The **letter** card for the notification content extension: the keepsake sibling of the little note.
A sealed, gilt-edged envelope → a ceremonious 3.2 s opening → the letter at rest (scrolling inside its
paper when it's long). Sources: `ios/App/KiriyaNotificationContent/FormalLetter/`. Lab: this folder.
Outputs (frames, sheets, MP4s, GIF): `/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/formal-letter/`.

## The design ("cute formal")
Researched wedding-invitation and fine-stationery suites (letterpress, cotton paper with deckled
edges, monogram liners, wax seals with dried flowers tucked under them, gold-foil seals, letters
folded in thirds with the letterhead on the first sheet) and envelope-opening motion. Kept the
site's lilac/plum world and its letter cues (the site's letter envelopes are blush `#ecd0df`, the
Maomao one is night plum; its letter modal sets the body in a book serif with an italic sign-off).

- **Envelope**: heavy blush paper (night plum for Maomao's), a deep pointed flap with a double gilt
  edge, a rounded bottom flap framing the address. Addressed like a formal envelope: the "open when …"
  line (or the title) in Allura script, a small-caps line under it between gilt rules ("for Kiriya",
  the title, or "a birthday letter for Kiriya"). Claret wax seal pressed with a script **K** inside a
  beaded ring, with a sprig of pressed lavender tucked under it. Plum liner with a gilt diamond
  lattice, gold dots and little hearts (shows when the flap opens).
- **Letter**: ivory cotton with an irregular deckle and gilded edge, folded in thirds (soft creases
  stay faintly visible). Letterhead crest: script K in a gilt double oval with a laurel and a rose
  heart. Title in Cormorant SemiBold Italic, "open when …" line, a gilt rule with a heart, the date
  in true small caps (right), salutation in italic, body in Cormorant Medium 19.5/27, closing
  "yours, always —" and the signature in Allura with a small red ❤️, set together on the right.
  Maomao's letters: the site's fan-writing label at the top, "your apothecary —", signed Maomao,
  no added salutation (her own voice).
- **Locked**: the same sealed envelope with a gold-foil date seal ("14 / FEB") stuck on the pocket and
  "opens on 14 February 2027" in small caps under it; a tap gives a small "not yet" shake.
- Fonts (OFL, licences beside them in `Fonts/`): Cormorant Medium / Medium Italic / SemiBold Italic
  (static instances made from the Google Fonts variable files with fontTools, renamed
  `FormalLetterCormorant-*` so nothing can collide), Allura (the site's own script, full
  Google Fonts build, renamed `FormalLetterAllura-Regular`). `tools/rename_font.py` did the renaming.

## How it's built
- **Pure timeline.** `FormalLetterGeometry.pose(time:idle:wiggle:)` returns every piece's place for a
  moment; `FormalLetterScene` draws that pose; `FormalLetterCard` only supplies the clock. Every frame
  can be rendered exactly (`./lab.sh frame …`, `./lab.sh sheet …`).
- **Text laid out with CoreText up front** (`FormalLetterText.swift`), then drawn as resolved SwiftUI
  text at those baselines, on the animated paper and in the scrolling body alike (same function),
  so the hand-off to the live scroll view can't shift a pixel. The paper's height is known before
  drawing, so the card's height comes from a `Layout` (`FormalLetterSizer`) in one pass.
- **Long letters**: `scrollable: true` → the paper takes the card's height and everything under the
  crest scrolls in a window with soft faded edges (a `LazyVStack` of equal 240-pt-ish Canvas strips,
  so a 20,000-character letter only ever draws what's on screen). `scrollable: false` → the paper
  stops with an ellipsis, a gilt rule and "the rest is waiting in the app ❤️". The push's
  `truncated` flag ends any letter with that footer (no sign-off; the ending is in the app).
- **Everything the opening shows is mounted from the start** (hidden faces at 0.2 % opacity, the
  letter folded inside the envelope, the resting/scrolling paper behind everything), and one
  TimelineView drives the card from sealed to rest, so no piece is drawn for the first time
  mid-animation and nothing is rebuilt at rest.

## Log (2026-11-26)
1. Read the note card's log and code (lessons: no colour emoji in this simulator runtime → stills on
   macOS; cold first draw stalls; fonts from the card's own files; one height change; two-stop
   gradients under rotation) and the jar's. Read the site's letters page, schema, routes, Maomao's letter.
2. Research + font specimens (`research/specimen.png`): Gelasio, Spectral, Lora, EB Garamond,
   Cormorant, Crimson Pro, Libre Baskerville, Playfair; scripts Allura, Pinyon, Great Vibes, Italianno.
   Chose Cormorant (wedding-invitation feel, real small caps and old-style figures, full accents/…/—)
   and the site's Allura.
3. First full pass rendered. Found: folded panels showed the whole sheet (a Canvas doesn't clip →
   `.clipped()` per slice).
4. Pass 2: glint washed out the whole seal (a gradient fill pads past its band → each half of the band
   is its own strip); the broken seal's V left a "bat-wing" then "lips" — now the break runs round the
   lower left so only a small chip of wax stays on the pocket and the rest lifts with the flap; the
   ground shadow read as a stripe → soft drop shadow + contact shadow that breathe; crease highlights
   read as seams → fainter, clipped to the sheet; straight quotes → curly quotes and a true ellipsis.
5. A faint line across the background at half height: CoreGraphics seam at a 3-stop gradient's inner
   stop → two-stop background (and the scroll fade mask built from two-stop pieces).
6. Choreography: the letter rose out, then travelled back down → the envelope now goes to wait just
   under the letter's place, the letter rises straight into it, and the empty envelope tucks away
   behind; the flap relaxes to 120° as it does, so its tip never peeks above the folded letter; the
   tuck finishes before the bottom third lands. Flap lifts sooner (the tip springs up 24° as the wax
   lets go) — no dead beat after the tap. Calmer fold perspective.
7. Lavender sprig added, first on the flap (it crossed the gilt edge), then on the pocket with its stem
   under the flap tip and the wax: it stays with the envelope, and its stem shows once the seal lifts.
8. Maomao's night envelope: the sheen was a white haze on the dark paper → per-tone sheen. Locked:
   gold-foil date seal.
9. Simulator ("Kiriya Formal Letter Lab", iPhone 17, iOS 26.3): iOS ImageRenderer frames match macOS
   (only the emoji differ). Live frame log: a ~1 s stall at the first opening and ~50–137 ms at the
   start of each opening and at rest → mounted every piece from the start (see above), one paper view
   throughout (it used to be rebuilt when it came to the front), one TimelineView for all phases.
   After: cold boot, no stall at the opening (one 33–62 ms frame at the tap itself, on this Intel
   simulator), clean 16.7 ms at the hand-off to rest.
10. `simctl io recordVideo --codec h264` froze after a second on this Mac (the app was fine): record
    with the default HEVC codec.
11. Live scrolling (lab drives the UIScrollView): words crowded the crest → window starts lower, 20 pt
    top fade, and nothing sits in the fade at rest (content moves down if it would). Scrolled to the
    end showed 120 pt of blank: a lazy stack sizes unmade strips from made ones and the last strip was
    shorter → every strip is the same whole-point height.
12. Edge cases (`./lab.sh edges 343|393`): emoji-only, Chinese, unbreakable URL/word, over-long title
    (envelope: balanced two lines, ellipsised; letter: three lines), accents/em dash, no heading/no
    signature ("with all my love ❤️"). Fixed: a very long title overflowed the envelope; an empty
    heading left two orphaned gilt rules (now the envelope moves up instead).
13. Widows: a lone word on a paragraph's last line gets company (an emoji beside it doesn't count).
14. Device typecheck of the whole extension target (arm64-apple-ios17.0, Swift 5): no errors, no warnings.
15. Scroll body pinned to the light scheme so its indicator stays dark on the paper in dark mode.
16. Memory (lab app on the simulator, `footprint`): ~32–35 MB dirty for the whole app in every state,
    even scrolling the 20,000-character letter. Reclaimable layer surfaces were ~47 MB while sealed
    because everything was pre-mounted → the scrolling paper is now mounted only at rest (that
    hand-off happens when nothing moves, so its first draw can't show), fold backs are let go once
    flat, and the moving sheet is let go once the scrolling paper takes over: ~30 MB sealed, ~21 MB open.
17. Hand-off parity, measured on the live card with window snapshots just before and after rest:
    the bottom third's words shifted by a fraction of a pixel (the fold slices sat at fractional
    offsets) → paper heights are multiples of 3 and slices overlap by a whole point; the springs'
    last fraction of a degree is eased out so the folds are exactly flat before rest. Now the
    hand-off is pixel-identical (long and medium letters).
18. Reduce Motion (simulator setting, verified from a real screen recording): the sealed card is
    perfectly still; the tap gives a 0.35 s crossfade. The crossfade used to start late on this slow
    simulator (the open scene was built at the tap) → the open scene is mounted, all but
    transparent, under the sealed one, so it starts at once. A locked letter's "not yet" with
    Reduce Motion darkens its date line for a moment instead of shaking.
19. Salutation rules tightened: a short first line is only taken as the letter's own salutation if it
    starts like a greeting ("Dear …", "my love,", "happy birthday babyy ♡") or is an address ending in
    a comma; a first line starting "dear/my/hi/…" inside a paragraph means no salutation is added.
20. Final device typecheck: whole extension target, Swift 5, arm64-apple-ios17.0: clean. The card's
    own files also typecheck clean in Swift 6 mode (lock-guarded caches marked `nonisolated(unsafe)`,
    the hand-written `==` on a View `nonisolated`).

21. VoiceOver strings (`./lab.sh speak <letter>`): sealed = "Open the letter" button with the heading and
    address as its hint; locked = "A sealed letter. It opens on 14 February 2027. …"; open = the whole
    letter in reading order (fan label, title, open-when, date, salutation, body, closing, signature,
    or "The rest is waiting in the app."), joined without doubled punctuation.
22. Final renders (`./lab.sh all`), sheets, MP4s, GIF, overviews; lab simulator shut down.

Heights (maxHeight 700): sealed 319 pt at 343 wide, 346 pt at 393. Open: short 439, birthday 586/559,
no-title 358/346, truncated push 430, Maomao 700/694, medium/open-when/long/20,000-char 700 (scrolling).

## Host integration (not done here — files outside this folder)
1. `ios/scripts/add-native-targets.rb`: add `FormalLetter` to the card list (`%w[Letter Jar FormalLetter]`, or run
   with `CARDS=Letter,Jar,FormalLetter`) so its Swift files and `Fonts/` (4 .ttf + 2 OFL .txt) join the
   KiriyaNotificationContent target. Font and licence filenames are all prefixed `FormalLetter-`.
2. `KiriyaNotificationContent-Info.plist`: add `LETTER` to `UNNotificationExtensionCategory`.
3. `ios/App/App/KiriyaNotifications.swift`: the LETTER category's buttons should open in place —
   an `OPEN_HERE`-style "Open letter 💌" (no `.foreground`), "Send one back ❤️", "Open in app".
4. Server (`server/push/apns.js`): send the letter with the push like a note's `notePayload`, under
   `letter`: `{ id, title, text, from, kind, openWhen, createdAt, unlockAt, truncated }` (trimmed to fit 4 KB).
5. `NoteCardModel`: a `.letter` kind; in `load`, `letter = FormalLetterContent(heading: content.title, payload: info["letter"])`
   (the initializer is in `FormalLetterCard.swift`). For a locked letter (`letter.isLocked()`), don't offer
   "Open letter" (set `[heart, openApp]`). `openEnvelope` for a letter calls `POST /me/letters/:id/open`.
6. `NoteCardView`: `case .letter:` →
   `FormalLetterCard(content: letter, isOpen: model.stage == .open, onTapSealed: { model.openEnvelope() }, scrollable: true, maxHeight: 720 - Self.statusHeight)`
   (it draws its own background and margins; the heart status strip can sit under it as for notes).

## Running it
- `./lab.sh all` · `./lab.sh sheet <letter> <width> [step] [from] [to]` · `./lab.sh frame <letter> <width> <t|sealed@idle|wiggle@s> [scale]`
  · `./lab.sh video|gif <letter> <width>` · `./lab.sh overview <width>` · `./lab.sh edges <width>` · `./lab.sh idle <letter> <width>`
  · `./lab.sh piece seal|flap|flapin|pocket|back|crest` · `./lab.sh report <letter> <width>` · `SCROLLABLE=0 ./lab.sh …`
  Letters: short, medium, openwhen, birthday, maomao, notitle, truncated, long, huge (20,000 chars), locked, and the edges.
- `./sim.sh create|build` · `./sim.sh frames <letter> [seconds]` (frame-gap log) · `SPRING=1 WIDTH=343 ./sim.sh record <letter> <seconds> -autoOpen 2.5 [-autoScroll 7]`
  · `./sim.sh render` (iOS parity frames + cost report) · `./sim.sh reducemotion on|off` · `./sim.sh shutdown`
  — uses only the "Kiriya Formal Letter Lab" simulator.
- `tools/side.sh out.png a.png b.png …` (side-by-side stills), `tools/rename_font.py`.
