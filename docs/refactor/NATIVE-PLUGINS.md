# Native iOS building blocks for the kiriya.love Capacitor 8 app

Research date: 2026-11-24. Research only: nothing was installed in the repo, and no file in the repo was changed.

**How claims were checked.** Every package below was downloaded with `npm pack` into a scratch folder (`scratchpad/pkgs/`), and its `README.md`, `dist/esm/definitions.d.ts`, `Package.swift` and iOS Swift sources were read. Apple behaviour was checked against Apple's documentation JSON and the live License Agreement page.

Labels used throughout:
- **[src]**: checked in the package's own source or type definitions.
- **[doc]**: checked in official Apple or Capacitor documentation.
- **[repo]**: checked in this repo or in Rora's.
- **[UNVERIFIED]**: from memory, community reports or inference, and not confirmed.

## 0. Current setup (from the repo) [repo]

- **Live site, not a bundle.** `capacitor.config.json` sets `server.url: https://kiriya.love/world`, so the app currently shows the live site.
  - `webDir` is `mobile/www`, a small shell.
  - `ios.scheme: "kiriya"` is the **Xcode build scheme** option, not the URL scheme. `ios/build.sh` passes `-scheme App` explicitly. A bundled build will run at **`capacitor://localhost`**, because the defaults are `server.iosScheme = capacitor` and `server.hostname = localhost`.
- **Native project.** It uses SPM (`ios/App/CapApp-SPM/Package.swift` declares `.iOS(.v15)`), with `IPHONEOS_DEPLOYMENT_TARGET = 15.0`.
  - The app uses the UIScene lifecycle (`SceneDelegate.swift`).
  - There are no extension targets yet.
  - The only entitlement is `aps-environment`.
- **Distribution is TestFlight** (`docs/refactor/IOS-APP.md`). Kiriya is planned as an internal tester, which means no Beta App Review.
- **Server push already sends categories and threads** (`server/push/apns.js`, uncommitted edits):
  - Categories `CHAT`, `TAP`, `LETTER`, `NOTE`, `JAR`, `EVENT`.
  - Thread ids `chat`, `letters`, `notes`, `jar`, `events`.
  - `mutableContent = 1` for letters and notes.
  - `sound = "default"`.
  - The iOS side registers no categories yet and has no Notification Service Extension.
- **Auth today:**
  - The site uses an httpOnly `kw` cookie (`SameSite=Lax`) plus an `x-kw: 1` CSRF header on writes.
  - The widget API (`server/routes/widget.js`) uses revocable device keys: `Authorization: Bearer`, or `?key=` on GETs.
  - Private media (`/api/uploads/media?path=…`) is checked with `readSession` (the cookie).

## Summary: one recommendation per item

| # | Need | Recommended | Version (published) | Licence | SPM / iOS min | Cap 8 peer | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Live web-bundle updates, self-hosted | **@capgo/capacitor-updater** | 8.54.2 (2026-11-04) | MPL-2.0 | yes / iOS 15 | `^8.0.0` | Already chosen in PLAN.md. **Set `statsUrl: ""`**; the default sends telemetry to plugin.capgo.app. MIT alternative: @capawesome/capacitor-live-update 8.10.0. |
| 2 | Icon badge | **@capawesome/capacitor-badge** | 8.0.4 (2026-10-08) | MIT | yes / iOS 15 | `>=8.0.0` | Set `persist: false`. The server's `aps.badge` should be the source of truth. |
| 3 | Home-screen quick actions | **@capawesome/capacitor-app-shortcuts** | 8.0.3 (2026-10-09) | MIT | yes / iOS 15 | `>=8.0.0` | Needs four lines in `SceneDelegate.swift`. |
| 4 | Alternate app icons | **@capawesome/capacitor-app-icon** | 0.1.3 (2026-11-12) | MIT | yes / iOS 15 | `>=8.0.0` | Uses public API only. Young (0.x, created 2026-07). Avoid the community plugin's `suppressNotification`, which calls a private API. |
| 5 | Widgets, interactive buttons, Siri | **Hand-written Swift WidgetKit extension + App Intents**, plus **capacitor-widget-bridge** for app→widget data and timeline reloads | 8.1.0 (2026-03-03) | MIT | yes / iOS 15 | `>=8.0.0` | Interactive buttons need the widget extension on iOS 17+. Capgo widget-kit and app-intents both need iOS 16 in `Package.swift` (blocker at target 15) and are heavier than needed. |
| 6 | Notification Service Extension (NSE) image, per-kind sounds, actions, threads | **No plugin.** Native NSE target, native `UNNotificationCategory` registration, existing `@capacitor/push-notifications` 8.1.3 for JS | n/a | n/a | n/a | n/a | The push plugin never registers categories. It maps the action id to JS as `tap`, `dismiss` or the raw identifier. |
| 7 | Native-feeling navigation, keyboard | Pure CSS tab bar + **@capacitor/haptics** 8.0.2 (installed) + **@capacitor/keyboard** 8.0.6. Swipe-back: native `allowsBackForwardNavigationGestures`, or @capgo/capacitor-transitions (MIT) | | MIT | yes / iOS 15 | `>=8.0.0` | `selectionChanged()` does nothing without `selectionStart()` [src]. |
| 8 | Bundled-app auth | **Bearer token + CORS allowlist for `capacitor://localhost`**. Leave CapacitorHttp and CapacitorCookies off. | (core) | | | | Private `<img>` media needs signed URLs whichever option is chosen. |

**Blockers and decisions:**
- The **iOS 15 deployment target** blocks Capgo widget-kit and app-intents, which need iOS 16. Interactive widgets need iOS 17 in the widget extension. An extension can probably have a higher deployment target than the app [UNVERIFIED but standard practice]; otherwise raise the app target.
- **`server.url` must be removed**, and `webDir` must point at a real Vite build, before any live update works.
- **Server work is needed:**
  - A bearer-token path in `readSession`.
  - CORS.
  - Signed media URLs.
  - A bundle-manifest endpoint.
  - A new widget route for "send ♡" (the device key only reaches `/api/widget/*`).

---

## 1. Live updates of the bundled web app (self-hosted)

### Candidates

