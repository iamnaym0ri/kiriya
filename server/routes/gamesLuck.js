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

gamesLuckRoutes.get("/", async (c) => {
  const { state } = await readLuck(await getDb(), role(c));
  return c.json(luckSummary(state, localDay()));
});

gamesLuckRoutes.post("/capsule", async (c) => {
  const parsed = pullBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_pull", message: "The crank slipped. Try again." }, 400);
  try {
    return c.json(await pullCapsule(await getDb(), role(c), { pullId: parsed.data.pullId, day: localDay() }));
  } catch (error) {
    if (error.code === "no_turns") return c.json({ error: "no_turns", message: error.message }, 429);
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/fortune", async (c) => {
  try {
    return c.json(await drawFortune(await getDb(), role(c), { day: localDay() }));
  } catch (error) {
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/best", async (c) => {
  const parsed = bestBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_best", message: "That score couldn't be saved." }, 400);
  try {
    return c.json(await saveBest(await getDb(), role(c), { ...parsed.data, day: localDay() }));
  } catch (error) {
    return busy(c, error);
  }
});

gamesLuckRoutes.post("/lantern-coin", async (c) => {
  try {
    return c.json(await claimLanternCoin(await getDb(), role(c), { day: localDay() }));
  } catch (error) {
    return busy(c, error);
  }
});
