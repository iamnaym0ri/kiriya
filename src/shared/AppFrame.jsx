import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import { Capacitor } from "@capacitor/core";
import { appPath, tabOf, tabRoot } from "../lib/appLinks.js";

// The iPhone app's frame behaviour (docs/refactor/RENOVATION.md, "App layout"), shared by the shell
// (WorldShell), the tab bar (AppTabBar) and any pushed screen (useAppBack). Owner: the frame agent.
//
// Like any iPhone app:
// - each tab remembers where it was (its page, a pushed screen in it, and how far down she'd scrolled);
// - switching tabs doesn't pile up history, so the edge swipe only ever goes back inside a tab;
// - tapping the tab you're on pops back to its first screen, then scrolls to the top;
// - a section's large title hands over to a small frosted bar once it scrolls away.

const scrolls = new Map(); // history entry key → scrollY when she left it
const tabs = new Map(); // tab → { path, key } of the last place she was in it
let stack = []; // history keys of the screens pushed inside the current tab (root first)
let currentKey = null;
let currentTab = null;
let pendingRestore = null; // { key, y } set by the tab bar for the switch it starts

const pathOf = (location) => `${location.pathname}${location.search}${location.hash}`;

/** Called by the tab bar. Returns where to go for a tap on `key`, and remembers the scroll to restore. */
export function tabTarget(key) {
  if (currentKey) scrolls.set(currentKey, window.scrollY);
  const memory = tabs.get(key);
  if (!memory) return { to: tabRoot(key), y: 0 };
  return { to: memory.path, y: scrolls.get(memory.key) ?? 0 };
}

/** How many screens deep the current tab is (0 = its first screen). */
export const tabDepth = () => Math.max(0, stack.length - 1);

export function setPendingRestore(y) {
  pendingRestore = { y };
}

/**
 * For a pushed screen's back button (`.app-screen__back`): goes back if she came from inside the same
 * tab (so the iPhone's edge swipe and the button agree), otherwise replaces this screen with
 * `fallback` (the tab's first screen by default), e.g. when a notification opened it directly.
 */
export function useAppBack(fallback) {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (stack.length > 1) navigate(-1);
    else navigate(fallback ?? tabRoot(tabOf(location.pathname)), { replace: true });
  }, [navigate, fallback, location.pathname]);
}

// Scrolls to `y` once the page is tall enough (content may still be arriving from the cache).
function restoreScroll(y) {
  if (!y) {
    window.scrollTo(0, 0);
    return () => {};
  }
  let frame = 0;
  const started = performance.now();
  const attempt = () => {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (room >= y - 2 || performance.now() - started > 900) {
      window.scrollTo(0, Math.min(y, Math.max(0, room)));
      return;
    }
    window.scrollTo(0, room);
    frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}

// Scrolls to #anchor once it exists.
function scrollToAnchor(id) {
  let frame = 0;
  const started = performance.now();
  const attempt = () => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start" });
    else if (performance.now() - started < 1500) frame = requestAnimationFrame(attempt);
  };
  frame = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(frame);
}

/** The shell's half: old links, history per tab, scroll positions, and data-nav for transitions. */
export function useAppNavigation() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const mapped = appPath(location);
  const redirecting = mapped !== pathOf(location);

  useEffect(() => {
    if (redirecting) navigate(mapped, { replace: true, state: location.state });
  }, [redirecting, mapped, navigate, location.state]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (currentKey) scrolls.set(currentKey, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    if (redirecting) return undefined;
    const tab = tabOf(location.pathname);
    const sameTab = tab === currentTab;
    // The history inside this tab, so back buttons and the edge swipe stay in it.
    if (type === "PUSH") stack = sameTab ? [...stack, location.key] : [location.key];
    else if (type === "REPLACE") stack = sameTab && stack.length ? [...stack.slice(0, -1), location.key] : [location.key];
    else {
      const at = stack.indexOf(location.key);
      stack = at >= 0 ? stack.slice(0, at + 1) : [location.key];
    }
    currentKey = location.key;
    currentTab = tab;
    tabs.set(tab, { path: pathOf(location), key: location.key });
    document.documentElement.dataset.nav = pendingRestore ? "tab" : type.toLowerCase();

    if (pendingRestore) {
      const { y } = pendingRestore;
      pendingRestore = null;
      scrolls.set(location.key, y);
      return restoreScroll(y);
    }
    if (location.hash.length > 1) return scrollToAnchor(decodeURIComponent(location.hash.slice(1)));
    if (type === "POP") return restoreScroll(scrolls.get(location.key) ?? 0);
    window.scrollTo(0, 0);
    return undefined;
  }, [location.key, redirecting]); // eslint-disable-line react-hooks/exhaustive-deps

  return redirecting;
}

