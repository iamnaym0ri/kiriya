/*
 * Charm drop: falling-block rules adapted from javascript-tetris by Jake Gordon
 * (https://github.com/jakesgordon/javascript-tetris): the 4×4 bit-mask pieces, eachblock(),
 * occupied(), the "bag of four of each" randomiser, line removal and the doubling line score.
 *
 * Copyright (c) 2011, 2012, 2013, 2014, 2015, 2016 Jake Gordon and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changes for kiriya.love: pure functions over plain state (no DOM, timers or globals), pieces
 * renamed and redrawn as charms, a seeded bag, wall kicks, a ghost, hold, hard drop, gentler
 * speeds, and a report of which rows cleared so the board can sparkle them away.
 */

export const COLS = 10;
export const ROWS = 18;

// Each piece: four rotations as 16-bit masks of a 4×4 box (from the original).
export const PIECES = {
  ribbon: { size: 4, blocks: [0x0f00, 0x2222, 0x00f0, 0x4444] }, // the long one
  moon: { size: 3, blocks: [0x44c0, 0x8e00, 0x6440, 0x0e20] },
  star: { size: 3, blocks: [0x4460, 0x0e80, 0xc440, 0x2e00] },
  locket: { size: 2, blocks: [0xcc00, 0xcc00, 0xcc00, 0xcc00] },
  leaf: { size: 3, blocks: [0x06c0, 0x8c40, 0x6c00, 0x4620] },
  crown: { size: 3, blocks: [0x0e40, 0x4c40, 0x4e00, 0x4640] },
  petal: { size: 3, blocks: [0x0c60, 0x4c80, 0xc600, 0x2640] },
};
export const KINDS = Object.keys(PIECES);

/** Every square a piece covers: [[x, y], …]. */
export function cellsOf({ type, x, y, dir }) {
  const blocks = PIECES[type].blocks[dir];
  const cells = [];
  let row = 0, col = 0;
  for (let bit = 0x8000; bit > 0; bit >>= 1) {
    if (blocks & bit) cells.push([x + col, y + row]);
    if (++col === 4) {
      col = 0;
      ++row;
    }
  }
  return cells;
}

/** Off the board or on a settled charm? (Above the top is fine while a piece arrives.) */
export function occupied(grid, piece) {
  return cellsOf(piece).some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && grid[y][x]));
}

const emptyGrid = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(null));

function takeFromBag(state, random) {
  let bag = state.bag;
  if (!bag.length) bag = KINDS.flatMap((kind) => [kind, kind, kind, kind]);
  const i = Math.floor(random() * bag.length);
  return { type: bag[i], bag: [...bag.slice(0, i), ...bag.slice(i + 1)] };
}

function spawn(type) {
  return { type, dir: 0, x: Math.floor((COLS - PIECES[type].size) / 2), y: type === "ribbon" ? -1 : 0 };
}

export function newGame(random = Math.random) {
  let state = { grid: emptyGrid(), bag: [], queue: [], hold: null, canHold: true, score: 0, lines: 0, over: false, pieces: 0, best4: 0 };
  while (state.queue.length < 4) {
    const { type, bag } = takeFromBag(state, random);
    state = { ...state, bag, queue: [...state.queue, type] };
  }
  return next(state, random);
}

function next(state, random) {
  const [type, ...rest] = state.queue;
  const { type: added, bag } = takeFromBag(state, random);
  const current = spawn(type);
  const over = occupied(state.grid, current);
  return { ...state, bag, queue: [...rest, added], current, canHold: true, over: state.over || over };
}

export const level = (state) => Math.floor(state.lines / 10) + 1;
/** Seconds per row: slow and kind to start, a little quicker every ten lines. */
export const stepFor = (state) => Math.max(0.22, 0.85 - (level(state) - 1) * 0.07);

export function move(state, dx, dy = 0) {
  if (state.over) return state;
  const piece = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
  return occupied(state.grid, piece) ? state : { ...state, current: piece };
}

const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];

/** Turns the piece; if it would bump something, tries a nudge left, right or up. */
export function rotate(state, turn = 1) {
  if (state.over) return state;
  const dir = (state.current.dir + turn + 4) % 4;
  for (const [dx, dy] of KICKS) {
    const piece = { ...state.current, dir, x: state.current.x + dx, y: state.current.y + dy };
    if (!occupied(state.grid, piece)) return { ...state, current: piece };
  }
  return state;
}

export function ghostOf(state) {
  let piece = state.current;
  while (!occupied(state.grid, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
  return piece;
}

export const resting = (state) => occupied(state.grid, { ...state.current, y: state.current.y + 1 });

/**
 * Settles the piece where it is, clears full rows and brings the next piece.
 * Returns `{ state, cleared: [row indices before removal], landed: [[x, y], …] }`.
 */
export function lock(state, random = Math.random) {
  const grid = state.grid.map((row) => [...row]);
  const landed = cellsOf(state.current);
  let above = false;
  for (const [x, y] of landed) {
    if (y < 0) above = true;
    else grid[y][x] = state.current.type;
  }
  const cleared = [];
  for (let y = 0; y < ROWS; y++) if (grid[y].every(Boolean)) cleared.push(y);
  const kept = grid.filter((_, y) => !cleared.includes(y));
  const fresh = [...Array.from({ length: cleared.length }, () => new Array(COLS).fill(null)), ...kept];
  const n = cleared.length;
  const scored = {
    ...state,
    grid: fresh,
    lines: state.lines + n,
    score: state.score + 10 + (n ? 100 * 2 ** (n - 1) * level(state) : 0),
    pieces: state.pieces + 1,
    best4: state.best4 + (n === 4 ? 1 : 0),
    over: above,
  };
  return { state: above ? scored : next(scored, random), cleared, landed };
}

/** One row down by gravity or by her finger (a point a row when she pushes). */
export function drop(state, { soft = false, random = Math.random } = {}) {
  if (state.over) return { state, cleared: [], locked: false };
  if (!resting(state)) {
    const moved = { ...state, current: { ...state.current, y: state.current.y + 1 }, score: state.score + (soft ? 1 : 0) };
    return { state: moved, cleared: [], locked: false };
  }
  const result = lock(state, random);
  return { ...result, locked: true };
}

/** Straight down and settle. */
export function hardDrop(state, random = Math.random) {
  if (state.over) return { state, cleared: [], landed: [] };
  const ghost = ghostOf(state);
  const rows = ghost.y - state.current.y;
  return lock({ ...state, current: ghost, score: state.score + rows * 2 }, random);
}

/** Puts the piece aside (once per piece) and takes the one saved before, or the next. */
export function hold(state, random = Math.random) {
  if (state.over || !state.canHold) return state;
  const saved = state.current.type;
  if (state.hold) {
    const current = spawn(state.hold);
    if (occupied(state.grid, current)) return state;
    return { ...state, current, hold: saved, canHold: false };
  }
  return { ...next({ ...state, hold: saved }, random), canHold: false };
}

export function isGame(value) {
  return Boolean(value && Array.isArray(value.grid) && value.grid.length === ROWS && value.grid.every((row) => Array.isArray(row) && row.length === COLS &&
    row.every((cell) => cell === null || KINDS.includes(cell))) && value.current && KINDS.includes(value.current.type) && Array.isArray(value.queue));
}
