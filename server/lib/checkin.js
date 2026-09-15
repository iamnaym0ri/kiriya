import { eq, sql } from "drizzle-orm";
import { schema } from "../db/client.js";
import { ADDRESS_OPTIONS, ENERGY_LABELS, ENERGY_LEVELS, FEELINGS, feelingByKey, MOODS, moodByKey } from "../content/moods.js";

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
function addressWrite(db, key, option) {
  const patch = { [key]: option };
  return db.insert(schema.settings).values({ key: "address_overrides", value: patch }).onConflictDoUpdate({
    target: schema.settings.key,
    set: { value: sql`${schema.settings.value} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() },
  });
}
export async function saveAddressPreference(db, key, option) {
  await addressWrite(db, key, option);
}
export async function readCheckin(db, day) {
  const [[row], [setting], [feelingSetting]] = await Promise.all([
    db.select().from(schema.moods).where(eq(schema.moods.day, day)),
    db.select().from(schema.settings).where(eq(schema.settings.key, "address_overrides")),
    db.select().from(schema.settings).where(eq(schema.settings.key, `daily_feeling:${day}`)),
  ]);
  const overrides = setting?.value ?? {};
  const choices = MOODS.map(mood => ({ key: mood.key, label: mood.label, hint: mood.hint, face: mood.face,
    address: ADDRESS_OPTIONS[overrides[mood.key]?.label] ?? mood.address }));
  const choice = choices.find(mood => mood.key === row?.mood);
  const feeling = FEELINGS.find(item => item.key === feelingSetting?.value?.key) ?? null;
  const current = choice ? { ...choice, energy: row.energy ?? 2, feeling } : null;
  return { day, current, choices, feelings: FEELINGS, energyLevels: ENERGY_LEVELS, energyLabels: ENERGY_LABELS, addressOptions: Object.keys(ADDRESS_OPTIONS),
    copy: current ? checkinCopy(current.address) : null,
    labels: { title: "Whay u feeling like today ;)", hint: "your presentation, your mood, your amount of yap. all yours.", presentation: "How you’re presenting", address: "Pronouns for today", addressHint: "Always your choice. Remembered for this presentation." },
  };
}
export async function saveCheckin(db, day, { mood, energy = 2, address, feeling }) {
  if (!Object.hasOwn(moodByKey, mood) || !Number.isInteger(energy) || energy < 0 || energy > 4 || (address !== undefined && !Object.hasOwn(ADDRESS_OPTIONS, address)) || (feeling !== undefined && feeling !== null && !Object.hasOwn(feelingByKey, feeling))) throw new Error("Invalid daily choice");
  const dayWrite = tx => tx.insert(schema.moods).values({ day, mood, energy }).onConflictDoUpdate({ target: schema.moods.day, set: { mood, energy, updatedAt: new Date() } });
  // Keep each day's feeling separately, without repurposing an existing personal note.
  const feelingWrite = tx => tx.insert(schema.settings).values({ key: `daily_feeling:${day}`, value: { key: feeling } }).onConflictDoUpdate({ target: schema.settings.key, set: { value: { key: feeling }, updatedAt: new Date() } });
  // Neon HTTP supports transactional batches, rather than interactive transactions.
  if (typeof db.batch === "function") {
    await db.batch([...(address ? [addressWrite(db, mood, ADDRESS_OPTIONS[address])] : []), ...(feeling !== undefined ? [feelingWrite(db)] : []), dayWrite(db)]);
  } else {
    await db.transaction(async tx => {
      if (address) await saveAddressPreference(tx, mood, ADDRESS_OPTIONS[address]);
      if (feeling !== undefined) await feelingWrite(tx);
      await dayWrite(tx);
    });
  }
  return readCheckin(db, day);
}
