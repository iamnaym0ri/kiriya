import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { background } from "../lib/background.js";
import { claimMigration, keysFor, pendingWork, putIdentity, releaseMigration, storeSealed } from "../lib/chatKeys.js";

// The chat's keys (mounted at /api/me/chat/keys behind a kiriya/admin session; lib/chatKeys.js).
// While Josh previews her side (src/lib/viewAs.js) these still answer as him: his phone holds his
// own key, and her wrapped key would be no use to it.
export const chatKeyRoutes = new Hono();

const realRole = (c) => c.get("session").previewBy ?? c.get("session").role;
const answer = (c, error, fallback) =>
  c.json({ error: error.code ?? (error.status === 409 ? "conflict" : "bad_request"), message: error.status ? error.message : fallback }, error.status ?? 400);

chatKeyRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

chatKeyRoutes.get("/", async (c) => c.json(await keysFor(await getDb(), realRole(c))));

chatKeyRoutes.put("/", async (c) => {
  try {
    const db = await getDb();
    await putIdentity(db, realRole(c), await c.req.json().catch(() => null));
    return c.json(await keysFor(db, realRole(c)));
  } catch (error) {
    if (error.code === "exists") return c.json({ error: "exists", message: error.message, ...(await keysFor(await getDb(), realRole(c))) }, 409);
    return answer(c, error, "That key couldn’t be saved.");
  }
});

const isoDate = z.string().datetime({ offset: true });
chatKeyRoutes.get("/pending", async (c) => {
  const query = z.object({ after: isoDate.optional(), memoriesAfter: isoDate.optional() }).strict().safeParse(c.req.query());
  if (!query.success) return c.json({ error: "bad_request", message: "That page couldn’t open." }, 400);
  return c.json(await pendingWork(await getDb(), query.data));
});

chatKeyRoutes.post("/claim", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.device !== "string" || body.device.length > 80) return c.json({ error: "bad_request", message: "Which device?" }, 400);
  const db = await getDb();
  return c.json(body.release ? await releaseMigration(db, body.device) : await claimMigration(db, realRole(c), body.device));
});

chatKeyRoutes.post("/sealed", async (c) => {
  try {
    return c.json(await storeSealed(await getDb(), realRole(c), await c.req.json().catch(() => null), { after: background }));
  } catch (error) {
    return answer(c, error, "That batch couldn’t be saved.");
  }
});
