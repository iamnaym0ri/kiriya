// Small line icons for the home section, drawn in the site's soft, rounded hand.
const PATHS = {
  chat: <path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9.5 11.2q2.5 1.8 5 0" />,
  note: (
    <>
      <path d="M4 7h16v11H4z" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  letter: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 9h7M8 12.5h8M8 16h5" />
    </>
  ),
  jar: (
    <>
      <path d="M8 4h8M8.5 4v3c-2 1-3 2.2-3 4.5V18a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6.5c0-2.3-1-3.5-3-4.5V4" />
      <path d="M12 16.5c-2.6-1.6-3-3.4-1.6-4.2.7-.4 1.3 0 1.6.5.3-.5.9-.9 1.6-.5 1.4.8 1 2.6-1.6 4.2z" />
    </>
  ),
  quiz: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.8-1.1 1.6v.4M12 16.9v.1" />
    </>
  ),
  song: (
    <>
      <path d="M9 17V6l10-2v11" />
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="16.5" cy="15" r="2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-1 5 3 3H7l3-3z" />
      <path d="M12 11.5V20" />
    </>
  ),
  event: (
    <>
      <path d="M5 6h14v13H5zM5 10h14M9 3.5v4M15 3.5v4" />
      <path d="m12 12.6.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" />
    </>
  ),
  heart: <path d="M12 19.5S4 14.5 4 9.3A4 4 0 0 1 12 8a4 4 0 0 1 8 1.3c0 5.2-8 10.2-8 10.2z" />,
  play: <path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7z" />,
  pause: <path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" />,
  prev: <path d="M15 6 9 12l6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  repeat: <path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3M20 12.5v1a4 4 0 0 1-4 4H4" />,
  close: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  upload: <path d="M12 16V4.5M7 9l5-5 5 5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />,
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="2.5" />
      <path d="M21 10.5v3" />
    </>
  ),
};

export default function HomeIcon({ name, size = 20, className = "", filled = false }) {
  return (
    <svg
      className={`home-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.heart}
    </svg>
  );
}
