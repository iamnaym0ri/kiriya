import { and, eq, sql } from "drizzle-orm";
import { schema } from "../db/client.js";
import { stickers as drawerStickers } from "../content/birthday.js";
import {
  CHARMS, CHARM_RARITIES, FORTUNES, FORTUNE_LEVELS, LUCKY_COLOURS, LUCKY_THINGS, LUCK_STICKERS, charmById, fortuneById,
} from "../content/luck.js";

// The luck shelf's per-person state (docs/refactor/RENOVATION.md, "Games"): the capsule machine's
// daily turns and charm book, the daily fortune slip and its keepsakes, best streaks, and the
// golden lantern's spare capsule coin. One kv row per person (`games-luck:<role>`), updated with a
// revision check so two quick taps, or two devices at once, can never double-dip.

export const CAPSULE_TURNS_PER_DAY = 3;
export const CAPSULE_STICKER_CHANCE = 0.2; // per turn, and never more than one sticker capsule a day
export const UNOWNED_CHARM_WEIGHT = 3; // charms she hasn't found yet come out a little more often
export const STREAK_GAMES = ["cups", "cards"];
const KEEP_PULLS = 40;
const KEEP_FORTUNES = 400;
const NO_REPEAT_FORTUNES = 30;

export const CAPSULE_COLOURS = ["lilac", "pink", "mint", "butter"];
export const STICKER_POOL = [
  ...drawerStickers.filter((sticker) => !sticker.birthdayOnly),
  ...LUCK_STICKERS,
];
const stickerById = (id) => STICKER_POOL.find((sticker) => sticker.id === id) ?? null;

const keyFor = (role) => `games-luck:${role}`;

export function blankLuck() {
  return {
    rev: 0,
    capsule: { day: null, used: 0, bonus: 0, stickerDay: null, pulls: [], charms: {}, stickers: [] },
    fortune: { history: [] },
    best: { cups: 0, cards: 0 },
    lanterns: { coinDay: null, coins: 0 },
  };
}

/** Fills in anything an older saved state lacks, so new fields never break old rows. */
export function normaliseLuck(value) {
  const blank = blankLuck();
  const v = value && typeof value === "object" ? value : {};
  return {
    rev: Number.isInteger(v.rev) ? v.rev : 0,
    capsule: { ...blank.capsule, ...v.capsule },
    fortune: { ...blank.fortune, ...v.fortune },
    best: { ...blank.best, ...v.best },
    lanterns: { ...blank.lanterns, ...v.lanterns },
  };
}

export async function readLuck(db, role) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, keyFor(role)));
  return { state: normaliseLuck(row?.value), exists: Boolean(row) };
}

/**
 * Applies `change(state)` → `{ state?, result }` with a revision check, retrying when another
 * request saved first. Returning no `state` means nothing changed (nothing is written).
 */
export async function updateLuck(db, role, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readLuck(db, role);
    const { state, result } = await change(structuredClone(current.state));
    if (!state) return result;
    const next = { ...state, rev: current.state.rev + 1 };
    const key = keyFor(role);
    const [row] = current.exists
      ? await db
          .update(schema.kv)
          .set({ value: next, updatedAt: new Date() })
          .where(and(eq(schema.kv.key, key), sql`coalesce((${schema.kv.value}->>'rev')::int, 0) = ${current.state.rev}`))
          .returning()
      : await db.insert(schema.kv).values({ key, value: next }).onConflictDoNothing().returning();
    if (row) return result;
  }
  throw Object.assign(new Error("Two taps landed at once. Try again."), { status: 409 });
}

/** The capsule counters for `day`: yesterday's turns and spare coins don't carry over. */
export function capsuleToday(capsule, day) {
  const fresh = capsule.day === day;
  const used = fresh ? capsule.used : 0;
  const bonus = fresh ? capsule.bonus : 0;
  return { used, bonus, left: Math.max(0, CAPSULE_TURNS_PER_DAY + bonus - used) };
}

function pickWeighted(items, weightOf, random) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return items.at(-1);
}

/**
 * What the next capsule holds. At most one sticker capsule a day (stickers she doesn't have yet
 * first); otherwise a charm, by rarity, with charms she hasn't found yet a little likelier.
 */
