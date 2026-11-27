// The pastime shelf's game rules (src/world/play/games/pastime/*/engine.js): pure logic, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../src/world/play/games/pastime/_shared/rng.js";
import * as herb from "../src/world/play/games/pastime/herb-match/engine.js";
import * as charms from "../src/world/play/games/pastime/charm-merge/engine.js";

// ---------- herb patch (match-3) ----------

const board = (rows, extra = {}) => {
  const h = rows.length, w = rows[0].length;
  let id = 1;
  const KINDS = { m: "mint", l: "lavender", c: "chamomile", r: "rose", b: "borage", g: "marigold" };
  const cells = rows.flatMap((row) => [...row].map((ch) => {
    if (ch === "H") return { id: id++, kind: null, special: "honey" };
    if (ch === ch.toUpperCase() && KINDS[ch.toLowerCase()]) return { id: id++, kind: KINDS[ch.toLowerCase()], special: extra.special ?? "row" };
    return { id: id++, kind: KINDS[ch], special: null };
  }));
  return { w, h, kinds: herb.HERBS.slice(0, 5), cells, vines: new Array(w * h).fill(false), nextId: id };
};

test("Herb patch: rows and columns of three match; an L joins into one group that leaves a dew drop", () => {
  const b = board([
    "mmmlc",
    "lcrbm",
    "lrbcr",
    "lbcrb",
  ]);
  const groups = herb.findMatches(b.cells, b.w, b.h);
  assert.equal(groups.length, 2);
  const l = board([
    "mmmlc",
    "mcrbl",
    "mrbcr",
    "lbcrb",
  ]);
  const [corner] = herb.findMatches(l.cells, l.w, l.h);
  assert.equal(corner.cells.size, 5);
  assert.equal(herb.specialFor(corner), "can");
  assert.equal(herb.specialFor({ runs: [{ dir: "h", cells: [0, 1, 2, 3] }] }), "row");
  assert.equal(herb.specialFor({ runs: [{ dir: "v", cells: [0, 5, 10, 15] }] }), "col");
  assert.equal(herb.specialFor({ runs: [{ dir: "h", cells: [0, 1, 2, 3, 4] }] }), "honey");
});

test("Herb patch: new boards never start with a match, always have a move, and place the vines asked for", () => {
  for (let s = 1; s <= 60; s++) {
    const b = herb.newBoard({ random: seeded(s), kinds: herb.HERBS, vines: 6 });
    assert.equal(herb.findMatches(b.cells, b.w, b.h).length, 0);
    assert.ok(herb.findMove(b));
    assert.equal(b.vines.filter(Boolean).length, 6);
    assert.equal(new Set(b.cells.map((cell) => cell.id)).size, b.cells.length);
  }
});

test("Herb patch: a swap that makes nothing is refused and leaves the board as it was", () => {
  const b = board([
    "mlcrb",
    "lcrbm",
    "crbml",
  ]);
  const result = herb.playSwap(b, 0, 1, seeded(1));
  assert.equal(result.valid, false);
  assert.strictEqual(result.board, b);
  assert.equal(result.steps.at(-1).type, "unswap");
  assert.equal(herb.playSwap(b, 0, 7, seeded(1)).valid, false, "only neighbours swap");
  assert.equal(herb.playSwap(b, 4, 5, seeded(1)).valid, false, "the end of a row isn't next to the start of the next");
});

test("Herb patch: a good swap clears, refills from above, cascades until still, and never leaves a match or a dead board", () => {
  for (let s = 1; s <= 40; s++) {
    const random = seeded(s);
    let b = herb.newBoard({ random, kinds: herb.HERBS });
    for (let turn = 0; turn < 25; turn++) {
      const move = herb.findMove(b, random);
      const result = herb.playSwap(b, move.a, move.b, random);
      assert.equal(result.valid, true);
      assert.ok(result.board.cells.every(Boolean), "every cell is filled");
      assert.equal(herb.findMatches(result.board.cells, b.w, b.h).length, 0, "the board ends still");
      assert.ok(herb.findMove(result.board), "and with a move");
      assert.equal(new Set(result.board.cells.map((cell) => cell.id)).size, result.board.cells.length, "ids stay unique");
      const removed = result.steps.filter((step) => step.type === "clear").flatMap((step) => step.removed);
      const counted = Object.values(result.collected).reduce((a, n) => a + n, 0);
      assert.equal(counted, removed.filter((cell) => cell.special !== "honey").length, "every gathered herb is counted once");
      b = result.board;
    }
  }
});

test("Herb patch: four in a row ties a ribbon bundle where she moved; matching it clears its whole row", () => {
  // Moving the mint at (1,2) up completes m m _ m → four in a row along the top.
  const b = board([
    "mmlmc",
    "crmbr",
    "rbcrb",
  ]);
  const result = herb.playSwap(b, 2, 7, seeded(3));
  assert.equal(result.valid, true);
  const made = result.steps.find((step) => step.type === "clear").made;
  assert.equal(made.length, 1);
  assert.equal(made[0].special, "row");
  assert.equal(made[0].idx, 2);
  // A bundle caught in a match takes its whole row with it.
  const go = board([
    "rlMcb",
    "cbmrl",
    "lrbmc",
  ]);
  const run = herb.playSwap(go, 12, 13, seeded(4)); // b<->m in the last row: column 2 becomes M m m
  assert.equal(run.valid, true);
  const cleared = run.steps.find((step) => step.type === "clear").removed.map((cell) => cell.idx).sort((a, z) => a - z);
  for (const i of [0, 1, 2, 3, 4]) assert.ok(cleared.includes(i), `row cell ${i} cleared`);
});

