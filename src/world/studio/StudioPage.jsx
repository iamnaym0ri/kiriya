import { Navigate, useLocation } from "react-router";

// Old sketchbook links now land in the single doodle-and-games workspace.
export default function StudioPage() {
  const { search } = useLocation();
  return <Navigate replace to={`/world${search}#play-desk`} />;
}
