Kiriya's Lilac World — Codex Execution Brief

Ready for execution · September 14, 2026 · replaces the design-review draft.

Start here, Codex

The owner is handing you the original build report and this execution brief so you can begin the redesign in the existing repository. Read both documents in full, inspect what has actually been built, then implement and verify the redesign. Do not stop at a plan or ask for another general confirmation to start.

Read the original Pasted markdown(20260914-222445).md build report supplied alongside this file. It may instead be named Original-Build-Report.md. This establishes project history, existing features, personal context, and reported issues.

Read this entire brief. This brief supersedes the report's older design direction and feature scope. The actual checkout establishes current implementation facts; applicable repository instructions and the owner's newer messages still apply.

Read repository instructions, inspect the worktree, run the existing app, and view both public and unlocked states before editing. Use the reported paths in section 12 as leads; discover their current equivalents if they moved.

Open the supplied images and the linked design examples. Collect the assets in section 9, then begin with the public and unlocked openings. Continue through the four interest sections, retained behavior, and visual verification.

The target: a beautiful personal world that feels specifically made for Kiriya. The public profile leans guns.lol: atmospheric imagery, strong identity, music, links, and calm controls. The fully unlocked version mixes both, with Strawpage leading its visual personality: character artwork, her art and cosplay, varied frames, lilac scrapbook materials, and cute details. guns.lol's cleanliness and clarity remain throughout. These are design references, not frameworks to install.

Three jobs: look beautiful even while passively open; offer small, curated discoveries from her interests; make her name, work, choices, songs, and gift the center of the experience.

Four core interests: Maomao / The Apothecary Diaries; Miku-led Vocaloid; her drawing, digital/traditional art and OCs; her cosplay. Fashion supports cosplay and style. Birthday letters, songs, personal links, and useful existing lore delivery remain. Remove the unrelated utility features listed in section 8.

Files and asset access

The original report and this brief are the two reading documents. Also provide Kiriya-Reference-Assets.zip for the exact uploaded images and saved visual references. Extract it beside this Markdown file; its links then resolve under assets/. If it was extracted elsewhere, locate the same filenames in the provided workspace.

Section 9 distinguishes direct HTTPS image files, source pages to inspect, and attached reference files. The direct image URLs can be downloaded by the agent. The original uploads do not have verified public URLs; the archive preserves those exact copies. Relative links refer to files supplied with the task, not internet download endpoints. Do not treat temporary paths from the original chat as paths in your checkout.

Missing personal photographs, original artwork, final song choices, or production credentials do not block the available design work. Inspect what already exists, use clearly identified reference material where appropriate, and report remaining needs together. Never substitute somebody else's work or photograph as Kiriya's. Keep these handoff documents outside publicly served application files.

This assignment is to implement and verify the redesign in the supplied project. Deployment and production-account setup require a separate instruction. No site implementation or repository inspection was performed while preparing this handoff.

1. Expected public and unlocked appearance

Strawpage and guns.lol are visual and interaction references, not two software frameworks to install. Keep the existing application and borrow their strongest qualities. guns.lol's documented background imagery, profile presentation, audio covers, and controls support the public composition. The inspected Strawpages contribute character scale, personal collage, varied frames, and handmade details.

State

What it should look like

What is available

Public / locked

One strong identity composition within a full-window lavender floral scene. Kiriya's name and approved avatar lead; a carefully placed character image, a small Miku music sleeve, and a few accents establish her taste. Text and controls are calm and readable.

Public bio/dedication, configured social links, chosen public music, a few approved previews, and a clear private-door action.

Fully unlocked

The same scene opens into a wider personal space with art, character images, cosplay photographs, illustrated discoveries, songs, and letters. Richer detail surrounds an orderly reading path.

Her private collections, drawing workspace, starred songs, sourced lore, selected prompts/tips, birthday gift, and existing editing controls where permitted.

The public opening

Use the lilac-branch image as the initial background candidate, softened by a plum veil or quiet paper layer where necessary. Keep the identity area substantially calmer than the surrounding imagery. A pearl or translucent lilac profile surface can work; a heavy black rectangle is not required. The existing name treatment can become a deliberate focal point, with a short approved line beneath it.

Place one substantial character image beside or partly behind the profile composition, outside the text area. The softer Maomao portrait is a good first candidate. Let a Miku song sleeve or small illustration make Vocaloid visible too. Do not place every supplied image, every flower texture, and every decorative motif in the first viewport. One small cat/star detail is enough to suggest the more personal world inside.

The public page should be satisfying to leave open: atmospheric artwork, a restrained ambient effect, and music after the visitor chooses to play it. It must remain attractive with sound and motion disabled. Show real public content only; an unavailable personal photo is not an invitation to invent Kiriya's appearance.

Opening her world

After successful unlock, keep the background, typography, name treatment, and player coherent. Expand the composition into an illustrated personal home. The transition can briefly open paper layers or reveal the surrounding collection, but it should not delay access or replay on every navigation.

A proposed first private view combines her name and welcome, one current discovery, a Miku music object, a Maomao image, and a meaningful glimpse of her own art or cosplay. The first substantial section below should give cosplay real photographic space, followed by her sketchbook/art, Maomao collection, and music shelf. This order can change once the actual personal media is inspected; keep all four interests visually significant.

Use readable bookmarks such as Home, Maomao, Music, Art, Cosplay, with Letters/birthday always reachable privately. A single browsable home with sections is preferred; existing deeper routes can host galleries and tools. Tools open when requested. On a phone, use a compact section menu rather than squeezing every label into a tiny navigation strip.

