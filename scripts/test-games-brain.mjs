// The brain-power shelf (src/world/play/games/brain): pure game logic, and the secret word's API
// through the real Hono app against an in-memory database. Network off.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "ABLY_API_KEY", "GIPHY_API_KEY"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
globalThis.fetch = () => {
  throw new Error("External network is disabled in these tests");
};

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const handlers = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
app.onError((error) => {
  throw error;
});
after(() => client.close());

const BRAIN = "../src/world/play/games/brain";
const words = await import(`${BRAIN}/secret-word/words.js`);
const secretWord = await import("../server/lib/secretWord.js");

function request(route, { method = "GET", cookie, body } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return handlers[method](
    new Request(rewritten, {
      method,
      headers: { "x-kw": "1", ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const json = async (response, status = 200) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
async function unlock(role) {
  const response = await request("session/unlock", { method: "POST", body: { passphrase: phrases[role] } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

// ---------------------------------------------------------------- secret word

test("secret word: letters score like the genre, repeated letters only count as often as the answer has them", () => {
  const { scoreGuess } = words;
  assert.deepEqual(scoreGuess("lilac", "lilac"), ["hit", "hit", "hit", "hit", "hit"]);
  assert.deepEqual(scoreGuess("pearl", "lilac"), ["miss", "miss", "near", "miss", "near"]);
  // Two l's guessed, the answer has two: one hit, one near.
  assert.deepEqual(scoreGuess("allot", "lilac"), ["near", "near", "hit", "miss", "miss"]);
  // Three e's guessed, the answer has two: the placed one is a hit, the first of the rest is near.
  assert.deepEqual(scoreGuess("eerie", "crepe"), ["near", "miss", "near", "miss", "hit"]);
  assert.deepEqual(scoreGuess("speed", "abide"), ["miss", "miss", "near", "miss", "near"]);
});

test("secret word: the keyboard keeps the best thing known about each letter", () => {
  const states = words.letterStates(["pearl", "allot"], "lilac");
  assert.equal(states.l, "hit");
  assert.equal(states.a, "near");
  assert.equal(states.p, "miss");
  assert.equal(words.wordStatus(["pearl"], "lilac"), "playing");
  assert.equal(words.wordStatus(["pearl", "lilac"], "lilac"), "won");
  assert.equal(words.wordStatus(Array(6).fill("pearl"), "lilac"), "lost");
});

test("secret word: the tin is five-letter words she can also guess, walked without repeats for months", () => {
  const dictionary = new Set(readFileSync(new URL(`${BRAIN}/secret-word/dictionary.js`, import.meta.url), "utf8").match(/"([a-z ]+)"/)[1].split(" "));
  assert.ok(dictionary.size > 8000);
  assert.equal(new Set(words.WORD_TIN).size, words.WORD_TIN.length, "no duplicates in the tin");
  for (const word of words.WORD_TIN) assert.ok(words.isFiveLetters(word), word);
  const outside = words.WORD_TIN.filter((word) => !dictionary.has(word));
  assert.deepEqual(outside, ["mochi", "ramen", "bento"], "only the snacks are added on top of the dictionary");
  const seen = new Set();
  for (let n = 0; n < words.WORD_TIN.length; n++) seen.add(words.tinWord(words.addDays("2026-11-27", n)));
  assert.equal(seen.size, words.WORD_TIN.length, "every word once before any comes back");
  assert.equal(words.tinWord("2026-11-27"), words.tinWord("2026-11-27"));
});

test("secret word: Singapore's calendar and the streak", () => {
  assert.equal(words.singaporeDay(new Date("2026-11-26T15:59:00Z")), "2026-11-26");
  assert.equal(words.singaporeDay(new Date("2026-11-26T16:00:00Z")), "2026-11-27");
  const results = { "2026-11-25": { status: "won" }, "2026-11-26": { status: "won" }, "2026-11-24": { status: "lost" } };
  assert.equal(words.solvedStreak(results, "2026-11-27"), 2, "today not played yet: the streak still counts");
  assert.equal(words.solvedStreak({ ...results, "2026-11-27": { status: "won" } }, "2026-11-27"), 3);
  assert.equal(words.solvedStreak(results, "2026-11-28"), 0);
});

test("secret word API: the tin fills a day, Josh's word and note replace it, and she resumes anywhere", async () => {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");
  assert.equal((await request("me/games/secret-word")).status, 401);
  assert.equal((await request("admin/games/secret-word", { cookie: her })).status, 401, "only Josh sees the queue");

  const first = await json(await request("me/games/secret-word", { cookie: her }));
  assert.equal(first.by, "tin");
  assert.equal(first.word, words.tinWord(first.day));
  assert.equal(first.play, null);

  // Josh picks today's word with a note, and one for later (the next free day by default).
  await json(await request("admin/games/secret-word", { method: "POST", cookie: josh, body: { word: " LiLaC ", day: first.day, note: "because of your room ♡" } }), 201);
  const later = await json(await request("admin/games/secret-word", { method: "POST", cookie: josh, body: { word: "honey" } }), 201);
  assert.equal(later.day, words.addDays(first.day, 1));
  await json(await request("admin/games/secret-word", { method: "POST", cookie: josh, body: { word: "peach", day: first.day } }), 409);
  await json(await request("admin/games/secret-word", { method: "POST", cookie: josh, body: { word: "four" } }), 400);
  await json(await request("admin/games/secret-word", { method: "POST", cookie: josh, body: { word: "peach", day: "2020-01-01" } }), 400);

  const today = await json(await request("me/games/secret-word", { cookie: her }));
  assert.deepEqual([today.word, today.by, today.note], ["lilac", "josh", "because of your room ♡"]);

  // She plays one guess on her phone; the next visit (another device) sees it.
  const saved = await json(await request("me/games/secret-word/play", { method: "PUT", cookie: her, body: { day: today.day, guesses: ["pearl"] } }));
  assert.equal(saved.play.status, "playing");
  assert.deepEqual((await json(await request("me/games/secret-word", { cookie: her }))).play.guesses, ["pearl"]);
  // A stale copy arriving late doesn't erase progress; the server scores the guesses itself.
  const won = await json(await request("me/games/secret-word/play", { method: "PUT", cookie: her, body: { day: today.day, guesses: ["pearl", "LILAC"] } }));
  assert.equal(won.play.status, "won");
  const after = await json(await request("me/games/secret-word/play", { method: "PUT", cookie: her, body: { day: today.day, guesses: ["pearl", "honey", "lilac"] } }));
  assert.deepEqual(after.play.guesses, ["pearl", "lilac"], "a finished game stays finished");
  await json(await request("me/games/secret-word/play", { method: "PUT", cookie: her, body: { day: today.day, guesses: ["lilac", "pearl"] } }), 400);
  await json(await request("me/games/secret-word/play", { method: "PUT", cookie: her, body: { day: "2026-01-01", guesses: ["pearl"] } }), 400);
  assert.equal((await json(await request("me/games/secret-word", { cookie: her }))).streak, 1);
  // Josh's own game is his own.
  assert.equal((await json(await request("me/games/secret-word", { cookie: josh }))).play, null);

  // Josh sees how she did, and what's coming.
  const box = await json(await request("admin/games/secret-word", { cookie: josh }));
  assert.deepEqual(box.recent[0].her, { status: "won", tries: 2 });
  assert.deepEqual(box.upcoming.map((item) => item.word), ["lilac", "honey"]);
  assert.ok(box.tin.every((item) => item.day !== later.day), "days with a word aren't offered from the tin");

  // Changing today's word starts her over (her guesses were for the old word).
  const todayEntry = box.upcoming.find((item) => item.day === today.day);
  await json(await request(`admin/games/secret-word/${todayEntry.id}`, { method: "PATCH", cookie: josh, body: { word: "bloom" } }));
  const changed = await json(await request("me/games/secret-word", { cookie: her }));
  assert.equal(changed.word, "bloom");
  assert.equal(changed.play, null);
  await json(await request(`admin/games/secret-word/${later.id}`, { method: "PATCH", cookie: josh, body: { day: today.day } }), 409);
  await json(await request(`admin/games/secret-word/${later.id}`, { method: "DELETE", cookie: josh }));
  await json(await request(`admin/games/secret-word/${later.id}`, { method: "DELETE", cookie: josh }), 404);
});

test("secret word: plays only for today or just after midnight", async () => {
  const now = new Date("2026-11-27T02:00:00Z");
  await assert.rejects(secretWord.savePlay(db, "kiriya", { day: "2026-11-25", guesses: ["pearl"] }, { now }), /gone back in the tin/);
  const yesterday = await secretWord.savePlay(db, "kiriya", { day: "2026-11-26", guesses: ["pearl"] }, { now });
  assert.equal(yesterday.status, "playing");
  assert.equal(secretWord.nextFreeDay([{ day: "2026-11-28" }, { day: "2026-11-29" }], "2026-11-27"), "2026-11-30");
});

// ---------------------------------------------------------------- three in a row

const ttt = await import(`${BRAIN}/three-in-a-row/logic.js`);
const { seeded } = await import(`${BRAIN}/common/hooks.js`);
const board = (text) => [...text].map((c) => (c === "y" ? "you" : c === "m" ? "mao" : null));

test("three in a row: focused Maomao never loses, whatever she tries and whoever starts", () => {
  let games = 0;
  const explore = (b, turn) => {
    const result = ttt.outcome(b);
    if (result) {
      assert.notEqual(result, "you", b.join(","));
      games += 1;
      return;
    }
    const moves = turn === "you" ? ttt.emptyCells(b) : ttt.bestMoves(b, "mao");
    for (const i of moves) {
      const next = [...b];
      next[i] = turn;
      explore(next, ttt.other(turn));
    }
  };
  explore(ttt.emptyBoard(), "you");
  explore(ttt.emptyBoard(), "mao");
  assert.ok(games > 1000);
});

test("three in a row: thoughtful Maomao always takes a win and always blocks, but a fork can catch her", () => {
  const random = seeded(7);
  for (let k = 0; k < 200; k++) {
    assert.equal(ttt.maomaoMove(board("mm-yy----"), "thoughtful", random), 2, "takes the win over the block");
    assert.equal(ttt.maomaoMove(board("yy--m----"), "thoughtful", random), 2, "blocks");
  }
  // Her hunch (no calculation), then a corner: the classic fork wins.
  const script = [0.9, 0.9, 0.1, 0.0];
  const scripted = () => script.shift() ?? 0;
  let b = board("y--------");
  b[ttt.maomaoMove(b, "thoughtful", scripted)] = "mao";
  assert.equal(b[4], "mao");
  b[8] = "you";
  b[ttt.maomaoMove(b, "thoughtful", scripted)] = "mao";
  assert.equal(b[2], "mao", "a corner instead of the edge she needed");
  const before = [...b];
  b[6] = "you";
  assert.equal(ttt.describeMove(before, b, "you"), "fork");
  b[ttt.maomaoMove(b, "thoughtful", scripted)] = "mao";
  const win = ttt.threats(b, "you")[0];
  b[win] = "you";
  assert.equal(ttt.outcome(b), "you");
});

test("three in a row: sleepy Maomao really is sleepy", () => {
  const random = seeded(11);
  let missed = 0;
  for (let k = 0; k < 300; k++) if (ttt.maomaoMove(board("yy--m----"), "sleepy", random) !== 2) missed += 1;
  assert.ok(missed > 60 && missed < 260, `missed ${missed} blocks`);
  assert.equal(ttt.describeMove(board("yy--m----"), board("yym-m----"), "mao"), "block");
  assert.equal(ttt.outcome(board("ymyymmmyy")), "draw");
});

// ---------------------------------------------------------------- shy shade

const shade = await import(`${BRAIN}/shy-shade/logic.js`);
const colour = await import(`${BRAIN}/shy-shade/colour.js`);

test("shy shade: the grid grows and the shy shade gets shyer, measured in Oklab", () => {
  for (let level = 2; level < 40; level++) {
    assert.ok(shade.gridSize(level) >= shade.gridSize(level - 1));
    assert.ok(shade.difference(level) <= shade.difference(level - 1));
  }
  assert.equal(shade.difference(60), shade.MIN_DIFFERENCE);
  const random = seeded(3);
  for (let level = 1; level <= 30; level++)
    for (let k = 0; k < 20; k++) {
      const round = shade.newRound(level, random);
      assert.match(round.swatch, /^#[0-9a-f]{6}$/);
      assert.notEqual(round.swatch, round.shy);
      assert.ok(round.odd >= 0 && round.odd < round.size ** 2);
      const target = shade.difference(level);
      assert.ok(Math.abs(colour.hexDistance(round.swatch, round.shy) - target) <= Math.max(0.004, target * 0.2), `level ${level}`);
      if (level <= shade.CUE_LEVELS) {
        assert.ok(["lighter", "darker"].includes(round.kind));
        assert.ok(colour.contrast(round.swatch, round.shy) >= 1.3, "the cue levels read without colour vision");
      }
    }
  const [L, a, b] = colour.rgbToOklab(colour.fromHex("#b48fd0"));
  assert.equal(colour.toHex(colour.oklabToRgb([L, a, b])), "#b48fd0", "the conversion round-trips");
});

test("shy shade: wrong taps cost hearts, a squint never hides the shy one, a find moves on", () => {
  const random = seeded(5);
  let run = shade.newRun(random);
  const wrong = run.round.odd === 0 ? 1 : 0;
  run = shade.shadeTurn(run, { type: "tap", index: wrong }, random);
  assert.equal(run.hearts, 2);
  assert.equal(shade.shadeTurn(run, { type: "tap", index: wrong }, random), run, "the same wrong swatch twice costs nothing");
  run = shade.shadeTurn(run, { type: "squint" }, random);
  assert.equal(run.squints, 0);
  assert.equal(run.dimmed.length, 2);
  assert.ok(!run.dimmed.includes(run.round.odd));
  run = shade.shadeTurn(run, { type: "tap", index: run.round.odd }, random);
  assert.equal(run.phase, "found");
  run = shade.shadeTurn(run, { type: "next" }, random);
  assert.deepEqual([run.level, run.phase, run.missed.length, run.dimmed.length], [2, "play", 0, 0]);
  for (let level = 2; level < 11; level++) {
    run = shade.shadeTurn(shade.shadeTurn(run, { type: "tap", index: run.round.odd }, random), { type: "next" }, random);
  }
  assert.equal(run.level, 11);
  assert.equal(run.squints, 1, "another squint every ten levels");
  const cells = run.round.size ** 2;
  for (let i = 0, misses = 0; i < cells && misses < 3; i++) if (i !== run.round.odd) { run = shade.shadeTurn(run, { type: "tap", index: i }, random); misses++; }
  assert.equal(run.phase, "over");
});

// ---------------------------------------------------------------- charm grid

const charms = await import(`${BRAIN}/charm-grid/logic.js`);

test("charm grid: every puzzle has exactly one answer and can be finished without guessing", () => {
  const random = seeded(2026);
  for (const tier of Object.keys(charms.TIERS))
    for (let k = 0; k < 25; k++) {
      const p = charms.generate(tier, random);
      const { n } = p;
      assert.equal(charms.countSolutions(p.puzzle, n, 3), 1, `${tier} #${k}`);
      assert.ok(charms.solvableBySingles(p.puzzle, n));
      assert.ok(p.puzzle.every((v, i) => !v || v === p.solution[i]));
      assert.equal(charms.clashes(p.solution, n).size, 0);
      for (const unit of charms.units(n)) assert.equal(new Set(unit.map((i) => p.solution[i])).size, n);
      assert.ok(p.givens >= charms.TIERS[tier].targetGivens && p.givens <= charms.TIERS[tier].targetGivens + 4, `${tier} givens ${p.givens}`);
    }
});

test("charm grid: clashes and nudges", () => {
  const grid = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
  assert.equal(charms.clashes(grid, 4).size, 0);
  const broken = [...grid];
  broken[1] = 1;
  // A second heart in row 1 repeats in that row, in column 2 (with the heart below) and in the box.
  assert.deepEqual([...charms.clashes(broken, 4)].sort((a, b) => a - b), [0, 1, 9]);
  const missing = [...grid];
  missing[5] = 0;
  assert.deepEqual(charms.nextSingle(missing, 4), { cell: 5, value: 4, why: "only" });
});

// ---------------------------------------------------------------- picture stitch

const stitch = await import(`${BRAIN}/picture-stitch/puzzles.js`);
const lines = await import(`${BRAIN}/picture-stitch/lineSolver.js`);

test("picture stitch: every picture has one answer, reached by line logic alone", () => {
  assert.equal(stitch.PUZZLES.length, 12);
  for (const p of stitch.PUZZLES) {
    const { grid, solved } = lines.solveByLines(p.rows, p.cols);
    assert.ok(solved, `${p.id} needs a guess`);
    assert.deepEqual(grid.map((v) => (v === 1 ? 1 : 0)), p.solution, p.id);
    assert.ok(p.solution.some(Boolean) && p.colours.every((c, i) => Boolean(c) === Boolean(p.solution[i])));
  }
});

test("picture stitch: clue numbers and single-line logic", () => {
  assert.deepEqual(stitch.hintsFor([1, 1, 0, 1, 0, 0, 1, 1, 1]), [2, 1, 3]);
  assert.deepEqual(stitch.hintsFor([0, 0]), []);
  // A 3 in 5 cells always covers the middle; the quick overlap rule and the full one agree.
  assert.deepEqual(lines.pushSolve([0, 0, 0, 0, 0], [3]), [0, 0, 1, 0, 0]);
  assert.deepEqual(lines.settleLine([0, 0, 0, 0, 0], [3]), [0, 0, 1, 0, 0]);
  // With the first cell stitched, the 3 is pinned to the left: the full rule finishes the line.
  assert.deepEqual(lines.settleLine([1, 0, 0, 0, 0], [3]), [1, 1, 1, -1, -1]);
  assert.deepEqual(lines.settleLine([0, 0, 0, 0], []), [-1, -1, -1, -1]);
  assert.equal(lines.settleLine([1, -1, 1, 0], [3]), null, "a contradiction");
});
