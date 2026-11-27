import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api.js";

// Quizzes for each other: the screens' data (server/routes/quizzes.js). Everything lives under
// ["me", …] so pull to refresh and signing out clear it with the rest.
export const quizzesKey = ["me", "quizzes"];
export const summaryKey = ["me", "quizzes-summary"];
const quizKey = (id) => ["me", "quiz", id];
const historyKey = ["me", "quizzes-history"];

export const newClientId = () => `q${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 13)}`;
export const otherOf = (role) => (role === "admin" ? "kiriya" : "admin");
/** How the screens say their names: lowercase, in the site's voice. */
export const nameOf = (names, role) => String(names?.[role] ?? (role === "admin" ? "Josh" : "Kiriya")).toLowerCase();

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

export function useQuizzes() {
  return useQuery({
    queryKey: quizzesKey,
    queryFn: () => api("/me/quizzes"),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    // While the screen is open, a quiz or an answer from the other one shows up by itself.
    refetchInterval: () => (visible() ? 30_000 : false),
  });
}

export function useQuizSummary() {
  return useQuery({
    queryKey: summaryKey,
    queryFn: () => api("/me/quizzes/summary"),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
}

/** Finds a quiz in what the overview already has, so a screen opens instantly. */
function cached(queryClient, id) {
  const overview = queryClient.getQueryData(quizzesKey);
  const pages = queryClient.getQueryData(historyKey)?.pages ?? [];
  const lists = [overview?.waiting, overview?.sent, overview?.results, overview?.history, ...pages.map((p) => p.items)];
  for (const list of lists) {
    const found = list?.find((quiz) => quiz.id === id);
    if (found) return found;
  }
  return undefined;
}

export function useQuiz(id) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: quizKey(id),
    queryFn: () => api(`/me/quizzes/${encodeURIComponent(id)}`),
    initialData: () => cached(queryClient, id),
    initialDataUpdatedAt: () => queryClient.getQueryState(quizzesKey)?.dataUpdatedAt,
    staleTime: 5_000,
    retry: (count, error) => error?.status !== 404 && count < 2,
  });
}

export function useQuizHistory() {
  return useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam }) => api(`/me/quizzes/history${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null,
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: 30_000,
  });
}

function refreshAll(queryClient) {
  queryClient.invalidateQueries({ queryKey: quizzesKey });
  queryClient.invalidateQueries({ queryKey: summaryKey });
  queryClient.invalidateQueries({ queryKey: historyKey });
}

export function useSendQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quiz) => api("/me/quizzes", { method: "POST", body: quiz }),
    onSuccess: (quiz) => {
      queryClient.setQueryData(quizKey(quiz.id), quiz);
      refreshAll(queryClient);
    },
  });
}

export function useAnswerQuiz(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice) => api(`/me/quizzes/${encodeURIComponent(id)}/answer`, { method: "POST", body: { choice } }),
    onSuccess: (quiz) => {
      // A dry run (Josh in test mode, one of hers) is shown but not kept.
      if (!quiz.dryRun) queryClient.setQueryData(quizKey(id), quiz);
      refreshAll(queryClient);
    },
  });
}

export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/quizzes/${encodeURIComponent(id)}/seen`, { method: "POST", body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizzesKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/quizzes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: quizKey(id) });
      refreshAll(queryClient);
    },
  });
}

/** "just now", "5 min ago", "yesterday", "3 Dec". */
export function timeAgo(iso, now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toLowerCase();
}
