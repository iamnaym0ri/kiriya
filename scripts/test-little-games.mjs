import test from "node:test";
import assert from "node:assert/strict";
import { inspectJar, JAR_CLUES, memoryTurn, newJarRound, newMemoryGame, LANTERNS_LIT, lanternNeighbors, lanternSolution, lanternTurn, newLanternGame, newSequenceGame, sequenceTurn, toggleLanterns } from "../src/world/play/littleGames.js";
import { newPaletteRounds, matchScore, PALETTE_PASS_SCORE } from "../src/world/play/palette.js";
import { readFile } from "node:fs/promises";
import { addressRemark, createRemarkPicker, MAOMAO_REMARKS, remarkTopic } from "../src/shared/play/maomaoDialogue.js";

test("Memory drawers prevent duplicate picks and preserve a mismatched pair until dismissed", () => {
  let game = newMemoryGame(() => 0.4);
  const a = 0;
  const b = game.cards.findIndex(card => card !== game.cards[a]);
  game = memoryTurn(game, { type: "flip", index: a });
  assert.strictEqual(memoryTurn(game, { type: "flip", index: a }), game);
  game = memoryTurn(game, { type: "flip", index: b });
  assert.equal(game.event, "miss");
  for (let index = -1; index <= game.cards.length; index++) assert.strictEqual(memoryTurn(game, { type: "flip", index }), game);
  game = memoryTurn(game, { type: "close" });
  assert.deepEqual(game.open, []);
  assert.deepEqual(game.found, []);
});

test("Four- and six-pair memory drawers are solvable and can restart after completion", () => {
  for (const pairs of [4, 6]) for (const random of [() => 0, () => 0.5, () => 0.999]) {
    let game = newMemoryGame(random, pairs);
    assert.equal(game.cards.length, pairs * 2);
    for (const symbol of new Set(game.cards)) {
      const pair = game.cards.flatMap((card, index) => card === symbol ? [index] : []);
      assert.equal(pair.length, 2);
      for (const index of pair) game = memoryTurn(game, { type: "flip", index });
    }
    assert.equal(game.event, "done");
    assert.equal(new Set(game.found).size, pairs * 2);
    assert.strictEqual(memoryTurn(game, { type: "flip", index: 0 }), game);
    const restarted = memoryTurn(game, { type: "restart", game: newMemoryGame(random, pairs) });
    assert.deepEqual(restarted.found, []);
    assert.deepEqual(restarted.open, []);
    assert.equal(restarted.pairs, pairs);
  }
});

test("Five odd-jar rounds grow the shelf, cover every clue and ignore picks after solving", () => {
  let order;
  const seen = new Set();
  for (let round = 0; round < JAR_CLUES.length; round++) {
    const count = round === 0 ? 6 : 9;
    for (let odd = 0; odd < count; odd++) {
      let game = newJarRound(round, () => (odd + 0.5) / count, order);
      order = game.order;
      seen.add(game.clueIndex);
      assert.equal(game.odd, odd);
      assert.equal(game.count, count);
      assert.strictEqual(inspectJar(game, count), game);
      game = inspectJar(game, (odd + 1) % count);
      assert.equal(game.solved, false);
      game = inspectJar(game, odd);
      assert.equal(game.solved, true);
      assert.equal(game.event, round === JAR_CLUES.length - 1 ? "done" : "found");
      assert.strictEqual(inspectJar(game, (odd + 1) % count), game);
    }
  }
  assert.equal(seen.size, JAR_CLUES.length);
});