The fully personalized state is a hybrid, with Strawpage in the visual lead and guns.lol providing the clean structure. The difference between the two states is the amount of personal material and decorative detail revealed. Clean spacing, clear controls, coherent colors, and a recognizable identity persist in both.

2. What already exists

The supplied report describes iloveukiriya.com, a standalone project at ~/projects/birthday, built as a gift from Josh for Kiriya. It reports a React/Vite frontend, React Router, TanStack Query, Motion, a Hono API, Drizzle with local PGlite, and planned Neon/Vercel Blob production services. Public /, private /world/*, and admin /admin surfaces already exist. These are report facts, not findings from a current repository inspection.

The report describes approximately 10,500 frontend lines, 3,800 server lines, 18 tables, and 63 endpoints. An earlier scrapbook version was replaced by a cleaner application treatment; its legacy source directory was removed. The current screenshot shows a narrow central feed, broad flat lavender margins, repeated rounded text panels, and a five-item navigation pill. It describes her interests more than it shows them.

The existing implementation is valuable, but its layout is not the design to preserve. Do not treat this as a recolor, add a wallpaper behind the same feed, or surround unchanged panels with stickers. Recompose the public profile, private opening, image scale, navigation, and interest sections.

Existing content worth salvaging

Reported material or behavior

Revised use

32 Maomao facts: 27 anime, 3 manga, 2 novel

Use verified anime items and appropriately marked manga items in illustrated notes. Keep light-novel-only content excluded.

21 Vocaloid lore entries

Keep Miku as the main focus, Rin/Len as supporting favorites, and selected wider Vocaloid material. Pair text with relevant artwork or song sleeves.

22 cosplay tips and 12 character ideas

Keep useful wig, costume, posing, prop, and process material. Handpick character ideas that suit her interests; do not restore a general cosplay-planning dashboard.

20 drawing subjects x 12 twists, plus 14 drawing tips

Reuse selected prompts and Procreate/traditional-art tips. Add explicitly authored OC prompts where appropriate, without a new prompt-generation product.

Greetings, Josh's notes, personal reminders, birthday notes and stickers

Preserve real authored material. Use a short welcome, small notes, a simple surprise object, and the birthday experience.

Date-based selection and previously shown-item history

Reuse stable daily selection and repeat avoidance. No behavioral recommendation system is needed.

Drawing canvas/gallery, songs/starred choices, uploads, letters

Preserve the working behavior and data, with the tools behind the new visual presentation.

Existing job, caching, notification preferences and delivery paths

Retain only what supports the approved content and optional surprises. Reuse existing infrastructure; do not introduce another scheduler or service.

The report's composer already selects deterministically from a day-based seed and tracks recently shown content. That is enough for a finite rotating collection. The new design should use this foundation without restoring eight equally weighted cards, unrelated modules, or a stream of unreviewed internet items.

3. Personal context and identity

Kiriya is the subject of the site. Maomao and Miku represent her interests; neither replaces her identity. Put her name, her work, her costume photographs, her saved songs, and the actual gift ahead of general fandom information.

Confirmed context

Design consequence

Kiriya; birthday September 15; Singapore timezone

Keep the configured spelling consistent. Use Asia/Singapore for birthday and daily selections. Do not invent an age or birth year.

Gift from Josh; signature "Josh <3"

Preserve the actual signature and messages. Do not generate a substitute personal history or final birthday letter.

Maomao is the principal anime interest; no Maomao/Jinshi shipping emphasis

Prefer solo portraits, expressions, case moments, flowers, and character details. Do not center couple compositions.

Has read the manga, but the exact stopping point is unspecified

Use non-spoiler opening artwork and retain spoiler reveal controls. Exclude light-novel-only spoilers.

Miku most important; Rin and Len also liked

Give Miku the strongest recurring Vocaloid presence. Other characters support the collection rather than competing equally.

iPad/Procreate and traditional drawing

Feature finished art, rough work, process and OCs; make the existing canvas easy to open.

Experienced cosplayer: Maomao, Miku, Lynette; wig styling

Cosplay needs substantial photographs and process detail. Avoid treating her as a beginner or burying this interest in a generic tip tile.

Soft/kawaii, sweet goth/jirai kei, street/skater and Y2K/alt fashion

Include selected fabric/accessory/style references inside cosplay. Allow plum/black accents alongside soft lilac.

iPhone is a primary device

Design the phone composition deliberately; use touch-friendly controls and reliable music/drawing fallbacks.

The existing report contains private identity and address preferences. Preserve their access boundaries. Public content, exported public screenshots, metadata and shipped assets must not expose them. Use direct second-person copy in her private world, and keep any retained preferences in quiet authenticated settings.

The feeling of being completely centered comes from attention and ownership: your sketchbook, your costumes, your music, a discovery chosen for your interests, a letter actually written for you. It does not require literal worship language, a throne motif, repetitive praise, a chatbot, or invented claims about how she feels.

4. Applying the supplied images

All five new attachments were visually inspected. Their proposed placements are art-direction decisions. File dimensions describe the supplied copies, not higher-resolution originals.

Reference

Observed qualities

Proposed role

R1 - Maomao dramatic portrait, 1200 x 675

Deep teal hair, pink/green costume, violet-blue eyes, warm dark surroundings, visible Yen123412 marks

A cinematic Maomao feature or wide detail image. Keep it separate from reading text. Preserve visible credits; the marks are a creator/source lead, not verified authorship.

R2 - Maomao floral portrait, 735 x 763

Bright diffuse light, flowers, teal hair, violet eyes and pink costume

Primary framed portrait candidate. Its softness complements lilac paper; preserve the illustration's original color balance.

R3 - Purple winged cat, 735 x 730

Rounded white silhouette, violet linework, stars, butterfly motifs and cloudy texture

Reference for one small recurring companion/sticker and its sparkle language. Do not make it another full-page background or automatically identify it as a canon character.

R4 - Lilac flowering branches, 735 x 719

Low-contrast lavender blossoms, diagonal branches and a paper-like haze

Strongest initial public-background candidate; compose quiet areas behind profile text and controls.

R5 - Purple flower field, 720 x 1080

Dense upright flowers, photographic depth, violet and pale lilac variation

Supporting panel, phone background alternative or lower-page floral edge. Its dense detail needs quieter surfaces beside text.

R4 and R5 provide the environmental palette. R1 and R2 supply expressive focal images. R3 supplies a restrained accessory vocabulary. Use these roles consistently rather than applying one global purple filter to every asset.

The earlier celestial lilac paper screenshot remains a useful material reference. The new images make the direction more concrete: a botanical lavender environment, rich character color, and small soft-edged decorations. These are visual references; they do not establish that any flower is her favorite.

The supplied flower copies are roughly phone-sized. Inspect them at the intended rendered size before using them across a large desktop viewport. A softly treated backdrop can tolerate less detail than a foreground hero. Obtain a larger original where needed; do not conceal poor image quality with excessive blur or claim a sharpened copy restores missing detail.

5. Clean structure with rich artwork

The governing rule is rich imagery, calm structure. Art, photographs and materials provide the detail. Consistent alignment, quiet text areas, predictable controls and a small number of focal points provide the cleanliness.

Starting palette

These values are proposed working colors interpreted from the supplied references; they are not exact pixel samples.

Role

Value

Use

Pearl

#FFF9FD

Highlights and high-contrast reading surfaces

Lilac paper

#F2EBF7

Main light surfaces

Dusty lavender

#D7C5E6

Secondary paper and floral framing

Wisteria

#B49BCF

Decorative borders and middle-depth layers

Amethyst

#806298

Emphasis, subtle depth, selected controls

Deep plum

#493653

Main dark text and framing

Near-black violet

#221C2A

Small alt accents and dark music details

Petal pink

#E6C5D8

Occasional ribbon and affectionate accents

Keep Maomao's green/teal, Miku's recognizable teal or the deliberately selected variant's colors, and Rin/Len's yellow. Match images through their lighting, framing and placement instead of recoloring every character.

Use a limited material family: floral atmosphere, quiet paper or vellum, narrow lace/ribbon, a few taped corners, and reflective music objects. Public view: one profile composition with perhaps two or three small accents. Unlocked view: more varied frames, a few overlaps, and distinct art/cosplay/music spreads. These counts are starting constraints, not a scoring system.

Retain the existing Jacquard wordmark if it remains legible at the chosen size. M PLUS Rounded can serve readable interface text. A single handwriting treatment is enough for short annotations. Avoid stacking decorative fonts or rendering navigation inside a giant collage image.

Composition and responsive behavior

View

Proposed arrangement

Public desktop

Full-window scene; a compact central profile and controlled adjacent image detail. The surrounding background must carry intentional visual content rather than empty flat margins.

Unlocked desktop

Approximately 1080-1200 pixels of composed content on a 1440-pixel viewport. Use a clear two-column opening and varied gallery spreads below.

Tablet

Two columns only where artwork and controls remain comfortable. Collapse complete groups instead of shrinking everything.

Phone

A recomposed vertical scene with readable gutters, one large focal image at a time, occasional two-up photo groups, and accessible music/section controls.

Narrow phone

Reduce overlaps and secondary ornaments. Keep the name, focal images, navigation and controls clear with no horizontal page overflow.

Use normal document flow, Grid and Flexbox for meaningful content. Absolute positioning belongs to bounded decorative layers. Body text sits on quiet surfaces; all interactive objects have an obvious tap target and readable label where needed. Decorative layers never intercept buttons or the drawing canvas.

Miku and Maomao should be recognizable early, but her name remains the strongest identity signal. Once real personal images are available, at least one piece of her work or cosplay should appear early in the unlocked experience. Give cosplay and art comparable visual importance to the character sections.

6. Simple functionality per interest

Interest

Main actions

Small curated discovery

Maomao

Browse/enlarge artwork and scenes; reveal spoiler-marked notes; switch the featured picture

A short sourced character fact, case detail, expression/scene note or costume observation

Miku / Vocaloid

Browse songs; play/pause/change track; open the source; star favorites in her private collection

A song pick with correct producer credit, a short Vocaloid fact, or a selected outfit/illustration note

Art / OCs

Browse her work and process; enlarge a piece; open the existing canvas; draw, undo/redo, save and revisit

A selected drawing prompt, color/composition study, or sourced Procreate/traditional-art tip

Cosplay

Browse her costume photographs, wig/details and process; open a reference beside the finished work

One relevant wig, costume, prop, posing or styling idea with its source

Maomao's collection

Anchor this area with a substantial solo portrait and a few expressions or scene crops. Lore can appear on a small illustrated notebook slip beside the image, with a short source link and spoiler marker. The interaction is browse, reveal and discover; no quiz or medical-teaching module is required.

The official peony and bellflower seasonal illustrations remain source candidates, and the two new portraits define the desired image scale and visual richness. Do not label an illustration as a particular episode, official image, or favorite scene without verifying that identification.

A Maomao-inspired mascot can deliver a brief playful line in an explicitly fan-inspired voice. It should not pretend to be an official character service, a live conversational companion, or a source of personal memories.

Miku's music shelf

Miku should recur throughout the scene, not live only in a tiny music icon. Plan a small collection: one substantial illustration, two or three song/album sleeves, an outfit-reference image, and one or two small accessories. Rin/Len can occupy a supporting mini-spread. A plush-like or chibi accent is optional, not a claim that she owns a particular collectible.

Clicking a sleeve opens its song. Show the actual title, producer/performer credit and playback state. A lore note can connect the picture, costume or song to the day's discovery. Existing songs, starred choices and uploaded recordings take priority over research suggestions. The report's seeded Senbonzakura is an existing starter entry, not proof of her favorite song.

Two concrete research suggestions are Crystal Snow - Aqu3ra feat. Hatsune Miku, connected to SNOW MIKU 2025, and Fondant Step - Heavenz feat. Hatsune Miku, connected to SNOW MIKU 2021. These are candidate additions with verified official credits, not newly asserted personal favorites.

Her sketchbook and OCs

Her own finished work leads. Surround it with rough sketches, expression studies, palettes or process images when supplied. OCs can have a simple name, one main drawing, a few expressions/outfits and a short authored note. Use existing gallery data and captions where possible; do not build an OC database, character builder, social platform or new asset-management system.

A prompt can sit on a paper corner: for example, "Draw your OC with one Maomao-inspired accessory" or "Try a Miku outfit in your OC's silhouette." These are proposed editorial prompts, not facts or claims about an existing character. She can ignore the prompt, choose another, or open the canvas.

Keep Her work and Inspiration visibly distinct. External digital art and character-sheet references should never appear as her creations. The drawing workspace can have a clean conventional toolbar once opened; its gallery entrance still belongs to the lilac world.

Her cosplay lookbook

Cosplay is a major section. Use a large photograph or a deliberate two/three-image sequence before any tips. Suggested groups are Maomao, Miku and Lynette, based on the report, with wig details, costume close-ups, makeup/posing photographs or work-in-progress images where available.

A small reference-and-result view can show a character image beside her actual costume. Place a relevant tip on a sewing label or margin note and offer a link to the full creator tutorial. Supporting fashion imagery can add fabric, accessories and alternate styling without introducing a wardrobe generator or shopping feed.

The report establishes that she has done these cosplays, not that the required photographs have been supplied. Until they are available, use a clearly labeled reference spread and a consolidated missing-photo list. Never insert another cosplayer's photograph as Kiriya.

7. Curated discoveries and existing delivery

Keep the useful lore/content system. Any earlier instruction to disable it wholesale is superseded. Preserve the sourced pools, template-based wording, date selection, shown-item history, caching, authored notes, and existing content-editing paths. Adapt the outputs to the new compositions.

What appears on the page

The private home shows one featured discovery. Each interest section may show one short relevant item alongside its imagery. Existing additional approved items can sit behind "Another little find" or a small collection drawer. Avoid recreating the full Today feed elsewhere.

Use one or two brief sentences by default, a meaningful image where available, a quiet source link, and one action. A Maomao fact belongs beside a Maomao image; a music fact belongs on a song sleeve; a drawing prompt belongs near her sketchbook; a wig idea belongs near cosplay photographs. A picture must actually relate to the note rather than act as arbitrary wallpaper.

Example

Content basis

Presentation

A Maomao case detail

Reuse one existing sourced, spoiler-tagged pool item after verifying its source

Small illustrated notebook slip, with reveal if required

Crystal Snow and its SNOW MIKU 2025 connection

Official festival page credits Aqu3ra feat. Hatsune Miku

Song sleeve, short note and play/source action

An OC accessory study

Clearly authored prompt, not an external factual claim

Paper corner beside her gallery and an "Open sketchbook" action

A Maomao costume construction detail

SajaLyn's documented wrap-skirt process, including her revision after the overlap proved too narrow

Detail image and a concise note linking to the maker's process

A personal note from Josh

Existing or newly supplied authored text

Small envelope or margin note; preserve exact authorship

Selection stays understandable

Choose only from a finite, approved collection in the four interest areas. Rotate by date or a straightforward sequence and reuse the existing repeat-avoidance mechanism. The image at the top does not need to change on every refresh. Selecting another image or note is a local browsing action, not a signal for a learning system.

Here, approved means source-checked and deliberately included in the collection, including the reusable existing pools. Daily picks and optional delivery still happen automatically. Kiriya does not have to curate each visit, and no new approval dashboard is required.

The baseline's broad source gathering, popularity/rating-based song picks and keyword-selected news must not automatically become the redesigned page's content. Existing adapters may support metadata lookup or help the owner find candidate material, but discovery is not approval to display. Prefer specific selected posts, illustrations, songs and tutorials; avoid passing an entire feed through a few keywords and calling the result curated.

Do not add behavioral tracking, inferred taste profiles, embeddings, recommender services, engagement scoring, infinite scrolling, a new scraping pipeline or a new recommendation API. Pinterest is a research and collection source, not a runtime dependency for the page.

Use the existing template writer as the baseline. An already-installed optional AI rephrasing path is not necessary to make the experience work and must never invent facts, memories, preferences or new source material. Do not spend this redesign building or expanding it. Retained content should render with no AI key.

Background behavior

Reuse the existing daily job and cached bundles if they support the approved collection. An image-rich page should appear immediately from available assets and the last usable content, while any refresh happens quietly. Failed external requests must leave the last approved material or a local pool item available.

Do not replace the note she is reading, advance an active gallery unexpectedly, interrupt music, reset navigation, or discard a drawing when a refresh finishes. Apply new daily material at a natural navigation/revisit boundary or through an unobtrusive explicit action. No persistent loading dashboard is needed.

A simple sticker drawer or small daily surprise may remain if already implemented. It should be optional, with no streaks, obligations, points or guilt for missing a day. The page must remain beautiful and useful even when she never opens the surprise.

Optional notifications

Salvage existing opt-in surprises where they already support the intended gift. Keep actual preferences, allowed hours and delivery controls; do not silently subscribe her, turn a disabled setting back on, or impose a new notification count. The core experience is complete without notifications.

Only approved, in-scope material or real authored notes may be delivered. Keep spoiler/private content out of lock-screen text. A notification should lead to the corresponding discovery or letter after the correct access check. Reconcile preference changes with today's pending deliveries and prevent disabled/off-scope items from being sent.

This is a reuse-and-repair requirement, not a new scheduling project. The report did not verify real iPhone delivery or production scheduling. Carry those limits forward and test the existing path when the necessary environment is available.

8. Keep, change and remove

Existing area

Required outcome

Public profile, social links, unlock

Retain behavior; redesign into the clean atmospheric opening.

Today/private home

Replace the feed layout with the personal world; retain its useful curated content behind the new presentation.

Maomao facts, Vocaloid lore, selected song picks

Keep, source-check and place beside relevant imagery.

Drawing prompts and art tips

Keep selected material as optional sketchbook discoveries.

Cosplay tips and ideas

Keep useful curated items; lead with actual photos and process.

Drawing canvas, color mixing, save/gallery

Preserve working behavior and stored work; reveal controls when opened.

Song library, stars, providers, recordings

Preserve and connect to the illustrated music shelf.

Cosplay budgets, deadlines, progress and checklists

Remove from the active experience; preserve stored data.

Fashion/saved looks

Integrate relevant references into cosplay/style; remove the separate outfit generator and weather dependence.

Ballet, pitch training, dance coaching, practice timers, language lessons

Remove active routes, navigation, generated content and delivery eligibility.

Mood/energy dashboards and check-ins

Remove from the main experience; preserve any necessary private settings without turning them into a daily task.

Real-world herb/poison teaching and quiz

Remove as a utility. Botanical motifs and short series-related lore may remain.

General news, trending/ranked feeds, broad museum-art automation

Remove automatic presentation. Retain only individually selected relevant content.

Episode countdown dashboards

Remove. A verified, relevant announcement can be a curated item rather than a permanent countdown feature.

Birthday cake, letters, real personal notes

Keep, visually integrate and make reachable throughout the year.

PWA, existing content job, optional push, settings/admin

Reuse only what supports this experience; no new platform/service required.

Guestbook, public submissions, social scoring, visitor tracking, Discord presence

Do not add as part of this redesign. Public profile links remain sufficient.

Scope pruning includes navigation, routes/imports where separable, content pools, prompt inputs, old cached visible payloads, source selection and queued deliveries. Hiding a card alone is insufficient. Preserve stored drawings, photos, letters and collections; do not drop tables or wipe the database to simplify the design.

9. Pinterest and source research

The selected references establish composition, subjects and collection directions. They are not all production-ready assets. Pinterest metadata and repost captions are leads; record the original creator/source wherever possible. Page-specific visual observations below are distinguished from entries known only through indexed text or board listings.

Direct image downloads

The following five URLs returned image files on September 14, 2026; their dimensions were checked. They are concrete download links, not search-result URLs. Keep the source page and status with each file. Download into the project at build time only where appropriate; do not make Pinterest or these external hosts runtime requirements. A working URL alone does not establish reuse permission.

Asset and proposed local filename

Direct image file

Source / status

Intended role

Miku original · miku-original.jpg · 600 × 600

Download Miku JPG

Crypton original-illustration terms; specified CC BY-NC 3.0 illustration, with required attribution

A recognizable Miku illustration for an appropriately sized frame, music object, or detail; not a large high-resolution wallpaper

Rin original · rin-original.jpg · 600 × 600

Download Rin JPG

Same illustration-specific Crypton terms

Supporting Vocaloid collection

Len original · len-original.jpg · 600 × 600

Download Len JPG

Same illustration-specific Crypton terms

Supporting Vocaloid collection

Pastel Miku · miku-pastel-reference.jpg · 736 × 966

Download pastel Miku reference JPG

Pinterest pin; points toward 9999mme, original-post attribution/use status unconfirmed

Lavender/pearl character-art direction. Reference use until its reuse status is established

Cosplay garment process · sajalyn-garment-reference.jpg · 1333 × 2000

Download garment reference JPG

SajaLyn's original article; externally authored photo, production use unconfirmed

Construction/process inspiration and a source-linked discovery. This is not Kiriya's costume; the article also includes Ah Duo material

For the three Crypton originals, follow the linked page's exact character-specific credit and license instructions; note adaptations where applicable. Those terms do not extend to other fan art, event visuals, songs or videos. Use original image colors and retain credits. Do not turn one small Miku JPEG into repeated copies filling every visual slot: collect a coherent mix of illustrations, sleeves and outfit details from the sources below.

Exact supplied references and saved copies

Extract Kiriya-Reference-Assets.zip beside this brief. These are relative file links into that archive. No public URL for an exact uploaded image is claimed. Its assets/ASSET-MAP.csv also maps the descriptive names back to the original attachment filenames and source pages.

Reference

Exact file

Placement / status

R1: dramatic Maomao

R1-maomao-dramatic.png

Wide Maomao feature; retain visible Yen123412 marks; exact original source unverified

R2: floral Maomao

R2-maomao-floral.png

Main framed portrait candidate

R3: purple winged cat

R3-purple-winged-cat.png

Small companion/accessory reference

R4: lilac branches

R4-lilac-branches.png

Primary floral environment candidate

R5: purple flowers

R5-purple-flowers.png

Supporting floral edge or phone background candidate

Existing site

baseline-site.png

Historical screenshot to understand the visual problem; also inspect the live local baseline

Original lilac mood

initial-lilac-reference.png

Etsy listing screenshot; material/color reference, not a production texture

The five R-images are the owner's selected visual references. Preserve them while developing the composition; check origin/use status before choosing third-party imagery for a public release. Do not strip watermarks or silently substitute an unrelated image because it shares the color purple.

Saved research views, for inspection if a website is unavailable:

Strawpage composition: Skyburial, Atissamun.

guns.lol identity/atmosphere: official-profile screenshot.

Miku mood: pastel Miku, SNOW MIKU 2025 page screenshot. The event screenshot is a design reference; the site restricts image/video reuse.

Cosplay process: SajaLyn garment detail.

Original-character backups: Miku, Rin, Len.

Asset filename/source map.

Source-page links for collecting more images

These are pages to inspect, not raw image downloads. Follow the original image or creator link on the page; do not save HTML as a JPEG, guess a hidden asset path, or call a repost official. If a source is blocked, use an available reference copy or another linked source and continue the redesign.

Collection

Start here

What to collect

Maomao official illustrations

Seasonal gallery, peony illustration page, bellflower illustration page

Solo-Maomao-friendly imagery, expressions and botanical compositions; inspect actual wallpaper links, credits, spoilers and permitted use

Miku art and costume direction

SNOW MIKU 2025 special page, SNOW MIKU 2021 special page, Purple Ageha pin

Coordinated character, costume and song references. Keep the 2025 event art as reference unless separately permitted

Digital art

Loish: lucid dream, pink leaves, dynamic poses

Artist-attributed inspiration for silhouettes, framing and studies; not substitute entries in her own art gallery

OC presentation

Heartmush / Velvet reference pin

How to present a main drawing, expressions and outfits; use Kiriya's own character images for her OC spread

Cosplay photography

Miku cosplay board, pink/white costume candidate, SajaLyn Maomao pin

Credited external reference photographs and posing/costume direction; her photographs lead the finished lookbook

Cosplay process

Miku DIY collection, SajaLyn's article, Apothecary costume archive

Specific wig, sewing, prop or styling references for the finite discovery pool

Concrete song links

Preserve the actual library and her starred choices first. These two researched examples can support Miku discoveries; they are not asserted personal favorites. The embed URLs below were linked from the official event pages. Playback in the redesigned app still needs to be verified.

Track

Playback link

Source and use

Crystal Snow — Aqu3ra feat. Hatsune Miku

Official-page YouTube embed

SNOW MIKU 2025 theme-song page; use a supported visible player or link out

Fondant Step — Heavenz feat. Hatsune Miku

Official-page YouTube embed

SNOW MIKU 2021 theme-song page; use a supported visible player or link out

Do not download or extract these tracks as background MP3s. The music object can open the supported player. Apply section 11's explicit-play and single-active-player behavior.

Pinterest shortlist

Reference

What it contributes

Evidence / use

Pastel Miku illustration

Lavender-blue linework, pearly highlights and a close character portrait

Visually inspected; the pin links toward a post by 9999mme. Strong music/art mood reference. Original-post authorship and reuse conditions still need confirmation.

Miku Purple Ageha

Purple/black costume contrast and an alt outfit silhouette

Visually inspected. Useful as an optional outfit/cosplay reference; less suited to the soft main hero.

Maomao floral illustration

A floral Maomao art discovery lead

Indexed title/description only. Inspect the exact image and creator before assigning a crop or calling it official.

Maomao live-wallpaper lead

A possible trail from the visible Yen123412 mark on supplied R1

Indexed metadata includes the same handle. An exact artwork/animation match is not established.

Heartmush character reference

A character sheet with outfit, views, expressions and annotations

Visually inspected; the pin links to a Heartmush post. Borrow the presentation idea for Kiriya's own OCs, not the character identity.

SajaLyn Maomao cosplay

A maker's finished-costume/process post

Pin text, video surface and creator link inspected. Its creator website provides a stronger process source; do not describe the unreviewed video as a fully inspected photo shoot.

Hatsune Miku cosplay board

Costume silhouettes, pastel variants and photography directions

Public board listing inspected; individual attribution varies. Research lead for the lookbook, not an approved image feed.

Miku cosplay DIY collection

Wig, sleeve, headphone and outfit-reference leads

Indexed page inspected. Select and trace individual creator tutorials; ignore marketplace ads and automatically related items.

The Miku cosplay board exposed specific candidate pins, including a pink/white outfit photograph at https://www.pinterest.com/pin/565061084496367634/ and a cosplay roundup at https://www.pinterest.com/pin/565061084496367737/. Their board labels were observed; the individual detail pages were not verified. They are further collection leads, not approved photographs.

Original and official sources

Source

Useful material

Decision

SNOW MIKU 2025

tokki's crystalline main visual, clear decorative hierarchy, coordinated character/costume/song material

Visually inspected. Strong Miku mood/composition reference; use the official credits. The site explicitly restricts image/video reuse, so this is reference material unless separately permitted.

SNOW MIKU 2021

Illumination-themed Miku direction; necömi credited for the main visual; Fondant Step by Heavenz

Official text and credits verified. Additional art/song collection direction, not a claim about Kiriya's favorites.

Crypton: For Creators

Specified original Miku/Rin/Len illustrations with stated reuse conditions

A concrete starting source for usable character imagery. Its listed license does not cover every fan illustration, song or event visual.

Loish: lucid dream and pink leaves

Digital painting with strong silhouette, flowing forms, botanical framing and controlled focal areas

Visually inspected as inspiration examples. These are Lois van Baarle's works, not Kiriya's art or known favorites.

Loish: dynamic poses

A named study reference for the sketchbook/process area

Official portfolio entry verified; useful as a source link for selected art-study content.

SajaLyn: Maomao wrap-skirt process

Maker-authored construction discussion and photographs

Concrete source for a relevant costume/process discovery, with a link to the full explanation.

Cosplay To Print: Apothecary archive

Maomao costume variants and pattern/process topics

Archive verified; the Moon Fairy article itself was not retrieved. Use as a discovery lead without inventing its instructions.

The earlier official Maomao seasonal galleries remain relevant. The Met's public-domain Irises and Roses remain optional botanical studies, but the art area now prioritizes her digital/traditional work and OCs over a generic museum-art rotation. Harajuku fashion research is supporting context, not a separate shopping feature.

Asset collection and handoff

Start with a deliberate collection rather than a large random download: one usable floral environment plus a quiet surface; two or three Maomao images; roughly five to eight Miku-related illustrations/sleeves/details spread across the page; one supporting Rin/Len set; three to six of her artworks/OC/process images; and six to ten cosplay photographs/details when available. These are planning ranges, not a reason to delay a first visual composition.

For every selected asset, keep a short record of filename, source/creator, use permission or status, intended role, dimensions, desktop/phone crop, alt text, spoiler status, and public/private designation. Use existing metadata or a simple file; no new asset-management product is needed. Do not strip watermarks or present reposted art as original material.

The companion asset archive includes supplied images under descriptive filenames and research images marked as references. Read the original report supplied separately. Download verified web assets from the direct links below, and use the archive for exact uploads and offline reference copies. Source pages and screenshots are not production image URLs. Copy approved assets into the actual project, keep private originals outside public paths, and produce responsive derivatives locally.

A research screenshot or borrowed character illustration does not replace missing personal photos. Provide one consolidated list of missing personal images, approved sources, actual song choices and the final letter. Finish the available composition work without inventing those materials.

10. Birthday and personal touches

The birthday gift stays part of her world rather than appearing only during a short date window. Keep the envelope, actual letters and a small cake/candle interaction reachable privately throughout the year. September 15 can add a restrained annual flourish using Singapore time; later delivery must still work.

A tap-to-blow candle interaction is enough. Keep existing microphone behavior only as a separate optional action if it works, with a complete tap fallback. Preserve authored letters and distinguish a fan-inspired Maomao message from Josh's own words. Do not create a new reveal-administration workflow or scheduler.

Let personal gestures appear in specific places: a saved drawing returns to her sketchbook; a starred track stays on her shelf; a note keeps its author; a costume image has her own caption. Avoid generic repeated compliments, fake memories, fabricated likes, or copy that makes the site sound as if it is monitoring her.

11. Motion, audio and passive use

Use a small number of coherent effects: slow floral light or gentle background drift, an occasional star glint, a little cat/sticker reaction, a CD turning while music plays, and an envelope opening when selected. Keep meaningful controls still and predictable. The page should feel alive while she listens or looks around, without demanding interaction.

Entrance/reveal transitions can be brief, about 250-700 ms, with small feedback around 120-240 ms. Those are design starting points. Limit simultaneous ambient motion, pause offscreen work, and avoid full-page parallax, constant confetti, flashing glitter or numerous bouncing characters. Do not add a new 3D/Live2D/video system for this effect.

Honor reduced motion in CSS, the existing Motion code, scrolling and decorative media. Preserve the static flowers, artwork, framing and texture when motion is disabled. If a background video is actually available and appropriate, provide a still fallback and use only one ambient scene at a time. The supplied images are stills, not delivered animation files.

Music requires an explicit playback choice. Offer an unobstructed silent entrance, handle blocked playback, keep one active audio source and show honest play/pause/error states. Existing player behavior should remain stable as she navigates.

Use supported provider embeds or recordings the owner may host. YouTube content must stay in a visible player with adequate controls and its required minimum dimensions; do not hide a video offscreen behind a fake CD. A sleeve can open the player, and closing that playback surface should pause it.

Readable text, visible keyboard focus, descriptive image alternatives and comfortable touch targets matter throughout. Use about 16-pixel body text and roughly 44-pixel primary touch targets as starting points. Dialogs need a clear close action and focus handling. Check safe areas, landscape, the software keyboard and the drawing surface on phones.

Load the opening artwork first, reserve image dimensions, lazy-load lower galleries, and defer the canvas and optional embeds until needed. Public rendering should not wait for private APIs, AI, news fetching or a video. Private content should use a cached approved bundle or local fallback while refreshing quietly.

12. Codex inspection and execution sequence

Begin after reading both documents and inspecting the existing site; no further general start approval is needed. Work in the existing gift project; do not connect it to Rora, migrate frameworks, add a page builder or create production services as part of the redesign.

Read the applicable AGENTS.md, README.md, docs/PLAN.md, docs/SETUP.md, the supplied report, and this revised brief. Check the actual worktree/branch and preserve uncommitted work. Reported paths, service versions and previous verification are starting information, not proof of the current checkout.

Reported area to inspect

What must be established

src/main.jsx, src/public/*, src/world/World.jsx, WorldShell.jsx

Actual routes, public/private shells, width limits and shared presentation

src/styles/tokens.css, base.css, fonts.css

Reusable tokens/type and broad card rules that need replacement

src/world/today/*, studio/*, stage/*, atelier/*, apothecary/*, letters/*

Working behavior, personal data and separable off-scope features

Shared music/player, stickers, mascot and effects

What can be reused without importing a whole retired dashboard

server/content/pools/*, server/engine/pick.js, compose.js, day.js, daily.js, personal.js, writer.js, sources/*

Actual approved pools, shown-item history, cached bundles, provenance, source selection and fallback

server/push/planner.js, web-push code, birthday/time helpers

Opt-in state, pending deliveries, preference changes, spoiler handling and Singapore dates

Auth/upload routes, src/sw.js, scripts/check-leaks.mjs

Public/private boundaries, uploaded media access, caches and public-bundle leaks

Package/lockfiles, asset folders and deployment configuration

Installed dependencies, available images, local startup and actual deployment status

Run the baseline and inspect public, unlocked home, Art, Music, Cosplay, Maomao, Letters and Settings at phone and desktop widths. Capture the present UI. Summarize confirmed facts, reusable behavior, available assets and the keep/change/remove map in a short recon note. Do not assume deleted legacy scrapbook source can be restored.

Establish the actual baseline. Inspect routes, assets, curation and access boundaries; identify existing failures without rebuilding the application.

Compose both visual states. Use real available imagery to build a public opening and unlocked opening at phone and desktop sizes. Inspect screenshots of both for hierarchy and continuity, correct problems, and continue into the remaining sections. This is a visual checkpoint, not a new permission gate.

Build the four interest spreads. Give cosplay and art real scale, place Miku throughout the music/visual system, and connect existing gallery, canvas, playback and letter actions.

Salvage curation selectively. Reuse approved pools and daily selection; replace the old feed presentation; remove unrelated categories and prevent unreviewed live items from becoming visible automatically.

Integrate the gift and optional delivery. Fix year-round access, replay, content eligibility and pending-notification preference handling using existing mechanisms.

Polish and verify. Review crops, spacing, motion, controls, cached fallbacks, retained functionality and access boundaries. Correct concrete failures before expanding testing.

Deliver a reviewable local result. Supply representative screenshots, a concise implementation report, source/asset records, checks performed and one owner-action list. Deployment and production account setup are separate from this design assignment.

A short recon note, one asset register/contact sheet, and one implementation report are sufficient documentation. Avoid creating a large framework of new planning documents or runtime subsystems.

13. Known issues and acceptance checks

The report describes local Chromium and API checks, including drawing/save and mocked AI behavior. It does not establish real iPhone/PWA behavior, real push delivery, production scheduling, Neon migrations, Vercel Blob uploads, microphone flows or TextAlive support. Preserve those distinctions.

Reported issue

Focused response

Letters difficult to reach outside September 15-21; birthday takeover ends September 21

Make gift/letters persistently reachable and the reveal replayable, including after a late delivery.

News filter misses word forms

Do not automatically display or send broad fetched news. Use the approved collection; any retained external-item path needs explicit eligibility and a meaningful check.

Notification setting changes wait until the next day

Reconcile pending deliveries when preferences change and recheck eligibility at send time. Do not replace the scheduler.

Blob URLs are public bearer URLs rather than an authentication boundary

Audit actual private-media exposure. Reuse or repair the existing protected delivery path as needed; do not call private galleries secure solely because their links are hidden.

Stale daily/cache data contains removed topics

Filter or reshape visible legacy payloads and pending deliveries without deleting personal data.

Verify package/API details only where the retained implementation uses them. For example, if the existing Met adapter remains for individually selected artwork, check its paginated-search compatibility against the current official documentation. This does not justify retaining an unrelated art feed.

Acceptance area

Required evidence

Public appearance

A polished identity scene with atmospheric imagery, concise controls, music and links; visibly informed by guns.lol.

Unlocked appearance

A richer personal collage with the same clean hierarchy; visibly informed by Strawpage without recreating the old dashboard.

Actual content

Recognizable Maomao/Miku artwork and a credible art/cosplay collection. Major imagery is not replaced with emoji, empty rectangles or generic badges.

Kiriya at the center

Her name, real work/photos, actual saved choices and authored gift lead. External art and cosplay remain attributed references.

Passive quality

The page is beautiful when left still, with motion disabled, and during quiet listening. No attention-demanding popups or background layout jumps.

Curated engagement

Short sourced lore, selected prompts/tips, stable rotation and optional existing delivery work without ranking, AI or a broad live feed.

Retained actions

Drawing/save/view, gallery browsing, song playback/stars, private access and letters work where retained.

Scope reduction

Removed topics cannot reappear through navigation, cached content, source jobs or queued notifications.

Responsive behavior

Phone and desktop compositions are intentional; text, media controls, overlays and canvas remain usable.

Failures and access

Missing audio, blocked autoplay, source failures and reduced motion leave a coherent page. Public users cannot fetch private material.

Birthday durability

Check September 15, September 22 and a later delivery date in Singapore time; access and replay remain available.

Honest completion

Report missing personal media and unperformed real-device/production checks; do not claim completion from a successful build alone.

Before implementation is accepted, review the public and unlocked first view together, then the cosplay and art spreads. With words temporarily ignored, the images should communicate her interests; with animation disabled, the composition should still feel finished. The design should make the existing useful functionality feel like part of her personal world.

Sources and evidence notes

Research and reference checks were conducted on September 14, 2026. The supplied report is historical build evidence; no current repository inspection or application test was performed for this handoff. Visual observations are limited to the pages or images actually inspected. Pinterest pins, creator pages and source links can change.

Pinterest was researched through indexed results and public pin/board inspection. Some individual detail pages were unavailable to text retrieval; those entries are explicitly marked as leads. Artist destinations observed on pins are attribution trails, not completed provenance or permission verification. The official Maomao gallery's indexed material was available during the earlier research, while live visual inspection met a verification screen; those image candidates still need final inspection. Supplied images and the asset archive do not constitute blanket production-reuse clear