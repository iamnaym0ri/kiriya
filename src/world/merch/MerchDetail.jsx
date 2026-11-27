// One merch piece on its own page (/world/events/merch/<event~piece>), so a tap on a piece never
// drops her into the middle of an event page (Josh, 2026-11-27). First the piece: pictures, name,
// price, what kind of piece it is, whether she can get it and when. Then, clearly, where it is: the
// event it's under, the booth or shop, the venue with a map, and a tap through to the event.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { MERCH_KIND, MERCH_STATUS, displayName, mapsLinks, merchChips, siteOf, titleLength } from "../events/eventFormat.js";
import { MERCH_LIST, eventPath, useMerchItem } from "../events/eventsData.js";
import { Chips, KindDoodle, MerchCard, SaveButton, Toaster } from "../events/EventPieces.jsx";
import Glyph from "../events/Glyph.jsx";
import "../events/events.css";
import "./merch.css";

const BACK = {
  merch: { label: "merch", to: MERCH_LIST },
  event: { label: "event", to: null },
  piece: { label: "merch", to: MERCH_LIST },
  events: { label: "events", to: "/world/events" },
  saved: { label: "saved", to: "/world/saves" },
  home: { label: "home", to: "/world" },
};

function Gallery({ item }) {
  const strip = useRef(null);
  const [index, setIndex] = useState(0);
  const images = item.images ?? [];
  useEffect(() => {
    const node = strip.current;
    if (!node || images.length < 2) return undefined;
    const onScroll = () => setIndex(Math.round(node.scrollLeft / Math.max(1, node.clientWidth)));
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [images.length]);
  if (!images.length)
    return (
      <div className="mx-gallery mx-gallery--empty" aria-label="No picture yet">
        <KindDoodle kind="merch" size={64} />
        <span>no picture yet</span>
      </div>
    );
  return (
    <figure className="mx-gallery">
      <div className="mx-gallery__strip" ref={strip} tabIndex={images.length > 1 ? 0 : undefined} aria-label={images.length > 1 ? `${images.length} pictures, swipe to see more` : undefined}>
        {images.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? item.name : ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
        ))}
      </div>
      {images.length > 1 && (
        <span className="mx-gallery__dots" aria-hidden="true">
          {images.map((src, i) => (
            <span key={src} data-on={i === index ? "" : undefined} />
          ))}
        </span>
      )}
      {item.imageCredit && <figcaption>{item.imageCredit}</figcaption>}
    </figure>
  );
}

function Fact({ icon, label, children, tone }) {
  return (
    <li className="mx-fact">
      <span className="mx-fact__icon" data-tone={tone} aria-hidden="true">
        <Glyph name={icon} size={18} />
      </span>
      <span className="mx-fact__text">
        <small>{label}</small>
        <span>{children}</span>
      </span>
    </li>
  );
}

