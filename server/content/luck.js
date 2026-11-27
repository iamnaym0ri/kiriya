// The luck shelf's content (src/world/play/games/luck/): capsule charms, the daily fortune slips and
// the stickers the luck games can hand out. Everything here is original writing; the charm and
// sticker pictures are drawn on the client (luck/capsule/charms.jsx, luck/stickers.jsx) by `id`.

// Capsule charms: the capsule machine's own collection, kept in her charm book. Rarer charms roll
// out in rarer capsules (lilac/pink/mint/butter for everyday ones, gold for sparkle ones).
export const CHARM_RARITIES = {
  everyday: { weight: 70, label: "everyday charm" },
  rare: { weight: 25, label: "rare charm" },
  sparkle: { weight: 5, label: "sparkle charm" },
};

export const CHARMS = [
  { id: "ribbon-heart", rarity: "everyday", name: "ribbon heart", line: "tied in a double knot, so it stays." },
  { id: "star-bead", rarity: "everyday", name: "star bead", line: "a whole wish, shrunk to pocket size." },
  { id: "moon-button", rarity: "everyday", name: "moon button", line: "sew it on something you love." },
  { id: "strawberry", rarity: "everyday", name: "strawberry", line: "sweet, a little sour, very you." },
  { id: "cloud", rarity: "everyday", name: "nap cloud", line: "for the softest kind of rest." },
  { id: "mushroom", rarity: "everyday", name: "spotty mushroom", line: "definitely not for soup." },
  { id: "cherries", rarity: "everyday", name: "twin cherries", line: "they only come in pairs. like us." },
  { id: "lilac", rarity: "everyday", name: "lilac sprig", line: "it smells like spring, apparently." },
  { id: "candy", rarity: "everyday", name: "wrapped candy", line: "save it for a rainy afternoon." },
  { id: "bunny", rarity: "rare", name: "bunny clip", line: "ears up, ready for anything." },
  { id: "bear", rarity: "rare", name: "little bear", line: "hugs available on request." },
  { id: "key-heart", rarity: "rare", name: "heart key", line: "it opens exactly one heart. guess which." },
  { id: "music-note", rarity: "rare", name: "teal note", line: "hums a tune only you can hear." },
  { id: "shell", rarity: "rare", name: "pearly shell", line: "hold it close and hear the sea." },
  { id: "teacup", rarity: "rare", name: "tiny teacup", line: "always the right temperature." },
  { id: "crystal-heart", rarity: "sparkle", name: "crystal heart", line: "it catches the light and keeps it." },
  { id: "wing", rarity: "sparkle", name: "angel wing", line: "for the days you need a lift." },
  { id: "crescent", rarity: "sparkle", name: "golden crescent", line: "the moon lent you this one. keep it." },
];

export const charmById = (id) => CHARMS.find((charm) => charm.id === id) ?? null;

// The stickers the luck shelf adds to her collection's catalogue. Their pictures live in
// src/world/play/games/luck/stickers.jsx; the coordinator adds them to server/content/birthday.js.
export const LUCK_STICKERS = [
  { id: "st-capsule", art: "capsule", name: "Capsule toy", line: "Twist, rattle, pop. Something lovely inside." },
  { id: "st-fortune", art: "fortune", name: "Fortune slip", line: "Today's luck: the sweet kind." },
  { id: "st-lantern", art: "lantern", name: "Wish lantern", line: "Lit, lifted and still glowing." },
  { id: "st-clover", art: "clover", name: "Four-leaf clover", line: "Found where nobody was looking." },
  { id: "st-card", art: "card", name: "Lilac card", line: "Higher, always higher." },
  { id: "st-teacup", art: "teacup", name: "Shuffle teacup", line: "It was under this one all along." },
];

// The daily fortune slip. Every level is a good one: this is cute luck, never bad news.
export const FORTUNE_LEVELS = [
  { id: "great", label: "great luck", kanji: "大吉" },
  { id: "sweet", label: "sweet luck", kanji: "吉" },
  { id: "middle", label: "middle luck (the comfy kind)", kanji: "中吉" },
  { id: "little", label: "little luck (the best kind)", kanji: "小吉" },
  { id: "sparkly", label: "sparkly luck", kanji: "大吉" },
];

export const LUCKY_COLOURS = [
  "lilac", "butter yellow", "strawberry-milk pink", "mint", "cloud white", "plum", "sky blue", "peach",
  "lavender grey", "sakura pink", "matcha green", "midnight blue",
];

export const LUCKY_THINGS = [
  "a warm drink", "a hair ribbon", "a fresh notebook page", "an old playlist", "a window seat", "a soft hoodie",
  "a tiny snack", "a pretty pen", "a long bath", "a cat video", "a hand-written note", "a new sticker",
  "a slow walk", "a sunny window", "sparkly nail polish", "a stuffed animal", "a cold bubble tea", "a long hug",
];

