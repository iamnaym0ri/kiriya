// The little characters who can live on her home screen in the app (docs/refactor/RENOVATION.md).
// Shared by the server (her saved pick, server/lib/personState.js) and the app
// (src/world/companions/). The order here is the order she sees in her settings. PLAVE's member
// is officially romanised "BAMBY"; the id stays "bambi".
export const COMPANIONS = [
  { id: "maomao", name: "Maomao", from: "The Apothecary Diaries" },
  { id: "miku-rotten", name: "Miku", from: "Confessions of a Rotten Girl" },
  { id: "bambi", name: "Bamby", from: "PLAVE" },
  { id: "miku", name: "Hatsune Miku", from: "VOCALOID" },
  { id: "kaito", name: "KAITO", from: "VOCALOID" },
];

export const COMPANION_IDS = COMPANIONS.map((companion) => companion.id);
export const companionById = Object.fromEntries(COMPANIONS.map((companion) => [companion.id, companion]));
