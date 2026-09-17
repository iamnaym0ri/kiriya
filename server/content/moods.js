// PRIVATE. The daily check-in. Each mood re-balances the site's colours (the CSS only knows the
// colour key) and decides how the site refers to Kiriya that day.
// Field names avoid identity words on purpose: this data reaches the browser only after unlocking.

const SHE = { subject: "she", object: "her", possessive: "her" };
const THEY = { subject: "they", object: "them", possessive: "their" };
const HE = { subject: "he", object: "him", possessive: "his" };

export const MOODS = [
  {
    key: "rose",
    label: "Femme",
    face: "(˘‿˘)♡",
    hint: "your version of feminine",
    lean: "femme",
    address: { label: "she/her", primary: SHE, alternate: null },
  },
  {
    key: "iris",
    label: "Fluid",
    face: "(~‿~)",
    hint: "room to move between things",
    lean: "neutral",
    address: { label: "she/they", primary: SHE, alternate: THEY },
  },
  {
    key: "night",
    label: "Masc",
    face: "(¬‿¬)",
    hint: "your version of masculine",
    lean: "masc",
    address: { label: "he/him", primary: HE, alternate: null },
  },
  {
    key: "cloud",
    label: "Just me",
    face: "(^_^)",
    hint: "no labels today",
    lean: "neutral",
    address: { label: "she/they", primary: SHE, alternate: THEY },
  },
];

export const moodByKey = Object.fromEntries(MOODS.map((m) => [m.key, m]));

// Choices Kiriya can pick per mood in settings.
export const ADDRESS_OPTIONS = {
  "she/her": { label: "she/her", primary: SHE, alternate: null },
  "she/they": { label: "she/they", primary: SHE, alternate: THEY },
  "they/them": { label: "they/them", primary: THEY, alternate: null },
  "he/him": { label: "he/him", primary: HE, alternate: null },
  "he/they": { label: "he/they", primary: HE, alternate: THEY },
  "any/all": { label: "any/all", primary: THEY, alternate: SHE },
};

export const FEELINGS = [
  { key: "happy", label: "Happy", emoji: "😊", hint: "life is kinda cute rn", response: "orchid pink petals for a good little day ♡" },
  { key: "content", label: "Content", emoji: "😌", hint: "comfy. no plot twists pls", response: "soft sage and slow little leaves. absolutely no rush." },
  { key: "excited", label: "Excited", emoji: "🤩", hint: "physically cannot be normal", response: "golden hour confetti. big main-character energy." },
  { key: "sad", label: "Sad", emoji: "🥺", hint: "need a hug, not a lecture", response: "soft blue and gentle rain. you don’t have to perform happy here." },
  { key: "angry", label: "Angry", emoji: "😤", hint: "my patience has left the chat", response: "a rosy red glow. your feelings get room, too." },
  { key: "anxious", label: "Anxious", emoji: "😰", hint: "brain has 47 tabs open", response: "calm periwinkle, slow little bubbles. one thing at a time." },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😵‍💫", hint: "everything is a bit too loud", response: "quiet grey, just a few soft lights. less to take in." },
  { key: "playful", label: "Playful", emoji: "😏", hint: "a little menace, respectfully", response: "candy pink mischief, hearts bouncing about." },
];
export const feelingByKey = Object.fromEntries(FEELINGS.map(feeling => [feeling.key, feeling]));
export const ENERGY_LEVELS = [
  { label: "kindly fuck off", face: "(-_-)", comment: "with love, leave me tf alone. even a ‘hey’ is doing too much rn." },
  { label: "Im not trynna hear allat", face: "(－ω－)", comment: "i did not order a podcast. short version pls, my last brain cell is on break." },
  { label: "mmm i could talk", face: "(•‿•)", comment: "depends... is the tea worth it? i could be convinced to form a sentence." },
  { label: "Feeling good, whatsupp!", face: "(^▽^)", comment: "heyyy, what’s the plan? im down to talk, laugh, and hear all ur random lore." },
  { label: "Holly yapping", face: "\\(^o^)/", comment: "u said ‘hey’ and unlocked a 3-hour yap session. get comfy, this story has side quests." },
];
export const ENERGY_LABELS = ENERGY_LEVELS.map(level => level.label);
