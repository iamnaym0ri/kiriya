# Her remembered choices, public profile, phone notes and widget

What this adds, how it keeps the public and private sides apart, and how to test it on an iPhone.

## What she gets

| Feature | Where |
| --- | --- |
| Her check-in (presentation, pronouns, mood, social battery) stays until she changes it. The corner shows "since Tuesday" once it carries over. | Feeling corner, `/world?quick=status` |
| Motion on/off and corner size follow her to every device, including the Home Screen app. | Server preferences |
| Choose what friends see: pronouns, presentation, mood, social battery. Everything starts hidden. | Settings → What your friends can see |
| Pin up to 6 gallery pieces to a board on the public page. | Gallery viewer → Pin to your public profile |
| Change her passphrase and sign out other devices. | Settings → Your passphrase |
| Notes sent to her phone, all kept in a "notes for you" page with read receipts. | `/world/notes`, heart icon, home slip |
| One-tap buttons (Apple Shortcuts) and a Home/Lock Screen widget (Scriptable). | Settings → Widget & one-tap buttons |

Unlocked, `kiriya.love` opens her world directly. "Your public profile" in the footer shows exactly what visitors see (`/?view=public`). Her private corner, colours and wording never appear on the public page.

## How public and private stay apart

- `/api/public/profile` returns only the check-in fields she switched on and her pinned artwork. The labels come from the server, so the public JavaScript build still contains no identity wording. `npm run build` checks this.
- A gallery image is readable without a session only while it is pinned on Kiriya's board.
- Browsers always revalidate the public profile. Vercel's CDN keeps a copy for 15 seconds (`Vercel-CDN-Cache-Control`), so changes reach visitors within about a minute.
- **The admin role is a test copy.** Check-ins, sharing, pins, notes, widget keys and home suggestions are all stored per role (`person_state`, `love_notes.recipient`, `device_keys.person`). Testing on your iPhone as admin never changes what Kiriya or her friends see. Your admin preview of the public page shows your test choices.

## Passphrases

A phrase changed in Settings is stored as a scrypt hash in the `credentials` table and takes precedence over the Vercel variable for that role. The device making the change stays signed in. "Sign out other devices" rotates that role's session key and turns off its widget keys.

If Kiriya forgets a phrase she chose, **Admin desk → Passphrases → reset** returns her to the phrase configured in Vercel and signs out her devices. If you forget your own admin phrase after changing it, clear the row in the Neon console. This reverts to `ADMIN_PASSPHRASE_HASH` and signs out old admin sessions:

```sql
update credentials set hash = null, session_key = 'reset-' || extract(epoch from now()) where role = 'admin';
```

Every session lasts **two days** from unlocking, even while in use, for both roles. That includes cookies issued before this change. When a session ends while the app is open, the app returns to the passphrase sheet on the next request or when it comes back to the front. Widget keys don't expire with sessions; they last until turned off, or until "sign out other devices".

## Notes to her phone

Compose from **Admin desk → Little notes to her phone**: send now, at a Singapore time, or "surprise me" (a random time inside her notification hours). Send to "my test devices" to try it on your own phone.

- Every note appears in her notes page at its time, whether or not a notification got through. The admin list shows delivery per device, and when she read it.
- Timed notes use the existing QStash integration, which calls `POST /api/jobs/love-note` (signed). Duplicate callbacks can't send twice.
- The daily backstop (`/api/jobs/backstop`, 00:20 Singapore) delivers any note whose callback was lost. Outside her notification hours, or when more than 2 hours late, those arrive without a buzz.
- A new letter can notify her immediately, or when it unlocks (checkbox on the letter form).
- Notification taps open the exact note. The app icon badge shows the unread count.

## Widget and one-tap buttons

No iOS version lets a Home Screen web app provide widgets (checked against iOS 27). Two free apps fill the gap without any App Store publishing:

- **Shortcuts** (built in): a one-tap "my little status" button for the Home Screen, Lock Screen or Control Center. It changes battery, mood or presentation without opening anything. A second shortcut can show her newest note.
- **Scriptable** (free): a Home Screen or Lock Screen widget showing her status and newest note. It refreshes when iOS allows, roughly every 15–60 minutes. A tap opens Safari, not the Home Screen app. Scriptable was last updated in 2024, so confirm it works on your iOS version before setting it up on her phone.

Both use a device key from Settings instead of the passphrase. Only a SHA-256 hash is stored, a person can have up to 5 keys, and each can be turned off. A key reaches only `/api/widget`, `/api/widget/menu`, `/api/widget/note` and `PUT /api/widget/status`. Reads also accept `?key=` for apps that can't set headers; changes require the `Authorization: Bearer` header.

To save her the setup, you can build the two shortcuts once on your phone with **Import Questions** for the key, then share the iCloud links. She pastes her own key when adding them.

A real interactive widget would need a native app: the $99/year Apple Developer Program plus a Mac with Xcode (TestFlight builds last 90 days). Free signing expires every 7 days.

## Deploying

The migration `0003_personal_world` only adds four tables (`credentials`, `person_state`, `love_notes`, `device_keys`) and two indexes. `npm run vercel-build` applies it. Production already has the VAPID keys, QStash token and signing keys, and `CRON_SECRET`; no new environment variables are needed.

Kiriya's existing check-in and pronoun choices are picked up automatically the first time the new code reads them. Nothing becomes public until she switches it on.

