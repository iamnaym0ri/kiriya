// mochi tower: the rules, with no drawing (tested in scripts/test-games-dexterity.mjs).
//
// The stacking rules are adapted from tower_game by iamkun (https://github.com/iamkun/tower_game):
// the piece swings on a rope and the first one hangs still; it drops straight down; it lands if its
// centre is over the top piece, tips off the edge otherwise; landing within 10% of dead centre is
// "perfect"; the stack starts to sway after a few floors; three drops and the round is over.
// Retuned for a gentle, one-handed game: slower swings, a softer sway, calm mode and squishy mochi.
//
// MIT License, Copyright (c) 2018 BMQB, Inc
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright notice and this
// permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

export const LIVES = 3;
export const FLAVOURS = 5;
export const MAX_FLOORS = 400;
const GRAVITY = 2300; // px/s², height measured upward from the plate
const EVENT_SLOTS = 8;

/** How the hanging mochi swings at a given height (tower_game's angle and speed steps, softened). */
export function swing(floors, calm = false) {
  if (floors < 1) return { angle: 0, period: 2 };
  if (calm) return floors < 12 ? { angle: 0.42, period: 2.6 } : { angle: 0.58, period: 2.3 };
  if (floors < 10) return { angle: 0.52, period: 2.15 };
  if (floors < 20) return { angle: 0.8, period: 1.85 };
  return { angle: 0.95, period: 1.65 };
}

/** The stack's sway, in px of the top floor (none for the first few floors). */
export function sway(floors, calm = false) {
  const amp = floors < 5 ? 0 : floors < 13 ? 7 : floors < 23 ? 13 : 19;
  return calm ? amp * 0.5 : amp;
}

export function createTower({ width = 414, calm = false, random = Math.random } = {}) {
  const state = {
    calm, random, width,
    w: 110, h: 60, rope: 150, startHeight: 300, // set by layoutTower()
    time: 0, swingTime: 0, floors: 0, score: 0, perfects: 0, combo: 0, bestCombo: 0, lives: LIVES, over: false,
    // the stack: rest x of each floor (relative to the plate's centre) and its flavour
    xs: new Float32Array(MAX_FLOORS),
    flavours: new Uint8Array(MAX_FLOORS),
    perfect: new Uint8Array(MAX_FLOORS),
    squash: 0, // the newest floor's landing squish, 1 → 0
    // the piece: "hang" (swinging) → "fall" → back to "hang" with a new flavour, or "tip"
    piece: { mode: "hang", x: 0, y: 0, vy: 0, angle: 0, flavour: 0, wait: 0 },
    // a mochi tumbling off the tower
    tumble: { active: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, flavour: 0, side: 1, pivotX: 0, t: 0 },
    events: Array.from({ length: EVENT_SLOTS }, () => ({ type: "", x: 0, y: 0, value: 0 })),
    eventCount: 0,
  };
  state.piece.flavour = Math.floor(random() * FLAVOURS);
  return state;
}

/** Sizes from the screen: mochi width, height and rope length (CSS px). */
export function layoutTower(state, width, height) {
  state.width = width;
  state.w = Math.round(Math.min(118, width * 0.28));
  state.h = Math.round(state.w * 0.56);
  state.rope = Math.round(Math.min(160, Math.max(110, height * 0.2)));
  // the rope hangs from the top of the screen (PIVOT_Y) and the plate sits PLATE_GAP above the bottom
  state.startHeight = Math.max(state.h * 1.5, height - PLATE_GAP - PIVOT_Y - state.rope - state.h);
}

export const PIVOT_Y = 98;
export const PLATE_GAP = 104;

/** Height of the hanging piece's bottom when the rope is straight down. */
export const hangBase = (state) => Math.max(top(state) + hangGap(state), state.startHeight);
/** How far the view has scrolled up (the plate is at the screen's bottom while this is 0). */
export const cameraHeight = (state) => Math.max(0, top(state) + hangGap(state) - state.startHeight);

const top = (state) => state.floors * state.h; // height of the stack's top surface

export function swayOffset(state, floor) {
  if (state.floors === 0) return 0;
  const amp = sway(state.floors, state.calm);
  if (!amp) return 0;
  const lean = (floor + 1) / state.floors;
  return amp * lean * lean * Math.sin((state.time * Math.PI * 2) / 2.6);
}

export const topX = (state) => (state.floors ? state.xs[state.floors - 1] + swayOffset(state, state.floors - 1) : 0);

/** Where the hanging piece is now: x from the plate's centre, y = height of its bottom. */
export function hangPosition(state) {
  const { angle, period } = swing(state.floors, state.calm);
  const theta = angle * Math.sin((state.swingTime * Math.PI * 2) / period);
  state.piece.angle = theta;
  state.piece.x = Math.sin(theta) * state.rope;
  // the rope hangs from a point above the stack: the piece's bottom sits `gap` above the top
  state.piece.y = hangBase(state) + state.rope * (1 - Math.cos(theta));
  return state.piece;
}

