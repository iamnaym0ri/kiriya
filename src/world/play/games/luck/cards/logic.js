// Higher or lower with the lilac deck: pure rules, tested in scripts/test-games-luck.mjs.
// Generous: a card of the same number counts as a right guess.
import { shuffle } from "../_kit/random.js";

export const SUITS = ["heart", "star", "moon", "flower"];
export const RANKS = Array.from({ length: 13 }, (_, i) => i + 1);
export const MILESTONES = [
  { streak: 5, sticker: "st-card", reason: "lilac cards: a streak of 5" },
  { streak: 10, sticker: "st-mirror", reason: "lilac cards: a streak of 10" },
];

export function newDeck(rng = Math.random, without = null) {
  const cards = SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${suit}-${rank}`, suit, rank })));
  return shuffle(without ? cards.filter((card) => card.id !== without.id) : cards, rng);
}

export function judge(current, next, guess) {
  if (next.rank === current.rank) return "same";
  const higher = next.rank > current.rank;
  return (guess === "higher") === higher ? "right" : "wrong";
}

/** How many of the cards still in the deck are higher, lower or the same as `current`. */
export function chances(current, deck) {
  let higher = 0;
  let lower = 0;
  let same = 0;
  for (const card of deck) {
    if (card.rank > current.rank) higher++;
    else if (card.rank < current.rank) lower++;
    else same++;
  }
  return { higher, lower, same };
}

export function newGame(rng = Math.random) {
  const deck = newDeck(rng);
  return { deck: deck.slice(1), current: deck[0], streak: 0, last: null, turns: 0, fresh: false };
}

/** One guess: the next card turns over and becomes the current card. */
export function guessTurn(state, guess, rng = Math.random) {
  if (guess !== "higher" && guess !== "lower") return state;
  let deck = state.deck;
  let fresh = false;
  if (!deck.length) {
    deck = newDeck(rng, state.current);
    fresh = true;
  }
  const [next, ...rest] = deck;
  const result = judge(state.current, next, guess);
  const streak = result === "wrong" ? 0 : state.streak + 1;
  return {
    deck: rest,
    current: next,
    streak,
    last: { guess, result, from: state.current, card: next, streakBefore: state.streak },
    turns: state.turns + 1,
    fresh,
  };
}
