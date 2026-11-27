import { Charm } from "./Charms.jsx";

// Shelf icon: a tiny two-by-two of charms in a framed grid.
export default function CharmGridIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="9" fill="#fffafd" stroke="#8e6aa3" strokeWidth="2.2" />
      <path d="M24 4v40M4 24h40" stroke="#a684b8" strokeWidth="1.8" />
      <svg x="6" y="6" width="16" height="16"><Charm value={1} /></svg>
      <svg x="26" y="6" width="16" height="16"><Charm value={2} /></svg>
      <svg x="6" y="26" width="16" height="16"><Charm value={3} /></svg>
      <svg x="26" y="26" width="16" height="16"><Charm value={4} /></svg>
    </svg>
  );
}
