# Kiriya’s lilac world — redesign handoff

Implemented locally, September 14–16, 2026. Preview: **http://localhost:5173**. Development passphrases: `kiriya` for the private world, `admin` for the existing admin desk. No deployment, production-account changes or commit was made.

## Latest: open feed collections, real cosplay picks and a listening queue

- The home page now exposes **Maomao fan art/clips, music fan art/memes, up to six music/news and dress-up finds, upcoming events, and up to six merch products**. Events and merch have their own main-page chapters and navigation anchors. Deeper shelves remain available for the rest of each collection. Maomao companion notes are surfaced alongside the other news, with their own credits.
- **Memes & other nonsense** is a large featured post with next/previous controls and two additional visible posts. Text-only memes get a large handwritten headline and a tinted poster treatment; the old duplicate text panel is gone. News and other text-only cards always show a prominent headline (falling back to the item title). Product cards show actual product artwork when available, product names, price/date facts, links, credit and keep/hide controls.
- **Cosplay root cause:** `CosplaySpread` used the old three reference assets whenever the `three` feed slots were empty, even if relevant cosplay existed elsewhere in the edition. It now selects real `kind: cosplay` entries across published slots/reserves in **Maomao → another Maomao/apothecary or related cosplay → Miku** order. The planner uses the same preference for future editions and no longer fills these slots with illustrations. Missing roles have honest empty states. Her own uploaded photographs remain a separate personal collection.
- Home cosplay photos link to `/world/atelier?collection=…&item=…#cosplay-feed`. The full shelf filters to the relevant collection, moves the chosen look first and highlights it; its photo still opens the full viewer. Collection filter buttons let her explore everything else.
- The music collage and main music section now recommend actual published feed songs, saved songs and the explicitly selected profile song. Next/previous switches the recommendation; tapping Play opens the existing visible player. Recommendations advance once per minute while visible and motion is enabled, pausing for playback, hover or keyboard focus. The old hardcoded Miku art carousel, record-cover fallbacks and authored music-pick query were removed from this section. Each song uses its own thumbnail; unavailable artwork becomes a neutral illustrated record. Public music continues to use only its public selected song and does not request private feeds.
- Verification: **21 feed continuation tests + 3 presentation tests passed**. Browser checks at **320, 390, 720, 820 and 1440px** confirm no horizontal overflow, full-width phone videos/song cards, three correctly ordered cosplay links and filtered viewers, meme navigation/native video playback, cover changes, selected-song player embeds, automatic recommendation rotation and its playback/reduced-motion pauses. Empty feeds, feed errors, missing artwork and public/private query separation were also checked. `npm run build` passed, including the private-string leak check.
- Populated browser checks used isolated admin-preview response fixtures and local media; provider embeds were mocked. They did not publish editions, alter Kiriya's saves, or verify external provider playback availability. The local database currently returns **no published feed revisions**, so its live empty state was checked separately. Evidence: `.data/redesign/feed-open/checks.json`, `empty-checks.json`, screenshots in that folder, `.data/redesign/feed-open-tests.log` and `.data/redesign/feed-open-build.log`. No deployment was made.

## Latest: readable drop sections and bigger phone videos

- Music/video sleeves stack in one full-width column at **720px and below**, including saved songs and daily music drops. Video entries in photo grids span both columns; portrait and landscape clips keep their source aspect ratio with containment rather than cropping. The Maomao carousel gives clips the same treatment. Playback still uses the existing native viewer or music player.
- Daily Maomao, music and dress-up drops, cosplay picks, memes, merch and events now have a shared bordered section with a prominent handwritten heading, icon, tinted header and clear spacing. The lilac/pink palette remains, with a soft mint accent for Maomao and events. Music subgroups have visible titles too.
- Maomao memes and the merch pick now appear in separately named blocks beneath the main carousel. Feed ordering within each displayed group, credits, saves, hide controls and meme navigation stay connected to their existing handlers.
- Browser verification used local portrait/landscape MP4 and feed-response fixtures in an admin preview; it did not create feed editions or alter Kiriya's saved content. At **320, 390, 430, 650, 720, 820 and 1440px**, pages fit without horizontal overflow. Checks confirm full-row phone cards, uncropped portrait video, meme next/previous, native playback with controls, the music player, and named sections on home, music, cosplay, Maomao and merch routes. No browser errors. Local evidence: `.data/redesign/feed-phone/checks.json` and screenshots in that folder. These are Chromium checks, not a physical iPhone test.
- Final `npm run build` passed, including the private-string leak check. Log: `.data/redesign/feed-phone-build.log`.

## Latest: everyday profile and note-jar voice

