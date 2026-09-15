import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// In development the same Hono app that runs on Vercel answers /api/* inside the Vite server.
function devApi() {
  return {
    name: "kiriya-dev-api",
    apply: "serve",
    async configureServer(server) {
      const { getRequestListener } = await import("@hono/node-server");
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/") && req.url !== "/api") return next();
        try {
          const { default: app } = await server.ssrLoadModule("/server/app.js");
          await getRequestListener(app.fetch)(req, res);
        } catch (error) {
          server.ssrFixStacktrace(error);
          next(error);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server code reads process.env; give it .env / .env.local values in development too.
  Object.assign(process.env, {
    ...loadEnv(mode, process.cwd(), ""),
    ...process.env,
  });

  return {
    plugins: [
      react(),
      devApi(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        registerType: "autoUpdate",
        injectRegister: false,
        manifestFilename: "manifest.webmanifest",
        manifest: {
          id: "/world",
          name: "kiriya ♡",
          short_name: "kiriya",
          description: "A little world made for Kiriya.",
          start_url: "/world",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#f2ebf7",
          theme_color: "#493653",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,webmanifest}"],
          // The Japanese font slices load on demand; precaching hundreds of them would bloat the install.
          globIgnores: ["**/m-plus-rounded-1c-[0-9]*", "**/*.woff"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173 },
    // Pre-bundle libraries that are only imported lazily, so the dev server doesn't have to
    // re-optimise (and reload) the first time a section opens.
    optimizeDeps: {
      include: [
        "mixbox",
        "perfect-freehand",
        "@vercel/blob/client",
        "react-parallax-tilt",
        "typewriter-effect",
        "canvas-confetti",
        "simple-icons",
      ],
    },
  };
});
