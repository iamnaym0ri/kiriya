// PRIVATE pool. Facts about Maomao and her world, checked against the sources listed.
// spoiler: "anime" (safe), "manga" (fine for Kiriya, still tucked behind a tap for friends peeking),
//          "novel" (beyond what she's read: always hidden behind a tap with a warning).

const WPE = "https://en.wikipedia.org/wiki/List_of_The_Apothecary_Diaries_episodes";
const WPC = "https://en.wikipedia.org/wiki/List_of_The_Apothecary_Diaries_characters";
const FW = (page) => `https://kusuriya.fandom.com/wiki/${page}`;

export const maomaoFacts = [
  { id: "mm-name", spoiler: "anime", text: "Maomao's name, 猫猫, is the character for “cat” written twice. Gaoshun sometimes calls her Xiaomao, “little cat.”", source: "https://anilist.co/character/126824" },
  { id: "mm-verdigris", spoiler: "anime", text: "She grew up in the Verdigris House. Verdigris is also a copper-green pigment, and its name means “green of Greece.”", source: "https://colourlex.com/project/verdigris/" },
  { id: "mm-kidnapped", spoiler: "anime", text: "She ended up in the palace because she was kidnapped while gathering herbs and sold as a laundry maid. Rude.", source: WPE },
  { id: "mm-first-case", spoiler: "anime", text: "Her first case: the “curse” on the royal babies was lead in the face powder. She warned the consorts anonymously, on cloth tied to a rhododendron.", source: WPE },
  { id: "mm-bandages", spoiler: "anime", text: "The bandages on her left arm cover scars from testing poisons and medicines on herself.", source: FW("Maomao") },
  { id: "mm-taster", spoiler: "anime", text: "As Consort Gyokuyou's food taster she is genuinely thrilled by the job, and recommends silver tableware.", source: WPE },
  { id: "mm-chocolate", spoiler: "anime", text: "Her self-declared dream assignment was making an aphrodisiac: chocolate about three times stronger than normal.", source: WPE },
  { id: "mm-freckles", spoiler: "anime", text: "Her freckles are painted on so she looks plain and stays out of trouble.", source: "https://www.animenewsnetwork.com/review/the-apothecary-diaries/episode-5/.204140" },
  { id: "mm-hairpins", spoiler: "anime", text: "In the inner palace, hairpins from admirers work like favour tickets.", source: WPE },
  { id: "mm-garden-party", spoiler: "anime", text: "At the garden party she found the poison the direct way: by tasting it.", source: WPE },
  { id: "mm-fingerprints", spoiler: "anime", text: "She dusts for fingerprints with powder, cotton and a brush. Forensics, apothecary style.", source: WPE },
  { id: "mm-princesses", spoiler: "anime", text: "The Verdigris House's Three Princesses are Meimei, Pairin and Joka.", source: WPE },
  { id: "mm-liquor", spoiler: "anime", text: "She loves strong liquor, and was horrified when Jinshi joked about banning underage drinking.", source: WPE },
  { id: "mm-exam", spoiler: "anime", text: "She failed the court lady exam. Book smarts about poisons, zero interest in etiquette.", source: WPE },
  { id: "mm-dust", spoiler: "anime", text: "She worked out that a fire was a flour-dust explosion, set off by an ember from a pipe.", source: WPE },
  { id: "mm-jinka", spoiler: "anime", text: "She disguised Jinshi as “Jinka” for a trip into town because he was far too pretty to go unnoticed.", source: WPE },
  { id: "mm-bezoar", spoiler: "anime", text: "The fastest way to bribe Maomao is rare medicine. Ox bezoar works every time.", source: WPE },
  { id: "mm-blue-roses", spoiler: "anime", text: "She produced “blue roses” out of season using a sauna as a greenhouse, plus some dyed water.", source: WPE },
  { id: "mm-lakan-go", spoiler: "anime", text: "Lakan can't recognise faces, so he sees people as Go pieces.", source: WPC },
  { id: "mm-luomen", spoiler: "anime", text: "Luomen, the apothecary who raised her, is a former palace doctor who studied abroad.", source: WPC },
  { id: "mm-cat", spoiler: "anime", text: "A calico kitten was named Maomao, much to her annoyance, and given the court title “Admonisher of Thieves.”", source: FW("Maomao,_the_Cat") },
  { id: "mm-moon-fairy", spoiler: "anime", text: "The “moon fairy” turned out to be moths drawn by a scent around a moonlit dancer.", source: WPE },
  { id: "mm-shrine", spoiler: "anime", text: "The Shrine of Choosing was secretly a colour-blindness test for imperial candidates.", source: WPE },
  { id: "mm-orpiment", spoiler: "anime", text: "The late emperor painted in secret with orpiment, an arsenic pigment, which explained why his body didn't decay.", source: WPE },
  { id: "mm-icecream", spoiler: "anime", text: "She turned a broken block of ice into ice cream for Consort Loulan.", source: WPE },
  { id: "mm-author", spoiler: "anime", text: "The author first imagined the heroine as an adult mother of three living in a mining town.", source: "https://en.wikipedia.org/wiki/The_Apothecary_Diaries" },
  { id: "mm-voices", spoiler: "anime", text: "Maomao is voiced by Aoi Yūki in Japanese and Emi Lo in English.", source: WPC },
  { id: "mm-lakan-father", spoiler: "manga", text: "Lakan is Maomao's father, and her mother Fengxian was a courtesan and Go player.", source: WPE },
  { id: "mm-luomen-uncle", spoiler: "manga", text: "Luomen is really Maomao's great-uncle.", source: WPC },
  { id: "mm-zuigetsu", spoiler: "manga", text: "Jinshi's official identity is Ka Zuigetsu, the Emperor's younger brother, and Gaoshun being a eunuch is part of the cover.", source: WPE },
  { id: "mm-buckwheat", spoiler: "novel", text: "For all her poison resistance, she has a buckwheat allergy she can't train away.", source: FW("Maomao") },
  { id: "mm-lightweight", spoiler: "novel", text: "Lakan is a hopeless lightweight, while Maomao can outdrink almost anyone.", source: FW("Lakan") },
];

// Dates that matter for the daily countdown card.
export const apothecaryDates = [
  { id: "s3", title: "Season 3 premieres", at: "2026-10-02T14:00:00Z", note: "Friday 10 p.m. in Singapore, on NTV in Japan (Crunchyroll has it too).", source: "https://www.animenewsnetwork.com/news/2026-08-15/the-apothecary-diaries-season-3-trailer-unveils-october-2-debut-more-cast-opening-song/.240600" },
  { id: "manga-en-16", title: "English manga volume 16", at: "2026-11-03T12:00:00-05:00", note: "From Square Enix Manga.", source: "https://en.wikipedia.org/wiki/List_of_The_Apothecary_Diaries_volumes" },
  // Date-only announcements are pinned to noon in Japan so they show the right calendar day in Singapore.
  { id: "film", title: "The film opens in Japan", at: "2026-12-11T12:00:00+09:00", note: "The Deceased Empress' Treasure, an original story by the author.", source: "https://www.animenewsnetwork.com/news/2026-07-02/the-apothecary-diaries-anime-film-trailer-reveals-title-cast-december-11-opening/.239226" },
  { id: "s3-part2", title: "Season 3, part 2", at: "2027-04-01T12:00:00+09:00", note: "Announced for April 2027.", source: "https://www.animenewsnetwork.com/news/2026-08-15/the-apothecary-diaries-season-3-trailer-unveils-october-2-debut-more-cast-opening-song/.240600", approximate: true },
];
