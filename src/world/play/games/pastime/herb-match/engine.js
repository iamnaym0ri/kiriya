// Herb patch: the rules of the match-3 board, with no drawing in it (tested by
// scripts/test-games-pastime.mjs). Written for this site. The board rules follow the ones
// match-three-js (Playtester's Kitchen, MIT) describes: a new board never starts with a match and
// always has a move, cleared cells fill from above, cascades repeat until the board is still, and a
// board with no moves left is reshuffled.
import { seeded, shuffle as shuffled } from "../_shared/rng.js";

export const HERBS = ["mint", "lavender", "chamomile", "rose", "borage", "marigold"];
export const SPECIALS = ["row", "col", "can", "honey"]; // bundle across, bundle down, watering can, honey pot
export const SIZE = { w: 7, h: 8 };

const index = (w, r, c) => r * w + c;

/** Every run of three or more of one herb, grouped where runs cross (an L or a T is one group). */
export function findMatches(cells, w, h) {
  const runs = [];
  const kindAt = (i) => (cells[i] && cells[i].special !== "honey" ? cells[i].kind : null);
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      const kind = kindAt(index(w, r, c));
      let end = c + 1;
      while (kind && end < w && kindAt(index(w, r, end)) === kind) end++;
      if (kind && end - c >= 3) runs.push({ dir: "h", kind, cells: Array.from({ length: end - c }, (_, k) => index(w, r, c + k)) });
      c = end;
    }
  }
  for (let c = 0; c < w; c++) {
    let r = 0;
    while (r < h) {
      const kind = kindAt(index(w, r, c));
      let end = r + 1;
      while (kind && end < h && kindAt(index(w, end, c)) === kind) end++;
      if (kind && end - r >= 3) runs.push({ dir: "v", kind, cells: Array.from({ length: end - r }, (_, k) => index(w, r + k, c)) });
      r = end;
    }
  }
  // Join runs that share a cell.
  const groups = [];
  for (const run of runs) {
    const touching = groups.filter((group) => run.cells.some((i) => group.cells.has(i)));
    const merged = { kind: run.kind, cells: new Set(run.cells), runs: [run] };
    for (const group of touching) {
      group.cells.forEach((i) => merged.cells.add(i));
      merged.runs.push(...group.runs);
      groups.splice(groups.indexOf(group), 1);
    }
    groups.push(merged);
  }
  return groups;
}

/** What a group leaves behind: five in a line → honey pot, an L or T → watering can, four → a bundle. */
export function specialFor(group) {
  const longest = Math.max(...group.runs.map((run) => run.cells.length));
  if (longest >= 5) return "honey";
  const dirs = new Set(group.runs.map((run) => run.dir));
  if (dirs.size === 2) return "can";
  if (longest === 4) return group.runs.find((run) => run.cells.length === 4).dir === "h" ? "row" : "col";
  return null;
}

function hasMatchAt(cells, w, h, i) {
  const kind = cells[i]?.special === "honey" ? null : cells[i]?.kind;
  if (!kind) return false;
  const r = Math.floor(i / w), c = i % w;
  const same = (rr, cc) => rr >= 0 && rr < h && cc >= 0 && cc < w && cells[index(w, rr, cc)]?.kind === kind && cells[index(w, rr, cc)]?.special !== "honey";
  let across = 1;
  for (let k = c - 1; same(r, k); k--) across++;
  for (let k = c + 1; same(r, k); k++) across++;
  if (across >= 3) return true;
  let down = 1;
  for (let k = r - 1; same(k, c); k--) down++;
  for (let k = r + 1; same(k, c); k++) down++;
  return down >= 3;
}

const isPower = (cell) => cell && (cell.special === "row" || cell.special === "col" || cell.special === "can");

