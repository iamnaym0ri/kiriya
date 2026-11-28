import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { NOTE_MAX } from "../../src/world/play/games/brain/secret-word/words.js";
import { SecretWordError, addWord, adminView, deleteWord, editWord, savePlay, todayFor } from "../lib/secretWord.js";

// The secret word game (src/world/play/games/brain/secret-word). Mounted at /me/games/secret-word
// (both of them play) and /admin/games/secret-word (Josh picks the words).

const fail = (c, error) => {
  if (error instanceof SecretWordError) return c.json({ error: error.code, message: error.message }, error.status);
  throw error;
};

export const secretWordRoutes = new Hono();
// Josh plays to check the game (his guesses stay his); the streak he sees is hers (round 3b).
secretWordRoutes.get("/", async (c) => {
  const db = await getDb();
  const person = c.get("session").role;
  const today = await todayFor(db, person);
  return c.json(person === "kiriya" ? today : { ...today, streak: (await todayFor(db, "kiriya")).streak, streakIsHers: true });
});

const playBody = z.object({ day: z.string().max(10), guesses: z.array(z.string().max(12)).max(6) }).strict();
secretWordRoutes.put("/play", async (c) => {
  const parsed = playBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_guesses", message: "Those guesses couldn’t be saved." }, 400);
  try {
    return c.json({ play: await savePlay(await getDb(), c.get("session").role, parsed.data) });
  } catch (error) {
    return fail(c, error);
  }
});

export const secretWordAdminRoutes = new Hono();
const word = z.string().max(20);
const day = z.string().max(10);
const note = z.string().max(NOTE_MAX + 20);
const addBody = z.object({ word, day: day.optional(), note: note.optional() }).strict();
const editBody = z
  .object({ word: word.optional(), day: day.optional(), note: note.optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0);

secretWordAdminRoutes.get("/", async (c) => c.json(await adminView(await getDb())));

secretWordAdminRoutes.post("/", async (c) => {
  const parsed = addBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_word", message: "A secret word is five letters, a to z." }, 400);
  try {
    return c.json(await addWord(await getDb(), parsed.data), 201);
  } catch (error) {
    return fail(c, error);
  }
});

secretWordAdminRoutes.patch("/:id", async (c) => {
  const parsed = editBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad_word", message: "That change couldn’t be saved." }, 400);
  try {
    return c.json(await editWord(await getDb(), c.req.param("id"), parsed.data));
  } catch (error) {
    return fail(c, error);
  }
});

secretWordAdminRoutes.delete("/:id", async (c) => {
  try {
    await deleteWord(await getDb(), c.req.param("id"));
    return c.json({ ok: true });
  } catch (error) {
    return fail(c, error);
  }
});
