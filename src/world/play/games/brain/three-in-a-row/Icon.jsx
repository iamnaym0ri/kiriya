// Shelf icon: a little hand-drawn board with a blossom and a herb sprig.
export default function ThreeInARowIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M17 5q-1 19 1 38M31 5q1 19-1 38M5 17q19-1 38 1M5 31q19 1 38-1" fill="none" stroke="#b896c9" strokeWidth="2.4" strokeLinecap="round" />
      <g transform="translate(11 11)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-3.4" rx="2.6" ry="3.4" transform={`rotate(${a})`} fill="#f4b6d2" stroke="#c2668f" strokeWidth="0.9" />
        ))}
        <circle r="1.8" fill="#ffe08f" />
      </g>
      <g transform="translate(24 24)">
        <path d="M-1 7Q0 0 1-7" stroke="#4f7a57" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M0 2C-5 3-6-1-6-1-2-1 0 0 0 2ZM0-2C5-2 6-5 6-5 2-6 0-4 0-2Z" fill="#9cc78a" stroke="#4f7a57" strokeWidth="0.9" />
      </g>
      <g transform="translate(37 37)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-3.4" rx="2.6" ry="3.4" transform={`rotate(${a})`} fill="#f4b6d2" stroke="#c2668f" strokeWidth="0.9" />
        ))}
        <circle r="1.8" fill="#ffe08f" />
      </g>
    </svg>
  );
}
