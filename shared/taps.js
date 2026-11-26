// One-tap "thinking of you" messages (2026-11-24). Sent from the chat, the Home Screen widget, the
// icon's quick actions or a notification, without typing anything. `{from}` is the sender's name.
// `kaomoji` and `note` make the notification's second line (and the widget shows the same kaomoji);
// each signal plays its own sound on the phone (SignalsWidget-<key>.caf, server/push/apns.js).
export const TAPS = Object.freeze([
  { key: "thinking", emoji: "♡", kaomoji: "(˘︶˘)♡", label: "thinking of you", push: "{from} is thinking of you ♡", note: "right now, and always" },
  { key: "hug", emoji: "🫂", kaomoji: "(っ´▽`)っ", label: "a big hug", push: "{from} sent you a big hug 🫂", note: "a long, warm squeeze" },
  { key: "kiss", emoji: "😘", kaomoji: "(˘ ³˘)♥", label: "a kiss", push: "{from} sent you a kiss 😘", note: "mwah" },
  { key: "morning", emoji: "☀️", kaomoji: "(＾▽＾)ノ", label: "good morning", push: "good morning from {from} ☀️", note: "have the loveliest day" },
  { key: "night", emoji: "🌙", kaomoji: "(－ω－)zZ", label: "goodnight", push: "goodnight from {from} 🌙", note: "sleep well, sweet dreams" },
  { key: "miss", emoji: "🥺", kaomoji: "(｡•︿•｡)", label: "miss you", push: "{from} misses you 🥺", note: "wish you were here" },
  { key: "water", emoji: "💧", kaomoji: "(˘▽˘)っ旦", label: "drink some water", push: "{from} says: drink some water 💧", note: "a little sip, for me?" },
]);
export const tapByKey = Object.fromEntries(TAPS.map((tap) => [tap.key, tap]));
