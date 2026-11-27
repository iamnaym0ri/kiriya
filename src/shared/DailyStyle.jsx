import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { usePrefs, useSetPrefs } from "../lib/prefs.js";
import { Icon } from "./WorldPrimitives.jsx";
import { isAppShell } from "../lib/native.js";
import "./DailyStyle.css";
const Checkin = lazy(() => import("../world/today/MoodCheckin.jsx"));
const TITLE = "Whay u feeling like today ;)";
const DailyStyleContext = createContext({ current: null, copy: null, open: () => {} });
export const useDailyStyle = () => useContext(DailyStyleContext);

/** "since Tuesday" once a choice has carried over from an earlier day. */
export function sinceLabel(current, today) {
  if (!current?.setDay || !today || current.setDay === today) return null;
  const days = Math.round((Date.parse(`${today}T12:00:00+08:00`) - Date.parse(`${current.setDay}T12:00:00+08:00`)) / 86_400_000);
  if (days === 1) return "since yesterday";
  if (days < 7) return `since ${new Intl.DateTimeFormat("en-SG", { weekday: "long", timeZone: "Asia/Singapore" }).format(new Date(`${current.setDay}T12:00:00+08:00`))}`;
  return `since ${new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" }).format(new Date(`${current.setDay}T12:00:00+08:00`))}`;
}

function CornerPanel({ query, data, onClose, onPreview }) {
  const ref = useRef(null);
  useEffect(() => {
    const panel = ref.current;
    const previous = document.activeElement;
    panel.showPopover();
    panel.querySelector("button")?.focus({ preventScroll: true });
    return () => {
      // Pointer dismissal should leave focus on the newly selected page control.
      if (panel.contains(document.activeElement) || document.activeElement === document.body) previous?.focus?.({ preventScroll: true });
    };
  }, []);
  return <section ref={ref} id="feeling-corner-panel" popover="auto" role="dialog" aria-labelledby="feeling-corner-title" className="daily-style-panel" onToggle={event => { if (event.newState === "closed") onClose(); }}>
    <header className="daily-style-panel__head">
      <div><span className="micro-label">YOUR OWN LITTLE CORNER</span><h2 id="feeling-corner-title">{data?.labels.title ?? TITLE}</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Close your little corner"><Icon name="close" /></button>
    </header>
    {query.isError ? <div className="daily-style-panel__error"><p role="alert">Your check-in couldn’t load.</p><button className="button-plum" onClick={() => query.refetch()}>Try again</button></div>
      : !data ? <p role="status">Opening your little check-in…</p>
      : <Suspense fallback={<p role="status">Opening your little check-in…</p>}><Checkin data={data} onDone={onClose} onPreview={onPreview} /></Suspense>}
  </section>;
}

const SHEET_EXIT_MS = 340;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Drag her corner's sheet down to close it, like any iPhone sheet: from the grabber and the header
 * always, and from the content once it's scrolled to the very top. The sheet follows the finger; it
 * closes past a third of its height (or 150 pt) or on a quick flick, and springs back otherwise.
 * The page underneath never scrolls with it. The mouse can drag the grabber on a computer.
 */
