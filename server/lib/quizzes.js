import { randomUUID } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "../db/client.js";
import { isUploadUrl } from "./media.js";
import { notificationPreview } from "./loveNotes.js";
import { names, other } from "./chat.js";
import { testMode } from "./appTestMode.js";
import { addDays, localDay } from "./time.js";
import { sendToSubscribers } from "../push/webpush.js";

// Quizzes for each other (docs/refactor/PLAN.md phase 5). Either of them writes a question with a
// picture and two to four emoji answers, in one of two modes:
// - "me" (about me): the sender marks the right answer and the other one guesses;
// - "us" (about us): the sender secretly picks their own answer and the other one picks theirs; the
//   same pick means they're in sync.
// Each quiz is one row in the `kv` store (`quiz:item:<id>`), so there's no table to migrate. Scores
// and streaks are worked out from those rows every time, so they can't drift.
//
// App test mode (lib/appTestMode.js): while Josh tests the app, nothing he does here may reach
// Kiriya. A quiz he sends is kept as a test (only he ever sees it, and he can answer it himself to see
// what she'd see), its notification goes to his own phones, and answering one of hers is a dry run.

export const MODES = ["me", "us"];
export const LIMITS = { question: 160, choiceText: 40, minChoices: 2, maxChoices: 4, perHour: 30 };
export const QUIZ_FOLDER = "quizzes";
const PREFIX = "quiz:item:";
const CHOICE_IDS = ["a", "b", "c", "d"];
const HISTORY_PAGE = 12;
const LIST_CAP = 50;

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- validation ----------

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
/** Exactly one emoji (skin tones, ZWJ families, flags and keycaps count as one). */
export function isOneEmoji(value) {
  if (typeof value !== "string" || !value || value.length > 32) return false;
  if ([...graphemes.segment(value)].length !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(value);
}

const oneLine = (value) => value.replace(/\s+/g, " ").trim();
const httpsUrl = z.string().max(500).url().refine((url) => url.startsWith("https://"), "https only");
const quizUpload = z.string().max(600).refine((url) => isUploadUrl(url, [QUIZ_FOLDER]), "not one of our uploads");
const size = { width: z.number().int().min(1).max(10000).optional(), height: z.number().int().min(1).max(10000).optional() };
export const LICENSES = ["cc0", "pdm", "by", "by-sa", "by-nc", "by-nc-sa", "by-nd", "by-nc-nd"];

// A stock photo from Openverse, copied into our own storage when it was picked, with the credit
// its licence asks for (shown on the card).
const credit = z
  .object({
    id: z.string().uuid(),
    title: z.string().max(200).default(""),
    creator: z.string().max(120).nullable().default(null),
    creatorUrl: httpsUrl.nullable().default(null),
    license: z.enum(LICENSES),
    licenseVersion: z.string().max(10).nullable().default(null),
    licenseUrl: httpsUrl.refine((url) => url.startsWith("https://creativecommons.org/"), "creative commons only").nullable().default(null),
    source: z.string().max(60).default(""),
    landingUrl: httpsUrl.nullable().default(null),
  })
  .strict();

const image = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("upload"), url: quizUpload, ...size }).strict(),
  z.object({ kind: z.literal("stock"), url: quizUpload, ...size, credit }).strict(),
]);

const choice = z
  .object({
    emoji: z.string().refine(isOneEmoji, "one emoji"),
    text: z.string().max(200).transform(oneLine).pipe(z.string().max(LIMITS.choiceText)).default(""),
  })
  .strict();

export const createSchema = z
  .object({
    clientId: z.string().min(8).max(80).regex(/^[\w-]+$/),
    mode: z.enum(MODES),
    question: z.string().max(600).transform(oneLine).pipe(z.string().min(1).max(LIMITS.question)),
    image: image.nullable().default(null),
    choices: z.array(choice).min(LIMITS.minChoices).max(LIMITS.maxChoices),
    answer: z.number().int().min(0).max(LIMITS.maxChoices - 1),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.answer >= input.choices.length) ctx.addIssue({ code: "custom", path: ["answer"], message: "pick one of the answers" });
    const seen = new Set(input.choices.map((c) => `${c.emoji}|${c.text.toLowerCase()}`));
    if (seen.size !== input.choices.length) ctx.addIssue({ code: "custom", path: ["choices"], message: "two answers are the same" });
  });

