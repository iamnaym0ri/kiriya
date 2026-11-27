import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PERSIST_MAX_AGE, persistOptions } from "./lib/persist.js";
import { forgetSession, isSessionEnded, sessionKey } from "./lib/session.js";
import { MotionConfig } from "motion/react";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/world-design.css";
import { MusicProvider } from "./shared/music/MusicRoom.jsx";
import { PlayfulProvider } from "./shared/play/PlayfulWorld.jsx";
import { DailyStyleProvider } from "./shared/DailyStyle.jsx";
import "./styles/strawpage.css";
import "./styles/daily-style.css";
import "./styles/feeling-corner.css";
import "./styles/in-app.css";
import ProfilePage from "./public/ProfilePage.jsx";
import PageLoader from "./shared/PageLoader.jsx";
import { isNativeApp, isAppShell } from "./lib/native.js";

// The private world and the admin desk are separate chunks: a visitor's phone never downloads them.
const World = lazy(() => import("./world/World.jsx"));
const Admin = lazy(() => import("./admin/Admin.jsx"));
// Only inside the kiriya.love iPhone app: Face ID, native notifications. Browsers never load it.
const NativeApp = isNativeApp() ? lazy(() => import("./shared/NativeApp.jsx")) : null;
// Lets the app-only styles (styles/in-app.css) apply before the first paint.
if (NativeApp) document.documentElement.classList.add("in-app");
// The app layout (five sections), in the app and in the local ?app=1 preview (lib/native.js).
if (isAppShell()) document.documentElement.classList.add("app-shell");

// When a session ends mid-visit, go back to the passphrase instead of showing broken pages.
function onSessionEnded(error) {
  if (isSessionEnded(error) && queryClient.getQueryData(sessionKey)?.role) forgetSession(queryClient);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onSessionEnded }),
  mutationCache: new MutationCache({ onError: onSessionEnded }),
  defaultOptions: {
    queries: {
      retry: (count, error) => error?.status !== 401 && count < 2,
      refetchOnWindowFocus: false,
      // Kept as long as the device copy (lib/persist.js), so restored pages aren't dropped unseen.
      gcTime: PERSIST_MAX_AGE,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <PlayfulProvider>
            <DailyStyleProvider>
            <MusicProvider>
              {NativeApp && (
                <Suspense fallback={null}>
                  <NativeApp />
                </Suspense>
              )}
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ProfilePage />} />
                  <Route path="/world/*" element={<World />} />
                  <Route path="/admin/*" element={<Admin />} />
                  <Route path="*" element={<ProfilePage />} />
                </Routes>
              </Suspense>
            </MusicProvider>
            </DailyStyleProvider>
          </PlayfulProvider>
        </BrowserRouter>
      </MotionConfig>
    </PersistQueryClientProvider>
  </StrictMode>,
);
