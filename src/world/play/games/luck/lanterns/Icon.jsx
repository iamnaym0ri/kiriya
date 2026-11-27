// The wishing lanterns' little picture on the luck shelf.
export default function LanternsIcon({ size = 48 }) {
  const lantern = (x, y, s, fill) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="10" cy="14" r="11" fill={fill} opacity=".3" />
      <rect x="6" y="0" width="8" height="3" rx="1.5" fill="#7e5a92" />
      <path d="M2 9c0-4 3-6 8-6s8 2 8 6v8c0 5-3 8-8 8s-8-3-8-8z" fill={fill} stroke="#4a2f57" strokeWidth="1.8" />
      <rect x="6" y="24" width="8" height="3" rx="1.5" fill="#7e5a92" />
    </g>
  );
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#5d4386" />
      <circle cx="9" cy="10" r="1" fill="#fff" /><circle cx="38" cy="7" r="1" fill="#fff" /><circle cx="42" cy="22" r=".8" fill="#fff" />
      {lantern(5, 18, 0.85, "#ffcf8a")}
      {lantern(19, 6, 1, "#ffd166")}
      {lantern(32, 20, 0.7, "#ff9fc6")}
    </svg>
  );
}
