import { MAOMAO_REMARKS } from "../../../../shared/play/maomaoDialogue.js";

// Maomao's lines for the app's companion engine (docs/refactor/RENOVATION.md, "Companions").
//
// Most of her voice already lives in src/shared/play/maomaoDialogue.js, which the website's
// Maomao also uses; those pools are reused here, so the two never drift apart. What is new is what
// only the app needs: greetings by time of day, being picked up and put down on a cloud, dozing,
// the sweet things she'd never say twice, Kiriya's birthday (17 September), and visits.
//
// Voice (docs/redesign/MAOMAO-CHARACTER-RESEARCH.md): dry and short by default; real enthusiasm
// only for herbs, poisons and specimens; warmth shown through small practical acts, then
// undercut. Original lines, PG, no medical advice or doses. The reader is Kiriya; lines say {name}, which the engine fills.

const line = (expression, text) => ({ expression, text });
/** The website's pools as they are; the engine fills "{name}" with her name. */
const shared = (...topics) => topics.flatMap((topic) => MAOMAO_REMARKS[topic].map(({ expression, text }) => line(expression, text)));
const hour = (index) => line(MAOMAO_REMARKS.hour[index].expression, MAOMAO_REMARKS.hour[index].text);

export const lines = {
  // Arriving, whatever the time.
  greet: shared("kiriya"),

  greetMorning: [
    hour(0),
    hour(1),
    line("sleepy", "Morning, {name}. The kettle's on. Talk to me once it boils."),
    line("deadpan", "You're up. Good. The dew's still on the leaves, so I'm busy."),
    line("pleased", "Morning. I picked the mint before the sun got to it. You can have some."),
    line("thinking", "Early light is the honest kind. Everything looks like what it is."),
    line("fond", "Morning, {name}. Did you eat? Something, I mean. Not only tea."),
    line("unimpressed", "You looked at your phone before you sat up. I could tell from here."),
    line("happy", "Good morning. I kept the warm side of the cloud for you."),
    line("focused", "Morning. Water first. Then whatever you were about to do."),
  ],
  greetAfternoon: [
    hour(2),
    line("pleased", "There you are. I was about to start arguing with the jars."),
    line("thinking", "Afternoon, {name}. If you've had lunch, nod. If not, go."),
    line("curious", "Back already? Hm. Was it a good morning, or a long one?"),
    line("focused", "Sit a while. I'm nearly done drying these."),
    line("smug", "Afternoon. I sorted the whole shelf while you were out. Admire it."),
    line("fond", "You look like you've been busy. Rest your eyes a moment."),
    line("deadpan", "The light's good for reading labels. And for seeing you, I suppose."),
  ],
  greetEvening: [
    hour(3),
    line("pleased", "Evening, {name}. You got through the day. That counts."),
    line("fond", "Evening. I lit the lantern. It seemed like a night for it."),
    line("curious", "Tell me one good thing about today. Just one. I'll write it down."),
    line("happy", "Evening. The tea's the calming kind. You may have some."),
    line("deadpan", "You're home. The errands can wait until tomorrow. They always do."),
    line("shy", "I wasn't waiting up. I happened to be here. With the lantern lit."),
    line("focused", "Evening. Take your hair down and stop working. That's my professional opinion."),
  ],
  greetNight: [
    hour(4),
    hour(5),
    hour(6),
    line("unimpressed", "Your eyes are doing the thing they do before you fall asleep on your phone."),
    line("fond", "Go to sleep, {name}. I'll keep watch over the jars. And you."),
    line("thinking", "Sleep is the cheapest remedy there is, and you're not taking it."),
    line("sleepy", "If you're staying up, at least have a blanket. I'm not arguing about it."),
    line("deadpan", "Night owls and apothecaries. At least one of us is paid for this."),
  ],

  // Left alone: self-talk, never addressed to her. Round 2 adds more of her inner voice: polite out
  // loud and savage in brackets, the old man's rules, the big sisters' advice, money, gallows humour.
  idle: [
    ...shared("idle"),
    line("deadpan", "How thoughtful of everyone. (More work.)"),
    line("thinking", "The old man says don't guess when you can check. So. Checking."),
    line("smug", "The big sisters taught me two things: smile less, and count your change twice."),
    line("skeptical", "Is this paid work, or the other kind?"),
    line("deadpan", "If something does me in one day, I hope it's rare. At least then it's educational."),
    line("amused", "There's a cat at the medical office with my name. I wasn't consulted."),
    line("unimpressed", "Some faces are pointlessly pretty. It wastes everyone's afternoon."),
    line("conspiratorial", "Freckles, painted on. Nobody looks twice at a plain girl. That's the trick."),
    line("thinking", "Everything is a poison. The dose is the whole argument."),
    line("deadpan", "Romance is a fever with better handwriting."),
    line("curious", "That cloud over there has a damp patch. Damp patches grow interesting things."),
    line("pleased", "Quiet. No errands. Nobody pretty asking for anything. Bliss."),
  ],
  musing: shared("musing"),
  working: shared("working"),
  herb: shared("herb"),
  poison: shared("poison"),
  notes: shared("notes"),
  deduction: shared("deduction"),
  sleepy: [
    line("sleepy", "Just resting my eyes. I can hear you perfectly well."),
    line("sleepy", "Five minutes. The herbs aren't going anywhere."),
    line("sleepy", "…mm. A whole field of caterpillar fungus… no. That was a dream."),
    line("sleepy", "If anyone asks, I'm thinking. With my eyes closed."),
    line("sleepy", "The cloud is warm. That's a dangerous quality in a workplace."),
    line("sleepy", "…the red jar. Not the blue one. …mm."),
  ],

  // Tapped: the website's taps and pokes together; rapid ones may use "pester".
  tapped: shared("tap", "poke"),
  pester: shared("pester"),

  // Picked up by the scruff, and set down again.
  picked: [
    ...shared("carried"),
    line("unimpressed", "I see. We're doing the kitten thing again."),
    line("ew", "My feet are not touching anything. I'd like that noted."),
    line("alarmed", "The cloud is getting smaller. Or I'm getting higher. Neither is ideal."),
    line("deadpan", "If you drop me, I'm writing it down."),
    line("amused", "Hm. The view's better from up here, at least."),
    line("skeptical", "Is this about the mushroom? I was only looking at it."),
  ],
  putDown: [
    ...shared("landed"),
    line("deadpan", "Feet. Cloud. Good. Everything where it belongs."),
    line("unimpressed", "Thank you for the trip. I won't be booking another."),
    line("pleased", "Ah, a new spot. The light's not bad. I'll allow it."),
    line("thinking", "Now, which way was I facing… it doesn't matter. Onward."),
    line("shy", "You were careful about it. …Thank you."),
  ],

  // 17 September.
  birthday: [
    ...shared("birthday"),
    line("party", "The seventeenth of September. I wrote it in three notebooks so I couldn't forget."),
    line("shy", "Happy birthday, {name}. I dried you some flowers. Properly, so they'll keep."),
    line("party", "Another year older. In medicine, we call that a good result."),
    line("pleased", "No errands today. I've told the jars. They took it well."),
    line("herb", "I found you a four-leaf clover. I examined it thoroughly. It's very lucky."),
    line("fond", "Happy birthday. I'm glad you were born. …That's all. Eat your cake."),
  ],

  // The things she means and would rather not repeat.
  sweet: [
    line("shy", "I don't say this often. You're good company, {name}. That's all."),
    line("fond", "Of everyone who wanders in here, you're the one I don't mind."),
    line("deadpan", "You remembered a label I wrote last week. Nobody remembers my labels."),
    line("smug", "I've seen the photos. Freckles, braids, the lot. You did your research."),
    line("shy", "You wear the braids better than I do. Don't let it go to your head."),
    line("pleased", "You notice small things. It's my favourite thing about you. Don't spread it around."),
    line("fond", "When you laugh, the whole shelf sounds better. It's very distracting."),
    line("shy", "I saved you the good cushion. It's not a big deal. It is the good one, though."),
    line("thinking", "Someone made all this for you. Nobody labels things this carefully by accident."),
    line("fond", "You're worth more than my rarest herb. …I have some very rare herbs."),
    line("smug", "If anyone's unkind to you today, tell me. I know which leaves make people sneeze."),
    line("pleased", "You came back. I like it better when you do."),
    line("deadpan", "You're not a bother. If you were, I'd say so. At length."),
    line("fond", "Drink some water, {name}. I'm fond of your kidneys. And the rest of you."),
    line("shy", "I wrote your name in my notebook, under 'important'. It's a short list."),
    line("happy", "It's quieter when you're not here. I've decided I don't like it."),
  ],

  // When someone drops by, before the call-and-response.
  visit: [
    line("deadpan", "Oh. Company. Mind the mortar."),
    line("curious", "A visitor. Wipe your feet. Clouds show everything."),
    line("pleased", "Ah, you came by. Sit. Don't touch the red jars."),
    line("skeptical", "You've come a long way for a cup of tea. I'll make one anyway."),
    line("deadpan", "Hello. If you're here for gossip, I'm out."),
    line("fond", "Visitors on a quiet day. Fine. You can stay a while."),
  ],

  // Leaving after a visit to someone else's cloud.
  bye: [
    line("deadpan", "Right. The herbs won't sort themselves."),
    line("pleased", "That was pleasant. Don't tell anyone I said so."),
    line("thinking", "I've left something steeping. Probably. I should check."),
    line("fond", "I'll come by again. Keep an eye on {name} for me."),
    line("unimpressed", "If anyone asks, I was never here. I was working."),
    line("smug", "Bring something interesting next time. A rash, ideally."),
  ],

  // Extra pools the engine may use when it knows more (a song playing, an offer of an herb or a vial).
  music: shared("music"),
  vial: shared("vial"),

  // The tap menu: "show her a vial". First held up to the light…
  action: [
    line("curious", "Oh. That colour. Where did you get this? Is there more?"),
    line("curious", "Hold still. Let me see it against the light… sediment. Lovely, suspicious sediment."),
    line("sparkle", "Unlabelled? A mystery in a bottle. For me?"),
    line("curious", "Cloudy at the bottom, clear at the top. Somebody didn't shake this. Good."),
    line("herb", "A vial. For me. You do know how to make a girl's afternoon, {name}."),
    line("curious", "Glass this thin is expensive. Whoever filled it meant business."),
    line("sparkle", "Don't open it. Don't sniff it. That's my job."),
    line("curious", "Is that wax on the stopper? Someone wanted this kept shut. Interesting."),
  ],
  // …and then, having sniffed it, hugged like treasure.
  actionAfter: [
    line("poison", "This is poison. I mean that as the highest compliment."),
    line("poison", "Bitter almond, and something underneath. I'm keeping it. For research."),
    line("poison", "Mine now. For study. And possibly resale."),
    line("poison", "I could kiss it. I won't. Probably."),
    line("poison", "Nobody touch it. Nobody drink it. Nobody tell the physician."),
    line("poison", "A little drop on my arm later, just to see. …I'm joking. Mostly."),
    line("poison", "Thank you, {name}. Truly. Nobody ever brings me the good stuff."),
  ],

  // Told to stay; let go again; thinking aloud while she stays put.
  stay: [
    line("pleased", "Stay? Gladly. Let the errands find someone else."),
    line("deadpan", "Fine. I'll take root. The good herbs do."),
    line("smug", "Staying put. If anyone asks, I'm on an important break."),
    line("pleased", "An order to sit still. The palace never gave me a better one."),
    line("deadpan", "Here, then. Wake me if something poisonous wanders by."),
    line("skeptical", "I'll stay. Not because you asked. This spot has good light."),
    line("fond", "Right here, then. Where you can find me."),
    line("unimpressed", "A cat told to stay. Bold of you. …I'll allow it."),
  ],
  wander: [
    line("curious", "Free to roam? Then I'm checking the far cloud for fungus."),
    line("deadpan", "Right. Off to see what's growing where it shouldn't."),
    line("smug", "You let the cat out. Don't be surprised where she turns up."),
    line("focused", "Back to my rounds. Something out there needs labelling."),
    line("conspiratorial", "Leave granted. I'll bring back something interesting. Maybe toxic."),
    line("pleased", "Not far. The good weeds are never far."),
    line("thinking", "Hm. The light's moved. I'll follow it."),
  ],
  stayIdle: [
    line("thinking", "If I'm not going anywhere, the seeds may as well get sorted."),
    line("deadpan", "Still here. Still unpaid. Still fine."),
    line("skeptical", "Nothing to investigate. That's suspicious in itself."),
    line("focused", "Forty-one puffs on this cloud. I counted. Twice."),
    line("amused", "A cat that stays where she's put. The old man would laugh."),
    line("pleased", "Good light here. I'll dry the mugwort before anyone notices."),
    line("sleepy", "Staying put is very restful. Dangerously restful."),
    line("deadpan", "I've been told to stay. I'm staying. Watch me stay."),
    line("smug", "The best spot on the whole screen, and it's mine."),
  ],

  // Her own in-place moments.
  coins: [
    line("skeptical", "One, two, three… one short. Again."),
    line("focused", "Count it twice, the big sisters said. Then count the people who were near it."),
    line("deadpan", "Rent, needles, a new mortar. And something sweet. Medicinally."),
    line("smug", "A secret, unsold, is worth more than this pouch. I know my prices."),
    line("skeptical", "Somebody's paid me in a coin with a dent in it. I'll remember the face."),
    line("conspiratorial", "Don't tell anyone how much I've saved. Especially not anyone pretty."),
  ],
  stretch: [
    line("amused", "Mmmh. Every good cat stretches before work."),
    line("sleepy", "Grinding all morning does this to a back."),
    line("amused", "Don't look. Cats stretch with dignity."),
    line("pleased", "There. Three bones clicked. That's a medical success."),
    line("deadpan", "If my ears came out, you saw nothing."),
    line("sleepy", "Stretch, yawn, back to work. In that order. Ideally."),
  ],
  drying: [
    line("pleased", "Mugwort, hung upside down. In a week it'll be worth something."),
    line("focused", "Shake out the bugs first. They don't improve the flavour."),
    line("thinking", "Dry them in the shade, not the sun. The sun cooks the good out."),
    line("pleased", "This bundle smells like a whole summer. I'm keeping it."),
    line("deadpan", "Everything hung up here is harmless. The interesting ones are in my sleeve."),
    line("curious", "A beetle. Not in the books. Hello, little stranger."),
  ],
  slugLook: [
    line("ew", "Someone nearby just smiled very prettily. I can feel it."),
    line("ew", "Ugh. I thought about a sparkly face. Slug look. There."),
    line("ew", "That expression? It's reserved for nymphs who want favours."),
    line("ew", "…Never mind. A memory. A very glittering, very tiresome memory."),
    line("ew", "Something sweet-talking somewhere. My skin is crawling."),
    line("ew", "Hm? No. Nothing. Just remembered a hairpin I was given. By someone. Glittering."),
  ],
  sunbeam: [
    line("fond", "A sunbeam. I'm not saying I'll lie in it. I'm sitting near it."),
    line("sleepy", "Warm cloud, warm light. This is how cats get nothing done."),
    line("pleased", "Five quiet minutes. I've earned them, and I'm taking them."),
    line("fond", "If you're staying, sit. The cloud's big enough for two."),
    line("pleased", "Tea, light, nobody wanting anything. The perfect prescription."),
    line("thinking", "Even my thoughts are slower in the sun. Pleasant."),
  ],
};