## After you push: testing as admin

### 1. Confirm the deploy

In Vercel → kiriya → Deployments, wait for the new build to be **Ready**. The build log should show `✓ Migrations applied.` and `✓ Leak check passed`. Then from a terminal:

```bash
curl -s https://kiriya.love/api/health                              # {"ok":true}
curl -s https://kiriya.love/api/widget                              # {"error":"locked",...}: the new code is live (old code says not_found)
curl -sI https://kiriya.love/api/public/profile | grep -i cache-control   # public, max-age=0, must-revalidate
```

### 2. Admin desk on a computer

Open `https://kiriya.love/admin` and unlock with the **admin** phrase (saved privately in `.data/production-setup/login-phrases.txt`). Admin is the easiest place to write notes. New cards: **Little notes to her phone** and **Passphrases**. "Preview Kiriya's world" opens `/world` as your test copy. When signed in, `kiriya.love` itself goes to `/world`; type `/admin` to come back.

### 3. Install on your iPhone

1. In Safari open `https://kiriya.love`, tap Share → **Add to Home Screen** (keep "Open as Web App" on) → Add.
2. Open **kiriya** from the Home Screen and unlock with the **admin** phrase. The Home Screen app keeps its own sign-in, separate from Safari, and asks again every two days.
3. Settings (gear) → **Notes & surprises on your phone** → Turn on → Allow → **Send a test**.
4. Settings → **This device** → **Open the admin desk** is there when you're signed in as admin, since the app has no address bar.

### 4. Notes

1. Admin desk → Little notes to her phone → **To my test devices** → title and note → Send now.
2. The notification should arrive. Tapping it opens that note in the app. The admin list then shows "read".
3. Schedule one 3–5 minutes ahead ("At a time", Singapore time) to test QStash. Then try **Surprise me**, which picks a time inside the notification hours.
4. A letter with "Tell her phone" ticked notifies **Kiriya's** devices, not yours. Use it only once you're happy.

### 5. Shortcuts one-tap button (built into iOS)

First make a key: in the kiriya app, Settings → **Widget & one-tap buttons** → name it → **Make a widget key** → **Copy key**. The key is shown only once. You can press and hold it to copy manually.

Then in the **Shortcuts** app → **+**:

1. Add **Get Contents of URL**. URL `https://kiriya.love/api/widget/menu`. Tap ▸ to show more → Headers → Add new header: key `Authorization`, value `Bearer ` followed by your key (one space after Bearer).
2. Add **Get Dictionary Value** → Get *Value* for key `choices` in *Contents of URL*.
3. Add **Choose from List** (list = Dictionary Value).
4. Add **Get Contents of URL**. URL `https://kiriya.love/api/widget/status`, Method **PUT**, the same Authorization header, Request Body **JSON** → Add new field → Text → key `pick`, value = the *Chosen Item* variable.
5. Add **Get Dictionary Value** → key `message` in *Contents of URL* → add **Show Notification** with that value.
6. Name it "my little status" and run it. Pick "🔋 battery · …", and the notification should say `social battery: … ✓`.
7. Home Screen: press and hold → Edit → Add Widget → **Shortcuts** → choose the shortcut. For the Lock Screen or Control Center: add controls → Shortcuts → Run Shortcut.

Newest note: a second shortcut with **Get Contents of URL** `https://kiriya.love/api/widget/note` (same header) → **Get Dictionary Value** `text` → **Show Result**.

As admin, these change and read your **test** status and notes. Check with Settings → What your friends can see → "See it like your friends do", which is your admin preview.

To give Kiriya the same button without her building it: in each Get Contents of URL action, replace your key with an **Import Question** (shortcut settings ⓘ → Import Questions), then share the shortcut's iCloud link. She pastes her own key when adding it.

### 6. Scriptable widget

1. Install **Scriptable** from the App Store (free).
2. In the kiriya app: Settings → Widget & one-tap buttons → Make a widget key (or use a fresh one) → **Copy widget script**.
3. Scriptable → **+** → paste → tap the title at the top and rename it `kiriya` → Done. Tap ▶ to preview. You should see "kiriya ✦", your status and newest note.
4. Home Screen: press and hold → Edit → Add Widget → **Scriptable** → pick Small/Medium/Large → Add. Press and hold the new widget → **Edit Widget** → Script: **kiriya**. Leave "When Interacting" alone; the script decides what a tap opens.
5. Lock Screen: press and hold → Customize → Lock Screen → tap the widget row → **Scriptable** → add the rectangular one → tap it → Script: **kiriya**.
6. It refreshes when iOS allows, roughly every 15–60 minutes. Tapping opens Safari, so you may need to unlock there separately. If Scriptable misbehaves on your iOS version, use the Shortcuts button instead.

### 7. Separation checks

- In a **private** Safari tab (signed out), open `kiriya.love`. It must show only what **Kiriya** shared, never your test choices.
- Pin a doodle as admin: it appears in your admin preview only, not in the private tab.
- Optional: change your admin passphrase in Settings with "sign out my other devices". The Home Screen app asks for the new phrase, and your widget keys stop working.

Automated coverage: `scripts/test-personal-world.mjs` (API flows, two-day sessions, isolation, passphrases, notes, widget keys) and `scripts/test-checkin.mjs` (carry-over, legacy data, admin separation).
