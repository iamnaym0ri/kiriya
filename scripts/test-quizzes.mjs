// Quizzes for each other (docs/refactor/PLAN.md phase 5), through the real API and the rules in
// server/lib/quizzes.js: both directions, both modes, scores, streaks across Singapore days, and app
// test mode never reaching Kiriya.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import webpush from "web-push";
import * as schema from "../server/db/schema.js";
import { hashPassphrase } from "../server/auth/passphrase.js";

for (const name of ["DATABASE_URL", "kData_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "QSTASH_TOKEN", "VITE_VAPID_PUBLIC_KEY", "CRON_SECRET", "OPENAI_API_KEY", "APNS_KEY", "ABLY_API_KEY", "GIPHY_API_KEY"])
  process.env[name] = "";
const phrases = { kiriya: randomBytes(12).toString("hex"), admin: randomBytes(12).toString("hex") };
// Real web push keys, so the API's own notifications are attempted (to subscriptions on a closed
// local port) and each subscription records whether anything was sent its way.
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = "mailto:test@kiriya.love";
// These tests check delivery to her phone, which is paused while the website is closed (shared/siteClosed.js).
process.env.KIRIYA_NOTIFY_WHILE_CLOSED = "1";
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
const quizzes = await import("../server/lib/quizzes.js");
const { setTestMode } = await import("../server/lib/appTestMode.js");
app.onError((error) => {
  throw error;
});

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

const ramen = {
  mode: "me",
  question: "  what's my   comfort food? ",
  choices: [
    { emoji: "🍜", text: "ramen" },
    { emoji: "🍣", text: "sushi" },
    { emoji: "🍓", text: "" },
  ],
  answer: 0,
};
const quiz = (overrides = {}) => ({ clientId: randomUUID(), ...ramen, ...overrides });
const post = (cookie, body, status = 201) => request("me/quizzes", { method: "POST", cookie, body }).then((r) => json(r, status));
const answer = (cookie, id, choice, status = 200) => request(`me/quizzes/${id}/answer`, { method: "POST", cookie, body: { choice } }).then((r) => json(r, status));
const at = (iso) => new Date(iso);

// Notifications the rules hand to the push service, captured instead of sent.
function recorder() {
  const sent = [];
  const send = async (_db, message, options) => {
    sent.push({ message, role: options.role });
    return { sent: 1, targets: 1 };
  };
  return { sent, send };
}

async function clearQuizzes() {
  await client.query("DELETE FROM kv WHERE key LIKE 'quiz:item:%'");
}

try {
  const her = await unlock("kiriya");
  const josh = await unlock("admin");

  await test("Only the two of them can open quizzes", async () => {
    assert.equal((await request("me/quizzes")).status, 401);
    assert.equal((await request("me/quizzes", { method: "POST", body: quiz() })).status, 401);
    const empty = await json(await request("me/quizzes", { cookie: her }));
    assert.deepEqual([empty.me, empty.waiting, empty.sent, empty.history, empty.testMode], ["kiriya", [], [], [], false]);
    assert.deepEqual(empty.names, { admin: "Josh", kiriya: "Kiriya" });
  });

  await test("Only well-formed quizzes get through, with a friendly reason", async () => {
    const reject = async (body, pattern) => {
      const error = await post(josh, body, 400);
      assert.match(error.message, pattern);
    };
    await reject(quiz({ question: "   " }), /Write a question/);
    await reject(quiz({ question: "x".repeat(161) }), /up to 160/);
    await reject(quiz({ choices: [{ emoji: "🍜", text: "ramen" }] }), /2 to 4 answers/);
    await reject(quiz({ choices: Array.from({ length: 5 }, (_, i) => ({ emoji: "🍜", text: `r${i}` })) }), /2 to 4 answers/);
    await reject(quiz({ choices: [{ emoji: "ab", text: "ramen" }, { emoji: "🍣", text: "sushi" }] }), /one emoji/);
    await reject(quiz({ choices: [{ emoji: "🍜🍣", text: "both" }, { emoji: "🍣", text: "sushi" }] }), /one emoji/);
    await reject(quiz({ choices: [{ emoji: "🍜", text: "Ramen" }, { emoji: "🍜", text: "ramen " }] }), /the same/);
    await reject(quiz({ answer: 3 }), /right answer/);
    await reject(quiz({ choices: [{ emoji: "🍜", text: "x".repeat(41) }, { emoji: "🍣" }] }), /up to 40/);
    await reject(quiz({ image: { kind: "upload", url: "https://evil.example/x.png" } }), /picture/);
    await reject(quiz({ image: { kind: "upload", url: "/api/uploads/media?path=chat%2Fx.webp" } }), /picture/);
    await reject(quiz({ mode: "them" }), /couldn’t be sent/);
    // Flags, keycaps, skin tones and ZWJ families are one emoji each.
    for (const emoji of ["🇸🇬", "1️⃣", "👍🏽", "👩‍❤️‍👨", "❤️"]) assert.equal(quizzes.isOneEmoji(emoji), true, emoji);
    for (const emoji of ["", "a", "🍜🍜", "♡♡"]) assert.equal(quizzes.isOneEmoji(emoji), false, emoji);
  });

  await test("Josh → Kiriya, about me: she guesses without ever being sent the answer", async () => {
    await clearQuizzes();
    const sent = await post(josh, quiz({ image: { kind: "upload", url: "/api/uploads/media?path=quizzes%2F1-ab12cd34.webp", width: 900, height: 1200 } }));
    assert.equal(sent.question, "what's my comfort food?");
    assert.deepEqual(sent.choices.map((c) => c.id), ["a", "b", "c"]);
    assert.deepEqual([sent.answer, sent.mine, sent.canAnswer, sent.to], ["a", true, false, "kiriya"]);

    const mine = await json(await request("me/quizzes", { cookie: her }));
    assert.equal(mine.waiting.length, 1);
    const waiting = mine.waiting[0];
    assert.deepEqual([waiting.answer, waiting.canAnswer, waiting.mine], [null, true, false]);
    assert(!JSON.stringify(mine).includes('"answer":"a"'), "the right answer never reaches her before she answers");
    const one = await json(await request(`me/quizzes/${sent.id}`, { cookie: her }));
    assert.equal(one.answer, null);
    assert.equal((await json(await request("me/quizzes", { cookie: josh }))).sent.length, 1);

    // Josh can't answer his own (real) quiz; a wrong letter is refused.
    await answer(josh, sent.id, "a", 403);
    await answer(her, sent.id, "z", 400);

    const revealed = await answer(her, sent.id, "a");
    assert.deepEqual([revealed.result, revealed.answer, revealed.reply.choice], ["right", "a", "a"]);
    // A retry of the same answer is fine; changing it afterwards isn't.
    assert.equal((await answer(her, sent.id, "a")).result, "right");
    await answer(her, sent.id, "b", 409);

    const after = await json(await request("me/quizzes", { cookie: josh }));
    assert.deepEqual([after.sent.length, after.results.length, after.history.length], [0, 1, 1]);
    await json(await request(`me/quizzes/${sent.id}/seen`, { method: "POST", cookie: josh, body: {} }));
    assert.equal((await json(await request("me/quizzes", { cookie: josh }))).results.length, 0);
    assert.equal((await json(await request(`me/quizzes/${sent.id}`, { method: "DELETE", cookie: josh }), 409)).error, "conflict", "answered quizzes stay in the history");
  });

  await test("Kiriya → Josh, about us: the same pick means they're in sync", async () => {
    await clearQuizzes();
    const us = await post(her, quiz({ mode: "us", question: "where should our next date be?", answer: 1, choices: [{ emoji: "🏖️", text: "beach" }, { emoji: "🎡", text: "fair" }] }));
    assert.equal(us.to, "admin");
    const waiting = (await json(await request("me/quizzes", { cookie: josh }))).waiting;
    assert.deepEqual([waiting.length, waiting[0].answer], [1, null], "her own pick stays hidden until he answers");
    assert.equal((await answer(josh, us.id, "b")).result, "match");

    const differ = await post(her, quiz({ mode: "us", question: "cats or dogs?", answer: 0, choices: [{ emoji: "🐱" }, { emoji: "🐶" }] }));
    assert.equal((await answer(josh, differ.id, "b")).result, "differ");

    const stats = (await json(await request("me/quizzes", { cookie: her }))).stats;
    assert.equal(stats.sync, 1);
    assert.equal(stats.kiriya.points, 1, "being in sync counts for both of them");
    assert.equal(stats.admin.points, 1);
  });

  await test("Notifications: the other one hears about a new quiz, the sender about the answer", async () => {
    await clearQuizzes();
    const { sent, send } = recorder();
    const made = await quizzes.createQuiz(db, "kiriya", quiz({ question: "what's my favourite colour?", choices: [{ emoji: "💜", text: "lilac" }, { emoji: "🩷", text: "pink" }] }), { send });
    assert.deepEqual(sent.at(-1), {
      role: "admin",
      message: { title: "Kiriya sent you a quiz question ♡", body: "“what's my favourite colour?”  💜 🩷", navigate: `/world/play/quizzes?open=${made.id}`, kind: "quiz", threadId: "quizzes" },
    });
    await quizzes.answerQuiz(db, "admin", made.id, { choice: "b" }, { send });
    assert.equal(sent.at(-1).role, "kiriya");
    assert.equal(sent.at(-1).message.title, "Josh answered your quiz ♡");
    assert.match(sent.at(-1).message.body, /guessed 🩷, so close ♡$/);

    const back = await quizzes.createQuiz(db, "admin", quiz(), { send });
    assert.equal(sent.at(-1).role, "kiriya");
    assert.equal(sent.at(-1).message.title, "Josh sent you a quiz question ♡");
    await quizzes.answerQuiz(db, "kiriya", back.id, { choice: "a" }, { send });
    assert.deepEqual([sent.at(-1).role, sent.at(-1).message.title], ["admin", "Kiriya answered your quiz ♡"]);
    assert.match(sent.at(-1).message.body, /got it right ✨$/);
    assert.equal(sent.length, 4);
  });

  await test("Test mode: Josh's quizzes and answers never reach Kiriya", async () => {
    await clearQuizzes();
    const { sent, send } = recorder();
    const now = at("2026-11-26T04:00:00Z");
    // One of hers, waiting for him, from before he started testing.
    const hers = await quizzes.createQuiz(db, "kiriya", quiz({ question: "do you know my shoe size?" }), { send, now: at("2026-11-26T03:00:00Z") });
    sent.length = 0;
    await setTestMode(db, true, now);

    const trial = await quizzes.createQuiz(db, "admin", quiz({ question: "a test one" }), { send, now });
    assert.equal(trial.test, true);
    assert.deepEqual(sent.map((s) => s.role), ["admin"], "the notification goes to his own phones");
    assert.equal(sent[0].message.title, "Josh sent you a quiz question ♡", "worded exactly as she'd see it");
    assert.match(sent[0].message.body, /^test: /);

    // She never sees it, anywhere.
    const hersView = await quizzes.overview(db, "kiriya", { now });
    assert.equal(JSON.stringify(hersView).includes("a test one"), false);
    assert.equal(await quizzes.getQuiz(db, "kiriya", trial.id), null);
    await assert.rejects(quizzes.answerQuiz(db, "kiriya", trial.id, { choice: "a" }, { send, now }), (e) => e.status === 404);
    assert.equal((await quizzes.summary(db, "kiriya", { now })).waiting, 0, "his test quiz never waits for her");

    // He can answer his own test quiz to see what she'd see; nothing goes anywhere.
    const his = await quizzes.overview(db, "admin", { now });
    assert.equal(his.testMode, true);
    assert.deepEqual(his.waiting.map((q) => q.id), [hers.id, trial.id], "his test quiz waits for him to try, after hers");
    assert.equal(his.waiting[1].answer, null);
    assert.equal((await quizzes.answerQuiz(db, "admin", trial.id, { choice: "a" }, { send, now })).result, "right");

    // Answering one of hers is a dry run: he sees the reveal, she sees nothing.
    const dry = await quizzes.answerQuiz(db, "admin", hers.id, { choice: "b" }, { send, now });
    assert.deepEqual([dry.dryRun, dry.result], [true, "wrong"]);
    assert.equal((await quizzes.readQuiz(db, hers.id)).reply, null, "not saved");
    assert.deepEqual(sent.map((s) => s.role), ["admin"], "and nothing was sent");

    // Test quizzes never count, and stay out of her history.
    const stats = await quizzes.quizStats(db, { now });
    assert.deepEqual([stats.admin.sent, stats.admin.points, stats.admin.answered], [0, 0, 0]);
    assert.equal((await quizzes.listHistory(db, "kiriya")).items.length, 0);
    assert.equal((await quizzes.listHistory(db, "admin")).items.length, 1);

    // After test mode, the same send reaches her.
    await setTestMode(db, false, now);
    await quizzes.createQuiz(db, "admin", quiz({ question: "a real one" }), { send, now });
    assert.equal(sent.at(-1).role, "kiriya");
    assert.equal((await quizzes.answerQuiz(db, "admin", hers.id, { choice: "b" }, { send, now })).dryRun, undefined);
    assert.equal((await quizzes.readQuiz(db, hers.id)).reply.choice, "b");
  });

  await test("Test mode through the real push path: only Josh's phone is ever tried", async () => {
    await clearQuizzes();
    const subscription = (role) => {
      const ecdh = createECDH("prime256v1");
      ecdh.generateKeys();
      return { role, endpoint: `https://127.0.0.1:9/push/${role}/${randomUUID()}`, keys: { p256dh: ecdh.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") } };
    };
    await db.delete(schema.pushSubscriptions);
    await db.insert(schema.pushSubscriptions).values([subscription("kiriya"), subscription("admin")]);
    const tried = async () => {
      const rows = await db.select().from(schema.pushSubscriptions);
      return Object.fromEntries(rows.map((r) => [r.role, Boolean(r.lastError || r.lastSuccessAt)]));
    };
    const waitFor = async (check) => {
      for (let i = 0; i < 100 && !check(await tried()); i++) await new Promise((resolve) => setTimeout(resolve, 50));
      return tried();
    };

    await setTestMode(db, true);
    const trial = await post(josh, quiz({ question: "test through the API" }));
    assert.equal(trial.test, true);
    assert.deepEqual(await waitFor((t) => t.admin), { admin: true, kiriya: false });
    await json(await request(`me/quizzes/${trial.id}/answer`, { method: "POST", cookie: josh, body: { choice: "a" } }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await tried()).kiriya, false, "her phone was never tried");
    assert.equal(JSON.stringify(await json(await request("me/quizzes", { cookie: her }))).includes("test through the API"), false);

    await setTestMode(db, false);
    await post(josh, quiz({ question: "real through the API" }));
    assert.equal((await waitFor((t) => t.kiriya)).kiriya, true, "with test mode off, it goes to her");
    await db.delete(schema.pushSubscriptions);
  });

  await test("Scores: right guesses, misses, and right answers in a row", async () => {
    await clearQuizzes();
    const day = (n, hour = 4) => at(`2026-11-${String(n).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`);
    const play = async (from, to, mode, pick, when) => {
      const made = await quizzes.createQuiz(db, from, quiz({ mode, answer: 0 }), { now: when, send: async () => ({}) });
      return quizzes.answerQuiz(db, to, made.id, { choice: pick }, { now: when, send: async () => ({}) });
    };
    await play("admin", "kiriya", "me", "a", day(10));
    await play("admin", "kiriya", "me", "b", day(10, 5));
    await play("admin", "kiriya", "me", "a", day(10, 6));
    await play("admin", "kiriya", "me", "a", day(10, 7));
    await play("kiriya", "admin", "me", "c", day(10, 8));
    await play("kiriya", "admin", "us", "a", day(10, 9));
    const stats = await quizzes.quizStats(db, { now: day(10, 10) });
    assert.deepEqual(
      [stats.kiriya.right, stats.kiriya.guessed, stats.kiriya.inARow, stats.kiriya.points, stats.kiriya.sent, stats.kiriya.answered],
      [3, 4, 2, 4, 2, 4],
    );
    assert.deepEqual([stats.admin.right, stats.admin.guessed, stats.admin.inARow, stats.admin.points, stats.sync], [0, 1, 0, 1, 1]);
  });

  await test("Streaks count Singapore days in a row, survive until a whole day is missed", async () => {
    await clearQuizzes();
    const noop = async () => ({});
    // 23:30 Singapore on the 1st is still the 1st there (15:30 UTC), 00:30 on the 2nd is 16:30 UTC.
    const sg = (day, time) => new Date(`2026-12-${String(day).padStart(2, "0")}T${time}:00+08:00`);
    const make = (from, when) => quizzes.createQuiz(db, from, quiz(), { now: when, send: noop });
    const reply = (to, id, when) => quizzes.answerQuiz(db, to, id, { choice: "a" }, { now: when, send: noop });

    const first = await make("admin", sg(1, "23:30"));
    assert.equal((await quizzes.quizStats(db, { now: sg(1, "23:45") })).admin.streak, 1);
    await reply("kiriya", first.id, sg(2, "00:30"));
    let stats = await quizzes.quizStats(db, { now: sg(2, "09:00") });
    assert.deepEqual([stats.admin.streak, stats.kiriya.streak, stats.kiriya.playedToday], [1, 1, true], "her answer counts on the 2nd");

    // Josh plays three days running; on the fourth morning his streak is still alive, not yet extended.
    await make("admin", sg(2, "12:00"));
    await make("admin", sg(3, "12:00"));
    stats = await quizzes.quizStats(db, { now: sg(4, "08:00") });
    assert.deepEqual([stats.admin.streak, stats.admin.playedToday, stats.admin.best], [3, false, 3]);
    // Missing the whole of the 4th breaks it on the 5th; the best stays.
    stats = await quizzes.quizStats(db, { now: sg(5, "08:00") });
    assert.deepEqual([stats.admin.streak, stats.admin.best], [0, 3]);
    await make("admin", sg(5, "21:00"));
    stats = await quizzes.quizStats(db, { now: sg(5, "22:00") });
    assert.deepEqual([stats.admin.streak, stats.admin.best, stats.admin.playedToday], [1, 3, true]);
    // Kiriya's own streak: she sends on the 3rd, missed, so her streak from the 2nd ended on the 4th.
    await make("kiriya", sg(3, "10:00"));
    stats = await quizzes.quizStats(db, { now: sg(4, "10:00") });
    assert.deepEqual([stats.kiriya.streak, stats.kiriya.best], [2, 2]);
  });

  await test("The summary says how many wait for each of them, and who they're from", async () => {
    await clearQuizzes();
    const empty = await json(await request("me/quizzes/summary", { cookie: her }));
    assert.equal(empty.waiting, 0);
    assert.equal("from" in empty, false);
    await post(josh, quiz({ question: "first" }));
    await post(josh, quiz({ question: "second" }));
    const hers = await json(await request("me/quizzes/summary", { cookie: her }));
    assert.deepEqual([hers.waiting, hers.from], [2, "Josh"]);
    const his = await json(await request("me/quizzes/summary", { cookie: josh }));
    assert.deepEqual([his.waiting, his.from], [0, undefined]);
    await post(her, quiz({ question: "for him" }));
    const now = await json(await request("me/quizzes/summary", { cookie: josh }));
    assert.deepEqual([now.waiting, now.from], [1, "Kiriya"]);
    assert.equal(typeof now.stats.admin.streak, "number");
  });

  await test("Sends are idempotent and capped, history pages back, only the sender can take one back", async () => {
    await clearQuizzes();
    const clientId = randomUUID();
    const once = await post(her, quiz({ clientId }));
    const again = await post(her, quiz({ clientId }));
    assert.equal(again.id, once.id);
    await post(josh, quiz({ clientId }), 409);
    assert.equal((await request(`me/quizzes/${once.id}`, { method: "DELETE", cookie: josh })).status, 404);
    await json(await request(`me/quizzes/${once.id}`, { method: "DELETE", cookie: her }));
    assert.equal((await request(`me/quizzes/${once.id}`, { cookie: josh })).status, 404);
    assert.equal((await request("me/quizzes/not-a-uuid", { cookie: josh })).status, 404);

    const base = Date.parse("2026-11-20T00:00:00Z");
    for (let i = 0; i < 30; i++) await quizzes.createQuiz(db, "admin", quiz({ question: `q${i}` }), { now: new Date(base + i * 1000), send: async () => ({}) });
    await assert.rejects(quizzes.createQuiz(db, "admin", quiz(), { now: new Date(base + 40_000), send: async () => ({}) }), (e) => e.status === 429);

    const open = (await json(await request("me/quizzes", { cookie: her }))).waiting;
    assert.equal(open.length, 30);
    assert.equal(open[0].question, "q0", "oldest first, like a queue");
    for (const [i, item] of open.entries()) await quizzes.answerQuiz(db, "kiriya", item.id, { choice: "a" }, { now: new Date(base + 100_000 + i * 1000), send: async () => ({}) });
    const seen = [];
    let before = null;
    do {
      const page = await json(await request(`me/quizzes/history${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cookie: her }));
      seen.push(...page.items.map((q) => q.question));
      before = page.next;
    } while (before);
    assert.equal(seen.length, 30);
    assert.equal(new Set(seen).size, 30);
    assert.equal(seen[0], "q29", "newest answer first");
    const summary = await json(await request("me/quizzes/summary", { cookie: josh }));
    assert.deepEqual([summary.waiting, summary.results], [0, 30]);
  });
} finally {
  await client.close();
}