export const hangGap = (state) => state.h * 1.5;

function emit(state, type, x, y, value = 0) {
  if (state.eventCount >= EVENT_SLOTS) return;
  const event = state.events[state.eventCount++];
  event.type = type;
  event.x = x;
  event.y = y;
  event.value = value;
}

export function dropPiece(state) {
  if (state.over || state.piece.mode !== "hang" || state.piece.wait > 0) return false;
  state.piece.mode = "fall";
  state.piece.vy = 0;
  state.piece.angle = 0;
  return true;
}

function nextPiece(state) {
  const piece = state.piece;
  piece.mode = "hang";
  piece.wait = 0.35; // a breath before the next one can drop
  let flavour = Math.floor(state.random() * FLAVOURS);
  if (flavour === piece.flavour) flavour = (flavour + 1) % FLAVOURS;
  piece.flavour = flavour;
  state.swingTime = state.random() * 0.4; // start near the middle, never at an extreme
}

export function stepTower(state, dt) {
  state.eventCount = 0;
  if (state.over) return state;
  state.time += dt;
  state.squash = Math.max(0, state.squash - dt * 3.2);
  const piece = state.piece;
  if (piece.wait > 0) piece.wait = Math.max(0, piece.wait - dt);

  if (piece.mode === "hang") {
    state.swingTime += dt;
    hangPosition(state);
  } else if (piece.mode === "fall") {
    piece.vy += GRAVITY * dt;
    piece.y -= piece.vy * dt;
    const surface = top(state);
    if (piece.y <= surface) {
      const below = topX(state);
      const offset = piece.x - below;
      const half = state.w / 2;
      if (Math.abs(offset) >= state.w) {
        // missed the stack entirely: it keeps falling past
        startTumble(state, piece.x, surface, 0, piece.vy, Math.sign(offset) || 1, false);
      } else if (state.floors > 0 && Math.abs(offset) > half) {
        // centre past the edge: it tips over the edge and falls (tower_game's rotate left/right)
        startTumble(state, piece.x, surface, 0, 0, Math.sign(offset), true, below + Math.sign(offset) * half);
      } else {
        const tolerance = state.w * (state.calm ? 0.15 : 0.1);
        const perfect = state.floors > 0 && Math.abs(offset) <= tolerance;
        const restX = (perfect ? below : piece.x) - swayOffset(state, state.floors);
        state.xs[state.floors] = state.floors === 0 ? 0 : restX;
        state.flavours[state.floors] = piece.flavour;
        state.perfect[state.floors] = perfect ? 1 : 0;
        state.floors = Math.min(MAX_FLOORS - 1, state.floors + 1);
        state.squash = 1;
        state.combo = perfect ? state.combo + 1 : 0;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        if (perfect) state.perfects += 1;
        state.score = state.floors;
        emit(state, perfect ? "perfect" : "land", perfect ? below : piece.x, surface, state.combo);
        nextPiece(state);
      }
    }
  } else if (piece.mode === "tip") {
    stepTumble(state, dt);
  }
  return state;
}

function startTumble(state, x, y, vx, vy, side, tipping, pivotX = 0) {
  const t = state.tumble;
  t.active = true;
  t.x = x;
  t.y = y;
  t.vx = vx || side * 60;
  t.vy = -vy;
  t.rot = 0;
  t.spin = side * (tipping ? 2.6 : 1.4);
  t.side = side;
  t.flavour = state.piece.flavour;
  t.pivotX = pivotX;
  t.t = 0;
  state.piece.mode = "tip";
  state.lives -= 1;
  state.combo = 0;
  emit(state, "drop", x, y, state.lives);
}

function stepTumble(state, dt) {
  const t = state.tumble;
  t.t += dt;
  if (t.t < 0.28 && t.pivotX) {
    // roll over the edge first
    t.rot += t.spin * dt * 1.6;
    t.x += t.side * 160 * dt;
  } else {
    t.vy -= GRAVITY * 0.7 * dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.rot += t.spin * dt;
  }
  if (t.t > 1.1) {
    t.active = false;
    if (state.lives <= 0) {
      state.over = true;
      emit(state, "over", 0, 0, state.score);
    } else nextPiece(state);
  }
}

export function rewardsFor({ floors, bestCombo }) {
  const earned = [];
  if (floors >= 15) earned.push({ sticker: "st-mochi", reason: "a tower 15 mochi tall" });
  if (bestCombo >= 5) earned.push({ sticker: "st-star", reason: "5 perfect drops in a row" });
  return earned;
}
