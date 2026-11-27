// The events & merch block on the app's home (docs/refactor/RENOVATION.md; the home agent places
// it). The next big thing with a live countdown, what's new since she last looked, a few things
// coming up, merch drops, and her saves; "see all" opens the full list inside the home tab.
import { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "react-router";
import {
  dateRange,
  kindLabel,
  phaseOf,
  price,
  timeOf,
  whenLabel,
} from "./eventFormat.js";
import { eventPath, latestChange, markLooked, useEventsList, useEventsPersonal } from "./eventsData.js";
import { Countdown, EventRow, ItemChips, KindDoodle, NewMark, useNow } from "./EventPieces.jsx";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

const live = (item, now) => !["ended", "sold_out", "cancelled"].includes(phaseOf(item, now).phase);

/** Picks what the block shows. Pure, so it's easy to reason about. */
export function homePicks(items, now = new Date()) {
  const current = items.filter((item) => live(item, now));
  const events = current.filter((item) => item.kind !== "merch" && phaseOf(item, now).phase !== "tbc");
  // The next big thing: the soonest big con or something from her fandoms, else the soonest event.
  const hero = events.find((item) => item.big && item.kind !== "cafe") ?? events.find((item) => item.hers) ?? events[0] ?? null;
  const soon = events.filter((item) => item !== hero).slice(0, 3);
  const merch = current
    .filter((item) => item.kind === "merch")
    .sort((a, b) => {
      // Open now (closing soonest first), then the ones still to drop.
      const pa = phaseOf(a, now);
      const pb = phaseOf(b, now);
      if (pa.phase !== pb.phase) return pa.phase === "open" ? -1 : 1;
      return (pa.closesAt ?? pa.next ?? Infinity) - (pb.closesAt ?? pb.next ?? Infinity);
    })
    .slice(0, 6);
  return { hero, soon, merch };
}

/** Marks the section as looked at once at least a third of it has been on screen for two seconds. */
function useLookedOnView(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    let timer = null;
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry.intersectionRatio >= 0.33 && !done)
          timer = setTimeout(() => {
            done = true;
            markLooked();
          }, 2000);
      },
      { threshold: [0, 0.33] },
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref]);
}

