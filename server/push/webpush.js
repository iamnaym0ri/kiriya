import webpush from "web-push";
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { apnsConfigured, sendNative } from "./apns.js";
import { WEBSITE_CLOSED } from "../../shared/siteClosed.js";

let configured = false;

export function webPushConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey);
}

/** Either kind of notification can reach her: web push (browsers, home-screen web app) or the iPhone app. */
export function pushConfigured() {
  return webPushConfigured() || apnsConfigured();
}

function configure() {
  if (configured) return;
  if (!webPushConfigured()) throw new Error("VAPID keys are not configured");
  // Apple rejects localhost-style subjects, so use the real site (or a real mailto: in VAPID_SUBJECT).
  webpush.setVapidDetails(env.vapidSubject || env.siteUrl, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

/**
 * Declarative Web Push (iOS 18.4+ shows it without running any code); other browsers hand the same
 * JSON to the service worker. `navigate` must be an absolute URL.
 */
export function buildPayload({ title, body, navigate = "/world", badge = 1 }) {
  const url = new URL(navigate, env.siteUrl).toString();
  return JSON.stringify({
    web_push: 8030,
    notification: { title: title.slice(0, 60), body: body.slice(0, 160), navigate: url, app_badge: String(Math.max(1, badge)) },
  });
}

/**
 * Sends to every stored subscription (optionally one role), and to every install of the iPhone app
 * for that role. Removes subscriptions the browser dropped and tokens Apple says are gone.
 */
export async function sendToSubscribers(db, message, { role: asked = null, ttlSeconds = 6 * 60 * 60 } = {}) {
  // Until the app surprise (shared/siteClosed.js), nothing notifies Kiriya; Josh's phones still hear.
  // (The delivery tests opt out with KIRIYA_NOTIFY_WHILE_CLOSED=1 to keep exercising her path.)
  const held = WEBSITE_CLOSED && process.env.KIRIYA_NOTIFY_WHILE_CLOSED !== "1";
  if (held && asked === "kiriya") return { sent: 0, failed: 0, targets: 0, held: true };
  const role = held && asked == null ? "admin" : asked;
  const [web, native] = await Promise.all([
    webPushConfigured() ? sendWebPush(db, message, { role, ttlSeconds }) : { sent: 0, failed: 0, targets: 0 },
    sendNative(db, message, { role, ttlSeconds }).catch((error) => ({ sent: 0, failed: 0, targets: 0, error: String(error.message).slice(0, 200) })),
  ]);
  return {
    sent: web.sent + native.sent,
    failed: web.failed + native.failed,
    targets: web.targets + native.targets,
    ...(native.targets || native.error ? { app: { sent: native.sent, targets: native.targets, ...(native.error ? { error: native.error } : {}) } } : {}),
  };
}

async function sendWebPush(db, message, { role = null, ttlSeconds = 6 * 60 * 60 } = {}) {
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
