// PRIVATE. The daily check-in. Each mood re-balances the site's colours (the CSS only knows the
// colour key), picks outfit ideas, and decides how the site refers to Kiriya that day.
// Field names avoid identity words on purpose: this data reaches the browser only after unlocking.

const SHE = { subject: "she", object: "her", possessive: "her" };
const THEY = { subject: "they", object: "them", possessive: "their" };
const HE = { subject: "he", object: "him", possessive: "his" };

export const MOODS = [
  {
    key: "rose",
    label: "Femme",
    hint: "ribbons, lace, all the soft things",
    lean: "femme",
    address: { label: "she/her", primary: SHE, alternate: null },
  },
  {
    key: "iris",
    label: "Fluid",
    hint: "a little of everything",
    lean: "neutral",
    address: { label: "she/they", primary: SHE, alternate: THEY },
  },
  {
    key: "night",
    label: "Masc",
    hint: "baggy fits, sharp edges",
    lean: "masc",
    address: { label: "he/him", primary: HE, alternate: null },
  },
  {
    key: "cloud",
    label: "Just me",
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

export const ENERGY_LABELS = ["running on fumes", "a bit sleepy", "doing okay", "feeling good", "unstoppable"];
