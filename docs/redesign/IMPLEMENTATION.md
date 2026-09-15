# Kiriya’s lilac world — redesign handoff

Implemented locally, September 14–15, 2026. Preview: **http://localhost:5173**. Development passphrases: `kiriya` for the private world, `admin` for the existing admin desk. No deployment, production-account changes or commit was made.

## Result

The latest pass is a **phone-first birthday scrapbook, led by Strawpage**. The name and main portrait lead the phone opening, with Maomao, a music sleeve, bows, handwriting and a birthday ribbon. The public profile keeps its links, visit counter, music and private door. The private page is a place to linger: a candle, an inline doodle page, a gentle colour game, character/lore slides, songs, cosplay pictures and saved art. Navigation jumps to these interests in the page; deeper tools remain available.

Gaegu handwriting and small pixel labels replace the previous restrained serif treatment. Local colour emoji, an animated Maomao companion, cursor sparkles, swaying bows, heart/star glints and quiet ambient charms make it more expressive. One motion toggle and the operating system’s reduced-motion preference settle the page. Rora remains the quality benchmark; its code, layouts and artwork were not copied.

The [Strawpage research and design note](STRAWPAGE-RESEARCH.md) records the inspected live pages, source-backed facts, interaction decisions and the user’s latest priorities. The supplied background remains for the next asset pass. Selecting her real avatar already makes it the primary public/private portrait. More images can be added to the ordered collections in `server/content/curation.js`.

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

## Verification

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

1. In the requested next image pass, supply the replacement background, her approved portrait and additional slideshow images. The avatar field is already wired to the main portrait; slides have explicit image/text/source entries. Add the actual public handles/bio, then Kiriya’s artwork/OCs and costume/process photographs with their captions. No personal avatar or cosplay photos were supplied. The saved heart is earlier QA artwork, not a claimed Kiriya original.
2. Add Josh’s final birthday/open-when letters and any actual little notes through the existing admin desk. Select her actual music choices; the three displayed external selections are suggestions, not claimed favorites.
3. Confirm reuse permission or replace the supplied Maomao/floral artwork and SajaLyn process photograph before public release. Preserve the Crypton illustration attribution and noncommercial license conditions. Review video-cover use and ensure uploaded recordings may be hosted. See [ASSETS.md](ASSETS.md).
4. When deployment is separately requested, configure the production passphrases, Neon, **private** Blob store, domain and optional existing push services using [SETUP.md](../SETUP.md). Inspect any preexisting public Blob objects before migrating them.
5. Complete real iPhone Safari/Home Screen checks: software keyboard and safe areas, finger drawing, actual provider/recording playback, native share, install, push permission/delivery and preference changes. Also verify live Neon migrations, private Blob uploads/streaming and signed QStash delivery. These account/device checks were not performed locally.
