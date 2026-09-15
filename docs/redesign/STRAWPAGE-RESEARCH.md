# Kiriya’s birthday page: Strawpage research and design decisions

Research and implementation: September 14–15, 2026. This note accompanies the working site at **http://localhost:5173**. The latest user direction takes precedence over the earlier brief’s restrained animation guidance.

## Direction

**Make a personal page she can inhabit.** The opening celebrates Kiriya; further down are things to draw, play, admire, listen to and read. Strawpage leads the visual language. The guns.lol reference contributes identity, a background scene, music, links and clear access controls. Rora remains the workmanship benchmark: intentional composition, responsive grouping, legible type and careful interaction. Its code, images and layouts were not copied. The earlier local inspection is recorded in [RECON.md](RECON.md).

The user’s latest priorities are explicit:

- Phone layout first, followed by desktop and iPad adaptations.
- A cute, expressive birthday page with fonts, emojis, animation and mouse reactions.
- Room to breathe, despite a stronger Strawpage influence.
- A usable sketchbook, small art game, Maomao picture-and-lore collection and Miku music/lore.
- Keep the existing public profile and private functionality.
- Change the background and add her actual portrait and more slideshow pictures in a subsequent asset pass.

An optional game-preference question was offered. With no selection received, the implemented choice is a gentle three-colour matching game with Maomao reactions. That is an implementation judgment, not a claim about her personal preference.

## 1. What the Strawpage references contribute

