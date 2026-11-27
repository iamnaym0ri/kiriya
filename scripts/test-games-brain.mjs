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