function WhereItIs({ item }) {
  const event = item.event ?? {};
  const venue = event.venue ?? (event.venueName ? { name: event.venueName, area: event.venueArea } : null);
  const maps = mapsLinks(venue);
  return (
    <section className="app-card app-card--flush mx-where" aria-label="Where it is">
      <header className="app-card__head mx-where__head">
        <h2 className="app-card__title">where it is</h2>
      </header>
      <ul className="app-list">
        {event.id && (
          <li className="app-row app-row--more mx-where__event">
            <Link to={eventPath(event.id)} state={{ from: "piece" }}>
              <span className="mx-where__art" aria-hidden="true">
                {event.image?.url ? <img src={event.image.url} alt="" loading="lazy" decoding="async" /> : <KindDoodle kind={event.kind ?? "con"} size={26} />}
              </span>
              <span className="app-row__text">
                <small className="mx-where__label">at the event</small>
                <span className="mx-where__name">{displayName(event.name)}</span>
                <small>{[event.dateLabel, event.timeLabel].filter(Boolean).join(" · ")}</small>
              </span>
            </Link>
          </li>
        )}
        {item.where && (
          <li className="app-row mx-where__row">
            <span className="app-row__icon" aria-hidden="true">
              <Glyph name="bag" size={18} />
            </span>
            <span className="app-row__text">
              <small className="mx-where__label">booth or shop</small>
              <span className="mx-where__name">{item.where}</span>
            </span>
          </li>
        )}
        {venue?.name && (
          <li className={`app-row mx-where__row ${maps ? "app-row--more" : ""}`}>
            {maps ? (
              <a href={maps.place} target="_blank" rel="noopener noreferrer">
                <span className="app-row__icon" aria-hidden="true">
                  <Glyph name="directions" size={18} />
                </span>
                <span className="app-row__text">
                  <small className="mx-where__label">venue · open in maps</small>
                  <span className="mx-where__name">{[venue.name, venue.hall].filter(Boolean).join(", ")}</span>
                  {venue.area && <small>{venue.area}</small>}
                </span>
              </a>
            ) : (
              <span className="app-row__text">
                <span className="mx-where__name">{venue.name}</span>
              </span>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}

export default function MerchDetail() {
  const { merchId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { item, full, isPending, isError, missing, gone, movedTo, refetch } = useMerchItem(merchId);
  const fromKey = location.state?.from;
  const from = BACK[fromKey] ?? BACK.merch;
  const fallback = from.to ?? (item?.event?.id ? eventPath(item.event.id) : MERCH_LIST);
  const back = useAppBack(fallback);
  useEffect(() => {
    if (item?.name) document.title = `${item.name} ♡`;
  }, [item?.name]);
  useEffect(() => {
    if (movedTo) navigate(`/world/events/merch/${encodeURIComponent(movedTo)}`, { replace: true, state: location.state });
  }, [movedTo, navigate, location.state]);

  const title = item?.name ?? (isPending ? "" : "not found");
  return (
    <div className="app-screen mx-page">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          {fromKey === "event" && item?.event?.name ? "event" : from.label}
        </button>
        <h1 className="app-section__title mx-page__title" data-length={titleLength(title) || undefined} data-short={item?.name ? "merch" : "merch"}>
          {title}
        </h1>
      </header>
      <div className="app-section__body">
        {!item ? (
          isPending ? (
            <div className="ev-skeleton" aria-label="Loading">
              <div className="ev-skeleton__hero" />
            </div>
          ) : (
            <div className="app-card ev-empty">
              <KindDoodle kind="merch" size={44} />
              <strong>{isError ? "this couldn’t load" : "this piece isn’t listed anymore"}</strong>
              {isError ? (
                <button type="button" className="ev-pill-link" onClick={() => refetch()}>
                  try again
                </button>
              ) : (
                <Link className="ev-pill-link" to={MERCH_LIST}>
                  see all merch
                </Link>
              )}
              {missing && null}
            </div>
          )
        ) : (
          <>
            {gone && (
              <p className="ev-gone" role="status">
                <Glyph name="info" size={18} /> this piece has come off the list since you opened it.
              </p>
            )}
            <Gallery item={item} />
            <section className="app-card mx-facts" aria-label="About this piece">
              <div className="mx-facts__top">
                <div className="mx-facts__price">
                  <strong>{item.priceLabel ?? (item.price === 0 ? "free" : "price tbc")}</strong>
                  <Chips chips={merchChips(item)} />
                </div>
                <SaveButton item={item} merch />
              </div>
              <ul className="mx-facts__list">
                <Fact icon="tag" label="what it is">
                  {MERCH_KIND[item.kind] ?? "merch"}
                  {item.limited && item.kind !== "limited" ? " · limited quantities" : ""}
                </Fact>
                <Fact icon="box" label="can i get it" tone={item.status === "sold_out" ? "mute" : "mint"}>
                  {MERCH_STATUS[item.status] ?? "revealed"}
                </Fact>
                <Fact icon="calendar" label="when">
                  {item.when ?? (item.event?.dateLabel ? `at the event · ${item.event.dateLabel}` : "tbc")}
                </Fact>
                {item.note && (
                  <Fact icon="note" label="good to know">
                    {item.note}
                  </Fact>
                )}
              </ul>
              {full && item.sources?.length > 0 && (
                <p className="ev-sourced">
                  <span className="ev-sourced__label">source{item.sources.length > 1 ? "s" : ""}</span>
                  {item.sources.map((s) => (
                    <a key={s.id} className="ev-source" href={s.url} target="_blank" rel="noopener noreferrer">
                      <span>{s.label || siteOf(s.url)}</span>
                    </a>
                  ))}
                </p>
              )}
            </section>
            <WhereItIs item={item} />
            {item.more?.length > 0 && (
              <section className="mx-more" aria-label="More from this event">
                <h2 className="app-group-title">more from {displayName(item.event?.name ?? "this event")}</h2>
                <ul className="mx-more__strip app-bleed">
                  {item.more.map((m) => (
                    <MerchCard key={m.id} item={m} where={false} save={false} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <Toaster />
    </div>
  );
}