- Public and private openings now share the same welcome, Parisienne name and full-frame cosplay portrait. The supplied `IMG_5446` appears first for September 16–17 Singapore time; the `maomao-floral` character portrait follows September 18–19, repeating every two days. Original cosplay praise captions rotate every two hours, with pose-specific text matched to its photo. The character portrait carries only its own sixteen captions, written as Maomao complimenting Kiriya; the sleeve-pose set stays with the retired IMG_5445 and does not appear. An explicit admin avatar still overrides the album. Birthday greetings return on September 15 only.
- The note jar now contains **340 rewritten original notes**: direct praise, encouragement, interest-specific affection, teasing and occasional caring tough love. Every saved feeling has fifteen dedicated notes. [Research, source limits, examples and editorial rules](NOTE-JAR-VOICE.md) explain the voice.
- Mood-specific content is restricted to its matching feeling; tough love and stronger teasing need an appropriate mood and battery. Exhausting a compatible pool permits labelled revisits without forcing incompatible notes. Existing saved notes and delivered history retain their original text.
- Profile timing checks confirm live two-hour caption changes and the two-day photo boundary. Earlier responsive checks covered public 320–1440px and private 320–1440px without overflow; shared heading/font and private-door access were checked. Final validation: **11 note-jar tests passed**; `verify:note-jar` passed against an isolated local database with no browser errors (320–1440px, save/reopen/retry, quiet/reduced motion and annual birthday return); `npm run build` passed including the private-string leak check. The portrait also passed reload stability, the next 48-hour return, reduced motion and September 15/16 greeting checks. Logs: `.data/redesign/note-jar-voice-*.log`; profile timing: `.data/redesign/cosplay-profile/timing-checks.json`.

Older sections below describe the earlier redesign and may retain superseded screenshots, copy and asset descriptions.

## Result

The latest pass is a **phone-first birthday scrapbook, led by Strawpage**. The name and main portrait lead the phone opening, with Maomao, a music sleeve, bows, handwriting and a birthday ribbon. The public profile keeps its links, visit counter, music and private door. The private page is a place to linger: a candle, one combined doodle workspace beside five games, character/lore slides, songs, cosplay pictures and saved art. Navigation jumps to these interests in the page; deeper tools remain available.

Gaegu handwriting and small pixel labels replace the previous restrained serif treatment. Local colour emoji, an animated Maomao companion, cursor sparkles, swaying bows, heart/star glints and quiet ambient charms make it more expressive. One motion toggle and the operating system’s reduced-motion preference settle the page. Rora remains the quality benchmark; its code, layouts and artwork were not copied.

The [Strawpage research and design note](STRAWPAGE-RESEARCH.md) records the inspected live pages, source-backed facts, interaction decisions and the user’s latest priorities. The latest supplied floral background now covers the entire site, with a restored daily check-in and subtle personal palettes. Selecting Kiriya’s real avatar already makes it the primary public/private portrait. More images can be added to the ordered collections in `server/content/curation.js`.

### Added in the Strawpage pass

- A birthday opening, moving ribbon, little love note and replayable candle directly on the home page, using the Singapore birthday date. Day-dependent content refreshes if the page stays open past midnight.
- An inline sketchbook with real finger/mouse drawing, colours, undo, private PNG saving and a fresh-page action after saving. The larger sketchbook keeps its brush, eraser, papers, pigment mixer, export and gallery. Unfinished drawings survive private navigation in memory; Keep/Save persists them. Leaving the private world releases unsaved drafts.
- Maomao’s three-round colour club: hints, gentle retry feedback, a completed birthday palette and a working link that takes those colours into the full sketchbook. No score tracking or timer.
- Five Maomao and five Miku picture/lore slides, source links, enlarged viewing and selected-song playback. Rotation pauses on hover, touch, keyboard focus, reduced motion, the global toggle and offscreen/hidden-tab states. Explicit play restarts a focus-paused collection.
- A reactive fan-made Maomao chibi with a birthday hat, moving gaze and tap messages. A bounded mouse trail expires and stops drawing when idle; touch screens and drawing/form controls are excluded.
- Phone-specific portrait placement, single-column reading order, full-width headings and comfortable touch controls. Desktop and tablet expand from that composition.

### Retained and connected

- Actual drawing canvas, undo/redo, eraser, paper choices, pigment mixing, image export, save/upload and enlarged gallery viewing.
- Song links, recording uploads, removal and explicit public starring. One shared visible player persists across private navigation and stops when closed or locked. YouTube remains visible at least 200 × 200 pixels; source links provide a fallback.
- Private cosplay upload, caption, full-size viewing and removal. Existing public photo controls remain in admin.
- Source-linked Maomao/music/cosplay notes, selected drawing/OC prompts, native-dialog galleries and manga spoiler reveals.
- Real authored notes retain their author on the home page. Existing letters and signature remain unchanged. The fan-inspired Maomao letter is labeled as fan writing.
- Permanent Letters navigation, a year-round birthday gift and tap-to-blow/relight candle. September 15 can change birthday copy without gating access.
- Public profile editing, private address preferences, existing admin desk and optional PWA notifications.

### Content, access and delivery repairs

