// Merch & exclusives on their own (/world/events/merch), apart from the events list: each piece as a
// picture card (picture, name, price, where), grouped under the event it belongs to. A tap opens the
// piece's own page. A pushed screen inside the app's home tab.
import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { displayName, handSafe } from "../events/eventFormat.js";
import { eventPath, useIsSaved, useMerchList } from "../events/eventsData.js";
import { KindDoodle, MerchCard, Toaster } from "../events/EventPieces.jsx";
import "../events/events.css";
import "./merch.css";

const FILTERS = [
  { key: "all", label: "all", test: () => true },
  { key: "exclusive", label: "exclusives", test: (m) => m.kind === "exclusive" || m.limited },
  { key: "preorder", label: "pre-order", test: (m) => m.status === "preorder" },
  { key: "available", label: "can buy now", test: (m) => m.status === "on_sale" || m.status === "preorder" },
  { key: "saved", label: "saved", test: (m, { isSaved }) => isSaved(m) },
];

export default function MerchList() {
  const fromHome = useLocation().state?.from === "home";
  const back = useAppBack(fromHome ? "/world" : "/world/events");
  const [params, setParams] = useSearchParams();
  const key = FILTERS.some((f) => f.key === params.get("show")) ? params.get("show") : "all";
  const filter = FILTERS.find((f) => f.key === key);
  const list = useMerchList();
  const isSaved = useIsSaved();
  useEffect(() => {
    document.title = "merch & exclusives ♡";
  }, []);
  const helpers = useMemo(() => ({ isSaved }), [isSaved]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, list.items.filter((m) => f.test(m, helpers)).length])), [list.items, helpers]);
  // One group per event, in the list's order (soonest first); sold-out pieces last in each.
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of list.items.filter((x) => filter.test(x, helpers))) {
      const id = m.event?.id ?? "other";
      if (!map.has(id)) map.set(id, { event: m.event, items: [] });
      map.get(id).items.push(m);
    }
    for (const g of map.values()) g.items.sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out") || Number(!a.image) - Number(!b.image));
    return [...map.values()];
  }, [list.items, filter, helpers]);
  const choose = (next) => setParams(next === "all" ? {} : { show: next }, { replace: true, preventScrollReset: true });

  return (
    <div className="app-screen mx-list">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          {fromHome ? "home" : "events"}
        </button>
        <h1 className="app-section__title">merch & exclusives</h1>
        <p className="app-section__subtitle">the good stuff at singapore events</p>
      </header>
      <div className="app-section__body">
        <div className="ev-filters app-bleed" role="toolbar" aria-label="Show">
          {FILTERS.filter((f) => f.key === "all" || f.key === key || counts[f.key] > 0 || f.key === "saved").map((f) => (
            <button key={f.key} type="button" className="ev-filter" aria-pressed={f.key === key} onClick={() => choose(f.key)}>
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
            </div>
          </div>
        ) : list.isError && !list.items.length ? (
          <div className="app-card ev-trouble">
            <p>the merch couldn’t load just now.</p>
            <button type="button" className="ev-pill-link" onClick={() => list.refetch()}>
              try again
            </button>
          </div>
        ) : !groups.length ? (
          <div className="app-card ev-empty">
            <KindDoodle kind="merch" size={44} />
            <p>{key === "saved" ? "tap the heart on a piece and it waits for you here." : "no merch on the list right now. exclusives land here as soon as they’re revealed."}</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.event?.id ?? "other"} className="mx-group" aria-label={displayName(g.event?.name ?? "merch")}>
              {g.event?.id ? (
                <Link className="mx-group__head" to={eventPath(g.event.id)} state={{ from: "merch" }}>
                  <span className="mx-group__text">
                    <strong>{handSafe(displayName(g.event.name))}</strong>
                    <small>{[g.event.dateLabel, g.event.venueName].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="mx-group__go">
                    event <span className="ev-chevron" aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <h2 className="app-group-title">other merch</h2>
              )}
              <ul className="ev-mgrid">
                {g.items.map((m) => (
                  <MerchCard key={m.id} item={m} where={false} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <Toaster />
    </div>
  );
}
