// Intentional seed pictures only. No fixed lore, news or song recommendations.
const images = {
  "maomao": [
    {
      "url": "/images/maomao-dramatic.webp",
      "aspect": "16 / 9",
      "alt": "A teal, pink and violet portrait of Maomao",
      "credit": "Supplied portrait · Yen123412 marks retained"
    },
    {
      "url": "/images/maomao-floral.webp",
      "alt": "Maomao in pink and green among pale flowers",
      "credit": "Supplied floral portrait · artist unverified"
    }
  ],
  "miku": [
    {
      "url": "/images/miku.webp",
      "alt": "Hatsune Miku with her long teal twin tails",
      "credit": "Art by KEI · © Crypton Future Media, Inc. 2007 · CC BY-NC 3.0"
    },
    {
      "url": "/images/rin.webp",
      "alt": "Kagamine Rin with her white bow",
      "credit": "Art by KEI · © Crypton Future Media, Inc. 2007 · CC BY-NC 3.0"
    }
  ]
};

export const curations = Object.fromEntries(Object.entries(images).map(([kind, pictures]) => [kind, pictures.map((image, index) => ({
  id: `picture:${kind}:${index}`,
  label: "FROM THE PICTURE ALBUM",
  title: image.alt,
  image,
  source: image.url,
  sourceLabel: "Open saved picture",
  tag: "saved picture",
}))]));
