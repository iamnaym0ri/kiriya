// Finite editorial collection. No feeds, ranking, tracking or AI approval.
// Source checks and deliberately selected entries: docs/redesign/ASSETS.md.
import { maomaoFacts } from "./pools/maomao.js";
import { vocaloidLore } from "./pools/vocaloid.js";
import { cosplayTips } from "./pools/cosplay.js";
import { artTips, promptSubjects, promptTwists } from "./pools/art.js";
import { defaultSong } from "./publicProfile.js";
export const COLLECTION_VERSION = 2;
export const approvedMaomao = maomaoFacts.filter((f) =>
  [
    "mm-name",
    "mm-freckles",
    "mm-fingerprints",
    "mm-cat",
    "mm-blue-roses",
    "mm-luomen",
    "mm-princesses",
    "mm-voices",
    "mm-exam",
    "mm-lakan-father",
    "mm-luomen-uncle",
  ].includes(f.id),
);
export const approvedVocaloid = vocaloidLore.filter((f) =>
  [
    "vl-miku-name",
    "vl-miku-birthday",
    "vl-miku-voice",
    "vl-kagamine-name",
    "vl-rinlen-release",
    "vl-rinlen-voice",
    "vl-magical-mirai",
    "vl-snow-miku",
  ].includes(f.id),
);
export const approvedCosplay = [
  ...cosplayTips.filter((f) =>
    ["cp-worbla-scraps", "cp-repair-kit"].includes(f.id),
  ),
  {
    id: "cp-wrap-skirt",
    topic: "costume",
    text: "SajaLyn added more overlap to her next wrap skirt after her first opened when walking. Try moving in a costume before you finish the seams.",
    source:
      "https://sajalyn.com/wickelrock-hanfu-naehen-mein-cosplay-fuer-die-tagebuecher-der-apothekerin/",
  },
  {
    id: "cp-wig-detangle",
    topic: "wigs",
    text: "For long wigs, work on a small section at a time, starting at the ends and moving upward. Give Miku’s twin tails a little patience.",
    source: "https://arda-wigs.com/pages/faq",
  },
];
export const approvedArtTips = artTips
  .filter((f) =>
    [
      "at-alpha-lock",
      "at-clipping",
      "at-values",
      "at-through",
      "at-limited",
    ].includes(f.id),
  )
  .map((f) => ({
    ...f,
    source:
      f.medium === "procreate"
        ? "https://help.procreate.com/procreate/handbook/layers/layers-mask"
        : null,
  }));
export const approvedSubjects = promptSubjects.filter(
  (s) =>
    !/ballerina|pointe|poison|herbs|medicine|mushroom|skater outfit/i.test(s),
);
export const approvedTwists = promptTwists.filter((s) => !/minutes/.test(s));
export const ocPrompts = [
  "Draw your OC with one Maomao-inspired accessory.",
  "Try a Miku outfit in your OC’s silhouette.",
  "Draw three expressions for an OC, with one surprising detail in each.",
];
export const musicPicks = [
  {
    ...defaultSong,
    key: "senbonzakura",
    source: "https://www.youtube.com/watch?v=shs0rAiwsGQ",
    thumbnail: "/images/song-senbonzakura.webp",
  },
  {
    key: "crystal-snow",
    kind: "link",
    provider: "youtube",
    embedId: "QcHZdiVD0Ww",
    url: "https://www.youtube.com/watch?v=QcHZdiVD0Ww",
    title: "Crystal Snow",
    artist: "Aqu3ra feat. Hatsune Miku",
    thumbnail: "/images/song-crystal-snow.webp",
    source: "https://snowmiku.com/2025/special.html",
  },
  {
    key: "fondant-step",
    kind: "link",
    provider: "youtube",
    embedId: "vNhvnj33foU",
    url: "https://www.youtube.com/watch?v=vNhvnj33foU",
    title: "Fondant Step",
    artist: "Heavenz feat. Hatsune Miku",
    thumbnail: "/images/song-fondant-step.webp",
    source: "https://snowmiku.com/2021/special.html",
  },
];
export const collectionCards = {
  maomao: approvedMaomao.map((f) => ({
    id: `maomao:${f.id}`,
    kind: "maomao",
    title: "Maomao file",
    body: f.text,
    spoiler: f.spoiler === "manga" ? "manga" : null,
    source: f.source,
  })),
  vocaloid: approvedVocaloid.map((f) => ({
    id: `vocaloid:${f.id}`,
    kind: "vocaloid",
    title: "Between songs",
    body: f.text,
    source: f.source,
  })),
  cosplay: approvedCosplay.map((f) => ({
    id: `cosplay:${f.id}`,
    kind: "cosplay",
    title: "From the sewing table",
    body: f.text,
    source: f.source,
  })),
  art: [
    ...ocPrompts.map((body, i) => ({
      id: `art:oc-${i}`,
      kind: "art",
      title: "An OC prompt",
      body,
    })),
    ...approvedArtTips.map((f) => ({
      id: `art:${f.id}`,
      kind: "art",
      title: "A sketchbook note",
      body: f.text,
      source: f.source,
    })),
  ],
};
export const isApprovedPush = (p) =>
  p?.collectionVersion === COLLECTION_VERSION &&
  ["maomao", "vocaloid", "art", "cosplay", "note"].includes(p.category) &&
  /^\/world(?:\/(?:apothecary|stage|art|atelier|letters))?$/.test(
    p.navigate ?? "",
  );
