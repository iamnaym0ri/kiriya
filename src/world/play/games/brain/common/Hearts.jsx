// The hearts a run has left, drawn like shy shade's (the status strip's small hearts).
export default function Hearts({ left, of = 3 }) {
  return (
    <span className="brain-hearts" role="img" aria-label={`${left} of ${of} hearts left`}>
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} viewBox="0 0 20 18" width="17" height="15" aria-hidden="true" className="brain-heart" data-full={i < left || undefined}>
          <path d="M10 16.5C3.5 12.3 1.5 9 1.5 6 1.5 3.4 3.4 1.5 5.8 1.5c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.9 4.3 4.5 0 3-2 6.3-8.5 10.5z" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}