`server/content/collection.js` is the finite allowlist. The existing daily seed and shown-item history select content; public/private page loads do not depend on broad feeds or an AI writer. Old cached bundles are upgraded on read. Ballet, language/pitch practice, timers, herb quizzes, countdowns, generated outfits and planner controls are absent from active routes and published bundles. Historical stored data remains intact; unused old source files are retained.

Pending notification rows are reconciled when frequency/hours/enabled settings change. Delivery rechecks current preferences, scope, day and allowance; superseded callbacks cannot send a reused row at its former time. Messages use safe teasers rather than private text or manga spoilers. The existing QStash/daily mechanisms are reused.

The previous local upload route allowed unauthenticated file reads. Local and production media routes now require authentication unless a file is explicitly selected for the public profile. New production uploads request **private Blob storage**, served through the API with private/no-store headers. Uploaded recordings are private until explicitly starred. Existing public Blob objects, if any exist in a production account, require a separate migration; local tests do not establish that migration.

## Birthday copy and image follow-up

The public greeting, dedication and scrolling ribbon now use the requested birthday wording. Both private birthday cards say **“Happy freaking birthday babyyy!”** with a filled heart, waving letters and a visibly flickering candle. The home and Letters cards share their dashed border and translucent background. Candle blow-out and replay remain available.

