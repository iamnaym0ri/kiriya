import apn from "@parse/node-apn";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { schema } from "../db/client.js";
import { env } from "../env.js";
import { tapByKey } from "../../shared/taps.js";

// Native notifications for the kiriya.love iPhone app, through Apple's push service with a
// token-based .p8 key (no certificates to renew). Ad hoc builds use the production gateway; a build
// run straight from Xcode uses the sandbox, which we learn the first time production rejects a token.

export function apnsConfigured() {
  return Boolean(env.apnsKey && env.apnsKeyId && env.apnsTeamId && env.apnsBundleId);
}

const keyData = () => Buffer.from(env.apnsKey.replace(/\\n/g, "\n"));
function provider(production) {
  return new apn.Provider({ token: { key: keyData(), keyId: env.apnsKeyId, teamId: env.apnsTeamId }, production });
}

// Each kind of notification looks and behaves a little differently on her phone. The category
// picks the action buttons the app registers (chat: Reply and ♡; letters and notes: Open and ♡),
// and the thread groups a conversation together in Notification Center.
// Sounds are short original chimes bundled in the app (ios/App/App/Sounds); a missing file plays
// the default sound.
const KINDS = {
  chat: { category: "CHAT", thread: "chat", sound: "chat.caf" },
  tap: { category: "TAP", thread: "chat", sound: "tap.caf" },
  letter: { category: "LETTER", thread: "letters", sound: "letter.caf", special: true },
  note: { category: "NOTE", thread: "notes", sound: "letter.caf", special: true },
  jar: { category: "JAR", thread: "jar", sound: "jar.caf", special: true },
  reminder: { category: "REMINDER", thread: "reminders", sound: "jar.caf" },
  event: { category: "EVENT", thread: "events", sound: "default" },
  quiz: { category: "QUIZ", thread: "quizzes", sound: "tap.caf" },
};

/** The same message the web push carries, as an APNs alert. `navigate` rides along for the tap. */
// APNs refuses payloads over 4 KB; the whole note rides along only up to this much (UTF-8 bytes).
const NOTE_BYTES = 3000;

/** Trims `out.text` until the whole object fits in `bytes` (UTF-8 JSON), marking it truncated. */
function fitText(out, bytes = NOTE_BYTES) {
  if (Buffer.byteLength(JSON.stringify(out)) <= bytes) return out;
  let text = out.text ?? "";
  while (text && Buffer.byteLength(JSON.stringify({ ...out, text })) > bytes - 20) text = text.slice(0, Math.floor(text.length * 0.9));
  return { ...out, text: `${text.trimEnd()}…`, truncated: true };
}

/** A little note's full text for the app's notification content extension, trimmed to fit a push. */
export function notePayload(note) {
  if (!note?.text) return null;
  return fitText({ id: note.id ?? null, title: String(note.title ?? "").slice(0, 120), text: String(note.text), from: note.from ?? null });
}

/**
 * A letter for the same extension (server/lib/letterCard.js). A long one is trimmed here and the
 * card fetches the rest when it opens; a letter that isn't ready yet carries no words at all.
 */
export function letterPayload(letter) {
  if (!letter?.title) return null;
  const out = {
    id: letter.id ?? null,
    title: String(letter.title).slice(0, 120),
    from: letter.from ?? null,
    kind: letter.kind ?? null,
    openWhen: letter.openWhen ?? null,
    date: letter.date ?? null,
    lockedUntil: letter.lockedUntil ?? null,
  };
  return letter.lockedUntil || !letter.text ? out : fitText({ ...out, text: String(letter.text) });
}

