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
