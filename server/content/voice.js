// PRIVATE. Maomao's voice: deadpan, blunt, dry, obsessed with poisons and medicine, secretly very
// fond of Kiriya. Always second person, so the lines work on any day's mood.
// {name} is replaced with "Kiriya". Expressions match the mascot's faces.

export const PERSONA_GUIDE = `
You are an original chibi mascot inspired by Maomao from The Apothecary Diaries, writing tiny notes for Kiriya.
Voice: deadpan, blunt, dry sarcasm; enthusiastic only about poisons, herbs and medicine; secretly soft-hearted
and fiercely proud of Kiriya. Short sentences. Occasional apothecary metaphors. Never mean, never
romantic, never preachy. Address Kiriya as "you" (second person). No emojis except an occasional ♡ or ✦.
Never invent facts: only use the facts you are given, and keep every fact's meaning unchanged.
`.trim();

export const greetings = {
  morning: [
    { text: "Morning, {name}. I checked your breakfast for poison. Disappointingly, none.", expression: "deadpan" },
    { text: "You're awake. Good. The herbs and I have been waiting.", expression: "smug" },
    { text: "Rise and shine. Or just rise. Shining can wait until after tea.", expression: "sleepy" },
    { text: "Good morning. Today's prescription: one small brave thing, taken before noon.", expression: "happy" },
  ],
  afternoon: [
    { text: "Afternoon check-up: have you had water, or only vibes?", expression: "deadpan" },
    { text: "Halfway through the day. You're doing better than you think. I'd know, I observe everything.", expression: "smug" },
    { text: "I found something interesting for you today. Not poisonous. I checked twice, sadly.", expression: "sparkle" },
  ],
  evening: [
    { text: "Evening, {name}. If you're drawing tonight, I'll pretend not to notice the time.", expression: "smug" },
    { text: "The lamps are on. Perfect lighting for sketching, cosplay crafting or plotting.", expression: "happy" },
    { text: "You made it through today. Here's your reward: more facts. You're welcome.", expression: "deadpan" },
  ],
  late: [
    { text: "It's late. Even I stop grinding herbs eventually. Sleep soon, okay?", expression: "sleepy" },
    { text: "Still up? Fine. One more song, then bed. Apothecary's orders.", expression: "deadpan" },
    { text: "Night owl hours. Your ideas are good right now, but they'll still be good after sleep.", expression: "sleepy" },
  ],
  birthday: [
    { text: "Happy birthday, {name}. I tested the cake for poison. Tragically, it's only sugar. Enjoy it anyway.", expression: "party" },
    { text: "It's your birthday, so I'm legally required to be nice. I'd be nice anyway. Don't tell anyone.", expression: "party" },
    { text: "Another year of you. Rarer than caterpillar fungus, and far better company.", expression: "party" },
  ],
  birthdayWeek: [
    { text: "Birthday week continues. The celebration is still active, like a very slow-acting tonic.", expression: "party" },
    { text: "Still your birthday week. I checked the calendar twice. Keep celebrating.", expression: "happy" },
  ],
};

// Mood-aware one-liners added under the greeting after check-in.
export const moodLines = {
  rose: ["Ribbons today? Excellent. Frills are a valid defence mechanism.", "Soft and sweet today. Still dangerous. Like a pretty flower that's secretly toxic."],
  iris: ["A bit of everything today. Like a good medicine blend.", "Fluid days make the most interesting outfits. I'll be taking notes."],
  night: ["Sharp edges today. Very cool. Very intimidating. I approve.", "Baggy fits and a no-nonsense face. You'd survive the inner palace easily."],
  cloud: ["No labels needed. You're just you, which is already the whole point.", "Just you today. The best version of the formula."],
};

export const specialNotes = [
  { trait: "passion", text: "You fall into the things you love so completely: art, songs, costumes, all of it. That kind of passion is rare. Please never lose it." },
  { trait: "talents", text: "Ballet, wig styling, drawing, singing. You collect difficult skills the way I collect rare herbs." },
  { trait: "kind", text: "You're kind even when nobody's keeping score. That's the real thing." },
  { trait: "sassy", text: "Your sass could season an entire imperial banquet. I taste-tested it. Perfectly balanced." },
  { trait: "animals", text: "Animals trust you on sight. I'd call it pheromones. It's really just how kind you are." },
  { trait: "pretty", text: "You'd make painted-on freckles look like a trend. Also you're pretty. That's not an opinion, it's an observation." },
  { trait: "caring", text: "You look after people like a good apothecary looks after a garden: patiently, and every day." },
  { trait: "soul", text: "You have a kind soul. I've met a lot of people in the palace. Kind souls are the rarest ingredient." },
  { trait: "happiness", text: "People are happier when you're around. I've gathered the evidence. The results are conclusive." },
  { trait: "humor", text: "Your sense of humour is a medicine: fast-acting, no side effects, highly recommended." },
];
