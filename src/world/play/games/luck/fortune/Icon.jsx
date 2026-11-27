// The fortune slip's little picture on the luck shelf.
export default function FortuneIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M13 6h22v36H13z" fill="#fffaf3" stroke="#4a2f57" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M13 18h22M13 30h22" stroke="#d9c3ea" strokeWidth="1.6" />
      <circle cx="24" cy="12" r="4.4" fill="#fff0f6" stroke="#c2006f" strokeWidth="1.6" />
      <path d="M17 23h14M18 26h12" stroke="#a589b4" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24 37c-4-6-12-6-10-1 1 3 7 3 10 1zm0 0c4-6 12-6 10-1-1 3-7 3-10 1z" fill="#c9a8f5" stroke="#4a2f57" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="24" cy="36.6" r="2.4" fill="#ff9fc6" stroke="#4a2f57" strokeWidth="1.4" />
    </svg>
  );
}