/** A swap that does something, or null. Looks in a shuffled order when given `random` (for hints). */
export function findMove(board, random) {
  const { w, h, cells } = board;
  const order = Array.from({ length: w * h }, (_, i) => i);
  const scan = random ? shuffled(order, random) : order;
  for (const i of scan) {
    const r = Math.floor(i / w), c = i % w;
    for (const j of [c + 1 < w ? i + 1 : -1, r + 1 < h ? i + w : -1, c > 0 ? i - 1 : -1, r > 0 ? i - w : -1]) {
      if (j < 0 || !cells[i] || !cells[j]) continue;
      if (cells[i].special === "honey" || cells[j].special === "honey") return { a: i, b: j };
      if (isPower(cells[i]) && isPower(cells[j])) return { a: i, b: j };
      const swapped = [...cells];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      if (hasMatchAt(swapped, w, h, i) || hasMatchAt(swapped, w, h, j)) return { a: i, b: j };
    }
  }
  return null;
}

function newCell(board, kinds, random) {
  return { id: board.nextId++, kind: kinds[Math.floor(random() * kinds.length)], special: null };
}

/** A fresh board: no match on it, at least one move. `vines` cells start tangled. */
export function newBoard({ w = SIZE.w, h = SIZE.h, kinds = HERBS.slice(0, 5), vines = 0, random = Math.random } = {}) {
  const board = { w, h, kinds, cells: new Array(w * h).fill(null), vines: new Array(w * h).fill(false), nextId: 1 };
  for (let i = 0; i < w * h; i++) {
    // Pick a herb that doesn't complete a line with the two before it.
    for (let tries = 0; tries < 20; tries++) {
      board.cells[i] = { id: board.nextId, kind: kinds[Math.floor(random() * kinds.length)], special: null };
      if (!hasMatchAt(board.cells, w, h, i)) break;
    }
    board.nextId++;
  }
  if (!findMove(board)) return newBoard({ w, h, kinds, vines, random });
  const spots = shuffled(Array.from({ length: w * h }, (_, i) => i).filter((i) => Math.floor(i / w) >= 2), random).slice(0, vines);
  spots.forEach((i) => (board.vines[i] = true));
  return board;
}

function blast(board, start) {
  // Everything a set of cleared cells takes with it, following specials caught in the clearing.
  const { w, h, cells } = board;
  const cleared = new Set(start);
  const queue = [...start];
  const fired = new Set();
  while (queue.length) {
    const i = queue.shift();
    const cell = cells[i];
    if (!cell?.special || fired.has(i)) continue;
    fired.add(i);
    const r = Math.floor(i / w), c = i % w;
    let hit = [];
    if (cell.special === "row") hit = Array.from({ length: w }, (_, k) => index(w, r, k));
    else if (cell.special === "col") hit = Array.from({ length: h }, (_, k) => index(w, k, c));
    else if (cell.special === "can") {
      for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) if (rr >= 0 && rr < h && cc >= 0 && cc < w) hit.push(index(w, rr, cc));
    } else if (cell.special === "honey") {
      // Caught in a blast: takes the herb there is most of.
      const counts = {};
      cells.forEach((other) => other && other.special !== "honey" && (counts[other.kind] = (counts[other.kind] ?? 0) + 1));
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      hit = cells.flatMap((other, k) => (other && other.kind === top && other.special !== "honey" ? [k] : []));
    }
    for (const k of hit) {
      if (!cells[k] || cleared.has(k)) continue;
      cleared.add(k);
      queue.push(k);
    }
  }
  return cleared;
}

function tally(result, cells) {
  for (const cell of cells) {
    if (!cell || cell.special === "honey") continue;
    result.collected[cell.kind] = (result.collected[cell.kind] ?? 0) + 1;
  }
}

/** The cells next to a match: a vine there comes loose too. */
function besideMatches(board, matched) {
  const { w, h } = board;
  const near = new Set();
  for (const i of matched) {
    const r = Math.floor(i / w), c = i % w;
    if (c > 0) near.add(i - 1);
    if (c < w - 1) near.add(i + 1);
    if (r > 0) near.add(i - w);
    if (r < h - 1) near.add(i + w);
  }
  return near;
}