/** The friendliest message for a rejected quiz (shown on her phone). */
export function createProblem(error) {
  const issue = error?.issues?.[0];
  if (!issue) return "That quiz couldn’t be sent.";
  const where = issue.path?.[0];
  if (where === "question") return issue.code === "too_small" ? "Write a question first ♡" : `Questions can be up to ${LIMITS.question} letters.`;
  if (where === "choices" && issue.message === "two answers are the same") return "Two answers are the same. Make each one different.";
  if (where === "choices" && issue.path.length === 1) return `Give it ${LIMITS.minChoices} to ${LIMITS.maxChoices} answers.`;
  if (where === "choices" && issue.path[2] === "emoji") return "Every answer needs one emoji.";
  if (where === "choices") return `Answers can be up to ${LIMITS.choiceText} letters.`;
  if (where === "answer") return "Pick the right answer.";
  if (where === "image") return "That picture couldn’t be used. Try another?";
  return "That quiz couldn’t be sent.";
}

// ---------- reading ----------

const keyOf = (id) => `${PREFIX}${id}`;
const isTest = sql`coalesce((${schema.kv.value}->>'test')::boolean, false)`;
const quizRows = (role, ...filters) =>
  and(like(schema.kv.key, `${PREFIX}%`), ...(role === "admin" ? [] : [sql`${isTest} = false`]), ...filters);
const field = (name) => sql`${schema.kv.value}->>${name}`;

/** Can `role` answer this quiz now? (Josh may answer his own test quizzes, to see what she'd see.) */
export const canAnswer = (role, quiz) => !quiz.reply && (quiz.to === role || (quiz.test && role === "admin"));

/**
 * A quiz as `role` may see it. Until it's answered, whoever is to answer it never gets the right
 * answer (or, about us, the sender's pick).
 */
export function shape(quiz, role) {
  const answering = canAnswer(role, quiz);
  return {
    id: quiz.id,
    from: quiz.from,
    to: quiz.to,
    mode: quiz.mode,
    question: quiz.question,
    image: quiz.image,
    choices: quiz.choices,
    answer: answering ? null : quiz.answer,
    reply: quiz.reply,
    result: quiz.result,
    test: Boolean(quiz.test),
    createdAt: quiz.createdAt,
    seenAt: quiz.seenAt ?? null,
    mine: quiz.from === role,
    canAnswer: answering,
  };
}

export async function readQuiz(db, id) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, keyOf(id)));
  return row?.value ?? null;
}

/** One quiz for `role`, or null when it isn't theirs to see. */
export async function getQuiz(db, role, id) {
  const quiz = await readQuiz(db, id);
  if (!quiz || (quiz.test && role !== "admin")) return null;
  return shape(quiz, role);
}

async function select(db, where, { order = "desc", limit = LIST_CAP } = {}) {
  const rows = await db
    .select({ value: schema.kv.value })
    .from(schema.kv)
    .where(where)
    .orderBy(order === "asc" ? field("createdAt") : desc(field("createdAt")))
    .limit(limit);
  return rows.map((row) => row.value);
}

