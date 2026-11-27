import { Link } from "react-router";
import { useAppBack } from "../../shared/AppFrame.jsx";
import { useIsAdmin } from "../../lib/session.js";

// The building blocks of her tab: rows in the frame's inset grouped lists (.app-list / .app-row,
// src/styles/app-shell.css), little hand-drawn icons in tinted tiles, a lilac switch, and the
// pushed screen around every setting.

const ICONS = {
  icon: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM12 8.2l1.1 2.4 2.5.3-1.9 1.7.6 2.5-2.3-1.3-2.3 1.3.6-2.5-1.9-1.7 2.5-.3z",
  friend: "M12 4.5c3.6 0 6 2.6 6 6.1 0 3.9-2.9 7.9-6 7.9s-6-4-6-7.9c0-3.5 2.4-6.1 6-6.1zM6.6 8.1 5 4.6l3.7 1.6M17.4 8.1 19 4.6l-3.7 1.6M9.6 11.4h.01M14.4 11.4h.01M10.6 14.2c.8.6 2 .6 2.8 0",
  bell: "M12 4.2c-3 0-5 2.3-5 5.2v3.1l-1.6 2.6h13.2L17 12.5V9.4c0-2.9-2-5.2-5-5.2zM10 18.2c.4 1 1.1 1.6 2 1.6s1.6-.6 2-1.6",
  sparkle: "M12 3.8c.5 3.4 1.8 5.4 5.4 6.2-3.6.8-4.9 2.8-5.4 6.2-.5-3.4-1.8-5.4-5.4-6.2 3.6-.8 4.9-2.8 5.4-6.2zM18.2 15.4c.2 1.4.8 2.1 2.1 2.4-1.3.3-1.9 1-2.1 2.4-.2-1.4-.8-2.1-2.1-2.4 1.3-.3 1.9-1 2.1-2.4z",
  page: "M6.5 4h11a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4zM12 8.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8.6 16.4c.6-1.6 1.9-2.4 3.4-2.4s2.8.8 3.4 2.4",
  eye: "M3.5 12s3.1-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3.1 5.5-8.5 5.5S3.5 12 3.5 12zM12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z",
  music: "M9.5 17.2V6.6l9-2v10.3M9.5 17.2a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0zM18.5 14.9a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0zM9.5 9.4l9-2",
  heart: "M12 19s-6.8-4.1-7.9-8.4C3.3 7.5 5.4 5.2 8 5.6c1.7.2 2.9 1.4 4 2.9 1.1-1.5 2.3-2.7 4-2.9 2.6-.4 4.7 1.9 3.9 5C18.8 14.9 12 19 12 19z",
  speech: "M5.2 5.5h13.6a1.2 1.2 0 0 1 1.2 1.2v8.1a1.2 1.2 0 0 1-1.2 1.2H11l-4.2 3.3V16H5.2A1.2 1.2 0 0 1 4 14.8V6.7a1.2 1.2 0 0 1 1.2-1.2zM8 9.6h8M8 12.4h5",
  bookmark: "M7.2 4.2h9.6a1 1 0 0 1 1 1v14.4L12 15.8l-5.8 3.8V5.2a1 1 0 0 1 1-1z",
  bag: "M5.6 8.4h12.8l-.9 11H6.5zM9 10.6V7.4a3 3 0 0 1 6 0v3.2",
  letter: "M4.5 6.5h15v11h-15zM4.5 6.8l7.5 5.8 7.5-5.8",
  photo: "M5 6.5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM4.5 15.6l4.2-3.9 3.3 3 2.6-2.2 4.9 4M15.6 9.6h.01",
  key: "M8.6 14.9a3.9 3.9 0 1 1 2.9-6.5 3.9 3.9 0 0 1-2.9 6.5zM11.6 12.5l7.9-.1M16.6 12.4v2.6M19.2 12.4v2",
  phones: "M8 3.8h6.4a1.2 1.2 0 0 1 1.2 1.2v13.9a1.2 1.2 0 0 1-1.2 1.2H8a1.2 1.2 0 0 1-1.2-1.2V5A1.2 1.2 0 0 1 8 3.8zM10.4 17.1h1.6M17.6 9.2l2.4 2.6-2.4 2.6M20 11.8h-4",
  palette: "M12 4.2c-4.6 0-8 3.2-8 7.4 0 4 3.1 7.2 7.2 7.2 1.3 0 1.9-.8 1.6-1.8-.3-1-.1-2 1.2-2h2.2c2.1 0 3.8-1.6 3.8-3.6 0-4-3.6-7.2-8-7.2zM8.2 11.2h.01M10.4 8h.01M14.2 8h.01M16.4 11h.01",
  lock: "M7 10.6h10a1 1 0 0 1 1 1v7.2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7.2a1 1 0 0 1 1-1zM8.8 10.6V8a3.2 3.2 0 0 1 6.4 0v2.6M12 14.2v2",
  flower: "M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM12 9.6c-1.2-2.2-.6-4.6 0-5.4.6.8 1.2 3.2 0 5.4zM14.4 12c2.2-1.2 4.6-.6 5.4 0-.8.6-3.2 1.2-5.4 0zM12 14.4c1.2 2.2.6 4.6 0 5.4-.6-.8-1.2-3.2 0-5.4zM9.6 12c-2.2 1.2-4.6.6-5.4 0 .8-.6 3.2-1.2 5.4 0z",
  home: "M4.6 11.4 12 5.2l7.4 6.2M6.6 9.8v8.9h4.2v-4.6h2.4v4.6h4.2V9.8M15.6 4.6l2.8 2.8",
  note: "M6 4.5h9l3 3V19a.6.6 0 0 1-.6.6H6a.6.6 0 0 1-.6-.6V5.1A.6.6 0 0 1 6 4.5zM8.4 10h7.2M8.4 13h7.2M8.4 16h4.4",
  jar: "M8.4 4.6h7.2v2.2H8.4zM7.6 6.8h8.8c1 1 1.6 2.2 1.6 3.6v7.4a1.8 1.8 0 0 1-1.8 1.8H7.8A1.8 1.8 0 0 1 6 17.8v-7.4c0-1.4.6-2.6 1.6-3.6zM10.2 13.6c.3-.9 1.1-.9 1.8 0 .7-.9 1.5-.9 1.8 0 .3.9-1 1.9-1.8 2.4-.8-.5-2.1-1.5-1.8-2.4z",
  brush: "M14.5 5.5l4 4-6.8 6.8-4-4zM7.7 12.3c-2 .3-2.7 2-2.9 3.5-.2 1.4-.8 2.2-1.6 2.6 2.8 1.1 6.4.7 7.4-2.2",
  flask: "M9.6 4.4h4.8M10.4 4.4v5.2l-4.6 8a1.4 1.4 0 0 0 1.2 2.1h10a1.4 1.4 0 0 0 1.2-2.1l-4.6-8V4.4M7.8 14.8h8.4",
  ring: "M12 4.2c-3 0-5 2.3-5 5.2v3.1l-1.6 2.6h13.2L17 12.5V9.4c0-2.9-2-5.2-5-5.2zM10 18.2c.4 1 1.1 1.6 2 1.6s1.6-.6 2-1.6M3.8 8.4c.4-1.8 1.4-3.2 2.8-4.2M20.2 8.4c-.4-1.8-1.4-3.2-2.8-4.2",
  widgets: "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z",
  pen: "M5 18.8c2.2-.2 3.4-1 4.6-2.6l8.2-8.2a1.9 1.9 0 0 0-2.7-2.7l-8.2 8.2C5.4 14.8 5 16.4 5 18.8zM13.6 6.8l2.7 2.7M4.4 20.4h15",
  calendar: "M5.4 6.4h13.2a1 1 0 0 1 1 1v11.2a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1zM4.4 10.4h15.2M8.6 4.4v3.6M15.4 4.4v3.6M10.4 14.6c.3-.9 1.1-.9 1.6 0 .5-.9 1.3-.9 1.6 0 .3.9-.9 1.8-1.6 2.2-.7-.4-1.9-1.3-1.6-2.2z",
  pulse: "M3.6 12.4h3.6l2-4.8 3.4 9.4 2.4-6.2 1.4 1.6h3.8",
  desk: "M4.8 6h14.4a.8.8 0 0 1 .8.8v8.4H4V6.8a.8.8 0 0 1 .8-.8zM2.6 18h18.8M9.6 15.2l-.6 2.8M14.4 15.2l.6 2.8",
  chat: "M5 5.6h14a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1h-7.6l-4.2 3.2v-3.2H5a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1z",
  faceid: "M4.5 8.5v-2a2 2 0 0 1 2-2h2M15.5 4.5h2a2 2 0 0 1 2 2v2M19.5 15.5v2a2 2 0 0 1-2 2h-2M8.5 19.5h-2a2 2 0 0 1-2-2v-2M9 9.4v1.4M15 9.4v1.4M12.2 9.4v3.6h-1M9.6 15.6c1.4 1.1 3.4 1.1 4.8 0",
  sticker: "M6 4.6h9.2L19.4 9v9.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1zM15 4.8v3.4a.8.8 0 0 0 .8.8h3.4M9.2 12.2h.01M14.4 12.2h.01M9.4 15.2c1.4 1.2 3.8 1.2 5.2 0",
};

