# Note-jar card — progress log

Owner: jar-card agent. Scope: `ios/App/KiriyaNotificationContent/Jar/` + `ios/CardLab/Jar/`.
Outputs (frames, MP4s, contact sheets): `/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/jar/`

## How to run the lab
- `ios/CardLab/Jar/build.sh` — compiles `../../App/KiriyaNotificationContent/Jar/*.swift` + `Lab/*.swift` with swiftc for the
  simulator (no Xcode project), bundles the font, installs on the lab's own simulator "Kiriya Jar Lab" (created if missing).
- `build.sh render [scenario,…]` — renders every scenario (see `Lab/JarLabScenarios.swift`) at 343 and 393 pt, 3x, into
  `$OUT/frames/<scenario>/w<width>/f####.png`, writes `$OUT/frames/report.md` (heights, type tier per note), then
  `assemble.sh` makes `$OUT/videos/*.mp4` and `$OUT/sheets/*.png`. `OUT` defaults to the scratchpad path above.
- `build.sh live [autoplay]` — the live JarCard hosted like the extension (natural height → animated platter, action rows);
  record with `xcrun simctl io <udid> recordVideo out.mp4`.
- `tools/pops.sh <frames dir> [fps]` — flags frame-to-frame jumps (CROP=880 to ignore card-height steps).
- `tools/sheet.sh out.png <div> a.png b.png …` — side-by-side stills. `reference/` — the app's jar rendered from its own SVG/CSS.

## Log
- 18:55 Read NoteJar.jsx/.css (the app's jar SVG + animations), NoteCardView, host VC, widget JarDrawing, server noteJar.js.
- 18:58 Reference: `reference/site-jar.html` = verbatim copy of JarArtwork + jar CSS; `reference/capture-site-jar.mjs` renders it
  (Playwright WebKit, paused animations) → `scratchpad/.../reference/` (idle, fresh 1/3, wiggle, 17 pull frames, paper).
  Findings: site jar = mauve/pink glass jar, pink lid with ridges, ribbon + bow, "little bits of love" label (Gaegu),
  8 envelope notes inside (lilac/pink/cream, mauve hearts), 4 charms, red heart badge with count; wiggle rotates the
  lid about its own centre (it slips off the neck slightly — I keep it attached).
- 18:59 Gaegu WOFF → TTF (`tools/woff2ttf.py`), shipped as `JarGaegu-Regular.ttf` (Letter agent ships `Gaegu-Regular.ttf`
  in the same target; distinct filename avoids a duplicate-resource build error). Gaegu has no em dash/é/♡ → CoreText fallback.
- 19:30 First full draft of Jar/: JarArt (paths/colours from NoteJar.jsx + SVG path parser), JarText (Gaegu registration,
  CoreText line layout → exact heights), JarLayout (geometry), JarTimeline (pure story×time → frame), JarScene (Canvas +
  folding paper), JarCard (public API, TimelineView clock, height Layout). Typechecks for arm64-apple-ios17.0 (Swift 5).
  Lab: `Lab/` (JarLab app built with swiftc, no Xcode project), `build.sh` (build/install on own sim "Kiriya Jar Lab",
  `render` / `live` modes), `assemble.sh` (ffmpeg → MP4 + contact sheets).
- 19:25 First renders (sim "Kiriya Jar Lab", iPhone 17 / iOS 26.3). Jar reads as the app's jar. Fixed: label text overflow
  (site's 19px spills; fitted), Gaegu curly-apostrophe gap ("don’ t": U+2019 advance 0.82em → straight quote for Gaegu),
  orphan words in tag/captions (balanced wrapping), creases too heavy, unreadable count on the small jar (badge boost),
  top charms clipped by paper when small, lone side caption (jar + caption now one centred row), paper min-height 196.
  Caption hearts are vector (badge red) — this sim runtime lacks Core/AppleColorEmoji.ttc so emoji draw as boxes in the lab.
- 19:40 Motion pass 1 (60fps sheets): flap receded *away* from viewer → now lifts toward her; dead beat with a big plain
  envelope → unfold starts on arrival, envelope gets a deeper flap + "just for u"; mouth puff clumped → spread; tape
  hearts clipped at top → the seal bursts into hearts as the letter opens; card grew at arrival leaving empty lilac →
  grows when the jar starts settling.
- 19:48 Repeat pull: empty card while a tiny jar popped a tiny note → jar steps up to centre stage, pops, settles back.
  Bigger hop when small; red/lilac twinkles; sequential caption fades (no overlapping words).
- 19:52 tools/pops.sh (consecutive-frame diff spikes): all big spikes = intended card-height steps; found a real pop at the
  Canvas→3D-paper hand-off (inner drop shadows on the envelope's fold/heart) → outline-only shadow matching the paper's.
- 19:55 Live run (TimelineView clock, onChange story, host-like animated platter) recorded with simctl io: works.
  macOS probe of the same CTLineDraw path: colour emoji + fallback glyphs draw upright.
- 20:00 Final polish: "1" in Gaegu reads as "I" → counts spelled out; captions balanced; host withAnimation can't leak
  into the clock-driven card (`.transaction { $0.animation = nil }`, verified live); text cache 120→400 (no thrash).
- 20:08 FINAL: full render at 343/393 (28 MP4s, sheets, stills), live autoplay recording, pops check clean (only the
  intended lid pop and card-height steps). Device typecheck (arm64-apple-ios17.0, Swift 5) OK. Heights: waiting
  311–347 pt; pulled 318–594 pt (600-char note at 343 = 571–594). Key stills + GIF + live MP4 in `$OUT/keys/`.
