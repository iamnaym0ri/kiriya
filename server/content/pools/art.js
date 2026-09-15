// PRIVATE pool. Drawing prompts are built from parts, so they rarely repeat; tips cover both
// Procreate and paper.

export const promptSubjects = [
  "Maomao sorting herbs by lamplight",
  "Miku, Rin and Len as apothecary apprentices",
  "the little calico kitten from this site, wearing a tiny wig",
  "a medicine cabinet where every drawer holds a different season",
  "Lynette mid-magic-trick",
  "a ballerina whose tutu is made of ribbons",
  "your OC in full jirai kei",
  "a Harajuku street at dawn, before the shops open",
  "a teacup that is definitely poisoned",
  "a Snow Miku-style winter redesign of a character you love",
  "a character you love, redesigned in purple and pink",
  "your own hand holding your favourite brush",
  "a pointe shoe still life",
  "a butterfly with stained-glass wings",
  "a cosplay you want to make next, as a design sheet",
  "Maomao's face when someone says “it's just a mushroom”",
  "a stage lit for a Vocaloid concert, from the crowd",
  "your perfect skater outfit, as a fashion flat",
  "a cat napping on a pile of sketchbooks",
  "a bouquet made only of poisonous flowers",
];

export const promptTwists = [
  "using only three colours",
  "in 15 minutes, then stop",
  "without lifting your pen for the first sketch",
  "with shapes only, no outlines",
  "from a worm's-eye view",
  "as a sticker sheet",
  "in chibi proportions",
  "silhouette first, details last",
  "with dramatic rim lighting",
  "in the style of a vintage poster",
  "with one bold accent colour and everything else greyscale",
  "as a tiny comic in three panels",
];

export const artTips = [
  { id: "at-alpha-lock", medium: "procreate", text: "Alpha Lock: swipe right with two fingers on a layer, and you can only paint where there's already paint. Perfect for recolouring lineart." },
  { id: "at-clipping", medium: "procreate", text: "Clipping Mask keeps shading on its own layer without spilling outside the base colours, and you can change your mind later." },
  { id: "at-reference", medium: "procreate", text: "Set your lineart layer to Reference, then ColorDrop on the colour layer below. The fill respects the lines on the other layer." },
  { id: "at-quickshape", medium: "procreate", text: "Hold your pencil at the end of a stroke and QuickShape snaps it into a clean line, ellipse or arc." },
  { id: "at-streamline", medium: "procreate", text: "Turn up StreamLine on your inking brush for smoother lines on long curves like hair." },
  { id: "at-flip", medium: "procreate", text: "Flip the canvas horizontally every so often (Actions → Canvas). Mistakes you've gone blind to jump right out." },
  { id: "at-liquify", medium: "procreate", text: "Liquify's Push tool fixes a slightly-off eye or jaw faster than redrawing it." },
  { id: "at-symmetry", medium: "procreate", text: "Drawing Guide → Symmetry makes accessories, armour and ornaments twice as fast." },
  { id: "at-gradient-map", medium: "procreate", text: "Try a Gradient Map adjustment on a finished piece. It can turn a flat colour scheme moody in one move." },
  { id: "at-gesture", medium: "traditional", text: "Warm up with 30-second gesture drawings. Aim for movement, not accuracy." },
  { id: "at-values", medium: "traditional", text: "Before colour, do a tiny three-value thumbnail: light, middle, dark. If it reads there, it'll read in colour." },
  { id: "at-thumbnails", medium: "traditional", text: "Thumbnail six tiny layouts before committing. The fourth one is usually the good one." },
  { id: "at-limited", medium: "traditional", text: "Limit yourself to one warm, one cool and one neutral. Constraints make colour choices look deliberate." },
  { id: "at-through", medium: "traditional", text: "Draw through forms: sketch the hidden side of a shape lightly so the object feels solid." },
];
