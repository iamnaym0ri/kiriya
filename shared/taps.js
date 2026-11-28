// One-tap "thinking of you" messages (2026-11-24). Sent from the chat, the Home Screen widget, the
// icon's quick actions or a notification, without typing anything. `{from}` is the sender's name.
// `kaomoji` and `note` make the notification's second line (and the widget shows the same kaomoji);
// each signal plays its own sound on the phone (SignalsWidget-<key>.caf, server/push/apns.js).
//
// Each of them says it their own way (Josh, 2026-11-28): `words.admin` is what Josh's signal says on
// her phone (his own words), `words.kiriya` what hers says on his (written in the same spirit, Josh
// approved). They replace `push` / `note` for that sender; the plain `push` / `note` are the
// fallback. The notification's buttons are in the app (ios/App/App/KiriyaNotifications.swift): the
// hug's own button reads "Yess I cann" on her phone and "Hugging u tighterr" on his (`tapCategory`).
export const TAPS = Object.freeze([
  {
    key: "thinking", emoji: "♡", kaomoji: "(˘︶˘)♡", label: "thinking of you", push: "{from} is thinking of you ♡", note: "right now, and always",
    words: { admin: { note: "Cause I love you soo much!" }, kiriya: { note: "and I love u moreee🥹" } },
  },
  {
    key: "hug", emoji: "🫂", kaomoji: "(っ´▽`)っ", label: "a big hug", push: "{from} sent you a big hug 🫂", note: "a long, warm squeeze",
    words: { admin: { note: "I'm hugging u now babyy can u feel itt?" }, kiriya: { note: "squeezing u reallyy tightt, hug me backk🥺" } },
  },
  {
    key: "kiss", emoji: "😘", kaomoji: "(˘ ³˘)♥", label: "a kiss", push: "{from} sent you a kiss 😘", note: "mwah",
    words: { admin: { note: "mwaaaaaahhh" }, kiriya: { note: "mwah mwah mwahhh💋" } },
  },
  {
    key: "morning", emoji: "☀️", kaomoji: "(＾▽＾)ノ", label: "good morning", push: "good morning from {from} ☀️", note: "have the loveliest day",
    words: { admin: { push: "morning babyyy❤️", note: "sleep well hunn?" }, kiriya: { push: "good morninggg babe☀️🥰", note: "wakey wakeyy, I missed uu" } },
  },
  {
    key: "night", emoji: "🌙", kaomoji: "(－ω－)zZ", label: "goodnight", push: "goodnight from {from} 🌙", note: "sleep well, sweet dreams",
    words: { admin: { push: "goodnight my lovee❤️😌", note: "sleeep well" }, kiriya: { push: "nightyy night baby🌙", note: "dream of mee okayy?💤" } },
  },
  {
    key: "miss", emoji: "🥺", kaomoji: "(｡•︿•｡)", label: "miss you", push: "{from} misses you 🥺", note: "wish you were here",
    words: { admin: { note: "Come here babyy🥺❤️" }, kiriya: { note: "hurry back to mee🥺💕" } },
  },
  {
    key: "water", emoji: "💧", kaomoji: "(˘▽˘)っ旦", label: "drink some water", push: "{from} says: drink some water 💧", note: "a little sip, for me?",
    words: { kiriya: { note: "stay hydratedd for mee💧" } },
  },
]);
export const tapByKey = Object.fromEntries(TAPS.map((tap) => [tap.key, tap]));

/** What a signal says when `sender` ("admin" or "kiriya") sends it: { title, note }, `{from}` filled in. */
export function tapWords(tap, sender, from = "") {
  const own = tap?.words?.[sender] ?? {};
  return { title: (own.push ?? tap.push).replace("{from}", from), note: own.note ?? tap.note };
}

// Signals whose own button reads differently on Josh's phone (her signal to him) than on hers.
const OWN_BUTTON_ON_HIS_PHONE = new Set(["hug"]);

/**
 * The notification category (its buttons) for a signal `sender` sent: ♡ has just "Send one back",
 * every other signal also offers itself straight back. ios/App/App/KiriyaNotifications.swift.
 */
export function tapCategory(key, sender) {
  if (key === "thinking") return "TAP";
  const base = `TAP_${String(key).toUpperCase()}`;
  return sender === "kiriya" && OWN_BUTTON_ON_HIS_PHONE.has(key) ? `${base}_FOR_JOSH` : base;
}
