// The engine's own cloud, for characters that don't draw one: a soft lilac puff with a flat
// underside. Feet stand 8 px into it (Platform.surface), so the bumps rise around the shoes.
export default function DefaultPlatform({ width = 96 }) {
  return (
    <svg
      className="cs-cloud"
      viewBox="0 0 120 36"
      width={width}
      height={(width * 36) / 120}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d="M13 27C4 27 3 17 12 16 12 8 24 5 31 11 35 2 52 1 57 9 63 2 79 3 82 11 89 6 102 8 103 16 113 16 116 27 107 27 90 31 30 31 13 27Z"
        fill="#fffaff"
        stroke="#cfb8de"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18 25.5C42 29 78 29 102 25.5" fill="none" stroke="#ebdff2" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 13c3-3 7-3 9-1m20-3c3-3 8-3 10 0" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
DefaultPlatform.surface = 8;
