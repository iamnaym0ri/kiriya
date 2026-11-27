// The private chat's data on the phone (docs/refactor/PLAN.md phase 4). Messages are cached by
// TanStack Query; sends show instantly (optimistic) and are idempotent by clientId; live events
// come from Ably when configured, otherwise a light poll runs while the chat is open.
import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { openIncoming, sealOutgoing } from "./chatCrypto.js";

export const chatKey = ["me", "chat", "messages"];
export const chatPrefsKey = ["me", "chat", "prefs"];
export const chatSummaryKey = ["me", "chat", "summary"];
const CHANNEL = "kiriya-josh";
const POLL_MS = 4000;

export const newClientId = () => `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 13)}`;

// Everything that arrives is opened (src/lib/chatCrypto.js) before anything renders it: pages,
// catch-ups, a send's or edit's echo, and the summary's latest message.
const openPage = async (page) => ({ ...page, messages: await Promise.all((page.messages ?? []).map((m) => openIncoming(m))) });

export function useChatMessages() {
  return useInfiniteQuery({
    queryKey: chatKey,
    queryFn: async ({ pageParam, signal }) => openPage(await api(`/me/chat/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`, { signal })),
    initialPageParam: null,
    getNextPageParam: (page) => page.next ?? undefined,
    staleTime: 15_000,
  });
}

/** Oldest first, across every loaded page (page 0 is the newest). */
export const flatten = (data) => (data?.pages ?? []).slice().reverse().flatMap((page) => page.messages);
export const newestServerAt = (data) =>
  flatten(data)
    .filter((m) => !m.pending)
    .reduce((latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest), null);

/** Adds or replaces messages (matching id, or the optimistic copy by clientId) in the newest page. */
export function mergeMessages(queryClient, incoming, extra = {}) {
  queryClient.setQueryData(chatKey, (data) => {
    if (!data?.pages?.length) return data;
    const pages = data.pages.map((page) => ({ ...page, messages: page.messages.slice() }));
    for (const message of incoming) {
      let placed = false;
      for (const page of pages) {
        const i = page.messages.findIndex((m) => m.id === message.id || (message.clientId && m.clientId === message.clientId));
        if (i >= 0) {
          page.messages[i] = message;
          placed = true;
          break;
        }
      }
      if (!placed) pages[0].messages.push(message);
    }
    pages[0].messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    pages[0] = { ...pages[0], ...extra };
    return { ...data, pages };
  });
}

export function updateMessage(queryClient, id, change) {
  queryClient.setQueryData(chatKey, (data) =>
    data && { ...data, pages: data.pages.map((page) => ({ ...page, messages: page.messages.map((m) => (m.id === id ? change(m) : m)) })) },
  );
}

function setFirstPage(queryClient, change) {
  queryClient.setQueryData(chatKey, (data) => data?.pages?.length && { ...data, pages: [change(data.pages[0]), ...data.pages.slice(1)] });
}

/**
 * Keeps an open chat live: Ably events when the server has a key, otherwise a poll every few
 * seconds while the page is visible. Also carries typing and "here now".
 */
