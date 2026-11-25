# Building the native pieces on the Mac (phase 4b)

Written 2026-11-24 on a Linux machine, where none of this could be compiled. Every Swift file below is written but unbuilt. Work through the steps in order on Josh's Mac, then run the phone checklist at the end.

Anything marked **UNVERIFIED** is a best reading of Apple's or Capacitor's documentation and source that only a real build or a real phone can confirm. Check those first.

## What's already in the repo

| Where | What | Target |
| --- | --- | --- |
| `ios/App/App/MainViewController.swift` | Capacitor's view controller plus the edge swipe to go back; takes the notification delegate back from Capacitor | App |
| `ios/App/App/KiriyaNotifications.swift` | Notification categories and buttons. "♡ back" and "Reply" are handled natively in the background. | App |
| `ios/App/App/KiriyaAppShortcuts.swift` | Siri / Shortcuts phrases ("Send a heart with kiriya.love") | App |
| `ios/App/App/AppDelegate.swift`, `SceneDelegate.swift` (edited) | Register the categories at launch; forward the long-press quick actions to `@capawesome/capacitor-app-shortcuts`; use `MainViewController` | App |
| `ios/App/App/Base.lproj/Main.storyboard` (edited) | Custom class is now `MainViewController` (module App) | App |
| `ios/App/App/Info.plist` (edited) | URL scheme `kiriyalove`; `INAlternativeAppNames` "kiriya" and "kiriya love" | App |
| `ios/App/App/App.entitlements` (edited) | Push, plus the App Group `group.love.kiriya.app` | App |
| `ios/App/App/PrivacyInfo.xcprivacy` | UserDefaults (CA92.1, 1C8F.1) and FileTimestamp (C617.1), each with the reason written beside it | App |
| `ios/App/App/Sounds/{chat,tap,letter,jar}.caf` | Four short original chimes (Linear PCM, 0.35–1.5 s) | App |
| `ios/App/App/Assets.xcassets/{Night,Blush,Mint,Paper}.appiconset` | Alternate icons. `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` is already set in the project. | App |
| `ios/App/KiriyaShared/KiriyaShared.swift`, `KiriyaIntents.swift` | The App Group store, the widget API client, the snapshot model, and the "send a tap" App Intent | App **and** KiriyaWidgets |
| `ios/App/KiriyaWidgets/*` | Four widgets (Little note, Note jar, Thinking of you, Next con), their Info.plist, entitlements and privacy file | KiriyaWidgets (new) |
| `ios/App/KiriyaNotificationService/*` | Attaches the envelope or jar picture to letters, notes and jar pushes; Info.plist, entitlements | KiriyaNotificationService (new) |

The project's deployment target is already **iOS 17.0**. `npx cap sync ios` reads it, so `CapApp-SPM/Package.swift` says `.iOS(.v17)`.

**Regenerating art.**
- `node scripts/make-app-icon.mjs` remakes every icon, including the alternates and the 180 px previews in `public/app-icons/`. `ios/build.sh` already runs it.
- `node scripts/make-notification-assets.mjs` remakes `envelope.png`, `jar.png` and the four chimes. Run it only when changing them.

## 0. Before Xcode

1. You need Xcode 16 or newer, signed in to the Apple ID for team **9W8CN9V8NR** (Xcode → Settings → Accounts).
2. In the repo, run:
   ```sh
   npm ci
   npm run build        # makes dist/ for the site and dist-app/, the copy bundled into the app
   npx cap sync ios     # copies dist-app into ios/App/App/public and refreshes CapApp-SPM
   ```
3. **The app ships a copy of the site.** `capacitor.config.json` has `webDir: "dist-app"` and no `server.url`. Later site deploys reach the phone over the air through `@capgo/capacitor-updater` (see `docs/refactor/HANDOFF.md`).
   - `dist-app/` is gitignored, so a fresh checkout needs `npm run build` before `npx cap sync ios`.
   - `ios/build.sh` now does that.
