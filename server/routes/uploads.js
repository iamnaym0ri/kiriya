import { randomBytes } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Hono } from "hono";
import { handleUpload } from "@vercel/blob/client";
import { env } from "../env.js";
import { readSession } from "../auth/session.js";
import { isPublicMedia } from "../lib/media.js";

const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
];
const MAX_BYTES = 15 * 1024 * 1024;
const LOCAL_DIR = path.resolve(".data/uploads");
const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
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

uploadRoutes.get("/config", (c) => {
  if (!readSession(c))
    return c.json(
      { error: "locked", message: "Enter the passphrase to open this." },
      401,
    );
  return c.json({
    mode: env.blobToken ? "blob" : env.isProd ? "unavailable" : "local",
    maxBytes: MAX_BYTES,
    allowed: ALLOWED,
  });
});

// Vercel Blob client uploads. The browser asks for a short-lived token here (session required), then
// sends the file straight to Blob storage, so large photos never pass through this function.
uploadRoutes.post("/blob", async (c) => {
  if (!env.blobToken)
    return c.json(
      { error: "not_configured", message: "File storage isn't connected yet." },
      503,
    );
  const body = await c.req.json();
  if (body?.type === "blob.generate-client-token" && !readSession(c)) {
    return c.json(
      { error: "locked", message: "Enter the passphrase to upload." },
      401,
    );
  }
  try {
    const result = await handleUpload({
      token: env.blobToken,
      body,
      request: c.req.raw,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^(art|avatar|cosplay|songs|photos)\//.test(pathname))
          throw new Error("Unexpected upload folder");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: "upload_failed", message: error.message }, 400);
  }
});

// Development stand-in for Blob storage: files land in .data/uploads and are served back by /api/uploads/file.
uploadRoutes.post("/local", async (c) => {
  if (env.isProd)
    return c.json(
      { error: "not_found", message: "Nothing lives at this address." },
      404,
    );
  if (!readSession(c))
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
  if (!["art", "avatar", "cosplay", "songs", "photos"].includes(folder))
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
  if (!/^[a-z]+-[0-9a-f]{16}\.[a-z0-9]+$/.test(name)) return c.notFound();
  if (!readSession(c) && !(await isPublicMedia(`/api/uploads/file/${name}`)))
    return c.json({ error: "locked" }, 401);
  try {
    const data = await readFile(path.join(LOCAL_DIR, name));
    const ext = name.split(".").pop();
    const type =
      Object.entries(EXT).find(([, e]) => e === ext)?.[0] ??
      "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
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
  if (
    !/^(art|avatar|cosplay|songs|photos)\/[a-zA-Z0-9._-]+$/.test(pathname ?? "")
  )
    return c.notFound();
  const canonical = `/api/uploads/media?path=${encodeURIComponent(pathname)}`;
  if (!readSession(c) && !(await isPublicMedia(canonical)))
    return c.json({ error: "locked" }, 401);
  if (!env.blobToken) return c.json({ error: "not_configured" }, 503);
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, {
    access: "private",
    token: env.blobToken,
    ...(c.req.header("range")
      ? { headers: { Range: c.req.header("range") } }
      : {}),
  });
  if (!result) return c.notFound();
  const headers = new Headers({
    "Content-Type": result.blob.contentType ?? "application/octet-stream",
    "Cache-Control": "private, no-store",
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
