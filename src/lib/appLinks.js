// Where an old link lands in the iPhone app's five sections (docs/refactor/RENOVATION.md, "Deep
// links in the app"). Notifications, widgets, Siri, quick actions and links inside the content were
// written for the website's one long home page; inside the app each of those places is a tab or a
// pushed screen. Pure, so NativeApp (before navigating) and the shell (for any link) share it, and
// scripts/test-app-links.mjs checks the whole list. Owner: the frame agent.

const parse = (to) => {
  if (typeof to !== "string") return { pathname: to.pathname ?? "/world", search: to.search ?? "", hash: to.hash ?? "" };
  const url = new URL(to, "https://app.invalid");
  return { pathname: url.pathname, search: url.search, hash: url.hash };
};

const join = ({ pathname, search, hash }) => `${pathname}${search && search !== "?" ? search : ""}${hash && hash !== "#" ? hash : ""}`;

/**
 * The app's path for a website path (string or { pathname, search, hash }). Returns the same path
 * when nothing needs to change.
 */
export function appPath(to) {
  const { pathname: rawPath, search, hash } = parse(to);
  const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const params = new URLSearchParams(search);
  const anchor = hash.replace(/^#/, "");

  if (pathname === "/world") {
    // An event's notification: /world?event=<id>#events → that event's own page (events-ui).
    const event = params.get("event");
    if (event) return `/world/events/${encodeURIComponent(event)}`;
    // A note on one of her doodles: /world?gallery=1&doodle=<id>#play-desk → play, doodle open.
    if (anchor === "play-desk" || params.has("doodle") || params.has("gallery") || params.has("paint")) {
      const next = new URLSearchParams();
      for (const key of ["doodle", "gallery", "paint"]) if (params.has(key)) next.set(key, params.get(key));
      const query = next.toString();
      return `/world/play${query ? `?${query}` : ""}`;
    }
    if (anchor === "letters-hub") return "/world/mail";
    if (anchor === "note-jar") return "/world/mail#note-jar";
    if (anchor === "events") return "/world/events";
  }
  // The mail agent also redirects these from its own pages; doing it here first avoids a flash.
  if (pathname === "/world/notes" && params.get("open")) return `/world/mail?note=${encodeURIComponent(params.get("open"))}`;
  if (pathname === "/world/letters" && params.get("open")) return `/world/mail?letter=${encodeURIComponent(params.get("open"))}`;
  if (pathname === "/world/settings" || pathname.startsWith("/world/settings/")) return join({ pathname: "/world/me", search, hash });
  return join({ pathname, search, hash });
}

/** The five tabs, in order. `match` decides which tab a path belongs to (pushed screens included). */
export const APP_TABS = [
  { key: "home", to: "/world" },
  { key: "chat", to: "/world/chat", match: /^\/world\/(chat|memories)(\/|$)/ },
  { key: "play", to: "/world/play", match: /^\/world\/(play|studio|art|game-lab)(\/|$)/ },
  { key: "mail", to: "/world/mail", match: /^\/world\/(mail|letters|notes)(\/|$)/ },
  { key: "me", to: "/world/me", match: /^\/world\/(me|settings)(\/|$)/ },
];

/** Which tab a path is in. Anything else under /world (events, saves, merch) is pushed from home. */
export function tabOf(pathname) {
  return APP_TABS.find((tab) => tab.match?.test(pathname))?.key ?? "home";
}

export const tabRoot = (key) => APP_TABS.find((tab) => tab.key === key)?.to ?? "/world";