/** Removes `clearSet`, leaves new specials behind, and records the step. */
function clearStep(board, clearSet, created, result, near = new Set()) {
  const cells = [...board.cells];
  const vines = [...board.vines];
  const removed = [];
  for (const i of new Set([...clearSet, ...near])) {
    if (!vines[i]) continue;
    vines[i] = false;
    result.vinesCleared++;
  }
  for (const i of clearSet) {
    if (!cells[i]) continue;
    removed.push({ idx: i, ...cells[i] });
    cells[i] = null;
  }
  tally(result, removed);
  const made = [];
  for (const { idx, kind, special } of created) {
    const cell = { id: board.nextId++, kind: special === "honey" ? null : kind, special };
    cells[idx] = cell;
    made.push({ idx, ...cell });
    result.specialsMade++;
  }
  board.cells = cells;
  board.vines = vines;
  result.steps.push({ type: "clear", removed, made, cells, vines });
}

function fallStep(board, random, result) {
  const { w, h } = board;
  const cells = [...board.cells];
  const drops = {};
  for (let c = 0; c < w; c++) {
    let write = h - 1;
    for (let r = h - 1; r >= 0; r--) {
      const cell = cells[index(w, r, c)];
      if (!cell) continue;
      if (write !== r) {
        cells[index(w, write, c)] = cell;
        cells[index(w, r, c)] = null;
      }
      write--;
    }
    const missing = write + 1;
    for (let r = write; r >= 0; r--) {
      const cell = newCell(board, board.kinds, random);
      cells[index(w, r, c)] = cell;
      drops[cell.id] = missing; // rows it falls from above the board
    }
  }
  board.cells = cells;
  result.steps.push({ type: "fall", cells, drops });
}

function settle(board, random, result, moved = []) {
  // Clear, fall, repeat until the board is still.
  for (let wave = 0; wave < 50; wave++) {
    const groups = findMatches(board.cells, board.w, board.h);
    if (!groups.length) break;
    if (wave > 0) result.cascades++;
    const matched = new Set();
    groups.forEach((group) => group.cells.forEach((i) => matched.add(i)));
    const created = [];
    for (const group of groups) {
      const special = specialFor(group);
      if (!special) continue;
      // Where the new piece appears: the cell she moved, else the middle of the longest run.
      const longest = group.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
      const crossing = special === "can" ? [...group.cells].find((i) => group.runs.filter((run) => run.cells.includes(i)).length > 1) : undefined;
      const at = moved.find((i) => group.cells.has(i)) ?? crossing ?? longest.cells[Math.floor(longest.cells.length / 2)];
      if (created.some((made) => made.idx === at)) continue;
      created.push({ idx: at, kind: group.kind, special });
    }
    const clearSet = blast(board, matched);
    created.forEach(({ idx }) => clearSet.add(idx));
    clearStep(board, clearSet, created, result, besideMatches(board, matched));
    fallStep(board, random, result);
    moved = [];
  }
  if (!findMove(board)) {
    reshuffle(board, random);
    result.steps.push({ type: "shuffle", cells: board.cells });
  }
}

/** Mixes the herbs (specials stay put) until there's no match and at least one move. */
export function reshuffle(board, random = Math.random) {
  const { w, h } = board;
  for (let tries = 0; tries < 200; tries++) {
    const plainSpots = board.cells.flatMap((cell, i) => (cell && !cell.special ? [i] : []));
    const mixed = shuffled(plainSpots.map((i) => board.cells[i]), random);
    const cells = [...board.cells];
    plainSpots.forEach((i, k) => (cells[i] = mixed[k]));
    const candidate = { ...board, cells };
    if (!findMatches(cells, w, h).length && findMove(candidate)) {
      board.cells = cells;
      return board;
    }
  }
  // Give up mixing: a fresh set of herbs (same specials).
  const fresh = newBoard({ w, h, kinds: board.kinds, random });
  board.cells = board.cells.map((cell, i) => (cell?.special ? cell : { ...fresh.cells[i], id: board.nextId++ }));
  return board;
}

export const adjacent = (w, a, b) => (Math.abs(a - b) === 1 && Math.floor(a / w) === Math.floor(b / w)) || Math.abs(a - b) === w;

/**
 * She swaps cells `a` and `b`. Returns the new board (the old one is untouched) and the steps to
 * animate: swap, then clear/fall waves, maybe a reshuffle; an unhelpful swap returns
 * `{ valid: false }` and the board unchanged.
 */
