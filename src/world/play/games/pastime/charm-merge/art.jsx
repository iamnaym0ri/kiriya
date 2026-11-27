// Charm ladder's charms, drawn for this site: a bead becomes a heart, a star, a bell, a ribbon, a
// moon, a blossom, a gem and at last a crown (and a few fancier crowns after it).
const round = { strokeLinecap: "round", strokeLinejoin: "round" };
const ink = "#4a2f57";

const crownBase = (
  <g {...round}>
    <path d="M9 34L7 15l10 9 7-13 7 13 10-9-2 19z" fill="#ffd56b" stroke="#b7862a" strokeWidth="2.2" />
    <path d="M9 34h30v5H9z" fill="#f7c24f" stroke="#b7862a" strokeWidth="2.2" />
    <circle cx="24" cy="27" r="3" fill="#e58bb5" stroke="#a8507f" strokeWidth="1.5" />
    <circle cx="15" cy="29" r="2" fill="#9fd0f0" stroke="#5c8cb4" strokeWidth="1.2" />
    <circle cx="33" cy="29" r="2" fill="#b493e6" stroke="#6a4c99" strokeWidth="1.2" />
    <circle cx="7" cy="14" r="2.4" fill="#fff3c4" stroke="#b7862a" strokeWidth="1.4" />
    <circle cx="24" cy="10" r="2.6" fill="#fff3c4" stroke="#b7862a" strokeWidth="1.4" />
    <circle cx="41" cy="14" r="2.4" fill="#fff3c4" stroke="#b7862a" strokeWidth="1.4" />
    <path d="M12 20l1.5 9" stroke="#fff4c8" strokeWidth="2" />
  </g>
);

export const CHARM_ART = [
  null,
  // 1 bead
  <g key="1" {...round}>
    <circle cx="24" cy="9" r="3.4" fill="none" stroke="#b7a1c6" strokeWidth="2" />
    <circle cx="24" cy="26" r="13.5" fill="#eadff8" stroke="#9c82b4" strokeWidth="2.2" />
    <circle cx="24" cy="26" r="9" fill="#f6f0fc" opacity="0.8" />
    <path d="M15.5 22c1.2-3.6 4.4-6 8-6" stroke="#fff" strokeWidth="2.8" fill="none" />
    <path d="M31 30l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="#c9a8f5" />
  </g>,
  // 2 heart
  <g key="2" {...round}>
    <path d="M24 40C12 32 7 25 7 18c0-6 4-10 9-10 4 0 7 2 8 5 1-3 4-5 8-5 5 0 9 4 9 10 0 7-5 14-17 22z" fill="#f7a6c8" stroke="#b0577f" strokeWidth="2.2" />
    <path d="M13 17c0-3 2-5 5-5" stroke="#ffe0ec" strokeWidth="2.4" fill="none" />
  </g>,
  // 3 star
  <g key="3" {...round}>
    <path d="M24 5l5.6 12.4L43 19l-10 9.4 2.8 13.4L24 35.2 12.2 41.8 15 28.4 5 19l13.4-1.6z" fill="#ffd977" stroke="#b7862a" strokeWidth="2.2" />
    <circle cx="19.5" cy="25" r="1.4" fill={ink} />
    <circle cx="28.5" cy="25" r="1.4" fill={ink} />
    <path d="M22 29c1.2 1 2.8 1 4 0" stroke={ink} strokeWidth="1.5" fill="none" />
    <path d="M15 21l4-.6" stroke="#fff5cf" strokeWidth="2.2" />
  </g>,
  // 4 bell
  <g key="4" {...round}>
    <path d="M24 8c-8 0-12 6-12 14v8l-4 5h32l-4-5v-8c0-8-4-14-12-14z" fill="#ffdf8a" stroke="#b7862a" strokeWidth="2.2" />
    <circle cx="24" cy="38" r="3.4" fill="#d9a04a" stroke="#b7862a" strokeWidth="1.8" />
    <path d="M17 8c2-3 5-3 7 0 2-3 5-3 7 0-2 3-5 3-7 1-2 2-5 2-7-1z" fill="#e58bb5" stroke="#a8507f" strokeWidth="1.6" />
    <path d="M16 18c0-3 2-5 4-6" stroke="#fff4c8" strokeWidth="2.4" fill="none" />
  </g>,
  // 5 ribbon
  <g key="5" {...round}>
    <path d="M24 22C16 10 5 10 5 19s12 9 19 4zM24 22c8-12 19-12 19-3s-12 9-19 4z" fill="#f59cc0" stroke="#a8507f" strokeWidth="2.2" />
    <path d="M21 24l-7 16 6-3 3 5 2-17zM27 24l7 16-6-3-3 5-2-17z" fill="#f59cc0" stroke="#a8507f" strokeWidth="2" />
    <rect x="20" y="17" width="8" height="10" rx="3.5" fill="#e3709f" stroke="#a8507f" strokeWidth="2" />
    <path d="M10 16c1-2 3-3 5-3" stroke="#ffe0ec" strokeWidth="2.2" fill="none" />
  </g>,
  // 6 moon
  <g key="6" {...round}>
    <path d="M30 6a18 18 0 1 0 12 30A15 15 0 1 1 30 6z" fill="#fff0a8" stroke="#b7972a" strokeWidth="2.2" />
    <circle cx="17" cy="25" r="1.4" fill={ink} />
    <path d="M14 30c2 1.6 4.4 1.6 6 0" stroke={ink} strokeWidth="1.5" fill="none" />
    <ellipse cx="13" cy="28" rx="2.4" ry="1.4" fill="#f7a6c8" />
    <path d="M38 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#b493e6" />
  </g>,
  // 7 blossom
  <g key="7" {...round}>
    {[0, 72, 144, 216, 288].map((angle) => (
      <path key={angle} d="M24 24c-6-4-7-11-4-15 2 1 3 3 4 4 1-1 2-3 4-4 3 4 2 11-4 15z" transform={`rotate(${angle} 24 24)`} fill="#ffc4dc" stroke="#c0628f" strokeWidth="1.8" />
    ))}
    <circle cx="24" cy="24" r="4" fill="#ffe08a" stroke="#c48a26" strokeWidth="1.5" />
  </g>,
  // 8 gem
  <g key="8" {...round}>
    <path d="M14 10h20l8 10-18 22L6 20z" fill="#c9a8f5" stroke="#6a4c99" strokeWidth="2.2" />
    <path d="M6 20h36M14 10l6 10 4 22M34 10l-6 10-4 22M20 20l4-10 4 10" stroke="#6a4c99" strokeWidth="1.6" fill="none" />
    <path d="M12 18l3-5" stroke="#f3eaff" strokeWidth="2.4" />
  </g>,
  // 9 crown
  <g key="9">{crownBase}</g>,
  // 10 starry crown
  <g key="10">{crownBase}<path d="M24 0l2 4.5 4.6.6-3.4 3.2.9 4.6L24 10.6l-4.1 2.3.9-4.6-3.4-3.2 4.6-.6z" fill="#fff" stroke="#b7862a" strokeWidth="1.4" strokeLinejoin="round" /></g>,
  // 11 moon crown
  <g key="11">{crownBase}<path d="M27 1a6 6 0 1 0 4 10 5 5 0 1 1-4-10z" fill="#fff6c4" stroke="#b7862a" strokeWidth="1.4" /></g>,
  // 12 heart crown
  <g key="12">{crownBase}<path d="M24 12c-4-3-6-5-6-7.5S20 1 21.5 1c1.2 0 2 .8 2.5 1.8.5-1 1.3-1.8 2.5-1.8C28 1 30 2 30 4.5S28 9 24 12z" fill="#f7a6c8" stroke="#a8507f" strokeWidth="1.4" /></g>,
  // 13 dream crown
  <g key="13">{crownBase}<path d="M6 6l1 2.4 2.4 1-2.4 1L6 13l-1-2.6-2.4-1 2.4-1zM42 4l1 2.4 2.4 1-2.4 1L42 11l-1-2.6-2.4-1 2.4-1zM24 0l1.4 3.4 3.4 1.4-3.4 1.4L24 10l-1.4-3.8-3.4-1.4 3.4-1.4z" fill="#ffffff" stroke="#9c82b4" strokeWidth="1.2" /></g>,
];

