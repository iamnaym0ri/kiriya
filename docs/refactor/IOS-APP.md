# The kiriya.love iPhone app

A real app on her Home Screen, named **kiriya.love**, with "kiriya" in the site's cursive on lilac.
It shows the live site in its own window, never in Safari. Updates to the site appear in the app
without a rebuild. Native pieces:

- **Face ID.** The passphrase opens the app once. After that, Face ID opens it on launch and after
  five minutes away. The sign-in key lives in the iPhone Keychain, and the Keychain itself requires
  a face match before it hands the key over. Changing her passphrase, tapping "Lock" in Settings,
  or using **Forget this phone** in admin retires the key.
- **Notifications through Apple (APNs).** Every notification the site already sends goes to the
  app as well: little notes, the note jar's morning push, daily surprises and test pushes. Tapping
  one opens the page it's about.
- **Offline page.** With no signal, a lilac "your little world needs a bit of signal" page shows
  instead of an error.

Code map:

| What | Where |
| --- | --- |
| Capacitor config: app id, name, live URL | `capacitor.config.json` |
| iOS project: icon, Face ID text, push entitlement, token hand-off | `ios/App/` |
| Face ID lock screen and notification taps (loaded only inside the app) | `src/shared/NativeApp.jsx` |
| Native helpers | `src/lib/native.js` |
| Server: device sign-in, push tokens, forget | `server/routes/app.js`, `server/lib/appDevices.js` |
| Server: Apple push | `server/push/apns.js` (fanned out from `sendToSubscribers`) |
| Icon and launch image | `scripts/make-app-icon.mjs` |
| Mac build script | `ios/build.sh` |
| Install page | `public/install/` → https://kiriya.love/install/ |

Libraries: Capacitor 8 (MIT), `@capgo/capacitor-native-biometric` (MPL-2.0), `@parse/node-apn`
(MIT), `fontkit` (MIT, icon rendering only), and the Parisienne font (SIL OFL).

## How she gets it: TestFlight (chosen 2026-11-24)

She installs **TestFlight**, Apple's own free app for private apps, from the App Store, then
accepts your invitation to **kiriya.love** inside it. There is no App Store listing and no
Developer Mode. https://kiriya.love/install/ walks her through it.

- **Updates.** Most updates are just a site deploy and appear in the app right away. A new upload
  is only needed when native parts change (the icon, plugins, Info.plist). With **Automatic
  Updates** on in TestFlight, a new build reaches her phone by itself.
- **The 90-day rule.** Every TestFlight build stops opening 90 days after upload. Run
  `ios/build.sh testflight` about every 80 days. The script prints the next due date, so put it in
  your calendar.

### Rollout order (owner, 2026-11-24)

1. Josh tests on **his own iPhone** first, as an internal tester. A build is testable as soon as
   Apple finishes processing it (about 10–30 minutes); internal testing has no Apple approval step.
2. Once everything is fully tested, Josh invites Kiriya and tells her, and she starts using it. If
   she is invited as an *external* tester, Apple's Beta App Review must approve that build first.

### One-time setup (Josh, on the Mac)

1. **Apple push key.** Go to developer.apple.com → Certificates, IDs & Profiles → Keys → "+".
   Tick **Apple Push Notifications service (APNs)**, then download the `.p8` file; it can only be
   downloaded once. In Vercel → Project → Settings → Environment Variables, add these as
   *Sensitive*:
   - `APNS_KEY`: the `.p8` file's contents
   - `APNS_KEY_ID`: the key's ID
   - `APNS_TEAM_ID`: `9W8CN9V8NR` (already the default)
   - `APNS_BUNDLE_ID`: `love.kiriya.app` (already the default)
2. **The app record.** In App Store Connect → Apps → "+" → New App, choose iOS and bundle ID
   `love.kiriya.app`. Xcode registers that bundle ID the first time it signs, so if it isn't in the
   list yet, run step 3 once and come back. App Store Connect names must be unique across the whole
   store, so if "kiriya.love" is taken, use something like "kiriya.love ✦ private". The name under
   the icon on her phone stays **kiriya.love** either way.
3. **Upload.** Sign in to Xcode with your Apple ID (Xcode → Settings → Accounts), then run
   `ios/build.sh testflight` from the repo. Apple processes the build in about 10–30 minutes.
4. **Invite her.** In App Store Connect → the app → TestFlight, choose one of two ways:
   - **Internal tester (recommended for privacy of her world).**
     - Add her in Users and Access with the **Marketing** role. Internal testers must have Admin,
       App Manager, Developer or Marketing.
     - If App Store Connect offers it for that role, limit her to the kiriya.love app only.
     - She accepts the team invite with her Apple ID. Then add her as an internal tester.
     - **No Apple review**, and builds are available as soon as they finish processing. The cost is
       that she joins your developer team as a limited user.
   - **External tester.**
     - Invite her by email; she never joins your team.
     - The first build of each version goes through **Beta App Review**. Apple will ask how
       reviewers can sign in, which means giving Apple's review team a way past the passphrase into
       her private world.
5. **Deploy the site** with phases 1–3, so Face ID sign-in and native push exist on the server.
   Then send her https://kiriya.love/install/.

TestFlight builds use Apple's production push service, which is what the server uses by default.

### Your own phone

Accept your own internal-tester invite the same way. Alternatively, plug your iPhone in and run
`ios/build.sh run <udid>` for a debug build; that kind of build needs Developer Mode on your phone
only. When you open the app with the admin passphrase, your phone becomes a test device, the same
as on the website.
