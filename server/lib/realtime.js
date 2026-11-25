import Ably from "ably";

// Live delivery for the chat through Ably (free tier). Only ids and tiny events pass through
// Ably; message text stays in our database. Without ABLY_API_KEY the chat falls back to polling.
export const CHAT_CHANNEL = "kiriya-josh";

export const ablyConfigured = () => Boolean(process.env.ABLY_API_KEY);
let rest = null;
const client = () => (rest ??= new Ably.Rest({ key: process.env.ABLY_API_KEY }));

/** A short-lived token for one person's phone: listen, publish typing, and show "online now". */
export function realtimeToken(role) {
  return client().auth.createTokenRequest({
    clientId: role,
    capability: { [CHAT_CHANNEL]: ["subscribe", "publish", "presence"] },
    ttl: 60 * 60 * 1000,
  });
}

/** Never throws: a missed live event is caught up by the next fetch. */
export async function publish(name, data) {
  if (!ablyConfigured()) return false;
  try {
    await client().channels.get(CHAT_CHANNEL).publish(name, data);
    return true;
  } catch {
    return false;
  }
}
