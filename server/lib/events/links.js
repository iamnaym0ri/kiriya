// The admin paste-a-link box: Josh pastes a link (an Instagram post, a news article, an organiser's
// page) and the worker treats it like any other signal, first in the queue.
import { enqueueSignal, sha } from "./store.js";

// Signal statuses, shared by every origin. The paste box shows them to Josh.
export const SIGNAL_STATUSES = ["queued", "checking", "researching", "added", "updated", "not_an_event", "duplicate", "failed", "paused", "skipped"];
export const LINK_MESSAGES = {
  queued: "in the queue; it gets checked within a few minutes",
  checking: "checking whether it's an event",
  researching: "looking into it properly",
  added: "added as a new event",
  updated: "added to an event we already had",
  not_an_event: "doesn't look like a Singapore event or merch",
  duplicate: "already known",
  failed: "couldn't be checked; it will be retried",
  paused: "waiting: this month's research budget is used up",
  skipped: "skipped",
};

/** A pasted link, cleaned: https only, no tracking parameters, no fragments. Throws on junk. */
export function cleanLink(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw Object.assign(new Error("not a link"), { code: "invalid_link" });
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || url.username || url.password) throw Object.assign(new Error("not a web link"), { code: "invalid_link" });
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_\w+|fbclid|igsh|igshid|si|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}

export async function pasteLink(db, { url, note = null, by = "admin" }) {
  const clean = cleanLink(url);
  // A link pasted again after it was handled is checked again (it may have new details).
  const { signal, created } = await enqueueSignal(db, {
    origin: "link",
    url: clean,
    title: note,
    payload: { note },
    by,
    hash: sha("link", clean, new Date().toISOString().slice(0, 13)),
  });
  return { signal, created };
}

export function presentLink(signal) {
  return {
    id: signal.id,
    url: signal.url,
    note: signal.payload?.note ?? null,
    status: signal.status,
    message: signal.message ?? LINK_MESSAGES[signal.status] ?? null,
    eventId: signal.eventId ?? signal.event_id ?? null,
    createdAt: new Date(signal.createdAt ?? signal.created_at).toISOString(),
    updatedAt: new Date(signal.updatedAt ?? signal.updated_at).toISOString(),
  };
}
