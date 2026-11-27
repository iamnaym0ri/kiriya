import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useSession } from "../../lib/session.js";
import { enrolledDevice, isNativeApp } from "../../lib/native.js";
import ProfilePage from "../../public/ProfilePage.jsx";
import AppSignIn from "./AppSignIn.jsx";

/**
 * The app's front door ("/" inside the app; the website keeps its public page there). Signed in, it
 * goes straight to her world; signed out, it's the sign-in screen. A phone set up for Face ID shows
 * only the lilac here, because NativeApp covers it with Face ID first (and its own passphrase
 * fallback). `?view=public` still shows her page as friends see it.
 */
export default function AppEntry() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const devFaceId = useDevFaceId(params);
  const role = session.data?.role ?? null;
  if (params.get("view") === "public") return <ProfilePage />;
  if (session.isPending) return <div className="app-signin app-signin--blank" />;
  if (role) return <Navigate to="/world" replace />;
  if (isNativeApp() && enrolledDevice()) return <div className="app-signin app-signin--blank" />;
  return <AppSignIn faceId={devFaceId} onUnlocked={() => navigate("/world", { replace: true })} />;
}

/** Development only: `/?app=1&signin=faceid` shows the Face ID version (the scan always "fails"). */
function useDevFaceId(params) {
  const [busy, setBusy] = useState(false);
  if (!import.meta.env.DEV || params.get("signin") !== "faceid") return null;
  return {
    label: "try Face ID again",
    busy,
    onPress: () => {
      setBusy(true);
      setTimeout(() => setBusy(false), 700);
    },
  };
}