/** Answered quizzes (both directions), newest answer first; `before` pages back. */
export async function listHistory(db, role, { before = null, limit = HISTORY_PAGE } = {}) {
  const answeredAt = sql`${schema.kv.value}->'reply'->>'at'`;
  const rows = await db
    .select({ value: schema.kv.value })
    .from(schema.kv)
    .where(quizRows(role, sql`${answeredAt} IS NOT NULL`, before ? sql`${answeredAt} < ${before}` : undefined))
    .orderBy(desc(answeredAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit).map((row) => shape(row.value, role));
  return { items: page, next: rows.length > limit ? page.at(-1).reply.at : null };
}

/** Everything the quizzes screen shows at once. */
export async function overview(db, role, { now = new Date() } = {}) {
  const unanswered = sql`(${schema.kv.value}->>'reply') IS NULL`;
  const [waitingRaw, sentRaw, resultsRaw, history, stats, who, mode] = await Promise.all([
    // For me to answer, oldest first (Josh's own test quizzes too, to try them).
    select(db, quizRows(role, unanswered, role === "admin" ? sql`(${field("to")} = ${role} OR ${isTest} = true)` : eq(field("to"), role)), { order: "asc" }),
    // Mine, still waiting for the other one.
    select(db, quizRows(role, unanswered, eq(field("from"), role), sql`${isTest} = false`)),
    // Mine, answered, and I haven't looked at the result yet.
    select(db, quizRows(role, sql`(${schema.kv.value}->>'reply') IS NOT NULL`, eq(field("from"), role), sql`(${schema.kv.value}->>'seenAt') IS NULL`, sql`${isTest} = false`)),
    listHistory(db, role),
    quizStats(db, { now }),
    names(db),
    role === "admin" ? testMode(db, now) : { on: false },
  ]);
  return {
    me: role,
    names: who,
    testMode: mode.on,
    waiting: waitingRaw.map((quiz) => shape(quiz, role)),
    sent: sentRaw.map((quiz) => shape(quiz, role)),
    results: resultsRaw.map((quiz) => shape(quiz, role)),
    history: history.items,
    next: history.next,
    stats,
  };
}

/**
 * For the play hub's card and the home at-a-glance card: how many quizzes wait for me (and who the
 * oldest is from), how many of my quizzes have a result I haven't seen, and the scores.
 */
export async function summary(db, role, { now = new Date() } = {}) {
  const waitingFor = role === "admin" ? sql`(${field("to")} = ${role} OR ${isTest} = true)` : eq(field("to"), role);
  const [waiting, [results], stats, who] = await Promise.all([
    db
      .select({ from: field("from") })
      .from(schema.kv)
      .where(quizRows(role, sql`(${schema.kv.value}->>'reply') IS NULL`, waitingFor))
      .orderBy(field("createdAt")),
    db
      .select({ n: sql`count(*)::int` })
      .from(schema.kv)
      .where(quizRows(role, sql`(${schema.kv.value}->>'reply') IS NOT NULL`, eq(field("from"), role), sql`(${schema.kv.value}->>'seenAt') IS NULL`, sql`${isTest} = false`)),
    quizStats(db, { now }),
    names(db),
  ]);
  return {
    me: role,
    names: who,
    waiting: waiting.length,
    ...(waiting.length ? { from: who[waiting[0].from] } : {}),
    results: Number(results.n),
    stats,
  };
}

// ---------- scores and streaks ----------

function runs(days, today) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  // The streak is alive while they played today or yesterday (today is still theirs to play).
  const yesterday = addDays(today, -1);
  const start = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  let current = 0;
  for (let day = start; day && days.has(day); day = addDays(day, -1)) current++;
  return { current, best, today: days.has(today) };
}

/**
 * Scores and streaks for both of them, from every real (non-test) quiz:
 * - points: about-me quizzes they guessed right, plus about-us quizzes where they were in sync;
 * - streak: Singapore days in a row on which they sent or answered a quiz (alive until a whole day
 *   is missed); best: their longest ever;
 * - inARow: about-me guesses right in a row, most recent first.
 */
