// Small pieces every events & merch screen shares: the hand-drawn kind doodles, date tiles,
// status chips, the save heart, "new" marks, source links and the live countdown.
import { memo, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import {
  chipsFor,
  dayNumber,
  displayName,
  kindLabel,
  merchChips,
  merchPrice,
  monthShort,
  phaseOf,
  siteOf,
  splitDuration,
  whenLabel,
} from "./eventFormat.js";
import { eventPath, merchPath, useIsSaved, useNewness, useToggleSave } from "./eventsData.js";

// ---------- the clock ----------
/** The time now, refreshed every `ms` while the page is visible (and at once when it comes back). */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = null;
    const tick = () => setNow(new Date());
    const start = () => {
      clearInterval(timer);
      // Line the ticks up with the clock's own seconds/minutes so digits change together.
      const wait = ms - (Date.now() % ms);
      timer = setTimeout(() => {
        tick();
        timer = setInterval(tick, ms);
      }, wait);
    };
    const visibility = () => {
      if (document.hidden) clearInterval(timer), clearTimeout(timer);
      else tick(), start();
    };
    start();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ms]);
  return now;
}

// ---------- hand-drawn kind doodles ----------
const DOODLES = {
  con: (
    <>
      <path d="M7.5 15.2c0-1.5 1.1-2.6 2.6-2.6h28c1.5 0 2.5 1.1 2.5 2.6v4.3a4.4 4.4 0 0 0 .1 8.8v4.4c0 1.4-1.1 2.6-2.6 2.6H10.1c-1.5 0-2.6-1.2-2.6-2.6v-4.4a4.4 4.4 0 0 0 0-8.8z" />
      <path d="M31.4 13.4v21.2" strokeDasharray="1.6 3.2" />
      <path d="m19.6 18.2 1.6 3.5 3.8.4-2.9 2.5.9 3.8-3.4-2-3.3 2 .8-3.8-2.8-2.5 3.8-.4z" />
    </>
  ),
  fair: (
    <>
      <path d="M8.3 19.6c3-5.3 7.7-8.4 15.6-8.5 8 0 12.7 3.2 15.8 8.6" />
      <path d="M8.3 19.6c.1 2.7 2.4 4.4 4.9 4.4 2.6 0 4.7-1.8 4.8-4.4.2 2.6 2.4 4.4 5 4.4s4.8-1.8 4.9-4.4c.2 2.6 2.4 4.4 5 4.4s4.6-1.7 4.8-4.4" />
      <path d="M11.4 24v14.8M36.8 24.2v14.6M8.6 39.2c10-.5 20.4-.5 31 0" />
      <path d="M17 31.5h14.3v7.4" />
      <path d="M23.9 6.4v4.7" />
    </>
  ),
  popup: (
    <>
      <path d="M11.6 17.1c8.3-.6 16.6-.6 24.9 0l-1.8 22c-7.2.5-14.2.5-21.3 0z" />
      <path d="M18.3 17c-.2-4.6 2.2-8 5.7-8s6 3.4 5.8 8" />
      <path d="M24 33.4s-5.2-3.2-5.2-6.4c0-1.7 1.3-2.9 2.8-2.9 1.1 0 1.9.6 2.4 1.5.5-.9 1.3-1.5 2.4-1.5 1.5 0 2.8 1.2 2.8 2.9 0 3.2-5.2 6.4-5.2 6.4z" />
      <path d="M38.6 8.6v4.6M36.3 10.9h4.6" />
    </>
  ),
  cafe: (
    <>
      <path d="M10.3 21.4c7.6-.4 15.3-.4 23 0-.2 8-3.6 14.6-11.5 14.7-7.9 0-11.3-6.7-11.5-14.7z" />
      <path d="M33.1 23.6c3.6-.5 5.8 1.1 5.6 3.6-.2 2.6-2.6 4.1-6.7 4.1" />
      <path d="M9 39.4c8.8.5 17 .5 25.8 0" />
      <path d="M18.6 16.6c-1.6-2-1.2-3.7.4-5.4M24.8 16.2c-1.6-2.3-1-4.4.7-6.6" />
    </>
  ),
  concert: (
    <>
      <path d="M19.4 33.8V13.6c5.4-1.3 10.8-2.5 16.2-3.4v19.6" />
      <ellipse cx="15.6" cy="34" rx="4.2" ry="3.4" transform="rotate(-12 15.6 34)" />
      <ellipse cx="31.8" cy="30.1" rx="4.2" ry="3.4" transform="rotate(-12 31.8 30.1)" />
      <path d="M19.6 19.4c5.3-1.3 10.6-2.4 16-3.3" />
      <path d="M8.4 11.2l2.4 1M9.6 6.8l1.4 2.4" />
    </>
  ),
  merch: (
    <>
      <path d="M9.8 20.3c9.5-.5 19-.5 28.5 0v18.4c-9.5.6-19 .6-28.5 0z" />
      <path d="M8.3 15.3c10.5-.6 21-.6 31.4 0v5.1c-10.5.5-21 .5-31.4 0z" />
      <path d="M24 15.4v23.8" />
      <path d="M24 15.2c-2.6-5.2-8.6-6.5-9.4-3.4-.7 2.8 4.4 3.4 9.4 3.4zM24 15.2c2.6-5.2 8.6-6.5 9.4-3.4.7 2.8-4.4 3.4-9.4 3.4z" />
    </>
  ),
};

