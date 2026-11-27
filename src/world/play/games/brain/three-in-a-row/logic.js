// Three in a row against Maomao. The board is nine cells: null, "you" (her blossoms) or "mao"
// (Maomao's herb sprigs). Maomao's play is a textbook minimax (an original implementation) with
// three moods: sleepy (makes real mistakes), thoughtful (never misses a win or a block, but can be
// caught by a fork) and focused (perfect: the best she can do is a draw).

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
export const LEVELS = ["sleepy", "thoughtful", "focused"];
export const other = (who) => (who === "you" ? "mao" : "you");
export const emptyBoard = () => Array(9).fill(null);
export const emptyCells = (board) => board.flatMap((cell, i) => (cell ? [] : [i]));

export function winner(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { who: board[a], line };
  }
  return null;
}

/** "you", "mao", "draw", or null while the game goes on. */
export function outcome(board) {
  const won = winner(board);
  if (won) return won.who;
  return board.every(Boolean) ? "draw" : null;
}

/** Cells where `who` would complete a line right now. */
export function threats(board, who) {
  return emptyCells(board).filter((i) => {
    const next = [...board];
    next[i] = who;
    return winner(next)?.who === who;
  });
}

const memo = new Map();
// A win further away is worth a little less, so focused Maomao wins quickly and loses slowly.
const later = (score) => (score > 0 ? score - 1 : score < 0 ? score + 1 : 0);
// The value of a position for "mao" with `turn` to move: +10 a Maomao win now, -10 hers, 0 a draw.
function value(board, turn) {
  const key = board.map((c) => (c === "you" ? "y" : c === "mao" ? "m" : "-")).join("") + turn;
  if (memo.has(key)) return memo.get(key);
  const result = outcome(board);
  let score;
  if (result === "mao") score = 10;
  else if (result === "you") score = -10;
  else if (result === "draw") score = 0;
  else {
    const scores = emptyCells(board).map((i) => {
      const next = [...board];
      next[i] = turn;
      return later(value(next, other(turn)));
    });
    score = turn === "mao" ? Math.max(...scores) : Math.min(...scores);
  }
  memo.set(key, score);
  return score;
}

/** Every move that is optimal for `who` (minimax). */
export function bestMoves(board, who) {
  const scored = emptyCells(board).map((i) => {
    const next = [...board];
    next[i] = who;
    return { i, score: later(value(next, other(who))) };
  });
  const best = who === "mao" ? Math.max(...scored.map((s) => s.score)) : Math.min(...scored.map((s) => s.score));
  return scored.filter((s) => s.score === best).map((s) => s.i);
}

const pick = (cells, random) => cells[Math.floor(random() * cells.length)];

// A person's way of playing when not calculating: the middle, then a corner, then whatever's left.
function hunch(board, random) {
  if (!board[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  if (corners.length && random() < 0.75) return pick(corners, random);
  return pick(emptyCells(board), random);
}

/** Maomao's move for a mood. */
export function maomaoMove(board, level = "thoughtful", random = Math.random) {
  const cells = emptyCells(board);
  if (!cells.length || outcome(board)) return null;
  const wins = threats(board, "mao");
  const blocks = threats(board, "you");
  if (level === "focused") return pick(bestMoves(board, "mao"), random);
  if (level === "sleepy") {
    if (wins.length && random() < 0.75) return pick(wins, random);
    if (blocks.length && random() < 0.55) return pick(blocks, random);
    return random() < 0.25 ? hunch(board, random) : pick(cells, random);
  }
  // Thoughtful: never misses a win or a block. Otherwise she calculates half the time and goes
  // with her hunch the other half, which is how a fork can still catch her out.
  if (wins.length) return pick(wins, random);
  if (blocks.length) return pick(blocks, random);
  return random() < 0.5 ? pick(bestMoves(board, "mao"), random) : hunch(board, random);
}

/**
 * What just happened, for Maomao's comment: who moved, and whether the move won, made a draw,
 * blocked a line, set up a line (a threat) or two at once (a fork).
 */
export function describeMove(before, after, who) {
  const result = outcome(after);
  if (result === who) return "win";
  if (result === "draw") return "draw";
  const opponent = other(who);
  const blocked = threats(before, opponent).some((i) => after[i] === who);
  const made = threats(after, who).length;
  if (made >= 2) return "fork";
  if (blocked) return "block";
  if (made === 1) return "threat";
  return "quiet";
}