test("Herb sequences support study, undo, a complete wrong attempt and a retry without leaking correctness early", () => {
  let game = newSequenceGame(0, () => 0);
  assert.equal(game.pattern.length, 3);
  assert.strictEqual(sequenceTurn(game, { type: "pick", kind: "leaf" }), game);
  game = sequenceTurn(game, { type: "hide" });
  game = sequenceTurn(game, { type: "pick", kind: "bottle" });
  assert.equal(game.phase, "recall");
  game = sequenceTurn(game, { type: "undo" });
  assert.deepEqual(game.entered, []);
  for (let i = 0; i < game.pattern.length; i++) game = sequenceTurn(game, { type: "pick", kind: "bottle" });
  assert.equal(game.phase, "retry");
  assert.strictEqual(sequenceTurn(game, { type: "pick", kind: "leaf" }), game);
  game = sequenceTurn(game, { type: "peek" });
  assert.equal(game.phase, "study");
  assert.deepEqual(game.entered, []);
});

test("Three growing sequences accept exact order, including repeated symbols, and finish cleanly", () => {
  for (let round = 0; round < 3; round++) {
    let game = newSequenceGame(round, () => .4);
    assert.equal(game.pattern.length, round + 3);
    game = sequenceTurn(game, { type: "hide" });
    for (const kind of game.pattern) game = sequenceTurn(game, { type: "pick", kind });
    assert.equal(game.phase, "solved");
    assert.equal(game.event, round === 2 ? "done" : "match");
    assert.strictEqual(sequenceTurn(game, { type: "pick", kind: "flower" }), game);
    assert.strictEqual(sequenceTurn(game, { type: "peek" }), game);
  }
});

test("Lantern switches affect a cross without wrapping between rows and always undo with a second tap", () => {
  assert.deepEqual(lanternNeighbors(0).sort(), [0, 1, 3]);
  assert.deepEqual(lanternNeighbors(4).sort(), [1, 3, 4, 5, 7]);
  assert.deepEqual(lanternNeighbors(2).sort(), [1, 2, 5]);
  for (let board = 0; board <= LANTERNS_LIT; board++) {
    for (let i = 0; i < 9; i++) assert.equal(toggleLanterns(toggleLanterns(board, i), i), board);
    const solution = lanternSolution(board);
    if (solution) assert.equal(solution.reduce(toggleLanterns, board), LANTERNS_LIT);
  }
});

test("Lantern puzzles require three to five moves and hints still solve a disturbed board", () => {
  for (let round = 0; round < 3; round++) for (const random of [() => 0, () => .45, () => .999]) {
    let game = newLanternGame(round, random);
    assert.equal(lanternSolution(game.board).length, 3 + round);
    const initial = game.board;
    game = lanternTurn(game, { type: "tap", index: 4 });
    game = lanternTurn(game, { type: "undo" });
    assert.equal(game.board, initial);
    assert.equal(game.history.length, 0);
    for (const i of [1, 7, 3]) game = lanternTurn(game, { type: "tap", index: i });
    for (let step = 0; game.board !== LANTERNS_LIT && step < 10; step++) {
      const distance = lanternSolution(game.board).length;
      game = lanternTurn(game, { type: "hint" });
      game = lanternTurn(game, { type: "tap", index: game.hint });
      assert.equal(lanternSolution(game.board).length, distance - 1);
    }
    assert.equal(game.board, LANTERNS_LIT);
    assert.equal(game.event, round === 2 ? "done" : "solved");
    assert.strictEqual(lanternTurn(game, { type: "tap", index: 0 }), game);
  }
});

test("Colour Club varies its target, requires a closer match and never gives away a starting win", () => {
  const targets = new Set();
  for (const random of [() => 0, () => .5, () => .999]) for (const round of newPaletteRounds(random)) {
    targets.add(round.target);
    assert(round.target >= 25 && round.target <= 75);
    assert(matchScore(50, round.target) < PALETTE_PASS_SCORE);
    assert(matchScore(round.target + 3, round.target) >= PALETTE_PASS_SCORE);
    assert(matchScore(round.target + 4, round.target) < PALETTE_PASS_SCORE);
  }
  assert(targets.size > 1);
});

test("Maomao uses every remark in a category before repeating and avoids boundary repeats", () => {
  const pick = createRemarkPicker(() => 0.5);
  for (const [category, lines] of Object.entries(MAOMAO_REMARKS)) {
    const firstCycle = Array.from({ length: lines.length }, () => pick(category));
    assert.equal(new Set(firstCycle.map(line => line.text)).size, lines.length);
    assert.notEqual(pick(category).text, firstCycle.at(-1).text);
    assert(firstCycle.every(line => line.text && line.expression));
  }
});