export const KindDoodle = memo(function KindDoodle({ kind, size = 28, className = "" }) {
  return (
    <svg className={`ev-doodle ${className}`} width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {DOODLES[kind] ?? DOODLES.con}
    </svg>
  );
});

// ---------- date tile ----------
/** A little torn-calendar tile: the month over the day, or "now" / "tbc". */
export function DateTile({ item, now }) {
  const p = phaseOf(item, now);
  let top = "";
  let big = "";
  let tone = "plain";
  if (p.phase === "tbc") (top = "date"), (big = "tbc"), (tone = "soft");
  else if (p.phase === "open" || p.phase === "between") (top = item.kind === "merch" ? "out" : "on"), (big = "now"), (tone = "live");
  else if (p.phase === "cancelled") (top = "sorry"), (big = "off"), (tone = "soft");
  else {
    const at = p.next ?? p.endedAt ?? (item.kind === "merch" ? item.drop?.dropAt : item.startsAt);
    if (at) (top = monthShort(at)), (big = dayNumber(at));
    if (p.phase === "ended" || p.phase === "sold_out") tone = "soft";
  }
  return (
    <span className="ev-tile" data-tone={tone} aria-hidden="true">
      <span className="ev-tile__top">{top}</span>
      <span className="ev-tile__big">{big}</span>
    </span>
  );
}

// ---------- chips ----------
export function Chips({ chips, className = "" }) {
  if (!chips?.length) return null;
  return (
    <span className={`ev-chips ${className}`}>
      {chips.map((chip) => (
        <span key={chip.label} className="ev-chip" data-tone={chip.tone}>
          {chip.label}
        </span>
      ))}
    </span>
  );
}

export function ItemChips({ item, now, live = true, max = 2 }) {
  return <Chips chips={chipsFor(item, now, { live }).slice(0, max)} />;
}

/** "new" or "updated", as a small rosy tag. */
export function NewMark({ newness }) {
  if (!newness) return null;
  return <span className="ev-new">{newness === "new" ? "new" : "updated"}</span>;
}

// ---------- a small toast above the tab bar ----------
const toast = { text: null, listeners: new Set(), timer: null };
export function showToast(text, ms = 2600) {
  clearTimeout(toast.timer);
  toast.text = text;
  toast.listeners.forEach((l) => l());
  toast.timer = setTimeout(() => {
    toast.text = null;
    toast.listeners.forEach((l) => l());
  }, ms);
}
const subscribeToast = (l) => (toast.listeners.add(l), () => toast.listeners.delete(l));
/** Mounted once per screen; shows whatever showToast() said last. */
export function Toaster() {
  const text = useSyncExternalStore(subscribeToast, () => toast.text, () => null);
  return (
    <div className="ev-toast" role="status" aria-live="polite" data-shown={text ? "" : undefined}>
      {text}
    </div>
  );
}