export async function quizStats(db, { now = new Date() } = {}) {
  const rows = await db
    .select({ from: field("from"), to: field("to"), mode: field("mode"), createdAt: field("createdAt"), answeredAt: sql`${schema.kv.value}->'reply'->>'at'`, result: field("result") })
    .from(schema.kv)
    .where(and(like(schema.kv.key, `${PREFIX}%`), sql`${isTest} = false`));
  const today = localDay(now);
  const people = { kiriya: { days: new Set(), guesses: [] }, admin: { days: new Set(), guesses: [] } };
  let sync = 0;
  for (const row of rows) {
    people[row.from]?.days.add(localDay(new Date(row.createdAt)));
    if (!row.answeredAt) continue;
    people[row.to]?.days.add(localDay(new Date(row.answeredAt)));
    if (row.mode === "us" && row.result === "match") sync++;
    if (row.mode === "me") people[row.to]?.guesses.push({ at: row.answeredAt, right: row.result === "right" });
  }
  const out = { today, sync };
  for (const [role, person] of Object.entries(people)) {
    const guesses = person.guesses.sort((a, b) => (a.at < b.at ? 1 : -1));
    const right = guesses.filter((g) => g.right).length;
    let inARow = 0;
    while (inARow < guesses.length && guesses[inARow].right) inARow++;
    const streak = runs(person.days, today);
    out[role] = {
      points: right + sync,
      right,
      guessed: guesses.length,
      inARow,
      sent: rows.filter((r) => r.from === role).length,
      answered: rows.filter((r) => r.to === role && r.answeredAt).length,
      streak: streak.current,
      best: streak.best,
      playedToday: streak.today,
    };
  }
  return out;
}

// ---------- writing ----------

const emojiLine = (choices) => choices.map((c) => c.emoji).join(" ");

/** What the other one's phone says when a quiz arrives. */
export function quizNotification(quiz, fromName, { test = false } = {}) {
  const line = `“${notificationPreview(quiz.question, 90)}”  ${emojiLine(quiz.choices)}`;
  return {
    title: `${fromName} sent you a quiz question ♡`,
    body: test ? `test: ${line}` : line,
    navigate: `/world/play/quizzes?open=${quiz.id}`,
    kind: "quiz",
    threadId: "quizzes",
  };
}

/** What the sender's phone says when the quiz is answered. */
export function answerNotification(quiz, byName) {
  const picked = quiz.choices.find((c) => c.id === quiz.reply.choice);
  const ending = {
    right: "got it right ✨",
    wrong: `guessed ${picked?.emoji ?? "…"}, so close ♡`,
    match: `you’re in sync ♡ both picked ${picked?.emoji ?? ""}`.trim(),
    differ: "you picked different answers, come see ♡",
  }[quiz.result];
  return {
    title: `${byName} answered your quiz ♡`,
    body: `“${notificationPreview(quiz.question, 70)}” · ${ending}`,
    navigate: `/world/play/quizzes?open=${quiz.id}`,
    kind: "quiz",
    threadId: "quizzes",
  };
}

/**
 * Sends a quiz from `role`. Idempotent on clientId. The notification goes out afterwards (`after`):
 * to the other one, or, in app test mode, to Josh's own phones only.
 */
export async function createQuiz(db, role, input, { now = new Date(), after = (task) => task(), send = sendToSubscribers } = {}) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw fail(createProblem(parsed.error));
  const data = parsed.data;

  const [existing] = await db
    .select({ value: schema.kv.value })
    .from(schema.kv)
    .where(and(like(schema.kv.key, `${PREFIX}%`), eq(field("clientId"), data.clientId)));
  if (existing) {
    if (existing.value.from !== role) throw fail("conflict", 409);
    return shape(existing.value, role);
  }

  const [{ recent }] = await db
    .select({ recent: sql`count(*)::int` })
    .from(schema.kv)
    .where(and(like(schema.kv.key, `${PREFIX}%`), eq(field("from"), role), sql`${field("createdAt")} > ${new Date(now.getTime() - 3600_000).toISOString()}`));
  if (Number(recent) >= LIMITS.perHour) throw fail("That’s a lot of quizzes for one hour ♡ try again in a bit.", 429);

  const test = role === "admin" && (await testMode(db, now)).on;
  const choices = data.choices.map((c, index) => ({ id: CHOICE_IDS[index], emoji: c.emoji, text: c.text }));
  const quiz = {
    id: randomUUID(),
    clientId: data.clientId,
    from: role,
    to: other(role),
    mode: data.mode,
    question: data.question,
    image: data.image,
    choices,
    answer: CHOICE_IDS[data.answer],
    test,
    createdAt: now.toISOString(),
    reply: null,
    result: null,
    seenAt: null,
  };
  await db.insert(schema.kv).values({ key: keyOf(quiz.id), value: quiz, updatedAt: now });

  const fromName = (await names(db))[role];
  await after(() =>
    send(db, quizNotification(quiz, fromName, { test }), { role: test ? "admin" : quiz.to, ttlSeconds: 24 * 3600 }).catch(() => null),
  );
  return shape(quiz, role);
}