// Call-and-response when a friend drops by: [Maomao's line, their reply]. Their replies are written
// to the voices the other characters' own research settled on (lowercase and "~" for the rotten
// girl, sound effects and peaches for Bamby, songs and leeks for Miku, ice cream and "ahaha" for
// KAITO).
export const visit = {
  with: {
    "miku-rotten": [
      [line("curious", "What are you drawing behind that sketchbook?"), "n-nothing! just… two clouds. who are in love. it's not what it looks like~"],
      [line("skeptical", "You've been staring at my mortar and pestle for a while."), "they're just… made for each other, okay?? i'll stop. (i won't stop.)"],
      [line("thinking", "Your glasses are fogged. Are you blushing or just warm?"), "b-both. mostly the first one. please don't ask why~"],
      [line("deadpan", "Go on, then. Confess. What did you do?"), "i stayed up till three drawing kaito and his ice cream. i'm so sorry. i'd do it again."],
      [line("unimpressed", "That's the fourth sketchbook today."), "it's the fifth. the fourth one is… classified~"],
      [line("amused", "You keep calling {name} your muse."), "because she IS. have you seen her cosplay?? i had to lie down."],
      [line("curious", "Hm. You ship herbs now?"), "mint and lemon balm. they grew up in the same pot. it's FATE."],
      // Round 2: she wants Maomao scandalised; Maomao grew up in the pleasure quarter.
      [line("unimpressed", "You're blushing at two teacups. I grew up in the pleasure quarter. Try harder."), "h-how are you so CALM?? they share a SAUCER, maomao."],
      [line("thinking", "A pretty eunuch and his loyal aide? The aide has a family and enough stress."), "but the YEARNING… fine. fine!! (i'm writing it anyway~)"],
      [line("curious", "Let me see the paddle. Lacquered? Fresh lacquer gives a rash."), "it's a SINNER paddle, not a specimen!! …a rash? asking for me."],
      [line("conspiratorial", "I once made chocolates for the courtesans. They did things. Everyone was very pleased."), "WHAT things. no. don't tell me. tell me. i need it for chapter six."],
      [line("deadpan", "Your nose is bleeding. That's the third time. Hold your head forward, not back."), "it's not my fault the clouds are holding hands!!"],
      [line("smug", "Two men sharing one umbrella is called weather, not a confession."), "that's EXACTLY what a confession looks like in volume two~"],
      [line("skeptical", "You've confessed three times today. To whom, exactly?"), "to god, to {name}, and to my sketchbook. the sketchbook is the worst."],
    ],
    bambi: [
      [line("deadpan", "You're bouncing again. Do you ever stand still?"), "nope! shuung~ that was a spin. did you see? one more!"],
      [line("curious", "There's a pigeon on the next cloud."), "WHERE. maomao-ssi, hide me!! behind the lantern, quick!"],
      [line("pleased", "I brought peaches. They're for {name}, but you can have one."), "peaches!! daebak. you're my favourite apothecary now~"],
      [line("focused", "Count the steps properly. One, two, three, four."), "ssukguk-ssukguk, tung-tung! …that's how I count. it works!"],
      [line("startled", "Are you crying? It was only a cup of tea."), "it was a REALLY nice cup of tea… aigoo, don't look~"],
      [line("amused", "You lost the game, and you're still smiling."), "lost, but I did my best! rematch tomorrow. I'm practising tonight."],
      [line("skeptical", "Cold noodles, in this weather?"), "naengmyeon is good in EVERY weather. no vinegar, no mustard. trust me~"],
      // Round 2: a deer and a cat. She reads his symbols like an apothecary's shelf.
      [line("curious", "A deer, are you? Antler velvet is a famous tonic. Purely an observation."), "m-maomao-ssi?! don't look at my head like that!! shuung~"],
      [line("focused", "Peaches are fine. The pit has a little poison in it. Don't chew the pit."), "WHO chews the pit?! …okay, once. as a kid. aigoo."],
      [line("deadpan", "It's a pigeon. It wants your snack, not your soul."), "you're so brave… daebak. i'm staying behind you forever."],
      [line("amused", "You spin like a top. Do you ever get dizzy, or do you just hide it?"), "i hide it!! idols always hide it~ one more spin? one more."],
    ],
    miku: [
      [line("deadpan", "You're humming again."), "sorry~ it's stuck in my head! want to hear the chorus? ♪"],
      [line("curious", "Is that a leek? Why are you carrying a leek?"), "for spinning, of course! …and soup later. it's very versatile!"],
      [line("smug", "Leeks are good for a cold, you know. Mildly."), "see?? healthy AND fun to wave! thank you, maomao~ 39!"],
      [line("skeptical", "Your hair is longer than your cloud."), "it's a feature! it swishes when I dance~"],
      [line("focused", "Sing a little quieter. I'm grinding."), "okay, okay~ ♪ this is the quiet version ♪"],
      [line("pleased", "{name} was humming one of your songs earlier."), "really?! that's the best thing anyone's told me all week!"],
      // Round 2: Maomao treats her like a loud, well-meaning patient.
      [line("curious", "Your hair is exactly verdigris. Pretty. Also poisonous, as pigments go."), "eh?! i'm taking that as a compliment! ♪"],
      [line("unimpressed", "You're swinging a perfectly good cold remedy like a sword."), "it's a leek AND a mic stand! okay, not really. but it could be~"],
      [line("skeptical", "The first sound of the future. I'll believe the future when I can test it."), "then test it! one note with me. just one! ♪"],
      [line("focused", "Stop shouting at clouds. Warm water, a little honey, and rest that throat."), "yes, doctor maomao! …can i sing quietly while i rest? ♪"],
      [line("amused", "I grew up in the Verdigris House. You'd have been very popular there."), "i'd sing for everyone! …wait, what kind of house was it?"],
    ],
    kaito: [
      [line("unimpressed", "Ice cream again? It's barely morning."), "ahaha… it's never too early for ice cream. want a spoon?"],
      [line("thinking", "You'll catch cold. Wear the scarf properly."), "hm-hm, I am wearing it! it's just… very long."],
      [line("ew", "Your ice cream is melting onto my cloud."), "ah, sorry, sorry! the lilac scoop is safe, though. that one's for {name}."],
      [line("curious", "You keep a scoop for {name}? Where?"), "in a little cooler. and in my heart. both, really~"],
      [line("smug", "Mint is an herb, you know. Your mint ice cream counts as medicine."), "really?! then I'm very healthy. ahaha~"],
      [line("fond", "Has she eaten today, do you know?"), "I was going to ask you the same thing! we're both worriers, hm?"],
      // Round 2: he fusses like a big brother; she diagnoses him right back.
      [line("skeptical", "Ice, in this weather? Only the consorts got ice. Who's paying for yours?"), "ahaha… me. want a scoop? on the house~"],
      [line("focused", "Your scarf's half a step from the brazier. I've treated burns for less."), "hm-hm, noted, doctor. I'll wind it once more. …twice."],
      [line("smug", "That's indigo. The root's a medicine. You're dressed sensibly by accident."), "by accident still counts, right? I'll take it~"],
      [line("deadpan", "Brain freeze again? Tongue to the roof of your mouth. Then eat like a person."), "ow… ow… oh, that works. you're a genius, maomao."],
      [line("curious", "Blue ice cream. Butterfly pea, harmless. Copper, and I'd like a word with your vendor."), "it's soda flavour! …I think. now I'm worried. taste it for me?"],
    ],
  },
};
