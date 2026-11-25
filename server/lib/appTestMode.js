// App test mode (admin → "Try the app on my phone"). The app is a surprise for Kiriya, so Josh tests
// it on his own phone without anything reaching her:
// - `tryNotification` sends a sample of each kind of notification to his test devices only;
// - while test mode is on, what his phone sends from outside the chat screen (the "♡ back" and Reply
//   buttons on a notification, the widget buttons, Siri, the icon's "Send a ♡") is checked like a
//   real send, then answered with a "✓ that worked" notification to his phones instead of going to her.
// Those senders are told apart by their clientId prefix: n- notification buttons
// (ios/App/App/KiriyaNotifications.swift), w- widgets and Siri (KiriyaIntents.swift), q- the icon's
// quick action (src/shared/NativeApp.jsx). The chat screen's own ids never look like that
// (src/lib/chat.js newClientId: a base-36 timestamp first).
import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { tapByKey } from "../../shared/taps.js";
import { sendToSubscribers } from "../push/webpush.js";
import { notificationPreview } from "./loveNotes.js";

const MODE_KEY = "app_test_mode";
const LOG_KEY = "app_test_log";
// A safety net: test mode switches itself off, so Josh's real hearts never stay swallowed for long.
export const TEST_MODE_HOURS = 12;
const LOG_SIZE = 12;

const CHANNELS = { n: "a notification button", w: "a widget or Siri", q: "the icon’s quick action" };

/** Where a send came from, if it's one of the phone's shortcuts (null for the chat screen). */
export function shortcutChannel(clientId) {
  const match = /^([nwq])-/.exec(String(clientId ?? ""));
  return match ? CHANNELS[match[1]] : null;
}

async function readSetting(db, key) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? null;
}

async function writeSetting(db, key, value) {
  await db
    .insert(schema.settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export async function testMode(db, now = new Date()) {
  const value = await readSetting(db, MODE_KEY);
  const until = value?.until ? new Date(value.until) : null;
  const on = Boolean(until && until > now);
  return { on, until: on ? until.toISOString() : null };
}

export async function setTestMode(db, on, now = new Date()) {
  const until = on ? new Date(now.getTime() + TEST_MODE_HOURS * 3600_000).toISOString() : null;
  await writeSetting(db, MODE_KEY, { until });
  return testMode(db, now);
}

export async function testLog(db) {
  return (await readSetting(db, LOG_KEY))?.entries ?? [];
}

/**
 * Called by sendMessage before it saves anything. Returns null when the send should go ahead as
 * normal; otherwise a stand-in for the message, which was checked but never saved or sent to her.
 */
export async function interceptTestSend(db, role, data, { after = (task) => task(), now = new Date() } = {}) {
  if (role !== "admin") return null;
  const channel = shortcutChannel(data.clientId);
  if (!channel || !(await testMode(db, now)).on) return null;

  const what = data.kind === "tap" ? `${tapByKey[data.body]?.emoji ?? "♡"} ${tapByKey[data.body]?.label ?? data.body}` : `“${notificationPreview(data.body, 80)}”`;
  const entry = { at: now.toISOString(), channel, kind: data.kind, what, replyTo: data.replyTo ?? null };
  const entries = [entry, ...(await testLog(db))].slice(0, LOG_SIZE);
  await writeSetting(db, LOG_KEY, { entries });
  await after(() =>
    sendToSubscribers(
      db,
      {
        title: "test mode ✓ that worked",
        body: `${what} from ${channel} reached kiriya.love. Nothing went to Kiriya.`,
        navigate: "/admin",
      },
      { role: "admin", ttlSeconds: 600 },
    ),
  );
  return { id: null, clientId: data.clientId, sender: role, kind: data.kind, body: data.body, replyTo: data.replyTo ?? null, createdAt: now.toISOString(), test: true };
}

/** One sample of each kind, as it would look on her phone. */
export const SAMPLE_KINDS = ["chat", "tap", "letter", "note", "jar", "reminder"];

function sample(kind, names) {
  const her = names?.kiriya ?? "Kiriya";
  const him = names?.admin ?? "Josh";
  switch (kind) {
    case "chat":
      return { title: her, body: "test: how’s your day going? ♡", navigate: "/world/chat", kind: "chat", threadId: "chat" };
    case "tap":
      return { title: (tapByKey.thinking?.push ?? "{from} is thinking of you ♡").replace("{from}", her), body: "tap to send one back ♡", navigate: "/world/chat", kind: "tap", threadId: "chat" };
    case "letter":
      return { title: "a new letter for you ✉", body: "“a test letter” is waiting in your letters ♡", navigate: "/world/letters", kind: "letter" };
    case "note":
      return {
        title: "a little note for you ✉︎",
        body: `test: ${him} is thinking of you ♡`,
        navigate: "/world/notes",
        kind: "note",
        note: {
          id: null,
          title: "a little note for you",
          text: "this is a test note, so only your phone sees it.\n\nwhen it's real, the whole note opens right here, without the app: a quick bit of love in the middle of her day ♡",
          from: him,
        },
      };
    case "jar":
      return { title: "2 new little notes in your jar ♡", body: `${him} slipped some new notes in for you. Pull them whenever you like.`, navigate: "/world#note-jar", kind: "jar" };
    case "reminder":
      return { title: "a little note has been waiting since this morning ♡", body: "they're still in your jar whenever you're ready.", navigate: "/world#note-jar", kind: "reminder" };
    default:
      return null;
  }
}

/** Sends one sample to Josh's test devices only, switching test mode on so its buttons can't reach her. */
export async function tryNotification(db, kind, names, { now = new Date(), send = sendToSubscribers } = {}) {
  const message = sample(kind, names);
  if (!message) return null;
  const mode = (await testMode(db, now)).on ? await testMode(db, now) : await setTestMode(db, true, now);
  const push = await send(db, message, { role: "admin", ttlSeconds: 600 });
  return { mode, push };
}
