import { QuizzesEntry } from "./QuizzesEntry.jsx";

// Dev only (/world/play/quizzes/entry-lab): the play hub card on its own, until the hub places it.
export default function EntryLab() {
  return (
    <div className="app-section">
      <header className="app-section__head">
        <h1 className="app-section__title">play</h1>
      </header>
      <div className="app-section__body">
        <QuizzesEntry />
        <div style={{ maxWidth: 220 }}>
          <QuizzesEntry />
        </div>
      </div>
    </div>
  );
}
