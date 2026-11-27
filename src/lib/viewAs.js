// "See it as kiriya": Josh's phone shows the app exactly as hers does, read-only. Every API call
// then carries `x-view-as: kiriya`, and the server answers those reads as if she asked
// (server/auth/session.js requireRole). Nothing can be changed while it is on: writes are turned
// away here and again by the server, so nothing he taps can reach her or mark anything as seen.
// Kept in sessionStorage: it lasts through an in-app reload and ends when the app closes.

const KEY = "kiriya:view-as";
const listeners = new Set();

let viewAs = null;
try {
  viewAs = sessionStorage.getItem(KEY) === "kiriya" ? "kiriya" : null;
} catch {
  viewAs = null;
}

/** "kiriya" while Josh is previewing her side, else null. */
export const viewingAs = () => viewAs;

export function setViewingAs(value) {
  viewAs = value === "kiriya" ? "kiriya" : null;
  try {
    if (viewAs) sessionStorage.setItem(KEY, viewAs);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the preview lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeViewAs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Paths that stay Josh's own even in the preview: signing in and out, and this phone's own pieces
// (its device, widgets, icon badge and notifications), so his Home Screen keeps showing his side.
const OWN = /^\/(?:session(?:\/|$)|app\/|push\/)/;

/** Whether a request to this API path speaks as her while previewing. */
export const speaksAsHer = (path) => Boolean(viewAs) && !OWN.test(path);

/** Whether a request would change something while previewing (and so is turned away). */
export const blockedInPreview = (path, method) =>
  Boolean(viewAs) && method !== "GET" && method !== "HEAD" && !/^\/session(?:\/|$)/.test(path) && !/^\/app\/devices(?:\/|$)/.test(path);

export const PREVIEW_MESSAGE = "just peeking at her side ♡ switch back to josh to change things.";
