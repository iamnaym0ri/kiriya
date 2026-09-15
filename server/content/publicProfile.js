// What anyone can see on iloveukiriya.com without the passphrase. Kiriya (or the admin) can override
// every field from the private settings; these are the starting values. Nothing personal belongs here.

export const BIRTHDAY = { month: 9, day: 15 };
export const BIRTHDAY_WEEK_DAYS = 7;

export const publicProfileDefaults = {
  // `name` is the lowercase wordmark; `displayName` is how sentences say it.
  name: "kiriya",
  displayName: "Kiriya",
  bioLines: [
    "maomao's no. 1 apprentice",
    "drawing on my ipad way past bedtime",
    "miku, rin & len on repeat",
    "wig styling is a lifestyle",
  ],
  badges: ["vocaloid", "apothecary", "artist", "cosplay"],
  socials: {
    tiktok: { handle: "", url: "" },
    discord: { username: "" },
  },
  avatarUrl: null,
  showViews: true,
  interests: [
    {
      key: "vocaloid",
      title: "Vocaloid",
      line: "Miku, Rin & Len, classics to Project SEKAI.",
      fact: "Hatsune Miku's name means “the first sound from the future.”",
      source: "https://ec.crypton.co.jp/pages/prod/vocaloid/cv01_us",
    },
    {
      key: "apothecary",
      title: "The Apothecary Diaries",
      line: "Maomao, poisons, and very suspicious herbs.",
      fact: "Maomao's name, 猫猫, is the character for “cat” written twice.",
      source: "https://anilist.co/character/126824",
    },
    {
      key: "art",
      title: "Drawing",
      line: "Procreate at night, sketchbooks by day.",
      fact: "Verdigris, the green pigment Maomao's childhood home is named after, means “green of Greece.”",
      source: "https://colourlex.com/project/verdigris/",
    },
    {
      key: "cosplay",
      title: "Cosplay",
      line: "Costumes, props and a lot of wig styling.",
      fact: "Heat-resistant wigs aren't heat-proof: styling tools stay at 350°F (175°C) or below.",
      source: "https://www.epiccosplay.com/blogs/wig-tips/wigs-and-heat",
    },
  ],
  cosplays: [
    { character: "Maomao", series: "The Apothecary Diaries", photoUrl: null },
    { character: "Hatsune Miku", series: "Vocaloid", photoUrl: null },
    { character: "Lynette", series: "Genshin Impact", photoUrl: null },
  ],
};

// Until a favourite is chosen, the profile plays the original Senbonzakura video.
export const defaultSong = {
  kind: "link",
  provider: "youtube",
  embedId: "shs0rAiwsGQ",
  url: "https://www.youtube.com/watch?v=shs0rAiwsGQ",
  title: "Senbonzakura",
  artist: "Kurousa-P feat. Hatsune Miku",
  thumbnail: "https://i.ytimg.com/vi/shs0rAiwsGQ/hqdefault.jpg",
};
