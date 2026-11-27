// End-to-end encryption for the chat (round 3, owned by the chat-room agent).
//
// The contract both chat agents build against. Every message the app sends goes through
// `sealOutgoing` just before it leaves the phone, every message that arrives (a page from the
// server, a realtime event, an edit) goes through `openIncoming` before anything renders it, and
// every photo, video or voice note is sealed with `sealFile` before it is uploaded and shown with
// `useMediaUrl`. Until the real implementation lands these pass everything through unchanged, so
// the rest of the chat can be built and tested against them now.

/** Whether this device can read and write sealed messages right now. */
export function chatCryptoReady() {
  return true;
}

/**
 * Seals a message before it is sent or edited. Takes the request body ({ kind, body, media,
 * replyTo, clientId, ... }) and returns the same shape with its private parts sealed, plus an
 * `enc` field describing how. Signals (kind "tap") stay plain: their body is a known key.
 */
export async function sealOutgoing(message) {
  return message;
}

/**
 * Opens a message from the server or realtime and returns it with a plain `body` and `media`
 * (and a plain `replyTo` preview), or with `locked: true` when this device can't read it yet.
 */
export async function openIncoming(message) {
  return message;
}

/**
 * Seals a file before upload. Returns `{ blob, sealed }`: upload `blob`, and keep `sealed` (null
 * when nothing was sealed) on the message's media entry, so `useMediaUrl` can open it again.
 */
export async function sealFile(file) {
  return { blob: file, sealed: null };
}

/**
 * React hook: a URL an <img>, <video> or <audio> can use for one media entry (an object URL of
 * the opened bytes when it was sealed, else the stored URL). Null while it is still opening.
 */
export function useMediaUrl(media) {
  return media?.url ?? null;
}
