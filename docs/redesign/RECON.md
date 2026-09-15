# Redesign reconnaissance

Read the full handoff and execution brief, PLAN, SETUP and supplied asset map. The execution brief governs the new scope. The project has no initial commit; all existing work is retained in place. The existing Vite server runs on port 5173 with PGlite.

Inspected public and authenticated Home, Studio, Stage, Atelier, Apothecary, Letters and Settings at 1440 and 390 pixels. Baseline captures are in `.data/redesign/before-*`. The baseline uses a 608-pixel dashboard column, gradient cards and drawn icons instead of character imagery. Rora's landing Opening composition and frontend Aesthetic/Reader styles establish the quality reference: expressive image scale, mixed typography, quiet controls, responsive grouping, explicit focus and safe-area handling. Rora is a read-only reference.

The supplied contact sheet is `.data/redesign/references.png`. Inspected the source pages for the two Strawpages, guns.lol and Crypton creator terms. Screenshots are references only. Selected supplied artwork is for this local review; unresolved release rights are recorded separately.

Actual content: no avatar, cosplay photographs, song library entries or Josh letters. One saved drawing is the earlier verification heart, not a supplied Kiriya artwork. Preserve it with neutral saved-sketch wording. The public default is Senbonzakura. Do not fabricate personal media or authorship.

Retain auth, public profile editing, drawing/paint/save/gallery, saved songs/feature/upload, cosplay photos, source-checked lore and prompts, letters, PWA, preferences and existing scheduling. Replace both openings and all four section entrances. Remove active training, quizzes, language, outfit generation, planner controls, ranked/live feeds and date countdowns; retain stored data.

Confirmed access issue: local uploaded media had no session check. Production uploads request public Blob access. Fix both rather than describing obscure URLs as private. Legacy day bundles and queued push payloads need scope filtering. Notification settings currently do not reconcile the current day. Letters need permanent navigation and a replayable gift.