| Package | Ver / date | Licence | SPM | Cap 8 | Maintenance | Self-host story |
|---|---|---|---|---|---|---|
| **@capgo/capacitor-updater** | 8.54.2 / 2026-11-04 | **MPL-2.0** [src LICENSE] | `Package.swift` `.iOS("15.0")`, no third-party deps besides Capacitor [src] | peer `^8.0.0`, README table "v8.\*.\* ↔ v8.\*.\*" | GitHub Cap-go/capacitor-updater: 891★, pushed 2026-11-25, 951 npm versions | (a) **manual**: `download({url,version,checksum})` + `next()`/`set()`; (b) **self-hosted auto**: point `updateUrl` at your own endpoint |
| @capawesome/capacitor-live-update | 8.10.0 / 2026-11-24 | **MIT** | `Package.swift` iOS 15 [src] | peer `>=8.0.0` | capawesome-team/capacitor-plugins monorepo, pushed 2026-11-24 | Manual only: `downloadBundle({url,bundleId,checksum})`. Its auto `sync()` needs Capawesome Cloud. |
| @capacitor/live-updates (Ionic) | 0.5.1 | **Commercial** | n/a | | | Excluded (not open source) |

MPL-2.0 is file-level copyleft: using the plugin unmodified in a private app has no obligations. If plugin source files are modified and distributed, those files must stay MPL [general licence reading; not legal advice].

### How bundles are served (Capgo)

- **Format** [src README "Packaging dist.zip"]:
  - A `.zip` of the production build output, with `index.html` at the root or inside a single top-level folder [src d.ts `download`].
  - Not password-encrypted.
  - No hidden files.
- **Hosting:** any HTTPS URL, such as Vercel Blob, a GitHub release or `/api/...`.
  - `DownloadOptions` has **no headers field** [src], so the zip URL must be public or carry its own signature or token in the query string.
  - The JS bundle is the same code the site already serves publicly, so public hosting is acceptable. Integrity comes from `checksum`.
- **Checksum:** SHA-256 of the zip [src d.ts: "it should be in sha256"]. Optional end-to-end signing: `publicKey` config plus `npx @capgo/cli bundle encrypt`, which yields `sessionKey` and an encrypted checksum [src].

### Self-hosted auto mode: protocol

- **Request** [src `CapgoUpdater.swift` uses `httpMethod = "POST"` with a JSON body]. The plugin POSTs an `InfoObject` with these fields [src `InternalUtils.swift`]: `platform, device_id, app_id, custom_id, version_build, version_code, version_os, version_name, old_version_name, plugin_version, is_emulator, is_prod, installSource, action, channel, defaultChannel, key_id`.
- **Response** [doc capgo.app/docs/plugins/updater/self-hosted/handling-updates]:
  ```json
  { "version": "1.0.2", "url": "https://…/bundle-1.0.2.zip", "checksum": "<sha256>" }
  ```
- **No update:** return `{ "message": "...", "error": "..." }`.
- **Validation:** the server should compare `version_name` with the latest version and refuse bundles built for a newer native shell.

### Exact API (from `dist/esm/definitions.d.ts`) [src]

```ts
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// 1) EVERY launch, as early as possible (before network calls). Otherwise rollback after appReadyTimeout (default 10 000 ms).
await CapacitorUpdater.notifyAppReady();            // Promise<{ bundle: BundleInfo }>

// 2) What is running now
const { bundle, native } = await CapacitorUpdater.current();   // bundle.id === 'builtin' when no OTA bundle is active

// 3a) MANUAL mode: our own manifest endpoint decides
const latest = await (await fetch('https://kiriya.love/api/app/bundle', { headers: { Authorization: `Bearer ${token}` } })).json();
if (latest.version && latest.version !== bundle.version) {
  const info = await CapacitorUpdater.download({ url: latest.url, version: latest.version, checksum: latest.checksum }); // Promise<BundleInfo>
  await CapacitorUpdater.next({ id: info.id });     // applied on next background / kill / reload()
  // or: await CapacitorUpdater.set({ id: info.id }); // reloads immediately; JS context is destroyed
}

// Housekeeping and rollback
await CapacitorUpdater.list();                       // { bundles: BundleInfo[] }
await CapacitorUpdater.delete({ id });
await CapacitorUpdater.reset({ toLastSuccessful: true }); // reload into the last good bundle (default: builtin)
await CapacitorUpdater.reload();                     // apply a pending next() now
CapacitorUpdater.addListener('updateFailed', (e) => { /* … */ });
```

`BundleInfo = { id, version, downloaded, checksum, status }` [src].

### Config (`capacitor.config.json` → `plugins.CapacitorUpdater`) [src defaults]

```jsonc
{
  "autoUpdate": false,          // manual mode. Default true = 'atBackground'.
  // For self-hosted auto mode instead: "autoUpdate": "atBackground", "updateUrl": "https://kiriya.love/api/app/updates"
  "statsUrl": "",               // IMPORTANT: default https://plugin.capgo.app/stats receives lifecycle + crash/JS-error telemetry
  "appReadyTimeout": 10000,
  "autoDeleteFailed": true,
  "autoDeletePrevious": true,
  "resetWhenUpdate": true,      // a new TestFlight build drops old OTA bundles
  "httpsOnly": true,
  "builtinMinimum": true,       // refuse bundles older than the native app version
  "keepUrlPathAfterReload": true
}
```

**Defaults that point at Capgo's cloud** [src `CapacitorUpdaterPlugin.swift`]:
- `updateUrl` → `https://plugin.capgo.app/updates`, used only when `autoUpdate` is on.
- `statsUrl` → `https://plugin.capgo.app/stats`, used for update events in any mode, so set it to `""`.
- `channelUrl` → `https://plugin.capgo.app/channel_self`, used by channel methods. Don't call `setChannel`/`getChannel` [UNVERIFIED that nothing else hits it].

