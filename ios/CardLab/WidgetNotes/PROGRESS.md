# Little note widget — progress log

The Home Screen / Lock Screen "Little note" widget, redesigned as a note passed to her and taped
down. Sources: `ios/App/KiriyaWidgets/Notes/` (every file and type prefixed `NotesWidget`). Lab: this
folder. Renders: `/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/notes/`.

## The design
Sibling of the little note's and the letter's notification cards (Letter/, FormalLetter/): the same
lilac desk, cream-pink paper, plum ink, Gaegu handwriting, Parisienne signature and pink washi tape,
but its own thing: a page torn from a notepad rather than an envelope.

- **Sealed** (a new note, not opened yet): the note folded shut, its flap held down by a strip of
  washi tape, "for Kiriya" in Josh's script and "open me ♡" on it; on the desk beside it "a new note
  from Josh · just now". Medium and large have it taped to the Home Screen at one corner too.
  **Tapping peels the tape** (an interactive AppIntent, `NotesWidgetPeelIntent`): the note opens right
  there, no app launch, and counts as opened on the server exactly like opening it inside its
  notification. A second tap on the open note opens the app at that note.
- **Open**: the page, torn along the top, ruled, a pink margin line (medium/large), the bottom corner
  curling up, held by a strip of tape. Title in bold Gaegu with a wavy pink underline (or "for Kiriya"
  in script on a large widget with no title), the words on the rules, "— Josh" and a glossy heart,
  and when it came ("just now", "a little while ago", "this morning", "last night", "on Tuesday").
  The handwriting is as big as the note allows: "love you ♡" fills a small widget, a long note steps
  down a size or two and ends with "..." where the widget runs out.
- **A letter came**: its announcement, folded: "a letter for you" + the letter's title; tap opens the letter.
- **Josh's phone** (role admin): his last note to her with a pink rubber stamp, "not opened yet" →
  "she opened it ♡ 9:41 pm" → "she loved it ♡" (her heart reaction), plus her emoji if she reacted with
  one. A test note he sends himself shows as she'd see it, when it's newer.
- **Empty / not set up**: a blank taped page ("no notes yet ♡ / the first one will land right here"),
  with a heart sticker on a large widget. Short notes on a large widget get the sticker too.
- Tape patterns (pink dots, lilac stripes, blush hearts) and the tear along the top are seeded by the
  note's id, so every note looks a little different and the same note never changes.

Looks: light (lilac desk), dark (the paper stays paper, lamp-lit on a night-plum desk with star dots),
tinted/clear (iOS 18/26 accented: outlines and washes, tape and hearts `widgetAccentable`), StandBy
(no desk; the words beside the note turn light), Lock Screen rectangular (system lettering, a tiny
drawn note glyph, the words `privacySensitive`).

## Motion (iOS 17 widget transitions; no code runs while a widget animates)
- **A new note is passed in**: the new folded note pushes in from the right edge as the old page
  slides off to the left (`.push(from: .trailing)`); the words on the desk fade in once it has landed.
- **Peeling**: the folded note dims while the intent runs (`invalidatableContent`), the tape lifts up and
  away, the folded note lets go, the page opens out from where the tape held it and a fresh strip of
  tape is pressed down onto it.
- **Built-in transitions only** (push, offset, scale, opacity, combined/asymmetric). Widgets can't
  interpolate custom `.modifier` transitions: on the lab simulator they fell back to a plain
  cross-fade (log 10). One spring (response 0.78, damping 0.74); the lab's frame modifiers draw
  exactly what those built-ins do, so the GIFs match the device.
- **Two-step timeline for pushes**: a reload on its own may only cross-fade, but a change between two
  entries of one timeline animates with the widget's transitions. So when a push has just handed a
  note over, the timeline is [what was on screen, now] + [the new note, +1.2 s] (log 11).

## The update path ("immediately")
1. NOTE push arrives → the notification service extension calls `NotesWidgetMailbox.receive(userInfo)`
   → the note's words go into the App Group (`notesWidget.latest`) and
   `WidgetCenter.reloadTimelines(ofKind: "LittleNoteWidget")`. The provider shows the pushed note at
   once (no network needed), then merges the snapshot when it arrives (same id → one note).
