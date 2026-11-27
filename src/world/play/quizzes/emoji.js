// A hand-picked emoji shelf for quiz answers, with a few words each so typing an answer can suggest
// its emoji ("ramen" → 🍜). Any other emoji can still be typed from the phone's own keyboard.

const SHELVES = {
  love: `💜 purple heart love lilac|🩷 pink heart love|❤️ red heart love|🤍 white heart|🖤 black heart goth|💕 hearts love|💞 hearts love|💗 heart growing|💘 cupid arrow crush|💌 love letter mail|💋 kiss lips|😘 kiss blow|🥰 love smile adore|😍 heart eyes love crush|🫶 heart hands love|🤗 hug cuddle|💐 bouquet flowers|💍 ring marry wedding proposal|👩‍❤️‍👨 couple us together|💑 couple us|🫂 hug people|🌹 rose flower date|✨ sparkle magic|🎀 ribbon bow cute|🧸 teddy bear plush cuddle|🍫 chocolate sweet|🎁 gift present surprise|🕯️ candle dinner`,
  food: `🍜 ramen noodles soup pho laksa|🍣 sushi fish japanese|🍙 onigiri rice ball|🍱 bento lunch box|🍛 curry rice|🍚 rice|🥟 dumpling gyoza|🍤 tempura shrimp prawn|🍝 pasta spaghetti|🍕 pizza|🍔 burger hamburger|🍟 fries chips|🌭 hotdog|🌮 taco mexican|🥗 salad healthy|🍲 hotpot stew steamboat|🍗 chicken wing|🥩 steak meat|🍳 egg breakfast cooking|🥞 pancakes breakfast|🧇 waffle|🥐 croissant bread bakery|🍞 bread toast|🧀 cheese|🥪 sandwich|🥘 paella pan|🫕 fondue|🍢 oden skewer|🍡 dango mochi sweet|🍰 cake slice dessert|🎂 birthday cake|🧁 cupcake|🍮 pudding flan custard|🍩 donut doughnut|🍪 cookie biscuit|🍦 ice cream soft serve|🍨 ice cream gelato|🍧 shaved ice kakigori|🍭 lollipop candy|🍬 candy sweet|🍓 strawberry fruit|🍑 peach fruit|🍒 cherry fruit|🍇 grapes fruit|🍉 watermelon fruit|🍋 lemon fruit|🍊 orange fruit|🍍 pineapple fruit|🥭 mango fruit|🍌 banana fruit|🍎 apple fruit|🥝 kiwi fruit|🫐 blueberry fruit|🥑 avocado|🌶️ chilli spicy hot|🍿 popcorn movie snack`,
  drinks: `🧋 bubble tea boba milk tea|🍵 matcha green tea|☕ coffee latte cafe|🥤 soda drink|🧃 juice box|🥛 milk|🍶 sake|🍷 wine|🍸 cocktail|🍹 tropical drink mocktail|🍺 beer|🥂 cheers champagne celebrate|🧉 mate|🫖 teapot tea`,
  animals: `🐱 cat kitten meow|🐈 cat|🐈‍⬛ black cat|🐶 dog puppy|🐰 bunny rabbit|🐹 hamster|🐻 bear|🐼 panda|🐨 koala|🦊 fox|🐯 tiger|🦁 lion|🐸 frog|🐧 penguin|🐥 chick bird|🦆 duck|🦢 swan|🦉 owl|🦋 butterfly|🐝 bee|🐞 ladybug|🐢 turtle|🐠 fish|🐳 whale|🐬 dolphin|🦈 shark|🐙 octopus|🦄 unicorn|🐉 dragon|🐾 paw prints pet`,
  nature: `🌸 cherry blossom sakura flower|🌷 tulip flower|🌻 sunflower flower|🌺 hibiscus flower|🌼 daisy flower|🪻 lavender lilac flower|🍀 clover luck|🌿 herb leaf plant|🌵 cactus plant|🌳 tree park|🍁 autumn leaf fall|🍂 leaves autumn|🌊 wave sea ocean beach|🏔️ mountain|🌋 volcano|🌙 moon night|⭐ star|🌟 star shine|☀️ sun sunny summer|🌈 rainbow|☁️ cloud|🌧️ rain rainy|⛈️ storm thunder|❄️ snow winter cold|☃️ snowman winter|🔥 fire hot|💧 water drop|🫧 bubbles`,
  places: `🏠 home house|🏖️ beach holiday|🏝️ island tropical holiday|🗼 tokyo tower japan|🗻 fuji mountain japan|⛩️ shrine japan|🏯 castle japan|🏰 castle disney|🎡 ferris wheel fair|🎢 rollercoaster theme park|🎠 carousel|🏟️ stadium concert|🏙️ city skyline|🌃 night city|🌉 bridge|🗽 new york|🗺️ map travel|✈️ plane flight travel trip|🚆 train|🚗 car drive|🚲 bike bicycle|🛳️ cruise ship boat|⛺ camping tent|🏕️ camping|🛍️ shopping mall|🏫 school|🏢 office work|🏥 hospital|🎪 circus fair festival|🇸🇬 singapore|🇯🇵 japan|🇰🇷 korea|🇺🇸 america usa|🇬🇧 uk britain london|🇫🇷 france paris|🇹🇼 taiwan`,
  fun: `🎮 game gaming video games|🕹️ arcade game|🎲 dice board game|🧩 puzzle|🃏 cards|🎨 art paint draw|✏️ draw pencil write|📚 books reading|📖 book read|🎬 movie film cinema|📺 tv show anime|🎤 karaoke sing|🎧 music headphones|🎵 music song|🎹 piano|🎸 guitar|🥁 drums|💃 dance dancing|🩰 ballet|🧘 yoga|🏃 run running|🏊 swim swimming|⚽ football soccer|🏀 basketball|🎾 tennis|🏸 badminton|🎳 bowling|⛸️ skating ice|🛹 skateboard|🎣 fishing|🧶 knitting crochet yarn|🧵 sewing cosplay|📷 photo camera|🎉 party celebrate|🎊 confetti|🎆 fireworks|🎃 halloween|🎄 christmas|🧧 red packet new year|🏮 lantern|🎐 wind chime|🛌 sleep nap bed`,
  things: `📱 phone|💻 laptop computer|⌚ watch|👗 dress|👘 kimono|👠 heels shoes|👟 sneakers shoes|👜 bag handbag|🎒 backpack|👒 hat|🕶️ sunglasses|💄 lipstick makeup|💅 nails manicure|🪞 mirror|💎 gem diamond|👑 crown queen king|🔑 key|🗝️ old key|💡 idea lightbulb|🕰️ clock time|⏰ alarm morning|📅 calendar date|✉️ letter mail|📝 note memo|🖊️ pen|💰 money|🪙 coin|🛒 shopping cart|🧳 luggage suitcase travel|🎟️ ticket|🪄 magic wand|🔮 crystal ball fortune|🧿 charm|🪐 planet space|🚀 rocket space|🤖 robot`,
  faces: `😊 happy smile|😄 grin happy|😂 laugh crying|🥹 touched teary|😭 crying sob|🥺 pleading puppy eyes|😳 flushed shy|😌 calm relieved|😋 yum tasty|😎 cool|🤓 nerd|🤔 thinking hmm|🫣 peek shy|🤭 giggle oops|😴 sleepy|🥱 yawn tired|😤 huff grumpy|😡 angry mad|🤯 mind blown|🥳 party birthday|😇 angel innocent|😈 devil cheeky|👻 ghost boo|💀 skull dead|🙈 see no evil shy|🤡 clown|👽 alien|🙃 upside down silly|😏 smirk|🤤 drool`,
};

