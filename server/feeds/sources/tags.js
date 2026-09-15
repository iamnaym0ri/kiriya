// Canonical tag vocabulary. Values match server/content/taste.js keys exactly so scoring can use
// them; adapters map source-specific names/aliases through these helpers instead of inventing tags.

export const CHARACTER_ALIASES = {
  maomao: ["maomao", "mao mao", "猫猫", "maomao_(kusuriya_no_hitorigoto)", "maomao (kusuriya no hitorigoto)"],
  jinshi: ["jinshi", "壬氏", "jinshi_(kusuriya_no_hitorigoto)"],
  pairin: ["pairin", "白鈴", "pairin_(kusuriya_no_hitorigoto)"],
  meimei: ["meimei", "梅梅", "meimei_(kusuriya_no_hitorigoto)"],
  joka: ["joka", "女華", "joka_(kusuriya_no_hitorigoto)"],
  xiaolan: ["xiaolan", "小蘭", "xiaolan_(kusuriya_no_hitorigoto)"],
  gaoshun: ["gaoshun", "高順", "gaoshun_(kusuriya_no_hitorigoto)"],
  lakan: ["lakan", "羅漢", "lakan_(kusuriya_no_hitorigoto)"],
  luomen: ["luomen", "羅門", "luomen_(kusuriya_no_hitorigoto)"],
  gyokuyou: ["gyokuyou", "gyokuyo", "玉葉", "gyokuyou_(kusuriya_no_hitorigoto)"],
  "hatsune miku": ["hatsune miku", "hatsune_miku", "初音ミク", "miku", "初音未来"],
  "kagamine rin": ["kagamine rin", "kagamine_rin", "鏡音リン"],
  "kagamine len": ["kagamine len", "kagamine_len", "鏡音レン"],
  luka: ["megurine luka", "megurine_luka", "巡音ルカ", "luka"],
  kaito: ["kaito", "kaito_(vocaloid)", "カイト"],
  meiko: ["meiko", "meiko_(vocaloid)", "メイコ"],
  "kasane teto": ["kasane teto", "kasane_teto", "重音テト", "teto"],
  gumi: ["gumi", "megpoid", "グミ"],
  lynette: ["lynette", "lynette_(genshin_impact)"],
  frieren: ["frieren", "フリーレン"],
  fern: ["fern", "fern_(sousou_no_frieren)", "フェルン"],
  coco: ["coco", "coco_(tongari_boushi_no_atelier)", "ココ"],
};
export const VOICEBANKS = [
  "hatsune miku",
  "kagamine rin",
  "kagamine len",
  "luka",
  "kaito",
  "meiko",
  "kasane teto",
  "gumi",
];
export const UNIT_ALIASES = {
  "wonderlands×showtime": ["wonderlands×showtime", "wonderlands x showtime", "wxs", "ワンダーランズ×ショウタイム", "wonderlands_x_showtime"],
  "vivid bad squad": ["vivid bad squad", "vbs", "vivid_bad_squad", "vivid bad squad (project sekai)"],
  "leo/need": ["leo/need", "leo_need", "leoneed"],
  "more more jump!": ["more more jump!", "more_more_jump", "mmj"],
  "nightcord at 25:00": ["nightcord at 25:00", "25-ji, nightcord de.", "25ji", "n25"],
  "virtual singer": ["virtual singer", "virtual_singer"],
};
// Project SEKAI master-data unit codes. Exact lookups only (`canonicalUnits`), never free-text
// `mentions`: ordinary words such as "street" or "idol" must not tag, or reject, unrelated text.
export const UNIT_CODES = {
  theme_park: "wonderlands×showtime",
  street: "vivid bad squad",
  light_sound: "leo/need",
  light_music_club: "leo/need",
  idol: "more more jump!",
  school_refusal: "nightcord at 25:00",
  piapro: "virtual singer",
};
export const FANDOM_ALIASES = {
  "the apothecary diaries": ["the apothecary diaries", "kusuriya no hitorigoto", "kusuriya_no_hitorigoto", "薬屋のひとりごと", "apothecary diaries"],
  vocaloid: ["vocaloid", "ボーカロイド", "voiceroid"],
  "project sekai": ["project sekai", "project_sekai", "プロジェクトセカイ", "prsk", "pjsk", "hatsune miku: colorful stage!", "colorful stage"],
  "genshin impact": ["genshin impact", "genshin_impact", "原神", "genshin"],
  "honkai: star rail": ["honkai: star rail", "honkai_(series)", "honkai:_star_rail", "崩壊：スターレイル", "hsr"],
  frieren: ["frieren", "sousou no frieren", "sousou_no_frieren", "葬送のフリーレン", "frieren: beyond journey's end"],
  "witch hat atelier": ["witch hat atelier", "tongari boushi no atelier", "tongari_boushi_no_atelier", "とんがり帽子のアトリエ"],
  "bungo stray dogs": ["bungo stray dogs", "bungou stray dogs", "bungou_stray_dogs", "文豪ストレイドッグス"],
  "oshi no ko": ["oshi no ko", "oshi_no_ko", "【推しの子】", "推しの子"],
  "bocchi the rock!": ["bocchi the rock!", "bocchi the rock", "bocchi_the_rock!", "ぼっち・ざ・ろっく！"],
  "girls band cry": ["girls band cry", "girls_band_cry", "ガールズバンドクライ"],
  minecraft: ["minecraft", "マインクラフト"],
};
// Taste strings are matched literally by the scorer; keep the en dash in the classics era.
export const ERAS = {
  classics: "classics 2007–2013",
  modern: "modern hits",
  story: "rin & len story songs",
};
export const MERCH_TYPES = [
  "acrylic stands",
  "badges",
  "nendoroids",
  "scale figures",
  "prize figures",
  "plushies",
  "shirts",
  "pins",
  "figma",
  "gacha",
  "fashion collab",
  "beauty collab",
  "other goods",
];
export const MEME_FORMATS = ["pov", "me_when", "text_post", "reaction", "comic", "unhinged fandom"];
export const COSPLAY_FORMATS = ["photoshoot", "wig", "makeup", "wip", "transformation", "tutorial", "props"];
export const FASHION_STYLES = ["y2k", "skater streetwear", "sweet", "girly"];

