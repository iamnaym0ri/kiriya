import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAppToken } from "./api.js";
import { clearPersistedCache } from "./persist.js";
import { forgetThisPhone, isNativeApp } from "./native.js";

export const sessionKey = ["session"];

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => api("/session"),
    staleTime: 60_000,
    // Sessions last two days; coming back to the app is when that's most likely to have happened.
    refetchOnWindowFocus: true,
  });
}

/** Forgets everything private on this device and shows the passphrase again. */
export async function forgetSession(queryClient) {
  window.dispatchEvent(new Event("kiriya:locked"));
  await queryClient.cancelQueries();
  // Keep the session query so mounted providers receive the locked state.
  // Removing it first leaves their observers attached to the old record.
  queryClient.setQueryData(sessionKey, { role: null });
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
  // The app's bearer token and the copy kept on the device go too.
  setAppToken(null);
  await clearPersistedCache();
}

/** A request the server turned away because the session ended (two days passed, or signed out elsewhere). */
export const isSessionEnded = (error) => error?.status === 401 && error.code === "locked";

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
    mutationFn: async () => {
      // In the iPhone app, locking also forgets this phone, so Face ID can't reopen it.
      if (isNativeApp()) await forgetThisPhone();
      return api("/session/lock", { method: "POST", body: {} });
    },
    onSuccess: () => forgetSession(queryClient),
  });
}