// Fortune ids are stable: history keeps the id, so never reorder or reuse one; add new ones at the end.
export const FORTUNES = [
  { id: "f01", text: "a small, good thing is on its way to you. it might be a cat. it might be a text. stay open." },
  { id: "f02", text: "today your outfit will be correct. not good. correct. the universe agrees." },
  { id: "f03", text: "the second cup of tea will taste better than the first. drink both." },
  { id: "f04", text: "someone is proud of you today for something you didn't even think was a big deal." },
  { id: "f05", text: "you will find exactly the right song at exactly the right moment." },
  { id: "f06", text: "be gentle with yourself before noon. after noon, be gentle anyway." },
  { id: "f07", text: "a doodle you make today will come out cuter than you planned." },
  { id: "f08", text: "your future self says thank you for resting." },
  { id: "f09", text: "a little rain, a little sun, and a whole lot of you being lovely." },
  { id: "f10", text: "today's luck is hiding in your pocket. check the left one." },
  { id: "f11", text: "the next thing you finish will make you smile, even if it's just a snack." },
  { id: "f12", text: "you are allowed to take the long way home and enjoy every step of it." },
  { id: "f13", text: "a compliment is coming. let it land; don't swat it away." },
  { id: "f14", text: "your hair will cooperate today. mostly. enough." },
  { id: "f15", text: "someone is thinking of you right now and grinning at nothing." },
  { id: "f16", text: "today is a good day to wear the thing you've been saving." },
  { id: "f17", text: "you'll laugh at something silly today, the kind of laugh that makes your eyes squish." },
  { id: "f18", text: "the stars say: drink some water. the stars are very practical." },
  { id: "f19", text: "a cat somewhere has chosen you as its favourite human. it just hasn't told you yet." },
  { id: "f20", text: "something you've been worrying about will turn out smaller than it looked." },
  { id: "f21", text: "your kindness today will travel further than you can see." },
  { id: "f22", text: "today you get to be soft and strong at the same time. it suits you." },
  { id: "f23", text: "the best seat on the train has your name on it today." },
  { id: "f24", text: "you'll find a tiny bit of magic in something ordinary. look up at the sky at least once." },
  { id: "f25", text: "today's lucky direction: towards whatever makes you giggle." },
  { id: "f26", text: "a good idea will arrive in the shower. write it down before it escapes." },
  { id: "f27", text: "you are someone's favourite notification." },
  { id: "f28", text: "your cosplay energy is extremely high today. channel it wisely." },
  { id: "f29", text: "a stretch, a sigh, a snack. the recipe for a perfect afternoon." },
  { id: "f30", text: "you will be exactly as brave as you need to be, right when you need it." },
  { id: "f31", text: "a sweet surprise is folded into this week somewhere. keep an eye out." },
  { id: "f32", text: "the moon thinks you're doing great. the moon has excellent taste." },
  { id: "f33", text: "it's a good day to tell someone you like their shoes." },
  { id: "f34", text: "small steps count double today. especially the tiny ones." },
  { id: "f35", text: "today, the dessert is worth it." },
  { id: "f36", text: "a familiar song will make you dance a little where nobody can see." },
  { id: "f37", text: "you'll land on your toes today: graceful, certain, a little bit sparkly." },
  { id: "f38", text: "your sketchbook misses you. one little line is enough to say hi." },
  { id: "f39", text: "you'll catch yourself smiling for no reason. there is a reason. it's you." },
  { id: "f40", text: "something lilac will cross your path. that's a sign. of what? of lilac." },
  { id: "f41", text: "if you nap today, it will be the good kind of nap." },
  { id: "f42", text: "a message you've been waiting for will feel worth the wait." },
  { id: "f43", text: "you have more luck than you think, and more love than you can count." },
  { id: "f44", text: "be curious today. something interesting is right around the corner." },
  { id: "f45", text: "a warm drink and a soft blanket are calling your name. answer them tonight." },
  { id: "f46", text: "your heart is a lovely place. everyone who visits wants to stay." },
  { id: "f47", text: "today's forecast: a 90% chance of being adorable." },
  { id: "f48", text: "you'll find the thing you lost, or something even better." },
  { id: "f49", text: "you deserve a little treat. this slip is legally binding." },
  { id: "f50", text: "someone wants to hold your hand right now. (you know who.)" },
  { id: "f51", text: "a good idea and a good snack will arrive at the same time." },
  { id: "f52", text: "you'll be lucky in small things today, and small things add up." },
  { id: "f53", text: "every mirror you pass today will agree: you look lovely." },
  { id: "f54", text: "the world is a little softer when you're in it." },
  { id: "f55", text: "try the new flavour. fortune favours the curious." },
  { id: "f56", text: "your favourite character would be very proud of you today." },
  { id: "f57", text: "a kind word from you will make someone's whole day." },
  { id: "f58", text: "the next photo you take will be a keeper." },
  { id: "f59", text: "you're doing better than you think. this slip is sure of it." },
  { id: "f60", text: "today is a good day to be a little bit extra." },
  { id: "f61", text: "your luck is quiet today, but it's holding your hand the whole time." },
  { id: "f62", text: "an ordinary moment today will turn into a favourite memory." },
  { id: "f63", text: "you'll hear a song that sounds like it was written just for you." },
  { id: "f64", text: "tonight sleep comes easily, and the dreams are soft ones." },
];

export const fortuneById = (id) => FORTUNES.find((fortune) => fortune.id === id) ?? null;
