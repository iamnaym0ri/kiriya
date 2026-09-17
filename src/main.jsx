import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import ProfilePage from "./public/ProfilePage.jsx";
import PageLoader from "./shared/PageLoader.jsx";

// The private world and the admin desk are separate chunks: a visitor's phone never downloads them.
const World = lazy(() => import("./world/World.jsx"));
const Admin = lazy(() => import("./admin/Admin.jsx"));

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
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <PlayfulProvider>
            <DailyStyleProvider>
            <MusicProvider>
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
    </QueryClientProvider>
  </StrictMode>,
);
