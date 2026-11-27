import { useAppBack } from "../../../shared/AppFrame.jsx";
import { useQuizHistory, useQuizzes } from "./api.js";
import { QuizRow, historyLine, resultMark } from "./QuizzesHome.jsx";

const HOME = "/world/play/quizzes";

/** Every answered quiz, both ways, newest answer first. */
export default function History() {
  const back = useAppBack(HOME);
  const overview = useQuizzes();
  const history = useQuizHistory();
  const me = overview.data?.me;
  const names = overview.data?.names;
  const items = (history.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="app-screen quiz-page quiz-page--history">
      <header className="app-section__head">
        <button type="button" className="app-screen__back" onClick={back}>
          quizzes
        </button>
        <h1 className="app-section__title">past quizzes</h1>
        <p className="app-section__subtitle">every question you’ve asked each other</p>
      </header>
      <div className="app-section__body">
        {history.isPending && <div className="quiz-teaser quiz-teaser--skeleton" aria-label="opening past quizzes" />}
        {history.isError && !items.length && (
          <div className="app-card app-empty">
            <strong>that didn’t open</strong>
            <button type="button" className="quiz-button" onClick={() => history.refetch()}>
              try again
            </button>
          </div>
        )}
        {history.isSuccess && !items.length && (
          <div className="app-card app-empty">
            <strong>no answers yet</strong>
            <span>answered quizzes land here, with who got what ♡</span>
          </div>
        )}
        {items.length > 0 && me && (
          <ul className="app-list">
            {items.map((quiz) => (
              <QuizRow key={quiz.id} quiz={quiz} line={historyLine(quiz, me, names)} detail={resultMark(quiz)} />
            ))}
          </ul>
        )}
        {history.hasNextPage && (
          <button type="button" className="quiz-button quiz-more" onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            {history.isFetchingNextPage ? "opening…" : "older quizzes"}
          </button>
        )}
      </div>
    </div>
  );
}
