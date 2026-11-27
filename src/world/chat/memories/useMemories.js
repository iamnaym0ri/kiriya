// "Our memories" data: one list per shelf (messages, pictures, voice notes, letters & notes), newest
// first, with saved chat messages opened (they're sealed like the chat itself; src/lib/chatCrypto).
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api.js";
import { openMemorySnapshot } from "../../../lib/chatCrypto.js";

export const SHELVES = [
  { key: "messages", label: "messages", icon: "message", empty: "hold a message in the chat and tap “save to our memories” ✿" },
  { key: "pictures", label: "pictures", icon: "picture", empty: "photos, videos, GIFs and stickers you save from the chat live here" },
  { key: "voice", label: "voice notes", icon: "voice", empty: "save a voice note from the chat to hear it again any time ♡" },
  { key: "letters", label: "letters & notes", icon: "letter", empty: "the ♡ under a letter, a little note or a jar note keeps it here" },
];

export const memoriesKey = (shelf) => ["me", "memories", shelf];

async function openItem(memory) {
  if (memory.kind !== "message") return memory;
  const snapshot = await openMemorySnapshot(memory.snapshot);
  return { ...memory, snapshot };
}

export function useMemoryShelf(shelf) {
  return useInfiniteQuery({
    queryKey: memoriesKey(shelf),
    queryFn: async ({ pageParam, signal }) => {
      const query = new URLSearchParams({ shelf, ...(pageParam ? { before: pageParam } : {}) });
      const page = await api(`/me/memories?${query}`, { signal });
      return { ...page, items: await Promise.all(page.items.map(openItem)) };
    },
    initialPageParam: null,
    getNextPageParam: (page) => page.next ?? undefined,
    staleTime: 30_000,
  });
}

export function useRemoveMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/memories/${id}`, { method: "DELETE" }),
    onMutate: (id) => {
      // Gone at once from every shelf; the counts follow on the next load.
      queryClient.setQueriesData({ queryKey: ["me", "memories"] }, (data) =>
        data?.pages ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== id) })) } : data,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["me", "memories"] }),
  });
}

/** Every picture inside a saved message (an album, a single photo, a GIF or a sticker). */
export function picturesOf(memory) {
  const s = memory.snapshot ?? {};
  if (s.locked || !s.media) return [];
  if (Array.isArray(s.media.items)) return s.media.items.map((item) => ({ ...item, type: item.type ?? "image" }));
  if (s.kind === "gif") return [{ type: "gif", ...s.media }];
  if (s.kind === "sticker") return [{ type: "sticker", ...s.media }];
  return [{ type: "image", ...s.media }];
}
