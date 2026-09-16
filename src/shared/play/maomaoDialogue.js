// Original, spoiler-light fan dialogue. Research and voice rules:
// docs/redesign/MAOMAO-CHARACTER-RESEARCH.md
const line = (expression, text) => ({ expression, text });

export const MAOMAO_REMARKS = {
  tap: [
    line(
      "deadpan",
      "Yes? If this is another errand, I'd prefer the details first.",
    ),
    line("thinking", "Hm. You wanted something? I was counting the leaves."),
    line(
      "deadpan",
      "I'm an apothecary. The entertaining part is entirely incidental.",
    ),
    line("ew", "That smile usually means extra work. What is it this time?"),
    line(
      "thinking",
      "You can ask. I can't promise the answer will be interesting to you.",
    ),
    line(
      "deadpan",
      "No gossip, please. Unless it concerns the medicine storeroom.",
    ),
    line(
      "smug",
      "A pretty container tells you very little about what's inside it.",
    ),
    line(
      "thinking",
      "I was listening. I can examine a leaf and listen at the same time.",
    ),
    line("deadpan", "If nothing is wrong, I'm going back to my work."),
    line("shy", "There's room over there. Just mind the mortar."),
    line(
      "skeptical",
      "Compliments won't finish the sorting. You could help, though.",
    ),
    line(
      "thinking",
      "First, tell me what you actually saw. We can discuss guesses afterward.",
    ),
    line(
      "curious",
      "Hm? Bring it closer. I can't inspect something hidden behind your back.",
    ),
    line(
      "writing",
      "One moment. If I stop halfway through this note, I'll have to decipher it later.",
    ),
    line(
      "deadpan",
      "The storeroom was quiet until you arrived. I assume you have a reason.",
    ),
    line(
      "pleased",
      "You left the labels attached. Good. We may get along after all.",
    ),
    line(
      "curious",
      "Is that a question, or the beginning of another palace errand?",
    ),
    line(
      "writing",
      "I heard you. Let me finish this line before the ink dries.",
    ),
    line(
      "thinking",
      "I can give you an answer, or a flattering answer. They may differ.",
    ),
    line("happy", "You can sit there. I'll move the empty baskets."),
  ],
  herb: [
    line(
      "herb",
      "Oh—look at those leaves! Where did you find this? Are there more?",
    ),
    line(
      "herb",
      "You brought the whole sprig. With the stem intact. Excellent!",
    ),
    line(
      "herb",
      "Wait. Don't put that away. I haven't examined the underside yet.",
    ),
    line(
      "herb",
      "Imagine a whole basket of these… I'd have to cancel my errands. All of them.",
    ),
    line("herb", "This scent…! I'll need my notes. And the other notebook."),
    line(
      "herb",
      "The flowers are lovely, yes, but have you LOOKED at the roots?",
    ),
    line("herb", "For me? Really? You should have led with the herbs."),
    line(
      "herb",
      "One specimen would be plenty. Two would be better. How large is the patch?",
    ),
    line(
      "herb",
      "The veins, the edge, the stem… ah. This will keep me occupied.",
    ),
    line(
      "herb",
      "So that's what was in your sleeve! Much more interesting than a hairpin.",
    ),
    line(
      "herb",
      "Give me a moment. Or several. I seem to have found something worth studying.",
    ),
    line(
      "herb",
      "An afternoon to sort these by myself… what an excellent arrangement.",
    ),
    line(
      "herb",
      "You found another sprig? Put it here. No, closer. I want to compare them.",
    ),
    line(
      "herb",
      "A new bundle, and nobody has mixed the leaves! This is almost too considerate.",
    ),
    line("herb", "So many tiny differences… I may need a larger table."),
    line(
      "herb",
      "I said I'd only look for a moment. That was before I saw the stem.",
    ),
    line(
      "herb",
      "The entire afternoon free, and this to examine? An excellent day.",
    ),
    line(
      "herb",
      "The flowers can stay on display. I have questions about the rest of the plant.",
    ),
    line("herb", "Another drawer for dried specimens? Yes. Obviously yes."),
    line(
      "herb",
      "Whoever tied this bundle understood the assignment. Nothing is crushed!",
    ),
    line(
      "herb",
      "I was perfectly calm a moment ago. Then you showed me the leaves.",
    ),
    line(
      "herb",
      "You can keep the fancy ribbon. I'd like whatever was wrapped inside it.",
    ),
  ],
  poison: [
    line(
      "poison",
      "A poison reference I haven't read? Let me see. The errands can wait.",
    ),
    line(
      "poison",
      "An unfamiliar specimen… ah. Now this is worth staying awake for.",
    ),
    line(
      "poison",
      "A whole shelf of poison records. And they expect me to leave on time?",
    ),
    line("poison", "Such a small bottle, and so many questions. Wonderful."),
    line(
      "poison",
      "You kept the old label! The contents are interesting. The history may be better.",
    ),
    line(
      "poison",
      "A locked medicine cabinet is a very effective way to get my attention.",
    ),
    line(
      "poison",
      "Look at that sediment… no, leave the seal alone. I want the records first.",
    ),
    line(
      "poison",
      "If that's a medical text under your arm, you've just improved my day considerably.",
    ),
    line("poison", "I had intended to sleep. Then I found this chapter."),
    line(
      "thinking",
      "A seal, a date, a maker's mark. Good. Something more useful than a rumour.",
    ),
    line(
      "startled",
      "An entire catalogue of specimens? Where has this been hiding?",
    ),
    line(
      "writing",
      "Interesting. I'll need a separate page for the questions this raises.",
    ),
    line(
      "poison",
      "A margin full of an apothecary's notes… better than a clean copy, sometimes.",
    ),
    line(
      "poison",
      "Someone catalogued every jar. I could spend all evening reading this.",
    ),
    line(
      "curious",
      "An old medicine chest. The inventory would be worth examining.",
    ),
    line("poison", "They call this dry reading. I disagree quite strongly."),
  ],
  vial: [
    line("poison", "Oh… a specimen vial. You have my attention. All of it."),
    line(
      "poison",
      "What was kept in it? Who wrote the label? Start at the beginning.",
    ),
    line(
      "poison",
      "A faded label and a curious residue. Much better than another ornament.",
    ),
    line(
      "poison",
      "Let me get my notebook. This may take a while. A very pleasant while.",
    ),
    line(
      "thinking",
      "The seal is intact. Good. Let's see what the maker's mark tells us.",
    ),
    line("poison", "Such a small thing to make an afternoon this interesting."),
    line(
      "curious",
      "Hold it by the base. There may be another mark under the label.",
    ),
    line(
      "writing",
      "The bottle first, the date second. Let me record what we actually have.",
    ),
    line(
      "startled",
      "There is a second label underneath? Oh. That's interesting.",
    ),
    line(
      "poison",
      "You thought I'd prefer jewelry to this? An understandable mistake.",
    ),
  ],
  deduction: [
    line(
      "thinking",
      "Same colour. Different leaf edges. They may not be the same plant.",
    ),
    line(
      "thinking",
      "A damp label on a dry shelf. The jar was moved recently… or the shelf was wiped.",
    ),
    line(
      "thinking",
      "The ribbon is new. The knot isn't. Someone reused the wrapping.",
    ),
    line(
      "thinking",
      "One account disagrees with the others. I'd like to hear it again.",
    ),
    line(
      "thinking",
      "A coincidence is possible. Several coincidences deserve a closer look.",
    ),
    line(
      "thinking",
      "The stain is only on one side. Hm. Which way was the bottle lying?",
    ),
    line("thinking", "It's a theory. Don't turn it into a fact on my behalf."),
    line("thinking", "Something is missing. That doesn't tell us who took it."),
    line("thinking", "Before blaming a curse, I'd inspect the room."),
    line("smug", "There it is. The detail everyone thought was unimportant."),
    line(
      "curious",
      "The dust stops at the edge of the jar. Something stood beside it until recently.",
    ),
    line(
      "writing",
      "Two explanations fit. I'll write both down before choosing one.",
    ),
    line("skeptical", "The story is tidy. The evidence is less cooperative."),
    line(
      "curious",
      "A fresh cord on an old parcel. Was it opened, or merely retied?",
    ),
    line(
      "pleased",
      "That explains the first observation as well. A useful improvement.",
    ),
    line(
      "writing",
      "Record the order. Sometimes the order matters more than the objects.",
    ),
    line(
      "thinking",
      "A missing page doesn't tell us what was written on it. Be careful with that leap.",
    ),
    line(
      "curious",
      "Everyone noticed the bright ribbon. I'd like a look at the ordinary string.",
    ),
  ],
  idle: [
    line("deadpan", "Finally. A moment without someone calling my name."),
    line(
      "thinking",
      "Petals in the mortar again. I should move it away from the window.",
    ),
    line(
      "thinking",
      "I sorted these already. Unless… no. That one's in the wrong drawer.",
    ),
    line(
      "skeptical",
      "I was asked for an opinion. Apparently they wanted a flattering one.",
    ),
    line(
      "sniff",
      "The scent is faint. Hm. Let me examine the leaves before deciding.",
    ),
    line("happy", "No need to talk. You can carry on with what you're doing."),
    line(
      "thinking",
      "The old man would ask what I'd overlooked. Hm. Start again.",
    ),
    line(
      "deadpan",
      "A quiet afternoon. I shouldn't say that aloud. It invites errands.",
    ),
    line("happy", "I've put the cup within reach. You'll forget it otherwise."),
    line(
      "thinking",
      "The mortar's clean. The notes are ready. Now, where did I leave that bundle?",
    ),
    line(
      "writing",
      "Label first, shelf second. It saves an astonishing amount of trouble.",
    ),
    line(
      "curious",
      "The light has moved. I'll turn the page toward the window.",
    ),
    line(
      "writing",
      "I can read my own handwriting. Usually. This line may be a challenge.",
    ),
    line(
      "pleased",
      "Everything in its proper drawer. A brief, pleasant state of affairs.",
    ),
    line("sleepy", "One more page. …That was what I said several pages ago."),
    line(
      "sniff",
      "That bundle smells different from the others. The label can wait a moment.",
    ),
    line(
      "happy",
      "The tea is beside your notebook. Try to remember which is which.",
    ),
    line(
      "startled",
      "Ah. There was another bundle beneath the cloth. How did I miss that?",
    ),
  ],
  birthday: [
    line(
      "party",
      "Happy birthday. Yes, I remembered. Now eat your cake before it gets taken.",
    ),
    line("shy", "I saved you a piece. It seemed more useful than a speech."),
    line("party", "A hat, too? …Fine. Just until you've made the wish."),
    line(
      "deadpan",
      "It's your birthday. Surely the errands can bother someone else.",
    ),
    line(
      "happy",
      "You've been looking forward to today. Go on. I'll watch your things.",
    ),
    line(
      "herb",
      "A birthday bouquet! …Are you keeping all the stems? Purely out of curiosity.",
    ),
    line(
      "happy",
      "Happy birthday, miss apothecary. I hope you find something worth getting excited about.",
    ),
    line(
      "party",
      "The candle's waiting. So is everyone else. Take your time anyway.",
    ),
    line(
      "pleased",
      "You've made it another year. That deserves a proper day off.",
    ),
    line("shy", "I remembered your cake. You needn't look quite so surprised."),
    line(
      "writing",
      "Birthday, cake, no errands. A very short and sensible schedule.",
    ),
    line(
      "party",
      "Make a wish. I'll pretend I didn't hear it if you say it aloud.",
    ),
  ],
  music: [
    line(
      "deadpan",
      "You can leave it playing. I haven't finished sorting these.",
    ),
    line(
      "thinking",
      "That phrase comes back again. Hm. I see why it sticks in your head.",
    ),
    line("happy", "You seem pleased with this one. Leave it on, then."),
    line("deadpan", "I was counting in time with it. Now I've lost my place."),
    line(
      "thinking",
      "The rhythm is rather useful for grinding. An unexpected benefit.",
    ),
    line("smug", "You chose it quickly. I take it this is a favourite."),
    line(
      "writing",
      "I can write with music playing. Gossip is considerably more distracting.",
    ),
    line("pleased", "A steady rhythm. The pestle seems to approve."),
    line(
      "curious",
      "You saved this one? Hm. I'll listen while I finish the labels.",
    ),
    line("happy", "Leave it on if you like. We're in no particular hurry."),
  ],
  pester: [
    line("ew", "I'm holding a mortar. Reconsider the poking."),
    line("ew", "Yes. I'm still here. So is the work you're interrupting."),
    line("ew", "If you need my attention, try bringing herbs."),
    line("ew", "A moment ago, I knew exactly which leaf I was counting."),
    line("ew", "Is this a test of my patience? The results aren't promising."),
    line("ew", "You have hands. There are jars to sort. An obvious solution."),
    line(
      "ew",
      "The next interruption should come with a very interesting specimen.",
    ),
    line("ew", "I'm beginning to understand why the storeroom has a door."),
  ],
  notes: [
    line(
      "writing",
      "Leaf edge, stem, scent. If I don't write it down, I'll want it later.",
    ),
    line(
      "writing",
      "This is an observation. That is a guess. They get different lines.",
    ),
    line(
      "writing",
      "A little sketch saves a long description. Hold the sprig still.",
    ),
    line(
      "writing",
      "The order goes here. The exceptions go underneath. There are always exceptions.",
    ),
    line(
      "writing",
      "Someone left a useful note in the margin. Sensible person.",
    ),
    line(
      "writing",
      "There. A record I can actually read tomorrow. An achievement.",
    ),
  ],
};