export function useChatLive({ live, me, enabled = true }) {
  const queryClient = useQueryClient();
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const channel = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const catchUp = useCallback(async () => {
    const data = queryClient.getQueryData(chatKey);
    if (!data) return;
    const newest = newestServerAt(data);
    // Live (Ably) events carry reactions, unsends and reads, so only new messages need fetching.
    // Without Ably, re-read the latest page instead, which also picks those changes up.
    const query = live && newest ? `?after=${encodeURIComponent(newest)}` : "";
    const page = await api(`/me/chat/messages${query}`).then(openPage).catch(() => null);
    if (!page) return;
    mergeMessages(queryClient, page.messages, { reads: page.reads, unread: page.unread });
    if (!live) setTyping(Boolean(page.typing));
  }, [queryClient, live]);

  const showTyping = useCallback(() => {
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 5000);
  }, []);

  useEffect(() => {
    if (!enabled || !me) return;
    let closed = false;
    let client = null;
    let poll = null;
    const onVisible = () => document.visibilityState === "visible" && catchUp();
    document.addEventListener("visibilitychange", onVisible);
    if (live) {
      import("ably")
        .then((Ably) => {
          if (closed) return;
          client = new Ably.Realtime({
            authCallback: (_params, done) => api("/me/chat/realtime").then((token) => done(null, token), (error) => done(error?.message ?? "auth", null)),
            echoMessages: false,
          });
          const ch = client.channels.get(CHANNEL);
          channel.current = ch;
          ch.subscribe("message", (event) => {
            // Their message arriving ends their "typing…".
            if (event.data?.sender && event.data.sender !== me) {
              clearTimeout(typingTimer.current);
              setTyping(false);
            }
            catchUp();
          });
          ch.subscribe("reaction", ({ data }) =>
            updateMessage(queryClient, data.messageId, (m) => {
              const reactions = { ...m.reactions };
              if (data.emoji) reactions[data.role] = data.emoji;
              else delete reactions[data.role];
              return { ...m, reactions };
            }),
          );
          ch.subscribe("deleted", ({ data }) => updateMessage(queryClient, data.id, (m) => ({ ...m, kind: "deleted", body: "", media: null })));
          ch.subscribe("read", ({ data }) => setFirstPage(queryClient, (page) => ({ ...page, reads: { ...page.reads, [data.role]: data.at } })));
          ch.subscribe("typing", (message) => message.clientId !== me && showTyping());
          const refreshPresence = () => ch.presence.get().then((members) => setOnline(members.some((m) => m.clientId !== me))).catch(() => {});
          ch.presence.subscribe(refreshPresence);
          ch.presence.enter().then(refreshPresence).catch(() => {});
          // After a dropped connection, fetch whatever arrived meanwhile.
          client.connection.on("connected", () => catchUp());
        })
        .catch(() => {});
    } else {
      poll = setInterval(() => document.visibilityState === "visible" && catchUp(), POLL_MS);
    }
    return () => {
      closed = true;
      clearInterval(poll);
      clearTimeout(typingTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current = null;
      client?.close();
    };
  }, [enabled, live, me, catchUp, queryClient, showTyping]);

  /** Call on every keystroke; it sends at most one "typing" every 2.5 s. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    if (channel.current) channel.current.publish("typing", {}).catch(() => {});
    else api("/me/chat/typing", { method: "POST", body: {} }).catch(() => {});
  }, []);

  return { typing, online, notifyTyping, catchUp };
}

export function useSendMessage(me) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message) =>
      openIncoming(
        await api("/me/chat/messages", {
          method: "POST",
          body: await sealOutgoing({ clientId: message.clientId, kind: message.kind, body: message.body ?? "", media: message.media, replyTo: message.replyTo?.id ?? null }),
        }),
      ),
    onMutate: (message) =>
      mergeMessages(queryClient, [{ reactions: {}, body: "", media: null, ...message, id: `pending-${message.clientId}`, sender: me, pending: true, failed: false, createdAt: new Date().toISOString() }]),
    onSuccess: (saved) => {
      mergeMessages(queryClient, [saved]);
      queryClient.invalidateQueries({ queryKey: chatSummaryKey });
    },
    onError: (_error, message) => updateMessage(queryClient, `pending-${message.clientId}`, (m) => ({ ...m, failed: true })),
  });
}

export function useReact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }) => api(`/me/chat/messages/${id}/reaction`, { method: "PUT", body: { emoji } }),
    onMutate: ({ id, emoji, me }) =>
      updateMessage(queryClient, id, (m) => {
        const reactions = { ...m.reactions };
        if (emoji) reactions[me] = emoji;
        else delete reactions[me];
        return { ...m, reactions };
      }),
  });
}

export function useUnsend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/me/chat/messages/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => updateMessage(queryClient, id, (m) => ({ ...m, kind: "deleted", body: "", media: null })),
  });
}

/** Marks everything read while the chat is open and visible (at most every few seconds). */
export function useMarkRead({ data, me, enabled }) {
  const queryClient = useQueryClient();
  const last = useRef(0);
  const newestFromThem = flatten(data).filter((m) => m.sender !== me && !m.pending).at(-1)?.createdAt;
  const readAt = data?.pages?.[0]?.reads?.[me];
  useEffect(() => {
    if (!enabled || !newestFromThem || (readAt && readAt >= newestFromThem)) return;
    if (document.visibilityState !== "visible" || Date.now() - last.current < 3000) return;
    last.current = Date.now();
    api("/me/chat/read", { method: "POST", body: {} })
      .then((reads) => {
        setFirstPage(queryClient, (page) => ({ ...page, reads, unread: 0 }));
        queryClient.setQueryData(chatSummaryKey, (summary) => summary && { ...summary, unread: 0 });
      })
      .catch(() => {});
  }, [enabled, newestFromThem, readAt, queryClient]);
}

export function useChatPrefs() {
  return useQuery({ queryKey: chatPrefsKey, queryFn: () => api("/me/chat/prefs"), staleTime: Infinity });
}
export function useSaveChatPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs) => api("/me/chat/prefs", { method: "PUT", body: prefs }),
    onMutate: (prefs) => queryClient.setQueryData(chatPrefsKey, (current) => ({ ...current, ...prefs })),
    onSuccess: (saved) => queryClient.setQueryData(chatPrefsKey, saved),
  });
}

export function useChatSummary({ enabled = true } = {}) {
  return useQuery({
    queryKey: chatSummaryKey,
    queryFn: async () => {
      const summary = await api("/me/chat/summary");
      return summary.last ? { ...summary, last: await openIncoming(summary.last) } : summary;
    },
    staleTime: 30_000,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useSaveMemory() {
  return useMutation({ mutationFn: ({ kind, sourceId, caption = "" }) => api("/me/memories", { method: "POST", body: { kind, sourceId, caption } }) });
}
