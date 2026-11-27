// The events & merch block on the app's home (docs/refactor/RENOVATION.md; the home agent places
// it). The next big thing with a live countdown (or, while it's on, how long it stays open), what's
// new since she last looked, a few things coming up, merch, and her saves. "see all" opens the full
// list inside the home tab.
import { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "react-router";
import { ago, dateRange, displayName, kindLabel, phaseOf, timeOf, whenLabel } from "./eventFormat.js";
import { MERCH_LIST, eventPath, markLooked, useEventsHome, useFreshSnapshot, useSeenNow } from "./eventsData.js";
import { Countdown, EventRow, ItemChips, KindDoodle, MerchCard, NewMark, Toaster, useNow } from "./EventPieces.jsx";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

const isLive = (item, now) => ["open", "between", "today"].includes(phaseOf(item, now).phase);

/** What the block shows, from the API's home answer. Pure. */
export function homePicks(home, now = new Date()) {
  if (!home) return { hero: null, soon: [] };
  // A big con that's on right now leads; otherwise the next big thing that's hers.
  const bigNow = home.onNow.find((item) => (item.big || item.hers) && !["popup", "cafe"].includes(item.kind) && isLive(item, now));
  const hero = bigNow ?? home.next ?? home.onNow[0] ?? null;
  const seen = new Set([hero?.id]);
  const soon = [...(bigNow && home.next ? [home.next] : []), ...home.onNow, ...home.upcoming].filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { hero, soon: soon.slice(0, 4) };
}

/** Marks the section as looked at once a third of it has been on screen for two seconds. */
function useLookedOnView(ref, enabled) {
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return undefined;
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
  }, [ref, enabled]);
}

function Hero({ item, now }) {
  const p = phaseOf(item, now);
  const open = p.phase === "open";
  const eyebrow = [open ? "on right now" : "the next big thing", kindLabel(item.kind), item.hers ? "ur fandom" : null].filter(Boolean).join(" · ");
  const where = item.venue?.name;
  let label = null;
  let to = null;
  if (open && p.closesAt && !p.run) (label = `day ${p.day} of ${p.of} · doors close in`), (to = p.closesAt);
  else if (p.next) (label = p.phase === "between" ? `day ${p.day} opens in` : p.phase === "today" ? "doors open in" : "starts in"), (to = p.next);
  return (
    <Link className="ev-hero" data-live={open ? "" : undefined} to={eventPath(item.id)} state={{ from: "home" }} aria-label={`${item.name}, ${dateRange(item, { now })}${where ? `, ${where}` : ""}`}>
      <span className="ev-hero__eyebrow">
        {open && <span className="ev-live-dot" aria-hidden="true" />}
        {eyebrow}
      </span>
      <span className="ev-hero__art" aria-hidden="true">
        {item.image?.url ? <img src={item.image.url} alt="" decoding="async" /> : <KindDoodle kind={item.kind} size={50} />}
      </span>
      <strong className="ev-hero__name">{displayName(item.name)}</strong>
      <span className="ev-hero__meta">
        {dateRange(item, { now })}
        {where && <> · {where}</>}
      </span>
      {to ? (
        <>
          <span className="ev-hero__count-label">{label}</span>
          <Countdown to={to} label={label} />
        </>
      ) : open ? (
        <p className="ev-hero__live">{whenLabel(item, now)}{p.closesAt ? ` · open till ${timeOf(p.closesAt)}` : ""}</p>
      ) : null}
      <span className="ev-hero__stub">
        <ItemChips item={item} now={now} live={false} />
        <span className="ev-hero__open">
          see it all
          <span className="ev-chevron" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function NewSince({ fresh, total }) {
  const seenNow = useSeenNow();
  if (!fresh.length)
    return (
      <p className="ev-caught-up">
        <span aria-hidden="true">✓</span> all caught up · nothing new since you last looked
      </p>
    );
  return (
    <section className="app-card app-card--flush ev-newsince" aria-label="New since you last looked">
      <header className="app-card__head">
        <h3 className="app-card__title ev-newsince__title">
          <span className="ev-newsince__spark" aria-hidden="true">
            ✦
          </span>{" "}
          new since you last looked
        </h3>
        {total > fresh.length && (
          <div className="app-card__action">
            <Link to="/world/events?show=new">see all</Link>
          </div>
        )}
      </header>
      <ul className="app-list">
        {fresh.map((entry) => {
          // Opened during this visit: it stays put, just without its spark.
          const seen = seenNow(entry.event.id);
          return (
            <li key={entry.id} className="app-row ev-newsince__row" data-seen={seen ? "" : undefined}>
              <Link to={`${eventPath(entry.event.id)}${entry.kind === "new" ? "" : "#updates"}`} state={{ from: "home" }}>
                <span className="ev-newsince__icon" aria-hidden="true">
                  <KindDoodle kind={entry.event.kind} size={22} />
                </span>
                <span className="app-row__text">
                  <span className="ev-newsince__what">
                    {displayName(entry.event.name)}
                    {entry.big && !seen && <NewMark newness="new" />}
                  </span>
                  <small>
                    {entry.kind === "new" ? "just announced" : entry.title}
                    {entry.at ? ` · ${ago(entry.at)}` : ""}
                  </small>
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
  const home = useEventsHome();
  const now = useNow(60_000);
  const block = useRef(null);
  useLookedOnView(block, home.isSuccess);
  const data = home.data;
  const { hero, soon } = useMemo(() => homePicks(data, now), [data, now]);
  const fresh = useFreshSnapshot(data?.fresh);
  const merch = data?.merch ?? [];
  const saved = data?.counts?.saved ?? 0;

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

      {home.isPending && !data ? (
        <Skeleton />
      ) : home.isError && !data ? (
        <div className="app-card ev-trouble">
          <p>the events list couldn’t load just now.</p>
          <button type="button" className="ev-pill-link" onClick={() => home.refetch()}>
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
          <NewSince fresh={fresh} total={data?.counts?.unseenUpdates ?? 0} />
          {hero && <Hero item={hero} now={now} />}
          {soon.length > 0 && (
            <section className="app-card app-card--flush ev-soon" aria-label="Coming up">
              <header className="app-card__head">
                <h3 className="app-card__title">on now & coming up</h3>
                <div className="app-card__action">
                  <Link to="/world/events">all {data?.counts?.upcoming ?? ""}</Link>
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
            <section className="ev-drops" aria-label="Merch">
              <header className="ev-drops__head">
                <h3 className="ev-drops__title">merch & exclusives</h3>
                <Link className="ev-drops__all" to={MERCH_LIST} state={{ from: "home" }}>
                  all merch
                </Link>
              </header>
              <ul className="ev-drops__strip app-bleed">
                {merch.map((item) => (
                  <MerchCard key={item.id} item={item} />
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
            {saved > 0 && <span className="app-row__detail">{saved}</span>}
          </Link>
        </li>
      </ul>
      <Toaster />
    </section>
  );
}
