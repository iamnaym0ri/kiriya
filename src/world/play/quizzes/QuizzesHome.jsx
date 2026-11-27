import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAppBack } from "../../../shared/AppFrame.jsx";
import { nameOf, otherOf, timeAgo, useQuizzes } from "./api.js";
import { MODE_LABEL, QuizPicture, answererOf, resultWords } from "./parts.jsx";
import { takeSentNote } from "./sentNote.js";

const HOME = "/world/play/quizzes";

/** The two of them side by side: points and streaks. Opens the scores screen. */
export function ScoreStrip({ stats, me, names }) {
  if (!stats) return <div className="quiz-scores quiz-scores--skeleton" aria-hidden="true" />;
  const them = otherOf(me);
  const side = (role) => {
    const s = stats[role];
    return (
      <span className={`quiz-scores__side quiz-scores__side--${role === me ? "me" : "them"}`}>
        <span className="quiz-scores__name">{role === me ? "you" : nameOf(names, role)}</span>
        <span className="quiz-scores__points">
          {s.points}
          <small>✦</small>
        </span>
        <span className={`quiz-scores__streak${s.streak ? "" : " is-cold"}`}>{s.streak ? `🔥 ${s.streak} ${s.streak === 1 ? "day" : "days"}` : "no streak yet"}</span>
      </span>
    );
  };
  return (
    <Link to={`${HOME}/scores`} className="quiz-scores" aria-label={`scores: you ${stats[me].points} points, ${nameOf(names, them)} ${stats[them].points}. open scores and streaks`}>
      {side(me)}
      <span className="quiz-scores__heart" aria-hidden="true">
        <span>♡</span>
        <small>{stats.sync} in sync</small>
      </span>
      {side(them)}
    </Link>
  );
}

function streakNudge(stats, me) {
  const mine = stats?.[me];
  if (!mine) return null;
  if (mine.streak > 0 && !mine.playedToday) return `🔥 answer or send one today to keep your ${mine.streak}-day streak`;
  if (mine.streak === 0) return "🔥 send or answer one a day to start a streak";
  return null;
}

/** A waiting quiz as a little card: its picture, the question, and "answer". */
function WaitingCard({ quiz, me, names }) {
  return (
    <Link to={`${HOME}/${quiz.id}`} className="quiz-teaser">
      <QuizPicture image={quiz.image} choices={quiz.choices} compact credit={false} />
      <span className="quiz-teaser__body">
        <span className="quiz-teaser__meta">
          <span className={`quiz-mode quiz-mode--${quiz.mode}`}>{MODE_LABEL[quiz.mode]}</span>
          {quiz.test && <span className="quiz-mode quiz-mode--test">test</span>}
          <span>
            from {nameOf(names, quiz.from)} · {timeAgo(quiz.createdAt)}
          </span>
        </span>
        <span className="quiz-teaser__question">{quiz.question}</span>
        <span className="quiz-teaser__emoji" aria-hidden="true">
          {quiz.choices.map((c) => c.emoji).join(" ")}
        </span>
        <span className="quiz-teaser__go">answer ♡</span>
      </span>
    </Link>
  );
}

/** A quiz as a row: its picture (or first emoji) as the icon, the question, and a line under it. */
export function QuizRow({ quiz, line, detail, isNew = false }) {
  return (
    <li className="app-row app-row--more quiz-row">
      <Link to={`${HOME}/${quiz.id}`}>
        <span className="quiz-row__thumb" aria-hidden="true">
          {quiz.image?.url ? <img src={quiz.image.url} alt="" loading="lazy" decoding="async" /> : <span>{quiz.choices[0]?.emoji}</span>}
        </span>
        <span className="app-row__text">
          <span className="quiz-row__question">{quiz.question}</span>
          <small>{line}</small>
        </span>
        {isNew && <span className="quiz-row__new">new</span>}
        {detail && <span className="app-row__detail">{detail}</span>}
      </Link>
    </li>
  );
}

const RESULT_MARK = { right: "✓", wrong: "✗", match: "♡", differ: "✿" };

/** The line under a past quiz: what happened, from whoever is looking. */
export function historyLine(quiz, me, names) {
  const words = resultWords(quiz, me, names);
  if (!words) return quiz.from === me ? "you asked" : `${nameOf(names, quiz.from)} asked`;
  return `${words.title.replace(/ ✨$/, "")} · ${timeAgo(quiz.reply?.at ?? quiz.createdAt)}${quiz.test ? " · test" : ""}`;
}

export function resultMark(quiz) {
  return <span className={`quiz-mark quiz-mark--${quiz.result}`}>{RESULT_MARK[quiz.result] ?? ""}</span>;
}

