import { Link } from "react-router";
import { nameOf, otherOf, useQuizSummary } from "./api.js";
import "./entry.css";

/**
 * The play hub's door to quizzes for each other (placed by the frame agent): a little stack of quiz
 * cards, what's waiting, and her streak. Light on purpose: the screens load only when it's opened.
 */
export function QuizzesEntry({ className = "" }) {
  const { data } = useQuizSummary();
  const me = data?.me;
  const them = me ? nameOf(data.names, otherOf(me)) : null;
  const waiting = data?.waiting ?? 0;
  const results = data?.results ?? 0;
  const streak = me ? data.stats?.[me]?.streak ?? 0 : 0;

  let line = them ? `ask ${them} something ♡` : "little questions for each other ♡";
  if (results > 0) line = `${results === 1 ? "an answer" : `${results} answers`} to see ✨`;
  if (waiting > 0) line = `${waiting} waiting for you${data.from ? ` from ${data.from.toLowerCase()}` : ""}`;

  return (
    <Link
      to="/world/play/quizzes"
      className={`quiz-entry ${className}`.trim()}
      aria-label={`quizzes for each other. ${line}${streak ? `. ${streak}-day streak` : ""}`}
    >
      <span className="quiz-entry__inner">
      <span className="quiz-entry__art" aria-hidden="true">
        <span className="quiz-entry__card quiz-entry__card--back">💜</span>
        <span className="quiz-entry__card quiz-entry__card--mid">🍓</span>
        <span className="quiz-entry__card quiz-entry__card--front">
          <i>?</i>
        </span>
      </span>
      <span className="quiz-entry__words">
        <span className="quiz-entry__kicker">for each other</span>
        <strong className="quiz-entry__title">quizzes</strong>
        <span className="quiz-entry__line">{line}</span>
      </span>
      <span className="quiz-entry__side" aria-hidden="true">
        {waiting > 0 ? <span className="quiz-entry__badge">{waiting > 9 ? "9+" : waiting}</span> : results > 0 ? <span className="quiz-entry__badge quiz-entry__badge--soft">✨</span> : null}
        {streak > 0 && <span className="quiz-entry__streak">🔥 {streak}</span>}
      </span>
      </span>
    </Link>
  );
}

export default QuizzesEntry;
