import { Suspense, lazy } from "react";
import { Route, Routes, useNavigate } from "react-router";
import { useSession } from "../lib/session.js";
import PageLoader from "../shared/PageLoader.jsx";
import UnlockSheet from "../shared/UnlockSheet.jsx";
import WorldShell from "./WorldShell.jsx";
import TodayPage from "./today/TodayPage.jsx";
import "../styles/japanese-fonts.css";

const ArtPage = lazy(() => import("./collection/ArtPage.jsx"));
const LettersPage = lazy(() => import("./letters/LettersPage.jsx"));
const StudioPage = lazy(() => import("./studio/StudioPage.jsx"));
const StagePage = lazy(() => import("./stage/StagePage.jsx"));
const AtelierPage = lazy(() => import("./atelier/AtelierPage.jsx"));
const ApothecaryPage = lazy(() => import("./apothecary/ApothecaryPage.jsx"));
const SettingsPage = lazy(() => import("./settings/SettingsPage.jsx"));
const SavesPage = lazy(() => import("./saves/SavesPage.jsx"));
const MerchPage = lazy(() => import("./merch/MerchPage.jsx"));
const NotesPage = lazy(() => import("./notes/NotesPage.jsx"));

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

  return (
    <Routes>
      <Route element={<WorldShell />}>
        <Route index element={<TodayPage />} />
        <Route path="letters" element={lazyPage(LettersPage)} />
        <Route path="art" element={lazyPage(ArtPage)} />
        <Route path="studio" element={lazyPage(StudioPage)} />
        <Route path="stage" element={lazyPage(StagePage)} />
        <Route path="atelier" element={lazyPage(AtelierPage)} />
        <Route path="apothecary" element={lazyPage(ApothecaryPage)} />
        <Route path="settings" element={lazyPage(SettingsPage)} />
        <Route path="saves" element={lazyPage(SavesPage)} />
        <Route path="merch" element={lazyPage(MerchPage)} />
        <Route path="notes" element={lazyPage(NotesPage)} />
        <Route path="*" element={<TodayPage />} />
      </Route>
    </Routes>
  );
}
