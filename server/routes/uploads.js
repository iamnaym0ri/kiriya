import { randomBytes } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Hono } from "hono";
import { handleUpload, handleUploadPresigned } from "@vercel/blob/client";
import { get, issueSignedToken } from "@vercel/blob";
import { env } from "../env.js";
import { readSession } from "../auth/session.js";
import { isPublicMedia } from "../lib/media.js";
import { mediaSignatureOk } from "../lib/mediaLinks.js";
import { fitImage } from "../lib/events/images.js";
import { IMMUTABLE_FOLDERS, UPLOAD_FOLDERS } from "../../shared/uploadFolders.js";
import {
  blobOptions,
  blobReadConfigured,
  blobUploadMode,
} from "../lib/blob.js";

const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  // Voice notes: Safari records audio/mp4, Chrome records audio/webm.
  "audio/webm",
];
const FOLDER_PATH = new RegExp(`^(${UPLOAD_FOLDERS.join("|")})\\/[a-zA-Z0-9][a-zA-Z0-9._-]*$`);
const cacheFor = (pathname) =>
  IMMUTABLE_FOLDERS.some((folder) => pathname.startsWith(`${folder}/`) || pathname.startsWith(`${folder}-`))
    ? "private, max-age=31536000, immutable"
    : "private, no-store";
const MAX_BYTES = 15 * 1024 * 1024;
const LOCAL_DIR = path.resolve(".data/uploads");
const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

export const uploadRoutes = new Hono();
uploadRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

uploadRoutes.get("/config", async (c) => {
  if (!(await readSession(c)))
    return c.json(
      { error: "locked", message: "Enter the passphrase to open this." },
      401,
    );
  return c.json({
    mode: blobUploadMode() ? "blob" : env.isProd ? "unavailable" : "local",
    uploadType: blobUploadMode(),
    maxBytes: MAX_BYTES,
    allowed: ALLOWED,
  });
});

// Vercel Blob client uploads. The browser asks for a short-lived token here (session required), then
// sends the file straight to Blob storage, so large photos never pass through this function.
uploadRoutes.post("/blob", async (c) => {
  const mode = blobUploadMode();
  if (!mode)
    return c.json(
      { error: "not_configured", message: "File storage isn't connected yet." },
      503,
    );
  const body = await c.req.json().catch(() => null);
  if (
    !body ||
    ![
      "blob.generate-client-token",
      "blob.generate-presigned-url",
      "blob.upload-completed",
    ].includes(body.type)
  ) {
    return c.json(
      { error: "bad_request", message: "Invalid upload request." },
      400,
    );
  }
  if (body.type !== "blob.upload-completed" && !(await readSession(c))) {
    return c.json(
      { error: "locked", message: "Enter the passphrase to upload." },
      401,
    );
  }
  // Personal uploads and saved copies share one private store. When a fresh meter shows too little
  // room for another maximum-size upload, refuse the grant instead of risking the store lockout.
  if (body.type !== "blob.upload-completed") {
    const { uploadCapacity } = await import("../feeds/storage.js");
    const capacity = await uploadCapacity(MAX_BYTES).catch(() => ({ ok: true }));
    if (!capacity.ok)
      return c.json(
        {
          error: "storage_full",
          message:
            "Your private storage is nearly full. Remove an old upload or saved copy, then try again.",
        },
        507,
      );
  }
  async function authorizePath(pathname) {
    if (!(await readSession(c))) throw new Error("Upload session is required");
    if (!FOLDER_PATH.test(pathname ?? "")) {
      throw new Error("Unexpected upload path");
    }
  }
  try {
    if (
      body.type === "blob.generate-presigned-url" ||
      (body.type === "blob.upload-completed" && mode === "presigned")
    ) {
      if (mode !== "presigned") return c.json({ error: "not_configured" }, 503);
      const result = await handleUploadPresigned({
        body,
        request: c.req.raw,
        webhookPublicKey: env.blobWebhookPublicKey,
        getSignedToken: async (pathname) => {
          await authorizePath(pathname);
          const constraints = {
            allowedContentTypes: ALLOWED,
            maximumSizeInBytes: MAX_BYTES,
            validUntil: Date.now() + 10 * 60 * 1000,
          };
          return {
            token: await issueSignedToken({
              ...blobOptions(),
              ...constraints,
              pathname,
              operations: ["put"],
              abortSignal: AbortSignal.timeout(15_000),
            }),
            urlOptions: {
              ...constraints,
              addRandomSuffix: true,
              allowOverwrite: false,
            },
          };
        },
      });
      return c.json(result);
    }
    if (!env.blobToken) return c.json({ error: "not_configured" }, 503);
    const result = await handleUpload({
      token: env.blobToken,
      body,
      request: c.req.raw,
      onBeforeGenerateToken: async (pathname) => {
        await authorizePath(pathname);
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return c.json(result);
  } catch {
    return c.json(
      {
        error: "upload_failed",
        message: "The upload couldn't start. Check the file and try again.",
      },
      400,
    );
  }
});

// Development stand-in for Blob storage: files land in .data/uploads and are served back by /api/uploads/file.
uploadRoutes.post("/local", async (c) => {
  if (env.isProd)
    return c.json(
      { error: "not_found", message: "Nothing lives at this address." },
      404,
    );
  if (!(await readSession(c)))
    return c.json(
      { error: "locked", message: "Enter the passphrase to upload." },
      401,
    );
  const type = c.req.header("content-type")?.split(";")[0] ?? "";
  if (!ALLOWED.includes(type))
    return c.json(
      { error: "bad_type", message: "That file type isn't supported." },
      415,
    );
  const buffer = Buffer.from(await c.req.arrayBuffer());
  if (buffer.length > MAX_BYTES)
    return c.json(
      { error: "too_big", message: "Files can be up to 15 MB." },
      413,
    );
  const folder = (c.req.query("folder") ?? "art").replace(/[^a-z]/g, "");
  if (!UPLOAD_FOLDERS.includes(folder))
    return c.json({ error: "bad_folder" }, 400);
  const name = `${folder}-${randomBytes(8).toString("hex")}.${EXT[type]}`;
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, name), buffer);
  return c.json({
    url: `/api/uploads/file/${name}`,
    pathname: name,
    contentType: type,
  });
});

uploadRoutes.get("/file/:name", async (c) => {
  if (env.isProd)
    return c.json(
      { error: "not_found", message: "Nothing lives at this address." },
      404,
    );
  const name = c.req.param("name");
  if (!/^[a-z]+-[0-9a-f]{16}\.[a-z0-9]+$/.test(name) || !UPLOAD_FOLDERS.includes(name.split("-")[0])) return c.notFound();
  if (!mediaSignatureOk.file(name, c.req.query("s")) && !(await readSession(c)) && !(await isPublicMedia(`/api/uploads/file/${name}`)))
    return c.json({ error: "locked" }, 401);
  try {
    const data = await readFile(path.join(LOCAL_DIR, name));
    const ext = name.split(".").pop();
    const type =
      Object.entries(EXT).find(([, e]) => e === ext)?.[0] ??
      "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Cache-Control": cacheFor(name),
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };
    const range = c.req.header("range");
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${data.length}` },
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, data.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(data.length - 1, Number(match[2]))
          : data.length - 1;
      if (start > end || start >= data.length)
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${data.length}` },
        });
      return new Response(data.subarray(start, end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${data.length}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(data, {
      headers: { ...headers, "Content-Length": String(data.length) },
    });
  } catch {
    return c.notFound();
  }
});

