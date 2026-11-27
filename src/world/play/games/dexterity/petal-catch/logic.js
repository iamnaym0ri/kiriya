// petal catch: the rules, with no drawing, so they can be tested (scripts/test-games-dexterity.mjs).
// Built from scratch (a catch game is a handful of lines; the open-source ones found were tiny and
// unmaintained). Everything is preallocated: a step never creates objects.
import { clamp, ease } from "../_kit/random.js";

export const KINDS = ["lilac", "sakura", "star", "heart", "thorn"];
export const POOL = 48;
export const EVENT_SLOTS = 16;
export const LIVES = 3;

export function difficulty(time, calm = false) {
  const ramp = 1 - Math.exp(-time / 70);
  const spawnRamp = 1 - Math.exp(-time / 60);
  const thornRamp = time < 8 ? 0 : 1 - Math.exp(-(time - 8) / 60);
  return calm
    ? { fall: 92 + 70 * ramp, every: 1.05 - 0.4 * spawnRamp, thorn: time < 8 ? 0 : 0.06 + 0.08 * thornRamp }
    : { fall: 122 + 118 * ramp, every: 0.86 - 0.44 * spawnRamp, thorn: time < 8 ? 0 : 0.12 + 0.16 * thornRamp };
}

export function createPetals({ width = 414, height = 760, calm = false, random = Math.random } = {}) {
  const items = Array.from({ length: POOL }, () => ({
    active: false, kind: "lilac", x: 0, y: 0, x0: 0, prevY: 0, vy: 0, sway: 0, phase: 0, rate: 0, rot: 0, spin: 0, r: 14, age: 0,
  }));
  const events = Array.from({ length: EVENT_SLOTS }, () => ({ type: "", kind: "", x: 0, y: 0, value: 0 }));
  const state = {
    width, height, calm, random,
    time: 0, score: 0, caught: 0, missed: 0, streak: 0, bestStreak: 0, lives: LIVES, over: false,
    hurt: 0, spawnIn: 0.6, flurryIn: 24, flurryLeft: 0, flurryGap: 0, flurrySide: 0,
    basket: { x: width / 2, target: width / 2, y: height - 104, w: 96, h: 60, lean: 0, squash: 0 },
    items, events, eventCount: 0,
  };
  return state;
}

export function resizePetals(state, width, height) {
  state.width = width;
  state.height = height;
  state.basket.y = height - Math.min(112, Math.max(88, height * 0.13));
  state.basket.x = clamp(state.basket.x, state.basket.w / 2, width - state.basket.w / 2);
  state.basket.target = clamp(state.basket.target, state.basket.w / 2, width - state.basket.w / 2);
}

export function aimBasket(state, x) {
  const half = state.basket.w / 2;
  state.basket.target = clamp(x, half, state.width - half);
}

function emit(state, type, kind, x, y, value = 0) {
  if (state.eventCount >= EVENT_SLOTS) return;
  const event = state.events[state.eventCount++];
  event.type = type;
  event.kind = kind;
  event.x = x;
  event.y = y;
  event.value = value;
}

function chooseKind(state) {
  const { random } = state;
  const level = difficulty(state.time, state.calm);
  const roll = random();
  if (roll < level.thorn) return "thorn";
  if (roll < level.thorn + 0.045) return "star";
  if (state.lives < LIVES && roll < level.thorn + 0.045 + 0.035) return "heart";
  return random() < 0.55 ? "lilac" : "sakura";
}

export function spawn(state, kind = chooseKind(state), x = null) {
  let item = null;
  for (let i = 0; i < state.items.length && !item; i++) if (!state.items[i].active) item = state.items[i];
  if (!item) return null;
  const { random, width } = state;
  const level = difficulty(state.time, state.calm);
  item.active = true;
  item.kind = kind;
  item.r = kind === "thorn" ? 19 : kind === "star" ? 17 : 15;
  item.sway = kind === "thorn" ? 6 + random() * 8 : 14 + random() * 22;
  item.x0 = x ?? item.sway + item.r + random() * Math.max(1, width - 2 * (item.sway + item.r));
  item.phase = random() * Math.PI * 2;
  item.rate = 1.3 + random() * 1.4;
  item.x = item.x0 + Math.sin(item.phase) * item.sway;
  item.y = -24;
  item.prevY = item.y;
  item.vy = level.fall * (kind === "thorn" ? 1.08 : 0.86 + random() * 0.28);
  item.rot = random() * Math.PI * 2;
  item.spin = (random() - 0.5) * (kind === "thorn" ? 2.2 : 3.4);
  item.age = 0;
  return item;
}

