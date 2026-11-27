// One page per event (docs/refactor/PLAN.md phase 6), arranged by what matters first (Josh,
// 2026-11-27): what it is, when (with a countdown), where (with a map), tickets and the weather for
// the day, all at a glance at the top. Then a short, icon-led gist, the merch as picture cards (each
// opens its own page), and everything else behind tidy rows she can open. Every claim still links
// to the page or post it came from. A pushed screen inside the app's home tab.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import {
  ago,
  dateRange,
  daysAway,
  dayLabel,
  dayNumber,
  dayWeather,
  displayName,
  handSafe,
  hours,
  kindLabel,
  mapsLinks,
  monthShort,
  phaseOf,
  siteOf,
  ticketFacts,
  tierChip,
  timeOf,
  titleLength,
  whenLabel,
} from "./eventFormat.js";
import { MERCH_LIST, useEvent, useMarkLooked } from "./eventsData.js";
import { Chips, Countdown, KindDoodle, MerchCard, NewMark, SaveButton, SourceLink, Sourced, Toaster, useNow } from "./EventPieces.jsx";
import Glyph from "./Glyph.jsx";
import { addToCalendar, canAddToCalendar } from "./calendar.js";
import PasteLink from "./PasteLink.jsx";
import "./events.css";

const BACK = {
  events: { label: "events", to: "/world/events" },
  saved: { label: "saved", to: "/world/saves" },
  home: { label: "home", to: "/world" },
  merch: { label: "merch", to: MERCH_LIST },
  piece: { label: "merch", to: MERCH_LIST },
  event: { label: "back", to: "/world/events" },
};
const ids = (claim) => claim?.sourceIds ?? (claim?.sourceId ? [claim.sourceId] : []);
const HIGHLIGHTS_SHOWN = 3;

/** "in 3 weeks", "in 6 months": how far off, in words, when a ticking clock would be too much. */
function farLabel(to, now) {
  const d = daysAway(to, now);
  if (d < 14) return `in ${d} days`;
  if (d < 60) return `in ${Math.round(d / 7)} weeks`;
  const months = Math.round(d / 30.4);
  return months >= 12 ? `in about ${months === 12 ? "a year" : `${months} months`}` : `in ${months} months`;
}
const MERCH_SHOWN = 4;

