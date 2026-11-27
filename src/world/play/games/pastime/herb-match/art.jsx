// Herb patch's own drawings: six herbs, the three special pieces and the tangled vine. Drawn for
// this site in the lilac, hand-drawn look (soft fills, a darker outline of the same colour).
const round = { strokeLinecap: "round", strokeLinejoin: "round" };

export const HERB_NAMES = {
  mint: "mint",
  lavender: "lavender",
  chamomile: "chamomile",
  rose: "rosebud",
  borage: "borage",
  marigold: "marigold",
};

const HERB_ART = {
  mint: (
    <g {...round}>
      <path d="M24 42V20" stroke="#4f7d5a" strokeWidth="2.4" fill="none" />
      <path d="M24 30c-9 1-14-5-13-12 8-1 14 4 13 12z" fill="#a8d69a" stroke="#4f7d5a" strokeWidth="2" />
      <path d="M24 26c8 1 13-5 12-12-8-1-13 4-12 12z" fill="#94c98a" stroke="#4f7d5a" strokeWidth="2" />
      <path d="M24 19c-5-2-6-8-3-12 5 2 6 7 3 12z" fill="#b9e0a8" stroke="#4f7d5a" strokeWidth="2" />
      <path d="M14 20l6 4M34 16l-6 5" stroke="#6f9f70" strokeWidth="1.4" fill="none" />
      <path d="M15 17c1-1 3-1 4 0" stroke="#e8f6df" strokeWidth="1.6" fill="none" />
    </g>
  ),
  lavender: (
    <g {...round}>
      <path d="M24 43V12M24 34l-7-7M24 30l7-8" stroke="#5f8a62" strokeWidth="2.2" fill="none" />
      {[[24, 8], [21.5, 13], [26.5, 13], [21.5, 18.5], [26.5, 18.5], [24, 23]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3.6" ry="4.4" fill="#b493e6" stroke="#6a4c99" strokeWidth="1.6" />
      ))}
      {[[16, 24], [32, 19]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3" ry="3.8" fill="#c7aef0" stroke="#6a4c99" strokeWidth="1.5" />
      ))}
      <path d="M22 7.5c.8-1 2-1.4 3-1" stroke="#efe6ff" strokeWidth="1.4" fill="none" />
    </g>
  ),
  chamomile: (
    <g {...round}>
      {Array.from({ length: 10 }, (_, i) => (
        <ellipse key={i} cx="24" cy="12.5" rx="4" ry="8" transform={`rotate(${i * 36} 24 24)`} fill="#fffdf6" stroke="#b9a37c" strokeWidth="1.6" />
      ))}
      <circle cx="24" cy="24" r="7" fill="#f4cb52" stroke="#bf8f2c" strokeWidth="1.8" />
      <circle cx="22" cy="22" r="1.3" fill="#fff3c2" />
      <circle cx="26" cy="25.5" r="1" fill="#d9a83b" />
    </g>
  ),
  rose: (
    <g {...round}>
      <path d="M24 44V32" stroke="#5f8a62" strokeWidth="2.4" fill="none" />
      <path d="M24 38c-6 0-9-3-9-7 5 0 9 2 9 7z" fill="#9fcf8f" stroke="#4f7d5a" strokeWidth="1.8" />
      <path d="M13 21c0-8 5-13 11-13s11 5 11 13c0 7-5 12-11 12S13 28 13 21z" fill="#f6a9c9" stroke="#b0577f" strokeWidth="2" />
      <path d="M24 13c-4 0-6 3-6 6s3 5 6 5 5-2 5-4-2-3-4-3-3 1-3 2" fill="none" stroke="#b0577f" strokeWidth="1.8" />
      <path d="M15 24c3 4 6 5 9 5s6-1 9-5" fill="none" stroke="#c96b95" strokeWidth="1.6" />
      <path d="M17 15c1-2 3-3 4-3" stroke="#ffe0ec" strokeWidth="1.6" fill="none" />
    </g>
  ),
  borage: (
    <g {...round}>
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d="M24 24L19 9c2-3 8-3 10 0z" transform={`rotate(${i * 72} 24 24)`} fill="#93b8f3" stroke="#4f6fae" strokeWidth="1.8" />
      ))}
      <circle cx="24" cy="24" r="4.6" fill="#3e4f8a" stroke="#2c3866" strokeWidth="1.4" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d="M24 20.5v-4" transform={`rotate(${i * 72 + 36} 24 24)`} stroke="#fff6d8" strokeWidth="1.4" />
      ))}
      <path d="M21 12c1-1.5 3-2 4-1.6" stroke="#e5efff" strokeWidth="1.4" fill="none" />
    </g>
  ),
  marigold: (
    <g {...round}>
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx="24" cy="11" r="6" transform={`rotate(${i * 30} 24 24)`} fill="#f7ae60" stroke="#c06c2c" strokeWidth="1.6" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx="24" cy="16.5" r="4.4" transform={`rotate(${i * 45 + 22} 24 24)`} fill="#fbc77d" stroke="#c97a34" strokeWidth="1.3" />
      ))}
      <circle cx="24" cy="24" r="4.5" fill="#e68a3a" stroke="#b25e22" strokeWidth="1.4" />
      <path d="M20 13c1.4-1.2 3-1.6 4.4-1.2" stroke="#fff0d6" strokeWidth="1.5" fill="none" />
    </g>
  ),
};

