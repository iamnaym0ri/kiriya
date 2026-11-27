import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import SettingsPage from "../settings/SettingsPage.jsx";

const SheetLab = import.meta.env.DEV ? lazy(() => import("./SheetLab.jsx")) : null;

// The app's last section, named after whoever is signed in (docs/refactor/RENOVATION.md, owner:
// the me agent). Hers: her settings and the whole app at a glance. Josh's: the same, plus every
// admin control.
export default function MeSection() {
  const [params] = useSearchParams();
  if (SheetLab && params.get("lab") === "sheet")
    return (
      <Suspense fallback={null}>
        <SheetLab />
      </Suspense>
    );
  return <SettingsPage />;
}
