import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

// The app home's own data (server/routes/home.js): Josh's greeting, photos, captions, pinboard and
// the songs for her to discover, plus what this person has already heard and seen. Rechecked when
// the app comes back to the front, so his changes are there the next time she opens it.
export const homeKey = ["me", "home"];

export function useHome() {
  return useQuery({
    queryKey: homeKey,
    queryFn: ({ signal }) => api("/me/home", { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Josh's edits: each answers with the whole home as he now sees it. */
export function useHomeEdit(path, method = "PUT") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/me/home${typeof path === "function" ? path(body) : path}`, { method, body: method === "DELETE" ? undefined : stripId(body) }),
    onSuccess: (data) => {
      const home = data?.home ?? (data?.pins ? data : null);
      if (home) queryClient.setQueryData(homeKey, home);
      else queryClient.invalidateQueries({ queryKey: homeKey });
    },
  });
}

// Path-builder mutations carry the id in the body; the server wants it in the path only.
function stripId(body) {
  if (!body || typeof body !== "object" || !("__id" in body)) return body;
  const { __id, ...rest } = body;
  return rest;
}

/** Song edits go through the songs routes and refresh both the home card and her song shelf. */
export function useSongEdit() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: homeKey });
    queryClient.invalidateQueries({ queryKey: ["me", "songs"] });
  };
  return {
    add: useMutation({ mutationFn: (body) => api("/me/songs", { method: "POST", body }), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, ...body }) => api(`/me/songs/${id}`, { method: "PATCH", body }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id) => api(`/me/songs/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}

/**
 * "She's heard it" / "she's looked at the board". Only the server changes now: the little "new"
 * marks stay for the rest of this visit and are gone the next time she opens the app.
 */
export function useMarkSeen() {
  return useMutation({ mutationFn: (body) => api("/me/home/seen", { method: "POST", body }) });
}
