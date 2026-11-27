import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../lib/api.js";
import { uploadFile } from "../../../../../lib/uploads.js";
import { sendPhotoToChat, useChatSummary } from "../../../../../lib/chat.js";
import { useSession } from "../../../../../lib/session.js";
import { haptic } from "../../../../../lib/native.js";

// Sending what she made: into the chat as a photo (the chat's own upload + send, nothing of the
// chat's screens touched), or into her doodle gallery (the same route the sketchbook's "keep" uses).

/** Who the chat goes to, by name: "Josh" on her phone, "Kiriya" on his. */
export function usePartner() {
  const me = useSession().data?.role ?? null;
  const summary = useChatSummary({ enabled: Boolean(me) });
  const names = summary.data?.names;
  const partner = me === "admin" ? names?.kiriya ?? "Kiriya" : names?.admin ?? "Josh";
  return { me, partner };
}

export function useArtShare() {
  const client = useQueryClient();
  const { partner } = usePartner();
  const toChat = useMutation({
    // The chat's own helper: sealed, uploaded and sent like a photo from the chat itself.
    mutationFn: async ({ make, caption = "", alt = "a little picture" }) => {
      const { file, width, height } = await make();
      return sendPhotoToChat({ file, width, height, alt, caption }, client);
    },
    onSuccess: () => haptic("success"),
  });
  // Resolves to the saved artwork ({ id, url, prompt, … }), so a game can link straight to it.
  // Titles name the kind for her gallery's filters (src/world/play/gallery/kinds.js):
  // "a little kaleidoscope…", "paper doll · <look>", "bouquet · <name>".
  const toDoodles = useMutation({
    mutationFn: async ({ make, title }) => {
      const { file, width, height } = await make();
      const stored = await uploadFile(file, { folder: "art" });
      return api("/me/artworks", { method: "POST", body: { ...stored, width, height, prompt: title } });
    },
    onSuccess: () => {
      haptic("success");
      client.invalidateQueries({ queryKey: ["me", "artworks"] });
    },
  });
  return { partner, toChat, toDoodles };
}

/**
 * Opens her gallery from inside a game (on one artwork when `id` is given). It replaces the game's
 * history entry, so the game's sheet closes and back from the gallery returns to play.
 */
export function useOpenGallery() {
  const navigate = useNavigate();
  return useCallback(
    (id) => navigate(`/world/play?gallery=1${id ? `&doodle=${encodeURIComponent(id)}` : ""}`, { replace: true }),
    [navigate],
  );
}

/** A canvas as a PNG file ready to upload. */
export async function canvasFile(canvas, name) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture couldn’t be made. Try again?");
  return { file: new File([blob], `${name}-${Date.now()}.png`, { type: "image/png" }), width: canvas.width, height: canvas.height };
}

/** Loads a picture for drawing onto a canvas (same-origin, or a signed link served with CORS). */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    if (!/^(blob|data):/.test(src)) {
      try {
        if (new URL(src, location.href).origin !== location.origin) image.crossOrigin = "anonymous";
      } catch {
        // an odd link: leave it as it is
      }
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A picture didn’t load. Try again?"));
    image.src = src;
  });
}

/** Draws a live <svg> element (as she sees it) onto a canvas at x, y, w, h. */
export async function drawSvg(ctx, svg, x, y, w, h) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    ctx.drawImage(image, x, y, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
