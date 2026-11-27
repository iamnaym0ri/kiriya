import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { background } from "../lib/background.js";
import { answerQuiz, createQuiz, deleteQuiz, getQuiz, listHistory, markSeen, overview, summary } from "../lib/quizzes.js";

// Quizzes for each other (docs/refactor/PLAN.md phase 5), mounted at /api/me/quizzes behind a
// kiriya/admin session. The rules live in lib/quizzes.js; notifications go out after the response.
export const quizRoutes = new Hono();

const role = (c) => c.get("session").role;
const fail = (c, error, fallback) =>
  c.json(
    { error: error.status === 429 ? "slow_down" : error.status === 404 ? "not_found" : error.status === 409 ? "conflict" : "bad_request", message: error.status ? error.message : fallback },
    error.status ?? 400,
  );

quizRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

quizRoutes.get("/", async (c) => c.json(await overview(await getDb(), role(c))));

quizRoutes.get("/summary", async (c) => c.json(await summary(await getDb(), role(c))));

quizRoutes.get("/history", async (c) => {
  const query = z.object({ before: z.string().datetime({ offset: true }).optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_page", message: "That page couldn’t open." }, 400);
  return c.json(await listHistory(await getDb(), role(c), query.data));
});

quizRoutes.get("/:id", async (c) => {
  const quiz = await getQuiz(await getDb(), role(c), c.req.param("id"));
  return quiz ? c.json(quiz) : c.json({ error: "not_found", message: "That quiz isn’t here any more." }, 404);
});

quizRoutes.post("/", async (c) => {
  try {
    const quiz = await createQuiz(await getDb(), role(c), await c.req.json().catch(() => null), { after: background });
    return c.json(quiz, 201);
  } catch (error) {
    return fail(c, error, "That quiz couldn’t be sent.");
  }
});

quizRoutes.post("/:id/answer", async (c) => {
  try {
    const quiz = await answerQuiz(await getDb(), role(c), c.req.param("id"), await c.req.json().catch(() => null), { after: background });
    return c.json(quiz);
  } catch (error) {
    return fail(c, error, "That answer didn’t go through. Try again?");
  }
});

quizRoutes.post("/:id/seen", async (c) => {
  const ok = await markSeen(await getDb(), role(c), c.req.param("id"));
  return c.json({ ok });
});

quizRoutes.delete("/:id", async (c) => {
  try {
    const ok = await deleteQuiz(await getDb(), role(c), c.req.param("id"));
    return ok ? c.json({ ok }) : c.json({ error: "not_found", message: "That quiz isn’t here any more." }, 404);
  } catch (error) {
    return fail(c, error, "That didn’t work. Try again?");
  }
});
