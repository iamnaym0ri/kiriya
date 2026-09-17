import { desc, eq, lte } from "drizzle-orm";
import { schema } from "../db/client.js";
import { ADDRESS_OPTIONS, ENERGY_LABELS, ENERGY_LEVELS, FEELINGS, feelingByKey, MOODS, moodByKey } from "../content/moods.js";
import { readPersonState, updatePersonState } from "./personState.js";

export function checkinCopy(address) {
  const single = address?.alternate ? null : address?.primary?.subject;
  const person = single === "he" ? "boy" : single === "she" ? "girl" : "star";
  const apothecary = single === "he" ? "mister apothecary" : single === "she" ? "miss apothecary" : "my apothecary";
  return {
    portraitAlt: `Kiriya, the birthday ${person}`,
    portraitCaption: `the birthday ${person} this whole little world is for ♡`,
    birthdayStamp: `🎂 SEPTEMBER ${person.toUpperCase()}`,
    ownWorld: `a world of ${single === "he" ? "his" : single === "she" ? "her" : "their"} own`,
    apothecary,
    birthdayCaption: `Happy birthday ${apothecary}💕`,
    example: single === "he" ? "He belongs here, exactly as he is." : single === "she" ? "She belongs here, exactly as she is." : "They belong here, exactly as they are.",
  };
}

// Kiriya's check-ins used to be kept per day, with address preferences in settings. Until she saves
// a choice in person_state, her most recent earlier check-in still counts as how she is.
async function legacyChoices(db, day) {
  const [[row], [overrides]] = await Promise.all([
    db.select().from(schema.moods).where(lte(schema.moods.day, day)).orderBy(desc(schema.moods.day)).limit(1),
    db.select().from(schema.settings).where(eq(schema.settings.key, "address_overrides")),
  ]);
  const address = Object.fromEntries(
    Object.entries(overrides?.value ?? {})
      .filter(([mood, option]) => Object.hasOwn(moodByKey, mood) && Object.hasOwn(ADDRESS_OPTIONS, option?.label))
      .map(([mood, option]) => [mood, option.label]),
  );
  if (!row) return { status: null, address };
  const [feeling] = await db.select().from(schema.settings).where(eq(schema.settings.key, `daily_feeling:${row.day}`));
  return {
    status: { mood: row.mood, energy: row.energy ?? 2, feeling: feeling?.value?.key ?? null, setAt: row.updatedAt?.toISOString() ?? null, day: row.day },
    address,
  };
}

async function choicesOf(db, state, day) {
  let { status } = state;
  let address = state.prefs.address;
  if (state.person === "kiriya" && (!status || !address)) {
    const legacy = await legacyChoices(db, day);
    status ??= legacy.status;
    address ??= legacy.address;
  }
  return { status, address: address ?? {} };
}

/** How the site sees this person right now: the latest check-in stays until they change it. */
export function describeCheckin(day, { status, address }) {
  const choices = MOODS.map((mood) => ({
    key: mood.key,
    label: mood.label,
    hint: mood.hint,
    face: mood.face,
    address: ADDRESS_OPTIONS[address[mood.key]] ?? mood.address,
  }));
  const choice = choices.find((mood) => mood.key === status?.mood);
  const feeling = FEELINGS.find((item) => item.key === status?.feeling) ?? null;
  const energy = Number.isInteger(status?.energy) && status.energy >= 0 && status.energy <= 4 ? status.energy : 2;
  const current = choice ? { ...choice, energy, feeling, setAt: status.setAt ?? null, setDay: status.day ?? null } : null;
  return {
    day,
    current,
    choices,
    feelings: FEELINGS,
    energyLevels: ENERGY_LEVELS,
    energyLabels: ENERGY_LABELS,
    addressOptions: Object.keys(ADDRESS_OPTIONS),
    copy: current ? checkinCopy(current.address) : null,
    labels: {
      title: "Whay u feeling like today ;)",
      hint: "your presentation, your mood, your amount of yap. all yours.",
      presentation: "How you’re presenting",
      address: "Pronouns",
      addressHint: "Always your choice. Remembered for this presentation.",
      kept: "stays just like this until you change it ♡",
    },
  };
}

/** The check-in for an already-loaded person_state row. */
export async function checkinFor(db, state, day) {
  return describeCheckin(day, await choicesOf(db, state, day));
}

export async function readCheckin(db, day, person = "kiriya") {
  return checkinFor(db, await readPersonState(db, person), day);
}

export async function saveAddressPreference(db, mood, label, person = "kiriya") {
  if (!Object.hasOwn(moodByKey, mood) || !Object.hasOwn(ADDRESS_OPTIONS, label)) throw new Error("Invalid address choice");
  await updatePersonState(db, person, async (state) => {
    const { address } = await choicesOf(db, state, "9999-12-31");
    return { prefs: { ...state.prefs, address: { ...address, [mood]: label } } };
  });
}

export async function saveCheckin(db, day, { mood, energy = 2, address, feeling }, person = "kiriya", now = new Date()) {
  if (!Object.hasOwn(moodByKey, mood) || !Number.isInteger(energy) || energy < 0 || energy > 4 || (address !== undefined && !Object.hasOwn(ADDRESS_OPTIONS, address)) || (feeling !== undefined && feeling !== null && !Object.hasOwn(feelingByKey, feeling))) throw new Error("Invalid daily choice");
  const saved = await updatePersonState(db, person, async (state) => {
    const previous = await choicesOf(db, state, day);
    return {
      // Older clients send no feeling; they keep the one already chosen.
      status: { mood, energy, feeling: feeling === undefined ? (previous.status?.feeling ?? null) : feeling, setAt: now.toISOString(), day },
      prefs: { ...state.prefs, address: { ...previous.address, ...(address ? { [mood]: address } : {}) } },
    };
  });
  return checkinFor(db, { ...saved, prefs: saved.prefs ?? {} }, day);
}
