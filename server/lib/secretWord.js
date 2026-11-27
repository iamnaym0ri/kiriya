import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { localDay } from "./time.js";
import {
  MAX_TRIES,
  NOTE_MAX,
  addDays,
  isDay,
  isFiveLetters,
  normalizeWord,
  solvedStreak,
  tinWord,
  wordStatus,
} from "../../src/world/play/games/brain/secret-word/words.js";

// The secret word (brain-power shelf): one five-letter word a day. Josh queues words with dates
// from his phone; a day without one takes a word from the built-in tin. Each person's guesses are
// kept so a game resumes on another device, and Josh can see how she did. Stored in `kv`.

const QUEUE = "games.secret-word.queue";
const PLAYS = "games.secret-word.plays";
const KEEP_PLAYS_DAYS = 400;
const KEEP_PAST_WORDS_DAYS = 60;
const MAX_QUEUE = 400;

export class SecretWordError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readKv(db, key, fallback) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? fallback;
}
async function writeKv(db, key, value) {
  await db
    .insert(schema.kv)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
}

const byDay = (a, b) => a.day.localeCompare(b.day);
export async function listQueue(db) {
  return [...(await readKv(db, QUEUE, []))].sort(byDay);
}

/** The puzzle for a day: Josh's word if he picked one, otherwise the tin's. */
export async function puzzleFor(db, day, queue) {
  const entry = (queue ?? (await listQueue(db))).find((item) => item.day === day);
  return entry
    ? { day, word: entry.word, by: "josh", note: entry.note || null }
    : { day, word: tinWord(day), by: "tin", note: null };
}

const resultsOf = (plays, person) => plays[person] ?? {};

/** What the game needs today: the word, who picked it, and this person's saved guesses. */
export async function todayFor(db, person, { now = new Date() } = {}) {
  const day = localDay(now);
  const [puzzle, plays] = await Promise.all([puzzleFor(db, day), readKv(db, PLAYS, {})]);
  const mine = resultsOf(plays, person);
  const play = mine[day]?.word === puzzle.word ? publicPlay(mine[day]) : null;
  return { ...puzzle, play, streak: solvedStreak(mine, day) };
}

const publicPlay = (play) => ({ guesses: play.guesses, status: play.status, at: play.at });

/**
 * Saves this person's guesses for a day (today, or yesterday for a game finished just after
 * midnight). The server scores them itself, and a finished game stays finished.
 */
export async function savePlay(db, person, { day, guesses }, { now = new Date() } = {}) {
  const today = localDay(now);
  if (!isDay(day) || (day !== today && day !== addDays(today, -1)))
    throw new SecretWordError("old_day", "That day’s word has gone back in the tin.");
  const words = (Array.isArray(guesses) ? guesses : []).map(normalizeWord);
  if (!words.length || words.length > MAX_TRIES || !words.every(isFiveLetters))
    throw new SecretWordError("bad_guesses", "Those guesses couldn’t be saved.");
  const { word } = await puzzleFor(db, day);
  const solvedAt = words.indexOf(word);
  if (solvedAt !== -1 && solvedAt !== words.length - 1)
    throw new SecretWordError("bad_guesses", "Those guesses couldn’t be saved.");

  const plays = await readKv(db, PLAYS, {});
  const mine = { ...resultsOf(plays, person) };
  const saved = mine[day]?.word === word ? mine[day] : null;
  if (saved && saved.status !== "playing") return publicPlay(saved);
  if (saved && (words.length < saved.guesses.length || saved.guesses.some((g, i) => g !== words[i])))
    return publicPlay(saved); // an older copy of the game arrived late: keep the longer one
  mine[day] = { word, guesses: words, status: wordStatus(words, word), at: now.toISOString() };
  const oldest = addDays(today, -KEEP_PLAYS_DAYS);
  for (const key of Object.keys(mine)) if (key < oldest) delete mine[key];
  await writeKv(db, PLAYS, { ...plays, [person]: mine });
  return publicPlay(mine[day]);
}

