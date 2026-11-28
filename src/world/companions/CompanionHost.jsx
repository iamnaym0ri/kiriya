import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { isAppShell } from "../../lib/native.js";
import { usePrefs } from "../../lib/prefs.js";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday } from "../../lib/world.js";
import MaomaoCompanion from "../mascot/MaomaoCompanion.jsx";
import { watchCover } from "./engine/cover.js";

// The engine is its own chunk: the website never downloads it.
const Stage = lazy(() => import("./engine/Stage.jsx"));

/** Dev pages with stages (or full-screen games) of their own: nobody else on them. */
const OWN_STAGE = /^\/world\/(companion-lab|game-lab)(\/|$)/;

// Where the companions are mounted (docs/refactor/RENOVATION.md, owner: the stage agent).
// The website keeps Maomao walking every page, as before. In the app, the character she picked lives
// on every page (round 3b): one stage for the whole app shell, mounted once and kept across tabs, so
// it keeps its spot, its stay and what it was doing; each page's own layout gives it its levels.
export default function CompanionHost() {
  if (!isAppShell()) return <MaomaoCompanion />;
  return <AppCompanions />;
}

/**
 * Her companion. Josh's phone reads her settings too (GET /me/prefs answers with hers there), so it
 * is her choice on both phones; the engine never writes prefs (stay spots live on each phone).
 */
function useCompanionPick() {
  const prefs = usePrefs();
  return prefs.isPending ? null : (prefs.data?.companion ?? "maomao");
}

/** True while a sheet, pop-up, viewer or game is open over the page (engine/cover.js). */
function useCovered() {
  const [covered, setCovered] = useState(false);
  useEffect(() => watchCover(setCovered, () => document.querySelector("[data-companion-stage]")), []);
  return covered;
}

function AppCompanions() {
  const { pathname } = useLocation();
  const pick = useCompanionPick();
  const profile = usePublicProfile();
  const today = useToday();
  const covered = useCovered();
  const control = useRef(null);
  // Dev only: the running stage for scripts (the lab has its own, window.__companionStage).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const timer = setInterval(() => (window.__companionApp = control.current), 500);
    return () => clearInterval(timer);
  }, []);
  if (!pick || pick === "none") return null;
  return (
    <Suspense fallback={null}>
      <Stage
        hostId={pick}
        active={!covered && !OWN_STAGE.test(pathname)}
        page={pathname}
        controlRef={control}
        name={profile.data?.name ?? ""}
        birthday={Boolean(today.data?.birthday?.isBirthday)}
      />
    </Suspense>
  );
}
