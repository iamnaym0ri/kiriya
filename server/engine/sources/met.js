// The Met's Open Access API: public-domain artwork with images, picked around Kiriya's interests.
import { getJson } from "../../lib/http.js";
import { seededRandom, shuffle } from "../pick.js";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";
const SEARCH = "https://collectionapi.metmuseum.org/public/collection/v1.1/search";

export const ART_THEMES = [
  { query: "Degas dancers", why: "ballet" },
  { query: "ballet", why: "ballet" },
  { query: "cat", why: "a very Maomao subject" },
  { query: "cherry blossoms", why: "Senbonzakura energy" },
  { query: "butterfly", why: "pretty and a little eerie" },
  { query: "medicinal plants", why: "apothecary research" },
  { query: "peony", why: "your palette in flower form" },
  { query: "moon", why: "night-owl drawing mood" },
  { query: "kimono", why: "costume design reference" },
  { query: "theater mask", why: "cosplay inspiration" },
  { query: "wisteria", why: "purple, obviously" },
  { query: "musical instrument", why: "for the singer" },
];

/** Picks today's theme and a public-domain object with an image. Tries a few candidates. */
export async function fetchArtworkOfTheDay(day) {
  const random = seededRandom(day, "met-artwork");
  const theme = ART_THEMES[Math.floor(random() * ART_THEMES.length)];
  const search = await getJson(`${SEARCH}?q=${encodeURIComponent(theme.query)}&hasImages=true`);
  const ids = shuffle((search.objectIDs ?? []).slice(0, 80), random).slice(0, 8);

  for (const id of ids) {
    const object = await getJson(`${API}/objects/${id}`).catch(() => null);
    if (object?.isPublicDomain && object.primaryImageSmall) {
      return {
        id: object.objectID,
        title: object.title || "Untitled",
        artist: object.artistDisplayName || object.culture || "Unknown artist",
        date: object.objectDate || null,
        medium: object.medium || null,
        image: object.primaryImageSmall,
        imageLarge: object.primaryImage || object.primaryImageSmall,
        url: object.objectURL,
        theme: theme.query,
        why: theme.why,
      };
    }
  }
  return null;
}