The official builder presents unconventional, personal, mobile-friendly page creation. More useful than copying its editor was examining actual personal pages: their drawing areas, character arrangements, tiny labels and freedom to vary the visual weight of objects. [Strawpage](https://straw.page/)

Four live pages were inspected in Chromium and captured for research. These are a deliberately small qualitative sample, not a survey of every Strawpage style. External pages can change; the saved captures record the particular visit.

| Primary reference | Observation during this review | Application to Kiriya’s page |
| --- | --- | --- |
| [skyburial](https://skyburial.straw.page/) | A very dense collection of small images and character details; expressive display lettering. | Let fandom and personality be visible immediately. Use a smaller, intentional group of objects around the portrait. |
| [atissamun](https://atissamun.straw.page/) | Mixed handwritten/pixel typography, a drawing canvas and many moving decorative elements. | Make drawing part of the page, use handwritten headings and pixel labels, and let decorations react. |
| [aeriristhetic](https://aeriristhetic.straw.page/) | A more limited image collection with a drawing canvas and a distinct typographic mood. | Personal atmosphere can remain strong with fewer objects. Keep clear reading surfaces around facts and controls. |
| [schaffspage](https://schaffspage.straw.page/) | Retro interface framing, dense image collections and a participatory drawing area. | Borrow the intimacy of a little browser toy, without presenting the whole website as a dashboard. |

Captures: [skyburial](strawpage-references/skyburial.png), [atissamun](strawpage-references/atissamun.png), [aeriristhetic](strawpage-references/aeri.png), [schaffspage](strawpage-references/schaff.png). They are research documents and are not shipped as website artwork.

The drawing/gallery interactions visible on [fishieguy](https://fishieguy.straw.page/) and the fandom/music framing on [skibidimikus](https://skibidimikus.straw.page/) were additional leads. These support making interests participatory: a visitor can leave a mark or spend time with a song. The colour game is an original choice for this gift, rather than a copied game from those pages.

### Synthesis

The useful pattern is **personal objects with small invitations**. A sketchbook invites a doodle; a character picture invites a story; a record invites a listen. A regular card grid with generic labels would lose that feeling. Copying a reference’s full density would also conflict with the user’s request for cleanliness.

The implemented page therefore varies the objects: an arched portrait, a ribbon, a handwritten note, a notebook, a small colour-club frame, tilted character pictures, music sleeves and envelopes. Their spacing and shared lilac/plum palette keep them related. The major reading text stays on quiet surfaces.

## 2. Phone composition comes first

On the private phone opening, the order is birthday greeting, Kiriya’s name, the main portrait, Maomao and the music sleeve, then the longer welcome. The full portrait fits within the checked 390 × 844 opening. The public phone layout puts its portrait directly inside the identity composition, before the bio and private door. This avoids spending the first screen on introductory copy alone.

The sketchbook appears before the colour game in the main page. Mobile section headings use the full available width; links sit underneath instead of forcing headings into narrow columns. Drawing and slideshow controls have room for fingers. The page scrolls naturally, and the main navigation jumps to interests within that same page.

Desktop expands into paired objects: the portrait beside the welcome, notebook beside game, and illustration beside its lore. The tablet arrangement preserves the same order. Detailed routes remain available for existing tools, saved work and editing, but the home page contains the primary ways to linger.

These are design judgments for this project. Strawpage is the reference language, not a layout template or a new runtime dependency.

## 3. Typography, colour and assets

The existing Jacquard name treatment remains the identity anchor. Gaegu adds handwriting to greetings, captions and section titles. Small DotGothic16 labels supply a little pixel texture, and M PLUS Rounded 1c continues to carry ordinary text. Letters retain a comfortable reading face. Gaegu is distributed under the SIL Open Font License. [Gaegu specimen](https://fonts.google.com/specimen/Gaegu), [Gaegu license](https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/OFL.txt)

This is a functional type hierarchy, not a different font for each box. Warm paper, lilac, plum, petal pink and small Miku-teal accents carry the atmosphere. Depth comes from borders, paper edges, framing and modest shadows. Character artwork retains its original colour.

The browser review found missing emoji glyphs on the Linux host. A local 10,308-byte Noto Color Emoji subset now covers the ten decorative emojis used here; a 2,172-byte Japanese subset supplies the five characters used in public captions. Native Apple/Windows emoji faces remain ahead of the fallback. Font requests stay local during use. Licenses are included in `public/fonts/`. [Noto Emoji project and licensing](https://github.com/googlefonts/noto-emoji), [Noto Color Emoji OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notocoloremoji/OFL.txt)

The existing SVG Maomao mascot was extended with teal hair, eye movement and interactive birthday reactions. The bow is code-native SVG. No new generated raster artwork was introduced. The supplied background and character pictures remain for this review; the user has explicitly reserved the replacement background and additional portraits for the next pass. See the [asset register](ASSETS.md) for provenance and reuse status.

## 4. Interest collections: facts paired with pictures

### Maomao

Five slides pair a picture or the page’s fan-made chibi with a brief character note. They cover Maomao’s background, her Japanese voice, Xiaolan, her move into Gyokuyo’s service and the observational premise of the opening mystery. The factual basis comes from the official anime introduction, character descriptions and cast material. The little captions are editorial affection, not canonical dialogue. [Official anime introduction and characters](https://kusuriyanohitorigoto.jp/season1/), [Aoi Yuki’s cast comment](https://kusuriyanohitorigoto.jp/season1/comment/cast1.html)

The slideshow uses introductory anime information. The separate existing discovery collection retains its explicit reveal button for manga notes. No novel-only plot material was added. Chibi quips are presented as the page’s unofficial companion, not as quotations from the series.

### Miku

Five slides connect the existing character illustrations and video covers to short notes about Miku, her initial release, two specific songs and Rin/Len. Crypton’s official profiles support the voice and release details. The two event pages identify the selected theme songs and their producers. [Crypton character profiles](https://piapro.net/intl/en_character.html), [SNOW MIKU 2025 theme song](https://snowmiku.com/2025/special.html), [SNOW MIKU 2021 theme song](https://snowmiku.com/2021/special.html)

“Crystal Snow” opens Aqu3ra’s linked video; “Fondant Step” opens the linked Heavenz song. Each has its own note and cover. They are curated listens, not invented claims about her favourites. Her saved/featured music controls remain intact. Nothing plays until she chooses it, and one visible player continues between private pages.

`server/content/curation.js` holds the ordered slide data. Each item carries its text, image/alt text, credit, source and optional song. The authenticated endpoint only accepts the two known collections. More approved images can be added without rebuilding the component or introducing a scraping feed.

## 5. Motion that supports staying awhile

The page has a moving birthday ribbon, drifting small charms, blinking/bobbing Maomao, swaying bows, heart/star glints, brief game/candle celebrations and a mouse sparkle trail. Maomao’s gaze follows mouse position and a tap changes her expression and little message.

Motion is bounded. The cursor trail has a fixed particle limit and expires quickly; it stops requesting animation frames when empty. Coarse pointers do not get a mouse trail. Drawing canvases and form controls are excluded. Decorative regions pause outside view, and hidden tabs settle. This uses browser animation frames and intersection observation rather than a permanent high-frequency timer. [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

Slides advance every 16 seconds while visible; touching their reading area settles them. The slideshow controls follow the WAI carousel guidance: a visible rotation control, previous/next buttons, one active slide, quiet automatic announcements, hover pause and a persistent stop when keyboard focus enters. Explicit play restarts rotation. The global motion control and the operating system’s reduced-motion setting also stop it. Images and facts remain visible when motion is off. [WAI carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/), [WAI animation guidance](https://www.w3.org/WAI/tutorials/carousels/animations/), [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)

A single toggle stores only a motion preference. Draft drawings stay in private in-memory state during navigation; only Keep/Save writes artwork to the existing authenticated gallery. Leaving the private world releases unfinished drafts. No new behavioural tracking, ranking, streaks, countdown pressure or reminder system was introduced.

## 6. Birthday behaviour and next asset pass

September 15 is evaluated using the existing Singapore calendar. Birthday wording appears in both openings and the ribbon; the private page includes its replayable candle and access to the birthday letters. A page left open over Singapore midnight refreshes its day-dependent content. The gift, sketchbook, game and interests remain accessible after the date.

Her actual portrait is already supported through the existing `avatarUrl`: once supplied and selected, it replaces the main placeholder in both public and private compositions. Responsive tests use an isolated portrait fixture; no fixture was saved as her photo. More slideshow images belong with their matching notes and credits in `curation.js`. The background still uses the supplied `branches.webp`; changing that image is the separately requested next pass.

## Verification and limits

Two complementary browser scripts cover the implementation. `verify:redesign` checks the retained profile, access, artwork, cosplay, songs, letters and settings at five viewport sizes. `verify:strawpage` checks the phone portrait composition, native Chromium touch drawing, draft retention, the complete colour game, palette handoff, both slideshows, source pairing, explicit song playback, cursor expiry and motion controls. Tests remove their temporary saved records. See [browser-checks.json](browser-checks.json) and [strawpage-checks.json](strawpage-checks.json).

Phone screenshots and touch emulation are meaningful local checks, but do not establish physical iPhone Safari behaviour. The host’s WebKit runtime is unavailable, as recorded in [IMPLEMENTATION.md](IMPLEMENTATION.md). Production storage, push delivery and device-only flows remain separate deployment/device validation. Current reference-image reuse status also remains as recorded in the asset register.

## Sources and evidence

Primary visual sources are the official [Strawpage](https://straw.page/) site and the six directly linked personal pages in section 1. Implementation guidance comes from W3C/WAI and MDN; character facts and song credits come from the official anime, Crypton and SNOW MIKU pages linked beside the relevant conclusions. Font licensing comes from the projects’ own repositories. Local evidence comprises the supplied `docs/assets/`, the initial [reconnaissance](RECON.md), the reference captures, the [asset register](ASSETS.md), and repeatable browser checks. Visual choices and the game concept are explicitly this project’s design interpretation.
