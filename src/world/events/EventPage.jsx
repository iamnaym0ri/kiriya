// One complete page per event or merch drop (docs/refactor/PLAN.md phase 6): what it is, when,
// where and how to get there, tickets, guests, merch, size, weather, tips, its timeline and what
// changed since she last looked. Every claim links to the page or post it came from.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import {
  ago,
  dateRange,
  dayLabel,
  daysAway,
  hours,
  kindLabel,
  mapsLinks,
  monthShort,
  dayNumber,
  phaseOf,
  price,
  siteOf,
  tierChip,
  timeOf,
  whenLabel,
} from "./eventFormat.js";
import { useEvent, useEventsPersonal, useMarkLooked } from "./eventsData.js";
import { Chips, Countdown, ItemChips, KindDoodle, NewMark, SaveButton, SourceLink, Sourced, useNow } from "./EventPieces.jsx";
import { addToCalendar, canAddToCalendar } from "./calendar.js";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

const BACK = { events: { label: "events", to: "/world/events" }, saved: { label: "saved", to: "/world/saves" }, home: { label: "home", to: "/world" } };

// ---------- little icons ----------
function Glyph({ name, size = 20 }) {
  const paths = {
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.8 9.8h16.4M8 3.2v3.4M16 3.2v3.4M8.2 14h2M13.8 14h2M8.2 17.2h2" />
      </>
    ),
    directions: (
      <>
        <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 7.6c0-.9.7-1.6 1.6-1.6h12.8c.9 0 1.6.7 1.6 1.6v2.2a2.3 2.3 0 0 0 0 4.4v2.2c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6v-2.2a2.3 2.3 0 0 0 0-4.4z" />
        <path d="M14.6 6.4v11.2" strokeDasharray="1 2.2" />
      </>
    ),
    bag: (
      <>
        <path d="M5.2 8.6h13.6l-1 11.6H6.2z" />
        <path d="M9 8.4c0-2.5 1.3-4.4 3-4.4s3 1.9 3 4.4" />
      </>
    ),
    mrt: (
      <>
        <rect x="6" y="3.5" width="12" height="13" rx="3.2" />
        <path d="M6.2 10.2h11.6M9.2 13.6h.1M14.8 13.6h.1M8.6 16.6 6.6 20.5M15.4 16.6l2 3.9" />
      </>
    ),
    bus: (
      <>
        <rect x="5" y="3.5" width="14" height="14" rx="3" />
        <path d="M5.2 11h13.6M8.6 14.4h.1M15.4 14.4h.1M7.6 17.5v2.5M16.4 17.5v2.5" />
      </>
    ),
    walk: (
      <>
        <circle cx="13" cy="4.6" r="1.8" />
        <path d="m10.2 21 2-6.4 2.6 2.4.8 4M12.2 14.6l.8-5.4-3.6 2-1 3.2M13 9.2l2.4 2.8 2.6.8" />
      </>
    ),
    car: (
      <>
        <path d="M4.6 15.6v-3.2l1.8-4.6c.3-.7.9-1.1 1.6-1.1h8c.7 0 1.3.4 1.6 1.1l1.8 4.6v3.2z" />
        <path d="M4.8 12.4h14.4M7.4 15.6v2.6M16.6 15.6v2.6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
      </>
    ),
    cloud: <path d="M7.4 18.2h9.8a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4 3.3 3.3 0 0 0 .6 6.6z" />,
    showers: (
      <>
        <path d="M7.4 14.6h9.8a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-10.1 1.3 3 3 0 0 0-.1 5.9z" />
        <path d="M8.6 17.4l-1 2.6M12.4 17.4l-1 2.6M16.2 17.4l-1 2.6" />
      </>
    ),
    storm: (
      <>
        <path d="M7.4 13.8h9.8a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-10.1 1.3 3 3 0 0 0-.1 5.9z" />
        <path d="m12.6 14.6-2.2 3.6h3l-2 3.6" />
      </>
    ),
    link: (
      <>
        <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2" />
        <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" />
      </>
    ),
  };
  return (
    <svg className="ev-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] ?? paths.link}
    </svg>
  );
}

// ---------- building blocks ----------
function Card({ title, id, children, className = "", tone }) {
  return (
    <section className={`app-card ev-card ${className}`} id={id} data-tone={tone} aria-label={title}>
      <header className="app-card__head">
        <h2 className="app-card__title">{title}</h2>
      </header>
      <div className="app-card__body">{children}</div>
    </section>
  );
}

