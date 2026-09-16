// Personal daily features only. External discoveries and songs come from published feeds.
import { seededRandom, pickFresh } from "./pick.js";
import {
  collectionCards,
  COLLECTION_VERSION,
  approvedSubjects,
  approvedTwists,
  ocPrompts,
} from "../content/collection.js";
import { greetings } from "../content/voice.js";
import { birthdayWeekNotes, stickers } from "../content/birthday.js";
export function composeDay(
  day,
  { recent = {}, birthday = {}, notes = [], signature = "Josh <3" } = {},
) {
  const used = [];
  const choose = (key, pool, idOf = (x) => x.id) => {
    const [item] = pickFresh(pool, {
      recentIds: recent[key] ?? [],
      random: seededRandom(day, key),
      id: idOf,
    });
    if (item) used.push(`${key}:${idOf(item)}`);
    return item;
  };
  const cards = [];
  const random = seededRandom(day, "art-prompt");
  const prompt =
    random() < 0.35
      ? ocPrompts[Math.floor(random() * ocPrompts.length)]
      : `Draw ${approvedSubjects[Math.floor(random() * approvedSubjects.length)]}, ${approvedTwists[Math.floor(random() * approvedTwists.length)]}.`;
  const art = choose("art", collectionCards.art);
  cards.push({
    ...art,
    body: prompt,
    extra: { tip: art.body, source: art.source ?? null },
    source: null,
  });
  const note =
    notes.length && seededRandom(day, "josh-note")() < 0.4
      ? choose("note", notes)
      : null;
  if (note)
    cards.push({
      id: `note:${note.id}`,
      kind: "special",
      title: `From ${signature}`,
      body: note.text,
    });
  const greetingSet = Object.fromEntries(
    ["morning", "afternoon", "evening", "late"].map((key) => [
      key,
      greetings[key][
        Math.floor(seededRandom(day, `g-${key}`)() * greetings[key].length)
      ],
    ]),
  );
  if (birthday.isBirthday) greetingSet.birthday = greetings.birthday[0];
  const sticker = choose(
    "sticker",
    stickers.filter(
      (s) => s.art !== "pointe" && (!s.birthdayOnly || birthday.isBirthday),
    ),
  );
  const pushes = [
    {
      category: "maomao",
      title: "A little apothecary note",
      body: "Come spend a little time in your Maomao corner.",
      navigate: "/world/apothecary",
    },
    {
      category: "vocaloid",
      title: "A little music for your day",
      body: "A little time for your music shelf, whenever you feel like it.",
      navigate: "/world/stage",
    },
    note
      ? {
          category: "note",
          title: "A note is waiting for you",
          body: "Open your world for a little message.",
          navigate: "/world",
        }
      : {
          category: "art",
          title: "A page for your imagination",
          body: "A little drawing prompt is waiting in your sketchbook.",
          navigate: "/world/art",
        },
  ].map((p) => ({ ...p, collectionVersion: COLLECTION_VERSION }));
  return {
    day,
    collectionVersion: COLLECTION_VERSION,
    writer: "template",
    greetings: greetingSet,
    cards,
    song: null,
    drawer: { kind: "sticker", sticker },
    birthdayNote: birthday.isBirthdayWeek
      ? (birthdayWeekNotes.find((n) => n.day === birthday.dayOfWeek) ?? null)
      : null,
    pushes,
    used,
  };
}
