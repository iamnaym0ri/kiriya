import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

export const todayKey = ["me", "today"];

export function useToday() {
  return useQuery({
    queryKey: todayKey,
    queryFn: () => api("/me/today"),
    staleTime: Infinity,
  });
}

export function useSetMood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: body => api("/me/mood", { method: "PUT", body }),
    onSuccess: data => {
      queryClient.setQueryData(["me", "mood"], data);
      queryClient.invalidateQueries({ queryKey: ["me", "address"] });
    },
  });
}

export function useOpenDrawer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/me/drawer", { method: "POST", body: {} }),
    onSuccess: (data) => {
      queryClient.setQueryData(todayKey, (old) =>
        old ? { ...old, drawer: { opened: true, reward: data.reward } } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["me", "stickers"] });
    },
  });
}

/** Keeps <html data-mood> in sync with today's check-in, and clears it when leaving the world. */
export function useMoodTheme(moodKey) {
  useEffect(() => {
    const root = document.documentElement;
    if (moodKey) root.dataset.mood = moodKey;
    else delete root.dataset.mood;
  }, [moodKey]);
  useEffect(() => () => delete document.documentElement.dataset.mood, []);
}
