// Shelf icon: a stitched heart on cloth with clue marks along two edges.
export default function PictureStitchIcon({ size = 48 }) {
  const heart = [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="11" y="11" width="34" height="34" rx="5" fill="#fffaf3" stroke="#8e6aa3" strokeWidth="1.8" />
      {heart.flatMap((row, r) =>
        [...row].map((ch, c) => (ch === "X" ? <rect key={`${r}-${c}`} x={13.5 + c * 6} y={13.5 + r * 6} width="5.2" height="5.2" rx="1.3" fill="#e98fb8" /> : null)),
      )}
      <path d="M4 15h4M4 21h4M4 27h4M4 33h4M15 4v4M21 4v4M27 4v4M33 4v4M39 4v4" stroke="#b79bc6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
