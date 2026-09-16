# A little jar, just for u

Implemented September 15–16, 2026 · private feature handoff

**Live locally:** [the note jar](http://localhost:5173/world#note-jar). The earlier four-note pocket prototype is superseded by this mounted feature. No live AI service, paid generation or spoken reading was added.

## Placement and birthday return

Josh’s latest instruction replaces the former home birthday-gift block with the daily jar. It is an individual section **immediately before PlayDesk**, where the cake used to be. The previous proposed position above the Maomao club is superseded.

On **September 15 every year**, the same section becomes a birthday celebration: the existing birthday message, animated “babyyy,” cake, flickering candle and wish/replay interaction return above the jar. Notes remain usable that day. On September 16, the section returns to the everyday jar. This uses the existing Singapore calendar and Today refresh; there is no one-off year check. The separate birthday gift in Letters remains available all year.

## What she sees

- A stitched lilac panel headed **“a little jar, just for u ♡”** with a glass jar, ribbon, folded heart notes and softly moving charms.
- **“pull a little note”**, then **“pull another little note”**. Every pull restarts the jar shake, lid lift, flying envelope and paper unfold. A waiting request disables the button briefly.
- A short handwritten note, visible voice byline, pull date and **“keep this”** heart.
- **“your little collection”** opens all pulls, grouped by Singapore date, with a favourites filter and older-page loading. Selecting an old note reopens its original text.
- The first pull each day is preserved as **“today’s first little note.”** Page visits alone consume nothing; she can keep pulling without a daily limit or streak.
- The mood link opens the existing feeling corner. The next pull uses her latest saved emotional mood and social battery; received cards do not change underneath her.

Desktop pairs jar and paper. Phones stack them and bring a newly pulled or reopened card into view. The main pull target is at least 44px high; keyboard activation, selectable text and one explicit screen-reader announcement work without animation. Quiet mode, reduced motion and offscreen state stop decorative movement.

Review: [desktop](screenshots/note-jar-desktop.png) · [phone](screenshots/note-jar-phone.png). These component captures hide the fixed navigation and feeling launcher only while taking the screenshot; the actual page keeps both controls.

## Personal library

**340 individually written notes**, with unique normalized text and stable content-derived IDs, are kept in `server/content/noteJar.js`. Nineteen families cover interests, direct praise, caring nudges and each of the eight feelings. See [voice research and writing rules](NOTE-JAR-VOICE.md) for the latest rewrite:

| Family | Personal focus |
| --- | --- |
| Art | Digital/traditional drawing, Procreate, imagination and enjoying her own work |
| Cosplay | Completed Maomao, Miku and Lynette looks, wigs and creative decisions |
| Ballet | Dancing, singing, practice and worth independent of performance |
| Music | Miku, Rin, Len, Vocaloid and Global SEKAI enthusiasm |
| Fandom | Her documented favourite worlds and cosplay interests |
| Kindness | Caring, warmth, animals and being appreciated beyond usefulness |
| Humour | Sass, funny observations and affectionate bestie teasing |
| Style | Purple/pink, self-expression, her smile and personal taste |
| Rest | Gentle reminders to pause, eat, drink and let unfinished things wait |
| Sad, anxious, overwhelmed, angry | Fifteen distinct notes per feeling: affection, reassurance, space and specific encouragement |
| Happy, excited, content, playful | Fifteen distinct notes per feeling: celebration, interest, quiet appreciation or sass |
| Tough love | Twenty caring nudges, restricted to lighter moods with sufficient energy |
| Maomao | Twenty original fan notes using restrained approval, herbs, labels and practical care |

The general voice is lowercase bestie, signed **✦ kiriya.love**. Character cards explicitly say **“a Maomao-inspired little note.”** These are not quotations, authored Josh letters or claims of a live conversation with Maomao.

Selection favours relevant emotional tags, gentler families for low battery, and varied recent themes. Presentation does not determine mood or pronouns. Notes use “u/you,” so they do not contradict the independent address settings. Known moods exclude mismatched mood-specific cards; difficult moods exclude the humour and tough-love families; check-in is optional and never required to pull.

### Variety and unlimited pulls

A note is excluded while unread notes compatible with the current mood/battery remain. Changing mood, unsaving or reloading does not discard seen history. After the compatible pool is exhausted, pulls continue through another cycle, with **“a little favourite, revisited”** shown on returning cards. An immediate repeat of the last note is excluded. Only that compatible pool is reset; IDs seen in other moods stay remembered. This replaces the earlier rule that could eventually force a mismatched note just to exhaust all themes.

This fulfils unlimited pulls without claiming a finite library can supply infinitely unique writing. The earlier proposal to stop when the library ran out is superseded. Each delivered snapshot and the permanent seen-ID history are retained, including after favourites change. Adding genuinely new notes supplies new content IDs; ordinary selection prefers unread additions before starting another cycle.

### Context used and its limits

| Source | What informs the library |
| --- | --- |
| [Original handoff](../HANDOFF-REPORT.md), §3 | Josh’s descriptions: kind, caring, sassy, funny, animals trust her; drawing, ballet, singing and experienced cosplay |
| [Original plan](../PLAN.md) | A private gift beyond her birthday, Singapore daily rhythm and second-person wording |
| [Latest feed Q&A](../feeds/PIPELINE.md) | Expanded fandoms, Global SEKAI, Vocaloid roster, completed/wanted cosplays and humour boundaries |
| [Feed foundation](../feeds/FOUNDATION-HANDOFF.md) and [contracts](../feeds/CONTRACTS.md) | Existing private access and clear distinction between site writing and Josh’s letters |
| [Maomao character study](MAOMAO-CHARACTER-RESEARCH.md) | Reserved baseline, practical kindness and intense herb interest; identifiable fan writing |
| `server/content/kiriya.js`, `taste.js`, `voice.js` | Confirmed profile and current voice rules |
| `DailyStyle.jsx` and `server/lib/checkin.js` | Emotional feeling and battery are separate from presentation/address preferences |

The latest feed answers supersede old spoiler/ship restrictions, though these notes do not need plot spoilers. Unknowns remain unknown: no invented shared memories, distinctive drawing techniques, particular finished artworks, insecurities, specific song meanings or personal favourites inferred from a displayed song. Existing test drawings are not evidence about Kiriya’s work. Smile compliments were expressly requested by Josh; appearance jokes remain outside the library.

Further curation can use actual memories, her favourite pieces, nicknames and music connections supplied later. Those missing details do not block the implemented feature. AI assistance is optional future work; the current library and mood selection work without an external provider or transmitting check-ins elsewhere.

## Storage and API

Reuses private sessions, the existing `kv` table, Drizzle, Singapore day helpers and TanStack Query. **No database migration** is needed. Authored letters, doodles, daily drawer content and external feeds remain in their existing stores.

- `notejar:state`: revision, current-cycle IDs, permanent seen IDs, recent themes, last pull and first pull of the current day.
- `notejar:pull:<request UUID>`: immutable delivered text/voice snapshot, day, time, ordinal and revisited status, plus a mutable favourite flag.
- A single SQL statement atomically compares/advances the state revision and inserts the pull. Concurrent requests retry against the new revision. Retrying the same request UUID returns its existing delivery; a lost response does not consume another note.
- History uses ordinal pagination in pages of 24. Favourites do not alter selection or history.

| Endpoint under `/api/me/note-jar` | Behaviour |
| --- | --- |
| `GET /` | Read current card, today’s first card, library size and pull count; consumes nothing |
| `POST /pull` | Validate request UUID and deliver one note; admin role receives a non-consuming preview |
| `GET /history` | Date-ready paginated history, with optional favourites filter |
| `PUT /keep` | Validate ID/boolean and save or unsave; admin previews cannot mutate favourites |

All endpoints inherit private auth and write CSRF protection and send `private, no-store`. Locking denies further private requests and clears the private query cache. Client errors preserve the prior readable card and offer retry. Offline pulls are not promised.

## Validation

- `node --test scripts/test-note-jar.mjs`: **11 passing cases** on isolated PGlite. Covers the 340-note library, all eight moods at low/normal/high battery through pool exhaustion, preservation of seen IDs across mood changes, first-of-day retention, favourites, retired-library snapshots, pagination, concurrent pulls/retries, preview isolation and annual birthdays. The earlier whole-repository run (55 tests) predates this rewrite; no new whole-suite result is claimed.
- `npm run verify:note-jar`: **passed** in local Chromium with an isolated database. Real private API persistence, save/reopen/reload, lost-response retry, repeated animation, quiet/reduced motion, 320–1440px layouts, phone card clearance, birthday return in 2027 and 2028, and private/admin behaviour passed without browser errors.
- `npm run build`: **passed**, including private-string checks. No note-library text is shipped in the browser bundle.

Local logs/results: `.data/redesign/note-jar-*.log` and `.data/redesign/note-jar/checks.json`. These are local browser/database checks, not a deployment or physical iPhone result.
