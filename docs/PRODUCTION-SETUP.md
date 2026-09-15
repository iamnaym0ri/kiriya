# Kiriya production preparation

Prepared September 14, 2026 (Los Angeles; September 15 in Singapore). **No push, deployment or redeployment was performed by the agent.**

**The owner's latest Production deployment is Ready. Configuration validation and Neon migrations passed.** Kiriya's existing passphrase was verified successfully through the live API and a phone-sized browser; the birthday page opens and the session survives reload. No further environment changes are needed for that login.

The clearer login error messages below are prepared locally for the owner's next push.

## Configured and fixed

- Linked this folder to existing Vercel project `kiriya` (`prj_4bNqxPCD4r6198yn2GyyzxtasHbM`) in the existing team. `.vercel/project.json` is Git-ignored.
- Confirmed `kiriya.love`, `www.kiriya.love` and `kiriya.vercel.app` are verified domains on that project. Its Git integration already tracks `iamnaym0ri/kiriya`, branch `main`, with Vite, Node 24 and `dist` output.
- Set Production `SITE_URL` to `https://kiriya.love` and `KIRIYA_TZ` to `Asia/Singapore`. Preserved the previous Preview values by retaining their original environment entries in Preview and creating distinct Production entries.
- Reused Neon resource `kiriyaa` and private Blob store `kiriya-blob`. Both are already connected to this project's Production and Preview environments. No storage resource or database was recreated.
- Wired both runtime queries and migrations to the integration's `kData_DATABASE_URL`, while retaining an explicit nonempty `DATABASE_URL` override. The last deployed build had logged that it skipped migrations because `DATABASE_URL` was absent.
- Added direct browser uploads through the existing Blob OIDC connection using `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`. A manual `BLOB_READ_WRITE_TOKEN` is no longer required for this connection; existing static-token configurations remain supported. Upload grants require a session, limit the path/type/size/lifetime, and disallow overwriting.
- Preserved authenticated private media delivery and explicit public-profile selection. Added the Vercel HEAD handler and coverage for private reads, byte ranges, public selection and revocation.
- Made malformed passphrase hashes fail safely so a bad Kiriya hash cannot crash a valid admin login. Added a controlled response when the login configuration is absent.
- Repaired the missing/invalid Production admin hash after the owner's build identified it as the only configuration blocker. Saved the generated phrase privately and preserved the previous Preview entry. Kiriya's existing hash and the session secret were retained.
- Added a readable wrong-passphrase alert, input highlighting and focus for correction. Connection problems, unavailable servers and too many attempts have distinct messages. Editing the phrase clears the previous error.
- Added production configuration validation before migrations. Missing/invalid required settings stop the build; optional QStash, push, OpenAI and TextAlive configuration does not block login or uploads.
- Updated the hash utility to support private input/output files without echoing the phrase or hash. Database migration and API error logging omit raw provider errors that could contain credentials.

## Verified

| Check | Result |
| --- | --- |
| Vercel project, Git branch, domain and storage attachment metadata | Confirmed through the authenticated Vercel API |
| Blob access mode | `private`; Production and Preview permitted |
| Existing sensitive settings | Kiriya's hash, `SESSION_SECRET`, database and Blob settings retained; the invalid Production admin hash was repaired |
| Deployment state | Owner's latest deployment is Ready; no agent-triggered deployment |
| Production database | Owner's build applied Neon migrations successfully |
| Live Kiriya login | Supplied phrase accepted; birthday page opens on a 390px phone browser and remains unlocked after reload |
| Login error presentation | Wrong phrase, HTTP 500/503, rate limits and connection failure checked in a local browser; alert fits 320px and 390px screens |
| Local regression tests | `npm test`: 10 passed, using in-memory PGlite and mocked provider requests |
| Production-mode login and admin | Secure/HttpOnly sessions, role separation, expired/changed sessions and invalid-hash behavior passed locally |
| Upload and image delivery | Session gate, signed-grant limits, private read denial, public allowlisting, revocation, HEAD and byte ranges passed with the real SDK against mocked provider responses |
| Frontend production build | `npm run build` passed, including the private-string leak check |

Local regression tests used isolated databases; browser error checks used mocked login responses. No production fixture, reset, media upload or content write was performed. Live login checks created normal authentication audit records. Production migrations ran in the owner's deployment.

## What still needs confirmation

### Login settings are ready

Production configuration validation passed for both hashes and the session secret. Kiriya's supplied phrase also passed actual authentication, so it was preserved. No phrase or hash belongs in this report or in Git. Sensitive variables remain unreadable through the Vercel API; successful live authentication verifies the Kiriya configuration without exposing them. [Vercel Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

### Checks at the next owner deployment

- Confirm the new login error presentation on the deployed page after pushing this change.
- Real OIDC browser uploads and private Blob reads must succeed in Production. The available local project identity is for Development, which the existing storage connection rejects. The connection's environment restrictions were retained.
- Check login on her physical phone; the successful phone check above used Chromium emulation. Admin login and private-image checks can be completed when those features are needed.

The SDK's supported OIDC upload method and automatic identity-token handling were checked against [Vercel's Blob reference](https://vercel.com/docs/vercel-blob/using-blob-sdk). No production identity token was copied into settings.

## Owner publishing commands

The production setup is already deployed. Push the prepared login-message commit through the existing Git integration:

```bash
cd ~/projects/birthday
git push origin main
```

That owner push uses the existing Git integration to build and deploy `kiriya`. No additional Vercel project, storage connection or separate CLI deployment is needed. In **Vercel → kiriya → Deployments**, inspect the new build for successful configuration validation, migrations and the frontend build.

After it becomes Ready:

```bash
curl --fail --silent --show-error https://kiriya.love/api/health
```

Then complete the browser checks in [SETUP.md](SETUP.md#checks-after-the-owner-deploys). Optional notification setup can follow after login and uploads are working.

## Private local files

The previously generated admin phrase is in `.data/production-setup/login-phrases.txt` (Git-ignored, mode `600`, directory mode `700`). No new Kiriya phrase was generated; her existing supplied phrase works.

The Git-ignored `.data/production-setup/` directory contains restricted local audit metadata and verification logs. It is not a deployment artifact. `.env.local` remains the local-development configuration.
