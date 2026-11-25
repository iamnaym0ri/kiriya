// One-tap "thinking of you" messages (2026-11-24). Sent from the chat, the Home Screen widget, the
// icon's quick actions or a notification, without typing anything. `{from}` is the sender's name.
export const TAPS = Object.freeze([
  { key: "thinking", emoji: "♡", label: "thinking of you", push: "{from} is thinking of you ♡" },
  { key: "hug", emoji: "🫂", label: "a hug", push: "{from} sent you a big hug 🫂" },
  { key: "kiss", emoji: "😘", label: "a kiss", push: "{from} sent you a kiss 😘" },
  { key: "morning", emoji: "☀️", label: "good morning", push: "good morning from {from} ☀️" },
  { key: "night", emoji: "🌙", label: "goodnight", push: "goodnight from {from} 🌙 sleep well" },
  { key: "miss", emoji: "🥺", label: "miss you", push: "{from} misses you 🥺" },
  { key: "water", emoji: "💧", label: "drink some water", push: "{from} says: drink some water 💧" },
]);
export const tapByKey = Object.fromEntries(TAPS.map((tap) => [tap.key, tap]));
