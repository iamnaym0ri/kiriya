import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api.js";

// YouTube songs play in YouTube's own visible player (their terms: at least 200×200, never in the
// background). The player sits inside a small page on this site's own address
// (server/routes/home.js, /api/embed/youtube): the iPhone app's capacitor:// pages send YouTube no
// Referer, which its player now requires. The page reports the length and play state back.

const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(input) {
  try {
    const url = new URL(String(input).trim());
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com")
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
    return id && ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const youtubePlayerUrl = (id, { autoplay = false, probe = false } = {}) =>
  apiUrl(`/embed/youtube?v=${encodeURIComponent(id)}${autoplay ? "&autoplay=1" : ""}${probe ? "&probe=1" : ""}`);

/**
 * Messages from one embedded player: { ready, duration, playing, error }. `frame` is the iframe
 * element (messages from any other frame are ignored).
 */
export function useYoutubeEvents(frame, id) {
  const [state, setState] = useState({ ready: false, duration: null, playing: false, error: null });
  useEffect(() => {
    setState({ ready: false, duration: null, playing: false, error: null });
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== "kw-youtube" || data.v !== id) return;
      if (frame.current && event.source !== frame.current.contentWindow) return;
      setState((old) => {
        const duration = data.duration > 0 ? Math.round(data.duration) : old.duration;
        if (data.type === "ready") return { ...old, ready: true, duration };
        if (data.type === "duration") return { ...old, duration };
        if (data.type === "state") return { ...old, duration, playing: data.state === 1 || data.state === 3 };
        if (data.type === "error") return { ...old, error: data.code };
        return old;
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, id]);
  return state;
}
