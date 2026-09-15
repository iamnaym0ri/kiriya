import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { registerServiceWorker, resyncSurprises } from "../lib/pwa.js";
import { Credits, Icon } from "../shared/WorldPrimitives.jsx";
import { BirthdayRibbon, MotionToggle } from "../shared/play/PlayfulWorld.jsx";
import { SketchbookProvider } from "./studio/SketchbookState.jsx";
import "./WorldShell.css";
const TABS = [
  { to: "/world#play-desk", label: "doodle & play" },
  { to: "/world#maomao", label: "maomao" },
  { to: "/world#music", label: "music" },
  { to: "/world#cosplay", label: "dress-up" },
];
export default function WorldShell() {
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [credits, setCredits] = useState(false);
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
            <MotionToggle />
            <NavLink
              to="/world/letters"
              className="quiet-button world-letter-link"
            >
              <Icon name="mail" size={17} />
              <span>Letters</span>
            </NavLink>
            <NavLink
              to="/world/settings"
              className="icon-button"
              aria-label="Settings"
            >
              <Icon name="settings" size={18} />
            </NavLink>
            <button
              className="icon-button world-menu-toggle"
              aria-label={menu ? "Close section menu" : "Open section menu"}
              aria-expanded={menu}
              aria-controls="world-mobile-menu"
              onClick={() => setMenu(!menu)}
            >
              <Icon name={menu ? "close" : "menu"} />
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
          </nav>
        )}
        <main className="world-content" id="world-main">
          <Outlet />
        </main>
        <footer className="world-footer">
          <span className="handwritten">a little world, entirely yours.</span>
          <Link to="/">
            Public profile <Icon name="diagonal" size={12} />
          </Link>
          <button onClick={() => setCredits(true)}>Art & credits</button>
          <span>made with love ♡</span>
        </footer>
        {credits && <Credits onClose={() => setCredits(false)} />}
      </div>
    </SketchbookProvider>
  );
}
