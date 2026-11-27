import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useChatSummary } from "../lib/chat.js";
import { useNotes } from "../lib/notes.js";
import { haptic } from "../lib/native.js";
import { useIsAdmin } from "../lib/session.js";
import "./AppTabBar.css";

// The iPhone app's bottom tab bar (docs/refactor/PLAN.md 4b): the website keeps its own top bar
// and menu; inside the app the same places sit under her thumb, like any iPhone app.
const TABS = [
  { key: "home", to: "/world", label: "home", icon: "home" },
  { key: "chat", to: "/world/chat", label: "chat", icon: "chat" },
  { key: "play", to: "/world/play", label: "play", icon: "play" },
  { key: "mail", to: "/world/mail", label: "letters", icon: "letters" },
  { key: "me", to: "/world/me", label: "kiriya", icon: "me" },
];

// The app's five sections (docs/refactor/RENOVATION.md). Old links (/world/notes, /world/letters,
// /world/settings, notification deep links) still land in the right section.
function activeTab({ pathname }) {
  if (/^\/world\/(me|settings)/.test(pathname)) return "me";
  if (/^\/world\/(chat|memories)/.test(pathname)) return "chat";
  if (/^\/world\/(mail|letters|notes)/.test(pathname)) return "mail";
  if (/^\/world\/(play|studio|art)/.test(pathname)) return "play";
  return "home";
}

const PATHS = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  letters: "M4 7h16v11H4zM4 7l8 6 8-6",
  chat: "M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  play: "M7 9h10a4 4 0 0 1 0 8c-1.5 0-2.3-1-3-2h-4c-.7 1-1.5 2-3 2a4 4 0 0 1 0-8zM8.5 11v3M7 12.5h3M15.5 12h.01M17 14h.01",
  events: "M5 7h14v12H5zM5 11h14M9 4v5M15 4v5",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c1-3.5 3.8-5 7-5s6 1.5 7 5",
};

export default function AppTabBar() {
  const location = useLocation();
  const current = activeTab(location);
  const notes = useNotes().data?.unread ?? 0;
  const chat = useChatSummary().data?.unread ?? 0;
  const counts = { mail: notes, chat };
  // The last tab is named after whoever is signed in.
  const admin = useIsAdmin();
  const labelFor = (tab) => (tab.key === "me" && admin ? "josh" : tab.label);
  useEffect(() => {
    document.body.dataset.appTabs = "on";
    return () => {
      delete document.body.dataset.appTabs;
    };
  }, []);
  return (
    <nav className="app-tabs" aria-label="Your world">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          className="app-tabs__tab"
          aria-current={current === tab.key ? "page" : undefined}
          onClick={() => {
            haptic("light");
            // Tapping the tab you're on goes back to its top, as on any iPhone app.
            if (tab.key === "home" && current === "home" && !location.hash) window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="app-tabs__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={PATHS[tab.icon]} />
            </svg>
            {counts[tab.key] > 0 && <span className="app-tabs__count">{counts[tab.key] > 9 ? "9+" : counts[tab.key]}</span>}
          </span>
          <span className="app-tabs__label">{labelFor(tab)}</span>
        </Link>
      ))}
    </nav>
  );
}
