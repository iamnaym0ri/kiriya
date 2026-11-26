# Letter card — progress log

The "little note" card for the notification content extension: sealed envelope → opening → the note
resting on the open envelope. Sources: `ios/App/KiriyaNotificationContent/Letter/`. Lab: this folder.
Outputs (frames, sheets, MP4s): `/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/letter/`.

## How it's built
- **Pure timeline.** `LetterGeometry.pose(time:idle:)` returns every piece's position/scale/angle for a
  moment; `LetterScene` draws that pose; `LetterCard` only supplies the clock (TimelineView: 30fps
  while idle, display rate while opening, nothing at rest). Every frame can be rendered exactly.
- **Text laid out with CoreText on a fixed ruled grid** (pitch 30pt), drawn as resolved SwiftUI Text in
  a Canvas. The paper's height is known before drawing, so the card's height comes from a custom
  `Layout` (`LetterSizer`) in one pass, and every line sits on a rule even with emoji.
- **Art is Equatable Canvas pieces** (back + lining, pocket + lace + stamp, flap faces, band, loops,
  tails, knot, wax seal, paper faces, tape); animation only moves them.

## Log
1. Probed rendering. iOS ImageRenderer renders `rotation3DEffect` with perspective. The iOS 26.3
   simulator runtime here has **no Apple Color Emoji** (falls back to LastResort; can't register the
   Mac's copy), so emoji show as boxes on the simulator only. Lab frames are rendered on macOS
   (identical layout, checked side by side against the iOS render), and the simulator is used for
   the live card, timing and Reduce Motion.
2. Fonts: woff2 → ttf by dumping CoreText's decoded tables (`tools/woff2ttf.swift`). Gaegu Regular/Bold
   (site's handwriting) and Parisienne (site's script). Gaegu's x-height is 0.34em, so body text is
   22pt (reads like ~16pt SF) on a 30pt grid.
3. First full pass. Sealed looked right straight away. Problems seen in the contact sheets: the ribbon
   was still falling through the opened envelope; ~0.3s of nothing between the flap opening and the
   note appearing; a static hover before unfolding; the tape clipped at the top while lifted; the
   pocket's V tip poked out under the resting paper as a notch; fold creases read as stray rules;
   two ❤️ stacked (rest-line + signature).
4. Retimed to 2.8s (ribbon gone before the flap swings; note rises as the flap settles; unfold starts
   as it clears the envelope). New rest composition: the note covers only the top quarter of the open
   envelope, so the lined mouth with lace shows beneath it (frame t=2.1 of the first pass was prettier
   than its rest pose, so that became the rest). Lace added along the pocket's mouth. Creases became
   soft shading valleys.
5. Added a postage stamp + postmark on the pocket (there from the start, so nothing pops in; makes the
   resting envelope read as mail). Orphan rule: never end a line on a one-letter word ("… ☀️ I").
6. Simulator, live: first run froze ~1.5s right when the paper first appeared (cold first draw of the
   paper; on this sim also the missing-emoji-font path). Fix: the folded note now lives inside the
   envelope from the start (hidden by flap + pocket), so it's drawn while sealed; its shadows only
   switch on as it emerges; the paper sheet is Equatable so idle frames skip it. Second live run:
   smooth, frame log ~16ms with occasional 35–70ms gaps on this Intel simulator.
7. Truncated notes: "the rest is waiting in the app ❤️" became a footer under a dashed divider (like
   the site's note reaction bar) instead of a line stacked over the signature. No byline + truncated:
   the footer's heart is the sign-off; no byline + whole note: a lone ❤️.
8. Reduce Motion (simulator setting): sealed card is perfectly still; opening was a hard cut because
   the host flips `isOpen` outside an animation. Now the card keeps its own phase and crossfades
   (0.35s). Height still follows `isOpen` at once (one size change for the host).
9. Fonts are created from the card's own font files (descriptors), not looked up by name: the Jar
   card bundles its own "Gaegu-Regular" (same glyphs, different file). Truncation uses Gaegu's own
   "..." (Gaegu has no "…", en/em dashes or accents; those fall back to the system face).
10. Edge cases (`./lab.sh edges 343`): emoji-only, Chinese, unbreakable URL, over-long title (2 lines,
    ellipsized), empty heading, accents/em dash. All hold the grid.
11. `maxHeight` parameter (default 700) so the host can leave room under the card.
12. Bow detail pass: the loops' "almond" hollow became a darker underside crescent with satin folds
    fanning from the knot, plus soft shadows (drawn once, in-canvas) under loops and tails; the seal's
    gloss is a crescent.
13. Found faint dotted seams on rotated pieces in the renders: CoreGraphics (what ImageRenderer
    uses) seams multi-stop gradients at their inner stops under rotation. All rotating pieces now
    use two-stop gradients (layered where more tones are needed). Clean at every rock angle.
14. Memory: fold panels were full-sheet canvases clipped to a third; now each fold draws only its
    own slice, and the resting note is one unpanelled sheet. Perspective scaled so the look is
    identical (before/after frames compared).
15. Host robustness: `.animation(nil, value: isOpen)` so a host that flips `isOpen` inside
    withAnimation (as NoteCardModel.openEnvelope does today) still produces exactly one height
    change. Verified live: "reports 2" (sealed, then open). Taps pass through once open; isOpen
    back to false (reused extension) re-seals.
16. Final renders: `./lab.sh all` (stills, 0.1s contact sheets, 60fps MP4s for short/medium/long/
    no-byline at 343 and 393, idle loops), `overview-343.png`, `open-medium-343.gif`.

## Running it
- `./lab.sh all` · `./lab.sh sheet <note> <width> [step] [from] [to]` · `./lab.sh frame <note> <width> <t|sealed|sealed@idle> [scale]`
  · `./lab.sh video <note> <width>` · `./lab.sh edges 343` · `./lab.sh piece loop|tail|seal|flap|flapin|pocket` · `./lab.sh report <note> <width>`
- `./sim.sh build` · `./sim.sh record medium 12` (SPRING=1 to flip like the real host) · `./sim.sh frames medium 7`
  (frame-gap log) · `./sim.sh render` (iOS parity frames + per-frame pose cost) — uses only the
  "Kiriya Letter Lab" simulator.
