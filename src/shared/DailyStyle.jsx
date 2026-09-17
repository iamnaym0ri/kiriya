import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { usePrefs, useSetPrefs } from "../lib/prefs.js";
import { Icon } from "./WorldPrimitives.jsx";
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

function CornerPanel({ query, data, onClose }) {
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
      : <Suspense fallback={<p role="status">Opening your little check-in…</p>}><Checkin data={data} onDone={onClose} /></Suspense>}
  </section>;
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
  const small = prefs.data?.cornerSmall ?? false;
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);
  useEffect(() => {
    const root = document.documentElement;
    if (current) {
      root.dataset.mood = current.key;
      root.dataset.energy = String(current.energy);
      if (current.feeling) root.dataset.feeling = current.feeling.key;
      else delete root.dataset.feeling;
    } else { delete root.dataset.mood; delete root.dataset.energy; delete root.dataset.feeling; }
    return () => { delete root.dataset.mood; delete root.dataset.energy; delete root.dataset.feeling; };
  }, [current]);
  useEffect(() => { if (!allowed || !inWorld) setEditing(false); }, [allowed, inWorld]);
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
    {allowed && inWorld && <aside className="daily-style-corner" data-small={small} aria-label="Your little feeling corner">
      <button className="daily-style-corner__toggle" onClick={open} aria-label={TITLE} aria-haspopup="dialog" aria-expanded={editing} aria-controls={editing ? "feeling-corner-panel" : undefined}>
        <span className="daily-style-corner__face" aria-hidden="true">{current?.feeling?.emoji ?? "♡"}</span>
        {!small && <span><strong>your little corner</strong><small>{current ? `${current.label} · ${current.feeling?.label ?? "feeling it out"}${since ? ` · ${since}` : ""}` : "how’s the world feeling?"}</small></span>}
      </button>
      <button className="daily-style-corner__size" aria-label={small ? "Expand your little corner" : "Make your little corner smaller"} onClick={() => setPrefs.mutate({ cornerSmall: !small })}>{small ? "+" : "−"}</button>
    </aside>}
    {editing && allowed && inWorld && <CornerPanel query={query} data={data} onClose={close} />}
  </DailyStyleContext.Provider>;
}
export function DailyStyleButton() {
  const { current, open, allowed, inWorld, editing } = useDailyStyle();
  if (!allowed || !inWorld) return null;
  return <button className="daily-style-button" onClick={open} aria-label={TITLE} title={TITLE} aria-haspopup="dialog" aria-expanded={editing}>
    <span className="daily-style-dot" aria-hidden="true">{current?.feeling?.emoji ?? "✿"}</span><span>Today</span>{current && <span className="sr-only">: {current.label}, {current.address.label}, {current.feeling?.label ?? "feeling it out"}</span>}
  </button>;
}