function useSheetDrag({ root, panel, scroll, enabled, onDismiss }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const rootNode = root.current;
    const panelNode = panel.current;
    if (!enabled || !rootNode || !panelNode) return undefined;
    let drag = null;
    const fromHandle = (target) => Boolean(target.closest?.(".corner-sheet__grab"));
    // Controls that move with a finger of their own keep it.
    const owned = (target) => Boolean(target.closest?.("input, textarea, select, [contenteditable='true'], [data-sheet-no-drag]"));
    const atTop = () => (scroll.current?.scrollTop ?? 0) <= 0;

    function begin(y, target) {
      const handle = fromHandle(target);
      if (!handle && (owned(target) || !scroll.current?.contains(target))) return;
      drag = { y0: y, last: y, lastT: performance.now(), velocity: 0, dy: 0, moving: false, handle };
    }
    function move(y, event) {
      if (!drag) return;
      const dy = y - drag.y0;
      if (!drag.moving) {
        if (dy === 0) return;
        // Content that can still scroll up, or a swipe upward, is an ordinary scroll.
        if (!drag.handle && (dy < 0 || !atTop())) {
          drag = null;
          return;
        }
        drag.moving = true;
        drag.y0 = y;
        rootNode.classList.add("is-dragging");
      }
      if (event?.cancelable) event.preventDefault();
      const now = performance.now();
      const raw = y - drag.y0;
      // Pulling up past the top stretches a little and no further.
      drag.dy = raw < 0 ? -Math.min(18, Math.sqrt(-raw) * 2) : raw;
      drag.velocity = (y - drag.last) / Math.max(1, now - drag.lastT);
      drag.last = y;
      drag.lastT = now;
      panelNode.style.transform = `translate3d(0, ${drag.dy}px, 0)`;
      const height = panelNode.offsetHeight || 1;
      rootNode.style.setProperty("--corner-shade", String(Math.max(0, Math.min(1, 1 - drag.dy / height))));
    }
    function end() {
      if (!drag) return;
      const { moving, dy } = drag;
      // A finger that stopped before lifting isn't flinging.
      const velocity = performance.now() - drag.lastT > 90 ? 0 : drag.velocity;
      drag = null;
      if (!moving) return;
      rootNode.classList.remove("is-dragging");
      const height = panelNode.offsetHeight || 1;
      panelNode.style.transform = "";
      rootNode.style.removeProperty("--corner-shade");
      if (dy > Math.min(150, height * 0.33) || (velocity > 0.5 && dy > 20)) dismiss.current();
    }

    const onTouchStart = (event) => {
      // Pull to refresh (window) never sees a touch that started on the sheet.
      event.stopPropagation();
      if (event.touches.length === 1) begin(event.touches[0].clientY, event.target);
      else drag = null;
    };
    const onTouchMove = (event) => {
      if (drag) move(event.touches[0].clientY, event);
      // Nothing but the sheet's own content scrolls while it is up.
      else if (!scroll.current?.contains(event.target) && event.cancelable) event.preventDefault();
    };
    const onTouchEnd = () => end();
    const onPointerDown = (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !fromHandle(event.target) || event.target.closest("button")) return;
      begin(event.clientY, event.target);
      const onMove = (e) => move(e.clientY, e);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        end();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
    rootNode.addEventListener("touchstart", onTouchStart, { passive: true });
    rootNode.addEventListener("touchmove", onTouchMove, { passive: false });
    rootNode.addEventListener("touchend", onTouchEnd);
    rootNode.addEventListener("touchcancel", onTouchEnd);
    rootNode.addEventListener("pointerdown", onPointerDown);
    return () => {
      rootNode.removeEventListener("touchstart", onTouchStart);
      rootNode.removeEventListener("touchmove", onTouchMove);
      rootNode.removeEventListener("touchend", onTouchEnd);
      rootNode.removeEventListener("touchcancel", onTouchEnd);
      rootNode.removeEventListener("pointerdown", onPointerDown);
    };
  }, [root, panel, scroll, enabled]);
}

/**
 * Her corner in the app: a bottom sheet that slides up over a fading shade and leaves the same way.
 * The header (with a grabber) stays put, the check-in scrolls inside the sheet, and its "keep"
 * button sits on solid paper at the very bottom, above the home indicator (MoodCheckin's footer is
 * sticky inside the scroller, so nothing ever shows underneath it).
 */
