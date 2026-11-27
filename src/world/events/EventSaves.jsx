// "events and merch i saved" (/world/saves inside the app): everything she hearted, soonest first,
// and below it anything she kept from the old merch shelf so nothing she kept goes missing.
// The website keeps its own keepsake box (SavesPage).
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { phaseOf } from "./eventFormat.js";
import { useSavedItems } from "./eventsData.js";
import { EventRow, KindDoodle, useNow } from "./EventPieces.jsx";
import "./events.css";

function ShelfKeeps() {
  const keeps = useQuery({ queryKey: ["me", "saves"], queryFn: () => api("/me/saves"), retry: false, staleTime: 5 * 60_000 });
  const list = (keeps.data?.saves ?? []).filter((save) => !save.removed);
  if (!list.length) return null;
  return (
    <section className="ev-group" aria-label="Kept from the merch shelf">
      <h2 className="app-group-title">kept from the merch shelf</h2>
      <ul className="app-list">
        {list.map((save) => (
          <li key={save.id} className="app-row app-row--more">
            <a href={save.url} target="_blank" rel="noopener noreferrer">
              <span className="app-row__icon" aria-hidden="true">
                <KindDoodle kind="merch" size={22} />
              </span>
              <span className="app-row__text">
                <span>{save.blurb?.headline || save.title}</span>
                <small>{[save.credit?.name ?? save.credit?.handle, save.credit?.platform].filter(Boolean).join(" · ")}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EventSaves() {
  const back = useAppBack("/world");
  const { items, isPending } = useSavedItems();
  const now = useNow(60_000);
  useEffect(() => {
    document.title = "saved ♡";
  }, []);
  const coming = items.filter((item) => !["ended", "sold_out", "cancelled"].includes(phaseOf(item, now).phase) && !item.gone);
  const earlier = items.filter((item) => !coming.includes(item));
  return (
    <div className="app-screen ev-saves">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          home
        </button>
        <h1 className="app-section__title" data-short="saved">
          events & merch i saved
        </h1>
        <p className="app-section__subtitle">only you can see these ♡</p>
      </header>
      <div className="app-section__body">
        {!items.length && !isPending && (
          <div className="app-card ev-empty">
            <svg className="ev-empty__heart" width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.3s-7.6-4.7-8.6-9.6C2.7 7.4 4.6 4.8 7.4 4.6c2-.2 3.6 1 4.6 2.6 1-1.6 2.6-2.8 4.6-2.6 2.8.2 4.7 2.8 4 6.1-1 4.9-8.6 9.6-8.6 9.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <strong>nothing saved yet</strong>
            <p>tap the heart on an event or a merch drop and it waits for you here.</p>
          </div>
        )}
        {coming.length > 0 && (
          <section className="ev-group" aria-label="Coming up">
            <h2 className="app-group-title">coming up</h2>
            <ul className="app-list">
              {coming.map((item) => (
                <EventRow key={item.id} item={item} now={now} save />
              ))}
            </ul>
          </section>
        )}
        {earlier.length > 0 && (
          <section className="ev-group" aria-label="Earlier">
            <h2 className="app-group-title">earlier</h2>
            <ul className="app-list">
              {earlier.map((item) => (
                <EventRow key={item.id} item={item} now={now} save showNew={false} />
              ))}
            </ul>
          </section>
        )}
        <ShelfKeeps />
      </div>
    </div>
  );
}
