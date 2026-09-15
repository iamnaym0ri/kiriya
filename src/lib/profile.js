import { useQuery } from "@tanstack/react-query";
import { api } from "./api.js";

export function usePublicProfile() {
  return useQuery({
    queryKey: ["public-profile"],
    queryFn: () => api("/public/profile"),
    staleTime: 30_000,
  });
}

// One view per browser tab, so refreshing doesn't inflate the count.
export async function countView() {
  try {
    if (sessionStorage.getItem("kw:viewed")) return null;
    sessionStorage.setItem("kw:viewed", "1");
  } catch {
    // Storage can be blocked; count the view anyway.
  }
  try {
    return (await api("/public/view", { method: "POST", body: {} })).views;
  } catch {
    return null;
  }
}
