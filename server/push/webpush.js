import webpush from "web-push";
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { env } from "../env.js";

let configured = false;

export function pushConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey);
}

function configure() {
  if (configured) return;
  if (!pushConfigured()) throw new Error("VAPID keys are not configured");
  // Apple rejects localhost-style subjects, so use the real site (or a real mailto: in VAPID_SUBJECT).
  webpush.setVapidDetails(env.vapidSubject || "https://iloveukiriya.com", env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

/**
 * Declarative Web Push (iOS 18.4+ shows it without running any code); other browsers hand the same
 * JSON to the service worker. `navigate` must be an absolute URL.
 */
export function buildPayload({ title, body, navigate = "/world" }) {
  const url = new URL(navigate, env.siteUrl).toString();
  return JSON.stringify({
    web_push: 8030,
    notification: { title: title.slice(0, 60), body: body.slice(0, 160), navigate: url, app_badge: "1" },
  });
}

/** Sends to every stored subscription (optionally one role). Removes subscriptions the browser dropped. */
export async function sendToSubscribers(db, message, { role = null, ttlSeconds = 6 * 60 * 60 } = {}) {
  configure();
  const subs = await db.select().from(schema.pushSubscriptions);
  const targets = role ? subs.filter((s) => s.role === role) : subs;
  const payload = buildPayload(message);
  const results = [];

  for (const sub of targets) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: ttlSeconds, urgency: "high", timeout: 10_000 });
      await db.update(schema.pushSubscriptions).set({ lastSuccessAt: new Date(), lastError: null }).where(eq(schema.pushSubscriptions.id, sub.id));
      results.push({ id: sub.id, ok: true });
    } catch (error) {
      const status = error.statusCode ?? null;
      if (status === 404 || status === 410) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
      } else {
        await db
          .update(schema.pushSubscriptions)
          .set({ lastError: `${status ?? "error"}: ${String(error.body ?? error.message).slice(0, 200)}` })
          .where(eq(schema.pushSubscriptions.id, sub.id));
      }
      results.push({ id: sub.id, ok: false, status });
    }
  }
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, targets: targets.length };
}
