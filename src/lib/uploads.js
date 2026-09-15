import { api, ApiError } from "./api.js";

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
    const { upload } = await import("@vercel/blob/client");
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const result = await upload(`${folder}/${Date.now()}.${extension}`, file, {
      access: "private",
      handleUploadUrl: "/api/uploads/blob",
      contentType: file.type,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(percentage)
        : undefined,
    });
    return {
      url: `/api/uploads/media?path=${encodeURIComponent(result.pathname)}`,
      pathname: result.pathname,
    };
  }

  if (config.mode === "local") {
    const response = await fetch(
      `/api/uploads/local?folder=${encodeURIComponent(folder)}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": file.type, "x-kw": "1" },
        body: file,
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data);
    return { url: data.url, pathname: data.pathname };
  }

  throw new ApiError(503, { message: "File storage isn't connected yet." });
}
