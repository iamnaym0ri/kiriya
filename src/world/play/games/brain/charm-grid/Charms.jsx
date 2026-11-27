// The six charms (original SVG). Each has its own shape and its own colour, so they read apart
// without colour vision as well. 4×4 puzzles use the first four.
export const CHARMS = [
  { id: 1, name: "heart" },
  { id: 2, name: "star" },
  { id: 3, name: "moon" },
  { id: 4, name: "blossom" },
  { id: 5, name: "kitty" },
  { id: 6, name: "clover" },
];
export const charmName = (v) => CHARMS[v - 1]?.name ?? "empty";

const S = { strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" };

export function Charm({ value, className = "" }) {
  return (
    <svg viewBox="0 0 40 40" className={`charm charm--${value} ${className}`} aria-hidden="true">
      {value === 1 && (
        <>
          <path d="M20 34C8 26.5 5 20.5 5 15c0-5 3.6-8.6 8-8.6 3 0 5.5 1.7 7 4.3 1.5-2.6 4-4.3 7-4.3 4.4 0 8 3.6 8 8.6 0 5.5-3 11.5-15 19z" fill="#f29cc2" stroke="#b9487c" {...S} />
          <path d="M11 13.5q1-3 4-3.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {value === 2 && (
        <>
          <path d="M20 4.5l4.4 9.6 10.4 1.2-7.7 7.2 2.1 10.3L20 27.6l-9.2 5.2 2.1-10.3-7.7-7.2 10.4-1.2z" fill="#ffd77a" stroke="#c18a1f" {...S} />
          <circle cx="16.5" cy="19" r="1.4" fill="#8a5a12" />
          <circle cx="23.5" cy="19" r="1.4" fill="#8a5a12" />
        </>
      )}
      {value === 3 && (
        <>
          <path d="M26 5.5A14.5 14.5 0 1 0 34.5 27 11.5 11.5 0 0 1 26 5.5z" fill="#a9b8f2" stroke="#4d5fae" {...S} />
          <circle cx="31" cy="10" r="1.6" fill="#4d5fae" />
          <circle cx="34.5" cy="17" r="1.1" fill="#4d5fae" />
        </>
      )}
      {value === 4 && (
        <>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx="20" cy="11.5" rx="6" ry="8" transform={`rotate(${angle} 20 20)`} fill="#d3b2f0" stroke="#7a4fae" strokeWidth="2.2" />
          ))}
          <circle cx="20" cy="20" r="4.4" fill="#fff1b8" stroke="#7a4fae" strokeWidth="2" />
        </>
      )}
      {value === 5 && (
        <>
          <path d="M7 15l1.5-9.5 7 5q4.5-1.4 9 0l7-5L33 15q3 4.5 1.6 9.2C32.6 31 26.8 34 20 34S7.4 31 5.4 24.2Q4 19.5 7 15z" fill="#ffc9a3" stroke="#bf6a33" {...S} />
          <circle cx="14.5" cy="21" r="1.7" fill="#5b2d12" />
          <circle cx="25.5" cy="21" r="1.7" fill="#5b2d12" />
          <path d="M18.4 25.3h3.2L20 27z" fill="#e0607e" />
        </>
      )}
      {value === 6 && (
        <>
          <path d="M20 21q1 7 5 13" fill="none" stroke="#3d7a4f" strokeWidth="2.6" strokeLinecap="round" />
          {[-90, 30, 150].map((angle) => (
            <path
              key={angle}
              d="M20 20c-2-4-8-4.5-8-.2 0 1.5.7 2.7 1.9 3.4-1.3.8-2 2.1-1.8 3.4.4 3.6 6 3 7.9-1.6z"
              transform={`rotate(${angle + 90} 20 20)`}
              fill="#9fd39a"
              stroke="#3d7a4f"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          ))}
        </>
      )}
    </svg>
  );
}