function cleanEntry({ word, day, note }) {
  const clean = {};
  if (word !== undefined) {
    clean.word = normalizeWord(word);
    if (!isFiveLetters(clean.word)) throw new SecretWordError("bad_word", "A secret word is five letters, a to z.");
  }
  if (day !== undefined) {
    if (!isDay(day)) throw new SecretWordError("bad_day", "Pick a day for this word.");
    clean.day = day;
  }
  if (note !== undefined) {
    clean.note = String(note ?? "").trim();
    if (clean.note.length > NOTE_MAX) throw new SecretWordError("bad_note", `A note can be up to ${NOTE_MAX} characters.`);
  }
  return clean;
}

/** The first day from tomorrow that has no word yet. */
export function nextFreeDay(queue, today) {
  const taken = new Set(queue.map((item) => item.day));
  let day = addDays(today, 1);
  while (taken.has(day)) day = addDays(day, 1);
  return day;
}

async function saveQueue(db, queue, today) {
  const oldest = addDays(today, -KEEP_PAST_WORDS_DAYS);
  await writeKv(db, QUEUE, queue.filter((item) => item.day >= oldest).sort(byDay));
}

export async function addWord(db, input, { now = new Date() } = {}) {
  const today = localDay(now);
  const queue = await listQueue(db);
  if (queue.filter((item) => item.day >= today).length >= MAX_QUEUE)
    throw new SecretWordError("full", "That’s a lot of words already. Use some up first ♡");
  const clean = cleanEntry({ note: "", ...input });
  if (!clean.word) throw new SecretWordError("bad_word", "A secret word is five letters, a to z.");
  clean.day ??= nextFreeDay(queue, today);
  if (clean.day < today) throw new SecretWordError("past_day", "That day has already been.");
  if (queue.some((item) => item.day === clean.day))
    throw new SecretWordError("day_taken", "That day already has a word. Change that one instead.", 409);
  const entry = { id: randomUUID(), ...clean, addedAt: now.toISOString() };
  await saveQueue(db, [...queue, entry], today);
  return entry;
}

export async function editWord(db, id, change, { now = new Date() } = {}) {
  const today = localDay(now);
  const queue = await listQueue(db);
  const index = queue.findIndex((item) => item.id === id);
  if (index === -1) throw new SecretWordError("not_found", "That word isn’t in the queue any more.", 404);
  const clean = cleanEntry(change);
  const next = { ...queue[index], ...clean };
  if (queue[index].day < today) throw new SecretWordError("past_day", "That day has already been.");
  if (next.day < today) throw new SecretWordError("past_day", "That day has already been.");
  if (queue.some((item, i) => i !== index && item.day === next.day))
    throw new SecretWordError("day_taken", "That day already has a word. Change that one instead.", 409);
  const updated = queue.map((item, i) => (i === index ? next : item));
  await saveQueue(db, updated, today);
  return next;
}

export async function deleteWord(db, id, { now = new Date() } = {}) {
  const queue = await listQueue(db);
  if (!queue.some((item) => item.id === id)) throw new SecretWordError("not_found", "That word isn’t in the queue any more.", 404);
  await saveQueue(db, queue.filter((item) => item.id !== id), localDay(now));
  return true;
}

/** Josh's view: what's queued, what the tin will give on empty days, and how she did lately. */
export async function adminView(db, { now = new Date(), past = 10, ahead = 7 } = {}) {
  const today = localDay(now);
  const [queue, plays] = await Promise.all([listQueue(db), readKv(db, PLAYS, {})]);
  const hers = resultsOf(plays, "kiriya");
  const summary = (play, word) =>
    play && play.word === word ? { status: play.status, tries: play.guesses.length } : null;
  const recent = [];
  for (let n = 0; n <= past; n++) {
    const day = addDays(today, -n);
    const puzzle = await puzzleFor(db, day, queue);
    recent.push({ day, word: puzzle.word, by: puzzle.by, her: summary(hers[day], puzzle.word) });
  }
  const tin = [];
  for (let n = 0, day = today; tin.length < ahead && n < 60; n++, day = addDays(day, 1))
    if (!queue.some((item) => item.day === day)) tin.push({ day, word: tinWord(day) });
  return {
    today,
    nextFreeDay: nextFreeDay(queue, today),
    upcoming: queue.filter((item) => item.day >= today),
    recent,
    tin,
    herStreak: solvedStreak(hers, today),
  };
}
