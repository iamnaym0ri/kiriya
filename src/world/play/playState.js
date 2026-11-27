import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

// The play hub's data (server/routes/play.js): her sticker collection, the sticker catalogue, and
// the games whoever is signed in has opened (for the "new" marks).
export const playKey = ["me", "play"];

export function usePlayState() {
  return useQuery({ queryKey: playKey, queryFn: () => api("/me/play"), staleTime: 60_000 });
}

/** Opening a game takes its "new" mark away at once, and tells the server. */
export function useMarkPlayed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (game) => api("/me/play/played", { method: "POST", body: { game } }),
    onMutate: (game) => {
      queryClient.setQueryData(playKey, (old) => (old && !old.played.includes(game) ? { ...old, played: [...old.played, game] } : old));
    },
    onSuccess: ({ played }) => queryClient.setQueryData(playKey, (old) => (old ? { ...old, played } : old)),
  });
}

/** A game's reward: saved into her collection (her sign-in), a preview on Josh's. */
export function useReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sticker, game, reason }) => api("/me/stickers", { method: "POST", body: { sticker, game, reason: String(reason ?? "played").slice(0, 80) } }),
    onSuccess: (result) => {
      if (result.saved) {
        queryClient.invalidateQueries({ queryKey: playKey });
        queryClient.invalidateQueries({ queryKey: ["me", "stickers"] });
      }
    },
  });
}
