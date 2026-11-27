// The play hub's bookkeeping (docs/refactor/RENOVATION.md, "Games"): stickers games give her, and
// which games each of them has opened (for the "new" mark). Both live in the kv table: her sticker
// collection under "stickers" (the same list the daily drawer adds to), and each person's played
// games under "play:played:<role>". Owner: the frame agent.
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { localDay } from "./time.js";
import { stickers as CATALOGUE } from "../content/birthday.js";

export const STICKER_ID = /^st-[a-z0-9-]{1,40}$/;
export const GAME_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const REASON_MAX = 80;
const PLAYED_MAX = 200;

const byId = new Map(CATALOGUE.map((sticker) => [sticker.id, sticker]));

async function readKv(db, key, fallback) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? fallback;
}

async function writeKv(db, key, value) {
  await db
    .insert(schema.kv)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
}

/** A sticker's card for the client: catalogue details when known, just the id otherwise. */
export const stickerCard = (id) => {
  const known = byId.get(id);
  return known ? { id, art: known.art, name: known.name, line: known.line } : { id, art: null, name: null, line: null };
};

/**
 * Gives her a sticker for something she did in a game. Idempotent per game + reason, so replaying
 * the same moment never adds it twice. Josh's sign-in only previews: nothing reaches her collection.
 */
export async function rewardSticker(db, role, { sticker, game, reason }) {
  const card = stickerCard(sticker);
  if (byId.get(sticker)?.birthdayOnly) return { saved: false, already: false, preview: false, refused: true, sticker: card };
  if (role !== "kiriya") return { saved: false, already: false, preview: true, sticker: card };
  const collection = await readKv(db, "stickers", []);
  const already = collection.some((entry) => entry.game === game && entry.reason === reason);
  if (already) return { saved: false, already: true, preview: false, sticker: card };
  const next = [...collection, { id: sticker, day: localDay(), game, reason, at: new Date().toISOString() }];
  await writeKv(db, "stickers", next);
  return { saved: true, already: false, preview: false, sticker: card, firstOfKind: !collection.some((entry) => entry.id === sticker) };
}

/** What the play hub needs: her collection (with details) and the games this person has opened. */
export async function playState(db, role) {
  const [collection, played] = await Promise.all([readKv(db, "stickers", []), readKv(db, `play:played:${role}`, [])]);
  const seen = new Set();
  const collected = [];
  for (const entry of collection) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const count = collection.filter((other) => other.id === entry.id).length;
    collected.push({ ...stickerCard(entry.id), day: entry.day ?? null, game: entry.game ?? null, count });
  }
  const catalogue = CATALOGUE.filter((sticker) => !sticker.birthdayOnly || seen.has(sticker.id)).map((sticker) => stickerCard(sticker.id));
  return { played: Array.isArray(played) ? played : [], collected, catalogue };
}

/** Marks a game opened by this person (the hub's "new" mark goes away). */
export async function markPlayed(db, role, game) {
  const played = await readKv(db, `play:played:${role}`, []);
  if (played.includes(game)) return played;
  const next = [...played, game].slice(-PLAYED_MAX);
  await writeKv(db, `play:played:${role}`, next);
  return next;
}
