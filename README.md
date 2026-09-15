# kiriya.love

Kiriya’s little lilac world: a floral public profile and a private, illustrated collection of cosplay, art, Maomao and Miku-led music. The birthday gift and letters are available all year.

- [Redesign report](docs/redesign/IMPLEMENTATION.md)
- [Asset and source register](docs/redesign/ASSETS.md)
- [Production setup](docs/SETUP.md)
- [Current production preparation and publishing steps](docs/PRODUCTION-SETUP.md)
- [Execution brief](docs/execute.md) and [original handoff](docs/HANDOFF-REPORT.md)

## Run locally

```bash
npm install
npm run setup   # first-time local secrets and push keys
npm run dev     # http://localhost:5173
```

Local storage uses PGlite in `.data/` and files in `.data/uploads/`. Development passphrases are **kiriya** for her world and **admin** for `/admin`. Run one development server per local database; stop it cleanly with Ctrl+C.

## Structure

| Area | Location |
| --- | --- |
| Public floral profile and private door | `src/public/ProfilePage.jsx` |
| Home and four illustrated collections | `src/world/today/`, `src/world/collection/` |
| Drawing canvas and paint mixer | `src/world/studio/` |
| Music shelf and shared persistent player | `src/world/stage/`, `src/shared/music/` |
| Letters, year-round gift, settings | `src/world/letters/`, `src/world/today/BirthdayTakeover.jsx`, `src/world/settings/` |
| Design foundations and component styles | `src/styles/world-design.css` and adjacent component CSS |
| Admin: real letters, notes, public photos, delivery | `src/admin/` |
| Hono API and authenticated media | `server/routes/` |
| Finite sourced selection and existing daily job | `server/content/collection.js`, `server/engine/` |
| Optional notification planning and delivery | `server/push/` |

Retired source modules remain in the repository as history; they are not part of active routes or the daily content path. No AI service, broad news feed, training dashboard or additional scheduler is required.

## Checks

```bash
npm test              # isolated content, login, admin and private-media regression checks
npm run build         # production build and private-string leak check
npm run verify:redesign # browser flows/screenshots against an already-running local dev server
```

The browser script uses Playwright Chromium (`npx playwright install chromium` if needed). It uses the development passphrase, creates temporary records, restores the prior featured song, and removes its test records. `VERIFY_BASE_URL` changes the local target. Do not run it against a production gift database.

Other commands: `npm run icons`, `npm run hash -- --file .data/phrase.txt --output .data/passphrase.hash`, `npm run db:generate`, `npm run db:migrate`, `npm run setup:qstash`. `npm run check:production` validates required server configuration without printing values or contacting the database.

## Privacy and credits

Private identity, preferences, letters and notes are returned only after unlock and never belong in client source. New production uploads require a **private Vercel Blob store** and are served through the authenticated API. Explicit public profile media is allowlisted.

Character and maker credits are available in **Art & credits**. The [asset register](docs/redesign/ASSETS.md) distinguishes licensed Crypton originals, supplied local-review artwork, external process references and missing personal material. Mixbox paint mixing remains in use under its existing noncommercial license. Deployment and production asset clearance are separate from the local redesign.
