import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { useSession } from "./session.js";

export const prefsKey = ["me", "prefs"];

/** Choices the site keeps on the server, so the Home Screen app, Safari and every device agree. */
export function usePrefs() {
  const session = useSession();
  return useQuery({
    queryKey: prefsKey,
    queryFn: () => api("/me/prefs"),
    enabled: Boolean(session.data?.role),
    staleTime: 60_000,
  });
}

/** Saves a partial change, showing it straight away and rolling back if the save fails. */
export function useSetPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => api("/me/prefs", { method: "PATCH", body: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: prefsKey });
      const previous = queryClient.getQueryData(prefsKey);
      if (previous)
        queryClient.setQueryData(prefsKey, {
          ...previous,
          ...patch,
          sharing: { ...previous.sharing, ...patch.sharing },
          hints: { ...previous.hints, ...patch.hints },
        });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(prefsKey, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(prefsKey, data);
      if (data) queryClient.invalidateQueries({ queryKey: ["me", "public-preview"] });
    },
  });
}

export function useSetPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }) => api(`/me/pins/${id}`, { method: "PUT", body: { pinned } }),
    onSuccess: (data) => {
      queryClient.setQueryData(prefsKey, data);
      queryClient.invalidateQueries({ queryKey: ["me", "public-preview"] });
    },
  });
}
