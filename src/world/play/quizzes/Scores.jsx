import { Link } from "react-router";
import { useAppBack } from "../../../shared/AppFrame.jsx";
import { nameOf, otherOf, useQuizzes } from "./api.js";

const HOME = "/world/play/quizzes";

function Ticket({ role, me, names, stats }) {
  const s = stats[role];
  const knows = s.guessed ? Math.round((s.right / s.guessed) * 100) : null;
  const who = role === me ? "you" : nameOf(names, role);
  const them = nameOf(names, otherOf(role));
  return (
    <section className={`quiz-ticket quiz-ticket--${role === me ? "me" : "them"}`} aria-label={`${who}: ${s.points} points`}>
      <h2 className="quiz-ticket__name">{who}</h2>
      <p className="quiz-ticket__points">
        <strong>{s.points}</strong>
        <span>{s.points === 1 ? "point" : "points"} ✦</span>
      </p>
      <dl className="quiz-ticket__facts">
        <div>
          <dt>streak</dt>
          <dd className={s.streak ? "" : "is-cold"}>
            🔥 {s.streak} {s.streak === 1 ? "day" : "days"}
          </dd>
        </div>
        <div>
          <dt>best streak</dt>
          <dd>
            {s.best} {s.best === 1 ? "day" : "days"}
          </dd>
        </div>
        <div>
          <dt>knows {role === me ? them : "you"}</dt>
          <dd>{knows == null ? "—" : `${knows}%`}</dd>
        </div>
        <div>
          <dt>right in a row</dt>
          <dd>{s.inARow}</dd>
        </div>
        <div>
          <dt>sent</dt>
          <dd>{s.sent}</dd>
        </div>
        <div>
          <dt>answered</dt>
          <dd>{s.answered}</dd>
        </div>
      </dl>
      {role === me && s.streak > 0 && !s.playedToday && <p className="quiz-ticket__nudge">play today to keep it going</p>}
      {role === me && s.playedToday && <p className="quiz-ticket__nudge is-done">today counts ✓</p>}
    </section>
  );
}

/** Scores and streaks, side by side, with what earns them. */
export default function Scores() {
  const back = useAppBack(HOME);
  const { data, isPending } = useQuizzes();
  const me = data?.me;
  const stats = data?.stats;

  return (
    <div className="app-screen quiz-page quiz-page--scores">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          quizzes
        </button>
        <h1 className="app-section__title">scores & streaks</h1>
      </header>
      <div className="app-section__body">
        {isPending && <div className="quiz-tickets quiz-tickets--skeleton" aria-label="opening scores" />}
        {stats && (
          <>
            <div className="quiz-tickets">
              <Ticket role={me} me={me} names={data.names} stats={stats} />
              <Ticket role={otherOf(me)} me={me} names={data.names} stats={stats} />
            </div>
            <section className="app-card app-card--tint quiz-sync">
              <span className="quiz-sync__heart" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path d="M12 20.5s-7.5-4.4-9.2-9.3C1.6 7.8 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.3 4.4 6.7-1.7 4.9-9.2 9.3-9.2 9.3z" fill="#e0669d" />
                </svg>
              </span>
              <p>
                <strong>
                  in sync {stats.sync} {stats.sync === 1 ? "time" : "times"}
                </strong>
                <span>about-us quizzes where you both picked the same answer</span>
              </p>
            </section>
            <section className="app-card quiz-rules">
              <header className="app-card__head">
                <h2 className="app-card__title">how it works</h2>
              </header>
              <ul className="app-card__body">
                <li>
                  <span aria-hidden="true">✦</span> a point for every right guess on an about-me quiz
                </li>
                <li>
                  <span aria-hidden="true">♡</span> a point each when you’re in sync on an about-us quiz
                </li>
                <li>
                  <span aria-hidden="true">🔥</span> your streak grows on each day you send or answer a quiz, and waits for you until a whole day goes by
                </li>
              </ul>
            </section>
            <ul className="app-list">
              <li className="app-row app-row--more">
                <Link to={`${HOME}/history`}>
                  <span className="app-row__text">all past quizzes</span>
                </Link>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
