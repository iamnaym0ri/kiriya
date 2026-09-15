import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/world-design.css";
import { MusicProvider } from "./shared/music/MusicRoom.jsx";
import { PlayfulProvider } from "./shared/play/PlayfulWorld.jsx";
import "./styles/strawpage.css";
import ProfilePage from "./public/ProfilePage.jsx";
import PageLoader from "./shared/PageLoader.jsx";

// The private world and the admin desk are separate chunks: a visitor's phone never downloads them.
const World = lazy(() => import("./world/World.jsx"));
const Admin = lazy(() => import("./admin/Admin.jsx"));

const queryClient = new QueryClient({
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
          </PlayfulProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