export function stepPetals(state, dt) {
  state.eventCount = 0;
  if (state.over) return state;
  state.time += dt;
  if (state.hurt > 0) state.hurt = Math.max(0, state.hurt - dt);

  const { basket } = state;
  const before = basket.x;
  basket.x += (basket.target - basket.x) * ease(22, dt);
  const speed = dt > 0 ? (basket.x - before) / dt : 0;
  basket.lean += (clamp(speed / 900, -0.22, 0.22) - basket.lean) * ease(12, dt);
  basket.squash = Math.max(0, basket.squash - dt * 4);

  // new petals: a steady drizzle, and now and then a little flurry across the sky
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawn(state);
    state.spawnIn += difficulty(state.time, state.calm).every * (0.75 + state.random() * 0.5);
  }
  state.flurryIn -= dt;
  if (state.flurryIn <= 0 && state.flurryLeft === 0) {
    state.flurryLeft = state.calm ? 5 : 7;
    state.flurryGap = 0;
    state.flurrySide = state.random() < 0.5 ? 0 : 1;
    state.flurryIn = 22 + state.random() * 10;
    emit(state, "flurry", "", state.width / 2, 0);
  }
  if (state.flurryLeft > 0) {
    state.flurryGap -= dt;
    if (state.flurryGap <= 0) {
      const total = state.calm ? 5 : 7;
      const step = total - state.flurryLeft;
      const t = (step + 0.5) / total;
      const x = 30 + (state.width - 60) * (state.flurrySide ? 1 - t : t);
      spawn(state, state.random() < 0.5 ? "lilac" : "sakura", x);
      state.flurryLeft -= 1;
      state.flurryGap = 0.16;
    }
  }

  const rim = basket.y - basket.h * 0.22;
  const reach = basket.w * 0.5;
  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i];
    if (!item.active) continue;
    item.age += dt;
    item.prevY = item.y;
    item.y += item.vy * dt;
    item.x = item.x0 + Math.sin(item.phase + item.age * item.rate) * item.sway;
    item.rot += item.spin * dt;

    if (item.prevY < rim && item.y >= rim && Math.abs(item.x - basket.x) <= reach + item.r * 0.35) {
      item.active = false;
      if (item.kind === "thorn") {
        if (state.hurt > 0) continue; // still blinking from the last one: it bounces off
        state.lives -= 1;
        state.hurt = 1.1;
        state.streak = 0;
        emit(state, "hurt", "thorn", item.x, rim, state.lives);
        if (state.lives <= 0) {
          state.over = true;
          emit(state, "over", "", basket.x, rim);
          return state;
        }
        continue;
      }
      state.caught += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const points = item.kind === "star" ? 5 : state.streak >= 20 ? 2 : 1;
      state.score += points;
      if (item.kind === "heart" && state.lives < LIVES) state.lives += 1;
      basket.squash = 1;
      emit(state, "catch", item.kind, item.x, rim, points);
      continue;
    }
    if (item.y > state.height + 30) {
      item.active = false;
      if (item.kind !== "thorn") {
        state.missed += 1;
        if (state.streak > 0) emit(state, "miss", item.kind, item.x, state.height, state.streak);
        state.streak = 0;
      }
    }
  }
  return state;
}

export function rewardsFor({ caught, bestStreak }) {
  const earned = [];
  if (caught >= 60) earned.push({ sticker: "st-petal", reason: "60 petals in one go" });
  if (bestStreak >= 40) earned.push({ sticker: "st-bow", reason: "a 40-petal streak" });
  return earned;
}