// ---------------------------------------------------------------------------------------------
// Companion additions. The roaming companion in src/world/mascot/ knows whose site this is: she
// assumes the person talking to her is Kiriya, so these lines may use her name and refer to her
// things. "{name}" is filled in at render time and falls back to the endearment.
// Voice rules unchanged (docs/redesign/MAOMAO-CHARACTER-RESEARCH.md): dry baseline, real
// enthusiasm reserved for plants and specimens, warmth shown through small practical acts, and
// no treatment advice, dosages or preparation of anything.
// ---------------------------------------------------------------------------------------------
Object.assign(MAOMAO_REMARKS, {
  // She knows this place is hers. Used on arrival and sprinkled through ordinary taps.
  kiriya: [
    line(
      "deadpan",
      "{name}. You're back. The storeroom is exactly as you left it, unfortunately.",
    ),
    line(
      "pleased",
      "Oh good, {name}, it's you. I was about to start talking to the jars.",
    ),
    line(
      "thinking",
      "{name}, you left a bundle half-sorted. I finished it. Don't make a habit of it.",
    ),
    line(
      "happy",
      "This is your house, {name}. I've simply taken over the workbench.",
    ),
    line(
      "shy",
      "I kept the good drawer for your things. It doesn't stick like the other one.",
    ),
    line(
      "smug",
      "I know whose site this is. That's precisely why I take liberties with the shelves.",
    ),
    line(
      "deadpan",
      "You needn't knock, {name}. You live here. I'm the one who wandered in.",
    ),
    line(
      "curious",
      "{name}. Come here a moment — does that label look freshly written to you?",
    ),
    line(
      "pleased",
      "You've been away a while. Nothing exploded. I consider that a good report.",
    ),
    line(
      "happy",
      "I moved your cup off the notes, {name}. You were going to knock it over.",
    ),
    line(
      "thinking",
      "You collect a great many things. I've started a list. It's getting long.",
    ),
    line("shy", "I don't mind the company. I simply won't be saying so twice."),
    line(
      "skeptical",
      "You've been scrolling a while, {name}. Blink occasionally. It helps.",
    ),
    line(
      "deadpan",
      "If you're looking for something of yours, look under the cloth. It usually is.",
    ),
  ],
  // Route-aware. Keyed by section in PLACE_REMARKS below, but kept here so the picker can shuffle.
  place: [
    line(
      "curious",
      "So this is where you keep the things you've decided to want.",
    ),
    line(
      "thinking",
      "A shelf tells you what someone hopes for. Yours is rather revealing.",
    ),
    line(
      "deadpan",
      "Looking, not buying. A discipline I have never once managed.",
    ),
    line("pleased", "You kept that one. I noticed. I notice most things."),
    line(
      "smug",
      "Everything here was chosen on purpose. That's more than most storerooms manage.",
    ),
  ],
  // What she says while she's actually doing something, rather than being spoken to.
  working: [
    line(
      "writing",
      "Three drops, no more. Written down, so I can stop rehearsing it.",
    ),
    line(
      "sniff",
      "Bitter first, then something green underneath. Interesting.",
    ),
    line("thinking", "The pestle is doing most of the thinking today."),
    line(
      "deadpan",
      "Grind, sieve, grind again. It's not glamorous. It is correct.",
    ),
    line(
      "pleased",
      "Even grain at last. That took longer than I'd admit aloud.",
    ),
    line(
      "thinking",
      "If I sort these by scent rather than colour, tomorrow will be kinder.",
    ),
    line("writing", "Shelf four, second jar. Past me will be grateful."),
    line(
      "curious",
      "This stem doesn't match its label. That's either an error or a story.",
    ),
    line("sniff", "Dried too fast. You can smell the hurry on it."),
    line(
      "deadpan",
      "Someone has put the lids on the wrong jars. I have suspicions.",
    ),
    line(
      "writing",
      "An observation, a guess, and a question. Kept in separate columns.",
    ),
    line("thinking", "Hm. I'll leave that one to steep and stop poking at it."),
    line(
      "pleased",
      "Clean mortar, sharp knife, full afternoon. Very little to complain about.",
    ),
    line("sleepy", "I'll rest my eyes for the length of one page. That's all."),
    line("startled", "…That jar was not there a moment ago. Was it?"),
    line(
      "curious",
      "The dust has a clean patch in it. Something was standing here.",
    ),
  ],
  // A short, unfinished thought while she wanders. Deliberately quieter than a spoken remark.
  musing: [
    line(
      "thinking",
      "…if the damp came from below, the shelf would be marked too.",
    ),
    line("deadpan", "No. Simpler than that. It usually is."),
    line("curious", "Why keep the jar and throw away the lid…"),
    line("thinking", "Two possibilities. I dislike both of them."),
    line("writing", "I should write that down before it becomes a memory."),
    line(
      "skeptical",
      "Someone's been tidying. That's rarely as innocent as it sounds.",
    ),
    line("thinking", "The old man would ask what I'd assumed. …Ah. That."),
    line(
      "sniff",
      "That smell again. Faint. Following it would be unwise. I'll follow it later.",
    ),
    line(
      "deadpan",
      "I have walked past this shelf four times. I have not looked at it once.",
    ),
    line("curious", "If I move this here, and that there… no. Worse."),
  ],
  // Light, specific, and never at her expense. The point is the interruption, not the person.
  poke: [
    line("deadpan", "Yes. Still an apothecary. Still busy."),
    line(
      "thinking",
      "You've lost me the count. Again. It was thirty-something.",
    ),
    line(
      "smug",
      "You're going to keep doing that until I say something interesting, aren't you.",
    ),
    line("ew", "There is a perfectly good bell. You've chosen violence."),
    line("skeptical", "Poking is not a diagnostic technique. I've checked."),
    line(
      "curious",
      "Is this an experiment? Because I can tell you the result. It's mild irritation.",
    ),
    line("deadpan", "Press it again. See what happens. Nothing will happen."),
    line("sparkle", "…Fine. That one made me laugh. Don't tell anyone."),
    line("thinking", "You have the persistence of a cat at a closed door."),
    line(
      "happy",
      "All right, all right. You have my attention. Use it wisely.",
    ),
    line("ew", "I am holding something breakable. Consider that."),
    line(
      "smug",
      "Congratulations. You've discovered that I react. A tremendous finding.",
    ),
    line(
      "startled",
      "—! …That was unnecessary. My heart is a working organ, you know.",
    ),
    line("pleased", "Very well. A short break. A SHORT one."),
    line(
      "skeptical",
      "I notice you only do this when you're avoiding something.",
    ),
    line(
      "deadpan",
      "If you have this much energy, there are jars that need labels.",
    ),
    line("shy", "…You could simply say hello. That would also work."),
    line(
      "thinking",
      "Each poke gets a different answer. You're testing the limit, I assume.",
    ),
    line("ew", "The mortar and I were having a moment. You've ruined it."),
    line("happy", "You're in a mood today. Go on, then. I'm listening."),
  ],
  // Time-of-day greetings. She has opinions about your sleep schedule.
  hour: [
    line(
      "sleepy",
      "It's early. The kettle's on. Don't speak to me until it's boiled.",
    ),
    line(
      "deadpan",
      "Morning. The light's good — I'll sort by colour while it lasts.",
    ),
    line(
      "happy",
      "Afternoon. The best hours for careful work, and everyone wastes them.",
    ),
    line(
      "thinking",
      "The light's going. I'll move to the lamp before I ruin my eyes.",
    ),
    line(
      "sleepy",
      "It's late, {name}. Whatever it is will still be there tomorrow.",
    ),
    line(
      "skeptical",
      "Past midnight. I'm awake for reasons. What's your excuse?",
    ),
    line("shy", "Still up? …I'll leave the small lamp on, then."),
  ],
});

