// Shelf icon: a three-by-three of lilac swatches, one a whisper paler, with a little heart.
export default function ShyShadeIcon({ size = 48 }) {
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="10" fill="#fffafd" stroke="#d7c2e3" strokeWidth="1.6" />
      {cells.map((i) => (
        <rect key={i} x={8 + (i % 3) * 11.5} y={8 + Math.floor(i / 3) * 11.5} width="9.5" height="9.5" rx="2.4" fill={i === 5 ? "#dcc2ea" : "#c49ad8"} />
      ))}
      <path d="M36.8 25.3c-2.2-1.4-3-2.5-3-3.6 0-.9.7-1.6 1.5-1.6.6 0 1.1.3 1.5.9.4-.6.9-.9 1.5-.9.8 0 1.5.7 1.5 1.6 0 1.1-.8 2.2-3 3.6z" fill="#b4457d" />
    </svg>
  );
}
