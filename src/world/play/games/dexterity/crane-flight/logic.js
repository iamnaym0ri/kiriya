// paper-crane flight: the rules, with no drawing (tested in scripts/test-games-dexterity.mjs).
//
// The flight model is adapted from floppybird by Nebez Briefkani (https://github.com/nebez/floppybird),
// Apache License 2.0 (see floppybird-LICENSE.txt beside this file). From it: constant gravity with
// a tap that sets the upward speed, tilt that follows the speed, gaps placed at random between a top
// and bottom padding, a point for each gap passed, and a hitbox a little smaller than the picture.
// Changed for kiriya.love: time-based (per second, not per frame), wider gaps that narrow slowly,
// limits on how far one gap is from the next, three hearts with a moment of grace after a bump
// instead of instant loss, a soft floor that bounces, little stars to collect, and calm mode.

export const LIVES = 3;
const POOL = 6;
const EVENT_SLOTS = 8;
export const OBSTACLE_WIDTH = 66;
export const CRANE_RADIUS = 13; // the picture is ~58 px wide; the hitbox is kinder

export function tuning(gaps, calm = false) {
  const t = Math.min(1, gaps / 35);
  return calm
    ? { speed: 105 + 20 * t, gap: 252 - 34 * t, spacing: 250, gravity: 780, flap: 260 }
    : { speed: 128 + 42 * t, gap: 236 - 62 * t, spacing: 232, gravity: 880, flap: 282 };
}

export function createFlight({ width = 414, height = 680, calm = false, random = Math.random } = {}) {
  const state = {
    calm, random, width, height,
    ground: height - 54, ceiling: 70,
    started: false, time: 0, gaps: 0, stars: 0, score: 0, lives: LIVES, hurt: 0, over: false, bumps: 0, bestClean: 0, clean: 0,
    crane: { x: Math.round(width * 0.3), y: height * 0.42, vy: 0, rot: 0, flap: 0 },
    scroll: 0, nextIn: 0, lastGapY: height * 0.45,
    obstacles: Array.from({ length: POOL }, () => ({ active: false, x: 0, gapY: 0, gapH: 0, scored: false, star: false, starY: 0 })),
    events: Array.from({ length: EVENT_SLOTS }, () => ({ type: "", x: 0, y: 0, value: 0 })),
    eventCount: 0,
  };
  return state;
}

export function resizeFlight(state, width, height) {
  state.width = width;
  state.height = height;
  state.ground = height - 54;
  state.crane.x = Math.round(width * 0.3);
  if (!state.started) state.crane.y = height * 0.42;
}

function emit(state, type, x, y, value = 0) {
  if (state.eventCount >= EVENT_SLOTS) return;
  const event = state.events[state.eventCount++];
  event.type = type;
  event.x = x;
  event.y = y;
  event.value = value;
}

export function flap(state) {
  state.eventCount = 0; // the last step's events were already handled
  if (state.over) return;
  if (!state.started) {
    state.started = true;
    state.nextIn = state.width * 0.55; // first gap arrives after a short glide
  }
  state.crane.vy = -tuning(state.gaps, state.calm).flap;
  state.crane.flap = 1;
  emit(state, "flap", state.crane.x, state.crane.y);
}

function spawn(state) {
  let slot = null;
  for (let i = 0; i < POOL && !slot; i++) if (!state.obstacles[i].active) slot = state.obstacles[i];
  if (!slot) return;
  const { gap } = tuning(state.gaps, state.calm);
  const pad = 26;
  const min = state.ceiling + pad + gap / 2;
  const max = state.ground - pad - gap / 2;
  // never more than ~190 px from the last gap, so there is always time to get there
  const lo = Math.max(min, state.lastGapY - 190);
  const hi = Math.min(max, state.lastGapY + 190);
  const y = lo + state.random() * Math.max(0, hi - lo);
  slot.active = true;
  slot.x = state.width + OBSTACLE_WIDTH;
  slot.gapY = y;
  slot.gapH = gap;
  slot.scored = false;
  slot.star = state.random() < 0.35;
  slot.starY = y + (state.random() - 0.5) * gap * 0.4;
  state.lastGapY = y;
}