/** Inline sprite every herb on the board points at with <use>, so 56 herbs stay light. */
export function HerbSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {Object.entries(HERB_ART).map(([kind, art]) => (
          <symbol key={kind} id={`herb-${kind}`} viewBox="0 0 48 48">{art}</symbol>
        ))}
        <symbol id="herb-honey" viewBox="0 0 48 48">
          <g {...round}>
            <path d="M15 17h18c5 4 7 9 7 14 0 8-7 12-16 12S8 39 8 31c0-5 2-10 7-14z" fill="#f6c65b" stroke="#b37a1f" strokeWidth="2.2" />
            <path d="M13 14h22v5H13z" fill="#d9a04a" stroke="#b37a1f" strokeWidth="2" />
            <path d="M16 19c0 5 2 6 3 6s2-2 2-4c1 4 3 5 4 5 2 0 3-3 3-6" fill="#ffe08a" stroke="#c48a26" strokeWidth="1.5" />
            <path d="M18 9c3-3 9-3 12 0" fill="none" stroke="#8a5a2b" strokeWidth="2" />
            <path d="M13 31c0-4 2-7 4-8" stroke="#fff1c4" strokeWidth="2" fill="none" />
            <path d="M26 33l2 2 4-5" stroke="#e58bb5" strokeWidth="2" fill="none" />
          </g>
        </symbol>
        <symbol id="herb-ribbon-row" viewBox="0 0 48 48">
          <g {...round}>
            <path d="M3 24c5-3 9-3 13 0M45 24c-5-3-9-3-13 0" stroke="#e58bb5" strokeWidth="3" fill="none" />
            <path d="M1 24l4-3v6zM47 24l-4-3v6z" fill="#e58bb5" />
          </g>
        </symbol>
        <symbol id="herb-ribbon-col" viewBox="0 0 48 48">
          <g {...round}>
            <path d="M24 3c-3 5-3 9 0 13M24 45c-3-5-3-9 0-13" stroke="#e58bb5" strokeWidth="3" fill="none" />
            <path d="M24 1l-3 4h6zM24 47l-3-4h6z" fill="#e58bb5" />
          </g>
        </symbol>
        <symbol id="herb-dew" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="21" fill="#dff1ff" fillOpacity="0.85" stroke="#8fbde6" strokeWidth="2" />
          <path d="M11 17c2-4 5-6 9-7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M39 3.5c3 4 4.5 6.3 4.5 8.3a4.5 4.5 0 0 1-9 0c0-2 1.5-4.3 4.5-8.3z" fill="#9fd0f0" stroke="#4f7fae" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M37.4 11.4c0-1 .5-1.9 1.2-2.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="herb-vine" viewBox="0 0 48 48">
          <g {...round} fill="none" stroke="#6a8f55" strokeWidth="2.6">
            <path d="M2 40c6-6 10 2 16-4s2-12 9-14 8 6 13 2 4-10 6-12" />
            <path d="M4 8c6 2 6 8 12 8s6-6 12-4" opacity="0.8" />
          </g>
          <g fill="#9cc47c" stroke="#55784a" strokeWidth="1.4">
            <path d="M18 36c-4-1-5-4-4-6 3 0 5 2 4 6z" />
            <path d="M40 24c0-4 2-6 5-6 0 3-2 6-5 6z" />
            <path d="M28 12c-2-3-1-6 2-7 1 3 0 6-2 7z" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}

export function HerbIcon({ kind, size = 28 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {HERB_ART[kind]}
    </svg>
  );
}

/** The shelf card's picture: a little bed of three herbs. */
export function HerbMatchIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="34" width="56" height="24" rx="8" fill="#e9dcef" stroke="#9675af" strokeWidth="2" />
      <g transform="translate(2 12) scale(0.62)">{HERB_ART.mint}</g>
      <g transform="translate(20 6) scale(0.62)">{HERB_ART.lavender}</g>
      <g transform="translate(36 14) scale(0.58)">{HERB_ART.chamomile}</g>
      <path d="M12 48h40" stroke="#c3a3d0" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
    </svg>
  );
}
