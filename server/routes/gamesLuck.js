import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { localDay } from "../lib/time.js";
import {
  STREAK_GAMES, claimLanternCoin, drawFortune, luckSummary, pullCapsule, readLuck, saveBest,
} from "../lib/gamesLuck.js";

// The luck shelf's server side (src/world/play/games/luck/): mounted at /me/games/luck, behind the
// /me sign-in check. Each person has their own state; "today" is Singapore's day.
export const gamesLuckRoutes = new Hono();
const role = (c) => c.get("session").role;
const pullBody = z.object({ pullId: z.string().uuid() }).strict();
const bestBody = z.object({ game: z.enum(STREAK_GAMES), streak: z.number().int().min(0).max(9999) }).strict();

gamesLuckRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

function busy(c, error) {
  if (error.status === 409) return c.json({ error: "busy", message: error.message }, 409);
  throw error;
}

/**
 * What a phone shows (round 3b: "anything that shows records/bests/keepsakes shows hers"). Hers:
 * her own state. Josh's: her keepsakes and records (charms, recent pulls, fortunes, bests, lantern
 * coins), with his own turns and today's tries, so he can still check every game works. His plays
 * stay in his own state and never touch hers.
 */
async function view(db, viewer, own, day) {
  if (viewer === "kiriya") return own;
  const { state } = await readLuck(db, "kiriya");
  const hers = luckSummary(state, day);
  const { used, bonus, left } = own.capsule;
  return {
    ...hers,
    capsule: { ...hers.capsule, used, bonus, left },
    fortune: { ...hers.fortune, today: own.fortune.today },
    lanterns: { ...hers.lanterns, coinToday: own.lanterns.coinToday },
    hers: true,
  };
}
const withView = async (c, result) => {
  if (!result?.luck || role(c) === "kiriya") return result;
  return { ...result, luck: await view(await getDb(), role(c), result.luck, localDay()) };
};

gamesLuckRoutes.get("/", async (c) => {
  const db = await getDb();
  const { state } = await readLuck(db, role(c));
  const day = localDay();
  return c.json(await view(db, role(c), luckSummary(state, day), day));
});

gamesLuckRoutes.post("/capsule", async (c) => {
  const parsed = pullBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_pull", message: "The crank slipped. Try again." }, 400);
  try {
    return c.json(await withView(c, await pullCapsule(await getDb(), role(c), { pullId: parsed.data.pullId, day: localDay() })));
  } catch (error) {
    if (error.code === "no_turns") return c.json({ error: "no_turns", message: error.message }, 429);
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/fortune", async (c) => {
  try {
    return c.json(await withView(c, await drawFortune(await getDb(), role(c), { day: localDay() })));
  } catch (error) {
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/best", async (c) => {
  const parsed = bestBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_best", message: "That score couldn't be saved." }, 400);
  try {
    return c.json(await withView(c, await saveBest(await getDb(), role(c), { ...parsed.data, day: localDay() })));
  } catch (error) {
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/lantern-coin", async (c) => {
  try {
    return c.json(await withView(c, await claimLanternCoin(await getDb(), role(c), { day: localDay() })));
  } catch (error) {
    return busy(c, error);
  }
});
