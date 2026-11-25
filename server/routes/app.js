import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { clientIpHash, recordAttempt, slowDown, tooManyFailures } from "../auth/attempts.js";
import { issueSession } from "../auth/session.js";
import { unreadTotals } from "../lib/appBadge.js";
import { clearPushToken, enrollDevice, renewWidgetKey, revokeDevice, setPushToken, verifyDevice } from "../lib/appDevices.js";

// The kiriya.love iPhone app (2026-11-24). Mounted at /api/app behind a kiriya/admin session,
// except the Face ID sign-in, which is how the app gets that session back without the passphrase.
export const appRoutes = new Hono();
export const appSessionRoutes = new Hono();

const id = z.string().uuid();
const enrollBody = z.object({ label: z.string().trim().max(60).optional() }).strict();
const pushBody = z.object({ token: z.string().regex(/^[0-9a-fA-F]{64,200}$/), env: z.enum(["production", "development"]).optional() }).strict();
const signInBody = z.object({ id, secret: z.string().min(20).max(200) }).strict();

appRoutes.use("*", async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });

// After the passphrase opens the app once: a device secret for the Keychain, shown only now.
appRoutes.post("/devices", async (c) => {
  const parsed = enrollBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "bad_device", message: "This phone couldn’t be set up." }, 400);
  return c.json(await enrollDevice(await getDb(), c.get("session").role, parsed.data), 201);
});

appRoutes.put("/devices/:id/push", async (c) => {
  const deviceId = id.safeParse(c.req.param("id"));
  const parsed = pushBody.safeParse(await c.req.json().catch(() => null));
  if (!deviceId.success || !parsed.success) return c.json({ error: "bad_token", message: "That notification token isn’t valid." }, 400);
  const row = await setPushToken(await getDb(), deviceId.data, c.get("session").role, parsed.data.token, { env: parsed.data.env });
  return row ? c.json({ ok: true }) : c.json({ error: "not_found", message: "This phone isn’t set up any more." }, 404);
});

appRoutes.delete("/devices/:id/push", async (c) => {
  const deviceId = id.safeParse(c.req.param("id"));
  if (!deviceId.success) return c.json({ error: "not_found", message: "That phone isn’t set up." }, 404);
  await clearPushToken(await getDb(), deviceId.data, c.get("session").role);
  return c.json({ ok: true });
});

// The app icon's red badge while the app is open (pushes set it while it's closed).
appRoutes.get("/unread", async (c) => c.json(await unreadTotals(await getDb(), c.get("session").role)));

// The install's widget key went missing (a reinstall keeps the Keychain but not the App Group).
appRoutes.post("/devices/:id/widget-key", async (c) => {
  const deviceId = id.safeParse(c.req.param("id"));
  const renewed = deviceId.success ? await renewWidgetKey(await getDb(), deviceId.data, c.get("session").role) : null;
  return renewed ? c.json(renewed) : c.json({ error: "not_found", message: "This phone isn’t set up any more." }, 404);
});

// Locking the app forgets this phone: Face ID can't open it again until the passphrase does.
appRoutes.delete("/devices/:id", async (c) => {
  const deviceId = id.safeParse(c.req.param("id"));
  if (!deviceId.success) return c.json({ error: "not_found", message: "That phone isn’t set up." }, 404);
  await revokeDevice(await getDb(), deviceId.data, { role: c.get("session").role });
  return c.json({ ok: true });
});

// Face ID passed on the phone, which released the Keychain secret: trade it for a session.
appSessionRoutes.post("/", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const db = await getDb();
  const ipHash = clientIpHash(c);
  if (await tooManyFailures(db, ipHash)) return slowDown(c);
  const parsed = signInBody.safeParse(await c.req.json().catch(() => null));
  const device = parsed.success ? await verifyDevice(db, parsed.data.id, parsed.data.secret) : null;
  await recordAttempt(db, ipHash, device?.role ?? null);
  if (!device) return c.json({ error: "device_unknown", message: "This phone needs the passphrase again." }, 401);
  return c.json(await issueSession(c, device.role));
});
