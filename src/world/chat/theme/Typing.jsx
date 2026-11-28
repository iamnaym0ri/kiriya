import { TypingIndicator as Classic } from "../parts.jsx";
import "./typing.css";

const CLASSIC = new Set(["hearts", "dots", "pencil", "maomao"]);

/** A bunny hopping on the spot. */
function Bunny() {
  return (
    <svg className="typing__bunny" width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">
      <ellipse className="shadow" cx="17" cy="28" rx="8" ry="1.6" fill="currentColor" opacity="0.18" />
      <g className="body">
        <ellipse cx="12.5" cy="7" rx="2.6" ry="6.5" fill="#fff" stroke="currentColor" strokeWidth="1.3" transform="rotate(-12 12.5 7)" />
        <ellipse cx="20.5" cy="7" rx="2.6" ry="6.5" fill="#fff" stroke="currentColor" strokeWidth="1.3" transform="rotate(12 20.5 7)" />
        <ellipse cx="12.5" cy="7.5" rx="1" ry="4" fill="#ffc2d9" transform="rotate(-12 12.5 7.5)" />
        <ellipse cx="20.5" cy="7.5" rx="1" ry="4" fill="#ffc2d9" transform="rotate(12 20.5 7.5)" />
        <ellipse cx="16.5" cy="19" rx="9" ry="7.5" fill="#fff" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="13.5" cy="18" r="1.1" fill="currentColor" />
        <circle cx="19.5" cy="18" r="1.1" fill="currentColor" />
        <path d="M15.6 20.6q.9.9 1.8 0" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <circle cx="11.5" cy="20.5" r="1.3" fill="#ffc2d9" />
        <circle cx="21.5" cy="20.5" r="1.3" fill="#ffc2d9" />
      </g>
    </svg>
  );
}

/** Little paw prints, one after another, as if a kitten were walking across. */
function Paws() {
  const paw = (x, y, r) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <ellipse cx="0" cy="2.2" rx="3" ry="2.5" />
      <circle cx="-3" cy="-1.6" r="1.2" />
      <circle cx="-1" cy="-3.2" r="1.2" />
      <circle cx="1.3" cy="-3.2" r="1.2" />
      <circle cx="3.2" cy="-1.5" r="1.2" />
    </g>
  );
  return (
    <svg className="typing__paws" width="54" height="24" viewBox="0 0 54 24" fill="currentColor" aria-hidden="true">
      <g className="p1">{paw(8, 15, -14)}</g>
      <g className="p2">{paw(21, 9, 10)}</g>
      <g className="p3">{paw(34, 15, -14)}</g>
      <g className="p4">{paw(47, 9, 10)}</g>
    </svg>
  );
}

/** Music notes floating up, as if they were humming (a nod to Miku). */
function Notes() {
  return (
    <span className="typing__notes" aria-hidden="true">
      <i>♪</i>
      <i>♫</i>
      <i>♪</i>
    </span>
  );
}

/** Three stars twinkling in turn. */
function Stars() {
  return (
    <span className="typing__stars" aria-hidden="true">
      <i>✦</i>
      <i>✧</i>
      <i>✦</i>
    </span>
  );
}

/** A cup of bubble tea with its pearls bobbing. */
function Boba() {
  return (
    <svg className="typing__boba" width="30" height="32" viewBox="0 0 30 32" aria-hidden="true">
      <path d="M17 1.5 15.5 11" stroke="#ff8fb8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 9h18l-2.4 19.5a2.5 2.5 0 0 1-2.5 2.2h-8.2a2.5 2.5 0 0 1-2.5-2.2Z" fill="#f6e7d6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 9h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.4 15.5h15.2" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <circle className="b1" cx="11" cy="26" r="1.9" fill="#4b3326" />
      <circle className="b2" cx="15" cy="27" r="1.9" fill="#4b3326" />
      <circle className="b3" cx="19" cy="26" r="1.9" fill="#4b3326" />
    </svg>
  );
}

const DRAWN = { bunny: Bunny, paws: Paws, notes: Notes, stars: Stars, boba: Boba };

/**
 * "…is typing": the style the person typing chose (round 4: theirs to pick, the other one sees it).
 * The first four are the chat's originals; the rest are drawn here.
 */
export function TypingIndicator({ style = "hearts", name }) {
  if (CLASSIC.has(style) || !DRAWN[style]) return <Classic style={CLASSIC.has(style) ? style : "hearts"} name={name} />;
  const Drawn = DRAWN[style];
  return (
    <div className="typing" data-style={style} role="status" aria-label={`${name} is typing`}>
      <Drawn />
      <span className="typing__label">{name} is typing…</span>
    </div>
  );
}