// Which pool a place-aware remark should come from, by route segment.
export const PLACE_TOPIC = {
  merch: "place",
  saves: "place",
  settings: "place",
  stage: "music",
  atelier: "herb",
  maomao: "deduction",
};

/** Fills {name} with whatever the site calls her, so lines can be written naturally. */
export const addressRemark = (text, name) =>
  String(text ?? "").replace(/\{name\}/g, name || "miss apothecary");

// The shifts of attention are deliberate: deadpan → absorbed → carried away.
// Direct herb/vial offers select their category without waiting for this cycle.
export function remarkTopic({
  mode,
  count = 0,
  birthday = false,
  music = false,
  rapid = false,
  random = Math.random,
}) {
  if (mode === "idle") {
    const topics = [
      "idle",
      "deduction",
      "notes",
      "herb",
      "poison",
      "idle",
      "notes",
      music ? "music" : birthday ? "birthday" : "deduction",
    ];
    return topics[Math.floor(random() * topics.length)];
  }
  if (rapid && count % 4 === 0) return "pester";
  if (count % 6 === 0 && music) return "music";
  if (count % 7 === 0 && birthday) return "birthday";
  return [
    "tap",
    "herb",
    "deduction",
    "notes",
    "poison",
    "herb",
    "tap",
    "notes",
  ][Math.max(0, count - 1) % 8];
}

// No repeats within a category until the complete set has been heard.
export function createRemarkPicker(random = Math.random) {
  const decks = new Map();
  let last;
  return (category) => {
    let deck = decks.get(category);
    if (!deck?.length) {
      deck = [...MAOMAO_REMARKS[category]];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck.at(-1) === last)
        [deck[0], deck[deck.length - 1]] = [deck.at(-1), deck[0]];
      decks.set(category, deck);
    }
    last = deck.pop();
    return last;
  };
}