4. Open `ios/App/App.xcodeproj`. It's a project, not a workspace: Capacitor uses Swift Package Manager here. Let the packages resolve; the status bar shows progress.

## 1. Files that belong to the App target

1. In the Project navigator, right-click the **App** group → **Add Files to "App"…**.
2. Select these files:
   - `MainViewController.swift`
   - `KiriyaNotifications.swift`
   - `KiriyaAppShortcuts.swift`
   - `PrivacyInfo.xcprivacy`
   - the `Sounds` folder
3. In the dialog:
   - **Copy items if needed:** OFF (the files are already in place).
   - **Added folders: Create groups.** The `Sounds` folder must be a yellow group, not a blue folder reference. iOS looks up `aps.sound` names at the root of the app bundle, and a folder reference would bury them in `Sounds/` (**UNVERIFIED** whether a subfolder would also work; the group avoids the question).
   - **Add to targets:** App.
4. Right-click the top-level **App** project group → **Add Files…** → select the `ios/App/KiriyaShared` folder (Create groups, target **App**). You'll tick the widget target for these two files in step 3.
5. Check **App target → Build Phases → Copy Bundle Resources**. It should list `chat.caf`, `tap.caf`, `letter.caf`, `jar.caf` and `PrivacyInfo.xcprivacy`.
6. **App target → Signing & Capabilities:**
   - Team **9W8CN9V8NR**, automatic signing.
   - Click **+ Capability → App Groups** and tick or add `group.love.kiriya.app`. The entitlements file already lists it; this step registers it with Apple.
   - Push Notifications is already there.
   - Siri is **not** needed: App Intents / App Shortcuts don't use the SiriKit entitlement.

## 2. Build once before adding targets

Product → Build (⌘B) with your iPhone or "Any iOS Device" selected. This shakes out App-target problems while there are fewer moving parts.

The Swift written blind most likely to need a touch is in `KiriyaNotifications.swift`: the delegate forwarding to Capacitor's `NotificationRouter`.

## 3. The widget extension (KiriyaWidgets)

1. **File → New → Target… → iOS → Widget Extension → Next.**
   - Product Name: `KiriyaWidgets`
   - Team: 9W8CN9V8NR
   - **Untick** "Include Live Activity", "Include Control" (if offered) and "Include Configuration App Intent".
   - Project: App. Embed in Application: **App**.
   - Click Finish, then **Activate** the scheme if asked (either answer is fine).
2. Xcode writes template files into `ios/App/KiriyaWidgets/`, next to ours.
   - **Delete** the template ones (Move to Trash): `KiriyaWidgets.swift`, `KiriyaWidgetsBundle.swift`, and any `KiriyaWidgetsLiveActivity.swift`, `KiriyaWidgetsControl.swift`, `AppIntent.swift`. Also delete its `Info.plist` and, optionally, its `Assets.xcassets`.
   - **Keep ours:** `WidgetsMain.swift`, `WidgetProvider.swift`, `WidgetViews.swift`, `WidgetTheme.swift`, `KiriyaWidgets-Info.plist`, `KiriyaWidgets.entitlements`, `PrivacyInfo.xcprivacy`.
3. **Add our files to the target.**
   - **Yellow group:** right-click it → Add Files… → the four `Widget*.swift` files and `PrivacyInfo.xcprivacy`, target **KiriyaWidgets** only.
   - **Blue "synchronized" folder** (newer Xcode can do this; with this project's format, objectVersion 60, it probably won't, **UNVERIFIED**): everything in the folder is in the target automatically. In the File inspector, untick target membership for `KiriyaWidgets-Info.plist` and `KiriyaWidgets.entitlements`; they are settings, not resources.