export function playSwap(original, a, b, random = Math.random) {
  if (!adjacent(original.w, a, b) || !original.cells[a] || !original.cells[b]) return { valid: false, board: original, steps: [] };
  const board = { ...original, cells: [...original.cells], vines: [...original.vines] };
  const result = { valid: true, steps: [], collected: {}, vinesCleared: 0, specialsMade: 0, cascades: 0, board };
  const cells = board.cells;
  [cells[a], cells[b]] = [cells[b], cells[a]];
  result.steps.push({ type: "swap", a, b, cells: [...cells] });
  const A = cells[b], B = cells[a]; // A moved from a to b, B from b to a
  if (A.special === "honey" || B.special === "honey") {
    const honeyAt = A.special === "honey" ? b : a;
    const other = cells[honeyAt === b ? a : b];
    const targets = other.special === "honey"
      ? cells.map((_, i) => i)
      : cells.flatMap((cell, i) => (cell && cell.kind === other.kind && cell.special !== "honey" ? [i] : []));
    const fired = new Set([honeyAt, ...targets]);
    const clearSet = blast({ ...board, cells: cells.map((cell, i) => (i === honeyAt ? { ...cell, special: null } : cell)) }, fired);
    clearStep(board, clearSet, [], result);
    fallStep(board, random, result);
    settle(board, random, result);
    return result;
  }
  if (isPower(A) && isPower(B)) {
    clearStep(board, blast(board, new Set([a, b])), [], result);
    fallStep(board, random, result);
    settle(board, random, result);
    return result;
  }
  if (!hasMatchAt(cells, board.w, board.h, a) && !hasMatchAt(cells, board.w, board.h, b)) {
    return { valid: false, board: original, steps: [{ type: "swap", a, b, cells: [...cells] }, { type: "unswap", cells: original.cells }] };
  }
  settle(board, random, result, [b, a]);
  return result;
}

// ---------- gardens (levels) ----------

/** Garden `n` (1-based): which herbs to gather, how many vines to untangle, and a gentle par. */
export function gardenPlan(n) {
  const random = seeded(n * 7919 + 13);
  const kinds = n <= 2 ? HERBS.slice(0, 5) : HERBS;
  const goalKinds = shuffled(kinds, random).slice(0, n >= 6 ? 3 : 2);
  const each = goalKinds.length === 3 ? Math.min(30, 12 + n) : Math.min(30, 12 + n * 3);
  const goals = goalKinds.map((kind) => ({ kind, count: each }));
  const vines = n < 3 ? 0 : Math.min(20, 4 + (n - 3) * 2);
  const par = Math.round(goals.reduce((sum, goal) => sum + goal.count, 0) / (kinds.length === 5 ? 3.4 : 2.5) + vines * 0.5 + 3);
  return { n, kinds, goals, vines, par, seed: Math.floor(random() * 2 ** 31) };
}

export function newGarden(n, random) {
  const plan = gardenPlan(n);
  const board = newBoard({ kinds: plan.kinds, vines: plan.vines, random: random ?? seeded(plan.seed) });
  return { plan, board, moves: 0, gathered: Object.fromEntries(plan.goals.map((goal) => [goal.kind, 0])), vinesLeft: plan.vines };
}

/** Adds a swap's harvest to the garden's progress. */
export function harvest(garden, result) {
  const gathered = { ...garden.gathered };
  for (const goal of garden.plan.goals) gathered[goal.kind] = Math.min(goal.count, gathered[goal.kind] + (result.collected[goal.kind] ?? 0));
  return { ...garden, board: result.board, moves: garden.moves + 1, gathered, vinesLeft: Math.max(0, garden.vinesLeft - result.vinesCleared) };
}

export const gardenDone = (garden) => garden.vinesLeft === 0 && garden.plan.goals.every((goal) => garden.gathered[goal.kind] >= goal.count);

/** Flowers for a finished garden: three within par, two within half again, one otherwise. */
export const flowersFor = (garden) => (garden.moves <= garden.plan.par ? 3 : garden.moves <= Math.ceil(garden.plan.par * 1.5) ? 2 : 1);