**Other setup:**
- The iOS privacy manifest needs `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` [src README].
- Use plugin ≥ 8.51.22 on iOS. Older builds contained `NSSelectorFromString`/`perform` code (for `autoSplashscreen`) that App Review rejected under guideline 2.5.2 [src README, issue #913]. Current 8.54.2 is fine.
- **Rollback model** [src]:
  - If `notifyAppReady()` isn't called within `appReadyTimeout`, the bundle is marked failed and the app returns to the last good bundle or the builtin one.
  - Runtime JS errors after that call do **not** trigger a rollback.

### Capawesome alternative (MIT): exact API [src]

```ts
import { LiveUpdate } from '@capawesome/capacitor-live-update';
await LiveUpdate.ready();                                     // { currentBundleId, previousBundleId, rollback }
await LiveUpdate.downloadBundle({ url, bundleId: '1.4.0', checksum /* sha256 hex */ });
await LiveUpdate.setNextBundle({ bundleId: '1.4.0' });
await LiveUpdate.reload();     // or wait for restart
await LiveUpdate.reset();      // back to the built-in bundle
// config plugins.LiveUpdate: { readyTimeout: 10000, autoDeleteBundles: true, publicKey?: PEM RSA }
```

### Apple's stance (TestFlight and App Store)

- **Developer Program License Agreement, §3.3.1(B) "Executable Code"** (formerly §3.3.2), checked on the live agreement page [doc]. §3.3 states its requirements apply to apps "distributed through the App Store, Custom App Distribution, or TestFlight, or … Ad Hoc distribution":
  > "an Application may not download or install executable code. Interpreted code may be downloaded to an Application but only so long as such code: (a) does not change the primary purpose of the Application by providing features or functionality that are inconsistent with the intended and advertised purpose of the Application (b) does not bypass signing, sandbox, or other security features of the OS; and (c) for Applications distributed on the App Store, does not create a store or storefront for other Applications."
- **App Review Guideline 2.5.2** [doc]:
  > "…nor may they download, install, or execute code which introduces or changes features or functionality of the app…"

  This is the guideline reviewers cite. Capgo's README says rejections are rare. It advises showing no "update / downloading / OTA" wording in the UI and keeping live updates away from review sessions.
- **Guideline 2.2** [doc]:
  > "Any app submitted for beta distribution via TestFlight … should comply with the App Review Guidelines … Significant updates to your beta build should be submitted to TestFlight App Review before being distributed to your testers."
- **TestFlight page** [doc]:
  - Internal testers are up to 100 team members, with no review step mentioned.
  - External testers need "your first build already approved by App Review for TestFlight".
- **Conclusion for this app:**
  - Downloading the app's own HTML, JS and CSS bundle is allowed by the license agreement for TestFlight builds.
  - As an **internal tester** there is no review gate at all.
  - If Kiriya is ever moved to *external* testing, follow Capgo's advice: no update wording, and no live update during review.
  - The current setup, which loads the live site through `server.url`, already runs downloaded code, so bundling with OTA updates is no worse.

---

## 2. App icon badge: @capawesome/capacitor-badge

- **Package facts:** 8.0.4, MIT, `Package.swift` iOS 15, peer `>=8.0.0`.
- **Implementation:** on iOS 16+ it calls `UNUserNotificationCenter.setBadgeCount`, and on older iOS it sets `applicationIconBadgeNumber` [src `Badge.swift`].

```ts
import { Badge } from '@capawesome/capacitor-badge';
await Badge.set({ count: unreadNotes + unreadMessages });
await Badge.clear();
const { count } = await Badge.get();        // NOTE: returns the plugin's stored value (UserDefaults), not the icon's real badge [src]
await Badge.requestPermissions();           // { display: 'granted' | 'denied' | 'prompt' }
await Badge.increase(); await Badge.decrease(); await Badge.isSupported();
```

- **Config:** `plugins.Badge: { "persist": false, "autoClear": false }`.
  - Defaults are `persist: true` and `autoClear: false` [src].
  - **Why `persist: false`:** with `persist: true`, plugin load calls `restore()`, which re-sets the badge to the last value JS wrote [src]. That would overwrite a newer count that APNs set while the app was closed.
  - `autoClear: true` also clears all delivered notifications on resume [src README].
- **Recommended flow:**
  - The server sets `note.badge = <unread total>` on every APNs push. `@parse/node-apn` exposes `Notification.badge` [repo node_modules types].
  - The app calls `Badge.set()` whenever the unread totals change and on resume.
- **Permission:** `@capacitor/push-notifications` already requests `[.alert, .sound, .badge]` [src].
- **Privacy manifest:** `NSPrivacyAccessedAPICategoryUserDefaults` / `CA92.1` [src README].

---

## 3. Home-screen quick actions: @capawesome/capacitor-app-shortcuts

- **Package facts:** 8.0.3, MIT, `Package.swift` iOS 15 (module `AppShortcutsPlugin`), peer `>=8.0.0`.
- **Cold start:** clicks are emitted with `retainUntilConsumed: true` [src], so a listener added late still receives them.

```ts
import { AppShortcuts } from '@capawesome/capacitor-app-shortcuts';
await AppShortcuts.set({ shortcuts: [
  { id: 'pull-note', title: 'Pull a note', iosIcon: 'sparkles' },        // SF Symbol name, UIApplicationShortcutIcon.IconType int, or asset name
  { id: 'chat',      title: 'Open chat',   iosIcon: 'bubble.left.and.bubble.right.fill' },
  { id: 'heart',     title: 'Send a ♡',    iosIcon: 'heart.fill', description: 'thinking of you' },
]});
AppShortcuts.addListener('click', ({ shortcutId }) => { /* route */ });
await AppShortcuts.get(); await AppShortcuts.clear();
// Or static: plugins.AppShortcuts.shortcuts = [{ id, title }] in capacitor.config (since 7.2.0)
```

**Required native edit** (UIScene lifecycle, matches this repo's `SceneDelegate.swift`) [src README]:

```swift
import AppShortcutsPlugin
// in scene(_:willConnectTo:options:) after makeKeyAndVisible():
if let item = connectionOptions.shortcutItem {
  NotificationCenter.default.post(name: NSNotification.Name(AppShortcutsPlugin.notificationName), object: nil,
                                  userInfo: [AppShortcutsPlugin.userInfoShortcutItemKey: item])
}
// new method:
func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                 completionHandler: @escaping (Bool) -> Void) {
  NotificationCenter.default.post(name: NSNotification.Name(AppShortcutsPlugin.notificationName), object: nil,
                                  userInfo: [AppShortcutsPlugin.userInfoShortcutItemKey: shortcutItem])
  completionHandler(true)
}
```

- **"Send a ♡" opens the app.** Quick actions always launch it; there is no background path. To send without opening, use the widget button or the Siri intent (§5).
- **Alternatives:**
  - `@capgo/capacitor-app-intents` `setHomeScreenShortcutItems()`: MPL-2.0, **iOS 16 min** (blocker).
  - `capacitor-quick-actions` 1.0.2: last published 2024-06, Capacitor 8 support not declared.

---

## 4. Alternate app icons: @capawesome/capacitor-app-icon

| Package | Ver / date | Licence | SPM | Notes |
|---|---|---|---|---|
| **@capawesome/capacitor-app-icon** | 0.1.3 / 2026-11-12 (created 2026-07-07) | MIT | iOS 15 | Uses only `UIApplication.setAlternateIconName` and `supportsAlternateIcons` [src] |
| @capacitor-community/app-icon | 7.0.0 / 2025-12-24 (peer `>=8.0.0`, so the version number doesn't track Capacitor) | MIT | iOS 15 | `suppressNotification: true` calls the **private** `_setAlternateIconName:completionHandler:` via `NSSelectorFromString` [src `AppIconPlugin.swift`]. The license agreement §3.3.1(A) says apps "must not use or call any private APIs" [doc], and that applies to TestFlight builds too. Don't use that flag. |
| persistant-capacitor-app-icon | 7.0.2 / 2026-02 | MIT | peer `>=7` | Fork; no reason to prefer it |

**Usage** [src]:

```ts
import { AppIcon } from '@capawesome/capacitor-app-icon';
const { available } = await AppIcon.isAvailable();
const { icon } = await AppIcon.getCurrentIcon();   // null = primary icon
await AppIcon.setIcon({ icon: 'Moonlight' });      // icon-set name, case-sensitive
await AppIcon.resetIcon();
```

**Adding the icons in Xcode** [doc Xcode build settings reference and `setAlternateIconName` page; src README]:

1. **Add one icon set per choice** in `ios/App/App/Assets.xcassets`, next to `AppIcon.appiconset`, for example `Moonlight.appiconset`.
   - The current `AppIcon` is a single-size 1024×1024 universal set [repo], so alternates can use the same `Contents.json` shape.
   - **Don't start alternate names with `AppIcon`.** Capawesome reports they don't render on iOS 26 [src README].
2. **Build settings** for the App target:
   - **Alternate App Icon Sets** = `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "Moonlight Pixel Miku"` (space-separated).
   - Or **Include All App Icon Assets** = `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES`.
   - Xcode generates `CFBundleIcons → CFBundleAlternateIcons` in the built Info.plist. No hand-edited plist is needed [doc].
3. **New build.** Icons are compiled into the binary, so a new icon needs a new TestFlight build. A live update can't add one.

**Platform behaviour:**
- iOS always shows a system alert after a change [src README].
- The change only works while the app is in the foreground [src README].
- Dark and tinted variants for alternates, and Icon Composer `.icon` files as alternates: [UNVERIFIED].

---

## 5. WidgetKit, interactive widgets and Siri / Shortcuts

### Plugin candidates

| Package | Ver / date | Licence | SPM / min iOS | Verdict |
|---|---|---|---|---|
| **capacitor-widget-bridge** (kisimediaDE) | 8.1.0 / 2026-03-03 | MIT | yes / iOS 15 | **Use it.** A tiny wrapper: `UserDefaults(suiteName:)` plus `WidgetCenter.reloadAllTimelines/reloadTimelines(ofKind:)` [src]. GitHub: 56★, 0 open issues, last push 2026-03. Small enough to vendor if it goes stale. |
| @capgo/capacitor-widget-kit | 8.2.2 / 2026-11-12 | MPL-2.0 | **iOS 16**, needs Xcode 26 / Swift 6 (SwiftDraw dependency) | SVG-template widgets, Live Activities, JSON "widget sessions". Overkill here, and blocked by the iOS 15 target. |
| capacitor-widgetsbridge-plugin (0xn33t) | 0.2.1 / 2025-05-31 | MIT (npm); no licence on GitHub | **No `Package.swift`** (CocoaPods only) | Not usable with this SPM project |
| @capgo/capacitor-app-intents | 8.3.0 / 2026-11-20 (created 2026-10, 1★) | MPL-2.0 | **iOS 16** | JS-dispatch intents. Its `CapgoDispatchAppIntent` has `openAppWhenRun = true` [src], so it **opens the app**. Not suitable for a "send without opening" action. |

### Sharing data and auth between the app and the extensions

- **App Groups** (`com.apple.security.application-groups`, for example `group.love.kiriya.app`) on the app, the widget extension and the NSE [doc "Configuring app groups"]. They give access to:
  - Shared `UserDefaults(suiteName:)`.
  - A shared container via `containerURL(forSecurityApplicationGroupIdentifier:)`.
  - Sounds in the group container's `Library/Sounds`, which the system also searches [doc `UNNotificationSound`].
- **Keychain sharing:**
  > "You can use app group names as keychain access group names, without adding them to the Keychain access groups entitlement" [doc "Sharing access to keychain items…"].

  Alternatively, add `keychain-access-groups` to every target. Rora's NSE does this: `$(AppIdentifierPrefix)…notifications` in `RoraNotificationService.entitlements`, read in `RoraShared/RoraNotificationStore.swift` [repo ~/projects/rora/rora-frontend/ios/App].
  - **What to store:** the widget **device key**, which today is created in Settings → Phone widget and reaches only `/api/widget/*`. Store it as a Keychain item with `kSecAttrAccessGroup = group…` and `kSecAttrAccessible…AfterFirstUnlock`, so widgets can read it while the phone is locked [accessibility class choice: UNVERIFIED best practice].
  - **No plugin writes it.** None of the existing plugins writes to a shared access group: native-biometric, @aparajita/capacitor-secure-storage and capacitor-secure-storage-plugin all lack `accessGroup` support [src grep]. Writing the key therefore needs either:
    - a ~40-line **local Capacitor plugin** in the App target, registered with `bridge?.registerPluginInstance(...)` from a `CAPBridgeViewController` subclass's `capacitorDidLoad()` (both hooks exist in Capacitor 8.6 [src `CAPBridgeViewController.swift`, `CapacitorBridge.swift`]); or
    - the simpler, weaker route: `WidgetBridgePlugin.setItem({ group, key: 'deviceKey', value })` into App Group defaults. The key is revocable and scoped, so this is defensible, but it isn't Keychain-protected.

**capacitor-widget-bridge API** [src]:

```ts
import { WidgetBridgePlugin } from 'capacitor-widget-bridge';
const group = 'group.love.kiriya.app';
await WidgetBridgePlugin.setItem({ group, key: 'snapshot', value: JSON.stringify(widgetSnapshot) }); // value is a string
await WidgetBridgePlugin.getItem({ group, key: 'snapshot' });   // { results: any }
await WidgetBridgePlugin.removeItem({ group, key: 'snapshot' });
await WidgetBridgePlugin.reloadTimelines({ ofKind: 'LatestNoteWidget' });  // or reloadAllTimelines()
await WidgetBridgePlugin.getCurrentConfigurations();             // iOS: WidgetCenter info
```

### Widget timeline (Swift, in the widget extension)

- **Fetching data:** the extension can call `GET https://kiriya.love/api/widget` itself, using `Authorization: Bearer <deviceKey>` with the key from the shared keychain. The JSON already has `status`, `unread`, `latestNote` and `links`. Alternatively it can read the snapshot the app wrote.
- **Refresh budget:** "for a widget the user frequently views, a daily budget typically includes from 40 to 70 refreshes", or roughly every 15–60 minutes [doc "Keeping a widget up to date"].
  - Reloads requested by the app through `WidgetCenter` are how the widget updates immediately after an in-app change.
  - **iOS 26+ only:** WidgetKit push. Conform a `WidgetPushHandler`; the server sends `apns-push-type: widgets`, `apns-topic: love.kiriya.app.push-type.widgets` and `{"aps":{"content-changed":true}}` [doc]. `@parse/node-apn` already accepts `pushType: 'widgets'` [repo types].

### Interactive widget buttons (iOS 17+) that call the API without opening the app [doc "Adding interactivity to widgets and Live Activities"]

- Buttons and toggles work in `systemSmall/Medium/Large`, `accessoryCircular/Rectangular` and Live Activities.
- "On a locked device, buttons and toggles are inactive … unless a person authenticates and unlocks."
- Add the `AppIntent` to **both the widget extension and the app target**. "By default, the system runs the app intent in the same process as the widget extension." It runs in the app's process only if `openAppWhenRun` is true or the intent is a `LiveActivityIntent`/`AudioPlaybackIntent`/… type.
- "When you return from the `perform()` function, the system reloads the widget's timeline … Interactions with a toggle or button always guarantee a timeline reload."
- Widgets don't resolve parameters, so every `@Parameter` must have a value.

```swift
import AppIntents
import WidgetKit

struct SendTapIntent: AppIntent {
  static var title: LocalizedStringResource = "Send a ♡"
  @Parameter(title: "Kind") var kind: String          // String param: [UNVERIFIED] Apple text suggests AppEntity types; String is common in practice
  init() {}
  init(kind: String) { self.kind = kind }

  func perform() async throws -> some IntentResult {
    guard let key = SharedKeychain.deviceKey() else { return .result() }    // your helper reading kSecAttrAccessGroup
    var req = URLRequest(url: URL(string: "https://kiriya.love/api/widget/tap")!)   // NEW route needed server-side
    req.httpMethod = "POST"
    req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(["kind": kind])
    _ = try? await URLSession.shared.data(for: req)
    return .result()                                       // → system reloads the timeline
  }
}

// In the widget view (widget extension deployment target 17, or wrap in `if #available(iOS 17, *)`):
Button(intent: SendTapIntent(kind: "thinking")) { Label("♡", systemImage: "heart.fill") }
```

The existing `PUT /api/widget/status` (battery, mood, presenting) can be wired the same way.

### Siri / Shortcuts exposure [doc]

- Put the same intent files in the **App target** and add an `AppShortcutsProvider` (iOS 16+).
- `AppShortcut(intent:phrases:shortTitle:systemImageName:)`: the variant with optional title and image is iOS 16; the variant with required title and image is iOS 17.

```swift
@available(iOS 16.0, *)
struct KiriyaShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: SendTapIntent(kind: "thinking"),
                phrases: ["Send a heart with \(.applicationName)"],   // phrases must contain the app name [UNVERIFIED rule from memory]
                shortTitle: "Send ♡", systemImageName: "heart.fill")
  }
}
```

- **Where it runs:** with the default (`openAppWhenRun` false), the intent runs in the background in the app process. That is plain Swift with `URLSession`; the WebView is not involved.
- **API change:** `openAppWhenRun` is deprecated in iOS 26 in favour of `static let supportedModes: IntentModes` (`.background`, `.foreground(.immediate|.dynamic|.deferred)`). Setting `openAppWhenRun = true` in an app extension raises an error [doc].
- **Today without native code:** the widget API already serves Shortcuts through "Get Contents of URL" (`/api/widget/menu`, `PUT /status`) [repo].

---

## 6. Notification Service Extension, sounds, categories and threads

### Notification Service Extension (NSE) [doc `UNNotificationServiceExtension`, `UNNotificationAttachment`]

- **When it runs:** only for alert pushes with `aps.mutable-content: 1`. Silent, sound-only and badge-only pushes are never passed to it. The server already sets this for `letter` and `note` [repo].
- **Time limit:** limited time, then `serviceExtensionTimeWillExpire()`. If no content is delivered, the original is shown.
- **Attachments:** image (JPEG, GIF, PNG) up to **10 MB**; audio up to 5 MB; video up to 50 MB. The file must be on disk with a matching type. "The system copies attachments located inside an app's bundle."
  - **So the envelope picture can ship inside the NSE target, with no network at all.**
  - For per-message images, download to a temp file with the right extension. If the image is private, send a short-lived signed URL in the payload, or read the device key from the shared keychain as Rora does.
- **Rora precedent:** a working NSE in a Capacitor SPM project at `~/projects/rora/rora-frontend/ios/App/RoraNotificationService/` [repo].
  - It sits beside `CapApp-SPM`, which shows that `npx cap sync` coexists with extra targets.
  - It uses **communication notifications** (`INSendMessageIntent` with a sender avatar) rather than `UNNotificationAttachment`. That is an option for the chat thread; it needs the Communication Notifications capability [UNVERIFIED capability name: `com.apple.developer.usernotifications.communication`].

```swift
import UserNotifications
final class NotificationService: UNNotificationServiceExtension {
  private var handler: ((UNNotificationContent) -> Void)?
  private var best: UNMutableNotificationContent?
  override func didReceive(_ request: UNNotificationRequest,
                           withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    handler = contentHandler
    best = request.content.mutableCopy() as? UNMutableNotificationContent
    guard let content = best else { return contentHandler(request.content) }
    if let kind = content.userInfo["kind"] as? String, ["letter", "note"].contains(kind),
       let url = Bundle.main.url(forResource: "envelope", withExtension: "png"),          // Bundle.main = the NSE bundle
       let att = try? UNNotificationAttachment(identifier: "envelope", url: url, options: nil) {
      content.attachments = [att]
    }
    contentHandler(content)
  }
  override func serviceExtensionTimeWillExpire() { if let h = handler, let c = best { h(c) } }
}
```

The Xcode template sets `NSExtensionPointIdentifier = com.apple.usernotifications.service` [doc; Rora's Info.plist matches].

### Custom sounds per kind [doc `UNNotificationSound`, "Generating a remote notification"]

- **Simplest path:** the server sets `note.sound = "letter.caf"` instead of `"default"` for each kind in `KINDS`.
- **Where the file can live:** `aps.sound` names "a sound file in your app's main bundle or in the `Library/Sounds` folder of your app's container". Put the `.caf` files in the **App** target.
- **Format:** Linear PCM, IMA4, µLaw or aLaw, in an `aiff`, `wav` or `caf` file, **under 30 s**; otherwise the default sound plays. Convert with:
  ```
  afconvert in.aiff out.caf -d ima4 -f caff -v
  ```
- **If the NSE sets the sound** (`content.sound = UNNotificationSound(named: …)`), the lookup covers the app container's `Library/Sounds`, the App Group's `Library/Sounds`, and "the main bundle of the current executable", which inside the NSE is the extension bundle. So keep shared sounds in the App Group or duplicate them [inference from doc; UNVERIFIED on device].

### Categories, actions and threads

- **Threads:** `aps.thread-id` maps to `threadIdentifier`; same string means one group [doc]. Already sent [repo].
- **Categories:** `aps.category` must match a `UNNotificationCategory` registered **at launch** [doc].
- **`@capacitor/push-notifications` never registers categories:** there is no API for it and no `setNotificationCategories` in the iOS source [src]. Register them natively in `AppDelegate.application(_:didFinishLaunchingWithOptions:)`, as Rora does in `RoraNotificationCategories.register()` [repo]:

```swift
let heart = UNNotificationAction(identifier: "HEART", title: "♡ back", options: [])            // background
let open  = UNNotificationAction(identifier: "OPEN",  title: "Open",   options: [.foreground])
let reply = UNTextInputNotificationAction(identifier: "REPLY", title: "Reply", options: [],
                                          textInputButtonTitle: "Send", textInputPlaceholder: "say something sweet")