test("Maomao's attention shifts toward herbs and medicine, with contextual and rapid-poke reactions", () => {
  const normal = Array.from({ length: 14 }, (_, i) => remarkTopic({ mode: "tap", count: i + 1 }));
  assert(normal.includes("herb") && normal.includes("poison") && normal.includes("deduction"));
  assert(!normal.includes("birthday") && !normal.includes("music") && !normal.includes("pester"));
  assert.equal(remarkTopic({ mode: "tap", count: 4, rapid: true }), "pester");
  assert.equal(remarkTopic({ mode: "tap", count: 6, music: true }), "music");
  assert.equal(remarkTopic({ mode: "tap", count: 7, birthday: true }), "birthday");
  const ambient = Array.from({ length: 100 }, (_, i) => remarkTopic({ mode: "idle", music: true, random: () => i / 100 }));
  assert(ambient.includes("music") && ambient.includes("herb") && ambient.includes("poison"));
  assert(!ambient.includes("pester"), "She should not scold someone who hasn't poked her");
});

// --- The roaming companion -------------------------------------------------------------------

test("The companion's expression list stays in step with the SVG face table", async () => {
  const { MAOMAO_EXPRESSIONS } = await import("../shared/maomaoExpressions.js");
  const source = await readFile(new URL("../src/world/mascot/MaomaoFace.jsx", import.meta.url), "utf8");
  const table = source.slice(source.indexOf("const FACES = {"), source.indexOf("\n};", source.indexOf("const FACES = {")));
  const drawn = [...table.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]);
  assert.deepEqual(
    [...MAOMAO_EXPRESSIONS].sort(),
    drawn.sort(),
    "every shared expression must have a face, and every face must be offerable",
  );
});

test("Her own thoughts never address Kiriya, and the lines that do are reserved for her", () => {
  // Passive pools are self-talk: she is working, not speaking to anyone.
  for (const category of ["working", "musing", "idle", "notes", "deduction"])
    for (const { text } of MAOMAO_REMARKS[category])
      assert.ok(!text.includes("{name}"), `${category} should not address her: ${text}`);
  // The pools that do greet her are the ones an interruption draws from.
  assert.ok(MAOMAO_REMARKS.kiriya.some((l) => l.text.includes("{name}")));
  assert.ok(MAOMAO_REMARKS.hour.some((l) => l.text.includes("{name}")));
});

test("A remark addressed to her uses her name, and falls back when there isn't one", () => {
  assert.equal(addressRemark("Hello, {name}.", "kiriya"), "Hello, kiriya.");
  assert.equal(addressRemark("Hello, {name}.", ""), "Hello, miss apothecary.");
  assert.equal(addressRemark("No placeholder here.", "kiriya"), "No placeholder here.");
});

test("Every companion line is a usable remark with a drawable expression", async () => {
  const { MAOMAO_EXPRESSIONS } = await import("../shared/maomaoExpressions.js");
  const allowed = new Set(MAOMAO_EXPRESSIONS);
  for (const [category, lines] of Object.entries(MAOMAO_REMARKS)) {
    assert.ok(lines.length >= 5, `${category} is too thin to avoid repeating`);
    for (const { expression, text } of lines) {
      assert.ok(allowed.has(expression), `${category}: unknown expression ${expression}`);
      assert.ok(text.trim().length > 0 && text.length <= 200, `${category}: unusable line ${text}`);
    }
  }
});

test("Poking her keeps producing new lines rather than cycling two", () => {
  const pick = createRemarkPicker(() => 0.5);
  const heard = new Set();
  for (let i = 0; i < 12; i++) heard.add(pick("poke").text);
  assert.ok(heard.size >= 12, `expected 12 distinct poke replies, heard ${heard.size}`);
});
