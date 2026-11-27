// boop the cats: the rules, with no drawing (tested in scripts/test-games-dexterity.mjs).
// A pop-up game built from scratch: the open-source whack-a-mole projects found were a few lines
// each and unmaintained, so there was nothing worth adapting. Nothing is allocated during a round.
import { clamp } from "../_kit/random.js";

export const CELLS = 9;
export const KINDS = {
  calico: { points: 1, boops: 1, stay: 1 },
  grey: { points: 1, boops: 1, stay: 1 },
  black: { points: 2, boops: 1, stay: 0.72 },
  chonk: { points: 3, boops: 2, stay: 1.35 },
  sleepy: { points: 0, boops: 1, stay: 1.25 },
};
const RISE = 0.16; // seconds to pop up
const HIDE = 0.2; // seconds to duck back down
const HAPPY = 0.5; // how long a booped cat beams before it hides
const COMBO_GAP = 1.15; // boops closer together than this keep the combo going
export const EVENT_SLOTS = 12;

export function roundLength(calm) {
  return calm ? 60 : 45;
}

export function pace(time, calm = false) {
  const t = clamp(time / roundLength(calm), 0, 1);
  return calm
    ? { gap: 1.2 - 0.4 * t, stay: 1.9 - 0.5 * t, max: 2 + Math.round(t), sleepy: 0.1 }
    : { gap: 0.95 - 0.47 * t, stay: 1.55 - 0.68 * t, max: 2 + Math.round(t * 2), sleepy: 0.08 + 0.1 * t };
}

export function createBoop({ calm = false, random = Math.random } = {}) {
  return {
    calm, random,
    time: 0, length: roundLength(calm), score: 0, boops: 0, missed: 0, woke: 0, combo: 0, bestCombo: 0,
    lastBoop: -10, spawnIn: 0.7, over: false,
    cells: Array.from({ length: CELLS }, () => ({ mode: "empty", kind: "calico", t: 0, stay: 1, lift: 0, left: 1, wobble: 0 })),
    events: Array.from({ length: EVENT_SLOTS }, () => ({ type: "", cell: 0, kind: "", value: 0 })),
    eventCount: 0,
  };
}

function emit(state, type, cell, kind, value = 0) {
  if (state.eventCount >= EVENT_SLOTS) return;
  const event = state.events[state.eventCount++];
  event.type = type;
  event.cell = cell;
  event.kind = kind;
  event.value = value;
}

function chooseKind(state, level) {
  const roll = state.random();
  if (roll < level.sleepy) return "sleepy";
  if (state.time > 8 && roll < level.sleepy + 0.1) return "chonk";
  if (state.time > 4 && roll < level.sleepy + 0.24) return "black";
  return state.random() < 0.5 ? "calico" : "grey";
}

export function popUp(state, index = -1, kind = null) {
  const level = pace(state.time, state.calm);
  let up = 0;
  for (let i = 0; i < CELLS; i++) if (state.cells[i].mode !== "empty") up += 1;
  if (index < 0) {
    if (up >= level.max) return -1;
    // a random empty box, without building an array
    let empty = CELLS - up;
    if (empty <= 0) return -1;
    let pick = Math.floor(state.random() * empty);
    for (let i = 0; i < CELLS; i++) {
      if (state.cells[i].mode !== "empty") continue;
      if (pick-- === 0) {
        index = i;
        break;
      }
    }
  }
  const cell = state.cells[index];
  if (!cell || cell.mode !== "empty") return -1;
  cell.kind = kind ?? chooseKind(state, level);
  cell.mode = "rising";
  cell.t = 0;
  cell.stay = level.stay * KINDS[cell.kind].stay;
  cell.left = KINDS[cell.kind].boops;
  cell.lift = 0;
  cell.wobble = 0;
  emit(state, "pop", index, cell.kind);
  return index;
}

export function stepBoop(state, dt) {
  state.eventCount = 0;
  if (state.over) return state;
  state.time += dt;
  if (state.time >= state.length) {
    state.time = state.length;
    state.over = true;
    emit(state, "over", 0, "", state.score);
    return state;
  }
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    popUp(state);
    state.spawnIn += pace(state.time, state.calm).gap * (0.7 + state.random() * 0.6);
  }
  for (let i = 0; i < CELLS; i++) {
    const cell = state.cells[i];
    if (cell.mode === "empty") continue;
    cell.t += dt;
    cell.wobble = Math.max(0, cell.wobble - dt * 3);
    if (cell.mode === "rising") {
      cell.lift = Math.min(1, cell.t / RISE);
      if (cell.t >= RISE) {
        cell.mode = "up";
        cell.t = 0;
      }
    } else if (cell.mode === "up") {
      cell.lift = 1;
      if (cell.t >= cell.stay) {
        cell.mode = "hiding";
        cell.t = 0;
        if (cell.kind !== "sleepy") {
          state.missed += 1;
          emit(state, "missed", i, cell.kind);
        }
      }
    } else if (cell.mode === "booped" || cell.mode === "grumpy") {
      cell.lift = 1;
      if (cell.t >= (cell.mode === "grumpy" ? HAPPY * 1.4 : HAPPY)) {
        cell.mode = "hiding";
        cell.t = 0;
      }
    } else if (cell.mode === "hiding") {
      cell.lift = Math.max(0, 1 - cell.t / HIDE);
      if (cell.t >= HIDE) {
        cell.mode = "empty";
        cell.lift = 0;
      }
    }
  }
  return state;
}

/** A tap on box `index`. Returns what happened: "boop", "nudge" (a chonk wants one more), "woke" or "". */
export function boop(state, index) {
  state.eventCount = 0;
  if (state.over) return "";
  const cell = state.cells[index];
  if (!cell || (cell.mode !== "rising" && cell.mode !== "up")) return "";
  if (cell.mode === "rising" && cell.lift < 0.35) return "";
  if (cell.kind === "sleepy") {
    cell.mode = "grumpy";
    cell.t = 0;
    state.woke += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - 1);
    emit(state, "woke", index, cell.kind, -1);
    return "woke";
  }
  cell.left -= 1;
  cell.wobble = 1;
  if (cell.left > 0) {
    cell.t = Math.min(cell.t, cell.stay * 0.4); // a nudge buys a little more time
    emit(state, "nudge", index, cell.kind);
    return "nudge";
  }
  state.combo = state.time - state.lastBoop <= COMBO_GAP ? state.combo + 1 : 1;
  state.lastBoop = state.time;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const points = KINDS[cell.kind].points * (state.combo >= 8 ? 2 : 1);
  state.score += points;
  state.boops += 1;
  cell.mode = "booped";
  cell.t = 0;
  emit(state, "boop", index, cell.kind, points);
  return "boop";
}

export function rewardsFor({ boops, missed, woke }) {
  const earned = [];
  if (boops >= 40) earned.push({ sticker: "st-kitten", reason: "40 boops in one round" });
  if (boops >= 25 && missed === 0 && woke === 0) earned.push({ sticker: "st-paw", reason: "every cat booped, no nappers woken" });
  return earned;
}
