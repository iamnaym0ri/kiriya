import { useEffect, useLayoutEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../lib/api.js";
import { haptic } from "../../../../../lib/native.js";

export { haptic };

/** False while the app is in the background or the tab is hidden: games pause their clocks. */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

const lessMotion = () =>
  typeof matchMedia !== "undefined" &&
  (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.littleMotion === "off");

/** Reduce Motion on the phone, or the site's own "little motion: off" setting. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(lessMotion);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(lessMotion());
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** The stage's own size (the hub's sheet, not the window), kept current as it changes. */
export function useStageSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setSize((old) => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      return old.width === width && old.height === height ? old : { width, height };
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

// ---------- the luck shelf's server state (server/routes/gamesLuck.js) ----------

export const LUCK_KEY = ["me", "games", "luck"];

/** Her luck state (capsule turns, charms, fortunes, best streaks), refreshed whenever she comes back. */
export function useLuck() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: LUCK_KEY, queryFn: () => api("/me/games/luck"), staleTime: 30_000 });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") client.invalidateQueries({ queryKey: LUCK_KEY });
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [client]);
  return query;
}

/** A write to the luck API that refreshes the shared state from the server's answer. */
export function useLuckAction(path) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body = {}) => api(`/me/games/luck/${path}`, { method: "POST", body }),
    onSuccess: (data) => {
      if (data?.luck) client.setQueryData(LUCK_KEY, data.luck);
    },
    onError: (error) => {
      if (error?.status === 429) client.invalidateQueries({ queryKey: LUCK_KEY });
    },
  });
}

/** Saves a best streak; returns { previous, best } (the previous best decides a first milestone). */
export function useSaveBest() {
  return useLuckAction("best");
}