export function choosePrize(state, { day, random = Math.random, ownedStickers = [] }) {
  const capsule = state.capsule;
  if (capsule.stickerDay !== day && random() < CAPSULE_STICKER_CHANCE) {
    const owned = new Set(ownedStickers);
    const unowned = STICKER_POOL.filter((sticker) => !owned.has(sticker.id));
    const pool = unowned.length ? unowned : STICKER_POOL;
    const sticker = pool[Math.floor(random() * pool.length)];
    return { kind: "sticker", id: sticker.id, capsule: "heart", isNew: !owned.has(sticker.id) };
  }
  const rarity = pickWeighted(Object.keys(CHARM_RARITIES), (key) => CHARM_RARITIES[key].weight, random);
  const charms = CHARMS.filter((charm) => charm.rarity === rarity);
  const charm = pickWeighted(charms, (c) => (capsule.charms[c.id] ? 1 : UNOWNED_CHARM_WEIGHT), random);
  const colour = rarity === "sparkle" ? "gold" : rarity === "rare" ? "berry" : CAPSULE_COLOURS[Math.floor(random() * CAPSULE_COLOURS.length)];
  return { kind: "charm", id: charm.id, capsule: colour, isNew: !capsule.charms[charm.id] };
}

/** A pull as the client sees it, with the charm's or sticker's name and line. */
export function describePull(pull) {
  if (!pull) return null;
  const item = pull.kind === "sticker" ? stickerById(pull.id) : charmById(pull.id);
  return {
    id: pull.pullId,
    day: pull.day,
    kind: pull.kind,
    capsule: pull.capsule,
    isNew: Boolean(pull.isNew),
    ...(pull.kind === "sticker"
      ? { sticker: item && { id: item.id, art: item.art, name: item.name, line: item.line } }
      : { charm: item && { id: item.id, name: item.name, line: item.line, rarity: item.rarity } }),
  };
}

export function describeFortune(entry) {
  if (!entry) return null;
  const fortune = fortuneById(entry.id);
  const level = FORTUNE_LEVELS.find((each) => each.id === entry.level) ?? FORTUNE_LEVELS[0];
  return { day: entry.day, id: entry.id, text: fortune?.text ?? "", level, colour: entry.colour, thing: entry.thing };
}

/** Everything the luck games show, for one person on `day`. */
export function luckSummary(state, day) {
  const capsule = capsuleToday(state.capsule, day);
  const history = state.fortune.history;
  return {
    day,
    capsule: {
      perDay: CAPSULE_TURNS_PER_DAY,
      ...capsule,
      charms: state.capsule.charms,
      catalogue: CHARMS,
      recent: state.capsule.pulls.slice(-6).reverse().map(describePull),
      stickers: state.capsule.stickers.length,
    },
    fortune: {
      today: history[0]?.day === day ? describeFortune(history[0]) : null,
      history: history.map(describeFortune),
      count: history.length,
    },
    best: state.best,
    lanterns: { coinToday: state.lanterns.coinDay === day, coins: state.lanterns.coins },
  };
}

async function readStickerCollection(db) {
  const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, "stickers"));
  return Array.isArray(row?.value) ? row.value : [];
}

