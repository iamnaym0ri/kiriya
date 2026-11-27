// Lantern corridor: the classic "lights out" puzzle on a square grid. A tap flips that lantern and
// its four neighbours. Every board is made by tapping a lit corridor at random, so it can always be
// lit again, and its "par" (the fewest taps that light it) is worked out exactly by solving the
// taps over GF(2) and trying every way the grid lets the same pattern be lit (2⁰, 2⁴ or 2² ways on
// 3×3, 4×4 and 5×5). Original code.

/** Levels: the grid grows, and so does the number of taps a corridor was scrambled with. */
export function levelPlan(level) {
  if (level <= 3) return { size: 3, taps: 2 + level }; // 3, 4, 5
  if (level <= 6) return { size: 4, taps: level }; // 4, 5, 6
  if (level <= 9) return { size: 5, taps: level - 2 }; // 5, 6, 7
  return { size: 5, taps: 7 + ((level - 10) % 3) }; // 7, 8, 9, 7, …
}

export function neighbours(size, index) {
  const r = Math.floor(index / size);
  const c = index % size;
  const out = [index];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

/** Lit lanterns as an array of booleans; `true` is lit. */
export const allLit = (size) => Array(size * size).fill(true);
export const isLit = (board) => board.every(Boolean);

export function press(board, size, index) {
  const next = board.slice();
  for (const i of neighbours(size, index)) next[i] = !next[i];
  return next;
}

// Bit-matrix helpers: rows of the tap matrix as BigInt-free number arrays (n ≤ 25 fits in 32 bits).
function tapMatrix(size) {
  const n = size * size;
  return Array.from({ length: n }, (_, i) => neighbours(size, i).reduce((bits, j) => bits | (1 << j), 0));
}

/**
 * Every tap set that lights `board`, as bitmasks, or [] when it can't be lit. Gaussian elimination
 * over GF(2) for one answer, then the null space for the others.
 */
export function solutions(board, size) {
  const n = size * size;
  const columns = tapMatrix(size); // column j: which lanterns tap j flips (the matrix is symmetric)
  // Rows: equation i says "the taps touching lantern i add up to (lantern i is dark)".
  const rows = Array.from({ length: n }, (_, i) => ({ bits: columns[i], rhs: board[i] ? 0 : 1 }));
  const pivots = [];
  let row = 0;
  for (let col = 0; col < n && row < n; col++) {
    let p = row;
    while (p < n && !(rows[p].bits & (1 << col))) p++;
    if (p === n) continue;
    [rows[row], rows[p]] = [rows[p], rows[row]];
    for (let r = 0; r < n; r++) {
      if (r !== row && rows[r].bits & (1 << col)) {
        rows[r] = { bits: rows[r].bits ^ rows[row].bits, rhs: rows[r].rhs ^ rows[row].rhs };
      }
    }
    pivots.push(col);
    row++;
  }
  for (let r = row; r < n; r++) if (rows[r].rhs) return [];
  const pivotSet = new Set(pivots);
  const free = [];
  for (let col = 0; col < n; col++) if (!pivotSet.has(col)) free.push(col);
  const answers = [];
  for (let mask = 0; mask < 1 << free.length; mask++) {
    let taps = 0;
    free.forEach((col, k) => {
      if (mask & (1 << k)) taps |= 1 << col;
    });
    pivots.forEach((col, r) => {
      // value of the pivot variable = rhs + sum of free variables in this row
      let v = rows[r].rhs;
      for (const f of free) if (taps & (1 << f) && rows[r].bits & (1 << f)) v ^= 1;
      if (v) taps |= 1 << col;
    });
    answers.push(taps);
  }
  return answers;
}

const popcount = (x) => {
  let count = 0;
  for (let v = x; v; v &= v - 1) count++;
  return count;
};

/** The fewest taps that light `board` (as cell indices), or null when it can't be lit. */
export function bestTaps(board, size) {
  const all = solutions(board, size);
  if (!all.length) return null;
  const best = all.reduce((a, b) => (popcount(b) < popcount(a) ? b : a));
  const cells = [];
  for (let i = 0; i < size * size; i++) if (best & (1 << i)) cells.push(i);
  return cells;
}

/** A level's corridor: a board whose best answer takes exactly `taps` taps. */
export function newCorridor(level, random = Math.random) {
  const { size, taps } = levelPlan(level);
  const n = size * size;
  for (let attempt = 0; attempt < 200; attempt++) {
    const picks = new Set();
    while (picks.size < taps) picks.add(Math.floor(random() * n));
    let board = allLit(size);
    for (const i of picks) board = press(board, size, i);
    const best = bestTaps(board, size);
    if (best && best.length === taps) return { level, size, board, start: board, par: taps };
  }
  // Rare: settle for whatever par the last scramble has.
  const picks = new Set();
  while (picks.size < taps) picks.add(Math.floor(random() * n));
  let board = allLit(size);
  for (const i of picks) board = press(board, size, i);
  return { level, size, board, start: board, par: bestTaps(board, size)?.length ?? taps };
}

/** Stars for a lit corridor: three at par, two within two taps of it, one otherwise. */
export const starsFor = (taps, par) => (taps <= par ? 3 : taps <= par + 2 ? 2 : 1);
