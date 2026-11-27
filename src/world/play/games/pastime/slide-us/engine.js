// "us, in pieces": the sliding-tile rules (the classic 15-puzzle), written for this site.
// Tiles are numbered 0..n²-2 in reading order; n²-1 is the gap, which starts bottom-right.
// Boards are mixed by sliding from the solved picture, so every one can be solved.

export const SIZES = [3, 4, 5];

export const solved = (n) => Array.from({ length: n * n }, (_, i) => i);
export const gapOf = (puzzle) => puzzle.tiles.indexOf(puzzle.n * puzzle.n - 1);
export const isSolved = (puzzle) => puzzle.tiles.every((tile, i) => tile === i);

function neighbours(n, i) {
  const r = Math.floor(i / n), c = i % n;
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((j) => j >= 0);
}

/** The standard parity test: whether a layout can be slid back to the picture. */
export function solvable(tiles, n) {
  const gap = n * n - 1;
  const order = tiles.filter((tile) => tile !== gap);
  let inversions = 0;
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (order[i] > order[j]) inversions++;
  if (n % 2 === 1) return inversions % 2 === 0;
  const gapRowFromBottom = n - Math.floor(tiles.indexOf(gap) / n);
  return (inversions + gapRowFromBottom) % 2 === 1;
}

/** How far every tile is from home (a rough "how mixed" measure). */
export function distance(tiles, n) {
  return tiles.reduce((sum, tile, i) => (tile === n * n - 1 ? sum : sum + Math.abs(Math.floor(tile / n) - Math.floor(i / n)) + Math.abs((tile % n) - (i % n))), 0);
}

/** A well-mixed board: a long random walk of the gap that never steps straight back. */
export function newPuzzle(n, random = Math.random) {
  const tiles = solved(n);
  let gap = n * n - 1;
  let previous = -1;
  const steps = n * n * 40;
  for (let k = 0; k < steps; k++) {
    const options = neighbours(n, gap).filter((j) => j !== previous);
    const next = options[Math.floor(random() * options.length)];
    [tiles[gap], tiles[next]] = [tiles[next], tiles[gap]];
    previous = gap;
    gap = next;
  }
  // Bring the gap home to the corner, so every board starts the same way round.
  while (gap % n < n - 1) {
    [tiles[gap], tiles[gap + 1]] = [tiles[gap + 1], tiles[gap]];
    gap += 1;
  }
  while (Math.floor(gap / n) < n - 1) {
    [tiles[gap], tiles[gap + n]] = [tiles[gap + n], tiles[gap]];
    gap += n;
  }
  const puzzle = { n, tiles, moves: 0 };
  if (isSolved(puzzle) || distance(tiles, n) < n * n) return newPuzzle(n, random);
  return puzzle;
}

/**
 * She taps the tile at `index`. If it shares a row or column with the gap, it and every tile
 * between slide one place toward the gap (one move). Otherwise nothing happens.
 */
export function slide(puzzle, index) {
  const { n } = puzzle;
  const gap = gapOf(puzzle);
  if (index === gap || index < 0 || index >= n * n) return puzzle;
  const sameRow = Math.floor(index / n) === Math.floor(gap / n);
  const sameCol = index % n === gap % n;
  if (!sameRow && !sameCol) return puzzle;
  const step = sameRow ? (index < gap ? -1 : 1) : index < gap ? -n : n;
  const tiles = [...puzzle.tiles];
  let at = gap;
  while (at !== index) {
    tiles[at] = tiles[at + step];
    at += step;
  }
  tiles[index] = n * n - 1;
  return { ...puzzle, tiles, moves: puzzle.moves + 1 };
}

export const canSlide = (puzzle, index) => {
  const gap = gapOf(puzzle);
  return index !== gap && (Math.floor(index / puzzle.n) === Math.floor(gap / puzzle.n) || index % puzzle.n === gap % puzzle.n);
};

export function isPuzzle(value) {
  return Boolean(value && SIZES.includes(value.n) && Array.isArray(value.tiles) && value.tiles.length === value.n * value.n &&
    [...value.tiles].sort((a, b) => a - b).every((tile, i) => tile === i) && solvable(value.tiles, value.n) && Number.isInteger(value.moves));
}
