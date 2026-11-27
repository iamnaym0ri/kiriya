// The lilac cards' little picture on the luck shelf.
export default function CardsIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="20" y="7" width="22" height="31" rx="4" fill="#c9a8f5" stroke="#4a2f57" strokeWidth="2" transform="rotate(10 31 22)" />
      <rect x="7" y="9" width="22" height="31" rx="4" fill="#fffaf3" stroke="#4a2f57" strokeWidth="2" transform="rotate(-8 18 24)" />
      <path d="M18 31c-5-3.4-7-6-7-8.6 0-2 1.6-3.4 3.4-3.4 1.6 0 2.8.9 3.6 2.2.8-1.3 2-2.2 3.6-2.2 1.8 0 3.4 1.4 3.4 3.4 0 2.6-2 5.2-7 8.6z" fill="#ff8fbd" stroke="#4a2f57" strokeWidth="1.6" transform="rotate(-8 18 24)" />
      <path d="M36 40v-8M33 35l3-3 3 3" stroke="#7e39df" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
