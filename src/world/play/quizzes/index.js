// Quizzes for each other (docs/refactor/PLAN.md phase 5).
// - QuizzesEntry: the play hub's card (light; the frame agent places it).
// - QuizzesPage: every quiz screen under /world/play/quizzes/* (World.jsx loads it lazily).
export { QuizzesEntry } from "./QuizzesEntry.jsx";
export const loadQuizzesPage = () => import("./QuizzesPage.jsx");
