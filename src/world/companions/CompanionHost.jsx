import { useLocation } from "react-router";
import { isAppShell } from "../../lib/native.js";
import MaomaoCompanion from "../mascot/MaomaoCompanion.jsx";

// Where the companions are mounted (docs/refactor/RENOVATION.md, owner: the stage agent).
// The website keeps Maomao walking every page, as before. In the app, the companion she picked
// lives on the home section only; the other sections stay clear.
export default function CompanionHost() {
  const { pathname } = useLocation();
  if (!isAppShell()) return <MaomaoCompanion />;
  const home = pathname === "/world" || pathname === "/world/";
  return home ? <MaomaoCompanion /> : null;
}
