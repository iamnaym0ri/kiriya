import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { registerServiceWorker, resyncSurprises } from "../lib/pwa.js";
import { useNotes } from "../lib/notes.js";
import { Credits, Icon } from "../shared/WorldPrimitives.jsx";
import { BirthdayRibbon, MotionToggle } from "../shared/play/PlayfulWorld.jsx";
import { SketchbookProvider } from "./studio/SketchbookState.jsx";
import { DailyStyleButton } from "../shared/DailyStyle.jsx";
import CompanionHost from "./companions/CompanionHost.jsx";
import CornerWidget from "./home/CornerWidget.jsx";
import AppTabBar from "../shared/AppTabBar.jsx";
import PullToRefresh from "../shared/PullToRefresh.jsx";
import { AppTopBar, useAppNavigation, useKeyboardClass } from "../shared/AppFrame.jsx";
import { tabOf } from "../lib/appLinks.js";
import { isAppShell } from "../lib/native.js";
import "./WorldShell.css";
import "../styles/app-shell.css";
const TABS = [
  { to: "/world#letters-hub", label: "letters & notes" },
  { to: "/world#play-desk", label: "doodle & play" },
  { to: "/world#events", label: "events & merch" },
];
// Tabs where pulling down at the top refreshes what's on screen (the chat scrolls on its own; games
// and settings have nothing to fetch).
const PULL_TO_REFRESH = new Set(["home", "mail"]);

export default function WorldShell() {
  return isAppShell() ? <AppShell /> : <WebsiteShell />;
}

/** The website: exactly as it was. */
function WebsiteShell() {
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [credits, setCredits] = useState(false);
  const unread = useNotes().data?.unread ?? 0;
  useEffect(() => {
    registerServiceWorker()
      .then(() => resyncSurprises())
      .catch(() => {});
  }, []);
  useEffect(() => {
    setMenu(false);
    if (location.hash) {
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    } else window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);
  return (
    <SketchbookProvider>
      <div className="world lilac-scene">
        <a className="skip-link" href="#world-main">
          Skip to content
        </a>
        <header className="world-mast">
          <Link
            to="/world"
            className="tiny-wordmark"
            aria-label="Kiriya’s home"
          >
            kiriya<span>✦</span>
          </Link>
          <nav className="world-bookmarks" aria-label="Your world">
            {TABS.map((tab) => (
              <Link key={tab.to} to={tab.to}>
                {tab.label}
              </Link>
            ))}
          </nav>
          <div className="world-mast__actions">
            <DailyStyleButton />
            <MotionToggle />
            <NavLink
              to="/world/letters"
              className="quiet-button world-letter-link"
            >
              <Icon name="mail" size={17} />
              <span>Letters</span>
            </NavLink>
            <NavLink
              to="/world/notes"
              className="icon-button world-notes-link"
              aria-label={unread ? `Notes for you, ${unread} new` : "Notes for you"}
            >
              <Icon name="heart" size={18} />
              {unread > 0 && <span className="world-notes-link__count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
            </NavLink>
            <NavLink
              to="/world/settings"
              className="icon-button world-settings-link"
              aria-label="Settings"
            >
              <Icon name="settings" size={18} />
            </NavLink>
            <button
              className="icon-button world-menu-toggle"
              aria-label={menu ? "Close section menu" : unread ? `Open section menu, ${unread} new notes` : "Open section menu"}
              aria-expanded={menu}
              aria-controls="world-mobile-menu"
              onClick={() => setMenu(!menu)}
            >
              <Icon name={menu ? "close" : "menu"} />
              {unread > 0 && !menu && <span className="world-notes-link__count world-menu-toggle__count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
            </button>
          </div>
        </header>
        <BirthdayRibbon />
        {menu && (
          <nav
            id="world-mobile-menu"
            className="world-mobile-menu"
            aria-label="Sections"
          >
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                onClick={() => setMenu(false)}
              >
                {tab.label}
                <Icon name="arrow" size={16} />
              </NavLink>
            ))}
            <Link to="/world/letters">
              Letters & your birthday gift
              <Icon name="mail" size={16} />
            </Link>
            <Link to="/world/notes">
              Notes for you{unread ? ` · ${unread} new` : ""} <Icon name="heart" size={16} />
            </Link>
            <Link to="/world/saves">
              Your saves <Icon name="heart" size={16} />
            </Link>
            <Link to="/world/merch">
              The merch shelf <Icon name="arrow" size={16} />
            </Link>
            <Link to="/world/settings">Settings <Icon name="settings" size={16} /></Link>
          </nav>
        )}
        <main className="world-content" id="world-main">
          <Outlet />
        </main>
        <footer className="world-footer">
          <span className="handwritten">a little world, entirely yours.</span>
          <Link to="/?view=public">
            Your public profile <Icon name="diagonal" size={12} />
          </Link>
          <button onClick={() => setCredits(true)}>Art & credits</button>
          <span>made with love ♡</span>
        </footer>
        {credits && <Credits onClose={() => setCredits(false)} />}
        {/* She lives here rather than on one page: mounted by the shell so she keeps her place,
            her mood and her train of thought while the route underneath her changes. */}
        <CompanionHost />
      </div>
    </SketchbookProvider>
  );
}

/**
 * The iPhone app (docs/refactor/RENOVATION.md, "App layout"): five tabs under a tab bar. The
 * website's top bar shows on home only: the wordmark on the left and her little corner, as a small
 * chip, on the right. The letters button and the menu moved into their tabs, and the animations
 * switch into her settings. Every other tab starts with its own large title, and a small
 * frosted bar takes over once that scrolls away. No footer: Art & credits and the public profile
 * live in the last tab.
 */
function AppShell() {
  const location = useLocation();
  const redirecting = useAppNavigation();
  useKeyboardClass();
  const tab = tabOf(location.pathname);
  const home = tab === "home" && /^\/world\/?$/.test(location.pathname);
  useEffect(() => {
    registerServiceWorker()
      .then(() => resyncSurprises())
      .catch(() => {});
  }, []);
  useEffect(() => {
    document.body.dataset.tab = tab;
    return () => {
      delete document.body.dataset.tab;
    };
  }, [tab]);
  return (
    <SketchbookProvider>
      <div className="world lilac-scene" data-tab={tab}>
        {home && (
          <>
            <header className="world-mast world-mast--home">
              <Link to="/world" className="tiny-wordmark" aria-label="Kiriya’s home">
                kiriya<span>✦</span>
              </Link>
              <CornerWidget />
            </header>
            <BirthdayRibbon />
          </>
        )}
        <main className="world-content" id="world-main">
          {!redirecting && <Outlet />}
        </main>
        <CompanionHost />
        <AppTopBar />
        <AppTabBar />
        <PullToRefresh enabled={PULL_TO_REFRESH.has(tab)} />
      </div>
    </SketchbookProvider>
  );
}
