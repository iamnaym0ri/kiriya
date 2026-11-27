// The secret word's rules and its built-in word tin. Plain JS with no imports, shared by the game
// and the server (server/lib/secretWord.js), so both agree on today's word when Josh hasn't picked one.

export const WORD_LENGTH = 5;
export const MAX_TRIES = 6;
export const NOTE_MAX = 140;

// The word tin: sweet five-letter words for the days Josh hasn't picked one. Every one is in the
// guess dictionary except the three snacks at the end, which the game accepts as guesses anyway.
export const WORD_TIN = [
  "heart", "sweet", "honey", "bunny", "kitty", "lilac", "peach", "dream", "smile", "adore",
  "angel", "bloom", "petal", "daisy", "tulip", "candy", "berry", "cream", "sugar", "charm",
  "fairy", "dance", "music", "stars", "light", "plush", "teddy", "pearl", "jewel", "crown",
  "tiara", "lucky", "happy", "sunny", "magic", "spark", "shine", "blush", "cutie", "lover",
  "ocean", "waves", "cloud", "lunar", "comet", "mango", "lemon", "melon", "apple", "grape",
  "toast", "jelly", "fudge", "latte", "piano", "lyric", "stage", "twirl", "frill", "satin",
  "silky", "roses", "lotus", "poppy", "herbs", "tonic", "quilt", "linen", "laces", "pinky",
  "dolly", "bijou", "amour", "belle", "laugh", "merry", "jolly", "fancy", "gleam", "glint",
  "shiny", "misty", "frost", "snowy", "flake", "scarf", "skirt", "dress", "tutus", "poise",
  "grace", "swirl", "curls", "braid", "paint", "brush", "easel", "diary", "poems", "rhyme",
  "songs", "choir", "flute", "otter", "panda", "koala", "puppy", "robin", "finch", "swans",
  "doves", "pasta", "sushi", "bagel", "scone", "crepe", "donut", "cocoa", "syrup", "maple",
  "mints", "spice", "treat", "beach", "shore", "today", "yours", "hello", "leeks", "voice",
  "synth", "tempo", "lacey", "plums", "peony", "fluff", "sprig", "bliss", "adorn", "wings",
  "plume", "swoon", "crush", "hazel", "amber", "ivory", "coral", "topaz", "mochi", "ramen",
  "bento",
];

export const normalizeWord = (word) => String(word ?? "").trim().toLowerCase();
export const isFiveLetters = (word) => /^[a-z]{5}$/.test(word);
export const isDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));

/** Whole days from 2026-01-01 to `day` (YYYY-MM-DD). */
export function dayNumber(day) {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse("2026-01-01T00:00:00Z")) / 86_400_000);
}
export function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Her calendar is Singapore's (the server's `localDay()` uses the same zone). */
export function singaporeDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The tin is walked in a fixed shuffled order, so a word doesn't come back for months.
function tinOrder() {
  let seed = 0x5eed2611;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = WORD_TIN.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const ORDER = tinOrder();
export function tinWord(day) {
  const n = ((dayNumber(day) % ORDER.length) + ORDER.length) % ORDER.length;
  return WORD_TIN[ORDER[n]];
}

/**
 * How each letter of a guess compares with the answer: "hit" (right place), "near" (in the word,
 * another place) or "miss". Repeated letters count only as often as the answer has them, hits first.
 */
export function scoreGuess(guess, answer) {
  const result = Array(guess.length).fill("miss");
  const left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = "hit";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "hit") continue;
    if (left[guess[i]] > 0) {
      result[i] = "near";
      left[guess[i]] -= 1;
    }
  }
  return result;
}

const RANK = { miss: 1, near: 2, hit: 3 };
/** The best thing known about each letter so far, for the keyboard. */
export function letterStates(guesses, answer) {
  const states = {};
  for (const guess of guesses) {
    scoreGuess(guess, answer).forEach((state, i) => {
      const letter = guess[i];
      if (!states[letter] || RANK[state] > RANK[states[letter]]) states[letter] = state;
    });
  }
  return states;
}

export function wordStatus(guesses, answer) {
  if (guesses.includes(answer)) return "won";
  return guesses.length >= MAX_TRIES ? "lost" : "playing";
}

/** Days solved in a row, ending today (or yesterday, if today isn't solved yet). */
export function solvedStreak(results, today) {
  let day = results[today]?.status === "won" ? today : addDays(today, -1);
  let streak = 0;
  while (results[day]?.status === "won") {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