UNUserNotificationCenter.current().setNotificationCategories([
  UNNotificationCategory(identifier: "CHAT",   actions: [reply, heart], intentIdentifiers: [], options: []),
  UNNotificationCategory(identifier: "TAP",    actions: [heart],        intentIdentifiers: [], options: []),
  UNNotificationCategory(identifier: "LETTER", actions: [open, heart],  intentIdentifiers: [], options: []),
  UNNotificationCategory(identifier: "NOTE",   actions: [open, heart],  intentIdentifiers: [], options: []),
  UNNotificationCategory(identifier: "JAR",    actions: [open],         intentIdentifiers: [], options: []),
  UNNotificationCategory(identifier: "EVENT",  actions: [open],         intentIdentifiers: [], options: []),
])
```

Apple notes that the action identifier is the only way to tell actions apart across categories [doc], so reuse an id only for actions that mean the same thing.

- **JS alternative:** `@capacitor/local-notifications` `registerActionTypes({ types: [{ id, actions: [{ id, title, input?, foreground?, destructive? }] }] })` also calls `setNotificationCategories` [src]. It replaces the whole set and only runs once JS has loaded, so native registration is safer.

### How actions reach JS [src `PushNotificationsHandler.swift`; Capacitor `NotificationRouter.swift`]

```ts
PushNotifications.addListener('pushNotificationActionPerformed', ({ actionId, inputValue, notification }) => {
  // actionId: 'tap' (UNNotificationDefaultActionIdentifier) | 'dismiss' (only if category has .customDismissAction)
  //           | the raw identifier, e.g. 'REPLY', 'HEART', 'OPEN'
  // inputValue: text from UNTextInputNotificationAction
  // notification: { id, title, subtitle, body, badge, data: userInfo (custom keys like navigate/kind, plus aps) }
});
```

- **Cold start:** the event is sent with `retainUntilConsumed: true` [src].
- **Background actions are a pitfall.**
  - **What the source shows** [src]: Capacitor's `NotificationRouter.userNotificationCenter(_:didReceive:withCompletionHandler:)` sends the event to JS, then calls `completionHandler()` **immediately**.
  - **What Apple says** [doc]: "Always call the completion handler after you finish handling the action."
  - **The risk:** a non-`.foreground` action ("♡ back", inline Reply) handled only in JS may be suspended before its `fetch` finishes. [UNVERIFIED on device]
  - **Recommended:** handle `HEART` and `REPLY` natively. Wrap `bridge.notificationRouter.pushNotificationHandler`, as Rora's `RoraForegroundPresentation` wraps it (`~/projects/rora/rora-frontend/ios/App/App/RoraNotifications.swift` ~L279–345) [repo]. Run a `URLSession` POST with the device key inside `UIApplication.shared.beginBackgroundTask`, and forward everything else to the wrapped handler.
- **Foreground presentation** is already configured: `PushNotifications.presentationOptions: ["badge","sound","banner","list"]` [repo].

---

## 7. Native-feeling navigation in a web app

**Bottom tab bar (pure CSS).** The repo already uses `viewport-fit=cover` and `env(safe-area-inset-*)` [repo]. These are best practices [not tied to one source]:

```css
.tabbar { position: fixed; inset: auto 0 0 0; height: calc(56px + env(safe-area-inset-bottom));
          padding-bottom: env(safe-area-inset-bottom); -webkit-tap-highlight-color: transparent;
          touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.page   { padding-bottom: calc(56px + env(safe-area-inset-bottom)); overscroll-behavior-y: contain; }
body.keyboard-open .tabbar { display: none; }   /* hide the tab bar while composing */
```

- Keep each tab's scroll position and router state alive, and don't remount on tab switch. Use `100dvh` rather than `100vh`.
- `ios.contentInset: "never"` is already set, so the CSS insets are the only source of padding [repo].
- Native iOS 26 tab bars can't be reproduced from the web layer.

**Haptics** (`@capacitor/haptics` 8.0.2, already installed) [src]:

```ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
Haptics.impact({ style: ImpactStyle.Light });            // tab tap, pull-to-refresh threshold
Haptics.notification({ type: NotificationType.Success }); // message sent
Haptics.selectionStart(); Haptics.selectionChanged(); Haptics.selectionEnd(); // pickers: changed() is a no-op unless start() ran first [src Haptics.swift]
```

**Swipe-back.** Two options:
- **(a) Native WKWebView gesture.** Capacitor has no config key for it [src cli declarations]. Subclass `CAPBridgeViewController` (`capacitorDidLoad()` is `open` in 8.6 [src]) and set `webView?.allowsBackForwardNavigationGestures = true`.
  - It works off WKWebView history, which includes react-router `pushState` entries [UNVERIFIED].
  - Community reports: double navigation when the router also animates, and an iOS 17.5.1+ case where the swipe jumps to the first page (Apple forums thread 766975) [UNVERIFIED].
- **(b) JS edge-swipe:** `@capgo/capacitor-transitions` 8.3.17 (MIT, React ≥18).
  - `setupRouterOutlet(el, { swipeGesture: 'auto' })` turns the gesture on only in native iOS Capacitor builds [src README].
  - It brings its own page-transition model, which may clash with the "additive UI only" rule, so evaluate first.

**Keyboard** (`@capacitor/keyboard` 8.0.6, MIT, SPM iOS 15) [src]:

```jsonc
// capacitor.config.json
"Keyboard": { "resize": "none", "style": "DEFAULT", "autoBackdropColor": "auto" }  // resize default is "native"
```

```ts
import { Keyboard } from '@capacitor/keyboard';
Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
  document.documentElement.style.setProperty('--kb', `${keyboardHeight}px`);
  document.body.classList.add('keyboard-open');
});
Keyboard.addListener('keyboardWillHide', () => {
  document.documentElement.style.setProperty('--kb', '0px');
  document.body.classList.remove('keyboard-open');
});
Keyboard.setAccessoryBarVisible({ isVisible: false });   // drop the ‹ › Done bar (iPhone only)
// composer: .composer { transform: translateY(calc(-1 * var(--kb, 0px))); transition: transform 250ms ease-out; }
```

- **Resize modes** [src]:
  - `native` resizes the whole WKWebView, which affects `vh`. It is simplest, but reflows the page and moves fixed elements.
  - `body` resizes only `<body>`.
  - `none` resizes nothing; you move the composer yourself using `keyboardHeight`.
- **For a chat composer** `none` plus a transform usually animates smoother and keeps the message list stable [UNVERIFIED preference, not measured].
- **Methods:** `Keyboard.hide()`, `setScroll({ isDisabled })` (iOS), `setResizeMode()`, `getResizeMode()`. `show()` is Android only.
- **Other events:** `keyboardDidShow` and `keyboardDidHide` also exist.

---

## 8. Auth when the bundled app (capacitor://localhost) calls https://kiriya.love/api

- **Origin:** iOS bundled Capacitor apps send `Origin: capacitor://localhost` (Ionic CORS FAQ). Every API call becomes **cross-origin and cross-site**.
- **Cookies:** Capacitor's docs note "As of iOS 14, you cannot use 3rd party cookies by default" [doc capacitorjs.com/docs/apis/cookies]. A cross-site `fetch(..., { credentials: 'include' })` will not reliably carry the `kw` cookie (SameSite=Lax, and WebKit blocks third-party cookies).
- **No same-site workaround:** `server.iosScheme` cannot be `https` [src cli declarations], so the bundle can never be same-site with kiriya.love.