const resultOf = (quiz, choice) =>
  quiz.mode === "me" ? (choice === quiz.answer ? "right" : "wrong") : choice === quiz.answer ? "match" : "differ";

/**
 * `role` answers a quiz. Answering twice with the same pick is harmless (a retry); a different
 * pick after the first is refused. Returns the quiz with its answer revealed.
 */
export async function answerQuiz(db, role, id, input, { now = new Date(), after = (task) => task(), send = sendToSubscribers } = {}) {
  const pick = z.object({ choice: z.enum(CHOICE_IDS) }).strict().safeParse(input);
  if (!pick.success) throw fail("Pick one of the answers.");
  const quiz = await readQuiz(db, id);
  if (!quiz || (quiz.test && role !== "admin")) throw fail("That quiz isn’t here any more.", 404);
  const { choice } = pick.data;
  if (!quiz.choices.some((c) => c.id === choice)) throw fail("Pick one of the answers.");
  if (quiz.reply) {
    if ((quiz.to === role || quiz.test) && quiz.reply.choice === choice) return shape(quiz, role);
    throw fail("You’ve already answered this one ♡", 409);
  }
  if (!canAnswer(role, quiz)) throw fail("This one is for the other one to answer ♡", 403);

  const answered = {
    ...quiz,
    reply: { choice, at: now.toISOString() },
    result: resultOf(quiz, choice),
    // Josh answering his own test quiz has seen the result already.
    seenAt: quiz.test ? now.toISOString() : null,
  };

  // Test mode, and this is one of hers: Josh sees the reveal, but nothing is saved or sent to her.
  if (role === "admin" && !quiz.test && (await testMode(db, now)).on) return { ...shape(answered, role), dryRun: true };

  const [row] = await db
    .update(schema.kv)
    .set({ value: answered, updatedAt: now })
    .where(and(eq(schema.kv.key, keyOf(id)), sql`(${schema.kv.value}->>'reply') IS NULL`))
    .returning({ value: schema.kv.value });
  if (!row) {
    // Answered on another device a moment ago.
    const latest = await readQuiz(db, id);
    if (latest?.reply?.choice === choice) return shape(latest, role);
    throw fail("You’ve already answered this one ♡", 409);
  }
  if (!quiz.test) {
    const byName = (await names(db))[role];
    await after(() => send(db, answerNotification(answered, byName), { role: quiz.from, ttlSeconds: 24 * 3600 }).catch(() => null));
  }
  return shape(row.value, role);
}

/** The sender has looked at the result (clears its "new" mark). */
export async function markSeen(db, role, id, { now = new Date() } = {}) {
  const quiz = await readQuiz(db, id);
  if (!quiz || quiz.from !== role || !quiz.reply) return false;
  if (quiz.seenAt) return true;
  await db
    .update(schema.kv)
    .set({ value: { ...quiz, seenAt: now.toISOString() }, updatedAt: now })
    .where(and(eq(schema.kv.key, keyOf(id)), sql`(${schema.kv.value}->>'seenAt') IS NULL`));
  return true;
}

/** The sender takes back a quiz that hasn't been answered yet (a test one, any time). */
export async function deleteQuiz(db, role, id) {
  const quiz = await readQuiz(db, id);
  if (!quiz || quiz.from !== role) return false;
  if (quiz.reply && !quiz.test) throw fail("It’s been answered, so it stays in your history ♡", 409);
  await db.delete(schema.kv).where(eq(schema.kv.key, keyOf(id)));
  return true;
}