/**
 * Keeps body.keyboard-open while the on-screen keyboard is up, where the app's Keyboard plugin
 * isn't there to say so (Safari, the Simulator, older builds). The plugin's own events
 * (lib/native.js trackKeyboard) win inside the app.
 */
export function useKeyboardClass() {
  useEffect(() => {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Keyboard")) return undefined;
    const viewport = window.visualViewport;
    const touch = matchMedia("(pointer: coarse)").matches;
    const typing = (element) =>
      element?.matches?.(
        "textarea, [contenteditable=''], [contenteditable='true'], input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit], [type=reset], [type=file], [type=color], [type=image], [type=hidden])",
      ) && !element.readOnly;
    const update = () => {
      const squeezed = viewport ? window.innerHeight - viewport.height > 140 : false;
      const open = squeezed || (touch && typing(document.activeElement));
      document.body.classList.toggle("keyboard-open", Boolean(open));
    };
    const later = () => requestAnimationFrame(update);
    viewport?.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    update();
    return () => {
      viewport?.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
      document.body.classList.remove("keyboard-open");
    };
  }, []);
}

/**
 * The small frosted bar at the top of the screen. It stays out of sight while a section's large
 * title (or home's wordmark) is on screen and fades in once that scrolls under the status bar,
 * carrying the title (and the back button on a pushed screen). Tapping the title scrolls to the top.
 */
export function AppTopBar() {
  const location = useLocation();
  const [state, setState] = useState({ shown: false, title: "", mark: false, back: "" });
  const latest = useRef(state);

  useEffect(() => {
    let frame = 0;
    let safeTop = null;
    const measure = () => {
      frame = 0;
      // The strip behind the status bar is exactly the safe-area inset tall.
      safeTop ??= document.querySelector(".app-topbar-strip")?.getBoundingClientRect().height ?? 0;
      const content = document.getElementById("world-main");
      const mast = document.querySelector(".world > .world-mast");
      const screen = content?.querySelector(".app-screen");
      const heading = (screen ?? content)?.querySelector(".app-section__title");
      const anchor = heading ?? (mast && getComputedStyle(mast).display !== "none" ? mast : null);
      const barBottom = safeTop + 44;
      const shown = anchor ? anchor.getBoundingClientRect().bottom < barBottom : window.scrollY > 40;
      const mark = !heading && Boolean(mast);
      const title = heading ? (heading.dataset.short || heading.textContent || "").trim() : "";
      const backButton = screen?.querySelector(".app-screen__back");
      const back = backButton ? (backButton.textContent || "back").trim() : "";
      const next = { shown, title, mark, back };
      const prev = latest.current;
      if (prev.shown !== next.shown || prev.title !== next.title || prev.mark !== next.mark || prev.back !== next.back) {
        latest.current = next;
        setState(next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Sections render after their chunk and data arrive: look again when the content changes.
    const content = document.getElementById("world-main");
    const observer = content ? new MutationObserver(schedule) : null;
    observer?.observe(content, { childList: true, subtree: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [location.key]);

  const toTop = () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const goBack = () => document.querySelector("#world-main .app-screen .app-screen__back")?.click();

  return (
    <>
      <div className="app-topbar-strip" aria-hidden="true" />
      <div className="app-topbar" data-shown={state.shown} aria-hidden={!state.shown}>
        {state.back && (
          <button type="button" className="app-screen__back app-topbar__back" onClick={goBack} tabIndex={state.shown ? 0 : -1}>
            {state.back}
          </button>
        )}
        <button
          type="button"
          className={state.mark ? "app-topbar__title app-topbar__title--mark" : "app-topbar__title"}
          onClick={toTop}
          tabIndex={state.shown ? 0 : -1}
          aria-label={`${state.mark ? "kiriya" : state.title}, back to the top`}
        >
          {state.mark ? (
            <>
              kiriya<span aria-hidden="true">✦</span>
            </>
          ) : (
            state.title
          )}
        </button>
      </div>
    </>
  );
}