| Option | How | Pros | Pitfalls on iOS WKWebView |
|---|---|---|---|
| **A. Bearer token + CORS (recommended; matches PLAN.md)** | Face ID sign-in (`POST /api/session/app`) returns the session token in JSON as well as the cookie. JS keeps it in memory, with the Keychain as source of truth (native-biometric is already used). Every call sends `Authorization: Bearer`. The server's `readSession` accepts the header when no cookie is present. Add Hono `cors()` for `/api/*`. | Standard fetch, streaming and AbortController all work. Nothing global to patch. Same code path as the widget API. | A **preflight** on every non-simple request (`Authorization`, `x-kw`, JSON). Set `maxAge`; WebKit's cap on preflight caching is [UNVERIFIED]. **`<img>`, `<video>`, `<audio>` and CSS `url()` can't send headers**, so `/api/uploads/media` (cookie-checked [repo]) needs **signed, short-lived URLs** or blob fetches. Vercel Blob's client upload handshake (`/api/uploads/blob`, cookie-checked) needs header auth. A token in JS is exposed to any XSS, so keep it in memory and keep the CSP tight. `x-kw` must be listed in `allowHeaders` (or skipped for bearer requests). |
| B. CapacitorHttp (`plugins.CapacitorHttp.enabled: true`) | Patches global `fetch`/`XMLHttpRequest` [doc]. From the 8.6 source [src `native-bridge.js`]: same-origin and relative URLs use the real fetch; cross-origin **GET/HEAD/OPTIONS** go through a `/_capacitor_http_interceptor_` proxy URL handled natively; **other methods** go through `nativePromise('CapacitorHttp','request')`, buffered. | No CORS. Cookies live in the native cookie store, so the cookie session could work for API calls. | Global patch also affects third-party SDKs. "data can only be a string or a JSON" for the direct API; "parsing and transferring large amount of data from native to the web can cause issues" [doc]. No response streaming for POST, and `AbortSignal` isn't passed to the native call [src reading; UNVERIFIED at runtime]. **Doesn't fix `<img>` media**, which WebKit loads directly with no third-party cookie. |
| C. CapacitorCookies (`plugins.CapacitorCookies.enabled: true`) | Patches `document.cookie` to the native store; adds `getCookies/setCookie/deleteCookie/clearCookies/clearAllCookies` [doc]. | Useful only for non-httpOnly cookies. | The `kw` cookie is **httpOnly**, so JS can't use it anyway. Apple's `WKAppBoundDomains` (≤10 domains) "improves cookie support" [doc]. With `ios.limitsNavigationsToAppBoundDomains: true` it **blocks navigation to any other domain** and needs `localhost` listed too [src cli declarations]. Whether it actually allows third-party cookies to kiriya.love is [UNVERIFIED]. |
| D. Status quo: keep `server.url` | The app is a first-party kiriya.love page | Cookies just work | No instant start or offline use. Live updates can't work, because the plugin swaps local bundles. |

