import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

export const notesKey = ["me", "notes"];

/** Notes that have arrived. Rechecked when the app comes back to the front, like a mailbox. */
export function useNotes() {
  const query = useQuery({
    queryKey: notesKey,
    queryFn: () => api("/me/notes"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });
  const unread = query.data?.unread;
  // The Home Screen icon's badge follows what's actually unread.
  useEffect(() => {
    if (unread === undefined) return;
    if (unread > 0) navigator.setAppBadge?.(unread).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }, [unread]);
  return query;
}

export function useOpenNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/notes/${id}/open`, { method: "POST", body: {} }),
    onSuccess: ({ note }) =>
      queryClient.setQueryData(notesKey, (old) => {
        if (!old) return old;
        const notes = old.notes.map((item) => (item.id === note.id ? note : item));
        return { notes, unread: notes.filter((item) => !item.openedAt).length };
      }),
  });
}

/** Hearts or emoji-reacts to a note. It shows straight away; a failed save puts the old one back. */
export function useReactToNote() {
  const queryClient = useQueryClient();
  const patch = (id, reaction) =>
    queryClient.setQueryData(notesKey, (old) => old && { ...old, notes: old.notes.map((item) => (item.id === id ? { ...item, reaction } : item)) });
  return useMutation({
    mutationFn: ({ id, reaction }) => api(`/me/notes/${id}/reaction`, { method: "PUT", body: { reaction } }),
    onMutate: async ({ id, reaction }) => {
      await queryClient.cancelQueries({ queryKey: notesKey });
      const previous = queryClient.getQueryData(notesKey)?.notes.find((item) => item.id === id)?.reaction ?? null;
      patch(id, reaction);
      return { previous };
    },
    onError: (_error, { id }, context) => {
      patch(id, context?.previous ?? null);
      queryClient.invalidateQueries({ queryKey: notesKey });
    },
  });
}