// ---------- save ----------
const HEART = "M12 20.3s-7.6-4.7-8.6-9.6C2.7 7.4 4.6 4.8 7.4 4.6c2-.2 3.6 1 4.6 2.6 1-1.6 2.6-2.8 4.6-2.6 2.8.2 4.7 2.8 4 6.1-1 4.9-8.6 9.6-8.6 9.6z";
const onPreview = () => showToast("her saves are hers: this is a preview ♡");

/**
 * The save heart for an event, or a merch piece with `merch`. `labelled` adds a word under it (the
 * event page's actions); otherwise it's a round 44pt button.
 */
export function SaveButton({ item, merch = false, labelled = false, className = "" }) {
  const isSaved = useIsSaved();
  const toggle = useToggleSave({ onPreview });
  const saved = isSaved(item);
  const [pop, setPop] = useState(false);
  const label = saved ? `Saved: ${item.name}. Tap to unsave` : `Save ${item.name}`;
  return (
    <button
      type="button"
      className={`ev-save ${labelled ? "ev-action" : ""} ${className}`.trim()}
      aria-pressed={saved}
      aria-label={labelled ? undefined : label}
      data-pop={pop ? "" : undefined}
      onAnimationEnd={() => setPop(false)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!saved) setPop(true);
        toggle.mutate({ thing: item, saved: !saved, merch });
      }}
    >
      <span className="ev-save__icon">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={HEART} fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      {labelled && <span className="ev-action__label">{saved ? "saved" : "save"}</span>}
    </button>
  );
}

// ---------- sources ----------
/** "↗ AFA Singapore": where a claim comes from. Opens the source page (Safari in the app). */
export function SourceLink({ item, id, prefix = "" }) {
  const source = item?.sources?.find((s) => s.id === id);
  if (!source) return null;
  return (
    <a className="ev-source" href={source.url} target="_blank" rel="noopener noreferrer">
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M3.2 8.8 8.6 3.4M4.2 3.2h4.6v4.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        {prefix}
        {source.label || siteOf(source.url)}
      </span>
    </a>
  );
}

/** The sources behind a block, deduplicated, on one line at its foot. */
export function Sourced({ item, ids, className = "" }) {
  const unique = [...new Set((ids ?? []).filter(Boolean))].filter((id) => item?.sources?.some((s) => s.id === id));
  if (!unique.length) return null;
  return (
    <p className={`ev-sourced ${className}`}>
      <span className="ev-sourced__label">source{unique.length > 1 ? "s" : ""}</span>
      {unique.map((id) => (
        <SourceLink key={id} item={item} id={id} />
      ))}
    </p>
  );
}

// ---------- countdown ----------
const pad2 = (n) => String(n).padStart(2, "0");

/** The live countdown: days, hours, minutes and seconds to `to`. `inline`: one small line. */
export function Countdown({ to, label, compact = false, inline = false }) {
  const now = useNow(1000);
  const { days, hours, minutes, seconds } = splitDuration(to.getTime() - now.getTime());
  if (inline) {
    const parts = [days ? [days, "d"] : null, [days ? pad2(hours) : hours, "h"], [pad2(minutes), "m"], days ? null : [pad2(seconds), "s"]].filter(Boolean);
    return (
      <span className="ev-count-inline" role="timer" aria-label={`${label ? `${label} ` : ""}${days} days, ${hours} hours and ${minutes} minutes`}>
        {parts.map(([value, unit]) => (
          <span key={unit} aria-hidden="true">
            {value}
            <small>{unit}</small>
          </span>
        ))}
      </span>
    );
  }
  const units = [
    { value: days, unit: days === 1 ? "day" : "days" },
    { value: hours, unit: hours === 1 ? "hr" : "hrs" },
    { value: minutes, unit: "min" },
    { value: seconds, unit: "sec" },
  ];
  const spoken = `${label ? `${label} ` : ""}${days} days, ${hours} hours and ${minutes} minutes`;
  return (
    <div className={`ev-count ${compact ? "ev-count--compact" : ""}`} role="timer" aria-label={spoken}>
      {units.map(({ value, unit }, i) => (
        <span key={unit.slice(0, 1)} className="ev-count__unit" aria-hidden="true">
          <span className="ev-count__value">{i === 0 ? value : pad2(value)}</span>
          <span className="ev-count__label">{unit}</span>
        </span>
      ))}
    </div>
  );
}

