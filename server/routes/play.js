// The play hub's routes, under /me (docs/refactor/RENOVATION.md, "Games"). Owner: the frame agent.
//   GET  /me/play          her sticker collection, the catalogue, and the games this person opened
//   POST /me/play/played   { game } — the "new" mark goes away
//   POST /me/stickers      { sticker, game, reason } — a game's reward (kiriya only; admin previews)
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { GAME_ID, REASON_MAX, STICKER_ID, markPlayed, playState, rewardSticker } from "../lib/playRewards.js";

export const playRoutes = new Hono();

const rewardBody = z.object({
  sticker: z.string().regex(STICKER_ID),
  game: z.string().regex(GAME_ID),
  reason: z.string().trim().min(1).max(REASON_MAX),
});

playRoutes.get("/play", async (c) => c.json(await playState(await getDb(), c.get("session").role)));

playRoutes.post("/play/played", async (c) => {
  const parsed = z.object({ game: z.string().regex(GAME_ID) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_request", message: "That game wasn't recognised." }, 400);
  return c.json({ played: await markPlayed(await getDb(), c.get("session").role, parsed.data.game) });
});

playRoutes.post("/stickers", async (c) => {
  const parsed = rewardBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_request", message: "That sticker couldn't be saved." }, 400);
  const result = await rewardSticker(await getDb(), c.get("session").role, parsed.data);
  if (result.refused) return c.json({ error: "bad_request", message: "That sticker isn't one a game can give." }, 400);
  return c.json(result, result.saved ? 201 : 200);
});
