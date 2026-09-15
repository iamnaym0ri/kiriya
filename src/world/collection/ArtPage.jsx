import { Navigate } from "react-router";
export default function ArtPage() {
  return <Navigate replace to="/world?gallery=1#play-desk" />;
}
