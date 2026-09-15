# Production setup for kiriya.love

Use the existing Vercel project **kiriya**, Neon resource **kiriyaa**, and **private** Blob store **kiriya-blob**. All three already exist. The two stores are connected to this project's Production and Preview environments. Do not create replacements.

See [the current preparation report](PRODUCTION-SETUP.md) for completed work, unresolved verification and exact publishing commands. The original handoff predates these accounts and connections.

## Project and build

The local `.vercel/project.json` links this folder to `kiriya`. It is Git-ignored. Vercel uses the Vite preset, Node 24, and `dist` output. The existing Git integration watches `main` in `iamnaym0ri/kiriya`.

`vercel.json` runs `npm run vercel-build`, which:

1. Checks the required production configuration, reporting names and problems without secret values.
2. Applies the existing Drizzle migrations to the configured Neon database.
3. Builds the frontend and checks it for private server strings.

A missing database now fails the production build instead of silently skipping migrations. This prevents a successful-looking deployment whose login cannot access its database. `npm run build` remains a local frontend build with no migrations or database writes. `npm test` uses isolated in-memory PGlite databases and mocked provider requests.

The owner performs every push and deployment. Environment changes apply to a subsequent deployment; they do not update the current function environment. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Required environment

| Purpose | Configuration |
| --- | --- |
| Site origin | `SITE_URL=https://kiriya.love` |
| Birthday and local dates | `KIRIYA_TZ=Asia/Singapore` |
| Private-world login | `KIRIYA_PASSPHRASE_HASH`, in this application's scrypt format |
| Admin login | A separate `ADMIN_PASSPHRASE_HASH` |
| Signed sessions | A random `SESSION_SECRET` of at least 32 characters |
| Neon | Existing integration-managed `kData_DATABASE_URL`; an explicit nonempty `DATABASE_URL` takes precedence |
| Private Blob with Vercel authentication | Existing `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`; Vercel supplies and refreshes `VERCEL_OIDC_TOKEN` |
| Legacy Blob alternative | `BLOB_READ_WRITE_TOKEN` if using a static-token connection instead |

Do not copy production secrets into `.env.local`: local development should keep using its existing PGlite database and local uploads. `.env.local`, `.data/` and `.vercel/` are ignored by Git. Never put credentials in `VITE_` variables, public assets, screenshots, documentation or commit messages.

### Login phrases

Existing valid hashes and the session secret should remain in place. Vercel's **Sensitive** variables are unreadable after saving, so an empty API response for one of those variables does not prove that its stored value is empty. See [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

Use separate phrases for Kiriya and admin. The app normalizes case, whitespace and smart quotes for phone entry. For a replacement phrase, save the phrase in a private local file and create its hash without putting either value in terminal output:

```bash
mkdir -p .data/private
chmod 700 .data/private
# Save the chosen phrase in .data/private/phrase.txt using your editor.
chmod 600 .data/private/phrase.txt
npm run hash -- --file .data/private/phrase.txt --output .data/private/passphrase.hash
```

Copy the hash into the matching Vercel Production variable using the dashboard. The original phrase stays local; do not paste it into the hash variable. The command preserves an existing output file. Changing a role's hash invalidates its sessions; changing `SESSION_SECRET` signs out both roles.

## Storage and images

### Neon

The existing integration uses the **kData** prefix. Both runtime queries and the migration command now use the same connection resolver: `DATABASE_URL`, falling back to `kData_DATABASE_URL`. Leave the managed values in place so the integration can maintain them.

The schema migrations contain no reset or fixture loading. Do not run browser fixture scripts, reset commands or local test data against production. The owner's latest Production build applied migrations successfully, and live Kiriya authentication confirmed runtime database access.

### Private Blob

The connected store uses Vercel's short-lived identity tokens (OIDC). The client requests a signed upload grant only after unlocking, then uploads straight to Blob so large photos do not pass through the function's request-body limit. Each grant permits one pathname, supported media types and at most 15 MB, expires after ten minutes, adds a random filename suffix and prevents overwriting.

The current SDK requires `handleUploadPresigned` / `uploadPresigned` for OIDC browser uploads. The older `handleUpload` route signs client tokens with a static read-write token, so the app retains that flow only for legacy token configurations. See [Blob authentication and upload methods](https://vercel.com/docs/vercel-blob/using-blob-sdk).

All new uploads request **private** access. Stored application URLs use `/api/uploads/media?path=...`; the API checks the session and streams private bytes with `private, no-store` headers. It supports HEAD and byte-range reads. Only media explicitly selected for the public profile is readable without a session. Signed upload grants do not grant private-image read access.

The `kiriya-blob` connection currently permits Production and Preview, not Development. A local development identity cannot read it; that is an environment restriction, not evidence of a broken production connection. Leave local development on its existing file storage.

## Optional integrations

Login, admin, sketch saving and image uploads do not require QStash, VAPID, OpenAI or TextAlive. Do not fill optional fields with placeholder tokens. Existing values are preserved by this preparation pass.

For notifications later, configure the existing QStash integration and VAPID public/private keys with a real contact. Reuse the existing scheduler and inspect schedules before running `npm run setup:qstash`. On iPhone, install the site from Safari and enable notifications through its Settings page. Notification permission and actual delivery need a real device check.

## Checks after the owner deploys

1. Check build output for successful configuration validation, migration and frontend build. Resolve any named missing configuration before retrying.
2. Open `https://kiriya.love/api/health`, then unlock `/world` with Kiriya's phrase and `/admin` with the admin phrase. Confirm Kiriya's session cannot open admin controls.
3. Save a drawing and upload a photograph. Reload and reopen them. Check that a copied private media URL is locked in an incognito window and that the underlying Blob URL also denies anonymous access.
4. Select a public avatar in admin and verify only that chosen image appears on the public page. Remove the selection to confirm public access is revoked.
5. On the actual phone, test cookie persistence, drawing, image loading and audio playback. Optional push and scheduler verification can follow separately.

Personal content and visual asset follow-up remain in [the redesign handoff](redesign/IMPLEMENTATION.md).