// ---------- rows ----------
/** Where a pushed page should say "back" to. */
export function useFrom() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/world/events/merch/")) return "piece";
  if (pathname.startsWith("/world/events/merch")) return "merch";
  if (/^\/world\/events\/[^/]+/.test(pathname)) return "event";
  return pathname.startsWith("/world/events") ? "events" : pathname.startsWith("/world/saves") ? "saved" : "home";
}

/** One event as a row: date tile, name, where and when, chips; opens its page. */
export function EventRow({ item, now, save = false, showNew = true }) {
  const newness = useNewness();
  const from = useFrom();
  const fresh = showNew ? newness(item) : null;
  const where = item.venue?.name;
  return (
    <li className="app-row ev-row" data-ended={["ended", "sold_out", "cancelled"].includes(phaseOf(item, now).phase) ? "" : undefined}>
      <Link className="ev-row__link" to={eventPath(item.id)} state={{ from }}>
        <DateTile item={item} now={now} />
        <span className="ev-row__text">
          <span className="ev-row__name">
            {displayName(item.name)}
            {fresh && <NewMark newness={fresh} />}
          </span>
          <small className="ev-row__meta">{[where, kindLabel(item.kind)].filter(Boolean).join(" · ")}</small>
          <span className="ev-row__foot">
            <span className="ev-row__when">{whenLabel(item, now)}</span>
            <ItemChips item={item} now={now} live={false} />
          </span>
        </span>
        {!save && <span className="ev-chevron" aria-hidden="true" />}
      </Link>
      {save && <SaveButton item={item} />}
    </li>
  );
}

/** A merch piece as a row: picture, name, price, where; opens the piece's own page. */
export function MerchRow({ item, save = true }) {
  const from = useFrom();
  const event = item.event ?? {};
  return (
    <li className="app-row ev-row ev-merch-row">
      <Link className="ev-row__link" to={merchPath(item.id)} state={{ from }}>
        <span className="ev-merch-row__art" aria-hidden="true">
          {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : <KindDoodle kind="merch" size={26} />}
        </span>
        <span className="ev-row__text">
          <span className="ev-row__name">{item.name}</span>
          <small className="ev-row__meta">{[displayName(event.name), event.dateLabel].filter(Boolean).join(" · ")}</small>
          <span className="ev-row__foot">
            {item.priceLabel && <span className="ev-row__when">{item.priceLabel}</span>}
            <Chips chips={merchChips(item).slice(0, 2)} />
          </span>
        </span>
        {!save && <span className="ev-chevron" aria-hidden="true" />}
      </Link>
      {save && <SaveButton item={item} merch />}
    </li>
  );
}

/**
 * A merch piece as a picture card (grids and strips): picture, name, price and where. Opens the
 * piece's own page; `where` adds the event's name under it.
 */
export function MerchCard({ item, where = true, save = true }) {
  const from = useFrom();
  const event = item.event ?? {};
  const chips = merchChips(item).slice(0, 2);
  return (
    <li className="ev-mcard" data-sold={item.status === "sold_out" ? "" : undefined}>
      <Link className="ev-mcard__link" to={merchPath(item.id)} state={{ from, title: item.name }}>
        <span className="ev-mcard__art">
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="ev-mcard__doodle" aria-hidden="true">
              <KindDoodle kind="merch" size={40} />
            </span>
          )}
          {item.images?.length > 1 && <span className="ev-mcard__count" aria-label={`${item.images.length} pictures`}>{item.images.length}</span>}
          {chips[0] && (
            <span className="ev-mcard__badge" data-tone={chips[0].tone}>
              {chips[0].label}
            </span>
          )}
        </span>
        <span className="ev-mcard__name">{item.name}</span>
        <span className="ev-mcard__price">{merchPrice(item)}</span>
        {where && (event.name || item.where) && <span className="ev-mcard__where">{displayName(event.name) || item.where}</span>}
      </Link>
      {save && <SaveButton item={item} merch className="ev-mcard__save" />}
    </li>
  );
}
