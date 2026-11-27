import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router";
import MeHome from "./MeHome.jsx";
import CharacterScreen from "./CharacterScreen.jsx";
import {
  FavesScreen,
  IconScreen,
  NotificationsScreen,
  PageScreen,
  PassphraseScreen,
  SharingScreen,
  SongsScreen,
  TalkScreen,
} from "./SettingsScreens.jsx";
import { PassphrasesScreen, PhotosScreen, StatusScreen, TryScreen, WidgetsScreen } from "./AdminScreens.jsx";
import "./MeSection.css";

const SheetLab = import.meta.env.DEV ? lazy(() => import("./SheetLab.jsx")) : null;

// The app's last section, named after whoever is signed in (docs/refactor/RENOVATION.md, owner:
// the me agent). Hers: her little world at a glance and her settings. Josh's: the same (so he sees
// and tests her side), plus his desk. Each setting is a pushed screen at /world/me/<screen>.
export default function MeSection() {
  const [params] = useSearchParams();
  if (SheetLab && params.get("lab") === "sheet")
    return (
      <Suspense fallback={null}>
        <SheetLab />
      </Suspense>
    );
  return (
    <Routes>
      <Route index element={<MeHome />} />
      <Route path="icon" element={<IconScreen />} />
      <Route path="companion" element={<CharacterScreen />} />
      <Route path="notifications" element={<NotificationsScreen />} />
      <Route path="passphrase" element={<PassphraseScreen />} />
      <Route path="page" element={<PageScreen />} />
      <Route path="sharing" element={<SharingScreen />} />
      <Route path="songs" element={<SongsScreen />} />
      <Route path="faves" element={<FavesScreen />} />
      <Route path="talk" element={<TalkScreen />} />
      <Route path="widgets" element={<WidgetsScreen />} />
      <Route path="try" element={<TryScreen />} />
      <Route path="photos" element={<PhotosScreen />} />
      <Route path="passphrases" element={<PassphrasesScreen />} />
      <Route path="status" element={<StatusScreen />} />
      <Route path="*" element={<Navigate replace to="/world/me" />} />
    </Routes>
  );
}
