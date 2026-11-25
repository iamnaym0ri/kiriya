import { api, ApiError, apiUrl, authHeaders, isBundledApp } from "./api.js";

let configPromise;
function uploadConfig() {
  configPromise ??= api("/uploads/config").catch((error) => {
    configPromise = undefined;
    throw error;
  });
  return configPromise;
}

/** Shrinks a photo on the phone before upload (max edge, WebP when supported). Drawings pass through. */
export async function shrinkImage(file, maxEdge = 1600, quality = 0.86) {
  if (!file.type.startsWith("image/") || file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob || blob.type !== "image/webp") {
    const jpeg = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return new File([jpeg], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  }
  return new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
    type: "image/webp",
  });
}

/**
 * Uploads a file to Vercel Blob in production (straight from the phone), or to the dev server's
 * local folder in development. Returns { url, pathname }.
 */
export async function uploadFile(file, { folder = "art", onProgress } = {}) {
  const config = await uploadConfig();
  if (file.size > config.maxBytes)
    throw new ApiError(413, { message: "Files can be up to 15 MB." });

  if (config.mode === "blob") {
    const { upload, uploadPresigned } = await import("@vercel/blob/client");
    const uploadToBlob = config.uploadType === "presigned" ? uploadPresigned : upload;
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    // Unique and never reused, so chat media can be cached on the phone for good.
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await uploadToBlob(`${folder}/${name}.${extension}`, file, {
      access: "private",
      handleUploadUrl: apiUrl("/uploads/blob"),
      // Inside the iPhone app the handshake carries the bearer token (there's no cookie there).
      headers: authHeaders(),
      contentType: file.type,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(percentage)
        : undefined,
    });
    const url = `/api/uploads/media?path=${encodeURIComponent(result.pathname)}`;
    // The app shows private files through signed links, which only the server can make.
    if (isBundledApp) return { url: (await api(`/uploads/resolve?path=${encodeURIComponent(result.pathname)}`)).url, pathname: result.pathname };
    return { url, pathname: result.pathname };
  }

  if (config.mode === "local") {
    const response = await fetch(
      apiUrl(`/uploads/local?folder=${encodeURIComponent(folder)}`),
      {
        method: "POST",
        credentials: isBundledApp ? "omit" : "same-origin",
        headers: { "Content-Type": file.type, "x-kw": "1", ...authHeaders() },
        body: file,
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data);
    return { url: data.url, pathname: data.pathname };
  }

  throw new ApiError(503, { message: "File storage isn't connected yet." });
}
