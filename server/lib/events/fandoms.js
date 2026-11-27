// Her fandoms, for "is this hers?" and "is this big?" (server/content/taste.js is the fuller profile).
// A big item is a con, pop-up or merch drop tied to one of the core fandoms: its news is pushed at
// once. Everything else waits for the weekly digest.

export const FANDOMS = [
  { id: "miku", label: "hatsune miku", core: true, words: ["hatsune miku", "miku", "初音ミク", "magical mirai", "miku expo", "snow miku", "sakura miku", "piapro", "crypton"] },
  { id: "vocaloid", label: "vocaloid", core: true, words: ["vocaloid", "kagamine", "rin & len", "rin and len", "megurine luka", "kaito", "meiko", "kasane teto", "gumi", "utau"] },
  { id: "sekai", label: "project sekai", core: true, words: ["project sekai", "proseka", "colorful stage", "プロセカ", "wonderlands×showtime", "wonderlands x showtime", "vivid bad squad", "leo/need", "more more jump", "25-ji", "nightcord"] },
  { id: "apothecary", label: "the apothecary diaries", core: true, words: ["apothecary diaries", "kusuriya", "薬屋のひとりごと", "maomao", "jinshi"] },
  { id: "plave", label: "plave", core: true, words: ["plave", "bamby", "yejun", "noah", "eunho", "hamin"] },
  { id: "rotten-girl", label: "confessions of a rotten girl", core: true, words: ["confessions of a rotten girl", "rotten girl", "sawtowne"] },
  { id: "cosplay", label: "cosplay", core: true, words: ["cosplay", "cosplayer", "cos photoshoot", "cosplay competition", "cosplay singles"] },
  { id: "j-fashion", label: "j-fashion", core: true, words: ["j-fashion", "lolita fashion", "lolita", "harajuku", "jirai kei", "kawaii fashion", "alt fashion", "konbini"] },
  { id: "vtuber", label: "vtubers", core: false, words: ["vtuber", "nijisanji", "noctyx", "uki violeta", "hololive"] },
  { id: "genshin", label: "genshin impact", core: false, words: ["genshin", "hoyoverse", "hoyo fest", "hoyofest", "honkai", "star rail", "zenless"] },
  { id: "frieren", label: "frieren", core: false, words: ["frieren"] },
  { id: "witch-hat", label: "witch hat atelier", core: false, words: ["witch hat atelier", "tongari"] },
  { id: "bungo", label: "bungo stray dogs", core: false, words: ["bungo stray dogs", "bungou stray dogs"] },
  { id: "oshi-no-ko", label: "oshi no ko", core: false, words: ["oshi no ko"] },
  { id: "bocchi", label: "bocchi the rock!", core: false, words: ["bocchi"] },
  { id: "girls-band-cry", label: "girls band cry", core: false, words: ["girls band cry"] },
  { id: "sanrio", label: "sanrio", core: false, words: ["sanrio", "hello kitty", "my melody", "kuromi", "cinnamoroll", "pompompurin", "pochacco"] },
  { id: "pokemon", label: "pokémon", core: false, words: ["pokémon", "pokemon", "pikachu"] },
  { id: "anime", label: "anime", core: false, words: ["anime", "manga", "doujin", "otaku", "acg", "artist alley", "comic con", "comics"] },
];

export const FANDOM_IDS = FANDOMS.map((f) => f.id);
export const fandomLabel = (id) => FANDOMS.find((f) => f.id === id)?.label ?? id;

const fold = (s) => String(s ?? "").normalize("NFKC").toLowerCase();
const wordRe = (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");
const MATCHERS = FANDOMS.map((f) => ({ ...f, res: f.words.map((w) => wordRe(fold(w))) }));

/** Fandom ids mentioned in some text (titles, captions, dossier text). */
export function fandomsIn(...texts) {
  const hay = fold(texts.flat().filter(Boolean).join(" \n "));
  return MATCHERS.filter((f) => f.res.some((re) => re.test(hay))).map((f) => f.id);
}

/** Normalises free-form fandom names from the investigation to our ids (unknown ones kept, slugged). */
export function normaliseFandoms(list = []) {
  const out = new Set();
  for (const name of list) {
    const hit = fandomsIn(name);
    if (hit.length) hit.forEach((id) => out.add(id));
    else {
      const slug = fold(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40);
      if (slug) out.add(slug);
    }
  }
  return [...out].slice(0, 10);
}

/** Hers: any core fandom, or a con (cons are always hers: cosplay is what she does). */
export function isHers({ kind, fandoms = [] }) {
  if (kind === "con") return true;
  return fandoms.some((id) => FANDOMS.find((f) => f.id === id)?.core);
}

/** Big: a con, pop-up or merch drop tied to her fandoms (PLAN.md: "Event push"). */
export function isBig({ kind, fandoms = [] }) {
  if (!["con", "popup", "merch", "cafe"].includes(kind)) return false;
  if (kind === "con") return fandoms.some((id) => FANDOMS.find((f) => f.id === id)?.core) || fandoms.includes("anime");
  return fandoms.some((id) => FANDOMS.find((f) => f.id === id)?.core);
}

/** The cheap keyword gate that decides whether a changed item is worth a triage call at all. */
const PREFILTER = [
  ...FANDOMS.flatMap((f) => f.words),
  "pop-up", "pop up", "popup", "collab cafe", "collab café", "collaboration cafe", "convention", "festival", "fest", "expo", "merch",
  "exclusive", "limited edition", "figure", "plush", "acrylic", "gacha", "gachapon", "ichiban kuji", "character", "anisong", "j-pop",
  "japanese", "japan", "kawaii", "con ", "fan meet", "fanmeet", "concert", "live in singapore",
].map((w) => wordRe(fold(w)));
export const prefilterMatch = (...texts) => {
  const hay = fold(texts.flat().filter(Boolean).join(" \n "));
  return PREFILTER.some((re) => re.test(hay));
};