function build(map) {
  const index = new Map();
  for (const [canonical, aliases] of Object.entries(map))
    for (const alias of [canonical, ...aliases]) index.set(alias.toLowerCase(), canonical);
  return index;
}
const characters = build(CHARACTER_ALIASES);
const units = build(UNIT_ALIASES);
for (const [code, unit] of Object.entries(UNIT_CODES)) units.set(code, unit);
const fandoms = build(FANDOM_ALIASES);
const pick = (index) => (values) =>
  [...new Set((values ?? []).map((v) => index.get(String(v).toLowerCase().trim())).filter(Boolean))];

/** Exact alias lookups; unknown names are dropped rather than invented as tags. */
export const canonicalCharacters = pick(characters);
export const canonicalUnits = pick(units);
export const canonicalFandoms = pick(fandoms);
export const canonicalVoicebanks = (values) =>
  canonicalCharacters(values).filter((c) => VOICEBANKS.includes(c));

/** Whole-word alias search in free text (titles, captions). Short aliases need word boundaries. */
export function mentions(text, map) {
  const haystack = ` ${String(text ?? "").toLowerCase()} `;
  const found = new Set();
  for (const [canonical, aliases] of Object.entries(map))
    for (const alias of [canonical, ...aliases]) {
      const a = alias.toLowerCase().replaceAll("_", " ");
      // Two-character CJK names (猫猫, 壬氏) are specific; short Latin aliases are not.
      const cjk = /[぀-ヿ㐀-鿿]/.test(a);
      if (a.length < 3 && !cjk) continue;
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (cjk ? haystack.includes(a) : new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(haystack)) {
        found.add(canonical);
        break;
      }
    }
  return [...found];
}
