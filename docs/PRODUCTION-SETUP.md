# Kiriya production preparation

Prepared September 14, 2026 (Los Angeles; September 15 in Singapore). **No push, deployment or redeployment was performed.**

The production wiring and local fixes are prepared. **The existing Sensitive login hashes and session secret still need confirmation**: Vercel hides their values, so their presence alone does not establish that valid credentials were entered. They have been preserved, not replaced. No new login phrases were generated.

## Configured and fixed

- Linked this folder to existing Vercel project `kiriya` (`prj_4bNqxPCD4r6198yn2GyyzxtasHbM`) in the existing team. `.vercel/project.json` is Git-ignored.
- Confirmed `kiriya.love`, `www.kiriya.love` and `kiriya.vercel.app` are verified domains on that project. Its Git integration already tracks `iamnaym0ri/kiriya`, branch `main`, with Vite, Node 24 and `dist` output.
- Set Production `SITE_URL` to `https://kiriya.love` and `KIRIYA_TZ` to `Asia/Singapore`. Preserved the previous Preview values by retaining their original environment entries in Preview and creating distinct Production entries.
- Reused Neon resource `kiriyaa` and private Blob store `kiriya-blob`. Both are already connected to this project's Production and Preview environments. No storage resource or database was recreated.
- Wired both runtime queries and migrations to the integration's `kData_DATABASE_URL`, while retaining an explicit nonempty `DATABASE_URL` override. The last deployed build had logged that it skipped migrations because `DATABASE_URL` was absent.
- Added direct browser uploads through the existing Blob OIDC connection using `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`. A manual `BLOB_READ_WRITE_TOKEN` is no longer required for this connection; existing static-token configurations remain supported. Upload grants require a session, limit the path/type/size/lifetime, and disallow overwriting.
- Preserved authenticated private media delivery and explicit public-profile selection. Added the Vercel HEAD handler and coverage for private reads, byte ranges, public selection and revocation.
- Made malformed passphrase hashes fail safely so a bad Kiriya hash cannot crash a valid admin login. Added a controlled response when the login configuration is absent.
- Added production configuration validation before migrations. Missing/invalid required settings stop the build; optional QStash, push, OpenAI and TextAlive configuration does not block login or uploads.
- Updated the hash utility to support private input/output files without echoing the phrase or hash. Database migration and API error logging omit raw provider errors that could contain credentials.

## Verified

| Check | Result |
| --- | --- |
| Vercel project, Git branch, domain and storage attachment metadata | Confirmed through the authenticated Vercel API |
| Blob access mode | `private`; Production and Preview permitted |
| Existing sensitive settings | Both hash variables, `SESSION_SECRET`, database and Blob token entries retain their original metadata and targets |
| Deployment state | Latest deployment ID unchanged after the settings updates |
| Local regression tests | `npm test`: 10 passed, using in-memory PGlite and mocked provider requests |
| Production-mode login and admin | Secure/HttpOnly sessions, role separation, expired/changed sessions and invalid-hash behavior passed locally |
| Upload and image delivery | Session gate, signed-grant limits, private read denial, public allowlisting, revocation, HEAD and byte ranges passed with the real SDK against mocked provider responses |
| Frontend production build | `npm run build` passed, including the private-string leak check |

No local test used the production database. No production fixture, reset, schema migration, media upload or content write was performed.

## What still needs confirmation

### Existing login settings

The following Production variables exist as **Sensitive**, but Vercel returns no readable value:

- `KIRIYA_PASSPHRASE_HASH`
- `ADMIN_PASSPHRASE_HASH`
- `SESSION_SECRET`

Confirm whether real values were saved or whether they are empty/placeholders. If real, retain them. If empty, identify which ones so only the missing values can be generated and configured through the existing authorized access. Do not post phrases, hashes or secrets in chat. There are no supplied production phrases in the local environment files; local development credentials are not production credentials.

Vercel explicitly makes Sensitive values unreadable after creation. This is why an empty API response was not treated as permission to replace an existing secret. [Vercel Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

### Checks at the next owner deployment

- Production configuration validation must pass with the actual runtime values.
- Neon connectivity and schema migration must succeed using `kData_DATABASE_URL`. The storage credential endpoint requires Vercel owner reauthentication (`challenge_required`); no separate local Neon credentials were available. Direct SQL access was therefore not verified.
- Real OIDC browser uploads and private Blob reads must succeed in Production. The available local project identity is for Development, which the existing storage connection rejects. The connection's environment restrictions were retained.
- Confirm both actual phrases work on the deployed domain; Kiriya cannot access `/admin`; sessions survive reloads; private images remain locked when signed out. Check the same flows on her phone.

The SDK's supported OIDC upload method and automatic identity-token handling were checked against [Vercel's Blob reference](https://vercel.com/docs/vercel-blob/using-blob-sdk). No production identity token was copied into settings.

## Owner publishing commands

After confirming the three login settings above, the following stages this production setup pass. Review the staged diff before committing. Other ongoing design edits can be included deliberately during that review.

```bash
cd ~/projects/birthday
git diff --check
git add .env.example README.md docs/SETUP.md docs/PRODUCTION-SETUP.md \
  api/index.js package.json \
  scripts/check-production-config.mjs scripts/hash-passphrase.mjs \
  scripts/migrate.mjs scripts/setup-qstash.mjs scripts/test-production.mjs \
  server/app.js server/auth/passphrase.js server/env.js server/configuration.js \
  server/lib/blob.js server/push/webpush.js server/routes/admin.js \
  server/routes/session.js server/routes/uploads.js \
  src/admin/Admin.jsx src/lib/uploads.js
git diff --cached
git commit -m "Prepare Kiriya production login and private uploads"
git push origin main
```

That owner push uses the existing Git integration to build and deploy `kiriya`. No additional Vercel project, storage connection or separate CLI deployment is needed. In **Vercel → kiriya → Deployments**, inspect the new build for successful configuration validation, migrations and the frontend build.

After it becomes Ready:

```bash
curl --fail --silent --show-error https://kiriya.love/api/health
```

Then complete the browser checks in [SETUP.md](SETUP.md#checks-after-the-owner-deploys). Optional notification setup can follow after login and uploads are working.

## Private local files

**New production login phrases: none.** Existing unreadable secrets were preserved.

The Git-ignored `.data/production-setup/` directory contains restricted local audit metadata and verification logs. It is not a deployment artifact. `.env.local` remains the local-development configuration.
