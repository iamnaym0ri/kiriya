// The teacup shuffle's little picture on the luck shelf.
export default function CupsIcon({ size = 48 }) {
  const cup = (x, lift = 0) => (
    <g transform={`translate(${x} ${-lift})`}>
      <path d="M2 38c0-12 4-20 11-20s11 8 11 20z" fill="#dcc8f1" stroke="#4a2f57" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 32c6 2 12 2 18 0" stroke="#ff9fc6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M24 30l2.4 5 5.4.6-4 3.6 1.2 5.3-5-2.8-5 2.8 1.2-5.3-4-3.6 5.4-.6z" fill="#ffd166" stroke="#4a2f57" strokeWidth="1.6" strokeLinejoin="round" />
      {cup(-3)}
      {cup(11, 12)}
      {cup(25)}
    </svg>
  );
}
