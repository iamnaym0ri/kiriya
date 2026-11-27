// One complete page per event or merch drop (docs/refactor/PLAN.md phase 6): what it is and what
// it's like, when, where and how to get there, tickets, guests, merch, size, weather, tips, its
// timeline and what changed since she last looked. Every claim links to the page or post it came
// from. A pushed screen inside the app's home tab.
import { useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { ago, dateRange, dayLabel, dayNumber, hours, kindLabel, mapsLinks, merchChips, monthShort, phaseOf, siteOf, tierChip, timeOf, whenLabel } from "./eventFormat.js";
import { useEvent, useMarkLooked } from "./eventsData.js";
import { Chips, Countdown, ItemChips, KindDoodle, NewMark, SaveButton, SourceLink, Sourced, Toaster, useNow } from "./EventPieces.jsx";
import Glyph from "./Glyph.jsx";
import { addToCalendar, canAddToCalendar } from "./calendar.js";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

const BACK = { events: { label: "events", to: "/world/events" }, saved: { label: "saved", to: "/world/saves" }, home: { label: "home", to: "/world" } };
const ids = (claim) => claim?.sourceIds ?? (claim?.sourceId ? [claim.sourceId] : []);

function Card({ title, id, children, className = "" }) {
  return (
    <section className={`app-card ev-card ${className}`} id={id} aria-label={title}>
      <header className="app-card__head">
        <h2 className="app-card__title">{title}</h2>
      </header>
      <div className="app-card__body">{children}</div>
    </section>
  );
}

/** Rows each say where they came from when a card mixes sources; otherwise one line at its foot. */
function sourcing(rows) {
  const all = [...new Set(rows.flatMap(ids))];
  const perRow = new Set(rows.map((r) => r.sourceId).filter(Boolean)).size > 1;
  return { perRow, all };
}

// ---------- the top ----------
function Ticket({ item, now }) {
  const p = phaseOf(item, now);
  const first = item.days?.[0];
  let times = null;
  if (first && item.days.every((d) => d.opens === first.opens && d.closes === first.closes)) times = `${item.days.length > 1 ? "each day, " : ""}${hours(first)}`;
  else if (first) times = "hours change by day, see below";
  else if (item.datesNote?.text) times = item.datesNote.text;
  let label = null;
  let to = null;
  if (p.phase === "open" && p.closesAt && !p.run) (label = "doors close in"), (to = p.closesAt);
  else if (p.next) (label = p.phase === "between" ? `day ${p.day} opens in` : p.phase === "today" ? "doors open in" : "starts in"), (to = p.next);
  return (
    <div className="ev-ticket" data-image={item.image?.url ? "" : undefined}>
      {item.image?.url && (
        <figure className="ev-ticket__image">
          <img src={item.image.url} alt={item.image.alt ?? ""} decoding="async" />
          {item.image.credit && <figcaption>{item.image.credit}</figcaption>}
        </figure>
      )}
      <div className="ev-ticket__top">
        {!item.image?.url && (
          <span className="ev-ticket__doodle" aria-hidden="true">
            <KindDoodle kind={item.kind} size={46} />
          </span>
        )}
        <div className="ev-ticket__when">
          <span className="ev-ticket__eyebrow">{[kindLabel(item.kind), item.hers ? "ur fandom" : null, item.venue?.area].filter(Boolean).join(" · ")}</span>
          <strong className="ev-ticket__dates">{dateRange(item, { now })}</strong>
          {times && <span className="ev-ticket__times">{times}</span>}
          {item.venue?.name && <span className="ev-ticket__venue">{[item.venue.name, item.venue.hall].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      {p.phase === "open" && (
        <p className="ev-ticket__live">
          <span className="ev-live-dot" aria-hidden="true" />
          {whenLabel(item, now)}
          {p.closesAt && !to ? ` · open till ${timeOf(p.closesAt)}` : ""}
        </p>
      )}
      {to && (
        <div className="ev-ticket__count">
          <span className="ev-ticket__count-label">{label}</span>
          <Countdown to={to} label={label} compact />
        </div>
      )}
      {p.phase === "ended" && <p className="ev-ticket__over">that was {ago(p.endedAt, now)} ♡</p>}
      <div className="ev-ticket__stub">
        <ItemChips item={item} now={now} live={false} max={3} />
      </div>
    </div>
  );
}

function Actions({ item }) {
  const maps = mapsLinks(item.venue);
  const buy = item.tickets?.url ?? item.links?.find((l) => l.kind === "tickets")?.url ?? null;
  const calendar = canAddToCalendar(item);
  return (
    <div className="ev-actions" role="group" aria-label="Actions">
      <button type="button" className="ev-action" disabled={!calendar} onClick={() => addToCalendar(item)}>
        <span className="ev-action__icon">
          <Glyph name="calendar" />
        </span>
        <span className="ev-action__label">{calendar ? "calendar" : "dates tbc"}</span>
      </button>
      {maps && (
        <a className="ev-action" href={maps.directions} target="_blank" rel="noopener noreferrer">
          <span className="ev-action__icon">
            <Glyph name="directions" />
          </span>
          <span className="ev-action__label">directions</span>
        </a>
      )}
      {buy && (
        <a className="ev-action" href={buy} target="_blank" rel="noopener noreferrer">
          <span className="ev-action__icon">
            <Glyph name="ticket" />
          </span>
          <span className="ev-action__label">tickets</span>
        </a>
      )}
      <SaveButton item={item} labelled />
    </div>
  );
}

function SinceYouLooked({ item, updates }) {
  if (!updates.length) return null;
  return (
    <section className="app-card ev-card ev-since" aria-label="What changed since you last looked">
      <header className="app-card__head">
        <h2 className="app-card__title">
          <span aria-hidden="true">✦</span> since you last looked
        </h2>
      </header>
      <ul className="ev-since__list">
        {updates.slice(0, 4).map((u) => (
          <li key={u.id}>
            <strong>{u.title}</strong>
            {u.text && <p>{u.text}</p>}
            <small>
              {ago(u.at)}
              {u.sourceId && (
                <>
                  {" · "}
                  <SourceLink item={item} id={u.sourceId} />
                </>
              )}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- the dossier ----------
function Prose({ title, claim, item, children }) {
  if (!claim?.text && !children) return null;
  return (
    <Card title={title}>
      {claim?.text && <p className="ev-prose">{claim.text}</p>}
      {children}
      <Sourced item={item} ids={ids(claim)} />
    </Card>
  );
}

function About({ item }) {
  const highlights = item.highlights ?? [];
  if (!item.about?.text && !highlights.length) return null;
  const { perRow, all } = sourcing(highlights);
  return (
    <Card title="what it is">
      {item.about?.text && <p className="ev-prose">{item.about.text}</p>}
      {highlights.length > 0 && (
        <ul className="ev-tips ev-highlights">
          {highlights.map((h) => (
            <li key={h.text}>
              <span>{h.text}</span>
              {perRow && h.sourceId && <SourceLink item={item} id={h.sourceId} />}
            </li>
          ))}
        </ul>
      )}
      <Sourced item={item} ids={[...ids(item.about), ...(perRow ? [] : all)]} />
    </Card>
  );
}

function Popup({ item }) {
  const p = item.popup;
  if (!p) return null;
  const { perRow, all } = sourcing(p.sold ?? []);
  return (
    <>
      <Prose title="what it's about" claim={p.about} item={item} />
      {p.sold?.length > 0 && (
        <Card title="what's sold">
          <ul className="ev-tips">
            {p.sold.map((c) => (
              <li key={c.text}>
                <span>{c.text}</span>
                {perRow && c.sourceId && <SourceLink item={item} id={c.sourceId} />}
              </li>
            ))}
          </ul>
          {!perRow && <Sourced item={item} ids={all} />}
        </Card>
      )}
    </>
  );
}

function Dates({ item, now }) {
  if (item.datesTbc)
    return (
      <Card title="dates & times">
        <p className="ev-prose">not announced yet. you’ll see it here the moment it is.</p>
      </Card>
    );
  if (!item.days?.length)
    return item.datesNote?.text ? (
      <Card title="dates & times">
        <ul className="app-list">
          <li className="app-row">
            <span className="app-row__text">
              <span>{dateRange(item, { now, withYear: true })}</span>
              <small>{item.datesNote.text}</small>
            </span>
          </li>
        </ul>
        <Sourced item={item} ids={ids(item.datesNote)} />
      </Card>
    ) : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
  return (
    <Card title="dates & times">
      <ul className="app-list ev-days">
        {item.days.map((d, i) => (
          <li key={d.date} className="app-row ev-day" data-today={d.date === today ? "" : undefined} data-past={d.date < today ? "" : undefined}>
            <span className="ev-day__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="app-row__text">
              <span>
                {dayLabel(d.date)}
                {d.date === today && <span className="ev-today"> · today</span>}
              </span>
              {d.note && <small>{d.note}</small>}
            </span>
            <span className="app-row__detail ev-day__hours">{hours(d)}</span>
          </li>
        ))}
      </ul>
      <Sourced item={item} ids={item.days.map((d) => d.sourceId)} />
    </Card>
  );
}

function GettingThere({ item }) {
  const v = item.venue;
  if (!v?.address && !v?.directions?.length) return null;
  const maps = mapsLinks(v);
  return (
    <Card title="getting there">
      <div className="ev-venue">
        <strong>{v.name}</strong>
        {v.hall && <span>{v.hall}</span>}
        {v.address && <span className="ev-venue__address">{v.address}</span>}
      </div>
      {maps && (
        <div className="ev-venue__buttons">
          <a className="ev-button" href={maps.place} target="_blank" rel="noopener noreferrer">
            <Glyph name="directions" size={18} /> open in maps
          </a>
          <a className="ev-button ev-button--quiet" href={maps.directions} target="_blank" rel="noopener noreferrer">
            <Glyph name="mrt" size={18} /> by train
          </a>
        </div>
      )}
      {v.directions?.length > 0 && (
        <ul className="ev-ways">
          {v.directions.map((way) => (
            <li key={way.text}>
              <span className="ev-ways__icon" aria-hidden="true">
                <Glyph name={way.how} size={18} />
              </span>
              <span>{way.text}</span>
            </li>
          ))}
        </ul>
      )}
      <Sourced item={item} ids={[...ids(v), ...v.directions.map((d) => d.sourceId)]} />
    </Card>
  );
}

function Tickets({ item }) {
  const t = item.tickets;
  if (!t || (!t.tiers?.length && !t.note?.text && !t.url && !t.opensAt)) return null;
  const tiers = t.tiers ?? [];
  const { perRow, all } = sourcing(tiers);
  return (
    <Card title={t.status === "free" ? "entry" : "tickets & prices"} id="tickets">
      {t.note?.text && <p className="ev-prose ev-prose--small">{t.note.text}</p>}
      {t.status === "soon" && t.opensAt && <p className="ev-prose ev-prose--small">on sale {dayLabel(t.opensAt)}, {timeOf(t.opensAt)}</p>}
      {tiers.length > 0 && (
        <ul className="app-list ev-tiers">
          {tiers.map((tier) => {
            const chip = tierChip(tier.status);
            return (
              <li key={tier.name} className="app-row ev-tier" data-status={tier.status}>
                <span className="app-row__text">
                  <span>{tier.name}</span>
                  {(tier.note || (perRow && tier.sourceId)) && (
                    <small>
                      {tier.note}
                      {tier.note && perRow && tier.sourceId ? " · " : ""}
                      {perRow && <SourceLink item={item} id={tier.sourceId} />}
                    </small>
                  )}
                </span>
                <span className="ev-tier__right">
                  <span className="ev-tier__price">{tier.priceLabel ?? (tier.price === 0 ? "free" : "tbc")}</span>
                  {chip && <Chips chips={[chip]} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {t.url && (
        <a className="ev-button" href={t.url} target="_blank" rel="noopener noreferrer">
          <Glyph name="ticket" size={18} /> get tickets on {siteOf(t.url)}
        </a>
      )}
      <Sourced item={item} ids={[...ids(t.note), ...(perRow ? [] : all)]} />
    </Card>
  );
}

function Guests({ item }) {
  const guests = item.guests ?? [];
  if (!guests.length) return null;
  const { perRow, all } = sourcing(guests);
  return (
    <Card title="guests">
      <ul className="app-list ev-plain-list">
        {guests.map((g) => (
          <li key={g.name} className="app-row">
            <span className="app-row__text">
              <span>{g.name}</span>
              <small>{[g.role, g.day ? dayLabel(g.day) : null, g.note].filter(Boolean).join(" · ")}</small>
              {perRow && g.sourceId && <SourceLink item={item} id={g.sourceId} />}
            </span>
          </li>
        ))}
      </ul>
      {!perRow && <Sourced item={item} ids={all} />}
    </Card>
  );
}

function Merch({ item }) {
  const goods = item.goods ?? [];
  if (!goods.length) return null;
  const { perRow, all } = sourcing(goods);
  return (
    <Card title={item.kind === "merch" ? "what's dropping" : "merch & exclusives"} id="merch">
      <ul className="app-list ev-goods">
        {goods.map((g) => (
          <li key={g.id} className="app-row ev-good">
            <span className="ev-merch-row__art" aria-hidden="true">
              {g.image ? <img src={g.image} alt="" loading="lazy" decoding="async" /> : <KindDoodle kind="merch" size={24} />}
            </span>
            <span className="app-row__text">
              <span>{g.name}</span>
              <small>{[g.where, g.when, g.note].filter(Boolean).join(" · ")}</small>
              <span className="ev-row__foot">
                {g.priceLabel && <span className="ev-tier__price">{g.priceLabel}</span>}
                <Chips chips={merchChips(g)} />
                {perRow && g.sourceId && <SourceLink item={item} id={g.sourceId} />}
              </span>
            </span>
            <SaveButton item={g} merch />
          </li>
        ))}
      </ul>
      {!perRow && <Sourced item={item} ids={all} />}
    </Card>
  );
}

const SCALE = { small: "small and cosy", medium: "medium", large: "big", huge: "huge" };
function Size({ item }) {
  const size = item.size;
  if (!size?.text) return null;
  return (
    <Card title="how big">
      {size.scale && (
        <p className="ev-scale" data-scale={size.scale}>
          <span className="ev-scale__bar" aria-hidden="true">
            {["small", "medium", "large", "huge"].map((s) => (
              <span key={s} data-on={["small", "medium", "large", "huge"].indexOf(s) <= ["small", "medium", "large", "huge"].indexOf(size.scale) ? "" : undefined} />
            ))}
          </span>
          {SCALE[size.scale] ?? size.scale}
        </p>
      )}
      <p className="ev-prose">{size.text}</p>
      <Sourced item={item} ids={ids(size)} />
    </Card>
  );
}

function Weather({ item }) {
  const w = item.weather;
  if (!w?.days?.length && !w?.now) return null;
  return (
    <Card title="weather">
      {w.now && (
        <p className="ev-weather-now">
          <Glyph name={w.now.icon} size={22} /> right now near {w.now.area}: {w.now.forecast.toLowerCase()}
        </p>
      )}
      {w.days?.length > 0 && (
        <ul className="ev-weather">
          {w.days.map((d) => (
            <li key={d.date}>
              <span className="ev-weather__day">{dayLabel(d.date).split(" ").slice(0, 2).join(" ")}</span>
              <span className="ev-weather__sky" aria-hidden="true">
                <Glyph name={d.icon} size={28} />
              </span>
              <span className="ev-weather__temp">
                {d.tempHigh}° <small>{d.tempLow}°</small>
              </span>
              {d.rainChance != null && <span className="ev-weather__rain">{d.rainChance}% rain</span>}
              {d.summary && <span className="ev-weather__text">{d.summary.toLowerCase()}</span>}
            </li>
          ))}
        </ul>
      )}
      {w.note && <p className="ev-prose ev-prose--small ev-weather__note">{w.note}</p>}
      <p className="ev-sourced">
        <span className="ev-sourced__label">
          {w.label}
          {w.fetchedAt ? ` · updated ${ago(w.fetchedAt)}` : ""}
        </span>
        <span className="ev-credit">{w.credit}</span>
      </p>
    </Card>
  );
}

function Transit({ item }) {
  const t = item.transit;
  if (t?.status !== "disrupted" || !t.alerts?.length) return null;
  return (
    <section className="app-card ev-card ev-transit" aria-label="Train alerts">
      <header className="app-card__head">
        <h2 className="app-card__title">
          <Glyph name="mrt" size={20} /> train alert
        </h2>
      </header>
      <ul className="ev-tips">
        {t.alerts.map((a) => (
          <li key={`${a.line}-${a.at}`}>
            <span>
              <strong>{a.line}</strong> {a.message}
            </span>
          </li>
        ))}
      </ul>
      <p className="ev-sourced">
        <span className="ev-credit">{t.credit}</span>
      </p>
    </section>
  );
}

function Tips({ item }) {
  if (!item.tips?.length) return null;
  return (
    <Card title="tips for a good day">
      <ul className="ev-tips">
        {item.tips.map((tip) => (
          <li key={tip.text}>
            <span>{tip.text}</span>
            {tip.sourceId && <SourceLink item={item} id={tip.sourceId} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Timeline({ item }) {
  const steps = item.timeline ?? [];
  if (!steps.length) return null;
  return (
    <Card title="timeline" id="timeline">
      <ol className="ev-timeline">
        {steps.map((s) => (
          <li key={s.stage} className="ev-step" data-state={s.state}>
            <span className="ev-step__dot" aria-hidden="true" />
            <div className="ev-step__body">
              <span className="ev-step__label">
                {s.title}
                {s.at && <span className="ev-step__date"> · {dayNumber(s.at)} {monthShort(s.at)}</span>}
                {s.state === "now" && <span className="ev-step__now"> now</span>}
              </span>
              {s.text || s.sourceId ? (
                <span className="ev-step__text">
                  {s.text}
                  {s.sourceId && (
                    <>
                      {" "}
                      <SourceLink item={item} id={s.sourceId} />
                    </>
                  )}
                </span>
              ) : (
                <span className="ev-step__text ev-step__text--waiting">{s.state === "unknown" ? "not yet" : "coming"}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function UpdateLog({ item, unseen }) {
  const updates = item.updates ?? [];
  if (!updates.length) return null;
  return (
    <Card title="update log" id="updates">
      <ol className="ev-log">
        {updates.map((u) => {
          const fresh = unseen.has(u.id);
          return (
            <li key={u.id} data-new={fresh ? "" : undefined}>
              <span className="ev-log__when">
                {ago(u.at)}
                {fresh && <NewMark newness="new" />}
              </span>
              <strong>{u.title}</strong>
              {u.text && <p>{u.text}</p>}
              {u.sourceId && <SourceLink item={item} id={u.sourceId} />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const SOURCE_KIND = { official: "official", venue: "venue", ticketing: "tickets", news: "article", listing: "listing", social: "social", newsletter: "newsletter", owner: "from josh" };

function LinksAndSources({ item }) {
  const links = (item.links ?? []).filter((l) => l.kind !== "map");
  const sources = item.sources ?? [];
  if (!links.length && !sources.length) return null;
  return (
    <Card title="official links & sources" id="sources">
      {links.length > 0 && (
        <ul className="app-list ev-links">
          {links.map((link) => (
            <li key={`${link.kind}-${link.url}`} className="app-row app-row--more">
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <span className="app-row__icon" aria-hidden="true">
                  <Glyph name={link.kind === "tickets" ? "ticket" : "link"} size={18} />
                </span>
                <span className="app-row__text">
                  <span>{link.label}</span>
                  <small>{siteOf(link.url)}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {sources.length > 0 && (
        <>
          <h3 className="ev-subhead">where this page’s facts come from</h3>
          <ol className="ev-sources">
            {sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label || siteOf(s.url)}
                </a>
                <small>{[s.publisher, SOURCE_KIND[s.kind], s.at ? ago(s.at) : null].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

// ---------- the page ----------
export default function EventPage() {
  const { id } = useParams();
  const location = useLocation();
  const from = BACK[location.state?.from] ?? BACK.home;
  const back = useAppBack(from.to);
  const { item, isPending, isError, missing, refetch } = useEvent(id);
  const now = useNow(60_000);
  // What she hadn't seen when the page opened stays marked for this visit.
  const unseen = useRef(null);
  if (item?.full && unseen.current === null) unseen.current = new Set(item.updates.filter((u) => u.unseen).map((u) => u.id));
  useMarkLooked(id, { enabled: Boolean(item?.full), delay: 1500 });
  useEffect(() => {
    if (item?.name) document.title = `${item.name} ♡`;
  }, [item?.name]);

  const head = (title) => (
    <header className="app-section__head">
      <button type="button" className="app-screen__back" onClick={back}>
        {from.label}
      </button>
      <h1 className="app-section__title ev-page__title" data-short={title || "event"}>
        {title}
      </h1>
      {item && (
        <div className="app-section__actions">
          <PasteLink event={item} compact />
        </div>
      )}
      {item?.tagline && <p className="app-section__subtitle">{item.tagline}</p>}
    </header>
  );

  if (!item)
    return (
      <div className="app-screen ev-page">
        {head(isPending ? "" : "not found")}
        <div className="app-section__body">
          {isPending ? (
            <div className="ev-skeleton" aria-label="Loading">
              <div className="ev-skeleton__hero" />
              <div className="ev-skeleton__rows">
                <span />
                <span />
              </div>
            </div>
          ) : (
            <div className="app-card ev-empty">
              <KindDoodle kind="con" size={44} />
              <strong>{isError ? "this page couldn’t load" : "this one isn’t on the list anymore"}</strong>
              <p>{isError ? "check your connection and try again." : missing ? "it may have been cancelled or folded into another event." : ""}</p>
              {isError ? (
                <button type="button" className="ev-pill-link" onClick={() => refetch()}>
                  try again
                </button>
              ) : (
                <Link className="ev-pill-link" to="/world/events">
                  see what’s on
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );

  const fresh = unseen.current ?? new Set();
  const updates = (item.updates ?? []).filter((u) => fresh.has(u.id));
  return (
    <div className="app-screen ev-page" data-kind={item.kind}>
      {head(item.name)}
      <div className="app-section__body">
        <Ticket item={item} now={now} />
        <Actions item={item} />
        <SinceYouLooked item={item} updates={updates} />
        {item.full ? (
          <>
            <About item={item} />
            <Prose title="what it's like" claim={item.like} item={item} />
            <Popup item={item} />
            <Dates item={item} now={now} />
            <Transit item={item} />
            <GettingThere item={item} />
            <Tickets item={item} />
            <Guests item={item} />
            <Merch item={item} />
            <Size item={item} />
            <Weather item={item} />
            <Tips item={item} />
            <Timeline item={item} />
            <UpdateLog item={item} unseen={fresh} />
            <LinksAndSources item={item} />
          </>
        ) : isError ? (
          <div className="app-card ev-trouble">
            <p>the rest of this page couldn’t load just now.</p>
            <button type="button" className="ev-pill-link" onClick={() => refetch()}>
              try again
            </button>
          </div>
        ) : (
          <div className="ev-skeleton" aria-hidden="true">
            <div className="ev-skeleton__rows">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
