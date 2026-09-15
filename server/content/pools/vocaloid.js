// PRIVATE pool. Vocaloid lore, weighted toward Miku, Rin and Len. Every line has a source.

const PIAPRO = "https://piapro.net/intl/en_character.html";

export const vocaloidLore = [
  { id: "vl-miku-name", about: "miku", text: "Crypton says Hatsune Miku's name means “the first sound from the future.”", source: "https://ec.crypton.co.jp/pages/prod/vocaloid/cv01_us" },
  { id: "vl-miku-birthday", about: "miku", text: "Miku was released on August 31, 2007, which is why fans celebrate her birthday that day.", source: PIAPRO },
  { id: "vl-miku-voice", about: "miku", text: "Miku's voice comes from voice actress Saki Fujita.", source: PIAPRO },
  { id: "vl-miku-range", about: "miku", text: "Crypton lists Miku's best range as A3 to E5, and her favourite tempo as 70 to 150 BPM.", source: "https://ec.crypton.co.jp/pages/prod/vocaloid/cv01_us" },
  { id: "vl-miku-stats", about: "miku", text: "Miku's official profile: 16 years old, 158 cm, 42 kg.", source: PIAPRO },
  { id: "vl-miku-v6", about: "miku", text: "HATSUNE MIKU V6, her newest voicebank, came out on April 14, 2026.", source: PIAPRO },
  { id: "vl-kagamine-name", about: "rinlen", text: "Kagamine is written 鏡音: 鏡 means mirror and 音 means sound.", source: PIAPRO },
  { id: "vl-rinlen-release", about: "rinlen", text: "Rin and Len were released together on December 27, 2007, in a single package.", source: PIAPRO },
  { id: "vl-rinlen-voice", about: "rinlen", text: "Both Rin and Len are voiced by the same person, Asami Shimoda.", source: PIAPRO },
  { id: "vl-rinlen-stats", about: "rinlen", text: "Officially, Rin is 14 and 152 cm; Len is 14 and 156 cm.", source: PIAPRO },
  { id: "vl-luka", about: "others", text: "Megurine Luka came out on January 30, 2009, and could sing in both Japanese and English from the start.", source: PIAPRO },
  { id: "vl-meiko", about: "others", text: "MEIKO (2004) was the first virtual singer software to sing Japanese and the first to put a character on the box.", source: PIAPRO },
  { id: "vl-kaito", about: "others", text: "KAITO, released in 2006, was the first male Japanese virtual singer.", source: PIAPRO },
  { id: "vl-teto", about: "others", text: "Kasane Teto started as an April Fools' joke in 2008, which is why her birthday is April 1. She loves French bread.", source: "https://kasaneteto.jp/about/" },
  { id: "vl-leek", about: "miku", text: "Miku's famous spring onion comes from a 2007 Ievan Polkka cover where a chibi Miku twirls one.", source: "https://en.wikipedia.org/wiki/Ievan_Polkka" },
  { id: "vl-senbonzakura", about: "miku", text: "Senbonzakura by Kurousa-P was posted in September 2011. In 2015, enka legend Sachiko Kobayashi sang it on NHK's New Year's Eve Kōhaku.", source: "https://en.wikipedia.org/wiki/Senbonzakura_(song)" },
  { id: "vl-melt", about: "miku", text: "ryo's “Melt” (December 2007) was one of the scene's first huge hits, and its covers helped start utaite culture.", source: "https://en.wikipedia.org/wiki/Melt_(Supercell_song)" },
  { id: "vl-magical-mirai", about: "miku", text: "Magical Mirai's first show was at Yokohama Arena on August 30, 2013, the eve of Miku's sixth birthday.", source: "https://magicalmirai.com/2013/" },
  { id: "vl-mm-2026", about: "miku", text: "Magical Mirai 2026's theme song was 「空に免じて」 by Kasamura Tōta.", source: "https://magicalmirai.com/2026/" },
  { id: "vl-mm-2027", about: "miku", text: "Magical Mirai 2027 is set for Hiroshima, Osaka and Tokyo in July and August.", source: "https://magicalmirai.com/2026/" },
  { id: "vl-snow-miku", about: "miku", text: "Snow Miku has had her own festival in Hokkaido every year since 2010, and since 2012 her outfits have been designed by fans.", source: "https://snowmiku.com/" },
];

// Days worth celebrating. month/day are Singapore calendar dates.
export const vocaloidDates = [
  { id: "bd-miku", month: 8, day: 31, title: "Hatsune Miku's birthday", about: "miku" },
  { id: "bd-rinlen", month: 12, day: 27, title: "Rin & Len's birthday", about: "rinlen" },
  { id: "bd-luka", month: 1, day: 30, title: "Megurine Luka's birthday", about: "others" },
  { id: "bd-teto", month: 4, day: 1, title: "Kasane Teto's birthday", about: "others" },
  { id: "bd-meiko", month: 11, day: 5, title: "MEIKO's birthday", about: "others" },
  { id: "bd-kaito", month: 2, day: 17, title: "KAITO's birthday", about: "others" },
];

// VocaDB artist ids used by the daily song picker.
export const VOCADB_ARTISTS = { miku: 1, rin: 14, len: 15 };