export const EMOJI_SHELVES = [
  { id: "love", label: "love", icon: "💜" },
  { id: "food", label: "food", icon: "🍜" },
  { id: "drinks", label: "drinks", icon: "🧋" },
  { id: "animals", label: "animals", icon: "🐱" },
  { id: "nature", label: "nature", icon: "🌸" },
  { id: "places", label: "places", icon: "🏖️" },
  { id: "fun", label: "fun", icon: "🎮" },
  { id: "things", label: "things", icon: "👗" },
  { id: "faces", label: "faces", icon: "😊" },
];

const parse = (line) => {
  const [emoji, ...words] = line.trim().split(" ");
  return { emoji, words };
};
export const EMOJI = Object.fromEntries(Object.entries(SHELVES).map(([id, list]) => [id, list.split("|").map(parse)]));
const ALL = Object.values(EMOJI).flat();

const STOP = new Set(["the", "a", "an", "my", "our", "your", "to", "of", "and", "in", "at", "on", "with", "for", "i", "you", "me", "we", "us", "it", "is", "or", "go", "get", "some", "very", "so"]);
// "cats" → "cat", "dresses" → "dress".
const forms = (word) => [word, ...(word.length > 3 && word.endsWith("s") ? [word.slice(0, -1)] : []), ...(word.length > 4 && word.endsWith("es") ? [word.slice(0, -2)] : [])];

/** Up to `limit` emoji whose words match what's typed ("bubble tea" → 🧋 first). */
export function suggestEmoji(text, limit = 6) {
  const words = String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 && !STOP.has(word));
  if (!words.length) return [];
  const scored = new Map();
  for (const entry of ALL) {
    let score = 0;
    for (const word of words) {
      let best = 0;
      for (const [index, key] of entry.words.entries()) {
        if (forms(word).includes(key)) best = Math.max(best, index === 0 ? 6 : 4);
        // Still typing: "stra" → 🍓.
        else if (word.length >= 3 && key.startsWith(word)) best = Math.max(best, 1);
      }
      score += best;
    }
    if (score > (scored.get(entry.emoji) ?? 0)) scored.set(entry.emoji, score);
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([emoji]) => emoji);
}

/** What a new answer starts with, before anything is typed. */
export const STARTER_EMOJI = ["🌸", "⭐", "🍓", "🫧"];

const graphemes = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
/** The last emoji in what was typed (the keyboard may add text around it), or null. */
export function lastEmoji(value) {
  const parts = graphemes ? [...graphemes.segment(String(value ?? ""))].map((s) => s.segment) : [...String(value ?? "")];
  for (let i = parts.length - 1; i >= 0; i--) if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(parts[i])) return parts[i];
  return null;
}