/** Rows that each say where they came from when the card mixes sources; otherwise one footer. */
function sourcing(rows) {
  const ids = [...new Set(rows.map((r) => r.sourceId).filter(Boolean))];
  return { perRow: ids.length > 1, ids };
}

// ---------- the parts of the page ----------
function Ticket({ item, now }) {
  const p = phaseOf(item, now);
  const merch = item.kind === "merch";
  const first = item.days?.[0];
  let times = null;
  if (item.hours) times = `every day, ${hours(item.hours)}`;
  else if (first && item.days.every((d) => d.opens === first.opens && d.closes === first.closes)) times = `${item.days.length > 1 ? "each day, " : ""}${hours(first)}`;
  else if (first) times = `${hours(first)} on day 1 · see the hours below`;
  if (merch) {
    const drop = item.drop ?? {};
    if (drop.dropAt && p.phase === "soon") times = `${dayLabel(drop.dropAt)}, ${timeOf(drop.dropAt)}`;
    else if (drop.until) times = `orders close ${dayLabel(drop.until)}, ${timeOf(drop.until)}`;
    else times = null;
  }
  const label = merch ? (p.phase === "soon" ? "drops in" : "") : p.phase === "between" ? `day ${p.day} opens in` : p.phase === "today" ? "doors open in" : "starts in";
  return (
    <div className="ev-ticket">
      <div className="ev-ticket__top">
        <span className="ev-ticket__doodle" aria-hidden="true">
          <KindDoodle kind={item.kind} size={46} />
        </span>
        <div className="ev-ticket__when">
          <span className="ev-ticket__eyebrow">{[kindLabel(item.kind), item.hers ? "ur fandom" : null, item.venue?.area].filter(Boolean).join(" · ")}</span>
          <strong className="ev-ticket__dates">{merch ? (item.drop?.dropAt && p.phase === "soon" ? `drops ${dayNumber(item.drop.dropAt)} ${monthShort(item.drop.dropAt)}` : whenLabel(item, now)) : dateRange(item, { now })}</strong>
          {times && <span className="ev-ticket__times">{times}</span>}
          {!merch && item.venue?.name && <span className="ev-ticket__venue">{[item.venue.name, item.venue.hall].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      {p.phase === "open" && !merch ? (
        <p className="ev-ticket__live">
          <span className="ev-live-dot" aria-hidden="true" />
          {p.run ? whenLabel(item, now) : `on right now${p.of > 1 ? ` · day ${p.day} of ${p.of}` : ""}`}
          {p.closesAt && ` · open till ${timeOf(p.closesAt)}`}
        </p>
      ) : p.next && (p.phase === "soon" || p.phase === "today" || p.phase === "between") && daysAway(p.next, now) < 100 ? (
        <div className="ev-ticket__count">
          <span className="ev-ticket__count-label">{label}</span>
          <Countdown to={p.next} label={label} compact />
        </div>
      ) : p.phase === "ended" ? (
        <p className="ev-ticket__over">{merch ? "orders have closed" : `that was ${ago(p.endedAt, now)} ♡`}</p>
      ) : null}
      <div className="ev-ticket__stub">
        <ItemChips item={item} now={now} />
      </div>
    </div>
  );
}

function Actions({ item }) {
  const [note, setNote] = useState(null);
  const maps = mapsLinks(item.venue);
  const buy = item.kind === "merch" ? item.drop?.where?.find((w) => w.url) ?? item.links?.[0] : item.tickets?.url ? { url: item.tickets.url } : null;
  const calendarOk = canAddToCalendar(item);
  return (
    <>
      <div className="ev-actions" role="group" aria-label="Actions">
        <button
          type="button"
          className="ev-action"
          disabled={!calendarOk}
          onClick={() => {
            const result = addToCalendar(item);
            setNote(result === "unavailable" ? "calendar isn’t available here yet" : result === "downloaded" ? "saved: open the file to add it ♡" : null);
          }}
        >
          <span className="ev-action__icon">
            <Glyph name="calendar" />
          </span>
          <span className="ev-action__label">{calendarOk ? "calendar" : "dates tbc"}</span>
        </button>
        {maps ? (
          <a className="ev-action" href={maps.directions} target="_blank" rel="noopener noreferrer">
            <span className="ev-action__icon">
              <Glyph name="directions" />
            </span>
            <span className="ev-action__label">directions</span>
          </a>
        ) : null}
        {buy?.url ? (
          <a className="ev-action" href={buy.url} target="_blank" rel="noopener noreferrer">
            <span className="ev-action__icon">
              <Glyph name={item.kind === "merch" ? "bag" : "ticket"} />
            </span>
            <span className="ev-action__label">{item.kind === "merch" ? "shop" : "tickets"}</span>
          </a>
        ) : null}
        <SaveButton item={item} labelled />
      </div>
      {note && (
        <p className="ev-action-note" role="status">
          {note}
        </p>
      )}
    </>
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
          <li key={u.id ?? u.at}>
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

function Prose({ title, block, item, children }) {
  if (!block?.text && !children) return null;
  return (
    <Card title={title}>
      {block?.text && <p className="ev-prose">{block.text}</p>}
      {children}
      <Sourced item={item} ids={[block?.sourceId]} />
    </Card>
  );
}

function Dates({ item, now }) {
  if (item.kind === "merch") return null;
  if (item.datesTbc)
    return (
      <Card title="dates & times">
        <p className="ev-prose">not announced yet{item.datesNote ? ` (${item.datesNote})` : ""}. you’ll see it here the moment it is.</p>
      </Card>
    );
  if (item.hours)
    return (
      <Card title="dates & times">
        <ul className="app-list">
          <li className="app-row">
            <span className="app-row__text">
              <span>every day, {hours(item.hours)}</span>
              <small>{dateRange(item, { now })}</small>
            </span>
          </li>
        </ul>
        <Sourced item={item} ids={[item.venue?.sourceId, item.popup?.about?.sourceId]} />
      </Card>
    );
  if (!item.days?.length) return null;
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
                {d.date === today && <span className="ev-today"> today</span>}
              </span>
              {d.note && <small>{d.note}</small>}
            </span>
            <span className="app-row__detail ev-day__hours">{hours(d)}</span>
          </li>
        ))}
      </ul>
      <Sourced item={item} ids={[item.about?.sourceId, item.venue?.sourceId]} />
    </Card>
  );
}

