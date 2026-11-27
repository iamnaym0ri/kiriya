import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router";
import QuizzesHome from "./QuizzesHome.jsx";
import QuizScreen from "./QuizScreen.jsx";
import Composer from "./Composer.jsx";
import Scores from "./Scores.jsx";
import History from "./History.jsx";
import "./quizzes.css";

// Every quiz screen, under /world/play/quizzes (a pushed screen of the play tab):
//   /                 waiting for you, new answers, waiting for them, past quizzes, scores at a glance
//   /new              writing a quiz
//   /scores           scores and streaks
//   /history          every past quiz
//   /<id>             one quiz: answering it and the reveal, or its result
// A notification links to /world/play/quizzes?open=<id>, which becomes /world/play/quizzes/<id>.
const EntryLab = import.meta.env.DEV ? lazy(() => import("./EntryLab.jsx")) : null;

function Index() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const open = params.get("open");
  useEffect(() => {
    if (open) navigate(`/world/play/quizzes/${encodeURIComponent(open)}`, { replace: true });
  }, [open, navigate]);
  return open ? null : <QuizzesHome />;
}

export default function QuizzesPage() {
  return (
    <Routes>
      <Route index element={<Index />} />
      <Route path="new" element={<Composer />} />
      <Route path="scores" element={<Scores />} />
      <Route path="history" element={<History />} />
      {EntryLab && (
        <Route
          path="entry-lab"
          element={
            <Suspense fallback={null}>
              <EntryLab />
            </Suspense>
          }
        />
      )}
      <Route path=":id" element={<QuizScreen />} />
      <Route path="*" element={<Navigate replace to="/world/play/quizzes" />} />
    </Routes>
  );
}
