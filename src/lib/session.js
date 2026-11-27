import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAppToken } from "./api.js";
import { setViewingAs, subscribeViewAs, viewingAs } from "./viewAs.js";
import { clearPersistedCache } from "./persist.js";
import { forgetThisPhone, isNativeApp } from "./native.js";

export const sessionKey = ["session"];

/** "kiriya" while Josh previews her side of the app (lib/viewAs.js), else null. */
export const useViewingAs = () => useSyncExternalStore(subscribeViewAs, viewingAs, () => null);

/**
 * The signed-in session. While Josh previews her side, `role` reads "kiriya" everywhere (so every
 * screen draws her version) and `realRole` still says "admin".
 */
export function useSession() {
  const as = useViewingAs();
  const select = useCallback(
    (data) => (as && data?.role === "admin" ? { ...data, role: as, realRole: data.role, previewing: true } : { ...data, realRole: data?.role ?? null }),
    [as],
  );
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => api("/session"),
    staleTime: 60_000,
    // Sessions last two days; coming back to the app is when that's most likely to have happened.
    refetchOnWindowFocus: true,
    select,
  });
}

/** Josh's sign-in: the same app as hers, plus the controls to change what she sees. */
export const useIsAdmin = () => useSession().data?.role === "admin";

/** Who is really signed in on this phone, preview or not (device pieces: widgets, badges). */
export const useRealRole = () => useSession().data?.realRole ?? null;

/**
 * Starts or ends the preview. Everything loaded so far was Josh's view, so it is dropped (and the
 * copy kept on the device) and loads again from her side, or back from his.
 */
export async function switchViewAs(queryClient, value) {
  await queryClient.cancelQueries();
  setViewingAs(value);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
  await clearPersistedCache().catch(() => {});
}

/** Forgets everything private on this device and shows the passphrase again. */
export async function forgetSession(queryClient) {
  window.dispatchEvent(new Event("kiriya:locked"));
  setViewingAs(null);
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

/**
 * The passphrase sign-in (every screen that takes a typed passphrase goes through here). The typed
 * passphrase never outlives the moment: the mutation leaves the cache as soon as nothing watches
 * it (gcTime 0), and a successful unlock is reset at once, which drops it from the mutation's state.
 */
export function useUnlock() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (passphrase) =>
      api("/session/unlock", { method: "POST", body: { passphrase } }),
    gcTime: 0,
    // eslint-disable-next-line no-unused-vars
    onSuccess: (data, passphrase) => {
      queryClient.setQueryData(sessionKey, { role: data.role });
      // ↓ Round 3 (r3-chat-room): hand `passphrase` to src/lib/chatCrypto.js here, in memory only,
      //   before the reset below drops it.
    },
  });
  const { isSuccess, reset } = mutation;
  useEffect(() => {
    if (isSuccess) reset();
  }, [isSuccess, reset]);
  return mutation;
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