function GettingThere({ item }) {
  const v = item.venue;
  if (!v || item.kind === "merch") return null;
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
              <span className="ev-ways__icon" aria-label={way.how === "mrt" ? "MRT" : way.how}>
                <Glyph name={way.how} size={18} />
              </span>
              <span>{way.text}</span>
            </li>
          ))}
        </ul>
      )}
      <Sourced item={item} ids={[v.sourceId]} />
    </Card>
  );
}

function Tickets({ item }) {
  const t = item.tickets;
  if (!t || item.kind === "merch") return null;
  const tiers = t.tiers ?? [];
  const { perRow, ids } = sourcing(tiers);
  if (!tiers.length && !t.summary && !t.url) return null;
  return (
    <Card title={t.status === "free" ? "entry" : "tickets & prices"} id="tickets">
      {t.summary && <p className="ev-prose ev-prose--small">{t.summary}</p>}
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
                  <span className="ev-tier__price">{price(tier.price) ?? "tbc"}</span>
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
      <Sourced item={item} ids={perRow ? [t.sourceId] : [t.sourceId, ...ids]} />
    </Card>
  );
}

function MerchBuy({ item, now }) {
  const drop = item.drop;
  if (item.kind !== "merch" || !drop) return null;
  const p = phaseOf(item, now);
  const cost = price(drop.price);
  return (
    <Card title="price & where to get it">
      <ul className="app-list">
        {cost && (
          <li className="app-row">
            <span className="app-row__text">
              <span>price</span>
            </span>
            <span className="app-row__detail ev-strong">
              {drop.price?.from ? "from " : ""}
              {cost}
            </span>
          </li>
        )}
        {drop.dropAt && (
          <li className="app-row">
            <span className="app-row__text">
              <span>{drop.status === "preorder" ? "preorder opens" : "drops"}</span>
            </span>
            <span className="app-row__detail">
              {dayLabel(drop.dropAt)}, {timeOf(drop.dropAt)}
            </span>
          </li>
        )}
        {drop.until && (
          <li className="app-row">
            <span className="app-row__text">
              <span>orders close</span>
              {p.phase === "open" && <small>{whenLabel(item, now)}</small>}
            </span>
            <span className="app-row__detail">
              {dayLabel(drop.until)}, {timeOf(drop.until)}
            </span>
          </li>
        )}
        {drop.ships && (
          <li className="app-row">
            <span className="app-row__text">
              <span>ships</span>
            </span>
            <span className="app-row__detail">{drop.ships.replace(/^ships\s*/, "")}</span>
          </li>
        )}
      </ul>
      {drop.where?.map((w) =>
        w.url ? (
          <a key={w.name} className="ev-button" href={w.url} target="_blank" rel="noopener noreferrer">
            <Glyph name="bag" size={18} /> {w.name}
          </a>
        ) : (
          <p key={w.name} className="ev-prose ev-prose--small">
            {w.name}
          </p>
        ),
      )}
      <Sourced item={item} ids={[drop.sourceId]} />
    </Card>
  );
}

