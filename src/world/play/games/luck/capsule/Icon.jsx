// The capsule machine's little picture on the luck shelf.
export default function CapsuleIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="18" r="14" fill="#f8f2ff" stroke="#4a2f57" strokeWidth="2.2" />
      <circle cx="19" cy="21" r="5" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="1.6" />
      <circle cx="29" cy="21" r="5" fill="#97dcc8" stroke="#4a2f57" strokeWidth="1.6" />
      <circle cx="24" cy="13" r="5" fill="#ffdc7d" stroke="#4a2f57" strokeWidth="1.6" />
      <path d="M14 10a12 12 0 0 1 7-5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <rect x="11" y="30" width="26" height="15" rx="5" fill="#dcc8f1" stroke="#4a2f57" strokeWidth="2.2" />
      <circle cx="24" cy="37.5" r="4.2" fill="#fffaf2" stroke="#4a2f57" strokeWidth="1.8" />
      <path d="M20.5 37.5h7" stroke="#f96cab" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
