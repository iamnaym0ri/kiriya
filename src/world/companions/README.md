# Companions: the engine and the character contract

Her character lives on the app's home section (`CompanionHost.jsx` mounts it, app only; the website
keeps `src/world/mascot/MaomaoCompanion.jsx`). This file is the contract between the engine
(`engine/`, owner: the stage agent) and the five characters (`characters/<id>/`, one agent each).
`docs/refactor/RENOVATION.md` → "Companions" holds the agreed names; this file is the detail.

- Try a character: `/world/companion-lab?app=1&c=<id>&v=<visitor>` (dev only). See "The lab".
- Engine test characters: `characters/_placeholder/` (a blob that uses most options) and
  `characters/_maomao-legacy/` (today's Maomao run through the engine). Folders starting with `_`
  are dev-only.

## How it looks and moves

- A fixed layer over home, between everything at the top (home's top bar and ribbon, the compact
  bar that fades in when home scrolls, the status bar) and the tab bar (plus anything fixed just
  above it). The band does not move while she scrolls. Only bodies take touches.
- **Levels**: 2 to 6 invisible floors across the band (as many as fit about every 150 px), the
  bottom and top running the full width and the ones between leaning left and right in turn. A
  character always stands on a level.
- **Clouds**: wherever a character stands or walks, its `Platform` is drawn under its feet. Walking
  (`platform: "trail"`), clouds form just ahead of the feet and fade once left behind; standing
  still, they gather into one under its feet. Riding (`platform: "ride"`), one cloud carries it.
- **Jumps** between neighbouring levels: a crouch (anticipation), a stretch on take-off, a real
  ballistic arc, the destination cloud puffing in just before the feet arrive, a squash on landing.
  Riders float from level to level instead (unless `hop: true`).
- **Choosing where to go**: before settling, it looks at what is under a few candidate spots and
  prefers ones that don't cover text, pictures or buttons. When home stops scrolling and it is
  standing over something she might want to read or tap, it moves somewhere clearer. Pages can mark
  things with `data-companion-avoid` (never stand here) or `data-companion-ok` (fine to cover), and
  the one thing a page is about with `data-companion-never` (home's greeting and her name): weighed
  four times heavier than ordinary text, for standing, for speech bubbles and for the behaviours that
  head for the top level (they happen in place instead).
- **Touch**: a tap → `react` pose and a `tapped` line (three quick taps → `pester` if it has one),
  and the **tap menu** (see "The tap menu and stay"). Hold still ~0.4 s or start dragging →
  picked up by the scruff (`held` pose, a `picked` line), swinging as it is carried. Let go → it
  falls (with a little of the throw) to the nearest level below, lands on a fresh cloud, says a
  `putDown` line and carries on. Told to stay, it drops straight down instead, and stays there.
- **Visits**: once she has been on home a while (25–80 s), with a 35% chance and at most one visit
  per 20 minutes, another character arrives from the side with more room, they trade lines, the
  visitor waves and leaves the way it came. Never more than two on screen.
- **Quiet mode / reduced motion**: no walking, jumping or squash; poses still change and it still
  talks, about 1.5× slower. A visitor fades in and out instead of walking. Bodies get
  `playing={false}` and must stop their own CSS animations.
- **Transitions** (round 3): nothing snaps from one pose to the next. See "Transitions" below.
- **Performance**: one `requestAnimationFrame` loop for the whole stage; positions, squash, sway and
  turns are written as transforms straight to the DOM; React re-renders an actor only when its pose,
  expression, clouds or words change. The loop stops when home is not showing, when the app is in
  the background and when nobody is on stage. Characters are lazy-loaded; a visitor is only loaded
  when it visits.

## A character folder

`characters/<id>/index.js` default-exports (ids match `shared/companions.js`):

```js
export default {
  id: "miku",
  name: "Hatsune Miku",
  credit: "…",                       // one line for Art & credits
  size: { width: 96, height: 128 },  // the body box at scale 1, CSS px; feet at bottom centre
  scale: 1,                          // optional: this character's size relative to the others
  Body,                              // see "Body"
  poses: ["idle", "walk", "jump", "fall", "land", "sit", "wave", "react", "sleep", "held", ...own],
  Platform,                          // see "Platform" (optional: the engine has a default cloud)
  movement: { ... },                 // see "Movement"; every field is optional
  behaviours: [ ... ],               // see "Behaviours"
  lines: { ... },                    // see "Lines"
  visit: { with: { ... } },          // see "Visits"
  action: { ... },                   // see "The tap menu and stay" (optional, but every character has one)
  Thumb,                             // small portrait for her settings picker (not used by the engine)
};
```

### Body

`({ pose, expression, facing, playing, frame, talking, prop }) => <svg …/>`

- Fill the box: the engine renders it in a box of exactly `size × scale` CSS px (about 0.9 on a
  414 pt phone, 0.8 at 375 pt) and scales it about the feet. Make the root `width: 100%;
  height: 100%` and `overflow: visible`. The feet stand at the **bottom centre** of the box.
- Draw facing **right** (or straight at her). The engine mirrors the whole body to face where it is
  going (a quick paper-doll turn); `facing` (1 right, -1 left) is there if you need to un-mirror
  something such as text. Set `movement.flip: false` to mirror nothing.
- `pose`: one of your `poses`. Missing poses fall back: `held` → `fall` → `jump` → `react`;
  `crouch` (optional, used for the anticipation if you have it) → `land`; `fall` → `jump`;
  `wave` → `react`; `sleep` → `sit`; anything else → your `restPose` → `idle`.
- **Sitting** (`sit`, and any own pose where it sits): the seat is on the feet line and legs may
  hang about 15% of the body height below it, over the cloud's front edge. The body is drawn
  **above** the platform, so dangling legs show in front of the cloud.
- `expression`: whatever your rig understands, or `undefined` (use your default). It comes from the
  current line while a bubble shows, else from an engine moment (`movement.expressions`), else
  from the behaviour.
- `playing`: false in quiet mode, reduced motion and while paused. Stop every CSS animation then
  (e.g. gate them on a `data-playing` attribute).
- `talking`: true while its bubble shows (a mouth that moves, if you like).
- `prop`: a string or `null`: what it holds right now, from the running action step or behaviour
  (`prop` on either; see "Steps"). Draw it in its hand (Rotten Girl's paddle, Miku's leek,
  KAITO's ice cream); unknown props draw nothing. It is `null` while held. You may also hold
  things in your own poses by your own means; `prop` is for the engine to ask for one.
- `frame`: Motion values the engine updates without re-rendering you: `frame.time` (s),
  `frame.stride` (px walked so far, for syncing steps), `frame.speed` (px/s along the level),
  `frame.vy` (px/s, negative going up). Use them with `motion` components and `useTransform`, or
  ignore them. `frame` is `null` in the lab's pose gallery.
- Keep it cheap: transform/opacity animations, no filters that repaint every frame, memo-friendly
  (the engine memoises on these props).
- The engine owns a wrapper around the body (taps, dragging, focus): don't add your own click
  handlers.
- Changes of pose, expression and prop are blended by the engine (see "Transitions"): draw each
  pose as it should look, give the parts CSS poses a `class`, and let the engine blend. Parts that
  move between poses by CSS (the upper body lowering to sit, an arm's angle, a walk cycle ending)
  glide on their own; your own CSS transitions keep working too. Mark a prop that should pop into
  the hand with `data-cs-pop` on a plain wrapper `<g>` (optionally `--cs-pop-origin`, default
  `50% 80%` of the prop). `Body.blend = false` opts out (a Body that blends its own poses).

### Platform

`({ width, state, facing, riding, playing }) => <svg …/>`

- The engine places the Platform box's **top centre at the feet point**; puffs may overflow upward
  a little. Set `Platform.surface = <px>` (at scale 1, default 0) to sink the feet that far into a
  fluffier cloud: the box's top then sits `surface × scale` px above the feet.
- `width`: the cloud's width in CSS px (`movement.platformWidth × scale`). Draw at that width;
  the height is yours (about a quarter to a third of the width reads well).
- `state`: `"forming"` (just appeared, `platformForm` ms), `"steady"`, `"fading"` (about to go,
  `platformFade` ms). With `platformFx: "engine"` (default) the engine puffs the cloud in and out
  for you (scale/opacity); add your own detail per state on top if you like. With
  `platformFx: "own"` the engine does nothing: animate the states yourself.
- `riding`: true for a `"ride"` character's cloud (it travels with the body). `facing` is the
  body's direction (for motion lines). `playing` as for Body.
- While walking there are usually two to four clouds on screen per character; keep each light.

### Movement

All optional; defaults in brackets. Distances are CSS px at scale 1.

| field | meaning |
| --- | --- |
| `walkSpeed` [38] | px per second along a level |
| `walkPose` ["walk"] | the pose while travelling (a rider might use `"sit"`) |
| `restPose` ["idle"] | what it settles into between things (Maomao `"ponder"`, Miku `"sit"`) |
| `restSeconds` [[2, 5]] | how long it settles before choosing the next behaviour |
| `restlessness` [0.5] | 0..1, how often it moves somewhere before its next behaviour |
| `jumpiness` [0.3] | 0..1, when it moves, how often it changes level instead of walking |
| `wander` [0.5] | the longest walk, as a share of the screen width |
| `platform` ["trail"] | `"trail"`: clouds form ahead and fade behind. `"ride"`: one cloud carries it |
| `hop` [true for trail, false for ride] | change level by jumping; false floats there on its cloud |
| `floatSeconds` [1.3] | riders: roughly how long a float to another level takes |
| `bob` [2 for ride, 0 for trail] | px of gentle up-and-down while standing or riding |
| `platformWidth` [size.width] | the cloud's width |
| `platformForm` [260] / `platformFade` [520] | ms in the forming / fading states |
| `platformFx` ["engine"] | `"engine"` puffs clouds in and out; `"own"` leaves it to the Platform |
| `jumpHeight` [34] | px the arc rises above the higher of the two levels |
| `maxJumpX` [150] | widest sideways distance of one jump |
| `gravity` [2400] | px/s² (higher = snappier, shorter hops) |
| `anticipation` [190] | ms crouching before a jump |
| `landing` [300] | ms in the `land` pose after touching down |
| `squash` [1] | 0..1.5, the engine's squash and stretch (lower it if your poses squash already) |
| `flip` [true] | mirror the body to face its direction |
| `turnMs` [200] | how long turning round takes |
| `heldAt` [0.9] | where it is held when picked up, as a share of its height from the feet (the scruff) |
| `sway` [1] | 0..2, how much it swings while carried |
| `talkiness` [0.45] | 0..1, chance it says something as it starts a behaviour |
| `expressions` [{}] | expressions for engine moments: `{ tapped, picked, putDown, walk, jump, stay, wander }` |

### Behaviours

What it does when left alone. Each time it finishes one it picks the next by weight (the same one
twice in a row is less likely), maybe moves first, does it, then settles in `restPose`.

```js
{ id: "ponder", weight: 3, pose: "ponder", expression: "thinking", seconds: [6, 12], topic: "musing" }
```

| field | meaning |
| --- | --- |
| `id`, `weight` [1] | name and relative chance |
| `pose` [restPose] | the pose for the behaviour |
| `expression` | the expression for it (lines override while they show) |
| `seconds` [[5, 10]] | how long it lasts |
| `topic` | the line topic it may say as it starts (`say` chance), else maybe an `idle` line |
| `say` [movement.talkiness] | 0..1, chance of saying something |
| `stay` [false] | never move before this one |
| `level` | `"top"` or `"bottom"`: go there first |
| `roam` [false] | keep moving for a while first: 2–3 short walks with pauses (Bambi) |
| `roamPose` [walkPose], `roamSpeed` [1] | the pose and speed multiplier while roaming |
| `hours` | `[from, to]` local hours when it can happen, e.g. `[22, 7]` for sleeping |
| `quiet` [true] | false: never in quiet mode |
| `prop` | a prop `Body` gets while it lasts (see "Steps") |
| `bounce` | little hops on the spot as it starts: a count, or `{ count, height, every }` (see "Steps") |
| `steps` | a little sequence instead of one pose: `[{ pose, prop, expression, seconds, topic, bounce, turn, chance }]` |

Told to stay, it only picks behaviours **without `roam` or `level`**, and never moves first, so
give it at least three of those (a dance or fidget, a humming or pondering moment, something of
its own). With none, it just rests in `restPose`.

### Steps

Actions and behaviours can be a sequence of steps, played in order. Each step:

| field | meaning |
| --- | --- |
| `pose` | the pose (default: the action's or behaviour's `pose`) |
| `prop` | the prop (default: the action's or behaviour's; `null` puts it away) |
| `expression` | the expression (default: the action's or behaviour's) |
| `seconds` | `[min, max]` or one number (default: the action's or behaviour's `seconds`) |
| `topic` | a line topic said as the step starts. In an action it is said to her (a solid bubble, always); in a behaviour it is an aside, with the behaviour's `say` chance |
| `bounce` | hops on the spot: `2`, or `{ count, height: 9, every: 0.36 }` (px at scale 1, seconds per hop). The feet leave the cloud and come back with a little squash; none in quiet mode |
| `turn` | `true`: turns to face the other way as the step starts (looking round) |
| `chance` | 0..1: the step only plays that often (default 1), e.g. a brain freeze one time in three |

```js
{ id: "routine", weight: 2, steps: [
  { pose: "hum", seconds: [2, 3], topic: "humming" },
  { pose: "dance", seconds: 1.4, bounce: 3 },
  { pose: "wave", seconds: 1, turn: true },
] }
```

### Lines

Topics map to lists; each line is a string or `{ text, expression }` (the expression is passed to
Body while the bubble shows). `{name}` becomes her name. No line repeats in a topic until all of
it has been heard.

| topic | when |
| --- | --- |
| `greet`, `greetMorning` (5–11), `greetAfternoon` (11–17), `greetEvening` (17–22), `greetNight` (22–5) | arriving on home; the hour's topic first, `greet` as fallback |
| `birthday` | her birthday: the greeting, and sometimes instead of an idle line |
| `idle` | thinking aloud (shown as a lighter, dashed aside) |
| `sweet` | now and then instead of an idle line |
| `tapped`, `pester` | tapped; three quick taps |
| `picked`, `putDown` | picked up; landed after being put down |
| `visit` | a visit with nobody in `visit.with`: the visitor's hello and the host's answer |
| `bye` | optional: the visitor's goodbye as it leaves |
| `action` | the tap menu's own choice, as it starts (default topic of `action`) |
| `stay`, `wander` | told to stay; let go again |
| `stayIdle` | optional: thinking aloud while staying (now and then instead of a behaviour's topic; falls back to `idle`) |
| any own topic | named by a behaviour's or a step's `topic` |

Unprompted lines are at least 14 s apart (21 s in quiet mode). A bubble stays up for 2.6–8 s
depending on length, always fully on screen (above the head, or beside it near the top).

### Visits

```js
visit: {
  with: {
    miku: [
      ["mine", "Miku's reply"],                     // a pair: [this character's line, the other's]
      [{ text: "…", expression: "pleased" }, "…"],
    ],
  },
  any: [["…", "…"]],  // optional: pairs for anyone without their own (this character speaks first)
}
```

A pair lives in the file of whoever speaks first. When B visits A, the engine picks at random
among A's `with.B` pairs and B's `with.A` pairs (longer exchanges alternate the same way). The
first line comes with a `wave`. With none written, it uses `any`, then each one's `visit` lines.

## Transitions

Josh, round 3: "more seamless instead of abrupt". Every switch flows; the engine does it once for
every character, whatever way its Body draws poses.

- **The cross-fade** (`engine/ghost.js`, `PoseBlend` in `ActorView.jsx`). Just before React draws a
  new pose, expression or prop, the body's DOM is copied as it looks that instant (the "ghost") and
  a MutationObserver notes what React changes. The copy is laid over the live body with its CSS
  clocks set to where the old ones were (a walk keeps stepping as it fades) and fades out; what
  React removed or redrew (an arm group, a path, a prop) fades out of it, and the new parts fade in
  on the live body. Styled parts (anything with a `class`) whose transform or opacity would jump
  with the new pose (an animation swapped for another or for a still value) are animated from where
  they were into whatever their CSS now says, still or moving, and the copy glides in step; parts
  with a CSS transition of their own glide in the copy too. So nothing doubles and nothing jumps.
  In quiet mode and reduced motion nothing glides: the copy is a plain short cross-fade.
- **Expression or prop only**: the copy holds just what React removed or redrew (everything else
  is pruned from it before it is styled), so the faces that ease between expressions by
  themselves (Maomao, both Mikus, KAITO: a JS morph of the face's numbers, which can't be CSS on
  the iPhone because WebKit has no CSS `d` for path shapes) keep their own easing with nothing over
  them, and a face drawn per expression (Bamby) cross-fades.
- **Cost** per change: one `cloneNode`, one observer, for a new pose a read of 20–50 styled parts'
  transform and opacity, a few short Web Animations (opacity and transforms); nothing per frame;
  at most two ghosts. The biggest share is the browser styling the copied SVG (a few ms in
  WebKit on the iMac per change of pose). The live body is never made see-through.
- **KAITO's arms** are three points per pose, so his Body sweeps them from pose to pose (0.24 s)
  instead of cross-fading, with what the hand holds riding along.
- **Timing** (`engine/blend.js`, `BLEND_MS`): quick (90 ms) for a reaction, a crouch, take-off, the
  top of a jump, landing and being picked up; 120 ms setting off, 160 ms stopping, 150 ms a
  behaviour or a step starting, 200 ms easing into the rest pose, sitting or lying down; 150 ms a
  new expression or prop. Quiet mode and reduced motion: one plain 130 ms fade, no squash.
- **Weight**: a change of pose in place gives the squash spring a small push (`settleKick`):
  sitting sinks a little, getting up stretches, anything else is a breath. Pushes are velocities,
  so they ease in; nothing jumps in scale except a landing's impact.
- **Lean**: setting off, the top of the body lags a touch; stopping, it carries on forward and
  settles back (a damped spring driven by the walk's acceleration, a skew about the feet, at most
  a few degrees).
- **A breath after travelling**: after a walk, a hop or a float it rests in `restPose` for about
  0.4 s before starting a behaviour in another pose, so it never goes from mid-stride into a
  dance.
- **The tap's hop** is one startled jump in the `react` pose (the squash does the crouch); real
  jumps keep their crouch, take-off, fall and land poses.
- **Bubbles** fade out when a line ends instead of vanishing.
- **Props** wrapped in `<g data-cs-pop>` pop into the hand (scale and fade, 300 ms).
- The lab's "blend poses" box (`blend=0`) turns the cross-fade off to compare.

## The tap menu and stay

A tap on her character (the host; a visitor only answers) opens a small frosted menu beside it with
two 44 pt chips: its own **action** (`[icon label]`) and **📍 stay** (while staying: **🌸 wander**).
A character without an `action` gets the stay chip alone.

```js
action: {
  id: "vial",                    // unique within the character
  label: "show her a vial",      // the chip's words: lowercase, at most ~20 characters
  icon: "🧪",                    // one emoji, or a tiny component ({ size }) drawn in the chip
  pose: "inspect",               // a pose from `poses`, held while it plays
  prop: "vial",                  // optional: Body gets prop="vial" while it plays
  expression: "curious",         // optional
  seconds: [3, 5],               // how long it lasts (each step's default)
  topic: "action",               // the lines topic said as it starts (default "action")
  steps: [ /* optional: { pose, prop, expression, seconds, topic, bounce, turn }, see "Steps" */ ],
}
```

- **The menu**: it waits (looking at her, in `restPose`) while the menu is open; it never covers
  the status bar, the top bars or the tab bar, and keeps clear of its bubble: a column beside it
  where there is room, else a row under its cloud or over its head. A tap elsewhere, a scroll, a
  drag, leaving home or 5 s of nothing closes it; Escape too. Enter or Space on the focused body
  opens it with the first chip focused. Visits wait until it closes.
- **The action**: a solid line from its `topic` (or the first step's), then each step's pose, prop
  and expression in turn, then back to its day. It plays where it stands, staying or not.
- **Stay**: a `stay` line (and the `stay` expression), and from then on it doesn't travel: no
  walks, hops between levels, floats, roaming, "somewhere clearer" moves, or making room for a
  visitor (visitors still come and go, as close as there is room for). It keeps doing everything it
  can do in place (behaviours without `roam` or `level`). Picked up and dropped, it falls straight
  down (no throw) to the level below where she let go, and that is its spot now.
- **Kept on this phone**: `localStorage["kiriya:companion-stay"] = { [id]: { x, level } }` (`x` the
  share of the band's width, `level` counted from the bottom), so next time home opens it is on its
  spot (the same level, or the top one if there are fewer; the same share of the width). Resizing
  or turning the phone puts it back on its spot too.
- **Wander**: a `wander` line (and expression), a happy little bounce, and it is free again.

## Stage options

`<Stage hostId active options name birthday controlRef />` (`engine/Stage.jsx`). `CompanionHost`
uses the defaults; the lab sets the rest.

| option | default | meaning |
| --- | --- | --- |
| `levels` | auto | 2..6, or `[{ at, from, to }]` (`at` 0 top..1 bottom, `from`/`to` 0..1 across) |
| `scale` | auto | body scale (0.9 × width / 414, between 0.74 and 1) |
| `speed` | 1 | time multiplier (slow motion in the lab) |
| `quiet` | her setting | force quiet (true) or lively (false) |
| `avoidText` | true | prefer spots clear of text, pictures and buttons |
| `insets` | measured | `{ top, bottom }` px to override the band |
| `visits` | `{ enabled: true, chance: 0.35, delay: [25, 80], cooldown: 20 }` | seconds; minutes |
| `chatGap` | 14 | seconds between unprompted lines |
| `blend` | true | cross-fade the body between poses, expressions and props ("Transitions") |
| `debug` | false | draw the levels |

Her pick comes from `prefs.companion` (`usePrefs`); `"none"` shows nobody and no visits. Changing
it swaps the character live: the old one fades, the new one drops in onto a cloud.

## The lab

`/world/companion-lab?app=1&c=<id>&v=<visitor>`: the real engine over a stand-in home, with a
frame-time readout (average, p95, max frame gap, long frames over 34 ms, the engine's own ms per
frame). Tap "lab ▾" for controls: character, visitor, a pose gallery (every pose on its cloud with
the feet line marked, and the three platform states), what's behind (home, text cards, plain),
levels, speed, scale, quiet/lively, show levels, avoid text, hold a pose, run a behaviour, say a
topic, visit now, jump, walk to an edge, tap (opens the menu), its action, stay, wander, close the
menu, drop in. The pose gallery also shows each action step with its prop, and every behaviour
prop. The readout starts with 📍 while it is staying. The same settings work as query options
(`levels`, `speed`, `scale`, `quiet=1|0`, `debug=1`, `bg=home|text|plain`, `tab=poses`, `open=1`,
and the one-shot `stay=1|0`: start staying at the bottom middle, or wandering), and
`window.__companionStage` is the running engine for scripts (`host.tap()`, `host.choose("action" |
"stay" | "wander")`, `host.runAction()`, `host.setStay(on)`, `host.closeMenu()`).

Engine tests: `node --test scripts/test-companion-engine.mjs` (the menu, actions, steps, stay and
its storage, without a browser). On touch: `.lab/menu.mjs` in the stage agent's worktree.