export default function QuizzesHome() {
  const back = useAppBack("/world/play");
  const { data, isPending, isError, refetch } = useQuizzes();
  const [sentNote, setSentNote] = useState(null);

  useEffect(() => {
    const note = takeSentNote();
    if (!note) return undefined;
    setSentNote(note);
    const timer = setTimeout(() => setSentNote(null), 4200);
    return () => clearTimeout(timer);
  }, []);

  const me = data?.me;
  const names = data?.names;
  const them = me ? nameOf(names, otherOf(me)) : "";
  const nudge = streakNudge(data?.stats, me);
  // A new answer shows under "new answers" until it's been looked at, not twice.
  const past = (data?.history ?? []).filter((quiz) => !data.results.some((r) => r.id === quiz.id));

  return (
    <div className="app-screen quiz-page">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          play
        </button>
        <h1 className="app-section__title">quizzes</h1>
        <div className="app-section__actions">
          <Link to={`${HOME}/new`} className="app-action quiz-compose" aria-label="write a quiz">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
              <path d="m13.5 6.5 4 4" />
            </svg>
          </Link>
        </div>
        <p className="app-section__subtitle">little questions for each other ♡</p>
      </header>

      <div className="app-section__body">
        {sentNote && (
          <p className="quiz-toast" role="status">
            {sentNote}
          </p>
        )}
        {data?.testMode && <p className="quiz-note quiz-note--test">test mode is on: quizzes you send now only reach your own phone, and you can answer them yourself to see what she’d see.</p>}

        <ScoreStrip stats={data?.stats} me={me} names={names} />
        {nudge && <p className="quiz-nudge">{nudge}</p>}

        {isError && !data && (
          <div className="app-card app-empty">
            <strong>quizzes didn’t open</strong>
            <span>check the connection and try again</span>
            <button type="button" className="quiz-button" onClick={() => refetch()}>
              try again
            </button>
          </div>
        )}
        {isPending && <div className="quiz-teaser quiz-teaser--skeleton" aria-label="opening quizzes" />}

        {data && (
          <>
            {data.waiting.length > 0 ? (
              <section className="quiz-group" aria-labelledby="quiz-waiting-title">
                <h2 className="app-group-title" id="quiz-waiting-title">
                  waiting for you · {data.waiting.length}
                </h2>
                <WaitingCard quiz={data.waiting[0]} me={me} names={names} />
                {data.waiting.length > 1 && (
                  <ul className="app-list">
                    {data.waiting.slice(1).map((quiz) => (
                      <QuizRow key={quiz.id} quiz={quiz} line={`${MODE_LABEL[quiz.mode]} · from ${nameOf(names, quiz.from)} · ${timeAgo(quiz.createdAt)}`} />
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <Link to={`${HOME}/new`} className="quiz-invite">
                <span className="quiz-invite__cards" aria-hidden="true">
                  <span>🍓</span>
                  <span>💜</span>
                  <span>✨</span>
                </span>
                <span className="quiz-invite__words">
                  <strong>nothing waiting for you</strong>
                  <span>write one for {them}? {them === "kiriya" ? "she’ll" : "he’ll"} get a little ping ♡</span>
                </span>
                <span className="quiz-button quiz-button--primary">write a quiz ✎</span>
              </Link>
            )}

            {data.results.length > 0 && (
              <section className="quiz-group" aria-labelledby="quiz-results-title">
                <h2 className="app-group-title" id="quiz-results-title">
                  new answers
                </h2>
                <ul className="app-list">
                  {data.results.map((quiz) => (
                    <QuizRow key={quiz.id} quiz={quiz} line={`${nameOf(names, answererOf(quiz))} answered · tap to see ✨`} isNew />
                  ))}
                </ul>
              </section>
            )}

            {data.sent.length > 0 && (
              <section className="quiz-group" aria-labelledby="quiz-sent-title">
                <h2 className="app-group-title" id="quiz-sent-title">
                  waiting for {them}
                </h2>
                <ul className="app-list">
                  {data.sent.map((quiz) => (
                    <QuizRow key={quiz.id} quiz={quiz} line={`${MODE_LABEL[quiz.mode]} · sent ${timeAgo(quiz.createdAt)}`} />
                  ))}
                </ul>
              </section>
            )}

            {past.length > 0 && (
              <section className="quiz-group" aria-labelledby="quiz-history-title">
                <h2 className="app-group-title" id="quiz-history-title">
                  past quizzes
                </h2>
                <ul className="app-list">
                  {past.slice(0, 5).map((quiz) => (
                    <QuizRow key={quiz.id} quiz={quiz} line={historyLine(quiz, me, names)} detail={resultMark(quiz)} />
                  ))}
                  <li className="app-row app-row--more">
                    <Link to={`${HOME}/history`}>
                      <span className="app-row__text">all past quizzes</span>
                    </Link>
                  </li>
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
