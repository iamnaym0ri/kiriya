import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useAppBack } from "../../../shared/AppFrame.jsx";
import { haptic } from "../../../lib/native.js";
import { nameOf, otherOf, useAnswerQuiz, useDeleteQuiz, useMarkSeen, useQuiz, useQuizzes } from "./api.js";
import { Choices, QuizMeta, QuizPicture, ResultBanner, answererOf } from "./parts.jsx";
import { DRUMROLL_MS, revealCelebration } from "./celebrate.js";

const HOME = "/world/play/quizzes";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One quiz: answering it (pick, lock it in, the reveal), the sender's view while it waits, and the
 * result afterwards, celebrated the first time each of them sees it.
 */
export default function QuizScreen() {
  const { id } = useParams();
  const back = useAppBack(HOME);
  const overview = useQuizzes();
  const query = useQuiz(id);
  const answer = useAnswerQuiz(id);
  const markSeen = useMarkSeen();
  const remove = useDeleteQuiz();
  const [picked, setPicked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [revealed, setRevealed] = useState(null); // the quiz as revealed on this screen
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(false);
  const card = useRef(null);
  const celebrated = useRef(false);

  const me = overview.data?.me;
  const names = overview.data?.names;
  const stats = overview.data?.stats;
  const quiz = revealed ?? query.data;

  // The sender seeing an answer for the first time: a smaller celebration, then it's no longer new.
  useEffect(() => {
    if (!quiz || !me || celebrated.current) return;
    if (quiz.reply && quiz.from === me && !quiz.seenAt && !quiz.test) {
      celebrated.current = true;
      const timer = setTimeout(() => {
        setFresh(true);
        revealCelebration(quiz.result, card.current?.querySelector(".quiz-result"), { power: 0.6 });
      }, 350);
      markSeen.mutate(quiz.id);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [quiz, me]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lockIn() {
    if (!picked || checking) return;
    setError(null);
    setChecking(true);
    haptic("medium");
    try {
      const [result] = await Promise.all([answer.mutateAsync(picked), wait(DRUMROLL_MS())]);
      celebrated.current = true;
      setRevealed(result);
      setFresh(true);
      requestAnimationFrame(() => revealCelebration(result.result, card.current?.querySelector(`[data-state="right"], [data-state="match"], .quiz-result`)));
    } catch (failure) {
      setError(failure?.message || "That answer didn’t go through. Try again?");
    } finally {
      setChecking(false);
    }
  }

  async function takeBack() {
    setError(null);
    try {
      await remove.mutateAsync(quiz.id);
      haptic("light");
      back();
    } catch (failure) {
      setAsking(false);
      setError(failure?.message || "That didn’t work. Try again?");
    }
  }

  const nextWaiting = overview.data?.waiting?.find((item) => item.id !== id && item.canAnswer);

  let body;
  if (!quiz && (query.isPending || overview.isPending)) {
    body = <div className="quiz-card quiz-card--skeleton" aria-label="opening the quiz" />;
  } else if (!quiz) {
    body = (
      <div className="app-card app-empty">
        <strong>this quiz isn’t here any more</strong>
        <span>it may have been taken back ♡</span>
      </div>
    );
  } else {
    const answering = quiz.canAnswer && !quiz.reply;
    const pending = !quiz.reply && !quiz.canAnswer;
    const other = nameOf(names, otherOf(me));
    body = (
      <>
        <article ref={card} className={`quiz-card quiz-card--${quiz.mode}${quiz.reply ? " is-revealed" : ""}`}>
          <QuizPicture image={quiz.image} choices={quiz.choices} />
          <div className="quiz-card__body">
            <QuizMeta quiz={quiz} me={me} names={names} />
            <h2 className="quiz-card__question">{quiz.question}</h2>
            {answering && (
              <p className="quiz-card__hint">
                {quiz.mode === "me" ? `what do you think ${quiz.test ? "she’d" : nameOf(names, quiz.from)} pick?` : "pick yours. same answer = in sync ♡"}
              </p>
            )}
            {quiz.reply && <ResultBanner quiz={quiz} me={me} names={names} stats={stats} fresh={fresh} />}
            <Choices
              quiz={quiz}
              me={me}
              names={names}
              picked={picked}
              waiting={checking}
              onPick={
                answering
                  ? (choice) => {
                      haptic("light");
                      setPicked(choice);
                    }
                  : null
              }
            />
            {answering && (
              <button type="button" className="quiz-button quiz-button--primary quiz-lock" disabled={!picked || checking} onClick={lockIn}>
                {checking ? "checking…" : picked ? "lock it in ♡" : "pick an answer"}
              </button>
            )}
            {pending && (
              <p className="quiz-waiting">
                <span className="quiz-waiting__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                waiting for {other} to answer
              </p>
            )}
            {revealed?.dryRun && <p className="quiz-note">test mode is on, so this answer stayed on your phone. answer it again once test mode is off ♡</p>}
            {error && (
              <p className="quiz-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </article>

        {quiz.reply && (
          <div className="quiz-after">
            {nextWaiting ? (
              <Link className="quiz-button quiz-button--primary" to={`${HOME}/${nextWaiting.id}`} replace>
                next quiz ›
              </Link>
            ) : (
              answererOf(quiz) === me && (
                <Link className="quiz-button quiz-button--primary" to={`${HOME}/new`} replace>
                  write one back ✎
                </Link>
              )
            )}
            <button type="button" className="quiz-button" onClick={back}>
              back to quizzes
            </button>
          </div>
        )}

        {pending && quiz.mine && (
          <div className="quiz-after">
            {asking ? (
              <div className="quiz-confirm" role="alertdialog" aria-label="take it back?">
                <p>take this quiz back? {other} won’t see it any more.</p>
                <div>
                  <button type="button" className="quiz-button" onClick={() => setAsking(false)}>
                    keep it
                  </button>
                  <button type="button" className="quiz-button quiz-button--danger" onClick={takeBack} disabled={remove.isPending}>
                    {remove.isPending ? "taking back…" : "take it back"}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="quiz-button quiz-button--quiet" onClick={() => setAsking(true)}>
                take it back
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-screen quiz-page quiz-page--one">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          quizzes
        </button>
        <h1 className="app-section__title" data-short="quiz">
          {quiz?.canAnswer ? "your turn ♡" : quiz?.reply ? "the answer" : "a quiz"}
        </h1>
      </header>
      <div className="app-section__body">{body}</div>
    </div>
  );
}