function hitsRect(cx, cy, r, left, top, right, bottom) {
  const nx = cx < left ? left : cx > right ? right : cx;
  const ny = cy < top ? top : cy > bottom ? bottom : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function bump(state, y) {
  if (state.hurt > 0) return;
  state.lives -= 1;
  state.bumps += 1;
  state.clean = 0;
  state.hurt = 1.4;
  emit(state, "bump", state.crane.x, y, state.lives);
  if (state.lives <= 0) {
    state.over = true;
    emit(state, "over", state.crane.x, y, state.score);
  }
}

export function stepFlight(state, dt) {
  state.eventCount = 0;
  if (state.over) return state;
  state.time += dt;
  const crane = state.crane;
  crane.flap = Math.max(0, crane.flap - dt * 4);
  if (!state.started) {
    // hovering, waiting for the first tap
    crane.y = state.height * 0.42 + Math.sin(state.time * 2.4) * 8;
    crane.rot = Math.sin(state.time * 2.4 + 1) * 0.08;
    return state;
  }
  const tune = tuning(state.gaps, state.calm);
  if (state.hurt > 0) state.hurt = Math.max(0, state.hurt - dt);
  crane.vy = Math.min(crane.vy + tune.gravity * dt, 560);
  crane.y += crane.vy * dt;
  crane.rot = Math.max(-0.45, Math.min(1.1, crane.vy / 520));
  if (crane.y < state.ceiling - 30) {
    crane.y = state.ceiling - 30;
    crane.vy = 0;
  }
  if (crane.y + CRANE_RADIUS >= state.ground) {
    // the meadow is soft: bounce back up (it still costs a heart)
    crane.y = state.ground - CRANE_RADIUS;
    crane.vy = -tune.flap * 1.05;
    bump(state, state.ground);
    if (state.over) return state;
  }

  const move = tune.speed * dt;
  state.scroll += move;
  state.nextIn -= move;
  if (state.nextIn <= 0) {
    spawn(state);
    state.nextIn += tune.spacing;
  }
  const half = OBSTACLE_WIDTH / 2;
  for (let i = 0; i < POOL; i++) {
    const o = state.obstacles[i];
    if (!o.active) continue;
    o.x -= move;
    if (o.x < -OBSTACLE_WIDTH) {
      o.active = false;
      continue;
    }
    const top = o.gapY - o.gapH / 2;
    const bottom = o.gapY + o.gapH / 2;
    if (
      hitsRect(crane.x, crane.y, CRANE_RADIUS, o.x - half, -200, o.x + half, top) ||
      hitsRect(crane.x, crane.y, CRANE_RADIUS, o.x - half, bottom, o.x + half, state.ground + 200)
    ) {
      bump(state, crane.y);
      if (state.over) return state;
    }
    if (o.star && Math.abs(o.x - crane.x) < 22 && Math.abs(o.starY - crane.y) < 26) {
      o.star = false;
      state.stars += 1;
      state.score += 1;
      emit(state, "star", o.x, o.starY, state.stars);
    }
    if (!o.scored && o.x + half < crane.x - CRANE_RADIUS) {
      o.scored = true;
      state.gaps += 1;
      state.score += 1;
      if (state.hurt === 0) state.clean += 1;
      state.bestClean = Math.max(state.bestClean, state.clean);
      emit(state, "gap", o.x, o.gapY, state.gaps);
    }
  }
  return state;
}

export function rewardsFor({ gaps, bestClean }) {
  const earned = [];
  if (gaps >= 25) earned.push({ sticker: "st-crane", reason: "25 gaps in one flight" });
  if (bestClean >= 15) earned.push({ sticker: "st-sprig", reason: "15 gaps without a single bump" });
  return earned;
}
