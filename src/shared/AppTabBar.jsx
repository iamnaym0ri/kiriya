import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useChatSummary } from "../lib/chat.js";
import { useNotes } from "../lib/notes.js";
import { haptic } from "../lib/native.js";
import { useIsAdmin } from "../lib/session.js";
import { tabOf, tabRoot } from "../lib/appLinks.js";
import { setPendingRestore, tabDepth, tabTarget } from "./AppFrame.jsx";
import "./AppTabBar.css";

// The iPhone app's tab bar (docs/refactor/RENOVATION.md, "App layout"). Five sections; the last one
// is named after whoever is signed in. Each tab remembers where she was in it; tapping the tab she's
// on goes back to its first screen, then to the top. Owner: the frame agent.
const TABS = [
  { key: "home", label: "home" },
  { key: "chat", label: "chat" },
  { key: "play", label: "play" },
  { key: "mail", label: "notes & letters" },
  { key: "me", label: "kiriya" },
];

// Hand-drawn icons, a little wobbly on purpose, in the site's ink-and-paper style. `shape` takes a
// soft fill when the tab is active; `lines` and `dots` are the details drawn on top.
const ICONS = {
  home: {
    shape: "M5.3 10.6c-.1 3 .1 6 .3 8.9 4.2.3 8.5.2 12.8-.1.2-3 .2-6 .1-8.9L12.1 4.6Z",
    lines: [
      "M3.5 11.4c2.6-2.2 5.6-4.7 8.6-7.2 2.9 2.4 5.8 4.8 8.5 7.1",
      "M12 17c-1.9-1.3-2.7-2.3-2.5-3.3.2-1.1 1.6-1.4 2.5-.3.9-1.1 2.3-.8 2.5.3.2 1-.6 2-2.5 3.3Z",
    ],
  },
  chat: {
    shape:
      "M4.5 6.9c.3-1.6 1.5-2.3 3.1-2.4 3-.2 6-.2 9 0 1.8.1 2.9 1 3 2.7.2 2 .1 4.2-.1 6.1-.2 1.6-1.3 2.4-2.9 2.5l-6.4.2c-1.5 1.4-3 2.6-4.6 3.6.5-1.3.9-2.5 1.1-3.8-1.3-.2-2.1-1-2.2-2.4-.2-2.2-.2-4.5 0-6.5Z",
    dots: [
      [8.9, 10.3],
      [12, 10.3],
      [15.1, 10.3],
    ],
  },
  play: {
    shape:
      "M7.2 8.4c3.2-.5 6.4-.5 9.6 0 2.6.4 3.8 3 4 5.8.2 2.4-.9 4-2.5 4-1.4 0-2.2-1.2-3.2-2.3-2.1-.2-4.1-.2-6.2 0-1 1.1-1.8 2.3-3.2 2.3-1.6 0-2.7-1.6-2.5-4 .2-2.8 1.4-5.4 4-5.8Z",
    lines: ["M7.8 11.1v3.1", "M6.3 12.7h3.1", "M10.6 6.2c.4-1 1-1.6 1.7-1.9"],
    dots: [
      [15.7, 11.6],
      [17.4, 13.4],
    ],
  },
  mail: {
    shape:
      "M4.2 7.4c.1-.9.7-1.4 1.6-1.4 4.1-.1 8.3-.1 12.4 0 .9 0 1.5.6 1.6 1.5.1 2.9.1 5.9-.1 8.9-.1 1-.7 1.5-1.6 1.6-4.1.1-8.1.1-12.2 0-.9-.1-1.5-.6-1.6-1.5-.2-3.1-.2-6.1-.1-9.1Z",
    lines: [
      "M4.7 6.9c2.3 1.9 4.7 3.7 7.3 5.4 2.6-1.7 5-3.5 7.3-5.4",
      "M4.8 17.3c1.9-1.7 3.6-3.1 5.4-4.4M19.2 17.3c-1.9-1.7-3.6-3.1-5.4-4.4",
    ],
  },
  bow: {
    shape:
      "M11 11.4C8.8 9 6.2 7.6 4.6 8.4c-1.3.7-1.2 4 0 5 1.6 1.2 4.2 0 6.4-1.5Zm2 0c2.2-2.4 4.8-3.8 6.4-3 1.3.7 1.2 4 0 5-1.6 1.2-4.2 0-6.4-1.5Z",
    lines: [
      "M10.7 10.6c.9-.4 1.7-.4 2.6 0 .3.8.3 1.5 0 2.3-.9.4-1.7.4-2.6 0-.3-.8-.3-1.5 0-2.3Z",
      "M11.2 13.1c-.8 2-1.8 3.8-3 5.5M12.8 13.1c.8 2 1.8 3.8 3 5.5",
    ],
  },
  face: {
    shape: "M12 4.3c4.4-.1 7.7 3.2 7.7 7.6.1 4.5-3.2 7.9-7.6 7.9-4.5 0-7.8-3.3-7.8-7.8 0-4.4 3.3-7.6 7.7-7.7Z",
    lines: ["M9.1 14.1c1.6 1.6 4.2 1.6 5.8 0"],
    dots: [
      [9.4, 10.6],
      [14.6, 10.6],
    ],
  },
};

function TabIcon({ name }) {
  const icon = ICONS[name];
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="app-tabs__fill" d={icon.shape} />
      {icon.lines?.map((d) => <path key={d} d={d} />)}
      {icon.dots?.map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="1.05" fill="currentColor" stroke="none" />)}
    </svg>
  );
}

export default function AppTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = tabOf(location.pathname);
  const notes = useNotes().data?.unread ?? 0;
  const chat = useChatSummary().data?.unread ?? 0;
  const counts = { mail: notes, chat };
  // The last tab is named after whoever is signed in.
  const admin = useIsAdmin();

  useEffect(() => {
    document.body.dataset.appTabs = "on";
    return () => {
      delete document.body.dataset.appTabs;
    };
  }, []);

  function choose(event, key) {
    event.preventDefault();
    haptic("light");
    if (key !== current) {
      const { to, y } = tabTarget(key);
      setPendingRestore(y);
      navigate(to, { replace: true });
      return;
    }
    // The tab she's on: back to its first screen, then to the top.
    const depth = tabDepth();
    const root = tabRoot(key);
    if (depth > 0) navigate(-depth);
    else if (`${location.pathname}${location.search}${location.hash}` !== root) navigate(root, { replace: true });
    else {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      document.dispatchEvent(new CustomEvent("app:tab-reselect", { detail: { tab: key } }));
    }
  }

  return (
    <nav className="app-tabs" aria-label="Sections">
      {TABS.map((tab) => {
        const count = counts[tab.key] ?? 0;
        const label = tab.key === "me" && admin ? "josh" : tab.label;
        const icon = tab.key === "me" ? (admin ? "face" : "bow") : tab.key;
        return (
          <a
            key={tab.key}
            href={tabRoot(tab.key)}
            className="app-tabs__tab"
            data-tab={tab.key}
            aria-current={current === tab.key ? "page" : undefined}
            aria-label={count > 0 ? `${label}, ${count} new` : label}
            onClick={(event) => choose(event, tab.key)}
          >
            <span className="app-tabs__icon">
              <TabIcon name={icon} />
              {count > 0 && (
                <span className="app-tabs__count" aria-hidden="true">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            <span className="app-tabs__label" aria-hidden="true">
              {label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
