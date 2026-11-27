// The website is closed until Josh gives Kiriya the app (2026-11-27: "I just don't want her to see it
// before the surprise"). One switch for both sides:
// - browsers get the quiet page (src/lib/siteClosed.js, src/public/ClosedPage.jsx), the app keeps
//   everything;
// - nothing notifies Kiriya (server/push/webpush.js sendToSubscribers): chat, notes, letters, the
//   note jar, quizzes and her scheduled surprises are still saved, but stay silent. Josh's own
//   notifications keep working.
// Set to false (and deploy) to open the website and turn her notifications back on.
export const WEBSITE_CLOSED = true;