4. **Shared files.** Select `KiriyaShared/KiriyaShared.swift` and `KiriyaIntents.swift`. In the File inspector → Target Membership, tick **App** and **KiriyaWidgets**. Don't tick `KiriyaAppShortcuts.swift` for the widget; there's only one Siri phrase list per app.
5. **KiriyaWidgets target → Build Settings** (search each name):
   | Setting | Value |
   | --- | --- |
   | `PRODUCT_BUNDLE_IDENTIFIER` | `love.kiriya.app.widgets` |
   | `INFOPLIST_FILE` | `KiriyaWidgets/KiriyaWidgets-Info.plist` |
   | `GENERATE_INFOPLIST_FILE` | `NO` |
   | `CODE_SIGN_ENTITLEMENTS` | `KiriyaWidgets/KiriyaWidgets.entitlements` |
   | `IPHONEOS_DEPLOYMENT_TARGET` | `17.0` |
   | `SWIFT_VERSION` | `5.0` (newer Xcode may default new targets to Swift 6, whose strict concurrency checks would reject some of this code) |
   | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` | the same as the App target (1.0 / 1) |
   | `TARGETED_DEVICE_FAMILY` | `1` (iPhone) |
6. **KiriyaWidgets → Signing & Capabilities:** team 9W8CN9V8NR, automatic. Click **+ Capability → App Groups** → `group.love.kiriya.app`.

## 4. The notification extension (KiriyaNotificationService)

1. **File → New → Target… → iOS → Notification Service Extension.**
   - Product Name: `KiriyaNotificationService`
   - Embed in Application: **App**. Finish.
2. **Delete the template files:** `NotificationService.swift` and its `Info.plist`.
3. **Add ours to the target KiriyaNotificationService:**
   - `KiriyaNotificationService.swift`
   - `envelope.png` and `jar.png`: they must be in its **Copy Bundle Resources** phase.
4. **Build Settings:**
   | Setting | Value |
   | --- | --- |
   | `PRODUCT_BUNDLE_IDENTIFIER` | `love.kiriya.app.notifications` |
   | `INFOPLIST_FILE` | `KiriyaNotificationService/KiriyaNotificationService-Info.plist` |
   | `GENERATE_INFOPLIST_FILE` | `NO` |
   | `CODE_SIGN_ENTITLEMENTS` | `KiriyaNotificationService/KiriyaNotificationService.entitlements` |
   | `IPHONEOS_DEPLOYMENT_TARGET` | `17.0` |
   | `SWIFT_VERSION` | `5.0` |
   | versions and device family | as above |
5. **Signing & Capabilities:** team, automatic, **App Groups** → `group.love.kiriya.app`.

## 5. Check the wiring, then build

- **App target → Build Phases → Embed Foundation Extensions** lists `KiriyaWidgets.appex` and `KiriyaNotificationService.appex`.
- **App target → General → Frameworks, Libraries, and Embedded Content** still has `CapApp-SPM`.
- Build the **App** scheme (⌘B). Both extensions build as dependencies.
- **`ios/build.sh`**
  - **Needs no change for the extensions.** `xcodebuild -scheme App` builds and embeds them, and `-allowProvisioningUpdates` with automatic signing creates their App IDs and profiles.
  - **`ExportOptions-testflight.plist`** (automatic signing, `manageAppVersionAndBuildNumber`) is expected to cover all three targets. **UNVERIFIED:** whether App Store Connect wants the extensions' build numbers bumped by hand. If the upload complains about a version mismatch, set the extensions' `CURRENT_PROJECT_VERSION` to the App's.
- **After an archive:** Organizer → Show in Finder → the `.xcarchive` → Products/Applications/App.app/PlugIns. Both `.appex` files must be there.

## 6. On her phone (and his): checklist

Install with `ios/build.sh run <udid>` first (development push environment), then via TestFlight (production).

**App basics**
- [ ] It opens, Face ID works as before, and pages load.
- [ ] **Swipe from the left edge** goes back a page. **UNVERIFIED:** WKWebView's gesture with the site's in-app navigation. If it jumps or double-navigates, remove the one line in `MainViewController.swift`.
- [ ] **Long-press the icon** to see "Open chat", "Pull a note" and "Send a ♡". The web side sets these on first launch, so open the app once first. Each one does its thing.
- [ ] **App icon picker** (in the app's settings): Night, Blush, Mint, Paper and back to lilac. iOS shows its own "You have changed the icon" alert; that's normal.

**Notifications.** Send each kind from the other phone or from admin.
- [ ] **Letter / little note:**
  - envelope picture on the banner (long-press to see it big)
  - the two-note `letter.caf` chime
  - buttons **Open** and **♡ back**
- [ ] **Jar morning announcement:** jar picture, `jar.caf`, **Open**.
- [ ] **Chat message:** `chat.caf`, grouped in one "chat" thread, buttons **Reply** and **♡ back**.
- [ ] **Reply** from the banner, with the app fully closed (swipe it away first):
  - the message lands in the chat as a reply to that message, once
  - other chat banners clear
  - with the phone locked, Reply first asks for Face ID
- [ ] **♡ back** with the app closed: the other phone gets "… is thinking of you ♡" **once**. The server dedupes on the clientId `n-<request.identifier>-heart`, and replies use `n-<request.identifier>-reply`. The web page ignores these two buttons; only Swift sends them.
- [ ] **No network:** turn on Airplane Mode, press ♡ back, and a local "didn't send" notice appears. Tapping it opens the chat.
- [ ] **A plain tap** on any notification opens the right page, both when the app was closed and when it was in the background. **UNVERIFIED, check this first:** `KiriyaNotificationDelegate` takes the delegate role back from Capacitor's router and forwards to it.
- [ ] **The red badge** on the icon matches the unread total the server sends.

**Widgets.** Long-press the Home Screen → Edit → Add Widget → kiriya.love.
- [ ] Before the app has been opened once after this build, they say "open kiriya.love once ♡". Afterwards they fill in.
  - The web side writes `widgetKey`, `apiBase`, `role` and `snapshot` into the App Group.
- [ ] **Little note** (small, medium, Lock Screen rectangular): shows the newest note. An unopened note has a red envelope. Tapping opens the notes page.
- [ ] **Note jar:** a red heart with the count when new notes wait; tapping opens the jar.
- [ ] **Thinking of you:**
  - tap 🫂 → the header reads "sent 🫂" for about a minute, and the other phone gets the hug, without the app opening
  - the Lock Screen circular heart does the same; iOS only allows widget buttons on a locked phone after it's unlocked
- [ ] **Next con:** a countdown, or "nothing on the calendar yet" until events exist (phase 6).

**Siri, Shortcuts and links**
- [ ] "Hey Siri, send a heart with kiriya.love" (also try "…with kiriya"; **UNVERIFIED** that `INAlternativeAppNames` applies to App Shortcut phrases) → "Sent ♡".
- [ ] The **Shortcuts app** lists "Send a little tap" under kiriya.love.
- [ ] **Deep link:** typing `kiriyalove://open/world/chat` in Safari opens the app on the chat.

## Things to know

- **The widget key** is a revocable `kw_` device key scoped to `/api/widget/*`. It lives in the App Group's UserDefaults, which is readable by this app and its extensions only. That's weaker than the Keychain, but it's what `capacitor-widget-bridge` can write. Revoking the key in Settings → Phone widget cuts off the widgets, Siri and the notification buttons together.
- **`Info.plist` → `UISceneStoryboardFile: Main`:** the storyboard is still named, while `SceneDelegate` builds the window in code, as Capacitor's template does. If a debug build ever logs plugins loading twice, remove the storyboard key from the scene configuration. **UNVERIFIED** whether that ever happens.
- **Every native change needs a new TestFlight build:** icons, sounds, extensions, categories, plugins. Only the web bundle updates over the air.