function ListCard({ title, rows, item, render }) {
  if (!rows?.length) return null;
  const { perRow, ids } = sourcing(rows);
  return (
    <Card title={title}>
      <ul className="app-list ev-plain-list">
        {rows.map((row) => (
          <li key={row.name ?? row.text} className="app-row">
            {render(row)}
            {perRow && row.sourceId && <SourceLink item={item} id={row.sourceId} />}
          </li>
        ))}
      </ul>
      {!perRow && <Sourced item={item} ids={ids} />}
    </Card>
  );
}

function Weather({ item }) {
  const w = item.weather;
  if (!w?.days?.length) return null;
  return (
    <Card title="weather">
      <ul className="ev-weather">
        {w.days.map((d) => (
          <li key={d.date}>
            <span className="ev-weather__day">{dayLabel(d.date).split(" ").slice(0, 2).join(" ")}</span>
            <span className="ev-weather__sky" aria-hidden="true">
              <Glyph name={d.sky ?? "cloud"} size={28} />
            </span>
            <span className="ev-weather__temp">
              {d.high}° <small>{d.low}°</small>
            </span>
            {d.rain != null && <span className="ev-weather__rain">{d.rain}% rain</span>}
            {d.text && <span className="ev-weather__text">{d.text}</span>}
          </li>
        ))}
      </ul>
      <p className="ev-sourced">
        <span className="ev-sourced__label">{w.provider ? `${w.provider} · ` : ""}updated {ago(w.updatedAt)}</span>
        <SourceLink item={item} id={w.sourceId} />
      </p>
    </Card>
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

const STAGES = [
  { stage: "announced", label: "announced" },
  { stage: "guests", label: "guests revealed" },
  { stage: "tickets", label: "tickets on sale" },
  { stage: "merch", label: "merch & exclusives" },
  { stage: "schedule", label: "schedule out" },
  { stage: "day", label: "the day itself" },
  { stage: "after", label: "after" },
];

function Timeline({ item, now }) {
  const steps = useMemo(() => {
    const entries = item.timeline ?? [];
    const full = ["con", "fair", "concert"].includes(item.kind);
    const out = [];
    for (const { stage, label } of STAGES) {
      const entry = [...entries].reverse().find((e) => e.stage === stage);
      if (!entry && !full) continue;
      const at = entry?.at ?? null;
      const done = at ? Date.parse(at) <= now.getTime() : false;
      out.push({ stage, label, entry, at, done });
    }
    // The first step not done yet is where things stand.
    const next = out.findIndex((s) => !s.done);
    return out.map((s, i) => ({ ...s, current: i === next }));
  }, [item, now]);
  if (!steps.length) return null;
  return (
    <Card title="timeline" id="timeline">
      <ol className="ev-timeline">
        {steps.map((s) => (
          <li key={s.stage} className="ev-step" data-done={s.done ? "" : undefined} data-current={s.current ? "" : undefined}>
            <span className="ev-step__dot" aria-hidden="true" />
            <div className="ev-step__body">
              <span className="ev-step__label">
                {s.label}
                {s.at && <span className="ev-step__date"> · {s.done ? `${dayNumber(s.at)} ${monthShort(s.at)}` : `${dayNumber(s.at)} ${monthShort(s.at)}`}</span>}
              </span>
              {s.entry ? (
                <span className="ev-step__text">
                  {s.entry.text ?? s.entry.title}
                  {s.entry.sourceId && (
                    <>
                      {" "}
                      <SourceLink item={item} id={s.entry.sourceId} />
                    </>
                  )}
                </span>
              ) : (
                <span className="ev-step__text ev-step__text--waiting">not yet</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function UpdateLog({ item, since }) {
  const updates = [...(item.updates ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!updates.length) return null;
  return (
    <Card title="update log" id="updates">
      <ol className="ev-log">
        {updates.map((u) => {
          const fresh = Date.parse(u.at) > since;
          return (
            <li key={u.id ?? u.at} data-new={fresh ? "" : undefined}>
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

const SOURCE_KIND = { official: "official", venue: "venue", ticketing: "tickets", instagram: "instagram", news: "article", weather: "weather", transit: "transit" };

function LinksAndSources({ item }) {
  const links = item.links ?? [];
  const sources = item.sources ?? [];
  if (!links.length && !sources.length) return null;
  return (
    <Card title="official links & sources" id="sources">
      {links.length > 0 && (
        <ul className="app-list ev-links">
          {links.map((link) => (
            <li key={link.url} className="app-row app-row--more">
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
                <small>
                  {[SOURCE_KIND[s.kind], siteOf(s.url), s.checkedAt ? `checked ${ago(s.checkedAt)}` : null].filter(Boolean).join(" · ")}
                </small>
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
  const mine = useEventsPersonal();
  const now = useNow(60_000);
  // What she hadn't seen when she opened the page stays marked for this visit.
  const [since] = useState(() => mine.since(id));
  useMarkLooked(id, { enabled: Boolean(item), delay: 1500 });
  useEffect(() => {
    if (item) document.title = `${item.name} ♡`;
  }, [item]);

  const head = (title, short) => (
    <header className="app-section__head">
      <button type="button" className="app-screen__back" onClick={back}>
        {from.label}
      </button>
      <h1 className="app-section__title ev-page__title" data-short={short ?? title}>
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
        {head(isPending ? "" : "not found", "events")}
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

  const unseen = mine.unseenUpdates(item, since);
  const popup = item.popup;
  return (
    <div className="app-screen ev-page" data-kind={item.kind}>
      {head(item.name)}
      <div className="app-section__body">
        <Ticket item={item} now={now} />
        <Actions item={item} />
        <SinceYouLooked item={item} updates={unseen} />
        {item.thin && (
          <div className="app-card ev-card ev-thin">
            <p className="ev-prose ev-prose--small">the full write-up for this one is still being put together. the official page has everything so far.</p>
            {item.links?.[0] && (
              <a className="ev-button" href={item.links[0].url} target="_blank" rel="noopener noreferrer">
                <Glyph name="link" size={18} /> {siteOf(item.links[0].url)}
              </a>
            )}
          </div>
        )}
        {popup ? (
          <>
            <Prose title="what it’s about" block={popup.about} item={item} />
            <Prose title="what’s sold" block={popup.sold} item={item}>
              {popup.sold?.items?.length > 0 && (
                <ul className="ev-sold">
                  {popup.sold.items.map((thing) => (
                    <li key={thing}>{thing}</li>
                  ))}
                </ul>
              )}
            </Prose>
          </>
        ) : (
          <Prose title={item.kind === "merch" ? "what it is" : "what it is"} block={item.about} item={item} />
        )}
        <Prose title="what it’s like" block={item.like} item={item} />
        <MerchBuy item={item} now={now} />
        <Dates item={item} now={now} />
        <GettingThere item={item} />
        <Tickets item={item} />
        <ListCard
          title="guests"
          rows={item.guests}
          item={item}
          render={(g) => (
            <span className="app-row__text">
              <span>{g.name}</span>
              <small>
                {g.role}
                {g.when ? ` · ${dayLabel(g.when)}` : ""}
              </small>
            </span>
          )}
        />
        <ListCard
          title="merch & exclusives"
          rows={item.goods}
          item={item}
          render={(g) => (
            <>
              <span className="app-row__text">
                <span>
                  {g.name}
                  {g.exclusive && <span className="ev-chip ev-chip--inline" data-tone="rose">exclusive</span>}
                </span>
                {g.note && <small>{g.note}</small>}
              </span>
              {g.price && <span className="app-row__detail ev-strong">{price(g.price)}</span>}
            </>
          )}
        />
        <Prose title="how big" block={item.size} item={item} />
        <Weather item={item} />
        <Tips item={item} />
        <Timeline item={item} now={now} />
        <UpdateLog item={item} since={since} />
        <LinksAndSources item={item} />
      </div>
    </div>
  );
}