test("Herb patch: a honey pot swapped with a herb gathers every one of that herb", () => {
  const b = board([
    "Hmlcr",
    "lcmbr",
    "mbrlc",
  ]);
  const mints = b.cells.filter((cell) => cell.kind === "mint").length;
  const result = herb.playSwap(b, 0, 1, seeded(2));
  assert.equal(result.valid, true);
  assert.ok((result.collected.mint ?? 0) >= mints);
});

test("Herb patch: vines come loose when matched on or right beside", () => {
  const b = board([
    "mmlcr",
    "lcmbr",
    "rbcrl",
  ]);
  b.vines[7] = true; // under the c at (1,2)'s left neighbour: beside the match at row 0
  b.vines[14] = true; // far away
  const result = herb.playSwap(b, 2, 7, seeded(5));
  assert.equal(result.valid, true);
  assert.equal(result.board.vines[7], false);
  assert.equal(result.board.vines[14], true);
  assert.ok(result.vinesCleared >= 1);
});

test("Herb patch: gardens grow gently, are finishable by a casual player, and score flowers against par", () => {
  let previous = 0;
  for (let n = 1; n <= 12; n++) {
    const plan = herb.gardenPlan(n);
    const total = plan.goals.reduce((sum, goal) => sum + goal.count, 0) + plan.vines;
    assert.ok(total >= previous - 12, "no sudden easy garden");
    previous = total;
    assert.deepEqual(herb.gardenPlan(n), plan, "a garden is the same every time");
    let garden = herb.newGarden(n, seeded(n));
    const random = seeded(100 + n);
    for (let turn = 0; turn < 400 && !herb.gardenDone(garden); turn++) {
      const move = herb.findMove(garden.board, random);
      garden = herb.harvest(garden, herb.playSwap(garden.board, move.a, move.b, random));
    }
    assert.ok(herb.gardenDone(garden), `garden ${n} can be finished`);
    assert.ok([1, 2, 3].includes(herb.flowersFor(garden)));
  }
  const g = herb.newGarden(1, seeded(1));
  assert.equal(herb.flowersFor({ ...g, moves: g.plan.par }), 3);
  assert.equal(herb.flowersFor({ ...g, moves: g.plan.par + 1 }), 2);
  assert.equal(herb.flowersFor({ ...g, moves: g.plan.par * 3 }), 1);
});

// ---------- charm ladder (merge) ----------

const ladder = (rows) => {
  let id = 1;
  const cells = rows.flatMap((row) => row.map((tier) => (tier ? { id: id++, tier } : null)));
  return { cells, score: 0, nextId: id, top: Math.max(1, ...rows.flat()), crowned: false, over: false, moves: 0 };
};
const tiers = (state) => state.cells.map((cell) => cell?.tier ?? 0);

test("Charm ladder: a new board has two little charms", () => {
  for (let s = 1; s < 30; s++) {
    const game = charms.newGame(seeded(s));
    const placed = game.cells.filter(Boolean);
    assert.equal(placed.length, 2);
    assert.ok(placed.every((cell) => cell.tier === 1 || cell.tier === 2));
  }
});

test("Charm ladder: matching charms merge once per move, toward the swipe, and a new bead arrives", () => {
  const game = ladder([
    [1, 1, 1, 1],
    [2, 0, 2, 0],
    [3, 3, 0, 0],
    [0, 0, 0, 0],
  ]);
  const { moved, state, merges } = charms.move(game, "left", () => 0.99);
  assert.equal(moved, true);
  const rows = [0, 1, 2, 3].map((r) => tiers(state).slice(r * 4, r * 4 + 4));
  assert.deepEqual(rows[0], [2, 2, 0, 0], "four beads make two hearts, not one star");
  assert.deepEqual(rows[1], [3, 0, 0, 0]);
  assert.deepEqual(rows[2], [4, 0, 0, 0]);
  assert.equal(merges.length, 4);
  assert.equal(state.score, 4 + 4 + 8 + 16);
  assert.equal(state.cells.filter(Boolean).length, 4 + 1, "one new charm");
  assert.equal(state.top, 4);
});

test("Charm ladder: a swipe that moves nothing changes nothing", () => {
  const game = ladder([
    [1, 2, 0, 0],
    [3, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const result = charms.move(game, "left", seeded(1));
  assert.equal(result.moved, false);
  assert.strictEqual(result.state, game);
  assert.equal(charms.move(game, "up", seeded(1)).moved, false);
  assert.equal(charms.move(game, "right", seeded(1)).moved, true);
});

test("Charm ladder: two gems make the crown, and a full board with no pairs is over", () => {
  const game = ladder([
    [8, 8, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const result = charms.move(game, "left", seeded(2));
  assert.equal(result.state.top, charms.CROWN);
  assert.equal(result.state.crowned, true);
  assert.equal(charms.LADDER[charms.CROWN].name, "crown");
  const stuck = ladder([
    [1, 2, 1, 2],
    [2, 1, 2, 1],
    [1, 2, 1, 2],
    [2, 1, 2, 1],
  ]);
  assert.equal(charms.movesAvailable(stuck.cells), false);
  assert.equal(charms.movesAvailable(ladder([[1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 2]]).cells), true);
});

test("Charm ladder: long games keep ids unique and saved games are checked before resuming", () => {
  const random = seeded(9);
  let game = charms.newGame(random);
  const dirs = ["left", "down", "right", "down"];
  for (let i = 0; i < 400 && !game.over; i++) {
    const result = charms.move(game, dirs[i % 4], random);
    if (!result.moved) continue;
    game = result.state;
    const ids = game.cells.filter(Boolean).map((cell) => cell.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(charms.isGame(game));
  }
  assert.equal(charms.isGame({ cells: [1, 2, 3] }), false);
  assert.equal(charms.isGame(null), false);
});