2. iOS 26: a WidgetKit push (`apns-push-type: widgets`, topic `love.kiriya.app.push-type.widgets`,
   `{"aps":{"content-changed":true}}`) reloads it too, even with notifications off or for notes
   delivered quietly at night; and reaches Josh's widget the moment she opens his note.
   `NotesWidgetPushHandler` is attached on iOS 26 (`.pushHandler`); the token is kept in the App Group and
   uploaded once the server route exists (`NotesWidgetPush.uploads`).
3. Fallbacks: the timeline (every 40 min; 20 min on Josh's phone while his note is unopened), the
   app's own reloads, and the peel/notification marking a note opened locally (`notesWidget.opened`).
4. A note a push just handed over is drawn without any network (it carries every word, up to the
   push's 3,000-byte cut, marked "…" and finished in the app); the snapshot is merged 90 s later.

## Log (2026-11-26)
1. Read the cards' logs and code, the widget target, KiriyaShared, the NSE, apns.js `notePayload`,
   widget.js `appSnapshot`, loveNotes.js `inbox`. Found: `inbox(db, "admin")` returns the notes sent
   **to** the admin (his test notes), never his notes to her, so "she opened it" needs a new
   `sentNote` field (below). Letter announcements and doodle notes are love notes too (kind `update`,
   or a `link`), so the widget handles them.
2. Researched iOS 26 WidgetKit push (Apple: "Updating widgets with WidgetKit push notifications";
   WWDC25 "What's new in widgets"; the SDK here: `WidgetPushHandler`, `WidgetPushInfo.token`,
   `WidgetConfiguration.pushHandler(_:)`, `WidgetCenter.currentPushInfo`, iOS 26.0+). Budgeted like
   reloads, "delivered opportunistically", no fixed numbers published.
3. Fonts: copied the cards' Gaegu Regular/Bold and Parisienne, renamed inside (fontTools,
   `tools/rename_font.py`) to "NotesWidget Hand" / "NotesWidget Script" so they can't collide with the
   other widgets' copies; "Parisienne" is a Reserved Font Name, so the modified copy doesn't use it.
   OFL texts beside them with a note on the change. Registered at runtime (CTFontManager, process scope).
4. First full render pass (`./lab.sh sheet 11`): looked right at once in the large; found every line
   sitting one rule too low (alignment guides inside a ZStack shift the whole stack) → each line is a
   1-pt frame whose top is its baseline. Titles too long for small → step down, then two balanced
   lines ("for after / your exam", never "for after your / exam").
5. Folded note: a flat band read as a stripe → slanted, inset flap edge with a blurred lift shadow,
   deeper flap tone, the seal tape at 72° (it read as a bookmark at 84°), the writing moved below the
   tape's end. Medium/large: a striped corner tape holding the note to the desk.
6. StandBy: plum desk words vanished on black → light ink when the system removes the background.
   Josh's stamp ran into the words → the layout keeps the last two rules for it.
7. Widow rule: a heart or emoji alone on the last line tries the next size down ("sleepyhead ♡");
   an "…" already in the words no longer doubles up as "……".
8. Motion, first GIF: the new note's desk words faded in over the old paper as it left, and during the
   peel the page faded in on top of the folded note (a muddle) → desk words wait 0.34 s; the tape goes
   first and the page follows 0.08 s later, swinging down from its top edge (rotation3D, not a squash),
   while the folded note fades over half the spring.

9. Real widget on the lab simulator ("Kiriya Notes Widget Lab", iPhone 11, iOS 26.3), through the lab's
   own generated Xcode project (lab app + the Notes folder as a widget extension + a lab NSE) and a
   WebDriverAgent built for the simulator (a copy of the Rora tooling's source in the scratchpad; the
   app icon's long-press menu turns it into a widget of any size). Findings:
   - The fonts registered at runtime (CTFontManager, process scope) **do** render on the real Home
     Screen (out of process): no `UIAppFonts` needed.
   - iOS 26 sizes on iPhone 11: large 356×371.5 pt, medium ≈356×166, corner radius 28.3, content
     margins 18.3 (disabled here). The layout adapts to whatever size it gets.
   - `simctl push` doesn't run a service extension on this Intel simulator, so the lab app hands the
     same userInfo to `NotesWidgetMailbox.receive` from the background instead (same code path).
   - A background `reloadTimelines` from the NSE path is "immediate-budgeted": it ran, but the
     provider's network fetch held the new note back (12 s here, on a refused connection) → a note a
     push just handed over is now shown with no network at all, and the server's view is merged
     90 s later; any other fetch gets 4 s before the cached snapshot stands.
   - Interactive peel works (`notesWidget.opened` written ~4 s after the tap on this loaded machine).
     Right after a reinstall the first tap only dimmed the note: the system hadn't registered the
     intent yet (the Mac's load average was 600–900 from other simulators).
10. The first transitions (custom `.modifier`, with turns and a 3D unfold) showed up on the real Home
    Screen as a cross-fade, both for the push reload and for the peel. Apple's "Animating data updates
    in widgets and Live Activities" lists built-in transitions only → rebuilt everything from built-ins
    (push / offset / scale / opacity). After that the peel animated on the simulator (the page opens out
    from the tape) — see `real-home-screen-update.gif`.
11. Two-step timeline for pushes (above): recorded on the simulator, the new folded note now pushes in
    from the right while the old page leaves to the left. `NotesWidgetMailbox` keeps the previous pushed
    note (`notesWidget.previous`) so the provider can rebuild what was on screen.
12. The peel intent now waits at most 1.5 s for the server (the widget shows the dimmed "pending" note
    meanwhile); the provider tells the server later if that didn't land, after handing over its
    timeline, so a slow network never holds the widget.
13. Copy: "tap to peel the tape ♡" on medium and large; when a short note leaves no room beside the
    signature, "a few minutes ago" goes on the line under it, a size smaller.

14. Widows: a lone short word on a paragraph's last line takes the word before it along ("water / for me"),
    seen on the 6.7" large widget. 6.7" sheets (`./lab.sh sheet 67`) otherwise matched the iPhone 11 ones.
15. Checks: the Notes folder with the widget target's files and KiriyaShared typechecks clean against the
    iOS 26.2 SDK (arm64-apple-ios17.0) in Swift 5 and in Swift 6 mode (the intent's statics are `let`);
    the notification service extension with `NotesWidgetMailbox.swift` and the one integration line
    typechecks clean too. Lab simulator shut down; WebDriverAgent stopped.

## Host integration (not done here — files outside this folder)

1. **`ios/App/KiriyaWidgets/WidgetsMain.swift`**: in `KiriyaWidgetsBundle.body`, replace `LittleNoteWidget()` with
   `NotesWidget()` and delete the `struct LittleNoteWidget` (same kind, `"LittleNoteWidget"`, so a placed widget
   carries on). `LittleNoteView` in WidgetViews.swift is then unused and can go.
2. **`ios/scripts/add-native-targets.rb`**, after the KiriyaWidgets sources are added:
   ```ruby
   # The Little note widget (KiriyaWidgets/Notes/): its Swift files, and its fonts + OFL texts as resources.
   notes_dir = File.join(IOS, "App", "KiriyaWidgets", "Notes")
   notes_group = widgets_group.children.find { |g| g.isa == "PBXGroup" && g.display_name == "Notes" } || widgets_group.new_group("Notes", "Notes")
   Dir.children(notes_dir).sort.grep(/\.swift\z/).each { |name| add_source(widgets, file_in(notes_group, name)) }
   notes_fonts = notes_group.children.find { |g| g.isa == "PBXGroup" && g.display_name == "Fonts" } || notes_group.new_group("Fonts", "Fonts")
   Dir.children(File.join(notes_dir, "Fonts")).sort.grep(/\.(ttf|txt)\z/).each { |name| add_resource(widgets, file_in(notes_fonts, name)) }
   ```
   and after `service = extension_target(...)` (and, for item 5, after `content = ...`):
   ```ruby
   add_source(service, file_in(notes_group, "NotesWidgetMailbox.swift"))   # NOTE pushes → the widget
   add_source(content, file_in(notes_group, "NotesWidgetMailbox.swift"))   # opened in the card → the widget
   ```
   Also give KiriyaNotificationService a `PrivacyInfo.xcprivacy` (copy KiriyaWidgets/PrivacyInfo.xcprivacy:
   UserDefaults, reason 1C8F.1) as a resource: it now writes App Group defaults.
3. **`ios/App/KiriyaNotificationService/KiriyaNotificationService.swift`**, first line of `didReceive`:
   ```swift
   // The Little note widget shows a NOTE (or LETTER) push's words at once, with no network fetch.
   NotesWidgetMailbox.receive(request.content.userInfo)
   ```
4. **Server, `server/routes/widget.js`** (the widget needs the whole note, its id and, on Josh's phone, his last note to her):
   ```js
   import { inbox, noteLink, notificationPreview, openLoveNote } from "../lib/loveNotes.js";
   import { letterForCard, openLetterInPlace, signatureName } from "../lib/letterCard.js";

   /** A little note as the Little note widget shows it (ios/App/KiriyaWidgets/Notes). */
   function widgetNote(note, from) {
     return {
       id: note.id, kind: note.kind, title: note.title,
       preview: notificationPreview(note.body, 180),
       text: note.body,                                   // ≤ NOTE_BODY_MAX (1000)
       at: note.at, opened: Boolean(note.openedAt), openedAt: note.openedAt ?? null,
       reaction: note.reaction ?? null, from,
       link: deep(noteLink(note)),                        // the note, or the letter / doodle it announces
       letter: Boolean(note.link?.startsWith("/world/letters")),
     };
   }
   ```
   and in `appSnapshot`: add `signatureName(db)` and `person === "admin" ? inbox(db, "kiriya", { limit: 1 }) : null`
   to the `Promise.all` (as `signer`, `sent`), then
   `latestNote: latest ? widgetNote(latest, signer) : null,` and
   `...(sent ? { sentNote: sent.notes[0] ? widgetNote(sent.notes[0], signer) : null } : {}),`.
   The old fields (title, preview, at, opened) are still there, so `KiriyaSnapshot` keeps decoding.
5. **`ios/App/KiriyaNotificationContent/NoteCardView.swift`** (`openEnvelope`), so a note opened inside its
   notification is open on the widget at once, whatever the network does:
   ```swift
   if isLetter { try? await KiriyaAPI.openLetter(id) } else {
       NotesWidgetMailbox.markOpened(id, reload: false)
       try? await KiriyaAPI.openNote(id)
   }
   WidgetCenter.shared.reloadAllTimelines()
   ```
6. **`src/shared/NativeApp.jsx`**: reload the widgets when the app goes to the background (today's
   reloads are throttled to one per 20 s, so opening a note just after opening the app can leave the
   widget sealed until its next refresh):
   `App.addListener("appStateChange", ({ isActive }) => (isActive ? sync() : refreshWidgets({ force: true })))`.
7. **Later, iOS 26 WidgetKit push** (optional; the NSE path works without it):
   - `KiriyaWidgets.entitlements`: `aps-environment` (Push Notifications capability on the widget extension).
   - `server/db/schema.js` `deviceKeys`: `widgetPushToken: text("widget_push_token")`, `widgetPushEnv: text("widget_push_env")`
     (+ a drizzle migration).
   - `server/lib/deviceKeys.js`: `setWidgetPushToken(db, key, token, env)` — find the row by `hashKey(key)` (not
     revoked), clear the same token on any other row, store token + env.
   - `server/routes/widget.js`: `POST /push-token {token (hex 64–200), env?, kinds?}` → `setWidgetPushToken` with the
     bearer key; 400 on a bad body.
   - `server/push/apns.js` `sendWidgetPush(db, { role })`: for that role's keys with a token, an
     `apn.Notification` with `topic = ${env.apnsBundleId}.push-type.widgets`, `pushType = "widgets"`,
     `contentChanged = true`, expiry 1 h; production first, sandbox on `BadDeviceToken` (as `sendNative`);
     clear tokens APNs calls dead.
   - Call it (in `background(...)`): in `deliverLoveNote` after every delivery (also the quiet and late ones,
     which have no alert push) for `note.recipient`; in `openLoveNote` when a note to `kiriya` becomes
     opened, and in `reactToLoveNote`, for `"admin"` (Josh's "she opened it ♡" within seconds).
   - Then set `NotesWidgetPush.uploads = true` (NotesWidgetPush.swift). The handler is already attached
     on iOS 26 and keeps the token in the App Group (`notesWidget.pushToken`).

## Running it
- `./lab.sh all` · `./lab.sh sheet [11|67]` · `./lab.sh states [11|67]` · `./lab.sh one <state> <small|medium|large|lock> <light|dark|tinted|standby>`
  · `./lab.sh overview` · `./lab.sh edges` · `./lab.sh gif <small|medium|large>` · `./lab.sh frame <size> <seconds>` · `./lab.sh typecheck`
- `./sim.sh build|install|scene <name>|deliver|push|shot|record|appearance|shutdown` (the lab's own Xcode project,
  generated by `tools/make-sim-project.rb`; only the "Kiriya Notes Widget Lab" simulator).
- `tools/grid.py` (review grids), `tools/rename_font.py`.
