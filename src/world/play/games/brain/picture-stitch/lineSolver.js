/*
 * Line solving for picture stitch.
 *
 * `pushLeft` and `pushSolve` are adapted from nonogram-solver by Thomas Rosenau
 * (https://github.com/ThomasR/nonogram-solver, src/solvers/pushSolver.js),
 * Copyright Thomas Rosenau, licensed under the Apache License, Version 2.0
 * (http://www.apache.org/licenses/LICENSE-2.0). Changes: ES module, named exports, comments, and
 * the "no hints" case also clears unknown cells. `settleLine` (a complete enumeration line solver)
 * and `solveByLines` are new, written for this game.
 *
 * A line is an array of cells: 1 = stitched, -1 = empty (crossed out), 0 = not known yet.
 * Hints are the clue numbers for that line, e.g. [3, 1].
 */

const shouldSkip = (line, hint, i) => {
  let allZeros = line[i - 1] === 0;
  let collision = line[i + hint] === 1;
  for (let x = i; x < i + hint; x++) {
    if (line[x] === -1 || x >= line.length) {
      collision = true;
      break;
    }
    if (line[x]) allZeros = false;
  }
  return allZeros || collision;
};

/** The leftmost arrangement of the hints that agrees with the line, or null if none does. */
export function pushLeft(line, hints) {
  if (hints.length === 0) return line.includes(1) ? null : line;
  const hint = hints[0];
  let maxIndex = line.indexOf(1);
  if (maxIndex === -1) maxIndex = line.length - hint;
  for (let i = 0; i <= maxIndex; i++) {
    if (shouldSkip(line, hint, i)) continue;
    const rest = pushLeft(line.slice(i + hint + 1), hints.slice(1));
    if (rest) {
      const result = line.slice();
      for (let x = i; x < i + hint; x++) result[x] = 1;
      for (let x = 0; x < rest.length; x++) result[x + i + hint + 1] = rest[x];
      return result;
    }
  }
  return null;
}

// Numbers the blocks and gaps of an arrangement, so two arrangements can be compared cell by cell.
const enumerate = (array) => {
  for (let i = 0, j = array[0] % 2; i < array.length; i++) {
    if (array[i] === -1) array[i] = 0;
    if (array[i] % 2 !== j % 2) j++;
    array[i] = j;
  }
};

/** The quick overlap rule: cells that agree between the leftmost and rightmost arrangements. */
export function pushSolve(line, hints) {
  if (hints.length === 0) return line.includes(1) ? null : line.map(() => -1);
  const leftmost = pushLeft(line, hints);
  if (!leftmost) return null;
  const rightmost = pushLeft(line.slice().reverse(), hints.slice().reverse()).reverse();
  enumerate(leftmost);
  enumerate(rightmost);
  return leftmost.map((el, i) => (el === rightmost[i] ? (el % 2 ? 1 : -1) : line[i]));
}

/**
 * Everything the clue says about this line: tries every arrangement that agrees with what's known
 * and keeps the cells they all share. Returns null if no arrangement fits (a contradiction).
 */
export function settleLine(line, hints) {
  const n = line.length;
  const always = Array(n).fill(null);
  let any = false;
  const place = (k, start, cells) => {
    if (k === hints.length) {
      for (let i = start; i < n; i++) if (line[i] === 1) return;
      const full = cells.concat(Array(n - cells.length).fill(-1));
      any = true;
      for (let i = 0; i < n; i++) always[i] = always[i] === null ? full[i] : always[i] === full[i] ? full[i] : 0;
      return;
    }
    const remaining = hints.slice(k).reduce((sum, h) => sum + h, 0) + hints.length - k - 1;
    for (let s = start; s + remaining <= n; s++) {
      if (line[s - 1] === 1 && s > start) break; // a stitched cell left uncovered
      let fits = true;
      for (let i = s; i < s + hints[k]; i++) if (line[i] === -1) fits = false;
      if (s + hints[k] < n && line[s + hints[k]] === 1) fits = false;
      for (let i = start; i < s; i++) if (line[i] === 1) fits = false;
      if (!fits) continue;
      const next = cells.concat(Array(s - cells.length).fill(-1), Array(hints[k]).fill(1), s + hints[k] < n ? [-1] : []);
      place(k + 1, s + hints[k] + 1, next);
    }
  };
  place(0, 0, []);
  if (!any) return null;
  return always.map((v, i) => (v === 0 ? line[i] : v));
}

/**
 * Solves a puzzle one line at a time, the way a person does: each pass applies every row and
 * column clue to what's known, until nothing changes. `grid` may already hold known cells.
 * Returns the grid (1 / -1 / 0) and whether it's fully worked out.
 */
export function solveByLines(rowHints, colHints, grid) {
  const h = rowHints.length;
  const w = colHints.length;
  const cells = grid ? grid.slice() : Array(w * h).fill(0);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < h; r++) {
      const line = cells.slice(r * w, r * w + w);
      if (!line.includes(0)) continue;
      const quick = pushSolve(line, rowHints[r]);
      const next = quick && settleLine(quick, rowHints[r]);
      if (!next) return { grid: cells, solved: false, contradiction: true };
      next.forEach((v, c) => {
        if (v !== cells[r * w + c]) {
          cells[r * w + c] = v;
          changed = true;
        }
      });
    }
    for (let c = 0; c < w; c++) {
      const line = Array.from({ length: h }, (_, r) => cells[r * w + c]);
      if (!line.includes(0)) continue;
      const quick = pushSolve(line, colHints[c]);
      const next = quick && settleLine(quick, colHints[c]);
      if (!next) return { grid: cells, solved: false, contradiction: true };
      next.forEach((v, r) => {
        if (v !== cells[r * w + c]) {
          cells[r * w + c] = v;
          changed = true;
        }
      });
    }
  }
  return { grid: cells, solved: !cells.includes(0), contradiction: false };
}