function Hero({ item, now }) {
  const p = phaseOf(item, now);
  const eyebrow = ["the next big thing", kindLabel(item.kind), item.hers ? "ur fandom" : null].filter(Boolean).join(" · ");
  const where = [item.venue?.name].filter(Boolean).join("");
  let clock;
  if (p.phase === "open")
    clock = (
      <p className="ev-hero__live">
        <span className="ev-live-dot" aria-hidden="true" />
        {p.run ? whenLabel(item, now) : `on right now${p.of > 1 ? ` · day ${p.day} of ${p.of}` : ""}`}
        {p.closesAt && ` · open till ${timeOf(p.closesAt)}`}
      </p>
    );
  else if (p.next) clock = <Countdown to={p.next} label={p.phase === "between" ? `day ${p.day} opens in` : "starts in"} />;
  return (
    <Link className="ev-hero" to={eventPath(item.id)} aria-label={`${item.name}, ${dateRange(item, { now })}${where ? `, ${where}` : ""}`}>
      <span className="ev-hero__eyebrow">{eyebrow}</span>
      <span className="ev-hero__doodle" aria-hidden="true">
        <KindDoodle kind={item.kind} size={52} />
      </span>
      <strong className="ev-hero__name">{item.name}</strong>
      <span className="ev-hero__meta">
        {dateRange(item, { now })}
        {where && <> · {where}</>}
      </span>
      {p.next && p.phase !== "open" && (
        <span className="ev-hero__count-label">{p.phase === "between" ? `day ${p.day} opens in` : p.phase === "today" ? "doors open in" : "starts in"}</span>
      )}
      {clock}
      <span className="ev-hero__stub">
        <ItemChips item={item} now={now} />
        <span className="ev-hero__open">
          everything about it
          <span className="ev-chevron" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function NewSince({ items, mine }) {
  const fresh = items
    .map((item) => ({ item, newness: mine.newness(item) }))
    .filter((x) => x.newness)
    .sort((a, b) => latestChange(b.item) - latestChange(a.item));
  if (!fresh.length)
    return (
      <p className="ev-caught-up">
        <span aria-hidden="true">✓</span> all caught up · nothing new since you last looked
      </p>
    );
  const shown = fresh.slice(0, 3);
  return (
    <section className="app-card app-card--flush ev-newsince" aria-label="New since you last looked">
      <header className="app-card__head">
        <h3 className="app-card__title ev-newsince__title">
          <span className="ev-newsince__spark" aria-hidden="true">
            ✦
          </span>{" "}
          new since you last looked
        </h3>
        {fresh.length > 3 && (
          <div className="app-card__action">
            <Link to="/world/events?show=new">all {fresh.length}</Link>
          </div>
        )}
      </header>
      <ul className="app-list">
        {shown.map(({ item, newness }) => {
          const update = newness === "updated" ? mine.unseenUpdates(item)[0] : null;
          return (
            <li key={item.id} className="app-row ev-newsince__row">
              <Link to={`${eventPath(item.id)}${update ? "#updates" : ""}`}>
                <span className="ev-newsince__icon" aria-hidden="true">
                  <KindDoodle kind={item.kind} size={22} />
                </span>
                <span className="app-row__text">
                  <span className="ev-newsince__what">
                    {update ? update.title : newness === "new" ? `just announced` : "updated"}
                    <NewMark newness={newness} />
                  </span>
                  <small>{item.name}</small>
                </span>
                <span className="ev-chevron" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MerchCard({ item, now, mine }) {
  const drop = item.drop ?? {};
  const where = drop.where?.[0]?.name;
  const cost = price(drop.price);
  return (
    <li className="ev-merch">
      <Link className="ev-merch__link" to={eventPath(item.id)}>
        <span className="ev-merch__art" aria-hidden="true">
          {item.image?.url ? <img src={item.image.url} alt="" loading="lazy" decoding="async" /> : <KindDoodle kind="merch" size={40} />}
        </span>
        <span className="ev-merch__name">
          {item.name}
          <NewMark newness={mine.newness(item)} />
        </span>
        <span className="ev-merch__meta">{[cost && `${drop.price?.from ? "from " : ""}${cost}`, where].filter(Boolean).join(" · ")}</span>
        <span className="ev-merch__when">{whenLabel(item, now)}</span>
        <ItemChips item={item} now={now} />
      </Link>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="ev-skeleton" aria-hidden="true">
      <div className="ev-skeleton__hero" />
      <div className="ev-skeleton__rows">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default function HomeEvents() {
  const titleId = useId();
  const list = useEventsList();
  const mine = useEventsPersonal();
  const now = useNow(60_000);
  const block = useRef(null);
  useLookedOnView(block);
  const { hero, soon, merch } = useMemo(() => homePicks(list.items, now), [list.items, now]);
  const savedCount = mine.savedCount;

  return (
    <section ref={block} className="ev-home" id="events" aria-labelledby={titleId}>
      <header className="ev-home__head">
        <div className="ev-home__titles">
          <h2 className="ev-home__title" id={titleId}>
            events & merch
          </h2>
          <p className="ev-home__sub">what’s on in singapore, all in one place</p>
        </div>
        <div className="ev-home__actions">
          <PasteLink compact />
          <Link className="ev-pill-link" to="/world/events">
            see all
          </Link>
        </div>
      </header>

      {list.isPending && !list.items.length ? (
        <Skeleton />
      ) : list.isError && !list.items.length ? (
        <div className="app-card ev-trouble">
          <p>the events list couldn’t load just now.</p>
          <button type="button" className="ev-pill-link" onClick={() => list.refetch()}>
            try again
          </button>
        </div>
      ) : !hero && !merch.length ? (
        <div className="app-card ev-empty">
          <KindDoodle kind="con" size={44} />
          <strong>nothing on the calendar yet</strong>
          <p>new cons, pop-ups and merch drops in singapore land here as soon as they’re announced.</p>
        </div>
      ) : (
        <>
          <NewSince items={list.items} mine={mine} />
          {hero && <Hero item={hero} now={now} />}
          {soon.length > 0 && (
            <section className="app-card app-card--flush ev-soon" aria-label="Coming up">
              <header className="app-card__head">
                <h3 className="app-card__title">coming up</h3>
                <div className="app-card__action">
                  <Link to="/world/events">all events</Link>
                </div>
              </header>
              <ul className="app-list">
                {soon.map((item) => (
                  <EventRow key={item.id} item={item} now={now} />
                ))}
              </ul>
            </section>
          )}
          {merch.length > 0 && (
            <section className="ev-drops" aria-label="Merch drops">
              <header className="ev-drops__head">
                <h3 className="ev-drops__title">merch drops</h3>
                <Link className="ev-drops__all" to="/world/events?kind=merch">
                  all merch
                </Link>
              </header>
              <ul className="ev-drops__strip app-bleed">
                {merch.map((item) => (
                  <MerchCard key={item.id} item={item} now={now} mine={mine} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ul className="app-list ev-saved-link">
        <li className="app-row app-row--more">
          <Link to="/world/saves">
            <span className="app-row__icon ev-saved-link__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 20.3s-7.6-4.7-8.6-9.6C2.7 7.4 4.6 4.8 7.4 4.6c2-.2 3.6 1 4.6 2.6 1-1.6 2.6-2.8 4.6-2.6 2.8.2 4.7 2.8 4 6.1-1 4.9-8.6 9.6-8.6 9.6z" fill="currentColor" />
              </svg>
            </span>
            <span className="app-row__text">
              <span>events and merch i saved</span>
            </span>
            <span className="app-row__detail">{savedCount || ""}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