/** Saves a capsule sticker into her collection (the daily drawer's kv row and shape), once per pull. */
export async function saveCapsuleSticker(db, { stickerId, day, pullId }) {
  const reason = `capsule ${pullId}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.select().from(schema.kv).where(eq(schema.kv.key, "stickers"));
    const collection = Array.isArray(row?.value) ? row.value : [];
    if (collection.some((entry) => entry.game === "capsule" && entry.reason === reason)) return false;
    const next = [...collection, { id: stickerId, day, game: "capsule", reason }];
    const [saved] = row
      ? await db
          .update(schema.kv)
          .set({ value: next, updatedAt: new Date() })
          .where(and(eq(schema.kv.key, "stickers"), sql`jsonb_array_length(${schema.kv.value}) = ${collection.length}`))
          .returning()
      : await db.insert(schema.kv).values({ key: "stickers", value: next }).onConflictDoNothing().returning();
    if (saved) return true;
  }
  throw Object.assign(new Error("Your sticker book is busy. Try again."), { status: 409 });
}

/**
 * Turns the crank once. `pullId` makes it safe to repeat: the same id returns the same capsule
 * without using another turn (a retry after a dropped connection, or a double tap).
 * Only Kiriya's stickers go into her collection; Josh's test pulls stay in his own luck state.
 */
export async function pullCapsule(db, role, { pullId, day, random = Math.random }) {
  const ownedStickers = role === "kiriya" ? (await readStickerCollection(db)).map((entry) => entry.id) : null;
  const outcome = await updateLuck(db, role, (state) => {
    const capsule = state.capsule;
    const earlier = capsule.pulls.find((pull) => pull.pullId === pullId);
    if (earlier) return { result: { pull: earlier, repeat: true } };
    const today = capsuleToday(capsule, day);
    if (today.left <= 0) {
      throw Object.assign(new Error("the machine is napping until tomorrow ♡"), { status: 429, code: "no_turns" });
    }
    const prize = choosePrize(state, { day, random, ownedStickers: ownedStickers ?? capsule.stickers });
    const pull = { pullId, day, at: new Date().toISOString(), ...prize };
    capsule.day = day;
    capsule.used = today.used + 1;
    capsule.bonus = today.bonus;
    capsule.pulls = [...capsule.pulls, pull].slice(-KEEP_PULLS);
    if (prize.kind === "sticker") {
      capsule.stickerDay = day;
      capsule.stickers = [...capsule.stickers, prize.id];
    } else {
      capsule.charms = { ...capsule.charms, [prize.id]: (capsule.charms[prize.id] ?? 0) + 1 };
    }
    return { state, result: { pull, repeat: false } };
  });
  if (outcome.pull.kind === "sticker" && role === "kiriya") {
    await saveCapsuleSticker(db, { stickerId: outcome.pull.id, day: outcome.pull.day, pullId });
  }
  const { state } = await readLuck(db, role);
  return { pull: describePull(outcome.pull), repeat: outcome.repeat, luck: luckSummary(state, day) };
}

/** Today's fortune slip: drawn once a day, never a repeat until she has read them all. */
export async function drawFortune(db, role, { day, random = Math.random }) {
  const outcome = await updateLuck(db, role, (state) => {
    const history = state.fortune.history;
    if (history[0]?.day === day) return { result: { entry: history[0], isNew: false } };
    const seen = new Set(history.map((entry) => entry.id));
    let candidates = FORTUNES.filter((fortune) => !seen.has(fortune.id));
    if (!candidates.length) {
      const recent = new Set(history.slice(0, NO_REPEAT_FORTUNES).map((entry) => entry.id));
      candidates = FORTUNES.filter((fortune) => !recent.has(fortune.id));
    }
    const pick = (list) => list[Math.floor(random() * list.length)];
    const entry = {
      day,
      id: pick(candidates).id,
      level: pick(FORTUNE_LEVELS).id,
      colour: pick(LUCKY_COLOURS),
      thing: pick(LUCKY_THINGS),
    };
    state.fortune.history = [entry, ...history].slice(0, KEEP_FORTUNES);
    return { state, result: { entry, isNew: true } };
  });
  const { state } = await readLuck(db, role);
  return { fortune: describeFortune(outcome.entry), isNew: outcome.isNew, luck: luckSummary(state, day) };
}

/** Records a streak; returns the best before and after, so a game can tell a first milestone. */
export async function saveBest(db, role, { game, streak, day }) {
  const outcome = await updateLuck(db, role, (state) => {
    const previous = state.best[game] ?? 0;
    if (streak <= previous) return { result: { previous, best: previous } };
    state.best = { ...state.best, [game]: streak };
    return { state, result: { previous, best: streak } };
  });
  const { state } = await readLuck(db, role);
  return { ...outcome, luck: luckSummary(state, day) };
}

/** The golden lantern's spare capsule coin: one a day. */
export async function claimLanternCoin(db, role, { day }) {
  const outcome = await updateLuck(db, role, (state) => {
    if (state.lanterns.coinDay === day) return { result: { granted: false } };
    const today = capsuleToday(state.capsule, day);
    state.capsule = { ...state.capsule, day, used: today.used, bonus: today.bonus + 1 };
    state.lanterns = { coinDay: day, coins: state.lanterns.coins + 1 };
    return { state, result: { granted: true } };
  });
  const { state } = await readLuck(db, role);
  return { ...outcome, coins: state.lanterns.coins, luck: luckSummary(state, day) };
}