/** Each tier's tile colour, soft at the bottom of the ladder and golden at the crown. */
export const TILE_TONES = [
  null,
  ["#f7f0fb", "#d9c6e6"],
  ["#fde8f1", "#efbdd3"],
  ["#fff4dc", "#ecd49a"],
  ["#fff0cf", "#e6c477"],
  ["#ffe2ee", "#eba6c4"],
  ["#eeeafd", "#c3b5ef"],
  ["#ffe6f0", "#f0a9c8"],
  ["#ece2ff", "#b99de8"],
  ["#fff0b8", "#e3b84a"],
  ["#fbe7ff", "#d39be0"],
  ["#e9f0ff", "#9fb4e8"],
  ["#ffe1ec", "#e78bb2"],
  ["#f2e6ff", "#a77fe0"],
];

export function CharmArt({ tier, size = 48, dim = false }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={dim ? { filter: "grayscale(1)", opacity: 0.32 } : undefined}>
      {CHARM_ART[tier]}
    </svg>
  );
}

export function CharmMergeIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="8" width="26" height="26" rx="7" fill="#fde8f1" stroke="#c9a3c4" strokeWidth="2" />
      <rect x="34" y="8" width="26" height="26" rx="7" fill="#fde8f1" stroke="#c9a3c4" strokeWidth="2" />
      <g transform="translate(6 10) scale(0.46)">{CHARM_ART[2]}</g>
      <g transform="translate(36 10) scale(0.46)">{CHARM_ART[2]}</g>
      <rect x="18" y="34" width="28" height="26" rx="7" fill="#fff0b8" stroke="#d1a84a" strokeWidth="2" />
      <g transform="translate(20 36) scale(0.5)">{CHARM_ART[9]}</g>
    </svg>
  );
}
