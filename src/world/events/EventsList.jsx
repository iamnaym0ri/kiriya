// Everything on in Singapore (cons, fairs, pop-ups, merch), grouped by month, with filters.
// A pushed screen inside the app's home tab.
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { groupOf } from "./eventFormat.js";
import { useEventsList, useEventsPersonal, useMarkLooked } from "./eventsData.js";
import { EventRow, KindDoodle, useNow } from "./EventPieces.jsx";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

export const FILTERS = [
  { key: "all", label: "all", test: () => true },
  { key: "con", label: "cons", test: (item) => item.kind === "con" || item.kind === "concert" },
  { key: "fair", label: "fairs", test: (item) => item.kind === "fair" },
  { key: "popup", label: "pop-ups", test: (item) => item.kind === "popup" || item.kind === "cafe" },
  { key: "merch", label: "merch", test: (item) => item.kind === "merch" },
  { key: "saved", label: "saved", test: (item, mine) => mine.isSaved(item.id) },
  { key: "new", label: "new", test: (item, mine) => Boolean(mine.newness(item)) },
];

const EMPTY = {
  all: "nothing on the calendar yet. new cons, pop-ups and merch drops land here as soon as they’re announced.",
  con: "no cons on the list right now.",
  fair: "no fairs or markets on the list right now.",
  popup: "no pop-ups or collab cafés on right now.",
  merch: "no merch drops on the list right now.",
  saved: "tap the heart on anything and it waits for you here.",
  new: "nothing new since you last looked ✓",
};

export default function EventsList() {
  const back = useAppBack("/world");
  const [params, setParams] = useSearchParams();
  const key = FILTERS.some((f) => f.key === params.get("kind")) ? params.get("kind") : params.get("show") === "new" ? "new" : "all";
  const filter = FILTERS.find((f) => f.key === key);
  const list = useEventsList();
  const mine = useEventsPersonal();
  const now = useNow(60_000);
  useMarkLooked(undefined, { enabled: list.isSuccess, delay: 1500 });
  useEffect(() => {
    document.title = "events & merch ♡";
  }, []);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, list.items.filter((item) => f.test(item, mine)).length])), [list.items, mine]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of list.items.filter((item) => filter.test(item, mine))) {
      const group = groupOf(item, now);
      if (!map.has(group.key)) map.set(group.key, { ...group, items: [] });
      map.get(group.key).items.push(item);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [list.items, filter, mine, now]);

  const choose = (next) => setParams(next === "all" ? {} : { kind: next }, { replace: true, preventScrollReset: true });
  const live = groups.filter((g) => g.key !== "9-ended");
  const ended = groups.find((g) => g.key === "9-ended");

  return (
    <div className="app-screen ev-list">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          home
        </button>
        <h1 className="app-section__title">events & merch</h1>
        <div className="app-section__actions">
          <PasteLink compact />
        </div>
        <p className="app-section__subtitle">cons, fairs, pop-ups and merch drops in singapore</p>
      </header>
      <div className="app-section__body">
        <div className="ev-filters app-bleed" role="toolbar" aria-label="Show">
          {FILTERS.filter((f) => f.key === "all" || f.key === key || counts[f.key] > 0 || f.key === "saved").map((f) => (
            <button key={f.key} type="button" className="ev-filter" aria-pressed={f.key === key} onClick={() => choose(f.key)}>
              {f.key === "saved" && (
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20.3s-7.6-4.7-8.6-9.6C2.7 7.4 4.6 4.8 7.4 4.6c2-.2 3.6 1 4.6 2.6 1-1.6 2.6-2.8 4.6-2.6 2.8.2 4.7 2.8 4 6.1-1 4.9-8.6 9.6-8.6 9.6z" fill="currentColor" />
                </svg>
              )}
              {f.key === "new" && <span className="ev-filter__dot" aria-hidden="true" />}
              {f.label}
              {f.key !== "all" && counts[f.key] > 0 && <span className="ev-filter__count">{counts[f.key]}</span>}
            </button>
          ))}
        </div>

        {list.isPending && !list.items.length ? (
          <div className="ev-skeleton" aria-label="Loading">
            <div className="ev-skeleton__rows">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : list.isError && !list.items.length ? (
          <div className="app-card ev-trouble">
            <p>the list couldn’t load just now.</p>
            <button type="button" className="ev-pill-link" onClick={() => list.refetch()}>
              try again
            </button>
          </div>
        ) : !groups.length ? (
          <div className="app-card ev-empty">
            <KindDoodle kind={key === "merch" ? "merch" : key === "popup" ? "popup" : key === "fair" ? "fair" : "con"} size={44} />
            <p>{EMPTY[key]}</p>
          </div>
        ) : (
          <>
            {live.map((group) => (
              <section key={group.key} className="ev-group" aria-label={group.label}>
                <h2 className="app-group-title">{group.label}</h2>
                <ul className="app-list">
                  {group.items.map((item) => (
                    <EventRow key={item.id} item={item} now={now} save />
                  ))}
                </ul>
              </section>
            ))}
            {ended && (
              <details className="ev-ended">
                <summary className="app-group-title">
                  just ended <span className="ev-ended__count">{ended.items.length}</span>
                </summary>
                <ul className="app-list">
                  {ended.items.map((item) => (
                    <EventRow key={item.id} item={item} now={now} save showNew={false} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
