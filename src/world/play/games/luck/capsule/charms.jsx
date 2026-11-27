// The capsule machine's charms, drawn for this game (ids match server/content/luck.js CHARMS).
// Each hangs from a little ring, so they read as charms rather than stickers. 48×48 box.
const s = { stroke: "#4a2f57", strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" };
const ring = (
  <>
    <circle cx="24" cy="5" r="3.2" fill="none" stroke="#b8a1c4" strokeWidth="2" />
    <path d="M24 8.2v3" stroke="#b8a1c4" strokeWidth="2" strokeLinecap="round" />
  </>
);
const shine = (d) => <path d={d} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".9" />;

export const CHARM_ART = {
  "ribbon-heart": (
    <>
      <path d="M24 44C12 36 8 30 8 24c0-5 4-8 8-8 3 0 6 2 8 5 2-3 5-5 8-5 4 0 8 3 8 8 0 6-4 12-16 20z" fill="#ffa4c9" {...s} />
      <path d="M24 17c-3-5-10-6-10-2 0 3 6 4 10 2zm0 0c3-5 10-6 10-2 0 3-6 4-10 2z" fill="#cfb4ff" {...s} strokeWidth="1.8" />
      <circle cx="24" cy="16.5" r="2.4" fill="#b589ff" {...s} strokeWidth="1.6" />
      {shine("M13 25c0-3 2-5 4-5")}
    </>
  ),
  "star-bead": (
    <>
      <path d="M24 12l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#ffd166" {...s} />
      <circle cx="24" cy="27" r="2.2" fill="#fff6d6" stroke="#c9a347" strokeWidth="1.5" />
      {shine("M19 21l2-1")}
    </>
  ),
  "moon-button": (
    <>
      <circle cx="24" cy="28" r="15" fill="#cfb4ff" {...s} />
      <circle cx="24" cy="28" r="11" fill="none" stroke="#a585d6" strokeWidth="1.6" strokeDasharray="2 3" />
      <path d="M27 20a8 8 0 1 0 4 12 7 7 0 0 1-4-12z" fill="#fff6d6" stroke="#4a2f57" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="18" cy="25" r="1.6" fill="#4a2f57" />
      <circle cx="18" cy="31" r="1.6" fill="#4a2f57" />
    </>
  ),
  strawberry: (
    <>
      <path d="M24 44c-9-4-14-12-13-19 1-5 7-7 13-7s12 2 13 7c1 7-4 15-13 19z" fill="#ff8fb1" {...s} />
      <path d="M17 18c2 3 5 3 7 0 2 3 5 3 7 0-2-3-5-4-7-4s-5 1-7 4z" fill="#8fd18a" {...s} strokeWidth="1.8" />
      {[[19, 26], [28, 25], [23, 31], [17, 33], [30, 32], [24, 38]].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1" ry="1.5" fill="#fff3b0" />
      ))}
      {shine("M14 26c0-2 1-4 3-5")}
    </>
  ),
  cloud: (
    <>
      <path d="M12 40c-5 0-7-4-6-7 1-4 5-5 7-4 0-6 5-10 11-9 4 0 7 3 8 6 4-1 9 1 9 6 1 5-3 8-7 8z" fill="#fffaff" {...s} />
      <path d="M17 31c1 1.5 3 1.5 4 0M27 31c1 1.5 3 1.5 4 0" stroke="#4a2f57" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="15.5" cy="35" rx="2.4" ry="1.4" fill="#ffb7d2" />
      <ellipse cx="33" cy="35" rx="2.4" ry="1.4" fill="#ffb7d2" />
      <path d="M22.5 35.5q1.5 1.2 3 0" stroke="#4a2f57" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  mushroom: (
    <>
      <path d="M19 30l-2 11c4 3 10 3 14 0l-2-11" fill="#fff1dc" {...s} />
      <path d="M7 31c0-11 8-18 17-18s17 7 17 18c-10 3-24 3-34 0z" fill="#c89be0" {...s} />
      <circle cx="17" cy="22" r="3" fill="#fffaff" />
      <circle cx="29" cy="19" r="2.4" fill="#fffaff" />
      <circle cx="33" cy="27" r="2" fill="#fffaff" />
      <circle cx="22" cy="28" r="1.8" fill="#fffaff" />
    </>
  ),
  cherries: (
    <>
      <path d="M24 12c-2 8-6 14-11 19M24 12c1 8 4 14 10 19" fill="none" {...s} />
      <path d="M24 12c4-3 9-2 11 1-4 2-8 2-11-1z" fill="#8fd18a" {...s} strokeWidth="1.8" />
      <circle cx="13" cy="35" r="7.5" fill="#f2557f" {...s} />
      <circle cx="34" cy="35" r="7.5" fill="#f2557f" {...s} />
      {shine("M9.5 33c.5-2 2-3 3-3")}
      {shine("M30.5 33c.5-2 2-3 3-3")}
    </>
  ),
  lilac: (
    <>
      <path d="M24 44V25" {...s} fill="none" />
      <path d="M24 36c-6 0-9-3-10-7 5 0 9 2 10 7z" fill="#9fd08f" {...s} strokeWidth="1.8" />
      {[[24, 14], [18, 19], [30, 19], [21, 25], [28, 25], [24, 31], [15, 25], [33, 25]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0-4.5c2 0 2.6 2.4 0 4.5 2.6-2.1 4.5-1 4.5 0s-1.9 2.1-4.5 0c2.6 2.1 2 4.5 0 4.5s-2.6-2.4 0-4.5c-2.6 2.1-4.5 1-4.5 0s1.9-2.1 4.5 0c-2.6-2.1-2-4.5 0-4.5z" fill={i % 2 ? "#c9a5ec" : "#b78be0"} stroke="#4a2f57" strokeWidth="1.1" />
          <circle r="0.9" fill="#fff6d6" />
        </g>
      ))}
    </>
  ),
  candy: (
    <>
      <path d="M14 28l-8-6v13zM34 28l8-6v13z" fill="#cfb4ff" {...s} />
      <ellipse cx="24" cy="28" rx="11" ry="9" fill="#ffa4c9" {...s} />
      <path d="M17 22c2 4 2 9 0 13M23 19.5c2 5 2 12 0 17M29 20c2 5 2 11 0 16" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  bunny: (
    <>
      <path d="M17 24c-4-8-4-15 0-15s5 7 4 14M31 24c4-8 4-15 0-15s-5 7-4 14" fill="#fffaff" {...s} />
      <path d="M17.5 22c-2-5-2-9 0-10M30.5 22c2-5 2-9 0-10" stroke="#ffb7d2" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <ellipse cx="24" cy="32" rx="13" ry="11" fill="#fffaff" {...s} />
      <circle cx="19" cy="31" r="1.7" fill="#4a2f57" />
      <circle cx="29" cy="31" r="1.7" fill="#4a2f57" />
      <path d="M22.5 35l1.5 1.2 1.5-1.2" stroke="#4a2f57" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <ellipse cx="16" cy="35" rx="2.4" ry="1.4" fill="#ffb7d2" />
      <ellipse cx="32" cy="35" rx="2.4" ry="1.4" fill="#ffb7d2" />
    </>
  ),
  bear: (
    <>
      <circle cx="13" cy="20" r="5.5" fill="#d9a77a" {...s} />
      <circle cx="35" cy="20" r="5.5" fill="#d9a77a" {...s} />
      <circle cx="24" cy="30" r="13" fill="#d9a77a" {...s} />
      <ellipse cx="24" cy="34" rx="6" ry="4.6" fill="#f6dcc2" stroke="#4a2f57" strokeWidth="1.6" />
      <ellipse cx="24" cy="32.4" rx="2" ry="1.4" fill="#4a2f57" />
      <circle cx="18.5" cy="28" r="1.7" fill="#4a2f57" />
      <circle cx="29.5" cy="28" r="1.7" fill="#4a2f57" />
      <path d="M22.5 35.5q1.5 1.3 3 0" stroke="#4a2f57" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </>
  ),
  "key-heart": (
    <>
      <path d="M24 26c-4-6-12-4-11 2 1 4 11 9 11 9s10-5 11-9c1-6-7-8-11-2z" fill="#ffd166" {...s} />
      <path d="M24 36v8M24 41h5M24 44h4" {...s} fill="none" />
      <path d="M24 29c-1.5-2-4-1.5-4 .5 0 1.5 4 3.5 4 3.5s4-2 4-3.5c0-2-2.5-2.5-4-.5z" fill="#f96cab" />
      <path d="M24 16v6" {...s} />
    </>
  ),
  "music-note": (
    <>
      <path d="M18 36V17l16-4v19" fill="none" {...s} strokeWidth="2.6" />
      <path d="M18 17l16-4v5l-16 4z" fill="#39c5bb" {...s} strokeWidth="2" />
      <ellipse cx="14" cy="37" rx="5.5" ry="4.2" transform="rotate(-18 14 37)" fill="#39c5bb" {...s} />
      <ellipse cx="30" cy="33" rx="5.5" ry="4.2" transform="rotate(-18 30 33)" fill="#39c5bb" {...s} />
      {shine("M11.5 35.5l2-1")}
    </>
  ),
  shell: (
    <>
      <path d="M24 42L9 25c3-8 9-12 15-12s12 4 15 12z" fill="#ffd6e4" {...s} />
      <path d="M24 42L16 18M24 42V14M24 42l8-24M24 42L11 23M24 42l13-19" stroke="#e7a2be" strokeWidth="1.6" fill="none" />
      <path d="M19 42h10l-2 4h-6z" fill="#ffd6e4" {...s} strokeWidth="1.8" />
      <circle cx="35" cy="38" r="4" fill="#fffaff" stroke="#4a2f57" strokeWidth="1.6" />
      {shine("M33.5 36.5l1-.6")}
    </>
  ),
  teacup: (
    <>
      <ellipse cx="23" cy="41" rx="15" ry="3.6" fill="#cfeee4" {...s} />
      <path d="M11 22h24v8c0 7-5 11-12 11s-12-4-12-11z" fill="#9fe0cf" {...s} />
      <path d="M35 25c5-1 7 3 4 6-1 1-3 2-5 2" fill="none" {...s} />
      <ellipse cx="23" cy="22" rx="12" ry="3" fill="#e9d6b0" {...s} strokeWidth="1.8" />
      <path d="M17 31c2 1.6 4 1.6 6 0 2 1.6 4 1.6 6 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M20 17c-2-2 0-3 0-5M26 17c-2-2 0-3 0-5" stroke="#c7a9d6" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  "crystal-heart": (
    <>
      <path d="M24 44L8 26l4-8h8l4 4 4-4h8l4 8z" fill="#d6e8ff" {...s} />
      <path d="M8 26h32M12 18l6 8 6 18 6-18 6-8M20 18l-2 8M28 18l2 8M24 22v4" stroke="#8fa7dd" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <path d="M13 24l3-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M38 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#ffd166" />
      <path d="M8 36l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#ffd166" />
    </>
  ),
  wing: (
    <>
      <path d="M12 40c-2-10 2-20 10-24 6-3 14-3 18 0-2 4-6 5-9 5 4 1 6 3 6 6-3 2-6 2-9 1 2 2 3 4 2 6-3 2-6 1-8-1 0 3-1 6-4 7z" fill="#fffaff" {...s} />
      <path d="M19 24c4-2 9-2 13-1M20 30c3-1 6-1 9 0M19 35c2 0 4 0 6 1" stroke="#d6bc7a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M40 16l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#ffd166" />
    </>
  ),
  crescent: (
    <>
      <path d="M29 13a16 16 0 1 0 8 27 13 13 0 0 1-8-27z" fill="#ffd166" {...s} />
      <path d="M33 21l1.4 3.4 3.6.4-2.8 2.4.9 3.6-3.1-2-3.1 2 .9-3.6-2.8-2.4 3.6-.4z" fill="#fff4c2" stroke="#4a2f57" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="17" cy="30" r="1.4" fill="#4a2f57" />
      <path d="M19 35q2 1.4 4 0" stroke="#4a2f57" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <ellipse cx="15" cy="34" rx="2" ry="1.2" fill="#ffb7d2" />
      {shine("M14 22c1-2 3-4 5-5")}
    </>
  ),
};

export function CharmArt({ id, size = 48, className = "" }) {
  return (
    <svg className={`charm-art ${className}`} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {ring}
      {CHARM_ART[id] ?? CHARM_ART["star-bead"]}
    </svg>
  );
}

/** An uncollected charm: a dashed outline she can't make out yet. */
export function CharmShadow({ size = 48 }) {
  return (
    <svg className="charm-art charm-art--shadow" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {ring}
      <circle cx="24" cy="29" r="14" fill="#efe6f5" stroke="#c4aed2" strokeWidth="2" strokeDasharray="3 4" />
      <text x="24" y="35" textAnchor="middle" fontSize="16" fontWeight="700" fill="#b8a1c4" fontFamily="var(--font-hand), sans-serif">?</text>
    </svg>
  );
}
