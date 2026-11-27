// Charm grid: a little Latin-square puzzle with boxes (4×4 with 2×2 boxes, 6×6 with 2×3 boxes),
// played with charms instead of digits. Original code: a backtracking solver that counts solutions
// (so every puzzle is checked to have exactly one), and a "singles" solver that proves a puzzle can
// be finished by looking, never by guessing. Values are 1..n, 0 is empty; cells are r * n + c.

export const TIERS = {
  cosy: { n: 4, label: "cosy", hint: "4 × 4", targetGivens: 6 },
  gentle: { n: 6, label: "gentle", hint: "6 × 6", targetGivens: 15 },
  tricky: { n: 6, label: "tricky", hint: "6 × 6", targetGivens: 10 },
};
export const BOX = { 4: [2, 2], 6: [2, 3] }; // rows × columns of a box

const peerCache = new Map();
/** For each cell, the other cells in its row, column and box. */
export function peers(n) {
  if (peerCache.has(n)) return peerCache.get(n);
  const [br, bc] = BOX[n];
  const list = Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const set = new Set();
    for (let k = 0; k < n; k++) {
      set.add(r * n + k);
      set.add(k * n + c);
    }
    const r0 = r - (r % br);
    const c0 = c - (c % bc);
    for (let y = r0; y < r0 + br; y++) for (let x = c0; x < c0 + bc; x++) set.add(y * n + x);
    set.delete(i);
    return [...set];
  });
  peerCache.set(n, list);
  return list;
}

/** Every row, column and box as a list of cells. */
export function units(n) {
  const [br, bc] = BOX[n];
  const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c));
  const cols = Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c));
  const boxes = [];
  for (let r0 = 0; r0 < n; r0 += br)
    for (let c0 = 0; c0 < n; c0 += bc) {
      const box = [];
      for (let y = r0; y < r0 + br; y++) for (let x = c0; x < c0 + bc; x++) box.push(y * n + x);
      boxes.push(box);
    }
  return [...rows, ...cols, ...boxes];
}

export function candidates(grid, n, i) {
  if (grid[i]) return [];
  const used = new Set(peers(n)[i].map((p) => grid[p]));
  const result = [];
  for (let v = 1; v <= n; v++) if (!used.has(v)) result.push(v);
  return result;
}

/** How many solutions the grid has, counting no further than `limit`. */
export function countSolutions(grid, n, limit = 2) {
  const work = [...grid];
  let found = 0;
  const step = () => {
    let best = -1;
    let bestOptions = null;
    for (let i = 0; i < work.length; i++) {
      if (work[i]) continue;
      const options = candidates(work, n, i);
      if (!options.length) return;
      if (!bestOptions || options.length < bestOptions.length) {
        best = i;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) {
      found += 1;
      return;
    }
    for (const v of bestOptions) {
      work[best] = v;
      step();
      if (found >= limit) break;
    }
    work[best] = 0;
  };
  step();
  return found;
}

/** A random complete grid. */
export function fullGrid(n, random = Math.random) {
  const grid = Array(n * n).fill(0);
  const fill = (i) => {
    if (i === grid.length) return true;
    const options = candidates(grid, n, i);
    for (let k = options.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [options[k], options[j]] = [options[j], options[k]];
    }
    for (const v of options) {
      grid[i] = v;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/**
 * One step of looking-not-guessing: a cell with only one charm left (a naked single), or a charm
 * with only one place left in a row, column or box (a hidden single). Null when stuck.
 */
export function nextSingle(grid, n) {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) continue;
    const options = candidates(grid, n, i);
    if (options.length === 1) return { cell: i, value: options[0], why: "only" };
  }
  for (const unit of units(n)) {
    for (let v = 1; v <= n; v++) {
      if (unit.some((i) => grid[i] === v)) continue;
      const spots = unit.filter((i) => !grid[i] && candidates(grid, n, i).includes(v));
      if (spots.length === 1) return { cell: spots[0], value: v, why: "place" };
    }
  }
  return null;
}

/** True when singles alone finish the grid. */
export function solvableBySingles(grid, n) {
  const work = [...grid];
  for (;;) {
    if (work.every(Boolean)) return true;
    const step = nextSingle(work, n);
    if (!step) return false;
    work[step.cell] = step.value;
  }
}

/** A puzzle for a tier: a unique solution, finishable by looking alone. */
export function generate(tierId, random = Math.random) {
  const tier = TIERS[tierId];
  const { n } = tier;
  const solution = fullGrid(n, random);
  const puzzle = [...solution];
  const order = solution.map((_, i) => i);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(random() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  let givens = puzzle.length;
  for (const i of order) {
    if (givens <= tier.targetGivens) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, n, 2) === 1 && solvableBySingles(puzzle, n)) givens -= 1;
    else puzzle[i] = keep;
  }
  return { tier: tierId, n, puzzle, solution, givens };
}

/** Cells whose charm repeats in their row, column or box. */
export function clashes(grid, n) {
  const all = peers(n);
  const set = new Set();
  grid.forEach((v, i) => {
    if (v && all[i].some((p) => grid[p] === v)) set.add(i);
  });
  return set;
}

export const isSolved = (grid, solution) => grid.every((v, i) => v === solution[i]);