Maomao’s fan letter now adapts the supplied affectionate message with lowercase, deliberate typos, dry asides and medicine-jar references. The interpretation draws on the [official character profile](https://kusuriyanohitorigoto.jp/season2/character/) and [Aoi Yuki’s account of her restrained delivery](https://www.anitrendz.com/news/2026/07/23/apothecary-diaries-interview); it remains labeled fan writing.

The lookbook’s **Hatsune Miku** and **The little details** pictures use the two original image URLs supplied by the user, stored locally with full compositions and source links. The saved QA heart is now a solid violet-pink drawing with an outline and small highlights. See the updated [asset register](ASSETS.md) and [heart generation record](../assets/generated/birthday-heart.md).

Follow-up validation: build and private-string leak check passed; all **10 current tests** passed. Chromium checks covered both birthday cards, candle replay, the letter dialog, 320/390/820/1440px layouts, motion controls, reduced motion, exact saved-heart bytes, both new image sources and enlarged viewing. Results and screenshots are in `.data/redesign/birthday-polish/`. These are local checks.

## Maomao companion and extra games follow-up

The private welcome now reads **“A world just for you full of soo much love and all ur faves✨”**. Its birthday wish reads **“That u will keep being unique and speciall just like u always have ben forever!!”**, with a gentle sway and wavy underline on **forever!!**. The wish stays available year-round, alongside any authored personal note. The character portrait caption now says **“Happy birthday miss apothecary💕”**; the local emoji font includes the pink hearts.

Maomao’s existing SVG now has her blue bun ribbon, beaded braids, violet-blue eyes, freckles, crossed collar, sleeve cuffs and skirt details, informed by the [official character reference](https://kusuriyanohitorigoto.jp/season2/character/). Forty original fan remarks cover taps, idle observations, birthdays and music, with shuffled categories that avoid early repeats. She occasionally speaks after 22–40 seconds while visible. Hidden tabs, offscreen placement, typing/drawing focus, reduced motion and the motion toggle pause this chatter; only explicit taps update the screen-reader live announcement. Her bubble and chibi occupy a normal layout row beneath the public/private music card so neither covers its controls.

The existing Colour Club now shares its spot beside the sketchbook with **Memory drawer** (three picture pairs) and **Odd jar** (three visual deduction rounds). Both add Maomao’s reaction to picks, retries, hints and replay. There are no timers; switching game tabs retains progress. Keyboard arrow/Home/End controls and descriptive picture labels are supported. Colour Club still hands the completed palette to the larger sketchbook. The Maomao appreciation collection remains available for the next requested pass.

Validation for this follow-up: all **14 tests passed**, including game-state and nonrepeating-dialogue regressions. `npm run verify:maomao-play` passed in Chromium: both new games through completion/replay, existing palette handoff, keyboard tabs, exact copy and emoji rendering, click/idle/music dialogue, quiet states and public/private layouts at 320, 390, 430, 650, 700, 820, 844 landscape, 1024 and 1440 pixels. There was no horizontal overflow, companion/music overlap or uncaught application error. The provider frame was a browser fixture; these checks do not establish external playback. Screenshots and results are in `.data/redesign/maomao-play/`. `npm run build` and its private-string leak check passed.

## Five-game shelf and expanded companion follow-up

The shelf now has **five games**, with two additions that are easy to learn and grow a little harder:

- **Herb Sequence:** study three pictures, hide the note and enter them in order. Later notes grow to four and five pictures. Undo, another look and replay are available; feedback compares a completed attempt.
- **Lantern Puzzle:** light a three-by-three corridor by toggling a lantern and its immediate neighbors. Three rounds have shortest solutions of three, four and five taps. Undo and a useful next-move hint remain valid after extra taps.
- **Memory Drawer:** starts with four pairs, then offers six pairs using six distinct picture symbols. Both sizes shuffle and replay.
- **Odd Jar:** five visual mysteries, with six jars for the opening round and nine afterward. Clues use labels, stripes, dots, leaf direction and seal shape; later rounds shuffle their order.
- **Colour Club:** fresh target mixtures on replay and a 95% matching threshold. Hints start with a direction; an exact mix becomes available after two checks. Its completed palette still opens in the sketchbook.

There are no timers. All five tabs retain progress, support arrow/Home/End navigation and show Maomao feedback for play, hints and corrections. The two new games add their own contextual remark sets.

The companion library grew from 80 to **140 original remarks** across ten categories, including note-taking. Four new expressions bring the total to **14**: a curious inspection lean, notebook writing, an approving nod and a startled hop. Her existing herb excitement, vial fascination, annoyance, spontaneous chatter and quiet behavior remain connected to the character study. The [research report](MAOMAO-CHARACTER-RESEARCH.md) includes the current library and [updated expression sheet](screenshots/maomao-character-expressions.png).

Validation: all **20 tests** and the full **five-game Chromium verification** passed. Checks cover complete games, mistakes, hints, undo, replay, shuffled difficulties, tab retention, palette handoff, companion context and quiet states. Public/private layouts and all games fit 320–1440px, including tablets and landscape, without horizontal overflow or music-player overlap. The four new pose animations were separately checked in normal, paused and reduced-motion modes. Build and private-string leak check passed. Local results are in `.data/redesign/five-games-*.log`, `.data/redesign/five-games-expressions.json` and `.data/redesign/maomao-play/`.

## Unified “lets doodle<3” workspace

The ring-bound doodle panel beside the games now absorbs the former art spread and separate studio. Its heading is **“lets doodle<3”**. The redundant **“From your imagination”** section is removed from the home page; the doodle and five-game shelf remain side by side above 720px and stack on smaller screens.

The initial panel keeps the bow, paper edges, notebook rings, handwritten labels and simple drawing controls. Extra tools live in fold-open sections:

- **Brush, pencil, translucent marker and textured crayon**, with size and opacity controls; pressure-aware brush strokes and an eraser.
- **Line, box, circle, heart, star and sparkle** shapes, with filled/outline choices and mirrored drawing.
- **Dotty, plain, cream, lilac, lined and night paper**. Paper is included in exported images.
- Existing **Mixbox pigment mixing**, a full palette, arbitrary colour picker and reusable mixed colours. Colour Club sends its reward into this same panel, preserving the current drawing and mounted game state.
- Undo/redo, a clear action that can itself be undone, a confirmed fresh-page action, optional title and art prompts.
- **Keep**, share/download, artwork upload, enlarged viewing, image download and explicit deletion. The optional gallery groups both doodles and uploads by **Singapore calendar date**, with a day filter. Existing saved artwork remains available.

Strokes stay editable in memory during private navigation. Explicit Keep saves the flattened image to the existing private artwork store. Exports redraw the stroke data at 1600px rather than enlarging the display bitmap. The new canvas guards against queued resize callbacks after unmount and leaves the actual drawing surface unrotated for accurate pointer coordinates.

Old `/world/studio` links redirect here and retain incoming palettes; `/world/art` opens the gallery in this workspace. There is one active canvas. These changes reuse the existing storage endpoints without a database migration.

Validation: **22 automated tests passed**, including date boundaries and undoable clear. `npm run verify:doodle` passed brush rendering, shapes, opacity, mirroring, erasing, draft retention, failed-save recovery, real saving/upload/deletion, private-media access, downloads, dated gallery filters, legacy routes and native Chromium touch input. Expanded controls fit **320–1440px**, including tablet and landscape, with no horizontal overflow. `npm run verify:maomao-play` passed all five games and the updated palette handoff. Build and private-string leak checks passed. Browser test artwork was removed afterward; existing artwork was preserved.

Local results: `.data/redesign/unified-doodle/checks.json`, `.data/redesign/unified-doodle-*.log`. Visuals: [combined play desk](screenshots/unified-doodle-desktop.png), [expanded phone tools](screenshots/unified-doodle-phone.png), [dated gallery](screenshots/unified-doodle-gallery.png). Gallery images include explicitly temporary test entries for the date-boundary check.

## Floral background and daily check-in

The [supplied lilac flower image](https://i.pinimg.com/736x/5a/3a/86/5a3a862b1e41d0986e102aa7a26499b3.jpg) is now a local WebP backdrop across public, private, admin and loading surfaces. A translucent wash keeps the flowers visible while preserving text contrast. Character pictures, saved artwork and paint colours retain their original colours.

**How do you feel today?** is available through the **Today** header button and a larger invitation above the private opening. Its four saved choices have deliberately close palettes:

| Choice | Palette |
| --- | --- |
| Femme | Warm mauve |
| Fluid | Blended lilac |
| Masc | Cool violet |
| Just me | Soft grey-lilac |

The energy slider gently adjusts background saturation. Pronouns are independently editable and remembered per presentation. Personal birthday stamps, portrait wording, Maomao’s personal address and the owner’s public footer follow that preference. Mixed sets use neutral wording; references to Maomao and other characters retain their own meaning. Authored letters are preserved.

Saving uses the existing daily moods and settings tables, with no migration. The choice persists across navigation and reloads; a new Singapore calendar day invites a fresh check-in while retaining address preferences. Cancelled edits and failed saves leave the previous theme intact. Locking clears the owner’s theme. Guest visitors see the floral background without requesting private check-in data; the option labels remain behind authenticated API routes.

The implementation uses transactional batches for production Neon HTTP and an interactive transaction for local PGlite. Independent preference updates merge their JSONB entries so changing one presentation does not remove another’s preference.

Validation: **27 automated tests passed**, including daily persistence, independent preferences, validation, neutral copy and the Neon HTTP batch path using its actual Drizzle driver with a mocked transport. Build and private-string leak checks passed. Browser results and current screenshots are recorded in `.data/redesign/background-mood/`; browser save responses are isolated fixtures, while persistence tests use a separate PGlite database. The owner’s saved daily choice was not changed for verification.

`npm run verify:daily-style` passed all four palettes, separate pronoun choices, energy changes, failed-save recovery, Settings synchronization, navigation/reload, daily reset, lock/unlock and guest access. Public/private pages fit 320–1440px, including landscape, with no uncaught application errors. This pass also fixed an existing session-cache issue that left mounted providers showing an unlocked state after locking. `npm run verify:maomao-play` passed all five games, palette handoff, companion reactions and responsive layouts after the theme changes.

Review images: [desktop background](screenshots/daily-style-desktop.png), [phone opening](screenshots/daily-style-phone.png), [phone check-in](screenshots/daily-style-checkin.png), [cool violet palette](screenshots/daily-style-cool-violet.png).

## Cursive name and floating feeling corner

The welcome now breaks before **“full of soo much love and all ur faves”**, followed by a gently animated **(˘ ³˘)♡** emoticon. The birthday wish now says **“been”**. The public/private Kiriya name and small header wordmark use locally hosted **Allura**, with a fine curved underline and floating hearts, a flower and a star around the main name. New animations pause offscreen, in quiet mode and with reduced motion.

The home invitation has become a floating, collapsible **little corner**, also reachable through Today in the header. Its title is exactly **“Whay u feeling like today ;)”**. It opens as a nonmodal popover: the page stays visible, the close control and save action stay accessible while scrolling, Escape dismisses it, and the closed corner moves above the active music player on narrower screens.

The check-in now has three independent parts:

- **Presentation:** Femme, Masc, Fluid and Just me each have a text emoticon and a short explanation. Pronouns remain independently editable.
- **Mood:** Happy 😊, Content 😌, Excited 🤩, Sad 🥺, Angry 😤, Anxious 😰, Overwhelmed 😵‍💫 and Playful 😏. A selected mood gets a specific slang description and a gentle response. Clear allows an unspecified mood.
- **Social battery:** five levels with changing text faces, a filling battery, a draggable thumb, keyboard adjustment and tappable low/full endpoints. Comments range from **“im not in the mood for bs today…”** to **“i could yap all day…”**. Energy gently changes the new decorative animation pace as well as background saturation.

Each emotional mood mixes a small tint into the selected presentation palette: 8% in the main accent, 1–2% in paper colours, and 3% in the background wash. The lilac identity remains visible throughout. Paint colours, character artwork and game targets retain their colours. Presentation controls personal wording; emotional mood does not choose pronouns.

The daily feeling is stored in a dated settings entry alongside the existing daily check-in in one transaction/batch. This preserves existing personal notes, prior days, independent preferences and compatibility with clients that omit the new field. No migration is needed. The daily reset and lock behavior still clear the active theme.

Validation: **28 automated tests passed**, including every mood, independent saved values, explicit clearing, old-client saves, date separation and all three writes through the actual Neon HTTP Drizzle driver with a mocked transport. Build/private-string checks and the five-game/companion browser checks passed. Local results and current review images are in `.data/redesign/feeling-corner/`.

`npm run verify:daily-style` also passed all eight mood tints, colour bounds, emoji font rendering, battery controls, cancelling/retrying saves, Settings synchronization, reloads, Singapore midnight, lock/unlock and guest access. Popover saving and page layouts fit 320–1440px, including landscape; focus restoration, active-player clearance and reduced motion passed with no uncaught application errors. Browser save responses use isolated fixtures; database persistence runs in separate test storage.

Review: [desktop name](screenshots/feeling-corner-desktop.png), [phone opening](screenshots/feeling-corner-phone.png), [floating picker](screenshots/feeling-corner-picker.png), [full-yap battery](screenshots/feeling-corner-energy.png).

### Name and alignment revision

The Kiriya name and header wordmark now use locally hosted **Parisienne**. The private welcome heading, paragraph and supporting description are centered, with the animated emoticon on its own centered line. Extra space below the name keeps its descending strokes clear of the welcome text. Public/private layouts were checked at 320, 390, 820 and 1440px, including the loaded font, alignment and overflow. Build and private-string checks passed.

### Social battery wording revision

The five levels now use the supplied wording, from low to high: **“kindly fuck off”**, **“Im not trynna hear allat”**, **“mmm i could talk”**, **“Feeling good, whatsupp!”** and **“Holly yapping”**. Each has a matching sarcastic paragraph, moving from wanting to be left alone to an extended yap session. The slider’s accessible value uses the same updated label and comment.

## Verification

### Opening order and personal-note design

The birthday stamps and Come play / love-letter links now sit below the birthday wish, with the same order in the phone layout. Checked at 320, 390, 820 and 1440px, with no overflow or browser errors; build/private-string checks passed.

The earlier pocket proposal and four-note preview are superseded by the implemented daily jar below, following Josh’s latest placement and birthday instructions.

### Daily note jar and annual birthday return

The old home birthday-gift block is now **“a little jar, just for u ♡”**, an individual stitched-paper section immediately before the combined games/doodle desk. Its original SVG glass jar holds folded heart notes, with a ribbon and floating charms. Every pull shakes the jar, lifts its lid, sends a note upward and unfolds a handwritten card. Phones bring new notes into view; quiet mode, reduced motion and offscreen state settle the decoration.

The server library contains **280 individually written caring notes** across fourteen families, drawn from the documented art, cosplay, ballet, music, fandom and personality context. Saved emotional mood and social battery influence the next pull. General cards are signed **✦ kiriya.love**; the twenty character cards are clearly labelled Maomao-inspired. No invented shared memories or live AI writing is required.

Pulls have **no daily cap**. The first note of each Singapore day stays available, and private history groups every pull by date with a favourites filter. All 280 notes can be read before any repeat; thereafter pulls continue and returning cards say **“a little favourite, revisited.”** A finite library does not claim infinite unique writing. Concurrent draws and lost-response retries preserve exactly one delivery per request UUID.

**Every September 15**, this same home block restores the birthday message, cake, flickering candle and wish/replay controls above the jar. On September 16 it returns to daily notes, with no year-specific cutoff. The birthday gift in Letters stays available year-round. Existing Singapore date refresh drives the switch.

Reuses private auth, CSRF protection and the existing `kv` store; no migration or external AI service was added. Admin pulls preview without changing Kiriya’s collection. See the [note-jar handoff](NOTE-POCKET.md) for endpoints, context, data and limitations.

Validation: **55 automated tests passed**, including ten note-specific persistence/concurrency/selection cases. `npm run verify:note-jar` passed real private API persistence, favourites/history/reload, lost-response retry, every-pull motion, phone card clearance, 320–1440px layouts, quiet/reduced motion and September 15 returns in 2027/2028, without browser errors. Build and private-string checks passed. Browser verification uses isolated PGlite and local Chromium. Review: [desktop](screenshots/note-jar-desktop.png) and [phone](screenshots/note-jar-phone.png).

### Daily dancing ribbon

The shared public/private ribbon keeps **“a little world for kiriya”** and refreshes its messages **four times a day: midnight, 6am, noon and 6pm in Singapore**. The library has **60 general cute/funny messages plus 96 mood-specific lines**, twelve for each of the eight emotional moods. Saving a feeling in the existing corner immediately selects fitting messages: gentle company for sad/anxious/overwhelmed moods, dry sass for angry/playful ones, and warm or lively lines for content/happy/excited moods. All twelve lines in a mood’s pool are used across its four windows without a same-day repeat (the recurring birthday greeting is the seasonal exception). Presentation and pronouns do not select emotional copy.

**Twelve dancing emoticons and eighteen expressive side faces replace the illustrated SVG characters**. Each message is flanked by a dancer and a reaction. The side faces add side-eye, smug tilts, shrugs and sleepy nods, with fitting question marks, ellipses or little “zZ” accents. Seventeen additional text faces rotate at the end of the strip. Emoticon selections and choreography still change daily.

Messages stay stable within the same time window and saved mood, including after reload. The existing shared clock schedules each six-hour change and catches up when the tab wakes; it still refreshes daily APIs only at midnight. A date check prevents yesterday’s feeling from being used during the midnight refresh. Unsaved/failed check-ins do not change the ribbon. Without a saved feeling or private session, it uses the general copy; saved mood data is never added to the public profile. On September 15 each year, the birthday greeting joins the parade; the permanent title stays.

**Hover and pointer clicks keep the rail moving.** Keyboard-visible focus can pause it for reading. Quiet/reduced motion stops the dances and shows the messages once in a wrapping strip, including on phones; offscreen/hidden states pause motion. The repeated scrolling copy is hidden from screen readers. The existing mood tint still colours the ribbon.

Initial daily-ribbon validation checked deterministic selection across **370 consecutive days**, plus Singapore midnight boundaries. Chromium checks passed same-day reload, live midnight rollover, future birthday return, public/private consistency, the previous hover/focus pause, quiet/reduced/offscreen motion and **320–2560px** layouts with no horizontal overflow or browser errors. Production build/private-string checks passed. Local results: `.data/redesign/daily-ribbon/checks.json`. Review: [daily ribbon](screenshots/daily-ribbon-desktop.png) · [still phone strip](screenshots/daily-ribbon-still-phone.png).

Emoticon follow-up: all twelve faces were visually reviewed across four daily selections, with independently animated text arms, 320–1440px layouts and reduced-motion wrapping checked in Chromium. Build/private-string checks passed. Updated captures use the new emoticons; follow-up results are in `.data/redesign/ribbon-emoticons/checks.json`.

Extra side-face follow-up: daily selection covers all eighteen new expressions, and browser checks confirm matching reaction animations and paired faces around each message. At 320–2560px there is no overflow; quiet mode places the two faces above each message on phones so the wording remains readable. Build/private-string checks passed, with no browser errors. Current captures include the sassy side faces; results are in `.data/redesign/ribbon-sass/checks.json`.

Mood/time follow-up: all eight mood banks, four windows, same-window stability, distinct daily lines, exact Singapore time boundaries and annual birthday inclusion passed selection checks. Chromium verified immediate saved-mood updates, unchanged copy on presentation-only/unsaved/failed changes, reload, clearing, guest fallback, actual movement while hovered/clicked, live six-hour rollover and midnight mood expiry. Responsive/quiet layouts passed at 320–1440px with no browser errors. Build/private-string checks passed. Browser check-in writes used response fixtures, preserving the actual saved feeling. Results: `.data/redesign/ribbon-moods/checks.json`.

### Slightly fuller falling decoration

The site-wide drifting hearts, flowers and sparkles now use nine particles instead of seven, evenly spread across the viewport. Their soft opacity and slow drift remain the same; phone sizing and quiet/reduced-motion controls still apply.

### Smoother Maomao expressions and movement

The shared chibi now has **17 expressions**, adding skeptical side-eye, shy warmth and attentive herb sniffing. Its violet-blue eyes have softer shading and catchlights, the cheeks have diffused blush, and the fringe and facial contours are softer. Existing remarks now select the new expressions where appropriate; two ambient observations accompany the herb-sniffing pose. The library still contains 140 original remarks.

Facial coordinates interpolate over 340 milliseconds without remounting the face or body. A fast second click continues from the current expression. Eyelids close over the iris instead of flattening it; pointer attention moves only the pupils. Gentle breathing, individual braid sway, ribbon movement, sleepy nods and scent strokes accompany the short reactions. Herb excitement and surprise now anticipate and settle, while repeated gestures replay without restarting the breathing and blink cycles.

The shared motion context is in `PlayfulContext.js` to avoid a component import cycle. All mascot instances honor quiet mode, live reduced-motion changes and their own visibility; both CSS accents and JavaScript face interpolation stop. The companion keeps its existing place below the music player.

Validation: **28 automated tests passed**. `npm run verify:maomao-expression` checks intermediate facial shapes, interrupted transitions, stable DOM, uninterrupted blink/breath phases, repeated gestures, all 17 expressions, quiet mode, reduced motion and offscreen stopping. `npm run verify:maomao-play` passed all five games, dialogue/pose matching and responsive layouts from 320–1440px, with no music overlap or browser errors. Production build and private-string leak checks passed. See the updated [expression sheet](screenshots/maomao-character-expressions.png) and [character study](MAOMAO-CHARACTER-RESEARCH.md). Browser verification is in local Chromium; no physical-device result is claimed.

### Character research follow-up

The [Maomao character study](MAOMAO-CHARACTER-RESEARCH.md) records official model/pose references, director and cast interviews, the illustrated expression sheet and all **80 original companion remarks**. The chibi now switches between restrained scrutiny, a hand-to-chin deduction pose, herb-struck delight, specimen-bottle fascination and comic cat annoyance. Blue-violet eyes, nose freckles, colored braid ties, a longer burgundy skirt and a mortar strengthen the everyday apothecary design. Brief pose animations replace a uniform reaction; quiet mode keeps the static expressions readable.

“Show an herb” and “A curious vial” directly trigger fitting reactions. Fast repeated pokes can annoy her; idle speech never does. Game commentary responds to the actual herb/bottle cards, while successful color mixing and jar deductions get restrained approval. The birthday copy and all three games remain in place.

All **15 tests** and `npm run verify:maomao-play` passed, including direct offers, expression matching, rapid-poke irritation, spontaneous speech, quiet states, replay, keyboard tabs and public/private responsive layouts. Local results are in `.data/redesign/maomao-character-*.log` and `.data/redesign/maomao-play/`. The production build and private-string leak check passed.

### Earlier verification

- `npm test`: **4 passing regression tests** using isolated in-memory PGlite. Covers stable/scoped dates, legacy bundle replacement with saved work preserved, daily jobs without external fetches, notification preference/callback behavior and media URL validation.
- `npm run verify:strawpage`: **passed**. Adds phone composition, native Chromium touch drawing, square PNG save, draft retention, the complete colour game and palette handoff, both source-linked slideshows, owner-portrait response fixtures, cursor expiry, hover/focus/offscreen pause, explicit restart and persistent motion controls. No uncaught application errors.
- `npm run build`: **passed**, including the private-string leak check. The PWA build retains its existing `inlineDynamicImports` deprecation warning.
- `npm run verify:redesign`: **passed**. Waits for actual page content before checking/capturing all eight private surfaces at 390, 1440, 320, 820 and 844 landscape widths. No horizontal overflow or uncaught application errors. Checks real unlock, canvas stroke/undo/redo/save, private media denial, artwork and cosplay dialogs, photo upload, manga reveal, provider player persistence/close, recording upload/play/pause/resume/public selection, byte-range reads and lock.
- Birthday and replay checked on **September 15, September 22 and November 4, 2026**, using Singapore date helpers plus controlled browser responses.
- Additional Chromium checks passed for pigment mixing, authored-note attribution, reduced-motion replay, unavailable recording feedback and a failed discovery API. A React audio-event bug found during this pass was repaired by reading media values before scheduling the state update.
- Browser fixtures are temporary: created art/photo/song rows are removed and the prior featured song is restored. The original saved drawing remains.

The final public/private openings were also checked with mounted doodles and lore at 320, 390, 430, 700, 820 and 1440 pixels: no horizontal overflow or uncaught errors. See [responsive checks](strawpage-responsive-checks.json).

Machine-readable browser results: [browser-checks.json](browser-checks.json) and [strawpage-checks.json](strawpage-checks.json). The browser verification script is repeatable against a local development database. It is not a production test. A WebKit smoke check was attempted but the browser could not launch because the host lacks its GTK/GStreamer and related runtime libraries; no Safari-engine or physical iPhone result is claimed.

### Screenshots

Phone-first details: [birthday opening](screenshots/strawpage-phone-home.png), [public identity](screenshots/strawpage-phone-public.png), [doodle](screenshots/strawpage-phone-doodle.png), [colour game](screenshots/strawpage-phone-game.png), [birthday palette](screenshots/strawpage-phone-game-complete.png).

| Surface | Desktop | Phone |
| --- | --- | --- |
| Public | [Opening](screenshots/desktop-public.png) | [Opening](screenshots/strawpage-phone-public.png) |
| Private home | [First view](screenshots/desktop-home.png) · [Full page](screenshots/strawpage-desktop-home-full.png) | [First view](screenshots/strawpage-phone-home.png) |
| Cosplay | [Lookbook](screenshots/desktop-cosplay.png) | [Lookbook](screenshots/phone-cosplay.png) |
| Art | [Sketchbook](screenshots/desktop-art.png) | [Sketchbook](screenshots/phone-art.png) |
| Maomao | [Collection](screenshots/desktop-maomao.png) | [Collection](screenshots/phone-maomao.png) |
| Music | [Collection](screenshots/desktop-music.png) | [Collection](screenshots/phone-music.png) |
| Letters | [Gift](screenshots/desktop-letters.png) | [Gift](screenshots/phone-letters.png) |

Canvas and Settings captures are also in the screenshots folder. Original reconnaissance/captures remain in `.data/redesign/`; supplied references remain in `docs/assets/`. The [asset register](ASSETS.md) records dimensions, crops, source links, credits, reuse status, alt text and spoiler/access designation.

## Owner actions before release

One consolidated list; none blocks reviewing the local redesign:

1. Supply Kiriya’s approved portrait and any additional personal slideshow images. The requested background and two supplied reference pictures are now installed. The avatar field is already wired to the main portrait; slides have explicit image/text/source entries. Add the actual public handles/bio, then Kiriya’s artwork/OCs and costume/process photographs with their captions. No personal avatar was supplied. The saved heart is earlier QA artwork, not a claimed Kiriya original.
2. Add Josh’s final birthday/open-when letters and any actual little notes through the existing admin desk. Select her actual music choices; the three displayed external selections are suggestions, not claimed favorites.
3. Confirm reuse permission or replace the supplied Maomao/floral artwork and SajaLyn process photograph before public release. Preserve the Crypton illustration attribution and noncommercial license conditions. Review video-cover use and ensure uploaded recordings may be hosted. See [ASSETS.md](ASSETS.md).
4. When deployment is separately requested, configure the production passphrases, Neon, **private** Blob store, domain and optional existing push services using [SETUP.md](../SETUP.md). Inspect any preexisting public Blob objects before migrating them.
5. Complete real iPhone Safari/Home Screen checks: software keyboard and safe areas, finger drawing, actual provider/recording playback, native share, install, push permission/delivery and preference changes. Also verify live Neon migrations, private Blob uploads/streaming and signed QStash delivery. These account/device checks were not performed locally.
