import { Hono } from "hono";
import { requireRole } from "./auth/session.js";
import { sessionRoutes } from "./routes/session.js";
import { publicRoutes } from "./routes/public.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { jobRoutes } from "./routes/jobs.js";
import { pushRoutes } from "./routes/push.js";
import { uploadRoutes } from "./routes/uploads.js";
import { feedRoutes, feedAdminRoutes, feedJobRoutes } from "./routes/feeds.js";
import { adminLoveNoteRoutes } from "./routes/loveNotes.js";
import { widgetRoutes } from "./routes/widget.js";

const app = new Hono().basePath("/api");

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
app.route("/session", sessionRoutes);
app.route("/public", publicRoutes);

app.use("/me/*", requireRole("kiriya", "admin"));
app.route("/me", feedRoutes);
app.route("/me", meRoutes);

app.use("/push/*", requireRole("kiriya", "admin"));
app.route("/push", pushRoutes);

app.use("/admin/*", requireRole("admin"));
app.route("/admin/feeds", feedAdminRoutes);
app.route("/admin/love-notes", adminLoveNoteRoutes);
app.route("/admin", adminRoutes);

app.route("/jobs/feeds", feedJobRoutes);
app.route("/jobs", jobRoutes);
app.route("/uploads", uploadRoutes);
app.route("/widget", widgetRoutes);

app.notFound((c) => c.json({ error: "not_found", message: "Nothing lives at this address." }, 404));
app.onError((error, c) => {
  // Database/provider errors can contain connection strings or signed URLs.
  console.error("[api]", c.req.method, c.req.path, error.name);
  return c.json({ error: "server_error", message: "Something broke on our side. Try again in a moment." }, 500);
});

export default app;