function AppCornerSheet({ open, query, data, onClose, onPreview }) {
  const root = useRef(null);
  const panel = useRef(null);
  const scroll = useRef(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  // Mount, then slide in on the next frame; on close, slide out before unmounting.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), reducedMotion() ? 200 : SHEET_EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);
  useLayoutEffect(() => {
    if (!mounted || !open) return undefined;
    // Let the closed position paint first, so the slide has somewhere to start from.
    panel.current?.getBoundingClientRect();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted, open]);

  // Focus, Escape, and the page underneath held still while it's up.
  useEffect(() => {
    if (!mounted || !open) return undefined;
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("corner-sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("corner-sheet-open");
      if (previous && document.contains(previous)) previous.focus?.({ preventScroll: true });
    };
  }, [mounted, open, onClose]);

  useSheetDrag({ root, panel, scroll, enabled: mounted && open, onDismiss: onClose });

  if (!mounted) return null;
  return createPortal(
    <div ref={root} className="corner-sheet" data-shown={shown || undefined}>
      <div className="corner-sheet__shade" aria-hidden="true" onClick={onClose} />
      <section
        ref={panel}
        id="feeling-corner-panel"
        className="corner-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feeling-corner-title"
        tabIndex={-1}
      >
        <header className="corner-sheet__grab">
          <span className="corner-sheet__grabber" aria-hidden="true" />
          <div className="corner-sheet__head">
            <div className="corner-sheet__titles">
              <span className="corner-sheet__label">your own little corner</span>
              <h2 id="feeling-corner-title">{data?.labels.title ?? TITLE}</h2>
            </div>
            <button type="button" className="corner-sheet__close" onClick={onClose} aria-label="Close your little corner">
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>
        <div ref={scroll} className="corner-sheet__scroll">
          {query.isError ? (
            <div className="daily-style-panel__error">
              <p role="alert">Your check-in couldn’t load.</p>
              <button className="button-plum" onClick={() => query.refetch()}>Try again</button>
            </div>
          ) : !data ? (
            <p className="corner-sheet__wait" role="status">Opening your little check-in…</p>
          ) : (
            <Suspense fallback={<p className="corner-sheet__wait" role="status">Opening your little check-in…</p>}>
              <Checkin data={data} onDone={onClose} onPreview={onPreview} />
            </Suspense>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function DailyStyleProvider({ children }) {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const allowed = Boolean(session.data?.role);
  // The public page stays exactly what visitors see; her corner lives inside her world.
  const inWorld = location.pathname.startsWith("/world");
  const query = useQuery({ queryKey: ["me", "mood"], queryFn: () => api("/me/mood"), enabled: allowed, staleTime: 60_000 });
  const prefs = usePrefs();
  const setPrefs = useSetPrefs();
  const data = allowed && inWorld && query.error?.status !== 401 ? query.data : null;
  const current = data?.current ?? null;
  const [editing, setEditing] = useState(false);
  // While the corner is open, tapping a mood shows its colours straight away; closing without
  // keeping it goes back to the saved one.
  const [preview, setPreview] = useState(null);
  const small = prefs.data?.cornerSmall ?? false;
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => { setEditing(false); setPreview(null); }, []);
  const moodKey = (editing && preview?.mood) || current?.key || null;
  const feelingKey = editing && preview ? preview.feeling : current?.feeling?.key ?? null;
  const energy = current ? String(current.energy) : null;
  useEffect(() => {
    const root = document.documentElement;
    const apply = (name, value) => { if (value) root.dataset[name] = value; else delete root.dataset[name]; };
    apply("mood", moodKey);
    apply("feeling", feelingKey);
    apply("energy", energy);
    return () => { delete root.dataset.mood; delete root.dataset.energy; delete root.dataset.feeling; };
  }, [moodKey, feelingKey, energy]);
  useEffect(() => { if (!allowed || !inWorld) close(); }, [allowed, inWorld, close]);
  // /world?quick=status opens straight to the check-in: used by Home Screen shortcuts and widgets.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!allowed || !inWorld || params.get("quick") !== "status") return;
    setEditing(true);
    params.delete("quick");
    navigate({ pathname: location.pathname, search: params.size ? `?${params}` : "", hash: location.hash }, { replace: true });
  }, [allowed, inWorld, location, navigate]);
  const since = sinceLabel(current, data?.day);
  return <DailyStyleContext.Provider value={{ current, day: data?.day ?? null, copy: data?.copy ?? null, allowed, inWorld, since, open, editing }}>
    {children}
    {allowed && inWorld && !isAppShell() && <aside className="daily-style-corner" data-small={small} aria-label="Your little feeling corner">
      <button className="daily-style-corner__toggle" onClick={open} aria-label={TITLE} aria-haspopup="dialog" aria-expanded={editing} aria-controls={editing ? "feeling-corner-panel" : undefined}>
        <span className="daily-style-corner__face" aria-hidden="true">{current?.feeling?.emoji ?? "♡"}</span>
        {!small && <span><strong>your little corner</strong><small>{current ? `${current.label} · ${current.feeling?.label ?? "feeling it out"}${since ? ` · ${since}` : ""}` : "how’s the world feeling?"}</small></span>}
      </button>
      <button className="daily-style-corner__size" aria-label={small ? "Expand your little corner" : "Make your little corner smaller"} onClick={() => setPrefs.mutate({ cornerSmall: !small })}>{small ? "+" : "−"}</button>
    </aside>}
    {isAppShell()
      ? allowed && inWorld && <AppCornerSheet open={editing} query={query} data={data} onClose={close} onPreview={setPreview} />
      : editing && allowed && inWorld && <CornerPanel query={query} data={data} onClose={close} onPreview={setPreview} />}
  </DailyStyleContext.Provider>;
}
export function DailyStyleButton() {
  const { current, open, allowed, inWorld, editing } = useDailyStyle();
  if (!allowed || !inWorld) return null;
  return <button className="daily-style-button" onClick={open} aria-label={TITLE} title={TITLE} aria-haspopup="dialog" aria-expanded={editing}>
    <span className="daily-style-dot" aria-hidden="true">{current?.feeling?.emoji ?? "✿"}</span><span>Today</span>{current && <span className="sr-only">: {current.label}, {current.address.label}, {current.feeling?.label ?? "feeling it out"}</span>}
  </button>;
}
