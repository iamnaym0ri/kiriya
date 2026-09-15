import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

export const sessionKey = ["session"];

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => api("/session"),
    staleTime: 60_000,
  });
}

export function useUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (passphrase) =>
      api("/session/unlock", { method: "POST", body: { passphrase } }),
    onSuccess: (data) => {
      queryClient.setQueryData(sessionKey, { role: data.role });
    },
  });
}

export function useLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/session/lock", { method: "POST", body: {} }),
    onSuccess: () => {
      window.dispatchEvent(new Event("kiriya:locked"));
      queryClient.clear();
      queryClient.setQueryData(sessionKey, { role: null });
    },
  });
}
