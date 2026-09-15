# Putting iloveukiriya.com online

This is a setup reference; the redesign has not been deployed. The app works locally without production accounts. Complete the consolidated owner checklist in [the redesign report](redesign/IMPLEMENTATION.md) before releasing it.

## Repository and Vercel

Create a private repository and connect it to a Vercel project with the Vite framework preset. The configured production build runs migrations and then the frontend build/leak check. Keep `.env.local`, `.data/`, handoff documents and personal originals outside public assets; the Vite output only serves `public/` and compiled client files.

## Storage

- Connect Neon Postgres and set `DATABASE_URL`. Existing Drizzle migrations run through `npm run vercel-build`.
- Create a **Private** Vercel Blob store, connect it and set `BLOB_READ_WRITE_TOKEN`. New image/audio uploads request private access. Browser-visible paths use `/api/uploads/media?path=...`; the API streams bytes after checking the session or an explicit public profile selection.
- An old **Public** Blob store is not made private by changing the frontend. If production already contains public personal objects, migrate them to private storage, update stored URLs and retire the old public objects as a separately reviewed migration. The inspected local database had no such Blob objects.

## Environment

Use `.env.example` as the current list. Set production values for `SITE_URL`, `KIRIYA_TZ`, both passphrase hashes, `SESSION_SECRET`, database and private storage. Make hashes with:

```bash
npm run hash -- "Kiriya's chosen phrase"
npm run hash -- "Your admin phrase"
openssl rand -base64 32
```

Use the last command’s output as a strong session secret. Changing that secret invalidates sessions. Passphrases normalize case and extra whitespace. Keep secrets in the hosting environment, never in client-prefixed variables or source.

No OpenAI key or TextAlive token is required by the redesigned site. Retired adapters remain as source history only.

## Optional notifications

Reuse the existing QStash account/scheduler: `QSTASH_TOKEN`, current/next signing keys, and `CRON_SECRET`. Set `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and an actual contact in `VAPID_SUBJECT`. Generate VAPID keys once with the existing web-push package.

After the domain is working, run the existing `npm run setup:qstash` with production environment values available. Check for an existing schedule before creating one. The daily job chooses from the finite reviewed collection using Singapore dates and existing repeat history; it does not fetch news or call an AI writer. The configured Vercel cron is the backstop for the same job.

Preferences in private Settings reconcile pending deliveries and are rechecked immediately before sending. Disabled, off-scope, expired and superseded deliveries are skipped. Notification previews contain generic teasers, not private notes or manga spoilers.

On iPhone: open in Safari, use **Share → Add to Home Screen**, open the installed app, unlock, then use **Settings → Turn on surprises**. Browser permission is requested only by that action. Use **Send a test** to check actual delivery. The app works without notifications.

## Admin and launch review

`/admin` retains editing of real letters, notes, signature and public profile images, plus the existing job controls. Select a public song using the star in the private music shelf. New uploaded recordings remain private until selected.

Use the [single owner-action list](redesign/IMPLEMENTATION.md#owner-actions-before-release) for personal materials, reuse permissions and device/production checks. Local screenshots and automated checks do not establish real iPhone push delivery, provider playback availability, private Blob operation or Neon deployment.
