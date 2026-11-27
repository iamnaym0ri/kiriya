// Shelf icon: three letter cards, the middle one sealed with a little plum heart.
export default function SecretWordIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="3" y="15" width="13" height="16" rx="3" fill="#fffafd" stroke="#a37fb6" strokeWidth="1.8" transform="rotate(-6 9.5 23)" />
      <rect x="32" y="15" width="13" height="16" rx="3" fill="#f6c6dc" stroke="#df93b7" strokeWidth="1.8" transform="rotate(5 38.5 23)" />
      <rect x="16.5" y="11" width="15" height="19" rx="3.5" fill="#7a4f93" stroke="#5e3a75" strokeWidth="1.8" />
      <path d="M24 25.5c-3.6-2.4-5-4.1-5-6 0-1.5 1.1-2.6 2.5-2.6 1 0 1.9.6 2.5 1.5.6-.9 1.5-1.5 2.5-1.5 1.4 0 2.5 1.1 2.5 2.6 0 1.9-1.4 3.6-5 6z" fill="#f7b9d8" />
      <path d="M8 40q8-4 16 0t16 0" fill="none" stroke="#c9aed8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