export function apnsNotification({ title, body, navigate = "/world", kind = null, tap = null, threadId = null, messageId = null, note: fullNote = null, letter = null, sealed = null }, { ttlSeconds = 6 * 60 * 60, now = Date.now(), badge = null } = {}) {
  const style = KINDS[kind] ?? {};
  // A "thinking of you" signal: which one (hug, kiss…), when the message says.
  const signal = kind === "tap" && tapByKey[tap] ? tap : null;
  const note = new apn.Notification();
  note.topic = env.apnsBundleId;
  note.alert = { title: title.slice(0, 60), body: body.slice(0, 160) };
  // Each signal has its own sound in the app (ios/App/App/Sounds): the same soft heartbeat she learns,
  // then a little tail that says which. An app build without them plays the default sound.
  note.sound = signal ? `SignalsWidget-${signal}.caf` : style.sound ?? "default";
  if (Number.isInteger(badge)) note.badge = badge;
  note.pushType = "alert";
  note.priority = 10;
  note.expiry = Math.floor(now / 1000) + ttlSeconds;
  if (style.category) note.category = style.category;
  // Every signal but ♡ offers itself straight back ("Hug back 🫂"; ios/App/App/KiriyaNotifications.swift).
  if (signal && signal !== "thinking") note.category = `TAP_${signal.toUpperCase()}`;
  if (threadId ?? style.thread) note.threadId = threadId ?? style.thread;
  // Letters, little notes and the jar get dressed up on the phone (an envelope or jar picture) by
  // the app's notification service extension, which needs permission to edit the notification.
  if (style.special) note.mutableContent = 1;
  // An end-to-end sealed chat message: the extension opens its preview with the chat key in the
  // Keychain (ios/App/KiriyaNotificationService, server/lib/chatKeys.js sealedNotification).
  if (sealed) note.mutableContent = 1;
  // messageId lets the "Reply" button on a chat notification quote the message it answers.
  // Little notes and letters open right inside the notification (ios/App/KiriyaNotificationContent),
  // so they carry their words.
  const inPlace = kind === "note" ? notePayload(fullNote) : null;
  const letterInPlace = kind === "letter" ? letterPayload(letter) : null;
  note.payload = {
    navigate,
    ...(kind ? { kind } : {}),
    ...(signal ? { tap: signal } : {}),
    ...(messageId ? { messageId } : {}),
    ...(inPlace ? { note: inPlace } : {}),
    ...(letterInPlace ? { letter: letterInPlace } : {}),
    ...(sealed ? { sealed } : {}),
  };
  return note;
}

/** Sends to every app install of a role. Tokens Apple says are dead are removed. */
export async function sendNative(db, message, { role = null, ttlSeconds } = {}) {
  if (!apnsConfigured()) return { sent: 0, failed: 0, targets: 0, skipped: "apns_not_configured" };
  const filters = [isNotNull(schema.appDevices.apnsToken), isNull(schema.appDevices.revokedAt)];
  if (role) filters.push(eq(schema.appDevices.role, role));
  const devices = await db.select().from(schema.appDevices).where(and(...filters));
  if (!devices.length) return { sent: 0, failed: 0, targets: 0 };
  // Each role's phones get that person's own unread total as the icon badge.
  const { unreadTotals } = await import("../lib/appBadge.js");
  const notes = {};
  for (const who of new Set(devices.map((d) => d.role))) {
    const badge = await unreadTotals(db, who).then((totals) => totals.total, () => null);
    notes[who] = apnsNotification(message, { ttlSeconds, badge });
  }
  const results = new Map();
  for (const [environment, who] of ["production", "development"].flatMap((e) => Object.keys(notes).map((r) => [e, r]))) {
    const targets = devices.filter((d) => d.apnsEnv === environment && d.role === who && !results.has(d.id));
    if (!targets.length) continue;
    const note = notes[who];
    const gateway = provider(environment === "production");
    try {
      const { sent, failed } = await gateway.send(note, targets.map((d) => d.apnsToken));
      const byToken = new Map(targets.map((d) => [d.apnsToken, d]));
      for (const { device } of sent) results.set(byToken.get(device).id, { ok: true });
      for (const failure of failed) {
        const device = byToken.get(failure.device);
        results.set(device.id, { ok: false, status: failure.status ?? null, reason: failure.response?.reason ?? failure.error?.message ?? "error" });
      }
    } finally {
      gateway.shutdown();
    }
  }
  // A token from an Xcode (sandbox) build is "BadDeviceToken" in production: try the sandbox once.
  const sandbox = devices.filter((d) => d.apnsEnv === "production" && results.get(d.id)?.reason === "BadDeviceToken");
  if (sandbox.length) {
    const gateway = provider(false);
    try {
      const sent = [];
      for (const who of new Set(sandbox.map((d) => d.role)))
        sent.push(...(await gateway.send(notes[who], sandbox.filter((d) => d.role === who).map((d) => d.apnsToken))).sent);
      for (const { device } of sent) {
        const row = sandbox.find((d) => d.apnsToken === device);
        results.set(row.id, { ok: true });
        await db.update(schema.appDevices).set({ apnsEnv: "development" }).where(eq(schema.appDevices.id, row.id));
      }
    } finally {
      gateway.shutdown();
    }
  }
  let sentCount = 0;
  for (const device of devices) {
    const result = results.get(device.id);
    if (result?.ok) {
      sentCount++;
      await db.update(schema.appDevices).set({ lastSuccessAt: new Date(), lastError: null }).where(eq(schema.appDevices.id, device.id));
    } else if (result) {
      const dead = result.status === 410 || ["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"].includes(result.reason);
      await db
        .update(schema.appDevices)
        .set({ lastError: `${result.status ?? "error"}: ${String(result.reason).slice(0, 180)}`, ...(dead ? { apnsToken: null } : {}) })
        .where(eq(schema.appDevices.id, device.id));
    }
  }
  return { sent: sentCount, failed: devices.length - sentCount, targets: devices.length };
}
