// PRIVATE pool. Outfit pieces tagged by vibe and lean, so each mood gets its own look. Singapore is
// warm all year with frequent showers, so every piece is tagged for heat and rain.
// vibe: kawaii | jirai | skater | y2k    lean: femme | neutral | masc    weather: hot | rain | aircon

export const fashionPieces = {
  top: [
    { name: "pastel cardigan with heart buttons", vibe: "kawaii", lean: "femme", weather: ["aircon"] },
    { name: "baby tee with a Miku print", vibe: "y2k", lean: "neutral", weather: ["hot"] },
    { name: "black blouse with lace trim", vibe: "jirai", lean: "femme", weather: ["aircon"] },
    { name: "oversized lilac graphic tee", vibe: "skater", lean: "neutral", weather: ["hot", "rain"] },
    { name: "boxy charcoal button-up, sleeves rolled", vibe: "skater", lean: "masc", weather: ["hot"] },
    { name: "striped long-sleeve under a band tank", vibe: "y2k", lean: "neutral", weather: ["aircon"] },
    { name: "sleeveless cropped hoodie", vibe: "skater", lean: "neutral", weather: ["hot"] },
    { name: "ribbon-tie blouse in soft pink", vibe: "jirai", lean: "femme", weather: ["hot"] },
    { name: "mesh top over a black camisole", vibe: "y2k", lean: "femme", weather: ["hot"] },
    { name: "loose white shirt with a skinny purple tie", vibe: "jirai", lean: "masc", weather: ["hot", "aircon"] },
    { name: "puff-sleeve top with strawberry print", vibe: "kawaii", lean: "femme", weather: ["hot"] },
    { name: "big washed-black hoodie", vibe: "skater", lean: "masc", weather: ["aircon", "rain"] },
  ],
  bottom: [
    { name: "black pleated mini skirt", vibe: "jirai", lean: "femme", weather: ["hot"] },
    { name: "wide-leg cargo pants", vibe: "skater", lean: "masc", weather: ["aircon", "rain"] },
    { name: "denim shorts with a chain", vibe: "y2k", lean: "neutral", weather: ["hot"] },
    { name: "tiered ruffle skirt in lavender", vibe: "kawaii", lean: "femme", weather: ["hot"] },
    { name: "baggy jorts", vibe: "skater", lean: "masc", weather: ["hot", "rain"] },
    { name: "bike shorts under a tulle skirt", vibe: "kawaii", lean: "neutral", weather: ["hot"] },
    { name: "plaid skirt with a belt chain", vibe: "y2k", lean: "femme", weather: ["hot", "aircon"] },
    { name: "black parachute pants", vibe: "skater", lean: "neutral", weather: ["rain", "aircon"] },
  ],
  shoes: [
    { name: "platform Mary Janes", vibe: "jirai", lean: "femme", weather: ["hot", "aircon"] },
    { name: "chunky skate shoes", vibe: "skater", lean: "neutral", weather: ["hot"] },
    { name: "white canvas high-tops", vibe: "y2k", lean: "neutral", weather: ["hot", "aircon"] },
    { name: "clear jelly sandals", vibe: "kawaii", lean: "femme", weather: ["hot", "rain"] },
    { name: "black slip-on sneakers", vibe: "skater", lean: "masc", weather: ["hot", "rain"] },
    { name: "platform sandals with ankle straps", vibe: "y2k", lean: "femme", weather: ["hot", "rain"] },
  ],
  accessory: [
    { name: "heart-shaped crossbody bag", vibe: "kawaii", lean: "femme" },
    { name: "silver chain necklace", vibe: "y2k", lean: "neutral" },
    { name: "ribbon choker", vibe: "jirai", lean: "femme" },
    { name: "bucket hat", vibe: "skater", lean: "neutral" },
    { name: "a handful of star hair clips", vibe: "kawaii", lean: "neutral" },
    { name: "black cap worn backwards", vibe: "skater", lean: "masc" },
    { name: "ballet-pink leg warmers (balletcore)", vibe: "kawaii", lean: "femme" },
    { name: "layered rings and one cross earring", vibe: "jirai", lean: "neutral" },
    { name: "tiny Miku keychain on your bag", vibe: "y2k", lean: "neutral" },
    { name: "a skinny belt with a heart buckle", vibe: "jirai", lean: "neutral" },
  ],
};

export const VIBE_NAMES = {
  kawaii: "Harajuku sweet",
  jirai: "sweet goth",
  skater: "skater comfort",
  y2k: "Y2K alt",
};

export const weatherNotes = {
  hot: "It's properly hot: breathable fabrics and something to hold your water.",
  rain: "Showers likely: quick-drying pieces, shoes that don't mind puddles, and a compact umbrella.",
  aircon: "Aircon will be freezing indoors, so bring a light layer.",
};
