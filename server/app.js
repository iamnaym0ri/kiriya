import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerToken, requireRole } from "./auth/session.js";
import { env } from "./env.js";
import { signMediaLinks, unsignMediaLinks } from "./lib/mediaLinks.js";
import { sessionRoutes } from "./routes/session.js";
import { publicRoutes } from "./routes/public.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { jobRoutes } from "./routes/jobs.js";
import { pushRoutes } from "./routes/push.js";
import { uploadRoutes } from "./routes/uploads.js";
import { feedRoutes, feedAdminRoutes, feedJobRoutes } from "./routes/feeds.js";
import { adminLoveNoteRoutes } from "./routes/loveNotes.js";
import { adminNoteJarRoutes } from "./routes/noteJarAdmin.js";
import { widgetRoutes } from "./routes/widget.js";
import { appRoutes, appSessionRoutes } from "./routes/app.js";
import { homeEmbedRoutes, homeRoutes } from "./routes/home.js";

const app = new Hono().basePath("/api");

// The bundled iPhone app (capacitor://localhost) calls this API cross-origin with a bearer token and
// no cookies. Registered first so preflights are answered before the header check below.
app.use(
  "*",
  cors({
    origin: (origin) => (env.appOrigins.includes(origin) ? origin : null),
    allowHeaders: ["Authorization", "Content-Type", "x-kw", "x-kw-token", "Range"],
    allowMethods: ["GET", "HEAD", "PUT", "POST", "PATCH", "DELETE"],
    maxAge: 86400,
    credentials: false,
  }),
);

// For the app only (bearer requests): private media links go out absolute and signed, because its
// <img> tags can't send the token, and come back in their plain stored form. See lib/mediaLinks.js.
app.use("*", async (c, next) => {
  if (!bearerToken(c)) return next();
  const origin = new URL(c.req.url).origin;
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && (c.req.header("content-type") ?? "").includes("application/json")) {
    const text = await c.req.raw.clone().text();
    const plain = unsignMediaLinks(text, origin);
    if (plain !== text) c.req.raw = new Request(c.req.raw, { body: plain });
  }
  await next();
  if (!(c.res.headers.get("content-type") ?? "").includes("application/json")) return;
  const text = await c.res.clone().text();
  const signed = signMediaLinks(text, origin);
  if (signed === text) return;
  const { status, headers: original } = c.res;
  const headers = new Headers(original);
  headers.delete("content-length");
  // Cleared first so Hono doesn't copy the old response's headers (and length) back over these.
  c.res = undefined;
  c.res = new Response(signed, { status, headers });
});

// Every state-changing request must come from this site's own scripts: a JSON body plus a custom
// header that a cross-site form can't send. SameSite=Lax cookies cover the rest.
app.use("*", async (c, next) => {
  if (/^\/api\/(?:me\/(?:feed|faves)|admin\/feeds|jobs\/feeds)(?:\/|$)/.test(c.req.path)) c.header("Cache-Control", "private, no-store");
  const method = c.req.method;
  // Exempt: signed job callbacks, Blob's upload handshake (its client library can't add headers;
  // that route checks the session cookie itself, and SameSite=Lax keeps other sites out), and the
  // phone widget API, which never reads cookies and requires its own device key header.
  const exempt = c.req.path.startsWith("/api/jobs/") || c.req.path === "/api/uploads/blob" || c.req.path === "/api/widget" || c.req.path.startsWith("/api/widget/");
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !exempt) {
    if (c.req.header("x-kw") !== "1") return c.json({ error: "bad_request", message: "Missing request header." }, 400);
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
app.route("/session/app", appSessionRoutes);
app.route("/session", sessionRoutes);
app.route("/public", publicRoutes);

app.use("/me/*", requireRole("kiriya", "admin"));
app.route("/me/home", homeRoutes);
app.route("/me", feedRoutes);
app.route("/me", meRoutes);

app.use("/app/*", requireRole("kiriya", "admin"));
app.route("/app", appRoutes);

app.use("/push/*", requireRole("kiriya", "admin"));
app.route("/push", pushRoutes);

app.use("/admin/*", requireRole("admin"));
app.route("/admin/feeds", feedAdminRoutes);
app.route("/admin/love-notes", adminLoveNoteRoutes);
app.route("/admin/note-jar", adminNoteJarRoutes);
app.route("/admin", adminRoutes);

app.route("/jobs/feeds", feedJobRoutes);
app.route("/jobs", jobRoutes);
app.route("/uploads", uploadRoutes);
app.route("/widget", widgetRoutes);
app.route("/embed", homeEmbedRoutes);

app.notFound((c) => c.json({ error: "not_found", message: "Nothing lives at this address." }, 404));
app.onError((error, c) => {
  // Database/provider errors can contain connection strings or signed URLs.
  console.error("[api]", c.req.method, c.req.path, error.name);
  return c.json({ error: "server_error", message: "Something broke on our side. Try again in a moment." }, 500);
});

export default app;
