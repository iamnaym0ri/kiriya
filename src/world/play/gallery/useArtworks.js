import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api.js";
import { useToday } from "../../../lib/world.js";
import { HEART } from "../../../../shared/reactions.js";

// Her saved artwork (GET /me/artworks: newest first, each with Josh's reaction and the notes he
// left on it). The play section's gallery card, the gallery screen and the sketchbook share this
// one cache entry, so a doodle she keeps shows up everywhere at once.

export const ARTWORKS_KEY = ["me", "artworks"];

export function useArtworks() {
  const query = useQuery({ queryKey: ARTWORKS_KEY, queryFn: () => api("/me/artworks"), staleTime: 30_000, refetchOnWindowFocus: true });
  const artworks = query.data?.artworks ?? [];
  const withNews = artworks.filter((art) => art.notes?.some((note) => !note.seenAt));
  return { query, artworks, withNews };
}

/** Josh's signature, as she sees it beside his notes ("josh" until today's data says otherwise). */
export const useSignature = () => useToday().data?.signature ?? "josh";

export const reactionGlyph = (reaction) => (reaction === HEART ? "♥" : reaction);
export const isHeart = (reaction) => reaction === HEART;

/** Opening a doodle marks Josh's notes on it seen (the server ignores this from his sign-in). */
export function useMarkNotesSeen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/artworks/${id}/notes/seen`, { method: "POST", body: {} }),
    onSuccess: ({ seen }) => {
      if (seen) client.invalidateQueries({ queryKey: ARTWORKS_KEY });
    },
  });
}

export function useRemoveArtwork() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/artworks/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      client.setQueryData(ARTWORKS_KEY, (old) => old && { ...old, artworks: old.artworks.filter((art) => art.id !== id) });
      client.invalidateQueries({ queryKey: ARTWORKS_KEY });
    },
  });
}