**Server sketch for option A** (Hono's `cors` options checked in `node_modules/hono` types [src]):

```js
import { cors } from "hono/cors";
app.use("*", cors({
  origin: (o) => (o === "capacitor://localhost" ? o : null),
  allowHeaders: ["Authorization", "Content-Type", "x-kw"],
  allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
  maxAge: 600,
  credentials: false,
}));
```

- `app` here is the `/api`-based app in `server/app.js`.
- Register it **before** the CSRF middleware, so the `OPTIONS` preflight is answered.

---

## Cross-cutting Xcode work (none of it is done by `npx cap sync`)

1. **Capabilities.**
   - App Groups `group.love.kiriya.app` on the App, Widget and NSE targets.
   - Keychain Sharing, or reuse the app group as the access group.
   - Push Notifications on the widget extension, only if WidgetKit push is used.
2. **New targets.** Each needs its own bundle id and provisioning; automatic signing in `ios/build.sh` / `ExportOptions-testflight.plist` must cover them [UNVERIFIED for the current export options].
   - **Widget Extension:** deployment target 17 for interactive buttons, otherwise 15. Holds the shared `AppIntent` files.
   - **Notification Service Extension:** holds `envelope.png`.
3. **Native code.**
   - `AppDelegate`: register categories, and wrap `bridge.notificationRouter.pushNotificationHandler` for background actions.
   - `SceneDelegate`: quick-action forwarding.
   - Optional `CAPBridgeViewController` subclass: the swipe gesture, and a local plugin for the shared keychain.
4. **`PrivacyInfo.xcprivacy`:** `NSPrivacyAccessedAPICategoryUserDefaults` / `CA92.1`, required by the updater and the badge plugin [src].
5. **Every native change needs a new TestFlight build.** That includes icons, sounds, extensions, categories and plugins. Only the web bundle is live-updatable.

## Sources

- **npm metadata:** `npm view <pkg> --json` for all packages listed, run 2026-11-24.
- **Package tarballs** (README, `definitions.d.ts`, `Package.swift`, Swift sources) under `scratchpad/pkgs/`:
  - @capgo/capacitor-updater, @capawesome/capacitor-live-update, @capawesome/capacitor-badge, @capawesome/capacitor-app-shortcuts
  - @capgo/capacitor-app-intents, @capacitor-community/app-icon, @capawesome/capacitor-app-icon
  - capacitor-widget-bridge, @capgo/capacitor-widget-kit, capacitor-widgetsbridge-plugin
  - @capacitor/keyboard, @capacitor/push-notifications, @capacitor/local-notifications
  - @aparajita/capacitor-secure-storage, capacitor-secure-storage-plugin, @capgo/capacitor-persistent-account, @capgo/capacitor-transitions
- **Repo `node_modules`:** @capacitor/core types, @capacitor/cli declarations, @capacitor/ios (`NotificationRouter.swift`, `CAPBridgeViewController.swift`, `native-bridge.js`), @capacitor/haptics, @capgo/capacitor-native-biometric, hono, @parse/node-apn.
- **GitHub REST API** repo stats (stars, last push, open issues), fetched 2026-11-24.
- **Capgo:** https://capgo.app/docs/plugins/updater/self-hosted/handling-updates/
- **Apple:**
  - License agreement §3.3.1(B): https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
  - App Review Guidelines 2.2 / 2.5.1 / 2.5.2 / 4.7: https://developer.apple.com/app-store/review/guidelines/
  - TestFlight: https://developer.apple.com/testflight/
  - Apple documentation JSON (`developer.apple.com/tutorials/data/documentation/...`):
    - WidgetKit: adding-interactivity-to-widgets-and-live-activities, keeping-a-widget-up-to-date, updating-widgets-with-widgetkit-push-notifications, widgetpushhandler, widgetcenter/reloadtimelines(ofkind:)
    - UserNotifications: unnotificationserviceextension, unnotificationattachment, unnotificationsound, threadidentifier, generating-a-remote-notification, declaring-your-actionable-notification-types, setbadgecount
    - Xcode: build-settings-reference, configuring-app-groups
    - Security: sharing-access-to-keychain-items-among-a-collection-of-apps
    - UIKit: setalternateiconname(_:completionhandler:)
    - AppIntents: appshortcutsprovider, appshortcut (+ init variants), appintent/openappwhenrun, appintent/supportedmodes
- **Capacitor:** https://capacitorjs.com/docs/apis/http, https://capacitorjs.com/docs/apis/cookies
- **Ionic CORS FAQ** (origin `capacitor://localhost`): https://ionicframework.com/docs/faq/cors
- **Swipe-back community reports:** https://forum.ionicframework.com/t/enable-swipe-from-left-to-right-to-go-back-to-previous-page-ios/246413, https://developer.apple.com/forums/thread/766975
- **Rora reference implementation:** `~/projects/rora/rora-frontend/ios/App/{RoraNotificationService,RoraShared,App/RoraNotifications.swift}`