// ---------- the top: what, when, where, tickets, weather ----------
function GlanceRow({ icon, title, detail, href, action, tone, children, label }) {
  const body = (
    <>
      <span className="ev-glance__icon" data-tone={tone} aria-hidden="true">
        <Glyph name={icon} size={20} />
      </span>
      <span className="ev-glance__text">
        <span className="ev-glance__label">{label}</span>
        <strong className="ev-glance__title">{title}</strong>
        {detail && <small className="ev-glance__detail">{detail}</small>}
        {children}
      </span>
      {action && (
        <span className="ev-glance__action" aria-hidden="true">
          {action}
        </span>
      )}
    </>
  );
  return (
    <li className="ev-glance__row">
      {href ? (
        <a className="ev-glance__link" href={href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <div className="ev-glance__link">{body}</div>
      )}
    </li>
  );
}

function When({ item, now }) {
  const p = phaseOf(item, now);
  const first = item.days?.[0];
  let time = null;
  if (first && item.days.every((d) => d.opens === first.opens && d.closes === first.closes)) time = `${item.days.length > 1 ? "daily " : ""}${hours(first)}`;
  else if (first) time = "hours change by day";
  const detail = [item.days?.length > 1 ? `${item.days.length} days` : null, time].filter(Boolean).join(" · ") || (item.datesTbc ? "you’ll see it here the moment it’s announced" : null);
  let label = null;
  let to = null;
  if (p.phase === "open" && p.closesAt && !p.run) (label = "doors close in"), (to = p.closesAt);
  else if (p.next) (label = p.phase === "between" ? `day ${p.day} opens in` : p.phase === "today" ? "doors open in" : "starts in"), (to = p.next);
  // A ticking clock only when it's close; further out, words are calmer.
  const close = to && to.getTime() - now.getTime() < 14 * 86_400_000;
  return (
    <GlanceRow icon="calendar" label="when" title={dateRange(item, { now })} detail={detail}>
      {(p.phase === "open" || (to && close)) && (
        <span className="ev-glance__count">
          {p.phase === "open" && (
            <span className="ev-glance__live">
              <span className="ev-live-dot" aria-hidden="true" />
              {whenLabel(item, now)}
              {p.closesAt && !close ? ` · open till ${timeOf(p.closesAt)}` : ""}
            </span>
          )}
          {to && close && (
            <span className="ev-glance__ticker">
              <span className="ev-glance__count-label">{label}</span>
              <Countdown to={to} label={label} inline />
            </span>
          )}
        </span>
      )}
      {p.phase === "cancelled" && <span className="ev-glance__off">cancelled</span>}
      {p.phase === "ended" && <span className="ev-glance__soft">that was {ago(p.endedAt, now)} ♡</span>}
      {to && !close && <span className="ev-glance__soon">{farLabel(to, now)}</span>}
    </GlanceRow>
  );
}

function Glance({ item, now }) {
  const maps = mapsLinks(item.venue);
  const t = ticketFacts(item.tickets, now);
  const buy = item.tickets?.url ?? item.links?.find((l) => l.kind === "tickets")?.url ?? null;
  const salesSoon = t.opensAt && t.opensAt - now.getTime() < 7 * 86_400_000;
  const w = dayWeather(item, now);
  const where = item.venue?.name;
  return (
    <section className="app-card app-card--flush ev-glance" aria-label="At a glance">
      {item.image?.url && (
        <figure className="ev-glance__image">
          <img src={item.image.url} alt={item.image.alt ?? ""} decoding="async" />
          {item.image.credit && <figcaption>{item.image.credit}</figcaption>}
        </figure>
      )}
      <div className="ev-glance__kind" data-over={item.image?.url ? "" : undefined}>
        <span className="ev-glance__doodle" aria-hidden="true">
          <KindDoodle kind={item.kind} size={item.image?.url ? 20 : 26} />
        </span>
        <span>{[kindLabel(item.kind), item.hers ? "ur fandom" : null].filter(Boolean).join(" · ")}</span>
      </div>
      <ul className="ev-glance__rows">
        <When item={item} now={now} />
        <GlanceRow
          icon="directions"
          label="where"
          title={where ?? "venue tbc"}
          detail={[item.venue?.hall, item.venue?.area].filter(Boolean).join(" · ") || null}
          href={maps?.place}
          action={maps ? <span className="ev-pill">map</span> : null}
        />
        <GlanceRow icon="ticket" label="tickets" title={t.title} detail={t.detail} tone={t.tone} href={buy} action={buy ? <span className="ev-pill ev-pill--strong">{t.status === "on_sale" ? "buy" : "view"}</span> : null}>
          {salesSoon && (
            <span className="ev-glance__count">
              <span className="ev-glance__ticker">
                <span className="ev-glance__count-label">sales open in</span>
                <Countdown to={new Date(t.opensAt)} label="sales open in" inline />
              </span>
            </span>
          )}
        </GlanceRow>
        {w ? (
          <GlanceRow icon={w.icon} label="weather" title={`${w.tempHigh}° / ${w.tempLow}°${w.rainChance != null ? ` · ${w.rainChance}% rain` : ""}`} detail={[dayLabel(w.date), w.summary?.toLowerCase()].filter(Boolean).join(" · ")} />
        ) : item.startsOn && !item.datesTbc && phaseOf(item, now).phase !== "ended" ? (
          <GlanceRow icon="cloudy" label="weather" title="forecast soon" detail="it shows up here about two weeks before" tone="mute" />
        ) : null}
      </ul>
    </section>
  );
}

function Actions({ item }) {
  const calendar = canAddToCalendar(item);
  return (
    <div className="ev-actions ev-actions--two" role="group" aria-label="Actions">
      <button type="button" className="ev-action" disabled={!calendar} onClick={() => addToCalendar(item)}>
        <span className="ev-action__icon">
          <Glyph name="calendar" />
        </span>
        <span className="ev-action__label">{calendar ? "add to calendar" : "dates tbc"}</span>
      </button>
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
          <Glyph name="sparkle" size={18} /> new since you looked
        </h2>
      </header>
      <ul className="ev-since__list">
        {updates.slice(0, 3).map((u) => (
          <li key={u.id}>
            <strong>{u.title}</strong>
            {u.text && <p>{u.text}</p>}
            <small>{ago(u.at)}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- the gist ----------
function Facts({ item, open }) {
  const facts = [];
  if (item.size?.scale) facts.push({ key: "size", icon: "size", value: { small: "small", medium: "medium", large: "big", huge: "huge" }[item.size.scale] ?? item.size.scale, label: "size", target: "about" });
  if (item.days?.length > 1) facts.push({ key: "days", icon: "clock", value: `${item.days.length} days`, label: "how long", target: "days" });
  if (item.guests?.length) facts.push({ key: "guests", icon: "people", value: `${item.guests.length}`, label: item.guests.length === 1 ? "guest" : "guests", target: "guests" });
  if (item.goods?.length) facts.push({ key: "merch", icon: "bag", value: `${item.goods.length}`, label: "merch", target: "merch" });
  if (item.tips?.length) facts.push({ key: "tips", icon: "tips", value: `${item.tips.length}`, label: item.tips.length === 1 ? "tip" : "tips", target: "tips" });
  if (!facts.length) return null;
  return (
    <ul className="ev-facts" aria-label="Quick facts">
      {facts.map((f) => (
        <li key={f.key}>
          <button type="button" className="ev-fact" onClick={() => open(f.target)}>
            <Glyph name={f.icon} size={18} />
            <strong>{f.value}</strong>
            <small>{f.label}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Gist({ item, open }) {
  const [more, setMore] = useState(false);
  const highlights = item.highlights ?? [];
  const about = item.about?.text ?? null;
  if (!about && !highlights.length && !item.size && !item.goods?.length && !item.guests?.length) return null;
  const long = about && about.length > 220;
  return (
    <section className="app-card ev-card ev-gist" aria-label="What it is">
      <header className="app-card__head">
        <h2 className="app-card__title">the gist</h2>
      </header>
      {about && (
        <div className="ev-gist__about">
          <p className="ev-prose" data-clamped={long && !more ? "" : undefined}>
            {about}
          </p>
          {long && (
            <button type="button" className="ev-textlink" aria-expanded={more} onClick={() => setMore((v) => !v)}>
              {more ? "less" : "read more"}
            </button>
          )}
        </div>
      )}
      {highlights.length > 0 && (
        <ul className="ev-highlights">
          {highlights.slice(0, HIGHLIGHTS_SHOWN).map((h) => (
            <li key={h.text}>
              <span className="ev-highlights__icon" aria-hidden="true">
                <Glyph name="sparkle" size={16} />
              </span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      )}
      <Facts item={item} open={open} />
      <Sourced item={item} ids={ids(item.about)} />
    </section>
  );
}

function MerchGrid({ item }) {
  const goods = item.goods ?? [];
  const [all, setAll] = useState(false);
  if (!goods.length) return null;
  // Exclusives and pieces with a picture first; sold-out last.
  const rank = (g) => (g.status === "sold_out" ? 4 : 0) + (g.image ? 0 : 2) + (g.kind === "exclusive" || g.limited ? 0 : 1);
  const sorted = goods.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map(({ g }) => g);
  const shown = all ? sorted : sorted.slice(0, MERCH_SHOWN);
  const exclusives = goods.filter((g) => g.kind === "exclusive" || g.limited).length;
  return (
    <section className="app-card ev-card ev-merchgrid" id="merch" aria-label="Merch and exclusives">
      <header className="app-card__head">
        <h2 className="app-card__title">{item.kind === "merch" ? "what's dropping" : "merch & exclusives"}</h2>
        {exclusives > 0 && (
          <div className="app-card__action">
            <span className="ev-chip" data-tone="rose">
              {exclusives} exclusive{exclusives === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>
      <ul className="ev-mgrid">
        {shown.map((g) => (
          <MerchCard key={g.id} item={g} where={false} />
        ))}
      </ul>
      {goods.length > MERCH_SHOWN && (
        <button type="button" className="ev-more-button" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "show fewer" : `see all ${goods.length}`}
        </button>
      )}
    </section>
  );
}

// ---------- everything else, folded ----------
function More({ id, icon, title, detail, children, openId }) {
  const ref = useRef(null);
  useEffect(() => {
    if (openId?.id === id && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [openId, id]);
  return (
    <li className="ev-more-row">
      <details className="ev-more" id={`ev-more-${id}`} ref={ref}>
        <summary className="ev-more__head">
          <span className="app-row__icon ev-more__icon" aria-hidden="true">
            <Glyph name={icon} size={18} />
          </span>
          <span className="ev-more__title">{title}</span>
          <span className="ev-more__detail">{detail ?? ""}</span>
          <span className="ev-more__chevron" aria-hidden="true" />
        </summary>
        <div className="ev-more__body">{children}</div>
      </details>
    </li>
  );
}

function Days({ item, now }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
  if (!item.days?.length)
    return (
      <>
        <p className="ev-prose">{item.datesTbc ? "not announced yet." : dateRange(item, { now, withYear: true })}</p>
        {item.datesNote?.text && <p className="ev-prose ev-prose--small">{item.datesNote.text}</p>}
        <Sourced item={item} ids={ids(item.datesNote)} />
      </>
    );
  return (
    <>
      <ul className="ev-days">
        {item.days.map((d, i) => (
          <li key={d.date} className="ev-day" data-today={d.date === today ? "" : undefined} data-past={d.date < today ? "" : undefined}>
            <span className="ev-day__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="ev-day__text">
              <span>
                {dayLabel(d.date)}
                {d.date === today && <span className="ev-today"> · today</span>}
              </span>
              {d.note && <small>{d.note}</small>}
            </span>
            <span className="ev-day__hours">{hours(d)}</span>
          </li>
        ))}
      </ul>
      <Sourced item={item} ids={item.days.map((d) => d.sourceId)} />
    </>
  );
}

function GettingThere({ item }) {
  const v = item.venue;
  const maps = mapsLinks(v);
  return (
    <>
      <div className="ev-venue">
        <strong>{[v.name, v.hall].filter(Boolean).join(", ")}</strong>
        {v.address && <span className="ev-venue__address">{v.address}</span>}
      </div>
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
      <Sourced item={item} ids={[...ids(v), ...(v.directions ?? []).map((d) => d.sourceId)]} />
    </>
  );
}

function TicketsMore({ item }) {
  const t = item.tickets ?? {};
  const tiers = t.tiers ?? [];
  return (
    <>
      {t.note?.text && <p className="ev-prose ev-prose--small">{t.note.text}</p>}
      {tiers.length > 0 && (
        <ul className="ev-tiers">
          {tiers.map((tier) => {
            const chip = tierChip(tier.status);
            return (
              <li key={tier.name} className="ev-tier" data-status={tier.status}>
                <span className="ev-tier__text">
                  <span>{tier.name}</span>
                  {tier.note && <small>{tier.note}</small>}
                </span>
                <span className="ev-tier__right">
                  <span className="ev-tier__price">{tier.priceLabel ?? (tier.price === 0 ? "free" : "tbc")}</span>
                  {chip && tier.status !== "on_sale" && <Chips chips={[chip]} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {t.url && (
        <a className="ev-button" href={t.url} target="_blank" rel="noopener noreferrer">
          <Glyph name="ticket" size={18} /> tickets on {siteOf(t.url)}
        </a>
      )}
      <Sourced item={item} ids={[...ids(t.note), ...tiers.flatMap(ids)]} />
    </>
  );
}

function Guests({ item }) {
  return (
    <>
      <ul className="ev-guests">
        {item.guests.map((g) => (
          <li key={g.name}>
            <span className="ev-guests__name">{g.name}</span>
            <small>{[g.role, g.day ? dayLabel(g.day) : null, g.note].filter(Boolean).join(" · ")}</small>
          </li>
        ))}
      </ul>
      <Sourced item={item} ids={item.guests.flatMap(ids)} />
    </>
  );
}

function Bullets({ item, list, sourced = true }) {
  return (
    <>
      <ul className="ev-tips">
        {list.map((tip) => (
          <li key={tip.text}>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
      {sourced && <Sourced item={item} ids={list.flatMap(ids)} />}
    </>
  );
}

function Timeline({ item }) {
  return (
    <ol className="ev-timeline">
      {item.timeline.map((s) => (
        <li key={s.stage} className="ev-step" data-state={s.state}>
          <span className="ev-step__dot" aria-hidden="true" />
          <div className="ev-step__body">
            <span className="ev-step__label">
              {s.title}
              {s.at && /^\d{4}-\d{2}-\d{2}/.test(s.at) && <span className="ev-step__date"> · {dayNumber(s.at.slice(0, 10))} {monthShort(s.at.slice(0, 10))}</span>}
              {s.state === "now" && <span className="ev-step__now"> now</span>}
            </span>
            {s.text ? (
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
              <span className="ev-step__text ev-step__text--waiting">{s.state === "next" ? "coming" : s.state === "unknown" ? "not yet" : ""}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function UpdateLog({ item, unseen }) {
  return (
    <ol className="ev-log">
      {item.updates.map((u) => (
        <li key={u.id} data-new={unseen.has(u.id) ? "" : undefined}>
          <span className="ev-log__when">
            {ago(u.at)}
            {unseen.has(u.id) && <NewMark newness="new" />}
          </span>
          <strong>{u.title}</strong>
          {u.text && <p>{u.text}</p>}
          {u.sourceId && <SourceLink item={item} id={u.sourceId} />}
        </li>
      ))}
    </ol>
  );
}

const SOURCE_KIND = { official: "official", venue: "venue", ticketing: "tickets", news: "article", listing: "listing", social: "social", newsletter: "newsletter", owner: "from josh" };

function LinksAndSources({ item }) {
  const links = (item.links ?? []).filter((l) => l.kind !== "map");
  const sources = item.sources ?? [];
  return (
    <>
      {links.length > 0 && (
        <ul className="ev-linklist">
          {links.map((link) => (
            <li key={`${link.kind}-${link.url}`}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <Glyph name={link.kind === "tickets" ? "ticket" : "link"} size={18} />
                <span className="ev-linklist__text">
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
    </>
  );
}

function Weather({ item }) {
  const w = item.weather;
  return (
    <>
      {w.now && (
        <p className="ev-weather-now">
          <Glyph name={w.now.icon} size={22} /> right now near {w.now.area}: {w.now.forecast.toLowerCase()}
        </p>
      )}
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
          </li>
        ))}
      </ul>
      {w.note && <p className="ev-prose ev-prose--small">{w.note}</p>}
      <p className="ev-sourced">
        <span className="ev-sourced__label">
          {w.label}
          {w.fetchedAt ? ` · updated ${ago(w.fetchedAt)}` : ""}
        </span>
        <span className="ev-credit">{w.credit}</span>
      </p>
    </>
  );
}

function Folded({ item, now, unseen, openId }) {
  const rows = [];
  const t = item.tickets;
  if (item.like?.text || item.highlights?.length > HIGHLIGHTS_SHOWN || item.size?.text || item.popup)
    rows.push(
      <More key="about" id="about" icon="info" title="what it’s like" openId={openId}>
        {item.like?.text && <p className="ev-prose">{item.like.text}</p>}
        {item.popup?.about?.text && <p className="ev-prose">{item.popup.about.text}</p>}
        {item.popup?.sold?.length > 0 && <Bullets item={item} list={item.popup.sold} sourced={false} />}
        {item.highlights?.length > HIGHLIGHTS_SHOWN && <Bullets item={item} list={item.highlights.slice(HIGHLIGHTS_SHOWN)} sourced={false} />}
        {item.size?.text && <p className="ev-prose ev-prose--small">{item.size.text}</p>}
        <Sourced item={item} ids={[...ids(item.like), ...ids(item.popup?.about), ...(item.popup?.sold ?? []).flatMap(ids), ...(item.highlights ?? []).slice(HIGHLIGHTS_SHOWN).flatMap(ids), ...ids(item.size)]} />
      </More>,
    );
  if (item.days?.length > 1 || item.datesNote?.text || item.days?.some((d) => d.note))
    rows.push(
      <More key="days" id="days" icon="clock" title="days & hours" detail={item.days?.length > 1 ? `${item.days.length} days` : null} openId={openId}>
        <Days item={item} now={now} />
      </More>,
    );
  if (item.venue?.address || item.venue?.directions?.length)
    rows.push(
      <More key="where" id="where" icon="route" title="getting there" detail={item.venue?.directions?.length > 1 ? `${item.venue.directions.length} ways` : null} openId={openId}>
        <GettingThere item={item} />
      </More>,
    );
  if (t?.tiers?.length || t?.note?.text)
    rows.push(
      <More key="tickets" id="tickets" icon="ticket" title="ticket prices" detail={t.tiers?.length ? `${t.tiers.length}` : null} openId={openId}>
        <TicketsMore item={item} />
      </More>,
    );
  if (item.guests?.length)
    rows.push(
      <More key="guests" id="guests" icon="people" title="guests" detail={`${item.guests.length}`} openId={openId}>
        <Guests item={item} />
      </More>,
    );
  if (item.tips?.length)
    rows.push(
      <More key="tips" id="tips" icon="tips" title="tips for the day" detail={`${item.tips.length}`} openId={openId}>
        <Bullets item={item} list={item.tips} />
      </More>,
    );
  if (item.weather?.days?.length > 1 || item.weather?.now)
    rows.push(
      <More key="weather" id="weather" icon={item.weather.days?.[0]?.icon ?? "cloudy"} title="weather, day by day" openId={openId}>
        <Weather item={item} />
      </More>,
    );
  if (item.timeline?.length)
    rows.push(
      <More key="timeline" id="timeline" icon="route" title="timeline" detail={item.timeline.find((s) => s.state === "now" || s.state === "next")?.title ?? null} openId={openId}>
        <Timeline item={item} />
      </More>,
    );
  if (item.updates?.length)
    rows.push(
      <More key="updates" id="updates" icon="history" title="what changed" detail={`${item.updates.length}`} openId={openId}>
        <UpdateLog item={item} unseen={unseen} />
      </More>,
    );
  if (item.links?.length || item.sources?.length)
    rows.push(
      <More key="sources" id="sources" icon="link" title="links & sources" detail={item.sources?.length ? `${item.sources.length}` : null} openId={openId}>
        <LinksAndSources item={item} />
      </More>,
    );
  if (!rows.length) return null;
  return (
    <section className="ev-folded" aria-label="More about it">
      <h2 className="app-group-title">more about it</h2>
      <ul className="app-list ev-more-list">{rows}</ul>
    </section>
  );
}

// ---------- the page ----------
export default function EventPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const from = BACK[location.state?.from] ?? BACK.home;
  const back = useAppBack(from.to);
  const { item, isPending, isError, missing, gone, movedTo, refetch } = useEvent(id);
  const now = useNow(60_000);
  const [openId, setOpenId] = useState(null);
  // What she hadn't seen when the page opened stays marked for this visit.
  const unseen = useRef(null);
  if (item?.full && unseen.current === null) unseen.current = new Set(item.updates.filter((u) => u.unseen).map((u) => u.id));
  useMarkLooked(id, { enabled: Boolean(item?.full), delay: 1500 });
  useEffect(() => {
    if (item?.name) document.title = `${displayName(item.name)} ♡`;
  }, [item?.name]);
  // An id folded into another event: show that one, under its own address (no new history entry).
  useEffect(() => {
    if (movedTo) navigate(`/world/events/${encodeURIComponent(movedTo)}${location.hash}`, { replace: true, state: location.state });
  }, [movedTo, navigate, location.hash, location.state]);
  // Old links to a section (#merch, #tickets, #updates) open that part.
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (!item?.full || !hash) return;
    if (hash === "merch") document.getElementById("merch")?.scrollIntoView({ block: "start" });
    else setOpenId({ id: hash, at: Date.now() });
  }, [item?.full, location.hash]);

  const name = item ? handSafe(displayName(item.name)) : "";
  const head = (title) => (
    <header className="app-section__head">
      <button type="button" className="app-screen__back" onClick={back}>
        {from.label}
      </button>
      <h1 className="app-section__title ev-page__title" data-length={titleLength(title) || undefined} data-short={title || "event"}>
        {title}
      </h1>
      {item && (
        <div className="app-section__actions">
          <PasteLink event={item} compact />
        </div>
      )}
      {item?.tagline && <p className="app-section__subtitle ev-page__tagline">{item.tagline}</p>}
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
              <p>{isError ? "check your connection and try again." : missing ? "it may have been cancelled or taken off the list." : ""}</p>
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
  const open = (target) => (target === "merch" ? document.getElementById("merch")?.scrollIntoView({ block: "start", behavior: "smooth" }) : setOpenId({ id: target, at: Date.now() }));
  return (
    <div className="app-screen ev-page" data-kind={item.kind}>
      {head(name)}
      <div className="app-section__body">
        {gone && (
          <p className="ev-gone" role="status">
            <Glyph name="info" size={18} /> this one has come off the list since you opened it. what you see is how it last looked.
          </p>
        )}
        <Glance item={item} now={now} />
        <Actions item={item} />
        <SinceYouLooked item={item} updates={updates} />
        {item.full ? (
          <>
            <Gist item={item} open={open} />
            <MerchGrid item={item} />
            <Folded item={item} now={now} unseen={fresh} openId={openId} />
          </>
        ) : isError ? (
          <div className="app-card ev-trouble">
            <p>the rest of this page couldn’t load just now.</p>
            <button type="button" className="ev-pill-link" onClick={() => refetch()}>
              try again
            </button>
          </div>
        ) : !gone ? (
          <div className="ev-skeleton" aria-hidden="true">
            <div className="ev-skeleton__rows">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>
      <Toaster />
    </div>
  );
}
