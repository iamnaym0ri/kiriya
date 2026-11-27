import { useId } from "react";

// A small drawing of the note jar for its card in the notes & letters section: the same glass,
// lid, bow and folded notes as the big jar (today/NoteJar.jsx), with the red heart when there are
// new notes from Josh.
export default function JarMini({ fresh = 0 }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="jar-mini" viewBox="0 0 120 128" aria-hidden="true" data-fresh={fresh > 0 || undefined}>
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" x2="1" y2="1">
          <stop stopColor="#fffaff" stopOpacity=".95" />
          <stop offset=".5" stopColor="#dcc7eb" stopOpacity=".45" />
          <stop offset="1" stopColor="#e7bfda" stopOpacity=".8" />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x2="0" y2="1">
          <stop stopColor="#e9c8da" />
          <stop offset="1" stopColor="#be8fae" />
        </linearGradient>
        <clipPath id={`${id}-in`}>
          <path d="M37 36h46v7c0 8 10 9 10 21v40q0 10-10 10H37q-10 0-10-10V64c0-12 10-13 10-21Z" />
        </clipPath>
      </defs>
      <ellipse cx="60" cy="120" rx="40" ry="4.5" fill="#b697cc" opacity=".2" />
      <g className="jar-mini__vessel">
        <path d="M37 36h46v7c0 8 10 9 10 21v40q0 10-10 10H37q-10 0-10-10V64c0-12 10-13 10-21Z" fill={`url(#${id}-glass)`} stroke="#ae8abb" strokeWidth="1.6" />
        <g clipPath={`url(#${id}-in)`}>
          {[
            [36, 96, -18, "#d6bee8"],
            [72, 100, 14, "#efc5d9"],
            [54, 108, -6, "#fff5df"],
            [44, 82, 15, "#efcbdc"],
            [72, 80, -16, "#ded0ec"],
            [56, 92, 8, "#fff8eb"],
          ].map(([x, y, angle, color], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <rect x="-9" y="-6" width="20" height="12" rx="1.5" fill={color} stroke="#b597bb" strokeWidth=".8" />
              <path d="m-8-5 10 6 9-6" fill="none" stroke="#c3a4c4" strokeWidth=".7" />
            </g>
          ))}
        </g>
        <path d="M35 58q-5 4-5 11v24" fill="none" stroke="#fffaff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
        <path d="M28 64q32 6 64 0" fill="none" stroke="#cda0c3" strokeWidth="4" />
        <g transform="translate(61 63)">
          <path d="M-2-1C-15-12-21-3-14 1c4 2 8 2 12-2ZM2-1C15-12 21-3 14 1c-4 2-9 1-12-2Z" fill="#dda9c5" stroke="#b580a5" strokeWidth="1.1" />
          <ellipse rx="3.6" ry="3" fill="#c28aad" />
        </g>
      </g>
      <g className="jar-mini__lid">
        <ellipse cx="60" cy="33" rx="29" ry="6" fill="#e4bdd4" stroke="#b787a9" strokeWidth="1.3" />
        <path d="M31 32v6q0 5 29 5t29-5v-6q-2 5-29 5t-29-5Z" fill={`url(#${id}-lid)`} stroke="#b787a9" strokeWidth="1.3" />
      </g>
      {fresh > 0 && (
        <g className="jar-mini__heart" transform="translate(92 26)">
          <path d="M0 10C-15-1-16-13-8-17-3-19 0-15 0-12 0-15 3-19 8-17 16-13 15-1 0 10Z" fill="#e0476f" stroke="#a8244d" strokeWidth="1.6" strokeLinejoin="round" />
          <text y="0" textAnchor="middle" className="jar-mini__count">{fresh > 9 ? "9+" : fresh}</text>
        </g>
      )}
    </svg>
  );
}
