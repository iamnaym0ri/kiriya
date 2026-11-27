// Picking what a character says. No line repeats within a topic until the whole topic has been
// heard, and the topic for a greeting follows the hour (README.md, "Lines").

/** Shuffled decks per topic; `pick(topic)` returns a line object or null if the topic is empty. */
export function createLinePicker(lines, random = Math.random) {
  const decks = new Map();
  const last = new Map();
  return (topic) => {
    const pool = lines[topic];
    if (!pool?.length) return null;
    let deck = decks.get(topic);
    if (!deck?.length) {
      deck = [...pool];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      // Never the same line twice in a row across a reshuffle.
      if (deck.length > 1 && deck.at(-1) === last.get(topic)) [deck[0], deck[deck.length - 1]] = [deck.at(-1), deck[0]];
      decks.set(topic, deck);
    }
    const line = deck.pop();
    last.set(topic, line);
    return line;
  };
}

/** The greeting topic for this hour, most specific first. */
export function greetTopics(date = new Date(), { birthday = false } = {}) {
  const h = date.getHours();
  const hour = h >= 5 && h < 11 ? "greetMorning" : h >= 11 && h < 17 ? "greetAfternoon" : h >= 17 && h < 22 ? "greetEvening" : "greetNight";
  return birthday ? ["birthday", hour, "greet"] : [hour, "greet"];
}

/** Lines are written with {name} where her name goes. */
export const fillName = (text, name) => String(text ?? "").replace(/\{name\}/g, name || "you");

/** How long a bubble stays up: long enough to read twice, never a wall. */
export const readMs = (text) => Math.min(8200, Math.max(2600, 1500 + String(text ?? "").length * 62));
