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
    mutationFn: ({ mood, energy }) =>
      api("/me/mood", { method: "PUT", body: { mood, energy } }),
    onMutate: async ({ mood }) => {
      // Recolour immediately; the server answer fills in the rest.
      document.documentElement.dataset.mood = mood;
    },
    onSuccess: (mood) => {
      queryClient.setQueryData(todayKey, (old) =>
        old ? { ...old, mood } : old,
      );
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
