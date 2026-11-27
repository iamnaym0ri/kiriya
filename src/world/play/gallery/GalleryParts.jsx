// Little pieces the gallery's card, screen and viewer share.

const KIND_ICONS = {
  doodle: (
    <path d="M5 17.5 15.8 6.7a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 20.5l-3.6.9.6-3.9Z M14 8.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  ),
  kaleidoscope: (
    <g fill="currentColor">
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="12" cy="6.6" rx="2.6" ry="4.4" transform={`rotate(${r} 12 12)`} opacity={r % 120 ? 0.55 : 0.95} />
      ))}
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  doll: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.4" r="3.6" />
      <path d="M9.6 11.6 6 20h12l-3.6-8.4M9 14.5h6" />
    </g>
  ),
  colouring: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 20.5C7 17 3.5 13.6 3.5 9.6 3.5 6.6 5.8 4.5 8.4 4.5c1.6 0 2.8.8 3.6 2 .8-1.2 2-2 3.6-2 2.6 0 4.9 2.1 4.9 5.1 0 4-3.5 7.4-8.5 10.9Z" />
      <path d="M12 6.5c-.9 3 1.8 5.4.4 8.2-.6 1.4-.4 3.6-.4 5.8C7 17 3.5 13.6 3.5 9.6 3.5 6.6 5.8 4.5 8.4 4.5c1.6 0 2.8.8 3.6 2Z" fill="currentColor" opacity="0.55" />
    </g>
  ),
  bouquet: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="2.6" />
      <circle cx="15" cy="6.4" r="2.6" />
      <circle cx="12" cy="10.4" r="2.6" />
      <path d="M7.6 12.6 12 21l4.4-8.4M10 16h4" />
    </g>
  ),
};

export function KindIcon({ kind, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {KIND_ICONS[kind] ?? KIND_ICONS.doodle}
    </svg>
  );
}

/** The tiny kind badge in a tile's corner (nothing for plain doodles: they're most of them). */
export function KindMark({ kind }) {
  if (kind === "doodle") return null;
  return (
    <span className="gallery-tile__kind" aria-hidden="true">
      <KindIcon kind={kind} size={13} />
    </span>
  );
}

/** A little sealed letter: Josh left a note on this one. */
export function LetterIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="3" y="6" width="18" height="13" rx="2.6" fill="#fffafd" stroke="#b23d6e" strokeWidth="1.8" />
      <path d="M4 7.5 12 13l8-5.5" fill="none" stroke="#b23d6e" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 17.2c-2.4-1.5-3.2-2.7-2.6-3.6.5-.7 1.6-.6 2.6.4 1-1 2.1-1.1 2.6-.4.6.9-.2 2.1-2.6 3.6Z" fill="#e0457b" />
    </svg>
  );
}

/** A pin: this piece is on her public profile. */
export function PinIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5Zm3 8.5v8.5" />
    </svg>
  );
}

/** "27 nov 2026" for a saved date, in Singapore time like the rest of the site. */
export function savedOn(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" }).format(date).toLowerCase();
}
