import { musicPicks } from "./collection.js";

// Small, intentionally ordered photo-and-lore collections. Source review:
// docs/redesign/STRAWPAGE-RESEARCH.md. No runtime feeds or inferred interests.
const anime = "https://kusuriyanohitorigoto.jp/season1/";
const piapro = "https://piapro.net/intl/en_character.html";
const floral = {
  url: "/images/maomao-floral.webp",
  alt: "Maomao in pink and green among pale flowers",
  credit: "Supplied floral portrait · artist unverified",
};
const dramatic = {
  url: "/images/maomao-dramatic.webp",
  aspect: "16 / 9",
  alt: "A teal, pink and violet portrait of Maomao",
  credit: "Supplied portrait · Yen123412 marks retained",
};
const miku = {
  url: "/images/miku.webp",
  alt: "Hatsune Miku with her long teal twin tails",
  credit: "Art by KEI · © Crypton Future Media, Inc. 2007 · CC BY-NC 3.0",
};
const rin = {
  url: "/images/rin.webp",
  alt: "Kagamine Rin with her white bow",
  credit: miku.credit,
};

export const curations = {
  maomao: [
    {
      id: "curious",
      label: "THE GIRL BEHIND THE FRECKLES",
      title: "A very curious apothecary.",
      body: "Before palace life, Maomao worked as an apothecary in the pleasure district. Her curiosity follows her everywhere—even when she would rather keep a low profile.",
      aside: "curiosity looks good on her. 🌿",
      image: dramatic,
      source: anime,
      sourceLabel: "Official anime introduction",
      tag: "character notes",
    },
    {
      id: "voice",
      label: "A FAMILIAR VOICE",
      title: "That wonderfully dry delivery.",
      body: "Aoi Yuki voices Maomao in the Japanese anime. The official cast page pairs her name with 猫猫: the girl whose expressions can say almost as much as her words.",
      aside: "the tiniest look. the loudest opinion. ♡",
      image: floral,
      source: "https://kusuriyanohitorigoto.jp/season1/comment/cast1.html",
      sourceLabel: "Aoi Yuki · official cast comment",
      tag: "behind the voice",
    },
    {
      id: "xiaolan",
      label: "A LITTLE COMPANY",
      title: "Even Maomao has a bestie.",
      body: "Xiaolan is Maomao’s friend among the palace servants. The official character notes describe her as chatty, fond of gossip, and eager to learn.",
      aside: "a little gossip between friends. 🎀",
      mascot: "happy",
      image: floral,
      source: anime,
      sourceLabel: "Official character notes",
      tag: "her little world",
    },
    {
      id: "gyokuyo",
      label: "A CHANGE OF SCENERY",
      title: "An unexpected new chapter.",
      body: "After a palace incident reveals what Maomao knows, Gyokuyo takes her into her service. Her quiet plan to stay unnoticed becomes rather difficult.",
      aside: "one small clue, a whole new chapter. ✧",
      image: floral,
      source: anime,
      sourceLabel: "Official introduction & characters",
      tag: "anime beginnings",
    },
    {
      id: "clues",
      label: "LOOK A LITTLE CLOSER",
      title: "There’s usually an explanation.",
      body: "The anime’s opening mystery starts with a rumoured curse. Maomao becomes curious about its cause: the beginning of a story where close observation matters.",
      aside: "for the girl who notices the little things. 🌷",
      mascot: "smug",
      image: dramatic,
      source: anime,
      sourceLabel: "Official story introduction",
      tag: "anime beginnings",
    },
  ],
  miku: [
    {
      id: "hello-miku",
      label: "初音ミク / HATSUNE MIKU",
      title: "One voice. So many worlds.",
      body: "Miku began as singing software: creators enter lyrics and melodies to make her sing. Her original voice artist is Saki Fujita; the stories people make with that voice keep growing.",
      aside: "a little teal-haired company for your day. 🎧",
      image: miku,
      source: piapro,
      sourceLabel: "Crypton’s character profile",
      tag: "meet miku",
    },
    {
      id: "miku-birthday",
      label: "AUGUST 31, 2007",
      title: "Her first hello to the world.",
      body: "Miku’s original software was released on August 31, 2007. Her official character colour is blue-green—the unmistakable shade of those twin tails.",
      aside: "birthday girls deserve a good soundtrack. ♡",
      image: miku,
      source: piapro,
      sourceLabel: "Crypton’s character profile",
      tag: "a birthday note",
    },
    {
      id: "crystal-snow",
      label: "SNOW MIKU 2025",
      title: "A little Crystal Snow.",
      body: "Aqu3ra’s Crystal Snow, featuring Hatsune Miku, is the official SNOW MIKU 2025 theme song. A winter chapter for this little music shelf.",
      aside: "press play, stay a little longer. ❄",
      image: {
        url: "/images/song-crystal-snow.webp",
        alt: "Crystal Snow’s video cover",
        credit: "Official song video cover · Aqu3ra feat. Hatsune Miku",
      },
      source: "https://snowmiku.com/2025/special.html",
      sourceLabel: "SNOW MIKU 2025 · official theme song",
      song: musicPicks.find((s) => s.key === "crystal-snow"),
      tag: "a selected listen",
    },
    {
      id: "fondant-step",
      label: "SNOW MIKU 2021",
      title: "Something sweet, on repeat.",
      body: "Heavenz created Fondant Step, featuring Hatsune Miku, as the SNOW MIKU 2021 theme song. Another small piece of Miku’s ever-changing winter wardrobe of music.",
      aside: "one for the birthday playlist. 🍰",
      image: {
        url: "/images/song-fondant-step.webp",
        alt: "Fondant Step’s video cover",
        credit: "Official song video cover · Heavenz feat. Hatsune Miku",
      },
      source: "https://snowmiku.com/2021/special.html",
      sourceLabel: "SNOW MIKU 2021 · official theme song",
      song: musicPicks.find((s) => s.key === "fondant-step"),
      tag: "a selected listen",
    },
    {
      id: "rin-len",
      label: "KAGAMINE RIN & LEN",
      title: "Good company, in yellow.",
      body: "Rin and Len first arrived together on December 27, 2007. Both characters draw their voices from Asami Shimoda. Two voices for so many different songs.",
      aside: "there’s always room for another favourite. ✨",
      image: rin,
      source: piapro,
      sourceLabel: "Crypton’s Rin & Len profiles",
      tag: "also in good company",
    },
  ],
};
