export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const MEMORY_SYMBOLS = ["leaf", "flower", "bottle", "mushroom", "scroll", "cup"];

export function newMemoryGame(random = Math.random, pairs = 4) {
  const selected = shuffled(MEMORY_SYMBOLS, random).slice(0, pairs);
  return {
    cards: shuffled([...selected, ...selected], random),
    pairs: selected.length,
    open: [], found: [], event: "welcome", moves: 0,
  };
}

export function memoryTurn(state, action) {
  if (action.type === "restart") return action.game;
  if (action.type === "close" && state.event === "miss") {
    return { ...state, open: [], event: "continue", moves: state.moves + 1 };
  }
  const i = action.index;
  if (action.type !== "flip" || !Number.isInteger(i) || i < 0 || i >= state.cards.length ||
      state.found.includes(i) || state.open.includes(i) || state.event === "miss" || state.event === "done") return state;
  const open = state.open.length === 1 ? [...state.open, i] : [i];
  let found = state.found;
  let event = "first";
  if (open.length === 2) {
    if (state.cards[open[0]] === state.cards[open[1]]) {
      found = [...found, ...open];
      event = found.length === state.cards.length ? "done" : "match";
    } else event = "miss";
  }
  return { ...state, open, found, event, moves: state.moves + 1 };
}

export const JAR_CLUES = [
  { kind: "label", normal: "leaf label", odd: "flower label", hint: "Read the pictures on the labels. One flower has wandered among the leaves." },
  { kind: "cork", normal: "one cork stripe", odd: "two cork stripes", hint: "Ignore the label this time. Count the little lines across each cork." },
  { kind: "dots", normal: "two seal dots", odd: "three seal dots", hint: "Look below the label. One jar has an extra little wax dot." },
  { kind: "leaf", normal: "leaf pointing right", odd: "leaf pointing left", hint: "Follow the tips of the leaves. One points in the other direction." },
  { kind: "seal", normal: "round seal", odd: "diamond seal", hint: "Look at the little seal on the neck. One has corners." },
];

export function newJarRound(round = 0, random = Math.random, order) {
  const plan = order ?? [0, ...shuffled([1, 2, 3, 4], random)];
  const count = round === 0 ? 6 : 9;
  return { round, order: plan, clueIndex: plan[round], count, odd: Math.floor(random() * count), solved: false, picked: null, attempts: 0, hint: false, event: "welcome" };
}

export function inspectJar(state, index) {
  if (state.solved || !Number.isInteger(index) || index < 0 || index >= state.count) return state;
  const solved = index === state.odd;
  return { ...state, picked: index, solved, attempts: state.attempts + 1,
    event: solved ? state.round === JAR_CLUES.length - 1 ? "done" : "found" : "retry" };
}

export const SEQUENCE_SYMBOLS = ["leaf", "flower", "mushroom", "bottle"];
export function newSequenceGame(round = 0, random = Math.random) {
  const pattern = [];
  for (let i = 0; i < 3 + round; i++) {
    const choices = SEQUENCE_SYMBOLS.filter(kind => round === 2 || kind !== pattern.at(-1));
    pattern.push(choices[Math.floor(random() * choices.length)]);
  }
  return { round, pattern, entered: [], phase: "study", event: "welcome", turns: 0, attempts: 0 };
}
export function sequenceTurn(state, action) {
  if (action.type === "hide" && state.phase === "study") {
    return { ...state, entered: [], phase: "recall", event: "ready", turns: state.turns + 1 };
  }
  if (action.type === "peek" && ["recall", "retry"].includes(state.phase)) {
    return { ...state, entered: [], phase: "study", event: "peek", turns: state.turns + 1 };
  }
  if (action.type === "undo" && state.phase === "recall" && state.entered.length) {
    return { ...state, entered: state.entered.slice(0, -1), event: "undo", turns: state.turns + 1 };
  }
  if (action.type !== "pick" || state.phase !== "recall" || !SEQUENCE_SYMBOLS.includes(action.kind)) return state;
  const entered = [...state.entered, action.kind];
  const complete = entered.length === state.pattern.length;
  const correct = entered.every((kind, i) => kind === state.pattern[i]);
  return { ...state, entered, turns: state.turns + 1,
    attempts: state.attempts + (complete ? 1 : 0),
    phase: complete ? correct ? "solved" : "retry" : "recall",
    event: complete ? correct ? state.round === 2 ? "done" : "match" : "retry" : "pick" };
}

export const LANTERNS_LIT = 0b111111111;
export function lanternNeighbors(index) {
  if (!Number.isInteger(index) || index < 0 || index > 8) return [];
  return [index, ...(index > 2 ? [index - 3] : []), ...(index < 6 ? [index + 3] : []),
    ...(index % 3 ? [index - 1] : []), ...(index % 3 < 2 ? [index + 1] : [])];
}
export function toggleLanterns(board, index) {
  return lanternNeighbors(index).reduce((bits, i) => bits ^ (1 << i), board);
}
// Enumerate the small board once. Every offered puzzle has a known shortest solution.
// Tapping twice cancels, so 2^9 tap combinations cover every possible solution.
const lanternPlans = new Map();
for (let taps = 0; taps <= LANTERNS_LIT; taps++) {
  let board = LANTERNS_LIT;
  const plan = [];
  for (let i = 0; i < 9; i++) if (taps & (1 << i)) { board = toggleLanterns(board, i); plan.push(i); }
  if (!lanternPlans.has(board) || plan.length < lanternPlans.get(board).length) lanternPlans.set(board, plan);
}
export function lanternSolution(board) { return lanternPlans.get(board); }
export function newLanternGame(round = 0, random = Math.random) {
  const choices = [...lanternPlans].filter(([, plan]) => plan.length === 3 + round);
  const [board] = choices[Math.floor(random() * choices.length)];
  return { board, round, history: [], hint: null, event: "welcome", turns: 0 };
}
export function lanternTurn(state, action) {
  if (action.type === "undo" && state.history.length) {
    return { ...state, board: state.history.at(-1), history: state.history.slice(0, -1), hint: null, event: "undo", turns: state.turns + 1 };
  }
  if (state.board === LANTERNS_LIT) return state;
  if (action.type === "hint") return { ...state, hint: lanternSolution(state.board)[0], event: "hint", turns: state.turns + 1 };
  if (action.type !== "tap" || !lanternNeighbors(action.index).length) return state;
  const board = toggleLanterns(state.board, action.index);
  return { ...state, board, history: [...state.history, state.board], hint: null, turns: state.turns + 1,
    event: board === LANTERNS_LIT ? state.round === 2 ? "done" : "solved" : "tap" };
}