// All production uploads live in a PRIVATE Blob store. Public profile media is
// explicitly allowlisted from saved public settings; all other bytes require a session.
uploadRoutes.get("/media", async (c) => {
  const pathname = c.req.query("path");
  if (!(FOLDER_PATH.test(pathname ?? "") || /^saves\/[a-zA-Z0-9._-]+$/.test(pathname ?? "")))
    return c.notFound();
  const canonical = `/api/uploads/media?path=${encodeURIComponent(pathname)}`;
  // A signed link (the iPhone app's <img> tags can't send its token) or a session; otherwise only
  // media the public profile shows.
  if (!mediaSignatureOk.media(pathname, c.req.query("s")) && !(await readSession(c)) && (pathname.startsWith("saves/") || !(await isPublicMedia(canonical))))
    return c.json({ error: "locked" }, 401);
  if (!blobReadConfigured()) return c.json({ error: "not_configured" }, 503);
  const range = c.req.header("range");
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return new Response(null, { status: 416 });
  }
  const result = await get(pathname, {
    access: "private",
    ...blobOptions(),
    ...(range ? { headers: { Range: range } } : {}),
  });
  if (!result) return c.notFound();
  // Event and merch pictures stored before they were sized for phones (lib/events/images.js
  // fitImage) are shrunk on the way out, so no 7000 px photo ever reaches the app.
  const contentType = result.blob.contentType ?? "application/octet-stream";
  // (Measured in pixels, not bytes: a 432 KB JPEG can still be 6912 px wide, about 95 MB decoded.)
  if (!range && pathname.startsWith("events/") && /^image\/(?:jpeg|png|webp)$/.test(contentType)) {
    const original = Buffer.from(await new Response(result.stream).arrayBuffer());
    const body = await fitImage(original, contentType);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": cacheFor(pathname), "X-Content-Type-Options": "nosniff", "Content-Length": String(body.length) },
    });
  }
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": cacheFor(pathname),
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  for (const name of ["Content-Range", "Content-Length"])
    if (result.headers.get(name)) headers.set(name, result.headers.get(name));
  return new Response(result.stream, {
    status: headers.has("Content-Range") ? 206 : result.statusCode,
    headers,
  });
});

// A just-uploaded file's link in the form this client can show: plain for the website, absolute and
// signed for the iPhone app (the bearer middleware in app.js signs it on the way out).
uploadRoutes.get("/resolve", async (c) => {
  c.header("Cache-Control", "private, no-store");
  if (!(await readSession(c))) return c.json({ error: "locked" }, 401);
  const pathname = c.req.query("path") ?? "";
  if (!FOLDER_PATH.test(pathname)) return c.json({ error: "not_found", message: "That file isn’t one of ours." }, 404);
  return c.json({ url: `/api/uploads/media?path=${encodeURIComponent(pathname)}` });
});

// ---------- official wallpapers (chat backgrounds), only ever served after login ----------
// Miku: Crypton's official V6 art, used under its character guideline §E(3) (non-commercial,
// credit shown, never distributed publicly). Maomao: the anime's official phone wallpaper (Halloween
// 2025), resized only, © line kept. See docs/refactor/WALLPAPERS.md. Literal URLs let Vercel bundle them.
const WALLPAPER_FILES = {
  miku: new URL("../assets/wallpapers/miku.webp", import.meta.url),
  maomao: new URL("../assets/wallpapers/maomao.webp", import.meta.url),
};
uploadRoutes.get("/wallpapers/:key", async (c) => {
  const key = c.req.param("key");
  const file = WALLPAPER_FILES[key];
  if (!file) return c.json({ error: "not_found", message: "That background isn’t here." }, 404);
  if (!mediaSignatureOk.wallpaper(key, c.req.query("s")) && !(await readSession(c))) return c.json({ error: "locked" }, 401);
  const body = await readFile(file);
  c.header("Content-Type", "image/webp");
  c.header("Cache-Control", "private, max-age=31536000, immutable");
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(body);
});