/** A little hand-drawn line icon. */
export function MeIcon({ name, size = 20 }) {
  return (
    <svg className="me-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name] ?? ICONS.sparkle} />
    </svg>
  );
}

/** The 32 pt tinted tile at the start of a row. Tones: lilac, pink, mint, peach, sky, plum, butter. */
export function RowIcon({ name, tone = "lilac" }) {
  return (
    <span className="app-row__icon me-tile" data-tone={tone}>
      <MeIcon name={name} />
    </span>
  );
}

function RowInside({ icon, tone, label, hint, detail, children }) {
  return (
    <>
      {icon && <RowIcon name={icon} tone={tone} />}
      <span className="app-row__text">
        <span className="me-row__label">{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      {detail != null && detail !== "" && <span className="app-row__detail">{detail}</span>}
      {children}
    </>
  );
}

/**
 * One row. Give it `to` (an in-app link, with a chevron), `href` (leaves the app's sections),
 * `onClick` (an action), or nothing (a row that holds its own control, like a switch).
 */
export function Row({ to, href, onClick, icon, tone, label, hint, detail, danger = false, more, children, state }) {
  const className = `app-row me-row${danger ? " me-row--danger" : ""}${(to || more) && !danger ? " app-row--more" : ""}`;
  const inside = (
    <RowInside icon={icon} tone={tone} label={label} hint={hint} detail={detail}>
      {children}
    </RowInside>
  );
  if (to)
    return (
      <li className={className}>
        <Link to={to} state={state}>
          {inside}
        </Link>
      </li>
    );
  if (href)
    return (
      <li className={className}>
        <a href={href}>{inside}</a>
      </li>
    );
  if (onClick)
    return (
      <li className={className}>
        <button type="button" onClick={onClick}>
          {inside}
        </button>
      </li>
    );
  return <li className={className}>{inside}</li>;
}

/** A row with a lilac switch at its end. The whole row toggles it. */
export function SwitchRow({ icon, tone, label, hint, checked, onChange, disabled = false }) {
  return (
    <li className="app-row me-row me-row--switch">
      <label className="me-row__switch-label">
        {icon && <RowIcon name={icon} tone={tone} />}
        <span className="app-row__text">
          <span className="me-row__label">{label}</span>
          {hint && <small>{hint}</small>}
        </span>
        <input
          type="checkbox"
          role="switch"
          className="me-switch"
          checked={checked}
          disabled={disabled}
          aria-checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    </li>
  );
}

/** A titled group of rows, like an iOS settings section, with an optional footnote under it. */
export function Group({ title, note, children, id }) {
  return (
    <section className="me-group" id={id} aria-label={title}>
      {title && <h2 className="app-group-title">{title}</h2>}
      <ul className="app-list">{children}</ul>
      {note && <p className="me-group__note">{note}</p>}
    </section>
  );
}

/** The tab's own name: "kiriya" on hers, "josh" on his. */
export function useTabName() {
  return useIsAdmin() ? "josh" : "kiriya";
}

/** A screen pushed inside her tab: the frame's back button (with the tab's name) and large title. */
export function Screen({ title, short, subtitle, children, className = "", actions }) {
  const back = useAppBack("/world/me");
  const tab = useTabName();
  return (
    <div className={`app-screen me-screen ${className}`.trim()}>
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          {tab}
        </button>
        <h1 className="app-section__title" data-short={short}>
          {title}
        </h1>
        {actions && <div className="app-section__actions">{actions}</div>}
        {subtitle && <p className="app-section__subtitle">{subtitle}</p>}
      </header>
      <div className="app-section__body">{children}</div>
    </div>
  );
}

/** A short, warm status line under a group ("saved ♡", or what went wrong). */
export function Note({ children, tone = "soft", role = "status" }) {
  if (!children) return null;
  return (
    <p className={`me-note me-note--${tone}`} role={role}>
      {children}
    </p>
  );
}
