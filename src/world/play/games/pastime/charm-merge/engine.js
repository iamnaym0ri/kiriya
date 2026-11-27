/*
 * Charm ladder: the sliding-and-merging rules, adapted from 2048 by Gabriele Cirulli
 * (https://github.com/gabrielecirulli/2048, js/game_manager.js and js/grid.js).
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Gabriele Cirulli
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Changes for kiriya.love: rewritten as pure functions over a flat array (no classes, DOM or
 * storage), numbers became charm tiers on a ladder that tops out at a crown, and each move
 * reports what slid where so the board can animate it.
 */

export const SIZE = 4;
export const CROWN = 9; // the tier she is climbing toward

/** The charms, bottom of the ladder first. Values double like the original's numbers. */
export const LADDER = [
  null,
  { name: "bead" },
  { name: "heart" },
  { name: "star" },
  { name: "bell" },
  { name: "ribbon" },
  { name: "moon" },
  { name: "blossom" },
  { name: "gem" },
  { name: "crown" },
  { name: "starry crown" },
  { name: "moon crown" },
  { name: "heart crown" },
  { name: "dream crown" },
];
export const TOP = LADDER.length - 1;
export const points = (tier) => 2 ** tier;

const VECTORS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const at = (x, y) => y * SIZE + x;
const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

export function emptyCells(cells) {
  return cells.flatMap((cell, i) => (cell ? [] : [i]));
}

/** A new charm in a free spot: a bead nine times in ten, otherwise a heart. */
export function addRandomTile(state, random = Math.random) {
  const free = emptyCells(state.cells);
  if (!free.length) return state;
  const spot = free[Math.floor(random() * free.length)];
  const cells = [...state.cells];
  cells[spot] = { id: state.nextId, tier: random() < 0.9 ? 1 : 2 };
  return { ...state, cells, nextId: state.nextId + 1, spawned: cells[spot].id };
}

export function newGame(random = Math.random) {
  let state = { cells: new Array(SIZE * SIZE).fill(null), score: 0, nextId: 1, top: 1, crowned: false, over: false, moves: 0 };
  state = addRandomTile(state, random);
  state = addRandomTile(state, random);
  return { ...state, top: Math.max(...state.cells.filter(Boolean).map((tile) => tile.tier)) };
}

function farthest(cells, x, y, vector) {
  let previous;
  do {
    previous = { x, y };
    x = previous.x + vector.x;
    y = previous.y + vector.y;
  } while (inside(x, y) && !cells[at(x, y)]);
  return { farthest: previous, next: { x, y } };
}

/** Matching charms touching in any direction: a move is still possible. */
export function movesAvailable(cells) {
  if (emptyCells(cells).length) return true;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const tile = cells[at(x, y)];
      if (tile.tier >= TOP) continue; // the dream crown is the very top: two of them can't merge
      if ((x + 1 < SIZE && cells[at(x + 1, y)]?.tier === tile.tier) || (y + 1 < SIZE && cells[at(x, y + 1)]?.tier === tile.tier)) return true;
    }
  return false;
}

/**
 * Slides every charm toward `direction` ("up" | "right" | "down" | "left"); two matching charms
 * that meet become the next charm up (each charm merges once per move). Returns
 * `{ moved, state, slides: { id: toIndex }, merges: [{ id, tier, at, from: [idA, idB] }] }`.
 * A move that changes nothing returns `moved: false` and the same state, with no new charm.
 */
export function move(state, direction, random = Math.random) {
  const vector = VECTORS[direction];
  if (!vector || state.over) return { moved: false, state, slides: {}, merges: [] };
  const cells = [...state.cells];
  const xs = [0, 1, 2, 3], ys = [0, 1, 2, 3];
  if (vector.x === 1) xs.reverse();
  if (vector.y === 1) ys.reverse();
  const merged = new Set();
  const slides = {};
  const merges = [];
  let nextId = state.nextId;
  let score = state.score;
  let top = state.top;
  let moved = false;
  for (const x of xs)
    for (const y of ys) {
      const tile = cells[at(x, y)];
      if (!tile) continue;
      const { farthest: far, next } = farthest(cells, x, y, vector);
      const other = inside(next.x, next.y) ? cells[at(next.x, next.y)] : null;
      if (other && other.tier === tile.tier && !merged.has(other.id) && tile.tier < TOP) {
        const made = { id: nextId++, tier: tile.tier + 1 };
        cells[at(next.x, next.y)] = made;
        cells[at(x, y)] = null;
        merged.add(made.id);
        slides[tile.id] = at(next.x, next.y);
        slides[other.id] = at(next.x, next.y);
        merges.push({ id: made.id, tier: made.tier, at: at(next.x, next.y), from: [tile.id, other.id] });
        score += points(made.tier);
        top = Math.max(top, made.tier);
        moved = true;
      } else {
        const to = at(far.x, far.y);
        if (to !== at(x, y)) {
          cells[to] = tile;
          cells[at(x, y)] = null;
          moved = true;
        }
        slides[tile.id] = to;
      }
    }
  if (!moved) return { moved: false, state, slides: {}, merges: [] };
  let next = { ...state, cells, nextId, score, top, moves: state.moves + 1, crowned: state.crowned || top >= CROWN };
  next = addRandomTile(next, random);
  next.over = !movesAvailable(next.cells);
  return { moved: true, state: next, slides, merges };
}

/** A saved game is only trusted if it still looks like one. */
export function isGame(state) {
  return Boolean(state && Array.isArray(state.cells) && state.cells.length === SIZE * SIZE &&
    state.cells.every((cell) => cell === null || (Number.isInteger(cell.id) && cell.tier >= 1 && cell.tier <= TOP)) && Number.isInteger(state.nextId));
}
