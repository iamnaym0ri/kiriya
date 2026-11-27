import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { useSession } from "../lib/session.js";
import PageLoader from "../shared/PageLoader.jsx";
import UnlockSheet from "../shared/UnlockSheet.jsx";
import WorldShell from "./WorldShell.jsx";
import TodayPage from "./today/TodayPage.jsx";
import HomeSection from "./home/HomeSection.jsx";
import { isAppShell } from "../lib/native.js";
import "../styles/japanese-fonts.css";

const ArtPage = lazy(() => import("./collection/ArtPage.jsx"));
const LettersPage = lazy(() => import("./letters/LettersPage.jsx"));
const StudioPage = lazy(() => import("./studio/StudioPage.jsx"));
const SettingsPage = lazy(() => import("./settings/SettingsPage.jsx"));
const SavesPage = lazy(() => import("./saves/SavesPage.jsx"));
const MerchPage = lazy(() => import("./merch/MerchPage.jsx"));
const NotesPage = lazy(() => import("./notes/NotesPage.jsx"));
const ChatPage = lazy(() => import("./chat/ChatPage.jsx"));
const MemoriesPage = lazy(() => import("./chat/MemoriesPage.jsx"));
// The app's five sections (docs/refactor/RENOVATION.md): home, chat, play, notes & letters, and
// the last one named after whoever is signed in.
const MailSection = lazy(() => import("./mail/MailSection.jsx"));
const PlaySection = lazy(() => import("./play/PlaySection.jsx"));
const MeSection = lazy(() => import("./me/MeSection.jsx"));
// Dev-only labs for building characters and games (docs/refactor/RENOVATION.md).
const CompanionLab = import.meta.env.DEV ? lazy(() => import("./companions/Lab.jsx")) : null;
const GameLab = import.meta.env.DEV ? lazy(() => import("./play/games/GameLab.jsx")) : null;

const lazyPage = (Page) => (
  <Suspense fallback={<PageLoader />}>
    <Page />
  </Suspense>
);

export default function World() {
  const session = useSession();
  const navigate = useNavigate();

  if (session.isPending) return <PageLoader />;
  if (!session.data?.role) {
    return (
      <div className="world-locked">
        <UnlockSheet open onClose={() => navigate("/")} />
      </div>
    );
  }

  const Home = isAppShell() ? HomeSection : TodayPage;
  return (
    <Routes>
      <Route element={<WorldShell />}>
        <Route index element={<Home />} />
        <Route path="letters" element={lazyPage(LettersPage)} />
        <Route path="art" element={lazyPage(ArtPage)} />
        <Route path="studio" element={lazyPage(StudioPage)} />
        {/* Retired 2026-11-24 (music, dress-up and Maomao club sections): old links and
            notifications land on home instead of a dead page. */}
        <Route path="stage" element={<Navigate replace to="/world" />} />
        <Route path="atelier" element={<Navigate replace to="/world" />} />
        <Route path="apothecary" element={<Navigate replace to="/world" />} />
        <Route path="settings" element={lazyPage(SettingsPage)} />
        <Route path="saves" element={lazyPage(SavesPage)} />
        <Route path="merch" element={lazyPage(MerchPage)} />
        <Route path="notes" element={lazyPage(NotesPage)} />
        <Route path="chat" element={lazyPage(ChatPage)} />
        <Route path="memories" element={lazyPage(MemoriesPage)} />
        <Route path="mail" element={lazyPage(MailSection)} />
        <Route path="play" element={lazyPage(PlaySection)} />
        <Route path="me/*" element={lazyPage(MeSection)} />
        {CompanionLab && <Route path="companion-lab" element={lazyPage(CompanionLab)} />}
        {GameLab && <Route path="game-lab" element={lazyPage(GameLab)} />}
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
