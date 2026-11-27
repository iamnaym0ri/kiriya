// What Maomao says across the board. Original lines in her voice: dry, observant, a little
// distracted by herbs and poisons. Each is { text, expression } for her face (MaomaoMascot).
const l = (expression, ...texts) => texts.map((text) => ({ text, expression }));

export const LINES = {
  "start-you": [
    ...l("deadpan", "You first. I’ll observe.", "Blossoms go first. Herbs are patient."),
    ...l("curious", "Go on, then. Show me how you think."),
  ],
  "start-mao": [
    ...l("focused", "My turn first. Don’t take it personally.", "I’ll start. A middle square is like a good mortar: useful."),
    ...l("smug", "I’m going first. It’s only fair; I was here before the board was."),
  ],
  "start-sleepy": [
    ...l("sleepy", "I was up all night grinding herbs… go easy on me.", "Mm. One game. Then a nap."),
  ],
  "start-focused": [
    ...l("focused", "No distractions. Not even the mushrooms in the corner.", "I’m paying attention this time."),
  ],
  think: [...l("thinking", "…", "Hm…", "Let me see…")],
  "you-quiet": [
    ...l("thinking", "Hm. An interesting choice.", "Noted.", "I see where you’re going. Possibly."),
    ...l("writing", "Writing that down."),
  ],
  "you-threat": [
    ...l("skeptical", "Two in a row. I’m not blind.", "That line is very obvious, you know."),
    ...l("curious", "Oh? You want that corner."),
  ],
  "you-block": [
    ...l("unimpressed", "You noticed. Annoying, but fair.", "Blocked. I’ll remember that."),
    ...l("amused", "Hm. You’re not as distracted as you look."),
  ],
  "you-fork": [
    ...l("poison", "…Two lines at once. That’s poisonous. I like it.", "A fork. Very clever. Very rude."),
    ...l("alarmed", "Wait. Both of those?"),
  ],
  "mao-quiet": [
    ...l("deadpan", "There.", "That one’s mine.", "A sprig here. For now."),
    ...l("conspiratorial", "Don’t mind me. Just tidying the shelf."),
  ],
  "mao-threat": [
    ...l("smug", "Your move. Look carefully.", "I’d be careful about that row, if I were you."),
    ...l("conspiratorial", "Something is about to happen over here."),
  ],
  "mao-block": [
    ...l("focused", "No. I saw that one coming.", "Not that square. I’m using it."),
    ...l("smug", "Blocked. Did you think I was looking at the herbs?"),
  ],
  "mao-fork": [...l("proud", "Two ways to finish. I only need one.")],
  "mao-win": [
    ...l("proud", "Three sprigs. A tidy little prescription.", "I win. Shall we call it a lesson in observation?"),
    ...l("smug", "Mine. Don’t sulk; it ruins the complexion."),
  ],
  "you-win": [
    ...l("startled", "…I wasn’t paying attention. I was thinking about mushrooms.", "Fine. You win. I’ll write it in my notes. In small letters."),
    ...l("fond", "Well played. Truly. Don’t tell anyone I said so."),
  ],
  "you-win-sleepy": [...l("sleepy", "Mm… you won? Good. Wake me for the rematch.")],
  draw: [
    ...l("deadpan", "A draw. Neither of us poisoned. Acceptable.", "Nobody wins. Like most arguments."),
    ...l("amused", "A full board and no winner. Very balanced. Very boring."),
  ],
  "draw-focused": [
    ...l("fond", "A draw against me at my best. That’s… actually impressive.", "Even when I’m concentrating. Hm. I’ll take note of you."),
  ],
  poke: [
    ...l("ew", "Don’t poke me. Poke the board.", "I’m thinking. Go away. Or don’t; it’s your turn."),
    ...l("shy", "…What?"),
  ],
};

/** A line for an event, varied by a counter so the same game doesn't repeat itself. */
export function lineFor(event, turn = 0) {
  const choices = LINES[event] ?? LINES["you-quiet"];
  return choices[Math.abs(turn) % choices.length];
}
