import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { isAppShell } from "../../lib/native.js";
import { usePrefs } from "../../lib/prefs.js";
import { usePublicProfile } from "../../lib/profile.js";
import { useToday } from "../../lib/world.js";
import MaomaoCompanion from "../mascot/MaomaoCompanion.jsx";

// The engine is its own chunk: the website never downloads it.
const Stage = lazy(() => import("./engine/Stage.jsx"));

const isHome = (pathname) => pathname === "/world" || pathname === "/world/";

// Where the companions are mounted (docs/refactor/RENOVATION.md, owner: the stage agent).
// The website keeps Maomao walking every page, as before. In the app, the character she picked
// lives on the home section only; the other sections stay clear.
export default function CompanionHost() {
  if (!isAppShell()) return <MaomaoCompanion />;
  return <AppCompanions />;
}

function AppCompanions() {
  const { pathname } = useLocation();
  const home = isHome(pathname);
  const prefs = usePrefs();
  const profile = usePublicProfile();
  const today = useToday();
  // Mounted the first time she reaches home, then kept (paused and hidden) while she is in other
  // tabs, so coming back finds her character where she left it, mid-thought.
  const [seen, setSeen] = useState(home);
  useEffect(() => {
    if (home) setSeen(true);
  }, [home]);
  if (!seen || prefs.isPending) return null;
  const pick = prefs.data?.companion ?? "maomao";
  if (pick === "none") return null;
  return (
    <Suspense fallback={null}>
      <Stage
        hostId={pick}
        active={home}
        name={profile.data?.name ?? ""}
        birthday={Boolean(today.data?.birthday?.isBirthday)}
      />
    </Suspense>
  );
}
